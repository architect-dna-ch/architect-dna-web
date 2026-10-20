/* brand-fx.js — Architect-DNA brand interactions. No dependencies.

   1. Guide fox — an ink-line fox watches the cursor. When the visitor hesitates, it trots
      to the element marked [data-fx-target], leaves a paw trail, and the target leans
      toward the cursor as it gets close (a "magnetic" pull).
   2. Seismic — scroll speed shakes a blueprint grid behind the page and draws a
      seismograph along the bottom edge. Submitting a form[data-fx-quake] (or clicking a
      button[data-fx-quake]) sets off an earthquake: the ground cracks and buttons jump.

   Usage:
     <a href="#contact" data-fx-target data-fx-hint="say hi →">Contact</a>
     <form data-fx-quake>…</form>
     <script src="/fx/brand-fx.js" defer></script>

   Optional config before the script: window.ArchitectFXConfig = { idleMs, fox, seismo }
   API: ArchitectFX.quake(x, y, strength), ArchitectFX.guide(), ArchitectFX.home()
   Respects prefers-reduced-motion (no shaking, no running). */
(() => {
  const CFG = Object.assign({ idleMs: 3500, fox: true, seismo: true }, window.ArchitectFXConfig || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INK = '#1A1A1A', RUST = '#B5271E', BG = '#FAFAF8';
  const FOX_W = 96, FOX_H = 64, SEISMO_H = 28;

  const css = `
.fx-ground{position:fixed;inset:-40px;z-index:-1;pointer-events:none;will-change:transform;
  background-image:linear-gradient(rgba(26,26,26,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(26,26,26,.055) 1px,transparent 1px);
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
.fx-fox .fx-leg{transform-box:fill-box;transform-origin:50% 0}
.fx-fox.run .fx-leg-a{animation:fxleg .18s infinite alternate}
.fx-fox.run .fx-leg-b{animation:fxleg .18s infinite alternate-reverse}
.fx-fox .fx-tail{transform-box:fill-box;transform-origin:100% 80%}
.fx-fox.wag .fx-tail{animation:fxwag .28s infinite alternate}
.fx-fox.hop svg{animation:fxhop .5s ease-out}
.fx-fox.flip.hop svg{animation:fxhopflip .5s ease-out}
@keyframes fxleg{from{transform:rotate(-24deg)}to{transform:rotate(24deg)}}
@keyframes fxwag{from{transform:rotate(-14deg)}to{transform:rotate(12deg)}}
@keyframes fxhop{40%{transform:translateY(-26px)}}
@keyframes fxhopflip{0%,100%{transform:scaleX(-1)}40%{transform:scaleX(-1) translateY(-26px)}}
.fx-bubble{position:absolute;bottom:100%;left:50%;transform:translate(-50%,2px);background:${INK};color:${BG};
  font:600 12px/1 -apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',sans-serif;letter-spacing:-.01em;
  padding:7px 10px;border-radius:6px;white-space:nowrap;opacity:0;transition:opacity .2s,transform .2s}
.fx-bubble.show{opacity:1;transform:translate(-50%,-6px)}
.fx-paw{position:fixed;width:7px;height:9px;border-radius:50%;background:${INK};opacity:0;z-index:9989;pointer-events:none;
  animation:fxpaw 1.6s forwards}
@keyframes fxpaw{15%{opacity:.22}100%{opacity:0}}
.fx-spark{position:fixed;width:6px;height:6px;border-radius:1px;background:${RUST};z-index:9992;pointer-events:none}
.fx-pull{outline:2px solid rgba(181,39,30,.35)!important;outline-offset:5px}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const target = () => document.querySelector('[data-fx-target]');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // True when the element's centre is on screen and not covered by an overlay.
  const visible = (el, r) => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
    const hit = document.elementFromPoint(cx, cy);
    return !!hit && (el.contains(hit) || hit.contains(el));
  };
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
    ctx.strokeStyle = quakeAmt > 0.05 ? RUST : 'rgba(26,26,26,.35)';
    ctx.beginPath();
    trace.forEach((v, i) => {
      const x = w - (trace.length - 1 - i) * 3, y = mid + v * (SEISMO_H / 2 - 2);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.font = '600 10px "SF Mono","Fira Code","Courier New",monospace';
    ctx.fillStyle = quakeAmt > 0.05 ? RUST : 'rgba(26,26,26,.45)';
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

  /* ---------- Guide fox ---------- */
  let fox = null;
  if (CFG.fox) fox = makeFox();

  function makeFox() {
    const el = document.createElement('div');
    el.className = 'fx-fox';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="fx-bubble"></div>
<svg viewBox="0 0 96 64">
  <path class="fx-tail" d="M28 38 C14 40 2 30 6 16 C10 22 16 26 26 30 Z" fill="${RUST}"/>
  <g stroke="${INK}" stroke-width="2.5" stroke-linecap="round">
    <line class="fx-leg fx-leg-a" x1="32" y1="47" x2="32" y2="58"/>
    <line class="fx-leg fx-leg-b" x1="38" y1="47" x2="38" y2="58"/>
    <line class="fx-leg fx-leg-b" x1="52" y1="47" x2="52" y2="58"/>
    <line class="fx-leg fx-leg-a" x1="58" y1="47" x2="58" y2="58"/>
  </g>
  <ellipse cx="44" cy="40" rx="20" ry="10" fill="${BG}" stroke="${INK}" stroke-width="2.5"/>
  <path d="M60 36 L66 12 L73 24 L80 12 L84 30 L93 38 L80 46 L62 44 Z" fill="${BG}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M84 30 L93 38 L80 46 Z" fill="${RUST}" opacity=".9"/>
  <circle cx="93" cy="38" r="2.2" fill="${INK}"/>
  <circle cx="75" cy="31" r="3.6" fill="${BG}" stroke="${INK}" stroke-width="1.6"/>
  <circle class="fx-pupil" cx="75" cy="31" r="1.8" fill="${INK}"/>
</svg>`;
    document.body.append(el);
    const bubble = el.querySelector('.fx-bubble'), pupil = el.querySelector('.fx-pupil');
    let pos = { x: 0, y: 0 }, facing = 1, state = 'home', idleTimer, sayTimer, homeTimer;

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
      if (!t) return;
      const r = t.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) {
        say(r.top > innerHeight ? 'this way ↓' : 'up here ↑');
        wag(true); setTimeout(() => wag(false), 1800);
        return;
      }
      if (!visible(t, r)) return;
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
    }
    function goHome() {
      if (state === 'home') return;
      state = 'home';
      wag(false);
      bubble.classList.remove('show');
      const h = homePos();
      place(h.x, h.y);
      setTimeout(() => { if (state === 'home') { facing = 1; el.classList.remove('flip'); } }, reduce ? 0 : 900);
    }
    function resetIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(guide, CFG.idleMs);
    }

    function look() {
      const ex = pos.x + (facing > 0 ? 75 : FOX_W - 75) * FOX_W / 96, ey = pos.y + 31 * FOX_H / 64;
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

    addEventListener('mousemove', e => {
      mouse = { x: e.clientX, y: e.clientY };
      look(); magnet(); resetIdle();
    }, { passive: true });
    addEventListener('scroll', () => { goHome(); resetIdle(); }, { passive: true });
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
    return { guide, home: goHome, say, hop };
  }

  function burst(x, y) {
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'fx-spark';
      s.style.left = `${x}px`; s.style.top = `${y}px`;
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
    home: () => fox && fox.home()
  };
})();
