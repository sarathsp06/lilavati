// Home page card for topology: a ring of squares (a doughnut seen from above) morphs into a mug seen
// from the side and back, while V − E + F stays 0. The same two maps as src/topology.rs, on its
// 8 × 6 grid with the hole in cells 5–6 across and 1–4 down.
const C = 8, R = 6, HOLE = [5, 1, 7, 5];
function ring(x, y) {
  const hx = 6, hy = 3, dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy);
  if (d < 1e-9) return [0, 0];
  const cx = dx / d, cy = dy / d;
  const hit = (x0, x1, y0, y1) => Math.min(Math.abs(cx) > 1e-9 ? ((cx > 0 ? x1 : x0) - hx) / cx : Infinity, Math.abs(cy) > 1e-9 ? ((cy > 0 ? y1 : y0) - hy) / cy : Infinity);
  const din = hit(HOLE[0], HOLE[2], HOLE[1], HOLE[3]), dout = hit(0, C, 0, R);
  const s = Math.max(0, Math.min(1, (d - din) / (dout - din))), rad = 0.42 + s * 0.63, a = Math.atan2(cy, cx);
  return [rad * Math.cos(a), -rad * Math.sin(a)];
}
function mug(x, y) {
  const v = (R / 2 - y) / (R / 2);
  if (x <= 5) return [-1.15 + x * 0.31, v * 1.05];
  const u = (x - 5) / 3, e = Math.min(1, u / 0.35), s = 1 - 0.4 * e * e * (3 - 2 * e);
  return [0.4 + u * 0.75 - 0.25 * u * u * v * v, v * s * 1.05];
}
const inHole = (x, y) => x >= HOLE[0] && x < HOLE[2] && y >= HOLE[1] && y < HOLE[3];

export default function preview(c, w, h, sec) {
  const k = 0.5 - 0.5 * Math.cos(sec * 0.7), t = k * k * (3 - 2 * k), S = h * 0.36, ox = w * 0.38, oy = h * 0.5;
  const P = (x, y) => { const a = ring(x, y), b = mug(x, y); return [ox + S * (a[0] + (b[0] - a[0]) * t), oy - S * (a[1] + (b[1] - a[1]) * t)]; };
  c.lineJoin = 'round';
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    if (inHole(x, y)) continue;
    const q = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
    c.beginPath(); q.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath();
    c.fillStyle = '#bbf7d0'; c.fill(); c.strokeStyle = '#15803d'; c.lineWidth = 1; c.stroke();
  }
  c.fillStyle = '#14532d'; c.font = '600 22px system-ui'; c.textAlign = 'left';
  c.fillText('1 hole', w * 0.7, h * 0.42);
  c.font = '18px system-ui'; c.fillStyle = '#15803d';
  c.fillText('V − E + F = 0', w * 0.7, h * 0.56);
  c.fillStyle = '#6b7280'; c.font = '14px system-ui';
  c.fillText(t < 0.5 ? 'doughnut' : 'mug', w * 0.7, h * 0.68);
}
