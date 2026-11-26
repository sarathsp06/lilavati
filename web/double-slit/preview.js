// Home-page card for the double-slit page: two slits, waves spreading from them, and dots landing one
// at a time on the screen until the stripes show, then the screen clears and it starts again.
const pattern = y => { const s = y * 0.9, b = y * 0.12; const env = b ? (Math.sin(b) / b) ** 2 : 1; return Math.cos(s) ** 2 * env; };
// where hit i lands: rejection sampling from the pattern with a fixed hash, so the card is the same every lap
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const HITS = [];
for (let k = 0; HITS.length < 900 && k < 20000; k++) { const y = (hash(2 * k) - 0.5) * 26; if (hash(2 * k + 1) < pattern(y)) HITS.push([y, hash(3 * k + 7)]); }

export default function (c, w, h, sec) {
  const cy = h / 2, wall = w * 0.34, scr = w * 0.72, sep = 38, slitW = 8, lap = 9, u = (sec % lap) / lap;
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  // source and wavefronts
  c.fillStyle = '#334155'; c.fillRect(24, cy - 12, 26, 24);
  for (let k = 0; k < 4; k++) { const x = 50 + ((sec * 60 + k * 50) % (wall - 50)); c.strokeStyle = 'rgba(190,24,93,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, cy - 60); c.lineTo(x, cy + 60); c.stroke(); }
  // circles from both slits
  c.save(); c.beginPath(); c.rect(wall, 0, scr - wall, h); c.clip();
  for (const sy of [cy - sep / 2, cy + sep / 2]) for (let k = 0; k < 6; k++) {
    const r = (sec * 60 + k * 36) % 216; c.strokeStyle = `rgba(190,24,93,${0.4 * (1 - r / 216)})`; c.beginPath(); c.arc(wall, sy, r, -1.3, 1.3); c.stroke();
  }
  c.restore();
  // the wall
  c.fillStyle = '#475569';
  c.fillRect(wall - 4, 10, 8, cy - sep / 2 - slitW / 2 - 10); c.fillRect(wall - 4, cy - sep / 2 + slitW / 2, 8, sep - slitW); c.fillRect(wall - 4, cy + sep / 2 + slitW / 2, 8, h - 10 - cy - sep / 2 - slitW / 2);
  // the screen and the dots so far this lap
  c.fillStyle = '#f8fafc'; c.fillRect(scr, 10, 46, h - 20); c.strokeStyle = '#cbd5e1'; c.strokeRect(scr, 10, 46, h - 20);
  const n = Math.floor(HITS.length * Math.min(1, u * 1.25)), py = y => cy - y * (h - 24) / 26;
  c.fillStyle = 'rgba(17,17,17,.75)';
  for (let i = 0; i < n; i++) c.fillRect(scr + 3 + HITS[i][1] * 38, py(HITS[i][0]) - 1, 2.2, 2.2);
  // the curve beside it, fading in once enough dots are down
  c.strokeStyle = `rgba(190,24,93,${Math.min(1, n / 500)})`; c.lineWidth = 2; c.beginPath();
  for (let k = 0; k <= 200; k++) { const y = -13 + 26 * k / 200, x = scr + 56 + pattern(y) * (w - scr - 70); k ? c.lineTo(x, py(y)) : c.moveTo(x, py(y)); }
  c.stroke();
}
