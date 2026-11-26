// The idea on one ring: a flat rubber ring moulded into a square frame, a band, a star and a mug. Its lengths
// and area change; its one piece and one hole don't, until you cut it.
// Maths: pkg/lilavati.js (topology.rs): ring_shape gives the moulded ring, loop_length_area measures it.
// The slider and the checkbox are inside <main>, so Together shares them on its own; nothing else is state.
import init, { ring_shape, loop_length_area } from '../pkg/lilavati.js';

const $ = id => document.getElementById(id);
const cv = $('ideaCanvas'), c = cv.getContext('2d'), W = cv.width;
let H = cv.height;
// on a phone the figure is drawn taller, so it isn't a thin strip
const fit = () => { const want = (cv.clientWidth || W) < 600 ? 640 : 420; if (cv.height !== want) cv.height = want; H = want; };
const N = 240, GAP = 9;                         // points round each edge; half the cut's width, in points
const CM = 4;                                   // one unit of the shape is 4 cm: the round ring is 8 cm across
const NAMES = ['a round ring', 'a square frame', 'a long thin band', 'a star', 'a mug (the hole is the handle)'];
const INK = '#1c1917', INK2 = '#57534e', RUB = '#bbf7d0', EDGE = '#15803d', HOLE = '#1d4ed8', CUT = '#dc2626';
const f1 = v => v.toFixed(1);

const mould = () => Math.min(4, Math.max(0, +$('ideaT').value || 0));
const isCut = () => $('ideaCut').checked;

function edges(t) {
  const r = ring_shape(t, N);
  return [r.slice(0, 2 * N), r.slice(2 * N)];
}

function draw() {
  fit();
  // on a small screen the canvas is shrunk, so the writing is made bigger to stay readable
  const z = Math.min(3, Math.max(1, 0.85 * W / (cv.clientWidth || W))), px = v => Math.round(v * z) + 'px';
  const t = mould(), cut = isCut(), [out, hole] = edges(t);
  const S = H > 500 ? 200 : 150, OX = W / 2 + 10, OY = H / 2 + 12 * z;
  const X = (p, i) => OX + S * p[2 * i], Y = (p, i) => OY - S * p[2 * i + 1];
  c.clearRect(0, 0, W, H);
  // the round ring it started as, dashed
  const [o0, h0] = edges(0);
  c.strokeStyle = 'rgba(28,25,23,.25)'; c.lineWidth = 1.2; c.setLineDash([5, 5]);
  for (const p of [o0, h0]) { c.beginPath(); for (let i = 0; i <= N; i++) { const k = i % N; i ? c.lineTo(X(p, k), Y(p, k)) : c.moveTo(X(p, k), Y(p, k)); } c.stroke(); }
  c.setLineDash([]);
  // the rubber: outside edge, then back round the hole (with a gap at the right-hand side if cut)
  const from = cut ? GAP : 0, to = cut ? N - GAP : N;
  c.beginPath();
  for (let i = from; i <= to; i++) { const k = i % N; i === from ? c.moveTo(X(out, k), Y(out, k)) : c.lineTo(X(out, k), Y(out, k)); }
  if (!cut) c.closePath(), c.moveTo(X(hole, 0), Y(hole, 0));
  for (let i = to; i >= from; i--) { const k = i % N; c.lineTo(X(hole, k), Y(hole, k)); }
  c.closePath();
  c.fillStyle = RUB; c.fill('evenodd');
  // painted lines on the rubber, so you can see it stretch: spokes from the hole to the outside, and a middle ring
  c.strokeStyle = 'rgba(21,128,61,.35)'; c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < N; i += 10) { if (cut && (i < GAP || i > N - GAP)) continue; c.moveTo(X(out, i), Y(out, i)); c.lineTo(X(hole, i), Y(hole, i)); }
  for (let i = from; i <= to; i++) { const k = i % N, x = (X(out, k) + X(hole, k)) / 2, y = (Y(out, k) + Y(hole, k)) / 2; i === from ? c.moveTo(x, y) : c.lineTo(x, y); }
  c.stroke();
  c.strokeStyle = EDGE; c.lineWidth = 2.5 * Math.sqrt(z); c.beginPath();
  for (let i = from; i <= to; i++) { const k = i % N; i === from ? c.moveTo(X(out, k), Y(out, k)) : c.lineTo(X(out, k), Y(out, k)); }
  if (!cut) { c.closePath(); c.moveTo(X(hole, 0), Y(hole, 0)); for (let i = 1; i <= N; i++) c.lineTo(X(hole, i % N), Y(hole, i % N)); }
  else { for (let i = to; i >= from; i--) { const k = i % N; c.lineTo(X(hole, k), Y(hole, k)); } c.closePath(); }
  c.stroke();
  // the hole's edge in blue while it is a hole
  if (!cut) { c.strokeStyle = HOLE; c.lineWidth = 2.5 * Math.sqrt(z); c.beginPath(); for (let i = 0; i <= N; i++) { const k = i % N; i ? c.lineTo(X(hole, k), Y(hole, k)) : c.moveTo(X(hole, k), Y(hole, k)); } c.stroke(); }
  // where the hole is: the middle of its edge
  let hx = 0, hy = 0; for (let i = 0; i < N; i++) { hx += hole[2 * i]; hy += hole[2 * i + 1]; }
  hx = OX + S * hx / N; hy = OY - S * hy / N;
  c.textAlign = 'center'; c.font = `600 ${px(13)} system-ui`;
  if (!cut) { c.fillStyle = HOLE; c.fillText('hole', hx, hy + 4 * z); }
  else {
    // the gap: a red mark across the cut
    const a = (X(out, 0) + X(hole, 0)) / 2, b = (Y(out, 0) + Y(hole, 0)) / 2;
    c.strokeStyle = CUT; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(out, 0) + 14, Y(out, 0)); c.lineTo(X(hole, 0) - 14, Y(hole, 0)); c.stroke(); c.setLineDash([]);
    c.fillStyle = CUT; c.textAlign = 'left'; c.fillText('cut', Math.min(a + 22, W - 40 * z), b - 10);
  }
  // title line
  c.textAlign = 'left'; c.fillStyle = INK; c.font = `600 ${px(14)} system-ui`;
  c.fillText(z > 1.3 ? `Now: ${NAMES[Math.round(t)].replace(/ \(.*\)/, '')}${cut ? ', cut: no hole' : ''}` : `Now: ${NAMES[Math.round(t)]}${cut ? ', cut: no hole now' : ''}   dashed: the round ring it started as`, 12, 8 + 14 * z);
}

function words() {
  const t = mould(), cut = isCut(), [out, hole] = edges(t);
  const [lo, ao] = loop_length_area(out), [lh, ah] = loop_length_area(hole);
  $('ideaTVal').textContent = NAMES[Math.round(t)].replace(/ \(.*\)/, '');
  $('ideaFormula').innerHTML =
    `Changes when you mould it:\n` +
    `edge length = ${f1(lo * CM)} cm round the outside + ${f1(lh * CM)} cm round the ${cut ? 'inside' : 'hole'} = ${f1((lo + lh) * CM)} cm\n` +
    `rubber area = ${f1(ao * CM * CM)} cm² inside the outside edge − ${f1(ah * CM * CM)} cm² ${cut ? 'cut out' : 'of hole'} = ${f1((ao - ah) * CM * CM)} cm²\n` +
    (cut ? `The cut changed what can't change by moulding: <b>1 piece</b>, now <b>0 holes</b>` : `Stays the same: <b>1 piece</b>, <b>1 hole</b>`);
  $('ideaSay').textContent = cut
    ? 'A cut is not allowed in topology. Now the ring is a curved strip with two loose ends: a string through the middle could slide out through the gap, so there is no hole any more. No amount of stretching turns a strip back into a ring; you would have to glue the ends.'
    : t < 0.05
      ? 'This is a flat rubber ring: one piece, with one hole you could thread a string through. Slide to mould it.'
      : 'Every length and area has changed, and the corners come and go, but it is still one piece with one hole: a string through the hole still can’t get out. To a topologist it is still the same shape as the round ring.';
  $('ideaCap').textContent = `A flat rubber ring moulded into ${NAMES[Math.round(t)]}${cut ? ', then cut across' : ''}. The faint lines are painted on the rubber, so you can see it stretch.`;
}

function changed() { words(); draw(); }

await init();
$('ideaT').addEventListener('input', changed);
$('ideaCut').addEventListener('change', changed);
addEventListener('resize', draw);
changed();
