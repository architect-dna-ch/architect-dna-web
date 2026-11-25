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
const MAX_IMAGE_CHARS = 4_000_000;   // ~3 MB of JPEG as base64, under the 4.5 MB request limit
const MAX_PHOTOS = 300;

// codes are compared without dashes/spaces and case: E2F394-45A7… == e2f39445a7…
const normCode = s => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const handleOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
const IMG = /\/([0-9a-f]{16})(?:_(\d+)x(\d+))?\.(jpg|webp|png)$/;

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
    if (m) files.set(m[1], { b, w: +m[2] || 0, h: +m[3] || 0 });
  }
  const known = new Set();
  d.photos = (d.photos || []).filter(p => files.has(p.id) && !known.has(p.id) && known.add(p.id));
  const fresh = [...files].filter(([id]) => !known.has(id))
    .sort((a, b) => new Date(b[1].b.uploadedAt) - new Date(a[1].b.uploadedAt))
    .map(([id, f]) => ({ id, url: f.b.url, caption: '', w: f.w, h: f.h, at: +new Date(f.b.uploadedAt) }));
  d.photos = [...fresh, ...d.photos];
  return { d, old: metas };
}
async function save(u, d, old) {
  await put(`portfolio/${u}/meta-${Date.now()}.json`, JSON.stringify(d),
    { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
  const stale = old.map(b => b.url);
  if (stale.length) { try { await del(stale); } catch (e) { /* harmless leftovers */ } }
}

function isOwner(u, key) {
  const want = OWNERS[u];
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
    if (!OWNERS[u]) return res.status(404).json({ error: 'unknown profile' });
    let d;
    try { ({ d } = await load(u)); } catch (e) { return res.status(503).json({ error: 'storage error' }); }
    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=10');
    return res.status(200).json({
      handle: u,
      profile: d.profile,
      photos: (d.photos || []).map(({ id, url, caption, w, h, at }) => ({ id, url, caption, w, h, at })),
    });
  }

  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-store');
  const b = req.body || {};
  const u = handleOf(b.u);
  if (!OWNERS[u]) return res.status(404).json({ error: 'unknown profile' });
  if (!isOwner(u, b.key)) return res.status(403).json({ error: 'wrong code' });

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
      const path = `portfolio/${u}/${id}_${w}x${h}.${ext}`;
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
