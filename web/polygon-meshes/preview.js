// Home-page card: a ball made of flat triangles, 20, 80, 320, then 1,280 of them, turning slowly.
const T = (1 + Math.sqrt(5)) / 2;
const unit = p => { const l = Math.hypot(...p); return p.map(v => v / l); };
const BASE = { p: [[-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1]].map(unit),
  t: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]] };
const LEVELS = [BASE];
for (let k = 1; k < 4; k++) {
  const m = LEVELS[k - 1], p = m.p.slice(), mid = new Map(), t = [];
  const half = (a, b) => { const key = Math.min(a, b) + ',' + Math.max(a, b); if (!mid.has(key)) { p.push(unit(p[a].map((v, i) => v + p[b][i]))); mid.set(key, p.length - 1); } return mid.get(key); };
  for (const [a, b, c] of m.t) { const ab = half(a, b), bc = half(b, c), ca = half(c, a); t.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
  LEVELS.push({ p, t });
}
const L = (() => { const v = [-0.45, 0.6, 0.66], l = Math.hypot(...v); return v.map(x => x / l); })();
export default function preview(c, w, h, sec) {
  const k = Math.floor(sec / 1.6) % 5, m = LEVELS[Math.min(k, 3)], yaw = 0.5 + sec * 0.4, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(0.35), sp = Math.sin(0.35);
  const R = h * 0.4, ox = w * 0.38, oy = h / 2;
  const q = m.p.map(([x, y, z]) => { const x1 = cy * x + sy * z, z1 = -sy * x + cy * z; return [x1, cp * y - sp * z1, sp * y + cp * z1]; });
  c.lineJoin = 'round';
  for (const [a, b, d] of m.t) {
    const A = q[a], B = q[b], D = q[d], u = B.map((v, i) => v - A[i]), v = D.map((x, i) => x - A[i]);
    const n = unit([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    let wind = n; if ((A[0] + B[0] + D[0]) * n[0] + (A[1] + B[1] + D[1]) * n[1] + (A[2] + B[2] + D[2]) * n[2] < 0) wind = n.map(x => -x);
    if (wind[2] <= 0) continue;
    const s = 0.22 + 0.78 * Math.max(0, wind[0] * L[0] + wind[1] * L[1] + wind[2] * L[2]);
    c.fillStyle = `rgb(${52 * s | 0},${178 * s | 0},${166 * s | 0})`;
    c.beginPath(); c.moveTo(ox + A[0] * R, oy - A[1] * R); c.lineTo(ox + B[0] * R, oy - B[1] * R); c.lineTo(ox + D[0] * R, oy - D[1] * R); c.closePath(); c.fill();
    c.strokeStyle = m.t.length > 400 ? c.fillStyle : 'rgba(15,40,38,.55)'; c.lineWidth = 1; c.stroke();
  }
  c.font = '700 26px system-ui'; c.fillStyle = '#0f766e'; c.fillText((m.t.length).toLocaleString('en-GB'), w * 0.7, h * 0.45);
  c.font = '500 16px system-ui'; c.fillStyle = '#44403c'; c.fillText('flat triangles', w * 0.7, h * 0.45 + 24);
}
