// The home page: the concept cards (from concepts.js) with small previews, and the hero, where spinning
// circles (the Rust Fourier series) have drawn a heart. Everything is still while the page scrolls; a card
// plays its preview only while a mouse rests on it.
import init, { Fourier, Craft, circular_speed, computer_guesses } from './pkg/lilavati.js';
import { CONCEPTS, CHAPTERS, card } from './concepts.js';
import { Plane, COL, I2, apply, rot, mul } from './la.js';

document.getElementById('cards').innerHTML = CONCEPTS.filter(c => c.status === 'live' && !c.series).map(card).join('');
document.getElementById('cards-la').innerHTML = CHAPTERS[0].slugs.map(s => card(CONCEPTS.find(c => c.slug === s))).join('');
document.getElementById('soon').innerHTML = CONCEPTS.filter(c => c.status !== 'live').map(card).join('');
await init();
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// shapes for the hero, as points round the outline in a 2×2 box around 0
const SHAPES = [
  ['a heart', n => Array.from({ length: n }, (_, i) => { const u = 2 * Math.PI * i / n; return [16 * Math.sin(u) ** 3 / 17, -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) / 17 - 0.1]; }).flat()],
  ['a star', () => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.42 : 1, u = -Math.PI / 2 + Math.PI * i / 5; return [r * Math.cos(u), r * Math.sin(u) + 0.08]; }).flat()],
  ['a fish', n => Array.from({ length: n }, (_, i) => { const u = 2 * Math.PI * i / n; return [Math.cos(u) - Math.sin(u) ** 2 / Math.SQRT2 * 0.9, Math.cos(u) * Math.sin(u) * 0.9]; }).flat()],
  ['a square', () => [-.8, -.8, .8, -.8, .8, .8, -.8, .8]],
];
const fits = SHAPES.map(([name, f]) => ({ name, fit: Fourier.fit(new Float64Array(f(400)), 40, 0) }));

const hero = document.getElementById('hero'), hc = hero.getContext('2d');
let which = 0, t = 0, trail = [], last = 0;
const SPEED = 0.9;   // radians per second: one shape every 7 s
function drawHero(dt) {
  const W = hero.width, S = W * 0.36, map = (x, y) => [W / 2 + S * x, W / 2 + S * y];
  const { fit } = fits[which], n = 30;
  hc.clearRect(0, 0, W, W);
  t += dt * SPEED;
  if (t > 2 * Math.PI + 1.2) { t = 0; trail = []; which = (which + 1) % fits.length; document.getElementById('heroCap').textContent = `Circles riding on circles, drawing ${fits[which].name}. That's a Fourier series.`; return; }
  // the shape it is heading for, faint, so there is always something to see
  hc.strokeStyle = 'rgba(37,99,235,.12)'; hc.lineWidth = 5; hc.beginPath();
  const tr = fit.trace(n, 300); for (let i = 0; i < tr.length; i += 2) { const [x, y] = map(tr[i], tr[i + 1]); i ? hc.lineTo(x, y) : hc.moveTo(x, y); } hc.closePath(); hc.stroke();
  const tt = Math.min(t, 2 * Math.PI), arms = fits[which].fit.arms(n, tt);
  let tip = map(fit.coefficient(0, 0), fit.coefficient(2, 0));
  for (let i = 0; i < arms.length; i += 4) {
    const [x, y] = map(arms[i], arms[i + 1]), r = arms[i + 2] * S, a = arms[i + 3];
    if (r < 0.6) continue;
    hc.strokeStyle = 'rgba(28,25,23,.14)'; hc.lineWidth = 1.5; hc.beginPath(); hc.arc(x, y, r, 0, 7); hc.stroke();
    const nx = x + r * Math.cos(a), ny = y + r * Math.sin(a);
    hc.strokeStyle = 'rgba(28,25,23,.55)'; hc.lineWidth = 2; hc.beginPath(); hc.moveTo(x, y); hc.lineTo(nx, ny); hc.stroke();
    tip = [nx, ny];
  }
  if (t <= 2 * Math.PI) trail.push(tip);
  hc.strokeStyle = '#2563eb'; hc.lineWidth = 6; hc.lineCap = hc.lineJoin = 'round'; hc.beginPath();
  trail.forEach(([x, y], i) => (i ? hc.lineTo(x, y) : hc.moveTo(x, y))); hc.stroke();
  hc.fillStyle = '#dc2626'; hc.beginPath(); hc.arc(tip[0], tip[1], 9, 0, 7); hc.fill();
}

// card previews
const previews = {
  'fourier-series'(c, w, h, sec) {
    const f = fits[1].fit, S = h * 0.36, cx = w / 2, cy = h / 2, tt = (sec * 0.8) % (2 * Math.PI), map = (x, y) => [cx + S * x, cy + S * y];
    c.strokeStyle = 'rgba(37,99,235,.35)'; c.lineWidth = 2.5; c.beginPath();
    const tr = f.trace(12, 200); for (let i = 0; i < tr.length; i += 2) { const [x, y] = map(tr[i], tr[i + 1]); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); c.stroke();
    const arms = f.arms(12, tt); let tip;
    for (let i = 0; i < arms.length; i += 4) { const [x, y] = map(arms[i], arms[i + 1]), r = arms[i + 2] * S, a = arms[i + 3];
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
      tip = [x + r * Math.cos(a), y + r * Math.sin(a)]; c.strokeStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.moveTo(x, y); c.lineTo(...tip); c.stroke(); }
    c.fillStyle = '#dc2626'; c.beginPath(); c.arc(tip[0], tip[1], 5, 0, 7); c.fill();
  },
  derivatives(c, w, h, sec) {
    const rows = [[t => -Math.cos(t), '#2563eb'], [t => Math.sin(t), '#059669'], [t => Math.cos(t), '#dc2626']];
    const now = (sec * 1.2) % (2 * Math.PI), pad = 24, rh = (h - 20) / 3;
    rows.forEach(([f, col], r) => {
      const mid = 10 + rh * r + rh / 2, X = u => pad + (w - 2 * pad) * u / (2 * Math.PI), Y = v => mid - v * rh * 0.36;
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(pad, mid); c.lineTo(w - pad, mid); c.stroke();
      c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); for (let i = 0; i <= 120; i++) { const u = 2 * Math.PI * i / 120; i ? c.lineTo(X(u), Y(f(u))) : c.moveTo(X(u), Y(f(u))); } c.stroke();
      if (r < 2) { const m = rows[r + 1][0](now) * 0.36 * rh / ((w - 2 * pad) / (2 * Math.PI)); c.strokeStyle = '#f59e0b'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(now) - 30, Y(f(now)) + 30 * m); c.lineTo(X(now) + 30, Y(f(now)) - 30 * m); c.stroke(); }
      c.fillStyle = col; c.beginPath(); c.arc(X(now), Y(f(now)), 5, 0, 7); c.fill();
    });
  },
};
// a small satellite on an ellipse, its path drawn behind it
const RE = 6.371e6, orbiter = new Craft(0, RE + 1.2e6, -circular_speed(RE + 1.2e6) * 1.18, 0);
let orbTrail = [], orbLast = 0;
previews.orbits = (c, w, h, sec) => {
  const s = h * 0.33 / RE, cx = w / 2 - 60, cy = h / 2 + 50, V = (x, y) => [cx + x * s, cy - y * s];
  orbiter.advance(Math.max(0, sec - orbLast) * 900); orbLast = sec;
  const [x, y] = orbiter.state(); orbTrail.push(x, y); if (orbTrail.length > 700) orbTrail.splice(0, 2);
  c.fillStyle = '#0b1324'; c.fillRect(0, 0, w, h);
  const g = c.createRadialGradient(cx - 20, cy - 20, 5, cx, cy, RE * s); g.addColorStop(0, '#3b82f6'); g.addColorStop(1, '#1e3a8a');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, RE * s, 0, 7); c.fill();
  c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < orbTrail.length; i += 2) { const [px, py] = V(orbTrail[i], orbTrail[i + 1]); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
  const [px, py] = V(x, y); c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 5, 0, 7); c.fill();
};
// the linear algebra chapter: small moving pictures of each idea
const laPlane = (c, w, h) => new Plane(c.canvas, 2.6, [(w - h) / 2, 0, h]);
const breathe = sec => [1 + 0.5 * Math.sin(sec * 0.9), 0.6 * Math.sin(sec * 0.6), 0.3 * Math.sin(sec * 0.7 + 1), 1 + 0.3 * Math.cos(sec * 0.8)];
Object.assign(previews, {
  'dot-product'(c, w, h, sec) { const p = laPlane(c, w, h), t = sec * 0.7, b = [1.8 * Math.cos(t), 1.8 * Math.sin(t)], a = [2, 0.6], k = (a[0] * b[0] + a[1] * b[1]) / (a[0] ** 2 + a[1] ** 2);
    p.axes().line(b[0], b[1], a[0] * k, a[1] * k, '#999', 1.5, [5, 5]).line(0, 0, a[0] * k, a[1] * k, k >= 0 ? 'rgba(22,163,74,.8)' : 'rgba(220,38,38,.8)', 7).arrow(...a, COL.v, { width: 3 }).arrow(...b, COL.w, { width: 3 }); },
  'linear-transformations'(c, w, h, sec) { const p = laPlane(c, w, h), m = breathe(sec); p.grid(m, 'rgba(79,70,229,.35)').axes().arrow(...apply(m, 1, 0), COL.i, { width: 3 }).arrow(...apply(m, 0, 1), COL.j, { width: 3 }); },
  determinant(c, w, h, sec) { const p = laPlane(c, w, h), m = [1.3, 0.9 * Math.sin(sec * 0.6), 0.2, 1.1], d = m[0] * m[3] - m[1] * m[2];
    p.grid(m, 'rgba(194,65,12,.18)').axes().poly([0, 0, 1, 0, 1, 1, 0, 1], m, d > 0 ? 'rgba(22,163,74,.3)' : 'rgba(220,38,38,.3)', d > 0 ? '#15803d' : '#b91c1c').arrow(...apply(m, 1, 0), COL.i, { width: 3 }).arrow(...apply(m, 0, 1), COL.j, { width: 3 }); },
  eigenvectors(c, w, h, sec) { const p = laPlane(c, w, h), m = [1.6, 0.6, 0.6, 1.6], t = sec * 0.5, v = [1.2 * Math.cos(t), 1.2 * Math.sin(t)], av = apply(m, ...v);
    p.axes().through(1, 1, 'rgba(147,51,234,.6)', 2, [8, 6]).through(1, -1, 'rgba(147,51,234,.35)', 2, [4, 6]).arrow(...v, 'rgba(245,158,11,.5)', { width: 3 }).arrow(...av, COL.v, { width: 3 }); },
  svd(c, w, h, sec) { const p = laPlane(c, w, h), s = (sec * 0.5) % 4, t1 = Math.min(1, s), t2 = Math.max(0, Math.min(1, s - 1)), t3 = Math.max(0, Math.min(1, s - 2));
    const m = mul(rot(0.7 * t3), mul([1 + 0.8 * t2, 0, 0, 1 - 0.45 * t2], rot(-0.5 * t1)));
    p.grid(m, 'rgba(3,105,161,.2)').axes().circle(I2, null, 'rgba(0,0,0,.2)', 1.5).circle(m, 'rgba(14,165,233,.18)', '#0369a1', 2.5).arrow(...apply(m, Math.cos(0.5), Math.sin(0.5)), COL.w, { width: 3 }); },
});
// two waves and their sum, scrolling
previews.superposition = (c, w, h, sec) => {
  const rows = [[h * 0.2, x => Math.sin(x), '#2563eb'], [h * 0.42, x => Math.sin(1.1 * x), '#ea580c'], [h * 0.75, x => Math.sin(x) + Math.sin(1.1 * x), '#111']];
  for (const [y0, f, col] of rows) { c.strokeStyle = col; c.lineWidth = col === '#111' ? 2.5 : 2; c.beginPath();
    for (let i = 0; i <= 200; i++) { const x = 0.25 * i + sec * 3, X = 20 + (w - 40) * i / 200, Y = y0 - f(x) * (col === '#111' ? 22 : 14); i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); }
};
// the guessing game: rounds of guesses sliding down the number line towards 0
const rounds = []; { let avg = -1; for (let k = 1; k <= 6; k++) { const g = Array.from(computer_guesses(14, k, avg, 2 / 3, 5)); avg = g.reduce((a, b) => a + b, 0) / g.length; rounds.push({ g, avg }); } }
previews['nash-equilibrium'] = (c, w, h, sec) => {
  const X = v => 30 + (w - 60) * v / 100, y = h * 0.66, s = (sec * 0.45) % rounds.length, k = Math.floor(s), u = Math.min(1, (s - k) * 2.5), e = 1 - (1 - u) ** 3;
  const a = rounds[k], b = rounds[(k + 1) % rounds.length], wrap = k + 1 === rounds.length;
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(0), y); c.lineTo(X(100), y); c.stroke();
  c.fillStyle = 'rgba(0,0,0,.45)'; c.font = '13px system-ui'; c.textAlign = 'center'; for (const v of [0, 50, 100]) c.fillText(v, X(v), y + 22);
  a.g.forEach((v, i) => { const to = wrap ? v : b.g[i], x = X(v + (to - v) * e), yy = y - 14 - (i % 4) * 13; c.fillStyle = i === 0 ? '#be123c' : 'rgba(37,99,235,.7)'; c.beginPath(); c.arc(x, yy, 6, 0, 7); c.fill(); });
  const avg = wrap ? a.avg : a.avg + (b.avg - a.avg) * e;
  c.strokeStyle = '#be123c'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(avg * 2 / 3), y + 4); c.lineTo(X(avg * 2 / 3), 30); c.stroke();
  c.fillStyle = '#be123c'; c.font = '600 14px system-ui'; c.textAlign = 'left'; c.fillText(`round ${wrap ? k + 1 : k + 1 + (u > 0.5 ? 1 : 0)}: ⅔ of the average`, X(avg * 2 / 3) + 6, 40);
};
window.__lilavatiPreviews = previews;   // for tools/og.mjs, which draws the link-preview pictures
const cards = [...document.querySelectorAll('canvas[data-preview]')];
// Still pictures, so nothing runs while the page scrolls (the person's request, 2026-11-28): each card is
// drawn once, a few seconds into its animation, and plays only while a mouse rests on it. The hero is drawn
// finished. Touch screens never hover, so on phones nothing animates at all.
const STILL_AT = 3.3;
const drawCard = (cv, sec) => { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); previews[cv.dataset.preview]?.(c, cv.width, cv.height, sec); };
// newer pages keep their card preview in web/<slug>/preview.js (default export (c, w, h, sec) => void), loaded here
const loaded = CONCEPTS.filter(c => c.status === 'live' && c.previewFile).map(c => import(`./${c.slug}/preview.js`).then(m => { previews[c.slug] = m.default; }).catch(e => console.warn('preview', c.slug, e)));
cards.forEach(cv => drawCard(cv, STILL_AT));
Promise.all(loaded).then(() => cards.forEach(cv => drawCard(cv, STILL_AT)));

// the hero: the heart, finished (the circles at the end of their turn)
for (let i = 0; i <= 400; i++) { t = 2 * Math.PI * i / 400; drawHero(0); }

// a card under the mouse plays from where its still picture is, and goes back to it when the mouse leaves
let playing = null, start = 0;
function play(now) {
  if (!playing) return;
  drawCard(playing, STILL_AT + (now - start) / 1000);
  requestAnimationFrame(play);
}
if (!still && matchMedia('(hover: hover) and (pointer: fine)').matches) for (const cv of cards) {
  const box = cv.closest('a') || cv;
  box.addEventListener('mouseenter', () => { playing = cv; start = performance.now(); requestAnimationFrame(play); });
  box.addEventListener('mouseleave', () => { if (playing === cv) { playing = null; drawCard(cv, STILL_AT); } });
}
