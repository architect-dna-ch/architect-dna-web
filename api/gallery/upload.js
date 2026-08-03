import { head, put } from '@vercel/blob';

export const config = {
  api: { bodyParser: false },
};

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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const filename = req.query.filename || 'photo.jpg';
  const caption = req.query.caption || '';
  const contentType = req.headers['content-type'] || 'image/jpeg';

  const buffer = await readRawBody(req);
  if (!buffer.length) {
    return res.status(400).json({ error: 'empty body' });
  }
  if (buffer.length > 15 * 1024 * 1024) {
    return res.status(413).json({ error: 'file too large (max 15MB)' });
  }

  const photoBlob = await put(`gallery/${Date.now()}-${filename}`, buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  });

  const index = await loadIndex();
  const entry = {
    id: 'g' + Date.now() + Math.random().toString(36).slice(2, 7),
    key: photoBlob.pathname,
    caption,
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
