import { head } from '@vercel/blob';

const INDEX_KEY = 'gallery-index.json';

export default async function handler(req, res) {
  try {
    const blob = await head(INDEX_KEY);
    const r = await fetch(blob.url, { cache: 'no-store' });
    const index = await r.json();
    // Never expose the underlying blob storage URL to the client — only id/key/caption.
    const safe = index.map(({ id, key, caption, uploadedAt }) => ({ id, key, caption, uploadedAt }));
    res.status(200).json(safe);
  } catch (e) {
    res.status(200).json([]);
  }
}
