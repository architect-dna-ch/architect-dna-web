import { head, put } from '@vercel/blob';
import crypto from 'node:crypto';

// ARC Tag — "if found, tap me." An NFC sticker / QR on your wallet points to /tag/<code>.
// A finder who taps it sees who it belongs to and can share where they found it; the owner sees
// those scans (with their secret key) and ARC on their phone notifies them. The owner's own taps are
// recognised by the key and logged as "you" — never as an alert, because you're holding it.
//
// Privacy: finders' locations are only readable with the owner's key. We store a hash of the key,
// never the key. One JSON blob, read-modify-write, like the other ARC stores.
const KEY = 'tag-store.json';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I confusion on a printed sticker
const MAX_SCANS = 200;

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const num = (v, lo, hi) => { const x = +v; return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };

function newCode() {
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}

async function load() {
  try {
    const b = await head(KEY);
    const r = await fetch(b.url, { cache: 'no-store' });
    return await r.json();
  } catch (e) { return { tags: {} }; }
}
async function save(d) {
  await put(KEY, JSON.stringify(d), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

const isOwner = (t, key) => !!key && t.ownerHash === sha(key);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();

  if (req.method === 'GET') {
    const code = clip(req.query.code, 12).toUpperCase();
    const d = await load();
    const t = d.tags && d.tags[code];
    if (!t) return res.status(404).json({ error: 'unknown tag' });
    if (isOwner(t, req.query.key)) {
      return res.status(200).json({ code, label: t.label, note: t.note, created: t.created, owner: true, scans: t.scans || [] });
    }
    return res.status(200).json({ code, label: t.label, note: t.note, owner: false });   // finders: no scans
  }

  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  const d = await load();
  d.tags = d.tags || {};

  if (b.action === 'create') {
    let code = newCode();
    while (d.tags[code]) code = newCode();
    const key = crypto.randomBytes(18).toString('base64url');
    d.tags[code] = {
      label: clip(b.label, 40) || 'Mein Portemonnaie',
      note: clip(b.note, 240),
      ownerHash: sha(key),
      created: now,
      scans: [],
    };
    try { await save(d); } catch (e) { return res.status(500).json({ error: String(e && e.message || e) }); }
    return res.status(200).json({ code, key });
  }

  const code = clip(b.code, 12).toUpperCase();
  const t = d.tags[code];
  if (!t) return res.status(404).json({ error: 'unknown tag' });
  const owner = isOwner(t, b.key);

  if (b.action === 'scan') {
    const scan = {
      at: now,
      by: owner ? 'owner' : 'finder',
      lat: num(b.lat, -90, 90),
      lng: num(b.lng, -180, 180),
      acc: num(b.acc, 0, 100000),
      msg: owner ? '' : clip(b.msg, 300),
      contact: owner ? '' : clip(b.contact, 80),
    };
    t.scans = (t.scans || []).concat(scan).slice(-MAX_SCANS);
    try { await save(d); } catch (e) { return res.status(500).json({ error: String(e && e.message || e) }); }
    return res.status(200).json({ ok: true, owner, label: t.label, note: t.note });
  }

  if (!owner) return res.status(403).json({ error: 'not your tag' });

  if (b.action === 'update') {
    if (b.label != null) t.label = clip(b.label, 40) || t.label;
    if (b.note != null) t.note = clip(b.note, 240);
  } else if (b.action === 'clear') {
    t.scans = [];
  } else if (b.action === 'delete') {
    delete d.tags[code];
  } else {
    return res.status(400).json({ error: 'bad action' });
  }
  try { await save(d); } catch (e) { return res.status(500).json({ error: String(e && e.message || e) }); }
  return res.status(200).json({ ok: true });
}
