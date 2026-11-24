// WG vibe board: get + set in ONE function. They used to be two functions, which never share
// memory on Vercel — so "set" was invisible to "get". In-memory: resets on cold start.
const store = global._wgStore || (global._wgStore = {});
const EIGHT_H = 8 * 60 * 60 * 1000;

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const op = String((req.query && req.query.op) || (req.method === 'POST' ? 'set' : 'get'));

  if (op === 'get') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'missing code' });
    const cutoff = Date.now() - EIGHT_H;
    return res.status(200).json({ residents: Object.values(store[code] || {}).filter(r => r.ts > cutoff) });
  }
  if (op === 'set') {
    if (req.method !== 'POST') return res.status(405).end();
    const { code, id, name, vibe, ts } = req.body || {};
    if (!code || !id || !vibe) return res.status(400).json({ error: 'missing fields' });
    if (!store[code]) store[code] = {};
    store[code][id] = { id, name: name || 'Someone', vibe, ts: ts || Date.now() };
    const cutoff = Date.now() - EIGHT_H;
    Object.keys(store[code]).forEach(k => { if (store[code][k].ts < cutoff) delete store[code][k]; });
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: 'bad op' });
}
