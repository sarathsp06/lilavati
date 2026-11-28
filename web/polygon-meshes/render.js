// A small software renderer: it turns a triangle mesh into pixels the way a graphics card does. Each
// corner is turned and projected onto the screen; each triangle facing us fills the pixels whose centres
// lie inside its three edges; a depth buffer keeps the nearest triangle at every pixel; and each pixel's
// brightness comes from how squarely the surface faces the light (one direction per triangle for flat
// shading, the corners' directions blended across it for smooth shading).

export const LIGHT = norm([-0.45, 0.6, 0.66]);   // where the light comes from, in screen terms (left, up, towards you)
export const AMBIENT = 0.22, DIFFUSE = 0.78;      // brightness = AMBIENT + DIFFUSE · cos(angle to the light)
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

export function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
export function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// turn a point: yaw about the up axis, then pitch about the across axis
export function turn(p, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x = cy * p[0] + sy * p[2], z = -sy * p[0] + cy * p[2];
  return [x, cp * p[1] - sp * z, sp * p[1] + cp * z];
}

// the brightness of a surface facing direction n (in screen terms), 0 to about 1.2
export function shade(n, shiny = true) {
  const d = Math.max(0, dot(n, LIGHT));
  return AMBIENT + DIFFUSE * d + (shiny && d > 0 ? 0.3 * Math.max(0, dot(n, HALF)) ** 40 : 0);
}

const buffers = new WeakMap();
function buffersFor(ctx) {
  const { width: w, height: h } = ctx.canvas;
  let b = buffers.get(ctx);
  if (!b || b.w !== w || b.h !== h) {
    const img = ctx.createImageData(w, h);
    b = { w, h, img, px: new Uint32Array(img.data.buffer), z: new Float32Array(w * h) };
    buffers.set(ctx, b);
  }
  return b;
}

// Draw mesh { p, t, n } (corner points, triangles, corner normals) on ctx.
// opts: yaw, pitch, dist (camera distance), f (focal length in pixels), cx, cy (screen centre),
// smooth, edges, color [r, g, b], faceColor(i) → [r, g, b] or null, edgeColor [r, g, b].
// Returns how many triangles were drawn (faced us).
export function render(ctx, mesh, o) {
  const B = buffersFor(ctx), { w, h, px, z } = B;
  px.fill(0); z.fill(Infinity);
  const { p, t, n } = mesh, nv = p.length / 3, dist = o.dist, f = o.f, cx = o.cx ?? w / 2, cy = o.cy ?? h / 2;
  // corners: turned, then projected (sx, sy on screen, d = distance in front of the camera)
  const V = new Float64Array(nv * 3), S = new Float64Array(nv * 3), N = o.smooth ? new Float64Array(nv * 3) : null;
  for (let i = 0; i < nv; i++) {
    const q = turn([p[3 * i], p[3 * i + 1], p[3 * i + 2]], o.yaw, o.pitch);
    V[3 * i] = q[0]; V[3 * i + 1] = q[1]; V[3 * i + 2] = q[2];
    const d = dist - q[2];
    S[3 * i] = cx + f * q[0] / d; S[3 * i + 1] = cy - f * q[1] / d; S[3 * i + 2] = d;
    if (N) { const m = turn([n[3 * i], n[3 * i + 1], n[3 * i + 2]], o.yaw, o.pitch); N[3 * i] = m[0]; N[3 * i + 1] = m[1]; N[3 * i + 2] = m[2]; }
  }
  const base = o.color, edge = o.edgeColor || [30, 41, 59], lineW = o.lineWidth ?? 0.7;
  const pack = (r, g, b) => 0xff000000 | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r);
  let drawn = 0;
  for (let k = 0; k < t.length; k += 3) {
    const a = t[k], b = t[k + 1], c = t[k + 2];
    // facing us? the triangle's own direction against the line to the camera
    const A = [V[3 * a], V[3 * a + 1], V[3 * a + 2]], Bv = [V[3 * b], V[3 * b + 1], V[3 * b + 2]], C = [V[3 * c], V[3 * c + 1], V[3 * c + 2]];
    const fn = cross([Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]);
    if (dot(fn, [-A[0], -A[1], dist - A[2]]) <= 0) continue;
    drawn++;
    const col = (o.faceColor && o.faceColor(k / 3)) || base;
    const flat = N ? 0 : shade(norm(fn));
    const x0 = S[3 * a], y0 = S[3 * a + 1], x1 = S[3 * b], y1 = S[3 * b + 1], x2 = S[3 * c], y2 = S[3 * c + 1];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    // lengths of the three edges, to turn "how far inside" into pixels for the edge lines
    const l0 = Math.hypot(x2 - x1, y2 - y1), l1 = Math.hypot(x0 - x2, y0 - y2), l2 = Math.hypot(x1 - x0, y1 - y0);
    const sg = area > 0 ? 1 : -1, d0 = S[3 * a + 2], d1 = S[3 * b + 2], d2 = S[3 * c + 2];
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const qx = x + 0.5;
        // the three edge tests: which side of each edge the pixel centre is on
        const e0 = ((x2 - x1) * (py - y1) - (y2 - y1) * (qx - x1)) * sg;
        const e1 = ((x0 - x2) * (py - y2) - (y0 - y2) * (qx - x2)) * sg;
        const e2 = ((x1 - x0) * (py - y0) - (y1 - y0) * (qx - x0)) * sg;
        if (e0 < 0 || e1 < 0 || e2 < 0) continue;
        const w0 = e0 / (area * sg), w1 = e1 / (area * sg), w2 = 1 - w0 - w1;
        const d = w0 * d0 + w1 * d1 + w2 * d2, i = y * w + x;
        if (d >= z[i]) continue;   // something nearer is already here
        z[i] = d;
        let s = flat;
        if (N) s = shade(norm([w0 * N[3 * a] + w1 * N[3 * b] + w2 * N[3 * c], w0 * N[3 * a + 1] + w1 * N[3 * b + 1] + w2 * N[3 * c + 1], w0 * N[3 * a + 2] + w1 * N[3 * b + 2] + w2 * N[3 * c + 2]]));
        let r = col[0] * s, g = col[1] * s, bl = col[2] * s;
        if (s > 1) { const extra = (s - 1) * 255; r = col[0] + extra; g = col[1] + extra; bl = col[2] + extra; }
        if (o.edges) {
          const near = Math.min(e0 / l0, e1 / l1, e2 / l2);
          if (near < lineW) { const k2 = 0.85 * (1 - near / lineW); r += (edge[0] - r) * k2; g += (edge[1] - g) * k2; bl += (edge[2] - bl) * k2; }
        }
        px[i] = pack(r | 0, g | 0, bl | 0);
      }
    }
  }
  ctx.putImageData(B.img, 0, 0);
  return drawn;
}
