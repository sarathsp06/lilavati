// Polygon meshes: a ball, a doughnut or a pebble made of flat triangles, drawn by a small software
// renderer (render.js) the way a graphics card does it. Maths: pkg/lilavati.js (mesh.rs) builds the
// meshes and measures them. The step figures build each result on screen: a lifted corner that bends a
// square, a triangle's normal and the shade it gives, pixels tested against three edges, a chord's gap
// shrinking four times, triangles added up into the area, and normals blended across faces.
import init, { mesh_points, mesh_triangles, corner_normals, measures, exact_measures, circle_polygons } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';
import { render, turn, shade, norm, cross, dot, LIGHT, AMBIENT, DIFFUSE } from './render.js';

await init();
const $ = id => document.getElementById(id);
const INK = '#1c1917', INK2 = '#57534e', TEAL = '#0d9488', ORANGE = '#ea580c', BLUE = '#2563eb', RED = '#dc2626';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = t => 1 - (1 - clamp(t)) ** 3;
const deg = r => r * 180 / Math.PI;
function fmt(v, d) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v), p = d ?? (a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : 6);
  return v.toFixed(p).replace('-', '−');
}
const pct = v => (v < 0.1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : v.toFixed(0)) + '%';
const big = n => n.toLocaleString('en-GB');

// ---------- the meshes ----------
const SHAPES = [
  { name: 'ball', the: 'the true ball', color: [52, 178, 166], across: 2, pitch: 0.35 },
  { name: 'doughnut', the: 'the true doughnut', color: [222, 150, 84], across: 2.8, pitch: 0.75 },
  { name: 'pebble', the: 'the true pebble', color: [160, 146, 128], across: 2.5, pitch: 0.4 },
];
const cache = new Map(), exacts = new Map();
function meshOf(s, l) {
  const k = s + ':' + l;
  if (!cache.has(k)) cache.set(k, { p: mesh_points(s, l), t: mesh_triangles(s, l), n: corner_normals(s, l), m: Array.from(measures(s, l)) });
  return cache.get(k);
}
const exactOf = s => { if (!exacts.has(s)) exacts.set(s, Array.from(exact_measures(s))); return exacts.get(s); };

// ---------- state ----------
let shape = 0, level = 2, smooth = false, edges = false, yaw = 0.5, pitch = 0.35, spinning = !still;

// ---------- small drawing helpers ----------
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
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(lx - 3, y - size * z, w + 6, size * z * 1.32);
  text(g, s, x, y, col, size, z, 600, align);
}
function arrow(g, x0, y0, x1, y1, col, lw = 2.5, head = 10) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.strokeStyle = g.fillStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4)); g.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4)); g.fill();
}
const rgb = (c, s = 1) => `rgb(${Math.min(255, c[0] * s) | 0},${Math.min(255, c[1] * s) | 0},${Math.min(255, c[2] * s) | 0})`;
// a chord across angle th of a circle of radius 1, in box [L, R] × [T, B], with the circle's height
// above the chord stretched by k so the gap can be seen; returns the mapping
function chordBox(L, R, T, B, th) {
  const half = th / 2, sx = (R - L) / (2 * Math.sin(half)) * 0.92, gap = 1 - Math.cos(half);
  const k = Math.max(1, (B - T) * 0.55 / (gap * sx));
  const X = x => (L + R) / 2 + x * sx, Y = y => B - 14 - (y - Math.cos(half)) * sx * k;
  return { X, Y, k, half, gap, sx };
}
function arc(g, f, a0, a1, col, lw, dash) {
  g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath();
  for (let i = 0; i <= 80; i++) { const a = a0 + (a1 - a0) * i / 80, x = f.X(Math.sin(a)), y = f.Y(Math.cos(a)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.setLineDash([]);
}

// ---------- The idea: a circle drawn with straight pieces ----------
let ideaN = 6;
function idea() {
  const [g, w, h, z] = fig('ideaCv'), n = ideaN, [inner, outer, gap] = Array.from(circle_polygons(n));
  const cx = w * 0.26, cy = h / 2, r = h * 0.4, R = r / Math.cos(Math.PI / n);
  // the circle, the polygon inside (corners on it) and the one outside (sides touching it)
  g.fillStyle = 'rgba(13,148,136,.16)'; g.strokeStyle = TEAL; g.lineWidth = 2.5; g.beginPath();
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 - Math.PI / n + 2 * Math.PI * i / n, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.fill(); g.stroke();
  g.strokeStyle = ORANGE; g.lineWidth = 1.8; g.setLineDash([6, 5]); g.beginPath();
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * i / n, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.setLineDash([]);
  g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  // the piece at the top, picked out, and a box round it
  const a0 = -Math.PI / 2 - Math.PI / n, a1 = -Math.PI / 2 + Math.PI / n;
  g.strokeStyle = RED; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0)); g.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1)); g.stroke();
  // magnified: that piece and its stretch of circle
  const L = w * 0.53, Rr = w - 24, T = 50 * z, B = h - 40 * z, f = chordBox(L, Rr, T, B, 2 * Math.PI / n);
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; g.strokeRect(L - 10, T - 34 * z, Rr - L + 20, B - T + 50 * z);
  arc(g, f, -f.half * 1.06, f.half * 1.06, INK, 2.5);
  g.strokeStyle = RED; g.lineWidth = 4; g.beginPath(); g.moveTo(f.X(-Math.sin(f.half)), f.Y(Math.cos(f.half))); g.lineTo(f.X(Math.sin(f.half)), f.Y(Math.cos(f.half))); g.stroke();
  for (const s of [-1, 1]) { g.fillStyle = INK; g.beginPath(); g.arc(f.X(s * Math.sin(f.half)), f.Y(Math.cos(f.half)), 5, 0, 7); g.fill(); }
  arrow(g, f.X(0), f.Y(Math.cos(f.half)), f.X(0), f.Y(1) + 2, BLUE, 2, 8);
  tag(g, `gap = 1 − cos(180°/${n}) = ${fmt(gap)}`, f.X(0) + 10, (f.Y(1) + f.Y(Math.cos(f.half))) / 2 + 5, BLUE, 14, z);
  text(g, `one piece, magnified${f.k > 1.05 ? `; heights stretched ×${Math.round(f.k)} so the gap shows` : ''}`, L, T - 14 * z, INK2, 12, z, 500);
  text(g, `${n} pieces`, cx, cy + r + 26 * z, INK, 15, z, 700, 'center');
  $('ideaNVal').textContent = n;
  $('ideaDouble').textContent = n >= 96 ? 'Start again at 6' : 'Double them';
  $('ideaFormula').textContent = `${n} × sin(180°/${n}) = ${inner.toFixed(5)}  <  π = 3.14159  <  ${n} × tan(180°/${n}) = ${outer.toFixed(5)}`;
  $('ideaSay').textContent = `Half the perimeter of the ${n}-sided shape inside is ${inner.toFixed(5)}, and of the one outside ${outer.toFixed(5)}; π, half the circle's perimeter, is trapped between them. Each straight piece sits at most ${fmt(gap)} of the radius inside the circle. ` +
    (n * 2 <= 192 ? `Double the pieces to ${2 * n} and that gap is ${fmt(circle_polygons(2 * n)[2])}, ${(gap / circle_polygons(2 * n)[2]).toFixed(2)} times smaller.` : '');
  $('ideaCap').textContent = `A circle of radius 1 drawn with ${n} straight pieces. Right: the red piece and the stretch of circle it replaces.`;
}
$('ideaN').addEventListener('input', () => { ideaN = clamp(+$('ideaN').value | 0, 3, 96); idea(); });
$('ideaDouble').addEventListener('click', () => { ideaN = ideaN >= 96 ? 6 : Math.min(96, ideaN * 2); $('ideaN').value = ideaN; idea(); });

// ---------- the main picture ----------
const cv = $('stage'), c = cv.getContext('2d');
let dirty = true;
function view(w, h, s = shape) {
  const dist = 7, sh = SHAPES[s];
  return { dist, f: 0.4 * Math.min(w, h * 1.4) * dist / (sh.across / 2 + 0.25), cx: w / 2, cy: h / 2 };
}
function drawStage() {
  const m = meshOf(shape, level), v = view(cv.width, cv.height);
  render(c, m, { ...v, yaw, pitch, smooth, edges, color: SHAPES[shape].color, lineWidth: level >= 4 ? 0.45 : 0.8 });
  const z = clamp(0.8 * cv.width / (cv.clientWidth || cv.width), 1, 2.2);
  text(c, `${big(m.m[0])} triangles · ${smooth ? 'smooth' : 'flat'} shading`, 16, 26 * z, INK2, 14, z, 600);
}
// how big the deepest gap is on the screen right now, in the screen's own pixels
function gapPixels() {
  const m = meshOf(shape, level), v = view(cv.width, cv.height);
  return m.m[4] * v.f / v.dist * (cv.clientWidth || cv.width) / cv.width;
}
function readout() {
  const m = meshOf(shape, level), [ea, ev] = exactOf(shape), sh = SHAPES[shape];
  const [T, V, A, Vol, gap] = m.m, E = 1.5 * T, aShort = (ea - A) / ea * 100, vShort = (ev - Vol) / ev * 100;
  const px = gapPixels(), mm = gap * 100 / sh.across;
  $('lvlVal').textContent = big(T);
  $('tT').textContent = big(T);
  $('tVx').textContent = big(V); $('tE').textContent = big(E);
  $('tChi').textContent = String(V - E + T);
  $('tA').textContent = `${fmt(A)} (${fmt(ea)})`;
  $('tV').textContent = `${fmt(Vol)} (${fmt(ev)})`;
  $('tGap').textContent = fmt(gap);
  $('gapNote').textContent = `The deepest gap is how far the middle of a triangle lies inside ${sh.the}. If this ${sh.name} were 10 cm across, it would be ${mm >= 1 ? fmt(mm, 1) : fmt(mm, 2)} mm. On your screen now it is ${px < 10 ? px.toFixed(1) : Math.round(px)} pixel${px >= 0.95 && px < 1.05 ? '' : 's'}: ${px < 1 ? 'too small to see.' : px < 2.5 ? 'only just visible.' : 'easy to see.'}`;
  $('say').innerHTML = `Area <b>${pct(aShort)}</b> short of ${sh.the}'s · volume <b>${pct(vShort)}</b> short · deepest gap <b>${px < 10 ? px.toFixed(1) : Math.round(px)} px</b> on screen`;
  dirty = true;
}
function setLevel(l) { level = clamp(l | 0, 0, 5); $('lvl').value = level; readout(); }
function setShape(s) { shape = clamp(s | 0, 0, 2); $('shape').value = String(shape); pitch = SHAPES[shape].pitch; readout(); }
function setSpin(on) { spinning = on; $('spin').textContent = on ? '■ Stop turning' : '▶ Turn it'; }
$('lvl').addEventListener('input', () => setLevel(+$('lvl').value));
$('shape').addEventListener('change', () => setShape(+$('shape').value));
$('shading').addEventListener('change', () => { smooth = $('shading').value === '1'; readout(); });
$('edges').addEventListener('change', () => { edges = $('edges').checked; readout(); });
$('spin').addEventListener('click', () => setSpin(!spinning));

// drag to turn: sideways on any screen; up and down too with a mouse (on touch screens that scrolls)
let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; setSpin(false); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  yaw = drag.yaw + (e.clientX - drag.x) * 0.012;
  if (e.pointerType === 'mouse') pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.012, -1.3, 1.3);
  dirty = true;
});
for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, () => { drag = null; });

// ---------- step 1: three corners are always flat ----------
function ex1(sec) {
  const [g, w, h, z] = fig('ex1'), hgt = 0.85 * Math.sin(sec * 0.9);
  const P = (p, ox) => { const q = turn(p, -0.55, 0.55); return [ox + q[0] * w * 0.15, h * 0.58 - q[1] * w * 0.15]; };
  const A = [-1, 0, -1], B = [1, 0, -1], C = [1, 0, 1], D = [-1, hgt, 1], D0 = [-1, 0, 1];
  // left: four corners; the flat through A, B, C, and D off it by h
  const ox = w * 0.26;
  g.fillStyle = 'rgba(13,148,136,.10)'; g.beginPath(); [A, B, C, D0].forEach((p, i) => { const [x, y] = P(p, ox); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.fill();
  g.strokeStyle = 'rgba(13,148,136,.5)'; g.setLineDash([5, 4]); g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
  g.strokeStyle = RED; g.lineWidth = 3; g.beginPath(); [A, B, C, D, A].forEach((p, i) => { const [x, y] = P(p, ox); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  for (const [p, q] of [[A, C], [B, D]]) { const [x0, y0] = P(p, ox), [x1, y1] = P(q, ox); g.strokeStyle = 'rgba(220,38,38,.45)'; g.lineWidth = 1.2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); }
  const [dx0, dy0] = P(D0, ox), [dx1, dy1] = P(D, ox);
  g.strokeStyle = BLUE; g.lineWidth = 2; g.beginPath(); g.moveTo(dx0, dy0); g.lineTo(dx1, dy1); g.stroke();
  tag(g, `h = ${fmt(hgt, 2)}`, dx1 + 8, (dy0 + dy1) / 2 + 4, BLUE, 13, z);
  for (const [p, nm] of [[A, 'A'], [B, 'B'], [C, 'C'], [D, 'D']]) { const [x, y] = P(p, ox); g.fillStyle = INK; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); text(g, nm, x + 7, y - 6, INK, 14, z, 700); }
  text(g, 'four corners', ox, 28 * z, INK, 15, z, 700, 'center');
  text(g, Math.abs(hgt) < 0.05 ? 'D is on the flat of A, B, C' : 'not flat: fold along AC or BD?', ox, 50 * z, RED, 13, z, 600, 'center');
  // right: two triangles, each flat, each with its own shade
  const ox2 = w * 0.74;
  for (const [tri, col] of [[[A, B, C], [52, 178, 166]], [[A, C, D], [222, 150, 84]]]) {
    const [p, q, r] = tri.map(v => turn(v, -0.55, 0.55)), nrm = norm(cross([q[0] - p[0], q[1] - p[1], q[2] - p[2]], [r[0] - p[0], r[1] - p[1], r[2] - p[2]]));
    const s = shade(nrm[2] < 0 ? nrm.map(v => -v) : nrm, false);
    g.fillStyle = rgb(col, s); g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath();
    tri.forEach((v, i) => { const [x, y] = P(v, ox2); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.stroke();
  }
  for (const [p, nm] of [[A, 'A'], [B, 'B'], [C, 'C'], [D, 'D']]) { const [x, y] = P(p, ox2); text(g, nm, x + 7, y - 6, INK, 14, z, 700); }
  text(g, 'two triangles', ox2, 28 * z, INK, 15, z, 700, 'center');
  text(g, 'each one flat, with one shade', ox2, 50 * z, TEAL, 13, z, 600, 'center');
  $('cap1').textContent = `Corner D moves up and down by h. The other three always span one flat plane (shaded); with D off it, the square must bend. Cut along AC, each half is a flat triangle.`;
}

// ---------- step 2: one triangle, one shade ----------
function ex2(sec) {
  const [g, w, h, z] = fig('ex2'), yw = 0.9 * Math.sin(sec * 0.45), pt = 0.25 * Math.sin(sec * 0.31);
  const tri = [[-1, -0.65, 0.1], [1.05, -0.4, -0.15], [-0.15, 0.85, 0]].map(p => turn(p, yw, pt));
  const S = w * 0.19, ox = w * 0.4, oy = h * 0.64, P = p => [ox + p[0] * S, oy - p[1] * S];
  const [A, B, C] = tri, AB = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], AC = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  let n = norm(cross(AB, AC)); if (n[2] < 0) n = n.map(v => -v);
  const cos = dot(n, LIGHT), b = AMBIENT + DIFFUSE * Math.max(0, cos);
  g.fillStyle = rgb([52, 178, 166], b); g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); tri.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.stroke();
  arrow(g, ...P(A), ...P(B), BLUE, 2.5); arrow(g, ...P(A), ...P(C), BLUE, 2.5);
  const [bx, by] = P(B), [ccx, ccy] = P(C), [ax, ay] = P(A);
  text(g, 'AB', (ax + bx) / 2, (ay + by) / 2 + 18 * z, BLUE, 13, z, 700); text(g, 'AC', (ax + ccx) / 2 - 26 * z, (ay + ccy) / 2, BLUE, 13, z, 700);
  const mid = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3], [mx, my] = P(mid);
  arrow(g, mx, my, mx + n[0] * S * 1.1, my - n[1] * S * 1.1, INK, 3);
  text(g, 'n', mx + n[0] * S * 1.1 + 6, my - n[1] * S * 1.1, INK, 15, z, 700);
  arrow(g, mx, my, mx + LIGHT[0] * S * 1.1, my - LIGHT[1] * S * 1.1, ORANGE, 3);
  const lx = mx + LIGHT[0] * S * 1.25, ly = my - LIGHT[1] * S * 1.25;
  g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(lx, ly, 9, 0, 7); g.fill(); text(g, 'L (to the light)', lx - 12, ly - 14, ORANGE, 13, z, 700);
  // the sum, written out, and the shade it gives
  const f2 = v => fmt(v, 2);
  const narrow = ($('ex2').clientWidth || w) < 500, fs = narrow ? 15 : 13, lh = fs * 1.5 * z;
  const lines = [[`n = AB × AC, made length 1 = (${f2(n[0])}, ${f2(n[1])}, ${f2(n[2])})`, INK]];
  const sum = `${f2(n[0])}×(${f2(LIGHT[0])}) + ${f2(n[1])}×${f2(LIGHT[1])} + ${f2(n[2])}×${f2(LIGHT[2])}`;
  if (narrow) lines.push([`cos θ = n · L`, ORANGE], [`  = ${sum} = ${f2(cos)}`, ORANGE]); else lines.push([`cos θ = n · L = ${sum} = ${f2(cos)}`, ORANGE]);
  lines.push([`brightness = 0.22 + 0.78 × ${f2(Math.max(0, cos))} = ${f2(b)}`, INK]);
  lines.forEach(([s2, col], i) => tag(g, s2, 10, (fs + 6) * z + i * lh, col, fs, z));
  // a brightness scale with the triangle's place on it
  const gx = w - 46 * z, gt = 90 * z, gb = h - 24 * z, GY = v => gb - (gb - gt) * v;
  for (let i = 0; i < 40; i++) { g.fillStyle = rgb([52, 178, 166], i / 40); g.fillRect(gx, GY((i + 1) / 40), 22 * z, (gb - gt) / 40 + 1); }
  g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(gx, gt, 22 * z, gb - gt);
  g.fillStyle = INK; g.beginPath(); g.moveTo(gx - 3, GY(b)); g.lineTo(gx - 14, GY(b) - 7); g.lineTo(gx - 14, GY(b) + 7); g.fill();
  text(g, f2(b), gx - 16, GY(b) + 5, INK, 13, z, 700, 'right');
  $('cap2').textContent = `The triangle turns, so its normal n turns with it; the light L stays put. The whole triangle gets the one brightness worked out at the top. The main picture adds a small shiny highlight on top of this.`;
}

// ---------- step 3: from a triangle to pixels ----------
const GW = 22, GH = 13;
function ex3(sec) {
  const [g, w, h, z] = fig('ex3'), cell = Math.min((w - 20) / GW, (h - 70 * z) / GH), L = (w - cell * GW) / 2, T = 62 * z;
  const tri = [[2.2 + Math.sin(sec * 0.2), 1.6], [20.2, 4.4 + Math.sin(sec * 0.23)], [7.3, 11.7]];
  const inside = (x, y) => {
    const s = (p, q) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    const r = [s(tri[0], tri[1]), s(tri[1], tri[2]), s(tri[2], tri[0])];
    return r.map(v => v >= 0);
  };
  const order = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) order.push([x, y]);
  const k = Math.floor((sec * 28) % (order.length + 60));
  let filled = 0;
  for (let i = 0; i < order.length; i++) {
    const [x, y] = order[i], ok = inside(x + 0.5, y + 0.5).every(Boolean);
    if (i < k && ok) { filled++; g.fillStyle = '#5eb8ae'; g.fillRect(L + x * cell, T + y * cell, cell, cell); }
  }
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
  for (let x = 0; x <= GW; x++) { g.beginPath(); g.moveTo(L + x * cell, T); g.lineTo(L + x * cell, T + GH * cell); g.stroke(); }
  for (let y = 0; y <= GH; y++) { g.beginPath(); g.moveTo(L, T + y * cell); g.lineTo(L + GW * cell, T + y * cell); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); tri.forEach(([x, y], i) => (i ? g.lineTo(L + x * cell, T + y * cell) : g.moveTo(L + x * cell, T + y * cell))); g.closePath(); g.stroke();
  ['A', 'B', 'C'].forEach((nm, i) => text(g, nm, L + tri[i][0] * cell + (i === 1 ? 6 : -16), T + tri[i][1] * cell + (i === 2 ? 18 : -4), INK, 14, z, 700));
  if (k < order.length) {
    const [x, y] = order[k], r = inside(x + 0.5, y + 0.5), ok = r.every(Boolean);
    g.strokeStyle = ok ? TEAL : RED; g.lineWidth = 3; g.strokeRect(L + x * cell, T + y * cell, cell, cell);
    g.fillStyle = INK; g.beginPath(); g.arc(L + (x + 0.5) * cell, T + (y + 0.5) * cell, 3, 0, 7); g.fill();
    const mark = v => (v ? '✓' : '✗');
    tag(g, `pixel (${x}, ${y}): inside AB ${mark(r[0])} · inside BC ${mark(r[1])} · inside CA ${mark(r[2])} → ${ok ? 'paint it' : 'leave it'}`, 12, 22 * z, ok ? TEAL : RED, 13, z);
  } else tag(g, `done: ${filled} pixels have their centre inside all three edges`, 12, 22 * z, TEAL, 13, z);
  tag(g, `pixels painted so far: ${filled}`, 12, 44 * z, INK2, 13, z);
  $('cap3').textContent = 'Each square is one pixel, much enlarged. The scan tests each pixel\'s centre against the three edges, in reading order. A real graphics card tests millions of pixels at once.';
}

// ---------- step 4: halve the triangles' size, quarter the gap ----------
function ex4(sec) {
  const [g, w, h, z] = fig('ex4'), m = meshOf(0, level).m, th = 2 * Math.asin(m[5] / 2);
  const g1 = 1 - Math.cos(th / 2), g2 = 1 - Math.cos(th / 4), ph = (sec % 7) / 7;
  const f = chordBox(30, w - 30, 80 * z, h - 30 * z, th), c0 = Math.cos(f.half);
  arc(g, f, -f.half * 1.04, f.half * 1.04, INK, 2.5);
  const lift = ease((ph - 0.25) / 0.25), top = c0 + (1 - c0) * lift;   // the new middle corner rising onto the circle
  const pL = [-Math.sin(f.half), c0], pR = [Math.sin(f.half), c0], pM = [0, top];
  g.strokeStyle = ph < 0.25 ? RED : 'rgba(220,38,38,.25)'; g.lineWidth = ph < 0.25 ? 4 : 2; g.beginPath(); g.moveTo(f.X(pL[0]), f.Y(pL[1])); g.lineTo(f.X(pR[0]), f.Y(pR[1])); g.stroke();
  if (ph >= 0.25) { g.strokeStyle = TEAL; g.lineWidth = 4; g.beginPath(); g.moveTo(f.X(pL[0]), f.Y(pL[1])); g.lineTo(f.X(pM[0]), f.Y(pM[1])); g.lineTo(f.X(pR[0]), f.Y(pR[1])); g.stroke(); }
  for (const p of ph >= 0.25 ? [pL, pM, pR] : [pL, pR]) { g.fillStyle = INK; g.beginPath(); g.arc(f.X(p[0]), f.Y(p[1]), 5, 0, 7); g.fill(); }
  // the gap of the one chord, then of the two halves
  arrow(g, f.X(0), f.Y(c0), f.X(0), f.Y(1) + 2, RED, 2, 8);
  tag(g, `gap = 1 − cos(${fmt(deg(th / 2), 2)}°) = ${fmt(g1)}`, f.X(0) + 10, (f.Y(1) + f.Y(c0)) / 2 + 5, RED, 13, z);
  if (ph >= 0.5) {
    const q = th / 4, xm = Math.sin(q), ym = (c0 + 1) / 2, yc = Math.cos(q);   // middle of the right half and the circle above it
    arrow(g, f.X(xm), f.Y(ym), f.X(xm), f.Y(yc) + 2, TEAL, 2, 7);
    tag(g, `gap = 1 − cos(${fmt(deg(th / 4), 2)}°) = ${fmt(g2)}`, f.X(xm) + 10, f.Y(yc) - 6, TEAL, 13, z);
  }
  tag(g, `your ${big(m[0])} triangles: an edge spans θ = ${fmt(deg(th), 2)}° of the ball`, 12, 22 * z, INK, 13, z);
  tag(g, ph < 0.25 ? 'one edge: a straight chord under the circle' : ph < 0.5 ? 'cut the triangles into four: a new corner rises onto the circle' : `two chords of θ/2: the gap is ${(g1 / g2).toFixed(2)} times smaller`, 12, 44 * z, ph < 0.5 ? INK2 : TEAL, 13, z);
  $('cap4').textContent = `A slice through the ball${shape ? ' (the ball, as the doughnut and pebble are not round)' : ''} with ${big(m[0])} triangles. Heights above the chord are stretched ${Math.round(f.k)} times so the gaps can be seen; widths are true. The panel's "deepest gap", ${fmt(m[4])}, is in a triangle's middle, a little deeper than on its edge.`;
}

// ---------- step 5: add up the triangles for the area ----------
let areas5 = null, key5 = '', order5 = [], rank5 = [], lon5 = [];
function ex5(sec) {
  const [g, w, h, z] = fig('ex5'), l5 = Math.min(level, 2), mesh = meshOf(shape, l5), T = mesh.m[0], ex = exactOf(shape)[0];
  if (key5 !== shape + ':' + l5) {
    key5 = shape + ':' + l5; const { p, t } = mesh; areas5 = [];
    for (let i = 0; i < t.length; i += 3) {
      const P = j => [p[3 * t[j]], p[3 * t[j] + 1], p[3 * t[j] + 2]], A = P(i), B = P(i + 1), C = P(i + 2);
      areas5.push(Math.hypot(...cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]])) / 2);
      lon5.length = areas5.length; lon5[areas5.length - 1] = Math.atan2(A[2] + B[2] + C[2], A[0] + B[0] + C[0]);
    }
    // count them in order round the shape (by longitude), so the shape can turn to keep the next one in front
    order5 = areas5.map((_, i) => i).sort((a, b) => lon5[a] - lon5[b]);
    rank5 = []; order5.forEach((i, r) => { rank5[i] = r; });
  }
  const run = 9, cyc = sec % (run + 2.5), k = Math.min(T, Math.floor(T * cyc / run));
  const v = view(w * 0.7, h, shape), cur = order5[Math.min(k, T - 1)];
  // turn so the triangle being counted faces you: a point at longitude φ faces the camera when yaw = φ − 90°
  const yaw5 = (lon5[order5[0]] + (lon5[order5[T - 1]] - lon5[order5[0]]) * Math.min(1, cyc / run)) - Math.PI / 2;
  render(g, mesh, { ...v, f: v.f * 0.85, cx: w * 0.36, cy: h * 0.56, yaw: yaw5, pitch: SHAPES[shape].pitch, smooth: false, edges: true, lineWidth: 0.8,
    color: [214, 211, 205], faceColor: i => (rank5[i] < k ? SHAPES[shape].color : rank5[i] === k ? [250, 204, 21] : null) });
  let sum = 0; for (let r = 0; r < k; r++) sum += areas5[order5[r]];
  // the bar: the running total against the true area
  const bx = w - 70 * z, bt = 80 * z, bb = h - 24 * z, top = Math.max(ex, sum) * 1.05, BY = v2 => bb - (bb - bt) * v2 / top;
  g.fillStyle = rgb(SHAPES[shape].color); g.fillRect(bx, BY(sum), 30 * z, bb - BY(sum));
  g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(bx, bt, 30 * z, bb - bt);
  g.strokeStyle = INK; g.setLineDash([5, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 10, BY(ex)); g.lineTo(bx + 40 * z, BY(ex)); g.stroke(); g.setLineDash([]);
  text(g, 'true', bx - 12, BY(ex) - 6, INK, 12, z, 600, 'right'); text(g, fmt(ex), bx - 12, BY(ex) + 12 * z, INK, 12, z, 600, 'right');
  text(g, fmt(sum), bx + 15 * z, BY(sum) - 6, INK, 12, z, 700, 'center');
  if (k < T) tag(g, `triangle ${k + 1} of ${big(T)} (yellow): ½ × |AB × AC| = ${fmt(areas5[cur])}`, 12, 22 * z, '#a16207', 13, z);
  else tag(g, `all ${big(T)} triangles: ${fmt(sum)}, ${pct((ex - sum) / ex * 100)} short of the true ${fmt(ex)}`, 12, 22 * z, INK, 13, z);
  tag(g, `total so far: ${fmt(sum)}`, 12, 44 * z, INK2, 13, z);
  $('cap5').textContent = `Your ${SHAPES[shape].name}${l5 !== level ? ` with ${big(T)} triangles (you have ${big(meshOf(shape, level).m[0])} above; these are big enough to see)` : ` with your ${big(T)} triangles`}. Counted triangles turn coloured; the bar adds up their areas.`;
}

// ---------- step 6: smooth shading bends the light, not the surface ----------
let sh6 = null;   // null: switch by itself; 0 or 1: the reader picked
function ex6(sec) {
  const [g, w, h, z] = fig('ex6'), th = 2 * Math.asin(meshOf(0, level).m[5] / 2);
  const N = clamp(Math.round(2 * Math.PI / th / 2) * 2, 8, 28), mode = sh6 ?? (Math.floor(sec / 3.5) % 2);
  const cx = w / 2, cy = h * 0.74, R = Math.min(w * 0.34, h * 0.44), L2 = norm([LIGHT[0], LIGHT[1], 0]);
  const bright = nv => AMBIENT + DIFFUSE * Math.max(0, nv[0] * L2[0] + nv[1] * L2[1]);
  // corners on the circle, upper half; face normals; corner normals (average of the two faces)
  const ang = i => Math.PI * i / (N / 2), P = i => [Math.cos(ang(i)), Math.sin(ang(i))];
  const faceN = i => { const a = (ang(i) + ang(i + 1)) / 2; return [Math.cos(a), Math.sin(a)]; };
  const cornerN = i => norm([faceN(i - 1)[0] + faceN(i)[0], faceN(i - 1)[1] + faceN(i)[1], 0]);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.setLineDash([4, 4]); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, Math.PI, 2 * Math.PI); g.stroke(); g.setLineDash([]);
  const X = p => cx + p[0] * R, Y = p => cy - p[1] * R, band = 26 * z;
  const plot = [];
  for (let i = 0; i < N / 2; i++) {
    const a = P(i), b = P(i + 1), steps = 14;
    for (let j = 0; j < steps; j++) {
      const t0 = j / steps, t1 = (j + 1) / steps, tm = (t0 + t1) / 2;
      const nv = mode ? norm([cornerN(i)[0] * (1 - tm) + cornerN(i + 1)[0] * tm, cornerN(i)[1] * (1 - tm) + cornerN(i + 1)[1] * tm, 0]) : faceN(i);
      const s = bright(nv), fn = faceN(i);
      const q0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], q1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      g.fillStyle = g.strokeStyle = rgb([52, 178, 166], s); g.lineWidth = 1; g.beginPath();
      g.moveTo(X(q0), Y(q0)); g.lineTo(X(q1), Y(q1)); g.lineTo(X(q1) - fn[0] * band, Y(q1) + fn[1] * band); g.lineTo(X(q0) - fn[0] * band, Y(q0) + fn[1] * band); g.closePath(); g.fill(); g.stroke();
      plot.push([(i + tm) / (N / 2), s]);
    }
  }
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= N / 2; i++) { const p = P(i); i ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p)); } g.stroke();
  // the normals: one per face, or one per corner
  const len = 36 * z;
  if (!mode) for (let i = 0; i < N / 2; i++) { const a = P(i), b = P(i + 1), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = faceN(i); arrow(g, X(m), Y(m), X(m) + n[0] * len, Y(m) - n[1] * len, INK, 1.8, 7); }
  else for (let i = 0; i <= N / 2; i++) { const p = P(i), n = i === 0 || i === N / 2 ? [p[0], 0] : cornerN(i); arrow(g, X(p), Y(p), X(p) + n[0] * len, Y(p) - n[1] * len, BLUE, 1.8, 7); g.fillStyle = INK; g.beginPath(); g.arc(X(p), Y(p), 3.5, 0, 7); g.fill(); }
  arrow(g, w - 90 * z, 90 * z, w - 90 * z + L2[0] * 50 * z, 90 * z - L2[1] * 50 * z, ORANGE, 2.5); text(g, 'light', w - 90 * z + L2[0] * 50 * z - 4, 90 * z - L2[1] * 50 * z - 8, ORANGE, 12, z, 700, 'right');
  // brightness along the outline, left to right
  const gl = 20, gr = w - 20, gt2 = h - 50 * z, gb2 = h - 12 * z;
  g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.strokeRect(gl, gt2, gr - gl, gb2 - gt2);
  g.strokeStyle = mode ? BLUE : INK; g.lineWidth = 2; g.beginPath();
  plot.sort((a, b) => a[0] - b[0]).forEach(([u, s], i) => { const x = gr - (gr - gl) * u, y = gb2 - (gb2 - gt2) * clamp(s / 1.05); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  text(g, 'brightness along the outline', gl + 6, gt2 - 6, INK2, 12, z, 500);
  tag(g, mode ? 'smooth: each corner\'s normal is the average of its two faces\'; blend them across each face' : 'flat: one normal per face, so the brightness jumps at every corner', 12, 22 * z, mode ? BLUE : INK, 13, z);
  tag(g, `the outline still has ${N / 2} straight pieces either way`, 12, 44 * z, INK2, 13, z);
  for (const b of document.querySelectorAll('[data-sh]')) b.classList.toggle('on', +b.dataset.sh === mode);
  $('cap6').textContent = `A slice through the ball's mesh: ${N} pieces round the circle${N !== Math.round(2 * Math.PI / th) ? ` (about ${Math.round(2 * Math.PI / th)} with your ${big(meshOf(0, level).m[0])} triangles; capped so you can see them)` : ''}. The coloured band is the brightness each part of the outline gets.`;
}
for (const b of document.querySelectorAll('[data-sh]')) b.addEventListener('click', () => { sh6 = +b.dataset.sh; });

// ---------- drawing only what is on screen ----------
const onScreen = new Set();
const io = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? onScreen.add(e.target.id) : onScreen.delete(e.target.id); }, { rootMargin: '80px' });
for (const id of ['stage', 'ideaCv', 'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6']) io.observe($(id));
const FIGS = { ex1, ex2, ex3, ex4, ex5, ex6 };
let last = 0, lastFigs = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
  if (document.hidden) return;
  if (spinning && !drag) { yaw += dt * 0.45; dirty = true; }
  if (dirty && onScreen.has('stage')) { dirty = false; drawStage(); }
  if (now - lastFigs < 33) return;   // the step figures at 30 frames a second
  lastFigs = now;
  const sec = still ? 30 : now / 1000;
  for (const id in FIGS) if (onScreen.has(id)) FIGS[id](sec);
}

// ---------- Try this ----------
function setup(s, l, sm, ed) {
  setShape(s); setLevel(l);
  smooth = sm; $('shading').value = sm ? '1' : '0';
  edges = ed; $('edges').checked = ed;
  readout();
}
const TRY = [
  () => setup(0, 0, false, true),
  () => setup(0, 0, true, false),
  () => setup(0, 3, false, false),
  () => setup(1, 2, false, true),
  () => { setup(0, 0, false, false); let l = 0; const t = setInterval(() => { if (++l > 5) return clearInterval(t); setLevel(l); }, still ? 0 : 1400); },
];
for (const btn of document.querySelectorAll('[data-try]')) btn.addEventListener('click', () => { TRY[+btn.dataset.try](); $('play').scrollIntoView({ behavior: still ? 'auto' : 'smooth' }); });

setSpin(spinning); setShape(0); setLevel(2);
idea();
for (const id in FIGS) FIGS[id](still ? 30 : 0);
drawStage();
requestAnimationFrame(frame);
new ResizeObserver(() => { idea(); readout(); }).observe(cv);

// Together (together/share.js): the shape, the number of triangles, the shading and the edges are
// controls; the way the shape is turned and the circle's number of pieces live here
share(() => ({ view: [yaw, pitch], n: ideaN }), s => {
  const v = nums(s?.view, 2);
  if (v && v.length === 2) { yaw = v[0] % (2 * Math.PI); pitch = clamp(v[1], -1.3, 1.3); dirty = true; }
  if (Number.isInteger(s?.n) && s.n >= 3 && s.n <= 96) { ideaN = s.n; $('ideaN').value = ideaN; idea(); }
  shape = clamp(+$('shape').value | 0, 0, 2); level = clamp(+$('lvl').value | 0, 0, 5);
  smooth = $('shading').value === '1'; edges = $('edges').checked;
  readout();
});
