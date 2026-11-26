// The topology page: a rubber sheet of squares (Rust/WebAssembly: src/topology.rs) that morphs, can be
// pulled about, cut and punched, with V − E + F counted from its faces; and the step-by-step figures.
import init, { Sheet, count_mesh, running_euler, measure, cube_faces, torus_faces, euler } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const cv = $('sheet'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
const S = 235, OX = W / 2, OY = H / 2;          // plane units to canvas pixels
const PX_PER_CM = W / 30;                        // the picture is 30 cm wide
const ENDS = ['Lump ↔ arch', 'Doughnut ↔ mug', 'Flat ↔ glasses', 'Flat ↔ wavy'];
const COL = { face: '#bbf7d0', faceEdge: '#86c79f', line: '#15803d', dot: '#14532d', hot: '#dc2626', warm: '#ea580c', ink: '#1d4ed8', grey: '#9ca3af' };

let sheet = new Sheet(1);
let t = 0;                                       // the morph, 0 to 1
let offs = new Float64Array(2 * sheet.vertex_count());   // the reader's pulls, in canvas pixels per vertex id
let playing = false, dir = 1, last = 0;
let startChi = sheet.counts()[3];                // V − E + F before any cut or punch

// ---------- the sheet ----------
// canvas positions of every vertex id of a sheet (same ids as the reader's sheet, so the pulls apply)
function pointsOf(sh, tt = t) {
  const p = sh.positions(tt), out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i += 2) { out[i] = OX + S * p[i] + (offs[i] || 0); out[i + 1] = OY - S * p[i + 1] + (offs[i + 1] || 0); }
  return out;
}
// the distinct edges of a list of quads, and how many faces each touches
function edgesOf(faces) {
  const m = new Map();
  for (let f = 0; f < faces.length; f += 4) for (let k = 0; k < 4; k++) {
    const a = faces[f + k], b = faces[f + (k + 1) % 4], key = a < b ? a * 100000 + b : b * 100000 + a;
    const e = m.get(key); if (e) e.n++; else m.set(key, { a, b, n: 1 });
  }
  return [...m.values()];
}
function usedIds(faces) { return [...new Set(faces)].sort((a, b) => a - b); }
// draw a sheet: faces filled, edges thin, the outline thick, dots small; map(i) gives a vertex's screen spot
function drawSheet(c, faces, map, o = {}) {
  const { dots = true, lines = true, faceCol = COL.face, scale = 1 } = o;
  c.lineJoin = 'round';
  for (let f = 0; f < faces.length; f += 4) {
    c.beginPath(); for (let k = 0; k < 4; k++) { const [x, y] = map(faces[f + k]); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath();
    c.fillStyle = typeof faceCol === 'function' ? faceCol(f / 4) : faceCol; c.fill();
    if (!lines) { c.strokeStyle = c.fillStyle; c.lineWidth = 1; c.stroke(); }
  }
  for (const e of edgesOf(faces)) {
    if (!lines && e.n > 1) continue;
    const [x0, y0] = map(e.a), [x1, y1] = map(e.b);
    c.strokeStyle = e.n > 1 ? COL.faceEdge : COL.line; c.lineWidth = (e.n > 1 ? 1 : 2.5) * scale;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  if (dots && lines) { c.fillStyle = COL.dot; for (const i of usedIds(faces)) { const [x, y] = map(i); c.beginPath(); c.arc(x, y, 2.6 * scale, 0, 7); c.fill(); } }
}
const m = v => (v < 0 ? '−' + -v : String(v));   // a number with a real minus sign
const cm = v => (v / PX_PER_CM).toFixed(1);

function draw() {
  ctx.clearRect(0, 0, W, H);
  const faces = sheet.faces(), P = pointsOf(sheet);
  drawSheet(ctx, faces, i => [P[2 * i], P[2 * i + 1]], { dots: $('showDots').checked, lines: $('showDots').checked, scale: 1.3 });
  const [V, E, F, chi, pieces, holes] = sheet.counts(), [len, area] = measure(faces, 4, P);
  $('keep').innerHTML = `<strong class="keep">Counts:</strong> ${holes} hole${holes === 1 ? '' : 's'} · ${pieces} piece${pieces === 1 ? '' : 's'} · V − E + F = ${V} − ${E} + ${F} = <b>${m(chi)}</b>`;
  $('change').innerHTML = `<strong class="change">Measures:</strong> outline ${cm(len)} cm · area ${(area / PX_PER_CM ** 2).toFixed(0)} cm² <small class="muted">(the picture is 30 cm wide)</small>`;
  $('tVal').textContent = `${Math.round(t * 100)}%`;
  const note = chi === startChi ? 'Cutting and punching are not stretching. Watch V − E + F when you do them.'
    : `You broke the rules: V − E + F went from ${m(startChi)} to ${m(chi)}. No amount of stretching does that.`;
  $('breakNote').textContent = note;
  $('cut').textContent = sheet.is_cut() ? 'Glue the cut' : (sheet.shape() === 0 ? 'Cut it in two' : 'Cut it');
  $('punch').textContent = sheet.is_punched() ? 'Fill the hole' : 'Punch a hole';
  $('cut').classList.toggle('on', sheet.is_cut()); $('punch').classList.toggle('on', sheet.is_punched());
}

function setShape(s) {
  sheet.free(); sheet = new Sheet(s); t = 0; playing = false; $('playMorph').textContent = 'Play the morph';
  offs = new Float64Array(2 * sheet.vertex_count()); startChi = sheet.counts()[3];
  $('shape').value = String(s); $('morph').value = '0'; $('ends').textContent = ENDS[s];
  changed();
}
function changed() { draw(); explain(); }

$('shape').addEventListener('change', e => setShape(+e.target.value));
$('morph').addEventListener('input', e => { t = +e.target.value; playing = false; $('playMorph').textContent = 'Play the morph'; changed(); });
$('showDots').addEventListener('change', draw);
$('playMorph').addEventListener('click', () => {
  playing = !playing; if (playing) dir = t >= 0.99 ? -1 : 1;
  $('playMorph').textContent = playing ? 'Pause' : 'Play the morph';
});
$('smooth').addEventListener('click', () => { offs.fill(0); changed(); });
$('cut').addEventListener('click', () => { sheet.set_cut(!sheet.is_cut()); changed(); });
$('punch').addEventListener('click', () => { sheet.set_punched(!sheet.is_punched()); changed(); });

// pulling the sheet like rubber: everything near the pointer follows it, less and less further away
let drag = null;
const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
function pull(x0, y0, dx, dy, radius = 70) {
  const P = pointsOf(sheet);
  for (let i = 0; i < P.length; i += 2) {
    const d2 = (P[i] - x0) ** 2 + (P[i + 1] - y0) ** 2, w = Math.exp(-d2 / (2 * radius * radius));
    offs[i] = Math.max(-400, Math.min(400, offs[i] + dx * w)); offs[i + 1] = Math.max(-400, Math.min(400, offs[i + 1] + dy * w));
  }
}
cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); drag = pos(e); cv.classList.add('dragging'); });
cv.addEventListener('pointermove', e => {
  if (!drag) return; const [x, y] = pos(e);
  pull(drag[0], drag[1], x - drag[0], y - drag[1]); drag = [x, y]; draw();
});
const endDrag = () => { if (!drag) return; drag = null; cv.classList.remove('dragging'); explain(); };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

// ---------- Try this ----------
const TRY = {
  mug: () => { setShape(1); playing = true; dir = 1; $('playMorph').textContent = 'Pause'; },
  pull: () => { setShape(1); t = 0.5; $('morph').value = '0.5';
    const P = pointsOf(sheet); // three firm pulls at fixed places, so everyone in a session sees the same
    for (const [i, dx, dy] of [[0, -90, -60], [Math.floor(P.length / 4), 110, 40], [P.length / 2 - 2, 60, 90]]) pull(P[i], P[i + 1], dx, dy, 90);
    changed(); },
  cut: () => { setShape(1); t = 1; $('morph').value = '1'; sheet.set_cut(true); changed(); },
  punch: () => { setShape(3); sheet.set_punched(true); changed(); },
  split: () => { setShape(0); sheet.set_cut(true); changed(); },
};
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[b.dataset.try]?.(); $('play').scrollIntoView({ behavior: 'smooth' }); });

// ---------- the step-by-step figures ----------
// a map from vertex ids to a w×h box (with a margin), fitted around the points used by the faces
function fitIds(P, faces, x0, y0, w, h, pad = 20) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const i of usedIds(faces)) { a = Math.min(a, P[2 * i]); c = Math.max(c, P[2 * i]); b = Math.min(b, P[2 * i + 1]); d = Math.max(d, P[2 * i + 1]); }
  const s = Math.min((w - 2 * pad) / (c - a || 1), (h - 2 * pad) / (d - b || 1));
  const ox = x0 + (w - s * (c - a)) / 2 - s * a, oy = y0 + (h - s * (d - b)) / 2 - s * b;
  return i => [ox + s * P[2 * i], oy + s * P[2 * i + 1]];
}
function text(c, s, x, y, o = {}) { c.font = o.font || '15px system-ui'; c.fillStyle = o.color || '#222'; c.textAlign = o.align || 'left'; c.fillText(s, x, y); c.textAlign = 'left'; }
const ctxOf = id => { const el = $(id), c = el.getContext('2d'); c.clearRect(0, 0, el.width, el.height); return [c, el.width, el.height]; };

// step 1: counting, animated: the dots, then the edges, then the faces
let fig = null;   // the reader's sheet, frozen for the figures: faces, points, edges, prefix counts
function explain() {
  const faces = sheet.faces(), P = pointsOf(sheet);
  const run = running_euler(faces, 4);
  const pre = []; for (let k = 1; k <= faces.length / 4; k++) pre.push(count_mesh(faces.slice(0, 4 * k), 4));
  fig = { faces, P, edges: edgesOf(faces), ids: usedIds(faces), run, pre, counts: sheet.counts() };
  const [V, E, F, chi, pieces, holes] = fig.counts;
  $('cap1').textContent = `Your sheet: ${V} dots, ${E} edges, ${F} squares. V − E + F = ${V} − ${E} + ${F} = ${m(chi)}.`;
  $('cap3').textContent = `Your sheet built one square at a time, row by row. It ends at ${m(chi)} = ${pieces} piece${pieces === 1 ? '' : 's'} − ${holes} hole${holes === 1 ? '' : 's'}.`;
  step4();
}
function step1(sec) {
  if (!fig) return;
  const [c, w, h] = ctxOf('s1'), { faces, P, edges, ids } = fig, [V, E, F, chi] = fig.counts;
  const map = fitIds(P, faces, 0, 60, w, h - 60, 16), T = sec % 11;
  const u = k => Math.max(0, Math.min(1, (T - 3 * k) / 2.6));   // how far phase k (0 dots, 1 edges, 2 faces) has got
  const nd = Math.round(u(0) * ids.length), ne = Math.round(u(1) * edges.length), nf = Math.round(u(2) * faces.length / 4);
  // faces counted so far in green, the rest faint
  for (let f = 0; f < faces.length; f += 4) {
    c.beginPath(); for (let k = 0; k < 4; k++) { const [x, y] = map(faces[f + k]); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath();
    c.fillStyle = f / 4 < nf ? '#86efac' : '#f0fdf4'; c.fill();
  }
  edges.forEach((e, k) => { const [x0, y0] = map(e.a), [x1, y1] = map(e.b); c.strokeStyle = k < ne ? COL.ink : '#d1d5db'; c.lineWidth = k < ne ? 2 : 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); });
  ids.forEach((i, k) => { const [x, y] = map(i); c.fillStyle = k < nd ? COL.warm : '#d1d5db'; c.beginPath(); c.arc(x, y, k < nd ? 3.5 : 2.5, 0, 7); c.fill(); });
  // the tally across the top
  const show = (n, total) => n >= total ? `${total}` : `${n}…`;
  text(c, `V = ${show(nd, V)}`, 16, 28, { color: COL.warm, font: '600 17px system-ui' });
  text(c, `E = ${T >= 3 ? show(ne, E) : '?'}`, 120, 28, { color: COL.ink, font: '600 17px system-ui' });
  text(c, `F = ${T >= 6 ? show(nf, F) : '?'}`, 230, 28, { color: '#15803d', font: '600 17px system-ui' });
  if (T >= 9) text(c, `V − E + F = ${V} − ${E} + ${F} = ${m(chi)}`, 16, 52, { font: '600 17px system-ui' });
  else text(c, ['counting the dots (vertices)', 'counting the edges', 'counting the squares (faces)'][Math.min(2, Math.floor(T / 3))], 16, 52, { color: '#666' });
}

// step 2: the small moves that make a mesh finer, on a 3 × 2 grid of squares
let move = 0;
for (const b of document.querySelectorAll('[data-move]')) b.addEventListener('click', () => { move = +b.dataset.move; for (const x of document.querySelectorAll('[data-move]')) x.classList.toggle('on', x === b); });
function step2(sec) {
  const [c, w, h] = ctxOf('s2'), q = 80, gx = 120, gy = 60, T = sec % 6, u = Math.max(0, Math.min(1, (T - 1) / 1.5));
  const P = (i, j) => [gx + i * q, gy + j * q];
  c.fillStyle = COL.face; c.fillRect(gx, gy, 3 * q, 2 * q);
  // the new piece first, under the grid lines
  if (move === 1) { const [x0, y0] = P(1, 0); c.fillStyle = `rgba(74,222,128,${0.6 * u})`; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + q, y0 + q); c.lineTo(x0, y0 + q); c.closePath(); c.fill(); }
  if (move === 2) { const sx = gx + 3 * q + 60 * (1 - u); c.globalAlpha = Math.max(0.15, u); c.fillStyle = '#86efac'; c.fillRect(sx, gy, q, q); c.globalAlpha = 1; }
  c.strokeStyle = COL.line; c.lineWidth = 2;
  for (let j = 0; j <= 2; j++) { c.beginPath(); c.moveTo(...P(0, j)); c.lineTo(...P(3, j)); c.stroke(); }
  for (let i = 0; i <= 3; i++) { c.beginPath(); c.moveTo(...P(i, 0)); c.lineTo(...P(i, 2)); c.stroke(); }
  c.fillStyle = COL.dot; for (let i = 0; i <= 3; i++) for (let j = 0; j <= 2; j++) { const [x, y] = P(i, j); c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
  let dv = 0, de = 0, df = 0, what;
  if (move === 0) {   // a dot in the middle of the edge between the first two squares of the top row
    dv = 1; de = 1; what = 'one more dot, and its edge is now two edges';
    const [x, y] = P(1, 0.5), [, ya] = P(1, 0), [, yb] = P(1, 1);
    if (u > 0) { c.lineWidth = 4; c.strokeStyle = COL.ink; c.beginPath(); c.moveTo(x, ya); c.lineTo(x, y); c.stroke(); c.strokeStyle = '#7c3aed'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, yb); c.stroke(); }
    c.fillStyle = COL.warm; c.beginPath(); c.arc(x, y, 7 * u, 0, 7); c.fill();
  } else if (move === 1) {   // a diagonal across the second square of the top row
    de = 1; df = 1; what = 'one more edge, and its square is now two faces';
    const [x0, y0] = P(1, 0); c.strokeStyle = COL.ink; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + q * u, y0 + q * u); c.stroke();
  } else {   // a square glued on along the right edge of the top row
    dv = 2; de = 3; df = 1; what = 'two new dots, three new edges, one new face';
    const sx = gx + 3 * q + 60 * (1 - u); c.globalAlpha = Math.max(0.15, u); c.strokeStyle = COL.ink; c.lineWidth = 4;
    c.beginPath(); c.moveTo(sx, gy); c.lineTo(sx + q, gy); c.lineTo(sx + q, gy + q); c.lineTo(sx, gy + q); c.stroke();
    c.fillStyle = COL.warm; for (const yy of [gy, gy + q]) { c.beginPath(); c.arc(sx + q, yy, 6, 0, 7); c.fill(); } c.globalAlpha = 1;
  }
  const [V, E, F] = [12, 17, 6], after = euler(V + dv, E + de, F + df);
  text(c, `Before:  V − E + F = ${V} − ${E} + ${F} = ${euler(V, E, F)}`, 20, h - 66, { font: '16px system-ui' });
  if (u >= 1) {
    text(c, `After:    V − E + F = ${V + dv} − ${E + de} + ${F + df} = ${after}`, 20, h - 42, { font: '600 16px system-ui' });
    text(c, `change: +${dv} − ${de} + ${df} = ${dv - de + df}`, 20, h - 18, { color: '#15803d', font: '600 15px system-ui' });
  } else text(c, what, 20, h - 42, { color: '#666' });
  $('cap2').textContent = `${what[0].toUpperCase() + what.slice(1)}: V − E + F changes by ${dv} − ${de} + ${df} = 0.`;
}

// step 3: the reader's sheet built square by square, with the running V − E + F
function step3(sec) {
  if (!fig) return;
  const [c, w, h] = ctxOf('s3'), { faces, P, run, pre } = fig, n = faces.length / 4;
  const per = Math.min(0.35, 9 / n), T = sec % (n * per + 3.5), k = Math.min(n, Math.floor(T / per) + 1);   // squares placed
  const map = fitIds(P, faces, 0, 70, w, h - 70, 16);
  for (let f = 0; f < k; f++) {
    const d = f ? run[f] - run[f - 1] : 0;
    c.beginPath(); for (let j = 0; j < 4; j++) { const [x, y] = map(faces[4 * f + j]); j ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath();
    c.fillStyle = d < 0 ? '#fca5a5' : d > 0 ? '#93c5fd' : f === k - 1 ? '#4ade80' : COL.face; c.fill();
    c.strokeStyle = COL.line; c.lineWidth = 1.2; c.stroke();
  }
  const f = k - 1, [v, e] = pre[f], [v0, e0] = f ? pre[f - 1] : [0, 0], dv = v - v0, de = e - e0, d = dv - de + 1;
  text(c, `V − E + F = ${v} − ${e} + ${k} = ${m(run[f])}`, 16, 28, { font: '600 17px system-ui' });
  const why = f === 0 ? 'the first square: 4 − 4 + 1 = 1'
    : `this square: +${dv} dot${dv === 1 ? '' : 's'}, +${de} edge${de === 1 ? '' : 's'}, +1 face → ${d > 0 ? '+1 (a new piece)' : d < 0 ? '−1 (it closes a ring round a hole)' : 'no change'}`;
  text(c, why, 16, 54, { color: d < 0 ? COL.hot : d > 0 ? COL.ink : '#555' });
}

// step 4: before and after a cut or a punch, with the changed dots marked
let brk = 'cut';
for (const b of document.querySelectorAll('[data-break]')) b.addEventListener('click', () => { brk = b.dataset.break; for (const x of document.querySelectorAll('[data-break]')) x.classList.toggle('on', x === b); step4(); });
function step4() {
  const [c, w, h] = ctxOf('s4');
  const one = on => { const sh = new Sheet(sheet.shape()); sh.set_cut(brk === 'cut' ? on : sheet.is_cut()); sh.set_punched(brk === 'punch' ? on : sheet.is_punched()); return sh; };
  const before = one(false), after = one(true), base = (before.cols() + 1) * (before.rows() + 1);
  const [cx, cy0, cy1] = before.cut_line(), [px, py] = before.punch_cell();
  const onCut = i => { const x = i % (before.cols() + 1), y = Math.floor(i / (before.cols() + 1)); return i < base && x === cx && y >= cy0 && y <= cy1; };
  const counts = [];
  [before, after].forEach((sh, side) => {
    const faces = sh.faces(), P = pointsOf(sh), map = fitIds(P, faces, side * w / 2, 40, w / 2, h - 130, 14);
    drawSheet(c, faces, map, { scale: 0.8 });
    if (brk === 'punch' && side === 0) {   // the square that will go
      const id = (x, y) => y * (before.cols() + 1) + x, q = [id(px, py), id(px + 1, py), id(px + 1, py + 1), id(px, py + 1)];
      c.beginPath(); q.forEach((i, j) => { const [x, y] = map(i); j ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fillStyle = 'rgba(220,38,38,.45)'; c.fill(); c.strokeStyle = COL.hot; c.lineWidth = 2; c.stroke();
    }
    if (brk === 'cut') for (const i of usedIds(faces)) if (onCut(i) || i >= base) { const [x, y] = map(i); c.fillStyle = COL.warm; c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fill(); }
    const [V, E, F, chi] = sh.counts(); counts.push([V, E, F, chi]);
    text(c, side ? 'after' : 'before', side * w / 2 + 14, 24, { color: '#666', font: '600 14px system-ui' });
    text(c, `${V} − ${E} + ${F} = ${m(chi)}`, side * w / 2 + w / 4, h - 70, { align: 'center', font: '600 17px system-ui' });
  });
  before.free(); after.free();
  const [[V0, E0, F0, x0], [V1, E1, F1, x1]] = counts, k = V1 - V0;
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const line = brk === 'cut' ? `cut: +${pl(k, 'dot')} (orange, doubled), +${pl(E1 - E0, 'edge')}, same faces → ${k} − ${E1 - E0} = +${x1 - x0}`
    : `punch: same dots, same edges, ${m(F1 - F0)} face → ${m(x1 - x0)}`;
  text(c, line, w / 2, h - 30, { align: 'center', color: COL.hot, font: '600 15px system-ui' });
  $('cap4').textContent = brk === 'cut'
    ? `Cutting your sheet: ${k} dots along the cut are doubled and so ${E1 - E0 === 1 ? 'is the 1 edge' : `are the ${E1 - E0} edges`} between them, so V − E + F goes from ${m(x0)} to ${m(x1)}.`
    : `Punching your sheet: one square goes, every dot and edge stays (they still border other squares), so V − E + F goes from ${m(x0)} to ${m(x1)}: one more hole.`;
}

// step 5: closed surfaces: a cube blown up into a ball, and a rectangle glued into a torus
let surf = 0;
for (const b of document.querySelectorAll('[data-surf]')) b.addEventListener('click', () => { surf = +b.dataset.surf; for (const x of document.querySelectorAll('[data-surf]')) x.classList.toggle('on', x === b); });
const CUBE = cube_faces(), CUBE_C = count_mesh(CUBE, 4), TN = 6, TM = 4, TOR_C = count_mesh(torus_faces(TN, TM), 4);
function step5(sec) {
  const [c, w, h] = ctxOf('s5');
  if (surf === 0) {
    const infl = 0.5 - 0.5 * Math.cos(sec * 0.8), a = sec * 0.5, tilt = 0.5;
    const corner = i => [(i & 1) * 2 - 1, (i >> 1 & 1) * 2 - 1, (i >> 2 & 1) * 2 - 1];
    const blow = p => { const r = Math.hypot(...p) / Math.sqrt(3); return p.map(v => v * (1 - infl + infl / r)); };
    const view = ([x, y, z]) => { const X = x * Math.cos(a) + z * Math.sin(a), Z = -x * Math.sin(a) + z * Math.cos(a), Y = y * Math.cos(tilt) - Z * Math.sin(tilt), D = y * Math.sin(tilt) + Z * Math.cos(tilt); return [w / 2 + 95 * X, 190 - 95 * Y, D]; };
    // each face: its outline, walked as 4 edges of 10 points each, blown up and turned
    const faces = [];
    for (let f = 0; f < 6; f++) {
      const q = [...CUBE.slice(4 * f, 4 * f + 4)].map(corner), pts = [];
      for (let k = 0; k < 4; k++) for (let s = 0; s < 10; s++) { const A = q[k], B = q[(k + 1) % 4]; pts.push(view(blow(A.map((v, j) => v + (B[j] - v) * s / 10)))); }
      faces.push({ pts, depth: pts.reduce((m, p) => m + p[2], 0) / pts.length });
    }
    faces.sort((p, q) => q.depth - p.depth);
    for (const f of faces) { c.beginPath(); f.pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = f.depth < 0 ? 'rgba(134,239,172,.92)' : 'rgba(187,247,208,.5)'; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = f.depth < 0 ? 2.5 : 1; c.stroke(); }
    for (let i = 0; i < 8; i++) { const [x, y, d] = view(blow(corner(i))); c.fillStyle = d < 0 ? COL.warm : 'rgba(234,88,12,.4)'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
    const [V, E, F] = CUBE_C;
    text(c, `${V} corners − ${E} edges + ${F} faces = ${euler(V, E, F)}`, w / 2, h - 40, { align: 'center', font: '600 17px system-ui' });
    text(c, infl > 0.5 ? 'blown up into a ball: the same dots, edges and faces' : 'a cube', w / 2, h - 16, { align: 'center', color: '#666' });
    $('cap5').textContent = `A cube: ${V} − ${E} + ${F} = 2. Blowing it up into a ball only moves the dots, so a sphere has V − E + F = 2.`;
    return;
  }
  // the torus: a 6 × 4 grid whose right edge is glued to its left, and bottom to top
  const q = 46, gx = 30, gy = 60, T = sec % 8, show = T > 2;   // after 2 s, the copies fade out
  c.fillStyle = COL.face; c.fillRect(gx, gy, TN * q, TM * q);
  for (let j = 0; j <= TM; j++) for (let i = 0; i < TN; i++) {   // horizontal edges; the bottom row is the top row again
    const copy = j === TM, edge = j === 0 || copy; c.strokeStyle = edge ? '#7c3aed' : COL.line; c.lineWidth = edge ? 3 : 1.5; c.setLineDash(copy && show ? [5, 5] : []);
    c.beginPath(); c.moveTo(gx + i * q, gy + j * q); c.lineTo(gx + (i + 1) * q, gy + j * q); c.stroke();
  }
  for (let i = 0; i <= TN; i++) for (let j = 0; j < TM; j++) {    // vertical edges; the right column is the left one again
    const edge = i === 0 || i === TN; c.strokeStyle = edge ? '#0891b2' : COL.line; c.lineWidth = edge ? 3 : 1.5; c.setLineDash(i === TN && show ? [5, 5] : []);
    c.beginPath(); c.moveTo(gx + i * q, gy + j * q); c.lineTo(gx + i * q, gy + (j + 1) * q); c.stroke();
  }
  c.setLineDash([]);
  // arrows saying which edges are glued
  const arrow = (x, y, ang, col) => { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -7); c.lineTo(-6, 7); c.closePath(); c.fill(); c.restore(); };
  for (const x of [gx, gx + TN * q]) arrow(x, gy + 1.5 * q, -Math.PI / 2, '#0891b2');
  for (const y of [gy, gy + TM * q]) { arrow(gx + 2.5 * q - 7, y, 0, '#7c3aed'); arrow(gx + 2.5 * q + 7, y, 0, '#7c3aed'); }
  // dots: the ones on the right column and bottom row are copies, drawn hollow once the copies fade
  for (let i = 0; i <= TN; i++) for (let j = 0; j <= TM; j++) {
    const copy = i === TN || j === TM, [x, y] = [gx + i * q, gy + j * q];
    c.beginPath(); c.arc(x, y, 4.5, 0, 7);
    if (copy && show) { c.strokeStyle = COL.grey; c.lineWidth = 1.5; c.stroke(); } else { c.fillStyle = COL.warm; c.fill(); }
  }
  const [V, E, F] = TOR_C;
  text(c, show ? `count each glued dot and edge once:` : `drawn: ${(TN + 1) * (TM + 1)} dots, ${TN * (TM + 1) + (TN + 1) * TM} edges, ${TN * TM} squares`, gx, 34, { color: '#555' });
  if (show) text(c, `${V} − ${E} + ${F} = ${euler(V, E, F)}`, gx, h - 40, { font: '600 17px system-ui' });
  text(c, 'hollow dots and dashed edges are copies', gx, h - 16, { color: '#666', font: '13px system-ui' });
  // the same grid wrapped round a doughnut
  const R = 84, r = 34, cx = 455, cy = 165, tilt = 0.85, spin = sec * 0.4;
  const P3 = (u, v) => { const x = (R + r * Math.cos(v)) * Math.cos(u + spin), y = (R + r * Math.cos(v)) * Math.sin(u + spin), z = r * Math.sin(v); return [cx + x, cy + y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)]; };
  const quads = [];
  for (let i = 0; i < TN * 3; i++) for (let j = 0; j < TM * 3; j++) {
    const u0 = 2 * Math.PI * i / (TN * 3), u1 = 2 * Math.PI * (i + 1) / (TN * 3), v0 = 2 * Math.PI * j / (TM * 3), v1 = 2 * Math.PI * (j + 1) / (TM * 3);
    const p = [P3(u0, v0), P3(u1, v0), P3(u1, v1), P3(u0, v1)]; quads.push({ p, d: p.reduce((m, x) => m + x[2], 0) / 4, i, j });
  }
  quads.sort((a, b) => b.d - a.d);
  for (const { p, i, j } of quads) {
    c.beginPath(); p.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = COL.face; c.fill();
    c.strokeStyle = COL.line; c.lineWidth = 1.2; c.beginPath();
    if (i % 3 === 0) { c.moveTo(p[0][0], p[0][1]); c.lineTo(p[3][0], p[3][1]); }
    if (j % 3 === 0) { c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); }
    c.stroke();
  }
  text(c, 'the same grid on a doughnut', cx, 290, { align: 'center', color: '#666', font: '13px system-ui' });
  $('cap5').textContent = `A torus from a ${TN} × ${TM} grid: ${V} dots, ${E} edges, ${F} squares once glued, so V − E + F = 0. Any grid gives 0.`;
}

// ---------- animation ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) {
    t += dir * dt / 3; if (t >= 1 || t <= 0) { t = Math.max(0, Math.min(1, t)); playing = false; $('playMorph').textContent = 'Play the morph'; explain(); }
    $('morph').value = String(t); draw();
  }
  const sec = now / 1000;
  step1(sec); step2(sec); step3(sec); step5(sec);
}
setShape(1);
requestAnimationFrame(frame);

// ---------- together: the shape, the morph, the cut and punch, and the pulls ----------
share(() => ({ s: sheet.shape(), t, cut: sheet.is_cut(), punch: sheet.is_punched(), offs: [...offs] }), st => {
  const s = Number.isInteger(st?.s) && st.s >= 0 && st.s <= 3 ? st.s : null;
  if (s === null || typeof st.t !== 'number' || !Number.isFinite(st.t)) return;
  if (s !== sheet.shape()) setShape(s);
  t = Math.max(0, Math.min(1, st.t)); $('morph').value = String(t);
  sheet.set_cut(st.cut === true); sheet.set_punched(st.punch === true);
  const o = nums(st.offs, offs.length);
  if (o && o.length === offs.length) offs = Float64Array.from(o, v => Math.max(-400, Math.min(400, v)));
  changed();
});
