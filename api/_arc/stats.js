// Live build numbers for the Werkschau. Every CI build of every ARC app publishes a release to the
// public mirror (architect-dna-ch/arc-releases) tagged with its run number: v1.0.N (ARC-DNA Home),
// stats-v0.N, orbit-v0.N, browser-v0.N, one-v0.N. The highest N per app is how many builds that app has
// had; their sum is the total. The newest publish time is "last shipped". Old mirror releases are
// pruned, but the newest tag per app always carries the run number, so the count stays right.
// Cached at the edge for 5 min. Optional GITHUB_TOKEN raises GitHub's rate limit; works without.
const MIRROR = 'https://api.github.com/repos/architect-dna-ch/arc-releases/releases?per_page=100';
const APPS = [
  ['home', /^v1\.0\.(\d+)$/],
  ['stats', /^stats-v0\.(\d+)$/],
  ['orbit', /^orbit-v0\.(\d+)$/],
  ['browser', /^browser-v0\.(\d+)$/],
  ['one', /^one-v0\.(\d+)$/],
];

export function summarise(releases) {
  const per = {};
  let last = 0;
  for (const r of Array.isArray(releases) ? releases : []) {   // an error object from GitHub counts as nothing
    const tag = String(r && r.tag_name || '');
    for (const [app, re] of APPS) {
      const m = tag.match(re);
      if (m) per[app] = Math.max(per[app] || 0, +m[1]);
    }
    const t = Date.parse(r && (r.published_at || r.created_at));
    if (Number.isFinite(t) && t > last) last = t;
  }
  const builds = Object.values(per).reduce((a, b) => a + b, 0);
  return { builds, apps: Object.keys(per).length, perApp: per, lastShipped: last || null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const headers = { 'User-Agent': 'architect-dna-werkschau', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const r = await fetch(MIRROR, { headers });
    if (!r.ok) throw new Error('github ' + r.status);
    const s = summarise(await r.json());
    if (!s.builds) throw new Error('no releases');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ ...s, at: Date.now() });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'stats unavailable' });
  }
}
