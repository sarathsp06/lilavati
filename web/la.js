// Shared drawing for the linear algebra pages: a coordinate plane on a canvas, the grid as a matrix
// moves it, arrows, shapes and points you can drag, and a 2×2 matrix you can type into.
// A matrix is [a, b, c, d] = [[a, b], [c, d]]; its columns (a, c) and (b, d) are where the arrows
// î = (1, 0) and ĵ = (0, 1) land.
export const COL = { i: '#16a34a', j: '#dc2626', v: '#f59e0b', w: '#7c3aed', grid: 'rgba(37,99,235,.38)', old: 'rgba(0,0,0,.07)', ink: '#1c1917', blue: '#2563eb' };
export const I2 = [1, 0, 0, 1];
export const apply = (m, x, y) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
export const det = m => m[0] * m[3] - m[1] * m[2];
export const mul = (p, q) => [p[0] * q[0] + p[1] * q[2], p[0] * q[1] + p[1] * q[3], p[2] * q[0] + p[3] * q[2], p[2] * q[1] + p[3] * q[3]];
export const rot = t => [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t)];
// from "nothing happens" (t = 0) to the full move (t = 1)
export const lerpM = (m, t) => [1 + (m[0] - 1) * t, m[1] * t, m[2] * t, 1 + (m[3] - 1) * t];
export const fmt = (v, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
export const vec = (x, y, d = 2) => `(${fmt(x, d)}, ${fmt(y, d)})`;

// an asymmetric little shape (a flag on a pole) so turns and mirror images are easy to see
export const FLAG = [0, 0, 0, 2, 1.3, 1.6, 0.25, 1.25, 0.25, 0];

export class Plane {
  // the plane fills the canvas, or a square region of it (box = [left, top, size]) for side-by-side figures
  constructor(canvas, range = 4, box) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.range = range; this.handles = []; this.drag = -1;
    this.box = box || [0, 0, Math.min(canvas.width, canvas.height)];
  }
  listen() {
    if (this.listening) return; this.listening = true;
    const canvas = this.cv;
    const near = e => { const [x, y] = this.world(e), tol = 22 * this.cv.width / this.cv.getBoundingClientRect().width / this.s;
      let best = -1, bd = tol; this.handles.forEach((h, k) => { const [hx, hy] = h.get(), d = Math.hypot(hx - x, hy - y); if (d < bd) { bd = d; best = k; } }); return best; };
    canvas.addEventListener('pointerdown', e => { const k = near(e); if (k < 0) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); this.drag = k; this.move(e); });
    canvas.addEventListener('pointermove', e => { if (this.drag >= 0) this.move(e); else canvas.style.cursor = near(e) >= 0 ? 'grab' : 'default'; });
    const end = () => { if (this.drag >= 0) { const h = this.handles[this.drag]; this.drag = -1; h.end?.(); } };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  }
  move(e) {
    const r = this.range, snap = v => Math.max(-r, Math.min(r, Math.round(v * 10) / 10));
    const [x, y] = this.world(e); this.handles[this.drag].set(snap(x), snap(y));
  }
  // drag a point: get() returns [x, y], set(x, y) moves it (snapped to tenths)
  handle(get, set, end) { this.listen(); this.handles.push({ get, set, end }); return this; }
  get s() { return this.box[2] / (2 * this.range); }
  P(x, y) { const [l, t, w] = this.box; return [l + w / 2 + x * this.s, t + w / 2 - y * this.s]; }
  world(e) { const b = this.cv.getBoundingClientRect(), px = (e.clientX - b.left) * this.cv.width / b.width, py = (e.clientY - b.top) * this.cv.height / b.height;
    const [l, t, w] = this.box; return [(px - l - w / 2) / this.s, (t + w / 2 - py) / this.s]; }
  clear(bg = '#fff') { const { c } = this, [l, t, w] = this.box; c.fillStyle = bg; c.fillRect(l, t, w, w); return this; }
  // keep drawing inside this plane's square until done()
  clip() { const { c } = this, [l, t, w] = this.box; c.save(); c.beginPath(); c.rect(l, t, w, w); c.clip(); return this; }
  done() { this.c.restore(); return this; }
  title(str, color = '#333') { const [l, t] = this.box; return this.text(str, l + 10, t + 26, color, 20); }
  // the grid lines x = k and y = k after the move m (m = I2: the plain grid)
  grid(m = I2, color = COL.grid, width = 1.4) {
    const n = Math.ceil(this.range * 4), { c } = this; c.strokeStyle = color; c.lineWidth = width; c.beginPath();
    for (let k = -n; k <= n; k++) for (const [x0, y0, x1, y1] of [[k, -n, k, n], [-n, k, n, k]]) {
      const [a, b] = this.P(...apply(m, x0, y0)), [p, q] = this.P(...apply(m, x1, y1)); c.moveTo(a, b); c.lineTo(p, q);
    }
    c.stroke(); return this;
  }
  axes(color = 'rgba(0,0,0,.35)') { const r = this.range; this.line(-r, 0, r, 0, color, 1.5); this.line(0, -r, 0, r, color, 1.5); return this; }
  line(x1, y1, x2, y2, color, width = 2, dash) {
    const { c } = this; c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []); c.beginPath();
    c.moveTo(...this.P(x1, y1)); c.lineTo(...this.P(x2, y2)); c.stroke(); c.setLineDash([]); return this;
  }
  // a whole line through the origin along (x, y)
  through(x, y, color, width = 2, dash) { const n = Math.hypot(x, y) || 1, k = 3 * this.range / n; return this.line(-x * k, -y * k, x * k, y * k, color, width, dash); }
  arrow(x, y, color, { from = [0, 0], width = 3.5, label, head = 13 } = {}) {
    const { c } = this, [ax, ay] = this.P(...from), [bx, by] = this.P(from[0] + x, from[1] + y), L = Math.hypot(bx - ax, by - ay);
    c.strokeStyle = c.fillStyle = color; c.lineWidth = width; c.lineCap = 'round';
    if (L > 1) {
      const ux = (bx - ax) / L, uy = (by - ay) / L, h = Math.min(head, L * 0.6);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx - ux * h * 0.7, by - uy * h * 0.7); c.stroke();
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - ux * h - uy * h * 0.5, by - uy * h + ux * h * 0.5); c.lineTo(bx - ux * h + uy * h * 0.5, by - uy * h - ux * h * 0.5); c.fill();
    }
    if (label) this.label(label, from[0] + x, from[1] + y, color);
    return this;
  }
  // text stays readable however small the canvas is shown (on a phone 800 px becomes about 320)
  get zoom() { const w = this.cv.getBoundingClientRect().width; return w ? Math.max(1, Math.min(2.2, 0.8 * this.cv.width / w)) : 1; }
  label(text, x, y, color, size = 22) {
    size *= this.zoom;
    const { c } = this, [px, py] = this.P(x, y); c.font = `600 ${size}px system-ui`; c.fillStyle = color;
    c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.85)'; c.strokeText(text, px + 8, py - 8); c.fillText(text, px + 8, py - 8); return this;
  }
  dot(x, y, r = 6, color = COL.ink) { const { c } = this; c.fillStyle = color; c.beginPath(); c.arc(...this.P(x, y), r, 0, 7); c.fill(); return this; }
  ring(x, y, r = 10, color = COL.ink) { const { c } = this; c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.arc(...this.P(x, y), r, 0, 7); c.stroke(); return this; }
  // a polygon [x0, y0, x1, y1, ...], moved by m
  poly(pts, m = I2, fill, stroke, width = 2.5) {
    const { c } = this; c.beginPath();
    for (let i = 0; i < pts.length; i += 2) { const [x, y] = this.P(...apply(m, pts[i], pts[i + 1])); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } return this;
  }
  // the unit circle, moved by m (an ellipse)
  circle(m = I2, fill, stroke, width = 2.5) {
    const pts = []; for (let k = 0; k < 96; k++) { const t = 2 * Math.PI * k / 96; pts.push(Math.cos(t), Math.sin(t)); }
    return this.poly(pts, m, fill, stroke, width);
  }
  text(str, px, py, color = '#333', size = 20) { const { c } = this; c.font = `${size}px system-ui`; c.fillStyle = color; c.fillText(str, px, py); return this; }
}

// four number boxes shaped like a matrix; returns a function that shows a matrix in them
export function matrixInputs(el, onChange) {
  el.classList.add('matrix');
  const ins = [0, 1, 2, 3].map(k => {
    const i = Object.assign(document.createElement('input'), { type: 'number', step: '0.1', className: k % 2 ? 'cj' : 'ci' });
    i.setAttribute('aria-label', ['top left', 'top right', 'bottom left', 'bottom right'][k]);
    i.addEventListener('input', () => onChange(ins.map(x => +x.value || 0)));
    el.append(i); return i;
  });
  return m => ins.forEach((inp, k) => { if (document.activeElement !== inp) inp.value = +fmt(m[k], 2); });
}

// a dropdown of named matrices
export function presetSelect(sel, list, pick) {
  list.forEach(([name], k) => sel.append(new Option(name, k)));
  sel.append(Object.assign(new Option('Your own', 'own'), { disabled: true }));
  sel.addEventListener('change', () => { if (sel.value !== 'own') pick(list[+sel.value][1], +sel.value); });
  return { own() { sel.value = 'own'; }, set(k) { sel.value = k; } };
}

export const MATRICES = [
  ['Do nothing (identity)', [1, 0, 0, 1]],
  ['Turn a quarter', [0, -1, 1, 0]],
  ['Turn 30°', rot(Math.PI / 6).map(v => +v.toFixed(3))],
  ['Make twice as big', [2, 0, 0, 2]],
  ['Stretch sideways (diagonal)', [2, 0, 0, 0.5]],
  ['Shear', [1, 1, 0, 1]],
  ['Mirror (orthogonal)', [-1, 0, 0, 1]],
  ['Symmetric', [2, 1, 1, 2]],
  ['Squash onto a line', [1, 2, 0.5, 1]],
  ['A bit of everything', [1.5, 0.6, -0.4, 1.1]],
];

// The matrix every matrix page plays with: drag the tips of î and ĵ, type into the boxes (#mx), pick
// a preset (#presets), slide or play the move (#morph, #tVal, #playMove). change() redraws.
// state.m is the matrix, state.t how far the move has gone (0 nothing, 1 all), state.mt the blend.
export function matrixToy(P, { presets = MATRICES, start = 9, change }) {
  const $ = id => document.getElementById(id);
  const st = { m: [...presets[start][1]], t: 1, get mt() { return lerpM(this.m, this.t); } };
  let anim = null;
  const show = matrixInputs($('mx'), m => { st.m = m; st.t = 1; pick.own(); update(); });
  const pick = $('presets') ? presetSelect($('presets'), presets, m => { st.m = [...m]; update(); }) : { own() {}, set() {} };
  pick.set(start);
  function update() {
    show(st.m);
    if ($('morph')) { $('morph').value = st.t; $('tVal').textContent = `${Math.round(st.t * 100)}%`; }
    change(st);
  }
  st.set = (m, k) => { st.m = [...m]; st.t = 1; if (k === undefined) pick.own(); else pick.set(k); update(); };
  st.update = update;
  P.handle(() => apply(st.mt, 1, 0), (x, y) => { st.m[0] = x; st.m[2] = y; st.t = 1; pick.own(); update(); })
   .handle(() => apply(st.mt, 0, 1), (x, y) => { st.m[1] = x; st.m[3] = y; st.t = 1; pick.own(); update(); });
  $('morph')?.addEventListener('input', e => { st.t = +e.target.value; update(); });
  st.play = () => {
    if (anim) cancelAnimationFrame(anim);
    const t0 = performance.now(), go = now => { const k = Math.min(1, (now - t0) / 1600); st.t = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2; update(); if (k < 1) anim = requestAnimationFrame(go); };
    anim = requestAnimationFrame(go);
  };
  $('playMove')?.addEventListener('click', st.play);
  return st;
}
// the basic arrows after a move, with labels
export function basis(P, m, labels = true) {
  const [ix, iy] = apply(m, 1, 0), [jx, jy] = apply(m, 0, 1);
  P.arrow(ix, iy, COL.i, { label: labels ? 'î' : '' }).arrow(jx, jy, COL.j, { label: labels ? 'ĵ' : '' });
  P.dot(ix, iy, 7, COL.i).dot(jx, jy, 7, COL.j);
}
export function figPlane(id, range = 4, box) { const cv = document.getElementById(id); const p = new Plane(cv, range, box || [(cv.width - cv.height) / 2, 0, cv.height]); return p; }
export function clearFig(id) { const cv = document.getElementById(id); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return cv; }
// n square panels side by side across a figure canvas
export function panels(id, n, range = 3.2) {
  const cv = clearFig(id), w = Math.min(cv.width / n, cv.height);
  return Array.from({ length: n }, (_, k) => new Plane(cv, range, [k * cv.width / n + (cv.width / n - w) / 2, (cv.height - w) / 2, w]));
}
