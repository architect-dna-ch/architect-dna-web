import { list, put, del } from '@vercel/blob';
import crypto from 'node:crypto';

// Social-Mediathek — a public photo portfolio per handle (/social-mediathek/<handle>), for an
// Instagram bio link. Anyone can view; only the owner (with their access code) can upload, caption
// or delete. Owners are fixed here by the SHA-256 of their code — the code itself is never stored.
//
// Photos arrive already resized on the phone (≤ 2400 px JPEG, which also drops EXIF/GPS) and are
// stored as public blobs. The photo files themselves are the truth: listing them is consistent, while
// an overwritten JSON blob can be served stale for up to a minute (that lost 7 of 11 uploads). So an
// upload only writes its image; a small meta JSON (profile, captions, order) is saved under a fresh
// name each time, the newest one wins, and any image it doesn't know yet is added on read.
const OWNERS = {
  muh4rrrem: '39fd9ea17ca8854ac559996bd3ad1b70cdc6c4ca509fa78b0db1bd666400415c',
};
const ADMIN = 'muh4rrrem';            // reviews applications and admits new photographers

/* Admitted photographers live in Blob (mediathek/owners-*.json, newest wins — same trick as the meta),
 * merged with the fixed ones above. Cached for 30 s per instance. */
let ownersCache = null, ownersAt = 0;
async function owners(fresh) {
  if (!fresh && ownersCache && Date.now() - ownersAt < 30_000) return ownersCache;
  let extra = {};
  try {
    const r = await list({ prefix: 'mediathek/owners-', limit: 1000 });
    const newest = r.blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    if (newest) extra = await (await fetch(newest.url, { cache: 'no-store' })).json();
  } catch (e) { /* only the fixed ones */ }
  ownersCache = { ...extra, ...OWNERS }; ownersAt = Date.now();
  return ownersCache;
}
async function saveOwners(map) {
  const extra = { ...map }; for (const k of Object.keys(OWNERS)) delete extra[k];
  await put(`mediathek/owners-${Date.now()}.json`, JSON.stringify(extra), { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
  const r = await list({ prefix: 'mediathek/owners-', limit: 1000 });
  const old = r.blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(1).map(b => b.url);
  if (old.length) { try { await del(old); } catch (e) { /* harmless */ } }
  ownersCache = null;
}
const applyHits = new Map();             // ip → [timestamps]: 5 applications per hour per address
function rateOk(ip) {
  const now = Date.now(), a = (applyHits.get(ip) || []).filter(t => now - t < 3_600_000);
  if (a.length >= 5) return false;
  a.push(now); applyHits.set(ip, a); return true;
}
const camSlug = c => String(c || '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, 48);
const newCode = () => { const h = crypto.randomBytes(12).toString('hex').toUpperCase(); return h.match(/.{6}/g).join('-'); };
const MAX_IMAGE_CHARS = 4_000_000;   // ~3 MB of JPEG as base64, under the 4.5 MB request limit
const MAX_PHOTOS = 300;

// codes are compared without dashes/spaces and case: E2F394-45A7… == e2f39445a7…
const normCode = s => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const handleOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
// <id>_<w>x<h>[_<camera>].<ext> — the camera ("Google-Pixel-9a") comes from the original photo's EXIF
const IMG = /\/([0-9a-f]{16})(?:_(\d+)x(\d+))?(?:_([A-Za-z0-9-]{1,48}))?\.(jpg|webp|png)$/;

async function listAll(u) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix: `portfolio/${u}/`, limit: 1000, cursor });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

/** {d, old}: the newest meta merged with every image blob; old = meta blobs to drop after a save. */
async function load(u) {
  const blobs = await listAll(u);
  const metas = blobs.filter(b => /\/(meta-[^/]+|index)\.json$/.test(b.pathname))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  let d = null;
  for (const m of metas) {
    try { d = await (await fetch(m.url, { cache: 'no-store' })).json(); break; } catch (e) { /* try older */ }
  }
  d = d || { profile: { name: '', bio: '', instagram: u }, photos: [] };
  const files = new Map();
  for (const b of blobs) {
    const m = b.pathname.match(IMG);
    if (m) files.set(m[1], { b, w: +m[2] || 0, h: +m[3] || 0, cam: m[4] ? m[4].replace(/-/g, ' ') : '' });
  }
  const known = new Set();
  d.photos = (d.photos || []).filter(p => files.has(p.id) && !known.has(p.id) && known.add(p.id))
    .map(p => ({ ...p, cam: files.get(p.id).cam }));
  const fresh = [...files].filter(([id]) => !known.has(id))
    .sort((a, b) => new Date(b[1].b.uploadedAt) - new Date(a[1].b.uploadedAt))
    .map(([id, f]) => ({ id, url: f.b.url, caption: '', w: f.w, h: f.h, cam: f.cam, at: +new Date(f.b.uploadedAt) }));
  d.photos = [...fresh, ...d.photos];
  return { d, old: metas };
}
async function save(u, d, old) {
  await put(`portfolio/${u}/meta-${Date.now()}.json`, JSON.stringify(d),
    { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
  const stale = old.map(b => b.url);
  if (stale.length) { try { await del(stale); } catch (e) { /* harmless leftovers */ } }
}

async function isOwner(u, key) {
  const want = (await owners())[u];
  if (!want || !key) return false;
  const got = sha(normCode(key));
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const u = handleOf(req.query.u);
    if (!(await owners())[u]) return res.status(404).json({ error: 'unknown profile' });
    let d;
    try { ({ d } = await load(u)); } catch (e) { return res.status(503).json({ error: 'storage error' }); }
    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=10');
    return res.status(200).json({
      handle: u,
      profile: d.profile,
      photos: (d.photos || []).map(({ id, url, caption, w, h, cam, at }) => ({ id, url, caption, w, h, cam: cam || '', at })),
    });
  }

  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-store');
  const b = req.body || {};

  /* ---- anyone: apply for a gallery (name, wished handle, Instagram, e-mail, 3 camera photos) ---- */
  if (b.action === 'apply') {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
    if (!rateOk(ip)) return res.status(429).json({ error: 'too many' });
    const wish = handleOf(b.wish), email = clip(b.email, 120);
    if (!wish || wish.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'missing fields' });
    if ((await owners())[wish]) return res.status(409).json({ error: 'handle taken' });
    const photos = Array.isArray(b.photos) ? b.photos.slice(0, 3) : [];
    if (photos.length < 3) return res.status(400).json({ error: 'three photos' });
    const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    try {
      const shots = [];
      for (let i = 0; i < 3; i++) {
        const m = String(photos[i].image || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
        const cam = camSlug(photos[i].cam);
        if (!m || !cam) return res.status(422).json({ error: 'no camera' });
        if (m[1].length > 1_400_000) return res.status(413).json({ error: 'image too large' });
        const blob = await put(`mediathek/apply/${id}/${i}_${cam}.jpg`, Buffer.from(m[1], 'base64'),
          { access: 'public', addRandomSuffix: true, contentType: 'image/jpeg' });
        shots.push({ url: blob.url, cam: cam.replace(/-/g, ' ') });
      }
      await put(`mediathek/apply/${id}/a.json`, JSON.stringify({
        id, at: Date.now(), name: clip(b.name, 60), wish, instagram: handleOf(b.instagram), email,
        why: clip(b.why, 300), shots,
      }), { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'storage error' });
    }
  }

  const u = handleOf(b.u);
  if (!(await owners())[u]) return res.status(404).json({ error: 'unknown profile' });
  if (!(await isOwner(u, b.key))) return res.status(403).json({ error: 'wrong code' });

  /* ---- admin: review applications, admit or decline ---- */
  if (b.action === 'applications' || b.action === 'approve' || b.action === 'reject') {
    if (u !== ADMIN) return res.status(403).json({ error: 'not admin' });
    try {
      const r = await list({ prefix: 'mediathek/apply/', limit: 1000 });
      if (b.action === 'applications') {
        const metas = r.blobs.filter(x => /\/a-?[^/]*\.json$/.test(x.pathname) || x.pathname.endsWith('/a.json'));
        const apps = [];
        for (const m of metas) { try { apps.push(await (await fetch(m.url, { cache: 'no-store' })).json()); } catch (e) { /* skip */ } }
        apps.sort((x, y) => y.at - x.at);
        return res.status(200).json({ ok: true, applications: apps });
      }
      const aid = String(b.id || '').replace(/[^a-z0-9]/g, '');
      const mine = r.blobs.filter(x => x.pathname.startsWith(`mediathek/apply/${aid}/`));
      if (!aid || !mine.length) return res.status(404).json({ error: 'no such application' });
      if (b.action === 'approve') {
        const handle = handleOf(b.handle);
        if (!handle || handle.length < 3) return res.status(400).json({ error: 'bad handle' });
        const map = await owners(true);
        if (map[handle]) return res.status(409).json({ error: 'handle taken' });
        const code = newCode();
        map[handle] = sha(normCode(code));
        await saveOwners(map);
        try { await del(mine.map(x => x.url)); } catch (e) { /* tidy later */ }
        return res.status(200).json({ ok: true, handle, code, link: `https://architect-dna.ch/social-mediathek/${handle}` });
      }
      try { await del(mine.map(x => x.url)); } catch (e) { /* already gone */ }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'storage error' });
    }
  }

  if (b.action === 'check') return res.status(200).json({ ok: true });

  try {
    if (b.action === 'upload') {
      const image = String(b.image || '');
      const m = image.match(/^data:image\/(jpeg|webp|png);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return res.status(400).json({ error: 'bad image' });
      if (image.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'image too large' });
      const bytes = Buffer.from(m[2], 'base64');
      // id from the ORIGINAL file's fingerprint (sent by the page; same in every browser), else from the
      // uploaded bytes: choosing the same photo again lands on the same file, never a duplicate
      const fh = /^[0-9a-f]{64}$/.test(String(b.fh || '')) ? String(b.fh) : crypto.createHash('sha256').update(bytes).digest('hex');
      const id = fh.slice(0, 16);
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const w = Math.max(0, Math.min(20000, Math.round(+b.w) || 0)), h = Math.max(0, Math.min(20000, Math.round(+b.h) || 0));
      // real photography only: the page sends the camera from the original's EXIF; no camera, no upload
      const cam = String(b.cam || '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, 48);
      if (!cam) return res.status(422).json({ error: 'no camera' });
      const path = `portfolio/${u}/${id}_${w}x${h}_${cam}.${ext}`;
      let blob;
      try {
        blob = await put(path, bytes, { access: 'public', addRandomSuffix: false, contentType: `image/${m[1]}` });
      } catch (e) {
        if (!/already exists/i.test(String(e && e.message))) throw e;
        return res.status(200).json({ ok: true, duplicate: true });
      }
      // no index write here: the next read finds the file, so parallel or quick uploads can't overwrite each other
      return res.status(200).json({ ok: true, photo: { id, url: blob.url, caption: '', w, h, at: Date.now() } });
    }
    if (b.action === 'dedupe') {
      // byte-identical photos (e.g. a batch chosen twice) — same size first, then compare contents;
      // keeps the oldest copy and its caption/place
      const imgs = (await listAll(u)).filter(x => IMG.test(x.pathname))
        .sort((x, y) => new Date(x.uploadedAt) - new Date(y.uploadedAt));
      const bySize = new Map();
      for (const x of imgs) bySize.set(x.size, [...(bySize.get(x.size) || []), x]);
      const drop = [];
      for (const group of bySize.values()) {
        if (group.length < 2) continue;
        const seen = new Set();
        for (const x of group) {
          const hsh = crypto.createHash('sha256').update(Buffer.from(await (await fetch(x.url)).arrayBuffer())).digest('hex');
          if (seen.has(hsh)) drop.push(x.url); else seen.add(hsh);
        }
      }
      if (drop.length) await del(drop);
      return res.status(200).json({ ok: true, removed: drop.length });
    }
    const { d, old } = await load(u);
    if (b.action === 'caption') {
      const p = d.photos.find(x => x.id === b.id);
      if (!p) return res.status(404).json({ error: 'no such photo' });
      p.caption = clip(b.caption, 200);
    } else if (b.action === 'delete') {
      const p = d.photos.find(x => x.id === b.id);
      if (p) { try { await del(p.url); } catch (e) { /* already gone */ } }
      d.photos = d.photos.filter(x => x.id !== b.id);
    } else if (b.action === 'move') {
      const i = d.photos.findIndex(x => x.id === b.id);
      const j = i + (b.dir === 'up' ? -1 : 1);
      if (i >= 0 && j >= 0 && j < d.photos.length) [d.photos[i], d.photos[j]] = [d.photos[j], d.photos[i]];
    } else if (b.action === 'profile') {
      d.profile = { name: clip(b.name, 60), bio: clip(b.bio, 240), instagram: handleOf(b.instagram) || u };
    } else {
      return res.status(400).json({ error: 'bad action' });
    }
    await save(u, d, old);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('portfolio', b.action, e && e.message);
    return res.status(500).json({ error: 'storage error', detail: String(e && e.message || '').slice(0, 160) });
  }
}
