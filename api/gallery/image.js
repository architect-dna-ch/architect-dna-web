import { head } from '@vercel/blob';
import { Readable } from 'node:stream';

export default async function handler(req, res) {
  const { key } = req.query;
  if (!key) return res.status(400).end();

  try {
    const blob = await head(key);
    const upstream = await fetch(blob.url);
    res.setHeader('Content-Type', blob.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    res.status(404).end();
  }
}
