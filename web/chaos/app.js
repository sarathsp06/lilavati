// The chaos page: two runs of Lorenz's three equations a hair apart (Rust: pkg/lilavati.js, chaos module), seen in 3D,
// the gap between them on a log chart, a "weather forecast" of twenty runs, and the step-by-step figures below.
import init, { Flock, settled_start, skeleton, lorenz_rates, rk4_stages, separation, growth_rate, trajectory, logistic_iterate, logistic_bifurcation } from '../pkg/lilavati.js';
import { share } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const RHO = 28, H = 0.005, L = 40, LAMBDA = 0.906, CLOUD = 20;
const T2 = Math.LN2 / LAMBDA;                       // doubling time from the long-run growth rate
const COL = { a: '#f97316', b: '#22d3ee', bInk: '#0891b2', x: '#dc2626', y: '#16a34a', z: '#2563eb', grey: 'rgba(0,0,0,.16)', ink: '#1f2937' };

// ---------- helpers ----------
const sup = n => String(n).replace(/-/g, '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
function small(e) {                                 // a small number people can read
  if (Math.abs(e - 1e-6) < 1e-12) return 'a millionth';
  if (e >= 0.001) return String(+e.toPrecision(2));
  const k = Math.floor(Math.log10(e) + 1e-9), m = e / 10 ** k;
  return `${Math.abs(m - 1) < 0.05 ? '' : m.toFixed(1) + '×'}10${sup(k)}`;
}
const fix = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const epsOf = s => 10 ** (-6 + s / 10);             // slider 0..60: a millionth .. 1
const tpsOf = s => 0.1 * 10 ** (s / 50);            // slider 0..100: 0.1 .. 10 time units a second
// a camera on the butterfly: turn by yaw about the up (z) axis, tilt by pitch; centre (0, 0, 25)
function camera(yaw, pitch, scale, cx, cy) {
  const cy_ = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (x, y, z) => { const u = x * cy_ - y * sy, d = x * sy + y * cy_; return [cx + scale * u, cy - scale * ((z - 25) * cp + d * sp)]; };
}
function polyline(c, pts, P, step = 1, from = 0, to = pts.length / 3) {
  c.beginPath();
  for (let i = from; i < to; i += step) { const [x, y] = P(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]); i === from ? c.moveTo(x, y) : c.lineTo(x, y); }
  c.stroke();
}
function arrow(c, x0, y0, x1, y1, col, w = 2.5, head = 9) {
  const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
  c.strokeStyle = c.fillStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  if (len < 3) return;
  const hd = Math.min(head, len * 0.5);
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - hd * Math.cos(a - 0.4), y1 - hd * Math.sin(a - 0.4)); c.lineTo(x1 - hd * Math.cos(a + 0.4), y1 - hd * Math.sin(a + 0.4)); c.closePath(); c.fill();
}
const dot = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
function text(c, s, x, y, col = COL.ink, font = '13px system-ui', align = 'left') { c.fillStyle = col; c.font = font; c.textAlign = align; c.fillText(s, x, y); c.textAlign = 'left'; }
// three little axes at screen point (ox, oy), the longest `len` pixels, turned like the picture
function axes(c, P, ox, oy, len) {
  const [a0, b0] = P(0, 0, 0), s = len / Math.max(...[[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(d => { const [a, b] = P(...d); return Math.hypot(a - a0, b - b0); }), 1e-9);
  for (const [d, col, name] of [[[1, 0, 0], COL.x, 'x'], [[0, 1, 0], COL.y, 'y'], [[0, 0, 1], COL.z, 'z']]) {
    const [a1, b1] = P(...d), ex = ox + (a1 - a0) * s, ey = oy + (b1 - b0) * s;
    arrow(c, ox, oy, ex, ey, col, 1.5, 6); text(c, name, ex + 4, ey - 2, col, '12px system-ui');
  }
}
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - (1 - u) ** 3);

// ---------- the run ----------
const START = Array.from(settled_start(20));       // a point already on the butterfly: every run starts here
const SKEL = skeleton(RHO, 20, 5000, 4);            // a long run for the grey butterfly behind
const space = $('space'), sc = space.getContext('2d');
let flock = null, forecast = false, playing = true, last = 0, view = { yaw: -0.6, pitch: 0.2 };
let trails = [], rec = [];                          // trails: per run, flat xyz; rec: [t, gap] for the chart
const TRAIL_AB = 2400, TRAIL_CLOUD = 80;
const eps = () => epsOf(+$('eps').value);

function restart() {
  flock?.free();
  const e = eps();
  if (forecast) { flock = new Flock(CLOUD, RHO); flock.scatter(0, CLOUD, START[0], START[1], START[2], e, 12345); }
  else { flock = new Flock(2, RHO); flock.set(0, ...START); flock.set(1, START[0] + e, START[1], START[2]); }
  trails = Array.from({ length: flock.len() }, () => []);
  rec = []; record(); labels();
}
const gap = () => (forecast ? flock.spread(0, CLOUD)[0] : flock.distance(0, 1));
function record() { rec.push([flock.time(), gap()]); }
function addTrails() {
  const p = flock.positions(), cap = forecast ? TRAIL_CLOUD : TRAIL_AB;
  for (let i = 0; i < trails.length; i++) { const tr = trails[i]; tr.push(p[3 * i], p[3 * i + 1], p[3 * i + 2]); if (tr.length > 3 * cap) tr.splice(0, tr.length - 3 * cap); }
}
// run forward by `steps` RK4 steps, keeping the trails and the chart
function advance(steps) {
  while (steps > 0) { const k = Math.min(2, steps); flock.advance(k, H); steps -= k; addTrails(); }
  record();
}
// jump to model time t from the start (used when someone else's run arrives): same start, same rules, same result
function jumpTo(t) {
  restart();
  const n = Math.round(Math.min(Math.max(t, 0), 3000) / H);
  for (let i = 0; i < n; i += 20) { advance(Math.min(20, n - i)); }
}

function labels() {
  const e = eps();
  $('epsVal').textContent = small(e);
  $('speedVal').textContent = `${+tpsOf(+$('speed').value).toPrecision(2)} time units a second`;
  $('forecast').textContent = forecast ? 'Back to two paths' : 'Weather forecast';
  $('playBtn').textContent = playing ? 'Pause' : 'Play';
  $('chartNote').textContent = forecast
    ? `How spread out the twenty are (typical distance from their middle). They started within ${small(e)} of each other. Each grid line is 10 times the one below.`
    : 'Each grid line is 10 times the one below. A straight climb on this chart means the gap multiplies by the same amount every time unit.';
}

// ---------- drawing the 3D view ----------
function drawSpace() {
  const W = space.width, Hh = space.height, P = camera(view.yaw, view.pitch, 11, W / 2, Hh / 2 + 10);
  sc.fillStyle = '#0b1020'; sc.fillRect(0, 0, W, Hh);
  sc.strokeStyle = 'rgba(148,163,184,.14)'; sc.lineWidth = 1; polyline(sc, SKEL, P, 1);
  // the axes, small, in a corner
  axes(sc, P, 120, Hh - 80, 70);
  const p = flock.positions();
  if (!forecast) {
    for (const [i, col] of [[1, COL.b], [0, COL.a]]) {
      const tr = trails[i], n = tr.length / 3;
      sc.lineWidth = 2;
      // older parts fainter
      for (let s = 0; s < 4; s++) { const from = Math.floor(n * s / 4), to = Math.min(n, Math.floor(n * (s + 1) / 4) + 1); if (to - from < 2) continue; sc.strokeStyle = col; sc.globalAlpha = 0.25 + 0.22 * s; polyline(sc, tr, P, 1, from, to); }
      sc.globalAlpha = 1;
      const [x, y] = P(p[3 * i], p[3 * i + 1], p[3 * i + 2]);
      sc.shadowColor = col; sc.shadowBlur = 14; dot(sc, x, y, 6, col); sc.shadowBlur = 0;
    }
  } else {
    for (let i = 0; i < CLOUD; i++) {
      const col = `hsl(${30 + 170 * i / CLOUD} 90% 62%)`;
      sc.strokeStyle = col; sc.globalAlpha = 0.55; sc.lineWidth = 1.5; if (trails[i].length >= 6) polyline(sc, trails[i], P);
      sc.globalAlpha = 1; const [x, y] = P(p[3 * i], p[3 * i + 1], p[3 * i + 2]); dot(sc, x, y, 4, col);
    }
  }
  const t = flock.time(), g = gap();
  $('say').innerHTML = forecast
    ? `t = <b>${t.toFixed(1)}</b> · the twenty are spread over <b>${g < 0.01 ? small(g) : g.toFixed(2)}</b>, ${Math.round(g / eps()).toLocaleString('en')} times their start`
    : `t = <b>${t.toFixed(1)}</b> · gap <b>${g < 0.001 ? small(g) : g.toPrecision(3)}</b>, ${g / eps() < 10 ? (g / eps()).toFixed(1) : Math.round(g / eps()).toLocaleString('en')} times the start`;
}

// ---------- the chart: the gap on a log scale ----------
const chart = $('chart'), cc = chart.getContext('2d');
function drawChart() {
  const W = chart.width, Hh = chart.height, x0 = 44, x1 = W - 12, y0 = 14, y1 = Hh - 30;
  const t = flock.time(), tmin = Math.max(0, t - 40), tmax = Math.max(40, t);
  const lo = Math.min(-6, Math.floor(Math.log10(eps())) - 1), hi = 2;
  const X = v => x0 + (x1 - x0) * (v - tmin) / (tmax - tmin), Y = d => y1 - (y1 - y0) * (Math.log10(Math.max(d, 1e-12)) - lo) / (hi - lo);
  cc.clearRect(0, 0, W, Hh);
  for (let k = lo; k <= hi; k++) { const y = Y(10 ** k); cc.strokeStyle = 'rgba(0,0,0,.07)'; cc.lineWidth = 1; cc.beginPath(); cc.moveTo(x0, y); cc.lineTo(x1, y); cc.stroke(); if ((k - lo) % (hi - lo > 8 ? 2 : 1) === 0) text(cc, k === 0 ? '1' : `10${sup(k)}`, x0 - 6, y + 4, '#64748b', '12px system-ui', 'right'); }
  for (let s = Math.ceil(tmin / 10) * 10; s <= tmax; s += 10) { const x = X(s); cc.strokeStyle = 'rgba(0,0,0,.07)'; cc.beginPath(); cc.moveTo(x, y0); cc.lineTo(x, y1); cc.stroke(); text(cc, String(s), x, y1 + 16, '#64748b', '12px system-ui', 'center'); }
  text(cc, 'time', x1 - 4, y1 - 6, '#64748b', '12px system-ui', 'right');
  cc.setLineDash([5, 4]); cc.strokeStyle = 'rgba(124,45,18,.6)'; cc.beginPath(); cc.moveTo(x0, Y(L)); cc.lineTo(x1, Y(L)); cc.stroke(); cc.setLineDash([]);
  text(cc, 'size of the butterfly', x0 + 6, Y(L) - 5, 'rgba(124,45,18,.8)', '11px system-ui');
  cc.strokeStyle = forecast ? '#7c3aed' : COL.a; cc.lineWidth = 2; cc.beginPath();
  let started = false;
  for (const [tt, d] of rec) { if (tt < tmin) continue; const x = X(tt), y = Y(d); started ? cc.lineTo(x, y) : cc.moveTo(x, y); started = true; }
  cc.stroke();
  text(cc, forecast ? 'spread of the twenty' : 'gap between the two', x0 + 6, y1 - 6, forecast ? '#7c3aed' : '#c2410c', '600 12px system-ui');
}

// ---------- turning the picture ----------
let drag = null;
space.addEventListener('pointerdown', e => { space.setPointerCapture(e.pointerId); drag = [e.clientX, e.clientY]; space.classList.add('dragging'); });
space.addEventListener('pointermove', e => {
  if (!drag) return;
  view.yaw += (e.clientX - drag[0]) * 0.008; view.pitch = Math.max(-1.4, Math.min(1.4, view.pitch + (e.clientY - drag[1]) * 0.008));
  drag = [e.clientX, e.clientY];
});
const endDrag = () => { drag = null; space.classList.remove('dragging'); };
space.addEventListener('pointerup', endDrag); space.addEventListener('pointercancel', endDrag);

// ---------- controls ----------
$('playBtn').addEventListener('click', () => { playing = !playing; labels(); });
$('reset').addEventListener('click', () => { restart(); explainRun(); });
$('forecast').addEventListener('click', () => { forecast = !forecast; restart(); });
$('eps').addEventListener('input', () => { restart(); explainRun(); });
$('speed').addEventListener('input', labels);
let spin = 0;   // seconds left of the slow turn from "Try this"
const TRY = {
  tiny: () => { forecast = false; $('eps').value = 0; restart(); explainRun(); playing = true; },
  big: () => { forecast = false; $('eps').value = 60; restart(); explainRun(); playing = true; },
  cloud: () => { forecast = true; $('eps').value = 30; restart(); explainRun(); playing = true; },
  again: () => { forecast = false; restart(); playing = true; },
  turn: () => { playing = false; spin = 3; },
};
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[b.dataset.try]?.(); labels(); $('play').scrollIntoView({ behavior: 'smooth' }); });

// ---------- the step-by-step figures ----------
// each figure redraws itself every frame while it is on screen, from its own clock (seconds since it last started)
const figs = {}, onScreen = new Set();
const watch = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? onScreen.add(e.target.id) : onScreen.delete(e.target.id); }, { rootMargin: '40px' });
function figure(id, draw, reset = () => {}) { const cv = $(id); figs[id] = { cv, c: cv.getContext('2d'), draw, reset, clock: 0 }; reset(); watch.observe(cv); }
const restartFig = id => { figs[id].clock = 0; figs[id].reset(); };
const A = () => Array.from(flock.get(0));

// 1: the arrow at the orange point, built from its three parts
let p1 = START, cyc1 = 0;
figure('ex1', (c, w, h, s) => {
  const u = s % 8;
  if (Math.floor(s / 8) !== cyc1) { cyc1 = Math.floor(s / 8); if (!forecast) p1 = A(); }
  const [x, y, z] = p1, v = lorenz_rates(x, y, z, RHO), k = 0.1;
  const P = camera(-0.55, 0.3, 5.2, 196, 205);
  c.clearRect(0, 0, w, h);
  c.strokeStyle = COL.grey; c.lineWidth = 1; polyline(c, SKEL, P, 3);
  // little axes
  axes(c, P, 50, h - 70, 34);
  const pts = [[x, y, z], [x + k * v[0], y, z], [x + k * v[0], y + k * v[1], z], [x + k * v[0], y + k * v[1], z + k * v[2]]];
  const S = pts.map(q => P(...q)), parts = [COL.x, COL.y, COL.z];
  for (let i = 0; i < 3; i++) { const e = ease(u - 1 - i); if (e <= 0) continue; const [a0, b0] = S[i], [a1, b1] = S[i + 1]; arrow(c, a0, b0, a0 + (a1 - a0) * e, b0 + (b1 - b0) * e, parts[i], 3); }
  if (u > 4) { const e = ease(u - 4); arrow(c, S[0][0], S[0][1], S[0][0] + (S[3][0] - S[0][0]) * e, S[0][1] + (S[3][1] - S[0][1]) * e, COL.a, 4, 12); }
  dot(c, S[0][0], S[0][1], 6, COL.a);
  text(c, 'Arrows to scale: how far the point goes in 0.1 time units at this speed.', 12, h - 12, '#64748b', '12px system-ui');
  // the sums
  const X0 = 372, mono = '13px ui-monospace, Menlo, monospace', b = '600 13px ui-monospace, Menlo, monospace';
  text(c, 'The orange point now:', X0, 34, COL.ink, '600 13px system-ui');
  text(c, `x = ${fix(x)}   y = ${fix(y)}   z = ${fix(z)}`, X0, 56, COL.ink, mono);
  const rows = [
    ['dx/dt = 10·(y − x)', `= 10·(${fix(y)} − ${fix(x)})`, `= ${fix(v[0], 1)}`, COL.x],
    ['dy/dt = x·(28 − z) − y', `= ${fix(x)}·(28 − ${fix(z)}) − ${fix(y)}`, `= ${fix(v[1], 1)}`, COL.y],
    ['dz/dt = x·y − (8/3)·z', `= ${fix(x)}·${fix(y)} − 2.667·${fix(z)}`, `= ${fix(v[2], 1)}`, COL.z],
  ];
  rows.forEach(([f, sub, res], i) => {
    const y0 = 96 + i * 72, show = u > 1 + i ? 1 : u > 0.5 + i * 0.3 ? 0.4 : 0.15;
    c.globalAlpha = Math.max(show, 0.15); text(c, f, X0, y0, rows[i][3], b);
    if (u > 1 + i) { text(c, sub, X0, y0 + 20, COL.ink, mono); text(c, res, X0, y0 + 40, rows[i][3], b); }
    c.globalAlpha = 1;
  });
  if (u > 4) text(c, `arrow = (${fix(v[0], 1)}, ${fix(v[1], 1)}, ${fix(v[2], 1)})`, X0, 320, COL.a, b);
  if (u > 4.6) text(c, 'red, then green, then blue, tip to tail', X0, 342, '#64748b', '12px system-ui');
}, () => { cyc1 = 0; p1 = flock && !forecast ? A() : START; });

// 2: one Runge–Kutta step, built from four peeks at the arrow
const HD = 0.08;
let rk = null;
function rkSetup() {
  // from the orange point, look ahead for its next sharp turn: there the four peeks differ the most
  const a = flock && !forecast ? A() : START, ahead = trajectory(a[0], a[1], a[2], RHO, H, 301, 1), lag = Math.round(HD / H);
  let best = 0, bi = 0;
  for (let i = 0; i + lag < 301; i++) {
    const u = lorenz_rates(ahead[3 * i], ahead[3 * i + 1], ahead[3 * i + 2], RHO), v = lorenz_rates(ahead[3 * (i + lag)], ahead[3 * (i + lag) + 1], ahead[3 * (i + lag) + 2], RHO);
    const turn = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1))));
    if (turn > best) { best = turn; bi = i; }
  }
  const p = Array.from(ahead.slice(3 * bi, 3 * bi + 3)), steps = [];
  let q = p;
  for (let i = 0; i < 3; i++) { const st = Array.from(rk4_stages(q[0], q[1], q[2], HD, RHO)); steps.push(st); q = st.slice(24, 27); }
  const path = trajectory(p[0], p[1], p[2], RHO, 0.0005, Math.round(3 * HD / 0.0005) + 1, 1);
  rk = { steps, path, P: null };
}
figure('ex2', (c, w, h, s) => {
  if (!rk) rkSetup();
  const per = 5, phase = s / 0.9, n = Math.floor(phase / per);
  if (n >= 3 + 1) { restartFig('ex2'); return; }
  // fit everything (the sample points and the arrow tips) into the picture
  if (!rk.P) {
    const base = camera(-0.55, 0.3, 1, 0, 0), xs = [], ys = [];
    for (const st of rk.steps) for (let j = 0; j < 4; j++) { const q = st.slice(6 * j, 6 * j + 3), k = st.slice(6 * j + 3, 6 * j + 6); for (const r of [q, [q[0] + HD * k[0], q[1] + HD * k[1], q[2] + HD * k[2]]]) { const [a, b] = base(...r); xs.push(a); ys.push(b); } }
    const [ax, bx, ay, by] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const sc_ = Math.min((w - 80) / (bx - ax || 1), (h - 120) / (by - ay || 1));
    const ma = (ax + bx) / 2, mb = (ay + by) / 2;
    rk.P = (x, y, z) => { const [a, b] = base(x, y, z); return [w / 2 + sc_ * (a - ma), h / 2 + 10 + sc_ * (b - mb)]; };
  }
  const P = rk.P;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 6; polyline(c, rk.path, P, 4);
  const col = ['#7c3aed', '#db2777', '#0d9488', '#ca8a04'], name = ['k₁', 'k₂', 'k₃', 'k₄'];
  for (let i = 0; i <= Math.min(n, 2); i++) {
    const st = rk.steps[i], done = i < n, ph = done ? per : phase - i * per;
    const pt = j => st.slice(6 * j, 6 * j + 3), kk = j => st.slice(6 * j + 3, 6 * j + 6);
    const [sx, sy] = P(...pt(0));
    if (!done) {
      for (let j = 0; j < 4; j++) {
        if (ph < j) break;
        const q = pt(j), k = kk(j), e = ease(ph - j), [a, b] = P(...q), [a1, b1] = P(q[0] + HD * k[0], q[1] + HD * k[1], q[2] + HD * k[2]);
        if (j > 0) { c.setLineDash([4, 4]); c.strokeStyle = col[j - 1]; c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(a, b); c.stroke(); c.setLineDash([]); }
        dot(c, a, b, 4, col[j]);
        arrow(c, a, b, a + (a1 - a) * e, b + (b1 - b) * e, col[j], 2, 8);
        const len = Math.hypot(a1 - a, b1 - b) || 1; if (j === Math.min(3, Math.floor(ph))) text(c, name[j], a1 + (a1 - a) / len * 14 - 6, b1 + (b1 - b) / len * 14 + 5, col[j], '600 14px system-ui');
      }
    }
    if (ph >= 4) {
      const [nx, ny] = P(...st.slice(24, 27)), e = ease((ph - 4) * 1.5);
      arrow(c, sx, sy, sx + (nx - sx) * e, sy + (ny - sy) * e, COL.a, done ? 3 : 4.5, 12);
    }
    dot(c, sx, sy, 6, i === 0 ? COL.a : 'rgba(249,115,22,.55)');
  }
  if (n >= 3) { const st = rk.steps[2], [nx, ny] = P(...st.slice(24, 27)); dot(c, nx, ny, 6, COL.a); }
  const j = Math.min(n, 2), ph = phase - j * per;
  const say = n >= 3 ? 'Three steps done. The grey line is the true path: the steps stay on it.'
    : ph < 1 ? `Step ${j + 1}: k₁, the arrow at the start` : ph < 2 ? 'k₂: the arrow half a step along k₁' : ph < 3 ? 'k₃: the arrow half a step along k₂' : ph < 4 ? 'k₄: the arrow a full step along k₃' : 'Move by the average: (k₁ + 2·k₂ + 2·k₃ + k₄) / 6';
  text(c, say, 14, 24, COL.ink, '600 14px system-ui');
  text(c, `Step size h = ${HD} here (the page itself uses ${H}). Arrows show h times each peek.`, 14, h - 14, '#64748b', '12px system-ui');
}, () => { rk = null; });

// 3: the gap on a log chart, the fitted line and its slope
let g3 = null;
function setup3() {
  const d0 = Math.min(eps(), 1e-3), every = 4, n = 2001;
  const sep = separation(START[0], START[1], START[2], d0, 0, 0, RHO, H, n, every);
  const fit = growth_rate(START[0], START[1], START[2], d0, 1, RHO, H, 60);
  let end = n - 1; for (let i = 0; i < n; i++) if (sep[i] > 20) { end = Math.min(n - 1, i + Math.round(3 / (every * H))); break; }
  g3 = { d0, sep, fit, end, dt: every * H };
  $('cap3').textContent = d0 < eps()
    ? `The gap from a start ${small(d0)} apart (your difference, ${small(eps())}, is already past the straight part). Dashed: the fitted line; the triangle reads its slope. One run wobbles; averaged over a very long run the slope is 0.906.`
    : `The gap from your starting difference, ${small(d0)}, on a log scale. Dashed: the fitted line; the triangle reads its slope. One run wobbles; averaged over a very long run the slope is 0.906.`;
}
figure('ex3', (c, w, h, s) => {
  if (!g3) setup3();
  const { d0, sep, fit, end, dt } = g3, [lam, ta, tb, b0] = fit;
  const x0 = 58, x1 = w - 16, y0 = 44, y1 = h - 40, tmax = end * dt;
  const lo = Math.floor(Math.log10(d0)) - 0.3, hi = 2;
  const X = t => x0 + (x1 - x0) * t / tmax, Y = d => y1 - (y1 - y0) * (Math.log10(d) - lo) / (hi - lo), Yln = l => Y(Math.exp(l));
  c.clearRect(0, 0, w, h);
  for (let k = Math.ceil(lo); k <= hi; k++) { const y = Y(10 ** k); c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); text(c, k === 0 ? '1' : `10${sup(k)}`, x0 - 6, y + 4, '#64748b', '12px system-ui', 'right'); }
  for (let t = 0; t <= tmax; t += 5) { text(c, String(t), X(t), y1 + 18, '#64748b', '12px system-ui', 'center'); }
  text(c, 'time', x1, y1 + 32, '#64748b', '12px system-ui', 'right');
  const shown = Math.min(end, Math.floor(s / 4 * end));
  c.strokeStyle = COL.a; c.lineWidth = 2.2; c.beginPath();
  for (let i = 0; i <= shown; i++) { const x = X(i * dt), y = Y(Math.max(sep[i], 1e-12)); i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
  if (s > 4.3 && Number.isFinite(lam)) {
    // the fitted line ln(gap) = b0 + λ·t over the straight part
    c.setLineDash([6, 5]); c.strokeStyle = COL.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X(ta), Yln(b0 + lam * ta)); c.lineTo(X(tb), Yln(b0 + lam * tb)); c.stroke(); c.setLineDash([]);
    if (s > 5.3) {
      // the slope triangle: 1 time unit across, λ up (in ln units)
      const tm = (ta + tb) / 2 - 0.5, ax = X(tm), ay = Yln(b0 + lam * tm), bx = X(tm + 1), by = Yln(b0 + lam * (tm + 1));
      c.strokeStyle = '#7c2d12'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, ay); c.lineTo(bx, by); c.stroke();
      text(c, '1 time unit', (ax + bx) / 2, ay + 16, '#7c2d12', '12px system-ui', 'center');
      text(c, `ln(gap) up by λ = ${lam.toFixed(2)}`, bx + 6, (ay + by) / 2 + 4, '#7c2d12', '600 12px system-ui');
    }
    if (s > 6.3) {
      text(c, `λ = ${lam.toFixed(2)} per time unit, so the gap doubles every T = ln 2 / λ = 0.693 / ${lam.toFixed(2)} = ${(Math.LN2 / lam).toFixed(2)}`, 14, 22, COL.ink, '600 13px system-ui');
    }
  } else if (s > 4.3) text(c, 'No straight part to fit from this start.', 14, 22, COL.ink, '600 13px system-ui');
  if (s > 12) restartFig('ex3');
}, () => { g3 = null; });

// 4: the logistic map as a cobweb, two starts a thousandth apart
const BIF = (() => { const cv = document.createElement('canvas'); cv.width = 240; cv.height = 150; const c = cv.getContext('2d'), b = logistic_bifurcation(2.5, 4, 480, 300, 120); c.fillStyle = 'rgba(30,41,59,.35)'; for (let i = 0; i < b.length; i += 2) c.fillRect((b[i] - 2.5) / 1.5 * 239, 149 - b[i + 1] * 149, 1, 1); return cv; })();
figure('ex4', (c, w, h, s) => {
  const r = +$('rr').value, N = 20, u = Math.min(N, s / 0.45);
  const a = logistic_iterate(r, 0.3, N), b = logistic_iterate(r, 0.301, N);
  const bx = 24, by = 30, S = 340, X = v => bx + S * v, Y = v => by + S * (1 - v);
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; c.strokeRect(bx, by, S, S);
  c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(1), Y(1)); c.stroke();
  c.save(); c.translate(X(0.06), Y(0.06) - 4); c.rotate(-Math.PI / 4); text(c, 'new x = old x', 0, 0, '#64748b', '11px system-ui'); c.restore();
  c.strokeStyle = COL.ink; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 100; i++) { const v = i / 100; i ? c.lineTo(X(v), Y(r * v * (1 - v))) : c.moveTo(X(v), Y(0)); } c.stroke();
  text(c, `new x = ${r.toFixed(2)}·x·(1 − x)`, bx + 6, by + 16, COL.ink, '600 12px system-ui');
  for (const [seq, col] of [[b, COL.bInk], [a, COL.a]]) {
    c.strokeStyle = col; c.lineWidth = 1.4; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(X(seq[0]), Y(0));
    for (let i = 0; i < Math.floor(u); i++) { c.lineTo(X(seq[i]), Y(seq[i + 1])); c.lineTo(X(seq[i + 1]), Y(seq[i + 1])); }
    c.stroke(); c.globalAlpha = 1;
    const k = Math.floor(u); dot(c, X(seq[k]), Y(k ? seq[k] : 0), 4, col);
  }
  text(c, 'x', X(1) - 4, Y(0) + 16, '#64748b', '12px system-ui', 'right');
  // right, top: both runs step by step and their gap
  const rx = 398, rw = w - rx - 12, ty0 = 30, ty1 = 170, XS = n => rx + rw * n / N, YS = v => ty1 - (ty1 - ty0) * v;
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.strokeRect(rx, ty0, rw, ty1 - ty0);
  for (const [seq, col] of [[b, COL.bInk], [a, COL.a]]) { c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i <= Math.floor(u); i++) i ? c.lineTo(XS(i), YS(seq[i])) : c.moveTo(XS(0), YS(seq[0])); c.stroke(); }
  const k = Math.floor(u);
  text(c, `step ${k}: gap ${Math.abs(a[k] - b[k]) < 0.001 ? small(Math.abs(a[k] - b[k])) : Math.abs(a[k] - b[k]).toFixed(3)}`, rx, ty0 - 8, COL.ink, '600 12px system-ui');
  text(c, 'x after each step', rx + rw, ty1 + 14, '#64748b', '11px system-ui', 'right');
  // right, bottom: where the rule ends up for every r
  const fy = 210; c.drawImage(BIF, rx, fy, rw, 150);
  const mx = rx + rw * (r - 2.5) / 1.5; c.strokeStyle = COL.a; c.lineWidth = 2; c.beginPath(); c.moveTo(mx, fy); c.lineTo(mx, fy + 150); c.stroke();
  text(c, '2.5', rx, fy + 166, '#64748b', '11px system-ui'); text(c, '4', rx + rw, fy + 166, '#64748b', '11px system-ui', 'right'); text(c, 'r', rx + rw / 2, fy + 166, '#64748b', '11px system-ui', 'center');
  text(c, 'where x ends up, for each r', rx, fy - 6, '#64748b', '11px system-ui');
  if (s > N * 0.45 + 3) restartFig('ex4');
});
$('rr').addEventListener('input', () => { $('rrVal').textContent = (+$('rr').value).toFixed(2); restartFig('ex4'); });

// 5: the forecast horizon as a staircase of doublings
figure('ex5', (c, w, h, s) => {
  const e = eps(), e2 = e / 10, k1 = Math.log2(L / e), k2 = Math.log2(L / e2);
  const x0 = 64, x1 = w - 20, y0 = 74, y1 = h - 44, tmax = T2 * Math.ceil(k2) * 1.04;
  const lo = Math.log2(e2) - 0.5, hi = Math.log2(L) + 0.8;
  const X = t => x0 + (x1 - x0) * t / tmax, Y = v => y1 - (y1 - y0) * (Math.log2(v) - lo) / (hi - lo);
  c.clearRect(0, 0, w, h);
  for (let k = Math.ceil(lo / Math.log2(10)); k <= hi / Math.log2(10); k++) { const y = Y(10 ** k); c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); text(c, k === 0 ? '1' : `10${sup(k)}`, x0 - 6, y + 4, '#64748b', '12px system-ui', 'right'); }
  for (let t = 0; t <= tmax; t += tmax > 30 ? 10 : 5) text(c, String(t), X(t), y1 + 18, '#64748b', '12px system-ui', 'center');
  text(c, 'time', x1, y1 + 32, '#64748b', '12px system-ui', 'right');
  c.setLineDash([5, 4]); c.strokeStyle = '#7c2d12'; c.beginPath(); c.moveTo(x0, Y(L)); c.lineTo(x1, Y(L)); c.stroke(); c.setLineDash([]);
  text(c, 'L = 40, the size of the butterfly', x1, Y(L) - 6, '#7c2d12', '12px system-ui', 'right');
  const shown = Math.min(Math.ceil(k2), s / 0.22);
  function stairs(start, kk, col, wdt) {
    c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); c.moveTo(X(0), Y(start));
    let v = start, i = 0;
    for (; i < Math.min(Math.ceil(kk), shown); i++) { const nv = Math.min(v * 2, L); c.lineTo(X((i + 1) * T2), Y(v)); c.lineTo(X((i + 1) * T2), Y(nv)); v = nv; }
    c.stroke(); return i;
  }
  stairs(e2, k2, 'rgba(0,0,0,.25)', 1.5);
  const done = stairs(e, k1, COL.a, 2.5);
  dot(c, X(0), Y(e), 5, COL.a); text(c, `ε = ${small(e)}`, X(0) + 8, Y(e) + 16, '#c2410c', '600 12px system-ui');
  if (shown < Math.ceil(k2)) text(c, `doublings so far: ${done}`, x0 + 6, 22, COL.ink, '600 13px system-ui');
  else {
    const hz = T2 * k1;
    c.strokeStyle = COL.a; c.lineWidth = 1; c.beginPath(); c.moveTo(X(hz), Y(L)); c.lineTo(X(hz), y1); c.stroke();
    text(c, `log₂(L / ε) = ${k1.toFixed(1)} doublings × T ${T2.toFixed(2)} = ${hz.toFixed(1)} time units`, x0 + 6, 22, COL.ink, '600 13px system-ui');
    text(c, `ten times better start (grey): ${(T2 * k2).toFixed(1)}, only ${(T2 * (k2 - k1)).toFixed(1)} more`, x0 + 6, 40, '#475569', '12px system-ui');
    text(c, `${hz.toFixed(1)}`, X(hz) + 4, y1 - 6, '#c2410c', '600 12px system-ui');
  }
  if (s > Math.ceil(k2) * 0.22 + 5) restartFig('ex5');
});

// 6: three starts far apart all land on the same butterfly
const FAR = [[-22, -26, 2], [22, 26, 48], [24, -22, 8]], FARCOL = ['#7c3aed', '#059669', '#e11d48'];
const FARPATHS = FAR.map(q => trajectory(q[0], q[1], q[2], RHO, H, 1600, 2));
figure('ex6', (c, w, h, s) => {
  const P = camera(view.yaw, view.pitch, 6.2, w / 2, h / 2 + 8), n = Math.min(1600, Math.floor(s / 9 * 1600));
  c.clearRect(0, 0, w, h);
  c.strokeStyle = COL.grey; c.lineWidth = 1; polyline(c, SKEL, P, 3);
  FARPATHS.forEach((tr, i) => {
    c.strokeStyle = FARCOL[i]; c.lineWidth = 1.6; c.globalAlpha = 0.85; if (n > 1) polyline(c, tr, P, 1, 0, n); c.globalAlpha = 1;
    const [sx, sy] = P(FAR[i][0], FAR[i][1], FAR[i][2]); c.fillStyle = FARCOL[i]; c.fillRect(sx - 6, sy - 6, 12, 12);
    const m = Math.max(0, n - 1), [hx, hy] = P(tr[3 * m], tr[3 * m + 1], tr[3 * m + 2]); dot(c, hx, hy, 5, FARCOL[i]);
  });
  text(c, `t = ${(n * 2 * H).toFixed(1)}`, 14, 24, COL.ink, '600 13px system-ui');
  if (s > 12) restartFig('ex6');
});
const explainRun = () => { restartFig('ex1'); restartFig('ex2'); restartFig('ex3'); restartFig('ex5'); };

// ---------- the clock ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  if (document.hidden) return;
  if (spin > 0) { spin -= dt; view.yaw += dt * 0.9; }
  if (playing) advance(Math.max(1, Math.round(tpsOf(+$('speed').value) * dt / H)));
  drawSpace(); drawChart();
  for (const id of onScreen) { const f = figs[id]; f.clock += dt; f.draw(f.c, f.cv.width, f.cv.height, f.clock); }
}
$('rrVal').textContent = (+$('rr').value).toFixed(2);
restart(); labels();
requestAnimationFrame(frame);
window.__chaos = { get flock() { return flock; }, get forecast() { return forecast; }, get view() { return view; }, figs };

// Together (together/share.js): the run is fixed by its start, the starting gap (a slider) and the time, so only the
// time, the mode, play/pause and the view travel; the other side re-runs the same rules to the same moment.
share(() => ({ t: flock.time(), f: forecast ? 1 : 0, run: playing ? 1 : 0, yaw: view.yaw, pitch: view.pitch }), s => {
  if (!s || typeof s !== 'object') return;
  const { t, f, run, yaw, pitch } = s;
  if (![t, yaw, pitch].every(Number.isFinite) || t < 0 || t > 3000) return;
  view = { yaw, pitch: Math.max(-1.4, Math.min(1.4, pitch)) };
  playing = run !== 0;
  const fc = f === 1;
  if (fc !== forecast || Math.abs(flock.time() - t) > 0.05) { forecast = fc; jumpTo(t); }
  labels();
});
