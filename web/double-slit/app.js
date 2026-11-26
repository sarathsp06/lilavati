// The double-slit page: particles fired one at a time at two slits, each landing as one dot; the stripes
// build up from the chances. Maths from Rust (pkg/lilavati.js, slits module): the pattern, the sampler
// that decides where each particle lands, the path lengths and the arrows. The step figures derive the
// pattern on screen: strips' arrows adding up, two arrows turned by their path lengths, the sweep.
import init, {
  sample_hits, sample_hits_with_path, two_slit_terms, two_slit_intensity, path_lengths, path_difference,
  single_slit_envelope, sub_source_phases, fringe_spacing, envelope_half_width, fraunhofer,
} from '../pkg/lilavati.js';
import { share } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const L = 1000, YM = 20;                     // screen 1 m away (in mm), 40 mm tall
const MAX = 30000, BINS = 80;                // most dots kept, histogram bins (0.5 mm)
const BLUE = '#2563eb', ORANGE = '#ea580c', INK = '#111', ACC = '#be185d';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = 2 * Math.PI;

// ---------- the settings (all lengths in mm) ----------
const S = () => ({ d: +$('d').value / 1000, a: +$('a').value / 1000, lam: +$('lam').value * 1e-6, det: $('det').checked });
const rate = () => Math.round(Math.pow(10, +$('rate').value));
function labels() {
  $('dVal').textContent = `${$('d').value} µm`; $('aVal').textContent = `${$('a').value} µm`;
  $('lamVal').textContent = `${$('lam').value} nm`; $('rateVal').textContent = `${rate()} a second`;
}

// ---------- the particles: hit i depends only on (seed, i, settings) ----------
let seed = 12345, n = 0, running = false, acc = 0;
const hitY = new Float64Array(MAX), hitS = new Uint8Array(MAX);  // where each landed, and the slit seen (0 none, 1, 2)
let landed = 0;                                                  // hits 0..landed-1 are on the screen
let flights = [];                                                // { i, t } particles still on their way
const counts = [new Float64Array(BINS), new Float64Array(BINS), new Float64Array(BINS)];  // all / slit 1 / slit 2
const bin = y => Math.min(BINS - 1, Math.max(0, Math.floor((y + YM) / (2 * YM) * BINS)));

function fire(k) {                                               // generate k more hits
  k = Math.min(k, MAX - n); if (k <= 0) return;
  const s = S();
  if (s.det) {
    const v = sample_hits_with_path(n, n + k, seed, YM, s.lam, s.d, s.a, L);
    for (let j = 0; j < k; j++) { hitY[n + j] = v[2 * j]; hitS[n + j] = v[2 * j + 1]; }
  } else {
    const v = sample_hits(n, n + k, seed, YM, s.lam, s.d, s.a, L, 1);
    for (let j = 0; j < k; j++) { hitY[n + j] = v[j]; hitS[n + j] = 0; }
  }
  const now = performance.now() / 1000;
  // a few particles at a time are shown flying; the rest land at once
  for (let j = 0; j < k; j++) flights.push({ i: n + j, t: now });
  n += k;
  if (flights.length > 10 || still) { for (const f of flights.splice(0, flights.length - (still ? 0 : 6))) land(f.i); }
}
function land(i) {
  if (i < landed) return;
  for (; landed <= i; landed++) {
    const b = bin(hitY[landed]); counts[0][b]++; if (hitS[landed]) counts[hitS[landed]][b]++;
    dotAt(landed);
  }
}
function clearScreen(newSeed) {
  if (newSeed) seed = (Math.random() * 2 ** 32) >>> 0;
  n = 0; landed = 0; flights = []; acc = 0; counts.forEach(c => c.fill(0));
  dots.clearRect(0, 0, dotsCv.width, dotsCv.height);
}

// ---------- the main picture ----------
const cv = $('plane'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
const SRC = [70, 320], WALL = 330, SCR = [600, 680], HIST = [700, 880], Y0 = 320, PX = 280 / YM;   // 14 px per mm
const Yof = y => Y0 - y * PX;
const dotsCv = document.createElement('canvas'); dotsCv.width = W; dotsCv.height = H;
const dots = dotsCv.getContext('2d');
const jitter = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
function dotAt(i) {
  dots.fillStyle = hitS[i] === 1 ? BLUE : hitS[i] === 2 ? ORANGE : 'rgba(17,17,17,.75)';
  dots.fillRect(SCR[0] + 4 + jitter(i) * (SCR[1] - SCR[0] - 10), Yof(hitY[i]) - 1, 2.2, 2.2);
}
const slitGeom = s => ({ sep: 40 + (s.d * 1000 - 50) / 350 * 160, w: 6 + (s.a * 1000 - 10) / 90 * 14 });

function draw(now) {
  const s = S(), g = slitGeom(s), y1 = Y0 - g.sep / 2, y2 = Y0 + g.sep / 2;
  c.clearRect(0, 0, W, H);
  // source
  c.fillStyle = '#334155'; c.beginPath(); c.roundRect(SRC[0] - 34, SRC[1] - 18, 40, 36, 6); c.fill();
  c.fillStyle = '#94a3b8'; c.fillRect(SRC[0] + 6, SRC[1] - 5, 10, 10);
  // the wall with its two slits
  c.fillStyle = '#475569';
  c.fillRect(WALL - 5, 20, 10, y1 - g.w / 2 - 20); c.fillRect(WALL - 5, y1 + g.w / 2, 10, y2 - g.w / 2 - y1 - g.w / 2); c.fillRect(WALL - 5, y2 + g.w / 2, 10, H - 20 - y2 - g.w / 2);
  // which-path detectors
  if (s.det) for (const [yy, col] of [[y1, BLUE], [y2, ORANGE]]) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(WALL + 16, yy, 9, 0, TAU); c.stroke(); }
  // the screen
  c.fillStyle = '#f8fafc'; c.fillRect(SCR[0], Yof(YM), SCR[1] - SCR[0], 2 * YM * PX);
  c.strokeStyle = '#cbd5e1'; c.lineWidth = 1; c.strokeRect(SCR[0], Yof(YM), SCR[1] - SCR[0], 2 * YM * PX);
  c.drawImage(dotsCv, 0, 0);
  // particles on their way: a dot to the wall, then a wave from both slits (or the one seen) to the screen
  const t = now / 1000, T1 = 0.28, T2 = 0.42;
  c.save(); c.beginPath(); c.rect(WALL + 5, 0, SCR[0] - WALL - 5, H); c.clip();
  for (const f of flights) {
    const u = t - f.t;
    if (u < T1) { const k = u / T1; c.fillStyle = INK; c.beginPath(); c.arc(SRC[0] + 16 + (WALL - SRC[0] - 16) * k, SRC[1], 4, 0, TAU); c.fill(); continue; }
    const k = Math.min(1, (u - T1) / T2), r = 10 + k * (SCR[0] - WALL);
    const from = hitS[f.i] === 1 ? [y1] : hitS[f.i] === 2 ? [y2] : [y1, y2];
    for (const yy of from) for (let ring = 0; ring < 3; ring++) {
      const rr = r - ring * 16; if (rr <= 4) continue;
      c.strokeStyle = `rgba(190,24,93,${(0.5 - ring * 0.15) * (1 - k * 0.6)})`; c.lineWidth = 1.5;
      c.beginPath(); c.arc(WALL, yy, rr, -1.2, 1.2); c.stroke();
    }
  }
  c.restore();
  for (const f of flights) if (t - f.t < T1) { const k = (t - f.t) / T1; c.fillStyle = INK; c.beginPath(); c.arc(SRC[0] + 16 + (WALL - SRC[0] - 16) * k, SRC[1], 4, 0, TAU); c.fill(); }
  // flashes at the detector
  for (const f of flights) if (hitS[f.i] && t - f.t > T1 && t - f.t < T1 + 0.2) { c.fillStyle = hitS[f.i] === 1 ? BLUE : ORANGE; c.beginPath(); c.arc(WALL + 16, hitS[f.i] === 1 ? y1 : y2, 7, 0, TAU); c.fill(); }
  // the counts beside the screen
  const mx = Math.max(4, ...counts[0]), bh = 2 * YM * PX / BINS, sx = (HIST[1] - HIST[0]) / mx;
  for (let b = 0; b < BINS; b++) {
    const yTop = Yof(YM) + (BINS - 1 - b) * bh;
    if (s.det) {
      c.fillStyle = 'rgba(37,99,235,.75)'; c.fillRect(HIST[0], yTop, counts[1][b] * sx, bh - 0.5);
      c.fillStyle = 'rgba(234,88,12,.75)'; c.fillRect(HIST[0] + counts[1][b] * sx, yTop, counts[2][b] * sx, bh - 0.5);
    } else { c.fillStyle = 'rgba(17,17,17,.55)'; c.fillRect(HIST[0], yTop, counts[0][b] * sx, bh - 0.5); }
  }
  // the predicted curve, scaled to the same number of dots
  if ($('curve').checked && landed > 0) {
    const ys = Array.from({ length: 400 }, (_, i) => -YM + 2 * YM * (i + 0.5) / 400);
    const p = ys.map(y => two_slit_intensity(y, s.lam, s.d, s.a, L, s.det ? 0 : 1)), sum = p.reduce((q, v) => q + v, 0);
    const scale = landed / sum * (400 / BINS) * sx;
    c.strokeStyle = ACC; c.lineWidth = 2; c.beginPath();
    ys.forEach((y, i) => (i ? c.lineTo(HIST[0] + p[i] * scale, Yof(y)) : c.moveTo(HIST[0] + p[i] * scale, Yof(y)))); c.stroke();
  }
  c.strokeStyle = '#cbd5e1'; c.beginPath(); c.moveTo(HIST[0], Yof(YM)); c.lineTo(HIST[0], Yof(-YM)); c.stroke();
  // labels
  c.fillStyle = '#64748b'; c.font = '19px system-ui'; c.textAlign = 'center';
  c.fillText('source', SRC[0] - 14, SRC[1] + 44); c.fillText('two slits', WALL, H - 4); c.fillText('screen', (SCR[0] + SCR[1]) / 2, H - 4); c.fillText('dots counted', (HIST[0] + HIST[1]) / 2, H - 4);
  c.fillText('slit 1', WALL - 40, y1 + 6); c.fillText('slit 2', WALL - 40, y2 + 6);
  c.textAlign = 'left'; c.font = '600 22px system-ui'; c.fillStyle = INK; c.fillText(`${landed.toLocaleString('en')} particle${landed === 1 ? '' : 's'}`, 16, 30);
  c.font = '17px system-ui'; c.fillStyle = '#94a3b8'; c.fillText('not to scale', 16, 56);
}

function say() {
  const s = S(), dy = fringe_spacing(s.lam, L, s.d);
  let t;
  if (landed === 0) t = 'Press <b>One particle</b> or <b>Run</b>.';
  else if (s.det) { const a = counts[1].reduce((p, v) => p + v, 0); t = `Detector on: <b>${a}</b> seen at slit 1 (blue), <b>${landed - a}</b> at slit 2 (orange). One smooth hump, no stripes.`; }
  else if (landed < 60) t = `${landed} dot${landed > 1 ? 's' : ''} so far, scattered. Keep going.`;
  else t = `Stripes every <b>λ·L / d = ${dy.toFixed(2)} mm</b>. No dot lands on the dark lines between them.`;
  if (n >= MAX) t += ' The screen is full: Reset to start again.';
  $('say').innerHTML = t;
}

// ---------- controls ----------
function changed() { labels(); clearScreen(false); stepsChanged(); }
for (const id of ['d', 'a', 'lam', 'det']) $(id).addEventListener('input', changed);
$('rate').addEventListener('input', labels);
$('one').addEventListener('click', () => fire(1));
$('run').addEventListener('click', () => setRun(!running));
$('reset').addEventListener('click', () => { setRun(false); clearScreen(true); });
function setRun(r) { running = r; $('run').textContent = r ? 'Pause' : 'Run'; }

// ---------- step figures ----------
const fig = id => { const e = $(id), g = e.getContext('2d'); g.clearRect(0, 0, e.width, e.height); return [g, e.width, e.height]; };
const line = (g, pts, color, w, dash) => { g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]); };
function arrow(g, x0, y0, x1, y1, color, w = 3) {
  const d = Math.hypot(x1 - x0, y1 - y0); if (d < 1) return; const ux = (x1 - x0) / d, uy = (y1 - y0) / d, h = Math.min(10, d * 0.45);
  line(g, [[x0, y0], [x1 - ux * h * 0.6, y1 - uy * h * 0.6]], color, w);
  g.fillStyle = color; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * h - uy * h * 0.5, y1 - uy * h + ux * h * 0.5); g.lineTo(x1 - ux * h + uy * h * 0.5, y1 - uy * h - ux * h * 0.5); g.fill();
}
const text = (g, s, x, y, col = '#333', font = '16px system-ui', align = 'left') => { g.fillStyle = col; g.font = font; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left'; };
const mm = y => `${y >= 0 ? '+' : '−'}${Math.abs(y).toFixed(1)} mm`;
const frac = x => x - Math.floor(x);
// a sweep of the screen point from −20 mm to +20 mm, slow enough to follow the stripes
const sweep = (sec, s) => { const per = Math.max(10, 1.1 * 2 * YM / fringe_spacing(s.lam, L, s.d)); return -YM + 2 * YM * frac(sec / per); };

// 1: one slit cut into strips; each strip's arrow turned by its path; the arrows head to tail; the envelope traced
const NS = 11;
function ex1(sec) {
  const [g, w, h] = fig('ex1'), s = S(), y = sweep(sec * 0.8, { ...s, d: s.a });
  // left: the slit (enlarged) and the paths from its strips to the point
  const sx = 40, top = 70, bot = 190, P = [250, 130 - y * 2.6];
  line(g, [[sx, 20], [sx, top]], '#475569', 6); line(g, [[sx, bot], [sx, 240]], '#475569', 6);
  line(g, [[250, 78], [250, 182]], '#cbd5e1', 2);
  const ph = sub_source_phases(y, 0, s.lam, s.a, L, NS), ref = ph[(NS - 1) / 2];
  const hue = k => `hsl(${200 + 140 * k / (NS - 1)},75%,45%)`;
  for (let k = 0; k < NS; k++) { const yy = bot - (bot - top) * (k + 0.5) / NS; line(g, [[sx, yy], P], hue(k), 1.2); g.fillStyle = hue(k); g.fillRect(sx - 3, yy - 2, 6, 4); }
  g.fillStyle = INK; g.beginPath(); g.arc(...P, 5, 0, TAU); g.fill();
  text(g, `point y = ${mm(y)}`, 120, 22, INK, '600 16px system-ui');
  text(g, `one slit (${$('a').value} µm), ${NS} strips`, 14, 262, '#555', '15px system-ui');
  // right: the strips' arrows head to tail, each turned by its own path length
  const al = 22; let x = 330, yy = 140;
  const start = [x, yy];
  for (let k = 0; k < NS; k++) { const a = ph[k] - ref, nx = x + al * Math.cos(a), ny = yy - al * Math.sin(a); arrow(g, x, yy, nx, ny, hue(k), 2.4); x = nx; yy = ny; }
  arrow(g, ...start, x, yy, INK, 2);
  const len = Math.hypot(x - start[0], yy - start[1]) / (al * NS);
  text(g, 'their arrows, head to tail', 340, 22, '#555', '15px system-ui');
  text(g, `sum: ${len.toFixed(2)} of full length, squared ${(len * len).toFixed(2)}`, 300, 262, INK, '600 15px system-ui');
  // bottom: the envelope, the sum squared, traced as the point moves
  const L1 = 30, R1 = w - 20, B = h - 20, Ht = 88, X = v => L1 + (R1 - L1) * (v + YM) / (2 * YM);
  line(g, [[L1, B], [R1, B]], '#e5e1d8', 1);
  const ys = Array.from({ length: 300 }, (_, i) => -YM + 2 * YM * i / 299);
  line(g, ys.map(v => [X(v), B - single_slit_envelope(v, s.lam, s.a, L) * Ht]), 'rgba(0,0,0,.12)', 2);
  line(g, ys.filter(v => v <= y).map(v => [X(v), B - single_slit_envelope(v, s.lam, s.a, L) * Ht]), ACC, 2.5);
  g.fillStyle = ACC; g.beginPath(); g.arc(X(y), B - len * len * Ht, 5, 0, TAU); g.fill();
  const z = envelope_half_width(s.lam, L, s.a);
  if (z < YM) for (const v of [-z, z]) { line(g, [[X(v), B + 2], [X(v), B - 10]], '#555', 1); text(g, `${mm(v)}`, X(v), B + 15, '#555', '13px system-ui', 'center'); }
  text(g, 'sum squared as the point moves: the envelope', L1, B - Ht - 8, ACC, '15px system-ui');
}

// 2: two paths to one chosen point, their lengths, and the two arrows added
function ex2(sec) {
  const [g, w, h] = fig('ex2'), s = S(), y = +$('yp').value;
  $('ypVal').textContent = mm(y);
  const r = path_lengths(y, s.d, L), dr = path_difference(y, s.d, L), turns = dr / s.lam;
  const t = two_slit_terms(y, s.lam, s.d, s.a, L, 1), m1 = Math.sqrt(t[0]), m2 = Math.sqrt(t[1]);
  // left: the slits (enlarged) and the two paths
  const S1 = [40, 150], S2 = [40, 230], P = [260, 190 - y * 6];
  line(g, [[40, 20], [40, 142]], '#475569', 6); line(g, [[40, 158], [40, 222]], '#475569', 6); line(g, [[40, 238], [40, 330]], '#475569', 6);
  line(g, [[260, 60], [260, 320]], '#cbd5e1', 2);
  line(g, [S1, P], BLUE, 2.5); line(g, [S2, P], ORANGE, 2.5);
  g.fillStyle = INK; g.beginPath(); g.arc(...P, 5, 0, TAU); g.fill();
  text(g, 'r₁', (S1[0] + P[0]) / 2, (S1[1] + P[1]) / 2 - 8, BLUE, '600 17px system-ui'); text(g, 'r₂', (S2[0] + P[0]) / 2, (S2[1] + P[1]) / 2 + 18, ORANGE, '600 17px system-ui');
  text(g, `r₁ = ${r[0].toFixed(6)} mm`, 14, 350, BLUE, '600 15px ui-monospace, monospace');
  text(g, `r₂ = ${r[1].toFixed(6)} mm`, 14, 368, ORANGE, '600 15px ui-monospace, monospace');
  text(g, `r₂ − r₁ = ${(dr * 1000).toFixed(3)} µm = ${turns.toFixed(2)}·λ`, 14, 388, INK, '600 15px ui-monospace, monospace');
  text(g, `point y = ${mm(y)}`, 150, 30, INK, '600 16px system-ui');
  // right: ψ₁ flat, ψ₂ turned further by (r₂ − r₁)/λ of a turn; the turn is shown happening, then held
  const cx = 360, cy = 190, sc = 120, k = still ? 1 : Math.min(1, frac(sec / 4) * 1.6);
  const ang = TAU * turns * k, tip1 = [cx + m1 * sc * 2, cy];
  g.strokeStyle = 'rgba(234,88,12,.25)'; g.setLineDash([4, 4]); g.lineWidth = 1; g.beginPath(); g.arc(...tip1, m2 * sc * 2, 0, TAU); g.stroke(); g.setLineDash([]);
  const tip2 = [tip1[0] + m2 * sc * 2 * Math.cos(ang), tip1[1] - m2 * sc * 2 * Math.sin(ang)];
  arrow(g, cx, cy, ...tip1, BLUE, 4); arrow(g, ...tip1, ...tip2, ORANGE, 4); arrow(g, cx, cy, ...tip2, INK, 2.5);
  text(g, 'ψ₁', cx + m1 * sc - 6, cy + 22, BLUE, '600 17px system-ui'); text(g, 'ψ₂', tip2[0] + 6, tip2[1] - 6, ORANGE, '600 17px system-ui');
  const deg = ((turns % 1) + 1) % 1 * 360;
  text(g, `ψ₂ turns ${(turns * k).toFixed(2)} turn further`, 300, 30, '#555', '15px system-ui');
  if (k >= 1) text(g, `(${deg.toFixed(0)}° past whole turns)`, 300, 50, '#555', '15px system-ui');
  const P2 = (tip2[0] - cx) ** 2 + (tip2[1] - cy) ** 2, Pn = P2 / (2 * sc) ** 2;
  text(g, `|ψ₁ + ψ₂|² = ${Pn.toFixed(2)}`, 300, 360, INK, '600 17px system-ui');
  text(g, `(alone: ${t[0].toFixed(2)} + ${t[1].toFixed(2)}; the cross term adds ${(Pn - t[0] - t[1]).toFixed(2)})`, 300, 382, '#555', '15px system-ui');
}

// 3: sweep the point; the arrows swing; the sum squared traces the stripes
function ex3(sec) {
  const [g, w, h] = fig('ex3'), s = S(), y = sweep(sec, s);
  const t = two_slit_terms(y, s.lam, s.d, s.a, L, 1), m1 = Math.sqrt(t[0]), m2 = Math.sqrt(t[1]);
  const dl = TAU * path_difference(y, s.d, L) / s.lam;
  const cx = 30, cy = 120, sc = 80;
  const tip1 = [cx + m1 * sc * 2, cy], tip2 = [tip1[0] + m2 * sc * 2 * Math.cos(dl), tip1[1] - m2 * sc * 2 * Math.sin(dl)];
  arrow(g, cx, cy, ...tip1, BLUE, 3.5); arrow(g, ...tip1, ...tip2, ORANGE, 3.5); arrow(g, cx, cy, ...tip2, INK, 2.5);
  text(g, `y = ${mm(y)}`, 20, 24, INK, '600 16px system-ui');
  text(g, `|ψ₁ + ψ₂|² = ${t[3].toFixed(2)}`, 20, 230, INK, '600 16px system-ui');
  text(g, `= ${t[0].toFixed(2)} + ${t[1].toFixed(2)} ${t[2] >= 0 ? '+' : '−'} ${Math.abs(t[2]).toFixed(2)}`, 20, 250, '#555', '15px ui-monospace, monospace');
  text(g, 'ψ₁ alone + ψ₂ alone + cross', 20, 272, '#888', '14px system-ui');
  // right: the plot, traced up to y
  const L3 = 260, R3 = w - 16, B = h - 36, Ht = 300, X = v => L3 + (R3 - L3) * (v + YM) / (2 * YM);
  line(g, [[L3, B], [R3, B]], '#e5e1d8', 1);
  const ys = Array.from({ length: 900 }, (_, i) => -YM + 2 * YM * i / 899);
  const terms = ys.map(v => two_slit_terms(v, s.lam, s.d, s.a, L, 1));
  line(g, ys.map((v, i) => [X(v), B - (terms[i][0] + terms[i][1]) * Ht]), 'rgba(0,0,0,.35)', 1.5, [5, 4]);
  line(g, ys.map((v, i) => [X(v), B - terms[i][3] * Ht]), 'rgba(0,0,0,.07)', 2);
  line(g, ys.filter(v => v <= y).map((v, i) => [X(v), B - terms[i][3] * Ht]), ACC, 2.2);
  g.fillStyle = ACC; g.beginPath(); g.arc(X(y), B - t[3] * Ht, 5, 0, TAU); g.fill();
  line(g, [[X(y), B], [X(y), B - t[3] * Ht]], 'rgba(190,24,93,.35)', 1);
  for (const v of [-20, -10, 0, 10, 20]) text(g, `${v}`, X(v), B + 16, '#888', '13px system-ui', 'center');
  text(g, 'y on the screen (mm)', (L3 + R3) / 2, B + 32, '#888', '14px system-ui', 'center');
  text(g, '|ψ₁ + ψ₂|²', L3, 24, ACC, '600 15px system-ui'); text(g, 'dashed: |ψ₁|² + |ψ₂|²', L3 + 105, 24, '#555', '15px system-ui');
}

// counts of a list of hits into bins over the screen
const binsOf = ys => { const b = new Float64Array(BINS); for (const y of ys) b[bin(y)]++; return b; };
const curvePts = (f, B, X, scale) => Array.from({ length: 400 }, (_, i) => { const y = -YM + 2 * YM * (i + 0.5) / 400; return [X(y), B - f(y) * scale]; });
function bars(g, b, X, B, sy, col, base) { const bw = (X(YM) - X(-YM)) / BINS; g.fillStyle = col; for (let k = 0; k < BINS; k++) if (b[k]) { const h0 = base ? base[k] * sy : 0; g.fillRect(X(-YM) + k * bw, B - h0 - b[k] * sy, bw - 0.6, b[k] * sy); } }

// 4: the reader's dots, counted into bins, against the curve
function ex4() {
  const [g, w, h] = fig('ex4'), s = S(), L4 = 30, R4 = w - 16, B = h - 40, X = v => L4 + (R4 - L4) * (v + YM) / (2 * YM);
  const coh = s.det ? 0 : 1, f = y => two_slit_intensity(y, s.lam, s.d, s.a, L, coh);
  const fsum = Array.from({ length: BINS * 10 }, (_, i) => f(-YM + 2 * YM * (i + 0.5) / (BINS * 10))).reduce((p, v) => p + v, 0) / 10;
  const mx = Math.max(...counts[0], landed / fsum, 1), sy = (B - 60) / mx;
  line(g, [[L4, B], [R4, B]], '#e5e1d8', 1);
  bars(g, counts[0], X, B, sy, 'rgba(17,17,17,.55)');
  line(g, curvePts(f, B, X, landed / fsum * sy), ACC, 2.5);
  for (const v of [-20, -10, 0, 10, 20]) text(g, `${v} mm`, X(v), B + 16, '#888', '13px system-ui', 'center');
  text(g, `${landed.toLocaleString('en')} dots in bins 0.5 mm wide`, L4, 26, INK, '600 16px system-ui');
  text(g, 'pink: the chance curve, scaled to the same number of dots', L4, 46, ACC, '15px system-ui');
  if (landed < 200) text(g, landed ? 'Too few to see the shape yet: run more above.' : 'No dots yet: press Run above.', w / 2, h / 2, '#888', '17px system-ui', 'center');
}

// 5: with a detector, each slit's dots alone, then stacked; your own if the detector is on, else simulated ones
let demo = null, demoKey = '';
function ex5() {
  const [g, w, h] = fig('ex5'), s = S(), key = `${s.d},${s.a},${s.lam}`;
  let g1, g2, total, src;
  if (s.det && landed >= 200) {
    g1 = counts[1]; g2 = counts[2]; total = landed; src = `your ${landed.toLocaleString('en')} dots`;
  } else {
    if (demoKey !== key) { const v = sample_hits_with_path(0, 6000, 99, YM, s.lam, s.d, s.a, L); const a = [], b = []; for (let i = 0; i < v.length; i += 2) (v[i + 1] === 1 ? a : b).push(v[i]); demo = [binsOf(a), binsOf(b)]; demoKey = key; }
    [g1, g2] = demo; total = 6000; src = '6,000 simulated dots (switch the detector on above to use yours)';
  }
  const L5 = 30, R5 = w - 16, X = v => L5 + (R5 - L5) * (v + YM) / (2 * YM), rows = [110, 210, 360], bw = 2 * YM / BINS;
  const p = y => single_slit_intensity2(y, s);
  const stacked = Float64Array.from(g1, (v, k) => v + g2[k]), mx = Math.max(...stacked, 1), sy = 130 / mx;
  const ssum = Array.from({ length: 400 }, (_, i) => p(-YM + 2 * YM * (i + 0.5) / 400)).reduce((q, v) => q + v[0] + v[1], 0) * (2 * YM / 400);
  const kexp = total * bw / ssum;
  bars(g, g1, X, rows[0], sy * 0.55, 'rgba(37,99,235,.7)'); line(g, curvePts(y => p(y)[0], rows[0], X, kexp * sy * 0.55), BLUE, 2);
  bars(g, g2, X, rows[1], sy * 0.55, 'rgba(234,88,12,.7)'); line(g, curvePts(y => p(y)[1], rows[1], X, kexp * sy * 0.55), ORANGE, 2);
  bars(g, g1, X, rows[2], sy, 'rgba(37,99,235,.7)'); bars(g, g2, X, rows[2], sy, 'rgba(234,88,12,.7)', g1);
  line(g, curvePts(y => { const q = p(y); return q[0] + q[1]; }, rows[2], X, kexp * sy), INK, 2);
  line(g, curvePts(y => two_slit_intensity(y, s.lam, s.d, s.a, L, 1), rows[2], X, kexp * sy), 'rgba(190,24,93,.45)', 1.5, [5, 4]);
  for (const r of rows) line(g, [[L5, r], [R5, r]], '#e5e1d8', 1);
  text(g, 'seen at slit 1: |ψ₁|², one bump', L5, 22, BLUE, '600 15px system-ui');
  text(g, 'seen at slit 2: |ψ₂|², one bump', L5, 128, ORANGE, '600 15px system-ui');
  text(g, 'both stacked: |ψ₁|² + |ψ₂|², no stripes', L5, 230, INK, '600 15px system-ui');
  text(g, 'dashed: the stripes without a detector', L5, 248, ACC, '14px system-ui');
  text(g, src, L5, h - 12, '#888', '14px system-ui');
}
const single_slit_intensity2 = (y, s) => [single_slit_envelope(y - s.d / 2, s.lam, s.a, L) / 4, single_slit_envelope(y + s.d / 2, s.lam, s.a, L) / 4];

// 6: the small triangle at the slits gives d·sin θ; bright where it is a whole number of λ
function ex6(sec) {
  const [g, w, h] = fig('ex6'), d = +$('d2').value / 1000, lam = +$('lam2').value * 1e-6;
  $('d2Val').textContent = `${$('d2').value} µm`; $('lam2Val').textContent = `${$('lam2').value} nm`;
  // the extra length in wavelengths swings from 0 to 2.5 and back
  const u = still ? 1 : 2.5 * (1 - Math.cos(TAU * sec / 14)) / 2, sinT = u * lam / d, y = L * Math.tan(Math.asin(sinT));
  // left: the slits (enlarged) and two nearly parallel paths at angle θ (drawn steeper than it is)
  const S1 = [80, 160], S2 = [80, 280], dv = 120, phi = u / 2.5 * 0.62, ux = Math.cos(phi), uy = -Math.sin(phi), Lr = 230;
  line(g, [[80, 20], [80, 152]], '#475569', 6); line(g, [[80, 168], [80, 272]], '#475569', 6); line(g, [[80, 288], [80, 380]], '#475569', 6);
  const ext = dv * Math.sin(phi), F = [S2[0] + ux * ext, S2[1] + uy * ext];
  line(g, [S1, [S1[0] + ux * Lr, S1[1] + uy * Lr]], BLUE, 2.2); line(g, [S2, [S2[0] + ux * (Lr + ext), S2[1] + uy * (Lr + ext)]], ORANGE, 2.2);
  line(g, [S1, F], '#555', 1.2, [4, 3]);
  line(g, [S2, F], '#dc2626', 5);
  line(g, [[S2[0], S2[1]], [S2[0] + 60, S2[1]]], '#bbb', 1);
  g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.arc(...S2, 44, -phi, 0); g.stroke();
  text(g, 'θ', S2[0] + 50, S2[1] - 6, '#555', '600 16px system-ui');
  text(g, 'd', 60, 225, INK, '600 17px system-ui');
  text(g, 'extra length d·sin θ', F[0] + 10, F[1] + 18, '#dc2626', '600 15px system-ui');
  text(g, `d·sin θ = ${u.toFixed(2)}·λ`, 100, h - 14, INK, '600 17px ui-monospace, monospace');
  // a ruler in wavelengths: bright at whole numbers
  const rx = 340, rw = 270, ry = 28;
  line(g, [[rx, ry], [rx + rw, ry]], '#ccc', 2);
  for (let m = 0; m <= 2; m++) { const x = rx + rw * m / 2.5; line(g, [[x, ry - 6], [x, ry + 6]], '#555', 1.5); text(g, `${m}·λ`, x, ry + 20, '#555', '14px system-ui', 'center'); }
  const fr = u - Math.floor(u), near = Math.min(fr, 1 - fr) < 0.06, dark = Math.abs(fr - 0.5) < 0.06;
  g.fillStyle = near ? '#16a34a' : dark ? '#111' : ACC; g.beginPath(); g.arc(rx + rw * u / 2.5, ry, 7, 0, TAU); g.fill();
  text(g, near ? 'whole number: arrows line up, bright' : dark ? 'half: arrows opposite, dark' : '', rx, ry + 40, near ? '#16a34a' : '#111', '600 15px system-ui');
  // right: the pattern on the screen with the bright marks at m·λ·L/d
  const sp = fringe_spacing(lam, L, d), YR = 2.6 * sp, top = 104, bot = h - 20, X0 = 360, Y = v => (top + bot) / 2 - v / YR * (bot - top) / 2;
  const pts = Array.from({ length: 300 }, (_, i) => { const v = -YR + 2 * YR * i / 299; return [X0 + fraunhofer(v / Math.hypot(L, v), lam, d, 1e-6) * 90, Y(v)]; });
  line(g, [[X0, top], [X0, bot]], '#cbd5e1', 1.5); line(g, pts, 'rgba(0,0,0,.45)', 1.8);
  for (let m = -2; m <= 2; m++) { const v = m * sp; line(g, [[X0 + 92, Y(v)], [X0 + 104, Y(v)]], '#16a34a', 2); text(g, m ? `m = ${m}: ${mm(v)}` : 'm = 0: middle', X0 + 110, Y(v) + 4, '#16a34a', '14px system-ui'); }
  g.fillStyle = ACC; g.beginPath(); g.arc(X0, Y(y), 6, 0, TAU); g.fill();
  text(g, `spacing λ·L / d = ${sp.toFixed(2)} mm`, X0 - 20, 92, INK, '600 15px system-ui');
}

function stepsChanged() { demoKey = ''; }

// ---------- the loop ----------
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (running) { acc += rate() * dt; const k = Math.floor(acc); acc -= k; if (k) fire(k); if (n >= MAX) setRun(false); }
  const t = now / 1000;
  for (const f of flights.filter(f => t - f.t >= 0.7)) land(f.i);
  flights = flights.filter(f => t - f.t < 0.7);
  draw(now); say();
  const sec = still ? 3 : t;
  ex1(sec); ex2(sec); ex3(sec); ex4(); ex5(); ex6(sec);
}

// ---------- Try this ----------
function setTo({ d = 100, a = 30, lam = 550, det = false, r = 1.3 } = {}) {
  $('d').value = d; $('a').value = a; $('lam').value = lam; $('det').checked = det; $('rate').value = r;
  labels(); clearScreen(true); stepsChanged();
}
const TRY = [
  () => { setTo(); setRun(false); fire(1); setTimeout(() => fire(1), 700); setTimeout(() => fire(1), 1400); },
  () => { setTo({ r: 3 }); setRun(true); },
  () => { setTo({ det: true, r: 3 }); setRun(true); },
  () => { setTo({ d: 50, r: 3 }); setRun(true); },
  () => { setTo({ lam: 700, r: 3 }); setRun(true); setTimeout(() => { $('lam').value = 400; changed(); setRun(true); }, 3500); },
];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });

// start alive: a screen that already has some dots on it, filling up
labels(); fire(400); land(n - 1); flights = []; setRun(true);
requestAnimationFrame(frame);

// Together (together/share.js): the sliders and buttons are shared by themselves; the dots are
// (seed, how many), since hit i depends only on the seed, i and the settings
share(() => ({ seed, n, run: running }), st => {
  if (!st || typeof st !== 'object') return;
  const sd = st.seed, k = st.n;
  if (!Number.isInteger(sd) || sd < 0 || sd >= 2 ** 32 || !Number.isInteger(k) || k < 0 || k > MAX) return;
  if (sd !== seed || k < n) { seed = sd; clearScreen(false); }
  if (k > n) { fire(k - n); }
  setRun(st.run === true);
});
