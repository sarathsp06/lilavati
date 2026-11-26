// The brachistochrone page: three (or four) tracks from A down to B, balls racing on them under gravity,
// and the step-by-step pictures that work out why the cycloid wins. The physics is in Rust
// (src/brachistochrone.rs): positions in metres, x to the right and y *down* from A.
import init, { speed_at_depth, cycloid_params, cycloid_points, line_points, arc_points, slide_time, slide_segment_times, slide_speeds, slide_position, slide_resample, snell_path } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();

const $ = id => document.getElementById(id);
const cv = $('track'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
const PX = 80;                                   // canvas pixels per metre
const A0 = [70, 60], B0 = [470, 340];            // B is 5 m across and 3.5 m down from A
const N = 400;                                   // points per track
const COL = { line: '#475569', arc: '#a855f7', cyc: '#0e7490', mine: '#e11d48', ink: '#1c1917', ink2: '#57534e', grey: 'rgba(0,0,0,.15)', hot: '#ea580c' };
const GRAV = ['9.81', '1.62', '3.71', '24.79'];

let A = [...A0], B = [...B0];
let mine = null;        // your track as fractions of B's offset from A: [u0, w0, u1, w1, …], or null
let g = 9.81;
let tracks = [];        // { key, name, color, pts (metres), T (seconds), len (metres) }
let tr = 0, hold = 0;   // the race clock (seconds of the ball's time) and the pause after a finish
let drawMode = false, stroke = null, drag = null;

const off = () => [(B[0] - A[0]) / PX, (B[1] - A[1]) / PX];
const length = p => { let s = 0; for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return s; };
const byKey = k => tracks.find(t => t.key === k);
const f2 = v => v.toFixed(2);

function mineMetres(bx, by, m = mine) { const p = new Float64Array(m.length); for (let i = 0; i < m.length; i++) p[i] = m[i] * (i % 2 ? by : bx); return p; }
function build() {
  const [bx, by] = off();
  tracks = [
    { key: 'line', name: 'Straight line', color: COL.line, pts: line_points(bx, by, N) },
    { key: 'arc', name: 'Circle arc', color: COL.arc, pts: arc_points(bx, by, N) },
    { key: 'cyc', name: 'Cycloid', color: COL.cyc, pts: cycloid_points(bx, by, N) },
  ];
  if (mine) tracks.push({ key: 'mine', name: 'Yours', color: COL.mine, pts: mineMetres(bx, by) });
  for (const t of tracks) { t.T = slide_time(t.pts, g); t.len = length(t.pts); }
  lastTable = '';
}
function restart() { tr = 0; hold = 0; }

// A and B (and your track) must keep every track inside the picture
function fits(a, b, m = mine) {
  const bx = (b[0] - a[0]) / PX, by = (b[1] - a[1]) / PX;
  if (!(bx >= 0.4 && by >= 0.25) || a[0] < 12 || a[1] < 12 || b[0] > W - 12 || b[1] > H - 12) return false;
  const p = cycloid_params(bx, by);
  const deep = [p[1] > Math.PI ? 2 * p[0] : by, bx > by ? (bx * bx + by * by) / (2 * bx) : by];
  if (m) for (let i = 0; i < m.length; i += 2) {
    deep.push(m[i + 1] * by);
    const x = a[0] + m[i] * bx * PX; if (x < 4 || x > W - 4) return false;
  }
  return a[1] + Math.max(...deep) * PX <= H - 8;
}

// your track: canvas points from A to B → metres, evenly spaced, as fractions of B's offset
function setMineFromMetres(pts) {
  const [bx, by] = off();
  const r = slide_resample(new Float64Array(pts), 160);
  const m = Array.from(r, (v, i) => v / (i % 2 ? by : bx));
  m[0] = 0; m[1] = 0; m[m.length - 2] = 1; m[m.length - 1] = 1;
  mine = fits(A, B, m) ? m : mine;
}
function setMineFromFractions(f) { const [bx, by] = off(); setMineFromMetres(f.map((v, i) => v * (i % 2 ? by : bx))); }

// ---------- dragging A and B, drawing your own ----------
const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
const hitR = () => Math.max(26, 22 * W / cv.getBoundingClientRect().width);
cv.addEventListener('pointerdown', e => {
  const p = pos(e);
  if (drawMode) { e.preventDefault(); cv.setPointerCapture(e.pointerId); stroke = [...A, ...p]; return; }
  const dA = Math.hypot(p[0] - A[0], p[1] - A[1]), dB = Math.hypot(p[0] - B[0], p[1] - B[1]);
  if (Math.min(dA, dB) > hitR()) return;
  e.preventDefault(); cv.setPointerCapture(e.pointerId);
  drag = dB <= dA ? 'B' : 'A';
});
cv.addEventListener('pointermove', e => {
  const p = pos(e);
  if (stroke) { const n = stroke.length; const q = [Math.min(W - 6, Math.max(6, p[0])), Math.min(H - 8, Math.max(A[1], p[1]))]; if (Math.hypot(q[0] - stroke[n - 2], q[1] - stroke[n - 1]) > 4) stroke.push(...q); return; }
  if (!drag) { cv.style.cursor = drawMode ? 'crosshair' : Math.min(Math.hypot(p[0] - A[0], p[1] - A[1]), Math.hypot(p[0] - B[0], p[1] - B[1])) < hitR() ? 'grab' : 'default'; return; }
  const a = drag === 'A' ? p : A, b = drag === 'B' ? p : B;
  if (fits(a, b)) { A = [...a]; B = [...b]; build(); restart(); }
});
const up = () => {
  drag = null;
  if (!stroke) return;
  const s = stroke; stroke = null;
  if (s.length >= 8) {
    const m = [];
    for (let i = 0; i < s.length; i += 2) m.push((s[i] - A[0]) / PX, Math.max(0, (s[i + 1] - A[1]) / PX));
    const [bx, by] = off(); m.push(bx, by);
    setMineFromMetres(m);
    build(); restart();
  }
  setDraw(false);
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
function setDraw(on) { drawMode = on; $('drawBtn').textContent = on ? 'Drawing: drag from A to B' : '✏️ Draw your own'; $('drawBtn').classList.toggle('on', on); }
$('drawBtn').addEventListener('click', () => setDraw(!drawMode));
$('clearBtn').addEventListener('click', () => { mine = null; build(); restart(); });
$('race').addEventListener('click', restart);
$('gravity').addEventListener('change', () => { const v = $('gravity').value; g = GRAV.includes(v) ? +v : 9.81; build(); restart(); });
const tempo = () => [1, 0.5, 0.25].includes(+$('tempo').value) ? +$('tempo').value : 0.5;

// ---------- the race picture ----------
function path(c, pts, m) { c.beginPath(); for (let i = 0; i < pts.length; i += 2) { const [x, y] = m(pts[i], pts[i + 1]); i ? c.lineTo(x, y) : c.moveTo(x, y); } }
const toCanvas = (x, y) => [A[0] + x * PX, A[1] + y * PX];
function drawRace() {
  const k = Math.min(2.4, Math.max(1, 0.6 * W / (cv.clientWidth || W)));   // bigger marks when the picture is small
  ctx.clearRect(0, 0, W, H);
  // a 1 m grid hanging from A
  ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = A[0] % PX; x < W; x += PX) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = A[1] % PX; y < H; y += PX) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(0, A[1]); ctx.lineTo(W, A[1]); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = COL.ink2; ctx.font = `${13 * k}px system-ui`; ctx.fillText('the height of A', A[0] + 22 * k, A[1] - 7);
  // a scale bar: one metre
  const sx = W - PX - 24, sy = H - 18; ctx.strokeStyle = COL.ink2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy); ctx.lineTo(sx + PX, sy); ctx.lineTo(sx + PX, sy - 5); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillText('1 m', sx + PX / 2, sy - 6); ctx.textAlign = 'start';
  for (const t of tracks) { ctx.strokeStyle = t.color; ctx.lineWidth = t.key === 'cyc' ? 4 : 3; path(ctx, t.pts, toCanvas); ctx.stroke(); }
  if (stroke) { ctx.strokeStyle = COL.mine; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); path(ctx, stroke, (x, y) => [x, y]); ctx.stroke(); ctx.setLineDash([]); }
  // the balls
  for (const t of tracks) {
    const [x, y] = slide_position(t.pts, g, tr), [X, Y] = toCanvas(x, y);
    ctx.fillStyle = t.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X, Y, 10 * k, 0, 7); ctx.fill(); ctx.stroke();
  }
  for (const [p, l] of [[A, 'A'], [B, 'B']]) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p[0], p[1], 15 * k, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.ink; ctx.font = `700 ${15 * k}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, p[0], p[1] + 1); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = COL.ink; ctx.font = `600 ${22 * k}px ui-monospace, monospace`; ctx.textAlign = 'right'; ctx.fillText(`${f2(tr)} s`, W - 16, 12 + 22 * k); ctx.textAlign = 'start';
  if (drawMode && !stroke) { ctx.fillStyle = COL.mine; ctx.font = `600 ${18 * k}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('Drag from A to B to draw your track', W / 2, H - 30 - 10 * k); ctx.textAlign = 'start'; }
}

let lastTable = '';
function readouts() {
  const done = tracks.filter(t => Number.isFinite(t.T)), end = Math.max(0, ...done.map(t => t.T));
  const order = [...done].sort((a, b) => a.T - b.T);
  let html = '<tr><th></th><th>Track</th><th>Length</th><th>Time</th></tr>';
  for (const t of tracks) {
    const arrived = tr >= t.T - 1e-9, rank = order.indexOf(t);
    const time = !Number.isFinite(t.T) ? 'never gets there' : arrived ? `${f2(t.T)} s${rank === 0 ? ' 🏁' : ''}` : '…';
    html += `<tr class="${arrived && rank === 0 ? 'win' : ''}"><td><i class="sw" style="background:${t.color}"></i></td><td>${t.name}</td><td>${f2(t.len)} m</td><td>${time}</td></tr>`;
  }
  let verdict = '';
  if (tr >= end && order.length) {
    const c = byKey('cyc'), l = byKey('line'), w = order[0];
    verdict = `${w.name} first. ` + (Number.isFinite(l.T) ? `The cycloid is ${Math.round(100 * (c.len / l.len - 1))}% longer than the straight line and arrives ${f2(l.T - c.T)} s sooner.` : '');
    const m = byKey('mine'); if (m && !Number.isFinite(m.T)) verdict += ' Your ball never reaches B: each sharp corner knocks away the part of its speed that points the wrong way, and no ball can climb back up to the height it started from.';
  }
  const say = drawMode ? 'Drag from A to B on the picture to lay your track.' : tr >= end ? 'Finished: ' + order.map(t => `${t.name.toLowerCase()} ${f2(t.T)} s`).join(', ') + '.' : `Racing in ${tempo() === 1 ? 'real time' : tempo() === 0.5 ? 'half speed' : 'quarter speed'}, g = ${g} m/s².`;
  const key = html + verdict + say;
  if (key === lastTable) return;
  lastTable = key; $('times').innerHTML = html; $('verdict').textContent = verdict; $('say').textContent = say;
}

// ---------- the step-by-step pictures ----------
const visible = new Set();
const io = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id); });
for (const id of ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6']) io.observe($(id));
const clk = { ex1: 0, ex2: 0, ex3: 0, ex6: 0 };

function fig(id) { const c = $(id), x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.font = '13px system-ui'; x.textAlign = 'start'; x.textBaseline = 'alphabetic'; return [x, c.width, c.height]; }
// fit world boxes [x0, y0, x1, y1] (metres, y down) into a canvas box: returns the mapping
function fitWorld(b, X, Y, w, h, pad = 14) {
  const s = Math.min((w - 2 * pad) / (b[2] - b[0] || 1), (h - 2 * pad) / (b[3] - b[1] || 1));
  const ox = X + (w - s * (b[2] - b[0])) / 2 - s * b[0], oy = Y + (h - s * (b[3] - b[1])) / 2 - s * b[1];
  const m = (x, y) => [ox + s * x, oy + s * y]; m.s = s; return m;
}
function bounds(list) { const b = [0, 0, 0, 0]; for (const p of list) for (let i = 0; i < p.length; i += 2) { b[0] = Math.min(b[0], p[i]); b[2] = Math.max(b[2], p[i]); b[1] = Math.min(b[1], p[i + 1]); b[3] = Math.max(b[3], p[i + 1]); } return b; }
function dot(c, [x, y], r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function arrow(c, x, y, dx, dy, col) {
  const L = Math.hypot(dx, dy); if (L < 2) return; const ux = dx / L, uy = dy / L;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx - 8 * ux, y + dy - 8 * uy); c.stroke();
  c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx - 10 * ux - 5 * uy, y + dy - 10 * uy + 5 * ux); c.lineTo(x + dx - 10 * ux + 5 * uy, y + dy - 10 * uy - 5 * ux); c.fill();
}
// where a track first reaches depth y: [x, y, dx, dy] (point and direction there), or null
function atDepth(p, y) {
  for (let i = 2; i < p.length; i += 2) {
    const y0 = p[i - 1], y1 = p[i + 1];
    if ((y0 - y) * (y1 - y) <= 0 && y1 !== y0) { const u = (y - y0) / (y1 - y0); return [p[i - 2] + u * (p[i] - p[i - 2]), y, p[i] - p[i - 2], y1 - y0]; }
  }
  return null;
}

// 1: speed comes only from depth
function step1(dt) {
  const cyc = byKey('cyc'); if (!cyc) return;
  clk.ex1 = (clk.ex1 + dt * 0.5) % (cyc.T + 1.2);
  const [c] = fig('ex1');
  const t = Math.min(clk.ex1, cyc.T), [bx, by, v] = slide_position(cyc.pts, g, t);
  const three = tracks.filter(k => k.key !== 'mine'), m = fitWorld(bounds(three.map(k => k.pts)), 0, 0, 390, 290, 22);
  const deepest = bounds(three.map(k => k.pts))[3];
  for (const k of three) { c.strokeStyle = k.color; c.lineWidth = k.key === 'cyc' ? 3 : 2; c.globalAlpha = k.key === 'cyc' ? 1 : 0.55; path(c, k.pts, m); c.stroke(); }
  c.globalAlpha = 1;
  const [X0, Y0] = m(0, 0), [Xb, Yb] = m(bx, by);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.setLineDash([5, 5]); c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, Y0); c.lineTo(390, Y0); c.moveTo(0, Yb); c.lineTo(390, Yb); c.stroke(); c.setLineDash([]);
  // the depth y, measured from the height of A
  c.strokeStyle = COL.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(12, Y0); c.lineTo(12, Yb); c.stroke();
  c.fillStyle = COL.ink; c.fillText(`y = ${f2(by)} m`, 16, (Y0 + Yb) / 2 + 4);
  // the same speed wherever a track crosses this depth
  const vmax = speed_at_depth(g, deepest), k = 70 / (vmax || 1);
  for (const tk of three) {
    const q = tk.key === 'cyc' ? [bx, by, ...dirAt(cyc.pts, t)] : atDepth(tk.pts, by); if (!q) continue;
    const [x, y] = m(q[0], q[1]), L = Math.hypot(q[2], q[3]) || 1;
    if (v > 0.05) arrow(c, x, y, k * v * q[2] / L, k * v * q[3] / L, tk.color);
    dot(c, [x, y], tk.key === 'cyc' ? 8 : 5, tk.color);
  }
  c.fillStyle = COL.ink; c.font = '600 13px system-ui';
  c.fillText('Arrows: speed where each track is at depth y', 10, 312);
  // the energy bars, per kilogram
  const E = g * deepest || 1, bh = 230, base = 270;
  const bars = [['given up', 'g·y', g * by, '#a8a29e'], ['speed energy', '½·v²', 0.5 * v * v, COL.cyc]];
  bars.forEach(([lab, sym, val, col], i) => {
    const x = 420 + i * 85, hgt = bh * val / E;
    c.fillStyle = '#f1efe9'; c.fillRect(x, base - bh, 60, bh);
    c.fillStyle = col; c.fillRect(x, base - hgt, 60, hgt);
    c.fillStyle = COL.ink; c.font = '600 13px system-ui'; c.textAlign = 'center'; c.fillText(sym, x + 30, base + 18);
    c.font = '12px system-ui'; c.fillText(lab, x + 30, base + 34); c.fillText(`${val.toFixed(1)} J/kg`, x + 30, base - hgt - 6);
  });
  c.textAlign = 'center'; c.font = '600 18px system-ui'; c.fillText('=', 497, base - 40); c.textAlign = 'start';
  c.font = '600 14px system-ui'; c.fillStyle = COL.ink;
  c.fillText(`v = √(2·g·y) = √(2·${g}·${f2(by)}) = ${f2(v)} m/s`, 10, 345);
}
function dirAt(p, t) {   // the direction of travel on a track at time t (from the next point along)
  const t0 = Math.max(0, t - 0.01), [x0, y0] = slide_position(p, g, t0), [x1, y1] = slide_position(p, g, t0 + 0.01);
  return Math.hypot(x1 - x0, y1 - y0) > 1e-9 ? [x1 - x0, y1 - y0] : [p[2] - p[0], p[3] - p[1]];
}

// 2 and 3: cut a track into pieces, time each one as length ÷ average speed, add them up
function pieces(id, capId, tk, n, ghost, key, dt) {
  const [c, w] = fig(id);
  const q = tk.key === 'line' ? line_points(...off(), n + 1) : slide_resample(tk.pts, n + 1);
  const st = slide_segment_times(q, g), gq = ghost ? line_points(...off(), n + 1) : null, gst = gq ? slide_segment_times(gq, g) : null;
  const per = 0.9, total = (n + 3.5) * per;
  clk[key] = (clk[key] + dt) % total;
  const k = Math.min(n, Math.floor(clk[key] / per));             // pieces added so far
  const m = fitWorld(bounds([q, gq || q]), 0, 0, w, 150, 16);
  if (gq) { c.strokeStyle = COL.line; c.globalAlpha = 0.35; c.lineWidth = 2; path(c, gq, m); c.stroke(); c.globalAlpha = 1; }
  for (let i = 0; i < n; i++) {
    const a = m(q[2 * i], q[2 * i + 1]), b = m(q[2 * i + 2], q[2 * i + 3]);
    c.strokeStyle = i < k ? (i % 2 ? tk.color : shade(tk.color)) : 'rgba(0,0,0,.18)'; c.lineWidth = i === k - 1 ? 7 : 4;
    c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
    dot(c, a, 2.5, COL.ink);
  }
  dot(c, m(q[2 * n], q[2 * n + 1]), 2.5, COL.ink);
  // the piece just added, worked out
  c.fillStyle = COL.ink; c.font = '13px system-ui';
  if (k > 0) {
    const i = k - 1, L = Math.hypot(q[2 * i + 2] - q[2 * i], q[2 * i + 3] - q[2 * i + 1]);
    const sp = slide_speeds(q, g), v0 = sp[i], v1 = sp[i + 1];
    const [lx, ly] = m((q[2 * i] + q[2 * i + 2]) / 2, (q[2 * i + 1] + q[2 * i + 3]) / 2);
    c.font = '700 12px system-ui'; c.fillText(String(k), lx + 7, ly - 5); c.font = '13px system-ui';
    c.fillText(Number.isFinite(st[i]) ? `Piece ${k}: ${f2(L)} m ÷ ((${f2(v0)} + ${f2(v1)}) ÷ 2) m/s = ${f2(st[i])} s` : `Piece ${k}: the ball never gets this far.`, 12, 172);
  } else c.fillText('Cutting the track into pieces…', 12, 172);
  // the bars: time for each piece, and the running total
  const fin = [...st, ...(gst || [])].filter(Number.isFinite), mx = Math.max(...fin, 1e-9);
  const X0 = 40, X1 = w - 16, base = 300, top = 190, slot = (X1 - X0) / n;
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X0, top - 4); c.lineTo(X0, base); c.lineTo(X1, base); c.stroke();
  c.save(); c.translate(14, (top + base) / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillStyle = COL.ink2; c.font = '12px system-ui'; c.fillText('time per piece', 0, 0); c.restore();
  let sum = 0, gsum = 0;
  for (let i = 0; i < n; i++) {
    const x = X0 + i * slot + 3, bw = (slot - 6) / (gst ? 2 : 1);
    if (gst && i < k) { const hh = (base - top) * Math.min(1, gst[i] / mx); c.strokeStyle = COL.line; c.lineWidth = 1.5; c.strokeRect(x + bw, base - hh, bw - 2, hh); gsum += gst[i]; }
    if (i < k) {
      const inf = !Number.isFinite(st[i]), hh = inf ? base - top : (base - top) * st[i] / mx;
      c.fillStyle = inf ? COL.hot : i === k - 1 ? tk.color : shade(tk.color); c.fillRect(x, base - hh, bw - 2, hh); sum += st[i];
    }
    c.fillStyle = COL.ink2; c.font = '11px system-ui'; c.textAlign = 'center'; c.fillText(i + 1, X0 + (i + 0.5) * slot, base + 13); c.textAlign = 'start';
  }
  c.fillStyle = COL.ink; c.font = '600 14px system-ui';
  const tot = Number.isFinite(sum) ? `${f2(sum)} s` : '∞';
  c.fillText(`${tk.key === 'line' ? 'Total' : tk.name} after ${k} piece${k === 1 ? '' : 's'}: ${tot}` + (gst ? `   ·   straight line: ${f2(gsum)} s` : ''), 12, 336);
  if (k === n) { c.font = '13px system-ui'; c.fillStyle = COL.ink2; c.fillText(`The race above, with ${N} pieces: ${Number.isFinite(tk.T) ? f2(tk.T) + ' s' : 'never arrives'}`, 12, 355); }
  $(capId).textContent = tk.key === 'line'
    ? `Your straight track in ${n} pieces. Each bar is one piece's length ÷ its average speed; the first ones, near A, are the slow ones.`
    : `${tk.key === 'mine' ? 'Your drawn track' : 'The cycloid (draw your own above to see yours)'} in ${n} pieces, added up the same way. Outlined bars: the straight line's pieces.`;
}
function shade(hex) { const n = parseInt(hex.slice(1), 16); const mix = v => Math.round(v + (255 - v) * 0.45); return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`; }

// 4: speed against time; the area under each curve is the distance
function step4() {
  const [c, w, h] = fig('ex4');
  const fin = tracks.filter(t => Number.isFinite(t.T)); if (!fin.length) return;
  const tMax = Math.max(...fin.map(t => t.T)) * 1.04, deepest = bounds(fin.map(t => t.pts))[3], vMax = speed_at_depth(g, deepest) * 1.08 || 1;
  const X0 = 52, X1 = w - 16, Y0 = 300, Y1 = 26, X = t => X0 + (X1 - X0) * t / tMax, Y = v => Y0 - (Y0 - Y1) * v / vMax;
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X0, Y1 - 10); c.lineTo(X0, Y0); c.lineTo(X1, Y0); c.stroke();
  c.fillStyle = COL.ink2; c.font = '12px system-ui'; c.fillText('time (s)', X1 - 46, Y0 + 28);
  for (let s = 0; s <= tMax; s += tMax > 3 ? 1 : 0.5) { c.fillText(s.toFixed(1), X(s) - 8, Y0 + 14); }
  c.save(); c.translate(16, (Y0 + Y1) / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText('speed (m/s)', 0, 0); c.restore();
  const now = Math.min(tr, tMax);
  fin.forEach((tk, j) => {
    const S = 140, ts = Array.from({ length: S + 1 }, (_, i) => tk.T * i / S), vs = ts.map(t => slide_position(tk.pts, g, t)[2]);
    // shade the area covered so far, and add it up (that is the distance)
    let area = 0;
    c.fillStyle = tk.color; c.globalAlpha = 0.1; c.beginPath(); c.moveTo(X(0), Y0);
    for (let i = 0; i <= S && ts[i] <= now; i++) { c.lineTo(X(ts[i]), Y(vs[i])); if (i) area += (ts[i] - ts[i - 1]) * (vs[i] + vs[i - 1]) / 2; }
    const vNow = slide_position(tk.pts, g, Math.min(now, tk.T))[2], ie = Math.min(now, tk.T), il = Math.floor(ie / tk.T * S);
    area += (ie - ts[il]) * (vNow + vs[il]) / 2;
    c.lineTo(X(ie), Y(vNow)); c.lineTo(X(ie), Y0); c.closePath(); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = tk.color; c.lineWidth = tk.key === 'cyc' ? 3 : 2; c.beginPath(); ts.forEach((t, i) => (i ? c.lineTo(X(t), Y(vs[i])) : c.moveTo(X(t), Y(vs[i])))); c.stroke();
    dot(c, [X(ie), Y(vNow)], 5, tk.color);
    c.fillStyle = tk.color; c.font = '600 12px system-ui';
    c.fillText(`${tk.name}: area so far ${f2(area)} m of ${f2(tk.len)} m${now >= tk.T ? ' ✓' : ''}`, X0 + 10, Y1 + 4 + 16 * j);
  });
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(now), Y1 - 6); c.lineTo(X(now), Y0); c.stroke(); c.setLineDash([]);
  c.fillStyle = COL.ink; c.font = '600 13px system-ui'; c.fillText(`stopwatch ${f2(tr)} s`, Math.min(X(now) + 6, X1 - 110), Y0 - 8);
  const vB = speed_at_depth(g, off()[1]), slowed = fin.some(t => slide_position(t.pts, g, t.T)[2] < vB - 0.01);
  c.fillStyle = COL.ink2; c.font = '12px system-ui'; c.fillText(slowed ? 'Smooth tracks end at the speed of B\'s depth; sharp corners on yours cost it speed.' : 'Every ball ends at the same speed: the speed of B\'s depth.', X0, 352);
}

// 5: light-like layers
function step5() {
  const [c] = fig('ex5');
  const L = Math.max(2, Math.min(40, Math.round(+$('layers').value) || 6)); $('layersVal').textContent = L;
  const [bx, by] = off(), [a, te] = cycloid_params(bx, by), deep = te > Math.PI ? 2 * a : by, hL = deep / L;
  const sp = snell_path(bx, by, L), cyc = byKey('cyc').pts;
  const m = fitWorld(bounds([sp, cyc]), 0, 0, 380, 330, 18);
  for (let k = 0; k < L; k++) {
    const [x0, y0] = m(bounds([sp, cyc])[0], k * hL), [x1, y1] = m(bounds([sp, cyc])[2], (k + 1) * hL);
    c.fillStyle = `rgba(14,116,144,${0.05 + 0.3 * Math.sqrt((k + 0.5) / L)})`; c.fillRect(0, y0, 380, y1 - y0 + 0.5);
  }
  c.strokeStyle = COL.cyc; c.lineWidth = 2; c.globalAlpha = 0.7; path(c, cyc, m); c.stroke(); c.globalAlpha = 1;
  c.strokeStyle = COL.hot; c.lineWidth = 3; path(c, sp, m); c.stroke();
  // the angle from straight down in each piece
  const rows = [];
  for (let i = 2; i < sp.length; i += 2) {
    const dx = sp[i] - sp[i - 2], dy = sp[i + 1] - sp[i - 1], len = Math.hypot(dx, dy), sa = Math.abs(dx) / len, v = speed_at_depth(g, (sp[i + 1] + sp[i - 1]) / 2);
    if (Math.abs(dy) > 0.99 * hL) rows.push([sa, v]);
    const [px, py] = m(sp[i - 2], sp[i - 1]);
    if (L <= 12) { c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + 0.8 * m.s * Math.abs(dy)); c.stroke(); c.setLineDash([]); }
    dot(c, [px, py], 3, COL.hot);
  }
  dot(c, m(sp[sp.length - 2], sp[sp.length - 1]), 3, COL.hot);
  dot(c, m(bx, by), 7, COL.ink); c.fillStyle = COL.ink; c.font = '700 13px system-ui'; c.fillText('B', m(bx, by)[0] + 9, m(bx, by)[1] + 5);
  dot(c, m(0, 0), 7, COL.ink); c.fillText('A', m(0, 0)[0] + 9, m(0, 0)[1] - 4);
  // the table: sin α ÷ v comes out the same in every layer
  c.fillStyle = COL.ink; c.font = '600 13px system-ui'; c.fillText('Each layer of the orange path:', 396, 22);
  c.font = '12px ui-monospace, monospace'; c.fillStyle = COL.ink2; c.fillText(' v m/s  sin α  sin α ÷ v', 396, 42);
  const show = rows.length <= 12 ? rows : rows.filter((_, i) => i % Math.ceil(rows.length / 12) === 0);
  show.slice(0, 12).forEach(([sa, v], i) => { c.fillStyle = COL.ink; c.fillText(`${v.toFixed(2).padStart(5)}  ${sa.toFixed(2).padStart(5)}  ${(sa / v).toFixed(3).padStart(7)}`, 396, 62 + 19 * i); });
  const miss = Math.hypot(sp[sp.length - 2] - bx, sp[sp.length - 1] - by);
  c.font = '12px system-ui'; c.fillStyle = COL.ink2;
  c.fillText('Dashed: straight down.', 396, 290); c.fillText('α: the angle from it to the path.', 396, 306); c.fillText(`The path ends ${f2(miss)} m from B.`, 396, 322); c.fillText('More layers, closer.', 396, 338);
  $('cap5').textContent = `${L} layers shaded by speed (deeper is faster), the light-like path through them (orange) and the cycloid it closes in on (teal).`;
}

// 6: the rolling wheel, turning at a steady rate, keeps pace with the racing ball
function step6(dt) {
  const [c, w] = fig('ex6');
  const cyc = byKey('cyc'), [bx, by] = off(), [a, te] = cycloid_params(bx, by), om = Math.sqrt(g / a);
  clk.ex6 = (clk.ex6 + dt * 0.5) % (cyc.T + 1.5);
  const t = Math.min(clk.ex6, cyc.T), th = Math.min(te, om * t);
  const m = fitWorld([-a, -0.4, Math.max(bx, a * te + a), 2 * a], 0, 0, w, 270, 18);
  const [Ax, Ay] = m(0, 0);
  c.strokeStyle = COL.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(0, Ay); c.lineTo(w, Ay); c.stroke();
  c.strokeStyle = COL.cyc; c.lineWidth = 6; c.beginPath(); c.moveTo(Ax, Ay); c.lineTo(m(a * th, 0)[0], Ay); c.stroke();
  c.fillStyle = COL.cyc; c.font = '600 12px system-ui'; c.textAlign = 'center'; c.fillText('rolled a·θ', (Ax + m(a * th, 0)[0]) / 2, Ay - 6); c.textAlign = 'start';
  c.strokeStyle = 'rgba(14,116,144,.25)'; c.lineWidth = 2; path(c, cyc.pts, m); c.stroke();
  // the pen's mark so far
  const tr6 = []; for (let i = 0; i <= 80; i++) { const u = th * i / 80; tr6.push(a * (u - Math.sin(u)), a * (1 - Math.cos(u))); }
  c.strokeStyle = COL.cyc; c.lineWidth = 3; path(c, tr6, m); c.stroke();
  const [cx, cy] = m(a * th, a), r = a * m.s, pen = m(a * (th - Math.sin(th)), a * (1 - Math.cos(th)));
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
  c.strokeStyle = COL.hot; c.beginPath(); c.moveTo(cx, cy); c.lineTo(...pen); c.stroke();
  dot(c, [cx, cy], 3, COL.ink);
  c.fillStyle = COL.ink2; c.font = '12px system-ui'; c.fillText('a', (cx + pen[0]) / 2 + 4, (cy + pen[1]) / 2);
  const ball = slide_position(cyc.pts, g, t);
  dot(c, m(ball[0], ball[1]), 9, COL.cyc); dot(c, pen, 4, COL.hot);
  dot(c, m(bx, by), 6, COL.ink); c.fillStyle = COL.ink; c.font = '700 13px system-ui'; c.fillText('B', m(bx, by)[0] + 8, m(bx, by)[1] + 4); c.fillText('A', Ax - 16, Ay - 6);
  c.font = '13px system-ui'; c.fillStyle = COL.ink;
  c.fillText(`Wheel radius a = ${f2(a)} m. It turns at a steady √(g ÷ a) = ${f2(om)} radians per second.`, 12, 292);
  c.fillText(`After ${f2(t)} s: θ = ${f2(th)} (${Math.round(th * 180 / Math.PI)}°),  x = a·(θ − sin θ) = ${f2(a * (th - Math.sin(th)))} m,  y = a·(1 − cos θ) = ${f2(a * (1 - Math.cos(th)))} m`, 12, 312);
  c.font = '600 13px system-ui';
  c.fillText(t >= cyc.T - 1e-6 ? `At B, θ = ${f2(te)}: T = θ·√(a ÷ g) = ${f2(te)}·√(${f2(a)} ÷ ${g}) = ${f2(te * Math.sqrt(a / g))} s. The race: ${f2(cyc.T)} s.` : 'The red pen and the teal racing ball stay together.', 12, 338);
}

// ---------- Try this ----------
const TRY = {
  race: () => restart(),
  far: () => { A = [...A0]; B = [A0[0] + 9 * PX, A0[1] + 1.5 * PX]; if (!fits(A, B)) mine = null; build(); restart(); },
  shallow: () => { A = [...A0]; B = [...B0]; setMineFromFractions([0, 0, 0.25, 0.02, 0.5, 0.05, 0.75, 0.12, 0.9, 0.4, 1, 1]); build(); restart(); },
  // straight down, round a quarter circle, then level to B (a square corner would stop the ball dead)
  corner: () => { A = [...A0]; B = [...B0]; const [bx, by] = off(), r = Math.min(0.8, by / 2, bx / 2), q = [0, 0, 0, by - r];
    for (let k = 1; k <= 24; k++) { const th = Math.PI / 2 * k / 24; q.push(r - r * Math.cos(th), by - r + r * Math.sin(th)); }
    q.push(bx, by); setMineFromMetres(q); build(); restart(); },
  moon: () => { $('gravity').value = '1.62'; $('gravity').dispatchEvent(new Event('change')); },
};
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[b.dataset.try]?.(); $('play').scrollIntoView({ behavior: 'smooth' }); });

// ---------- the loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const fin = tracks.filter(t => Number.isFinite(t.T)), end = Math.max(0, ...fin.map(t => t.T));
  if (tr < end) tr = Math.min(end, tr + dt * tempo()); else if ((hold += dt) > 1.8) restart();
  drawRace(); readouts();
  if (visible.has('ex1')) step1(dt);
  if (visible.has('ex2')) pieces('ex2', 'cap2', byKey('line'), 8, false, 'ex2', dt);
  if (visible.has('ex3')) pieces('ex3', 'cap3', byKey('mine') || byKey('cyc'), 10, true, 'ex3', dt);
  if (visible.has('ex4')) step4();
  if (visible.has('ex5')) step5();
  if (visible.has('ex6')) step6(dt);
}
build();
requestAnimationFrame(frame);

// people exploring together see the same A, B and drawn track (gravity and the buttons are shared by Together itself)
share(() => ({ A, B, mine }), s => {
  const a = nums(s?.A, 2), b = nums(s?.B, 2);
  if (!a || !b || a.length !== 2 || b.length !== 2) return;
  let m = null;
  if (s.mine != null) { m = nums(s.mine, 4000); if (!m || m.length < 4 || m.length % 2 || m.some(v => Math.abs(v) > 50)) return; }
  if (!fits(a, b, m)) return;
  const same = JSON.stringify([A, B, mine]) === JSON.stringify([a, b, m]);
  A = [...a]; B = [...b]; mine = m ? [...m] : null;
  if (!same) { build(); restart(); }
});
