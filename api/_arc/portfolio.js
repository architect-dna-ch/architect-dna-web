import { head, put, del } from '@vercel/blob';
import crypto from 'node:crypto';

// Social-Mediathek — a public photo portfolio per handle (/social-mediathek/<handle>), for an
// Instagram bio link. Anyone can view; only the owner (with their access code) can upload, caption
// or delete. Owners are fixed here by the SHA-256 of their code — the code itself is never stored.
//
// Photos arrive already resized on the phone (≤ 2400 px JPEG, which also drops EXIF/GPS) and are
// stored as public blobs; one JSON index per handle holds profile + order.
const OWNERS = {
  muh4rrrem: 'ceb9e58f6387170c70beddeb681ee35bdb967267f083c259300b4d9cdaff187e',
};
const MAX_IMAGE_CHARS = 4_000_000;   // ~3 MB of JPEG as base64, under the 4.5 MB request limit
const MAX_PHOTOS = 300;

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const handleOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
const indexKey = u => `portfolio/${u}/index.json`;

async function load(u) {
  try {
    const b = await head(indexKey(u));
    const r = await fetch(b.url, { cache: 'no-store' });
    return await r.json();
  } catch (e) {
    return { profile: { name: '', bio: '', instagram: u }, photos: [] };
  }
}
async function save(u, d) {
  await put(indexKey(u), JSON.stringify(d), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

function isOwner(u, key) {
  const want = OWNERS[u];
  if (!want || !key) return false;
  const got = sha(key);
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
    const d = await load(u);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
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

  const d = await load(u);
  d.photos = d.photos || [];

  try {
    if (b.action === 'upload') {
      const image = String(b.image || '');
      const m = image.match(/^data:image\/(jpeg|webp|png);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return res.status(400).json({ error: 'bad image' });
      if (image.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'image too large' });
      if (d.photos.length >= MAX_PHOTOS) return res.status(409).json({ error: 'gallery full' });
      const id = crypto.randomBytes(8).toString('hex');
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const blob = await put(`portfolio/${u}/${id}.${ext}`, Buffer.from(m[2], 'base64'), {
        access: 'public', addRandomSuffix: false, contentType: `image/${m[1]}`,
      });
      const photo = { id, url: blob.url, caption: clip(b.caption, 200), w: +b.w || 0, h: +b.h || 0, at: Date.now() };
      d.photos.unshift(photo);
      await save(u, d);
      return res.status(200).json({ ok: true, photo });
    }
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
    await save(u, d);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'storage error' });
  }
}
