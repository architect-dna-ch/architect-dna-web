import { head, put } from '@vercel/blob';

const INDEX_KEY = 'gallery-index.json';

async function loadIndex() {
  try {
    const blob = await head(INDEX_KEY);
    const r = await fetch(blob.url, { cache: 'no-store' });
    return await r.json();
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { filename, contentType, dataBase64, caption } = req.body || {};
  if (!filename || !dataBase64) {
    return res.status(400).json({ error: 'missing filename or dataBase64' });
  }

  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.length > 12 * 1024 * 1024) {
    return res.status(413).json({ error: 'file too large (max 12MB)' });
  }

  const photoBlob = await put(`gallery/${Date.now()}-${filename}`, buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType: contentType || 'image/jpeg',
  });

  const index = await loadIndex();
  const entry = {
    id: 'g' + Date.now() + Math.random().toString(36).slice(2, 7),
    key: photoBlob.pathname,
    caption: caption || '',
    uploadedAt: Date.now(),
  };
  index.unshift(entry);

  await put(INDEX_KEY, JSON.stringify(index), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });

  res.status(200).json({ ok: true, id: entry.id });
}
