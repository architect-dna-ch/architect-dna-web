export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { person, intent, tone } = req.body;
  if (!person || !intent) return res.status(400).json({ error: 'missing fields' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'not configured' });

  const prompt = `You help people send the perfect first message. Be natural, human, direct — not cringe or over-eager.

Person: ${person}
Goal: ${intent}

Write exactly 3 short ready-to-send messages with different tones:
1. Warm and genuine
2. Casual and light
3. Short and direct (2 sentences max)

Return ONLY a JSON array, no markdown:
[{"tone":"warm","text":"..."},{"tone":"casual","text":"..."},{"tone":"bold","text":"..."}]`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.8,
    })
  });

  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '[]';
  const match = text.match(/\[[\s\S]*\]/);
  try {
    res.status(200).json({ messages: JSON.parse(match?.[0] || '[]') });
  } catch {
    res.status(200).json({ messages: [{ tone: 'warm', text: text }] });
  }
}
