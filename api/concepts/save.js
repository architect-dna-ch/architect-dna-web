import { head, put } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { id, text } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing id' });

  let data = {};
  try {
    const blob = await head('concepts-notes.json');
    const r = await fetch(blob.url, { cache: 'no-store' });
    data = await r.json();
  } catch (e) {
    // first save ever, start fresh
  }

  data[id] = { text: text || '', updatedAt: Date.now() };

  await put('concepts-notes.json', JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });

  res.status(200).json({ ok: true });
}
