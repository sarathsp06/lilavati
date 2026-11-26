// The topology page's 3D rubber: the flat sheet of squares (src/topology.rs) made thick, drawn as a shaded
// surface on a plain 2D canvas (painter's algorithm: the little four-sided pieces are sorted far to near).
// Every square of the sheet is split into smaller pieces for a smooth picture; the sheet's own dots and
// edges are drawn on the front of the rubber, so the mesh that is counted is the mesh you see.
// Used by app.js (all four shapes) and preview.js (the home card's doughnut and mug).
const TAU = 2 * Math.PI;
const clamp01 = x => Math.max(0, Math.min(1, x));
export const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- the one-hole sheet: a ring, then a doughnut, then a mug ----------
// the one-hole sheet of src/topology.rs: 8 × 6 squares, the hole in squares 5–6 across and 1–4 down
export const ONE = { cols: 8, rows: 6, hole: [5, 1, 7, 5] };
// the same map as ring() in src/topology.rs: [angle round the hole (anticlockwise, 0 = right), share of the
// way from the hole's edge (0) to the outside edge (1)]
export function ringUS(x, y, { cols, rows, hole } = ONE) {
  const hx = (hole[0] + hole[2]) / 2, hy = (hole[1] + hole[3]) / 2, dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy);
  if (d < 1e-12) return [0, 0];
  const cx = dx / d, cy = dy / d;
  const hit = (x0, x1, y0, y1) => Math.min(Math.abs(cx) > 1e-12 ? ((cx > 0 ? x1 : x0) - hx) / cx : Infinity, Math.abs(cy) > 1e-12 ? ((cy > 0 ? y1 : y0) - hy) / cy : Infinity);
  const din = hit(hole[0], hole[2], hole[1], hole[3]), dout = hit(0, cols, 0, rows);
  return [-Math.atan2(cy, cx), clamp01((d - din) / (dout - din))];
}

// World units: x to the right, y away from you (the front of the rubber faces −y), z up.
// The doughnut stands up facing you; its tube's middle circle has radius R0 and the tube radius r0, so seen
// from the front it covers the flat ring of src/topology.rs (radius 0.42 to 1.05) exactly.
const R0 = 0.735, r0 = 0.315;
const UJ = 1.92;                  // the handle is the part of the ring with angle −UJ < u < UJ (the thin right side)
const XC = -0.3;                  // the cup's axis
const AA = 0.5 * Math.PI, AB = 0.29 * Math.PI;   // where the handle joins the body (angles up from its bottom)

// the cup, as a curve from the middle of its base, out, up the outside, over the lip, down the inside and
// across the floor to the middle: [r, z] at a = 0 … π (pieces: [start of a / π, the piece])
const line = (p, q) => k => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const arc = (cx, cz, rad, b0, b1) => k => { const b = lerp(b0, b1, k); return [cx + rad * Math.cos(b), cz + rad * Math.sin(b)]; };
const CUP = (() => {
  const Rc = 0.62, w = 0.1, zb = -0.72, zt = 0.73, c = 0.12, ci = 0.08, zf = zb + 0.14;
  return [[0, line([0, zb], [Rc - c, zb])], [0.13, arc(Rc - c, zb + c, c, -Math.PI / 2, 0)], [0.21, line([Rc, zb + c], [Rc, zt])], 
    [0.58, arc(Rc - w / 2, zt, w / 2, 0, Math.PI)], [0.73, line([Rc - w, zt], [Rc - w, zf + ci])],
    [0.86, arc(Rc - w - ci, zf + ci, ci, 0, -Math.PI / 2)], [0.9, line([Rc - w - ci, zf], [0, zf])], [1, null]];
})();
function cup(a) {
  const f = clamp01(a / Math.PI);
  for (let i = 0; i < CUP.length - 1; i++) if (f <= CUP[i + 1][0] || i === CUP.length - 2) return CUP[i][1]((f - CUP[i][0]) / (CUP[i + 1][0] - CUP[i][0]));
}
// the swollen lump half way: a rounded block with the handle's joints at about the cup's heights
const BK = [[0, 0], [AB, 0.413 * Math.PI], [AA, 0.666 * Math.PI], [Math.PI, Math.PI]];
function lump(a) {
  let i = 0; while (i < BK.length - 2 && a > BK[i + 1][0]) i++;
  const p = lerp(BK[i][1], BK[i + 1][1], (a - BK[i][0]) / (BK[i + 1][0] - BK[i][0]));
  const s = Math.sin(p), c = Math.cos(p);
  return [0.68 * Math.pow(Math.abs(s), 0.75), -0.75 * Math.sign(c) * Math.pow(Math.abs(c), 0.75)];
}

// The doughnut ↔ mug surface at morph t, as a function of the ring's angle u and the angle v round its
// tube (v = 0 on the outside edge, π on the hole's edge, 0 < v < π on the front).
// The mug's body is a ball whose circles of "latitude" ring the two places where the handle joins it
// (circles on a sphere at a fixed ratio of distances to two points), so each circle round the doughnut's
// tube becomes one of them; then the top of the ball is pushed in to make the cup.
export class DoughnutMug {
  constructor() { this.set(0); }
  set(t) {
    this.e = smooth(t / 0.6);                          // doughnut → lump with a handle
    const l = this.l = smooth((t - 0.35) / 0.65);      // the dent deepens into the cup; the handle thins
    this.rh = lerp(0.2, 0.095, l);
    this.kA = lerp(0.26, 0.13, l);
    this.L = lerp(0.85, 0.74, l);
    const sp = a => [Math.sin(a), 0, -Math.cos(a)];
    this.a = sp(AA); this.b = sp(AB);
    const cen = k => { let x = 0, y = 0, z = 0; for (let i = 0; i < 24; i++) { const p = this.body(k, TAU * i / 24); x += p[0]; y += p[1]; z += p[2]; } return [x / 24, y / 24, z / 24]; };
    this.cA = cen(this.kA); this.cB = cen(1 / this.kA);
    return this;
  }
  // the body: k is the ratio of distances to the upper and lower joints (on the unit ball), v the angle round
  body(k, v) {
    const { a, b } = this, k2 = k * k;
    const nx = a[0] - k2 * b[0], nz = a[2] - k2 * b[2], nl = Math.hypot(nx, nz), ux = nx / nl, uz = nz / nl;
    const d = (1 - k2) / nl, rho = Math.sqrt(Math.max(0, 1 - d * d)), cv = Math.cos(v), sv = Math.sin(v);
    const px = d * ux - rho * cv * uz, py = -rho * sv, pz = d * uz + rho * cv * ux;
    const al = Math.acos(Math.max(-1, Math.min(1, -pz))), th = Math.atan2(py, px);
    const c = cup(al), m = lump(al), r = lerp(m[0], c[0], this.l), z = lerp(m[1], c[1], this.l);
    this.ao = 1 - this.l * (0.12 * smooth((al / Math.PI - 0.64) / 0.06) + 0.25 * smooth((al / Math.PI - 0.74) / 0.2));   // darker inside the cup
    return [XC + r * Math.cos(th), r * Math.sin(th), z];
  }
  // the handle: s from the lower joint (0) to the upper joint (1)
  handle(s, v) {
    const { cA, cB, L } = this, q = 1 - s;
    const P0 = cB, P1 = [cB[0] + L, 0, cB[2] - 0.08], P2 = [cA[0] + L, 0, cA[2] + 0.08], P3 = cA;
    const B = j => q * q * q * P0[j] + 3 * q * q * s * P1[j] + 3 * q * s * s * P2[j] + s * s * s * P3[j];
    const D = j => 3 * q * q * (P1[j] - P0[j]) + 6 * q * s * (P2[j] - P1[j]) + 3 * s * s * (P3[j] - P2[j]);
    let tx = D(0), tz = D(2); const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const cv = Math.cos(v), sv = Math.sin(v), rh = this.rh;
    const ring = [rh * cv * tz, -rh * sv, -rh * cv * tx];                     // round the tube, outward first
    const w = smooth(s / 0.22) * smooth((1 - s) / 0.22);                       // near a joint, follow the body's circle
    const top = s > 0.5, J = top ? this.body(this.kA, v) : this.body(1 / this.kA, v), C = top ? cA : cB;
    this.ao = 1;
    return [0, 1, 2].map(j => B(j) + lerp(J[j] - C[j], ring[j], w));
  }
  mug(u, v) {
    if (u < -UJ) u += TAU;
    if (u <= UJ) return this.handle((u + UJ) / (2 * UJ), v);
    const beta = (u - UJ) / (TAU - 2 * UJ);
    return this.body(Math.pow(this.kA, 1 - 2 * beta), v);
  }
  at(u, v) {
    this.ao = 1;
    const cv = Math.cos(v), x = (R0 + r0 * cv) * Math.cos(u), y = -r0 * Math.sin(v), z = (R0 + r0 * cv) * Math.sin(u);
    if (this.e <= 0) return [x, y, z];
    const m = this.mug(u, v), e = this.e; this.ao = lerp(1, this.ao, e);
    return [lerp(x, m[0], e), lerp(y, m[1], e), lerp(z, m[2], e)];
  }
}

// ---------- the mesh: each square of the sheet split into smaller pieces, front and back ----------
// The distance from a grid point to the nearest of some edges (segments [x0, y0, x1, y1] in grid units), and a
// smoothly changing direction away from them (so points can be gathered towards the edge without tearing).
function away(px, py, segs, D) {
  let best = Infinity; const ds = [], dirs = [];
  for (const [x0, y0, x1, y1] of segs) {
    const ex = x1 - x0, ey = y1 - y0, k = clamp01(((px - x0) * ex + (py - y0) * ey) / (ex * ex + ey * ey || 1));
    const qx = px - (x0 + k * ex), qy = py - (y0 + k * ey), d = Math.hypot(qx, qy);
    ds.push(d); dirs.push(d > 1e-12 ? [qx / d, qy / d] : [0, 0]); if (d < best) best = d;
  }
  if (!segs.length) return [Infinity, 0, 0];
  let sx = 0, sy = 0, sw = 0; const sharp = 10 / D;
  ds.forEach((d, i) => { const w = Math.exp(-sharp * (d - best)); sx += w * dirs[i][0]; sy += w * dirs[i][1]; sw += w; });
  return [best, sx / sw, sy / sw];
}

// faces: 4 vertex ids per square (the sheet's order); grid: grid position of each id; ncol / nrow: how many
// pieces each column / row of squares is split into; segs: the edges the rubber is pinched shut along (its
// rim), with the rounding width D (grid units). Returns the mesh: fine points (gathered towards those edges
// so the rounded rim gets enough pieces) with their pinch g (0 on the edge, 1 from D in), and the pieces.
export function buildMesh({ faces, grid, ncol, nrow, segs = [], D = 0.5 }) {
  const key = new Map(), gp = [], gq = [], g = [], dist = [], cid = [], wts = [], quads = [], sides = [], dots = [];
  const edgeN = new Map();
  for (let f = 0; f < faces.length; f += 4) for (let k = 0; k < 4; k++) {
    const a = faces[f + k], b = faces[f + (k + 1) % 4], e = a < b ? a * 65536 + b : b * 65536 + a; edgeN.set(e, (edgeN.get(e) || 0) + 1);
  }
  const outline = (a, b) => edgeN.get(a < b ? a * 65536 + b : b * 65536 + a) === 1;
  const point = (x, y, ids, w) => {
    const kk = Math.round(x * 4096) * 1e6 + Math.round(y * 4096);
    let i = key.get(kk); if (i !== undefined) return i;
    i = gp.length / 2; key.set(kk, i); gp.push(x, y);
    const [d, dx, dy] = away(x, y, segs, D), ph = Math.PI / 2 * Math.min(1, d / D);
    const pull = d < D ? d - D * (1 - Math.cos(ph)) : 0;
    gq.push(x - dx * pull, y - dy * pull); g.push(Math.sin(ph)); dist.push(d); cid.push(...ids); wts.push(...w);
    return i;
  };
  for (let f = 0; f < faces.length; f += 4) {
    const ids = [faces[f], faces[f + 1], faces[f + 2], faces[f + 3]], P = ids.map(i => [grid[2 * i], grid[2 * i + 1]]);
    const cx = Math.floor(P[0][0] + 1e-9), cy = Math.floor(P[0][1] + 1e-9), n = ncol[cx] || 2, m = nrow[cy] || 2;
    const idx = [];
    for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) {
      const a = i / n, b = j / m, w = [(1 - a) * (1 - b), a * (1 - b), a * b, (1 - a) * b];
      idx.push(point(w[0] * P[0][0] + w[1] * P[1][0] + w[2] * P[2][0] + w[3] * P[3][0], w[0] * P[0][1] + w[1] * P[1][1] + w[2] * P[2][1] + w[3] * P[3][1], ids, w));
    }
    const o = [outline(ids[0], ids[1]), outline(ids[1], ids[2]), outline(ids[2], ids[3]), outline(ids[3], ids[0])];
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      quads.push(idx[j * (n + 1) + i], idx[j * (n + 1) + i + 1], idx[(j + 1) * (n + 1) + i + 1], idx[(j + 1) * (n + 1) + i]);
      // which sides of this piece lie on an edge of the sheet (bit k: from corner k to k + 1), which of those
      // are on the outline, and which corners are dots of the sheet
      let s = 0, ol = 0, dt = 0;
      if (j === 0) { s |= 1; if (o[0]) ol |= 1; }
      if (i === n - 1) { s |= 2; if (o[1]) ol |= 2; }
      if (j === m - 1) { s |= 4; if (o[2]) ol |= 4; }
      if (i === 0) { s |= 8; if (o[3]) ol |= 8; }
      if (i === 0 && j === 0) dt |= 1; if (i === n - 1 && j === 0) dt |= 2; if (i === n - 1 && j === m - 1) dt |= 4; if (i === 0 && j === m - 1) dt |= 8;
      sides.push(s | ol << 4); dots.push(dt);
    }
  }
  const nv = gp.length / 2, rim = new Uint8Array(nv);
  for (let q = 0; q < sides.length; q++) for (let k = 0; k < 4; k++) if (sides[q] >> (4 + k) & 1) { rim[quads[4 * q + k]] = 1; rim[quads[4 * q + (k + 1) % 4]] = 1; }
  return { nv, rim, dist: Float64Array.from(dist), gp: Float64Array.from(gp), gq: Float64Array.from(gq), g: Float64Array.from(g), cid: Uint32Array.from(cid), wts: Float64Array.from(wts),
    quads: Int32Array.from(quads), sides: Uint8Array.from(sides), dots: Uint8Array.from(dots) };
}

// How thick the rubber is at each point (grid units, each side), for a sheet puffed up like a balloon: solve
// −∇²h = 1 on the fine mesh with h = 0 on the outline, then the thickness is √(2·h), so a strip of width w
// gets a round tube of radius w / 2 and wide parts get fatter. Points that were gathered towards the edge
// (buildMesh) take the thickness of where they landed (h grows in step with the distance to the edge there).
export function inflate(mesh, step, D) {
  const { nv, quads, rim, dist } = mesh, nb = Array.from({ length: nv }, () => new Set());
  for (let q = 0; q < quads.length; q += 4) for (let k = 0; k < 4; k++) { const a = quads[q + k], b = quads[q + (k + 1) % 4]; nb[a].add(b); nb[b].add(a); }
  const N = nb.map(s => Int32Array.from(s)), h = new Float64Array(nv), s2 = step * step;
  for (let it = 0; it < 400; it++) {
    let ch = 0;
    for (let i = 0; i < nv; i++) {
      if (rim[i]) continue;
      const n = N[i]; let sum = 0; for (let j = 0; j < n.length; j++) sum += h[n[j]];
      const v = (sum + s2 * n.length / 4) / n.length, nw = h[i] + 1.85 * (v - h[i]);
      ch = Math.max(ch, Math.abs(nw - h[i])); h[i] = nw;
    }
    if (ch < 1e-7) break;
  }
  const out = new Float64Array(nv);
  for (let i = 0; i < nv; i++) {
    const d = dist[i], ph = Math.PI / 2 * Math.min(1, d / D), dd = d < D ? D * (1 - Math.cos(ph)) : d;
    out[i] = Math.sqrt(Math.max(0, 2 * h[i] * (d > 1e-12 ? dd / d : 0)));
  }
  return out;
}

// The edges of a sheet with exactly one square (its outline), as grid segments.
export function outlineSegs(faces, grid) {
  const m = new Map();
  for (let f = 0; f < faces.length; f += 4) for (let k = 0; k < 4; k++) {
    const a = faces[f + k], b = faces[f + (k + 1) % 4], e = a < b ? a * 65536 + b : b * 65536 + a;
    const v = m.get(e); if (v) v.n++; else m.set(e, { a, b, n: 1 });
  }
  return [...m.values()].filter(e => e.n === 1).map(({ a, b }) => [grid[2 * a], grid[2 * a + 1], grid[2 * b], grid[2 * b + 1]]);
}

// Where each point of the one-hole sheet's mesh sits on the doughnut: [u, v] per point (u round the ring,
// v round the tube, the front skin's v from 0 on the outside edge to π on the hole's edge). The ring map
// bends sharply along the lines to the hole's corners; a few rounds of averaging each point with its
// neighbours (the outline stays put) smooth those bends away, so the doughnut shows no creases.
export function doughnutUV(mesh, rounds = 60) {
  const { nv, quads, rim, gq } = mesh, C = new Float64Array(nv), Sn = new Float64Array(nv), Q = new Float64Array(nv), nb = Array.from({ length: nv }, () => new Set());
  for (let i = 0; i < nv; i++) { const [u, s] = ringUS(gq[2 * i], gq[2 * i + 1]); C[i] = Math.cos(u); Sn[i] = Math.sin(u); Q[i] = s; }
  for (let q = 0; q < quads.length; q += 4) for (let k = 0; k < 4; k++) { const a = quads[q + k], b = quads[q + (k + 1) % 4]; nb[a].add(b); nb[b].add(a); }
  const N = nb.map(x => [...x]);
  for (let it = 0; it < rounds; it++) for (let i = 0; i < nv; i++) {
    if (rim[i]) continue;
    let c = 0, sn = 0, q = 0; for (const j of N[i]) { c += C[j]; sn += Sn[j]; q += Q[j]; }
    const l = Math.hypot(c, sn) || 1; C[i] = c / l; Sn[i] = sn / l; Q[i] = q / N[i].length;
  }
  const uv = new Float64Array(2 * nv);
  for (let i = 0; i < nv; i++) { uv[2 * i] = Math.atan2(Sn[i], C[i]); uv[2 * i + 1] = Math.PI * (1 - Q[i]); }
  return uv;
}

// ---------- drawing ----------
// view: { yaw, pitch, S (pixels per unit), cx, cy (screen centre), dist (camera distance, units) }
export function project(view) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  return (x, y, z) => {
    const X = x * cy - y * sy, Y0 = x * sy + y * cy, Y = z * cp + Y0 * sp, Z = Y0 * cp - z * sp;
    return [X, Y, Z];
  };
}

// The surface area and the volume inside a closed mesh, and the length of the sheet's outline on the front.
export function measure3d(pos, mesh) {
  const { nv, quads, sides } = mesh;
  let area = 0, vol = 0, edge = 0;
  const P = i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  const tri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += Math.hypot(nx, ny, nz) / 2; vol += (a[0] * nx + a[1] * ny + a[2] * nz) / 6;
  };
  for (let q = 0; q < quads.length; q += 4) for (const off of [0, nv]) {
    const [a, b, c, d] = [0, 1, 2, 3].map(k => P(quads[q + k] + off));
    if (off) { tri(a, c, b); tri(a, d, c); } else { tri(a, b, c); tri(a, c, d); }
    if (!off) { const s = sides[q / 4] >> 4; for (let k = 0; k < 4; k++) if (s >> k & 1) { const p = P(quads[q + k]), r = P(quads[q + (k + 1) % 4]); edge += Math.hypot(r[0] - p[0], r[1] - p[1], r[2] - p[2]); } }
  }
  return { area, volume: Math.abs(vol), edge };
}

// Draw the mesh at world positions pos (3 numbers per point: the nv front points, then the nv back points).
// o: { lines, dots, base: [r, g, b], lw (line width), shadow }
export function draw(c, pos, mesh, view, o = {}) {
  const { nv, quads, sides, dots } = mesh, N = 2 * nv, rot = project(view);
  const X = new Float64Array(N), Y = new Float64Array(N), Z = new Float64Array(N), sx = new Float64Array(N), sy = new Float64Array(N);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zmin = Infinity;
  for (let i = 0; i < N; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2], [a, b, d] = rot(x, y, z);
    X[i] = a; Y[i] = b; Z[i] = d; const f = view.dist / (view.dist + d);
    sx[i] = view.cx + view.S * f * a; sy[i] = view.cy - view.S * f * b;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < zmin) zmin = z;
  }
  // a soft shadow on the ground under it
  if (o.shadow !== false && zmin < Infinity) {
    const g = (x, y) => { const [a, b, d] = rot(x, y, zmin - 0.06), f = view.dist / (view.dist + d); return [view.cx + view.S * f * a, view.cy - view.S * f * b]; };
    const C = g((x0 + x1) / 2, (y0 + y1) / 2), A = g(x1 + 0.1, (y0 + y1) / 2), B = g((x0 + x1) / 2, y1 + 0.1);
    const ax = A[0] - C[0], ay = A[1] - C[1], bx = B[0] - C[0], by = B[1] - C[1];
    c.save(); c.setTransform(c.getTransform().multiply(new DOMMatrix([ax, ay, bx, by, C[0], C[1]])));
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(20,40,30,.22)'); gr.addColorStop(1, 'rgba(20,40,30,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
  }
  // the pieces that face you, far ones first
  const nq = quads.length / 4, list = [];
  const L = [-0.45, 0.62, -0.64], Ll = Math.hypot(...L); L[0] /= Ll; L[1] /= Ll; L[2] /= Ll;
  const H = [L[0], L[1], L[2] - 1], Hl = Math.hypot(...H); H[0] /= Hl; H[1] /= Hl; H[2] /= Hl;
  const shade = new Float32Array(2 * nq), spec = new Float32Array(2 * nq), depth = new Float32Array(2 * nq);
  for (let side = 0; side < 2; side++) for (let q = 0; q < nq; q++) {
    const off = side * nv; let a = quads[4 * q] + off, b = quads[4 * q + 1] + off, cc = quads[4 * q + 2] + off, d = quads[4 * q + 3] + off;
    const ux = X[cc] - X[a], uy = Y[cc] - Y[a], uz = Z[cc] - Z[a], vx = X[d] - X[b], vy = Y[d] - Y[b], vz = Z[d] - Z[b];
    // outward normal: the front's pieces run the other way round from the back's
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (side === 1) { nx = -nx; ny = -ny; nz = -nz; }
    const mx = (X[a] + X[b] + X[cc] + X[d]) / 4, my = (Y[a] + Y[b] + Y[cc] + Y[d]) / 4, mz = (Z[a] + Z[b] + Z[cc] + Z[d]) / 4;
    // facing away? (which way round its corners go on screen, so the test is exact for each piece)
    const wind = (sx[cc] - sx[a]) * (sy[d] - sy[b]) - (sy[cc] - sy[a]) * (sx[d] - sx[b]);
    if ((side ? -wind : wind) <= 0) continue;
    const nl = Math.hypot(nx, ny, nz); if (nl < 1e-12) continue;
    nx /= nl; ny /= nl; nz /= nl;
    const k = side * nq + q, dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), sp = Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), 18);
    const rim = Math.pow(1 - Math.abs(nz), 3) * 0.12;
    const ao = o.ao ? (o.ao[quads[4 * q]] + o.ao[quads[4 * q + 1]] + o.ao[quads[4 * q + 2]] + o.ao[quads[4 * q + 3]]) / 4 : 1;
    shade[k] = (0.3 + 0.7 * dif + rim) * ao; spec[k] = 0.32 * sp; depth[k] = mz; list.push(k);
  }
  list.sort((p, q) => depth[q] - depth[p]);
  const [br, bg, bb] = o.base || [86, 196, 128], lw = o.lw || 1;
  c.lineJoin = 'round';
  for (const k of list) {
    const side = k >= nq ? 1 : 0, q = k - side * nq, off = side * nv;
    const v = [quads[4 * q] + off, quads[4 * q + 1] + off, quads[4 * q + 2] + off, quads[4 * q + 3] + off];
    const lam = shade[k], sp = spec[k];
    const col = `rgb(${Math.min(255, br * lam + 255 * sp) | 0},${Math.min(255, bg * lam + 255 * sp) | 0},${Math.min(255, bb * lam + 255 * sp) | 0})`;
    c.beginPath(); c.moveTo(sx[v[0]], sy[v[0]]); c.lineTo(sx[v[1]], sy[v[1]]); c.lineTo(sx[v[2]], sy[v[2]]); c.lineTo(sx[v[3]], sy[v[3]]); c.closePath();
    c.fillStyle = col; c.fill(); c.strokeStyle = col; c.lineWidth = 0.8; c.stroke();
    if (side || !o.lines) continue;
    const sd = sides[q];
    if (sd & 15) {
      for (let e = 0; e < 4; e++) if (sd >> e & 1) {
        const outer = sd >> (4 + e) & 1, p = v[e], r = v[(e + 1) % 4];
        c.strokeStyle = outer ? '#166534' : 'rgba(20,83,45,.55)'; c.lineWidth = (outer ? 2.6 : 1.1) * lw;
        c.beginPath(); c.moveTo(sx[p], sy[p]); c.lineTo(sx[r], sy[r]); c.stroke();
      }
    }
    if (o.dots && dots[q]) { c.fillStyle = '#14532d'; for (let e = 0; e < 4; e++) if (dots[q] >> e & 1) { c.beginPath(); c.arc(sx[v[e]], sy[v[e]], 2.7 * lw, 0, TAU); c.fill(); } }
  }
  return { sx, sy, Z };
}
