// Home page card for the brachistochrone page: a straight line, a circle arc and a cycloid from A down
// to B, with three balls let go together; the cycloid's ball arrives first. 560×260 canvas, drawn by home.js.
const G = 9.81, BX = 5, BY = 2.2, N = 160;
const cycloid = () => {
  const f = t => (1 - Math.cos(t)) / (t - Math.sin(t));
  let lo = 1e-6, hi = 2 * Math.PI - 1e-9;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (f(mid) > BY / BX) lo = mid; else hi = mid; }
  const te = (lo + hi) / 2, a = BX / (te - Math.sin(te));
  return Array.from({ length: N }, (_, i) => { const t = te * i / (N - 1); return [a * (t - Math.sin(t)), a * (1 - Math.cos(t))]; });
};
const line = () => Array.from({ length: N }, (_, i) => [BX * i / (N - 1), BY * i / (N - 1)]);
const arc = () => {
  const r = (BX * BX + BY * BY) / (2 * BX), end = Math.atan2(BY, BX - r);
  return Array.from({ length: N }, (_, i) => { const u = Math.PI + (end - Math.PI) * i / (N - 1); return [r + r * Math.cos(u), r * Math.sin(u)]; });
};
// each straight piece takes its length ÷ the average of the speeds at its ends, v = √(2·g·depth)
function timed(pts, color) {
  const ts = [0];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], v = Math.sqrt(2 * G * y0) + Math.sqrt(2 * G * y1);
    ts.push(ts[i - 1] + (v > 0 ? 2 * Math.hypot(x1 - x0, y1 - y0) / v : 0));
  }
  return { pts, ts, T: ts[ts.length - 1], color };
}
function at({ pts, ts }, t) {
  let i = 1; while (i < ts.length - 1 && ts[i] < t) i++;
  const u = Math.max(0, Math.min(1, (t - ts[i - 1]) / ((ts[i] - ts[i - 1]) || 1)));
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
}
let tracks = null;
export default (c, w, h, sec) => {
  tracks ??= [timed(line(), '#475569'), timed(arc(), '#a855f7'), timed(cycloid(), '#0e7490')];
  const deep = Math.max(...tracks.flatMap(k => k.pts.map(p => p[1])));
  const s = Math.min((w - 90) / BX, (h - 50) / deep), ox = 40, oy = 24, P = ([x, y]) => [ox + s * x, oy + s * y];
  const end = Math.max(...tracks.map(k => k.T)), t = Math.min(end, (sec * 0.45) % (end + 1.2));
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.setLineDash([5, 5]); c.lineWidth = 1; c.beginPath(); c.moveTo(10, oy); c.lineTo(w - 10, oy); c.stroke(); c.setLineDash([]);
  for (const k of tracks) { c.strokeStyle = k.color; c.lineWidth = k.color === '#0e7490' ? 3.5 : 2.5; c.beginPath(); k.pts.forEach((p, i) => (i ? c.lineTo(...P(p)) : c.moveTo(...P(p)))); c.stroke(); }
  for (const k of tracks) { const [x, y] = P(at(k, t)); c.fillStyle = k.color; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.stroke(); }
  c.fillStyle = '#1c1917'; c.font = '700 14px system-ui'; c.textAlign = 'center';
  const [ax, ay] = P([0, 0]), [bx, by] = P([BX, BY]); c.fillText('A', ax - 16, ay + 5); c.fillText('B', bx + 16, by + 5);
  c.font = '600 15px ui-monospace, monospace'; c.textAlign = 'right'; c.fillText(`${t.toFixed(2)} s`, w - 14, h - 14); c.textAlign = 'start';
};
