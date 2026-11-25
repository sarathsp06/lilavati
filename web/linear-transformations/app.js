// Linear transformations: drag î and ĵ and the grid, a flag and a vector v all follow.
// Maths: pkg/mathtoys.js (linalg); drawing: ../la.js.
import init, { det2, inv2, mul2 } from '../pkg/mathtoys.js';
import { Plane, COL, FLAG, I2, apply, rot, fmt, vec, matrixToy, basis, figPlane, clearFig, panels } from '../la.js';

await init();
const $ = id => document.getElementById(id);
const P = new Plane($('plane'), 4);
let v = [1, 2];
const st = matrixToy(P, { start: 9, change: draw });
P.handle(() => v, (x, y) => { v = [x, y]; draw(st); });
$('undo').addEventListener('click', () => {
  const i = inv2(...st.m);
  if (!i.length) { $('say').innerHTML = '<b>This move can\'t be undone</b>: it squashes the plane onto a line, so many points landed on the same spot.'; return; }
  st.set(i.map(x => +x.toFixed(4)));
});

function draw(s) {
  const m = s.mt;
  P.clear().grid(I2, COL.old).grid(m).axes();
  P.poly(FLAG, I2, null, 'rgba(0,0,0,.18)', 2).poly(FLAG, m, 'rgba(245,158,11,.25)', '#b45309', 2.5);
  // v before (faint) and after, built from x steps of î and y of ĵ
  const [ix, iy] = apply(m, 1, 0), [ax, ay] = apply(m, ...v);
  P.arrow(v[0], v[1], 'rgba(245,158,11,.45)', { width: 2.5, label: 'v' }).dot(v[0], v[1], 7, 'rgba(245,158,11,.6)');
  P.line(0, 0, ix * v[0], iy * v[0], COL.i, 2.5, [7, 6]).line(ix * v[0], iy * v[0], ax, ay, COL.j, 2.5, [7, 6]);
  basis(P, m);
  P.arrow(ax, ay, COL.v, { label: 'Av' });
  const d = det2(...s.m);
  $('say').innerHTML = `v = ${vec(...v, 1)} lands at <b>Av = ${vec(ax, ay)}</b> = ${fmt(v[0], 1)}·(green) + ${fmt(v[1], 1)}·(red). Areas × ${fmt(d)}${Math.abs(d) < 1e-9 ? ' (squashed: no way back)' : ''}.`;
  explain(s.m);
}

function explain(m) {
  { const p = figPlane('ex1'); clearFig('ex1'); p.clip().grid(m, 'rgba(37,99,235,.2)').axes();
    const [ix, iy] = apply(m, 1, 0), [jx, jy] = apply(m, 0, 1), [ax, ay] = apply(m, ...v);
    for (let k = 0; k < Math.abs(Math.round(v[0] * 2)); k++) { const s = Math.sign(v[0]) * 0.5; p.arrow(ix * s, iy * s, COL.i, { from: [ix * s * k, iy * s * k], width: 3, head: 10 }); }
    const bx = ix * Math.round(v[0] * 2) / 2, by = iy * Math.round(v[0] * 2) / 2;
    for (let k = 0; k < Math.abs(Math.round(v[1] * 2)); k++) { const s = Math.sign(v[1]) * 0.5; p.arrow(jx * s, jy * s, COL.j, { from: [bx + jx * s * k, by + jy * s * k], width: 3, head: 10 }); }
    p.arrow(ax, ay, COL.v, { width: 4, label: 'Av' }).done();
    $('cap1').textContent = `v = ${vec(...v, 1)}: ${fmt(v[0], 1)} steps of the moved î (green) and ${fmt(v[1], 1)} of the moved ĵ (red), in half steps. They end at Av = ${vec(...apply(m, ...v))}.`; }
  { const [a, b] = panels('ex2', 2, 3.2);
    for (const [p, mm, t] of [[a, I2, 'before'], [b, m, 'after']]) { p.clip().clear().grid(mm).axes().poly(FLAG, mm, 'rgba(245,158,11,.3)', '#b45309'); basis(p, mm, false); p.done().title(t); } }
  { const p = figPlane('ex3', 3.5); clearFig('ex3'); p.clip().grid(m, 'rgba(37,99,235,.18)').axes(); basis(p, m); p.done();
    const c = p.c; c.font = '700 30px ui-monospace, monospace';
    const x0 = 18, y0 = 70; c.fillStyle = '#111'; c.fillRect(x0, y0 - 40, 4, 100); c.fillRect(x0 + 186, y0 - 40, 4, 100);
    c.fillStyle = '#15803d'; c.fillText(fmt(m[0], 1), x0 + 14, y0); c.fillText(fmt(m[2], 1), x0 + 14, y0 + 48);
    c.fillStyle = '#b91c1c'; c.fillText(fmt(m[1], 1), x0 + 104, y0); c.fillText(fmt(m[3], 1), x0 + 104, y0 + 48); }
  { const B = [0, -1, 1, 0], [p, q, r] = panels('ex4', 3, 3.6);
    const ba = mul2(...B, ...m), ab = mul2(...m, ...B);
    for (const [pl, mm, t] of [[p, I2, 'start'], [q, ba, 'A, then turn: BA'], [r, ab, 'turn, then A: AB']]) { pl.clip().clear().grid(mm, 'rgba(37,99,235,.25)').axes().poly(FLAG, mm, 'rgba(245,158,11,.3)', '#b45309'); pl.done().title(t); }
    $('cap4').textContent = `BA = [[${ba.map(x => fmt(x, 1)).join(', ')}]] but AB = [[${ab.map(x => fmt(x, 1)).join(', ')}]]${ab.every((x, k) => Math.abs(x - ba[k]) < 1e-9) ? ': these happen to be equal for your A' : ': different'}.`.replace(/\[\[(.*?), (.*?), (.*?), (.*?)\]\]/g, '[[$1, $2], [$3, $4]]'); }
  { const i = inv2(...m), [p, q, r] = panels('ex5', 3, 3.6);
    p.clip().clear().grid(I2).axes().poly(FLAG, I2, 'rgba(245,158,11,.3)', '#b45309'); p.done().title('start');
    q.clip().clear().grid(m).axes().poly(FLAG, m, 'rgba(245,158,11,.3)', '#b45309'); q.done().title('after A');
    if (i.length) { const back = mul2(...i, ...m); r.clip().clear().grid(back).axes().poly(FLAG, back, 'rgba(22,163,74,.3)', '#15803d'); r.done().title('after A⁻¹: back'); $('cap5').textContent = `A⁻¹ = [[${fmt(i[0])}, ${fmt(i[1])}], [${fmt(i[2])}, ${fmt(i[3])}]] puts every point back.`; }
    else { r.clear(); r.title('no A⁻¹: squashed', '#b91c1c'); $('cap5').textContent = 'Your matrix squashes the plane onto a line, so it has no inverse: there is no way back.'; } }
  { const [p, q] = panels('ex6', 2, 3.2), n = 12;
    p.clip().clear().grid(m).axes().poly(FLAG, m, 'rgba(245,158,11,.3)', '#b45309'); p.done().title('W x');
    q.clip().clear().axes(); const c = q.c; c.strokeStyle = COL.grid; c.lineWidth = 1.4;
    const relu = (x, y) => q.P(Math.max(0, x), Math.max(0, y));
    for (let k = -n; k <= n; k++) for (const vert of [true, false]) { c.beginPath(); for (let s = -n; s <= n; s += 0.25) { const [x, y] = apply(m, vert ? k : s, vert ? s : k), [px, py] = relu(x, y); s === -n ? c.moveTo(px, py) : c.lineTo(px, py); } c.stroke(); }
    const fl = []; for (let i = 0; i < FLAG.length; i += 2) { const [x, y] = apply(m, FLAG[i], FLAG[i + 1]); fl.push(Math.max(0, x), Math.max(0, y)); }
    q.poly(fl, I2, 'rgba(245,158,11,.3)', '#b45309'); q.done().title('ReLU(W x)'); }
}

const TRY = [() => st.set([0, -1, 1, 0], 1), () => { st.set([1, 1, 0, 1], 5); st.play(); }, () => { st.set([1, 2, 0.5, 1], 8); setTimeout(() => $('undo').click(), 900); }, () => { v = [2, 1]; draw(st); }];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });
st.update();
