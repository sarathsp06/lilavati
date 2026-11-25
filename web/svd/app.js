// The singular value decomposition: any matrix = turn (Vᵀ), stretch (Σ), turn (U). Slide through
// the three moves; compress a picture with the SVD; find principal components of a data cloud.
// Maths: pkg/lilavati.js (linalg); drawing: ../la.js.
import init, { svd2, pca2, Svd } from '../pkg/lilavati.js';
import { Plane, COL, I2, apply, rot, mul, fmt, matrixToy, basis, figPlane, clearFig, panels } from '../la.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const P = new Plane($('plane'), 4);
let stage = 3, anim = null;
const st = matrixToy(P, { start: 9, change: s => { if (!anim) stage = 3; $('stage').value = stage; draw(s); } });
$('stage').addEventListener('input', e => { stage = +e.target.value; draw(st); });
$('rank1').addEventListener('change', () => draw(st));
$('playMove').addEventListener('click', () => {
  if (anim) cancelAnimationFrame(anim);
  const t0 = performance.now(), go = now => { stage = Math.min(3, (now - t0) / 1300); $('stage').value = stage; draw(st); anim = stage < 3 ? requestAnimationFrame(go) : null; };
  anim = requestAnimationFrame(go);
});

const clamp01 = x => Math.max(0, Math.min(1, x));
// the decomposition of A (or its rank-1 part), and the matrix after s of the three moves (0..3)
function parts(m) { const [tv, s1, s2, tu, f] = svd2(...m); return { tv, s1, s2: $('rank1').checked ? 0 : s2, tu, f }; }
function at(d, s) {
  const t1 = clamp01(s), t2 = clamp01(s - 1), t3 = clamp01(s - 2);
  const D = [1 + (d.s1 - 1) * t2, 0, 0, 1 + (d.f * d.s2 - 1) * t2];
  return mul(rot(d.tu * t3), mul(D, rot(-d.tv * t1)));
}
const deg = t => `${Math.round(t * 180 / Math.PI)}°`;
const STAGES = ['start', 'after Vᵀ (turn)', 'after Σ (stretch)', 'after U (turn): A'];

function drawSvd(p, d, s, labels = true) {
  const M = at(d, s), v1 = [Math.cos(d.tv), Math.sin(d.tv)], v2 = [-Math.sin(d.tv), Math.cos(d.tv)];
  p.grid(M, 'rgba(37,99,235,.22)').axes().circle(I2, null, 'rgba(0,0,0,.2)', 2).circle(M, 'rgba(14,165,233,.15)', '#0369a1', 3);
  const a1 = apply(M, ...v1), a2 = apply(M, ...v2);
  p.arrow(...a1, COL.w, { width: 4, label: labels ? (s >= 3 ? 'σ₁u₁' : 'v₁') : '' }).arrow(...a2, COL.blue, { width: 4, label: labels ? (s >= 3 ? 'σ₂u₂' : 'v₂') : '' });
}
function draw(s) {
  const d = parts(s.m);
  P.clear(); drawSvd(P, d, stage);
  if (stage >= 3 && !$('rank1').checked) basis(P, s.m);
  const k = Math.min(3, Math.floor(stage + 1e-6));
  $('sVal').textContent = STAGES[k];
  $('say').innerHTML = `Turn <b>${deg(-d.tv)}</b>, stretch by <b>σ₁ = ${fmt(d.s1)}</b> and <b>σ₂ = ${fmt(d.s2)}</b>${d.f < 0 ? ' (one flipped)' : ''}, turn <b>${deg(d.tu)}</b>.${$('rank1').checked ? ' Rank 1: only the biggest stretch kept.' : ''}`;
  explain(s.m, d);
}

// a 48 × 48 picture made from numbers: a smiling face on a soft gradient, with stripes
const N = 48, IMG = new Float64Array(N * N);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x = (j - 23.5) / 20, y = (i - 23.5) / 20, r = Math.hypot(x, y);
  let v = 0.35 + 0.25 * (j / N) + (i > 40 && (j >> 2) % 2 ? 0.25 : 0);
  if (r < 0.95) v = 0.85;
  if (Math.hypot(x + 0.35, y + 0.3) < 0.13 || Math.hypot(x - 0.35, y + 0.3) < 0.13) v = 0.1;
  if (Math.abs(r - 0.55) < 0.07 && y > 0.15) v = 0.15;
  IMG[i * N + j] = v;
}
const svdImg = new Svd(IMG, N, N);
const KS = [1, 2, 5, 10, 48], RECON = KS.map(k => svdImg.approx(k));
function picture(c, data, x0, y0, size) {
  const px = size / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const g = Math.round(255 * Math.max(0, Math.min(1, data[i * N + j]))); c.fillStyle = `rgb(${g},${g},${g})`; c.fillRect(x0 + j * px, y0 + i * px, px + 0.6, px + 0.6); }
}
// a round blob of 240 points (fixed, seeded), for PCA
const BLOB = []; { let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let k = 0; k < 240; k++) { const a = Math.sqrt(-2 * Math.log(r() + 1e-12)), t = 2 * Math.PI * r(); BLOB.push(0.55 * a * Math.cos(t), 0.55 * a * Math.sin(t)); } }

function explain(m, d) {
  { const p = figPlane('ex1', 3.4); clearFig('ex1'); p.clip(); drawSvd(p, d, 3, false); p.done();
    p.text(`σ₁ = ${fmt(d.s1)} (longest radius)`, 14, 30, COL.w, 18).text(`σ₂ = ${fmt(d.s2)} (shortest)`, 14, 54, COL.blue, 18); }
  { const p = figPlane('ex2', 3.4); clearFig('ex2'); p.clip(); const M = at(d, 3), v1 = [Math.cos(d.tv), Math.sin(d.tv)], v2 = [-Math.sin(d.tv), Math.cos(d.tv)];
    p.axes().circle(I2, null, 'rgba(0,0,0,.25)').circle(M, null, '#0369a1');
    p.arrow(...v1, 'rgba(124,58,237,.5)', { width: 3, label: 'v₁' }).arrow(...v2, 'rgba(37,99,235,.5)', { width: 3, label: 'v₂' });
    p.arrow(...apply(M, ...v1), COL.w, { width: 4, label: 'Av₁' }).arrow(...apply(M, ...v2), COL.blue, { width: 4, label: 'Av₂' }).done(); }
  { const ps = panels('ex3', 4, 3.4); ps.forEach((p, k) => { p.clip().clear(); drawSvd(p, d, k, false); p.done().title(['start', 'Vᵀ: turn', 'Σ: stretch', 'U: turn'][k]); }); }
  { const cv = clearFig('ex4'), c = cv.getContext('2d'), w = cv.width / 5, size = w - 14, vals = svdImg.values();
    RECON.forEach((img, k) => { picture(c, img, k * w + 7, 40, size); c.fillStyle = '#333'; c.font = '600 15px system-ui'; c.fillText(`${KS[k]} layer${KS[k] > 1 ? 's' : ''}`, k * w + 10, 28); c.font = '13px system-ui'; c.fillText(KS[k] === N ? `${N * N} numbers` : `${KS[k] * (2 * N + 1)} numbers`, k * w + 10, 40 + size + 22); });
    c.fillStyle = '#555'; c.font = '13px system-ui'; c.fillText(`σ: ${vals.slice(0, 6).map(x => fmt(x, 1)).join(', ')}, …`, 10, cv.height - 12); }
  { const p = figPlane('ex5', 4); clearFig('ex5'); p.clip().axes();
    const pts = []; for (let k = 0; k < BLOB.length; k += 2) pts.push(...apply(m, BLOB[k], BLOB[k + 1]));
    const [mx, my, l1, l2, ux, uy] = pca2(new Float64Array(pts));
    for (let k = 0; k < pts.length; k += 2) { const t = (pts[k] - mx) * ux + (pts[k + 1] - my) * uy; p.line(pts[k], pts[k + 1], mx + t * ux, my + t * uy, 'rgba(0,0,0,.08)', 1); p.dot(pts[k], pts[k + 1], 3, 'rgba(37,99,235,.55)'); p.dot(mx + t * ux, my + t * uy, 2.5, 'rgba(124,58,237,.6)'); }
    const r1 = 2 * Math.sqrt(l1), r2 = 2 * Math.sqrt(l2);
    p.arrow(ux * r1, uy * r1, COL.w, { from: [mx, my], width: 4, label: 'PC 1' }).arrow(-uy * r2, ux * r2, COL.blue, { from: [mx, my], width: 4, label: 'PC 2' }).done();
    let diff = Math.abs(Math.atan2(uy, ux) - d.tu) % Math.PI; diff = Math.min(diff, Math.PI - diff);
    $('cap5').textContent = `240 points: a round blob moved by your matrix. PCA's first direction is ${Math.round(diff * 180 / Math.PI)}° from your matrix's u₁, and the spreads are in the ratio ${fmt(Math.sqrt(l1 / Math.max(l2, 1e-12)), 1)} : 1 (σ₁/σ₂ = ${fmt(d.s1 / Math.max(d.s2, 1e-12), 1)}). Purple dots: the data squeezed to one number each.`; }
}

const TRY = [() => { stage = 0; $('stage').value = 0; draw(st); let s = 0; const id = setInterval(() => { s += 0.03; stage = Math.min(3, s); $('stage').value = stage; draw(st); if (s >= 3) clearInterval(id); }, 40); },
  () => st.set([0.866, -0.5, 0.5, 0.866], 2), () => { st.set([1, 1, 0, 1], 5); $('rank1').checked = true; draw(st); }, () => { $('rank1').checked = false; st.set([-1, 0, 0, 1], 6); $('playMove').click(); }];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { if (+b.dataset.try !== 2) $('rank1').checked = false; TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });
st.update();

// Together (together/share.js): the matrix and which stage of the move is shown
const m4 = v => (nums(v, 4)?.length === 4 ? [...v] : null), t01 = t => (Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1);
share(() => ({ m: st.m, t: st.t, stage }), s => {
  const m = m4(s?.m); if (!m || !Number.isFinite(s.stage)) return;
  st.m = m; st.t = t01(s.t); st.update(); stage = Math.max(0, Math.min(3, s.stage)); $('stage').value = stage; draw(st);
});
