import { createHash, timingSafeEqual } from 'crypto';
import { del, list, put } from '@vercel/blob';

// Diagnostics drop for the ARC-DNA Home app. Two tokens, only their SHA-256 here:
// the upload token is built into the app and can only add logs; the read token is kept
// apart (never in the app), so unpacking the APK doesn't give access to the logs.
const TOKEN_SHA256 = '4e32054ae39cb95dfaf46358c7923c672a5eaceacc6f0e3333c64fed64bd0dce';
const READ_SHA256 = '03716cc57e224fcc67f096ddd4911ff454dd5e886f6b8b863f7404d71fb5d8eb';
const FOLDER = 'diag/8cbab9b0e68ef88fff13b745d2739fff815b0d30a80f05516f1b43ab27931be4/';
const KEEP = 20;
const MAX_BYTES = 512 * 1024;

const sha = (s) => createHash('sha256').update(s).digest('hex');

function matches(token, hash) {
  if (typeof token !== 'string' || !token) return false;
  return timingSafeEqual(Buffer.from(sha(token), 'hex'), Buffer.from(hash, 'hex'));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = req.headers['x-diag-token'];
  const folder = FOLDER;

  if (req.method === 'POST') {
    if (!matches(token, TOKEN_SHA256)) return res.status(401).json({ error: 'unauthorised' });
    const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');
    if (!text) return res.status(400).json({ error: 'empty' });
    if (Buffer.byteLength(text) > MAX_BYTES) return res.status(413).json({ error: 'too large' });
    const name = `${folder}${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    await put(name, text, { access: 'public', addRandomSuffix: true, contentType: 'text/plain; charset=utf-8' });

    const { blobs } = await list({ prefix: folder });
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const old = blobs.slice(KEEP).map((b) => b.url);
    if (old.length) await del(old);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    if (!matches(token, READ_SHA256)) return res.status(401).json({ error: 'unauthorised' });
    const { blobs } = await list({ prefix: folder });
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    if (req.query.list !== undefined) {
      return res.status(200).json(blobs.map((b, i) => ({ n: i, uploadedAt: b.uploadedAt, size: b.size })));
    }
    const pick = blobs[Number(req.query.n) || 0];
    if (!pick) return res.status(404).json({ error: 'no logs yet' });
    const r = await fetch(pick.url, { cache: 'no-store' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(await r.text());
  }

  return res.status(405).end();
}
