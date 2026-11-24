// One serverless function for the newer ARC endpoints. Vercel's Hobby plan allows 12 functions per
// deployment, and every file in api/ counts — so these share one function and vercel.json maps their
// public URLs here (/api/konnekt → /api/arc?fn=konnekt, …). Handlers live in api/_arc/ (a leading
// underscore keeps Vercel from turning them into functions of their own).
import konnekt from './_arc/konnekt.js';
import cal from './_arc/cal.js';
import crowd from './_arc/crowd.js';
import tag from './_arc/tag.js';
import lens from './_arc/lens.js';
import portfolio from './_arc/portfolio.js';

const HANDLERS = { konnekt, cal, crowd, tag, lens, portfolio };

export default async function handler(req, res) {
  const fn = String((req.query && req.query.fn) || '');
  const h = Object.prototype.hasOwnProperty.call(HANDLERS, fn) ? HANDLERS[fn] : null;
  if (!h) return res.status(404).json({ error: 'unknown endpoint' });
  return h(req, res);
}
