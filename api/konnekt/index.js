import { head, put } from '@vercel/blob';

// Konnekt's shared bubble store — one public JSON blob, read-modify-write.
// Good enough for an MVP; swap for Postgres when it grows.
const KEY = 'konnekt-store.json';

async function load() {
  try {
    const blob = await head(KEY);
    const r = await fetch(blob.url, { cache: 'no-store' });
    return await r.json();
  } catch (e) {
    return { bubbles: {}, rsvps: {} };
  }
}

async function save(data) {
  // Drop bubbles (and their rsvps) that ended more than 3h ago, so the store stays small.
  const cutoff = Date.now() - 3 * 3600 * 1000;
  for (const [id, b] of Object.entries(data.bubbles || {})) {
    if ((b.when || 0) < cutoff) {
      delete data.bubbles[id];
      for (const rid of Object.keys(data.rsvps || {})) {
        if (data.rsvps[rid].bubbleId === id) delete data.rsvps[rid];
      }
    }
  }
  await put(KEY, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const d = await load();
    return res.status(200).json({
      bubbles: Object.entries(d.bubbles || {}).map(([id, b]) => ({ id, ...b })),
      rsvps: Object.entries(d.rsvps || {}).map(([id, r]) => ({ id, ...r })),
    });
  }

  if (req.method !== 'POST') return res.status(405).end();
  const body = req.body || {};
  const action = body.action;
  const d = await load();
  d.bubbles = d.bubbles || {}; d.rsvps = d.rsvps || {};

  try {
    if (action === 'bubble') {
      const b = body.bubble || {};
      if (!b.id || !b.title) return res.status(400).json({ error: 'bad bubble' });
      d.bubbles[b.id] = {
        host: b.host, title: String(b.title).slice(0, 80), vibe: b.vibe,
        place: String(b.place || '').slice(0, 80), when: +b.when || Date.now(),
        size: Math.min(20, Math.max(2, +b.size || 6)), createdAt: Date.now(),
      };
      if (b.host && b.host.id) d.rsvps[b.id + '_' + b.host.id] = { bubbleId: b.id, userId: b.host.id, name: b.host.name, at: Date.now() };
    } else if (action === 'join') {
      const r = body.rsvp || {};
      if (!r.bubbleId || !r.userId) return res.status(400).json({ error: 'bad rsvp' });
      d.rsvps[r.bubbleId + '_' + r.userId] = { bubbleId: r.bubbleId, userId: r.userId, name: String(r.name || 'Someone').slice(0, 40), at: Date.now() };
    } else if (action === 'leave') {
      delete d.rsvps[body.bubbleId + '_' + body.userId];
    } else if (action === 'delete') {
      delete d.bubbles[body.bubbleId];
      for (const rid of Object.keys(d.rsvps)) if (d.rsvps[rid].bubbleId === body.bubbleId) delete d.rsvps[rid];
    } else {
      return res.status(400).json({ error: 'unknown action' });
    }
    await save(d);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
