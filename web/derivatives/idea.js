// The idea on one curve, y = x·x: its slope at a point (rise over run, the run shrinking) and the area
// under it (thin rectangles, getting thinner). Maths: pkg/lilavati.js (motion.rs): square_secant_slope
// and square_left_sum. The two sliders are inside <main>, so Together shares them; nothing else is state.
import init, { square_secant_slope, square_left_sum } from '../pkg/lilavati.js';

const $ = id => document.getElementById(id);
const cv = $('ideaCanvas'), c = cv.getContext('2d');
const INK = '#1c1917', INK2 = '#57534e', CURVE = '#1d4ed8', RED = '#dc2626', GREEN = '#16a34a', ORANGE = '#ea580c';
const XMAX = 3.6, YMAX = 13;
const f = x => x * x;
const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

const pointX = () => Math.min(2.5, Math.max(0.2, +$('ideaX').value || 2));
const stepH = () => Math.min(1, Math.max(0.05, +$('ideaH').value || 0.5));
const rects = (x, h) => Math.max(1, Math.round(x / h));

// side by side on a wide screen, one above the other on a phone
let wide = null;
function layout() {
  const w = cv.clientWidth || 900, nowWide = w >= 620;
  if (nowWide !== wide) { wide = nowWide; cv.width = wide ? 900 : 480; cv.height = wide ? 400 : 760; }
}

function panel(px, py, pw, ph, z, title) {
  const L = 34 * z, B = 24 * z, T = 30 * z, R = 10;
  const box = { x0: px + L, x1: px + pw - R, y0: py + ph - B, y1: py + T };
  box.X = x => box.x0 + (box.x1 - box.x0) * x / XMAX;
  box.Y = y => box.y0 - (box.y0 - box.y1) * y / YMAX;
  const fs = v => Math.round(v * z) + 'px';
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.beginPath();
  c.moveTo(box.x0, box.y1); c.lineTo(box.x0, box.y0); c.lineTo(box.x1, box.y0); c.stroke();
  c.fillStyle = INK2; c.font = `${fs(12)} system-ui`; c.textAlign = 'center';
  for (const x of [0, 1, 2, 3]) c.fillText(String(x), box.X(x), box.y0 + 15 * z);
  c.textAlign = 'right';
  for (const y of [0, 4, 8, 12]) c.fillText(String(y), box.x0 - 6, box.Y(y) + 4 * z);
  c.textAlign = 'left'; c.fillStyle = INK; c.font = `600 ${fs(14)} system-ui`; c.fillText(title, px + 8, py + 18 * z);
  return box;
}

function curve(box, x0, x1) {
  c.strokeStyle = CURVE; c.lineWidth = 2.5; c.beginPath();
  for (let i = 0; i <= 200; i++) { const x = x0 + (x1 - x0) * i / 200, y = Math.min(f(x), YMAX); i ? c.lineTo(box.X(x), box.Y(y)) : c.moveTo(box.X(x), box.Y(y)); }
  c.stroke();
}
function dot(x, y, col, r = 5) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function label(text, x, y, col, z, align = 'left', weight = 600) {
  c.font = `${weight} ${Math.round(12.5 * z)}px system-ui`; c.textAlign = align;
  const w = c.measureText(text).width, pad = 3, h = 15 * z;
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  c.fillStyle = 'rgba(255,255,255,.88)'; c.fillRect(lx - pad, y - h + 3 * z, w + 2 * pad, h + 2);
  c.fillStyle = col; c.fillText(text, x, y); c.textAlign = 'left';
}

function draw() {
  layout();
  const W = cv.width, H = cv.height;
  // on a small screen the canvas is shrunk, so the writing is made bigger to stay readable
  const z = Math.min(2.2, Math.max(1, 0.8 * W / (cv.clientWidth || W)));
  const x = pointX(), h = stepH(), n = rects(x, h), w = x / n;
  c.clearRect(0, 0, W, H);
  const [A, Bp] = wide ? [[0, 0, W / 2, H], [W / 2, 0, W / 2, H]] : [[0, 0, W, H / 2], [0, H / 2, W, H / 2]];

  // 1. the slope: the line through the point and a point h further on
  const a = panel(...A, z, 'Slope at the point: rise ÷ run');
  const xq = x + h, s = square_secant_slope(x, h), t = 2 * x;
  c.save(); c.beginPath(); c.rect(a.x0, a.y1, a.x1 - a.x0, a.y0 - a.y1); c.clip();
  c.setLineDash([6, 5]); c.strokeStyle = GREEN; c.lineWidth = 1.5; c.beginPath();
  c.moveTo(a.X(0), a.Y(f(x) - t * x)); c.lineTo(a.X(XMAX), a.Y(f(x) + t * (XMAX - x))); c.stroke(); c.setLineDash([]);
  c.strokeStyle = RED; c.lineWidth = 2; c.beginPath();
  c.moveTo(a.X(0), a.Y(f(x) - s * x)); c.lineTo(a.X(XMAX), a.Y(f(x) + s * (XMAX - x))); c.stroke();
  c.restore();
  curve(a, 0, XMAX);
  // run and rise
  c.strokeStyle = ORANGE; c.lineWidth = 2.5; c.beginPath();
  c.moveTo(a.X(x), a.Y(f(x))); c.lineTo(a.X(xq), a.Y(f(x))); c.lineTo(a.X(xq), a.Y(f(xq))); c.stroke();
  dot(a.X(x), a.Y(f(x)), INK); dot(a.X(xq), a.Y(f(xq)), RED, 4);
  label(`run h = ${f2(h)}`, (a.X(x) + a.X(xq)) / 2, a.Y(f(x)) + 17 * z, ORANGE, z, 'center');
  label(`rise = ${f2(f(xq) - f(x))}`, a.X(xq) + 6, (a.Y(f(x)) + a.Y(f(xq))) / 2 + 5 * z, ORANGE, z);
  label(`red: rise ÷ run = ${f2(s)}`, a.x0 + 8, a.y1 + 16 * z, RED, z);
  label(`green, dashed: slope at the point = ${f2(t)}`, a.x0 + 8, a.y1 + 34 * z, GREEN, z);

  // 2. the area: n rectangles from 0 to x under the curve
  const b = panel(...Bp, z, 'Area under the curve, from 0 to the point');
  c.fillStyle = 'rgba(29,78,216,.12)'; c.beginPath(); c.moveTo(b.X(0), b.Y(0));
  for (let i = 0; i <= 100; i++) { const u = x * i / 100; c.lineTo(b.X(u), b.Y(f(u))); }
  c.lineTo(b.X(x), b.Y(0)); c.closePath(); c.fill();
  for (let i = 0; i < n; i++) {
    const l = i * w, top = f(l);
    c.fillStyle = 'rgba(234,88,12,.35)'; c.strokeStyle = ORANGE; c.lineWidth = 1;
    c.fillRect(b.X(l), b.Y(top), b.X(l + w) - b.X(l), b.Y(0) - b.Y(top));
    c.strokeRect(b.X(l), b.Y(top), b.X(l + w) - b.X(l), b.Y(0) - b.Y(top));
  }
  curve(b, 0, XMAX);
  c.strokeStyle = INK; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(b.X(x), b.Y(0)); c.lineTo(b.X(x), b.Y(f(x))); c.stroke(); c.setLineDash([]);
  dot(b.X(x), b.Y(f(x)), INK);
  label(`orange: ${n} rectangle${n > 1 ? 's' : ''}, area ${f2(square_left_sum(x, n))}`, b.x0 + 8, b.y1 + 16 * z, ORANGE, z);
  label(`blue: area under the curve = ${f2(x * x * x / 3)}`, b.x0 + 8, b.y1 + 34 * z, CURVE, z);
}

function words() {
  const x = pointX(), h = stepH(), n = rects(x, h), w = x / n, xq = x + h;
  $('ideaXVal').textContent = f2(x); $('ideaHVal').textContent = f2(h);
  $('ideaSlope').textContent = `rise ÷ run = (${f2(xq)}·${f2(xq)} − ${f2(x)}·${f2(x)}) ÷ ${f2(h)} = (${f2(xq * xq)} − ${f2(x * x)}) ÷ ${f2(h)} = ${f2(square_secant_slope(x, h))}   →   slope at x = ${f2(x)}: ${f2(2 * x)}`;
  const parts = Array.from({ length: Math.min(n, 4) }, (_, i) => `${f2(i * w)}·${f2(i * w)}`).join(' + ');
  $('ideaArea').textContent = `area ≈ ${f2(w)} · (${parts}${n > 4 ? ' + …' : ''}) = ${f2(square_left_sum(x, n))}   →   exact area: ${f2(x * x * x / 3)}`;
  $('ideaCap').textContent = `y = x·x at x = ${f2(x)} (height ${f2(x * x)}), with a step of h = ${f2(h)}. ${wide ? 'Left' : 'Top'}: the line through the point and a point h further on. ${wide ? 'Right' : 'Bottom'}: ${n} rectangle${n > 1 ? 's' : ''}, each ${f2(w)} wide and as tall as the curve at its left edge.`;
  $('ideaSay').textContent = h <= 0.1
    ? `With a step this small both numbers are close to the exact ones: the slope at x is 2·x (two times x) and the area from 0 to x is x·x·x ÷ 3. Those two answers are the derivative and the integral of x·x.`
    : `Make the step h smaller. The red line swings onto the dashed green one, and the rectangles fill the blue area: both numbers settle on the exact ones.`;
}

await init();
const update = () => { draw(); words(); };
$('ideaX').addEventListener('input', update);
$('ideaH').addEventListener('input', update);
new ResizeObserver(update).observe(cv);
update();
