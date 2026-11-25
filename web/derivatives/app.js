// The derivatives and integrals page, shown with motion: one motion as three linked graphs (position, velocity, acceleration) over 10 s.
// You draw on one; Rust (pkg/lilavati.js, motion module) works out the other two by slopes and areas.
import init, { Motion, smooth } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const T = 10, N = 501, DT = T / (N - 1);
const KEYS = ['s', 'v', 'a'];
const INFO = { s: { name: 'position', unit: 'm', col: '#1d4ed8' }, v: { name: 'velocity', unit: 'm/s', col: '#16a34a' }, a: { name: 'acceleration', unit: 'm/s²', col: '#dc2626' } };
let src = 's';                       // which graph is drawn on
let data = new Float64Array(N);      // its samples
let v0 = 0;                          // starting velocity when drawing acceleration
let motion = null, cur = { s: [], v: [], a: [] };
const range = { s: [0, 1], v: [0, 1], a: [0, 1] };
let fixed = null;                    // the drawn graph keeps its scale while you draw
let t = 0, playing = true, last = 0;

// ---------- maths ----------
function compute() {
  const sigma = +$('sigma').value;
  motion = src === 's' ? Motion.from_distance(data, DT, sigma) : src === 'v' ? Motion.from_velocity(data, DT, 0, sigma) : Motion.from_acceleration(data, DT, v0, 0);
  cur = { s: motion.distance(), v: motion.velocity(), a: motion.acceleration() };
  for (const k of KEYS) if (k !== fixed) range[k] = nice(cur[k]);
  drawAll(); explainAll();
}
// a y-range with some room that always includes 0
function nice(v) {
  let lo = Math.min(0, ...v), hi = Math.max(0, ...v);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; return [lo - (lo < 0 ? pad : 0), hi + (hi > 0 ? pad : 0)];
}
const valAt = (arr, time) => { const f = Math.min(N - 1, Math.max(0, time / DT)), i = Math.floor(f), j = Math.min(N - 1, i + 1); return arr[i] + (arr[j] - arr[i]) * (f - i); };

// ---------- presets ----------
const PRESETS = [
  ['Steady walk', 'v', () => 1.4, 0],
  ['Car speeding up', 'a', t => (t < 5 ? 4 : 0), 0],
  ['Braking to a stop', 'v', t => Math.max(0, 20 - 4 * t), 0],
  ['Ball thrown up', 'a', () => -9.81, 49.05],
  ['Bouncing spring', 's', t => 2 * Math.sin(2 * Math.PI * t / 2.5), 0],
  ['Stop-and-go traffic', 'v', t => 4 * (1 - Math.cos(2 * Math.PI * t / 5)), 0],
];
// a dropdown right above the graphs; drawing on a graph switches it to "your own drawing"
function usePreset(i) {
  const [, k, f, vv] = PRESETS[i];
  $('presets').value = i;
  setSource(k, false); data = Float64Array.from({ length: N }, (_, j) => f(j * DT)); v0 = vv; syncV0(); fixed = null; compute(); t = 0; playing = true; $('playBtn').textContent = 'Pause';
}
PRESETS.forEach(([name], i) => $('presets').append(new Option(name, i)));
$('presets').append(Object.assign(new Option('Your own drawing', 'own'), { disabled: true }));
$('presets').addEventListener('change', e => { if (e.target.value !== 'own') usePreset(+e.target.value); });

// ---------- controls ----------
function setSource(k, keep = true) {
  if (keep && motion) { data = Float64Array.from(cur[k]); if (k === 'a') { v0 = cur.v[0]; syncV0(); } }
  src = k; $('source').value = k;
  $('v0wrap').style.display = k === 'a' ? '' : 'none';
  for (const g of KEYS) $('g-' + g).classList.toggle('draw', g === k);
}
function syncV0() { $('v0').value = v0; $('v0val').textContent = (+v0).toFixed(1); }
$('source').addEventListener('change', e => { setSource(e.target.value); compute(); });
$('v0').addEventListener('input', e => { v0 = +e.target.value; $('v0val').textContent = v0.toFixed(1); compute(); });
$('sigma').addEventListener('input', e => { $('sigval').textContent = e.target.value; compute(); });
$('extras').addEventListener('change', drawAll);
$('flat').addEventListener('click', () => { $('presets').value = 'own'; data = new Float64Array(N); v0 = 0; syncV0(); fixed = null; compute(); });
$('playBtn').addEventListener('click', () => { playing = !playing; $('playBtn').textContent = playing ? 'Pause' : 'Play'; });
$('time').addEventListener('input', e => { t = +e.target.value; playing = false; $('playBtn').textContent = 'Play'; drawAll(); });

// ---------- drawing on a graph ----------
const PAD = { l: 56, r: 14, t: 14, b: 26 };
function toData(cv, e) {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
  const [lo, hi] = range[src];
  const i = Math.round((x - PAD.l) / (cv.width - PAD.l - PAD.r) * (N - 1));
  return [Math.max(0, Math.min(N - 1, i)), lo + (hi - lo) * (cv.height - PAD.b - y) / (cv.height - PAD.t - PAD.b)];
}
let lastPt = null;
for (const k of KEYS) {
  const cv = $('g-' + k);
  cv.addEventListener('pointerdown', e => { if (k !== src) { setSource(k); } e.preventDefault(); cv.setPointerCapture(e.pointerId); fixed = k; $('presets').value = 'own'; lastPt = toData(cv, e); data[lastPt[0]] = lastPt[1]; compute(); });
  cv.addEventListener('pointermove', e => {
    if (!lastPt || k !== src) return;
    const p = toData(cv, e), [i0, y0] = lastPt, [i1, y1] = p;
    const step = i1 >= i0 ? 1 : -1;
    for (let i = i0; i !== i1 + step; i += step) data[i] = i1 === i0 ? y1 : y0 + (y1 - y0) * (i - i0) / (i1 - i0);
    lastPt = p; compute();
  });
  const end = () => { if (!lastPt) return; lastPt = null; fixed = null; compute(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
}

// ---------- rendering ----------
function ticks(lo, hi, n = 4) {
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 5, 10].map(m => m * p).find(s => s >= raw) || raw;
  const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(10)); return { out, st };
}
function graph(k) {
  const cv = $('g-' + k), c = cv.getContext('2d'), w = cv.width, h = cv.height, [lo, hi] = range[k], info = INFO[k];
  const X = time => PAD.l + (w - PAD.l - PAD.r) * time / T, Y = v => h - PAD.b - (h - PAD.t - PAD.b) * (v - lo) / (hi - lo);
  c.clearRect(0, 0, w, h);
  if (k === src) { c.fillStyle = 'rgba(29,78,216,.04)'; c.fillRect(0, 0, w, h); }
  c.font = '12px system-ui'; c.fillStyle = '#888'; c.strokeStyle = '#eee'; c.lineWidth = 1;
  const { out, st } = ticks(lo, hi);
  for (const v of out) { c.beginPath(); c.moveTo(PAD.l, Y(v)); c.lineTo(w - PAD.r, Y(v)); c.stroke(); c.fillText((st < 1 ? v.toFixed(1) : v.toFixed(0)), 6, Y(v) + 4); }
  for (let s = 0; s <= T; s++) { c.fillText(s + ' s', X(s) - 8, h - 8); }
  c.strokeStyle = '#999'; c.beginPath(); c.moveTo(PAD.l, Y(0)); c.lineTo(w - PAD.r, Y(0)); c.stroke();
  const arr = cur[k];
  // the area so far (under velocity or acceleration)
  if ($('extras').checked && k !== 's') {
    const n = Math.round(t / DT);
    for (let i = 0; i < n; i++) { c.fillStyle = arr[i] >= 0 ? 'rgba(29,78,216,.18)' : 'rgba(220,38,38,.18)'; c.fillRect(X(i * DT), Math.min(Y(0), Y(arr[i])), X(DT) - X(0) + .5, Math.abs(Y(arr[i]) - Y(0))); }
  }
  c.strokeStyle = info.col; c.lineWidth = 2.5; c.beginPath();
  arr.forEach((v, i) => { const x = X(i * DT), y = Y(v); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
  // the tangent (slope) on distance and velocity
  if ($('extras').checked && k !== 'a') {
    const slope = valAt(k === 's' ? cur.v : cur.a, t), v = valAt(arr, t), d = 1.2;
    c.save(); c.beginPath(); c.rect(PAD.l, PAD.t, w - PAD.l - PAD.r, h - PAD.t - PAD.b); c.clip();
    c.strokeStyle = '#f59e0b'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(t - d), Y(v - slope * d)); c.lineTo(X(t + d), Y(v + slope * d)); c.stroke(); c.restore();
  }
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(t), PAD.t); c.lineTo(X(t), h - PAD.b); c.stroke();
  c.fillStyle = info.col; c.beginPath(); c.arc(X(t), Y(valAt(arr, t)), 5, 0, 7); c.fill();
  c.font = 'bold 13px system-ui'; c.fillText(`${info.name} (${info.unit})${k === src ? '  ✎ draw here' : ''}`, PAD.l + 6, PAD.t + 12);
  if ($('extras').checked) {
    c.font = '12px system-ui'; c.fillStyle = '#b45309';
    const note = k === 's' ? 'orange: slope = velocity' : k === 'v' ? 'orange: slope = acceleration · shaded: area = distance gone' : 'shaded: area = change in velocity';
    c.fillText(note, w - PAD.r - c.measureText(note).width - 4, PAD.t + 12);
  }
}
function track() {
  const s = valAt(cur.s, t), v = valAt(cur.v, t), a = valAt(cur.a, t);
  $('readout').textContent = `t = ${t.toFixed(2)} s   position = ${s.toFixed(2)} m   velocity = ${v.toFixed(2)} m/s   acceleration = ${a.toFixed(2)} m/s²`;
}
function drawAll() { if (!motion) return; for (const k of KEYS) graph(k); track(); $('time').value = t; }

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing && !lastPt) { t += dt; if (t > T) t = 0; drawAll(); }
  explainAnim(now / 1000);
}

// ---------- the walk-through figures ----------
function fig(id) { const cv = $(id), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); return [c, cv.width, cv.height]; }
function axes(c, w, h, arr, col, pad = 34) {
  const [lo, hi] = nice(arr), X = time => pad + (w - 2 * pad) * time / T, Y = v => h - pad - (h - 2 * pad) * (v - lo) / (hi - lo);
  c.strokeStyle = '#ccc'; c.lineWidth = 1; c.beginPath(); c.moveTo(pad, Y(0)); c.lineTo(w - pad, Y(0)); c.moveTo(pad, pad); c.lineTo(pad, h - pad); c.stroke();
  c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); arr.forEach((v, i) => { i ? c.lineTo(X(i * DT), Y(v)) : c.moveTo(X(i * DT), Y(v)); }); c.stroke();
  return { X, Y };
}
let ex4Rects = 4;
function explainAll() {
  // 1: position with one-second dots
  { const [c, w, h] = fig('ex1'), { X, Y } = axes(c, w, h, cur.s, INFO.s.col);
    c.fillStyle = INFO.s.col; for (let s = 0; s <= T; s++) { c.beginPath(); c.arc(X(s), Y(valAt(cur.s, s)), 4, 0, 7); c.fill(); } }
  // 5: wobble demo (fixed, does not depend on the motion)
  { const [c, w, h] = fig('ex5'), n = 200, d = 0.05, line = Float64Array.from({ length: n }, (_, i) => 0.5 * i * d + 0.04 * Math.sin(i * 2.7) );
    const v = Motion.from_distance(line, d, 0), rows = [[line, INFO.s.col], [v.velocity(), INFO.v.col], [v.acceleration(), INFO.a.col]];
    rows.forEach(([arr, col], r) => { const top = r * h / 3, lo = Math.min(...arr), hi = Math.max(...arr);
      c.strokeStyle = col; c.lineWidth = 1.8; c.beginPath(); arr.forEach((y, i) => { const X = 20 + (w - 40) * i / n, Y = top + h / 3 - 10 - (h / 3 - 20) * (y - lo) / (hi - lo || 1); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); }); }
}
// figures 2, 3 and 4 move: a shrinking gap, a sliding tangent, thinning rectangles
function explainAnim(sec) {
  if (!motion) return;
  { const [c, w, h] = fig('ex2'), { X, Y } = axes(c, w, h, cur.s, INFO.s.col);
    const t0 = 3, ph = (sec % 6) / 6, gap = 4 * Math.pow(0.02, Math.min(1, ph * 1.25)), s0 = valAt(cur.s, t0), s1 = valAt(cur.s, t0 + gap), m = (s1 - s0) / gap;
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    c.strokeStyle = '#dc2626'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(t0 - 2), Y(s0 - 2 * m)); c.lineTo(X(t0 + gap + 2), Y(s1 + 2 * m)); c.stroke(); c.restore();
    c.fillStyle = '#dc2626'; for (const [tt, ss] of [[t0, s0], [t0 + gap, s1]]) { c.beginPath(); c.arc(X(tt), Y(ss), 5, 0, 7); c.fill(); }
    c.font = '14px system-ui'; c.fillStyle = '#333';
    c.fillText(`h = ${gap.toFixed(3)} s   average speed = ${m.toFixed(2)} m/s`, 44, 22);
    c.fillText(`velocity at t = 3 s: ${valAt(cur.v, t0).toFixed(2)} m/s`, 44, 42); }
  { const [c, w, h] = fig('ex3'), { X, Y } = axes(c, w, h, cur.v, INFO.v.col);
    const tt = (sec * 1.2) % T, v = valAt(cur.v, tt), m = valAt(cur.a, tt);
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    c.strokeStyle = '#f59e0b'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(tt - 1.5), Y(v - 1.5 * m)); c.lineTo(X(tt + 1.5), Y(v + 1.5 * m)); c.stroke(); c.restore();
    c.fillStyle = INFO.v.col; c.beginPath(); c.arc(X(tt), Y(v), 5, 0, 7); c.fill();
    c.font = '14px system-ui'; c.fillStyle = '#333'; c.fillText(`t = ${tt.toFixed(1)} s   slope = acceleration = ${m.toFixed(2)} m/s²`, 44, 22); }
  { const [c, w, h] = fig('ex4'), { X, Y } = axes(c, w, h, cur.v, INFO.v.col);
    const n = [4, 8, 16, 32, 64, 128][Math.floor(sec / 1.5) % 6], bw = T / n; let sum = 0;
    for (let i = 0; i < n; i++) { const v = valAt(cur.v, (i + 0.5) * bw); sum += v * bw;
      c.fillStyle = v >= 0 ? 'rgba(29,78,216,.22)' : 'rgba(220,38,38,.22)'; c.strokeStyle = 'rgba(29,78,216,.5)'; c.lineWidth = 1;
      c.fillRect(X(i * bw), Math.min(Y(0), Y(v)), X(bw) - X(0), Math.abs(Y(v) - Y(0))); c.strokeRect(X(i * bw), Math.min(Y(0), Y(v)), X(bw) - X(0), Math.abs(Y(v) - Y(0))); }
    c.font = '14px system-ui'; c.fillStyle = '#333';
    c.fillText(`${n} rectangles: total area = ${sum.toFixed(2)} m`, 44, 22);
    c.fillText(`exact distance gone: ${(cur.s[N - 1] - cur.s[0]).toFixed(2)} m`, 44, 42); }
}

setSource('s', false);
usePreset(1);   // start with the car speeding up
requestAnimationFrame(frame);
// "Try this" buttons: set the toy up, then scroll back to it
const pause = at => { t = at; playing = false; $('playBtn').textContent = 'Play'; drawAll(); };
const TRY = {
  car: () => usePreset(1),
  ball: () => { usePreset(3); pause(5); },
  drawv: () => { setSource('v'); compute(); },
  nosmooth: () => { $('sigma').value = 0; $('sigval').textContent = '0'; setSource('s'); compute(); },
};
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[b.dataset.try]?.(); document.getElementById('play').scrollIntoView({ behavior: 'smooth' }); });
window.__motion = { get cur() { return cur; }, setSource, compute };

// Together (together/share.js): which graph is drawn on and what is drawn there
share(() => ({ src, data: Array.from(data), v0 }), s => {
  const d = nums(s?.data, N); if (!d || d.length !== N || !KEYS.includes(s.src)) return;
  setSource(s.src, false); data = Float64Array.from(d); v0 = Number.isFinite(s.v0) ? s.v0 : 0; syncV0(); fixed = null; compute();
});
