// Riemann sums: rectangles under a curve, their total, and how far it is from the exact area.
// Maths: pkg/lilavati.js (riemann.rs). The step figures build each result on screen: the rectangles
// added into a bar, the misses in red and green, the misses stacked into one column, the middle
// rectangle's top tilted onto the curve, the totals closing in, and a gauge for signed areas.
import init, { curve, exact, domain, tops, riemann, misses, spreads, signed_parts, sums_doubling } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const AMBER = '#d97706', INK = '#1c1917', INK2 = '#57534e', RED = '#dc2626', GREEN = '#16a34a', BLUE = '#2563eb';
const RULE_COL = ['#2563eb', '#ea580c', '#16a34a', '#7c3aed'];
const RULE_NAME = ['left edge', 'right edge', 'middle', 'trapezoids'];
const UNITS = [{ x: 's', y: 'm/s', area: ' m' }, null, null, null, null];
const PI = Math.PI, E = Math.E;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = t => 1 - (1 - clamp(t)) ** 3;
// numbers the way people write them: a real minus sign, about four significant digits
function fmt(v, d) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v), p = d ?? (a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : 4);
  if (a < 0.5 * 10 ** -p) return '0';   // nothing at all reads as 0, not 0.0000
  const s = v.toFixed(p);
  return s.replace('-', '−');
}
const area = v => fmt(v) + (UNITS[kind]?.area || '');

// ---------- state ----------
let kind = 0, rule = 0, n = 1, a = 0, b = 9.58, auto = !still;
const dom = () => Array.from(domain(kind));
function useKind(k, keepEnds = false) {
  kind = k; const d = dom();
  if (!keepEnds) { a = d[2]; b = d[3]; }
  yRange = rangeOf(d[0], d[1]);
}
// the heights a curve reaches over a stretch (and 0, so the axis is always in view)
function rangeOf(x0, x1) {
  let lo = 0, hi = 0;
  for (let i = 0; i <= 200; i++) { const y = curve(kind, x0 + (x1 - x0) * i / 200); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const pad = (hi - lo) * 0.08 || 1; return [lo < 0 ? lo - pad : 0, hi + pad];
}
let yRange = [0, 1];

// strips: [{ x0, x1, l, r }] where l and r are the heights of the top at the two edges
function strips(m, k = kind, x0 = a, x1 = b, rl = rule) {
  const t = Array.from(tops(k, x0, x1, m, rl)), dx = (x1 - x0) / m;
  return Array.from({ length: m }, (_, i) => ({ x0: x0 + i * dx, x1: x0 + (i + 1) * dx, l: t[2 * i], r: t[2 * i + 1] }));
}
// where in strip i the height is taken (for the dots), or null for trapezoids
const sampleAt = (s, rl = rule) => (rl === 0 ? s.x0 : rl === 1 ? s.x1 : rl === 2 ? (s.x0 + s.x1) / 2 : null);

// ---------- drawing helpers ----------
// a figure's 2D context, cleared; z makes writing bigger when the canvas is shown small (phones)
function fig(id) {
  const e = $(id), g = e.getContext('2d'), w = e.width, h = e.height;
  g.clearRect(0, 0, w, h);
  const z = clamp(0.75 * w / (e.clientWidth || w), 1, 1.9);
  return [g, w, h, z];
}
function text(g, s, x, y, col, size, z, weight = 600, align = 'left') {
  g.font = `${weight} ${Math.round(size * z)}px system-ui`; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left';
}
function tag(g, s, x, y, col, size, z, align = 'left') {
  g.font = `600 ${Math.round(size * z)}px system-ui`;
  const w = g.measureText(s).width, lx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(lx - 3, y - size * z, w + 6, size * z * 1.3);
  text(g, s, x, y, col, size, z, 600, align);
}
// a mapping from (x, y) to the canvas, for the box [L, R] × [T, B]
function frameOf(L, R, T, B, x0, x1, y0, y1) {
  return { X: x => L + (R - L) * (x - x0) / (x1 - x0), Y: y => B - (B - T) * (y - y0) / (y1 - y0), L, R, T, B };
}
function plotCurve(g, f, x0, x1, col, w, dash) {
  g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath();
  const m = 240; for (let i = 0; i <= m; i++) { const x = x0 + (x1 - x0) * i / m, px = f.X(x), py = f.Y(curve(kind, x)); i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke(); g.setLineDash([]);
}
function shape(g, f, s, fill, stroke, lw = 1) {
  g.beginPath(); g.moveTo(f.X(s.x0), f.Y(0)); g.lineTo(f.X(s.x0), f.Y(s.l)); g.lineTo(f.X(s.x1), f.Y(s.r)); g.lineTo(f.X(s.x1), f.Y(0)); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function axisLine(g, f) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(f.L, f.Y(0)); g.lineTo(f.R, f.Y(0)); g.stroke(); }
// red where the top is above the curve, green where the curve is above the top
function missFill(g, f, s, alpha = 0.55) {
  const m = 32, xs = Array.from({ length: m + 1 }, (_, j) => s.x0 + (s.x1 - s.x0) * j / m);
  const top = j => s.l + (s.r - s.l) * j / m, y = xs.map(x => curve(kind, x));
  for (const [hi, lo, col] of [[j => Math.max(top(j), y[j]), j => y[j], `rgba(220,38,38,${alpha})`], [j => y[j], j => Math.min(top(j), y[j]), `rgba(22,163,74,${alpha})`]]) {
    g.beginPath();
    xs.forEach((x, j) => (j ? g.lineTo(f.X(x), f.Y(hi(j))) : g.moveTo(f.X(x), f.Y(hi(j)))));
    for (let j = m; j >= 0; j--) g.lineTo(f.X(xs[j]), f.Y(lo(j)));
    g.closePath(); g.fillStyle = col; g.fill();
  }
}
function niceStep(span, target) { const r = span / target, p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

// ---------- the main picture ----------
const cv = $('stage'), c = cv.getContext('2d');
let F = null;   // the stage's mapping, for dragging
function drawStage() {
  const W = cv.width, H = cv.height, z = clamp(0.8 * W / (cv.clientWidth || W), 1, 2.2), d = dom();
  c.clearRect(0, 0, W, H);
  const f = F = frameOf(52 * z, W - 18, 22 * z, H - 46 * z, d[0], d[1], yRange[0], yRange[1]);
  // grid and numbers on the axes
  c.font = `${Math.round(12 * z)}px system-ui`; c.fillStyle = INK2;
  const sx = niceStep(d[1] - d[0], 8), sy = niceStep(yRange[1] - yRange[0], 5);
  for (let x = Math.ceil(d[0] / sx) * sx; x <= d[1] + 1e-9; x += sx) {
    c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 1; c.beginPath(); c.moveTo(f.X(x), f.T); c.lineTo(f.X(x), f.B); c.stroke();
    c.textAlign = 'center'; c.fillText(fmt(x, sx < 1 ? 1 : 0), f.X(x), f.B + 16 * z);
  }
  for (let y = Math.ceil(yRange[0] / sy) * sy; y <= yRange[1] + 1e-9; y += sy) {
    c.strokeStyle = 'rgba(0,0,0,.06)'; c.beginPath(); c.moveTo(f.L, f.Y(y)); c.lineTo(f.R, f.Y(y)); c.stroke();
    c.textAlign = 'right'; c.fillText(fmt(y, sy < 1 ? 1 : 0), f.L - 6, f.Y(y) + 4 * z);
  }
  c.textAlign = 'left';
  if (UNITS[kind]) { text(c, 'speed (m/s)', f.L + 6, f.T + 12 * z, INK2, 12, z, 500); text(c, 'time (s)', f.R, f.B - 6, INK2, 12, z, 500, 'right'); }
  axisLine(c, f);
  // the rectangles
  const ss = strips(n), edge = n <= 90;
  for (const s of ss) {
    const neg = s.l + s.r < 0;
    shape(c, f, s, neg ? 'rgba(220,38,38,.28)' : 'rgba(217,119,6,.32)', edge ? (neg ? 'rgba(185,28,28,.8)' : 'rgba(180,83,9,.85)') : null, 1.2);
  }
  if (!edge) { c.strokeStyle = 'rgba(180,83,9,.6)'; c.lineWidth = 1; c.beginPath(); ss.forEach((s, i) => { i ? c.lineTo(f.X(s.x0), f.Y(s.l)) : c.moveTo(f.X(s.x0), f.Y(s.l)); c.lineTo(f.X(s.x1), f.Y(s.r)); }); c.stroke(); }
  // the curve: faint outside [a, b], strong inside
  plotCurve(c, f, d[0], d[1], 'rgba(28,25,23,.3)', 1.5, [5, 5]);
  plotCurve(c, f, a, b, INK, 2.6);
  // the points where the heights are taken
  if (n <= 40 && rule < 3) for (const s of ss) { const x = sampleAt(s); c.fillStyle = INK; c.beginPath(); c.arc(f.X(x), f.Y(curve(kind, x)), 3.2 * z, 0, 7); c.fill(); }
  // the ends of the area: dashed lines and dots to drag
  for (const [v, name] of [[a, 'a'], [b, 'b']]) {
    c.strokeStyle = 'rgba(28,25,23,.45)'; c.lineWidth = 1; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(f.X(v), f.B); c.lineTo(f.X(v), f.Y(curve(kind, v))); c.stroke(); c.setLineDash([]);
    c.fillStyle = hot === name ? AMBER : '#fff'; c.strokeStyle = INK; c.lineWidth = 2.5;
    c.beginPath(); c.arc(f.X(v), f.B, 8 * z, 0, 7); c.fill(); c.stroke();
    tag(c, `${name} = ${fmt(v, 2)}`, f.X(v), f.B - 13 * z, INK, 12, z, name === 'a' ? 'left' : 'right');
  }
  // what is going on
  const sum = riemann(kind, a, b, n, rule), ex = exact(kind, a, b);
  text(c, `${n} ${rule === 3 ? 'trapezoid' : 'rectangle'}${n > 1 ? 's' : ''}, each Δx = ${fmt((b - a) / n)} wide`, f.L + 6, f.T + (UNITS[kind] ? 30 : 12) * z, AMBER, 14, z, 700);
  return [sum, ex];
}
function readout() {
  const [sum, ex] = drawStage(), err = sum - ex;
  const rel = Math.abs(ex) > 1e-9 ? Math.abs(err / ex) * 100 : NaN, pct = Number.isFinite(rel) ? ` (${rel === 0 ? '0' : rel < 0.1 ? rel.toPrecision(1) : fmt(rel, 1)}%)` : '';
  $('say').innerHTML = `Rectangles: <b>${area(sum)}</b> · exact: <b>${area(ex)}</b> · off by <b>${area(Math.abs(err))}</b>${pct}`;
  $('nVal').textContent = n;
  $('tDx').textContent = fmt((b - a) / n) + (UNITS[kind] ? ' s' : '');
  $('tSum').textContent = area(sum); $('tExact').textContent = area(ex);
  $('tErr').textContent = (err > 0 ? 'too big by ' : err < 0 ? 'too small by ' : '') + area(Math.abs(err));
  $('units').textContent = kind === 0 ? 'Here a rectangle is a speed (m/s) times a time (s): a distance in metres. The curve is a simple model of a 100 m sprint: top speed about 12 m/s, reached in a few seconds.'
    : kind === 3 ? 'The exact area of this half circle of radius 1 is π/2 = 1.5708, so twice the total is an estimate of π.'
      : kind === 4 ? 'The area under 1/x from 1 to b is the natural logarithm of b; from 1 to e = 2.718… it is exactly 1.' : '';
}

// ---------- the controls ----------
const SEQ = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
let autoT = 0, autoK = 0;
function setN(v) { n = clamp(Math.round(v), 1, 128); $('n').value = n; stepsFor(); }
function setAuto(on) { auto = on; $('auto').textContent = on ? '■ Stop' : '▶ Thinner and thinner'; if (on) { autoK = 0; autoT = 0; setN(SEQ[0]); } }
$('n').addEventListener('input', () => { setAuto(false); setN(+$('n').value); readout(); });
$('auto').addEventListener('click', () => setAuto(!auto));
$('kind').addEventListener('change', () => { const k = clamp(+$('kind').value | 0, 0, 4); if (k !== kind) useKind(k); readout(); });
$('rule').addEventListener('change', () => { rule = clamp(+$('rule').value | 0, 0, 3); readout(); });

// dragging the ends; they snap to round numbers and to π, 2π and e where those matter
let hot = null, drag = null;
function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
function near(e) {
  if (!F) return null; const [x, y] = toCanvas(e), r = Math.max(24, 20 * cv.width / (cv.clientWidth || cv.width));
  const da = Math.hypot(x - F.X(a), y - F.B), db = Math.hypot(x - F.X(b), y - F.B);
  return da < r || db < r ? (da <= db ? 'a' : 'b') : null;
}
const SNAPS = [[], [], [PI / 2, PI, 3 * PI / 2, 2 * PI], [], [E]];
function snap(v) {
  const d = dom(), span = d[1] - d[0];
  for (const s of [...SNAPS[kind], ...Array.from({ length: 13 }, (_, i) => Math.round(d[0]) + i)]) if (Math.abs(v - s) < span * 0.012) return s;
  return Math.round(v * 100) / 100;
}
cv.addEventListener('pointerdown', e => { const h = near(e); if (!h) return; drag = h; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
cv.addEventListener('pointermove', e => {
  if (!drag) { const h = near(e); if (h !== hot) { hot = h; cv.classList.toggle('grab', !!h); readout(); } return; }
  const d = dom(), [x] = toCanvas(e), gap = (d[1] - d[0]) * 0.03;
  let v = snap(clamp(d[0] + (x - F.L) / (F.R - F.L) * (d[1] - d[0]), d[0], d[1]));
  if (drag === 'a') a = Math.min(v, b - gap); else b = Math.max(v, a + gap);
  stepsFor(); readout();
});
for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, () => { drag = null; });

// ---------- step figures ----------
// the number of rectangles a figure uses: the reader's, unless there are too many to see
const few = (lo, hi) => clamp(n, lo, hi);
function figFrame(w, h, z, x0, x1, L, R, extraLo = 0, extraHi = 0) {
  let [lo, hi] = rangeOf(x0, x1); lo = Math.min(lo, extraLo); hi = Math.max(hi, extraHi);
  return frameOf(L, R, 56 * z, h - 18 * z, x0, x1, lo, hi);
}
const fewNote = m => (m !== n ? ` (${m} here; above you have ${n})` : '');

// 1: the rectangles added into a bar, one at a time
function ex1(sec) {
  const [g, w, h, z] = fig('ex1'), m = few(1, 24), ss = strips(m), dx = (b - a) / m;
  const areas = ss.map(s => dx * (s.l + s.r) / 2), cum = []; areas.reduce((t, v, i) => (cum[i] = t + v), 0);
  const ex = exact(kind, a, b), per = m > 12 ? 0.45 : 0.8, cyc = m * per + 2.2, t = still ? cyc : (sec % cyc), k = Math.min(m, Math.floor(t / per)), u = (t - k * per) / per;
  const f = figFrame(w, h, z, a, b, 36 * z, w - 150 * z, Math.min(0, ...ss.map(s => Math.min(s.l, s.r))), Math.max(...ss.map(s => Math.max(s.l, s.r))));
  axisLine(g, f);
  ss.forEach((s, i) => shape(g, f, s, i < k ? 'rgba(217,119,6,.18)' : null, i < k ? 'rgba(180,83,9,.5)' : 'rgba(0,0,0,.12)', 1));
  plotCurve(g, f, a, b, INK, 2);
  // the bar: its scale fits every running total and the exact area
  const bx = w - 105 * z, bw = 44 * z, lo = Math.min(0, ex, ...cum), hi = Math.max(0, ex, ...cum), bt = 56 * z, bb = h - 18 * z;
  const BY = v => bb - (bb - bt) * (v - lo) / (hi - lo || 1);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.strokeRect(bx, bt, bw, bb - bt);
  for (let i = 0; i < k; i++) {
    const y0 = BY(i ? cum[i - 1] : 0), y1 = BY(cum[i]);
    g.fillStyle = areas[i] < 0 ? 'rgba(220,38,38,.55)' : i % 2 ? 'rgba(217,119,6,.75)' : 'rgba(245,158,11,.75)';
    g.fillRect(bx, Math.min(y0, y1), bw, Math.abs(y1 - y0));
  }
  g.strokeStyle = INK; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(bx - 8, BY(ex)); g.lineTo(bx + bw + 8, BY(ex)); g.stroke(); g.setLineDash([]);
  text(g, 'exact', bx + bw + 4, BY(ex) - 4, INK, 11, z, 600);
  text(g, 'total', bx + bw / 2, bt - 6, INK2, 12, z, 600, 'center');
  if (k < m) {
    // the current rectangle: its width and height, then it slides into the bar as a slice of the same area
    const s = ss[k], hgt = (s.l + s.r) / 2, x = sampleAt(s) ?? (s.x0 + s.x1) / 2;
    shape(g, f, s, 'rgba(217,119,6,.55)', '#92400e', 2);
    if (rule < 3) { g.fillStyle = INK; g.beginPath(); g.arc(f.X(x), f.Y(curve(kind, x)), 4 * z, 0, 7); g.fill(); }
    const yb = f.Y(0) + 12 * z;
    g.strokeStyle = '#92400e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(f.X(s.x0), yb); g.lineTo(f.X(s.x1), yb); g.stroke();
    if (u > 0.25) {
      const p = ease((u - 0.25) / 0.6), y0 = BY(k ? cum[k - 1] : 0), y1 = BY(cum[k]);
      const sx = f.X(s.x0) + (bx - f.X(s.x0)) * p, sw = (f.X(s.x1) - f.X(s.x0)) + (bw - (f.X(s.x1) - f.X(s.x0))) * p;
      const top = f.Y(Math.max(hgt, 0)) + (Math.min(y0, y1) - f.Y(Math.max(hgt, 0))) * p, hh = Math.abs(f.Y(hgt) - f.Y(0)) + (Math.abs(y1 - y0) - Math.abs(f.Y(hgt) - f.Y(0))) * p;
      g.fillStyle = 'rgba(146,64,14,.45)'; g.fillRect(sx, top, sw, hh);
    }
    tag(g, `rectangle ${k + 1} of ${m}:  width ${fmt(dx)} × height ${fmt(hgt)} = ${fmt(areas[k])}`, 14 * z, 22 * z, '#92400e', 14, z);
    tag(g, `total so far: ${fmt(k ? cum[k - 1] : 0)} + ${fmt(areas[k])} = ${fmt(cum[k])}`, 14 * z, 42 * z, INK, 14, z);
  } else {
    tag(g, `all ${m}: total ${area(cum[m - 1])}; exact area ${area(ex)}`, 14 * z, 22 * z, INK, 14, z);
    tag(g, `off by ${area(Math.abs(cum[m - 1] - ex))}`, 14 * z, 42 * z, INK2, 14, z);
  }
  $('cap1').textContent = `Heights from the ${RULE_NAME[rule]}${fewNote(m)}. Each rectangle's area, width × height, becomes a slice of the bar.`;
}

// 2: what each rectangle gets wrong, in red (too much) and green (too little)
function ex2() {
  const [g, w, h, z] = fig('ex2'), m = few(1, 32), ss = strips(m);
  const f = figFrame(w, h, z, a, b, 36 * z, w - 170 * z, Math.min(0, ...ss.map(s => Math.min(s.l, s.r))), Math.max(...ss.map(s => Math.max(s.l, s.r))));
  axisLine(g, f);
  ss.forEach(s => { shape(g, f, s, 'rgba(217,119,6,.10)', 'rgba(180,83,9,.6)', 1); missFill(g, f, s); });
  plotCurve(g, f, a, b, INK, 2);
  const [over, under] = Array.from(misses(kind, a, b, m, rule)), sum = riemann(kind, a, b, m, rule), ex = exact(kind, a, b);
  const bx = w - 140 * z, bw = 40 * z, bb = h - 30 * z, top = 70 * z, sc = (bb - top) / Math.max(over, under, 1e-9);
  g.fillStyle = 'rgba(220,38,38,.7)'; g.fillRect(bx, bb - over * sc, bw, over * sc);
  g.fillStyle = 'rgba(22,163,74,.7)'; g.fillRect(bx + bw + 16 * z, bb - under * sc, bw, under * sc);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.moveTo(bx - 6, bb); g.lineTo(bx + 2 * bw + 22 * z, bb); g.stroke();
  text(g, fmt(over), bx + bw / 2, bb - over * sc - 6, RED, 12, z, 700, 'center');
  text(g, fmt(under), bx + 1.5 * bw + 16 * z, bb - under * sc - 6, GREEN, 12, z, 700, 'center');
  text(g, 'too much', bx + bw / 2, bb + 15 * z, RED, 11, z, 600, 'center');
  text(g, 'too little', bx + 1.5 * bw + 16 * z, bb + 15 * z, GREEN, 11, z, 600, 'center');
  tag(g, `sum − exact = too much − too little`, 14 * z, 22 * z, INK, 14, z);
  tag(g, `${fmt(sum)} − ${fmt(ex)} = ${fmt(over)} − ${fmt(under)} = ${fmt(sum - ex)}`, 14 * z, 42 * z, INK, 14, z);
  $('cap2').textContent = `Heights from the ${RULE_NAME[rule]}${fewNote(m)}. Red: counted but not under the curve. Green: under the curve but left out.`;
}

// 3: each strip's miss fits in a box; the boxes stack into one column Δx wide
function ex3(sec) {
  const [g, w, h, z] = fig('ex3'), m = few(2, 32), ss = strips(m), dx = (b - a) / m;
  const sp = Array.from(spreads(kind, a, b, m)), sp2 = Array.from(spreads(kind, a, b, 2 * m)), S = sp.reduce((s, v) => s + v, 0), S2 = sp2.reduce((s, v) => s + v, 0);
  // the graph leaves room on the right for the column (one strip wide) and the column for twice as many
  const L = 36 * z, gw = (w - L - 16 * z - 30 * z) / (1 + 1.5 / m);
  const f = figFrame(w, h, z, a, b, L, L + gw, Math.min(0, ...ss.map(s => Math.min(s.l, s.r))), Math.max(...ss.map(s => Math.max(s.l, s.r))));
  axisLine(g, f);
  // each strip's lowest point (found by looking along it), so its box sits around the curve there
  const los = ss.map(s => { let lo = Infinity; for (let j = 0; j <= 32; j++) lo = Math.min(lo, curve(kind, s.x0 + (s.x1 - s.x0) * j / 32)); return lo; });
  ss.forEach(s => { shape(g, f, s, null, 'rgba(180,83,9,.35)', 1); missFill(g, f, s, 0.45); });
  plotCurve(g, f, a, b, INK, 2);
  // the column, to the right, with its own scale if it would not fit
  const unit = Math.abs(f.Y(0) - f.Y(1));   // pixels for one unit of height
  const room = f.B - f.T, fit = Math.min(1, room / (S * unit || 1)), cw = f.X(a + dx) - f.X(a), cx = f.R + 14 * z;
  const cyc = 7, u = still ? 1 : (sec % cyc) / cyc;
  let stack = 0;
  ss.forEach((s, i) => {
    const hpx = sp[i] * unit, p = ease((u - 0.12 - i * 0.4 / m) / 0.35);
    const x0 = f.X(s.x0), y0 = f.Y(los[i] + sp[i]), tx = cx, ty = f.B - (stack + hpx) * fit;
    const x = x0 + (tx - x0) * p, y = y0 + (ty - y0) * p, hh = hpx * (1 + (fit - 1) * p), ww = cw;
    g.fillStyle = i % 2 ? 'rgba(124,58,237,.22)' : 'rgba(124,58,237,.34)'; g.fillRect(x, y, ww, hh);
    g.strokeStyle = 'rgba(91,33,182,.8)'; g.lineWidth = 1; g.strokeRect(x, y, ww, hh);
    stack += hpx;
  });
  // the column for twice as many strips: half as wide, no taller
  const cw2 = cw / 2, h2 = S2 * unit * fit;
  if (u > 0.62) {
    g.setLineDash([4, 3]); g.strokeStyle = '#5b21b6'; g.lineWidth = 1.5; g.strokeRect(cx + cw + 18 * z, f.B - h2, cw2, h2); g.setLineDash([]);
    text(g, `${m} strips`, cx + cw / 2, f.B + 14 * z, '#5b21b6', 11, z, 600, 'center');
    text(g, `${2 * m}`, cx + cw + 18 * z + cw2 / 2, f.B + 14 * z, '#5b21b6', 11, z, 600, 'center');
  }
  const err = Math.abs(riemann(kind, a, b, m, rule) - exact(kind, a, b)), err2 = Math.abs(riemann(kind, a, b, 2 * m, rule) - exact(kind, a, b));
  tag(g, `column: ${fmt(dx)} wide × ${fmt(S)} tall = ${fmt(dx * S)}  ≥  miss ${fmt(err)}`, 14 * z, 22 * z, '#5b21b6', 14, z);
  tag(g, `${2 * m} strips: ${fmt(dx / 2)} × ${fmt(S2)} = ${fmt(dx / 2 * S2)}  ≥  miss ${fmt(err2)}`, 14 * z, 42 * z, INK2, 13, z);
  $('cap3').textContent = `Heights from the ${RULE_NAME[rule]}${fewNote(m)}. Each purple box is one strip wide and as tall as the curve rises or falls in it${fit < 1 ? '; the column is drawn smaller to fit' : ''}.`;
}

// 4: one strip, magnified: the middle rectangle's top turned onto the curve keeps its area
function ex4(sec) {
  const [g, w, h, z] = fig('ex4'), k = clamp(+$('stripK').value | 0, 1, n) - 1, dx = (b - a) / n, x0 = a + k * dx, x1 = x0 + dx, xm = (x0 + x1) / 2;
  $('stripVal').textContent = `${k + 1} of ${n}`;
  const fm = curve(kind, xm), e = dx * 1e-3, slope = (curve(kind, xm + e) - curve(kind, xm - e)) / (2 * e);
  const vx0 = x0 - dx * 0.18, vx1 = x1 + dx * 0.18;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 60; i++) { const y = curve(kind, vx0 + (vx1 - vx0) * i / 60); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  lo = Math.min(lo, fm - Math.abs(slope) * dx * 0.6); hi = Math.max(hi, fm + Math.abs(slope) * dx * 0.6);
  const pad = (hi - lo) * 0.35 || Math.abs(fm) * 0.1 || 0.1;
  const f = frameOf(30 * z, w - 30 * z, 70 * z, h - 22 * z, vx0, vx1, lo - pad, hi + pad);
  const cyc = 6, u = still ? 1 : (sec % cyc) / cyc, p = ease((u - 0.15) / 0.4);
  const topY = x => fm + p * slope * (x - xm), base = Math.max(f.Y(0) < f.B ? f.Y(0) : f.B, f.T);
  // the rectangle, its top turning about the middle point
  g.beginPath(); g.moveTo(f.X(x0), base); g.lineTo(f.X(x0), f.Y(topY(x0))); g.lineTo(f.X(x1), f.Y(topY(x1))); g.lineTo(f.X(x1), base); g.closePath();
  g.fillStyle = 'rgba(22,163,74,.16)'; g.fill(); g.strokeStyle = 'rgba(21,128,61,.8)'; g.lineWidth = 1.5; g.stroke();
  if (base === f.B && f.Y(0) > f.B) text(g, '↓ the rectangle goes on down to the line', f.X(x0) + 6, f.B - 6, INK2, 11, z, 500);
  // the two triangles between the flat top and the turned top: one taken off, one put on, the same size
  if (p > 0.02) {
    for (const [xe, col] of [[x0, slope > 0 ? 'rgba(220,38,38,.45)' : 'rgba(37,99,235,.45)'], [x1, slope > 0 ? 'rgba(37,99,235,.45)' : 'rgba(220,38,38,.45)']]) {
      g.beginPath(); g.moveTo(f.X(xm), f.Y(fm)); g.lineTo(f.X(xe), f.Y(fm)); g.lineTo(f.X(xe), f.Y(topY(xe))); g.closePath(); g.fillStyle = col; g.fill();
    }
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(21,128,61,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(f.X(x0), f.Y(fm)); g.lineTo(f.X(x1), f.Y(fm)); g.stroke(); g.setLineDash([]);
    const tri = Math.abs(slope) * (dx / 2) ** 2 / 2;
    tag(g, `each triangle ${fmt(tri)}: one cut off, one added`, w / 2, 62 * z, INK2, 12, z, 'center');
  }
  // the curved gap that is left once the top touches the curve
  if (p > 0.95) {
    const m = 40; g.fillStyle = 'rgba(124,58,237,.45)';
    for (let j = 0; j < m; j++) { const xa = x0 + dx * j / m, xb = x0 + dx * (j + 1) / m, xc = (xa + xb) / 2, y = curve(kind, xc), t = topY(xc); g.fillRect(f.X(xa), f.Y(Math.max(y, t)), f.X(xb) - f.X(xa) + 0.6, Math.abs(f.Y(y) - f.Y(t))); }
  }
  plotCurve(g, f, vx0, vx1, INK, 2.4);
  g.fillStyle = INK; g.beginPath(); g.arc(f.X(xm), f.Y(fm), 4.5 * z, 0, 7); g.fill();
  const miss = dx * fm - exact(kind, x0, x1);
  const e1 = Math.abs(riemann(kind, a, b, n, 2) - exact(kind, a, b)), e2 = Math.abs(riemann(kind, a, b, 2 * n, 2) - exact(kind, a, b));
  tag(g, `this strip: ${fmt(dx)} × ${fmt(fm)} = ${fmt(dx * fm)}, misses by ${fmt(Math.abs(miss))} (purple)`, 14 * z, 22 * z, INK, 13, z);
  tag(g, `all middle rectangles: ${n} miss by ${fmt(e1)}, ${2 * n} by ${fmt(e2)}${e2 > 1e-12 ? `: ${fmt(e1 / e2, 2)} times less` : ''}`, 14 * z, 42 * z, INK2, 13, z);
  $('cap4').textContent = `Strip ${k + 1} of the ${n} above, magnified. The middle rectangle's top turns about its centre (the dot) until it touches the curve; the red and blue triangles are the same size.`;
}

// 5: the totals for 1, 2, 4 … 1024 rectangles, every rule, closing in on the exact area
function ex5(sec) {
  const [g, w, h, z] = fig('ex5'), K = 11, ex = exact(kind, a, b);
  const lines = [0, 1, 2, 3].map(r => Array.from(sums_doubling(kind, a, b, r, K)));
  const all = lines.flat().concat(ex), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.08 || 1;
  const f = frameOf(46 * z, w - 20 * z, 64 * z, h - 34 * z, 0, K - 1, lo - pad, hi + pad);
  g.strokeStyle = INK; g.setLineDash([6, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(f.L, f.Y(ex)); g.lineTo(f.R, f.Y(ex)); g.stroke(); g.setLineDash([]);
  tag(g, `exact ${area(ex)}`, f.R, f.Y(ex) - 6, INK, 12, z, 'right');
  for (let k = 0; k < K; k += 2) text(g, String(2 ** k), f.X(k), h - 16 * z, INK2, 11, z, 500, 'center');
  text(g, 'rectangles →', f.R, h - 4 * z, INK2, 11, z, 500, 'right');
  // your number of rectangles
  const xn = f.X(Math.log2(n)); g.strokeStyle = 'rgba(217,119,6,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(xn, f.T); g.lineTo(xn, f.B); g.stroke();
  text(g, `you: ${n}`, xn + 4, f.T + 10 * z, AMBER, 11, z, 700);
  const shown = still ? K : 1 + Math.floor((sec * 2.2) % (K + 5));
  lines.forEach((ls, r) => {
    g.strokeStyle = RULE_COL[r]; g.fillStyle = RULE_COL[r]; g.lineWidth = r === rule ? 3 : 1.6; g.beginPath();
    ls.slice(0, shown).forEach((v, k) => (k ? g.lineTo(f.X(k), f.Y(v)) : g.moveTo(f.X(k), f.Y(v)))); g.stroke();
    ls.slice(0, shown).forEach((v, k) => { g.beginPath(); g.arc(f.X(k), f.Y(v), (r === rule ? 3.5 : 2.5) * z, 0, 7); g.fill(); });
  });
  // the key, with how much each doubling divides the miss by (from 256 to 512 rectangles)
  lines.forEach((ls, r) => {
    const e1 = Math.abs(ls[8] - ex), e2 = Math.abs(ls[9] - ex), ratio = e2 > 1e-13 ? `÷${fmt(e1 / e2, 1)}` : 'exact';
    text(g, `${RULE_NAME[r]} ${ratio}`, 14 * z + (r % 2) * 210 * z, (20 + Math.floor(r / 2) * 19) * z, RULE_COL[r], 13, z, r === rule ? 800 : 600);
  });
  $('cap5').textContent = `Totals for 1 to 1024 rectangles. The numbers in the key say how much one doubling divides the miss by (256 → 512 rectangles). Your choice, the ${RULE_NAME[rule]}, is the thick line.`;
}

// 6: signed areas: a gauge that climbs with rectangles above the line and drops with those below
function ex6(sec) {
  const [g, w, h, z] = fig('ex6'), m = few(4, 32);
  let k6 = kind, x0 = a, x1 = b;
  const mine = strips(m), dips = mine.some(s => s.l + s.r < 0);
  if (!dips) { k6 = 2; x0 = 0; x1 = 2 * PI; }
  const ss = dips ? mine : strips(m, 2, 0, 2 * PI), dx = (x1 - x0) / m, areas = ss.map(s => dx * (s.l + s.r) / 2);
  const cum = []; areas.reduce((t, v, i) => (cum[i] = t + v), 0);
  const saveKind = kind; kind = k6;   // the drawing helpers read the curve from kind
  let [lo, hi] = rangeOf(x0, x1); lo = Math.min(lo, ...ss.map(s => Math.min(s.l, s.r))); hi = Math.max(hi, ...ss.map(s => Math.max(s.l, s.r)));
  const f = frameOf(30 * z, w - 185 * z, 62 * z, h - 18 * z, x0, x1, lo, hi);
  const per = m > 16 ? 0.35 : 0.6, cyc = m * per + 2, t = still ? cyc : sec % cyc, k = Math.min(m, Math.floor(t / per));
  axisLine(g, f);
  ss.forEach((s, i) => { const neg = areas[i] < 0; shape(g, f, s, i < k ? (neg ? 'rgba(220,38,38,.45)' : 'rgba(37,99,235,.35)') : 'rgba(0,0,0,.04)', i === k ? INK : 'rgba(0,0,0,.2)', i === k ? 2 : 1); });
  plotCurve(g, f, x0, x1, INK, 2);
  kind = saveKind;
  // the gauge: running total
  const [up, down] = Array.from(signed_parts(k6, x0, x1, m, rule));
  const gx = w - 72 * z, gl = Math.min(0, ...cum), gh = Math.max(0, ...cum, 1e-9), gt = 62 * z, gb = h - 18 * z, GY = v => gb - (gb - gt) * (v - gl) / (gh - gl || 1);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(gx, gt); g.lineTo(gx, gb); g.stroke();
  g.beginPath(); g.moveTo(gx - 12, GY(0)); g.lineTo(gx + 12, GY(0)); g.stroke(); text(g, '0', gx - 16, GY(0) + 4, INK2, 11, z, 500, 'right');
  // the running total so far, as a small trace beside the gauge, one step per rectangle
  g.strokeStyle = 'rgba(28,25,23,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(gx - 98 * z, GY(0));
  for (let i = 0; i < k; i++) { const x0 = gx - 98 * z + 88 * z * i / m, x1 = gx - 98 * z + 88 * z * (i + 1) / m; g.lineTo(x0, GY(cum[i])); g.lineTo(x1, GY(cum[i])); }
  g.stroke();
  const now = k ? cum[k - 1] : 0;
  g.fillStyle = now < 0 ? RED : BLUE; g.beginPath(); g.moveTo(gx + 4, GY(now)); g.lineTo(gx + 16, GY(now) - 7); g.lineTo(gx + 16, GY(now) + 7); g.fill();
  text(g, fmt(now), gx + 20, GY(now) + 4, now < 0 ? RED : BLUE, 12, z, 700);
  if (k < m) tag(g, `rectangle ${k + 1}: height ${fmt((ss[k].l + ss[k].r) / 2)} × width ${fmt(dx)} = ${fmt(areas[k])}`, 14 * z, 22 * z, areas[k] < 0 ? RED : BLUE, 14, z);
  else tag(g, `above ${fmt(up)} − below ${fmt(down)} = ${fmt(up - down)}`, 14 * z, 22 * z, INK, 14, z);
  tag(g, `total so far ${fmt(now)}`, 14 * z, 42 * z, INK2, 13, z);
  $('cap6').textContent = dips ? `Your curve from a = ${fmt(a, 2)} to b = ${fmt(b, 2)}${fewNote(m)}: blue rectangles add, red ones take away.`
    : `Your curve stays above the line here, so this is the wave y = sin x from 0 to 2π, with ${m} rectangles: blue rectangles add, red ones take away.`;
  $('useWave').hidden = dips;
}
$('useWave').addEventListener('click', () => {
  $('kind').value = '2'; useKind(2); a = 0; b = 2 * PI; $('rule').value = '2'; rule = 2; setAuto(false); setN(16); readout();
});
$('stripK').addEventListener('input', () => ex4(performance.now() / 1000));
// the strip picker covers the reader's strips, and starts on one a third of the way along
let stripN = 0;
function stepsFor() {
  if (stripN === n) return;
  stripN = n; $('stripK').max = n; $('stripK').value = Math.max(1, Math.ceil(n / 3));
}

// ---------- the animation ----------
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
  if (auto) {
    autoT += dt;
    const hold = autoK === SEQ.length - 1 ? 2.6 : 0.9;
    if (autoT > hold) { autoT = 0; autoK = (autoK + 1) % SEQ.length; setN(SEQ[autoK]); }
  }
  readout();
  const sec = now / 1000;
  ex1(sec); ex2(); ex3(sec); ex4(sec); ex5(sec); ex6(sec);
}

// ---------- Try this ----------
function setup(k, rl, nn, ends, play = false) {
  $('kind').value = String(k); useKind(k);
  if (ends) [a, b] = ends;
  $('rule').value = String(rl); rule = rl;
  setAuto(play); if (!play) setN(nn);
  readout();
}
const TRY = [
  () => setup(0, 0, 1, null, true),
  () => setup(0, 1, 4, null),
  () => setup(1, 2, 4, [0, 1]),
  () => setup(2, 2, 16, [0, 2 * PI]),
  () => setup(3, 2, 128, [-1, 1]),
];
for (const btn of document.querySelectorAll('[data-try]')) btn.addEventListener('click', () => { TRY[+btn.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });

useKind(0); setAuto(auto); if (!auto) setN(8);
readout();
requestAnimationFrame(frame);

// Together (together/share.js): the curve, rule and number of rectangles are controls; the ends of the
// area and whether the rectangles are thinning by themselves live here
share(() => ({ k: kind, ends: [a, b], auto, n }), s => {
  const e = nums(s?.ends, 2), k = s?.k;
  if (!e || e.length !== 2 || !Number.isInteger(k) || k < 0 || k > 4) return;
  if (k !== kind) { $('kind').value = String(k); useKind(k); }
  const d = dom(); if (!(e[0] >= d[0] - 1e-9 && e[1] <= d[1] + 1e-9 && e[0] < e[1])) return;
  [a, b] = e;
  if (typeof s.auto === 'boolean' && s.auto !== auto) setAuto(s.auto);
  if (!auto && Number.isInteger(s.n)) setN(s.n);
  readout();
});
