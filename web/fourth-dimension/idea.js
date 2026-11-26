// The idea on one point: a point in four dimensions is four numbers (x, y, z, w), and its distance from the
// start is Pythagoras applied once per direction. The figure lays the four right triangles flat, one on the
// next, the way the formula adds one square at a time.
// Maths: pkg/lilavati.js (tesseract.rs): running_distance gives the distance after 1, 2, 3 and 4 directions.
// The four sliders are inside <main>, so Together shares them (and the preset button's click) on its own.
import init, { running_distance } from '../pkg/lilavati.js';

const $ = id => document.getElementById(id);
const cv = $('ideaCanvas'), c = cv.getContext('2d'), W = cv.width;
let H = cv.height;
// on a phone the figure is drawn taller, so it isn't a thin strip
const fit = () => { const want = (cv.clientWidth || W) < 600 ? 640 : 420; if (cv.height !== want) cv.height = want; H = want; };
const KEYS = ['ix', 'iy', 'iz', 'iw'], AXN = ['x', 'y', 'z', 'w'];
const AX = ['#dc2626', '#16a34a', '#2563eb', '#c026d3'];   // the same colours as the edges below
const INK = '#1c1917', INK2 = '#57534e';
const num = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace(/\.0$/, '');
const f2 = v => v.toFixed(2);
const val = k => Math.min(4, Math.max(-4, +$(k).value || 0));

// the corners of the flat picture: start at O, then each number's size is a step at right angles to the line
// from O, always turning the same way (a minus sign only means the other way along that direction, and the
// distance doesn't care, so the picture uses the sizes)
function corners(p) {
  const pts = [[0, 0]];
  let x = 0, y = 0;
  p.forEach((v, i) => {
    const a = Math.abs(v);
    if (i === 0) { x = a; pts.push([x, y]); return; }
    const d = Math.hypot(x, y);
    const ux = d > 1e-9 ? -y / d : 1, uy = d > 1e-9 ? x / d : 0;
    x += ux * a; y += uy * a; pts.push([x, y]);
  });
  return pts;
}

let LZ = 1;   // line widths grow with the writing on small screens
function arrow(x0, y0, x1, y1, col, w, dash) {
  c.strokeStyle = col; c.lineWidth = w * LZ; c.setLineDash(dash || []);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
}

function draw() {
  fit();
  // on a small screen the canvas is shrunk, so the writing is made bigger to stay readable
  const z = Math.min(3, Math.max(1, 0.85 * W / (cv.clientWidth || W))), px = v => Math.round(v * z) + 'px';
  LZ = Math.sqrt(z);
  const p = KEYS.map(val), d = running_distance(p), pts = corners(p);
  c.clearRect(0, 0, W, H);
  // fit the picture
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const top = 30 * z, pad = 50 * z;
  const s = Math.min(110, (W - 2 * pad) / Math.max(x1 - x0, 0.5), (H - top - 2 * pad) / Math.max(y1 - y0, 0.5));
  const cx = W / 2 - s * (x0 + x1) / 2, cy = top + (H - top) / 2 + s * (y0 + y1) / 2;
  const P = q => [cx + s * q[0], cy - s * q[1]];
  // the lines from O to each corner: the running distance (dashed), the last one solid
  for (let i = 2; i <= 4; i++) {
    const [a, b] = P(pts[i]);
    if (i < 4) arrow(cx, cy, a, b, 'rgba(28,25,23,.45)', 1.5, [6, 5]);
  }
  // right-angle marks
  for (let i = 1; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9 || d[i - 1] < 1e-9) continue;
    const q = pts[i], r = pts[i + 1], len = 9 / s;
    const ax = -q[0] / Math.hypot(q[0], q[1]), ay = -q[1] / Math.hypot(q[0], q[1]);   // back towards O
    const bx = (r[0] - q[0]) / Math.abs(p[i]), by = (r[1] - q[1]) / Math.abs(p[i]);    // along the new step
    const m1 = P([q[0] + ax * len, q[1] + ay * len]), m2 = P([q[0] + (ax + bx) * len, q[1] + (ay + by) * len]), m3 = P([q[0] + bx * len, q[1] + by * len]);
    c.strokeStyle = INK2; c.lineWidth = 1; c.beginPath(); c.moveTo(...m1); c.lineTo(...m2); c.lineTo(...m3); c.stroke();
  }
  // the four steps, one per direction
  c.font = `600 ${px(14)} system-ui`;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) continue;
    const [a, b] = P(pts[i]), [e, f] = P(pts[i + 1]);
    arrow(a, b, e, f, AX[i], 4);
    // the label, beside the middle of the step, on the side away from the start
    const mx = (a + e) / 2, my = (b + f) / 2, L = Math.hypot(e - a, f - b) || 1;
    let nx = -(f - b) / L, ny = (e - a) / L;
    const side = nx * (mx - cx) + ny * (my - cy);
    if (side < -1e-6 || (Math.abs(side) <= 1e-6 && ny < 0)) { nx = -nx; ny = -ny; }
    const text = `${AXN[i]} = ${num(p[i])}`, tw = c.measureText(text).width;
    const off = 12 * z + Math.abs(nx) * tw / 2 + Math.abs(ny) * 7 * z;
    c.fillStyle = AX[i]; c.textAlign = 'center';
    c.fillText(text, mx + off * nx, my + off * ny + 5 * z);
  }
  // the final distance
  const [ex, ey] = P(pts[4]);
  if (d[3] > 1e-9) {
    arrow(cx, cy, ex, ey, INK, 3);
    const mx = (cx + ex) / 2, my = (cy + ey) / 2, nx = -(ey - cy), ny = ex - cx, nl = Math.hypot(nx, ny) || 1;
    // put the label on the side of the line away from the steps
    const side = Math.sign(nx * (P(pts[2])[0] - mx) + ny * (P(pts[2])[1] - my)) || 1;
    c.fillStyle = INK; c.textAlign = 'center';
    const text = `distance ${f2(d[3])}`, tw = c.measureText(text).width, ux = -side * nx / nl, uy = -side * ny / nl;
    const off = 10 * z + Math.abs(ux) * tw / 2 + Math.abs(uy) * 8 * z;
    c.fillText(text, mx + off * ux, my + off * uy + 5 * z);
  }
  c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill();
  c.font = `600 ${px(13)} system-ui`; c.textAlign = 'right'; c.fillText('start', cx - 10, cy + 5 * z);
  c.textAlign = 'left'; c.font = `600 ${px(14)} system-ui`; c.fillStyle = INK;
  c.fillText(z > 1.3 ? 'Each step at right angles to the line so far' : 'Each step goes at right angles to the line so far: one right triangle per direction', 12, 8 + 14 * z);
}

function words() {
  const p = KEYS.map(val), d = running_distance(p);
  KEYS.forEach((k, i) => { $(k + 'Val').textContent = num(p[i]); });
  const sq = i => `<b style="color:${AX[i]}">${p[i] < 0 ? `(${num(p[i])})` : num(p[i])}</b>²`;
  const lines = [1, 2, 3, 4].map(m => {
    const sum = p.slice(0, m).reduce((a, v) => a + v * v, 0);
    const pt = m === 4 ? '(x, y, z, w)' : m === 3 ? '(x, y, z)' : m === 2 ? '(x, y)' : '(x)';
    return `${['On a line', 'On a page', 'In a room', 'In 4D'][m - 1]}, ${pt}: distance = √(${p.slice(0, m).map((_, i) => sq(i)).join(' + ')}) = √${+sum.toFixed(2)} = ${f2(d[m - 1])}`;
  });
  $('ideaFormula').innerHTML = lines.join('\n');
  $('ideaPoint').textContent = `(${p.map(num).join(', ')})`;
  const corner = p.every(v => Math.abs(v) === 0.5);
  $('ideaSay').textContent = corner
    ? 'This point is a corner of the tesseract below: each of its four numbers is ½ or −½. Every corner is the same distance, 1, from the centre, just as every corner of a cube is the same distance from its centre.'
    : `Read √(…) as "the square root of", 2² as "2 times 2", and (−2)² as "−2 times −2", which is 4. Each new direction is at right angles to all the others, so Pythagoras simply adds one more square. Here the w step takes the distance from ${f2(d[2])} to ${f2(d[3])}.`;
  $('ideaCap').textContent = `The point (${p.map(num).join(', ')}): each coloured step is the size of one of its numbers, taken at right angles to the line so far (a minus sign only flips the direction, so it doesn't change the distance). The black line is its distance from the start, ${f2(d[3])}.`;
}

function changed() { words(); draw(); }

await init();
for (const k of KEYS) $(k).addEventListener('input', changed);
$('ideaCorner').addEventListener('click', () => { for (const k of KEYS) $(k).value = 0.5; changed(); });
addEventListener('resize', draw);
changed();
