// Home-page card for the chaos page: two runs of Lorenz's equations a thousandth apart, seen from the side
// (x across, z up). They travel together, then part. Plain JS so the card needs no WebAssembly.
const H = 0.01, N = 2600;
function rk4(s) {
  const f = ([x, y, z]) => [10 * (y - x), x * (28 - z) - y, x * y - 8 / 3 * z];
  const ad = (a, k, h) => a.map((v, i) => v + h * k[i]);
  const k1 = f(s), k2 = f(ad(s, k1, H / 2)), k3 = f(ad(s, k2, H / 2)), k4 = f(ad(s, k3, H));
  return s.map((v, i) => v + H / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
let s = [1, 1, 1];
for (let i = 0; i < 2000; i++) s = rk4(s);
const run = from => { const out = [from]; let p = from; for (let i = 1; i < N; i++) out.push(p = rk4(p)); return out; };
const A = run(s), B = run([s[0] + 1e-3, s[1], s[2]]);

export default function preview(c, w, h, sec) {
  const k = Math.floor((sec * 160) % N), X = x => w / 2 + x * 7.5, Y = z => h - 8 - z * 4.9, tail = 260;
  c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 1; c.beginPath();
  for (let i = 0; i < N; i += 3) { const [x, , z] = A[i]; i ? c.lineTo(X(x), Y(z)) : c.moveTo(X(x), Y(z)); }
  c.stroke();
  for (const [P, col] of [[B, '#0891b2'], [A, '#f97316']]) {
    c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath();
    for (let i = Math.max(0, k - tail); i <= k; i++) { const [x, , z] = P[i]; i > k - tail && i > 0 ? c.lineTo(X(x), Y(z)) : c.moveTo(X(x), Y(z)); }
    c.stroke();
    const [x, , z] = P[k]; c.fillStyle = col; c.beginPath(); c.arc(X(x), Y(z), 5, 0, 7); c.fill();
  }
  const d = Math.hypot(A[k][0] - B[k][0], A[k][1] - B[k][1], A[k][2] - B[k][2]);
  c.fillStyle = '#7c2d12'; c.font = '600 14px system-ui'; c.textAlign = 'left';
  c.fillText(`gap ${d < 0.01 ? d.toExponential(0) : d.toFixed(d < 1 ? 2 : 0)}`, 16, 24);
}
