# architect-dna-web

Static multi-project site for Architect-DNA Systems (architect-dna.ch), deployed on Vercel.
Each subfolder is a self-contained project/concept (game, tool, app landing page). The root
`index.html` is the main studio site.

## Deploy

```
vercel --prod
```
Always run from the repo root (`/Users/besonnet.kl2/archive/architect-dna-web`), not from a
subfolder — deploying from a project subfolder deploys only that subfolder, not the site.

## Structure

- `index.html` — main studio landing page (hero, project grid, contact)
- One folder per project/concept (e.g. `pulsebot/`, `void-freq/`, `sprint/`, `gridfal/`) — each
  typically has its own `index.html` or `app.html`/`play.html` entry point
- `api/` — Vercel serverless functions (see `vercel.json` rewrites for routing, e.g.
  `/api/concepts/save` → `api/concepts/save.js`)
- `concepts/` — unlisted brainstorm gallery with autosaving notes
- `vercel.json` — subdomain routing (e.g. `calm.architect-dna.ch` → `/calm/app.html`) and legacy
  redirects (`/game-studio`, `/games` → `/`)

## Adding a new project/page

1. Create a new subfolder with its own `index.html` (self-contained: inline CSS/JS preferred,
   matches existing projects' pattern of single-file pages)
2. Link it from the project grid in root `index.html`
3. If it needs a subdomain, add a rewrite entry in `vercel.json`
4. `vercel --prod` to deploy

## Design tokens (root site)

```css
--bg: #FAFAF8;       /* main background, warm off-white */
--bg2: #F0EFEB;       /* secondary background */
--border: #E0E0D8;
--border2: rgba(0,0,0,.12);
--text: #1A1A1A;       /* ink */
--text2: #5A5A58;
--text3: #9A9A98;
--red: #B5271E;        /* rust accent */
--font: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', sans-serif;
--mono: 'SF Mono', 'Fira Code', 'Courier New', monospace;
```

Editorial beige/ink/rust system — sticky blurred header, big tight-tracking headlines
(`letter-spacing:-.05em`), sharp 6-8px border radii, no shadows-heavy UI.

Individual project subfolders (games, apps) may have their own distinct visual identity — don't
force the root palette onto them unless asked.

## Known gotchas

- No Node build step for most pages — they're static HTML with inline styles/scripts. Only `api/`
  functions and anything using `@vercel/blob` need the `node_modules`/`package.json` setup.
- `node_modules` is present in this repo (not gitignored in some older commits) — check `git status`
  before committing broadly.
