/* brand-fx.js — Architect-DNA brand interactions. No dependencies.

   1. Guide fox — an ink-line fox watches the cursor. When the visitor hesitates, it trots
      to the element marked [data-fx-target], leaves a paw trail, and the target leans
      toward the cursor as it gets close (a "magnetic" pull).
   2. Talking fox — click the fox to ask it anything. It answers in a thought bubble: first
      in fox (yips, gekkers, wow-wows — audible once sound is on), then "translated" into
      plain language. When a visitor lingers on a part of a page it offers a suggestion
      based on what's on screen and which page they're on (AI via the chat API, with a
      local fallback). Hint a section with data-fx-say="…" (+ data-fx-href / data-fx-cta).
   3. Hunt — now and then (or when asked: "hunt", "Hase", "rabbit" in the fox chat) a rabbit
      pops out of a burrow; the fox stalks, chases and pounces. Click the rabbit to save it.
   4. Seismic — scroll speed shakes a blueprint grid behind the page and draws a
      seismograph along the bottom edge. Submitting a form[data-fx-quake] (or clicking a
      button[data-fx-quake]) sets off an earthquake: the ground cracks and buttons jump.

   Usage:
     <a href="#contact" data-fx-target data-fx-hint="say hi →">Contact</a>
     <section id="work" data-fx-say="Six apps here — Einspruch is the newest.">…</section>
     <form data-fx-quake>…</form>
     <script src="/fx/brand-fx.js" defer></script>

   Optional config before the script:
     window.ArchitectFXConfig = { idleMs, dwellMs, fox, talk, seismo, api, context, contextExtra,
       theme: { ink, accent, bg, field, line, muted, font, mono } }   // theme matches a subpage's look
   API: ArchitectFX.quake(x, y, strength), .guide(), .home(), .talk(), .suggest(), .hunt()
   Respects prefers-reduced-motion (no shaking, no running, no typing animation). */
(() => {
  const DEFAULT_CTX = 'You are the fox: the mascot and assistant of Architect-DNA, a Swiss indie software studio based in Bern. Answer helpfully and concisely (max 3 short sentences) in the same language the visitor writes in (German or English). Facts: Architect-DNA builds privacy-first apps and browser games. Apps: FITRA (life OS), VOID FREQ (ambient focus), LIA (legal vault), Rida (Muslim companion), Calm, Noise, Sakina (waswas companion), Einspruch (legal objections). Games: Nexus Breach, KART, BLOOM, Grid Fall, Sprint, Ares Race, Sector Zero — all free, no install. PulseBot is an embeddable AI chatbot for Swiss KMUs, CHF 49/149/499/month, 30-day free trial, no credit card, one line of code to install, DSGVO-konform. Contact: systems@architect-dna.ch. Based in Bern, Switzerland.';
  const CFG = Object.assign({
    idleMs: 3500, dwellMs: 6000, fox: true, talk: true, seismo: true,
    api: '/api/chat', context: DEFAULT_CTX
  }, window.ArchitectFXConfig || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (CFG.contextExtra) CFG.context += '\n\n' + CFG.contextExtra;
  const THEME = Object.assign({
    ink: '#1A1A1A', accent: '#B5271E', bg: '#FAFAF8', field: '#fff', line: '#E0E0D8', muted: '#9A9A98',
    font: "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',sans-serif",
    mono: "'SF Mono','Fira Code','Courier New',monospace"
  }, CFG.theme || {});
  const INK = THEME.ink, RUST = THEME.accent, BG = THEME.bg, FONT = THEME.font, MONO = THEME.mono;
  // '#rrggbb' + alpha → rgba() for tints of the theme colours.
  const tint = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const FOX_W = 96, FOX_H = 64, SEISMO_H = 28;

  const css = `
.fx-ground{position:fixed;inset:-40px;z-index:-1;pointer-events:none;will-change:transform;
  background-image:linear-gradient(${tint(INK, .055)} 1px,transparent 1px),linear-gradient(90deg,${tint(INK, .055)} 1px,transparent 1px);
  background-size:32px 32px}
.fx-seismo{position:fixed;left:0;right:0;bottom:0;height:${SEISMO_H}px;z-index:9990;pointer-events:none}
.fx-cracks{position:fixed;inset:0;width:100%;height:100%;z-index:9989;pointer-events:none;overflow:visible}
.fx-cracks path{fill:none;stroke:${INK};stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.6;
  stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:fxcrack .35s ease-out forwards,fxfade .8s 1.4s forwards}
@keyframes fxcrack{to{stroke-dashoffset:0}}
@keyframes fxfade{to{opacity:0}}
.fx-fox{position:fixed;left:0;top:0;width:${FOX_W}px;height:${FOX_H}px;z-index:9991;pointer-events:none;
  transition:transform .9s cubic-bezier(.45,.05,.3,1)}
.fx-fox svg{width:100%;height:100%;overflow:visible;transition:transform .2s}
.fx-fox.flip svg{transform:scaleX(-1)}
.fx-hit{position:absolute;left:10px;right:2px;top:6px;bottom:10px;padding:0;border:0;border-radius:12px;background:transparent;
  cursor:pointer;pointer-events:auto}
.fx-hit:focus-visible{outline:2px solid ${RUST};outline-offset:2px}
.fx-fox .fx-leg{transform-box:fill-box;transform-origin:50% 0}
.fx-fox.run .fx-leg-a{animation:fxleg .18s infinite alternate}
.fx-fox.run .fx-leg-b{animation:fxleg .18s infinite alternate-reverse}
.fx-fox .fx-tail{transform-box:fill-box;transform-origin:100% 80%}
.fx-fox.wag .fx-tail{animation:fxwag .28s infinite alternate}
.fx-fox .fx-head{transform-box:fill-box;transform-origin:20% 90%}
.fx-fox.talk .fx-head{animation:fxtalk .14s infinite alternate}
.fx-fox.hop svg{animation:fxhop .5s ease-out}
.fx-fox.flip.hop svg{animation:fxhopflip .5s ease-out}
@keyframes fxleg{from{transform:rotate(-24deg)}to{transform:rotate(24deg)}}
@keyframes fxwag{from{transform:rotate(-14deg)}to{transform:rotate(12deg)}}
@keyframes fxtalk{from{transform:rotate(0)}to{transform:rotate(-7deg)}}
@keyframes fxhop{40%{transform:translateY(-26px)}}
@keyframes fxhopflip{0%,100%{transform:scaleX(-1)}40%{transform:scaleX(-1) translateY(-26px)}}
.fx-bubble{position:absolute;bottom:100%;left:50%;transform:translate(-50%,2px);background:${INK};color:${BG};
  font:600 12px/1 ${FONT};letter-spacing:-.01em;padding:7px 10px;border-radius:6px;white-space:nowrap;opacity:0;transition:opacity .2s,transform .2s}
.fx-bubble.show{opacity:1;transform:translate(-50%,-6px)}
.fx-think{position:fixed;left:12px;bottom:${SEISMO_H + FOX_H + 16}px;z-index:9993;width:min(300px,calc(100vw - 24px));
  background:${BG};color:${INK};border:1.5px solid ${INK};border-radius:20px;padding:10px 14px 12px;
  font:14px/1.45 ${FONT};text-align:left;transform-origin:25% 100%;animation:fxpop .24s cubic-bezier(.34,1.4,.64,1)}
.fx-think[hidden]{display:none}
.fx-think::before,.fx-think::after{content:'';position:absolute;border:1.5px solid ${INK};background:${BG};border-radius:50%}
.fx-think::before{width:14px;height:14px;left:58px;bottom:-21px}
.fx-think::after{width:8px;height:8px;left:72px;bottom:-34px}
@keyframes fxpop{from{opacity:0;transform:scale(.6)}}
.fx-t-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;
  font:600 10px/1 ${MONO};letter-spacing:.08em;text-transform:uppercase;color:${THEME.muted}}
.fx-t-head button{font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit;background:none;border:0;padding:4px;cursor:pointer}
.fx-t-head button:hover,.fx-t-head button:focus-visible{color:${INK}}
.fx-t-raw{margin:0;font:italic 600 15px/1.35 ${MONO};color:${RUST};transition:opacity .3s,font-size .3s}
.fx-t-raw.done{opacity:.5;font-size:11px;text-decoration:line-through;text-decoration-color:${tint(RUST, .45)}}
.fx-t-out{margin:6px 0 0;max-height:38vh;overflow:auto;white-space:pre-wrap}
.fx-t-out:empty{display:none}
.fx-t-cta{display:inline-block;margin-top:10px;padding:7px 11px;border-radius:6px;background:${INK};color:${BG}!important;
  font:600 13px/1 ${FONT};text-decoration:none}
.fx-t-cta[hidden]{display:none}
.fx-t-ask{display:flex;gap:6px;margin:10px 0 0;padding-top:10px;border-top:1px solid ${THEME.line}}
.fx-t-ask input{flex:1;min-width:0;padding:8px 10px;border:1px solid ${THEME.line};border-radius:6px;background:${THEME.field};color:${INK};font:13px ${FONT}}
.fx-t-ask input:focus{outline:2px solid ${tint(RUST, .35)};outline-offset:1px}
.fx-t-ask button{padding:0 12px;border:0;border-radius:6px;background:${INK};color:${BG};font:700 14px ${FONT};cursor:pointer}
.fx-fox.stalk svg{transform:translateY(5px) scaleY(.86)}
.fx-fox.flip.stalk svg{transform:scaleX(-1) translateY(5px) scaleY(.86)}
.fx-fox.stalk .fx-leg-a{animation:fxleg .5s infinite alternate}
.fx-fox.stalk .fx-leg-b{animation:fxleg .5s infinite alternate-reverse}
.fx-fox.pounce svg{animation:fxpounce .7s ease-in-out}
.fx-fox.flip.pounce svg{animation:fxpounceflip .7s ease-in-out}
@keyframes fxpounce{45%{transform:translateY(-64px) rotate(-16deg)}80%{transform:translateY(-6px) rotate(14deg)}}
@keyframes fxpounceflip{0%,100%{transform:scaleX(-1)}45%{transform:scaleX(-1) translateY(-64px) rotate(-16deg)}80%{transform:scaleX(-1) translateY(-6px) rotate(14deg)}}
.fx-rabbit{position:fixed;left:0;top:0;width:48px;height:40px;z-index:9989;padding:0;border:0;background:none;cursor:pointer}
.fx-rabbit:focus-visible{outline:2px solid ${RUST};outline-offset:2px;border-radius:8px}
.fx-rabbit svg{width:100%;height:100%;overflow:visible;pointer-events:none}
.fx-rabbit.flip svg{transform:scaleX(-1)}
.fx-rabbit.pop svg{animation:fxrpop .45s ease-out}
.fx-rabbit.hopping svg{animation:fxrhop .3s ease-in-out infinite}
.fx-rabbit.flip.hopping svg{animation:fxrhopflip .3s ease-in-out infinite}
.fx-rabbit .fx-ears{transform-box:fill-box;transform-origin:50% 100%}
.fx-rabbit.twitch .fx-ears{animation:fxtwitch .12s 4 alternate}
@keyframes fxrpop{from{transform:translateY(26px);opacity:0}}
@keyframes fxrhop{50%{transform:translateY(-14px)}}
@keyframes fxrhopflip{0%,100%{transform:scaleX(-1)}50%{transform:scaleX(-1) translateY(-14px)}}
@keyframes fxtwitch{to{transform:rotate(-12deg)}}
.fx-hole{position:fixed;width:34px;height:8px;border-radius:50%;background:${INK};opacity:.85;z-index:9990;pointer-events:none;
  animation:fxholein .3s ease-out;transition:opacity .6s}
@keyframes fxholein{from{transform:scaleX(0)}}
.fx-paw{position:fixed;width:7px;height:9px;border-radius:50%;background:${INK};opacity:0;z-index:9989;pointer-events:none;
  animation:fxpaw 1.6s forwards}
@keyframes fxpaw{15%{opacity:.22}100%{opacity:0}}
.fx-spark{position:fixed;width:6px;height:6px;border-radius:1px;background:${RUST};z-index:9992;pointer-events:none}
.fx-pull{outline:2px solid ${tint(RUST, .35)}!important;outline-offset:5px}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const target = () => document.querySelector('[data-fx-target]');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const tidy = s => (s || '').replace(/\s+/g, ' ').trim();
  // True when the element's centre is on screen and not covered by an overlay.
  const visible = (el, r) => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
    const hit = document.elementFromPoint(cx, cy);
    return !!hit && (el.contains(hit) || hit.contains(el));
  };
  // Storage can throw (private mode, blocked site data) — treat that as empty.
  const store = (area, prefix) => ({
    get: k => { try { return area().getItem(prefix + k); } catch { return null; } },
    set: (k, v) => { try { area().setItem(prefix + k, v); } catch {} }
  });
  const local = store(() => localStorage, 'fx:'), session = store(() => sessionStorage, 'fx:');
  let mouse = { x: -1, y: -1 };

  /* ---------- Seismic ---------- */
  const ground = document.createElement('div');
  ground.className = 'fx-ground';
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-seismo';
  const cracks = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  cracks.setAttribute('class', 'fx-cracks');
  cracks.setAttribute('aria-hidden', 'true');
  document.body.prepend(ground);
  if (CFG.seismo) document.body.append(canvas);
  document.body.append(cracks);

  const ctx = canvas.getContext('2d');
  let trace = [], lastY = scrollY, tremor = 0, quakeAmt = 0, peak = 0, label = '';
  let wobbling = [], running = false, settle = 0;

  function sizeCanvas() {
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = SEISMO_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    trace = new Array(Math.ceil(innerWidth / 3)).fill(0);
    draw();
  }

  function draw() {
    if (!CFG.seismo) return;
    const w = innerWidth, mid = SEISMO_H / 2 + 3;
    ctx.clearRect(0, 0, w, SEISMO_H);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = quakeAmt > 0.05 ? RUST : tint(INK, .35);
    ctx.beginPath();
    trace.forEach((v, i) => {
      const x = w - (trace.length - 1 - i) * 3, y = mid + v * (SEISMO_H / 2 - 2);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.font = `600 10px ${MONO}`;
    ctx.fillStyle = quakeAmt > 0.05 ? RUST : tint(INK, .45);
    ctx.fillText(label || `SEISMO  M ${(peak * 6).toFixed(1)}`, 12, 11);
  }

  function tick() {
    const dy = Math.abs(scrollY - lastY);
    lastY = scrollY;
    tremor = Math.max(tremor * 0.9, Math.min(dy / 80, 1));
    quakeAmt *= 0.965;
    const level = Math.min(tremor * 0.6 + quakeAmt, 1);
    peak = Math.max(peak * 0.985, level);

    trace.push(level * (Math.random() * 2 - 1) + (Math.random() - 0.5) * 0.04);
    trace.shift();
    draw();

    const amp = reduce ? 0 : tremor * 3 + quakeAmt * 16;
    ground.style.transform = amp > 0.2
      ? `translate(${(Math.random() - .5) * amp}px,${(Math.random() - .5) * amp}px) rotate(${(Math.random() - .5) * amp * .04}deg)`
      : '';
    if (wobbling.length) {
      const a = quakeAmt * 10;
      wobbling.forEach(el => {
        el.style.translate = a > 0.3 ? `${(Math.random() - .5) * a}px ${(Math.random() - .5) * a}px` : '';
        el.style.rotate = a > 0.3 ? `${(Math.random() - .5) * a * .6}deg` : '';
      });
      if (a <= 0.3) { wobbling = []; label = ''; }
    }

    settle = level > 0.01 ? 0 : settle + 1;
    if (settle > trace.length) { running = false; ground.style.transform = ''; return; }
    requestAnimationFrame(tick);
  }
  function wake() { if (!running) { running = true; settle = 0; requestAnimationFrame(tick); } }

  function crackFrom(x, y) {
    const n = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      let ang = (i / n) * Math.PI * 2 + Math.random() * 0.6, px = x, py = y, d = `M${x} ${y}`, len = 0;
      const segs = 5 + Math.floor(Math.random() * 5);
      for (let s = 0; s < segs; s++) {
        const step = 18 + Math.random() * 34;
        ang += (Math.random() - .5) * 0.9;
        px += Math.cos(ang) * step; py += Math.sin(ang) * step;
        d += ` L${px.toFixed(1)} ${py.toFixed(1)}`;
        len += step;
      }
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.style.setProperty('--len', Math.ceil(len));
      cracks.append(p);
      setTimeout(() => p.remove(), 2400);
    }
  }

  function quake(x = innerWidth / 2, y = innerHeight / 2, strength = 1) {
    quakeAmt = Math.max(quakeAmt, strength);
    peak = Math.max(peak, strength);
    label = `M ${(4.6 + strength * 1.6 + Math.random() * .4).toFixed(1)}  ·  SENT`;
    crackFrom(x, y);
    if (!reduce) wobbling = [...document.querySelectorAll('button, .btn, [data-fx-wobble]')];
    if (fox) { fox.hop(); fox.say('whoa.', 1400); }
    wake();
  }

  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', sizeCanvas);
  document.addEventListener('submit', e => {
    if (!e.target.matches('[data-fx-quake]')) return;
    const r = (e.submitter || e.target).getBoundingClientRect();
    quake(r.left + r.width / 2, r.top + r.height / 2);
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-fx-quake], a[data-fx-quake]');
    if (b) quake(e.clientX, e.clientY);
  });
  sizeCanvas();

  /* ---------- Fox voice (Web Audio) ---------- */
  // Syllable → [start Hz, end Hz, seconds]. Rough imitations of real fox calls:
  // yips and barks ("wow"), gekkering, the vixen scream ("eeek"), contact "mrrp".
  const VOICE = {
    yip: [900, 1600, .07], wow: [700, 1150, .16], gekk: [620, 480, .05], ack: [520, 440, .06],
    ha: [800, 700, .05], eeek: [1900, 1300, .3], mrrp: [400, 700, .12], wa: [600, 900, .06],
    pa: [650, 850, .05], huff: [300, 200, .1]
  };
  const CALLS = ['Yip', 'Yip-yip', 'Gekk-gekk-gekk', 'Wow-wow', 'Ack-ack-ack', 'Ha-ha-ha-ha', 'Eeek', 'Mrrp', 'Wa-pa-pa-pa', 'Huff'];
  let audio = null;

  function foxCalls() {
    const n = 2 + Math.floor(Math.random() * 2), picked = [];
    while (picked.length < n) {
      const c = CALLS[Math.floor(Math.random() * CALLS.length)];
      if (!picked.includes(c)) picked.push(c);
    }
    const seps = ['! ', '… ', ' — '];
    const text = picked.map((c, i) => i ? seps[Math.floor(Math.random() * seps.length)] + c.toLowerCase() : c).join('') + '!';
    return { text, calls: picked };
  }

  function voice(calls) {
    if (local.get('sound') !== 'on') return;
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    if (audio.state === 'suspended') audio.resume();
    let t = audio.currentTime + 0.03;
    for (const call of calls) {
      for (const syl of call.toLowerCase().split('-')) {
        const [f0, f1, d] = VOICE[syl] || VOICE.yip;
        const o = audio.createOscillator(), g = audio.createGain(), bp = audio.createBiquadFilter();
        o.type = 'sawtooth';
        bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + d);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(bp).connect(g).connect(audio.destination);
        o.start(t); o.stop(t + d + 0.02);
        t += d + 0.035;
      }
      t += 0.14;
    }
  }

  /* ---------- Page awareness ---------- */
  // The innermost hinted element or section crossing the reading line (45% down the viewport).
  function currentTopic() {
    const line = innerHeight * 0.45;
    let best = null, bestH = Infinity;
    for (const el of document.querySelectorAll('[data-fx-say], section[id], article[id], main')) {
      const r = el.getBoundingClientRect();
      if (r.height && r.top <= line && r.bottom >= line && r.height < bestH && visible(el, { left: r.left, top: line - 1, width: r.width, height: 2 })) {
        best = el; bestH = r.height;
      }
    }
    if (!best) return null;
    const h = best.querySelector('h1,h2,h3,[class*="title"],[class*="label"]');
    const heading = tidy(h && h.innerText) || best.id || document.title;
    const links = [...best.querySelectorAll('a[href]')]
      .map(a => ({ href: a.getAttribute('href'), label: tidy(a.textContent || a.getAttribute('aria-label')).slice(0, 40) }))
      .filter(l => l.label && l.href !== '#' && !l.href.startsWith('javascript:'))
      .slice(0, 12);
    return {
      key: location.pathname + '#' + (best.id || heading),
      heading: heading.slice(0, 80),
      text: tidy(best.innerText).slice(0, 600),
      say: best.dataset.fxSay || '',
      href: best.dataset.fxHref || '',
      cta: best.dataset.fxCta || '',
      links
    };
  }

  function pageContext(tp) {
    return `\n\nThe visitor is on the page "${document.title}" (${location.pathname})` +
      (tp ? `, looking at the part titled "${tp.heading}". What they can see: ${tp.text}` : '.');
  }

  async function ask(question, context) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(CFG.api, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context })
      });
      const d = await r.json();
      return tidy(d.answer) || null;
    } catch { return null; } finally { clearTimeout(timer); }
  }

  async function suggestionFor(tp) {
    const cached = session.get('s:' + tp.key);
    if (cached) { try { return JSON.parse(cached); } catch {} }
    const lang = (document.documentElement.lang || 'en').startsWith('de') ? 'German' : 'English';
    const sys = CFG.context + `\n\nWrite ONE short suggestion (max 25 words) for a visitor who is reading the part of the page described below. Point them to a concrete next step. Write in ${lang}. No greeting, no emoji, no quotation marks. If one of the listed links fits, end with " || " followed by that link's href exactly.`;
    const q = `Page: ${document.title} (${location.pathname})\nSection: ${tp.heading}\nAuthor hint: ${tp.say || '-'}\nVisible text: ${tp.text}\nLinks:\n${tp.links.map(l => `- ${l.label}: ${l.href}`).join('\n') || '-'}`;
    const answer = CFG.api ? await ask(q, sys) : null;
    let res;
    if (answer) {
      const [text, href] = answer.split('||').map(s => s.trim().replace(/^["“]|["”]$/g, ''));
      const link = tp.links.find(l => l.href === href);
      res = link ? { text, href: link.href, cta: link.label + ' →' } : { text, href: tp.href, cta: tp.cta };
    } else {
      res = { text: tp.say || `Curious about “${tp.heading}”? Click me and ask — I translate.`, href: tp.href, cta: tp.cta };
    }
    session.set('s:' + tp.key, JSON.stringify(res));
    return res;
  }

  /* ---------- Fox ---------- */
  let fox = null;
  if (CFG.fox) fox = makeFox();

  function makeFox() {
    const el = document.createElement('div');
    el.className = 'fx-fox';
    el.innerHTML = `<div class="fx-bubble" aria-hidden="true"></div>
<svg viewBox="0 0 96 64" aria-hidden="true">
  <path class="fx-tail" d="M28 38 C14 40 2 30 6 16 C10 22 16 26 26 30 Z" fill="${RUST}"/>
  <g stroke="${INK}" stroke-width="2.5" stroke-linecap="round">
    <line class="fx-leg fx-leg-a" x1="32" y1="47" x2="32" y2="58"/>
    <line class="fx-leg fx-leg-b" x1="38" y1="47" x2="38" y2="58"/>
    <line class="fx-leg fx-leg-b" x1="52" y1="47" x2="52" y2="58"/>
    <line class="fx-leg fx-leg-a" x1="58" y1="47" x2="58" y2="58"/>
  </g>
  <ellipse cx="44" cy="40" rx="20" ry="10" fill="${BG}" stroke="${INK}" stroke-width="2.5"/>
  <g class="fx-head">
    <path d="M60 36 L66 12 L73 24 L80 12 L84 30 L93 38 L80 46 L62 44 Z" fill="${BG}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M84 30 L93 38 L80 46 Z" fill="${RUST}" opacity=".9"/>
    <circle cx="93" cy="38" r="2.2" fill="${INK}"/>
    <circle cx="75" cy="31" r="3.6" fill="${BG}" stroke="${INK}" stroke-width="1.6"/>
    <circle class="fx-pupil" cx="75" cy="31" r="1.8" fill="${INK}"/>
  </g>
</svg>`;
    document.body.append(el);
    const bubble = el.querySelector('.fx-bubble'), pupil = el.querySelector('.fx-pupil');
    let pos = { x: 0, y: 0 }, facing = 1, state = 'home', idleTimer, sayTimer, homeTimer;
    let dwellKey = '', dwellSince = 0, lastAct = Date.now();

    const homePos = () => ({ x: 14, y: innerHeight - FOX_H - SEISMO_H + 8 });

    function place(x, y, animate = true) {
      const dist = Math.hypot(x - pos.x, y - pos.y);
      facing = x < pos.x - 2 ? -1 : x > pos.x + 2 ? 1 : facing;
      el.classList.toggle('flip', facing < 0);
      el.style.transition = animate && !reduce ? '' : 'none';
      el.style.transform = `translate(${x}px,${y}px)`;
      pos = { x, y };
      if (animate && !reduce && dist > 4) {
        el.classList.add('run');
        clearTimeout(place.t);
        place.t = setTimeout(() => el.classList.remove('run'), 900);
      }
    }
    function say(text, ms = 3200) {
      bubble.textContent = text;
      bubble.classList.add('show');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => bubble.classList.remove('show'), ms);
    }
    function hop() {
      if (reduce) return;
      el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
    }
    function wag(on) { el.classList.toggle('wag', on && !reduce); }

    function trail(from, to) {
      if (reduce) return;
      const steps = Math.min(18, Math.max(4, Math.floor(Math.hypot(to.x - from.x, to.y - from.y) / 34)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, p = document.createElement('span');
        p.className = 'fx-paw';
        const side = i % 2 ? -5 : 5;
        p.style.left = `${from.x + (to.x - from.x) * t + FOX_W / 2}px`;
        p.style.top = `${from.y + (to.y - from.y) * t + FOX_H - 6 + side}px`;
        p.style.animationDelay = `${t * 0.8}s`;
        document.body.append(p);
        setTimeout(() => p.remove(), 2600);
      }
    }

    function guide() {
      const t = target();
      if (!t || think.open || state === 'hunting') return false;
      const r = t.getBoundingClientRect();
      if (!visible(t, r)) return false;
      // Sit on top of the target, or just under it when there's no room above.
      const x = clamp(r.left + r.width / 2 - FOX_W / 2, 8, innerWidth - FOX_W - 8);
      let y = r.top - FOX_H + 6;
      if (y < 64) y = r.bottom + 4;
      y = clamp(y, 8, innerHeight - FOX_H - SEISMO_H);
      trail(pos, { x, y });
      place(x, y);
      facing = mouse.x >= 0 && mouse.x < x + FOX_W / 2 ? -1 : 1;
      setTimeout(() => {
        el.classList.toggle('flip', facing < 0);
        wag(true);
        say(t.dataset.fxHint || 'psst — here');
      }, reduce ? 0 : 900);
      state = 'guiding';
      clearTimeout(homeTimer);
      homeTimer = setTimeout(goHome, 9000);
      return true;
    }
    // Resolves once the fox is back in its corner.
    function goHome() {
      if (state === 'home') return Promise.resolve();
      state = 'home';
      wag(false);
      el.classList.remove('stalk', 'pounce');
      bubble.classList.remove('show');
      const h = homePos();
      place(h.x, h.y);
      return wait(reduce ? 0 : 900).then(() => {
        if (state === 'home') { facing = 1; el.classList.remove('flip'); }
      });
    }

    function onIdle() {
      if (think.open || state === 'hunting') return;
      if (guide()) return;
      if (!CFG.talk) return;
      const tp = currentTopic();
      if (!tp) return;
      if (tp.key !== dwellKey) {
        dwellKey = tp.key; dwellSince = Date.now();
        idleTimer = setTimeout(onIdle, CFG.dwellMs);
      } else if (Date.now() - dwellSince >= CFG.dwellMs) {
        think.suggest(tp);
      }
    }
    function resetIdle() {
      lastAct = Date.now();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(onIdle, CFG.idleMs);
    }

    function look() {
      const ex = pos.x + (facing > 0 ? 75 : FOX_W - 75), ey = pos.y + 31;
      let dx = mouse.x - ex, dy = mouse.y - ey;
      const d = Math.hypot(dx, dy) || 1;
      dx = (dx / d) * 1.5 * facing; dy = (dy / d) * 1.5;
      pupil.setAttribute('cx', 75 + dx);
      pupil.setAttribute('cy', 31 + dy);
    }

    function magnet() {
      const t = target();
      if (!t) return;
      const r = t.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = mouse.x - cx, dy = mouse.y - cy, d = Math.hypot(dx, dy), R = 150;
      if (d < R && !reduce && visible(t, r)) {
        const k = (1 - d / R) * 0.22;
        t.style.translate = `${clamp(dx * k, -10, 10)}px ${clamp(dy * k, -10, 10)}px`;
        t.classList.add('fx-pull');
      } else if (t.style.translate) {
        t.style.translate = '';
        t.classList.remove('fx-pull');
      }
    }

    /* Thought bubble: fox talk → translation. */
    const think = (() => {
      const box = document.createElement('div');
      box.className = 'fx-think';
      box.hidden = true;
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Fox assistant');
      box.innerHTML = `<div class="fx-t-head"><span>fox → human</span><span>
  <button type="button" class="fx-t-sound"></button><button type="button" class="fx-t-close" aria-label="Close">✕</button></span></div>
<p class="fx-t-raw" aria-hidden="true"></p>
<p class="fx-t-out" aria-live="polite"></p>
<a class="fx-t-cta" hidden></a>
<form class="fx-t-ask"><input name="q" maxlength="300" autocomplete="off" placeholder="Ask the fox anything…" aria-label="Ask the fox"><button aria-label="Send">→</button></form>`;
      document.body.append(box);
      const raw = box.querySelector('.fx-t-raw'), out = box.querySelector('.fx-t-out');
      const cta = box.querySelector('.fx-t-cta'), form = box.querySelector('form'), input = form.q;
      const soundBtn = box.querySelector('.fx-t-sound');
      let run = 0, hideTimer, auto = false, dismissals = 0, lastAuto = 0;
      const shown = new Set();

      const paintSound = () => {
        const on = local.get('sound') === 'on';
        soundBtn.textContent = on ? '♪ on' : '♪ off';
        soundBtn.setAttribute('aria-label', on ? 'Mute fox' : 'Unmute fox');
      };
      paintSound();

      async function type(node, text, ms, id) {
        if (reduce) { node.textContent = text; return; }
        node.textContent = '';
        for (let i = 0; i < text.length; i += 2) {
          if (id !== run) return;
          node.textContent = text.slice(0, i + 2);
          await wait(ms);
        }
      }

      function hold() { clearTimeout(hideTimer); }
      function autoHide() {
        hold();
        hideTimer = setTimeout(() => { if (!box.matches(':hover, :focus-within')) close(); else autoHide(); }, 11000);
      }

      async function speak(answer, { isAuto = false } = {}) {
        const id = ++run;
        auto = isAuto;
        hold();
        if (state !== 'home') await goHome();
        if (id !== run) return;
        box.hidden = false;
        api.open = true;
        raw.classList.remove('done');
        out.textContent = '';
        cta.hidden = true;
        const fx = foxCalls();
        voice(fx.calls);
        el.classList.add('talk');
        wag(true);
        await type(raw, fx.text, 38, id);
        const res = await answer;
        if (id !== run) return;
        el.classList.remove('talk');
        raw.classList.add('done');
        await type(out, res.text, 16, id);
        if (id !== run) return;
        if (res.href) {
          cta.href = res.href;
          cta.textContent = res.cta || 'Show me →';
          cta.hidden = false;
        }
        wag(false);
        if (auto) autoHide();
      }

      function close() {
        run++;
        hold();
        box.hidden = true;
        api.open = false;
        el.classList.remove('talk');
        wag(false);
        if (auto && ++dismissals >= 2) api.quiet = true;
      }

      form.addEventListener('submit', e => {
        e.preventDefault();
        const q = tidy(input.value);
        if (!q) return;
        input.value = '';
        if (/\b(hunt|jag|hase|hasen|rabbit|bunny)/i.test(q)) { close(); hunt(); return; }
        const answer = (CFG.api ? ask(q, CFG.context + pageContext(currentTopic())) : Promise.resolve(null))
          .then(a => ({ text: a || 'My translator glitched. Try again — or write to systems@architect-dna.ch.' }));
        speak(answer);
      });
      soundBtn.addEventListener('click', () => {
        local.set('sound', local.get('sound') === 'on' ? 'off' : 'on');
        paintSound();
        if (local.get('sound') === 'on') voice(['Yip']);
      });
      box.querySelector('.fx-t-close').addEventListener('click', close);
      box.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); hit.focus(); } });
      box.addEventListener('focusin', () => { auto = false; hold(); });

      const api = {
        open: false, quiet: false,
        toggle() {
          if (api.open) return close();
          if (local.get('sound') === null) { local.set('sound', 'on'); paintSound(); }
          const tp = currentTopic();
          const where = tp ? `“${tp.heading}”` : document.title;
          speak(Promise.resolve({ text: `Hi! I'm the Architect-DNA fox. You're looking at ${where} — ask me anything about it.` }))
            .then(() => { if (api.open) input.focus({ preventScroll: true }); });
        },
        suggest(tp = currentTopic()) {
          if (!tp || api.open || api.quiet || shown.has(tp.key) || Date.now() - lastAuto < 25000) return;
          shown.add(tp.key);
          lastAuto = Date.now();
          speak(suggestionFor(tp), { isAuto: true });
        },
        close
      };
      return api;
    })();

    /* Hunt: rabbit pops up on the ground line, fox stalks, chases and pounces. */
    const groundY = () => innerHeight - SEISMO_H + 2;
    let huntSeq = 0, rabbit = null, holes = [], lastHunt = 0;
    const bootAt = Date.now();

    function makeHole(x) {
      const h = document.createElement('span');
      h.className = 'fx-hole';
      h.style.left = `${x}px`;
      h.style.top = `${groundY() - 5}px`;
      document.body.append(h);
      holes.push(h);
    }
    function rabbitTo(x, ms, hopping = true) {
      const r = rabbit;
      if (!r) return Promise.resolve();
      r.classList.toggle('flip', x < r.x);
      r.style.transition = `transform ${ms}ms linear`;
      r.style.transform = `translate(${x}px,${groundY() - 36}px)`;
      r.x = x;
      if (hopping) r.classList.add('hopping');
      return wait(ms).then(() => r.classList.remove('hopping'));
    }
    function foxTo(x, ms, mode) {
      const y = homePos().y;
      facing = x < pos.x ? -1 : 1;
      el.classList.toggle('flip', facing < 0);
      el.style.transition = `transform ${ms}ms ${mode === 'pounce' ? 'cubic-bezier(.3,0,.4,1)' : 'linear'}`;
      el.style.transform = `translate(${x}px,${y}px)`;
      pos = { x, y };
      el.classList.add(mode);
      return wait(ms).then(() => el.classList.remove(mode));
    }
    function faceRabbit() {
      if (!rabbit) return;
      facing = rabbit.x + 24 > pos.x + FOX_W / 2 ? 1 : -1;
      el.classList.toggle('flip', facing < 0);
    }
    function clearHunt() {
      if (rabbit) { const r = rabbit; rabbit = null; r.style.transition = 'opacity .3s'; r.style.opacity = 0; setTimeout(() => r.remove(), 320); }
      holes.forEach(h => { h.style.opacity = 0; setTimeout(() => h.remove(), 650); });
      holes = [];
    }
    function endHunt() {
      clearHunt();
      el.classList.remove('stalk', 'pounce');
      if (state === 'hunting') { state = 'returning'; goHome(); }
    }

    async function hunt() {
      if (reduce) { say('not today.', 1500); return false; }
      if (state !== 'home' || think.open || rabbit) return false;
      state = 'hunting';
      lastHunt = Date.now();
      const id = ++huntSeq, alive = () => state === 'hunting' && huntSeq === id && rabbit;
      const W = innerWidth, minX = 60, maxX = W - 60;
      let rx = clamp(W * (.45 + Math.random() * .3), 170, maxX);

      rabbit = document.createElement('button');
      rabbit.type = 'button';
      rabbit.className = 'fx-rabbit pop';
      rabbit.setAttribute('aria-label', 'Rabbit — click to help it escape');
      rabbit.innerHTML = `<svg viewBox="0 0 48 40" aria-hidden="true">
  <circle cx="9" cy="27" r="3.6" fill="${BG}" stroke="${INK}" stroke-width="2"/>
  <ellipse cx="22" cy="28" rx="13" ry="8.5" fill="${BG}" stroke="${INK}" stroke-width="2.2"/>
  <line x1="17" y1="36" x2="27" y2="36" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
  <g class="fx-ears" fill="${BG}" stroke="${INK}" stroke-width="2" stroke-linejoin="round">
    <path d="M32 16 C29 5 32 0 35 2 C37 5 36 11 35.5 15"/>
    <path d="M36.5 15 C38 5 42 2 43.5 4 C44.5 8 41.5 13 39 16.5"/>
  </g>
  <circle cx="35" cy="21.5" r="7" fill="${BG}" stroke="${INK}" stroke-width="2.2"/>
  <circle cx="37.6" cy="20.5" r="1.3" fill="${INK}"/>
  <circle cx="41.6" cy="22.6" r="1.1" fill="${RUST}"/>
</svg>`;
      rabbit.x = rx;
      rabbit.style.transform = `translate(${rx}px,${groundY() - 36}px)`;
      document.body.append(rabbit);
      makeHole(rx + 7);
      rabbit.addEventListener('click', e => {
        e.stopPropagation();
        if (!rabbit) return;
        const saved = (+local.get('saved') || 0) + 1;
        local.set('saved', String(saved));
        const r = rabbit.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, BG, INK);
        say(`hey! · ${saved} saved`, 2000);
        huntSeq++;
        endHunt();
      });
      setTimeout(() => rabbit && rabbit.classList.remove('pop'), 460);

      await wait(900);
      if (!alive()) return endHunt();
      say('!', 900);
      el.classList.add('stalk');
      await foxTo(Math.max(14, rx - 170), 2400, 'stalk');
      if (!alive()) return endHunt();
      faceRabbit();

      const hops = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < hops; i++) {
        rabbit.classList.add('twitch');
        await wait(420);
        if (!alive()) return endHunt();
        rabbit.classList.remove('twitch');
        let dir = Math.random() < .7 ? 1 : -1;
        let nx = rx + dir * (110 + Math.random() * 120);
        if (nx > maxX || nx < minX) { dir = -dir; nx = rx + dir * (110 + Math.random() * 120); }
        nx = clamp(nx, minX, maxX);
        const chase = clamp(nx - dir * 110, 8, W - FOX_W - 8);
        await Promise.all([rabbitTo(nx, 700), wait(150).then(() => foxTo(chase, 750, 'run'))]);
        rx = nx;
        if (!alive()) return endHunt();
        faceRabbit();
      }

      const escapes = Math.random() < .6;
      faceRabbit();
      const landX = clamp(facing > 0 ? rx + 24 - 80 : rx + 24 - 16, 8, W - FOX_W - 8);
      if (escapes) {
        makeHole(rx + 7);
        rabbit.style.transition = 'transform .35s ease-in, opacity .2s .15s';
        rabbit.style.transform = `translate(${rx}px,${groundY() - 10}px)`;
        rabbit.style.opacity = 0;
      }
      await foxTo(landX, 700, 'pounce');
      if (state !== 'hunting' || huntSeq !== id) return endHunt();
      quakeAmt = Math.max(quakeAmt, .3);
      wake();
      burst(landX + FOX_W / 2, groundY() - 4, tint(INK, .35));
      if (escapes) {
        say('…?', 1600);
      } else if (rabbit) {
        const r = rabbit.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, BG, INK);
        rabbit.remove();
        rabbit = null;
        say('got it!', 1600);
        wag(true);
      }
      await wait(1700);
      wag(false);
      if (huntSeq === id) endHunt();
    }

    // Now and then, when the visitor is idle: at most once every 3 minutes.
    setInterval(() => {
      const now = Date.now();
      if (document.hidden || reduce || now - bootAt < 25000 || now - lastHunt < 180000 || now - lastAct < 6000) return;
      if (state !== 'home' || think.open || Math.random() < .5) return;
      hunt();
    }, 10000);

    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'fx-hit';
    hit.setAttribute('aria-label', 'Talk to the fox');
    if (CFG.talk) el.append(hit);
    hit.addEventListener('click', () => { hop(); think.toggle(); });

    addEventListener('mousemove', e => {
      mouse = { x: e.clientX, y: e.clientY };
      look(); magnet(); resetIdle();
    }, { passive: true });
    addEventListener('scroll', () => { if (state === 'guiding') goHome(); resetIdle(); }, { passive: true });
    addEventListener('keydown', resetIdle);
    addEventListener('touchstart', resetIdle, { passive: true });
    addEventListener('resize', () => { if (state === 'home') { const h = homePos(); place(h.x, h.y, false); } });
    document.addEventListener('click', e => {
      const t = target();
      if (!t || !t.contains(e.target)) return;
      hop(); say('nice.', 1200);
      if (!reduce) burst(e.clientX, e.clientY);
      clearTimeout(homeTimer);
      homeTimer = setTimeout(goHome, 1300);
    });

    const h = homePos();
    place(h.x, h.y, false);
    resetIdle();
    return { guide, home: goHome, say, hop, think, hunt };
  }

  function burst(x, y, color = RUST, border = '') {
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'fx-spark';
      s.style.left = `${x}px`; s.style.top = `${y}px`;
      s.style.background = color;
      if (border) s.style.border = `1px solid ${border}`;
      document.body.append(s);
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
      s.animate([
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d - 3}px,${Math.sin(a) * d - 3}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
      ], { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
    }
  }

  window.ArchitectFX = {
    quake,
    guide: () => fox && fox.guide(),
    home: () => fox && fox.home(),
    talk: () => fox && fox.think.toggle(),
    suggest: () => fox && fox.think.suggest(),
    hunt: () => fox && fox.hunt()
  };
})();
