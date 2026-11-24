import { head, put } from '@vercel/blob';

// Crowdsourced public-transport density. Volunteers POST a subjective "how full" (0 empty … 3 packed)
// for a line; ARC Route GETs the aggregated level per line to show on connections. One public JSON
// blob, read-modify-write; keeps the last few hours, prunes the rest. No accounts, no tracking.
const KEY = 'crowd-store.json';
const WINDOW_MS = 120 * 60 * 1000;   // reports from the last 2h count as "now"
const KEEP_MS = 6 * 60 * 60 * 1000;  // drop anything older than 6h
const CAP = 8000;

const norm = s => String(s || '').toUpperCase().replace(/\s+/g, '').slice(0, 12);

async function load() {
  try {
    const b = await head(KEY);
    const r = await fetch(b.url, { cache: 'no-store' });
    return await r.json();
  } catch (e) { return { reports: [] }; }
}
async function save(d) {
  await put(KEY, JSON.stringify(d), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

// recency-weighted average → 0..3, plus a sample count
function aggregate(reports, line, now) {
  let w = 0, sum = 0, n = 0, newest = 0;
  for (const r of reports) {
    if (r.line !== line) continue;
    const age = now - r.at;
    if (age > WINDOW_MS) continue;
    const weight = 1 - age / WINDOW_MS;        // fresh reports weigh more
    sum += r.level * weight; w += weight; n++;
    if (r.at > newest) newest = r.at;
  }
  if (n === 0) return null;
  return { level: Math.round(sum / w), n, ageMin: Math.round((now - newest) / 60000) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();

  if (req.method === 'GET') {
    const d = await load();
    const reports = d.reports || [];
    const want = (req.query.lines || '').split(',').map(norm).filter(Boolean);
    const out = {};
    const lines = want.length ? want : [...new Set(reports.filter(r => now - r.at < WINDOW_MS).map(r => r.line))];
    for (const l of lines) { const a = aggregate(reports, l, now); if (a) out[l] = a; }
    return res.status(200).json({ lines: out, at: now });
  }

  if (req.method !== 'POST') return res.status(405).end();
  const body = req.body || {};
  const line = norm(body.line);
  const level = Math.max(0, Math.min(3, Math.round(+body.level)));
  if (!line || !Number.isFinite(level)) return res.status(400).json({ error: 'bad report' });

  const d = await load();
  d.reports = (d.reports || []).filter(r => now - r.at < KEEP_MS);
  d.reports.push({ line, level, at: now });
  if (d.reports.length > CAP) d.reports = d.reports.slice(-CAP);
  try { await save(d); } catch (e) { return res.status(500).json({ error: String(e && e.message || e) }); }
  const a = aggregate(d.reports, line, now);
  res.status(200).json({ ok: true, line, now: a });
}
