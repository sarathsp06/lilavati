// The idea on two slow waves: at one moment, the height of A plus the height of B is the height of the sum.
// Drag the moment along and the sum is built point by point. Maths: pkg/lilavati.js (waves.rs): heights_at.
// The controls are inside <main>, so Together shares them; nothing else is state.
import init, { heights_at } from '../pkg/lilavati.js';

const $ = id => document.getElementById(id);
const cv = $('ideaCanvas'), c = cv.getContext('2d');
const INK = '#1c1917', INK2 = '#57534e', A = '#2563eb', B = '#ea580c';
const LAPS = 2;
const SPEED = ['', 'as fast as A', 'twice as fast as A', 'three times as fast as A'];
const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2).replace('-', '−');
const signed = v => (v < -0.005 ? `(${f2(v)})` : f2(v));

const speed = () => Math.min(3, Math.max(1, +$('ideaSpeed').value | 0));
const shift = () => Math.min(360, Math.max(0, +$('ideaShift').value || 0));
const moment = () => Math.min(100, Math.max(0, +$('ideaT').value || 0)) / 100 * LAPS;
const at = t => heights_at([1, speed()], [1, 1], [0, shift() * Math.PI / 180], t);

let wide = null;
function layout() {
  const nowWide = (cv.clientWidth || 900) >= 620;
  if (nowWide !== wide) { wide = nowWide; cv.width = wide ? 900 : 480; cv.height = wide ? 430 : 560; }
}

function arrow(x, y0, y1, col, w = 3) {
  if (Math.abs(y1 - y0) < 1) return;
  const d = Math.sign(y1 - y0), head = Math.min(8, Math.abs(y1 - y0));
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1 - d * head); c.stroke();
  c.beginPath(); c.moveTo(x, y1); c.lineTo(x - 5, y1 - d * head); c.lineTo(x + 5, y1 - d * head); c.closePath(); c.fill();
}
function tag(text, x, y, col, z, align = 'left') {
  c.font = `600 ${Math.round(13 * z)}px system-ui`; c.textAlign = align;
  const w = c.measureText(text).width, lx = align === 'right' ? x - w : x;
  c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(lx - 3, y - 13 * z, w + 6, 17 * z);
  c.fillStyle = col; c.fillText(text, x, y); c.textAlign = 'left';
}

function draw() {
  layout();
  const W = cv.width, H = cv.height;
  // on a small screen the canvas is shrunk, so the writing is made bigger to stay readable
  const z = Math.min(2.2, Math.max(1, 0.8 * W / (cv.clientWidth || W)));
  const x0 = 64 * z, x1 = W - 14, top = 10, u = (H - top - 20) / 9.6;   // u: one unit of height
  const rows = [{ name: 'A', mid: top + 1.2 * u, col: A }, { name: 'B', mid: top + 3.8 * u, col: B }, { name: 'A + B', mid: top + 7.2 * u, col: INK }];
  const X = t => x0 + (x1 - x0) * t / LAPS, now = moment(), here = at(now);
  c.clearRect(0, 0, W, H);
  // rows: the zero line, a name, and the scale
  for (const r of rows) {
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, r.mid); c.lineTo(x1, r.mid); c.stroke();
    c.fillStyle = r.col; c.font = `700 ${Math.round(15 * z)}px system-ui`; c.textAlign = 'right'; c.fillText(r.name, x0 - 12, r.mid + 5 * z);
  }
  c.strokeStyle = 'rgba(0,0,0,.08)'; c.setLineDash([3, 4]);
  for (const v of [-2, -1, 1, 2]) { c.beginPath(); c.moveTo(x0, rows[2].mid - v * u); c.lineTo(x1, rows[2].mid - v * u); c.stroke(); }
  c.setLineDash([]);
  c.fillStyle = INK2; c.font = `${Math.round(11 * z)}px system-ui`; c.textAlign = 'right';
  for (const v of [-2, 2]) c.fillText(String(v), x0 - 12, rows[2].mid - v * u + 4 * z);
  c.textAlign = 'left';
  // the two waves in full, the sum only up to the moment: it is built point by point
  const N = 400;
  for (const [k, r, until] of [[0, rows[0], LAPS], [1, rows[1], LAPS], [2, rows[2], now]]) {
    c.strokeStyle = r.col; c.lineWidth = k === 2 ? 3 : 2; c.beginPath();
    const m = Math.max(1, Math.round(N * until / LAPS));
    for (let i = 0; i <= m; i++) { const t = until * i / m, y = r.mid - u * at(t)[k]; i ? c.lineTo(X(t), y) : c.moveTo(X(t), y); }
    c.stroke();
  }
  // the moment: one height from A, one from B, stacked
  const xm = X(now);
  c.strokeStyle = 'rgba(28,25,23,.35)'; c.lineWidth = 1; c.setLineDash([4, 4]);
  c.beginPath(); c.moveTo(xm, top); c.lineTo(xm, H - 6); c.stroke(); c.setLineDash([]);
  arrow(xm, rows[0].mid, rows[0].mid - u * here[0], A);
  arrow(xm, rows[1].mid, rows[1].mid - u * here[1], B);
  const s0 = rows[2].mid, s1 = s0 - u * here[0], s2 = s1 - u * here[1];
  arrow(xm - 6, s0, s1, A); arrow(xm + 6, s1, s2, B);
  c.strokeStyle = INK2; c.lineWidth = 1; c.beginPath(); c.moveTo(xm - 6, s1); c.lineTo(xm + 6, s1); c.stroke();
  c.fillStyle = INK; c.beginPath(); c.arc(xm, s2, 5.5, 0, 7); c.fill();
  const right = xm < (x0 + x1) / 2, side = right ? xm + 12 : xm - 12, al = right ? 'left' : 'right';
  tag(`A = ${f2(here[0])}`, side, rows[0].mid - u * here[0] / 2 + 5, A, z, al);
  tag(`B = ${f2(here[1])}`, side, rows[1].mid - u * here[1] / 2 + 5, B, z, al);
  tag(`A + B = ${f2(here[2])}`, side, s2 + (here[2] >= 0 ? -6 : 18 * z), INK, z, al);
}

function words() {
  const k = speed(), sh = shift(), now = moment(), here = at(now);
  $('ideaShiftVal').textContent = `${sh}°`; $('ideaTVal').textContent = `${f2(now)} laps`;
  $('ideaWaves').textContent = `A = sin(360°·t);  B = sin(360°·${k}·t${sh ? ` + ${sh}°` : ''});  t = ${f2(now)} laps`;
  $('ideaFormula').textContent = `at this moment: A + B = ${f2(here[0])} + ${signed(here[1])} = ${f2(here[2])}`;
  let say;
  if (k === 1 && sh === 180) say = 'B is A upside down, its mirror image. At every moment the two heights are equal and opposite, so the sum is 0 everywhere: the waves cancel. For sound that is silence.';
  else if (k === 1 && (sh === 0 || sh === 360)) say = 'B is exactly A. At every moment the two heights are the same, so the sum is twice as tall: the waves reinforce each other.';
  else if (k === 1) say = 'Same speed, shifted: the sum is again a smooth wave of the same speed, somewhere between twice as tall (shift 0°) and nothing (shift 180°).';
  else say = `B goes up and down ${k === 2 ? 'twice' : 'three times'} for each time A does. The sum is no longer a plain wave: it has a shape of its own, and the shift changes that shape.`;
  $('ideaSay').textContent = say;
  $('ideaCap').textContent = `A (blue) and B (orange, ${SPEED[k]}, shifted ${sh}°), and their sum (black) drawn up to the moment t = ${f2(now)}. At the dashed line, B's height is stacked on top of A's.`;
}

await init();
const update = () => { draw(); words(); };
for (const id of ['ideaSpeed', 'ideaShift', 'ideaT']) $(id).addEventListener('input', update);
$('ideaSpeed').addEventListener('change', update);
const set = (sp, sh) => { $('ideaSpeed').value = sp; $('ideaShift').value = sh; update(); };
$('ideaCancel').addEventListener('click', () => set(1, 180));
$('ideaDouble').addEventListener('click', () => set(1, 0));
new ResizeObserver(update).observe(cv);
update();
