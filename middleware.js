import { next } from '@vercel/edge';

// Gate the /me photo page and its images behind an unguessable token (from the Instagram bio link).
// Visit architect-dna.ch/me?t=TOKEN once → a cookie is set, so the images load too. No token = locked.
export const config = { matcher: ['/me', '/me/', '/me/img/:path*'] };

const SECRET = () => (globalThis.process?.env?.ME_TOKEN) || 'herbst2026';

const LOCKED = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Privat</title>
<meta name="robots" content="noindex">
<style>*{margin:0;box-sizing:border-box}
:root{--bg:#FAFAF8;--t:#1A1A1A;--t2:#5A5A58;--r:#B5271E}
@media(prefers-color-scheme:dark){:root{--bg:#121211;--t:#ECEBE6;--t2:#A9A8A2;--r:#D9472F}}
html{background:var(--bg);color:var(--t);font-family:-apple-system,'Segoe UI',sans-serif;height:100%}
body{min-height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
.c{max-width:360px}
.tag{font-family:'SF Mono',monospace;font-size:12px;letter-spacing:.2em;color:var(--r);font-weight:700}
h1{font-size:40px;font-weight:900;letter-spacing:-.04em;margin:10px 0}
p{color:var(--t2);font-size:15px;line-height:1.5}
a{color:var(--t2);font-size:12px;font-family:'SF Mono',monospace;text-decoration:none;display:inline-block;margin-top:18px;border:1px solid var(--t2);padding:7px 13px;border-radius:7px}
</style></head><body><div class="c">
<div class="tag">PRIVAT</div><h1>🔒</h1>
<p>Diese Seite ist nur über den Link in meinem Instagram-Profil erreichbar.</p>
<a href="https://architect-dna.ch">← architect-dna.ch</a>
</div></body></html>`;

export default function middleware(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('t');
  const cookie = req.headers.get('cookie') || '';
  const secret = SECRET();
  const ok = token === secret || cookie.includes('me_t=' + secret);
  if (!ok) {
    return new Response(LOCKED, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  const res = next();
  if (token === secret) {
    res.headers.append('Set-Cookie', `me_t=${secret}; Path=/me; Max-Age=31536000; SameSite=Lax; Secure`);
  }
  return res;
}
