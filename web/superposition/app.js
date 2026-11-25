// Superposition of waves: up to three waves, their sum, and the sound of it. Maths: pkg/lilavati.js
// (waves module); the step figures derive each result on screen (stacked heights, spinning arrows).
import init, { wave, superpose, combined_amplitude, beat_frequency } from '../pkg/lilavati.js';
import { share } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const F = a => new Float64Array(a);
const COL = ['#2563eb', '#ea580c', '#7c3aed'], NAMES = ['A', 'B', 'C'], DEG = Math.PI / 180;
let waves = [{ f: 220, a: 1, p: 0 }, { f: 224, a: 1, p: 0 }, { f: 330, a: 0, p: 0 }];
let shift = 0, last = 0;   // the picture scrolls slowly through time
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const winOf = s => 0.005 * Math.pow(200, s / 100);          // 5 ms .. 1 s
const winSlider = T => 100 * Math.log(T / 0.005) / Math.log(200);
const on = () => waves.filter(w => w.a > 0);

// ---------- presets ----------
const PRESETS = [
  ['Cancel out', [[220, 1, 0], [220, 1, 180], [330, 0, 0]], 0.02],
  ['Beats (220 and 224 Hz)', [[220, 1, 0], [224, 1, 0], [330, 0, 0]], 1],
  ['In step: twice as tall', [[220, 1, 0], [220, 1, 0], [330, 0, 0]], 0.02],
  ['An octave (220 and 440 Hz)', [[220, 1, 0], [440, 0.6, 0], [330, 0, 0]], 0.02],
  ['A chord (C, E, G)', [[261.63, 1, 0], [329.63, 1, 0], [392, 1, 0]], 0.05],
  ['Towards a square wave (1, 3, 5)', [[110, 1, 0], [330, 1 / 3, 0], [550, 0.2, 0]], 0.02],
];
PRESETS.forEach(([n], k) => $('presets').append(new Option(n, k)));
$('presets').append(Object.assign(new Option('Your own mix', 'own'), { disabled: true }));
function usePreset(k) {
  const [, ws, T] = PRESETS[k];
  waves = ws.map(([f, a, p]) => ({ f, a, p }));
  $('presets').value = k; $('win').value = winSlider(T); shift = 0; buildSliders(); sound(); draw();
}
$('presets').addEventListener('change', e => usePreset(+e.target.value));
$('win').addEventListener('input', () => { shift = 0; draw(); });

// ---------- the sliders for each wave ----------
function buildSliders() {
  $('waves').innerHTML = '';
  waves.forEach((w, i) => {
    const row = document.createElement('div'); row.className = 'wv';
    row.innerHTML = `<span class="dot" style="background:${COL[i]}" title="wave ${NAMES[i]}"></span>
      <label>${NAMES[i]}: <b data-o="f">${w.f.toFixed(0)} Hz</b><input type="range" min="50" max="1000" step="1" value="${w.f}" data-k="f"></label>
      <label>size <b data-o="a">${w.a.toFixed(2)}</b><input type="range" min="0" max="1" step="0.01" value="${w.a}" data-k="a"></label>
      <label>shift <b data-o="p">${Math.round(w.p)}°</b><input type="range" min="0" max="360" step="5" value="${w.p}" data-k="p"></label>`;
    for (const inp of row.querySelectorAll('input')) inp.addEventListener('input', () => {
      const k = inp.dataset.k; w[k] = +inp.value; $('presets').value = 'own';
      row.querySelector(`[data-o="${k}"]`).textContent = k === 'f' ? `${w.f.toFixed(0)} Hz` : k === 'a' ? w.a.toFixed(2) : `${Math.round(w.p)}°`;
      sound(); draw();
    });
    $('waves').append(row);
  });
}

// ---------- sound ----------
let ctx = null, voices = [];
function sound() {
  if (!ctx) return;
  const now = ctx.currentTime;
  voices.forEach((v, i) => { v.osc.frequency.setTargetAtTime(waves[i].f, now, 0.02); v.gain.gain.setTargetAtTime(0.12 * waves[i].a, now, 0.02); });
}
$('listen').addEventListener('click', () => {
  if (ctx) { ctx.close(); ctx = null; voices = []; $('listen').textContent = '▶ Listen'; return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  voices = waves.map(() => { const osc = ctx.createOscillator(), gain = ctx.createGain(); gain.gain.value = 0; osc.connect(gain).connect(ctx.destination); osc.start(); return { osc, gain }; });
  // shifts: start each oscillator offset in time so its phase matches
  sound(); $('listen').textContent = '■ Stop';
});

// ---------- the main picture: each wave, then the sum ----------
const cv = $('plane'), c = cv.getContext('2d'), W = cv.width, H = cv.height, L = 60, R = W - 16;
function samples(T) { return Math.min(20000, Math.max(900, Math.ceil(Math.max(...waves.map(w => w.f)) * T * 24))); }
function plot(vals, y0, scale, color, width) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  vals.forEach((v, i) => { const x = L + (R - L) * i / (vals.length - 1), y = y0 - v * scale; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
}
function axis(y0, label, color) { c.strokeStyle = '#e5e1d8'; c.lineWidth = 1; c.beginPath(); c.moveTo(L, y0); c.lineTo(R, y0); c.stroke(); c.fillStyle = color; c.font = '600 20px system-ui'; c.fillText(label, 8, y0 + 7); }
function fmtT(T) { return T < 0.1 ? `${(T * 1000).toFixed(T < 0.01 ? 1 : 0)} ms` : `${T.toFixed(2)} s`; }
function draw() {
  const T = winOf(+$('win').value), n = samples(T), t0 = shift, t1 = shift + T;
  $('winVal').textContent = fmtT(T);
  c.clearRect(0, 0, W, H);
  waves.forEach((w, i) => { const y0 = 60 + i * 100; axis(y0, NAMES[i], COL[i]); if (w.a > 0) plot(wave(w.f, w.a, w.p * DEG, t0, t1, n), y0, 38, COL[i], 2); else { c.fillStyle = '#aaa'; c.font = '16px system-ui'; c.fillText('off', L + 10, y0 + 5); } });
  const total = superpose(F(waves.map(w => w.f)), F(waves.map(w => w.a)), F(waves.map(w => w.p * DEG)), t0, t1, n);
  const ys = 495, peak = Math.max(1, waves.reduce((s, w) => s + w.a, 0));
  axis(ys, 'sum', '#111'); c.fillStyle = '#111'; c.font = '600 20px system-ui'; c.fillText('=', 30, ys - 120);
  plot(total, ys, 120 / peak, '#111', 2.6);
  c.fillStyle = '#888'; c.font = '15px system-ui'; c.fillText(`${fmtT(T)} shown`, R - 110, H - 10);
  // what is going on, in words
  const ws = on(), amp = total.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  let say = `Biggest height of the sum: <b>${amp.toFixed(2)}</b>.`;
  if (ws.length >= 2) {
    const [a, b] = ws;
    if (Math.abs(a.f - b.f) < 1e-9) { const A = combined_amplitude(a.a, b.a, (b.p - a.p) * DEG); say = `Same frequency: they add to one wave of size <b>${A.toFixed(2)}</b>${A < 0.01 ? ' (silence)' : ''}.`; }
    else if (Math.abs(a.f - b.f) < 30) say = `Nearly equal: <b>${beat_frequency(a.f, b.f).toFixed(1)} beats a second</b> (${b.f} − ${a.f}). Show 1 s to see them.`;
  }
  $('say').innerHTML = say;
}

// ---------- step figures ----------
const fig = id => { const e = $(id), g = e.getContext('2d'); g.clearRect(0, 0, e.width, e.height); return [g, e.width, e.height]; };
const line = (g, pts, color, w, dash) => { g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]); };
function arrow(g, x0, y0, x1, y1, color, w = 3) {
  const d = Math.hypot(x1 - x0, y1 - y0); if (d < 1) return; const ux = (x1 - x0) / d, uy = (y1 - y0) / d, h = Math.min(11, d * 0.5);
  line(g, [[x0, y0], [x1 - ux * h * 0.6, y1 - uy * h * 0.6]], color, w);
  g.fillStyle = color; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * h - uy * h * 0.5, y1 - uy * h + ux * h * 0.5); g.lineTo(x1 - ux * h + uy * h * 0.5, y1 - uy * h - ux * h * 0.5); g.fill();
}
// the two waves the figures use: A and B from above (B falls back to A's frequency if off)
const pair = () => { const a = waves[0].a > 0 ? waves[0] : { f: 220, a: 1, p: 0 }, b = waves[1].a > 0 ? waves[1] : { f: a.f, a: 0.7, p: 60 }; return [a, b]; };

// 1: stacking heights at a scanning moment
function ex1(sec) {
  const [g, w, h] = fig('ex1'), [a, b] = pair(), L1 = 30, R1 = w - 20, y0 = h / 2, cyc = 2, T = cyc / a.f, n = 400;
  const s = 70 / Math.max(1, a.a + b.a) * 1.4, X = i => L1 + (R1 - L1) * i / (n - 1);
  const A = Array.from(wave(a.f, a.a, a.p * DEG, 0, T, n)), B = Array.from(wave(b.f, b.a, b.p * DEG, 0, T, n)), S = A.map((v, i) => v + B[i]);
  const u = (sec * 0.25) % 1, k = Math.floor(u * (n - 1));
  line(g, [[L1, y0], [R1, y0]], '#e5e1d8', 1);
  line(g, A.map((v, i) => [X(i), y0 - v * s]), 'rgba(37,99,235,.55)', 2);
  line(g, B.map((v, i) => [X(i), y0 - v * s]), 'rgba(234,88,12,.55)', 2);
  line(g, S.slice(0, k + 1).map((v, i) => [X(i), y0 - v * s]), '#111', 3);
  const x = X(k); line(g, [[x, 14], [x, h - 14]], 'rgba(0,0,0,.25)', 1);
  arrow(g, x, y0, x, y0 - A[k] * s, '#2563eb', 4);
  arrow(g, x + 7, y0 - A[k] * s, x + 7, y0 - S[k] * s, '#ea580c', 4);
  g.fillStyle = '#111'; g.beginPath(); g.arc(x, y0 - S[k] * s, 6, 0, 7); g.fill();
  g.font = '600 16px system-ui'; g.fillStyle = '#333';
  g.fillText(`A ${A[k] >= 0 ? '+' : '−'}${Math.abs(A[k]).toFixed(2)}   +   B ${B[k] >= 0 ? '+' : '−'}${Math.abs(B[k]).toFixed(2)}   =   ${S[k].toFixed(2)}`, L1, 24);
}
// 2: spinning arrows of the same frequency, head to tail
function ex2(sec) {
  const [g, w, h] = fig('ex2'), [a] = pair(), bA = waves[1].a > 0 ? waves[1].a : 0.7, gap = +$('gap').value * DEG;
  $('gapVal').textContent = `${$('gap').value}°`;
  const cx = 145, cy = h / 2 + 10, s = 125 / Math.max(1, a.a + bA), th = sec * 1.2;
  const p1 = [cx + a.a * s * Math.cos(th), cy - a.a * s * Math.sin(th)], p2 = [p1[0] + bA * s * Math.cos(th + gap), p1[1] - bA * s * Math.sin(th + gap)];
  g.strokeStyle = '#eee'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, a.a * s, 0, 7); g.stroke();
  arrow(g, cx, cy, ...p1, '#2563eb', 4); arrow(g, ...p1, ...p2, '#ea580c', 4); arrow(g, cx, cy, ...p2, '#111', 3);
  // the heights traced over the last moments
  const L2 = 290, R2 = w - 20, n = 200, back = 2 * Math.PI * 1.5;
  line(g, [[L2, cy], [R2, cy]], '#e5e1d8', 1);
  for (const [fn, col, lw] of [[t => a.a * Math.sin(t), 'rgba(37,99,235,.6)', 2], [t => bA * Math.sin(t + gap), 'rgba(234,88,12,.6)', 2], [t => a.a * Math.sin(t) + bA * Math.sin(t + gap), '#111', 3]])
    line(g, Array.from({ length: n }, (_, i) => { const t = th - back + back * i / (n - 1); return [L2 + (R2 - L2) * i / (n - 1), cy - fn(t) * s]; }), col, lw);
  line(g, [[p2[0], p2[1]], [R2, p2[1]]], 'rgba(0,0,0,.15)', 1, [4, 4]);
  const A = combined_amplitude(a.a, bA, gap);
  g.font = '600 16px system-ui'; g.fillStyle = '#111';
  g.fillText(`sum size = √(${a.a.toFixed(1)}² + ${bA.toFixed(1)}² + 2·${a.a.toFixed(1)}·${bA.toFixed(1)}·cos ${$('gap').value}°) = ${A.toFixed(2)}`, 14, 24);
}
// 3: beats: B laps A slowly; the sum swells and fades
function ex3(sec) {
  const [g, w, h] = fig('ex3'); let [a, b] = pair();
  if (Math.abs(a.f - b.f) < 0.5 || Math.abs(a.f - b.f) > 30) { a = { f: 220, a: 1, p: 0 }; b = { f: 224, a: 1, p: 0 }; }
  const fb = beat_frequency(a.f, b.f), cx = 40, cy = h / 2, s = 105 / (a.a + b.a);
  const rel = 2 * Math.PI * fb * ((sec * 0.25) % (1 / fb));    // slowed down 4×
  const p1 = [cx + a.a * s, cy], p2 = [p1[0] + b.a * s * Math.cos(rel), p1[1] - b.a * s * Math.sin(rel)];
  g.strokeStyle = '#eee'; g.beginPath(); g.arc(p1[0], p1[1], b.a * s, 0, 7); g.stroke();
  arrow(g, cx, cy, ...p1, '#2563eb', 4); arrow(g, ...p1, ...p2, '#ea580c', 4); arrow(g, cx, cy, ...p2, '#111', 3);
  g.font = '14px system-ui'; g.fillStyle = '#555'; g.fillText('seen from arrow A', cx, cy + 125);
  const L3 = 280, R3 = w - 16, T = 2 / fb, n = 3000, S = Array.from(superpose(F([a.f, b.f]), F([a.a, b.a]), F([a.p * DEG, b.p * DEG]), 0, T, n)), sy = 70 / (a.a + b.a);
  line(g, S.map((v, i) => [L3 + (R3 - L3) * i / (n - 1), cy - v * sy]), 'rgba(0,0,0,.55)', 1);
  const env = Array.from({ length: 200 }, (_, i) => { const t = T * i / 199; return [L3 + (R3 - L3) * i / 199, combined_amplitude(a.a, b.a, 2 * Math.PI * (b.f - a.f) * t + (b.p - a.p) * DEG)]; });
  line(g, env.map(([x, v]) => [x, cy - v * sy]), '#7c3aed', 2.5); line(g, env.map(([x, v]) => [x, cy + v * sy]), '#7c3aed', 2.5);
  const mx = L3 + (R3 - L3) * ((sec * 0.25 * fb) % 1) / 2; line(g, [[mx, 30], [mx, h - 30]], 'rgba(124,58,237,.35)', 1);
  g.font = '600 16px system-ui'; g.fillStyle = '#111'; g.fillText(`${b.f} − ${a.f} = ${fb.toFixed(1)} beats a second (2 shown, ${fmtT(T)})`, 14, 24);
}
// 4: square wave from odd harmonics, one added at a time
let sqN = 1, sqT = 0;
function ex4(dt) {
  const [g, w, h] = fig('ex4'); sqT += dt; if (sqT > 1.1) { sqT = 0; sqN = sqN >= 15 ? 1 : sqN + 1; }
  const L4 = 20, R4 = w - 20, cy = h / 2 + 10, s = 110, n = 600, X = i => L4 + (R4 - L4) * i / (n - 1);
  const odd = k => 2 * k - 1, part = m => Array.from({ length: n }, (_, i) => { const x = 4 * Math.PI * i / (n - 1); let v = 0; for (let k = 1; k <= m; k++) v += Math.sin(odd(k) * x) / odd(k); return v; });
  line(g, [[L4, cy], [R4, cy]], '#e5e1d8', 1);
  line(g, Array.from({ length: n }, (_, i) => [X(i), cy - Math.sign(Math.sin(4 * Math.PI * i / (n - 1))) * Math.PI / 4 * s]), 'rgba(0,0,0,.2)', 3);
  line(g, Array.from({ length: n }, (_, i) => [X(i), cy - Math.sin(odd(sqN) * 4 * Math.PI * i / (n - 1)) / odd(sqN) * s]), 'rgba(234,88,12,.8)', 1.5);
  line(g, part(sqN).map((v, i) => [X(i), cy - v * s]), '#111', 2.8);
  g.font = '600 16px system-ui'; g.fillStyle = '#111';
  const terms = Array.from({ length: Math.min(sqN, 4) }, (_, k) => k ? `sin ${odd(k + 1)}x / ${odd(k + 1)}` : 'sin x').join(' + ') + (sqN > 4 ? ' + …' : '');
  g.fillText(`${sqN} wave${sqN > 1 ? 's' : ''}: ${terms}`, L4, 26);
  g.font = '14px system-ui'; g.fillStyle = '#ea580c'; g.fillText(`orange: the one just added, ${odd(sqN)} × the frequency, size 1/${odd(sqN)}`, L4, 48);
}
// 5: two waves in opposite directions make a standing wave
function ex5(sec) {
  const [g, w, h] = fig('ex5'), L5 = 20, R5 = w - 20, n = 400, X = i => L5 + (R5 - L5) * i / (n - 1), t = sec * 0.6, kx = i => 3 * Math.PI * i / (n - 1);
  const rows = [[h * 0.22, i => Math.sin(kx(i) - t), '#2563eb', 'going right'], [h * 0.47, i => Math.sin(kx(i) + t), '#ea580c', 'going left']];
  for (const [y0, fn, col, lab] of rows) { line(g, [[L5, y0], [R5, y0]], '#eee', 1); line(g, Array.from({ length: n }, (_, i) => [X(i), y0 - fn(i) * 30]), col, 2); g.fillStyle = col; g.font = '14px system-ui'; g.fillText(lab, L5, y0 - 36); }
  const y3 = h * 0.8; line(g, [[L5, y3], [R5, y3]], '#eee', 1);
  line(g, Array.from({ length: n }, (_, i) => [X(i), y3 - (Math.sin(kx(i) - t) + Math.sin(kx(i) + t)) * 30]), '#111', 3);
  for (let m = 0; m <= 3; m++) { const i = (n - 1) * m / 3; g.fillStyle = '#dc2626'; g.beginPath(); g.arc(X(i), y3, 6, 0, 7); g.fill(); }
  g.fillStyle = '#111'; g.font = '14px system-ui'; g.fillText('sum: a standing wave (red dots: nodes, never moving)', L5, y3 - 70);
}

$('gap').addEventListener('input', () => ex2(last / 1000));
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!still) shift += dt * winOf(+$('win').value) * 0.12;
  draw(); const sec = still ? 1 : now / 1000;
  ex1(sec); ex2(sec); ex3(sec); ex4(still ? 0 : dt); ex5(sec);
}

const TRY = [() => usePreset(0), () => { usePreset(1); if (!ctx) $('listen').click(); },
  () => { usePreset(1); let f = 224; const id = setInterval(() => { f += 0.5; waves[1].f = f; buildSliders(); sound(); $('presets').value = 'own'; if (f >= 230) clearInterval(id); }, 120); },
  () => usePreset(5)];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });

usePreset(1);
requestAnimationFrame(frame);

// Together (together/share.js): everything here is in the controls
share();
