// Four-dimensional geometry: the shadow of a tesseract turned through the fourth direction, and step figures
// that build it from a point, count its pieces, derive the shadow rule and slice it.
// Maths: pkg/lilavati.js (tesseract.rs): corners, edges, turns in 4D, projections, slices.
import init, { rot4_all, apply4, project_4d_to_3d, project_3d_to_2d, ncube_edges, ncube_edge_axes, ncube_extrude, ncube_vertices_centred, ncube_counts, dist4, slice } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const RAD = Math.PI / 180;
const AX = ['#dc2626', '#16a34a', '#2563eb', '#c026d3'];   // edge colours by direction: x, y, z, w
const AXN = ['x', 'y', 'z', 'w'];
const CELLC = ['#ea580c', '#0d9488'];                       // the cubes w = −½ and w = +½
const COPY = '#6d28d9', OLD = '#57534e', INK = '#1c1917', INK2 = '#57534e';
const TILT = 0.38;   // a fixed tilt (yz plane) so the picture shows depth
const D3 = 4;        // eye distance for the last step, 3D → screen
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2).replace('-', '\u2212');
const easeIO = u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;

const V4 = ncube_vertices_centred(4), E4 = ncube_edges(4), A4 = ncube_edge_axes(4);
const V3 = ncube_vertices_centred(3);

// ---------- the reader's settings ----------
const ANG = ['xw', 'yw', 'zw', 'xz'];
const DEF = { xw: 30, yw: 0, zw: 0, xz: 25, d: 2.5 };
let spinXw = null;   // the xw angle while spinning, finer than the slider's whole degrees
const S = () => ({ xw: ($('spin').checked && spinXw !== null ? spinXw : +$('xw').value) * RAD, yw: +$('yw').value * RAD, zw: +$('zw').value * RAD, xz: +$('xz').value * RAD, d: +$('d').value });
function labels() { for (const k of ANG) $(k + 'Val').textContent = `${$(k).value}°`; $('dVal').textContent = (+$('d').value).toFixed(1); $('hVal').textContent = f2(+$('h').value); }

// 4D points (four numbers each) → turned, shadow in 3D (zoomed so w = 0 keeps its size), screen (zoomed so z = 0 keeps its size)
function chain(pts, a, d, only4 = true) {
  const m = only4 ? rot4_all(0, a.xz, TILT, a.xw, a.yw, a.zw) : rot4_all(0, a.xz, TILT, 0, 0, 0);
  const r = apply4(m, pts);
  const p3 = project_4d_to_3d(r, d).map(v => v * d);
  const p2 = project_3d_to_2d(p3, D3).map((v, i) => (i % 3 < 2 ? v * D3 : v));
  return { r, p3, p2 };
}
const scr = (p2, i, cx, cy, s) => [cx + p2[i * 3] * s, cy - p2[i * 3 + 1] * s];
function ctx(id) { const cv = $(id), c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); return [c, cv.width, cv.height]; }
function line(c, a, b, col, w = 2, dash = null) { c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]); }
function dot(c, p, r, col) { c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], r, 0, 2 * Math.PI); c.fill(); }
function text(c, s, x, y, col = INK, font = '15px system-ui', align = 'left') { c.fillStyle = col; c.font = font; c.textAlign = align; c.fillText(s, x, y); }
// text on a white patch, for labels that sit on lines
function tag(c, s, x, y, col, font, align = 'left') { c.font = font; const w = c.measureText(s).width, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x0 - 3, y - 13, w + 6, 18); text(c, s, x, y, col, font, align); }
// near in w: dark violet; far: pale
const wShade = w => { const u = clamp((w + 1) / 2, 0, 1); return `rgb(${Math.round(225 - 150 * u)},${Math.round(215 - 175 * u)},${Math.round(240 - 70 * u)})`; };

// ---------- Play: the shadow of the tesseract ----------
function drawMain() {
  const [c, W, H] = ctx('view'), a = S(), { r, p2 } = chain(V4, a, a.d);
  const s = W * 0.3, cx = W / 2, cy = H / 2, byCell = $('colour').value === 'cells';
  const order = [...Array(E4.length / 2).keys()].sort((i, j) => (r[E4[2 * i] * 4 + 3] + r[E4[2 * i + 1] * 4 + 3]) - (r[E4[2 * j] * 4 + 3] + r[E4[2 * j + 1] * 4 + 3]));
  for (const e of order) {
    const i = E4[2 * e], j = E4[2 * e + 1], wm = (r[i * 4 + 3] + r[j * 4 + 3]) / 2;
    let col = AX[A4[e]];
    if (byCell) col = A4[e] === 3 ? 'rgba(120,113,108,.55)' : CELLC[(i >> 3) & 1];
    c.globalAlpha = 0.45 + 0.55 * clamp((wm + 1) / 2, 0, 1);
    line(c, scr(p2, i, cx, cy, s), scr(p2, j, cx, cy, s), col, 2 + 3 * clamp((wm + 1) / 2, 0, 1));
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 16; i++) dot(c, scr(p2, i, cx, cy, s), 5 + 4 * clamp((r[i * 4 + 3] + 1) / 2, 0, 1), wShade(r[i * 4 + 3]));
  // the readout: how far the corners are in w, how much the shadow shrinks them, and the edges' true length
  let wl = Infinity, wh = -Infinity, el = Infinity, eh = 0;
  for (let i = 0; i < 16; i++) { wl = Math.min(wl, r[i * 4 + 3]); wh = Math.max(wh, r[i * 4 + 3]); }
  for (let e = 0; e < E4.length / 2; e++) { const i = E4[2 * e], j = E4[2 * e + 1], L = dist4(r.slice(i * 4, i * 4 + 4), r.slice(j * 4, j * 4 + 4)); el = Math.min(el, L); eh = Math.max(eh, L); }
  const same = Math.abs(eh - el) < 1e-9;
  $('say').innerHTML = `Corners’ <b>w</b> runs from ${f2(wl)} to ${f2(wh)}, so the shadow scales them by <b>1/(d − w)</b> from ${(1 / (a.d - wl)).toFixed(2)} (far) to ${(1 / (a.d - wh)).toFixed(2)} (near). In 4D all 32 edges are still <b>${same ? el.toFixed(3) : el.toFixed(3) + '–' + eh.toFixed(3)}</b> long.`;
}

// ---------- step 1: build by dragging a copy ----------
let pull = 0.65, pullAnim = null;
const nBuild = () => clamp(+$('build').value | 0, 1, 4);
// the n-cube with its last direction pulled out to t: the start at −½, the copy at t − ½
function built(n, t) {
  const v = ncube_extrude(n, t);
  for (let i = 0; i < v.length; i++) if (i % 4 < n) v[i] -= 0.5;
  return v;
}
function shapeFig(c, n, t, a, cx, cy, s, colourOf, widthOf) {
  const v = built(n, t), { r, p2 } = chain(v, n === 4 ? a : { ...a, xw: 0, yw: 0, zw: 0 }, a.d);
  const E = ncube_edges(n), A = ncube_edge_axes(n), out = [];
  for (let e = 0; e < E.length / 2; e++) {
    const i = E[2 * e], j = E[2 * e + 1], group = A[e] === n - 1 ? 'new' : ((i >> (n - 1)) & 1 ? 'copy' : 'old');
    out.push({ e, i, j, group, a: scr(p2, i, cx, cy, s), b: scr(p2, j, cx, cy, s) });
  }
  for (const ed of out) { const col = colourOf(ed); if (col) line(c, ed.a, ed.b, col, widthOf(ed)); }
  const k = 1 << n;
  for (let i = 0; i < k; i++) dot(c, scr(p2, i, cx, cy, s), (i >> (n - 1)) & 1 ? 6 : 5, (i >> (n - 1)) & 1 ? COPY : OLD);
  return { out, r, p2 };
}
function drawS1() {
  const [c, W, H] = ctx('s1'), n = nBuild(), a = S(), t = pull;
  const groupCol = { old: OLD, copy: COPY, new: AX[n - 1] };
  shapeFig(c, n, t, a, W * 0.5, H * 0.56, n === 4 ? 170 : 190, ed => groupCol[ed.group], ed => ed.group === 'new' ? 2.5 : 3);
  const names = ['a point', 'a segment', 'a square', 'a cube', 'a tesseract'];
  text(c, `${names[n - 1]} + its copy, pulled ${t.toFixed(2)} along ${AXN[n - 1]}`, 16, 28, INK, '600 16px system-ui');
  const V = ncube_counts(n - 1)[0];
  text(c, `corners: ${V} + ${V} = ${2 * V}`, 16, 52, INK2);
  text(c, n === 4 ? 'We can’t draw w: the copy moves nearer the eye in w, so its shadow grows.' : `the new direction ${AXN[n - 1]} is at right angles to the ${n - 1 ? 'old ones' : 'nothing before it'}.`, 16, H - 16, INK2, '13px system-ui');
  text(c, '← drag →', W - 16, 28, '#a8a29e', '14px system-ui', 'right');
}
{
  const cv = $('s1'); let x0 = null, t0 = 0;
  const px = e => { const b = cv.getBoundingClientRect(); return (e.clientX - b.left) * cv.width / b.width; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); x0 = px(e); t0 = pull; pullAnim = null; });
  cv.addEventListener('pointermove', e => { if (x0 === null) return; pull = clamp(t0 + (px(e) - x0) / (cv.width * 0.45), 0, 1); });
  const up = () => { x0 = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('pull').addEventListener('click', () => { pullAnim = { start: performance.now() }; });
  $('build').addEventListener('change', () => { pull = 0; pullAnim = { start: performance.now() }; count0 = performance.now(); });
}

// ---------- step 2: counting corners and edges ----------
let count0 = performance.now();
function drawS2(now) {
  const [c, W, H] = ctx('s2'), n = nBuild(), a = S();
  const E = ncube_edges(n), A = ncube_edge_axes(n);
  const groups = { old: [], copy: [], new: [] };
  for (let e = 0; e < E.length / 2; e++) groups[A[e] === n - 1 ? 'new' : ((E[2 * e] >> (n - 1)) & 1 ? 'copy' : 'old')].push(e);
  const order = ['old', 'copy', 'new'], dur = g => clamp(groups[g].length * 0.22, 0.7, 2.6);
  const total = order.reduce((s, g) => s + dur(g), 0) + 3;
  let tt = ((now - count0) / 1000) % total, phase = 3, lit = 0;
  for (let k = 0; k < 3; k++) { if (tt < dur(order[k])) { phase = k; lit = Math.floor(groups[order[k]].length * tt / dur(order[k])) + 1; break; } tt -= dur(order[k]); }
  const shown = g => { const k = order.indexOf(g); return k < phase ? groups[g].length : k === phase ? Math.min(lit, groups[g].length) : 0; };
  const groupCol = { old: OLD, copy: COPY, new: AX[n - 1] };
  const { out } = shapeFig(c, n, 1, a, W * 0.28, H * 0.5, n === 4 ? 120 : 140,
    ed => groups[ed.group].indexOf(ed.e) < shown(ed.group) ? groupCol[ed.group] : 'rgba(0,0,0,.1)',
    ed => (order.indexOf(ed.group) === phase && groups[ed.group].indexOf(ed.e) === lit - 1) ? 5 : 2.5);
  // numbers on the edges of the group being counted
  if (phase < 3) for (const ed of out) { const k = groups[ed.group].indexOf(ed.e); if (ed.group === order[phase] && k < lit) text(c, String(k + 1), (ed.a[0] + ed.b[0]) / 2, (ed.a[1] + ed.b[1]) / 2 - 4, groupCol[ed.group], '600 12px system-ui', 'center'); }
  // the sum, built up on the right
  const V0 = ncube_counts(n - 1), V1 = ncube_counts(n), x = W * 0.56;
  text(c, `Corners: V(${n}) = 2 · ${V0[0]} = ${V1[0]}`, x, 34, INK, '600 15px system-ui');
  const rows = [['old', `old shape’s edges`], ['copy', `the copy’s edges`], ['new', `new edges, one per old corner`]];
  rows.forEach(([g, s], k) => { text(c, String(shown(g)), x, 72 + k * 28, groupCol[g], '700 18px system-ui'); text(c, s, x + 34, 72 + k * 28, groupCol[g], '14px system-ui'); });
  if (phase === 3) text(c, `E(${n}) = ${groups.old.length} + ${groups.copy.length} + ${groups.new.length} = ${E.length / 2}`, x, 72 + 3 * 28 + 6, INK, '700 17px system-ui');
  // the table so far
  const names = ['point', 'segment', 'square', 'cube', 'tesseract'], ty = 220;
  text(c, 'n', x, ty, INK2, '600 13px system-ui'); text(c, 'shape', x + 26, ty, INK2, '600 13px system-ui'); text(c, 'corners', x + 118, ty, INK2, '600 13px system-ui'); text(c, 'edges', x + 190, ty, INK2, '600 13px system-ui');
  for (let k = 0; k <= 4; k++) {
    const y = ty + 26 + k * 26, cnt = ncube_counts(k), on = k === n, past = k < n || (on && phase === 3);
    if (on) { c.fillStyle = 'rgba(109,40,217,.1)'; c.fillRect(x - 8, y - 18, W - x - 4, 25); }
    const col = past ? INK : '#c4bfb8';
    text(c, String(k), x, y, col); text(c, names[k], x + 26, y, col); text(c, String(cnt[0]), x + 140, y, col, '15px system-ui', 'right'); text(c, past ? String(cnt[1]) : '?', x + 210, y, col, '15px system-ui', 'right');
  }
}

// ---------- step 3: a shadow divides by the distance ----------
let hiCorner = 0, hiAt = 0;
function drawS3(now) {
  const [c, W, H] = ctx('s3'), a = S(), four = $('pmode').value !== 'z';
  const d = four ? a.d : 2.5, dk = four ? 3 : 2, dn = four ? 'w' : 'z';
  const r = four ? apply4(rot4_all(0, a.xz, TILT, a.xw, a.yw, a.zw), V4) : apply4(rot4_all(0, a.xz, TILT, 0, 0, 0), V3);
  const k = r.length / 4, L = 40, R = W - 50, lo = -1.1, hi = d + 0.3;
  const sc = Math.min((R - L) / (hi - lo), 150), X = u => L + (u - lo) * sc, cy = 225, Y = v => cy - v * sc;
  if (now - hiAt > 1800) { hiAt = now; hiCorner = (hiCorner + 1) % k; }
  const hc = hiCorner % k, ex = X(d), sx = X(d - 1);
  // axis through the eye, the screen, the eye
  line(c, [L - 10, cy], [ex + 20, cy], '#d6d3d1', 1.5);
  line(c, [sx, cy - 165], [sx, cy + 140], '#a8a29e', 2);
  text(c, 'screen', sx, cy + 158, INK2, '13px system-ui', 'center');
  text(c, `1 in front of the eye`, sx, cy + 174, INK2, '12px system-ui', 'center');
  dot(c, [ex, cy], 7, INK); text(c, 'eye', ex, cy + 22, INK, '600 13px system-ui', 'center');
  text(c, `${dn} = ${d.toFixed(1)}`, ex, cy + 38, INK2, '12px system-ui', 'center');
  text(c, `${dn} (depth) →`, L, cy + 174, INK2, '13px system-ui');
  // rays and shadows
  for (let i = 0; i < k; i++) {
    const w = r[i * 4 + dk], x = r[i * 4], sh = x / (d - w), on = i === hc;
    line(c, [X(w), Y(x)], [ex, cy], on ? 'rgba(109,40,217,.8)' : 'rgba(0,0,0,.08)', on ? 2 : 1);
    dot(c, [X(w), Y(x)], on ? 7 : 5, four ? wShade(w) : '#78716c');
    dot(c, [sx, Y(sh)], on ? 6 : 3.5, on ? COPY : 'rgba(109,40,217,.5)');
  }
  // the two similar triangles for the highlighted corner
  const w = r[hc * 4 + dk], x = r[hc * 4], sh = x / (d - w);
  c.fillStyle = 'rgba(109,40,217,.07)'; c.beginPath(); c.moveTo(ex, cy); c.lineTo(X(w), cy); c.lineTo(X(w), Y(x)); c.closePath(); c.fill();
  c.fillStyle = 'rgba(109,40,217,.2)'; c.beginPath(); c.moveTo(ex, cy); c.lineTo(sx, cy); c.lineTo(sx, Y(sh)); c.closePath(); c.fill();
  line(c, [X(w), cy], [X(w), Y(x)], '#dc2626', 2.5);
  line(c, [X(w), cy + (x < 0 ? -12 : 12)], [ex, cy + (x < 0 ? -12 : 12)], '#0d9488', 2);
  tag(c, `x = ${f2(x)}`, X(w) - 6, (cy + Y(x)) / 2 + 4, '#dc2626', '600 13px system-ui', 'right');
  tag(c, `d − ${dn} = ${(d - w).toFixed(2)}`, (X(w) + ex) / 2, cy + (x < 0 ? -18 : 28), '#0d9488', '600 13px system-ui', 'center');
  // the sum written out
  text(c, `shadow height = x · 1/(d − ${dn}) = ${f2(x)} · 1/${(d - w).toFixed(2)} = ${f2(sh)}`, 16, 28, INK, '600 16px system-ui');
  text(c, four ? 'Corners far back in w (pale) land near the middle: the small inner cube.' : 'Corners far back in z land near the middle: the small inner square of a cube’s shadow.', 16, 50, INK2, '13px system-ui');
}

// ---------- step 4: a turn in the xw plane ----------
let turn0 = performance.now();
function drawS4(now) {
  const [c, W, H] = ctx('s4'), a = S(), th = a.xw, d = a.d;
  const cyc = 4.5, u = ((now - turn0) / 1000) % cyc, e = u < 2.5 ? easeIO(u / 2.5) : 1, t = th * e;
  const cs = Math.cos(t), sn = Math.sin(t);
  const G = [[0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]], GC = ['#c026d3', '#0d9488', '#ea580c', '#2563eb'];
  const cx = 165, cy = 250, s = 130;
  text(c, `θ = ${Math.round(t / RAD)}°   for the corner with x = 0.50, w = 0.50:`, 16, 24, INK, '600 15px system-ui');
  text(c, `x′ = cos(θ) · x − sin(θ) · w = ${f2(cs)} · 0.50 − ${f2(sn)} · 0.50 = ${f2(cs * 0.5 - sn * 0.5)}`, 16, 46, INK, '14px system-ui');
  text(c, `w′ = sin(θ) · x + cos(θ) · w = ${f2(sn)} · 0.50 + ${f2(cs)} · 0.50 = ${f2(sn * 0.5 + cs * 0.5)}`, 16, 66, INK, '14px system-ui');
  // the xw plane
  line(c, [cx - 150, cy], [cx + 150, cy], '#d6d3d1', 1.5); line(c, [cx, cy + 112], [cx, cy - 150], '#d6d3d1', 1.5);
  text(c, 'x', cx + 152, cy + 16, AX[0], '600 14px system-ui'); text(c, 'w ↑ towards the eye', cx + 6, cy - 150, AX[3], '600 13px system-ui');
  c.setLineDash([4, 5]); c.strokeStyle = '#a8a29e'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, s * Math.SQRT1_2, 0, 2 * Math.PI); c.stroke(); c.setLineDash([]);
  const P = G.map(([x, w]) => [cs * x - sn * w, sn * x + cs * w]);
  G.forEach(([x, w], k) => {
    dot(c, [cx + x * s, cy - w * s], 4, 'rgba(0,0,0,.18)');
    const a0 = Math.atan2(w, x); c.strokeStyle = GC[k]; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, s * Math.SQRT1_2, -a0, -(a0 + t), t > 0); c.stroke();
    dot(c, [cx + P[k][0] * s, cy - P[k][1] * s], 7, GC[k]);
  });
  line(c, [cx, cy], [cx + P[0][0] * s, cy - P[0][1] * s], GC[0], 1.5, [3, 3]);
  text(c, `every corner stays ${Math.SQRT1_2.toFixed(2)} from the middle`, cx, H - 12, INK2, '12px system-ui', 'center');
  text(c, '(4 corners at each dot: y and z are untouched)', cx, H - 28, INK2, '12px system-ui', 'center');
  // shrink factors
  const bx = 345, bw = W - bx - 20, top = 110, mx = 1 / (d - 1);
  text(c, 'shadow scale 1/(d − w′)', bx, top - 12, INK, '600 14px system-ui');
  [...P.keys()].sort((i, j) => P[j][1] - P[i][1]).forEach((k, row) => {
    const w = P[k][1], f = 1 / (d - w), y = top + 14 + row * 62;
    c.fillStyle = GC[k]; c.globalAlpha = 0.85; c.fillRect(bx, y, bw * f / mx, 22); c.globalAlpha = 1;
    text(c, `w′ = ${f2(w)}  →  1/(${d.toFixed(1)} ${w < 0 ? '+ ' + f2(-w) : '− ' + f2(w)}) = ${f.toFixed(2)}`, bx, y + 40, INK2, '13px system-ui');
  });
  if (Math.abs(th) < 0.5 * RAD) text(c, 'Set xw above to an angle to see the turn.', bx, H - 14, '#b91c1c', '600 13px system-ui');
}

// ---------- step 5: slices ----------
let passAnim = null;
// slice() → points (four numbers each) and the pairs joined, in the order round the outline where possible
function cut(n, pts, axis, h) {
  const s = slice(n, pts, axis, h), k = s[0] | 0, P = [], pairs = [];
  for (let i = 0; i < k; i++) P.push([s[1 + i * 4], s[2 + i * 4], s[3 + i * 4], s[4 + i * 4]]);
  for (let i = 1 + 4 * k; i + 1 < s.length; i += 2) pairs.push([s[i] | 0, s[i + 1] | 0]);
  return { P, pairs };
}
function loop(P, pairs) {   // a slice of a cube is one polygon: walk round it
  if (P.length < 3) return [];
  const nb = P.map(() => []); for (const [i, j] of pairs) { nb[i].push(j); nb[j].push(i); }
  const out = [0]; let prev = -1, cur = 0;
  for (let n = 0; n < P.length; n++) { const nx = nb[cur].find(j => j !== prev); if (nx === undefined || nx === 0) break; out.push(nx); prev = cur; cur = nx; }
  return out;
}
function drawS5() {
  const [c, W, H] = ctx('s5'), a = S(), h = +$('h').value;
  // left: a cube in a flat world's view; the world is the sheet z = h
  const cube = apply4(rot4_all(0, a.xz, 0.6, 0, 0, 0), V3);
  const ob = (p, cx = 160, cy = 235, s = 100) => [cx + (p[0] - 0.5 * p[1]) * s, cy - (p[2] + 0.32 * p[1]) * s];
  const sheet = [[-0.95, -0.9, h], [0.95, -0.9, h], [0.95, 0.9, h], [-0.95, 0.9, h]].map(p => ob(p));
  c.fillStyle = 'rgba(37,99,235,.08)'; c.strokeStyle = 'rgba(37,99,235,.35)'; c.lineWidth = 1; c.beginPath(); sheet.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fill(); c.stroke();
  const E3 = ncube_edges(3), cp = i => [cube[i * 4], cube[i * 4 + 1], cube[i * 4 + 2]];
  for (let e = 0; e < E3.length / 2; e++) line(c, ob(cp(E3[2 * e])), ob(cp(E3[2 * e + 1])), 'rgba(0,0,0,.25)', 1.5);
  const L = cut(3, cube, 2, h), lp = loop(L.P, L.pairs);
  if (lp.length > 2) { c.fillStyle = 'rgba(109,40,217,.35)'; c.beginPath(); lp.forEach((i, k) => { const p = ob(L.P[i]); k ? c.lineTo(...p) : c.moveTo(...p); }); c.closePath(); c.fill(); }
  for (const [i, j] of L.pairs) line(c, ob(L.P[i]), ob(L.P[j]), COPY, 3);
  for (const p of L.P) dot(c, ob(p), 4, COPY);
  text(c, 'a cube passing a flat world', 160, 26, INK, '600 15px system-ui', 'center');
  text(c, L.P.length ? `the flat world sees a ${['', '', '', 'triangle', 'four-sided shape', 'five-sided shape', 'hexagon'][L.P.length] || L.P.length + '-sided shape'}` : 'the flat world sees nothing', 160, 48, INK2, '13px system-ui', 'center');
  text(c, `the flat world z = ${f2(h)}`, sheet[1][0], sheet[1][1] + 16, '#2563eb', '12px system-ui', 'right');
  line(c, [W * 0.5, 20], [W * 0.5, H - 20], '#e7e2d9', 1);
  // right: the tesseract (turned through w as above) cut by our space at w = h, seen in our space
  const r4 = apply4(rot4_all(0, 0, 0, a.xw, a.yw, a.zw), V4), T = cut(4, r4, 3, h);
  const flat = T.P.flatMap(p => [p[0], p[1], p[2], 0]);
  const cx = W * 0.75, cy = H * 0.55, s = 150;
  if (T.P.length) {
    const { p2 } = chain(new Float64Array(flat), a, a.d, false);
    for (const [i, j] of T.pairs) line(c, scr(p2, i, cx, cy, s), scr(p2, j, cx, cy, s), '#0d9488', 2.5);
    for (let i = 0; i < T.P.length; i++) dot(c, scr(p2, i, cx, cy, s), 4, '#0d9488');
  }
  text(c, 'a tesseract passing our space', cx, 26, INK, '600 15px system-ui', 'center');
  text(c, T.P.length ? `we see a solid with ${T.P.length} corners, at w = ${f2(h)}` : 'we see nothing: it is not in our space', cx, 48, INK2, '13px system-ui', 'center');
  text(c, 'each corner is where an edge crosses', W * 0.5, H - 12, INK2, '12px system-ui', 'center');
}
$('pass').addEventListener('click', () => { passAnim = { start: performance.now() }; });

// ---------- animation: one loop for the toy and the figures on screen ----------
const onScreen = new Set(['view']);
const io = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? onScreen.add(e.target.id) : onScreen.delete(e.target.id); }, { rootMargin: '80px' });
for (const id of ['view', 's1', 's2', 's3', 's4', 's5']) io.observe($(id));
let tween = null, last = performance.now();
const setVal = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('input', { bubbles: true })); };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (tween) { const u = clamp((now - tween.start) / (tween.secs * 1000), 0, 1), e = easeIO(u); setVal(tween.id, (tween.from + (tween.to - tween.from) * e).toFixed(tween.dp)); if (u >= 1) { const nx = tween.then; tween = null; nx?.(); } }
  if ($('spin').checked && !(tween && tween.id === 'xw')) { let v = (spinXw ?? +$('xw').value) + 25 * dt; if (v > 180) v -= 360; spinXw = v; $('xw').value = Math.round(v); labels(); } else spinXw = null;
  if (pullAnim) { const u = (now - pullAnim.start) / 1600; pull = clamp(easeIO(clamp(u, 0, 1)), 0, 1); if (u >= 1) pullAnim = null; }
  if (passAnim) { const u = (now - passAnim.start) / 5000; $('h').value = (-1 + 2 * clamp(u, 0, 1)).toFixed(2); labels(); if (u >= 1) passAnim = null; }
  if (document.hidden) return;
  if (onScreen.has('view')) drawMain();
  if (onScreen.has('s1')) drawS1();
  if (onScreen.has('s2')) drawS2(now);
  if (onScreen.has('s3')) drawS3(now);
  if (onScreen.has('s4')) drawS4(now);
  if (onScreen.has('s5')) drawS5();
}
for (const id of [...ANG, 'd', 'h']) $(id).addEventListener('input', e => { if (e.isTrusted && tween?.id === id) tween = null; if (e.isTrusted && id === 'h') passAnim = null; labels(); if (id === 'xw' && e.isTrusted) { turn0 = performance.now(); spinXw = null; } });
$('spin').addEventListener('change', () => { spinXw = null; });
$('pmode').addEventListener('change', () => { hiAt = 0; });
function reset() { tween = null; $('spin').checked = false; for (const [k, v] of Object.entries(DEF)) $(k).value = v; $('colour').value = 'axis'; labels(); turn0 = performance.now(); }
$('reset').addEventListener('click', reset);

// "Try this" buttons: set the toy up, then scroll back to it
const go = (id, from, to, secs, then) => { tween = { id, from, to, secs, dp: id === 'd' ? 1 : 0, start: performance.now(), then }; };
const TRY = [
  () => { reset(); $('colour').value = 'cells'; setVal('xw', 0); go('xw', 0, 180, 4); },
  () => { reset(); setVal('xz', -180); go('xz', -180, 180, 6); },
  () => { reset(); setVal('d', 8); go('d', 8, 1.8, 4); },
  () => { reset(); $('colour').value = 'cells'; $('spin').checked = true; },
];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try]?.(); $('play').scrollIntoView({ behavior: 'smooth' }); });

labels();
requestAnimationFrame(frame);
window.__tesseract = { S, get pull() { return pull; }, drawMain };

// Together (together/share.js): sliders, the checkbox and the selects are shared on their own; the pulled
// copy in step 1 lives here
share(() => ({ pull: +pull.toFixed(3) }), s => {
  const v = nums([s?.pull]); if (!v) return;
  pull = clamp(v[0], 0, 1); pullAnim = null;
});
