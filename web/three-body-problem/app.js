// The three-body problem page: three bodies under Newton's gravity in a plane, stepped forward by the
// Rust maths (pkg/lilavati.js, threebody module) in units where G = 1. Drag the bodies, pick a famous
// setup, switch on a twin a millionth off; the step-by-step figures are made from the same setup.
import init, { System, preset, pulls, run, run_fixed, kepler, kepler_paths } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const EPS = 1e-4;                     // softening: a close pass of 0.0001 is as close as the maths looks
const NUDGE = 1e-6;                   // the twin: body 1 a millionth faster
const FRAME_STEPS = 60000;
const FIG_STEPS = 2e6;                 // the most small steps one figure may take to work out (a close pass takes millions)            // the most small steps worked out in one frame (about 4 ms of work)
let slowmo = -1e9;                     // when a close pass last slowed the picture down
const CHUNK = 0.005;                  // the toy moves time on in pieces of this length, the same on every screen
const COL = ['#fbbf24', '#38bdf8', '#f472b6'];     // the bodies on the dark sky
const INK = ['#d97706', '#0284c7', '#db2777'];     // the same bodies on white figures
const SETUPS = {
  eight: { rate: 1.2, view: 1.25, T: 12.65, Tg: 60, note: 'Three equal masses on one figure-eight curve, each a third of a lap behind the next. One lap takes 6.33 time units.' },
  lagrange: { rate: 1.5, view: 1.35, T: 25, Tg: 60, note: 'Three equal masses at the corners of a triangle that turns as a whole (Lagrange, 1772). Balanced, but unstable.' },
  'sun-planet-moon': { rate: 0.8, view: 1.3, T: 6.3, Tg: 30, note: 'A sun (mass 1), a planet (0.01) one unit away and a moon (0.0001) close to the planet. One year is 6.3 time units.' },
  'two-suns': { rate: 2, view: 3.6, T: 15, Tg: 60, note: 'Two equal suns circling each other and a small planet going round both, three times as far out.' },
  pythagorean: { rate: 4, view: 3.4, T: 20, Tg: 100, note: 'Masses 3, 4 and 5 let go at rest at the corners of a 3-4-5 right triangle, each opposite the side of its own length (Burrau, 1913).' },
  custom: { rate: null, view: null, T: 15, Tg: 60, note: 'Your own setup. Back to the start replays it from where you left it.' },
};

// ---------- state ----------
let setup = 'eight', start, sys, twin, trails, twinTrails, playing = true, stalled = false, gone = -1, E0 = 0;
let owed = 0, view = 1.25, zoom = 1.25, cam = [0, 0], arrowK = 0.5, drag = null, last = 0;
const sum = a => a.reduce((x, y) => x + y, 0);
const mass = () => Array.from(sys.masses()), pos = () => Array.from(sys.positions()), vel = () => Array.from(sys.velocities());
function com(m, p) { const M = sum(m); return [0, 1].map(k => sum(m.map((mi, i) => mi * p[2 * i + k])) / M); }
// the centre of mass put at rest at 0; returns where it was
function recentre(st) {
  const M = sum(st.m), c = com(st.m, st.p), w = com(st.m, st.v);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) { st.p[2 * i + k] -= c[k]; st.v[2 * i + k] -= w[k]; }
  return c;
}
// numbers for people: 0.00012 as 1.2×10⁻⁴
const sup = s => s.replace(/×10\^\+?(-?\d+)/, (_, e) => '×10' + [...e].map(ch => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)]).join(''));
const fmt = (x, d = 3) => { const a = Math.abs(x); return a === 0 ? '0' : a >= 1e4 || a < 1e-3 ? sup(x.toExponential(1).replace('e', '×10^')) : Number(x.toPrecision(d)).toString(); };
const nice = fmt;

function startRun(keepView = false) {
  sys?.free(); twin?.free();
  sys = new System(start.m, start.p, start.v, EPS);
  twin = sys.copy(); twin.nudge_velocity(0, NUDGE);
  trails = [[], [], []]; twinTrails = [[], [], []];
  stalled = false; gone = -1; E0 = sys.totals()[0];
  if (!keepView) { zoom = view; cam = com(start.m, start.p); }
  massUI(); prepare();
}
function load(name) {
  if (!SETUPS[name] || name === 'custom') name = 'eight';
  setup = name; $('setup').value = name;
  const s = Array.from(preset(name));
  start = { m: s.slice(0, 3), p: s.slice(3, 9), v: s.slice(9) };
  const S = SETUPS[name]; view = S.view; $('rate').value = Math.log2(S.rate); rateLabel();
  $('note').textContent = S.note; $('setup').querySelector('[value=custom]').hidden = true;
  fitArrows(); startRun();
}
// the velocity arrows: drawn as where the body would be after arrowK time units without any pull
function fitArrows() {
  const vmax = Math.max(...[0, 1, 2].map(i => Math.hypot(start.v[2 * i], start.v[2 * i + 1])));
  const typical = Math.sqrt(sum(start.m) / view);
  arrowK = 0.3 * view / Math.max(vmax, 0.5 * typical);
}
// a change made by hand: the toy as it is now, changed by f, becomes the new start
function edit(f, keepView = true) {
  const st = { m: mass(), p: pos(), v: vel() };
  f(st);
  start = st; setup = 'custom';
  const opt = $('setup').querySelector('[value=custom]'); opt.hidden = false; $('setup').value = 'custom';
  $('note').textContent = SETUPS.custom.note;
  startRun(keepView);
}
function settle() {   // after a drag: centre of mass back at rest at 0, without the picture jumping
  const c = recentre(start); cam = [cam[0] - c[0], cam[1] - c[1]];
  startRun(true);
}

// ---------- the controls ----------
const rate = () => 2 ** +$('rate').value;
function rateLabel() { const r = rate(); $('rateVal').textContent = `${r < 1 ? r.toFixed(2) : r.toFixed(1)} time units a second`; }
$('rate').addEventListener('input', rateLabel);
$('setup').addEventListener('change', () => { if ($('setup').value !== 'custom') { load($('setup').value); play(true); } });
$('restart').addEventListener('click', () => { startRun(); play(true); });
$('playBtn').addEventListener('click', () => play(!playing));
function play(on) { playing = on; $('playBtn').textContent = on ? 'Pause' : 'Play'; }
// masses: a slider per body on a log scale, 0.0001 to 10
$('masses').innerHTML = [0, 1, 2].map(i => `<div class="mass"><span class="dot" style="background:${INK[i]}"></span><label>Body ${i + 1}: mass <strong id="mv${i}"></strong><input type="range" id="m${i}" min="-4" max="1" step="0.05" aria-label="Mass of body ${i + 1}"></label></div>`).join('');
function massUI() { for (let i = 0; i < 3; i++) { $('m' + i).value = Math.log10(start.m[i]); $('mv' + i).textContent = fmt(start.m[i], 2); } }
for (let i = 0; i < 3; i++) $('m' + i).addEventListener('input', () => {
  const m = 10 ** +$('m' + i).value;
  if (!(m > 0 && Number.isFinite(m))) return;
  edit(st => { st.m[i] = m; const c = recentre(st); cam = [cam[0] - c[0], cam[1] - c[1]]; });
});

// ---------- the sky ----------
const cv = $('sky'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
const STARS = Array.from({ length: 140 }, (_, i) => [(i * 7919) % W, (i * 104729) % H, ((i * 31) % 3) / 2 + .4]);
const scale = () => (Math.min(W, H) / 2 - 34) / zoom;
const toScreen = (x, y) => { const s = scale(); return [W / 2 + (x - cam[0]) * s, H / 2 - (y - cam[1]) * s]; };
const toWorld = (X, Y) => { const s = scale(); return [cam[0] + (X - W / 2) / s, cam[1] - (Y - H / 2) / s]; };
const radius = (m, ms) => 4 + 9 * Math.cbrt(m / Math.max(...ms));
function arrow(g, x0, y0, x1, y1, col, w = 2.5, head = 9) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round';
  if (L < 1) return;
  const ux = dx / L, uy = dy / L, hh = Math.min(head, L * 0.6);
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - ux * hh * 0.7, y1 - uy * hh * 0.7); g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * hh - uy * hh * 0.5, y1 - uy * hh + ux * hh * 0.5); g.lineTo(x1 - ux * hh + uy * hh * 0.5, y1 - uy * hh - ux * hh * 0.5); g.closePath(); g.fill();
}
// where a body's velocity handle sits on screen: the arrow's tip, or a little to the side when the arrow is short
function handleAt(i, p, v) {
  const [x, y] = toScreen(p[2 * i], p[2 * i + 1]), [tx, ty] = toScreen(p[2 * i] + arrowK * v[2 * i], p[2 * i + 1] + arrowK * v[2 * i + 1]);
  return Math.hypot(tx - x, ty - y) < 22 ? [x + 22, y - 22, true] : [tx, ty, false];
}
function path(g, pts) { g.beginPath(); for (let i = 0; i < pts.length; i += 2) { const [x, y] = toScreen(pts[i], pts[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } }
function draw() {
  const fs = Math.min(2, Math.max(1, W / (cv.clientWidth || W) * 0.6));   // text stays readable when the sky is shown small
  c.clearRect(0, 0, W, H);
  for (const [x, y, r] of STARS) { c.fillStyle = `rgba(255,255,255,${.15 + r * .25})`; c.fillRect(x, y, r, r); }
  const m = mass(), p = pos(), v = vel(), tp = Array.from(twin.positions());
  if ($('trailsOn').checked) for (let i = 0; i < 3; i++) {
    if ($('twin').checked) { c.strokeStyle = COL[i]; c.globalAlpha = .35; c.lineWidth = 1.5; c.setLineDash([4, 5]); path(c, twinTrails[i]); c.stroke(); c.setLineDash([]); }
    c.globalAlpha = .75; c.strokeStyle = COL[i]; c.lineWidth = 2; path(c, trails[i]); c.stroke(); c.globalAlpha = 1;
  }
  const F = Array.from(sys.forces()), fmax = Math.max(1e-12, ...[0, 1, 2].map(i => Math.hypot(F[2 * i], F[2 * i + 1])));
  for (let i = 0; i < 3; i++) {
    const [x, y] = toScreen(p[2 * i], p[2 * i + 1]), r = radius(m[i], m);
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) { offscreen(i, x, y); continue; }
    if ($('twin').checked) { const [a, b] = toScreen(tp[2 * i], tp[2 * i + 1]); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(a, b, r + 3, 0, 7); c.stroke(); }
    if ($('pullsOn').checked) { const f = Math.hypot(F[2 * i], F[2 * i + 1]), L = 70 * Math.sqrt(f / fmax); if (f > 0) arrow(c, x, y, x + F[2 * i] / f * L, y - F[2 * i + 1] / f * L, '#fb7185', 3); }
    // velocity arrow and its handle
    const [hx, hy, side] = handleAt(i, p, v);
    if (!side) arrow(c, x, y, hx, hy, 'rgba(134,239,172,.9)', 2);
    else { c.strokeStyle = 'rgba(134,239,172,.5)'; c.setLineDash([2, 4]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(hx, hy); c.stroke(); c.setLineDash([]); }
    c.strokeStyle = 'rgba(134,239,172,.95)'; c.lineWidth = 2; c.fillStyle = 'rgba(5,8,20,.6)'; c.beginPath(); c.arc(hx, hy, 6, 0, 7); c.fill(); c.stroke();
    const g = c.createRadialGradient(x, y, 0, x, y, r * 2.6); g.addColorStop(0, COL[i]); g.addColorStop(.4, COL[i] + '88'); g.addColorStop(1, COL[i] + '00');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.6, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * 0.55, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = `600 ${15 * fs}px system-ui`; c.fillText(String(i + 1), x - r - 10 - 4 * fs, y - r - 4);
  }
  c.font = `${17 * fs}px system-ui`; c.fillStyle = 'rgba(255,255,255,.7)'; c.fillText(`time ${sys.time().toFixed(1)}`, 16, 12 + 17 * fs);
  // the key: one line on a wide screen, one item per line on a small one
  const key = [['▬ velocity (drag the ring)', 'rgba(134,239,172,.9)', true], ['▬ total pull', '#fb7185', $('pullsOn').checked], ['○ twin, a millionth off', 'rgba(255,255,255,.75)', $('twin').checked]].filter(k => k[2]);
  c.font = `${14 * fs}px system-ui`; let kx = 16, ky = 20 + 36 * fs;
  for (const [t, col] of key) { c.fillStyle = col; c.fillText(t, kx, ky); if (fs > 1.2) ky += 18 * fs; else kx += c.measureText(t).width + 20; }
}
function offscreen(i, x, y) {
  const cx = Math.max(16, Math.min(W - 16, x)), cy = Math.max(16, Math.min(H - 16, y)), a = Math.atan2(y - H / 2, x - W / 2);
  c.fillStyle = COL[i]; c.beginPath(); c.moveTo(cx + 12 * Math.cos(a), cy + 12 * Math.sin(a)); c.lineTo(cx + 8 * Math.cos(a + 2.4), cy + 8 * Math.sin(a + 2.4)); c.lineTo(cx + 8 * Math.cos(a - 2.4), cy + 8 * Math.sin(a - 2.4)); c.fill();
  c.font = `${13 * Math.min(2, Math.max(1, W / (cv.clientWidth || W) * 0.6))}px system-ui`; c.textAlign = x > W / 2 ? 'right' : 'left'; c.fillText(`${i + 1}${gone === i ? ': thrown out' : ''}`, cx + (x > W / 2 ? -14 : 14), cy + (y > H / 2 ? -8 : 16)); c.textAlign = 'left';
}

// body i thrown out for good: far away, and moving off faster than the other two can pull it back
function thrownOut() {
  const m = mass(), p = pos(), v = vel();
  for (let i = 0; i < 3; i++) {
    const [j, k] = [0, 1, 2].filter(q => q !== i), M = m[j] + m[k];
    const cp = [0, 1].map(q => (m[j] * p[2 * j + q] + m[k] * p[2 * k + q]) / M), cvv = [0, 1].map(q => (m[j] * v[2 * j + q] + m[k] * v[2 * k + q]) / M);
    const rx = p[2 * i] - cp[0], ry = p[2 * i + 1] - cp[1], ux = v[2 * i] - cvv[0], uy = v[2 * i + 1] - cvv[1], r = Math.hypot(rx, ry);
    const pair = Math.hypot(p[2 * j] - p[2 * k], p[2 * j + 1] - p[2 * k + 1]);
    if (r > 2 * view && r > 4 * pair && rx * ux + ry * uy > 0 && 0.5 * (ux * ux + uy * uy) - (M + m[i]) / r > 0) return i;
  }
  return -1;
}
let sayAt = 0;
function say(now) {
  if (now - sayAt < 200) return; sayAt = now;
  const t = sys.totals(), drift = Math.abs((t[0] - E0) / E0) * 100;
  let s;
  if (stalled) s = 'Two bodies came closer than this computation can follow. Press Back to the start, or drag a body to start again.';
  else if (gone >= 0) { const [j, k] = [0, 1, 2].filter(q => q !== gone); s = `Body ${gone + 1} has been thrown out for good: it is moving away faster than the others can pull it back. Bodies ${j + 1} and ${k + 1} are left circling each other.`; }
  else if (now - slowmo < 600) s = `Time ${sys.time().toFixed(3)}. Two bodies are passing very close, so the picture slows down while the computer takes tiny steps.`;
  else s = `Time ${sys.time().toFixed(1)}. Total energy ${t[0].toFixed(4)}, steady to ${drift < 1e-4 ? 'better than 0.0001' : fmt(drift, 2)}%.`;
  if ($('twin').checked && !stalled) {
    const gap = sys.distance_to(twin);
    s += gap > 0.3 * view ? ' The twin has gone its own way.' : ` Twin: ${nice(gap, 2)} away.`;
  }
  $('say').textContent = s;
}

// ---------- dragging: a body moves it, the ring at the end of its arrow sets its velocity ----------
function at(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('pointerdown', e => {
  const [X, Y] = at(e), m = mass(), p = pos(), v = vel();
  let best = null, bd = 1e9;
  for (let i = 0; i < 3; i++) {
    const [hx, hy] = handleAt(i, p, v), dh = Math.hypot(X - hx, Y - hy);
    if (dh < 16 && dh < bd) { best = { i, kind: 'v' }; bd = dh; }
    const [x, y] = toScreen(p[2 * i], p[2 * i + 1]), db = Math.hypot(X - x, Y - y);
    if (db < Math.max(18, radius(m[i], m) + 8) && db < bd) { best = { i, kind: 'p' }; bd = db; }
  }
  if (!best) return;
  drag = { ...best, was: playing, moved: false }; play(false); cv.classList.add('dragging'); cv.setPointerCapture(e.pointerId); e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const [x, y] = toWorld(...at(e)), i = drag.i;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  drag.moved = true;
  edit(st => {
    if (drag.kind === 'p') { st.p[2 * i] = x; st.p[2 * i + 1] = y; }
    else { st.v[2 * i] = (x - st.p[2 * i]) / arrowK; st.v[2 * i + 1] = (y - st.p[2 * i + 1]) / arrowK; }
  });
});
const endDrag = () => { if (!drag) return; const { was, moved } = drag; drag = null; cv.classList.remove('dragging'); if (moved) settle(); play(was); };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

// ---------- running ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing && !drag && !stalled) {
    // in fixed pieces of time, so a run comes out the same on every screen and frame rate
    owed = Math.min(owed + dt * rate(), 200 * CHUNK);
    const near = 1.5 / scale();
    // at most about FRAME_STEPS small steps a frame: in a very close pass the bodies go into slow motion instead
    // of freezing the page
    const work0 = sys.steps() + twin.steps();
    while (owed >= CHUNK) {
      const left = FRAME_STEPS - (sys.steps() + twin.steps() - work0);
      const h = Math.min(sys.next_step(), twin.next_step());
      // a whole piece would take too many small steps: move on only as far as this frame's work allows
      const d = 2 * CHUNK / h > left ? Math.max(h, 0.5 * left * h) : CHUNK;
      sys.advance(d); twin.advance(d);
      if (d < CHUNK) { owed = 0; slowmo = now; } else owed -= CHUNK;
      if (sys.stalled()) { stalled = true; play(false); break; }
      const p = sys.positions(), q = twin.positions();
      // a trail point only once the body has moved a pixel or two since the last one
      for (let i = 0; i < 3; i++) for (const [tr, r] of [[trails[i], p], [twinTrails[i], q]]) { const n = tr.length; if (!n || Math.hypot(r[2 * i] - tr[n - 2], r[2 * i + 1] - tr[n - 1]) > near) tr.push(r[2 * i], r[2 * i + 1]); }
    }
    for (const a of [...trails, ...twinTrails]) if (a.length > 5000) a.splice(0, a.length - 4400);
    if (gone < 0 && ((now / 16) | 0) % 8 === 0) gone = thrownOut();
  }
  // follow the centre of mass, and zoom out (up to 2.5 times) to keep the bodies in view
  const m = mass(), p = pos(), cm = com(m, p);
  let far = 0; for (let i = 0; i < 3; i++) if (i !== gone) far = Math.max(far, Math.hypot(p[2 * i] - cm[0], p[2 * i + 1] - cm[1]) * 1.15);
  const want = Math.min(2.5 * view, Math.max(view, far)), k = Math.min(1, dt * 2);
  if (!drag) { zoom += (want - zoom) * k; cam = [cam[0] + (cm[0] - cam[0]) * k, cam[1] + (cm[1] - cam[1]) * k]; }
  draw(); say(now);
  figures(now);
}

// ---------- the step-by-step figures ----------
function fig(id) { const f = $(id), g = f.getContext('2d'); g.clearRect(0, 0, f.width, f.height); return [g, f.width, f.height]; }
const seen = id => { const r = $(id).getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
// a view that fits the given [x, y, x, y, …] into a w×h box with a margin
function fitter(pts, w, h, pad = 40, top = 0) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
  const span = Math.max(x1 - x0, y1 - y0, 1e-9), s = Math.min((w - 2 * pad) / Math.max(x1 - x0, span * 0.05), (h - top - 2 * pad) / Math.max(y1 - y0, span * 0.05));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return (x, y) => [w / 2 + (x - cx) * s, top + (h - top) / 2 - (y - cy) * s];
}
function line(g, pts, V, from = 0, to = pts.length) { g.beginPath(); for (let i = from; i < to; i += 2) { const [x, y] = V(pts[i], pts[i + 1]); i > from ? g.lineTo(x, y) : g.moveTo(x, y); } }
function dot(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
function text(g, s, x, y, col = '#333', font = '13px system-ui') { g.font = font; g.fillStyle = col; g.fillText(s, x, y); }
const SUB = ['₁', '₂', '₃'];
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

let pick = 0, stepH = 0.3, snap1 = null, snap3 = null, cyc1 = -1, cyc3 = -1, data = null;
for (const b of document.querySelectorAll('[data-f1]')) b.addEventListener('click', () => { pick = +b.dataset.f1; for (const o of document.querySelectorAll('[data-f1]')) o.classList.toggle('on', o === b); cyc1 = cyc3 = -1; });
for (const b of document.querySelectorAll('[data-h]')) b.addEventListener('click', () => { stepH = +b.dataset.h; for (const o of document.querySelectorAll('[data-h]')) o.classList.toggle('on', o === b); cyc3 = -1; });
const live = () => ({ m: mass(), p: pos(), v: vel() });

// 1: the two pulls on one body, from the toy as it is at the start of each 7-second cycle
function fig1(now) {
  const cycle = Math.floor(now / 7000), u = (now % 7000) / 7000;
  if (cycle !== cyc1 || !snap1) { snap1 = live(); cyc1 = cycle; }
  const { m, p } = snap1, i = pick, [g, w, h] = fig('ex1'), V = fitter(p, w, h - 70, 80, 0);
  const pl = Array.from(pulls(m, p, EPS, i)), others = [0, 1, 2].filter(j => j !== i);
  const fm = Math.max(Math.hypot(pl[0], pl[1]), Math.hypot(pl[3], pl[4]), 1e-12), S = 120 / fm;
  const [bx, by] = V(p[2 * i], p[2 * i + 1]);
  for (let j = 0; j < 3; j++) { const [x, y] = V(p[2 * j], p[2 * j + 1]); if (j !== i) { g.strokeStyle = '#ccc'; g.setLineDash([4, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(x, y); g.stroke(); g.setLineDash([]); } dot(g, x, y, 4 + 8 * Math.cbrt(m[j] / Math.max(...m)), INK[j]); text(g, `${j + 1}  (m = ${fmt(m[j], 2)})`, x + 12, y - 10, INK[j], '600 13px system-ui'); }
  const a = [pl[0] * S, -pl[1] * S], b = [pl[3] * S, -pl[4] * S];
  const ga = ease(u / 0.22), gb = ease((u - 0.22) / 0.22), slide = ease((u - 0.48) / 0.18), tot = ease((u - 0.7) / 0.15);
  if (ga > 0) arrow(g, bx, by, bx + a[0] * ga, by + a[1] * ga, INK[others[0]], 3.5, 11);
  if (gb > 0) { const ox = bx + a[0] * slide, oy = by + a[1] * slide; arrow(g, ox, oy, ox + b[0] * gb, oy + b[1] * gb, INK[others[1]], 3.5, 11); }
  if (tot > 0) arrow(g, bx, by, bx + (a[0] + b[0]) * tot, by + (a[1] + b[1]) * tot, '#111', 4, 13);
  const lines = others.map((j, n) => { const f = Math.hypot(pl[3 * n], pl[3 * n + 1]), r = pl[3 * n + 2];
    return [`from ${j + 1}:  G·m${SUB[i]}·m${SUB[j]} / r² = 1·${fmt(m[i], 2)}·${fmt(m[j], 2)} / ${fmt(r, 3)}² = ${nice(f, 3)}`, INK[j], n ? gb : ga]; });
  const F = [pl[0] + pl[3], pl[1] + pl[4]], Fm = Math.hypot(F[0], F[1]);
  lines.push([`total (tip to tail): ${nice(Fm, 3)},  so acceleration = ${nice(Fm, 3)} / ${fmt(m[i], 2)} = ${nice(Fm / m[i], 3)}`, '#111', tot]);
  lines.forEach(([s, col, on], n) => { if (on > 0) text(g, s, 14, h - 56 + 20 * n, col, '13px system-ui'); });
  text(g, `Pulls on body ${i + 1}`, 14, 22, '#333', '600 14px system-ui');
}

// 2: two bodies only (the third taken away): Kepler's formula against the step-by-step path
function pair2(st) {
  let best = null;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    const k = Array.from(kepler(st.m[i], st.m[j], st.p[2 * i], st.p[2 * i + 1], st.p[2 * j], st.p[2 * j + 1], st.v[2 * i], st.v[2 * i + 1], st.v[2 * j], st.v[2 * j + 1]));
    // skip pairs that would fall straight in or fly apart, and very light partners (nothing to see)
    if (!(k[4] < 0 && k[1] < 0.95) || Math.min(st.m[i], st.m[j]) / Math.max(st.m[i], st.m[j]) < 1e-3) continue;
    if (!best || k[1] < best.e) best = { i, j, e: k[1] };
  }
  if (best) { const { i, j } = best; return { own: true, i, j, m: [st.m[i], st.m[j]], p: [st.p[2 * i], st.p[2 * i + 1], st.p[2 * j], st.p[2 * j + 1]], v: [st.v[2 * i], st.v[2 * i + 1], st.v[2 * j], st.v[2 * j + 1]] }; }
  return { own: false, i: 0, j: 1, m: [1, 0.5], p: [-0.35, 0, 0.7, 0], v: [0, -0.309, 0, 0.617] };   // e ≈ 0.4
}
function prep2() {
  const q = pair2(start);
  // centre of mass at rest at 0
  const M = q.m[0] + q.m[1];
  for (let k = 0; k < 2; k++) { const c = (q.m[0] * q.p[k] + q.m[1] * q.p[2 + k]) / M, w = (q.m[0] * q.v[k] + q.m[1] * q.v[2 + k]) / M; q.p[k] -= c; q.p[2 + k] -= c; q.v[k] -= w; q.v[2 + k] -= w; }
  const k = Array.from(kepler(q.m[0], q.m[1], q.p[0], q.p[1], q.p[2], q.p[3], q.v[0], q.v[1], q.v[2], q.v[3]));
  const curve = Array.from(kepler_paths(q.m[0], q.m[1], q.p[0], q.p[1], q.p[2], q.p[3], q.v[0], q.v[1], q.v[2], q.v[3], 240, 10));
  const T = k[5], rows = Array.from(run(q.m, q.p, q.v, EPS, 2 * T, T / 200));   // run() stops early if the pair is too slow to follow
  const comp = [[], []]; for (let r = 0; r + 7 <= rows.length; r += 7) { comp[0].push(rows[r + 1], rows[r + 2]); comp[1].push(rows[r + 3], rows[r + 4]); }
  // where the computed path ended up after exactly one lap of the formula's period, against the start
  const back = comp[0].length > 401 ? Math.hypot(comp[0][400] - comp[0][0], comp[0][401] - comp[0][1]) : NaN;
  return { q, k, curve, comp, T, back };
}
function fig2(now) {
  const { q, k, curve, comp, T, back } = data.d2, [g, w, h] = fig('ex2'), V = fitter(curve, w, h - 60, 40, 24);
  const n = curve.length / 4, ci = [INK[q.i], INK[q.j]];
  for (let b = 0; b < 2; b++) { g.strokeStyle = ci[b]; g.globalAlpha = .55; g.lineWidth = 1.5; g.setLineDash([6, 5]); line(g, curve, V, 2 * n * b, 2 * n * (b + 1)); g.closePath(); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
  const N = comp[0].length / 2, u = (now / 1000 / 6) % 1, upto = Math.max(1, Math.floor(u * (N - 1)));
  for (let b = 0; b < 2; b++) { g.strokeStyle = ci[b]; g.lineWidth = 3; line(g, comp[b], V, 0, 2 * upto + 2); g.stroke(); const [x, y] = V(comp[b][2 * upto], comp[b][2 * upto + 1]); dot(g, x, y, 4 + 6 * Math.cbrt(q.m[b] / Math.max(...q.m)), ci[b]); }
  const [ox, oy] = V(0, 0); g.strokeStyle = '#999'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ox - 6, oy); g.lineTo(ox + 6, oy); g.moveTo(ox, oy - 6); g.lineTo(ox, oy + 6); g.stroke();
  text(g, q.own ? `Bodies ${q.i + 1} and ${q.j + 1}, third body taken away` : 'A sample pair (your setup has no pair that would orbit alone)', 12, 18, '#333', '600 13px system-ui');
  text(g, `Formula: ellipse with long radius a = ${fmt(k[0], 3)}, stretch e = ${fmt(k[1], 2)}, one lap every T = ${fmt(T, 3)}`, 12, h - 34, '#555');
  text(g, `Computed: after time T, body ${q.i + 1} is back within ${nice(Math.max(back, 1e-9), 2)} of its start.  Time ${(u * 2 * T).toFixed(2)}`, 12, h - 14, '#555');
}

// 3: kick, drift, kick for one body, from the toy as it is at the start of each cycle
function prep3() {
  const st = snap3, s = new System(st.m, st.p, st.v, EPS), i = pick, N = 6, h = stepH, steps = [];
  for (let n = 0; n < N; n++) {
    const p0 = Array.from(s.positions()), v0 = Array.from(s.velocities());
    s.advance_fixed(h, h);
    const p1 = Array.from(s.positions());
    steps.push({ p0: [p0[2 * i], p0[2 * i + 1]], v0: [v0[2 * i], v0[2 * i + 1]], p1: [p1[2 * i], p1[2 * i + 1]] });
  }
  s.free();
  const t = new System(st.m, st.p, st.v, EPS), truth = [st.p[2 * i], st.p[2 * i + 1]];
  for (let n = 0; n < 120 && t.steps() < FIG_STEPS; n++) { t.advance(N * h / 120); const q = t.positions(); truth.push(q[2 * i], q[2 * i + 1]); }
  t.free();
  const end = steps[N - 1].p1, miss = Math.hypot(end[0] - truth[truth.length - 2], end[1] - truth[truth.length - 1]);
  return { steps, truth, miss, i, N, h };
}
let d3 = null;
function fig3(now) {
  const per = 1100, N = 6, total = N * per + 2200, cycle = Math.floor(now / total), tt = now % total;
  if (cycle !== cyc3 || !d3) { snap3 = live(); cyc3 = cycle; d3 = prep3(); }
  const { steps, truth, miss, i, h } = d3, [g, w, H3] = fig('ex3');
  const all = [...truth]; for (const s of steps) all.push(s.p0[0] + h * s.v0[0], s.p0[1] + h * s.v0[1], ...s.p1);
  const V = fitter(all, w, H3 - 50, 46, 26);
  g.strokeStyle = '#bbb'; g.lineWidth = 6; g.lineCap = 'round'; line(g, truth, V); g.stroke();
  const k = Math.min(N, Math.floor(tt / per)), u = (tt % per) / per;
  for (let n = 0; n <= Math.min(k, N - 1); n++) {
    const s = steps[n], [x0, y0] = V(...s.p0), [gx, gy] = V(s.p0[0] + h * s.v0[0], s.p0[1] + h * s.v0[1]), [x1, y1] = V(...s.p1);
    const done = n < k, a = done ? 1 : ease(u / 0.3), b = done ? 1 : ease((u - 0.33) / 0.3), cc = done ? 1 : ease((u - 0.66) / 0.3);
    if (a > 0) { g.globalAlpha = done ? .45 : 1; arrow(g, x0, y0, x0 + (gx - x0) * a, y0 + (gy - y0) * a, '#16a34a', 2.5, 9); }
    if (b > 0) arrow(g, gx, gy, gx + (x1 - gx) * b, gy + (y1 - gy) * b, '#db2777', 2.5, 9);
    g.globalAlpha = 1;
    if (cc > 0) arrow(g, x0, y0, x0 + (x1 - x0) * cc, y0 + (y1 - y0) * cc, '#2563eb', 3.5, 11);
    dot(g, x0, y0, 5, INK[i]);
    if (done || cc >= 1) dot(g, x1, y1, 5, INK[i]);
  }
  text(g, `Body ${i + 1}, step size h = ${h}`, 12, 18, '#333', '600 13px system-ui');
  text(g, '▬ h · velocity (no pull)', 12, H3 - 32, '#16a34a'); text(g, '▬ what the pulls add', 180, H3 - 32, '#db2777'); text(g, '▬ the step taken', 340, H3 - 32, '#2563eb'); text(g, '▬ true path', 470, H3 - 32, '#999');
  text(g, k >= N ? `After ${N} steps (time ${(N * h).toFixed(2)}), the computed body is ${nice(miss, 2)} from the true path.` : `Step ${k + 1} of ${N}`, 12, H3 - 12, '#333');
}

// 4–6 use the starting setup and are worked out again when it changes
function busiest(rows, n) {   // the body that moves furthest in a run (rows of 9 numbers)
  const L = [0, 0, 0];
  for (let r = 9; r + 9 <= rows.length && r < n * 9; r += 9) for (let i = 0; i < 3; i++) L[i] += Math.hypot(rows[r + 1 + 2 * i] - rows[r - 8 + 2 * i], rows[r + 2 + 2 * i] - rows[r - 7 + 2 * i]);
  return L.indexOf(Math.max(...L));
}
function prep4() {
  const T = SETUPS[setup].T, ref = Array.from(run(start.m, start.p, start.v, EPS, T, T / 400)), b = busiest(ref, 401);
  const hs = [0.2, 0.1, 0.05], runs = hs.map(h => Array.from(run_fixed(start.m, start.p, start.v, EPS, T, T / 400, h)));
  const body = rows => { const o = []; for (let r = 0; r + 9 <= rows.length; r += 9) o.push(rows[r + 1 + 2 * b], rows[r + 2 + 2 * b]); return o; };
  const err = rows => Math.abs((rows[rows.length - 2] - rows[7]) / rows[7]) * 100;
  return { T, b, ref: body(ref), runs: runs.map(body), hs, errs: runs.map(err) };
}
function fig4(now) {
  const { T, b, ref, runs, hs, errs } = data.d4, [g, w, h] = fig('ex4');
  const V = fitter(ref, w, h - 80, 30, 24), N = ref.length / 2, u = Math.min(1, ((now / 1000) % 9) / 7), upto = Math.max(1, Math.floor(u * (N - 1)));
  g.save(); g.beginPath(); g.rect(0, 22, w, h - 98); g.clip();
  g.strokeStyle = '#ccc'; g.lineWidth = 6; g.lineCap = 'round'; line(g, ref, V, 0, 2 * upto + 2); g.stroke();
  const cols = ['#dc2626', '#ea580c', '#2563eb'];
  runs.forEach((r, n) => { const k = Math.min(upto, r.length / 2 - 1); g.strokeStyle = cols[n]; g.lineWidth = 2; line(g, r, V, 0, 2 * k + 2); g.stroke(); const [x, y] = V(r[2 * k], r[2 * k + 1]); dot(g, x, y, 4, cols[n]); });
  g.restore();
  text(g, `Body ${b + 1} from your starting setup, time 0 to ${(u * T).toFixed(1)}`, 12, 16, '#333', '600 13px system-ui');
  hs.forEach((hh, n) => text(g, `▬ h = ${hh}:  energy off by ${errs[n] > 1000 || !Number.isFinite(errs[n]) ? 'over 1000%' : nice(errs[n], 2) + '%'} at the end`, 12, h - 62 + 18 * n, cols[n]));
  text(g, '▬ tiny adaptive steps (the toy)', 330, h - 62, '#999');
}
function prep5() {
  const T = SETUPS[setup].Tg, stride = T / 500;
  const a = new System(start.m, start.p, start.v, EPS); a.nudge_velocity(0, NUDGE); const v2 = Array.from(a.velocities()); a.free();
  const A = Array.from(run(start.m, start.p, start.v, EPS, T, stride)), B = Array.from(run(start.m, start.p, v2, EPS, T, stride));
  const n = Math.min(A.length, B.length) / 9, gap = [];
  for (let r = 0; r < n; r++) { let s = 0; for (let k = 1; k <= 6; k++) s += (A[9 * r + k] - B[9 * r + k]) ** 2; gap.push(Math.sqrt(s)); }
  const b = busiest(A, n), pa = [], pb = []; for (let r = 0; r < n; r++) { pa.push(A[9 * r + 1 + 2 * b], A[9 * r + 2 + 2 * b]); pb.push(B[9 * r + 1 + 2 * b], B[9 * r + 2 + 2 * b]); }
  return { T, stride, gap, pa, pb, b, n };
}
let eightGap = null;
function fig5(now) {
  const { T, stride, gap, pa, pb, b, n } = data.d5, [g, w, h] = fig('ex5'), top = 250;
  const u = Math.min(1, ((now / 1000) % 12) / 10), k = Math.max(1, Math.floor(u * (n - 1)));
  // top: the busiest body in both copies, and the gap between them now
  const V = fitter(pa.slice(0, 2 * k + 2).concat(pb.slice(0, 2 * k + 2)), w, top, 26, 20);
  g.strokeStyle = INK[b]; g.lineWidth = 2; line(g, pa, V, Math.max(0, 2 * k - 600), 2 * k + 2); g.stroke();
  g.strokeStyle = '#333'; g.lineWidth = 1.5; g.setLineDash([4, 4]); line(g, pb, V, Math.max(0, 2 * k - 600), 2 * k + 2); g.stroke(); g.setLineDash([]);
  const [ax, ay] = V(pa[2 * k], pa[2 * k + 1]), [bx, by] = V(pb[2 * k], pb[2 * k + 1]);
  g.strokeStyle = '#dc2626'; g.lineWidth = 3; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  dot(g, ax, ay, 6, INK[b]); g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, 7, 0, 7); g.stroke();
  text(g, `Body ${b + 1}: solid as started, dashed with body 1 a millionth faster`, 12, 16, '#333', '600 13px system-ui');
  // bottom: the gap, one line up = ten times bigger
  const L = 40, R = w - 14, Y0 = top + 20, Y1 = h - 26, lo = -7, hi = 1, X = t => L + (R - L) * t / T, Y = gp => Y1 - (Y1 - Y0) * (Math.log10(Math.max(gp, 1e-7)) - lo) / (hi - lo);
  g.font = '11px system-ui';
  for (let e = lo; e <= hi; e++) { g.strokeStyle = e === -6 ? '#bbb' : '#eee'; g.lineWidth = 1; g.beginPath(); g.moveTo(L, Y(10 ** e)); g.lineTo(R, Y(10 ** e)); g.stroke(); g.fillStyle = '#888'; g.fillText(sup(`10^${e}`.replace('10^', '×10^')).replace('×', ''), 6, Y(10 ** e) + 4); }
  g.fillText('time →', R - 40, Y1 + 16); g.fillText('gap (log scale)', L + 4, Y0 - 6);
  if (setup !== 'eight' && eightGap) { g.strokeStyle = '#bbb'; g.lineWidth = 2; g.beginPath(); eightGap.forEach((gp, r) => { const x = X(r * stride), y = Y(gp); r ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.fillStyle = '#999'; g.fillText('figure eight, for comparison', R - 170, Y(eightGap[eightGap.length - 1]) - 6); }
  g.strokeStyle = '#dc2626'; g.lineWidth = 2.5; g.beginPath(); for (let r = 0; r <= k; r++) { const x = X(r * stride), y = Y(gap[r]); r ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  dot(g, X(k * stride), Y(gap[k]), 5, '#dc2626');
  text(g, `time ${(k * stride).toFixed(1)}: gap ${nice(gap[k], 2)}  (${gap[k] > 1e-12 ? nice(gap[k] / NUDGE, 2) : 0} times the nudge)`, L + 4, h - 6, '#dc2626');
}
function prep6() {
  const T = SETUPS[setup].T * 1.5, n = 300, s = new System(start.m, start.p, start.v, EPS), rows = [];
  const m = start.m, pairs = [[0, 1], [0, 2], [1, 2]];
  for (let r = 0; r <= n; r++) {
    if (r) s.advance(T / n);
    const p = s.positions(), v = s.velocities();
    const ke = [0, 1, 2].map(i => 0.5 * m[i] * (v[2 * i] ** 2 + v[2 * i + 1] ** 2));
    const pe = pairs.map(([i, j]) => -m[i] * m[j] / Math.sqrt((p[2 * j] - p[2 * i]) ** 2 + (p[2 * j + 1] - p[2 * i + 1]) ** 2 + EPS * EPS));
    rows.push({ t: s.time(), ke, pe, K: sum(ke), P: sum(pe) });
    if (s.stalled() || s.steps() > FIG_STEPS) break;
  }
  s.free();
  const E = rows[0].K + rows[0].P, med = rows.map(r => -r.P).sort((a, b) => a - b)[rows.length >> 1];
  return { T, rows, top: Math.max(1.4 * Math.abs(E), 1.6 * med, 1e-9) };
}
function fig6(now) {
  const { T, rows, top } = data.d6, [g, w, h] = fig('ex6'), L = 44, R = 380, Y0 = 34, Y1 = h - 50, mid = (Y0 + Y1) / 2;
  const X = t => L + (R - L) * t / T, Y = e => mid - (Y1 - Y0) / 2 * e / top;
  const n = rows.length, u = ((now / 1000) % 10) / 10, k = Math.min(n - 1, Math.floor(u * n));
  g.strokeStyle = '#999'; g.lineWidth = 1; g.beginPath(); g.moveTo(L, mid); g.lineTo(R, mid); g.stroke(); text(g, '0', L - 14, mid + 4, '#888', '11px system-ui');
  g.save(); g.beginPath(); g.rect(L, Y0 - 4, R - L + 2, Y1 - Y0 + 8); g.clip();
  for (const [f, col, lw] of [[r => r.K, '#16a34a', 2], [r => r.P, '#7c3aed', 2], [r => r.K + r.P, '#111', 3]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); rows.forEach((r, q) => { const x = X(r.t), y = Y(f(r)); q ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(220,38,38,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(rows[k].t), Y0); g.lineTo(X(rows[k].t), Y1); g.stroke();
  text(g, '▬ movement', L, Y1 + 22, '#16a34a'); text(g, '▬ gravity', L + 100, Y1 + 22, '#7c3aed'); text(g, '▬ total', L + 190, Y1 + 22, '#111'); text(g, 'time →', R - 40, Y1 + 22, '#888');
  // the bars at the marked moment: movement stacked by body, gravity stacked by pair, then their sum
  const r = rows[k], bw = 46, x1 = 410, x2 = 470, x3 = 530;
  let y = mid; r.ke.forEach((e, i) => { const hgt = Y(0) - Y(e); g.fillStyle = INK[i]; g.fillRect(x1, Math.max(Y0 - 4, y - hgt), bw, Math.min(hgt, y - Y0 + 4)); y -= hgt; });
  y = mid; const pc = ['#a78bfa', '#7c3aed', '#4c1d95']; r.pe.forEach((e, q) => { const hgt = Y(e) - Y(0); g.fillStyle = pc[q]; g.fillRect(x2, y, bw, Math.max(0, Math.min(hgt, Y1 + 4 - y))); y += hgt; });
  const E = r.K + r.P; g.fillStyle = '#111'; g.fillRect(x3, Math.min(mid, Y(E)), bw, Math.abs(Y(E) - mid));
  g.font = '12px system-ui'; g.fillStyle = '#333'; g.textAlign = 'center';
  g.fillText('movement', x1 + bw / 2, 16); g.fillText('gravity', x2 + bw / 2, 16); g.fillText('total', x3 + bw / 2, 16);
  g.fillText(fmt(r.K, 3), x1 + bw / 2, h - 30); g.fillText(fmt(r.P, 3), x2 + bw / 2, h - 30); g.fillText(fmt(E, 4), x3 + bw / 2, h - 30);
  g.fillText('+', (x1 + bw + x2) / 2, h - 30); g.fillText('=', (x2 + bw + x3) / 2, h - 30); g.textAlign = 'left';
  text(g, `time ${r.t.toFixed(1)}`, L, 18, '#333', '600 13px system-ui');
}

let prepTimer = 0;
function prepare() {
  clearTimeout(prepTimer);
  prepTimer = setTimeout(() => {
    data = { d2: prep2(), d4: prep4(), d5: prep5(), d6: prep6() };
    cyc1 = cyc3 = -1;
    $('cap2').textContent = data.d2.q.own ? `Bodies ${data.d2.q.i + 1} and ${data.d2.q.j + 1} from your starting setup, with the third taken away. Dashed: Kepler's formula. Solid: computed step by step.` : 'Your setup has no pair that would orbit on its own, so this is a sample pair. Dashed: the formula. Solid: computed step by step.';
    $('cap4').textContent = `Body ${data.d4.b + 1} from your starting setup, computed with fixed steps of 0.2, 0.1 and 0.05, against the toy's tiny adaptive steps (grey).`;
    $('cap5').textContent = `Top: body ${data.d5.b + 1} in both copies, the gap drawn in red. Bottom: the gap between the two copies (all three bodies) over time.`;
  }, drag ? 400 : 60);
}

function figures(now) {
  if (!data) return;
  for (const [id, f] of [['ex1', fig1], ['ex2', fig2], ['ex3', fig3], ['ex4', fig4], ['ex5', fig5], ['ex6', fig6]]) if (seen(id)) f(now);
}

// ---------- Try this ----------
const TRY = {
  eight: () => { load('eight'); $('twin').checked = true; },
  pyth: () => { load('pythagorean'); $('twin').checked = true; },
  tri: () => { load('lagrange'); $('twin').checked = false; },
  moon: () => { load('sun-planet-moon'); edit(st => { st.m[2] = 0.004; recentre(st); }, false); },
};
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[b.dataset.try]?.(); play(true); $('play').scrollIntoView({ behavior: 'smooth' }); });

{ const s = Array.from(preset('eight')), sy = new System(s.slice(0, 3), s.slice(3, 9), s.slice(9), EPS), tw = sy.copy(); tw.nudge_velocity(0, NUDGE);
  eightGap = []; for (let r = 0; r <= 500; r++) { if (r) { sy.advance(60 / 500); tw.advance(60 / 500); } eightGap.push(sy.distance_to(tw)); } sy.free(); tw.free(); }
load('eight');
requestAnimationFrame(frame);
window.__threebody = { get sys() { return sys; }, get data() { return data; }, load, get setup() { return setup; } };

// Together (together/share.js): the starting setup, and where the bodies are and how they move now
share(() => ({ s: setup, start: [...start.m, ...start.p, ...start.v], now: [...mass(), ...pos(), ...vel()], t: sys.time() }), st => {
  const a = nums(st?.start, 15), b = nums(st?.now, 15);
  if (!a || !b || a.length !== 15 || b.length !== 15 || !Number.isFinite(st.t)) return;
  const ok = q => q.slice(0, 3).every(m => m > 0 && m <= 100) && q.slice(3).every(x => Math.abs(x) < 1e4);
  if (!ok(a) || !ok(b)) return;
  setup = SETUPS[st.s] ? st.s : 'custom';
  $('setup').querySelector('[value=custom]').hidden = setup !== 'custom'; $('setup').value = setup;
  $('note').textContent = SETUPS[setup].note;
  if (setup !== 'custom') view = SETUPS[setup].view;
  start = { m: a.slice(0, 3), p: a.slice(3, 9), v: a.slice(9) };
  fitArrows(); startRun(true);
  sys.free(); twin.free();
  sys = new System(b.slice(0, 3), b.slice(3, 9), b.slice(9), EPS); sys.set_time(Math.max(0, st.t));
  twin = sys.copy(); twin.nudge_velocity(0, NUDGE);
  const s0 = new System(start.m, start.p, start.v, EPS); E0 = s0.totals()[0]; s0.free();
});
