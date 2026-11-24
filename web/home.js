// The home page: the concept cards (from concepts.js) with small live previews, and the hero,
// where spinning circles (the Rust Fourier series) draw one shape after another.
import init, { Fourier, Craft, circular_speed } from './pkg/mathtoys.js';
import { CONCEPTS, card } from './concepts.js';

document.getElementById('cards').innerHTML = CONCEPTS.filter(c => c.status === 'live').map(card).join('');
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
const cards = [...document.querySelectorAll('canvas[data-preview]')];

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!document.hidden) {
    if (!still) drawHero(dt);
    for (const cv of cards) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); previews[cv.dataset.preview]?.(c, cv.width, cv.height, still ? 1 : now / 1000); }
  }
}
if (still) { t = 2 * Math.PI; for (let i = 0; i <= 400; i++) { t = 2 * Math.PI * i / 400; drawHero(0); } }
requestAnimationFrame(frame);
