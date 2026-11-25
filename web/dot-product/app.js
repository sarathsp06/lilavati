// Vectors and the dot product: two arrows you drag, their dot product, angle, shadow and length
// (three norms), and a one-neuron classifier you can train. Maths: pkg/lilavati.js (linalg).
import init, { dot, cosine } from '../pkg/lilavati.js';
import { Plane, COL, fmt, vec } from '../la.js';

await init();
const $ = id => document.getElementById(id);
const F = (...v) => new Float64Array(v);
const P = new Plane($('plane'), 4);
let a = [3, 1], b = [1, 2], mode = 'arrows', norm = '2';
let w = [1, -1], bias = 0.5, learning = null;

const PAIRS = [['Pointing roughly the same way', [3, 1], [2, 2]], ['At right angles', [3, 1], [-1, 3]], ['Opposite', [2, 1], [-2.4, -1.2]], ['Same direction, twice as long', [1.5, 1], [3, 2]]];
PAIRS.forEach(([n], k) => $('pairs').append(new Option(n, k)));
$('pairs').append(Object.assign(new Option('Your own', 'own'), { disabled: true }));
$('pairs').addEventListener('change', () => { if ($('pairs').value === 'own') return; [, a, b] = PAIRS[+$('pairs').value]; a = [...a]; b = [...b]; draw(); });
$('norm').addEventListener('change', e => { norm = e.target.value; draw(); });
$('mode').addEventListener('change', e => { mode = e.target.value; $('arrowsBox').hidden = mode !== 'arrows'; $('neuronBox').hidden = mode !== 'neuron'; draw(); });
$('bias').addEventListener('input', e => { bias = +e.target.value; draw(); });

P.handle(() => (mode === 'arrows' ? a : [NaN, NaN]), (x, y) => { a = [x, y]; $('pairs').value = 'own'; draw(); })
 .handle(() => (mode === 'arrows' ? b : [NaN, NaN]), (x, y) => { b = [x, y]; $('pairs').value = 'own'; draw(); })
 .handle(() => (mode === 'neuron' ? w : [NaN, NaN]), (x, y) => { w = [x, y]; draw(); });

const len = (v, n = norm) => (n === '1' ? Math.abs(v[0]) + Math.abs(v[1]) : n === 'inf' ? Math.max(Math.abs(v[0]), Math.abs(v[1])) : Math.hypot(...v));
// the outline of all arrows with length r in a norm
function ball(p, r, n, color) {
  const pts = n === '1' ? [r, 0, 0, r, -r, 0, 0, -r] : n === 'inf' ? [r, r, -r, r, -r, -r, r, -r] : null;
  if (pts) p.poly(pts, undefined, null, color, 2); else p.poly(Array.from({ length: 96 }, (_, k) => [r * Math.cos(k * Math.PI / 48), r * Math.sin(k * Math.PI / 48)]).flat(), undefined, null, color, 2);
}
const deg = v => (v * 180 / Math.PI).toFixed(0);

// ---------- the neuron: two kinds of points, a line that sorts them ----------
let pts = [];
function newPoints(seed = 1) {
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const dir = rnd() * Math.PI * 2, nx = Math.cos(dir), ny = Math.sin(dir), off = (rnd() - 0.5) * 1.2;
  pts = [];
  while (pts.length < 18) { const x = (rnd() - 0.5) * 6.6, y = (rnd() - 0.5) * 6.6, side = x * nx + y * ny + off; if (Math.abs(side) > 0.5) pts.push([x, y, side > 0 ? 1 : -1]); }
}
newPoints(3);
const says = p => w[0] * p[0] + w[1] * p[1] + bias;
const correct = () => pts.filter(p => Math.sign(says(p)) === p[2]).length;
$('shuffle').addEventListener('click', () => { newPoints(Math.floor(Math.random() * 1000) + 2); draw(); });
// the perceptron rule: for a wrong point, w += label · x and b += label (scaled down so you can watch)
$('learn').addEventListener('click', () => {
  if (learning) { clearInterval(learning); learning = null; $('learn').textContent = 'Let it learn'; return; }
  $('learn').textContent = 'Stop'; let k = 0, n = 0;
  learning = setInterval(() => {
    const wrong = pts.filter(p => Math.sign(says(p)) !== p[2]);
    if (!wrong.length || n > 400) { clearInterval(learning); learning = null; $('learn').textContent = 'Let it learn'; draw(); return; }
    const p = wrong[k++ % wrong.length]; n++;
    w = [w[0] + 0.3 * p[2] * p[0], w[1] + 0.3 * p[2] * p[1]]; bias = Math.max(-6, Math.min(6, bias + 0.3 * p[2]));
    const m = Math.hypot(...w); if (m > 3.8) w = w.map(v => v * 3.8 / m);
    $('bias').value = bias; draw(p);
  }, 160);
});

function neuronShade(p, ww, bb, alpha = 0.10) {
  const { c } = p, [l, t, W] = p.box, step = W / 60;
  for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
    const x = (l + (i + 0.5) * step - l - W / 2) / p.s, y = (t + W / 2 - (t + (j + 0.5) * step)) / p.s;
    c.fillStyle = ww[0] * x + ww[1] * y + bb > 0 ? `rgba(37,99,235,${alpha})` : `rgba(234,88,12,${alpha * 0.7})`;
    c.fillRect(l + i * step, t + j * step, step + .5, step + .5);
  }
  // the line w·x + b = 0
  const n2 = ww[0] ** 2 + ww[1] ** 2;
  if (n2 > 1e-9) { const px = -bb * ww[0] / n2, py = -bb * ww[1] / n2, dx = -ww[1], dy = ww[0], k = 20 / Math.sqrt(n2); p.line(px - dx * k, py - dy * k, px + dx * k, py + dy * k, '#111', 2.5); }
}
function points(p, hit) {
  for (const q of pts) {
    const ok = Math.sign(says(q)) === q[2];
    if (q[2] > 0) p.dot(q[0], q[1], 8, '#2563eb'); else { const [x, y] = p.P(q[0], q[1]); p.c.fillStyle = '#ea580c'; p.c.fillRect(x - 8, y - 8, 16, 16); }
    if (!ok) p.ring(q[0], q[1], 14, '#dc2626');
    if (hit === q) p.ring(q[0], q[1], 20, '#111');
  }
}

function draw(hit) {
  P.clear().grid(undefined, 'rgba(0,0,0,.07)').axes();
  if (mode === 'arrows') {
    const d = dot(F(...a), F(...b)), aa = a[0] ** 2 + a[1] ** 2, k = aa > 1e-9 ? d / aa : 0, pr = [a[0] * k, a[1] * k];
    ball(P, len(a), norm, 'rgba(245,158,11,.55)');
    P.through(a[0], a[1], 'rgba(245,158,11,.25)', 1.5);
    P.line(b[0], b[1], pr[0], pr[1], '#888', 1.5, [6, 6]);
    P.line(0, 0, pr[0], pr[1], d >= 0 ? 'rgba(22,163,74,.75)' : 'rgba(220,38,38,.75)', 9);
    // the angle between them
    const ta = Math.atan2(a[1], a[0]), tb = Math.atan2(b[1], b[0]), [ox, oy] = P.P(0, 0);
    let dt = tb - ta; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
    P.c.strokeStyle = '#555'; P.c.lineWidth = 2; P.c.beginPath(); P.c.arc(ox, oy, 46, -ta, -(ta + dt), dt > 0); P.c.stroke();
    P.arrow(a[0], a[1], COL.v, { label: 'a' }).arrow(b[0], b[1], COL.w, { label: 'b' });
    P.dot(a[0], a[1], 7, COL.v).dot(b[0], b[1], 7, COL.w);
    const cs = cosine(F(...a), F(...b)), ang = Math.acos(Math.max(-1, Math.min(1, cs)));
    const nm = norm === '1' ? '‖a‖₁' : norm === 'inf' ? '‖a‖∞' : '|a|';
    $('say').innerHTML = `a·b = ${fmt(a[0], 1)}×${fmt(b[0], 1)} + ${fmt(a[1], 1)}×${fmt(b[1], 1)} = <b>${fmt(d)}</b> · angle <b>${deg(ang)}°</b> · cos θ = <b>${fmt(cs)}</b> · ${nm} = <b>${fmt(len(a))}</b>, |b| = <b>${fmt(Math.hypot(...b))}</b>`;
  } else {
    neuronShade(P, w, bias); points(P, hit);
    P.arrow(w[0], w[1], COL.w, { label: 'w' }).dot(w[0], w[1], 7, COL.w);
    $('bVal').textContent = fmt(bias, 1);
    $('say').innerHTML = `The neuron says <b>yes</b> (blue side) when w·x + b = ${fmt(w[0], 1)}·x + ${fmt(w[1], 1)}·y + ${fmt(bias, 1)} &gt; 0. Sorted right: <b>${correct()} of ${pts.length}</b>.`;
  }
  explain();
}

// ---------- the step-by-step figures ----------
function fig(id, range = 4) { const cv = $(id), p = new Plane(cv, range, [(cv.width - cv.height) / 2, 0, cv.height]); p.c.clearRect(0, 0, cv.width, cv.height); return p; }
const WORDS = [['cat', 3, 1.2], ['kitten', 3.2, 0.6], ['dog', 2.8, 1.8], ['puppy', 2.5, 2.3], ['car', -1.4, 3], ['truck', -2, 2.5], ['bicycle', -0.6, 3.2], ['banana', -2.8, -1.4], ['apple', -2.4, -2.1]];
function explain() {
  { const p = fig('ex1'); p.grid(undefined, 'rgba(0,0,0,.07)').axes();
    p.line(0, 0, a[0], 0, COL.i, 4, [8, 6]).line(a[0], 0, a[0], a[1], COL.j, 4, [8, 6]).arrow(a[0], a[1], COL.v, { label: `a = ${vec(a[0], a[1], 1)}` });
    $('cap1').textContent = `Your arrow a: ${fmt(a[0], 1)} across, then ${fmt(a[1], 1)} up. As a list: [${fmt(a[0], 1)}, ${fmt(a[1], 1)}].`; }
  { const p = fig('ex2', 4.5); p.grid(undefined, 'rgba(0,0,0,.06)').axes();
    const r1 = len(a, '1'), r2 = len(a, '2'), ri = len(a, 'inf');
    ball(p, 1, '2', '#2563eb'); ball(p, 1, '1', '#16a34a'); ball(p, 1, 'inf', '#dc2626');
    p.arrow(a[0], a[1], COL.v, { label: 'a' });
    p.text(`L² (circle): ${fmt(r2)}`, 12, 26, '#2563eb').text(`L¹ (diamond): ${fmt(r1)}`, 12, 52, '#16a34a').text(`L∞ (square): ${fmt(ri)}`, 12, 78, '#dc2626'); }
  { const cv = $('ex3'), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    const cells = [['a', a, COL.v], ['b', b, COL.w]], x0 = 70, cw = 130;
    c.font = '600 22px system-ui';
    cells.forEach(([n, v, col], r) => { c.fillStyle = col; c.fillText(n, 30, 90 + r * 70); v.forEach((x, k) => { c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(x0 + k * cw, 58 + r * 70, cw - 20, 48); c.fillText(fmt(x, 1), x0 + k * cw + 30, 90 + r * 70); }); });
    c.fillStyle = '#333'; c.fillText('×', x0 + 45, 254); c.fillText('×', x0 + cw + 45, 254);
    const pr = [a[0] * b[0], a[1] * b[1]];
    pr.forEach((x, k) => { c.strokeStyle = '#333'; c.strokeRect(x0 + k * cw, 270, cw - 20, 48); c.fillText(fmt(x), x0 + k * cw + 20, 302); });
    c.fillText('+', x0 + cw - 16, 302);
    c.font = '700 26px system-ui'; c.fillStyle = '#111'; c.fillText(`a·b = ${fmt(pr[0])} + ${fmt(pr[1])} = ${fmt(pr[0] + pr[1])}`, 40, 380); }
  { const p = fig('ex4'); p.axes('rgba(0,0,0,.2)'); const ua = Math.hypot(...a) || 1;
    for (let k = 0; k < 48; k++) { const t = 2 * Math.PI * k / 48, x = 3.2 * Math.cos(t), y = 3.2 * Math.sin(t), cs = (a[0] * x + a[1] * y) / (ua * 3.2);
      const col = cs > 0.05 ? `rgba(22,163,74,${0.25 + 0.75 * cs})` : cs < -0.05 ? `rgba(220,38,38,${0.25 - 0.75 * cs})` : '#999'; p.arrow(x, y, col, { width: 2.5, head: 9 }); }
    p.arrow(a[0] * 2 / ua, a[1] * 2 / ua, COL.v, { width: 5, label: 'a' });
    const cs = cosine(F(...a), F(...b)), t = Math.atan2(b[1], b[0]); p.arrow(3.6 * Math.cos(t), 3.6 * Math.sin(t), COL.w, { width: 4, label: `b: ${fmt(cs)}` }); }
  { const p = fig('ex5'); p.grid(undefined, 'rgba(0,0,0,.06)').axes();
    const cat = F(3, 1.2);
    for (const [wd, x, y] of WORDS) { p.arrow(x, y, wd === 'cat' ? COL.v : 'rgba(79,70,229,.6)', { width: 2.5, head: 10 }); p.label(`${wd} ${wd === 'cat' ? '' : fmt(cosine(cat, F(x, y)))}`, x, y, wd === 'cat' ? '#b45309' : '#3730a3', 19); } }
  { const p = fig('ex6'); neuronShade(p, w, bias, 0.14); p.axes('rgba(0,0,0,.25)'); points(p); p.arrow(w[0], w[1], COL.w, { label: 'w' });
    $('cap6').textContent = `The neuron from above: w = ${vec(w[0], w[1], 1)}, b = ${fmt(bias, 1)}. Blue side: yes. ${correct()} of ${pts.length} points sorted right. Switch the toy to "A neuron" to change it.`; }
}

const TRY = [
  () => { $('mode').value = 'arrows'; $('mode').dispatchEvent(new Event('change')); $('pairs').value = 1; $('pairs').dispatchEvent(new Event('change')); },
  () => { $('mode').value = 'arrows'; $('mode').dispatchEvent(new Event('change')); a = [3, 0]; b = [2, 0.3]; $('pairs').value = 'own'; let t = 0.15; const id = setInterval(() => { t += 0.08; b = [2.5 * Math.cos(t), 2.5 * Math.sin(t)]; draw(); if (t > 2 * Math.PI) clearInterval(id); }, 60); },
  () => { $('mode').value = 'arrows'; $('mode').dispatchEvent(new Event('change')); $('pairs').value = 3; $('pairs').dispatchEvent(new Event('change')); },
  () => { $('mode').value = 'neuron'; $('mode').dispatchEvent(new Event('change')); w = [1, -1]; bias = 0.5; $('bias').value = bias; draw(); $('learn').click(); },
];
for (const btn of document.querySelectorAll('[data-try]')) btn.addEventListener('click', () => { TRY[+btn.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });
$('pairs').value = 0;
draw();
