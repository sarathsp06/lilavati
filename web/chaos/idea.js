// The idea with one number: the doubling rule (double it; if that is 1 or more, take 1 off), started twice.
// Maths: pkg/lilavati.js (chaos.rs): doubling_iterate works the rule in exact decimals, as by hand.
// The two controls are inside <main>, so Together shares them on its own; nothing else is state.
import init, { doubling_iterate } from '../pkg/lilavati.js';

const $ = id => document.getElementById(id);
const cv = $('ideaCanvas'), c = cv.getContext('2d');
let W = cv.width, H = cv.height;
// phones get a narrower, taller drawing, so that its writing is not shrunk away
function size() {
  const phone = (cv.parentElement.clientWidth || 900) < 600, w = phone ? 600 : 900, h = phone ? 640 : 470;
  if (cv.width !== w) { cv.width = W = w; cv.height = H = h; }
}
const INK = '#1c1917', INK2 = '#57534e', A = '#ea580c', B = '#2563eb', GAP = '#dc2626', MAX = 40, START = 0.3;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = n => String(n).split('').map(d => SUP[+d]).join('');

const digits = () => Math.min(7, Math.max(1, +$('ideaEps').value | 0));
const steps = () => Math.min(MAX, Math.max(0, +$('ideaN').value | 0));
const runs = e => [doubling_iterate(START, e, MAX), doubling_iterate(START + 10 ** -e, e, MAX)];
// the first step at which the gap is over 0.1
const parts = e => { const [a, b] = runs(e); const k = a.findIndex((x, i) => Math.abs(b[i] - x) > 0.1); return k < 0 ? null : k; };

function dot(x, y, col, ring, r) {
  c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI);
  if (ring) { c.strokeStyle = col; c.lineWidth = 3; c.stroke(); } else { c.fillStyle = col; c.fill(); }
}
function arrow(x0, y0, x1, y1, col) {
  const a = Math.atan2(y1 - y0, x1 - x0), h = 7;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)); c.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4)); c.fill();
}

function draw() {
  // on a small screen the canvas is shrunk, so the writing is made bigger to stay readable
  size();
  const z = Math.min(2.2, Math.max(1, 0.85 * W / (cv.clientWidth || W))), px = v => Math.round(v * z) + 'px', small = W < 900 || z > 1.3;
  const e = digits(), n = steps(), [ra, rb] = runs(e), f = v => v.toFixed(e);
  const L = 40, S = (W - 2 * L) / 2 - (W < 900 ? 0 : 30), X = v => L + S * v;
  c.clearRect(0, 0, W, H);

  // one number line: from 0 to `to`, with its ticks and a label above
  function line(y, to, label) {
    c.strokeStyle = 'rgba(28,25,23,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(0), y); c.lineTo(X(to), y); c.stroke();
    c.fillStyle = INK2; c.font = `${px(12)} system-ui`; c.textAlign = 'center';
    for (let t = 0; t <= to; t++) { c.beginPath(); c.moveTo(X(t), y - 5); c.lineTo(X(t), y + 5); c.stroke(); c.fillText(String(t), X(t), y + 8 + 12 * z); }
    c.textAlign = 'left'; c.fillStyle = INK; c.font = `600 ${px(13)} system-ui`; c.fillText(label, L, y - 12);
  }
  function pair(y, a, b, scaleTo) {
    const xa = L + S * a, xb = L + S * b;
    if (Math.abs(xb - xa) > 2) { c.strokeStyle = GAP; c.lineWidth = 4; c.beginPath(); c.moveTo(xa, y); c.lineTo(xb, y); c.stroke(); }
    dot(xb, y, B, true, 9); dot(xa, y, A, false, 5.5);
    if (scaleTo === 1) {   // the numbers, to the right of the 0-to-1 line
      c.font = `${px(13)} ui-monospace, monospace`; c.textAlign = 'left';
      const x0 = X(1) + 40;
      if (!small) { c.fillStyle = A; c.fillText(`orange ${f(a)}`, x0, y - 4); c.fillStyle = B; c.fillText(`blue   ${f(b)}`, x0 + 210, y - 4); }
      c.fillStyle = GAP; c.fillText(`gap    ${f(Math.abs(b - a))}`, x0, small ? y + 5 : y + 18);
    }
  }

  const r1 = 30 + 30 * z, r2 = r1 + 50 + 25 * z, r3 = r2 + 50 + 25 * z;
  if (n === 0) {
    line(r1, 1, 'The two starts'); pair(r1, ra[0], rb[0], 1);
    c.fillStyle = INK2; c.font = `${px(14)} system-ui`;
    c.fillText('Slide Steps to apply the rule.', L, r2 + 10);
  } else {
    const a0 = ra[n - 1], b0 = rb[n - 1], a1 = ra[n], b1 = rb[n];
    line(r1, 1, small ? `After ${n - 1} steps` : `After ${n - 1} step${n === 2 ? '' : 's'}`);
    // the doubled line, with the part from 1 to 2 shaded: that part gets 1 taken off
    c.fillStyle = 'rgba(234,88,12,.08)'; c.fillRect(X(1), r2 - 16, S, 32);
    line(r2, 2, small ? 'Doubled' : 'Doubled: the line stretched to twice its length');
    c.fillStyle = INK2; c.font = `${px(12)} system-ui`; c.textAlign = 'right';
    c.fillText(small ? 'take 1 off' : '1 or more: take 1 off', X(2), r2 - 12); c.textAlign = 'left';
    line(r3, 1, `After ${n} step${n === 1 ? '' : 's'}`);
    arrow(X(a0), r1 + 6, X(2 * a0), r2 - 8, 'rgba(234,88,12,.6)'); arrow(X(b0), r1 + 6, X(2 * b0), r2 - 8, 'rgba(37,99,235,.6)');
    arrow(X(2 * a0), r2 + 8, X(a1), r3 - 8, 'rgba(234,88,12,.6)'); arrow(X(2 * b0), r2 + 8, X(b1), r3 - 8, 'rgba(37,99,235,.6)');
    pair(r1, a0, b0, 1); pair(r2, 2 * a0, 2 * b0, 2); pair(r3, a1, b1, 1);
  }

  // every step so far: both runs and the gap between them
  const gx0 = L + 10, gx1 = W - 20, gy0 = H - 14 - 14 * z, gy1 = r3 + 40 + 40 * z, GX = k => gx0 + (gx1 - gx0) * k / MAX, GY = v => gy0 - (gy0 - gy1) * v;
  c.fillStyle = INK; c.font = `600 ${px(13)} system-ui`; c.textAlign = 'left';
  c.fillText(small ? 'Every step so far' : 'Every step so far: orange and blue, and the gap between them (red)', L, gy1 - 18);
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.beginPath();
  for (const v of [0, 1]) { c.moveTo(gx0, GY(v)); c.lineTo(gx1, GY(v)); }
  c.stroke();
  c.fillStyle = INK2; c.font = `${px(12)} system-ui`; c.textAlign = 'right';
  c.fillText('1', gx0 - 6, GY(1) + 4); c.fillText('0', gx0 - 6, GY(0) + 4);
  c.textAlign = 'center';
  for (let k = 0; k <= MAX; k += small ? 20 : 10) { c.textAlign = k === MAX ? 'right' : 'center'; c.fillText(k ? `step ${k}` : '0', k === MAX ? gx1 : GX(k), H - 6); }
  for (let k = 0; k <= n; k++) {
    if (Math.abs(rb[k] - ra[k]) * (gy0 - gy1) > 1.5) { c.strokeStyle = 'rgba(220,38,38,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(GX(k), GY(ra[k])); c.lineTo(GX(k), GY(rb[k])); c.stroke(); }
  }
  for (const [r, col] of [[rb, B], [ra, A]]) {
    c.strokeStyle = col; c.globalAlpha = .35; c.lineWidth = 1.2; c.beginPath();
    for (let k = 0; k <= n; k++) k ? c.lineTo(GX(k), GY(r[k])) : c.moveTo(GX(k), GY(r[k]));
    c.stroke(); c.globalAlpha = 1;
    for (let k = 0; k <= n; k++) dot(GX(k), GY(r[k]), col, col === B, col === B ? 4.5 : 3);
  }
  const k = parts(e);
  if (k !== null && k <= n) {
    c.strokeStyle = 'rgba(220,38,38,.5)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(GX(k), gy1 - 4); c.lineTo(GX(k), gy0); c.stroke(); c.setLineDash([]);
    c.fillStyle = GAP; c.font = `600 ${px(12)} system-ui`; c.textAlign = GX(k) > W - 160 ? 'right' : 'left';
    c.fillText(' they part ', GX(k) + 2, gy0 - 6);
  }
  c.textAlign = 'left';
}

function words() {
  const e = digits(), n = steps(), [ra, rb] = runs(e), f = v => v.toFixed(e), eps = f(10 ** -e);
  $('ideaNVal').textContent = n;
  const gap = Math.abs(rb[n] - ra[n]), pred = 10 ** -e * 2 ** n, doubling = Math.abs(gap - pred) < 10 ** -e / 2;
  const one = (x0, x1) => { const d = 2 * x0; return d >= 1 ? `2 · ${f(x0)} = ${f(d)}, take 1 off: ${f(x1)}` : `2 · ${f(x0)} = ${f(x1)}`; };
  let g;
  if (n === 0) g = `gap = ${eps}`;
  else if (doubling) g = `gap = ${f(gap)} = ${eps} · 2${sup(n)}, that is ${eps} doubled ${n} time${n === 1 ? '' : 's'}`;
  else g = `gap = ${f(gap)}. Doubling ${eps} ${n} times would give ${pred < 1000 ? +pred.toPrecision(3) : Math.round(pred).toLocaleString('en')}, more than the whole line, so taking 1 off has split the two and the gap is just whatever is left`;
  $('ideaFormula').innerHTML = n === 0
    ? `Start: <span style="color:${A}">orange ${f(ra[0])}</span>, <span style="color:${B}">blue ${f(rb[0])}</span><br>${g}`
    : `Step ${n}: <span style="color:${A}">orange ${one(ra[n - 1], ra[n])}</span><br><span style="visibility:hidden">Step ${n}: </span><span style="color:${B}">blue ${one(rb[n - 1], rb[n])}</span><br>${g}`;
  const k = parts(e), k2 = parts(e + 1);
  $('ideaSay').innerHTML = `Both runs follow the same rule exactly: start again and you get the same numbers, nothing is random. But every step doubles the gap, so after 10 steps it is 2${sup(10)} = 1024 times bigger. Starting ${eps} apart, the two part (the gap passes 0.1) at step ${k}. ${e < 7 ? 'Choose a start ten times more exact and they part only at step ' + k2 + ', a few steps later' : 'A start ten times more exact would hold them together only until step ' + k2}: ten times more exact buys only about 3.3 steps, since three doublings already multiply by 8 and 3.3 doublings by 10.`;
  $('ideaCap').textContent = n === 0
    ? 'The two starts on the line from 0 to 1. Below: their runs, which so far are just the starts.'
    : `Top: step ${n} of the rule, for both numbers. Doubling stretches the line to twice its length; anything that lands past 1 is moved back by 1. Below: all ${n + 1} values of both runs.`;
}

function changed() { words(); draw(); }

await init();
$('ideaEps').addEventListener('change', changed);
$('ideaN').addEventListener('input', changed);
addEventListener('resize', draw);
changed();
