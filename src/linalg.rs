//! Linear algebra for the matrix pages. A 2×2 matrix is passed as a, b, c, d for [[a, b], [c, d]]:
//! its columns (a, c) and (b, d) are where the arrows î = (1, 0) and ĵ = (0, 1) land. A few pieces
//! work on any length or size: the dot product, cosine similarity and the SVD of a small picture.
use wasm_bindgen::prelude::*;

const EPS: f64 = 1e-12;

/// How much the matrix scales area (negative: it flips space over).
#[wasm_bindgen] pub fn det2(a: f64, b: f64, c: f64, d: f64) -> f64 { a * d - b * c }

/// [[a, b], [c, d]] · [[e, f], [g, h]]: first do the right-hand move, then the left.
#[wasm_bindgen]
pub fn mul2(a: f64, b: f64, c: f64, d: f64, e: f64, f: f64, g: f64, h: f64) -> Vec<f64> {
    vec![a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h]
}

/// The move that undoes this one, or empty when there is none (determinant 0).
#[wasm_bindgen]
pub fn inv2(a: f64, b: f64, c: f64, d: f64) -> Vec<f64> {
    let det = det2(a, b, c, d);
    if det.abs() < EPS { return vec![]; }
    vec![d / det, -b / det, -c / det, a / det]
}

fn unit(x: f64, y: f64) -> (f64, f64) { let n = x.hypot(y); if n < EPS { (1.0, 0.0) } else { (x / n, y / n) } }

// a direction with (A − λI)v = 0, or None when every direction works (A = λI)
fn eigvec(a: f64, b: f64, c: f64, d: f64, l: f64) -> Option<(f64, f64)> {
    let (p, q) = ((b, l - a), (l - d, c));
    let (np, nq) = (p.0.hypot(p.1), q.0.hypot(q.1));
    let scale = 1.0 + a.abs() + b.abs() + c.abs() + d.abs();
    if np.max(nq) < 1e-9 * scale { return None; }
    Some(if np >= nq { unit(p.0, p.1) } else { unit(q.0, q.1) })
}

/// Eigenvalues and unit eigenvectors, biggest |λ| first: [λ1, λ2, v1x, v1y, v2x, v2y].
/// When they are complex (the matrix turns every direction) returns [re, im] instead.
/// For a shear both vectors are the same line.
#[wasm_bindgen]
pub fn eig2(a: f64, b: f64, c: f64, d: f64) -> Vec<f64> {
    let (half, det) = ((a + d) / 2.0, det2(a, b, c, d));
    let disc = half * half - det;
    if disc < -1e-12 { return vec![half, (-disc).sqrt()]; }
    let r = disc.max(0.0).sqrt();
    let (mut l1, mut l2) = (half + r, half - r);
    if l2.abs() > l1.abs() { std::mem::swap(&mut l1, &mut l2); }
    let (v1, v2) = (eigvec(a, b, c, d, l1), eigvec(a, b, c, d, l2));
    let (v1, v2) = match (v1, v2) {
        (Some(p), Some(q)) => (p, q),
        _ => ((1.0, 0.0), (0.0, 1.0)), // A = λI: every direction is an eigenvector
    };
    vec![l1, l2, v1.0, v1.1, v2.0, v2.1]
}

// a symmetric [[p, q], [q, r]]: eigenvalues (big first) and the first unit eigenvector
fn sym_eig(p: f64, q: f64, r: f64) -> (f64, f64, (f64, f64)) {
    let (m, h) = ((p + r) / 2.0, (((p - r) / 2.0).powi(2) + q * q).sqrt());
    let l1 = m + h;
    let v = if q.abs() < EPS { if p >= r { (1.0, 0.0) } else { (0.0, 1.0) } } else { unit(l1 - r, q) };
    (l1, m - h, v)
}

/// The SVD as three simple moves: A = R(θu) · diag(σ1, flip·σ2) · R(θv)ᵀ, returned as
/// [θv, σ1, σ2, θu, flip]. R(θ) turns by θ; σ1 ≥ σ2 ≥ 0 are the stretches; flip is −1 when the
/// matrix turns space over (negative determinant), so the stretch also mirrors.
#[wasm_bindgen]
pub fn svd2(a: f64, b: f64, c: f64, d: f64) -> Vec<f64> {
    let (l1, l2, v1) = sym_eig(a * a + c * c, a * b + c * d, b * b + d * d);
    let (s1, s2) = (l1.max(0.0).sqrt(), l2.max(0.0).sqrt());
    let tv = v1.1.atan2(v1.0);
    let u1 = if s1 > EPS { unit(a * v1.0 + b * v1.1, c * v1.0 + d * v1.1) } else { (1.0, 0.0) };
    let tu = u1.1.atan2(u1.0);
    let flip = if det2(a, b, c, d) < 0.0 { -1.0 } else { 1.0 };
    vec![tv, s1, s2, tu, flip]
}

/// a · b = a₁b₁ + a₂b₂ + … for vectors of any length.
#[wasm_bindgen] pub fn dot(a: &[f64], b: &[f64]) -> f64 { a.iter().zip(b).map(|(x, y)| x * y).sum() }

/// cos of the angle between a and b: 1 same direction, 0 at right angles, −1 opposite.
#[wasm_bindgen]
pub fn cosine(a: &[f64], b: &[f64]) -> f64 {
    let n = dot(a, a).sqrt() * dot(b, b).sqrt();
    if n < EPS { 0.0 } else { dot(a, b) / n }
}

/// The main directions of a cloud of points [x0, y0, x1, y1, ...] (principal component analysis):
/// [mean x, mean y, variance along v1, variance along v2, v1x, v1y]; v2 is v1 turned a quarter.
#[wasm_bindgen]
pub fn pca2(pts: &[f64]) -> Vec<f64> {
    let n = (pts.len() / 2).max(1) as f64;
    let (mut mx, mut my) = (0.0, 0.0);
    for p in pts.chunks(2) { mx += p[0]; my += p[1]; }
    mx /= n; my /= n;
    let (mut sxx, mut sxy, mut syy) = (0.0, 0.0, 0.0);
    for p in pts.chunks(2) { let (x, y) = (p[0] - mx, p[1] - my); sxx += x * x; sxy += x * y; syy += y * y; }
    let (l1, l2, v) = sym_eig(sxx / n, sxy / n, syy / n);
    vec![mx, my, l1, l2, v.0, v.1]
}

/// The singular value decomposition of a rows × cols grid of numbers (a small greyscale picture),
/// by one-sided Jacobi rotations. Keeps A·V (columns σⱼuⱼ) and V, sorted by σ.
#[wasm_bindgen]
pub struct Svd { rows: usize, cols: usize, av: Vec<f64>, v: Vec<f64>, sigma: Vec<f64>, order: Vec<usize> }

#[wasm_bindgen]
impl Svd {
    #[wasm_bindgen(constructor)]
    pub fn new(data: &[f64], rows: usize, cols: usize) -> Svd {
        let (m, n) = (rows, cols);
        let mut u = data.to_vec(); // m × n, row-major
        let mut v = vec![0.0; n * n];
        for i in 0..n { v[i * n + i] = 1.0; }
        for _sweep in 0..60 {
            let mut rotated = false;
            for p in 0..n {
                for q in p + 1..n {
                    let (mut al, mut be, mut ga) = (0.0, 0.0, 0.0);
                    for i in 0..m { let (x, y) = (u[i * n + p], u[i * n + q]); al += x * x; be += y * y; ga += x * y; }
                    if ga.abs() <= 1e-13 * (al * be).sqrt() || ga.abs() < 1e-300 { continue; }
                    rotated = true;
                    let z = (be - al) / (2.0 * ga);
                    let t = z.signum() / (z.abs() + (1.0 + z * z).sqrt());
                    let c = 1.0 / (1.0 + t * t).sqrt();
                    let s = c * t;
                    for i in 0..m { let (x, y) = (u[i * n + p], u[i * n + q]); u[i * n + p] = c * x - s * y; u[i * n + q] = s * x + c * y; }
                    for i in 0..n { let (x, y) = (v[i * n + p], v[i * n + q]); v[i * n + p] = c * x - s * y; v[i * n + q] = s * x + c * y; }
                }
            }
            if !rotated { break; }
        }
        let sigma: Vec<f64> = (0..n).map(|j| (0..m).map(|i| u[i * n + j].powi(2)).sum::<f64>().sqrt()).collect();
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|&x, &y| sigma[y].partial_cmp(&sigma[x]).unwrap());
        Svd { rows, cols, av: u, v, sigma, order }
    }

    /// The singular values, biggest first.
    pub fn values(&self) -> Vec<f64> { self.order.iter().map(|&j| self.sigma[j]).collect() }

    /// The best picture made from only the k biggest pieces: Σ σⱼ uⱼ vⱼᵀ over the top k.
    pub fn approx(&self, k: usize) -> Vec<f64> {
        let (m, n) = (self.rows, self.cols);
        let mut out = vec![0.0; m * n];
        for &j in self.order.iter().take(k) {
            for i in 0..m { let a = self.av[i * n + j]; for c in 0..n { out[i * n + c] += a * self.v[c * n + j]; } }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn near(a: f64, b: f64) -> bool { (a - b).abs() < 1e-9 }
    fn rot(t: f64) -> [f64; 4] { [t.cos(), -t.sin(), t.sin(), t.cos()] }

    #[test]
    fn determinants_multiply_and_inverses_undo() {
        let (a, b) = ([2.0, 1.0, 0.5, 3.0], [1.0, -1.0, 2.0, 0.5]);
        let ab = mul2(a[0], a[1], a[2], a[3], b[0], b[1], b[2], b[3]);
        assert!(near(det2(ab[0], ab[1], ab[2], ab[3]), det2(a[0], a[1], a[2], a[3]) * det2(b[0], b[1], b[2], b[3])));
        let i = inv2(a[0], a[1], a[2], a[3]);
        let id = mul2(a[0], a[1], a[2], a[3], i[0], i[1], i[2], i[3]);
        assert!(near(id[0], 1.0) && near(id[1], 0.0) && near(id[2], 0.0) && near(id[3], 1.0));
        assert!(inv2(1.0, 2.0, 2.0, 4.0).is_empty(), "a squash has no inverse");
        let r = rot(0.7);
        assert!(near(det2(r[0], r[1], r[2], r[3]), 1.0), "turning keeps area");
        assert!(near(det2(1.0, 1.5, 0.0, 1.0), 1.0), "so does a shear");
    }

    #[test]
    fn eigenvectors_stay_on_their_line() {
        let e = eig2(2.0, 1.0, 1.0, 2.0);
        assert!(near(e[0], 3.0) && near(e[1], 1.0));
        assert!(near(e[2].abs(), 0.5f64.sqrt()) && near(e[2], e[3]), "(1, 1) is stretched by 3");
        for (m, k) in [([2.0, 1.0, 0.5, -1.0], 0), ([0.3, 2.0, 1.0, 0.7], 0)] {
            let e = eig2(m[0], m[1], m[2], m[3]);
            for s in 0..2 {
                let (l, x, y) = (e[s], e[2 + 2 * s], e[3 + 2 * s]);
                assert!(near(m[0] * x + m[1] * y, l * x) && near(m[2] * x + m[3] * y, l * y), "A v = λ v ({k})");
            }
        }
        let e = eig2(0.0, -1.0, 1.0, 0.0);
        assert_eq!(e.len(), 2, "a quarter turn leaves no direction alone");
        assert!(near(e[1].abs(), 1.0));
        let f = eig2(1.0, 1.0, 1.0, 0.0);
        assert!(near(f[0], (1.0 + 5f64.sqrt()) / 2.0), "Fibonacci grows by the golden ratio");
        let s = eig2(1.0, 1.0, 0.0, 1.0);
        assert!(near(s[0], 1.0) && near(s[1], 1.0) && near(s[3], 0.0) && near(s[5], 0.0), "a shear keeps only the x-axis");
        let i = eig2(2.0, 0.0, 0.0, 2.0);
        assert!(near(i[0], 2.0) && near(i[2], 1.0) && near(i[5], 1.0));
    }

    #[test]
    fn svd_is_turn_stretch_turn() {
        for m in [[2.0, 1.0, 0.5, 3.0], [1.0, 2.0, 3.0, 1.0], [0.0, -1.0, 1.0, 0.0], [1.0, 2.0, 2.0, 4.0], [1.0, 0.0, 0.0, -1.0], [3.0, 0.0, 0.0, 0.5]] {
            let s = svd2(m[0], m[1], m[2], m[3]);
            let (tv, s1, s2, tu, f) = (s[0], s[1], s[2], s[3], s[4]);
            assert!(s1 >= s2 && s2 >= 0.0);
            let (u, v) = (rot(tu), rot(tv));
            let us = mul2(u[0], u[1], u[2], u[3], s1, 0.0, 0.0, f * s2);
            let r = mul2(us[0], us[1], us[2], us[3], v[0], v[2], v[1], v[3]); // · R(θv)ᵀ
            for k in 0..4 { assert!((r[k] - m[k]).abs() < 1e-9, "{m:?} -> {r:?}"); }
            assert!(near(s1 * s2, det2(m[0], m[1], m[2], m[3]).abs()));
        }
    }

    #[test]
    fn dot_products_and_angles() {
        assert!(near(dot(&[1.0, 2.0, 3.0], &[4.0, -5.0, 6.0]), 12.0));
        assert!(near(cosine(&[1.0, 0.0], &[0.0, 3.0]), 0.0));
        assert!(near(cosine(&[2.0, 2.0], &[5.0, 5.0]), 1.0), "length does not matter");
        let p = pca2(&[0.0, 0.1, 1.0, 0.9, 2.0, 2.1, 3.0, 2.9, -1.0, -1.0]);
        assert!((p[4] - 0.5f64.sqrt()).abs() < 0.05 && (p[5] - 0.5f64.sqrt()).abs() < 0.05, "{p:?}");
        assert!(p[2] > 50.0 * p[3]);
    }

    #[test]
    fn a_picture_from_a_few_pieces() {
        let (m, n) = (6, 5);
        let data: Vec<f64> = (0..m * n).map(|k| ((k * 37 % 11) as f64) / 7.0 - 0.6).collect();
        let s = Svd::new(&data, m, n);
        let full = s.approx(n);
        for k in 0..m * n { assert!((full[k] - data[k]).abs() < 1e-9); }
        let v = s.values();
        assert!(v.windows(2).all(|w| w[0] >= w[1] - 1e-12));
        let err = |k: usize| s.approx(k).iter().zip(&data).map(|(a, b)| (a - b).powi(2)).sum::<f64>();
        assert!(err(1) > err(2) && err(2) > err(3), "each piece makes it better");
        assert!((err(2) - v[2..].iter().map(|x| x * x).sum::<f64>()).abs() < 1e-9, "the error is exactly the dropped σ²");
        // an outer product has one piece only
        let r: Vec<f64> = (0..4).flat_map(|i| (0..3).map(move |j| (i + 1) as f64 * (j as f64 - 1.5))).collect();
        let s = Svd::new(&r, 4, 3);
        assert!(s.values()[1] < 1e-9);
    }
}
