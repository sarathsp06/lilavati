// Taylor series: a curve and its Taylor polynomial around a point a, the terms at a chosen x, and where the
// polynomial stays within 0.01. Maths: pkg/lilavati.js (taylor.rs). The step figures build each result on
// screen: the flat line turning into the tangent with its slope triangle, the miss after each term, the
// powers coming down as factorials, the terms added up into a bar chart, the terms shrinking or growing
// either side of the radius, and the error against the first term left out.
import init, { tcurve, coefficients, terms, taylor, radius, good_range } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const PINK = '#db2777', INK = '#1c1917', INK2 = '#57534e', BLUE = '#2563eb', GREEN = '#16a34a', RED = '#dc2626', AMBER = '#d97706';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = t => 1 - (1 - clamp(t)) ** 3;
function fmt(v, d) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (d === undefined) {
    if (a !== 0 && (a < 1e-4 || a >= 1e6)) {
      // powers of ten the way people write them: 5.36 × 10⁻⁸
      const [m, e] = a.toExponential(2).split('e');
      return (v < 0 ? '−' : '') + m + ' × 10' + (+e < 0 ? '⁻' : '') + String(Math.abs(+e)).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
    }
    d = a >= 100 ? 1 : a >= 10 ? 3 : a >= 0.01 ? 4 : 6;
  }
  if (a < 0.5 * 10 ** -d) return '0';
  return v.toFixed(d).replace('-', '−');
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = k => String(k).split('').map(c => SUP[+c]).join('');
const FACT = [1]; for (let k = 1; k <= 40; k++) FACT[k] = FACT[k - 1] * k;

// ---------- the curves ----------
// x range, y range, the starting a and x, where a may go, the name
const CURVES = [
  { name: 'sin x', d: [-7, 7], y: [-2.2, 2.2], a: 0, x: 0.6457718, aLim: [-6.5, 6.5] },
  { name: 'cos x', d: [-7, 7], y: [-2.2, 2.2], a: 0, x: 1, aLim: [-6.5, 6.5] },
  { name: 'eˣ', d: [-4, 3], y: [-2, 10], a: 0, x: 1, aLim: [-3.5, 2.2] },
  { name: 'ln(1 + x)', d: [-1.5, 3.5], y: [-3.5, 2.5], a: 0, x: 0.5, aLim: [-0.8, 3] },
  { name: '1 ÷ (1 − x)', d: [-3, 3], y: [-4, 6], a: 0, x: 0.5, aLim: [-2.8, 0.8] },
  { name: 'arctan x', d: [-5, 5], y: [-2.2, 2.2], a: 0, x: 0.8, aLim: [-4.5, 4.5] },
];
let kind = 0, a = 0, x = 0.6458, n = 1, auto = !still;
const C = () => CURVES[kind];
function useKind(k, keep = false) { kind = k; if (!keep) { a = C().a; x = C().x; } }

// ---------- drawing helpers ----------
function fig(id) {
  const e = $(id), g = e.getContext('2d'), w = e.width, h = e.height;
  g.clearRect(0, 0, w, h);
  const z = clamp(0.75 * w / (e.clientWidth || w), 1, 1.9);
  return [g, w, h, z];
}
function text(g, s, x0, y0, col, size, z, weight = 600, align = 'left') {
  g.font = `${weight} ${Math.round(size * z)}px system-ui`; g.fillStyle = col; g.textAlign = align; g.fillText(s, x0, y0); g.textAlign = 'left';
}
function tag(g, s, x0, y0, col, size, z, align = 'left') {
  g.font = `600 ${Math.round(size * z)}px system-ui`;
  const w = g.measureText(s).width, lx = align === 'right' ? x0 - w : align === 'center' ? x0 - w / 2 : x0;
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(lx - 3, y0 - size * z, w + 6, size * z * 1.32);
  text(g, s, x0, y0, col, size, z, 600, align);
}
function frameOf(L, R, T, B, x0, x1, y0, y1) {
  return { X: v => L + (R - L) * (v - x0) / (x1 - x0), Y: v => B - (B - T) * (v - y0) / (y1 - y0), x0, x1, y0, y1, L, R, T, B,
    inv: px => x0 + (px - L) / (R - L) * (x1 - x0) };
}
// a curve y = f(x) over the frame, broken where it leaves the picture or is not defined
function plot(g, f, fn, col, lw, dash, from = f.x0, to = f.x1) {
  g.save(); g.beginPath(); g.rect(f.L, f.T, f.R - f.L, f.B - f.T); g.clip();
  g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath();
  const m = 400, span = f.y1 - f.y0; let pen = false;
  for (let i = 0; i <= m; i++) {
    const xv = from + (to - from) * i / m, yv = fn(xv);
    if (!Number.isFinite(yv) || yv > f.y1 + 3 * span || yv < f.y0 - 3 * span) { pen = false; continue; }
    pen ? g.lineTo(f.X(xv), f.Y(yv)) : g.moveTo(f.X(xv), f.Y(yv)); pen = true;
  }
  g.stroke(); g.setLineDash([]); g.restore();
}
function axes(g, f, z, labels = true) {
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; g.font = `${Math.round(11 * z)}px system-ui`; g.fillStyle = INK2;
  const sx = niceStep(f.x1 - f.x0, 8), sy = niceStep(f.y1 - f.y0, 6);
  for (let v = Math.ceil(f.x0 / sx) * sx; v <= f.x1 + 1e-9; v += sx) { g.beginPath(); g.moveTo(f.X(v), f.T); g.lineTo(f.X(v), f.B); g.stroke(); if (labels) { g.textAlign = 'center'; g.fillText(fmt(v, sx < 1 ? 1 : 0), f.X(v), f.B + 14 * z); } }
  for (let v = Math.ceil(f.y0 / sy) * sy; v <= f.y1 + 1e-9; v += sy) { g.beginPath(); g.moveTo(f.L, f.Y(v)); g.lineTo(f.R, f.Y(v)); g.stroke(); if (labels) { g.textAlign = 'right'; g.fillText(fmt(v, sy < 1 ? 1 : 0), f.L - 5, f.Y(v) + 4); } }
  g.textAlign = 'left';
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.beginPath();
  if (f.y0 < 0 && f.y1 > 0) { g.moveTo(f.L, f.Y(0)); g.lineTo(f.R, f.Y(0)); }
  if (f.x0 < 0 && f.x1 > 0) { g.moveTo(f.X(0), f.T); g.lineTo(f.X(0), f.B); }
  g.stroke();
}
function niceStep(span, target) { const r = span / target, p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function dot(g, px, py, r, fill, stroke) { g.fillStyle = fill; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); } }
const curve = v => tcurve(kind, v);
// the polynomial written out with its numbers, the first few terms that are not 0
function written(k0 = kind, a0 = a, n0 = n, most = 4) {
  const c = Array.from(coefficients(k0, a0, n0)), h = a0 === 0 ? 'x' : `(x ${a0 < 0 ? '+' : '−'} ${fmt(Math.abs(a0), 2)})`;
  const parts = []; let left = 0;
  c.forEach((v, k) => {
    if (Math.abs(v) < 1e-12) return;
    if (parts.length >= most) { left++; return; }
    const num = k === 0 ? fmt(Math.abs(v), 3) : Math.abs(Math.abs(v) - 1) < 1e-12 ? '' : fmt(Math.abs(v), Math.abs(v) < 0.01 ? 6 : 4);
    const pw = k === 0 ? '' : k === 1 ? h : h + sup(k);
    parts.push([v < 0 ? '−' : '+', num + (num && pw ? '·' : '') + pw]);
  });
  if (!parts.length) return '0';
  let s = (parts[0][0] === '−' ? '−' : '') + parts[0][1];
  for (const [sg, t] of parts.slice(1)) s += ` ${sg} ${t}`;
  return left ? s + ` ${left === 1 ? '+ 1 more term' : `+ ${left} more terms`}` : s;
}

// ---------- the main picture ----------
const cv = $('stage'), c = cv.getContext('2d');
let F = null, hot = null, drag = null;
function drawStage() {
  const W = cv.width, H = cv.height, z = clamp(0.8 * W / (cv.clientWidth || W), 1, 2.2), cu = C();
  c.clearRect(0, 0, W, H);
  const f = F = frameOf(46 * z, W - 16, 52 * z, H - 40 * z, cu.d[0], cu.d[1], cu.y[0], cu.y[1]);
  // where the series works at all (radius), and where this polynomial is within 0.01 (green)
  const R = radius(kind, a);
  if (Number.isFinite(R)) {
    c.fillStyle = 'rgba(220,38,38,.06)';
    if (a - R > f.x0) c.fillRect(f.L, f.T, f.X(a - R) - f.L, f.B - f.T);
    if (a + R < f.x1) c.fillRect(f.X(a + R), f.T, f.R - f.X(a + R), f.B - f.T);
    c.strokeStyle = 'rgba(220,38,38,.6)'; c.setLineDash([6, 5]); c.lineWidth = 1.5; c.beginPath();
    for (const e of [a - R, a + R]) if (e > f.x0 && e < f.x1) { c.moveTo(f.X(e), f.T); c.lineTo(f.X(e), f.B); }
    c.stroke(); c.setLineDash([]);
  }
  const [glo, ghi] = Array.from(good_range(kind, a, n, 0.01, cu.d[0], cu.d[1]));
  c.fillStyle = 'rgba(22,163,74,.13)'; c.fillRect(f.X(glo), f.T, f.X(ghi) - f.X(glo), f.B - f.T);
  axes(c, f, z);
  plot(c, f, curve, INK, 2.8);
  plot(c, f, v => taylor(kind, a, n, v), PINK, 3, null);
  // x: the line up from the bottom, the curve's height and the polynomial's there
  const fx = curve(x), px = taylor(kind, a, n, x);
  c.strokeStyle = 'rgba(28,25,23,.45)'; c.setLineDash([4, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(f.X(x), f.B); c.lineTo(f.X(x), f.T); c.stroke(); c.setLineDash([]);
  if (Number.isFinite(fx) && fx > f.y0 && fx < f.y1) dot(c, f.X(x), f.Y(fx), 5 * z, INK);
  if (px > f.y0 && px < f.y1) dot(c, f.X(x), f.Y(px), 5 * z, PINK);
  dot(c, f.X(x), f.B, 8 * z, hot === 'x' ? '#fde68a' : '#fff', INK);
  tag(c, `x = ${fmt(x, 3)}`, f.X(x) + (f.X(x) > f.R - 90 * z ? -12 : 12), f.B - 12 * z, INK, 12, z, f.X(x) > f.R - 90 * z ? 'right' : 'left');
  // a: the point on the curve the series is built around
  const fa = curve(a);
  dot(c, f.X(a), f.Y(fa), 9 * z, hot === 'a' ? '#f9a8d4' : PINK, '#fff');
  tag(c, `a = ${fmt(a, 2)}`, f.X(a) + 12 * z, f.Y(fa) - 12 * z, PINK, 13, z);
  // what is drawn
  tag(c, `${cu.name} ≈ ${written()}`, f.L + 6, 22 * z, PINK, 14, z);
  if (Number.isFinite(R)) tag(c, `the series works only within ${fmt(R, 2)} of a (red lines)`, f.L + 6, 42 * z, RED, 12, z);
  else tag(c, `green: within 0.01 of the curve, from ${fmt(glo, 2)} to ${fmt(ghi, 2)}`, f.L + 6, 42 * z, GREEN, 12, z);
}
function readout() {
  drawStage();
  const t = Array.from(terms(kind, a, n, x)), fx = curve(x), sum = t.reduce((s, v) => s + v, 0);
  $('nVal').textContent = n;
  $('atX').textContent = `The terms at x = ${fmt(x, 4)}`;
  const rows = []; let shown = 0, hidden = 0, run = 0;
  t.forEach((v, k) => {
    run += v;
    if (Math.abs(v) < 1e-15 && Math.abs(coefficients(kind, a, k)[k]) < 1e-12) return;   // terms that are 0 everywhere
    if (shown >= 8) { hidden++; return; }
    shown++;
    rows.push(`<tr><td>${k === 0 ? 'f(a)' : `power ${k}`}</td><td>${v >= 0 && rows.length ? '+' : ''}${fmt(v)}</td><td>${fmt(run, 7)}</td></tr>`);
  });
  if (hidden) rows.push(`<tr><td colspan="2">… ${hidden} more term${hidden > 1 ? 's' : ''}</td><td>${fmt(sum, 7)}</td></tr>`);
  rows.push(`<tr class="sum"><td>Sum</td><td></td><td>${fmt(sum, 7)}</td></tr>`);
  rows.push(`<tr><td>${C().name}</td><td></td><td>${fmt(fx, 7)}</td></tr>`);
  rows.push(`<tr><td>Off by</td><td></td><td>${fmt(Math.abs(sum - fx))}</td></tr>`);
  $('tbody').innerHTML = '<tr class="head"><td></td><td>term</td><td>total</td></tr>' + rows.join('');
  const R = radius(kind, a);
  $('note').textContent = Number.isFinite(R)
    ? `This series only works closer to a than ${fmt(R, 3)}: the distance from a to ${kind === 3 ? 'x = −1, where ln(1 + x) breaks down' : kind === 4 ? 'x = 1, where 1 ÷ (1 − x) breaks down' : 'the imaginary numbers ±i, where arctan breaks down'}. Your x is ${fmt(Math.abs(x - a), 3)} away${Math.abs(x - a) < R ? ', inside it' : ', outside it: more terms make it worse'}.`
    : `The series of ${C().name} works for every x; far from a it just needs more terms.`;
  $('say').innerHTML = `${n + 1} term${n ? 's' : ''} (powers 0 to ${n}) · at x = ${fmt(x, 3)}: polynomial <b>${fmt(sum, 6)}</b>, curve <b>${fmt(fx, 6)}</b>, off by <b>${fmt(Math.abs(sum - fx))}</b>`;
}

// ---------- the controls ----------
const SEQ = Array.from({ length: 16 }, (_, i) => i);
let autoT = 0, autoK = 0;
function setN(v) { n = clamp(Math.round(v), 0, 24); $('n').value = n; }
function setAuto(on) { auto = on; $('auto').textContent = on ? '■ Stop' : '▶ Add terms one by one'; if (on) { autoK = 0; autoT = 0; setN(SEQ[0]); } }
$('n').addEventListener('input', () => { setAuto(false); setN(+$('n').value); readout(); });
$('auto').addEventListener('click', () => setAuto(!auto));
$('kind').addEventListener('change', () => { const k = clamp(+$('kind').value | 0, 0, 5); if (k !== kind) useKind(k); readout(); });

function toCanvas(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
function near(e) {
  if (!F) return null; const [px, py] = toCanvas(e), r = Math.max(26, 22 * cv.width / (cv.clientWidth || cv.width));
  const da = Math.hypot(px - F.X(a), py - F.Y(curve(a))), dx = Math.hypot(px - F.X(x), py - F.B);
  return da < r && da <= dx ? 'a' : dx < r ? 'x' : null;
}
const snapTo = v => (Math.abs(v - Math.round(v * 4) / 4) < 0.04 ? Math.round(v * 4) / 4 : Math.round(v * 100) / 100);
cv.addEventListener('pointerdown', e => { const h = near(e); if (!h) return; drag = h; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
cv.addEventListener('pointermove', e => {
  if (!drag) { const h = near(e); if (h !== hot) { hot = h; cv.classList.toggle('grab', !!h); readout(); } return; }
  const [px] = toCanvas(e), v = snapTo(F.inv(px));
  if (drag === 'a') a = clamp(v, ...C().aLim); else x = clamp(v, C().d[0] + 0.01, C().d[1] - 0.01);
  if (kind === 4 && drag === 'x' && Math.abs(x - 1) < 0.02) x = 0.98;
  readout();
});
for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, () => { drag = null; });

// ---------- step figures ----------
// a frame round a for the figures: the curve from a − s to a + s, s big enough to include x when it is near
function localFrame(w, h, z, extra = []) {
  const cu = C(), s = clamp(Math.abs(x - a) * 1.4, 1, 2.5);
  const x0 = Math.max(cu.d[0], a - s), x1 = Math.min(cu.d[1], a + s);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 100; i++) { const v = curve(x0 + (x1 - x0) * i / 100); if (Number.isFinite(v) && Math.abs(v) < 50) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  for (const v of extra) if (Number.isFinite(v) && Math.abs(v) < 50) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pad = (hi - lo) * 0.15 || 0.5;
  return frameOf(40 * z, w - 16, 72 * z, h - 30 * z, x0, x1, lo - pad, hi + pad);
}
const xIn = f => clamp(x, f.x0 + (f.x1 - f.x0) * 0.04, f.x1 - (f.x1 - f.x0) * 0.04);

// 1: the flat line turns into the tangent; the slope triangle from a to x
function ex1(sec) {
  const [g, w, h, z] = fig('ex1'), c0 = coefficients(kind, a, 1), fa = c0[0], m = c0[1];
  const f = localFrame(w, h, z, [fa, fa + m * (x - a)]), xv = xIn(f), hgt = xv - a;
  axes(g, f, z, false);
  plot(g, f, curve, INK, 2.5);
  const ph = still ? 1 : (sec % 6) / 6, turn = ease((ph - 0.25) / 0.3), slope = m * turn;
  plot(g, f, v => fa, 'rgba(87,83,78,.45)', 2, [6, 5]);
  plot(g, f, v => fa + slope * (v - a), BLUE, 3);
  dot(g, f.X(a), f.Y(fa), 7 * z, PINK, '#fff');
  if (turn > 0.98) {
    // the slope triangle: along by x − a, up by f′(a)·(x − a)
    g.strokeStyle = AMBER; g.lineWidth = 2.5; g.beginPath(); g.moveTo(f.X(a), f.Y(fa)); g.lineTo(f.X(xv), f.Y(fa)); g.lineTo(f.X(xv), f.Y(fa + m * hgt)); g.stroke();
    tag(g, `x − a = ${fmt(hgt, 3)}`, (f.X(a) + f.X(xv)) / 2, f.Y(fa) + (m * hgt > 0 ? 18 : -8) * z, AMBER, 12, z, 'center');
    tag(g, `up ${fmt(m, 3)} × ${fmt(hgt, 3)} = ${fmt(m * hgt, 3)}`, f.X(xv) + (hgt > 0 ? 8 : -8), (f.Y(fa) + f.Y(fa + m * hgt)) / 2, AMBER, 12, z, hgt > 0 ? 'left' : 'right');
    dot(g, f.X(xv), f.Y(curve(xv)), 4.5 * z, INK);
  }
  tag(g, `first term: the height f(a) = ${fmt(fa, 4)} (grey)`, 10, 22 * z, INK2, 13, z);
  tag(g, turn > 0.98 ? `plus the slope: f′(a)·(x − a) with f′(a) = ${fmt(m, 4)} (blue)` : 'add the second term: the line tilts to the slope at a', 10, 44 * z, BLUE, 13, z);
  $('cap1').textContent = `Your curve, ${C().name}, around a = ${fmt(a, 2)}, with x = ${fmt(xv, 3)}${xv !== x ? ` (moved into view; above it is ${fmt(x, 3)})` : ''}. Two terms: ${fmt(fa + m * hgt, 4)}; the curve: ${fmt(curve(xv), 4)}.`;
}

// 2: the polynomials after 1, 2, 3 … terms, and the miss at x after each
function ex2(sec) {
  const [g, w, h, z] = fig('ex2'), mmax = clamp(n, 2, 6), xv = x;
  const misses = Array.from({ length: mmax + 1 }, (_, k) => Math.abs(taylor(kind, a, k, xv) - curve(xv)));
  const f = localFrame(w * 0.62, h, z), cur = still ? 2 : Math.floor(sec / 1.3) % (mmax + 1);
  const xs = xIn(f);
  axes(g, f, z, false);
  for (let k = 0; k <= mmax; k++) if (k !== cur) plot(g, f, v => taylor(kind, a, k, v), 'rgba(219,39,119,.18)', 1.5);
  plot(g, f, curve, INK, 2.5);
  plot(g, f, v => taylor(kind, a, cur, v), PINK, 3);
  dot(g, f.X(a), f.Y(curve(a)), 6 * z, PINK, '#fff');
  const py = taylor(kind, a, cur, xs), fy = curve(xs);
  g.strokeStyle = RED; g.lineWidth = 3; g.beginPath(); g.moveTo(f.X(xs), f.Y(clamp(py, f.y0, f.y1))); g.lineTo(f.X(xs), f.Y(fy)); g.stroke();
  // the misses, one bar each, on a scale of powers of ten
  const L = w * 0.68, Rr = w - 14, T = 80 * z, B = h - 34 * z, lmax = Math.ceil(Math.log10(Math.max(...misses, 1e-9))), lmin = Math.max(lmax - 8, Math.floor(Math.log10(Math.max(Math.min(...misses), 1e-12))));
  const BY = v => B - (B - T) * clamp((Math.log10(Math.max(v, 1e-15)) - lmin) / (lmax - lmin || 1)), bw = (Rr - L) / (mmax + 1);
  for (let k = 0; k <= mmax; k++) {
    g.fillStyle = k === cur ? RED : 'rgba(220,38,38,.3)'; g.fillRect(L + k * bw + 2, BY(misses[k]), bw - 4, B - BY(misses[k]));
    text(g, String(k + 1), L + (k + 0.5) * bw, B + 14 * z, INK2, 11, z, 600, 'center');
  }
  text(g, 'terms', (L + Rr) / 2, B + 28 * z, INK2, 11, z, 500, 'center');
  text(g, 'miss at x', L, T - 8 * z, RED, 12, z, 700);
  tag(g, `${cur + 1} term${cur ? 's' : ''}: miss at x = ${fmt(xv, 3)} is ${fmt(misses[cur])}`, 10, 22 * z, RED, 13, z);
  tag(g, cur >= 2 ? `the bend term: f″(a)/2 = ${fmt(coefficients(kind, a, 2)[2], 4)}` : cur === 1 ? 'height and slope: a straight line' : 'just the height: a flat line', 10, 44 * z, INK2, 13, z);
  $('cap2').textContent = `Your ${C().name} around a = ${fmt(a, 2)}. Bars: how far the polynomial is from the curve at x after each number of terms, each line on the scale ten times smaller than the one above.${Math.abs(x - a) >= radius(kind, a) ? ' Your x is beyond the radius, so the misses grow.' : ''}`;
}

// 3: the derivatives of (x − a)^k, the power coming down each time
function ex3(sec) {
  const [g, w, h, z] = fig('ex3'), k = clamp(+$('kPick').value | 0, 1, 7), shown = still ? k : Math.min(k, Math.floor((sec % (k * 1.1 + 3)) / 1.1));
  $('kVal').textContent = k;
  const rowH = Math.min(40 * z, (h - 110 * z) / (k + 1)), L = 26 * z, cfs = coefficients(kind, a, k), ck = cfs[k];
  const h0 = a === 0 ? 'x' : '(x − a)';
  for (let j = 0; j <= shown; j++) {
    const y = 34 * z + j * rowH, front = Array.from({ length: j }, (_, i) => k - i);
    const pw = k - j, body = pw === 0 ? '' : pw === 1 ? h0 : h0 + sup(pw);
    const lhs = j === 0 ? 'the term:' : `derivative ${j}:`;
    text(g, lhs, L, y, INK2, 15, z, 600);
    const expr = (front.length ? front.join('·') + (body ? '·' : '') : '') + body;
    text(g, expr || '1', L + 150 * z, y, j === k ? PINK : INK, 17, z, 700);
    if (j > 0 && j === shown && j < k + 1 && !still) {
      // the power that just came down, flying from the exponent to the front
      const t = clamp(((sec % (k * 1.1 + 3)) - j * 1.1) / 0.6), from = [L + 150 * z + 130 * z, y - rowH - 8 * z], to = [L + 150 * z + (front.length - 1) * 22 * z, y];
      if (t < 1) text(g, String(k - j + 1), from[0] + (to[0] - from[0]) * ease(t), from[1] + (to[1] - from[1]) * ease(t), AMBER, 16, z, 800);
    }
  }
  if (shown >= k) {
    const y = 34 * z + (k + 1) * rowH + 8 * z;
    tag(g, `= ${k}! = ${FACT[k]}. So cₖ = f⁽${sup(k)}⁾(a) ÷ ${FACT[k]}`, L, y, PINK, 15, z);
    tag(g, `for your ${C().name} at a = ${fmt(a, 2)}: f⁽${sup(k)}⁾(a) = ${fmt(ck * FACT[k], 4)}, so c${'₀₁₂₃₄₅₆₇'[k]} = ${fmt(ck * FACT[k], 4)} ÷ ${FACT[k]} = ${fmt(ck)}`, L, y + 26 * z, INK, 13, z);
  }
  $('cap3').textContent = `Each derivative brings the power down in front and lowers it by one. After ${k} of them only the number ${k}·…·1 = ${k}! = ${FACT[k]} is left.`;
}

// 4: the terms at x as bars, and their running total closing in on the curve's value
function ex4(sec) {
  const [g, w, h, z] = fig('ex4'), N = clamp(n, 1, 14), t = Array.from(terms(kind, a, N, x)), fx = curve(x);
  const per = 0.7, k = still ? N : Math.min(N, Math.floor((sec % (N * per + 3)) / per));
  const run = []; let s = 0; for (const v of t) { s += v; run.push(s); }
  let lo = Math.min(0, fx, ...run, ...t), hi = Math.max(0, fx, ...run, ...t); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
  const L = 50 * z, R = w - 16, T = 70 * z, B = h - 34 * z, bw = (R - L) / (N + 1), Y = v => B - (B - T) * (v - lo) / (hi - lo);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(R, Y(0)); g.stroke();
  text(g, '0', L - 6, Y(0) + 4, INK2, 11, z, 500, 'right');
  for (let j = 0; j <= k; j++) {
    const v = t[j], x0 = L + j * bw;
    g.fillStyle = v >= 0 ? 'rgba(37,99,235,.45)' : 'rgba(220,38,38,.45)';
    g.fillRect(x0 + bw * 0.2, Math.min(Y(0), Y(v)), bw * 0.6, Math.abs(Y(v) - Y(0)) || 1);
    text(g, String(j), x0 + bw / 2, B + 14 * z, INK2, 11, z, 600, 'center');
  }
  text(g, 'power', (L + R) / 2, B + 28 * z, INK2, 11, z, 500, 'center');
  g.strokeStyle = PINK; g.lineWidth = 3; g.beginPath();
  for (let j = 0; j <= k; j++) { const px = L + (j + 0.5) * bw; j ? g.lineTo(px, Y(run[j])) : g.moveTo(px, Y(run[j])); }
  g.stroke();
  for (let j = 0; j <= k; j++) dot(g, L + (j + 0.5) * bw, Y(run[j]), 3.5 * z, PINK);
  if (Number.isFinite(fx)) { g.strokeStyle = INK; g.setLineDash([6, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, Y(fx)); g.lineTo(R, Y(fx)); g.stroke(); g.setLineDash([]); tag(g, `${C().name} at x: ${fmt(fx, 6)}`, R, Y(fx) - 6, INK, 12, z, 'right'); }
  tag(g, `term ${k}: c${k <= 7 ? '₀₁₂₃₄₅₆₇'[k] : '' + k}·(x − a)${sup(k)} = ${fmt(t[k])}`, 10, 22 * z, t[k] >= 0 ? BLUE : RED, 13, z);
  tag(g, `running total: ${fmt(run[k], 7)}`, 10, 44 * z, PINK, 13, z);
  $('cap4').textContent = `Your ${C().name} around a = ${fmt(a, 2)} at x = ${fmt(x, 3)}, with terms up to power ${N}${N !== n ? ` (${n} above)` : ''}. Blue bars add, red ones take away; the pink line is the total so far.`;
}

// 5: the size of each term at an x inside the radius and at one outside it
function ex5(sec) {
  const [g, w, h, z] = fig('ex5'), finite = Number.isFinite(radius(kind, a));
  const k5 = finite ? kind : 3, a5 = finite ? a : 0, R = radius(k5, a5);
  const xi = a5 + 0.6 * R, xo = a5 + 1.3 * R, N = 24;
  const ti = Array.from(terms(k5, a5, N, xi)).map(Math.abs), to = Array.from(terms(k5, a5, N, xo)).map(Math.abs);
  const k = still ? N : Math.min(N, Math.floor((sec % 11) / 0.33));
  const L = 50 * z, Rr = w - 16, T = 74 * z, B = h - 34 * z, bw = (Rr - L) / (N + 1);
  const all = [...ti, ...to].filter(v => v > 0), lmax = Math.ceil(Math.log10(Math.max(...all))), lmin = Math.max(lmax - 9, Math.floor(Math.log10(Math.min(...all))));
  const Y = v => B - (B - T) * clamp((Math.log10(Math.max(v, 1e-20)) - lmin) / (lmax - lmin || 1));
  for (let e = lmin; e <= lmax; e++) { g.strokeStyle = 'rgba(0,0,0,.07)'; g.beginPath(); g.moveTo(L, Y(10 ** e)); g.lineTo(Rr, Y(10 ** e)); g.stroke(); text(g, e === 0 ? '1' : `10${e < 0 ? '⁻' : ''}${sup(Math.abs(e))}`, L - 6, Y(10 ** e) + 4, INK2, 10, z, 500, 'right'); }
  for (let j = 1; j <= k; j++) {
    const x0 = L + j * bw;
    g.fillStyle = 'rgba(22,163,74,.6)'; g.fillRect(x0 + bw * 0.1, Y(ti[j]), bw * 0.38, B - Y(ti[j]));
    g.fillStyle = 'rgba(220,38,38,.6)'; g.fillRect(x0 + bw * 0.52, Y(to[j]), bw * 0.38, B - Y(to[j]));
    if (j % 4 === 0) text(g, String(j), x0 + bw / 2, B + 14 * z, INK2, 11, z, 600, 'center');
  }
  text(g, 'power', (L + Rr) / 2, B + 28 * z, INK2, 11, z, 500, 'center');
  const si = taylor(k5, a5, Math.max(k, 1), xi), so = taylor(k5, a5, Math.max(k, 1), xo);
  tag(g, `x = ${fmt(xi, 3)}, inside (0.6 × R): terms shrink, total ${fmt(si, 5)} → ${fmt(tcurve(k5, xi), 5)}`, 10, 22 * z, GREEN, 13, z);
  tag(g, `x = ${fmt(xo, 3)}, outside (1.3 × R): terms grow, total ${fmt(so, 3)}`, 10, 44 * z, RED, 13, z);
  $('cap5').textContent = `${finite ? `Your ${CURVES[k5].name} around a = ${fmt(a5, 2)}` : `ln(1 + x) around 0 (your ${C().name} works everywhere, so it never does this)`}: radius R = ${fmt(R, 3)}. The size of each term, on a scale of powers of ten, at one x inside the radius and one outside.`;
  $('useLn').hidden = finite;
}
$('useLn').addEventListener('click', () => { $('kind').value = '3'; useKind(3); setAuto(false); setN(12); readout(); });

// 6: the actual error against the size of the first term left out, for 0 … 14 terms
function ex6(sec) {
  const [g, w, h, z] = fig('ex6'), N = 14;
  const err = [], next = [], bound = [];
  for (let m = 0; m <= N; m++) {
    err.push(Math.abs(taylor(kind, a, m, x) - curve(x)));
    // the first term left out that is not 0
    let j = m + 1, t = 0; while (j <= m + 3) { t = Math.abs(terms(kind, a, j, x)[j]); if (t > 1e-300) break; j++; }
    next.push(t);
    bound.push(kind <= 1 ? Math.abs(x - a) ** (m + 1) / FACT[m + 1] : NaN);
  }
  const all = [...err, ...next].filter(v => v > 1e-17 && Number.isFinite(v));
  const lmax = Math.ceil(Math.log10(Math.max(...all, 1e-12))), lmin = Math.max(lmax - 12, Math.floor(Math.log10(Math.min(...all, 1))));
  const L = 50 * z, R = w - 16, T = 74 * z, B = h - 34 * z, X = m => L + (R - L) * m / N, Y = v => B - (B - T) * clamp((Math.log10(Math.max(v, 1e-20)) - lmin) / (lmax - lmin || 1));
  for (let e = lmin; e <= lmax; e += Math.ceil((lmax - lmin) / 6)) { g.strokeStyle = 'rgba(0,0,0,.07)'; g.beginPath(); g.moveTo(L, Y(10 ** e)); g.lineTo(R, Y(10 ** e)); g.stroke(); text(g, e === 0 ? '1' : `10${e < 0 ? '⁻' : ''}${sup(Math.abs(e))}`, L - 6, Y(10 ** e) + 4, INK2, 10, z, 500, 'right'); }
  const reveal = still ? N : Math.min(N, Math.floor((sec % 9) / 0.45));
  const line = (vals, col, w2, dash) => { g.strokeStyle = col; g.lineWidth = w2; g.setLineDash(dash || []); g.beginPath(); let pen = false; for (let m = 0; m <= reveal; m++) { if (!(vals[m] > 1e-17) || !Number.isFinite(vals[m])) { pen = false; continue; } pen ? g.lineTo(X(m), Y(vals[m])) : g.moveTo(X(m), Y(vals[m])); pen = true; } g.stroke(); g.setLineDash([]); };
  if (kind <= 1) line(bound, 'rgba(37,99,235,.6)', 2, [6, 4]);
  line(err, RED, 4);
  line(next, AMBER, 2.5, [7, 5]);   // dashed on top: for sin it lies almost on the red line
  for (let m = 0; m <= N; m += 2) text(g, String(m), X(m), B + 14 * z, INK2, 11, z, 600, 'center');
  text(g, 'terms up to power', (L + R) / 2, B + 28 * z, INK2, 11, z, 500, 'center');
  const mm = clamp(n, 0, N);
  g.strokeStyle = 'rgba(219,39,119,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(mm), T); g.lineTo(X(mm), B); g.stroke();
  tag(g, `red: the real error at x = ${fmt(x, 3)} · amber: the first term left out${kind <= 1 ? ' · blue: the sure limit' : ''}`, 10, 22 * z, INK, 12, z);
  tag(g, `your ${mm}: error ${fmt(err[mm])}, next term ${fmt(next[mm])}`, 10, 44 * z, PINK, 13, z);
  $('cap6').textContent = `Your ${C().name} around a = ${fmt(a, 2)} at x = ${fmt(x, 3)}, on a scale of powers of ten. ${kind <= 1 ? 'For sin and cos the red line never goes above the blue limit |x − a|ⁿ⁺¹ ÷ (n + 1)!.' : 'The red and amber lines run close together: the error is about the first term left out.'}`;
}

// ---------- the animation: only what is on screen ----------
const onScreen = new Set();
const io = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? onScreen.add(e.target.id) : onScreen.delete(e.target.id); }, { rootMargin: '80px' });
for (const id of ['stage', 'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6']) io.observe($(id));
const FIGS = { ex1, ex2, ex3, ex4, ex5, ex6 };
let last = 0, lastFigs = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
  if (document.hidden) return;
  if (auto) {
    autoT += dt;
    const hold = autoK === SEQ.length - 1 ? 2.6 : 0.9;
    if (autoT > hold) { autoT = 0; autoK = (autoK + 1) % SEQ.length; setN(SEQ[autoK]); if (onScreen.has('stage')) readout(); }
  }
  if (now - lastFigs < 33) return;
  lastFigs = now;
  const sec = now / 1000;
  for (const id in FIGS) if (onScreen.has(id)) FIGS[id](sec);
}

// ---------- Try this ----------
function setup(k, aa, xx, nn, play = false) {
  $('kind').value = String(k); useKind(k);
  a = aa; x = xx; setAuto(play); if (!play) setN(nn);
  readout();
}
const TRY = [
  () => setup(0, 0, 2.5, 0, true),
  () => setup(0, 0, 0.6457718, 7),   // 37° in radians
  () => setup(2, 0, 1, 9),
  () => setup(3, 0, 1.5, 24),
  () => setup(5, 0, 1.5, 15),
];
for (const btn of document.querySelectorAll('[data-try]')) btn.addEventListener('click', () => { TRY[+btn.dataset.try](); $('play').scrollIntoView({ behavior: still ? 'auto' : 'smooth' }); });

useKind(0); setAuto(auto); if (!auto) setN(7);
readout();
for (const id in FIGS) FIGS[id](still ? 1e3 : 0);
requestAnimationFrame(frame);
new ResizeObserver(() => readout()).observe(cv);

// Together (together/share.js): the curve and the number of terms are controls; a, x and whether the
// terms are being added by themselves live here
share(() => ({ k: kind, ax: [a, x], auto, n }), s => {
  const v = nums(s?.ax, 2), k = s?.k;
  if (!v || v.length !== 2 || !Number.isInteger(k) || k < 0 || k > 5) return;
  if (k !== kind) { $('kind').value = String(k); useKind(k); }
  const cu = C();
  if (!(v[0] >= cu.aLim[0] && v[0] <= cu.aLim[1] && v[1] > cu.d[0] && v[1] < cu.d[1])) return;
  [a, x] = v;
  if (typeof s.auto === 'boolean' && s.auto !== auto) setAuto(s.auto);
  if (!auto && Number.isInteger(s.n)) setN(s.n);
  readout();
});
