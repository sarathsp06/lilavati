// The Monty Hall problem: play the game by hand or let it play itself, with 3, 10 or 100 doors and a
// host who knows or guesses. Maths: pkg/lilavati.js (monty module); the step figures derive 1/n,
// (n − 1)/n and 1/2 on screen by drawing every possible world and crossing out the ones ruled out.
import init, { deal, kept_door, opened_doors, car_shown, simulate, chances, surviving_worlds } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ST = '#2563eb', SW = '#ea580c', WOOD = '#b45309', CAR = '#eab308';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pct = (a, b) => (b ? `${Math.round(100 * a / b)}%` : '–');

// ---------- the state ----------
let n = 3, knows = true;
let seed = (Math.random() * 2 ** 32) >>> 0, next = 0;   // games are dealt from (seed, game number)
let tally = [0, 0, 0, 0];      // games that count, staying won, switching won, voided (host showed the car)
let mine = [0, 0, 0, 0];       // games played by hand: stayed, won by staying, switched, won by switching
let hist = [];                 // [games, staying won, switching won] after each game, for the chart
let auto = true, autoGames = 0, g = null;

// a game: the deal, your pick, and what the host does; phases pick → opening → decide → reveal → done
function newGame(byHand) {
  const i = next++, [car, autoPick, r] = Array.from(deal(seed, i, n));
  g = { i, car, r, pick: -1, kept: -1, open: [], phase: 'pick', t: 0, choice: '', hand: byHand, autoPick };
}
function pick(d) {
  g.pick = d; g.kept = kept_door(n, g.car, d, g.r, knows);
  g.open = Array.from(opened_doors(n, d, g.kept)); g.phase = 'opening'; g.t = 0;
}
function choose(c) {
  if (g.phase !== 'decide') return;
  g.choice = c; g.phase = 'reveal'; g.t = 0;
  if (g.hand) { const k = c === 'stay' ? 0 : 2, won = (c === 'stay' ? g.pick : g.kept) === g.car; mine[k]++; if (won) mine[k + 1]++; }
  record();
}
// every game counts for both imaginary players: one who stays and one who switches
function record() {
  if (car_shown(g.car, g.pick, g.kept)) tally[3]++;
  else { tally[0]++; tally[g.car === g.pick ? 1 : 2]++; hist.push([tally[0], tally[1], tally[2]]); }
  if (hist.length > 400) hist = hist.filter((_, k) => k % 2 === 0 || k === hist.length - 1);
  panel();
}
const opening = () => (n === 3 ? 0.7 : n === 10 ? 1.1 : 2.4) * speed();
// the order the host opens doors in: scattered, the same in every browser for the same game, so the door left
// shut is never given away by a gap in a sweep
let rankFor = null, ranks = [];
function openRank(k, len) { const key = g.i + ':' + len; if (rankFor !== key) { rankFor = key; ranks = order(len); } return ranks[k]; }
function order(len) { let h = (g.i * 2654435761 + 97) >>> 0; const keys = Array.from({ length: len }, (_, j) => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = (h + j * 40503) >>> 0; return [h, j]; }); keys.sort((a, b) => a[0] - b[0]); const r = []; keys.forEach((q, pos) => { r[q[1]] = pos; }); return r; }
const speed = () => (g?.hand || still ? 1 : Math.max(0.12, Math.pow(0.88, autoGames)));

function step(dt) {
  g.t += dt;
  if (g.phase === 'opening' && g.t > opening()) {
    g.phase = 'decide'; g.t = 0;
    if (car_shown(g.car, g.pick, g.kept)) { g.phase = 'done'; g.choice = ''; record(); }
  }
  if (g.phase === 'reveal' && g.t > 0.5 * speed()) { g.phase = 'done'; g.t = 0; }
  if (!auto) return;
  // auto-play: pick, then alternately stay and switch, then the next game, faster as it goes
  const s = speed();
  if (g.phase === 'pick' && g.t > 0.5 * s) pick(g.autoPick);
  else if (g.phase === 'decide' && g.t > 0.6 * s) choose(g.i % 2 ? 'switch' : 'stay');
  else if (g.phase === 'done' && g.t > 0.9 * s) { autoGames++; newGame(false); }
}

// ---------- the doors ----------
const cv = $('stage'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
function layout(count, x0, y0, w, h, cols) {
  cols = cols || (count === 3 ? 3 : count === 10 ? 5 : 20);
  const rows = Math.ceil(count / cols), cw = w / cols, ch = h / rows;
  const dw = Math.min(cw * 0.78, ch * 0.7 * 0.75), dh = Math.min(ch * 0.82, dw / 0.68);
  return Array.from({ length: count }, (_, d) => { const cx = x0 + cw * (d % cols + 0.5), cy = y0 + ch * (Math.floor(d / cols) + 0.5); return [cx - dw / 2, cy - dh / 2, dw, dh]; });
}
// one door: o = how far open (0 shut, 1 open), with a car or a goat behind it
function door(g2, [x, y, w, h], o, isCar, label, big) {
  g2.fillStyle = isCar ? '#fef9c3' : '#f1f5f9'; g2.fillRect(x, y, w, h);
  if (o > 0.3 && w > 14) {
    const a0 = g2.globalAlpha; g2.globalAlpha = a0 * clamp((o - 0.3) / 0.4); g2.font = `${Math.round(Math.min(w * 0.7, h * 0.5))}px system-ui`; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(isCar ? '🚗' : '🐐', x + w / 2, y + h * 0.55); g2.globalAlpha = a0; g2.textBaseline = 'alphabetic';
  } else if (o > 0.3) { g2.fillStyle = isCar ? CAR : '#cbd5e1'; g2.fillRect(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.3); }
  const pw = w * (1 - 0.85 * o);   // the door panel swings open towards the left
  g2.fillStyle = o > 0 ? '#d6a46a' : WOOD; g2.fillRect(x, y, pw, h);
  if (o < 0.5 && big && w > 24) {
    g2.fillStyle = 'rgba(255,255,255,.9)'; g2.font = `600 ${Math.round(Math.min(w * 0.3, 40))}px system-ui`; g2.textAlign = 'center';
    g2.fillText(label, x + pw / 2, y + h * 0.42); if (w > 60) { g2.beginPath(); g2.arc(x + pw * 0.8, y + h * 0.55, 4, 0, 7); g2.fill(); }
  }
  g2.textAlign = 'left';
}
function ring(g2, [x, y, w, h], col, lw, dash) { g2.strokeStyle = col; g2.lineWidth = lw; g2.setLineDash(dash || []); g2.strokeRect(x - lw, y - lw, w + 2 * lw, h + 2 * lw); g2.setLineDash([]); }
const rects = () => layout(n, 20, 34, W - 40, 300);
// how far open each door is right now
function openness(d) {
  if (g.pick < 0) return 0;
  if (g.phase === 'opening') { const k = g.open.indexOf(d); if (k < 0) return 0; const T = opening(), delay = T * 0.6 * (n > 3 ? openRank(k, g.open.length) : k) / Math.max(1, g.open.length); return clamp((g.t - delay) / (T * 0.4)); }
  if (g.open.includes(d)) return 1;
  if (g.phase === 'reveal') return clamp(g.t / (0.5 * speed()));
  return g.phase === 'done' ? 1 : 0;
}
function drawStage() {
  c.clearRect(0, 0, W, H);
  const rs = rects(), big = n <= 10;
  // with many doors, opened goats fade once the host is done, so the two shut doors stand out
  const fade = n > 3 && g.pick >= 0 && g.phase !== 'opening' && g.phase !== 'pick';
  rs.forEach((r, d) => { const o = openness(d); c.globalAlpha = fade && g.open.includes(d) ? 0.35 : 1; door(c, r, o, d === g.car, String(d + 1), big); });
  c.globalAlpha = 1;
  if (g.pick >= 0) {
    const lw = n === 100 ? 2.5 : 4;
    ring(c, rs[g.pick], ST, lw);
    if (g.phase !== 'opening') ring(c, rs[g.kept], SW, lw, [8, 5]);
    if (g.phase === 'done' && g.choice) ring(c, rs[g.choice === 'stay' ? g.pick : g.kept], '#111', lw + 1);
    // labels on a white patch, drawn last so they sit over the doors around them
    const label = (r, s2, col) => { const [x, y, w] = r; c.font = `600 ${n === 100 ? 14 : 19}px system-ui`; c.textAlign = 'center';
      const tw = c.measureText(s2).width, ly = y - (n === 100 ? 6 : 8); c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(x + w / 2 - tw / 2 - 4, ly - (n === 100 ? 13 : 17), tw + 8, n === 100 ? 17 : 22);
      c.fillStyle = col; c.fillText(s2, x + w / 2, ly); };
    label(rs[g.pick], n === 100 ? 'you' : 'your pick', ST);
    if (g.phase !== 'opening') label(rs[g.kept], n === 100 ? 'shut' : 'left shut', SW);
    c.textAlign = 'left';
  }
  chart();
  say();
}
// how often staying and switching have won, game after game
function chart() {
  const L = 70, R = W - 150, T = 370, B = H - 30, [pS, pW] = Array.from(chances(n, knows)), total = Math.max(10, tally[0]);
  const X = k => L + (R - L) * k / total, Y = v => B - (B - T) * v;
  c.strokeStyle = '#e5e1d8'; c.lineWidth = 1; c.beginPath(); c.moveTo(L, T); c.lineTo(L, B); c.lineTo(R, B); c.stroke();
  c.fillStyle = '#888'; c.font = '17px system-ui';
  for (const v of [0, 0.5, 1]) c.fillText(`${v * 100}%`, L - 52, Y(v) + 6);
  c.fillText(`${tally[0]} game${tally[0] === 1 ? '' : 's'}`, R - 90, B + 22);
  for (const [v, col] of [[pS, ST], [pW, SW]]) { c.strokeStyle = col; c.globalAlpha = 0.4; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(R, Y(v)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
  const lastH = hist[hist.length - 1], ys = lastH ? [Y(lastH[1] / lastH[0]), Y(lastH[2] / lastH[0])] : [0, 0];
  if (lastH && Math.abs(ys[0] - ys[1]) < 18) { const m = (ys[0] + ys[1]) / 2, up = lastH[1] >= lastH[2] ? 0 : 1; ys[up] = m - 9; ys[1 - up] = m + 9; }
  for (const [k, col, name] of [[1, ST, 'staying'], [2, SW, 'switching']]) {
    if (!hist.length) continue;
    c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath();
    hist.forEach((h, i) => { const x = X(h[0]), y = Y(h[k] / h[0]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    const last = hist[hist.length - 1], v = last[k] / last[0];
    c.fillStyle = col; c.font = '600 19px system-ui'; c.fillText(`${name} ${Math.round(v * 100)}%`, R + 8, ys[k - 1] + 5);
  }
  c.fillStyle = '#555'; c.font = '17px system-ui'; c.fillText(`dashed: the exact chances, ${fmt(pS)} and ${fmt(pW)}`, L, T - 8);
}
const fmt = v => (Math.abs(v - 0.5) < 1e-9 ? '1/2' : Math.abs(v - 1 / n) < 1e-9 ? `1/${n}` : `${n - 1}/${n}`);

function say() {
  const P = g.pick + 1, K = g.kept + 1, C = g.car + 1;
  let s;
  if (g.phase === 'pick') s = auto ? `Playing by itself (game ${g.i + 1}). Click any door to play yourself.` : 'Pick a door: click it.';
  else if (g.phase === 'opening') s = `You picked door ${P}. The host opens ${n === 3 ? 'a door' : `${n - 2} doors`}…`;
  else if (g.phase === 'decide') s = n === 3 ? `You picked door ${P}. The host opened door ${g.open[0] + 1}: a goat. <b>Stay</b> with ${P} or <b>switch</b> to ${K}?` : `You picked door ${P}. The host opened ${n - 2} doors, all goats, and left door ${K} shut. <b>Stay</b> or <b>switch</b>?`;
  else if (!g.choice) s = `The host opened a door with the car behind it (door ${C}). He was guessing; this game doesn't count.`;
  else { const won = (g.choice === 'stay' ? g.pick : g.kept) === g.car; s = `The car was behind door ${C}. ${g.choice === 'stay' ? 'Staying' : 'Switching'} ${won ? '<b>wins the car</b>' : 'gets a goat'}; ${g.choice === 'stay' ? 'switching' : 'staying'} would have ${won ? 'lost' : 'won'}.`; }
  if (s !== say.last) { $('say').innerHTML = s; say.last = s; }
  const can = g.phase === 'decide';
  $('stay').disabled = $('switch').disabled = !can;
  $('auto').textContent = auto ? '■ Stop auto-play' : '▶ Auto-play';
}
function panel() {
  $('tStay').textContent = `${tally[1]} of ${tally[0]} (${pct(tally[1], tally[0])})`;
  $('tSwitch').textContent = `${tally[2]} of ${tally[0]} (${pct(tally[2], tally[0])})`;
  $('tVoid').textContent = `${tally[3]}`; $('voidRow').hidden = knows && !tally[3];
  $('mStay').textContent = `won ${mine[1]} of ${mine[0]}`; $('mSwitch').textContent = `won ${mine[3]} of ${mine[2]}`;
}

// ---------- what you can do ----------
function handGame() { auto = false; newGame(true); }
cv.addEventListener('click', e => {
  const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
  const d = rects().findIndex(([rx, ry, rw, rh]) => x > rx - 4 && x < rx + rw + 4 && y > ry - 4 && y < ry + rh + 4);
  if (d < 0) return;
  if (g.phase === 'decide' && g.hand) { if (d === g.pick) choose('stay'); else if (d === g.kept) choose('switch'); return; }
  if (g.phase === 'pick' && g.hand) { pick(d); return; }
  if (g.phase === 'opening' && g.hand) return;
  handGame(); pick(d);
});
$('stay').addEventListener('click', () => choose('stay'));
$('switch').addEventListener('click', () => choose('switch'));
$('new').addEventListener('click', handGame);
$('auto').addEventListener('click', () => { auto = !auto; if (auto) { autoGames = 0; if (g.hand && g.phase === 'pick') g.hand = false; else if (g.hand) newGame(false); } else if (!g.hand) newGame(true); });
$('fast').addEventListener('click', () => {
  for (let k = 0; k < 50; k++) {
    const [games, st, sw, vd] = Array.from(simulate(seed, next, 20, n, knows)); next += 20;
    tally[0] += games; tally[1] += st; tally[2] += sw; tally[3] += vd; if (games) hist.push([tally[0], tally[1], tally[2]]);
  }
  if (hist.length > 400) hist = hist.filter((_, k) => k % 2 === 0 || k === hist.length - 1);
  panel();
});
function reset() { seed = (seed + 1) >>> 0; next = 0; tally = [0, 0, 0, 0]; mine = [0, 0, 0, 0]; hist = []; autoGames = 0; newGame(!auto); panel(); }
$('reset').addEventListener('click', reset);
$('doors').addEventListener('change', () => { n = +$('doors').value; reset(); });
$('host').addEventListener('change', () => { knows = $('host').value === 'knows'; reset(); });

// ---------- step figures ----------
const fig = id => { const e = $(id), g2 = e.getContext('2d'); g2.clearRect(0, 0, e.width, e.height); return [g2, e.width, e.height]; };
// the game the figures follow: your pick and the door the host left shut (or door 1 and door 2)
function seen() {
  if (g.pick >= 0 && g.phase !== 'opening') return [g.pick, g.kept];
  return [0, 1];
}
const text = (g2, s, x, y, col = '#111', font = '600 15px system-ui') => { g2.fillStyle = col; g2.font = font; g2.fillText(s, x, y); };

// 1: the car visits every world; count the worlds where it is behind your pick
function ex1(sec) {
  const [g2, w] = fig('ex1'), [P] = seen(), per = n === 3 ? 1.2 : n === 10 ? 0.45 : 0.06, cyc = n * per + 2;
  const u = (still ? cyc : sec) % cyc, wv = Math.min(n - 1, Math.floor(u / per)), done = u >= n * per;
  const rs = layout(n, 20, 40, w - 40, 170, n === 100 ? 25 : undefined);
  rs.forEach((r, d) => door(g2, r, d === wv && !done ? 1 : 0, d === wv, String(d + 1), n <= 10));
  ring(g2, rs[P], ST, n === 100 ? 2 : 3);
  text(g2, done ? 'every world visited' : `world ${wv + 1} of ${n}: the car is behind door ${wv + 1}${wv === P ? ', your pick' : ''}`, 20, 26);
  const L = 20, R = w - 20, y = 250, cw = (R - L) / n;
  for (let j = 0; j < n; j++) {
    const visited = done || j <= wv;
    g2.fillStyle = !visited ? '#f1f5f9' : j === P ? '#16a34a' : '#94a3b8'; g2.fillRect(L + j * cw + (n < 100 ? 1 : 0), y, Math.max(1, cw - (n < 100 ? 2 : 0)), 34);
  }
  text(g2, 'each square is one world, all equally likely', L, y - 8, '#555', '13px system-ui');
  const right = done || wv >= P ? 1 : 0, seenN = done ? n : wv + 1;
  text(g2, `worlds where your first pick is right: ${right} of ${seenN}`, L, y + 64, '#16a34a');
  text(g2, done ? `chance your first pick is right = 1/${n};  wrong = ${n - 1}/${n}` : ' ', L, y + 92);
}

// 2: in each world, which door the host must (or may) leave shut
function ex2(sec) {
  const [g2, w, h] = fig('ex2'), [P] = seen(), others = [...Array(n).keys()].filter(d => d !== P);
  const worlds = n === 3 ? [P, ...others] : [P, others[0], others[1]], cyc = 3, u = still ? 0.99 : (sec % cyc) / cyc, round = Math.floor(sec / cyc);
  const rowH = 100, top = 30;
  worlds.forEach((car, k) => {
    const y = top + k * rowH, r = car === P ? round % (n - 1) : 0, kept = kept_door(n, car, P, r, true), open = Array.from(opened_doors(n, P, kept));
    const rs = layout(n, 190, y + 8, 280, 70, n === 100 ? 50 : n);
    rs.forEach((rr, d) => { const k2 = open.indexOf(d), o = k2 < 0 ? 0 : clamp((u * 1.6 - 0.6 * k2 / open.length) / 0.4); door(g2, rr, o, d === car, String(d + 1), n === 3); });
    ring(g2, rs[P], ST, n === 100 ? 1.5 : 2.5);
    { const [cx, cy, cw2] = rs[car]; g2.font = `${n === 3 ? 18 : 12}px system-ui`; g2.textAlign = 'center'; g2.fillText('🚗', cx + cw2 / 2, cy - 3); g2.textAlign = 'left'; }
    if (u > 0.6) ring(g2, rs[kept], SW, n === 100 ? 1.5 : 2.5, [5, 3]);
    text(g2, `car behind ${car + 1}`, 10, y + 38, '#111', '600 14px system-ui');
    text(g2, `chance 1/${n}`, 10, y + 58, '#555', '13px system-ui');
    const free = car === P;
    text(g2, free ? 'free choice:' : 'no choice:', 482, y + 38, free ? '#7c3aed' : '#111', '600 14px system-ui');
    text(g2, u > 0.6 ? `leaves door ${kept + 1} shut` : '…', 482, y + 58, SW, '14px system-ui');
  });
  if (n > 3) text(g2, `… and ${n - 3} more worlds like the last two: the host must leave the car's door shut`, 10, top + 3 * rowH + 4, '#555', '13px system-ui');
  else text(g2, 'In the top row he picks at random each time; in the others he never can.', 10, top + 3 * rowH + 4, '#555', '13px system-ui');
}

// 3 and 5: every world as a piece of a square, its area its chance; cross out what you didn't see
function worlds(id, capId, sec, kn) {
  const [g2, w, h] = fig(id), [P, K0] = seen(), K = K0 === P ? (P + 1) % n : K0;
  const x0 = 30, y0 = 50, S = 300, cw = S / n, cyc = 8, u = still ? 7.9 : sec % cyc;
  const fade = clamp((u - 1.5) / 2), grow = clamp((u - 4) / 2);
  text(g2, `You picked door ${P + 1}; the host left door ${K + 1} shut.`, x0, 24);
  for (let j = 0; j < n; j++) {
    const slices = kn && j !== P ? 1 : n - 1, sh = S / slices;
    for (let r = 0; r < slices; r++) {
      const kept = slices === 1 ? j : kept_door(n, j, P, r, false), match = kept === K, shown = car_shown(j, P, kept), lives = match && !shown;
      const x = x0 + j * cw, y = y0 + r * sh, col = j === P ? ST : SW;
      g2.globalAlpha = lives ? 1 : 1 - 0.85 * fade;
      g2.fillStyle = lives ? col : match && shown ? '#dc2626' : j === P ? '#bfdbfe' : '#fed7aa'; g2.fillRect(x, y, cw, sh);
      if (cw > 3 && sh > 3) { g2.strokeStyle = '#fff'; g2.lineWidth = n === 100 ? 0.5 : 1.5; g2.strokeRect(x, y, cw, sh); }
      g2.globalAlpha = 1;
      if (n === 3 && fade < 0.6) text(g2, `keeps ${kept + 1}`, x + 6, y + 18, lives ? '#fff' : '#555', '12px system-ui');
      if (match && shown && fade > 0.5 && n === 3) text(g2, '✗ car shown', x + 6, y + sh / 2 + 5, '#fff', '600 13px system-ui');
    }
    if (n <= 10) text(g2, `${j + 1}`, x0 + j * cw + cw / 2 - 4, y0 + S + 18, '#555', '13px system-ui');
  }
  text(g2, 'car behind door …', x0, y0 + S + 38, '#555', '13px system-ui');
  // the two survivors: first at their real size (each piece of a column 1/n wide), then blown up to share the whole bar
  const [a, b] = Array.from(surviving_worlds(n, kn)), BX = 400, BW = 90, pw = Math.max(cw, 4), base = y0 + S;
  const real = v => v * S * S / cw, lerp = (p, q) => p + (q - p) * grow;
  const pieces = [[a, ST, BX, real(a), base - S * (a + b > 0 ? 1 : 0)], [b, SW, BX + pw + 70, real(b), base - S * b / (a + b)]];
  if (fade > 0.3) {
    g2.globalAlpha = clamp((fade - 0.3) / 0.5);
    const den = x => (Math.abs(x * n * (n - 1) - 1) < 1e-9 ? `1/${n * (n - 1)}` : `1/${n}`);
    pieces.forEach(([v, col, x1, h1, yTop2], k) => {
      const h2 = S * v / (a + b), x = lerp(x1, BX), wd = lerp(pw, BW), hh = lerp(h1, h2), y = lerp(base - h1, yTop2);
      g2.fillStyle = col; g2.fillRect(x, y, wd, hh);
      const label = grow < 0.5 ? `${k ? 'switch' : 'stay'}: ${den(v)}` : `${k ? 'switch' : 'stay'}: ${fmtShare(v / (a + b))}`;
      text(g2, label, grow < 0.5 ? x : BX + BW + 10, grow < 0.5 ? y - 8 - 18 * k : y + Math.max(hh / 2, 8) + 5, col);
    });
    text(g2, grow < 0.5 ? 'what survives, at its real size' : 'shared out again: the new chances', BX, base + 18, '#555', '13px system-ui');
    g2.globalAlpha = 1;
  }
  $(capId).textContent = kn
    ? `The host knows. Blue: worlds where your pick is right, cut by the door he might leave shut. Orange: worlds where he had to leave the car's door shut. Only the bright pieces match what you saw.`
    : `The host guesses: every column is cut by the door he happened to leave shut. Red: he would have shown the car. The two bright pieces are equal.`;
}
const fmtShare = v => (Math.abs(v - 0.5) < 1e-9 ? '1/2' : Math.abs(v - 1 / n) < 1e-9 ? `1/${n}` : `${n - 1}/${n}`);

// 4: games sorted by one question: was the first pick right?
function ex4(sec) {
  const [g2, w] = fig('ex4'), N = 30, per = 0.35, cyc = N * per + 2.5, u = still ? cyc : sec % cyc;
  const games = Array.from({ length: N }, (_, i) => { const [car, p] = Array.from(deal(seed, 100000 + i, n)); return car === p; });
  const piles = [[], []], tile = 22, cols = 10;
  const slot = (side, k) => [(side ? 340 : 30) + (k % cols) * (tile + 4), 330 - Math.floor(k / cols) * (tile + 4)];
  text(g2, 'first pick right: staying wins', 30, 60, ST); text(g2, 'first pick wrong: switching wins', 340, 60, SW);
  games.forEach((right, i) => {
    const t = (u - i * per) / 0.3; if (t < 0) return;
    const side = right ? 0 : 1, k = piles[side].length; piles[side].push(i);
    const [tx, ty] = slot(side, k), e = 1 - (1 - clamp(t)) ** 3, x = 297 + (tx - 297) * e, y = 80 + (ty - 80) * e;
    g2.fillStyle = right ? ST : SW; g2.fillRect(x, y, tile, tile);
    g2.fillStyle = '#fff'; g2.font = '600 14px system-ui'; g2.fillText(right ? '✓' : '✗', x + 6, y + 16);
  });
  const a = piles[0].length, b = piles[1].length;
  text(g2, `${a}`, 30, 380, ST, '600 18px system-ui'); text(g2, `${b}`, 340, 380, SW, '600 18px system-ui');
  text(g2, `game ${a + b} of ${N}: so far ${a} : ${b}, and in the long run 1 : ${n - 1}`, 30, 26, '#111');
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (frame.last || now)) / 1000); frame.last = now;
  step(dt); drawStage();
  const sec = now / 1000;
  ex1(sec); ex2(sec); worlds('ex3', 'cap3', sec, true); ex4(sec); worlds('ex5', 'cap5', sec, false);
}

// ---------- Try this ----------
const setSel = (id, v) => { if ($(id).value !== v) { $(id).value = v; $(id).dispatchEvent(new Event('change')); } };
const TRY = [
  () => { setSel('doors', '3'); setSel('host', 'knows'); auto = true; reset(); },
  () => { setSel('doors', '3'); setSel('host', 'knows'); handGame(); },
  () => { setSel('doors', '100'); setSel('host', 'knows'); handGame(); },
  () => { setSel('doors', '3'); setSel('host', 'guesses'); reset(); $('fast').click(); },
];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });

newGame(false); panel();
requestAnimationFrame(frame);

// Together (together/share.js): the games, the tallies and the game on screen
const PHASES = ['pick', 'opening', 'decide', 'reveal', 'done'];
share(() => ({ seed, next, auto, tally, mine, hist: hist.flat(), g: { i: g.i, pick: g.pick, phase: g.phase, choice: g.choice, hand: g.hand } }), s => {
  const t = nums(s?.tally, 4), m = nums(s?.mine, 4), h = nums(s?.hist, 1500), q = s?.g;
  if (!t || t.length !== 4 || !m || m.length !== 4 || !h || h.length % 3 || !q || typeof q !== 'object') return;
  const ok = v => Number.isInteger(v) && v >= 0 && v < 2 ** 32;
  if (!ok(s.seed) || !ok(s.next) || !ok(q.i) || q.i > s.next || !PHASES.includes(q.phase) || !['', 'stay', 'switch'].includes(q.choice)) return;
  if (!Number.isInteger(q.pick) || q.pick < -1 || q.pick >= n || (q.pick < 0 && q.phase !== 'pick')) return;
  seed = s.seed; next = s.next; auto = !!s.auto; tally = [...t]; mine = [...m];
  hist = []; for (let k = 0; k < h.length; k += 3) hist.push([h[k], h[k + 1], h[k + 2]]);
  const [car, autoPick, r] = Array.from(deal(seed, q.i, n));
  g = { i: q.i, car, r, pick: -1, kept: -1, open: [], phase: 'pick', t: 0, choice: '', hand: !!q.hand, autoPick };
  if (q.pick >= 0) { pick(q.pick); g.phase = q.phase === 'opening' ? 'decide' : q.phase; g.t = 9; g.choice = q.choice; }
  panel();
});
