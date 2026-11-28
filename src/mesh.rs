//! Polygon meshes: curved surfaces drawn with flat triangles, the way computer graphics does it.
//!
//! A mesh is a list of corner points and a list of triangles, three corner numbers each, wound so that
//! the corners go anticlockwise seen from outside. Shapes are picked by number:
//!
//! 0. a ball of radius 1: an icosahedron (20 triangles) whose triangles are cut into 4 again and again,
//!    with every new corner pushed out onto the ball (an "icosphere")
//! 1. a doughnut (torus): a ring of radius R = 1 swept by a circle of radius r = 0.4, cut into a grid of
//!    small four-sided patches, each split into 2 triangles
//! 2. a pebble: the icosphere again, but each corner pushed out to a radius that changes with direction,
//!    1 + 0.22·(x³ − 3·x·z²) + 0.12·(2·y² − x² − z²), which gives three lumps round the middle
//!
//! `level` goes from 0 (coarsest) to `LEVELS − 1`. The exact area and volume of the smooth shapes are
//! known (ball 4·π and 4/3·π, doughnut 4·π²·R·r and 2·π²·R·r²) or worked out by adding up very many very
//! small pieces (the pebble). The 2D case, a circle drawn with straight pieces, is Archimedes' squeeze on π.
use std::collections::HashMap;
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// How many levels of detail each shape has.
pub const LEVELS: u32 = 6;
const RING: f64 = 1.0;
const TUBE: f64 = 0.4;
// the doughnut's grid: v pieces round the tube, 2·v round the ring, for each level
const TUBE_STEPS: [u32; LEVELS as usize] = [3, 5, 9, 18, 36, 68];

type P = [f64; 3];
fn sub(a: P, b: P) -> P { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn add(a: P, b: P) -> P { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn dot(a: P, b: P) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn cross(a: P, b: P) -> P { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn len(a: P) -> f64 { dot(a, a).sqrt() }
fn unit(a: P) -> P { let l = len(a); [a[0] / l, a[1] / l, a[2] / l] }
fn scale(a: P, s: f64) -> P { [a[0] * s, a[1] * s, a[2] * s] }

// the pebble's radius in direction d (a unit vector), and the gradient of that formula
fn pebble_r(d: P) -> f64 { 1.0 + 0.22 * (d[0].powi(3) - 3.0 * d[0] * d[2] * d[2]) + 0.12 * (2.0 * d[1] * d[1] - d[0] * d[0] - d[2] * d[2]) }
fn pebble_grad(d: P) -> P {
    let (x, y, z) = (d[0], d[1], d[2]);
    [0.22 * (3.0 * x * x - 3.0 * z * z) - 0.24 * x, 0.48 * y, -0.22 * 6.0 * x * z - 0.24 * z]
}
// the true surface's distance from the centre in direction d (ball and pebble)
fn radius(shape: u32, d: P) -> f64 { if shape == 2 { pebble_r(d) } else { 1.0 } }

struct Mesh { pts: Vec<P>, tris: Vec<[u32; 3]> }

// the icosahedron's 12 corners (on the ball) and 20 faces
fn icosahedron() -> Mesh {
    let t = (1.0 + 5f64.sqrt()) / 2.0;
    let raw = [[-1.0, t, 0.0], [1.0, t, 0.0], [-1.0, -t, 0.0], [1.0, -t, 0.0], [0.0, -1.0, t], [0.0, 1.0, t],
        [0.0, -1.0, -t], [0.0, 1.0, -t], [t, 0.0, -1.0], [t, 0.0, 1.0], [-t, 0.0, -1.0], [-t, 0.0, 1.0]];
    let tris = vec![[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    Mesh { pts: raw.iter().map(|&p| unit(p)).collect(), tris }
}

// cut every triangle into 4 at its edges' midpoints, pushing the new corners onto the ball
fn subdivide(m: &Mesh) -> Mesh {
    let mut pts = m.pts.clone();
    let mut mid: HashMap<(u32, u32), u32> = HashMap::new();
    let mut half = |a: u32, b: u32, pts: &mut Vec<P>| -> u32 {
        let key = (a.min(b), a.max(b));
        *mid.entry(key).or_insert_with(|| { pts.push(unit(add(pts[a as usize], pts[b as usize]))); (pts.len() - 1) as u32 })
    };
    let mut tris = Vec::with_capacity(m.tris.len() * 4);
    for &[a, b, c] in &m.tris {
        let (ab, bc, ca) = (half(a, b, &mut pts), half(b, c, &mut pts), half(c, a, &mut pts));
        tris.extend([[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]);
    }
    Mesh { pts, tris }
}

fn torus(level: u32) -> Mesh {
    let nv = TUBE_STEPS[level.min(LEVELS - 1) as usize] as usize;
    let nu = 2 * nv;
    let mut pts = Vec::with_capacity(nu * nv);
    for i in 0..nu {
        let u = 2.0 * PI * i as f64 / nu as f64;
        for j in 0..nv {
            let v = 2.0 * PI * j as f64 / nv as f64;
            let w = RING + TUBE * v.cos();
            pts.push([w * u.cos(), TUBE * v.sin(), w * u.sin()]);
        }
    }
    let id = |i: usize, j: usize| ((i % nu) * nv + j % nv) as u32;
    let mut tris = Vec::with_capacity(2 * nu * nv);
    for i in 0..nu {
        for j in 0..nv {
            let (a, b, c, d) = (id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
            tris.push([a, b, c]);
            tris.push([a, c, d]);
        }
    }
    Mesh { pts, tris }
}

// the outward direction of the true surface near point p
fn outward(shape: u32, p: P) -> P {
    if shape == 1 {
        let w = (p[0] * p[0] + p[2] * p[2]).sqrt();
        let core = [p[0] / w * RING, 0.0, p[2] / w * RING];
        unit(sub(p, core))
    } else { unit(p) }
}

fn build(shape: u32, level: u32) -> Mesh {
    let level = level.min(LEVELS - 1);
    let mut m = if shape == 1 { torus(level) } else {
        let mut m = icosahedron();
        for _ in 0..level { m = subdivide(&m); }
        if shape == 2 { for p in m.pts.iter_mut() { *p = scale(*p, pebble_r(*p)); } }
        m
    };
    // wind every triangle anticlockwise seen from outside
    for t in m.tris.iter_mut() {
        let [a, b, c] = t.map(|i| m.pts[i as usize]);
        let n = cross(sub(b, a), sub(c, a));
        let centre = scale(add(add(a, b), c), 1.0 / 3.0);
        if dot(n, outward(shape, centre)) < 0.0 { t.swap(1, 2); }
    }
    m
}

/// The corner points of shape `shape` at level `level`: x, y, z for each corner, one after another.
#[wasm_bindgen]
pub fn mesh_points(shape: u32, level: u32) -> Vec<f64> { build(shape, level).pts.iter().flatten().copied().collect() }

/// The triangles: three corner numbers each, anticlockwise seen from outside.
#[wasm_bindgen]
pub fn mesh_triangles(shape: u32, level: u32) -> Vec<u32> { build(shape, level).tris.iter().flatten().copied().collect() }

/// The direction each corner faces, for smooth shading: the average of the directions its triangles
/// face, each weighted by its area (x, y, z per corner, each of length 1).
#[wasm_bindgen]
pub fn corner_normals(shape: u32, level: u32) -> Vec<f64> {
    let m = build(shape, level);
    let mut ns = vec![[0.0; 3]; m.pts.len()];
    for &[a, b, c] in &m.tris {
        let (pa, pb, pc) = (m.pts[a as usize], m.pts[b as usize], m.pts[c as usize]);
        let n = cross(sub(pb, pa), sub(pc, pa));   // its length is twice the triangle's area
        for i in [a, b, c] { ns[i as usize] = add(ns[i as usize], n); }
    }
    ns.iter().flat_map(|&n| unit(n)).collect()
}

/// The mesh's own numbers: [triangles, corners, surface area, volume, deepest gap, typical edge length].
/// The area adds up every triangle's area (half the length of the cross product of two of its sides);
/// the volume adds up the cones from the centre to every triangle (one third of base × height), counted
/// negative where a triangle faces the centre; the deepest gap is how far the middle of a triangle lies
/// inside the true surface, at its worst.
#[wasm_bindgen]
pub fn measures(shape: u32, level: u32) -> Vec<f64> {
    let m = build(shape, level);
    let (mut area, mut vol, mut gap, mut edges) = (0.0, 0.0, 0.0f64, 0.0);
    for &[a, b, c] in &m.tris {
        let (pa, pb, pc) = (m.pts[a as usize], m.pts[b as usize], m.pts[c as usize]);
        let n = cross(sub(pb, pa), sub(pc, pa));
        area += len(n) / 2.0;
        vol += dot(pa, cross(pb, pc)) / 6.0;
        edges += len(sub(pb, pa)) + len(sub(pc, pb)) + len(sub(pa, pc));
        let mid = scale(add(add(pa, pb), pc), 1.0 / 3.0);
        gap = gap.max(depth_inside(shape, mid));
    }
    vec![m.tris.len() as f64, m.pts.len() as f64, area, vol, gap, edges / (3 * m.tris.len()) as f64]
}

// how far point p lies inside the true surface (ball and pebble: along the line from the centre)
fn depth_inside(shape: u32, p: P) -> f64 {
    if shape == 1 {
        let w = (p[0] * p[0] + p[2] * p[2]).sqrt();
        TUBE - ((w - RING).powi(2) + p[1] * p[1]).sqrt()
    } else { radius(shape, unit(p)) - len(p) }
}

/// The exact area and volume of the smooth shape: [area, volume].
#[wasm_bindgen]
pub fn exact_measures(shape: u32) -> Vec<f64> {
    match shape {
        0 => vec![4.0 * PI, 4.0 / 3.0 * PI],
        1 => vec![4.0 * PI * PI * RING * TUBE, 2.0 * PI * PI * RING * TUBE * TUBE],
        _ => pebble_exact(),
    }
}

// The pebble's surface is r(d)·d over all directions d. A small patch of directions of size dΩ becomes
// surface of area r·√(r² + |g|²)·dΩ, where g is how fast r changes sideways (the gradient of r with its
// outward part removed), and a cone of volume r³/3·dΩ. Add these up over a fine grid of directions,
// with u = cos(latitude) so that dΩ = du·dφ.
fn pebble_exact() -> Vec<f64> {
    let (nu, nphi) = (2000, 400);
    let (du, dphi) = (2.0 / nu as f64, 2.0 * PI / nphi as f64);
    let (mut area, mut vol) = (0.0, 0.0);
    for i in 0..nu {
        let u = -1.0 + (i as f64 + 0.5) * du;
        let s = (1.0 - u * u).sqrt();
        for j in 0..nphi {
            let phi = (j as f64 + 0.5) * dphi;
            let d = [s * phi.cos(), u, s * phi.sin()];
            let r = pebble_r(d);
            let g = pebble_grad(d);
            let side = sub(g, scale(d, dot(g, d)));
            area += r * (r * r + dot(side, side)).sqrt();
            vol += r * r * r / 3.0;
        }
    }
    vec![area * du * dphi, vol * du * dphi]
}

/// A circle of radius 1 drawn with n straight pieces (Archimedes): [half the perimeter of the polygon
/// inside, half the perimeter of the polygon outside, the gap between a piece and the circle at its
/// middle]. π lies between the first two, and the gap is 1 − cos(π/n).
#[wasm_bindgen]
pub fn circle_polygons(n: u32) -> Vec<f64> {
    let n = n.max(3) as f64;
    vec![n * (PI / n).sin(), n * (PI / n).tan(), 1.0 - (PI / n).cos()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_grow_four_times_per_level() {
        let mut want = 20.0;
        for l in 0..LEVELS {
            let m = measures(0, l);
            assert_eq!(m[0], want, "ball level {l}");
            // a closed surface made of triangles: corners − edges + faces = 2, and edges = 3/2 faces
            assert_eq!(m[1] - 1.5 * m[0] + m[0], 2.0);
            want *= 4.0;
        }
        let t = measures(1, 2);
        assert_eq!(t[0], 4.0 * 9.0 * 9.0);
        assert_eq!(t[1] - 1.5 * t[0] + t[0], 0.0, "a doughnut has V − E + F = 0");
    }

    #[test]
    fn every_triangle_faces_out() {
        for shape in 0..3 {
            for l in 0..4 {
                let (p, t) = (mesh_points(shape, l), mesh_triangles(shape, l));
                let pt = |i: u32| [p[3 * i as usize], p[3 * i as usize + 1], p[3 * i as usize + 2]];
                for k in t.chunks(3) {
                    let (a, b, c) = (pt(k[0]), pt(k[1]), pt(k[2]));
                    let mid = scale(add(add(a, b), c), 1.0 / 3.0);
                    assert!(dot(cross(sub(b, a), sub(c, a)), outward(shape, mid)) > 0.0);
                }
                assert!(measures(shape, l)[3] > 0.0);
            }
        }
    }

    #[test]
    fn meshes_close_in_on_the_exact_shape() {
        for shape in 0..3 {
            let ex = exact_measures(shape);
            let mut last = [f64::INFINITY; 3];
            for l in 0..LEVELS {
                let m = measures(shape, l);
                let errs = [(ex[0] - m[2]).abs(), (ex[1] - m[3]).abs(), m[4]];
                for k in 0..3 { assert!(errs[k] < last[k], "shape {shape} level {l} measure {k}: {} then {}", last[k], errs[k]); }
                last = errs;
            }
            assert!(last[0] / ex[0] < 0.002 && last[1] / ex[1] < 0.003, "shape {shape}: {last:?}");
        }
    }

    #[test]
    fn halving_the_triangles_quarters_the_gap() {
        // each level halves the edges; the gap shrinks about 4 times
        let gaps: Vec<f64> = (0..LEVELS).map(|l| measures(0, l)[4]).collect();
        for w in gaps.windows(2).skip(1) { let r = w[0] / w[1]; assert!(r > 3.6 && r < 4.4, "{r}"); }
        let errs: Vec<f64> = (0..LEVELS).map(|l| 4.0 * PI - measures(0, l)[2]).collect();
        for w in errs.windows(2).skip(1) { let r = w[0] / w[1]; assert!(r > 3.6 && r < 4.4, "{r}"); }
    }

    #[test]
    fn the_ball_is_inscribed() {
        // every corner is on the ball, every triangle inside it
        let p = mesh_points(0, 3);
        for c in p.chunks(3) { assert!((len([c[0], c[1], c[2]]) - 1.0).abs() < 1e-12); }
        let m = measures(0, 0);
        // the icosahedron of circumradius 1: edge 4/√(10 + 2√5), area 5·√3·edge²
        let e = 4.0 / (10.0 + 2.0 * 5f64.sqrt()).sqrt();
        assert!((m[2] - 5.0 * 3f64.sqrt() * e * e).abs() < 1e-12);
        assert!((m[5] - e).abs() < 1e-12);
    }

    #[test]
    fn pebble_exact_agrees_with_a_fine_mesh() {
        let ex = exact_measures(2);
        let fine = { let mut m = icosahedron(); for _ in 0..7 { m = subdivide(&m); } m };
        let (mut area, mut vol) = (0.0, 0.0);
        for &[a, b, c] in &fine.tris {
            let [pa, pb, pc] = [a, b, c].map(|i| scale(fine.pts[i as usize], pebble_r(fine.pts[i as usize])));
            area += len(cross(sub(pb, pa), sub(pc, pa))).abs() / 2.0;
            vol += dot(pa, cross(pb, pc)).abs() / 6.0;
        }
        assert!((area - ex[0]).abs() / ex[0] < 1e-4, "{area} {}", ex[0]);
        assert!((vol - ex[1]).abs() / ex[1] < 1e-4, "{vol} {}", ex[1]);
    }

    #[test]
    fn corner_normals_point_out() {
        for shape in 0..3 {
            let (p, n) = (mesh_points(shape, 2), corner_normals(shape, 2));
            for (c, d) in p.chunks(3).zip(n.chunks(3)) {
                let (c, d) = ([c[0], c[1], c[2]], [d[0], d[1], d[2]]);
                assert!((len(d) - 1.0).abs() < 1e-12);
                assert!(dot(d, outward(shape, c)) > 0.8);
            }
        }
    }

    #[test]
    fn archimedes_squeezes_pi() {
        let mut n = 6;
        let mut last = circle_polygons(3);
        while n <= 96 {
            let c = circle_polygons(n);
            assert!(c[0] < PI && PI < c[1] && c[0] > last[0] && c[1] < last[1]);
            assert!((c[2] - (1.0 - (PI / n as f64).cos())).abs() < 1e-15);
            last = c; n *= 2;
        }
        // Archimedes' 96-gon: 3 10/71 < π < 3 1/7
        assert!(last[0] > 3.0 + 10.0 / 71.0 && last[1] < 3.0 + 1.0 / 7.0);
    }
}
