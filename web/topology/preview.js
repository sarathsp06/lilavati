// Home page card for topology: a rubber doughnut morphs into a coffee mug and back, drawn in 3D with the
// same surface as the page (shape3d.js), on a coarser mesh; the hole and V − E + F = 0 never change.
import { ONE, DoughnutMug, doughnutUV, buildMesh, draw, smooth } from './shape3d.js';

let mesh = null, uv, pos, ao;
const dm = new DoughnutMug();
function build() {
  // the one-hole sheet of src/topology.rs: 8 × 6 squares, vertex id y·9 + x, the hole in squares 5–6 across and 1–4 down
  const { cols, rows, hole } = ONE, faces = [], grid = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) grid.push(x, y);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (x >= hole[0] && x < hole[2] && y >= hole[1] && y < hole[3]) continue;
    const id = (a, b) => b * (cols + 1) + a;
    faces.push(id(x, y), id(x + 1, y), id(x + 1, y + 1), id(x, y + 1));
  }
  mesh = buildMesh({ faces, grid, ncol: [6, 6, 3, 3, 3, 2, 2, 7], nrow: [6, 7, 7, 7, 5, 6] });
  uv = doughnutUV(mesh, 40); pos = new Float64Array(6 * mesh.nv); ao = new Float32Array(mesh.nv);
}

export default function preview(c, w, h, sec) {
  if (!mesh) build();
  const k = 0.5 - 0.5 * Math.cos(sec * 0.55), t = smooth(1.5 * k - 0.25), nv = mesh.nv;
  dm.set(t);
  for (let i = 0; i < nv; i++) {
    const [x, y, z] = dm.at(uv[2 * i], uv[2 * i + 1]); ao[i] = dm.ao;
    pos[3 * i] = pos[3 * (nv + i)] = x; pos[3 * i + 2] = pos[3 * (nv + i) + 2] = z; pos[3 * i + 1] = y; pos[3 * (nv + i) + 1] = -y;
  }
  draw(c, pos, mesh, { yaw: -0.42 + 0.22 * Math.sin(sec * 0.35), pitch: 0.36, S: h * 0.39, cx: w * 0.36, cy: h * 0.5, dist: 7 }, { lines: true, lw: 0.6, ao });
  c.fillStyle = '#14532d'; c.font = '600 22px system-ui'; c.textAlign = 'left';
  c.fillText('1 hole', w * 0.7, h * 0.42);
  c.font = '18px system-ui'; c.fillStyle = '#15803d';
  c.fillText('V − E + F = 0', w * 0.7, h * 0.56);
  c.fillStyle = '#6b7280'; c.font = '14px system-ui';
  c.fillText(t < 0.25 ? 'a doughnut' : t > 0.75 ? 'a mug' : 'stretching…', w * 0.7, h * 0.68);
}
