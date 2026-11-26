// The Nash equilibrium page: guess two-thirds of the average. A table of you, computer players and
// (with Together) friends; hidden guesses until the reveal (game.js); the maths from Rust
// (pkg/lilavati.js, games module); six step-by-step figures drawn from the last round. Before the game,
// "The idea": a game of two players with two choices each, with arrows for who would switch (switch_gains).
import init, { average, target, winners, computer_guesses, level_guess, iterate_replies, switch_gains } from '../pkg/lilavati.js';
import { createGame, P } from './game.js';
import { share, room } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const F = a => new Float64Array(a);
const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
const ACC = '#be123c', GOLD = '#d97706', INK = '#1c1917', MUTED = '#78716c', CPU = '#a8a29e', BLUE = '#2563eb';
const SEED = 7;

const score = vs => ({ avg: average(F(vs)), target: target(F(vs), P), win: Array.from(winners(F(vs), P)) });
const computers = (n, round, last) => Array.from(computer_guesses(n, round, last, P, SEED));
const game = createGame({ self: 'me', send: d => room.send(d), score, computers });

// ---------- who is at the table ----------
const solo = () => !room.active || room.people().length < 2;
function seat() {
  if (room.active) game.setSelf(room.self);
  const n = +$('cpu').value;
  game.setComputers(solo() && n === 0 ? 7 : n);   // alone, someone has to play against you
  game.setPeople(room.active ? room.people().map(p => ({ id: p.id, name: p.me ? 'You' : p.name })) : [{ id: game.self, name: 'You' }]);
}
// the number of computer players is the table's: a change goes to everyone (k: 'cpu', not a game.js message)
const CPU_N = ['0', '3', '7', '15'];
function setCpu(n) { if (CPU_N.includes(String(n)) && $('cpu').value !== String(n)) { $('cpu').value = String(n); seat(); } }
room.on(ev => {
  if (ev.type !== 'message') return seat();
  if (ev.data?.k === 'cpu') setCpu(ev.data.n); else game.receive(ev.data, ev.from);
});
$('cpu').addEventListener('change', () => { room.send({ k: 'cpu', n: +$('cpu').value }); seat(); });

// ---------- controls ----------
const guess = () => +$('guess').value;
$('guess').addEventListener('input', () => { $('gVal').textContent = fmt(guess()); draw(); });
$('lockBtn').addEventListener('click', () => game.lock(guess()));
$('revealBtn').addEventListener('click', () => game.reveal());
$('nextBtn').addEventListener('click', () => game.next());
$('inviteBtn').addEventListener('click', () => { const b = document.querySelector('.together-btn'); if (b && document.querySelector('.together')?.hidden) b.click(); });
// drag on the number line to choose
const line = $('line');
const toValue = e => { const r = line.getBoundingClientRect(), x = (e.clientX - r.left) * line.width / r.width; return Math.max(0, Math.min(100, (x - L.l) / (line.width - L.l - L.r) * 100)); };
let dragging = false;
line.addEventListener('pointerdown', e => { if (game.state.phase !== 'guess' || game.state.mine !== null) return; dragging = true; line.setPointerCapture(e.pointerId); setGuess(toValue(e)); });
line.addEventListener('pointermove', e => { if (dragging) setGuess(toValue(e)); });
for (const t of ['pointerup', 'pointercancel']) line.addEventListener(t, () => { dragging = false; });
function setGuess(v) { $('guess').value = Math.round(v * 10) / 10; $('gVal').textContent = fmt(guess()); draw(); }

// ---------- the reveal animation ----------
let shownRounds = 0, revealT = 1, revealStart = 0;
game.onChange(() => {
  const h = game.state.history;
  if (h.length > shownRounds) { shownRounds = h.length; revealStart = performance.now(); revealT = 0; explain(); }
  if (game.state.phase === 'guess' && game.state.mine === null && h.length) revealT = 1;
  panel(); draw();
});
const last = () => game.state.history[game.state.history.length - 1];

// ---------- the number line ----------
const L = { l: 46, r: 46, axis: 330 };   // axis: set from the canvas height and text size in draw()
function zoom(cv) { const w = cv.getBoundingClientRect().width; return w ? Math.max(1, Math.min(2.4, 0.85 * cv.width / w)) : 1; }
function axis(c, W, X, y, z, labels = true) {
  c.strokeStyle = '#d6d3d1'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(0), y); c.lineTo(X(100), y); c.stroke();
  c.fillStyle = MUTED; c.font = `${13 * z}px system-ui`; c.textAlign = 'center';
  for (let v = 0; v <= 100; v += 10) { c.fillRect(X(v) - 1, y - 5, 2, 10); if (labels && (z < 1.6 || v % 20 === 0)) c.fillText(v, X(v), y + 20 * z); }
}
function marker(c, x, y0, y1, color, text, z, dash) {
  c.strokeStyle = color; c.lineWidth = 2.5; c.setLineDash(dash || []); c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); c.setLineDash([]);
  if (text) { const W = c.canvas.width; c.font = `600 ${14 * z}px system-ui`; c.fillStyle = color; c.textAlign = x > W * 0.72 ? 'right' : x < W * 0.22 ? 'left' : 'center'; c.fillText(text, x, y1 - 8); }
}
// dots stacked upwards where guesses are close together
function stack(entries, X, y, gap) {
  const order = entries.map((e, i) => [e.v, i]).sort((a, b) => a[0] - b[0]), pos = [], placed = [];
  for (const [v, i] of order) { let k = 0; while (placed.some(p => p.k === k && Math.abs(X(p.v) - X(v)) < gap)) k++; placed.push({ v, k }); pos[i] = k; }
  return pos;
}
const ease = t => (t < 0 ? 0 : t > 1 ? 1 : 1 - (1 - t) ** 3);

function draw() {
  const c = line.getContext('2d'), W = line.width, H = line.height, z = zoom(line), st = game.state;
  const X = v => L.l + (W - L.l - L.r) * v / 100;
  L.axis = H - 14 - 46 * z;
  c.clearRect(0, 0, W, H);
  // the levels of thinking, faint
  c.font = `${11 * z}px system-ui`; c.textAlign = 'center';
  for (let k = 0; k <= 3; k++) { const v = level_guess(k, P, 50); c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(v), 40); c.lineTo(X(v), L.axis); c.stroke(); c.fillStyle = '#a8a29e'; c.fillText(z < 1.6 ? `level ${k}` : `L${k}`, X(v), 30); }
  axis(c, W, X, L.axis, z);
  const h = last();
  if (st.phase === 'done' && h) {
    const t = revealT, n = h.entries.length, pos = stack(h.entries, X, L.axis, 20 * Math.min(z, 1.4));
    h.entries.forEach((e, i) => {
      const k = ease(t * 3 - i / Math.max(1, n) * 1.2); if (k <= 0) return;
      const y = L.axis - 16 - pos[i] * 19 * Math.min(z, 1.3), yy = 40 + (y - 40) * k;
      const won = h.win.includes(i) && t > 0.85, me = e.id === game.self;
      c.globalAlpha = Math.min(1, k * 1.5);
      c.fillStyle = e.cpu ? CPU : me ? ACC : BLUE; c.beginPath(); c.arc(X(e.v), yy, (e.cpu ? 7 : 9) * Math.min(z, 1.3), 0, 7); c.fill();
      if (won) { c.strokeStyle = GOLD; c.lineWidth = 4; c.beginPath(); c.arc(X(e.v), yy, 15 * Math.min(z, 1.3), 0, 7); c.stroke(); }
      if (!e.cpu || won) { c.font = `600 ${12 * z}px system-ui`; c.fillStyle = won ? GOLD : me ? ACC : INK; c.textAlign = 'center'; c.fillText(`${e.name} ${fmt(e.v)}`, X(e.v), yy - 14 * Math.min(z, 1.3) - 4); }
      c.globalAlpha = 1;
    });
    // the average slides in from the middle, then two-thirds of it
    const ka = ease((t - 0.35) / 0.3), kt = ease((t - 0.6) / 0.3);
    if (ka > 0) { const ax = X(50 + (h.avg - 50) * ka); c.fillStyle = INK; c.beginPath(); c.moveTo(ax, L.axis + 6); c.lineTo(ax - 9, L.axis + 22); c.lineTo(ax + 9, L.axis + 22); c.fill();
      c.font = `${13 * z}px system-ui`; c.textAlign = 'center'; c.fillText(`average ${fmt(h.avg)}`, ax, L.axis + 42 * z); }
    if (kt > 0) { const tx = X(h.avg + (h.target - h.avg) * kt); marker(c, tx, L.axis + 4, 64, ACC, `⅔ of the average = ${fmt(h.target)}`, z); }
  } else {
    // guessing: my number (only I see it) and last round's target as a hint
    if (h) marker(c, X(h.target), L.axis, 70, 'rgba(190,18,60,.35)', `last round: ${fmt(h.target)}`, z, [6, 6]);
    const v = st.mine ?? guess(), x = X(v);
    c.fillStyle = st.mine !== null ? ACC : 'rgba(190,18,60,.55)'; c.beginPath(); c.arc(x, L.axis - 20, 11 * Math.min(z, 1.3), 0, 7); c.fill();
    c.font = `600 ${14 * z}px system-ui`; c.textAlign = 'center'; c.fillStyle = ACC;
    c.fillText(st.mine !== null ? `you: ${fmt(v)} 🔒` : `you: ${fmt(v)}`, x, L.axis - 42 * Math.min(z, 1.3));
    if (st.mine === null) { c.fillStyle = MUTED; c.font = `${13 * z}px system-ui`; c.fillText('drag to choose', x, L.axis + 42 * z); }
  }
  say();
}

function say() {
  const st = game.state, h = last(), others = room.active ? room.people().filter(p => !p.me) : [];
  const nc = game.state.computers, vs = `${others.length ? others.length + (others.length === 1 ? ' person' : ' people') : ''}${others.length && nc ? ' and ' : ''}${nc ? nc + ' computer player' + (nc === 1 ? '' : 's') : ''}`;
  let text;
  if (st.phase === 'done' && h) {
    const ws = h.win.map(i => h.entries[i]), me = ws.find(e => e.id === game.self);
    const who = me ? (ws.length > 1 ? 'You share the win' : 'You win!') : `${ws.map(e => e.name).join(' and ')} ${ws.length > 1 ? 'share the win' : 'wins'} with ${fmt(ws[0].v)}.`;
    text = `Round ${h.round}: average <b>${fmt(h.avg)}</b>, two-thirds of it <b>${fmt(h.target)}</b>. ${who}`;
  } else if (st.phase === 'reveal') text = 'Revealing…';
  else if (st.mine !== null) {
    const waiting = others.filter(p => !st.locked.includes(p.id)).map(p => p.name);
    text = `Locked in: <b>${fmt(st.mine)}</b>, hidden from everyone. ${waiting.length ? 'Waiting for ' + waiting.join(', ') + '.' : ''}`;
  } else text = `Round ${st.round}. Pick a number from 0 to 100 and lock it in. You play against ${vs || 'computer players'}.`;
  $('say').innerHTML = text;
  $('lockBtn').hidden = st.phase !== 'guess'; $('lockBtn').disabled = st.mine !== null;
  $('lockBtn').textContent = st.mine !== null ? 'Locked in' : 'Lock in';
  $('revealBtn').hidden = !(st.phase === 'guess' && others.length && st.locked.length);
  $('nextBtn').hidden = st.phase !== 'done';
  $('guess').disabled = st.phase !== 'guess' || st.mine !== null;
}

function panel() {
  const st = game.state, people = room.active ? room.people() : [{ id: game.self, name: 'You', me: true }];
  $('who').replaceChildren(...people.map(p => {
    const li = document.createElement('li'), done = st.locked.includes(p.me ? game.self : p.id);
    li.innerHTML = `<span class="tick">${st.phase === 'guess' ? (done ? '✓' : '…') : '•'}</span>`;
    li.append(p.me ? 'You' : p.name); if (done && st.phase === 'guess') li.classList.add('ok'); return li;
  }), ...(st.computers ? [Object.assign(document.createElement('li'), { className: 'cpu', innerHTML: `<span class="tick">⚙</span>${st.computers} computer player${st.computers === 1 ? '' : 's'}` })] : []));
  $('inviteBtn').hidden = room.active && room.people().length > 1;
  $('rounds').replaceChildren(...st.history.slice().reverse().map(h => {
    const tr = document.createElement('tr'), w = h.win.map(i => h.entries[i]).map(e => (e.id === game.self ? 'You' : e.name)).join(', ');
    tr.innerHTML = `<td>${h.round}</td><td>${fmt(h.avg)}</td><td>${fmt(h.target)}</td><td></td>`; tr.lastChild.textContent = w; return tr;
  }));
}

// ---------- step by step ----------
// the round the figures use: your last one, or computer players on their own
function example() {
  const vs = computers(9, 1, -1), r = score(vs);
  return { round: 1, avg: r.avg, target: r.target, win: r.win, entries: vs.map((v, i) => ({ id: 'cpu' + i, name: 'Computer ' + (i + 1), v, cpu: true })) };
}
const figRound = () => last() || example();
const figs = [1, 2, 3, 4, 5, 6].map(k => $('ex' + k));
const visible = new Set();
const io = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target); });
figs.forEach(f => io.observe(f));
$('pFig').addEventListener('change', explain);

function fig1(c, W, H, t, r) {
  // the pivot moves by how much the seesaw tips, settling at the average
  const X = v => 40 + (W - 80) * v / 100, base = 190, z = zoom(c.canvas);
  const cycle = (t % 9) / 9, k = Math.min(1, cycle / 0.75), f = r.avg + (50 - r.avg) * Math.exp(-5 * k) * Math.cos(9 * k);
  const torque = r.entries.reduce((s, e) => s + (e.v - f), 0), tilt = Math.max(-0.12, Math.min(0.12, -torque / 900));
  const Y = v => base - (X(v) - X(f)) * Math.tan(tilt);
  c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(100), Y(100)); c.stroke();
  c.fillStyle = MUTED; c.beginPath(); c.moveTo(X(f), base + 2); c.lineTo(X(f) - 14, base + 30); c.lineTo(X(f) + 14, base + 30); c.fill();
  const pos = stack(r.entries, X, base, 13);
  r.entries.forEach((e, i) => { c.fillStyle = e.cpu ? CPU : e.id === game.self ? ACC : BLUE; c.beginPath(); c.arc(X(e.v), Y(e.v) - 9 - pos[i] * 13, 6, 0, 7); c.fill(); });
  // the pulls on each side: the distances, added up
  const left = r.entries.filter(e => e.v < f).reduce((s, e) => s + f - e.v, 0), right = r.entries.filter(e => e.v >= f).reduce((s, e) => s + e.v - f, 0), sc = (W - 120) / 2 / Math.max(left, right, 1);
  c.fillStyle = 'rgba(37,99,235,.7)'; c.fillRect(W / 2 - left * sc, 300, left * sc, 18);
  c.fillStyle = 'rgba(234,88,12,.7)'; c.fillRect(W / 2, 300, right * sc, 18);
  c.fillStyle = INK; c.fillRect(W / 2 - 1, 292, 2, 34);
  c.font = `${13 * z}px system-ui`; c.textAlign = 'right'; c.fillText(`pull to the left ${fmt(left)}`, W / 2 - 8, 346); c.textAlign = 'left'; c.fillText(`pull to the right ${fmt(right)}`, W / 2 + 8, 346);
  c.textAlign = 'center'; c.font = `600 ${15 * z}px system-ui`; c.fillText(`pivot at ${fmt(f)}`, X(f), base + 58);
  c.font = `${11 * z}px system-ui`; c.fillStyle = MUTED; c.fillText('0', X(0), Y(0) + 22); c.fillText('100', X(100), Y(100) + 22);
  $('cap1').textContent = `Round ${r.round}: ${r.entries.length} guesses. The seesaw balances at ${fmt(r.avg)}, the average: the distances to the left add up to the same as those to the right.`;
}

function fig2(c, W, H, t, r) {
  const X = v => 40 + (W - 80) * v / 100, y = 230, z = zoom(c.canvas), ph = (t % 8) / 8;
  axis(c, W, X, y, z);
  // 0 → average as a bar, cut in three, two kept
  const third = r.avg / 3, k1 = ease(ph / 0.25), k2 = ease((ph - 0.25) / 0.2), k3 = ease((ph - 0.45) / 0.3);
  c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(X(0), 70, (X(r.avg) - X(0)) * k1, 26);
  c.fillStyle = INK; c.font = `${12 * z}px system-ui`; c.textAlign = 'center';
  if (k1 >= 1) c.fillText(`average ${fmt(r.avg)}`, X(r.avg), 60);
  if (k2 > 0) for (let i = 1; i <= 2; i++) { c.globalAlpha = k2; c.fillRect(X(third * i) - 1, 64, 2, 38); c.globalAlpha = 1; }
  if (k2 >= 1) { c.fillStyle = 'rgba(190,18,60,.5)'; c.fillRect(X(0), 70, X(2 * third) - X(0), 26); c.fillStyle = ACC; c.fillText(`two of three parts = ${fmt(r.target)}`, X(r.target / 2), 120); }
  if (k2 >= 1) marker(c, X(r.target), 98, y, ACC, '', z);
  // every guess, and its distance to the target
  const pos = stack(r.entries, X, y, 13), best = Math.min(...r.entries.map(e => Math.abs(e.v - r.target)));
  r.entries.forEach((e, i) => {
    const yy = y - 12 - pos[i] * 13, win = Math.abs(Math.abs(e.v - r.target) - best) < 1e-9;
    if (k3 > 0) { c.strokeStyle = win ? GOLD : 'rgba(0,0,0,.18)'; c.lineWidth = win ? 4 : 1.5; c.beginPath(); const yl = y + 40 + i * 8; c.moveTo(X(e.v), yl); c.lineTo(X(e.v + (r.target - e.v) * k3), yl); c.stroke(); }
    c.fillStyle = e.cpu ? CPU : e.id === game.self ? ACC : BLUE; c.beginPath(); c.arc(X(e.v), yy, 6, 0, 7); c.fill();
    if (win && k3 >= 1) { c.strokeStyle = GOLD; c.lineWidth = 3; c.beginPath(); c.arc(X(e.v), yy, 11, 0, 7); c.stroke(); c.fillStyle = GOLD; c.font = `600 ${13 * z}px system-ui`; c.fillText(`closest: ${fmt(e.v)}`, X(e.v), yy - 16); }
  });
  const w = r.entries[r.win[0]];
  $('cap2').textContent = `⅓ of ${fmt(r.avg)} is ${fmt(third)}; two of those make ${fmt(r.target)}. The lines below are each guess's distance to it: ${w ? `${w.id === game.self ? 'yours' : w.name + "'s"} (${fmt(w.v)}) is the shortest, ${fmt(Math.abs(w.v - r.target))} away.` : ''}`;
}

function fig3(c, W, H, t, r) {
  const X = v => 40 + (W - 80) * v / 100, y = 250, z = zoom(c.canvas), steps = 7, per = 1.4, s = Math.floor((t % (steps * per + 2)) / per);
  axis(c, W, X, y, z);
  const kk = Math.min(s, steps);
  for (let k = 1; k <= kk; k++) {
    const hi = 100 * P ** (k - 1), lo = 100 * P ** k;
    c.fillStyle = `rgba(120,113,108,${0.14 + 0.05 * k})`; c.fillRect(X(lo), 80, X(hi) - X(lo), y - 80);
    c.fillStyle = INK; c.font = `${12 * z}px system-ui`; c.textAlign = 'center';
    if (k <= 4) c.fillText(`step ${k}`, (X(lo) + X(hi)) / 2, 100);
    c.fillStyle = MUTED; c.fillText(fmt(lo), X(lo), y + 40 + (k % 2) * 16);
  }
  const edge = 100 * P ** kk;
  marker(c, X(edge), y, 140, ACC, kk ? `nothing sensible above ${fmt(edge)}` : 'everything from 0 to 100 is possible', z);
  marker(c, X(r.target), y, 200, GOLD, `the round's winning number: ${fmt(r.target)}`, z, [6, 5]);
  $('cap3').textContent = `Grey: guesses crossed out, one step of reasoning at a time (above 66.7, then 44.4, 29.6, 19.8 …). The winning number in round ${r.round}, ${fmt(r.target)}, sits where about ${Math.max(0, Math.round(Math.log(r.target / 100) / Math.log(P)))} steps would leave you: real players stop early.`;
}

function fig4(c, W, H, t, r) {
  const z = zoom(c.canvas), X = v => 150 + (W - 180) * v / 100, rows = 6, rh = (H - 60) / rows;
  const levelOf = v => (v <= 0 ? rows - 1 : Math.max(0, Math.min(rows - 1, Math.round(Math.log(v / 50) / Math.log(P)))));
  const grow = ease(((t % 8) / 8) / 0.5);
  for (let k = 0; k < rows; k++) {
    const v = level_guess(k, P, 50), y = 30 + k * rh;
    c.fillStyle = `rgba(190,18,60,${0.15 + 0.1 * k})`; c.fillRect(X(0), y + 6, (X(v) - X(0)) * Math.min(1, grow * rows - k > 0 ? Math.min(1, grow * rows - k) : 0), rh - 18);
    c.fillStyle = INK; c.font = `600 ${13 * z}px system-ui`; c.textAlign = 'right'; c.fillText(`level ${k}`, X(0) - 10, y + rh / 2 - 4);
    c.font = `${11 * z}px system-ui`; c.fillStyle = MUTED;
    if (grow * rows - k >= 1) c.fillText(k ? `${fmt(v)} = ⅔ × ${fmt(level_guess(k - 1, P, 50))}` : '50, the middle', X(0) - 10, y + rh / 2 + 12);
  }
  // the round's guesses, each on its nearest level
  if (grow >= 1) {
    const count = new Array(rows).fill(0);
    r.entries.forEach(e => {
      const k = levelOf(e.v), y = 30 + k * rh + rh / 2 - 3, x = X(e.v);
      c.fillStyle = e.cpu ? CPU : e.id === game.self ? ACC : BLUE; c.beginPath(); c.arc(x, y + (count[k]++ % 3 - 1) * 6, 6, 0, 7); c.fill();
      if (e.id === game.self) { c.font = `600 ${12 * z}px system-ui`; c.fillStyle = ACC; c.textAlign = 'center'; c.fillText('you', x, y - 12); }
    });
  }
  const levels = r.entries.map(e => levelOf(e.v)), mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  const mine = r.entries.find(e => e.id === game.self);
  $('cap4').textContent = `Each bar is two-thirds of the one above. The dots are round ${r.round}'s guesses, on their nearest level: on average ${fmt(mean)} levels deep${mine ? `; your ${fmt(mine.v)} is level ${levelOf(mine.v)}` : ''}.`;
}

function fig5(c, W, H, t, r) {
  const p = +$('pFig').value, z = zoom(c.canvas), M = 50, S = Math.min(W - 2 * M - 80, H - 2 * M);
  const X = v => M + 60 + S * v / 100, Y = v => H - M - S * v / 100;
  c.strokeStyle = '#d6d3d1'; c.lineWidth = 1.5; c.strokeRect(X(0), Y(100), S, S);
  c.font = `${12 * z}px system-ui`; c.fillStyle = MUTED; c.textAlign = 'center';
  c.fillText("the others' average", X(50), H - 14);
  c.save(); c.translate(X(0) - 34, Y(50)); c.rotate(-Math.PI / 2); c.fillText('your best guess', 0, 0); c.restore();
  for (const v of [0, 50, 100]) { c.fillText(v, X(v), Y(0) + 18); c.textAlign = 'right'; c.fillText(v, X(0) - 6, Y(v) + 4); c.textAlign = 'center'; }
  c.strokeStyle = '#a8a29e'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(100), Y(100)); c.stroke();
  c.strokeStyle = '#7c3aed'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(100), Y(100 * p)); c.stroke();
  const x0 = r.avg, xs = Array.from(iterate_replies(x0, p, 12)), n = Math.min(12, Math.floor((t % 10) / 0.6));
  c.strokeStyle = ACC; c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(xs[0]), Y(0));
  for (let i = 0; i < n; i++) { c.lineTo(X(xs[i]), Y(xs[i + 1])); c.lineTo(X(xs[i + 1]), Y(xs[i + 1])); }
  c.stroke();
  c.fillStyle = ACC; c.beginPath(); c.arc(X(xs[0]), Y(0), 6, 0, 7); c.fill();
  if (p < 1) { c.fillStyle = INK; c.beginPath(); c.arc(X(0), Y(0), 7, 0, 7); c.fill(); c.font = `600 ${13 * z}px system-ui`; c.textAlign = 'left'; c.fillText('0: its own best reply', X(0) + 10, Y(0) - 10); }
  c.font = `600 ${13 * z}px system-ui`; c.fillStyle = '#7c3aed'; c.textAlign = 'right'; c.fillText(`best reply = ${p === 1 ? '' : fmt(p, 2) + ' × '}average`, X(100), Y(100 * p) + (p === 1 ? 20 : -8));
  $('cap5').textContent = p === 1
    ? 'With the fraction exactly 1 the purple line lies on the diagonal: every number is its own best reply, so whatever everyone picks together is an equilibrium.'
    : `From the round's average ${fmt(x0)}: ${xs.slice(1, 5).map(v => fmt(v)).join(', ')} … after 12 replies ${fmt(xs[12], 2)}. Only 0 maps to itself.`;
}

function fig6(c, W, H, t, r) {
  let hist = game.state.history, ex = false;
  if (hist.length < 2) {   // computer players replying to themselves, until you have played a few rounds
    ex = true; hist = []; let lastAvg = -1;
    for (let k = 1; k <= 6; k++) { const vs = computers(9, k, lastAvg), s = score(vs); hist.push({ round: k, avg: s.avg, target: s.target }); lastAvg = s.avg; }
  }
  hist = hist.slice(-10);
  const z = zoom(c.canvas), M = 40, n = hist.length, bw = (W - 2 * M - 40) / n, top = Math.max(60, ...hist.map(h => h.avg)) * 1.1;
  const Y = v => H - M - (H - 2 * M - 20) * v / top, grow = ease(((t % 8) / 8) / 0.25);
  hist.forEach((h, i) => {
    const x = M + 40 + i * bw;
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x + bw * 0.15, Y(h.avg * grow), bw * 0.32, Y(0) - Y(h.avg * grow));
    c.fillStyle = 'rgba(190,18,60,.7)'; c.fillRect(x + bw * 0.5, Y(h.target * grow), bw * 0.32, Y(0) - Y(h.target * grow));
    c.fillStyle = MUTED; c.font = `${12 * z}px system-ui`; c.textAlign = 'center'; c.fillText(`round ${h.round}`, x + bw / 2, H - M + 18);
    if (grow >= 1) { c.fillStyle = INK; c.fillText(fmt(h.avg), x + bw * 0.31, Y(h.avg) - 6); }
  });
  // where perfect replies would go: two-thirds less each round
  c.strokeStyle = ACC; c.setLineDash([5, 5]); c.lineWidth = 2; c.beginPath();
  hist.forEach((h, i) => { const v = hist[0].avg * P ** i, x = M + 40 + i * bw + bw / 2; i ? c.lineTo(x, Y(v)) : c.moveTo(x, Y(v)); }); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#d6d3d1'; c.beginPath(); c.moveTo(M + 30, Y(0)); c.lineTo(W - M, Y(0)); c.stroke();
  c.font = `${12 * z}px system-ui`; c.textAlign = 'left'; c.fillStyle = MUTED; c.fillText('grey: average   red: ⅔ of it (the winning number)', M, 24);
  $('cap6').textContent = ex ? 'Computer players on their own, replying to the last average each round. Play two or more rounds above and this shows yours.'
    : `Your ${n} rounds: the average went from ${fmt(hist[0].avg)} to ${fmt(hist[n - 1].avg)}.`;
}

const FIGS = [fig1, fig2, fig3, fig4, fig5, fig6];
function explain() { for (const f of figs) visible.add(f); }   // draw every figure once more, now
function frame(now) {
  requestAnimationFrame(frame);
  if (revealT < 1) { revealT = Math.min(1, (now - revealStart) / 2400); draw(); }
  const r = figRound(), t = now / 1000;
  figs.forEach((cv, k) => {
    if (!visible.has(cv)) return;
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    FIGS[k](c, cv.width, cv.height, t, r);
  });
}

// ---------- Try this ----------
let auto = null;
const TRY = [
  () => { if (game.state.phase === 'done') game.next(); setGuess(33.3); },
  () => { if (game.state.phase === 'done') game.next(); setGuess(0); },
  () => {
    if (!solo()) { $('say').innerHTML = 'Quick rounds are for playing alone: here everyone would have to wait for you.'; return; }
    if (auto) return;
    let k = 0;
    const step = async () => {
      if (game.state.phase === 'done') game.next();
      const h = last(); setGuess(h ? h.target : 33.3);
      await game.lock(guess());
      if (++k < 5) auto = setTimeout(step, 2900); else auto = null;
    };
    step();
  },
  () => $('inviteBtn').click(),
];
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[+b.dataset.try](); $('play').scrollIntoView({ behavior: 'smooth' }); });

// ---------- The idea: a 2×2 game, and who would switch from each cell ----------
// you pick the row, they pick the column; points per cell row by row: [row 1 col 1, row 1 col 2, row 2 col 1, row 2 col 2]
const GAMES = [
  { names: ['High price', 'Low price'], you: [3, 0, 5, 1], them: [3, 5, 0, 1],
    story: 'You and the shop across the street sell the same thing and each pick a price. Both high: 3 points of profit each. If one goes low, it takes the customers: 5 points for it, 0 for the one still high. Both low: 1 point each.',
    end: 'Both shops would make 3 at high prices, yet from there each one gains by going low alone. The only cell nobody leaves is both low, with 1 point each: an equilibrium that is worse for both of them. (Game theorists call this shape the prisoner\'s dilemma.)' },
  { names: ['Café', 'Cinema'], you: [2, 0, 0, 1], them: [2, 0, 0, 1],
    story: 'You and a friend meant to meet, but both phones are dead. Each of you goes to the café or the cinema. Meeting at the café: 2 points each (you both like it more). Meeting at the cinema: 1 point each. Missing each other: 0.',
    end: 'Two cells have no arrow out: a game can have more than one equilibrium. Meeting at the café is better for both, but once you are both at the cinema, neither gains by leaving alone either.' },
  { names: ['Left', 'Right'], you: [0, 1, 1, 0], them: [1, 0, 0, 1],
    story: 'You take a penalty kick and they keep goal. You kick left or right; they dive left or right (the same sides of the goal). If they dive the way you kick, they save it: 1 point to them. If not, you score: 1 point to you.',
    end: 'The arrows go round in a circle: in every cell someone wants to switch, so there is no equilibrium in plain choices. Nash proved there always is one if players may choose at random: kick each side half the time and dive each side half the time, and then neither of you can do better by changing.' },
];
const ideaCv = $('ideaCanvas'), ideaC = ideaCv.getContext('2d');
const GOLD_BG = '#fef3c7', GOLD_INK = '#92400e';
let ideaCell = 0, ideaGrow = 1, ideaLast = 0, ideaBox = null, ideaSeen = false;
const ideaGame = () => Math.min(2, Math.max(0, +$('ideaGame').value | 0));
const otherRow = i => (1 - (i >> 1)) * 2 + (i & 1), otherCol = i => (i & 2) + (1 - (i & 1));

function arrow(c, x0, y0, x1, y1, col, w) {
  const a = Math.atan2(y1 - y0, x1 - x0), h = 4 + 2.6 * w;
  c.strokeStyle = c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 - Math.cos(a) * h * 0.7, y1 - Math.sin(a) * h * 0.7); c.stroke();
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45)); c.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45)); c.closePath(); c.fill();
}

function drawIdea() {
  const g = GAMES[ideaGame()], gains = Array.from(switch_gains(F(g.you), F(g.them)));
  const W = Math.round(ideaCv.clientWidth || 700), narrow = W < 560, dpr = devicePixelRatio || 1;
  const pad = 12, LW = narrow ? 92 : 140, legendH = 66, HH = 46, ch = narrow ? 118 : 132;
  const cw = (W - LW - pad) / 2, gx = LW, gy = pad + legendH + HH, H = Math.round(gy + 2 * ch + pad);
  if (ideaCv.width !== Math.round(W * dpr) || ideaCv.height !== Math.round(H * dpr)) { ideaCv.width = Math.round(W * dpr); ideaCv.height = Math.round(H * dpr); ideaCv.style.height = H + 'px'; }
  const c = ideaC; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  ideaBox = { gx, gy, cw, ch };
  // the legend
  c.font = `${narrow ? 13 : 14}px system-ui`; c.textBaseline = 'middle'; c.textAlign = 'left';
  const legend = [[ACC, 'red arrow: you would gain by switching row'], [BLUE, 'blue arrow: they would gain by switching column'], [GOLD_BG, 'gold cell: nobody would, a Nash equilibrium']];
  const lx = pad; let ly = pad + 10;
  for (const [col, text] of legend) {
    c.fillStyle = col; c.fillRect(lx, ly - 5, 14, 10); if (col === GOLD_BG) { c.strokeStyle = GOLD; c.lineWidth = 1; c.strokeRect(lx + 0.5, ly - 4.5, 13, 9); } c.fillStyle = INK; c.fillText(text, lx + 20, ly);
    ly += 21;
  }
  // headers: their choices across the top, yours down the side
  c.textAlign = 'center';
  for (let k = 0; k < 2; k++) {
    const x = gx + cw * (k + 0.5);
    c.fillStyle = BLUE; c.font = `${narrow ? 12 : 13}px system-ui`; c.fillText('they pick', x, gy - HH + 13);
    c.font = `600 ${narrow ? 14 : 15}px system-ui`; c.fillText(g.names[k], x, gy - 13);
    const y = gy + ch * (k + 0.5);
    c.textAlign = 'right'; c.fillStyle = ACC; c.font = `${narrow ? 12 : 13}px system-ui`; c.fillText('you pick', gx - 10, y - 10);
    c.font = `600 ${narrow ? 14 : 15}px system-ui`; c.fillText(g.names[k], gx - 10, y + 10); c.textAlign = 'center';
  }
  // the four cells
  for (let i = 0; i < 4; i++) {
    const r = i >> 1, k = i & 1, x = gx + k * cw, y = gy + r * ch, eq = gains[i] === 0;
    c.fillStyle = eq ? GOLD_BG : '#fafaf9'; c.fillRect(x, y, cw, ch);
    c.strokeStyle = 'rgba(28,25,23,.25)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    const cx = x + cw / 2, cy = y + ch / 2;
    c.font = `700 ${narrow ? 15 : 17}px system-ui`;
    c.fillStyle = ACC; c.fillText(`you ${g.you[i]}`, cx, cy - 11);
    c.fillStyle = BLUE; c.fillText(`them ${g.them[i]}`, cx, cy + 11);
    if (eq) { c.fillStyle = GOLD_INK; c.font = `600 ${narrow ? 12 : 13}px system-ui`; c.fillText(narrow ? 'equilibrium' : 'Nash equilibrium', cx, r ? y + ch - 13 : y + 13); }
  }
  // the cell being read: a dark frame, and rings round the two numbers it is compared with
  const s = ideaCell, sx = gx + (s & 1) * cw, sy = gy + (s >> 1) * ch;
  c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(sx + 2, sy + 2, cw - 4, ch - 4);
  const ring = (i, dy, col) => { const x = gx + ((i & 1) + 0.5) * cw, y = gy + ((i >> 1) + 0.5) * ch + dy; c.strokeStyle = col; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(x, y, narrow ? 36 : 44, 12, 0, 0, 2 * Math.PI); c.stroke(); c.setLineDash([]); };
  ring(s, -11, ACC); ring(otherRow(s), -11, ACC); ring(s, 11, BLUE); ring(otherCol(s), 11, BLUE);
  // the arrows, growing in after a change of game
  const t = ideaGrow < 0 ? 0 : 1 - (1 - ideaGrow) ** 3;
  for (let i = 0; i < 4; i++) {
    const r = i >> 1, k = i & 1;
    if (gains[i] & 1) {   // you would switch row: a vertical arrow across the middle line, in this column
      const x = gx + (k + 0.5) * cw, yb = gy + ch, a = Math.min(0.24 * ch, 32), d = r ? -1 : 1;
      arrow(c, x, yb - d * a, x, yb - d * a + d * 2 * a * Math.max(t, 0.05), ACC, i === s ? 5 : 3.5);
    }
    if (gains[i] & 2) {   // they would switch column: a horizontal arrow across the middle line, in this row
      const y = gy + (r + 0.5) * ch, xb = gx + cw, a = Math.min(0.2 * cw, 34), d = k ? -1 : 1;
      arrow(c, xb - d * a, y, xb - d * a + d * 2 * a * Math.max(t, 0.05), y, BLUE, i === s ? 5 : 3.5);
    }
  }
}

function ideaWords() {
  const g = GAMES[ideaGame()], gains = Array.from(switch_gains(F(g.you), F(g.them))), s = ideaCell;
  const r = s >> 1, k = s & 1, n = g.names, yo = g.you[otherRow(s)], to = g.them[otherCol(s)];
  $('ideaStory').textContent = g.story;
  const eqs = gains.map((v, i) => (v === 0 ? `(${n[i >> 1]}, ${n[i & 1]})` : null)).filter(Boolean);
  $('ideaCap').textContent = `Tap a cell to read it. ${eqs.length ? `Nash equilibri${eqs.length > 1 ? 'a' : 'um'} (your choice, theirs): ${eqs.join(' and ')}.` : 'No cell without an arrow out: no equilibrium in plain choices.'}`;
  const yes = (a, b) => (a >= b ? `${a} ≥ ${b} ✓` : `${a} ≥ ${b} ✗`);
  $('ideaFormula').textContent = `(${n[r]}, ${n[k]}):  you ${yes(g.you[s], yo)}   them ${yes(g.them[s], to)}   ⇒  ${gains[s] ? 'not an equilibrium' : 'Nash equilibrium'}`;
  const youPart = g.you[s] >= yo ? `If you switched to ${n[1 - r]} on your own you would get ${yo}, no more, so you stay.` : `If you switched to ${n[1 - r]} on your own you would get ${yo}, more, so you would switch: the red arrow.`;
  const themPart = g.them[s] >= to ? `If they switched to ${n[1 - k]} they would get ${to}, no more, so they stay.` : `If they switched to ${n[1 - k]} they would get ${to}, more, so they would switch: the blue arrow.`;
  $('ideaSay').innerHTML = `Read the line above as: in the cell where you pick <strong>${n[r]}</strong> and they pick <strong>${n[k]}</strong>, are your points at least what you would get in the other row (same column), and are theirs at least what they would get in the other column (same row)? `
    + `Here you get ${g.you[s]}. ${youPart} They get ${g.them[s]}. ${themPart} ${gains[s] ? 'Somebody gains by moving alone, so this is not an equilibrium.' : 'Nobody gains by moving alone: this cell is a Nash equilibrium.'}<br><br>${g.end}`;
}
function ideaShow() { ideaWords(); drawIdea(); }
function ideaPick(e) {
  if (!ideaBox) return;
  const rc = ideaCv.getBoundingClientRect(), x = e.clientX - rc.left - ideaBox.gx, y = e.clientY - rc.top - ideaBox.gy;
  if (x < 0 || y < 0 || x >= 2 * ideaBox.cw || y >= 2 * ideaBox.ch) return;
  ideaCell = (y >= ideaBox.ch ? 2 : 0) + (x >= ideaBox.cw ? 1 : 0); ideaShow();
}
ideaCv.addEventListener('click', ideaPick);
$('ideaGame').addEventListener('change', () => { ideaCell = 0; ideaGrow = 0; ideaShow(); });
new IntersectionObserver(es => { for (const e of es) ideaSeen = e.isIntersecting; }).observe(ideaCv);
(function ideaFrame(now) {
  if (ideaSeen && ideaGrow < 1) { ideaGrow = Math.min(1, ideaGrow + (now - ideaLast) / 700); drawIdea(); }
  ideaLast = now; requestAnimationFrame(ideaFrame);
})(performance.now());
// the shared part (see share() below): which game and which cell is being read
function ideaAdopt(v) {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isInteger) || v[0] < 0 || v[0] > 2 || v[1] < 0 || v[1] > 3) return;
  if (String(v[0]) !== $('ideaGame').value) { $('ideaGame').value = String(v[0]); ideaGrow = 0; }
  ideaCell = v[1]; ideaShow();
}

// ---------- start ----------
seat(); panel(); draw(); ideaShow(); requestAnimationFrame(frame);
addEventListener('resize', () => { draw(); drawIdea(); });
// Together (together/share.js): the rounds so far, for someone who joins; never a hidden guess
share(() => ({ ...game.snapshot(), cpu: +$('cpu').value, idea: [ideaGame(), ideaCell] }), s => {
  if (s && 'idea' in s) ideaAdopt(s.idea);
  if (s && 'cpu' in s) setCpu(s.cpu);
  if (game.adopt(s)) { shownRounds = game.state.history.length; revealT = 1; panel(); draw(); }
});
