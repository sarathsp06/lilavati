// Home-page card: the sine curve and its Taylor polynomials around 0, one more term every second or so.
const FACT = [1]; for (let k = 1; k <= 20; k++) FACT[k] = FACT[k - 1] * k;
const poly = (n, x) => { let s = 0; for (let k = 1; k <= n; k += 2) s += (((k - 1) / 2) % 2 ? -1 : 1) * x ** k / FACT[k]; return s; };
export default function preview(c, w, h, sec) {
  const degs = [1, 3, 5, 7, 9, 11, 13, 15], n = degs[Math.floor(sec / 1.1) % degs.length];
  const L = 16, R = w - 16, X = x => L + (R - L) * (x + 7.5) / 15, Y = y => h / 2 + 8 - y * h * 0.3;
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(R, Y(0)); c.moveTo(X(0), 30); c.lineTo(X(0), h - 10); c.stroke();
  // where this polynomial is within 0.01 of the curve
  let lo = 0, hi = 0; while (hi < 7.5 && Math.abs(poly(n, hi + 0.02) - Math.sin(hi + 0.02)) < 0.01) hi += 0.02; lo = -hi;
  c.fillStyle = 'rgba(22,163,74,.14)'; c.fillRect(X(lo), 30, X(hi) - X(lo), h - 40);
  const draw = (f, col, lw) => { c.save(); c.beginPath(); c.rect(L, 28, R - L, h - 36); c.clip(); c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (let i = 0; i <= 300; i++) { const x = -7.5 + 15 * i / 300; i ? c.lineTo(X(x), Y(f(x))) : c.moveTo(X(x), Y(f(x))); } c.stroke(); c.restore(); };
  draw(Math.sin, '#1c1917', 3);
  draw(x => poly(n, x), '#db2777', 3.5);
  c.fillStyle = '#db2777'; c.beginPath(); c.arc(X(0), Y(0), 6, 0, 7); c.fill();
  const sup = String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
  c.font = '600 16px system-ui'; c.fillStyle = '#9d174d'; c.fillText(`sin x with terms up to x${sup}`, L, 22);
}
