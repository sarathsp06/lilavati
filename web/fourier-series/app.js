// The Fourier series page: a canvas you draw on, the Rust/WebAssembly series (pkg/circles.js), the spinning circles
// that redraw the shape, and the equations with copy buttons. No framework; Pico CSS for the look.
import init, { Fourier } from '../pkg/lilavati.js';

const canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const MAX_TERMS = 100;
let stroke = [];          // what is being drawn: [x0, y0, x1, y1, ...] in canvas pixels
let drawing = false;
let fourier = null;       // the fitted series (Rust)
let t = 0, last = 0;      // animation time (radians) and the last frame's clock
let trail = [];           // the pen's path so far this lap
let scanHold = 0;         // seconds the finished scan in step 3 stays on screen

await init();

// ---------- drawing ----------
const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); drawing = true; fourier = null; trail = []; stroke = pos(e); $('hint').classList.add('hidden'); });
canvas.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); const n = stroke.length; if (n && Math.hypot(x - stroke[n - 2], y - stroke[n - 1]) < 1.5) return; stroke.push(x, y); });
const endStroke = () => { if (!drawing) return; drawing = false; if (stroke.length >= 6) fit(); else { stroke = []; $('hint').classList.remove('hidden'); } };
canvas.addEventListener('pointerup', endStroke); canvas.addEventListener('pointercancel', endStroke);

// ---------- the series ----------
function fit() {
  fourier = Fourier.fit(new Float64Array(stroke), MAX_TERMS, 0);   // 0: the crate picks the sample count
  t = 0; trail = [];
  $('terms').max = MAX_TERMS;
  for (const id of ['copyText', 'copyLatex', 'copyJson']) $(id).disabled = false;
  showEquations();
  explain();
}
const terms = () => +$('terms').value;
function showEquations() {
  $('termsVal').textContent = terms();
  if (!fourier) return;
  $('equations').textContent = fourier.equations(terms(), +$('digits').value);
  $('error').textContent = `Fit error with ${terms()} term${terms() > 1 ? 's' : ''}: ${fourier.error(terms()).toFixed(2)} px (root mean square)`;
}
$('terms').addEventListener('input', () => { trail = []; showEquations(); });
$('digits').addEventListener('change', showEquations);
$('clear').addEventListener('click', () => { stroke = []; fourier = null; trail = []; explain(); $('equations').textContent = 'Draw something first.'; $('error').textContent = ''; $('hint').classList.remove('hidden'); for (const id of ['copyText', 'copyLatex', 'copyJson']) $(id).disabled = true; });
const copy = (id, text) => $(id).addEventListener('click', async () => { if (!fourier) return; await navigator.clipboard.writeText(text()); const b = $(id), was = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = was; }, 1200); });
copy('copyText', () => fourier.equations(terms(), +$('digits').value));
copy('copyLatex', () => fourier.latex(terms(), +$('digits').value));
copy('copyJson', () => fourier.json(terms()));

// ---------- presets: shapes made of points, as if drawn ----------
const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
const PRESETS = {
  heart: n => Array.from({ length: n }, (_, i) => { const u = 2 * Math.PI * i / n; return [cx + 14 * Math.pow(Math.sin(u), 3) * 14, cy - (13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) * 14 + 20]; }).flat(),
  star: () => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 100 : 240, u = -Math.PI / 2 + Math.PI * i / 5; return [cx + r * Math.cos(u), cy + r * Math.sin(u)]; }).flat(),
  square: () => [cx - 200, cy - 200, cx + 200, cy - 200, cx + 200, cy + 200, cx - 200, cy + 200],
  // a simple bird in profile: body, tail, head and beak, as a hand might trace it
  bird: () => [[-300, 20], [-240, 60], [-120, 90], [0, 95], [120, 80], [200, 40], [250, 0], [300, -30], [330, -36], [300, -46], [262, -52], [230, -90], [180, -120], [100, -140], [0, -135], [-80, -115], [-160, -80], [-240, -40], [-330, -30], [-370, -10], [-360, 10], [-330, 10]].map(([x, y]) => [cx + x, cy + y]).flat(),
};
for (const a of document.querySelectorAll('[data-preset]')) a.addEventListener('click', e => { e.preventDefault(); stroke = PRESETS[a.dataset.preset](400); $('hint').classList.add('hidden'); fit(); });

// ---------- animation ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  scan.u = Math.min(1, scan.u + dt / 4); if (scan.u >= 1 && (scanHold += dt) > 2.5) { scan.u = 0; scanHold = 0; }
  scanStep(); rebuildStep(dt);
  ctx.clearRect(0, 0, W, H);
  if (!fourier) {   // the stroke as it is being drawn
    if (stroke.length >= 4) { ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 2.5; path(stroke, drawing ? false : true); ctx.stroke(); }
    return;
  }
  const n = terms();
  if ($('showOriginal').checked) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; path(stroke, true); ctx.stroke(); }
  // the approximation with n terms, faint, as a guide
  ctx.strokeStyle = 'rgba(29,78,216,.25)'; ctx.lineWidth = 1.5; path(fourier.trace(n, 600), true); ctx.stroke();
  t += dt * +$('speed').value;
  if (t >= 2 * Math.PI) { t -= 2 * Math.PI; trail = []; }
  const arms = fourier.arms(n, t);
  let tipX = fourier.coefficient(0, 0), tipY = fourier.coefficient(2, 0);
  if ($('showCircles').checked) {
    for (let i = 0; i < arms.length; i += 4) {
      const [x, y, r, a] = [arms[i], arms[i + 1], arms[i + 2], arms[i + 3]];
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,38,38,.8)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); ctx.stroke();
    }
  }
  if (arms.length) { const l = arms.length - 4; tipX = arms[l] + arms[l + 2] * Math.cos(arms[l + 3]); tipY = arms[l + 1] + arms[l + 2] * Math.sin(arms[l + 3]); }
  trail.push(tipX, tipY);
  if ($('showTrail').checked && trail.length >= 4) { ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 3; path(trail, false); ctx.stroke(); }
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, 2 * Math.PI); ctx.fill();
}
function path(p, close) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); if (close) ctx.closePath(); }
requestAnimationFrame(frame);

// ---------- the step-by-step pictures below, made from the current shape ----------
const COL = { ink: '#1d4ed8', hot: '#dc2626', grey: 'rgba(0,0,0,.2)', ok: '#16a34a' };
// fit points [x0, y0, ...] into a w×h box with a margin: returns a mapping function
function fitBox(pts, w, h, pad = 24) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
  const s = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
  const ox = (w - s * (x1 - x0)) / 2 - s * x0, oy = (h - s * (y1 - y0)) / 2 - s * y0;
  return { s, map: (x, y) => [ox + s * x, oy + s * y] };
}
function line(c, pts, f, close, color, width) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  for (let i = 0; i < pts.length; i += 2) { const [x, y] = f(pts[i], pts[i + 1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
  if (close) c.closePath(); c.stroke();
}
function blank(id, msg) {
  const cv = $(id), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  if (msg) { c.fillStyle = '#999'; c.font = '16px system-ui'; c.textAlign = 'center'; c.fillText(msg, cv.width / 2, cv.height / 2); c.textAlign = 'start'; }
  return [c, cv.width, cv.height];
}
function explain() {
  if (!fourier) { for (const id of ['step1', 'step2', 'step3', 'step5', 'step6', 'step7']) blank(id, 'Draw a shape above to fill this in'); return; }
  const out = fourier.outline(), m = out.length / 2;
  // 1: the evenly spaced points
  { const [c, w, h] = blank('step1'), { map } = fitBox(out, w, h);
    line(c, out, map, true, COL.grey, 2);
    for (let j = 0; j < m; j += 8) { const [x, y] = map(out[2 * j], out[2 * j + 1]); c.fillStyle = j ? COL.ink : COL.ok; c.beginPath(); c.arc(x, y, j ? 3 : 6, 0, 7); c.fill(); }
    const [ax, ay] = map(out[0], out[1]), [bx, by] = map(out[2 * 6], out[2 * 6 + 1]), a = Math.atan2(by - ay, bx - ax);
    c.strokeStyle = COL.ok; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx - 12 * Math.cos(a - .5), by - 12 * Math.sin(a - .5)); c.lineTo(bx, by); c.lineTo(bx - 12 * Math.cos(a + .5), by - 12 * Math.sin(a + .5)); c.stroke(); }
  // 2: x(t) and y(t) against t
  { const [c, w, h] = blank('step2'), pad = 30;
    const xs = [], ys = []; for (let j = 0; j < m; j++) { xs.push(out[2 * j]); ys.push(out[2 * j + 1]); }
    const lo = Math.min(...xs, ...ys), hi = Math.max(...xs, ...ys);
    const f = (j, v) => [pad + (w - 2 * pad) * j / m, h - pad - (h - 2 * pad) * (v - lo) / (hi - lo || 1)];
    c.strokeStyle = '#ccc'; c.lineWidth = 1; c.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
    c.fillStyle = '#888'; c.font = '13px system-ui'; c.fillText('0', pad - 4, h - 10); c.fillText('2π', w - pad - 8, h - 10); c.fillText('t →', w / 2 - 10, h - 10);
    for (const [vs, col] of [[xs, COL.ink], [ys, COL.hot]]) { c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); vs.forEach((v, j) => { const [x, y] = f(j, v); j ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
    c.fillStyle = COL.ink; c.fillText('x(t)', pad + 6, pad + 16); c.fillStyle = COL.hot; c.fillText('y(t)', pad + 46, pad + 16); }
  // 3 and 6 move: drawn every frame by scanStep() and rebuildStep()
  // 4: two waves that cancel, and a wave with itself (fixed)
  orthogonality();
  // 5: the spectrum, with the scanned k outlined
  { const [c, w, h] = blank('step5'), K = 40, pad = 30;
    const size = Array.from({ length: K }, (_, i) => { const k = i + 1; return Math.hypot(fourier.coefficient(0, k), fourier.coefficient(1, k), fourier.coefficient(2, k), fourier.coefficient(3, k)); });
    const top = Math.max(...size) || 1, bw = (w - 2 * pad) / K;
    size.forEach((v, i) => { const bh = (h - 2 * pad) * v / top; c.fillStyle = i < terms() ? COL.ink : '#b8c4e8'; c.fillRect(pad + i * bw + 1, h - pad - bh, bw - 2, bh);
      if (i + 1 === scan.k) { c.strokeStyle = COL.hot; c.lineWidth = 3; c.strokeRect(pad + i * bw - 1, h - pad - bh - 3, bw + 2, bh + 4); } });
    c.fillStyle = '#888'; c.font = '13px system-ui'; c.fillText('k = 1', pad, h - 10); c.fillText('40', w - pad - 14, h - 10); c.fillText(`dark: the ${terms()} terms in use above`, w - pad - 200, pad); }
  // 6 (bottom half): small multiples of the shape
  { const cv = $('step6'), c = cv.getContext('2d'), w = cv.width, top = 250, N = [1, 2, 3, 5, 10, 40], cw = w / 6;
    c.clearRect(0, top, w, cv.height - top);
    N.forEach((n, i) => {
      c.save(); c.translate(i * cw, top);
      const { map } = fitBox(out, cw, cv.height - top, 10);
      line(c, out, map, true, COL.grey, 1.2); line(c, fourier.trace(n, 300), map, true, COL.ink, 1.8);
      c.fillStyle = '#444'; c.font = '12px system-ui'; c.fillText(`${n}`, 6, 14); c.restore();
    }); }
  // 7: the arms frozen at t = 0.9
  { const [c, w, h] = blank('step7'), { map, s } = fitBox(out, w, h), arms = fourier.arms(8, 0.9);
    line(c, fourier.trace(8, 400), map, true, 'rgba(29,78,216,.35)', 2);
    let tip = map(fourier.coefficient(0, 0), fourier.coefficient(2, 0));
    for (let i = 0; i < arms.length; i += 4) {
      const [x, y] = map(arms[i], arms[i + 1]), r = arms[i + 2] * s, a = arms[i + 3];
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
      tip = [x + r * Math.cos(a), y + r * Math.sin(a)];
      c.strokeStyle = COL.hot; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(...tip); c.stroke();
    }
    c.fillStyle = COL.hot; c.beginPath(); c.arc(tip[0], tip[1], 5, 0, 7); c.fill(); }
}
$('terms').addEventListener('change', explain);

// ---------- step 3: scanning x(t) with a test wave, and step 6: rebuilding x(t) ----------
const scan = { k: 1, fn: 'sin', xy: 'x', u: 0 };   // u: how far the scan has got, 0..1
function pickK(k) { scan.k = k; scan.u = 0; for (const b of document.querySelectorAll('[data-k]')) b.classList.toggle('on', +b.dataset.k === k); explain(); }
for (const b of document.querySelectorAll('[data-k]')) b.addEventListener('click', () => pickK(+b.dataset.k));
$('kfn').addEventListener('change', e => { scan.fn = e.target.value; scan.u = 0; });
$('kxy').addEventListener('change', e => { scan.xy = e.target.value; scan.u = 0; });
function signal(which) { const out = fourier.outline(), m = out.length / 2, o = which === 'x' ? 0 : 1, v = Array.from({ length: m }, (_, j) => out[2 * j + o]), mean = v.reduce((p, q) => p + q, 0) / m; return v.map(q => q - mean); }
function rowAxes(c, x0, x1, y, label) { c.strokeStyle = '#ddd'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.fillStyle = '#666'; c.font = '13px system-ui'; c.fillText(label, x0, y - 52); }
function scanStep() {
  const cv = $('step3'), c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  if (!fourier) return;
  const x = signal(scan.xy), m = x.length, k = scan.k, wave = j => (scan.fn === 'cos' ? Math.cos : Math.sin)(2 * Math.PI * k * j / m);
  const amp = Math.max(...x.map(Math.abs)) || 1, L = 40, R = W - 16, X = j => L + (R - L) * j / m, upto = Math.floor(scan.u * m);
  const prod = x.map((v, j) => v * wave(j)), pmax = Math.max(...prod.map(Math.abs)) || 1;
  // row 1: the signal and the test wave
  const y1 = 80, s1 = 55 / amp; rowAxes(c, L, R, y1, `${scan.xy}(t), your shape`);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); for (let j = 0; j <= m; j++) { const yy = y1 - 55 * wave(j % m); j ? c.lineTo(X(j), yy) : c.moveTo(X(j), yy); } c.stroke(); c.setLineDash([]);
  c.strokeStyle = scan.xy === 'x' ? COL.ink : COL.hot; c.lineWidth = 2.5; c.beginPath(); x.forEach((v, j) => { const yy = y1 - v * s1; j ? c.lineTo(X(j), yy) : c.moveTo(X(j), yy); }); c.stroke();
  c.fillStyle = '#555'; c.font = '13px system-ui'; c.fillText(`dashed: test wave ${scan.fn}(${k === 1 ? '' : k}t)`, R - 190, y1 - 52);
  // row 2: the product, green above and red below, filled as far as the scan has got
  const y2 = 225, s2 = 55 / pmax; rowAxes(c, L, R, y2, 'their product, moment by moment');
  for (let j = 0; j < m; j++) { const v = prod[j]; c.fillStyle = v >= 0 ? (j < upto ? 'rgba(22,163,74,.75)' : 'rgba(22,163,74,.15)') : (j < upto ? 'rgba(220,38,38,.75)' : 'rgba(220,38,38,.15)'); c.fillRect(X(j), Math.min(y2, y2 - v * s2), Math.max(1, X(1) - X(0)), Math.abs(v * s2)); }
  // row 3: the running total, which ends at a_k
  const run = []; let acc = 0; for (let j = 0; j < m; j++) { acc += prod[j]; run.push(2 * acc / m); }
  const final = run[m - 1], rmax = Math.max(...run.map(Math.abs), 1e-9), y3 = 380, s3 = 60 / rmax;
  rowAxes(c, L, R, y3, 'running total × 2 / (number of points)');
  c.strokeStyle = 'rgba(124,58,237,.5)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(L, y3 - final * s3); c.lineTo(R, y3 - final * s3); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#7c3aed'; c.lineWidth = 2.5; c.beginPath(); for (let j = 0; j < Math.max(1, upto); j++) { const yy = y3 - run[j] * s3; j ? c.lineTo(X(j), yy) : c.moveTo(X(j), yy); } c.stroke();
  // the scan line
  const sx = X(upto); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx, 20); c.lineTo(sx, H - 30); c.stroke();
  const name = { x: { cos: 'a', sin: 'b' }, y: { cos: 'c', sin: 'd' } }[scan.xy][scan.fn], now = run[Math.max(0, upto - 1)];
  c.fillStyle = '#111'; c.font = '600 16px system-ui';
  c.fillText(scan.u >= 1 ? `${name}${k} = ${final.toFixed(2)}` : `so far: ${now.toFixed(2)}`, L, H - 8);
  const kind = { x: 0, y: 2 }[scan.xy] + (scan.fn === 'sin' ? 1 : 0);
  $('cap3').textContent = `Scanning ${scan.xy}(t) with ${scan.fn}(${k}t). The total ends at ${name}${k} = ${final.toFixed(2)}, the same number as in the equation above (${fourier.coefficient(kind, k).toFixed(2)}). ${Math.abs(final) < 0.05 * amp ? 'Almost nothing: green and red cancel, so this wave is hardly in your shape.' : 'Big: the shape keeps agreeing with this wave.'}`;
}
// step 4: cos(3t)·cos(2t) cancels; cos(3t)·cos(3t) averages ½
function orthogonality() {
  const cv = $('step4'), c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const n = 300, panels = [[3, 2, 'cos(3t) × cos(2t)'], [3, 3, 'cos(3t) × cos(3t)']];
  panels.forEach(([p, q, title], i) => {
    const L = i * W / 2 + 14, R = (i + 1) * W / 2 - 14, X = j => L + (R - L) * j / n, f = j => Math.cos(2 * Math.PI * p * j / n), g = j => Math.cos(2 * Math.PI * q * j / n);
    c.fillStyle = '#333'; c.font = '600 15px system-ui'; c.fillText(title, L, 22);
    const y1 = 95; for (const [fn, col] of [[f, COL.ink], [g, '#ea580c']]) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); for (let j = 0; j <= n; j++) { const yy = y1 - 50 * fn(j); j ? c.lineTo(X(j), yy) : c.moveTo(X(j), yy); } c.stroke(); }
    const y2 = 270; c.strokeStyle = '#ccc'; c.beginPath(); c.moveTo(L, y2); c.lineTo(R, y2); c.stroke();
    let sum = 0; for (let j = 0; j < n; j++) { const v = f(j) * g(j); sum += v; c.fillStyle = v >= 0 ? 'rgba(22,163,74,.7)' : 'rgba(220,38,38,.7)'; c.fillRect(X(j), Math.min(y2, y2 - 80 * v), Math.max(1, X(1) - X(0)), Math.abs(80 * v)); }
    const avg = sum / n; c.strokeStyle = '#7c3aed'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(L, y2 - 80 * avg); c.lineTo(R, y2 - 80 * avg); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#111'; c.font = '600 16px system-ui'; c.fillText(`average = ${Math.abs(avg) < 1e-9 ? '0' : avg.toFixed(2)}`, L, H - 30);
    c.font = '13px system-ui'; c.fillStyle = '#555'; c.fillText(i ? 'never below zero' : 'green and red areas are equal', L, H - 10);
  });
}
// step 6 (top half): x(t) rebuilt one wave at a time
let rebuildN = 1, rebuildT = 0;
function rebuildStep(dt) {
  const cv = $('step6'), c = cv.getContext('2d'), W = cv.width; c.clearRect(0, 0, W, 245);
  if (!fourier) return;
  rebuildT += dt; if (rebuildT > 0.9) { rebuildT = 0; rebuildN = rebuildN >= 12 ? 1 : rebuildN + 1; }
  const x = signal('x'), m = x.length, amp = Math.max(...x.map(Math.abs)) || 1, L = 40, R = W - 16, X = j => L + (R - L) * j / m, y0 = 120, s = 80 / amp;
  const a0 = fourier.coefficient(0, 0), part = n => j => { const t = 2 * Math.PI * j / m; let v = 0; for (let k = 1; k <= n; k++) v += fourier.coefficient(0, k) * Math.cos(k * t) + fourier.coefficient(1, k) * Math.sin(k * t); return v; };
  c.strokeStyle = '#ddd'; c.beginPath(); c.moveTo(L, y0); c.lineTo(R, y0); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.beginPath(); x.forEach((v, j) => { j ? c.lineTo(X(j), y0 - v * s) : c.moveTo(X(j), y0 - v * s); }); c.stroke();
  const last = j => fourier.coefficient(0, rebuildN) * Math.cos(rebuildN * 2 * Math.PI * j / m) + fourier.coefficient(1, rebuildN) * Math.sin(rebuildN * 2 * Math.PI * j / m);
  c.strokeStyle = 'rgba(234,88,12,.7)'; c.lineWidth = 1.5; c.beginPath(); for (let j = 0; j <= m; j++) { const yy = y0 - last(j % m) * s; j ? c.lineTo(X(j), yy) : c.moveTo(X(j), yy); } c.stroke();
  const sum = part(rebuildN); c.strokeStyle = COL.ink; c.lineWidth = 2.5; c.beginPath(); for (let j = 0; j <= m; j++) { const yy = y0 - sum(j % m) * s; j ? c.lineTo(X(j), yy) : c.moveTo(X(j), yy); } c.stroke();
  c.fillStyle = '#333'; c.font = '600 15px system-ui'; c.fillText(`x(t) from ${rebuildN} wave${rebuildN > 1 ? 's' : ''}`, L, 22);
  c.font = '13px system-ui'; c.fillStyle = '#ea580c'; c.fillText(`orange: the wave just added, k = ${rebuildN}`, L + 170, 22); c.fillStyle = '#888'; c.fillText('grey: what you drew', R - 130, 22);
}

// start with a shape so the page is alive; drawing replaces it
stroke = PRESETS.heart(400); fit(); pickK(1);

// for tests: draw a shape programmatically
window.__circles = { setStroke(pts) { stroke = pts; $('hint').classList.add('hidden'); fit(); }, get fourier() { return fourier; }, terms };

// "Try this" buttons: set the toy up, then scroll back to it
const setTerms = n => { $('terms').value = n; $('terms').dispatchEvent(new Event('input')); explain(); };
const TRY = {
  terms1: () => setTerms(1),
  star10: () => { stroke = PRESETS.star(400); $('hint').classList.add('hidden'); fit(); setTerms(10); },
  square: () => { stroke = PRESETS.square(400); $('hint').classList.add('hidden'); fit(); setTerms(1); let n = 1; const id = setInterval(() => { n = Math.min(100, n + 3); setTerms(n); if (n >= 100) clearInterval(id); }, 120); },
};
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[b.dataset.try]?.(); document.getElementById('play').scrollIntoView({ behavior: 'smooth' }); });
