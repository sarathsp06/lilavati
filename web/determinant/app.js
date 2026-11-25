// The determinant: the unit square becomes a parallelogram whose (signed) area is det A.
// Maths: pkg/mathtoys.js (linalg); drawing: ../la.js.
import init, { det2, mul2 } from '../pkg/mathtoys.js';
import { Plane, COL, FLAG, I2, apply, fmt, matrixToy, basis, figPlane, clearFig, panels } from '../la.js';

await init();
const $ = id => document.getElementById(id);
const P = new Plane($('plane'), 4);
const SQ = [0, 0, 1, 0, 1, 1, 0, 1];
const fill = d => (d > 1e-9 ? 'rgba(22,163,74,.3)' : d < -1e-9 ? 'rgba(220,38,38,.3)' : 'rgba(0,0,0,.2)');
const edge = d => (d > 1e-9 ? '#15803d' : d < -1e-9 ? '#b91c1c' : '#444');
const st = matrixToy(P, { start: 9, change: draw });
$('showCircle').addEventListener('change', () => draw(st));

function draw(s) {
  const m = s.mt, d = det2(...m);
  P.clear().grid(I2, COL.old).grid(m).axes();
  P.poly(SQ, I2, null, 'rgba(0,0,0,.25)', 2);
  if ($('showCircle').checked) P.circle(I2, null, 'rgba(0,0,0,.18)', 2).circle(m, 'rgba(124,58,237,.10)', '#7c3aed', 2);
  P.poly(SQ, m, fill(d), edge(d), 3);
  const [cx, cy] = apply(m, 0.5, 0.5); P.label(fmt(d), cx - 0.3, cy - 0.1, edge(d), 26);
  basis(P, m);
  const D = det2(...s.m);
  $('say').innerHTML = `det = ad − bc = ${fmt(s.m[0], 1)}×${fmt(s.m[3], 1)} − ${fmt(s.m[1], 1)}×${fmt(s.m[2], 1)} = <b>${fmt(D)}</b>. ` +
    (Math.abs(D) < 1e-9 ? 'Every area becomes <b>0</b>: space is squashed flat.' : `Every area × <b>${fmt(Math.abs(D))}</b>${D < 0 ? ', and space is <b>flipped</b> over.' : '.'}`);
  explain(s.m);
}

function explain(m) {
  const d = det2(...m);
  { const p = figPlane('ex1', 3.5); clearFig('ex1'); p.clip().grid(m, 'rgba(37,99,235,.18)').axes().poly(SQ, I2, null, 'rgba(0,0,0,.3)', 2).poly(SQ, m, fill(d), edge(d), 3); basis(p, m); p.done();
    $('cap1').textContent = `The square of area 1 becomes a parallelogram of area ${fmt(Math.abs(d))}${d < 0 ? ' (flipped, so the determinant is ' + fmt(d) + ')' : ''}.`; }
  { const [p, q] = panels('ex2', 2, 3.2);
    for (const [pl, mm, t] of [[p, I2, 'before'], [q, m, 'after']]) { pl.clip().clear().grid(mm, 'rgba(37,99,235,.2)').axes().circle(mm, 'rgba(124,58,237,.15)', '#7c3aed').poly(FLAG, mm, 'rgba(245,158,11,.3)', '#b45309'); pl.done().title(t); }
    const k = Math.abs(d); $('cap2').textContent = `Circle: π ≈ 3.14 → ${fmt(Math.PI * k)}. Flag: 0.84 → ${fmt(0.844 * k)}. Every area × ${fmt(k)}.`; }
  { const p = figPlane('ex3', 2.6, [140, 10, 400]); clearFig('ex3'); const [a, b, c, dd] = [3, 1, 1, 2], sc = 0.55;
    const S = (x, y) => [x * sc - 1.9, y * sc - 1.5], poly = (pts, f, s) => p.poly(pts.flatMap((v, i) => (i % 2 ? [] : S(v, pts[i + 1]))), I2, f, s, 2);
    poly([0, 0, a + b, 0, a + b, c + dd, 0, c + dd], null, '#333');
    poly([0, 0, a, 0, a, c], 'rgba(234,88,12,.25)', '#ea580c'); poly([a + b, c + dd, b, c + dd, b, dd], 'rgba(234,88,12,.25)', '#ea580c');
    poly([0, 0, b, dd, 0, dd], 'rgba(37,99,235,.2)', '#2563eb'); poly([a + b, c + dd, a, c, a + b, c], 'rgba(37,99,235,.2)', '#2563eb');
    poly([a, 0, a + b, 0, a + b, c, a, c], 'rgba(124,58,237,.25)', '#7c3aed'); poly([0, dd, b, dd, b, c + dd, 0, c + dd], 'rgba(124,58,237,.25)', '#7c3aed');
    poly([0, 0, a, c, a + b, c + dd, b, dd], 'rgba(22,163,74,.35)', '#15803d');
    p.text('box (a+b)(c+d) = 12', 10, 26, '#333', 18).text('− 2 × ac/2 = 3', 10, 50, '#ea580c', 18).text('− 2 × bd/2 = 2', 10, 74, '#2563eb', 18).text('− 2 × bc = 2', 10, 98, '#7c3aed', 18).text('= ad − bc = 5', 10, 128, '#15803d', 20); }
  { const M = d < 0 ? m : [-1, 0, 0, 1], [p, q] = panels('ex4', 2, 3.2);
    for (const [pl, mm, t] of [[p, I2, 'before'], [q, M, d < 0 ? 'your matrix' : 'a mirror']]) {
      pl.clip().clear().grid(mm, 'rgba(37,99,235,.2)').axes().poly(FLAG, mm, 'rgba(245,158,11,.3)', '#b45309'); basis(pl, mm, false);
      const [ix, iy] = apply(mm, 1, 0), [jx, jy] = apply(mm, 0, 1), [ox, oy] = pl.P(0, 0), a1 = Math.atan2(iy, ix), a2 = Math.atan2(jy, jx); let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      pl.c.strokeStyle = da > 0 ? '#15803d' : '#b91c1c'; pl.c.lineWidth = 3; pl.c.beginPath(); pl.c.arc(ox, oy, 34, -a1, -(a1 + da), da > 0); pl.c.stroke();
      pl.done().title(`${t}: î → ĵ ${da > 0 ? 'anticlockwise' : 'clockwise'}`); } }
  { const M = Math.abs(d) < 1e-9 ? m : [1, 2, 0.5, 1], p = figPlane('ex5', 4); clearFig('ex5');
    p.clip().grid(M, 'rgba(37,99,235,.35)').axes();
    const [ix, iy] = apply(M, 1, 0); p.through(ix || 1, iy, '#b91c1c', 3);
    for (const [x, y, col] of [[2, -1, '#2563eb'], [0, 0, '#ea580c'], [-2, 1, '#7c3aed']]) { p.dot(x, y, 8, col); const [X, Y] = apply(M, x, y); p.line(x, y, X, Y, col, 1.5, [5, 5]); }
    const [X, Y] = apply(M, 2, -1); p.ring(X, Y, 14, '#111').done().title(`${Math.abs(d) < 1e-9 ? 'your matrix' : '[[1, 2], [0.5, 1]]'}: three points, one landing spot`); }
  { const B = [2, 0, 0, 2], BA = mul2(...m, ...B), [p, q, r] = panels('ex6', 3, 3.6);
    for (const [pl, mm, t] of [[p, B, `B: ${fmt(det2(...B))}`], [q, m, `A: ${fmt(d)}`], [r, BA, `AB: ${fmt(det2(...BA))}`]]) { const dd = det2(...mm); pl.clip().clear().grid(mm, 'rgba(37,99,235,.2)').axes().poly(SQ, mm, fill(dd), edge(dd), 2.5); pl.done().title(t); }
    $('cap6').textContent = `det(AB) = det(A) × det(B) = ${fmt(d)} × 4 = ${fmt(4 * d)}.`; }
}

const TRY = [() => { st.set([1, 1, 0, 1], 5); st.play(); }, () => { st.set([1, 0.5, 0.3, 1]); let k = 0; const id = setInterval(() => { k += 0.04; st.m = [1, 0.5 - 1.6 * k, 0.3, 1 - 0.6 * k]; st.update(); if (k >= 1) clearInterval(id); }, 50); }, () => { st.set([2, 0, 0, 2], 3); st.play(); }, () => { st.set([1, 2, 0.5, 1], 8); st.play(); }];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });
st.update();
