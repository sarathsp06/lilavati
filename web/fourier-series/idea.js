// The idea on one wave: a square, sawtooth or triangle wave and the sum of its first sine waves.
// Maths: pkg/lilavati.js (fourier.rs): wave_terms gives the amounts, wave_target the wave itself.
// The two controls are inside <main>, so Together shares them on its own; nothing else is state.
import init, { wave_terms, wave_target } from '../pkg/lilavati.js';

const $ = id => document.getElementById(id);
const cv = $('ideaCanvas'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
const NAMES = ['square wave', 'sawtooth wave', 'triangle wave'];
const INK = '#1c1917', INK2 = '#57534e', SUM = '#2563eb', NEW = '#ea580c', GREY = 'rgba(28,25,23,.28)';
const T0 = -Math.PI, T1 = 3 * Math.PI;   // two laps
const SHOWN = 5;                         // waves drawn one by one underneath
let prevN = 0, grow = 1, last = 0;

const kind = () => Math.min(2, Math.max(0, +$('ideaShape').value | 0));
const count = () => Math.min(30, Math.max(1, +$('ideaN').value | 0));
const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

function curve(fn, x0, x1, yMid, amp, col, width, dash) {
  c.strokeStyle = col; c.lineWidth = width; c.setLineDash(dash || []); c.beginPath();
  for (let i = 0; i <= 600; i++) {
    const t = T0 + (T1 - T0) * i / 600, x = x0 + (x1 - x0) * i / 600, y = yMid - amp * fn(t);
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke(); c.setLineDash([]);
}

function draw() {
  // on a small screen the canvas is shrunk, so the writing is made bigger to stay readable
  const z = Math.min(2.2, Math.max(1, 0.62 * W / (cv.clientWidth || W))), px = v => Math.round(v * z) + 'px';
  const k = kind(), n = count(), terms = wave_terms(k, n);
  const sumOf = (m, t, lastScale = 1) => { let s = 0; for (let j = 0; j < m; j++) s += terms[2 * j + 1] * Math.sin(terms[2 * j] * t) * (j === m - 1 ? lastScale : 1); return s; };
  c.clearRect(0, 0, W, H);
  const x0 = 70, x1 = W - 20, top = 125, amp = 78;
  // axes and the two laps
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, top); c.lineTo(x1, top);
  for (const t of [T0, Math.PI, T1]) { const x = x0 + (x1 - x0) * (t - T0) / (T1 - T0); c.moveTo(x, top - amp - 20); c.lineTo(x, top + amp + 20); }
  c.stroke();
  c.fillStyle = INK2; c.font = `${px(13)} system-ui`; c.textAlign = 'right';
  for (const v of [1, 0, -1]) c.fillText(String(v), x0 - 8, top - amp * v + 4);
  c.textAlign = 'center'; c.fillText('one lap', x0 + (x1 - x0) * 0.25, top + amp + 20 + 14 * z);
  if (z <= 1.3) c.fillText('the next lap: the same again', x0 + (x1 - x0) * 0.75, top + amp + 34);
  c.textAlign = 'left';
  // the wave, the sum without the newest wave (dashed) and the sum with it, growing in
  curve(t => wave_target(k, t), x0, x1, top, amp, GREY, 6);
  if (n > 1) curve(t => sumOf(n - 1, t), x0, x1, top, amp, 'rgba(37,99,235,.45)', 1.5, [5, 5]);
  curve(t => sumOf(n, t, grow), x0, x1, top, amp, SUM, 2.5);
  c.fillStyle = INK; c.font = `600 ${px(14)} system-ui`;
  c.fillText(z > 1.3 ? `grey: ${NAMES[k]}, blue: ${n} sine wave${n > 1 ? 's' : ''} added` : `grey: the ${NAMES[k]}   blue: the sum of ${n} sine wave${n > 1 ? 's' : ''}${n > 1 ? '   dashed: the sum before the newest one' : ''}`, x0, 8 + 14 * z);
  // the waves themselves, one row each
  const shownRows = z > 1.3 ? 3 : SHOWN, rowTop = 270, rowH = (H - rowTop - 30) / shownRows, rows = Math.min(n, shownRows);
  c.fillStyle = INK; c.font = `600 ${px(13)} system-ui`; c.fillText('The waves being added:', 12, rowTop - 14);
  for (let j = 0; j < rows; j++) {
    const kk = terms[2 * j], b = terms[2 * j + 1], y = rowTop + rowH * (j + 0.5), isNew = j === n - 1;
    curve(t => b * Math.sin(kk * t) * (isNew ? grow : 1), x0 + 130 * Math.min(z, 1.9), x1, y, rowH * 0.42, isNew ? NEW : SUM, isNew ? 2.2 : 1.5);
    c.fillStyle = isNew ? NEW : INK; c.font = `${isNew ? 600 : 400} ${px(13)} ui-monospace, monospace`;
    c.fillText(`${j ? '+ ' : '  '}${f2(b)}·sin(${kk}·t)`, 8, y + 4);
  }
  if (n > shownRows) { c.fillStyle = INK2; c.font = `${px(13)} system-ui`; c.fillText(z > 1.3 ? `+ ${n - shownRows} more, smaller and faster` : `+ ${n - shownRows} more, each smaller and faster (the newest: ${f2(terms[2 * n - 1])}·sin(${terms[2 * n - 2]}·t))`, 8, H - 10); }
}

function words() {
  const k = kind(), n = count(), terms = wave_terms(k, Math.max(n, 3));
  $('ideaNVal').textContent = n;
  const shown = Array.from({ length: Math.min(n, 4) }, (_, j) => `${j && terms[2 * j + 1] >= 0 ? '+ ' : j ? '− ' : ''}${f2(j ? Math.abs(terms[2 * j + 1]) : terms[1])}·sin(${terms[2 * j]}·t)`);
  $('ideaFormula').textContent = `${NAMES[k]} ≈ ${shown.join(' ')}${n > 4 ? ' + …' : ''}`;
  const rule = ['only the odd waves (1, 3, 5, …), wave k in the amount 4 ÷ (π·k): a third as much of the wave three times as fast, a fifth of the one five times as fast, and so on',
    'every wave, wave k in the amount 2 ÷ (π·k), with alternating signs',
    'only the odd waves, wave k in the amount 8 ÷ (π²·k²) with alternating signs; they shrink so fast that a few already look right'][k];
  $('ideaSay').innerHTML = `Read the formula as: a wave that goes up and down once per lap (sin(1·t), where t is how far along the lap you are and k·t means k times t), plus smaller, faster waves on top. For the ${NAMES[k]} the recipe is ${rule}.${k === 0 ? ' Near each jump the sum always overshoots by about 9%, however many waves you add: the Gibbs phenomenon.' : ''}`;
  $('ideaCap').textContent = `The ${NAMES[k]} and the sum of its first ${n} sine wave${n > 1 ? 's' : ''}. Underneath, each wave on its own; the newest one is orange.`;
}

const seen = new IntersectionObserver(es => { for (const e of es) visible = e.isIntersecting; });
let visible = false;
function frame(now) {
  if (visible && grow < 1) { grow = Math.min(1, grow + (now - last) / 600); draw(); }
  last = now; requestAnimationFrame(frame);
}
function changed() { const n = count(); grow = n > prevN ? 0 : 1; prevN = n; words(); draw(); }

await init();
seen.observe(cv);
$('ideaShape').addEventListener('change', () => { prevN = 0; changed(); });
$('ideaN').addEventListener('input', changed);
prevN = count(); words(); draw();
requestAnimationFrame(t => { last = t; frame(t); });
