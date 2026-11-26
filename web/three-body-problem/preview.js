// The home-page card: three equal suns chasing each other round the figure eight (Moore 1993;
// Chenciner and Montgomery 2000). One lap is worked out once here with small leapfrog steps (G = 1),
// so the card needs no WebAssembly; each frame just looks up where the bodies are at that moment.
const PERIOD = 6.32591398, N = 720, COL = ['#fbbf24', '#38bdf8', '#f472b6'];
const lap = (() => {
  const [x, y, vx, vy] = [0.97000436, 0.24308753, 0.466203685, 0.43236573];
  const p = [-x, y, x, -y, 0, 0], v = [vx, vy, vx, vy, -2 * vx, -2 * vy], out = [];
  const acc = () => { const a = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const dx = p[2 * j] - p[2 * i], dy = p[2 * j + 1] - p[2 * i + 1], k = 1 / Math.pow(dx * dx + dy * dy, 1.5);
      a[2 * i] += k * dx; a[2 * i + 1] += k * dy; a[2 * j] -= k * dx; a[2 * j + 1] -= k * dy; }
    return a; };
  const sub = 20, h = PERIOD / N / sub; let a = acc();
  for (let s = 0; s < N; s++) {
    out.push(p.slice());
    for (let k = 0; k < sub; k++) { for (let q = 0; q < 6; q++) v[q] += 0.5 * h * a[q]; for (let q = 0; q < 6; q++) p[q] += h * v[q]; a = acc(); for (let q = 0; q < 6; q++) v[q] += 0.5 * h * a[q]; }
  }
  return out;
})();

export default function preview(c, w, h, sec) {
  c.fillStyle = '#070b18'; c.fillRect(0, 0, w, h);
  const s = Math.min(w * 0.4 / 1.1, h), cx = w / 2, cy = h / 2, V = (x, y) => [cx + x * s, cy - y * s];
  const at = Math.floor(((sec * 0.9) / PERIOD) * N) % N;
  // the whole eight, faint, then each body's last stretch brighter
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; c.beginPath();
  for (let k = 0; k <= N; k++) { const q = lap[k % N], [X, Y] = V(q[0], q[1]); k ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke();
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = COL[i]; c.lineWidth = 2.5; c.lineCap = 'round';
    for (let k = 1; k < 120; k++) {
      const a = lap[(at - k + N) % N], b = lap[(at - k + 1 + N) % N], [x0, y0] = V(a[2 * i], a[2 * i + 1]), [x1, y1] = V(b[2 * i], b[2 * i + 1]);
      c.globalAlpha = 1 - k / 120; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    c.globalAlpha = 1;
    const q = lap[at], [X, Y] = V(q[2 * i], q[2 * i + 1]), g = c.createRadialGradient(X, Y, 0, X, Y, 16);
    g.addColorStop(0, COL[i]); g.addColorStop(1, COL[i] + '00'); c.fillStyle = g; c.beginPath(); c.arc(X, Y, 16, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(X, Y, 4.5, 0, 7); c.fill();
  }
}
