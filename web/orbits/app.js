// The orbits page: a satellite round the Earth, seen from above the North Pole (Rust: pkg/lilavati.js,
// orbit module). Launch it and fire its engine.
// top. Positions are metres from the Earth's centre, y up; the Earth spins anticlockwise once a day.
import init, { Craft, predict, elements, gravity, felt_gravity, circular_speed, escape_speed, synchronous_radius, earth_radius, earth_spin } from '../pkg/lilavati.js';
import { share, nums } from '../together/share.js';

await init();
const $ = id => document.getElementById(id);
const R = earth_radius(), OMEGA = earth_spin(), GEO = synchronous_radius(), G0 = gravity(R), FAR = 30 * R;
const PERSON = 70;

// ---------- sliders with a nicer scale ----------
// height and tower: slider 0..100, roughly logarithmic so 100 km and 40,000 km both fit
const heightOf = s => 100e3 * Math.pow(400, s / 100);                         // 100 km .. 40,000 km
const heightSlider = h => 100 * Math.log(h / 100e3) / Math.log(400);
const towerOf = s => (s <= 0 ? 0 : 0.5e3 * Math.pow(1e5, s / 100));            // 0, 500 m .. 50,000 km
const towerSlider = h => (h <= 0 ? 0 : 100 * Math.log(h / 0.5e3) / Math.log(1e5));
const warpOf = s => Math.pow(10, s);                                            // 10× .. 50,000×

// ---------- formatting ----------
const km = m => {
  const k = m / 1000;
  if (Math.abs(k) < 10) return `${k.toFixed(2)} km`;
  return `${Math.round(k).toLocaleString('en')} km`;
};
const hm = m => (m < 1000 ? `${Math.round(m)} m` : km(m));
const kms = v => `${(v / 1000).toFixed(2)} km/s`;
function dur(s) {
  if (!isFinite(s)) return 'never';
  if (s < 120) return `${Math.round(s)} s`;
  if (s < 2 * 3600) return `${Math.round(s / 60)} min`;
  if (s < 3 * 86400) return `${(s / 3600).toFixed(1)} hours`;
  return `${(s / 86400).toFixed(1)} days`;
}

// ---------- state ----------
let craft, ghost = null, ghostOut = 0, trail = [], simT = 0, playing = true, last = 0;
let tower = 0, viewR = 1.4 * R, gone = false;
const TOWER_AT = Math.PI / 2 - 0.9;   // the tower's longitude at time 0 (so it doesn't sit under the launch point)

function towerAngle() { return TOWER_AT + OMEGA * simT; }
function setCraft(x, y, vx, vy) {
  craft?.free(); craft = new Craft(x, y, vx, vy);
  trail = []; gone = false; foresee(); explain();
}
function foresee() {
  const [x, y, vx, vy] = craft.state();
  ghost?.free?.();
  const p = predict(x, y, vx, vy, FAR, 1500); ghost = p.points(); ghostOut = p.outcome(); p.free();
  readouts();
}
// launch from the top of the picture (above the North Pole view's "12 o'clock"), moving anticlockwise
function launch(h = heightOf(+$('height').value), pct = +$('speed').value, aim = +$('aim').value) {
  const r = R + h, v = circular_speed(r) * pct / 100, a = aim * Math.PI / 180;
  setCraft(0, r, -v * Math.cos(a), v * Math.sin(a));
  autoWarp();
}
// time speed so that one lap takes about 12 seconds
function autoWarp() {
  const [x, y, vx, vy] = craft.state(), el = elements(x, y, vx, vy);
  const T = isFinite(el[5]) ? el[5] : 2 * Math.PI * Math.sqrt(Math.pow(Math.hypot(x, y), 3) / 3.986e14);
  const s = Math.min(4.7, Math.max(1, Math.log10(T / 12)));
  $('warp').value = s; labels();
}
function reset() {
  $('height').value = heightSlider(400e3); $('speed').value = 100; $('aim').value = 0;
  simT = 0;
  playing = true; $('playBtn').textContent = 'Pause';
  launch(400e3, 100, 0);
}
// engine burns: 100 m/s, or 3% of the speed when that is more (far out, 100 m/s is a lot)
const dv = () => { const s = craft.state(); return Math.max(50, Math.min(100, 0.03 * Math.hypot(s[2], s[3]))); };
// after a burn the sliders show where the satellite is now and its new speed there, so they follow
function syncSliders() {
  const [x, y, vx, vy] = craft.state(), r = Math.hypot(x, y);
  $('height').value = heightSlider(Math.max(100e3, r - R));
  $('speed').value = Math.round(100 * Math.hypot(vx, vy) / circular_speed(r));
  labels();
}
const burn = d => { if (gone || craft.crashed()) return; craft.burn(d); syncSliders(); foresee(); explain(); };
$('faster').addEventListener('click', () => burn(dv()));
$('slower').addEventListener('click', () => burn(-dv()));
$('reset').addEventListener('click', reset);
$('playBtn').addEventListener('click', () => { playing = !playing; $('playBtn').textContent = playing ? 'Pause' : 'Play'; });
$('warp').addEventListener('input', labels);
// the launch sliders act straight away: every change is a new launch, so the picture follows your finger
for (const id of ['height', 'speed', 'aim']) $(id).addEventListener('input', () => { labels(); launch(); playing = true; $('playBtn').textContent = 'Pause'; });

const PRESETS = [
  ['Space station', 400e3, 100], ['GPS', 20_200e3, 100], ['Geostationary', GEO - R, 100], ["Newton's cannon", 150e3, 85],
];
for (const [name, h, p] of PRESETS) {
  const b = Object.assign(document.createElement('button'), { className: 'outline', textContent: name });
  b.addEventListener('click', () => { $('height').value = heightSlider(h); $('speed').value = p; $('aim').value = 0; labels(); launch(h, p, 0); });
  $('presets').append(b);
}

function labels() {
  const h = heightOf(+$('height').value), r = R + h, pct = +$('speed').value;
  $('hVal').textContent = km(h);
  $('sVal').textContent = `${pct}% = ${kms(circular_speed(r) * pct / 100)}`;
  $('aVal').textContent = `${$('aim').value}°`;
  const w = warpOf(+$('warp').value);
  $('warpVal').textContent = w < 60 ? `1 s = ${Math.round(w)} s` : w < 3600 ? `1 s = ${(w / 60).toFixed(1)} min` : `1 s = ${(w / 3600).toFixed(1)} h`;
  if (craft) $('dvVal').textContent = `${Math.round(dv())} m/s`;
}

// ---------- the picture ----------
const cv = $('space'), c = cv.getContext('2d'), W = cv.width, MID = W / 2;
const stars = Array.from({ length: 160 }, (_, i) => [((i * 7919) % 900), ((i * 104729) % 900), ((i * 31) % 3) / 2 + .4]);
const LAND = [[0.2, .6, .2], [0.45, .72, .12], [1.3, .5, .24], [1.55, .74, .1], [2.4, .66, .17], [2.65, .48, .1], [3.4, .42, .2], [3.7, .7, .14], [4.5, .62, .19], [4.75, .4, .09], [5.5, .52, .22], [5.85, .78, .08]];   // angle, radius, size
function view(x, y) { const s = (W / 2 - 20) / viewR; return [MID + x * s, MID - y * s]; }
function earth() {
  const [ex, ey] = view(0, 0), er = R * (W / 2 - 20) / viewR, spin = OMEGA * simT;
  const glow = c.createRadialGradient(ex, ey, er * .95, ex, ey, er * 1.12);
  glow.addColorStop(0, 'rgba(96,165,250,.45)'); glow.addColorStop(1, 'rgba(96,165,250,0)');
  c.fillStyle = glow; c.beginPath(); c.arc(ex, ey, er * 1.12, 0, 7); c.fill();
  const sea = c.createRadialGradient(ex - er * .3, ey - er * .3, er * .1, ex, ey, er);
  sea.addColorStop(0, '#3b82f6'); sea.addColorStop(1, '#1e3a8a');
  c.fillStyle = sea; c.beginPath(); c.arc(ex, ey, er, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(ex, ey, er, 0, 7); c.clip();
  c.fillStyle = 'rgba(74,222,128,.55)';
  for (const [a, rr, sz] of LAND) { const t = a + spin; c.beginPath(); c.ellipse(ex + Math.cos(t) * rr * er, ey - Math.sin(t) * rr * er, sz * er, sz * er * .6, -t, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(ex, ey, er * .13, 0, 7); c.fill();   // the North Pole's ice
  c.restore();
}
function polyline(pts, close) { c.beginPath(); for (let i = 0; i < pts.length; i += 2) { const [x, y] = view(pts[i], pts[i + 1]); i ? c.lineTo(x, y) : c.moveTo(x, y); } if (close) c.closePath(); }
function draw() {
  c.clearRect(0, 0, W, W);
  for (const [x, y, r] of stars) { c.fillStyle = `rgba(255,255,255,${.25 + r * .3})`; c.fillRect(x, y, r, r); }
  // geostationary ring when it fits
  if (GEO < viewR * 1.05) { c.strokeStyle = 'rgba(251,191,36,.25)'; c.setLineDash([4, 6]); c.lineWidth = 1; const [ex, ey] = view(0, 0); c.beginPath(); c.arc(ex, ey, GEO * (W / 2 - 20) / viewR, 0, 7); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(251,191,36,.6)'; c.font = '13px system-ui'; c.fillText('geostationary height', ...view(GEO * .72, GEO * .72)); }
  earth();
  // the tower at the equator, turning with the Earth
  if (tower) {
    const th = towerAngle(), [x0, y0] = view(R * Math.cos(th), R * Math.sin(th)), [x1, y1] = view((R + tower) * Math.cos(th), (R + tower) * Math.sin(th));
    c.strokeStyle = '#fb923c'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 + (x1 === x0 ? 0 : 0), y1); c.stroke();
    c.fillStyle = '#fdba74'; c.beginPath(); c.arc(x1, y1, 5, 0, 7); c.fill();
  }
  // the path ahead, then where it has been
  if (ghost && !gone) { c.strokeStyle = ghostOut === 1 ? 'rgba(248,113,113,.6)' : ghostOut === 2 ? 'rgba(251,191,36,.6)' : 'rgba(255,255,255,.4)'; c.lineWidth = 1.5; c.setLineDash([6, 6]); polyline(ghost, ghostOut === 0); c.stroke(); c.setLineDash([]); }
  if (trail.length > 3) { c.strokeStyle = '#22d3ee'; c.lineWidth = 2.5; polyline(trail, false); c.stroke(); }
  const [x, y, vx, vy] = craft.state(), [sx, sy] = view(x, y);
  if (craft.crashed()) {
    c.strokeStyle = '#f87171'; c.lineWidth = 3; c.beginPath(); c.moveTo(sx - 9, sy - 9); c.lineTo(sx + 9, sy + 9); c.moveTo(sx + 9, sy - 9); c.lineTo(sx - 9, sy + 9); c.stroke();
  } else {
    const v = Math.hypot(vx, vy), len = 30 + 40 * Math.min(2, v / circular_speed(Math.hypot(x, y)));
    if (v > 0) { const ux = vx / v, uy = -vy / v; c.strokeStyle = '#4ade80'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + ux * len, sy + uy * len); c.stroke();
      c.fillStyle = '#4ade80'; c.beginPath(); c.moveTo(sx + ux * (len + 8), sy + uy * (len + 8)); c.lineTo(sx + ux * len - uy * 5, sy + uy * len + ux * 5); c.lineTo(sx + ux * len + uy * 5, sy + uy * len - ux * 5); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, 6, 0, 7); c.fill();
    // gravity: a small arrow pointing to the centre
    const r = Math.hypot(x, y), gl = 14 + 26 * Math.min(1, gravity(r) / G0);
    c.strokeStyle = '#f472b6'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - x / r * gl, sy + y / r * gl); c.stroke();
  }
  c.font = '20px system-ui'; c.fillStyle = 'rgba(255,255,255,.7)';
  c.fillText('Seen from above the North Pole', 16, 28);
  c.font = '20px system-ui'; c.fillStyle = '#4ade80'; c.fillText('▬ velocity', 16, 54); c.fillStyle = '#f472b6'; c.fillText('▬ gravity', 130, 54);
  c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText('- - path ahead', 240, 54); c.fillStyle = '#22d3ee'; c.fillText('▬ path so far', 390, 54);
}

// ---------- the numbers under the picture ----------
function liveLine() {
  const [x, y, vx, vy] = craft.state(), r = Math.hypot(x, y), v = Math.hypot(vx, vy);
  $('now').innerHTML = craft.crashed() ? 'Now: on the ground.' : `Now: <b>${kms(v)}</b> (${Math.round(100 * v / circular_speed(r))}% of circle speed at this height), <b>${km(r - R)}</b> up.`;
}
function readouts() {
  liveLine();
  const [x, y, vx, vy, t] = craft.state(), r = Math.hypot(x, y), v = Math.hypot(vx, vy), el = elements(x, y, vx, vy);
  $('rAlt').textContent = km(r - R); $('rSpeed').textContent = kms(v);
  $('rCirc').textContent = kms(circular_speed(r)); $('rEsc').textContent = kms(escape_speed(r));
  $('rG').textContent = `${gravity(r).toFixed(2)} m/s² (${Math.round(100 * gravity(r) / G0)}%)`;
  $('rT').textContent = dur(t);
  const vd = $('verdict'); vd.className = '';
  if (craft.crashed()) { vd.textContent = 'It hit the Earth. Too little sideways speed to keep missing the ground. Move a slider to launch again, or press Reset.'; vd.className = 'bad'; }
  else if (gone) { vd.textContent = 'Gone for good: it escaped the Earth\'s gravity and is heading off into space.'; vd.className = 'away'; }
  else if (el[0] >= 0) { vd.textContent = `Escaping: its speed is above escape speed (${Math.round(100 * v / escape_speed(r))}% of it), so it will never come back.`; vd.className = 'away'; }
  else if (ghostOut === 1) { vd.textContent = `Falling: its orbit dips ${km(R - el[3])} into the ground, so it will crash.`; vd.className = 'bad'; }
  else if (el[4] > 384_400e3) vd.textContent = `Only just trapped: it climbs to ${km(el[4] - R)}, beyond the Moon's distance, and falls back after ${dur(el[5])}. A little more speed and it escapes.`;
  else if (el[2] < 0.01) vd.textContent = `A circle, ${km(el[1] - R)} up, once round every ${dur(el[5])}.`;
  else vd.textContent = `An ellipse: lowest ${km(el[3] - R)}, highest ${km(el[4] - R)} up, once round every ${dur(el[5])}.`;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing && !gone && !craft.crashed()) {
    // in pieces of about 1/60 of a lap, so even at top speed the path is drawn as a curve
    const step = dt * warpOf(+$('warp').value);
    let left = step;
    for (let k = 0; k < 300 && left > 0 && !craft.crashed(); k++) {
      const [x0, y0] = craft.state(), piece = Math.min(left, 0.1 * Math.sqrt(Math.hypot(x0, y0) ** 3 / 3.986004418e14));
      craft.advance(piece); left -= piece;
      const [x, y] = craft.state();
      trail.push(x, y);
      if (Math.hypot(x, y) > FAR) { gone = true; break; }
    }
    simT += step;
    if (trail.length > 6000) trail.splice(0, trail.length - 6000);
  } else if (playing && craft.crashed()) simT += dt * warpOf(+$('warp').value) * .2;   // the Earth keeps turning
  // zoom to fit what matters: the satellite, its orbit (if it comes back), and the tower
  const [x, y, vx, vy] = craft.state(), el = elements(x, y, vx, vy), r = Math.hypot(x, y);
  let want = Math.max(r, R + tower * (tower < 60e6 ? 1 : 0));
  if (el[0] < 0 && el[4] < FAR && ghostOut !== 1) want = Math.max(want, el[4]);
  want = Math.min(FAR, Math.max(1.12 * R, 1.12 * want));
  viewR += (want - viewR) * Math.min(1, dt * 2.5);
  draw(); readouts(); labels();
}

// ---------- the step-by-step figures (made from the toy's current state) ----------
function fig(id) { const f = $(id), g = f.getContext('2d'); g.clearRect(0, 0, f.width, f.height); return [g, f.width, f.height]; }
function orbitFigure(id, h0, pcts, colors, fixed) {
  const [g, w, h] = fig(id), r0 = R + h0;
  const paths = pcts.map(p => { const q = predict(0, r0, -circular_speed(r0) * p / 100, 0, 4 * R, 600); const o = { pts: q.points(), out: q.outcome() }; q.free(); return o; });
  // fit: Earth plus the closed orbits, capped
  let ext = fixed || 1.15 * r0; if (!fixed) for (const p of paths) for (let i = 0; i < p.pts.length; i += 2) ext = Math.max(ext, Math.min(3.2 * R, Math.hypot(p.pts[i], p.pts[i + 1]) * 1.05));
  const s = (Math.min(w, h) / 2 - 10) / ext, cx = w / 2, cy = h / 2, V = (x, y) => [cx + x * s, cy - y * s];
  g.fillStyle = '#1e3a8a'; g.beginPath(); g.arc(cx, cy, R * s, 0, 7); g.fill();
  paths.forEach((p, k) => { g.strokeStyle = colors[k]; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < p.pts.length; i += 2) { const [x, y] = V(p.pts[i], p.pts[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
  const [lx, ly] = V(0, r0); g.fillStyle = '#111'; g.beginPath(); g.arc(lx, ly, 4, 0, 7); g.fill();
  g.font = '12px system-ui'; pcts.forEach((p, k) => { g.fillStyle = colors[k]; g.fillText(`${p}%`, 10, 18 + 16 * k); });
}
const RAINBOW = ['#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#b45309'];
function curve(id, f, from, to, opts) {
  const [g, w, h] = fig(id), pad = 46, top = opts.top, bot = opts.bot ?? 0;
  const X = v => pad + (w - pad - 14) * (Math.log10(v) - Math.log10(from)) / (Math.log10(to) - Math.log10(from));
  const Y = v => h - 30 - (h - 50) * (v - bot) / (top - bot);
  g.strokeStyle = '#ddd'; g.lineWidth = 1; g.font = '11px system-ui'; g.fillStyle = '#888';
  for (const m of [100e3, 1e6, 10e6, 40e6].filter(m => m >= from && m <= to)) { g.beginPath(); g.moveTo(X(m), 14); g.lineTo(X(m), h - 30); g.stroke(); g.fillText(km(m), X(m) - 18, h - 12); }
  if (bot < 0) { g.strokeStyle = '#999'; g.beginPath(); g.moveTo(pad, Y(0)); g.lineTo(w - 14, Y(0)); g.stroke(); }
  for (const [fn, col] of f) { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= 200; i++) { const hh = from * Math.pow(to / from, i / 200), [x, y] = [X(hh), Y(fn(hh))]; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.fillStyle = '#666'; g.fillText(opts.unit, 6, 14); for (const v of opts.ticks) g.fillText(String(v), 6, Y(v) + 4);
  g.fillText('height (log scale) →', w - 130, h - 30 - 4);
  return { g, X, Y, h };
}
function explain() {
  const [x, y, vx, vy] = craft.state(), r = Math.hypot(x, y), v = Math.hypot(vx, vy), alt = Math.max(1e3, r - R);
  // 2: gravity with height
  { const { g, X, Y, h } = curve('ex2', [[hh => gravity(R + hh), '#2563eb']], 1e3, 60e6, { top: 10, unit: 'm/s²', ticks: [0, 5, 10] });
    g.fillStyle = '#2563eb'; g.beginPath(); g.arc(X(Math.min(60e6, alt)), Y(gravity(R + alt)), 6, 0, 7); g.fill();
    if (tower > 1e3) { g.fillStyle = '#f97316'; g.beginPath(); g.arc(X(Math.min(60e6, tower)), Y(gravity(R + tower)), 6, 0, 7); g.fill(); }
    g.fillStyle = '#333'; g.font = '13px system-ui'; g.fillText(`satellite: ${gravity(r).toFixed(2)} m/s², ${Math.round(100 * gravity(r) / G0)}% of the ground's`, 60, h - 42); }
  // 3: circle and escape speeds against height, and the satellite
  { const { g, X, Y, h } = curve('ex3', [[hh => circular_speed(R + hh) / 1000, '#16a34a'], [hh => escape_speed(R + hh) / 1000, '#dc2626']], 100e3, 60e6, { top: 12, unit: 'km/s', ticks: [0, 4, 8, 12] });
    g.fillStyle = '#2563eb'; g.beginPath(); g.arc(X(Math.min(60e6, Math.max(100e3, alt))), Y(Math.min(12, v / 1000)), 7, 0, 7); g.fill();
    g.fillStyle = '#333'; g.font = '13px system-ui'; g.fillText(`satellite: ${kms(v)} at ${km(r - R)}`, 60, h - 42); }
  // 4: different speeds from the launch height
  orbitFigure('ex4', heightOf(+$('height').value), [80, 90, 100, 110, 125, 141], RAINBOW);
  $('ex4cap').textContent = `From ${km(heightOf(+$('height').value))} up (your launch height): 80%, 90%, 100%, 110%, 125% and 141% of circle speed.`;
  // 5: energy bars
  { const [g, w, h] = fig('ex5'), ke = v * v / 2, pe = -3.986004418e14 / r, tot = ke + pe, top = Math.max(ke, -pe) * 1.1, mid = h / 2;
    const bars = [['speed energy ½v²', ke, '#16a34a'], ['well depth −GM/r', pe, '#7c3aed'], ['total', tot, tot < 0 ? '#2563eb' : '#d97706']];
    g.strokeStyle = '#999'; g.beginPath(); g.moveTo(30, mid); g.lineTo(w - 30, mid); g.stroke();
    bars.forEach(([name, val, col], i) => { const bx = 70 + i * 170, bh = (h / 2 - 30) * val / top; g.fillStyle = col; g.fillRect(bx, Math.min(mid, mid - bh), 90, Math.abs(bh));
      g.fillStyle = '#333'; g.font = '13px system-ui'; g.fillText(name, bx - 6, val >= 0 ? mid + 18 : mid - 8); g.fillText(`${(val / 1e6).toFixed(1)} MJ/kg`, bx + 6, val >= 0 ? mid - bh - 6 : mid - bh + 16); });
    g.font = 'bold 13px system-ui'; g.fillStyle = tot < 0 ? '#2563eb' : '#b45309';
    g.fillText(tot < 0 ? 'Total below zero: trapped, it orbits.' : 'Total zero or more: it escapes.', 30, 20); }
}
// 1: Newton's cannon (fixed)
orbitFigure('ex1', 600e3, [50, 70, 85, 95, 100, 130], RAINBOW, 1.5 * R);

// ---------- Try this ----------
const TRY = {
  speedup: () => { reset(); setTimeout(() => { for (let i = 0; i < 3; i++) craft.burn(dv()); foresee(); explain(); }, 50); },
  escape: () => { $('height').value = heightSlider(400e3); $('speed').value = 142; $('aim').value = 0; launch(); $('warp').value = 3.3; labels(); },
  crash: () => { $('height').value = heightSlider(400e3); $('speed').value = 80; $('aim').value = 0; launch(); },
};
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => { TRY[b.dataset.try]?.(); playing = true; $('playBtn').textContent = 'Pause'; $('play').scrollIntoView({ behavior: 'smooth' }); });

reset();
requestAnimationFrame(frame);
window.__orbits = { readouts, get craft() { return craft; }, get ghostOut() { return ghostOut; }, get tower() { return tower; }, reset, launch };

// Together (together/share.js): where the satellite is and how it moves, and the clock
share(() => ({ c: Array.from(craft.state()), t: simT }), s => {
  const c = nums(s?.c, 4); if (!c || c.length !== 4 || !Number.isFinite(s.t)) return;
  simT = s.t; setCraft(...c);
});
