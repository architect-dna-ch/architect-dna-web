// Concepts notes: get + save in one function (Vercel Hobby: max 12 functions per deployment).
import { head, put } from '@vercel/blob';
const KEY = 'concepts-notes.json';

async function load() {
  try { const b = await head(KEY); const r = await fetch(b.url, { cache: 'no-store' }); return await r.json(); }
  catch (e) { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const op = String((req.query && req.query.op) || (req.method === 'POST' ? 'save' : 'get'));

  if (op === 'get') return res.status(200).json(await load());
  if (op === 'save') {
    if (req.method !== 'POST') return res.status(405).end();
    const { id, text } = req.body || {};
    if (!id) return res.status(400).json({ error: 'missing id' });
    const data = await load();
    data[id] = { text: text || '', updatedAt: Date.now() };
    await put(KEY, JSON.stringify(data), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: 'bad op' });
}
