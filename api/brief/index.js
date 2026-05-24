export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { type, industry, description, budget, timeline } = req.body;
  if (!description) return res.status(400).json({ error: 'missing description' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'not configured' });

  const prompt = `You are a senior freelance consultant. Generate a professional project brief.

Project type: ${type}
Client industry: ${industry || 'general'}
Description: ${description}
Budget: ${budget || 'not specified'}
Timeline: ${timeline || 'not specified'}

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "5-7 word project title",
  "overview": "2-3 sentence executive summary",
  "deliverables": ["5-8 specific deliverables"],
  "outOfScope": ["3-4 items explicitly excluded"],
  "timeline": "timeline with 3-4 milestones",
  "tiers": [
    {"name":"Essential","price":"CHF X,XXX","scope":"brief scope"},
    {"name":"Professional","price":"CHF X,XXX","scope":"brief scope"},
    {"name":"Premium","price":"CHF X,XXX","scope":"brief scope"}
  ],
  "nextSteps": ["3-4 concrete next steps"]
}

Pricing must be realistic for Switzerland.`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    })
  });

  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  const match = text.match(/\{[\s\S]*\}/);
  try {
    res.status(200).json(JSON.parse(match?.[0] || '{}'));
  } catch {
    res.status(500).json({ error: 'parse error' });
  }
}
