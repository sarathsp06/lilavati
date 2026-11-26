//! Four-dimensional geometry: the tesseract, rotations in 4D, projection to 3D and 2D.
//!
//! An n-cube has 2^n corners, one for each list of n zeros and ones; two corners are joined by an edge
//! when they differ in exactly one coordinate. Every point here is stored as four numbers (x, y, z, w);
//! for n < 4 the unused coordinates are 0. Rotations in 4D happen in a plane (xy, xz, yz, xw, yw, zw)
//! and are 4×4 matrices stored row by row. Perspective projection drops a coordinate by dividing by the
//! distance to the eye: 4D → 3D divides by (d − w), 3D → 2D divides by (d − z).
use wasm_bindgen::prelude::*;

/// Which pair of axes each rotation plane turns: 0 xy, 1 xz, 2 yz, 3 xw, 4 yw, 5 zw.
const PLANES: [(usize, usize); 6] = [(0, 1), (0, 2), (1, 2), (0, 3), (1, 3), (2, 3)];

fn choose(n: u32, k: u32) -> f64 {
    if k > n { return 0.0; }
    (0..k).fold(1.0, |acc, i| acc * (n - i) as f64 / (i + 1) as f64)
}

/// The corners of the n-cube (n = 0..4), four numbers each, every coordinate 0 or 1. Corner number i
/// has coordinate k equal to bit k of i, so corner 5 = 0b0101 is (1, 0, 1, 0).
#[wasm_bindgen]
pub fn ncube_vertices(n: u32) -> Vec<f64> {
    let n = n.min(4);
    let mut out = Vec::with_capacity(4 << n);
    for i in 0..(1u32 << n) {
        for k in 0..4 { out.push(if k < n && (i >> k) & 1 == 1 { 1.0 } else { 0.0 }); }
    }
    out
}

/// The same corners moved so the cube is centred on the origin: every used coordinate is −½ or ½.
#[wasm_bindgen]
pub fn ncube_vertices_centred(n: u32) -> Vec<f64> {
    let n = n.min(4);
    let mut v = ncube_vertices(n);
    for (i, x) in v.iter_mut().enumerate() { if (i % 4) < n as usize { *x -= 0.5; } }
    v
}

/// The edges of the n-cube as pairs of corner numbers, grouped by the axis they run along: first every
/// edge along x, then along y, and so on. So the last 2^(n−1) edges are the ones added when the n-cube
/// is built from two copies of the (n−1)-cube.
#[wasm_bindgen]
pub fn ncube_edges(n: u32) -> Vec<u32> {
    let n = n.min(4);
    let mut out = Vec::new();
    for axis in 0..n {
        for i in 0..(1u32 << n) {
            if (i >> axis) & 1 == 0 { out.push(i); out.push(i | (1 << axis)); }
        }
    }
    out
}

/// For each edge of ncube_edges(n), the axis it runs along (0 x, 1 y, 2 z, 3 w).
#[wasm_bindgen]
pub fn ncube_edge_axes(n: u32) -> Vec<u32> {
    let n = n.min(4);
    (0..n).flat_map(|a| std::iter::repeat(a).take(1 << (n - 1).max(0))).collect()
}

/// The square faces of the n-cube, four corner numbers each, in order round the square.
#[wasm_bindgen]
pub fn ncube_faces(n: u32) -> Vec<u32> {
    let n = n.min(4);
    let mut out = Vec::new();
    for a in 0..n {
        for b in (a + 1)..n {
            for i in 0..(1u32 << n) {
                if (i >> a) & 1 == 0 && (i >> b) & 1 == 0 {
                    out.extend([i, i | (1 << a), i | (1 << a) | (1 << b), i | (1 << b)]);
                }
            }
        }
    }
    out
}

/// The corner numbers of one cubic cell of the 4-cube (or one square face of the 3-cube, and so on):
/// the corners whose coordinate `axis` equals `value` (0 or 1). The tesseract has 8 cells: two per axis.
#[wasm_bindgen]
pub fn ncube_cell(n: u32, axis: u32, value: u32) -> Vec<u32> {
    let n = n.min(4);
    (0..(1u32 << n)).filter(|i| (i >> axis) & 1 == (value & 1)).collect()
}

/// How many corners, edges, square faces and cubic cells the n-cube has: C(n, k) · 2^(n−k) pieces of
/// dimension k. Returned as [V, E, F, C].
#[wasm_bindgen]
pub fn ncube_counts(n: u32) -> Vec<f64> {
    (0..4u32).map(|k| if k > n { 0.0 } else { choose(n, k) * (1u64 << (n - k)) as f64 }).collect()
}

/// Build it: the n-cube as two copies of the (n−1)-cube, the second pushed a distance t along the new
/// axis (number n−1). t = 0 is the (n−1)-cube with every corner doubled up; t = 1 is the finished
/// n-cube (the same corners as ncube_vertices(n)). Four numbers per corner.
#[wasm_bindgen]
pub fn ncube_extrude(n: u32, t: f64) -> Vec<f64> {
    let n = n.min(4);
    let mut v = ncube_vertices(n);
    if n > 0 { for i in 0..(1usize << n) { v[i * 4 + (n as usize - 1)] *= t; } }
    v
}

/// Rotation by `theta` radians in one plane (0 xy, 1 xz, 2 yz, 3 xw, 4 yw, 5 zw): a 4×4 matrix, row by
/// row. Everything outside the plane stays put.
#[wasm_bindgen]
pub fn rot4(plane: u32, theta: f64) -> Vec<f64> {
    let (i, j) = PLANES[(plane as usize).min(5)];
    let (s, c) = theta.sin_cos();
    let mut m = vec![0.0; 16];
    for k in 0..4 { m[k * 4 + k] = 1.0; }
    m[i * 4 + i] = c; m[i * 4 + j] = -s;
    m[j * 4 + i] = s; m[j * 4 + j] = c;
    m
}

/// The product of two 4×4 matrices (row by row): first b, then a.
#[wasm_bindgen]
pub fn mat4_mul(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut m = vec![0.0; 16];
    for r in 0..4 { for c in 0..4 { for k in 0..4 { m[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c]; } } }
    m
}

/// All six rotations in one matrix: first the ones that use w (xw, then yw, then zw), then the ordinary
/// turns of space (xy, xz, yz). Angles in radians.
#[wasm_bindgen]
pub fn rot4_all(xy: f64, xz: f64, yz: f64, xw: f64, yw: f64, zw: f64) -> Vec<f64> {
    let mut m = rot4(3, xw);
    for (p, t) in [(4, yw), (5, zw), (0, xy), (1, xz), (2, yz)] { m = mat4_mul(&rot4(p, t), &m); }
    m
}

/// Move every point (four numbers each) by a 4×4 matrix.
#[wasm_bindgen]
pub fn apply4(m: &[f64], pts: &[f64]) -> Vec<f64> {
    let mut out = Vec::with_capacity(pts.len());
    for p in pts.chunks_exact(4) {
        for r in 0..4 { out.push((0..4).map(|k| m[r * 4 + k] * p[k]).sum()); }
    }
    out
}

/// Perspective from 4D to 3D with the eye a distance d along w: (x, y, z, w) → (x, y, z) / (d − w).
/// Points with bigger w are nearer the eye and come out bigger. Three numbers per point.
#[wasm_bindgen]
pub fn project_4d_to_3d(pts: &[f64], d: f64) -> Vec<f64> {
    let mut out = Vec::with_capacity(pts.len() / 4 * 3);
    for p in pts.chunks_exact(4) { let s = 1.0 / (d - p[3]); out.extend([p[0] * s, p[1] * s, p[2] * s]); }
    out
}

/// Perspective from 3D to the screen with the eye a distance d along z: (x, y, z) → (x, y) / (d − z).
/// Returns three numbers per point: the two screen coordinates and z itself (how near the eye it is).
#[wasm_bindgen]
pub fn project_3d_to_2d(pts: &[f64], d: f64) -> Vec<f64> {
    let mut out = Vec::with_capacity(pts.len());
    for p in pts.chunks_exact(3) { let s = 1.0 / (d - p[2]); out.extend([p[0] * s, p[1] * s, p[2]]); }
    out
}

/// The whole chain for a 4D point list: 4D → 3D (eye at d4 along w) → screen (eye at d3 along z).
/// Four numbers per point: screen x, screen y, depth (z in 3D, for shading) and w (which side in 4D).
#[wasm_bindgen]
pub fn project_chain(pts: &[f64], d4: f64, d3: f64) -> Vec<f64> {
    let p3 = project_4d_to_3d(pts, d4);
    let p2 = project_3d_to_2d(&p3, d3);
    let mut out = Vec::with_capacity(pts.len());
    for (q, p) in p2.chunks_exact(3).zip(pts.chunks_exact(4)) { out.extend([q[0], q[1], q[2], p[3]]); }
    out
}

/// The picture of the n-cube, with every intermediate quantity, for the page: centred corners, the
/// last axis grown to `t` (1 = finished), turned by the six angles, then projected twice. Nine numbers
/// per corner: the turned 4D point (x, y, z, w), the 3D point (x3, y3, z3) and the screen point (X, Y).
#[wasm_bindgen]
pub fn scene(n: u32, t: f64, xy: f64, xz: f64, yz: f64, xw: f64, yw: f64, zw: f64, d4: f64, d3: f64) -> Vec<f64> {
    let n = n.min(4);
    let mut v = ncube_extrude(n, t);
    for (i, x) in v.iter_mut().enumerate() {
        let k = i % 4;
        if (k as u32) < n { *x -= if k as u32 == n - 1 { 0.5 * t } else { 0.5 }; }
    }
    let r = apply4(&rot4_all(xy, xz, yz, xw, yw, zw), &v);
    let p3 = project_4d_to_3d(&r, d4);
    let p2 = project_3d_to_2d(&p3, d3);
    let mut out = Vec::with_capacity(r.len() / 4 * 9);
    for i in 0..r.len() / 4 {
        out.extend_from_slice(&r[i * 4..i * 4 + 4]);
        out.extend_from_slice(&p3[i * 3..i * 3 + 3]);
        out.extend_from_slice(&p2[i * 3..i * 3 + 2]);
    }
    out
}

/// The distance from the origin to a point, built up one direction at a time: after x alone, after x and y,
/// after x, y and z, and after all four. Each new direction is at right angles to all the earlier ones,
/// so each step is Pythagoras on a right triangle: new distance² = old distance² + new number².
#[wasm_bindgen]
pub fn running_distance(p: &[f64]) -> Vec<f64> {
    let mut s = 0.0;
    p.iter().take(4).map(|v| { s += v * v; s.sqrt() }).collect()
}

/// Length of one edge after any 4×4 move: the distance between two 4D points.
#[wasm_bindgen]
pub fn dist4(a: &[f64], b: &[f64]) -> f64 {
    (0..4).map(|k| (a[k] - b[k]).powi(2)).sum::<f64>().sqrt()
}

/// Slice a shape by the flat "world" w = h (or, for an n-cube with n ≤ 3, by the coordinate numbered
/// `axis` = h): where each edge crosses, and which crossing points are joined because they lie on the
/// same square face. Returns [k, then k crossing points of four numbers each, then pairs of crossing
/// point numbers]. For the 4-cube with axis 3 this is the wireframe of the 3D solid you would see as
/// the tesseract passes through our space; for the 3-cube with axis 2 it is the polygon a flat
/// world sees; for the square with axis 1 it is the segment a line world sees.
#[wasm_bindgen]
pub fn slice(n: u32, pts: &[f64], axis: u32, h: f64) -> Vec<f64> {
    let n = n.min(4);
    let a = (axis as usize).min(3);
    let edges = ncube_edges(n);
    let mut hits: Vec<(usize, usize, Vec<f64>)> = Vec::new();   // (corner i, corner j, point)
    for e in edges.chunks_exact(2) {
        let (i, j) = (e[0] as usize, e[1] as usize);
        let (p, q) = (&pts[i * 4..i * 4 + 4], &pts[j * 4..j * 4 + 4]);
        let (pa, qa) = (p[a] - h, q[a] - h);
        if (pa <= 0.0 && qa > 0.0) || (qa <= 0.0 && pa > 0.0) {
            let u = pa / (pa - qa);
            hits.push((i, j, (0..4).map(|k| p[k] + (q[k] - p[k]) * u).collect()));
        }
    }
    let mut out = vec![hits.len() as f64];
    for (_, _, p) in &hits { out.extend_from_slice(p); }
    let on_face = |f: &[u32], i: usize, j: usize| f.contains(&(i as u32)) && f.contains(&(j as u32));
    for f in ncube_faces(n).chunks_exact(4) {
        let here: Vec<usize> = hits.iter().enumerate().filter(|(_, (i, j, _))| on_face(f, *i, *j)).map(|(k, _)| k).collect();
        if here.len() == 2 { out.push(here[0] as f64); out.push(here[1] as f64); }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::{FRAC_PI_2, PI};
    fn close(a: f64, b: f64) -> bool { (a - b).abs() < 1e-9 }
    fn pt(v: &[f64], i: usize) -> [f64; 4] { [v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]] }
    fn as_set(v: &[f64], idx: &[u32]) -> Vec<[i64; 4]> {
        let mut s: Vec<[i64; 4]> = idx.iter().map(|&i| pt(v, i as usize).map(|x| (x * 1000.0).round() as i64)).collect();
        s.sort(); s
    }

    #[test]
    fn distance_adds_one_square_per_direction() {
        assert_eq!(running_distance(&[1.0, 2.0, 2.0, 4.0]), vec![1.0, 5f64.sqrt(), 3.0, 5.0]);
        assert_eq!(running_distance(&[-3.0, 4.0, 0.0, 0.0]), vec![3.0, 5.0, 5.0, 5.0]);
        // a tesseract corner is 1 from the centre, the same as dist4 says
        let c = [0.5, 0.5, 0.5, 0.5];
        assert!(close(running_distance(&c)[3], 1.0));
        assert!(close(running_distance(&c)[3], dist4(&c, &[0.0; 4])));
    }

    #[test]
    fn counts_match_the_known_numbers() {
        assert_eq!(ncube_counts(4), vec![16.0, 32.0, 24.0, 8.0]);
        assert_eq!(ncube_counts(3), vec![8.0, 12.0, 6.0, 1.0]);
        assert_eq!(ncube_counts(2), vec![4.0, 4.0, 1.0, 0.0]);
        assert_eq!(ncube_counts(1), vec![2.0, 1.0, 0.0, 0.0]);
        assert_eq!(ncube_counts(0), vec![1.0, 0.0, 0.0, 0.0]);
        for n in 0..=4 {
            let c = ncube_counts(n);
            assert_eq!(ncube_vertices(n).len(), 4 * c[0] as usize, "n = {n} corners");
            assert_eq!(ncube_edges(n).len(), 2 * c[1] as usize, "n = {n} edges");
            assert_eq!(ncube_faces(n).len(), 4 * c[2] as usize, "n = {n} faces");
            assert_eq!(ncube_edge_axes(n).len(), c[1] as usize);
        }
        assert_eq!(ncube_cell(4, 3, 0).len(), 8);
        assert_eq!(ncube_cell(3, 2, 1), vec![4, 5, 6, 7]);
    }

    #[test]
    fn edges_join_corners_one_step_apart() {
        let v = ncube_vertices(4);
        for e in ncube_edges(4).chunks_exact(2) {
            let (p, q) = (pt(&v, e[0] as usize), pt(&v, e[1] as usize));
            let diff: usize = (0..4).filter(|&k| p[k] != q[k]).count();
            assert_eq!(diff, 1);
        }
        // every corner is a different pattern of 0s and 1s
        let mut corners: Vec<[i64; 4]> = (0..16).map(|i| pt(&v, i).map(|x| x as i64)).collect();
        corners.sort(); corners.dedup();
        assert_eq!(corners.len(), 16);
    }

    #[test]
    fn building_up_doubles_the_corners_and_adds_the_connecting_edges() {
        // V(n) = 2 V(n−1), E(n) = 2 E(n−1) + V(n−1)
        for n in 1..=4 {
            let (c, p) = (ncube_counts(n), ncube_counts(n - 1));
            assert!(close(c[0], 2.0 * p[0]));
            assert!(close(c[1], 2.0 * p[1] + p[0]));
            // the last V(n−1) edges run along the new axis
            let axes = ncube_edge_axes(n);
            assert!(axes[axes.len() - p[0] as usize..].iter().all(|&a| a == n - 1));
            // t = 0: the copy sits on the original; t = 1: the finished cube
            let flat = ncube_extrude(n, 0.0);
            for i in 0..(1usize << (n - 1)) { assert_eq!(pt(&flat, i), pt(&flat, i + (1 << (n - 1)))); }
            assert_eq!(ncube_extrude(n, 1.0), ncube_vertices(n));
        }
    }

    #[test]
    fn rotations_keep_every_length() {
        let v = ncube_vertices_centred(4);
        let m = rot4_all(0.3, -0.7, 1.1, 0.5, 2.0, -1.3);
        let r = apply4(&m, &v);
        for e in ncube_edges(4).chunks_exact(2) {
            let (i, j) = (e[0] as usize, e[1] as usize);
            assert!(close(dist4(&r[i * 4..i * 4 + 4], &r[j * 4..j * 4 + 4]), 1.0));
        }
        // distances between all pairs, and the distance from the centre, stay the same
        for i in 0..16 { for j in 0..16 {
            assert!(close(dist4(&v[i * 4..i * 4 + 4], &v[j * 4..j * 4 + 4]), dist4(&r[i * 4..i * 4 + 4], &r[j * 4..j * 4 + 4])));
        } }
        for i in 0..16 { assert!(close(dist4(&r[i * 4..i * 4 + 4], &[0.0; 4]), 1.0)); }
        // each plane rotation is a rotation: its transpose undoes it
        for p in 0..6 {
            let a = rot4(p, 0.9); let b = rot4(p, -0.9);
            let id = mat4_mul(&a, &b);
            for r in 0..4 { for c in 0..4 { assert!(close(id[r * 4 + c], if r == c { 1.0 } else { 0.0 })); } }
        }
    }

    #[test]
    fn turning_in_the_xw_plane_moves_the_inner_cube_onto_another_cell() {
        let v = ncube_vertices_centred(4);
        let inner = ncube_cell(4, 3, 0);   // w = −½: the small, far cube in the picture
        let outer = ncube_cell(4, 3, 1);   // w = +½: the big, near cube
        // a half turn (180°) in xw sends w → −w: the inner cube lands exactly on the outer cube
        let half = apply4(&rot4(3, PI), &v);
        assert_eq!(as_set(&half, &inner), as_set(&v, &outer));
        assert_eq!(as_set(&half, &outer), as_set(&v, &inner));
        // a quarter turn (90°) in xw sends (x, w) → (−w, x): the inner cube lands on the x = +½ cell,
        // one of the side cells, so the picture shows it moving out through the side
        let quarter = apply4(&rot4(3, FRAC_PI_2), &v);
        assert_eq!(as_set(&quarter, &inner), as_set(&v, &ncube_cell(4, 0, 1)));
        // and the picture after a quarter turn is the same set of 16 corners as before
        assert_eq!(as_set(&quarter, &(0..16).collect::<Vec<u32>>()), as_set(&v, &(0..16).collect::<Vec<u32>>()));
    }

    #[test]
    fn flat_in_w_projects_to_the_ordinary_cube() {
        // a cube (w = 0 everywhere) seen from distance d along w is just the cube scaled by 1/d
        let c = ncube_vertices_centred(3);
        for d in [1.0, 2.0, 3.5] {
            let p = project_4d_to_3d(&c, d);
            for i in 0..8 { for k in 0..3 { assert!(close(p[i * 3 + k], c[i * 4 + k] / d)); } }
        }
        // the whole chain keeps w = 0 and the depth as z
        let q = project_chain(&c, 1.0, 10.0);
        for i in 0..8 { assert!(close(q[i * 4 + 3], 0.0)); assert!(close(q[i * 4 + 2], c[i * 4 + 2])); }
        // the near cell (w = +½) comes out bigger than the far cell (w = −½)
        let t = project_4d_to_3d(&ncube_vertices_centred(4), 2.0);
        let size = |cell: Vec<u32>| cell.iter().map(|&i| t[i as usize * 3].abs()).fold(0.0, f64::max);
        assert!(size(ncube_cell(4, 3, 1)) > size(ncube_cell(4, 3, 0)));
        assert!(close(size(ncube_cell(4, 3, 1)), 0.5 / 1.5) && close(size(ncube_cell(4, 3, 0)), 0.5 / 2.5));
    }

    #[test]
    fn scene_lines_up_with_the_pieces() {
        let s = scene(4, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 4.0);
        assert_eq!(s.len(), 16 * 9);
        let v = ncube_vertices_centred(4);
        for i in 0..16 {
            for k in 0..4 { assert!(close(s[i * 9 + k], v[i * 4 + k])); }
            let sc = 1.0 / (2.0 - v[i * 4 + 3]);
            assert!(close(s[i * 9 + 4], v[i * 4] * sc));
            assert!(close(s[i * 9 + 7], s[i * 9 + 4] / (4.0 - s[i * 9 + 6])));
        }
        // half-built: the new axis is only part way out
        let h = scene(3, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 4.0);
        for i in 0..8 { assert!(close(h[i * 9 + 2].abs(), 0.25)); }
    }

    #[test]
    fn slicing_a_square_gives_a_segment_and_a_cube_a_polygon() {
        // a square standing on a corner (turned 45°) passing a line: the segment grows then shrinks
        let sq = apply4(&rot4(0, PI / 4.0), &ncube_vertices_centred(2));
        let len_at = |h: f64| { let s = slice(2, &sq, 1, h); let k = s[0] as usize; if k < 2 { 0.0 } else { dist4(&s[1..5], &s[5..9]) } };
        assert!(close(len_at(0.0), 2f64.sqrt()));
        assert!(close(len_at(0.5), 2f64.sqrt() - 1.0));   // width at height h is √2 − 2h
        assert!(close(len_at(0.8), 0.0));
        // a cube on a corner through a plane: a triangle near the tip, a hexagon through the middle
        let cube = apply4(&mat4_mul(&rot4(2, (1f64 / 3f64.sqrt()).acos()), &rot4(0, PI / 4.0)), &ncube_vertices_centred(3));
        let n_pts = |h: f64| slice(3, &cube, 2, h)[0] as usize;
        assert_eq!(n_pts(0.0), 6);
        assert_eq!(n_pts(0.7), 3);
        // the tesseract straight on: the slice is a full cube, 8 corners, 12 edges
        let t = ncube_vertices_centred(4);
        let s = slice(4, &t, 3, 0.0);
        let k = s[0] as usize;
        assert_eq!(k, 8);
        assert_eq!((s.len() - 1 - 4 * k) / 2, 12);
        assert_eq!(slice(4, &t, 3, 0.7)[0], 0.0);
    }
}
