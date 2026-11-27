// Home-page card: rectangles under a curve get thinner and thinner, and their total closes in on the area.
export default function preview(c, w, h, sec) {
  const f = x => 0.25 + 0.55 * x * x - 0.12 * Math.sin(9 * x);   // a curve over x from 0 to 1
  const L = 30, R = w - 30, T = 30, B = h - 34, X = x => L + (R - L) * x, Y = y => B - (B - T) * y / 0.8;
  const seq = [1, 2, 4, 8, 16, 32, 64], k = Math.floor(sec / 1.1) % (seq.length + 2), n = seq[Math.min(k, seq.length - 1)];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x0 = i / n, x1 = (i + 1) / n, y = f(x0); sum += y / n;
    c.fillStyle = 'rgba(217,119,6,.35)'; c.fillRect(X(x0), Y(y), X(x1) - X(x0), B - Y(y));
    if (n <= 32) { c.strokeStyle = 'rgba(180,83,9,.8)'; c.lineWidth = 1; c.strokeRect(X(x0), Y(y), X(x1) - X(x0), B - Y(y)); }
  }
  c.strokeStyle = '#1c1917'; c.lineWidth = 3; c.beginPath();
  for (let i = 0; i <= 120; i++) { const x = i / 120; i ? c.lineTo(X(x), Y(f(x))) : c.moveTo(X(x), Y(f(x))); }
  c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(L, B); c.lineTo(R, B); c.stroke();
  const exact = 0.25 + 0.55 / 3 - 0.12 * (1 - Math.cos(9)) / 9;
  c.font = '600 16px system-ui'; c.fillStyle = '#92400e';
  c.fillText(`${n} rectangle${n > 1 ? 's' : ''}: ${sum.toFixed(3)}`, L, 22);
  c.fillStyle = '#1c1917'; c.textAlign = 'right'; c.fillText(`area ${exact.toFixed(3)}`, R, 22); c.textAlign = 'left';
}
