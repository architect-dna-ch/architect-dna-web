import { head } from '@vercel/blob';

export default async function handler(req, res) {
  const { key } = req.query;
  if (!key) return res.status(400).end();

  try {
    const blob = await head(key);
    const upstream = await fetch(blob.url);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', blob.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.status(200).send(buffer);
  } catch (e) {
    res.status(404).end();
  }
}
