const store = global._wgStore || (global._wgStore = {});

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'missing code' });

  const flat = store[code] || {};
  const cutoff = Date.now() - 8 * 60 * 60 * 1000;
  const residents = Object.values(flat).filter(r => r.ts > cutoff);

  res.status(200).json({ residents });
}
