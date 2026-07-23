import { head } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const blob = await head('concepts-notes.json');
    const r = await fetch(blob.url, { cache: 'no-store' });
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    // No notes saved yet
    res.status(200).json({});
  }
}
