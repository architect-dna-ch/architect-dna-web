export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { question, context } = req.body;
  if (!question) return res.status(400).json({ error: 'missing question' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'not configured' });

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: context || 'You are PulseBot, a helpful assistant.' },
        { role: 'user', content: question }
      ],
      max_tokens: 300,
      temperature: 0.7,
    })
  });

  const data = await r.json();
  if (!r.ok) return res.status(200).json({ answer: `Groq error ${r.status}: ${data.error?.message || JSON.stringify(data)}` });
  const answer = data.choices?.[0]?.message?.content?.trim() || 'Keine Antwort erhalten.';
  res.status(200).json({ answer });
}
