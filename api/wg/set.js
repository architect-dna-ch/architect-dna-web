// In-memory store — good for small WGs, resets on cold start (~fine for Vercel hobby)
const store = global._wgStore || (global._wgStore = {});

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { code, id, name, vibe, ts } = req.body;
  if (!code || !id || !vibe) return res.status(400).json({ error: 'missing fields' });

  if (!store[code]) store[code] = {};
  store[code][id] = { id, name: name || 'Someone', vibe, ts: ts || Date.now() };

  // Expire entries older than 8 hours
  const cutoff = Date.now() - 8 * 60 * 60 * 1000;
  Object.keys(store[code]).forEach(k => { if (store[code][k].ts < cutoff) delete store[code][k]; });

  res.status(200).json({ ok: true });
}
