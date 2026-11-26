//! Chaos: the Lorenz system, nearby starts drifting apart, the growth of a tiny difference, and the
//! logistic map as a simpler chaotic rule. Fixed-step RK4; time in Lorenz's dimensionless units.
//!
//! dx/dt = σ(y − x), dy/dt = x(ρ − z) − y, dz/dt = xy − βz, with Lorenz's σ = 10, β = 8/3 and ρ = 28.
use wasm_bindgen::prelude::*;

pub const SIGMA: f64 = 10.0;
pub const BETA: f64 = 8.0 / 3.0;
pub const RHO: f64 = 28.0;
/// The step the page uses.
pub const H: f64 = 0.005;

/// The three rates at (x, y, z): the arrow the rules attach to that point.
pub fn rates(s: [f64; 3], sigma: f64, rho: f64, beta: f64) -> [f64; 3] {
    [sigma * (s[1] - s[0]), s[0] * (rho - s[2]) - s[1], s[0] * s[1] - beta * s[2]]
}

fn add(a: [f64; 3], k: [f64; 3], f: f64) -> [f64; 3] { [a[0] + f * k[0], a[1] + f * k[1], a[2] + f * k[2]] }

/// One RK4 step of size h.
pub fn rk4(s: [f64; 3], h: f64, sigma: f64, rho: f64, beta: f64) -> [f64; 3] {
    let k1 = rates(s, sigma, rho, beta);
    let k2 = rates(add(s, k1, h / 2.0), sigma, rho, beta);
    let k3 = rates(add(s, k2, h / 2.0), sigma, rho, beta);
    let k4 = rates(add(s, k3, h), sigma, rho, beta);
    let mut o = [0.0; 3];
    for i in 0..3 { o[i] = s[i] + h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]); }
    o
}

fn step(s: [f64; 3], h: f64, rho: f64) -> [f64; 3] { rk4(s, h, SIGMA, rho, BETA) }
fn dist(a: [f64; 3], b: [f64; 3]) -> f64 { ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt() }
fn run(mut s: [f64; 3], rho: f64, h: f64, t: f64) -> [f64; 3] { for _ in 0..(t / h).round() as usize { s = step(s, h, rho); } s }

/// The rates at one point, for the step-1 figure: [dx/dt, dy/dt, dz/dt].
#[wasm_bindgen]
pub fn lorenz_rates(x: f64, y: f64, z: f64, rho: f64) -> Vec<f64> { rates([x, y, z], SIGMA, rho, BETA).to_vec() }

/// One RK4 step from (x, y, z): the new point.
#[wasm_bindgen]
pub fn lorenz_step(x: f64, y: f64, z: f64, h: f64, rho: f64) -> Vec<f64> { step([x, y, z], h, rho).to_vec() }

/// The four slopes RK4 samples in one step and where it samples them, for the step-2 figure:
/// [p1 (3), k1 (3), p2, k2, p3, k3, p4, k4, new point (3)] = 27 numbers. p1 is the start, p2 and p3
/// are half a step along k1 and k2, p4 a full step along k3.
#[wasm_bindgen]
pub fn rk4_stages(x: f64, y: f64, z: f64, h: f64, rho: f64) -> Vec<f64> {
    let s = [x, y, z];
    let k1 = rates(s, SIGMA, rho, BETA);
    let p2 = add(s, k1, h / 2.0); let k2 = rates(p2, SIGMA, rho, BETA);
    let p3 = add(s, k2, h / 2.0); let k3 = rates(p3, SIGMA, rho, BETA);
    let p4 = add(s, k3, h); let k4 = rates(p4, SIGMA, rho, BETA);
    let mut out = Vec::with_capacity(27);
    for v in [s, k1, p2, k2, p3, k3, p4, k4, step(s, h, rho)] { out.extend_from_slice(&v); }
    out
}

/// C+ and C− for this rho: [x+, y+, z, x−, y−, z]; empty when rho <= 1 (only the origin rests).
#[wasm_bindgen]
pub fn fixed_points(rho: f64) -> Vec<f64> {
    if rho <= 1.0 { return vec![]; }
    let a = (BETA * (rho - 1.0)).sqrt();
    vec![a, a, rho - 1.0, -a, -a, rho - 1.0]
}

/// A point on the attractor: (1, 1, 1) run for `skip` time units at rho 28, so the page starts on the butterfly.
#[wasm_bindgen]
pub fn settled_start(skip: f64) -> Vec<f64> { run([1.0, 1.0, 1.0], RHO, H, skip).to_vec() }

/// A trajectory from (x, y, z): `n` points, one every `every` RK4 steps of size h. Flat xyz, the start first.
#[wasm_bindgen]
pub fn trajectory(x: f64, y: f64, z: f64, rho: f64, h: f64, n: usize, every: usize) -> Vec<f64> {
    let mut s = [x, y, z];
    let mut out = Vec::with_capacity(3 * n);
    for _ in 0..n {
        out.extend_from_slice(&s);
        for _ in 0..every.max(1) { s = step(s, h, rho); }
    }
    out
}

/// Two runs side by side, A from (x, y, z) and B from (x + dx, y + dy, z + dz): the distance between them
/// at times 0, every·h, 2·every·h, … (`n` values).
#[wasm_bindgen]
pub fn separation(x: f64, y: f64, z: f64, dx: f64, dy: f64, dz: f64, rho: f64, h: f64, n: usize, every: usize) -> Vec<f64> {
    let (mut a, mut b) = ([x, y, z], [x + dx, y + dy, z + dz]);
    let mut out = Vec::with_capacity(n);
    for _ in 0..n {
        out.push(dist(a, b));
        for _ in 0..every.max(1) { a = step(a, h, rho); b = step(b, h, rho); }
    }
    out
}

/// Many runs stepped together (A, B, or a whole cloud). Positions flat [x0,y0,z0,x1,...].
#[wasm_bindgen]
pub struct Flock { pos: Vec<f64>, rho: f64, t: f64 }

#[wasm_bindgen]
impl Flock {
    /// n runs, all at (1, 1, 1), t = 0.
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, rho: f64) -> Flock { Flock { pos: [1.0, 1.0, 1.0].repeat(n), rho, t: 0.0 } }
    pub fn set(&mut self, i: usize, x: f64, y: f64, z: f64) {
        if 3 * i + 2 < self.pos.len() { self.pos[3 * i] = x; self.pos[3 * i + 1] = y; self.pos[3 * i + 2] = z; }
    }
    pub fn set_rho(&mut self, rho: f64) { self.rho = rho; }
    pub fn set_time(&mut self, t: f64) { self.t = t; }
    /// n points in a ball of radius r round (x,y,z), from a seeded xorshift so every browser gets the same cloud.
    pub fn scatter(&mut self, from: usize, n: usize, x: f64, y: f64, z: f64, r: f64, seed: u32) {
        let mut s: u32 = seed.max(1);
        let mut next = || { s ^= s << 13; s ^= s >> 17; s ^= s << 5; s as f64 / u32::MAX as f64 * 2.0 - 1.0 };
        for i in from..(from + n).min(self.len()) {
            // rejection sampling: uniform in the ball
            let (u, v, w) = loop { let (u, v, w) = (next(), next(), next()); if u * u + v * v + w * w <= 1.0 { break (u, v, w); } };
            self.set(i, x + r * u, y + r * v, z + r * w);
        }
    }
    /// Advance every run by `steps` RK4 steps of size h. Returns the new model time.
    pub fn advance(&mut self, steps: usize, h: f64) -> f64 {
        let rho = self.rho;
        for p in self.pos.chunks_exact_mut(3) {
            let mut s = [p[0], p[1], p[2]];
            for _ in 0..steps { s = step(s, h, rho); }
            p.copy_from_slice(&s);
        }
        self.t += steps as f64 * h;
        self.t
    }
    pub fn positions(&self) -> Vec<f64> { self.pos.clone() }
    pub fn get(&self, i: usize) -> Vec<f64> { self.pos.get(3 * i..3 * i + 3).map(|s| s.to_vec()).unwrap_or_default() }
    pub fn time(&self) -> f64 { self.t }
    pub fn len(&self) -> usize { self.pos.len() / 3 }
    pub fn is_empty(&self) -> bool { self.pos.is_empty() }
    /// |run i − run j|.
    pub fn distance(&self, i: usize, j: usize) -> f64 {
        let (a, b) = (self.get(i), self.get(j));
        if a.len() < 3 || b.len() < 3 { return f64::NAN; }
        dist([a[0], a[1], a[2]], [b[0], b[1], b[2]])
    }
    /// RMS distance of runs from..from+n from their centre (the cloud's spread), and their bounding-box volume: [spread, volume].
    pub fn spread(&self, from: usize, n: usize) -> Vec<f64> {
        let end = (from + n).min(self.len());
        if end <= from { return vec![0.0, 0.0]; }
        let pts: Vec<&[f64]> = (from..end).map(|i| &self.pos[3 * i..3 * i + 3]).collect();
        let m = pts.len() as f64;
        let mut c = [0.0; 3];
        let (mut lo, mut hi) = ([f64::INFINITY; 3], [f64::NEG_INFINITY; 3]);
        for p in &pts { for k in 0..3 { c[k] += p[k] / m; lo[k] = lo[k].min(p[k]); hi[k] = hi[k].max(p[k]); } }
        let ms = pts.iter().map(|p| (0..3).map(|k| (p[k] - c[k]).powi(2)).sum::<f64>()).sum::<f64>() / m;
        vec![ms.sqrt(), (0..3).map(|k| hi[k] - lo[k]).product()]
    }
}

/// One long settled run for the grey butterfly behind the picture: skip `skip` time units, then `n` points
/// every `every` steps. Flat xyz.
#[wasm_bindgen]
pub fn skeleton(rho: f64, skip: f64, n: usize, every: usize) -> Vec<f64> {
    let s = run([1.0, 1.0, 1.0], rho, H, skip);
    trajectory(s[0], s[1], s[2], rho, H, n, every)
}

/// Least-squares slope of ys against ts (λ from a log-gap plot). NaN when fewer than 2 points.
#[wasm_bindgen]
pub fn fit_slope(ts: &[f64], ys: &[f64]) -> f64 {
    let n = ts.len().min(ys.len());
    if n < 2 { return f64::NAN; }
    let (mt, my) = (ts[..n].iter().sum::<f64>() / n as f64, ys[..n].iter().sum::<f64>() / n as f64);
    let (mut sxy, mut sxx) = (0.0, 0.0);
    for i in 0..n { sxy += (ts[i] - mt) * (ys[i] - my); sxx += (ts[i] - mt).powi(2); }
    if sxx == 0.0 { f64::NAN } else { sxy / sxx }
}

/// How fast a tiny difference grows, read straight off two runs: the slope of ln(distance) against time
/// while the gap is still small (between 10·d0 and `cap`), A from (x, y, z) and B nudged by d0 in x.
/// Returns [slope λ, t_from, t_to, intercept]: the fitted line is ln d = intercept + λ·t over [t_from, t_to].
/// All NaN when the gap never gets into that window within t_max.
#[wasm_bindgen]
pub fn growth_rate(x: f64, y: f64, z: f64, d0: f64, cap: f64, rho: f64, h: f64, t_max: f64) -> Vec<f64> {
    let (mut a, mut b) = ([x, y, z], [x + d0, y, z]);
    let (mut ts, mut ys) = (vec![], vec![]);
    let n = (t_max / h).round() as usize;
    for i in 1..=n {
        a = step(a, h, rho); b = step(b, h, rho);
        let (t, d) = (i as f64 * h, dist(a, b));
        if d > cap { break; }
        if d >= 10.0 * d0 { ts.push(t); ys.push(d.ln()); }
    }
    if ts.len() < 2 { return vec![f64::NAN; 4]; }
    let lam = fit_slope(&ts, &ys);
    let (mt, my) = (ts.iter().sum::<f64>() / ts.len() as f64, ys.iter().sum::<f64>() / ys.len() as f64);
    vec![lam, ts[0], ts[ts.len() - 1], my - lam * mt]
}

/// For each nudge d in `nudges`, the model time at which |A − B| first exceeds `delta`, A from (x,y,z) and B from
/// (x+d, y, z), both at rho, RK4 step h, giving up at t_max (returns t_max then). Flat, same order as nudges.
#[wasm_bindgen]
pub fn horizon(x: f64, y: f64, z: f64, rho: f64, nudges: &[f64], delta: f64, h: f64, t_max: f64) -> Vec<f64> {
    nudges.iter().map(|&d| {
        let (mut a, mut b, mut t) = ([x, y, z], [x + d, y, z], 0.0);
        while t < t_max {
            a = step(a, h, rho); b = step(b, h, rho); t += h;
            if dist(a, b) > delta { return t; }
        }
        t_max
    }).collect()
}

/// Largest Lyapunov exponent by the Benettin method: follow a run and a companion at distance d0, renormalise the
/// companion back to d0 every `renorm` time units, average ln(stretch)/renorm after a transient. ≈ 0.906 at rho 28.
#[wasm_bindgen]
pub fn lyapunov(rho: f64, t_total: f64, h: f64) -> f64 {
    let (d0, renorm, transient) = (1e-8, 0.5, 20.0);
    let per = (renorm / h).round().max(1.0) as usize;
    let mut a = run([1.0, 1.0, 1.0], rho, h, transient);
    let mut b = [a[0] + d0, a[1], a[2]];
    let (mut sum, mut blocks) = (0.0, 0usize);
    let n = ((t_total / renorm) as usize).max(1);
    for _ in 0..n {
        for _ in 0..per { a = step(a, h, rho); b = step(b, h, rho); }
        let d = dist(a, b);
        if d == 0.0 { return f64::NEG_INFINITY; }
        sum += (d / d0).ln();
        blocks += 1;
        for k in 0..3 { b[k] = a[k] + (b[k] - a[k]) * d0 / d; }
    }
    sum / (blocks as f64 * per as f64 * h)
}

// ---------- the logistic map: x → r·x(1 − x), a one-line rule that is just as chaotic ----------

/// x_0, x_1, …, x_n from x0 under x → r·x(1 − x) (n + 1 values).
#[wasm_bindgen]
pub fn logistic_iterate(r: f64, x0: f64, n: usize) -> Vec<f64> {
    let mut x = x0;
    let mut out = Vec::with_capacity(n + 1);
    out.push(x);
    for _ in 0..n { x = r * x * (1.0 - x); out.push(x); }
    out
}

/// The bifurcation picture: for `nr` values of r from r0 to r1, run `skip` steps from 0.5 then keep `keep`
/// values. Flat [r, x, r, x, …].
#[wasm_bindgen]
pub fn logistic_bifurcation(r0: f64, r1: f64, nr: usize, skip: usize, keep: usize) -> Vec<f64> {
    let mut out = Vec::with_capacity(2 * nr * keep);
    for i in 0..nr {
        let r = if nr > 1 { r0 + (r1 - r0) * i as f64 / (nr - 1) as f64 } else { r0 };
        let mut x = 0.5;
        for _ in 0..skip { x = r * x * (1.0 - x); }
        for _ in 0..keep { x = r * x * (1.0 - x); out.push(r); out.push(x); }
    }
    out
}

/// The logistic map's growth rate at r: the average of ln|r(1 − 2x)| along a long run (its Lyapunov exponent).
/// Positive means chaos; ln 2 ≈ 0.693 at r = 4.
#[wasm_bindgen]
pub fn logistic_lyapunov(r: f64, n: usize) -> f64 {
    let mut x = 0.3;
    for _ in 0..500 { x = r * x * (1.0 - x); }
    let mut sum = 0.0;
    for _ in 0..n.max(1) { sum += (r * (1.0 - 2.0 * x)).abs().ln(); x = r * x * (1.0 - x); }
    sum / n.max(1) as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixed_points_stay_fixed() {
        let f = fixed_points(28.0);
        let a = (BETA * 27.0).sqrt();
        assert!((a - 72f64.sqrt()).abs() < 1e-12 && (a - 8.48528).abs() < 1e-5);
        assert!((f[0] - a).abs() < 1e-12 && (f[1] - a).abs() < 1e-12 && f[2] == 27.0);
        assert!((f[3] + a).abs() < 1e-12 && (f[4] + a).abs() < 1e-12 && f[5] == 27.0);
        for c in [[f[0], f[1], f[2]], [f[3], f[4], f[5]]] {
            assert!(rates(c, SIGMA, 28.0, BETA).iter().all(|r| r.abs() < 1e-12));
            assert!(dist(rk4(c, 0.01, SIGMA, 28.0, BETA), c) < 1e-12);
            assert!(dist(run(c, 28.0, H, 5.0), c) < 1e-9);
        }
        assert!(fixed_points(0.5).is_empty());
        assert!(rates([0.0, 0.0, 0.0], SIGMA, 28.0, BETA).iter().all(|r| *r == 0.0));
    }

    #[test]
    fn a_millionth_apart_become_more_than_one_apart_within_30() {
        let s = settled_start(20.0);
        let (mut a, mut b) = ([s[0], s[1], s[2]], [s[0] + 1e-6, s[1], s[2]]);
        let mut t = 0.0;
        while t < 30.0 && dist(a, b) < 1.0 { a = step(a, H, 28.0); b = step(b, H, 28.0); t += H; }
        assert!(dist(a, b) > 1.0, "only {} apart after 30", dist(a, b));
        assert!(t > 5.0, "parted suspiciously fast, at t = {t}");
        // the same from separation(): it is one run, so it says the same
        let sep = separation(s[0], s[1], s[2], 1e-6, 0.0, 0.0, 28.0, H, 6001, 1);
        assert!((sep[0] - 1e-6).abs() < 1e-12 && sep.iter().any(|&d| d > 1.0));
    }

    #[test]
    fn growth_rate_is_about_0_9_per_time_unit() {
        let s = settled_start(20.0);
        let g = growth_rate(s[0], s[1], s[2], 1e-6, 1.0, 28.0, H, 40.0);
        assert!(g[0] > 0.7 && g[0] < 1.1, "slope {}", g[0]);
        assert!(g[1] > 0.0 && g[2] > g[1] + 3.0, "window {} .. {}", g[1], g[2]);
        // a different start and nudge give about the same slope
        let s2 = settled_start(33.0);
        let g2 = growth_rate(s2[0], s2[1], s2[2], 1e-7, 1.0, 28.0, H, 40.0);
        assert!(g2[0] > 0.6 && g2[0] < 1.2, "slope {}", g2[0]);
        // and the careful estimate lands near 0.906
        let l = lyapunov(28.0, 2000.0, 0.01);
        assert!(l > 0.8 && l < 1.0, "λ = {l}");
        assert!(lyapunov(20.0, 500.0, 0.01) < 0.0);
    }

    #[test]
    fn logistic_at_3_2_settles_into_a_2_cycle() {
        let xs = logistic_iterate(3.2, 0.3, 1000);
        let (a, b, c, d) = (xs[997], xs[998], xs[999], xs[1000]);
        assert!((a - c).abs() < 1e-9 && (b - d).abs() < 1e-9, "{a} {b} {c} {d}");
        assert!((a - b).abs() > 0.2, "not a real cycle: {a} {b}");
        // the known 2-cycle: (1 + r ± √((r−3)(r+1))) / (2r)
        let r: f64 = 3.2;
        let q = ((r - 3.0) * (r + 1.0)).sqrt();
        let (p, m) = ((1.0 + r + q) / (2.0 * r), (1.0 + r - q) / (2.0 * r));
        assert!((a.max(b) - p).abs() < 1e-9 && (a.min(b) - m).abs() < 1e-9);
        // at 2.8 it settles to one value, 1 − 1/r
        let ys = logistic_iterate(2.8, 0.3, 500);
        assert!((ys[500] - (1.0 - 1.0 / 2.8)).abs() < 1e-9);
        // at 3.9 two starts 0.001 apart separate
        let (u, v) = (logistic_iterate(3.9, 0.3, 40), logistic_iterate(3.9, 0.301, 40));
        assert!((u[40] - v[40]).abs() > 0.1);
        assert!(logistic_lyapunov(3.9, 20_000) > 0.3 && logistic_lyapunov(2.8, 20_000) < 0.0);
        assert!((logistic_lyapunov(4.0, 50_000) - 2f64.ln()).abs() < 0.05);
    }

    #[test]
    fn bifurcation_has_one_value_then_two() {
        let one = logistic_bifurcation(2.8, 2.8, 1, 500, 10);
        assert!(one.chunks(2).all(|p| (p[1] - one[1]).abs() < 1e-9));
        let two = logistic_bifurcation(3.2, 3.2, 1, 500, 10);
        let mut xs: Vec<f64> = two.chunks(2).map(|p| p[1]).collect();
        xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
        assert!(xs[9] - xs[0] > 0.2 && xs[4] - xs[0] < 1e-9 && xs[9] - xs[5] < 1e-9);
        assert_eq!(logistic_bifurcation(2.5, 4.0, 300, 100, 50).len(), 2 * 300 * 50);
    }

    #[test]
    fn rk4_is_accurate_and_stages_agree() {
        let (a, b) = (run([1.0, 1.0, 1.0], 28.0, 0.01, 1.0), run([1.0, 1.0, 1.0], 28.0, 0.001, 1.0));
        assert!(dist(a, b) < 1e-3, "{a:?} vs {b:?}");
        let st = rk4_stages(1.0, 1.0, 1.0, 0.01, 28.0);
        assert_eq!(st.len(), 27);
        assert_eq!(&st[24..27], &lorenz_step(1.0, 1.0, 1.0, 0.01, 28.0)[..]);
        assert_eq!(&st[3..6], &lorenz_rates(1.0, 1.0, 1.0, 28.0)[..]);
        let tr = trajectory(1.0, 1.0, 1.0, 28.0, 0.01, 101, 1);
        assert!(dist([tr[300], tr[301], tr[302]], a) < 1e-12);
    }

    #[test]
    fn at_28_it_stays_on_the_butterfly_and_is_symmetric() {
        let (mut s, h) = ([1.0, 1.0, 1.0], 0.01);
        let (mut flips, mut prev) = (0, 1.0f64);
        for i in 0..50_000 {
            s = step(s, h, 28.0);
            assert!(s[0].abs() < 25.0 && s[1].abs() < 30.0 && s[2] > 0.0 && s[2] < 50.0, "left the box at step {i}: {s:?}");
            if i >= 40_000 && s[0].signum() != prev.signum() { flips += 1; }
            prev = s[0];
        }
        assert!(flips >= 40, "x changed sign {flips} times");
        let (mut p, mut q) = ([1.0, 1.0, 1.0], [-1.0, -1.0, 1.0]);
        for _ in 0..5000 { p = step(p, 0.01, 28.0); q = step(q, 0.01, 28.0); assert_eq!([-p[0], -p[1], p[2]], q); }
    }

    #[test]
    fn flock_twins_never_part_and_clouds_repeat() {
        let mut f = Flock::new(3, 28.0);
        f.set(0, 1.0, 1.0, 1.0); f.set(1, 1.0, 1.0, 1.0); f.set(2, 1.0001, 1.0, 1.0);
        f.advance(10_000, H);
        assert_eq!(f.distance(0, 1), 0.0);
        assert!(f.distance(0, 2) > 0.1);
        assert!((f.time() - 50.0).abs() < 1e-9);
        let (mut f, mut g) = (Flock::new(500, 28.0), Flock::new(500, 28.0));
        f.scatter(0, 500, 1.0, 2.0, 3.0, 0.01, 7); g.scatter(0, 500, 1.0, 2.0, 3.0, 0.01, 7);
        assert_eq!(f.positions(), g.positions());
        for i in 0..500 { let p = f.get(i); assert!(dist([1.0, 2.0, 3.0], [p[0], p[1], p[2]]) <= 0.01 + 1e-15); }
        let sp = f.spread(0, 500);
        assert!(sp[0] > 0.003 && sp[0] < 0.01 && sp[1] > 0.0);
    }

    #[test]
    fn horizon_grows_with_the_log_of_precision() {
        let s = settled_start(20.0);
        let hz = horizon(s[0], s[1], s[2], 28.0, &[1e-2, 1e-4, 1e-6, 1e-8], 10.0, 0.01, 100.0);
        for w in hz.windows(2) { assert!(w[1] - w[0] > 1.0 && w[1] - w[0] < 8.0, "{hz:?}"); }
        assert!(hz[3] < 100.0);
        assert!((fit_slope(&[0.0, 1.0, 2.0], &[1.0, 3.0, 5.0]) - 2.0).abs() < 1e-12);
        assert!(fit_slope(&[1.0], &[1.0]).is_nan());
    }
}
