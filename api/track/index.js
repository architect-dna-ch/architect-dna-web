// Privacy-first analytics for /me — aggregate counts only. No cookies, no IPs, no PII.
// Stores a single JSON blob with page views, per-image clicks and dwell, and total time.
import { head, put } from '@vercel/blob';

const FILE = 'me-stats.json';

async function load() {
  try {
    const blob = await head(FILE);
    const r = await fetch(blob.url, { cache: 'no-store' });
    return await r.json();
  } catch (e) {
    return { views: 0, pageMs: 0, sessions: 0, images: {}, day: {} };
  }
}

async function save(data) {
  await put(FILE, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET ?stats=KEY → the aggregates (only with the right key).
  if (req.method === 'GET') {
    const key = req.query.stats;
    const secret = process.env.STATS_KEY || 'muharrem';
    if (key !== secret) return res.status(401).json({ error: 'nope' });
    return res.status(200).json(await load());
  }
  if (req.method !== 'POST') return res.status(405).end();

  const b = req.body || {};
  const data = await load();
  const today = new Date().toISOString().slice(0, 10);
  if (b.t === 'view') {
    data.views = (data.views || 0) + 1;
    data.day[today] = (data.day[today] || 0) + 1;
  } else if (b.t === 'img' && b.i != null) {
    const k = String(b.i);
    data.images[k] = data.images[k] || { clicks: 0, dwellMs: 0, dwellN: 0 };
    data.images[k].clicks++;
  } else if (b.t === 'dwell' && b.i != null && b.ms > 0) {
    const k = String(b.i);
    data.images[k] = data.images[k] || { clicks: 0, dwellMs: 0, dwellN: 0 };
    data.images[k].dwellMs += Math.min(b.ms, 600000);
    data.images[k].dwellN++;
  } else if (b.t === 'page' && b.ms > 0) {
    data.pageMs += Math.min(b.ms, 3600000);
    data.sessions = (data.sessions || 0) + 1;
  }
  await save(data);
  res.status(200).json({ ok: true });
}
