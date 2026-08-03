import { head, put, del } from '@vercel/blob';

const INDEX_KEY = 'gallery-index.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing id' });

  let index = [];
  try {
    const blob = await head(INDEX_KEY);
    const r = await fetch(blob.url, { cache: 'no-store' });
    index = await r.json();
  } catch (e) {
    return res.status(200).json({ ok: true });
  }

  const entry = index.find(x => x.id === id);
  if (entry) {
    try { await del(entry.key); } catch (e) { /* already gone */ }
  }
  index = index.filter(x => x.id !== id);

  await put(INDEX_KEY, JSON.stringify(index), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });

  res.status(200).json({ ok: true });
}
