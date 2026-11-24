// ARC Lens — point the camera at something, ask about it. The page sends one downscaled JPEG frame
// plus the question (and the conversation so far, for follow-ups on the same picture); we ask a
// vision model on Groq — the same provider and key as /api/chat — and return the answer.
// The key stays here on the server; nothing is stored.
const MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const MAX_IMAGE_CHARS = 4_000_000;   // Groq accepts base64 images up to ~4 MB
const MAX_TURNS = 6;

const SYSTEM = `Du bist ARC Lens, ein Kamera-Assistent. Der Nutzer zeigt dir ein Foto (oft Schulaufgaben,
Texte, Dinge, Schilder) und stellt eine Frage dazu. Antworte auf Deutsch (Schweizer Rechtschreibung, «ss» statt «ß»),
ausser der Nutzer schreibt in einer anderen Sprache.
- Kurz und klar. Keine Floskeln.
- Mathe/Physik: Schritt für Schritt, jede Umformung auf eigener Zeile. Formeln in LaTeX zwischen $...$ (inline) oder $$...$$ (Block).
- Wenn handschriftliche Lösungen sichtbar sind: prüfe sie und sag konkret, in welcher Zeile ein Fehler ist und warum.
- Wenn etwas im Bild unleserlich oder abgeschnitten ist, sag das, statt zu raten.`;

const clip = (s, n) => String(s || '').slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'not configured' });

  const b = req.body || {};
  const image = String(b.image || '');
  const question = clip(b.question, 1000).trim() || 'Was siehst du? Erklär es kurz.';
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) return res.status(400).json({ error: 'bad image' });
  if (image.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'image too large' });

  // Earlier turns about the same picture (text only); the image rides along on the first user turn.
  const history = Array.isArray(b.history) ? b.history.slice(-MAX_TURNS) : [];
  const messages = [{ role: 'system', content: SYSTEM }];
  let attached = false;   // the picture rides on the first user turn we actually send, so it's never sliced away
  const withImage = text => { attached = true; return [{ type: 'text', text }, { type: 'image_url', image_url: { url: image } }]; };
  for (const t of history) {
    const q = clip(t && t.q, 1000), a = clip(t && t.a, 4000);
    if (!q || !a) continue;
    messages.push({ role: 'user', content: attached ? q : withImage(q) });
    messages.push({ role: 'assistant', content: a });
  }
  messages.push({ role: 'user', content: attached ? question : withImage(question) });

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 900, temperature: 0.3 }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data && data.error && data.error.message || `HTTP ${r.status}`;
      return res.status(502).json({ error: 'vision model unavailable', detail: clip(msg, 200) });
    }
    const answer = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return res.status(200).json({ answer: (answer || '').trim() || 'Keine Antwort erhalten.', model: MODEL });
  } catch (e) {
    return res.status(502).json({ error: 'vision model unreachable' });
  }
}
