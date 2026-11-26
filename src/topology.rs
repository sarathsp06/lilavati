//! Topology: surfaces made of dots (vertices), edges and faces, and the number V − E + F (the Euler
//! characteristic, χ) that stretching and bending can never change, but cutting and gluing can.
//!
//! The page's shapes are flat rubber sheets: a grid of square cells with some cells missing (the holes),
//! laid out in the plane by a smooth map that can be morphed (a doughnut into a mug). Morphing only moves
//! the dots, so V, E and F stay the same. For a flat sheet, χ = pieces − holes; for a closed surface,
//! χ = 2 − 2·g, where g is the number of holes (a sphere 2, a torus 0).
use std::collections::HashSet;
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// V − E + F.
#[wasm_bindgen]
pub fn euler(v: i32, e: i32, f: i32) -> i32 { v - e + f }

/// The number of holes g of a closed, two-sided surface with Euler characteristic χ = 2 − 2·g.
#[wasm_bindgen]
pub fn genus(chi: i32) -> i32 { (2 - chi) / 2 }

/// Count a mesh given as faces of `per` vertex ids each: [V, E, F], where V counts distinct vertex ids
/// used by some face and E distinct (unordered) pairs of neighbouring ids round a face.
#[wasm_bindgen]
pub fn count_mesh(faces: &[u32], per: usize) -> Vec<i32> {
    let per = per.max(3);
    let mut vs = HashSet::new();
    let mut es = HashSet::new();
    let n = faces.len() / per;
    for f in faces.chunks_exact(per) {
        for k in 0..per {
            let (a, b) = (f[k], f[(k + 1) % per]);
            vs.insert(a);
            es.insert((a.min(b), a.max(b)));
        }
    }
    vec![vs.len() as i32, es.len() as i32, n as i32]
}

/// V − E + F after each face is added in turn (the first entry is after one face).
#[wasm_bindgen]
pub fn running_euler(faces: &[u32], per: usize) -> Vec<i32> {
    let per = per.max(3);
    let mut vs = HashSet::new();
    let mut es = HashSet::new();
    let mut out = Vec::new();
    for (i, f) in faces.chunks_exact(per).enumerate() {
        for k in 0..per {
            let (a, b) = (f[k], f[(k + 1) % per]);
            vs.insert(a);
            es.insert((a.min(b), a.max(b)));
        }
        out.push(vs.len() as i32 - es.len() as i32 + i as i32 + 1);
    }
    out
}

/// How many separate pieces the faces make (faces sharing a vertex are joined).
#[wasm_bindgen]
pub fn pieces(faces: &[u32], per: usize) -> u32 {
    let per = per.max(3);
    let top = faces.iter().copied().max().map_or(0, |m| m as usize + 1);
    let mut parent: Vec<usize> = (0..top).collect();
    fn find(p: &mut Vec<usize>, mut x: usize) -> usize { while p[x] != x { p[x] = p[p[x]]; x = p[x]; } x }
    for f in faces.chunks_exact(per) {
        let r = find(&mut parent, f[0] as usize);
        for &v in &f[1..] { let s = find(&mut parent, v as usize); parent[s] = r; }
    }
    let used: HashSet<u32> = faces.iter().copied().collect();
    let mut roots = HashSet::new();
    for v in used { roots.insert(find(&mut parent, v as usize)); }
    roots.len() as u32
}

/// The length of the outline (edges that belong to only one face) and the total area of the faces,
/// for faces of `per` vertex ids and positions [x0, y0, x1, y1, …] indexed by id.
#[wasm_bindgen]
pub fn measure(faces: &[u32], per: usize, pos: &[f64]) -> Vec<f64> {
    let per = per.max(3);
    let p = |i: u32| (pos[2 * i as usize], pos[2 * i as usize + 1]);
    let mut seen: std::collections::HashMap<(u32, u32), u32> = std::collections::HashMap::new();
    let mut area = 0.0;
    for f in faces.chunks_exact(per) {
        let mut a = 0.0;
        for k in 0..per {
            let (i, j) = (f[k], f[(k + 1) % per]);
            let ((x0, y0), (x1, y1)) = (p(i), p(j));
            a += x0 * y1 - x1 * y0;
            *seen.entry((i.min(j), i.max(j))).or_insert(0) += 1;
        }
        area += a.abs() / 2.0;
    }
    let outline = seen.iter().filter(|(_, &c)| c == 1).map(|(&(i, j), _)| { let ((x0, y0), (x1, y1)) = (p(i), p(j)); (x1 - x0).hypot(y1 - y0) }).sum();
    vec![outline, area]
}

/// The faces (squares) of an n×m grid glued left to right and top to bottom: a torus.
#[wasm_bindgen]
pub fn torus_faces(n: u32, m: u32) -> Vec<u32> {
    let (n, m) = (n.max(1), m.max(1));
    let id = |i: u32, j: u32| (j % m) * n + (i % n);
    let mut out = Vec::new();
    for j in 0..m { for i in 0..n { out.extend([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]); } }
    out
}

/// The six square faces of a cube (vertex ids 0..8, bit k of the id is coordinate k).
#[wasm_bindgen]
pub fn cube_faces() -> Vec<u32> {
    vec![0, 1, 3, 2, 4, 6, 7, 5, 0, 4, 5, 1, 2, 3, 7, 6, 0, 2, 6, 4, 1, 5, 7, 3]
}

/// A rectangle of cells, in grid units: x from x0 to x1, y from y0 to y1.
#[derive(Clone, Copy, Debug)]
struct Rect { x0: u32, y0: u32, x1: u32, y1: u32 }
impl Rect {
    fn has(&self, x: u32, y: u32) -> bool { x >= self.x0 && x < self.x1 && y >= self.y0 && y < self.y1 }
}

/// One of the page's rubber sheets: a cols×rows grid of square cells, some missing (the holes), with a
/// cut that can be made from a hole to the edge (or right across) and one more hole that can be punched.
#[wasm_bindgen]
pub struct Sheet {
    shape: u32,
    cols: u32,
    rows: u32,
    holes: Vec<Rect>,
    cut_x: u32, cut_y0: u32, cut_y1: u32,
    punch: (u32, u32),
    is_cut: bool,
    is_punched: bool,
}

/// The names of the shapes, in order.
pub const SHAPES: [&str; 4] = ["No hole: a lump of clay", "One hole: a doughnut and a mug", "Two holes: a pair of glasses", "Three holes: a pretzel"];

#[wasm_bindgen]
impl Sheet {
    /// Shape 0: no hole; 1: one hole (doughnut ↔ mug); 2: two holes; 3: three holes.
    #[wasm_bindgen(constructor)]
    pub fn new(shape: u32) -> Sheet {
        let r = |x0, y0, x1, y1| Rect { x0, y0, x1, y1 };
        let (cols, rows, holes, cut, punch) = match shape.min(3) {
            0 => (8, 6, vec![], (4, 0, 6), (3, 2)),
            1 => (8, 6, vec![r(5, 1, 7, 5)], (6, 5, 6), (2, 2)),
            2 => (11, 5, vec![r(2, 1, 4, 4), r(7, 1, 9, 4)], (3, 4, 5), (5, 2)),
            _ => (12, 6, vec![r(1, 1, 3, 3), r(5, 1, 7, 3), r(9, 1, 11, 3)], (2, 3, 6), (5, 4)),
        };
        Sheet { shape: shape.min(3), cols, rows, holes, cut_x: cut.0, cut_y0: cut.1, cut_y1: cut.2, punch, is_cut: false, is_punched: false }
    }
    pub fn shape(&self) -> u32 { self.shape }
    pub fn cols(&self) -> u32 { self.cols }
    pub fn rows(&self) -> u32 { self.rows }
    pub fn name(&self) -> String { SHAPES[self.shape as usize].to_string() }
    pub fn set_cut(&mut self, on: bool) { self.is_cut = on; }
    pub fn set_punched(&mut self, on: bool) { self.is_punched = on; }
    pub fn is_cut(&self) -> bool { self.is_cut }
    pub fn is_punched(&self) -> bool { self.is_punched }
    /// How many dots along the cut (the ones that get doubled when it is made).
    pub fn cut_len(&self) -> u32 { self.cut_y1 - self.cut_y0 + 1 }
    /// The holes the shape starts with.
    pub fn built_in_holes(&self) -> u32 { self.holes.len() as u32 }
    /// Room for every vertex id: the grid's corners, then the doubled dots along the cut.
    pub fn vertex_count(&self) -> u32 { (self.cols + 1) * (self.rows + 1) + self.cut_len() }
    fn base(&self, x: u32, y: u32) -> u32 { y * (self.cols + 1) + x }
    fn present(&self, x: u32, y: u32) -> bool {
        !self.holes.iter().any(|h| h.has(x, y)) && !(self.is_punched && (x, y) == self.punch)
    }
    /// The id of corner (x, y) as seen from cell (cx, cy): cells right of the cut see the doubled dots.
    fn corner(&self, x: u32, y: u32, cx: u32) -> u32 {
        if self.is_cut && x == self.cut_x && cx >= self.cut_x && y >= self.cut_y0 && y <= self.cut_y1 {
            (self.cols + 1) * (self.rows + 1) + (y - self.cut_y0)
        } else { self.base(x, y) }
    }
    /// The cells that are there, row by row, as four vertex ids each (going round the square).
    pub fn faces(&self) -> Vec<u32> {
        let mut out = Vec::new();
        for y in 0..self.rows { for x in 0..self.cols {
            if !self.present(x, y) { continue; }
            out.extend([self.corner(x, y, x), self.corner(x + 1, y, x), self.corner(x + 1, y + 1, x), self.corner(x, y + 1, x)]);
        } }
        out
    }
    /// The cell punched by set_punched, as [x, y].
    pub fn punch_cell(&self) -> Vec<u32> { vec![self.punch.0, self.punch.1] }
    /// The cut as [x, y0, y1] in grid units.
    pub fn cut_line(&self) -> Vec<u32> { vec![self.cut_x, self.cut_y0, self.cut_y1] }
    /// Grid position (x, y) of every vertex id (the doubled dots sit a little to the right once cut).
    pub fn grid(&self) -> Vec<f64> {
        let mut out = Vec::with_capacity(2 * self.vertex_count() as usize);
        for y in 0..=self.rows { for x in 0..=self.cols { out.extend([x as f64, y as f64]); } }
        let gap = if self.is_cut { 0.35 } else { 0.0 };
        for y in self.cut_y0..=self.cut_y1 { out.extend([self.cut_x as f64 + gap, y as f64]); }
        out
    }
    /// Where every vertex id sits in the plane (x right, y up, roughly within ±1.5) at morph t (0 to 1).
    pub fn positions(&self, t: f64) -> Vec<f64> {
        let g = self.grid();
        let t = smooth(t.clamp(0.0, 1.0));
        let mut out = Vec::with_capacity(g.len());
        for p in g.chunks_exact(2) {
            let (ax, ay) = self.start(p[0], p[1]);
            let (bx, by) = self.end(p[0], p[1]);
            out.extend([ax + (bx - ax) * t, ay + (by - ay) * t]);
        }
        out
    }
    /// [V, E, F, V − E + F, pieces, holes], counted from the faces. holes = pieces − (V − E + F).
    pub fn counts(&self) -> Vec<i32> {
        let f = self.faces();
        let c = count_mesh(&f, 4);
        let chi = euler(c[0], c[1], c[2]);
        let p = pieces(&f, 4) as i32;
        vec![c[0], c[1], c[2], chi, p, p - chi]
    }
}

fn smooth(t: f64) -> f64 { t * t * (3.0 - 2.0 * t) }

impl Sheet {
    /// The grid as a slab with rounded corners, width 2.8, centred.
    fn slab(&self, x: f64, y: f64) -> (f64, f64) {
        let (c, r) = (self.cols as f64, self.rows as f64);
        let (u, v) = (2.0 * x / c - 1.0, 1.0 - 2.0 * y / r);
        // half way between the square and the round disk it maps onto
        let (du, dv) = (u * (1.0 - v * v / 2.0).sqrt(), v * (1.0 - u * u / 2.0).sqrt());
        let (u, v) = (0.5 * (u + du), 0.5 * (v + dv));
        (1.4 * u, 1.4 * r / c * v)
    }
    /// The first picture of each shape.
    fn start(&self, x: f64, y: f64) -> (f64, f64) {
        if self.shape == 1 { self.ring(x, y) } else { self.slab(x, y) }
    }
    /// The last picture: bent, pinched or wavy; the mug for the one-hole shape.
    fn end(&self, x: f64, y: f64) -> (f64, f64) {
        match self.shape {
            0 => { // bent into an arc, like a banana
                let (sx, sy) = self.slab(x, y);
                let r0 = 1.6; let a = sx / r0; let rad = r0 + sy;
                (rad * a.sin(), rad * a.cos() - r0)
            }
            1 => self.mug(x, y),
            2 => { // pinched in the middle and the lenses rounded: a pair of glasses
                let (sx, sy) = self.slab(x, y);
                let pinch = 1.0 - 0.55 * (-sx * sx / 0.12).exp();
                (sx * 1.05, sy * pinch * 1.25 + 0.08 * (sx * 2.2).cos())
            }
            _ => { // wavy: a gentle shear in both directions (its stretch never folds the sheet)
                let (sx, sy) = self.slab(x, y);
                (sx + 0.18 * (2.2 * sy + 1.0).sin(), sy * 1.3 + 0.22 * (2.4 * sx).sin())
            }
        }
    }
    /// One hole as a round ring: each point keeps its direction from the hole's centre and its share of
    /// the way from the hole's edge to the outer edge.
    fn ring(&self, x: f64, y: f64) -> (f64, f64) {
        let h = self.holes[0];
        let (hx, hy) = ((h.x0 + h.x1) as f64 / 2.0, (h.y0 + h.y1) as f64 / 2.0);
        let (dx, dy) = (x - hx, y - hy);
        let d = dx.hypot(dy);
        if d < 1e-12 { return (0.0, 0.0); }
        let (cx, cy) = (dx / d, dy / d);
        // distance along the ray from the centre to the edge of a box [x0, x1]×[y0, y1] around it
        let hit = |x0: f64, x1: f64, y0: f64, y1: f64| {
            let tx = if cx.abs() > 1e-12 { if cx > 0.0 { (x1 - hx) / cx } else { (x0 - hx) / cx } } else { f64::INFINITY };
            let ty = if cy.abs() > 1e-12 { if cy > 0.0 { (y1 - hy) / cy } else { (y0 - hy) / cy } } else { f64::INFINITY };
            tx.min(ty)
        };
        let din = hit(h.x0 as f64, h.x1 as f64, h.y0 as f64, h.y1 as f64);
        let dout = hit(0.0, self.cols as f64, 0.0, self.rows as f64);
        let s = ((d - din) / (dout - din)).clamp(0.0, 1.0);
        let rad = 0.42 + s * (1.05 - 0.42);
        let a = cy.atan2(cx);
        (rad * a.cos(), -rad * a.sin())
    }
    /// One hole as a mug seen from the side: the left of the grid is the body, the right the handle.
    fn mug(&self, x: f64, y: f64) -> (f64, f64) {
        let v = (self.rows as f64 / 2.0 - y) / (self.rows as f64 / 2.0); // −1 at the bottom, 1 at the top
        if x <= 5.0 { return (-1.15 + x * 0.31, v * 1.05); }
        let u = (x - 5.0) / 3.0;
        let e = (u / 0.35).min(1.0);
        let s = 1.0 - 0.4 * e * e * (3.0 - 2.0 * e);
        (0.4 + u * 0.75 - 0.25 * u * u * v * v, v * s * 1.05)
    }
}

/// The angle of the ring map, for tests: a point's direction from the hole's centre is kept.
#[allow(dead_code)]
fn angle(x: f64, y: f64) -> f64 { y.atan2(x).rem_euclid(2.0 * PI) }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solids_have_two() {
        let c = count_mesh(&cube_faces(), 4);
        assert_eq!(c, vec![8, 12, 6]);
        assert_eq!(euler(c[0], c[1], c[2]), 2);
        assert_eq!(genus(2), 0);
        // a tetrahedron: four triangles
        let t = count_mesh(&[0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3], 3);
        assert_eq!(t, vec![4, 6, 4]);
        assert_eq!(pieces(&cube_faces(), 4), 1);
    }

    #[test]
    fn a_torus_has_zero_whatever_the_grid() {
        for (n, m) in [(3, 3), (4, 7), (12, 5)] {
            let c = count_mesh(&torus_faces(n, m), 4);
            assert_eq!(c, vec![(n * m) as i32, (2 * n * m) as i32, (n * m) as i32]);
            assert_eq!(euler(c[0], c[1], c[2]), 0);
        }
        assert_eq!(genus(0), 1);
        assert_eq!(genus(-2), 2);
    }

    #[test]
    fn sheets_count_their_holes() {
        for s in 0..4 {
            let sh = Sheet::new(s);
            let c = sh.counts();
            assert_eq!(c[3], c[0] - c[1] + c[2]);
            assert_eq!((c[4], c[5]), (1, s as i32), "shape {s}: {c:?}");
            assert_eq!(c[3], 1 - s as i32);
            assert_eq!(sh.built_in_holes(), s);
        }
    }

    #[test]
    fn punching_and_cutting_change_the_number() {
        for s in 0..4 {
            let mut sh = Sheet::new(s);
            let before = sh.counts();
            sh.set_punched(true);
            let p = sh.counts();
            assert_eq!((p[0], p[1], p[2]), (before[0], before[1], before[2] - 1), "an inner cell: only F drops");
            assert_eq!(p[3], before[3] - 1);
            assert_eq!(p[5], before[5] + 1);
            sh.set_punched(false);
            sh.set_cut(true);
            let c = sh.counts();
            let k = sh.cut_len() as i32;
            assert_eq!((c[0], c[1], c[2]), (before[0] + k, before[1] + k - 1, before[2]), "shape {s}");
            assert_eq!(c[3], before[3] + 1);
            if s == 0 { assert_eq!((c[4], c[5]), (2, 0), "cut right across: two pieces"); }
            else { assert_eq!((c[4], c[5]), (1, s as i32 - 1), "a hole opened to the edge"); }
        }
    }

    #[test]
    fn adding_one_face_at_a_time() {
        let sh = Sheet::new(1);
        let run = running_euler(&sh.faces(), 4);
        assert_eq!(run[0], 1);
        assert_eq!(*run.last().unwrap(), 0);
        // every step changes the number by at most one
        for w in run.windows(2) { assert!((w[1] - w[0]).abs() <= 1); }
    }

    #[test]
    fn morphing_moves_dots_but_keeps_counts() {
        let sh = Sheet::new(1);
        let f = sh.faces();
        let (a, b) = (sh.positions(0.0), sh.positions(1.0));
        assert!(a.iter().chain(b.iter()).all(|v| v.is_finite() && v.abs() < 2.0));
        let (ma, mb) = (measure(&f, 4, &a), measure(&f, 4, &b));
        assert!((ma[0] - mb[0]).abs() > 0.1 && (ma[1] - mb[1]).abs() > 0.05, "length and area change: {ma:?} {mb:?}");
        assert_eq!(sh.counts(), Sheet::new(1).counts());
        // the ring: the hole's edge lands on radius 0.42, the outside on 1.05
        let g = sh.grid();
        let id = |x: u32, y: u32| (y * (sh.cols() + 1) + x) as usize;
        for (x, y, r) in [(5, 1, 0.42), (6, 5, 0.42), (0, 0, 1.05), (8, 3, 1.05)] {
            let i = id(x, y);
            assert_eq!((g[2 * i], g[2 * i + 1]), (x as f64, y as f64));
            assert!((a[2 * i].hypot(a[2 * i + 1]) - r).abs() < 1e-9, "({x}, {y})");
        }
        // directions from the hole's centre (6, 3) are kept: (8, 3) is straight right
        assert!(angle(a[2 * id(8, 3)], a[2 * id(8, 3) + 1]).abs() < 1e-9);
    }

    #[test]
    fn measuring_a_square() {
        let m = measure(&[0, 1, 2, 3], 4, &[0.0, 0.0, 2.0, 0.0, 2.0, 2.0, 0.0, 2.0]);
        assert!((m[0] - 8.0).abs() < 1e-12 && (m[1] - 4.0).abs() < 1e-12);
        // two squares side by side: the shared edge is not outline
        let m = measure(&[0, 1, 4, 3, 1, 2, 5, 4], 4, &[0.0, 0.0, 1.0, 0.0, 2.0, 0.0, 0.0, 1.0, 1.0, 1.0, 2.0, 1.0]);
        assert!((m[0] - 6.0).abs() < 1e-12 && (m[1] - 2.0).abs() < 1e-12);
    }
}
