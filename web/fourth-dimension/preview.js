// Home page card: a tesseract's shadow turning in the xw and yw planes (a cube inside a cube, turning inside out),
// with the build-up point → segment → square → cube on the left. Plain JS, no WebAssembly.
const AX = ['#dc2626', '#16a34a', '#2563eb', '#c026d3'];
const V = Array.from({ length: 16 }, (_, i) => [0, 1, 2, 3].map(k => ((i >> k) & 1) - 0.5));
const E = []; for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) if (!((i >> k) & 1)) E.push([i, i | (1 << k), k]);

function project(p, a, b) {
  let [x, y, z, w] = p;
  [x, w] = [Math.cos(a) * x - Math.sin(a) * w, Math.sin(a) * x + Math.cos(a) * w];      // xw turn
  [y, w] = [Math.cos(b) * y - Math.sin(b) * w, Math.sin(b) * y + Math.cos(b) * w];      // yw turn
  const s4 = 2.5 / (2.5 - w); x *= s4; y *= s4; z *= s4;                                // 4D → 3D: divide by d − w
  [x, z] = [Math.cos(0.5) * x - Math.sin(0.5) * z, Math.sin(0.5) * x + Math.cos(0.5) * z];   // a view turn in our space
  [y, z] = [Math.cos(0.35) * y - Math.sin(0.35) * z, Math.sin(0.35) * y + Math.cos(0.35) * z];
  const s3 = 4 / (4 - z);
  return [x * s3, y * s3, w];
}

export default function preview(c, w, h, sec) {
  // the build-up, small, on the left
  const sx = 28, sy = h / 2, u = 22;
  c.lineWidth = 2;
  c.fillStyle = '#57534e'; c.beginPath(); c.arc(sx, sy, 3.5, 0, 7); c.fill();
  const seg = [[sx + 22, sy], [sx + 22 + u, sy]];
  c.strokeStyle = AX[0]; c.beginPath(); c.moveTo(...seg[0]); c.lineTo(...seg[1]); c.stroke();
  const qx = sx + 80; c.strokeStyle = AX[0]; c.strokeRect(qx, sy - u / 2, u, u);
  c.strokeStyle = AX[1]; c.beginPath(); c.moveTo(qx, sy - u / 2); c.lineTo(qx, sy + u / 2); c.moveTo(qx + u, sy - u / 2); c.lineTo(qx + u, sy + u / 2); c.stroke();
  const kx = qx + 44, o = 9;
  c.strokeStyle = '#78716c'; c.strokeRect(kx, sy - u / 2 + o / 2, u, u); c.strokeRect(kx + o, sy - u / 2 - o / 2, u, u);
  c.strokeStyle = AX[2]; c.beginPath(); for (const [dx, dy] of [[0, 0], [u, 0], [0, u], [u, u]]) { c.moveTo(kx + dx, sy - u / 2 + o / 2 + dy); c.lineTo(kx + o + dx, sy - u / 2 - o / 2 + dy); } c.stroke();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.font = '15px system-ui'; c.textAlign = 'center';
  for (const x of [sx + 11, sx + 66, qx + u + 10, kx + u + o + 14]) c.fillText('→', x, sy + 5);
  // the tesseract
  const a = sec * 0.45, b = sec * 0.17, cx = w * 0.66, cy = h / 2, s = h * 0.36;
  const P = V.map(p => project(p, a, b));
  const order = E.map((e, i) => i).sort((i, j) => (P[E[i][0]][2] + P[E[i][1]][2]) - (P[E[j][0]][2] + P[E[j][1]][2]));
  for (const i of order) {
    const [p, q, k] = E[i], near = Math.min(1, Math.max(0, ((P[p][2] + P[q][2]) / 2 + 1) / 2));
    c.globalAlpha = 0.4 + 0.6 * near; c.strokeStyle = AX[k]; c.lineWidth = 1.5 + 2.5 * near;
    c.beginPath(); c.moveTo(cx + P[p][0] * s, cy - P[p][1] * s); c.lineTo(cx + P[q][0] * s, cy - P[q][1] * s); c.stroke();
  }
  c.globalAlpha = 1;
  for (const p of P) { const near = Math.min(1, Math.max(0, (p[2] + 1) / 2)); c.fillStyle = `rgba(109,40,217,${0.35 + 0.65 * near})`; c.beginPath(); c.arc(cx + p[0] * s, cy - p[1] * s, 3 + 3 * near, 0, 7); c.fill(); }
}
