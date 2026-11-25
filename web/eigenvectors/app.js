// Eigenvectors: drag v until Av stays on v's line; apply the matrix again and again (power
// iteration). Maths: pkg/mathtoys.js (linalg); drawing: ../la.js.
import init, { eig2, det2 } from '../pkg/mathtoys.js';
import { Plane, COL, I2, MATRICES, apply, fmt, vec, matrixToy, basis, figPlane, clearFig, panels } from '../la.js';

await init();
const $ = id => document.getElementById(id);
const P = new Plane($('plane'), 4);
const PRESETS = [...MATRICES, ['Fibonacci rabbits', [1, 1, 1, 0]]];
let v = [2, 0.6], trail = [];
const st = matrixToy(P, { presets: PRESETS, start: 7, change: s => { draw(s); } });
P.handle(() => v, (x, y) => { v = [x, y]; trail = []; draw(st); });
const unit2 = (x, y, r = 2) => { const n = Math.hypot(x, y) || 1; return [x * r / n, y * r / n]; };
$('again').addEventListener('click', () => { trail.push(v); if (trail.length > 12) trail.shift(); v = unit2(...apply(st.m, ...v)); draw(st); });
$('restart').addEventListener('click', () => { v = [2, 0.6]; trail = []; draw(st); });
const angleBetween = (a, b) => { let d = Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function eigenText(e) {
  if (e.length === 2) return `Eigenvalues are complex (${fmt(e[0])} ± ${fmt(e[1])}i): <b>every direction gets turned</b>.`;
  const same = Math.abs(e[2] * e[5] - e[3] * e[4]) < 1e-6;
  return same ? `One eigenvalue, <b>λ = ${fmt(e[0])}</b>, and only one line of eigenvectors, along ${vec(e[2], e[3])}.`
    : `Eigenvalues <b>λ₁ = ${fmt(e[0])}</b> along ${vec(e[2], e[3])} and <b>λ₂ = ${fmt(e[1])}</b> along ${vec(e[4], e[5])}.`;
}
function eigenLines(p, e, labels = true) {
  if (e.length === 2) return;
  p.through(e[2], e[3], 'rgba(147,51,234,.7)', 2.5, [10, 7]); if (labels) p.label(`λ₁ = ${fmt(e[0])}`, e[2] * 3, e[3] * 3, '#7e22ce', 20);
  if (Math.abs(e[2] * e[5] - e[3] * e[4]) > 1e-6) { p.through(e[4], e[5], 'rgba(147,51,234,.45)', 2.5, [4, 6]); if (labels) p.label(`λ₂ = ${fmt(e[1])}`, e[4] * 3, e[5] * 3, '#7e22ce', 20); }
}

function draw(s) {
  const m = s.mt, e = eig2(...s.m), Av = apply(m, ...v);
  P.clear().grid(I2, COL.old).grid(m, 'rgba(37,99,235,.2)').axes();
  eigenLines(P, eig2(...m));
  trail.forEach((t, k) => P.arrow(t[0], t[1], `rgba(245,158,11,${0.12 + 0.05 * k})`, { width: 2, head: 8 }));
  P.through(v[0], v[1], 'rgba(0,0,0,.18)', 1.5, [4, 6]);
  basis(P, m);
  P.arrow(v[0], v[1], 'rgba(245,158,11,.5)', { width: 3, label: 'v' }).dot(v[0], v[1], 7, 'rgba(245,158,11,.7)');
  P.arrow(Av[0], Av[1], COL.v, { width: 4, label: 'Av' });
  const turn = angleBetween(v, Av), on = Math.min(Math.abs(turn), Math.PI - Math.abs(turn)) < 0.02 && Math.hypot(...Av) > 1e-6;
  const ratio = Math.hypot(...Av) / (Math.hypot(...v) || 1) * (Math.abs(turn) > Math.PI / 2 ? -1 : 1);
  $('say').innerHTML = eigenText(e) + ' ' + (on ? `<b style="color:#7e22ce">v is on its own line: Av = ${fmt(ratio)} × v.</b>` : `v gets turned by ${Math.round(Math.abs(turn) * 180 / Math.PI)}°.`);
  $('againSay').textContent = trail.length ? `Applied ${trail.length} time${trail.length > 1 ? 's' : ''}. ${e.length === 6 ? `Angle to the λ₁ line: ${Math.round(Math.abs(Math.asin(Math.max(-1, Math.min(1, (v[0] * e[3] - v[1] * e[2]) / Math.hypot(...v))))) * 180 / Math.PI)}°.` : 'With no real eigenvectors it just keeps turning.'}` : 'Each press replaces v by Av, scaled back to length 2 so it stays on screen.';
  explain(s.m, e);
}

function explain(m, e) {
  { const p = figPlane('ex1', 3.4); clearFig('ex1'); p.clip().axes();
    for (let k = 0; k < 24; k++) { const t = Math.PI * k / 12, x = Math.cos(t), y = Math.sin(t), [ax, ay] = apply(m, x, y), d = Math.abs(angleBetween([x, y], [ax, ay])), tw = Math.min(d, Math.PI - d) / (Math.PI / 2);
      p.arrow(x, y, 'rgba(0,0,0,.25)', { width: 1.5, head: 7 }); p.arrow(ax, ay, `hsl(${280 - 250 * tw}, 75%, ${45 + 10 * tw}%)`, { width: 2.5, head: 9 }); }
    p.done(); }
  { const p = figPlane('ex2', 3.4); clearFig('ex2'); p.clip().grid(m, 'rgba(37,99,235,.15)').axes(); eigenLines(p, e);
    if (e.length === 6) for (const [x, y] of [[e[2], e[3]], [e[4], e[5]]]) { p.arrow(x * 1.2, y * 1.2, 'rgba(245,158,11,.6)', { width: 3 }); p.arrow(...apply(m, x * 1.2, y * 1.2), COL.v, { width: 4 }); }
    p.done(); $('cap2').innerHTML = e.length === 6 ? 'The eigenvector lines of your matrix: v (light) and Av (dark) stay on the same line.' : 'Your matrix turns every direction: no real eigenvector lines. Try another matrix.'; }
  { const cv = clearFig('ex3'), c = cv.getContext('2d'), W = cv.width, H = cv.height, X = v => 40 + (W - 80) * (v + 3) / 6, y = H / 2;
    const zones = [[-3, -1, 'flips and grows', '#fee2e2'], [-1, 0, 'flips and shrinks', '#ffedd5'], [0, 1, 'shrinks', '#e0f2fe'], [1, 3, 'grows', '#dcfce7']];
    for (const [a, b, t, col] of zones) { c.fillStyle = col; c.fillRect(X(a), y - 50, X(b) - X(a), 100); c.fillStyle = '#555'; c.font = '16px system-ui'; c.fillText(t, X(a) + 8, y - 30); }
    c.strokeStyle = '#333'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(-3), y); c.lineTo(X(3), y); c.stroke();
    c.font = '15px system-ui'; c.fillStyle = '#333'; for (let k = -3; k <= 3; k++) { c.fillRect(X(k) - 1, y - 6, 2, 12); c.fillText(k, X(k) - 4, y + 26); }
    if (e.length === 6) [[e[0], 'λ₁'], [e[1], 'λ₂']].forEach(([l, n], k) => { const x = X(Math.max(-3, Math.min(3, l))); c.fillStyle = '#7e22ce'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.font = '600 18px system-ui'; c.fillText(`${n} = ${fmt(l)}`, x - 30, y + 60 + 22 * k); });
    else { c.fillStyle = '#7e22ce'; c.font = '600 18px system-ui'; c.fillText(`complex: ${fmt(e[0])} ± ${fmt(e[1])}i, no point on this line`, 50, y + 70); } }
  { const cv = clearFig('ex4'), c = cv.getContext('2d'), W = cv.width, H = cv.height, tr = m[0] + m[3], d = det2(...m), f = l => l * l - tr * l + d;
    const lo = Math.min(-3, tr / 2 - 3), hi = lo + 6 + Math.max(0, tr / 2 + 3 - (lo + 6)), vals = Array.from({ length: 121 }, (_, k) => f(lo + (hi - lo) * k / 120)), top = Math.max(4, ...vals.map(Math.abs).slice(30, 90));
    const X = l => 40 + (W - 80) * (l - lo) / (hi - lo), Y = q => H / 2 - (H / 2 - 30) * Math.max(-1.2, Math.min(1.2, q / top));
    c.strokeStyle = '#999'; c.beginPath(); c.moveTo(40, Y(0)); c.lineTo(W - 40, Y(0)); c.stroke();
    c.strokeStyle = '#7e22ce'; c.lineWidth = 3; c.beginPath(); vals.forEach((q, k) => { const x = X(lo + (hi - lo) * k / 120); k ? c.lineTo(x, Y(q)) : c.moveTo(x, Y(q)); }); c.stroke();
    if (e.length === 6) for (const l of [e[0], e[1]]) { c.fillStyle = '#111'; c.beginPath(); c.arc(X(l), Y(0), 7, 0, 7); c.fill(); }
    c.fillStyle = '#333'; c.font = '18px ui-monospace, monospace'; c.fillText(`λ² − ${fmt(tr)}λ + ${fmt(d)} = 0`, 50, 34);
    c.font = '15px system-ui'; c.fillText(e.length === 6 ? `roots ${fmt(e[0])} and ${fmt(e[1])}: sum ${fmt(tr)} (trace), product ${fmt(d)} (determinant)` : 'the curve never reaches zero: no real roots', 50, H - 16); }
  { const p = figPlane('ex5', 3.4); clearFig('ex5'); p.clip().axes(); eigenLines(p, e, false);
    let u = [1, 0.15]; for (let k = 0; k <= 10; k++) { const [x, y] = unit2(...u, 3); p.arrow(x, y, `rgba(245,158,11,${0.2 + 0.08 * k})`, { width: 2.5, head: 9 }); p.label(String(k), x, y, '#92400e', 16); u = apply(m, ...u); }
    p.done(); $('cap5').textContent = e.length === 6 ? `Starting from (1, 0.15): after 10 steps it lies ${Math.round(Math.abs(Math.asin(Math.max(-1, Math.min(1, (unit2(...u, 1)[0] * e[3] - unit2(...u, 1)[1] * e[2]))))) * 180 / Math.PI)}° from the λ₁ line.` : 'With complex eigenvalues the arrow keeps turning round and never settles.'; }
  { const [p, q] = panels('ex6', 2, 3.2);
    if (e.length === 6 && Math.abs(e[2] * e[5] - e[3] * e[4]) > 1e-6) {
      const B = [e[2], e[4], e[3], e[5]], AB = [m[0] * B[0] + m[1] * B[2], m[0] * B[1] + m[1] * B[3], m[2] * B[0] + m[3] * B[2], m[2] * B[1] + m[3] * B[3]];
      for (const [pl, mm, t] of [[p, B, 'eigen grid'], [q, AB, 'after the matrix']]) { pl.clip().clear().axes().grid(mm, 'rgba(147,51,234,.45)'); eigenLines(pl, e, false); pl.done().title(t); }
      $('cap6').textContent = `Along the eigen grid your matrix is just diag(${fmt(e[0])}, ${fmt(e[1])}): stretch each direction, no turning.`;
    } else { p.clear().title('no second eigen direction'); q.clear(); $('cap6').textContent = 'Your matrix has no two separate eigen directions (a turn or a shear), so it can\'t be written as a pure stretch. Try "Symmetric".'; } }
}

const TRY = [() => { st.set([2, 0, 0, 0.5], 4); v = [2.5, 0]; trail = []; draw(st); }, () => st.set([0, -1, 1, 0], 1), () => { st.set([2, 1, 1, 2], 7); v = [2, -0.8]; trail = []; let k = 0; const id = setInterval(() => { $('again').click(); if (++k >= 5) clearInterval(id); }, 450); },
  () => { st.set([1, 1, 1, 0], PRESETS.length - 1); v = [0.4, 2]; trail = []; let k = 0; const id = setInterval(() => { $('again').click(); if (++k >= 8) clearInterval(id); }, 450); }];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });
st.update();
