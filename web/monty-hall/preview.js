// Home-page card: three doors; a pick, the host opens a goat door, the pick switches, and the car appears.
export default function preview(c, w, h, sec) {
  const cyc = 4, u = (sec % cyc) / cyc, round = Math.floor(sec / cyc), car = round % 3, pick = (round * 2 + 1) % 3;
  const keep = car === pick ? (pick + 1) % 3 : car, open = [0, 1, 2].find(d => d !== pick && d !== keep);
  const dw = 92, dh = 150, gap = 40, x0 = (w - 3 * dw - 2 * gap) / 2, y0 = 60;
  for (let d = 0; d < 3; d++) {
    const x = x0 + d * (dw + gap), o = d === open ? Math.min(1, Math.max(0, (u - 0.25) / 0.15)) : u > 0.7 ? Math.min(1, (u - 0.7) / 0.12) : 0;
    c.fillStyle = d === car ? '#fef9c3' : '#f1f5f9'; c.fillRect(x, y0, dw, dh);
    if (o > 0.4) { c.font = '52px system-ui'; c.textAlign = 'center'; c.fillText(d === car ? '🚗' : '🐐', x + dw / 2, y0 + dh * 0.62); }
    c.fillStyle = o > 0 ? '#d6a46a' : '#b45309'; c.fillRect(x, y0, dw * (1 - 0.85 * o), dh);
    if (o < 0.5) { c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '600 30px system-ui'; c.textAlign = 'center'; c.fillText(String(d + 1), x + dw * (1 - 0.85 * o) / 2, y0 + 64); }
    const mine = u < 0.5 ? pick : keep;
    if (d === mine && u > 0.08) { c.strokeStyle = '#2563eb'; c.lineWidth = 4; c.strokeRect(x - 5, y0 - 5, dw + 10, dh + 10); }
  }
  c.textAlign = 'left'; c.font = '600 16px system-ui';
  c.fillStyle = '#2563eb'; c.fillText('stay 1/3', 30, h - 26); c.fillRect(110, h - 38, (w - 140) / 3, 14);
  c.fillStyle = '#ea580c'; c.fillText('switch 2/3', 30, h - 6); c.fillRect(110, h - 18, (w - 140) * 2 / 3, 14);
  c.fillStyle = '#555'; c.font = '14px system-ui'; c.fillText(u < 0.25 ? 'pick a door' : u < 0.5 ? 'the host opens a goat door' : 'switch?', x0, 36);
}
