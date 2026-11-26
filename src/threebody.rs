//! The three-body problem: N point masses in a plane under Newton's gravity, in units where G = 1.
//! Written for any N (the page uses three). Stepped with leapfrog (kick-drift-kick), the same
//! symplectic recipe as `orbit.rs`, so energy stays put instead of drifting; the step shrinks when
//! two bodies come close, and a softening ε keeps a near-collision from blowing up:
//! the pull of j on i is mᵢ mⱼ (rⱼ − rᵢ) / (|rⱼ − rᵢ|² + ε²)^(3/2).
//!
//! A system is given as three flat lists: masses `[m1, …, mN]`, positions `[x1, y1, …]` and
//! velocities `[vx1, vy1, …]`. Free functions take the same three lists.
use wasm_bindgen::prelude::*;

/// The step is ETA · min over pairs of sqrt(d³ / (mᵢ + mⱼ)) (a fraction of the local free-fall
/// time), never more than H_MAX.
pub const ETA: f64 = 0.002;
pub const H_MAX: f64 = 1e-3;
/// Most leapfrog steps one `advance` call may take before it gives up (see `System::stalled`).
pub const MAX_SUBSTEPS: usize = 400_000;

/// The figure-eight period (Chenciner–Montgomery orbit, Simó's initial conditions), in these units.
pub const EIGHT_PERIOD: f64 = 6.32591398;

fn check(m: &[f64], p: &[f64], v: &[f64]) -> usize {
    let n = m.len();
    assert!(n >= 1, "at least one body");
    assert!(p.len() == 2 * n && v.len() == 2 * n, "positions and velocities need 2 numbers per body");
    assert!(m.iter().all(|&x| x > 0.0 && x.is_finite()), "masses must be positive");
    n
}

/// Accelerations into `a` (2 per body) from masses `m`, positions `p`, softening `eps`.
fn accel_into(m: &[f64], p: &[f64], eps: f64, a: &mut [f64]) {
    let n = m.len();
    for x in a.iter_mut() { *x = 0.0; }
    for i in 0..n {
        for j in (i + 1)..n {
            let dx = p[2 * j] - p[2 * i];
            let dy = p[2 * j + 1] - p[2 * i + 1];
            let r2 = dx * dx + dy * dy + eps * eps;
            let k = 1.0 / (r2 * r2.sqrt());
            a[2 * i] += m[j] * k * dx;
            a[2 * i + 1] += m[j] * k * dy;
            a[2 * j] -= m[i] * k * dx;
            a[2 * j + 1] -= m[i] * k * dy;
        }
    }
}

/// The force on every body (mass × acceleration): [fx1, fy1, fx2, fy2, …].
#[wasm_bindgen]
pub fn forces(m: &[f64], p: &[f64], eps: f64) -> Vec<f64> {
    let n = check(m, p, &vec![0.0; 2 * m.len()]);
    let mut a = vec![0.0; 2 * n];
    accel_into(m, p, eps, &mut a);
    for i in 0..n { a[2 * i] *= m[i]; a[2 * i + 1] *= m[i]; }
    a
}

/// The separate pulls on body i from every other body j, in the order of j skipping i:
/// [fx_from_j, fy_from_j, distance_ij] for each j (3 numbers per other body).
#[wasm_bindgen]
pub fn pulls(m: &[f64], p: &[f64], eps: f64, i: usize) -> Vec<f64> {
    let n = m.len();
    let i = i.min(n.saturating_sub(1));
    let mut out = Vec::with_capacity(3 * n);
    for j in 0..n {
        if j == i { continue; }
        let dx = p[2 * j] - p[2 * i];
        let dy = p[2 * j + 1] - p[2 * i + 1];
        let r2 = dx * dx + dy * dy + eps * eps;
        let k = m[i] * m[j] / (r2 * r2.sqrt());
        out.push(k * dx);
        out.push(k * dy);
        out.push((dx * dx + dy * dy).sqrt());
    }
    out
}

/// The totals that gravity never changes: [energy, px, py, angular momentum, kinetic, potential].
#[wasm_bindgen]
pub fn totals(m: &[f64], p: &[f64], v: &[f64], eps: f64) -> Vec<f64> {
    let n = check(m, p, v);
    let (mut ke, mut px, mut py, mut l, mut pe) = (0.0, 0.0, 0.0, 0.0, 0.0);
    for i in 0..n {
        let (x, y, vx, vy) = (p[2 * i], p[2 * i + 1], v[2 * i], v[2 * i + 1]);
        ke += 0.5 * m[i] * (vx * vx + vy * vy);
        px += m[i] * vx;
        py += m[i] * vy;
        l += m[i] * (x * vy - y * vx);
        for j in (i + 1)..n {
            let dx = p[2 * j] - x;
            let dy = p[2 * j + 1] - y;
            pe -= m[i] * m[j] / (dx * dx + dy * dy + eps * eps).sqrt();
        }
    }
    vec![ke + pe, px, py, l, ke, pe]
}

fn step_size(m: &[f64], p: &[f64], eps: f64) -> f64 {
    let n = m.len();
    let mut h = H_MAX;
    for i in 0..n {
        for j in (i + 1)..n {
            let dx = p[2 * j] - p[2 * i];
            let dy = p[2 * j + 1] - p[2 * i + 1];
            let r2 = dx * dx + dy * dy + eps * eps;
            h = h.min(ETA * (r2 * r2.sqrt() / (m[i] + m[j])).sqrt());
        }
    }
    h
}

/// The system, stepped forward. `advance` takes the adaptive leapfrog steps needed to cover dt.
#[wasm_bindgen]
pub struct System { m: Vec<f64>, p: Vec<f64>, v: Vec<f64>, a: Vec<f64>, eps: f64, t: f64, stalled: bool }

#[wasm_bindgen]
impl System {
    /// Panics if the lists disagree in length or a mass is not positive.
    #[wasm_bindgen(constructor)]
    pub fn new(m: &[f64], p: &[f64], v: &[f64], eps: f64) -> System {
        let n = check(m, p, v);
        let mut s = System { m: m.to_vec(), p: p.to_vec(), v: v.to_vec(), a: vec![0.0; 2 * n], eps: eps.abs(), t: 0.0, stalled: false };
        s.refresh();
        s
    }
    /// A copy that runs on its own (for the ghost).
    pub fn copy(&self) -> System { System { m: self.m.clone(), p: self.p.clone(), v: self.v.clone(), a: self.a.clone(), eps: self.eps, t: self.t, stalled: false } }

    fn refresh(&mut self) { accel_into(&self.m, &self.p, self.eps, &mut self.a); }

    /// One leapfrog step of size h: half kick, drift, half kick (the acceleration at the new
    /// place is kept for the next step).
    fn leapfrog(&mut self, h: f64) {
        for k in 0..self.v.len() { self.v[k] += 0.5 * h * self.a[k]; }
        for k in 0..self.p.len() { self.p[k] += h * self.v[k]; }
        self.refresh();
        for k in 0..self.v.len() { self.v[k] += 0.5 * h * self.a[k]; }
        self.t += h;
    }

    /// Move dt forward with adaptive steps (never larger than H_MAX nor what is left). Gives up
    /// after MAX_SUBSTEPS steps and sets `stalled`.
    pub fn advance(&mut self, dt: f64) {
        let mut left = dt;
        let mut n = 0;
        self.stalled = false;
        while left > 1e-12 {
            if n >= MAX_SUBSTEPS { self.stalled = true; return; }
            let h = step_size(&self.m, &self.p, self.eps).min(left);
            self.leapfrog(h);
            left -= h;
            n += 1;
        }
    }

    /// Move dt forward with a fixed step h (to show what a step that is too big does).
    pub fn advance_fixed(&mut self, dt: f64, h: f64) {
        let mut left = dt;
        let h = h.abs().max(1e-9);
        while left > 1e-12 {
            let k = h.min(left);
            self.leapfrog(k);
            left -= k;
        }
    }

    pub fn n(&self) -> usize { self.m.len() }
    pub fn masses(&self) -> Vec<f64> { self.m.clone() }
    pub fn positions(&self) -> Vec<f64> { self.p.clone() }
    pub fn velocities(&self) -> Vec<f64> { self.v.clone() }
    /// The force on every body right now: [fx1, fy1, …].
    pub fn forces(&self) -> Vec<f64> { self.a.iter().enumerate().map(|(k, a)| a * self.m[k / 2]).collect() }
    /// [energy, px, py, angular momentum, kinetic, potential].
    pub fn totals(&self) -> Vec<f64> { totals(&self.m, &self.p, &self.v, self.eps) }
    pub fn time(&self) -> f64 { self.t }
    pub fn set_time(&mut self, t: f64) { self.t = t; }
    pub fn softening(&self) -> f64 { self.eps }
    pub fn set_softening(&mut self, eps: f64) { self.eps = eps.abs(); self.refresh(); }
    /// True when the last `advance` stopped early: two bodies too close to follow.
    pub fn stalled(&self) -> bool { self.stalled }

    pub fn set_mass(&mut self, i: usize, m: f64) { if i < self.m.len() && m > 0.0 && m.is_finite() { self.m[i] = m; self.refresh(); } }
    pub fn set_body(&mut self, i: usize, x: f64, y: f64, vx: f64, vy: f64) {
        if i < self.m.len() && [x, y, vx, vy].iter().all(|q| q.is_finite()) {
            self.p[2 * i] = x; self.p[2 * i + 1] = y;
            self.v[2 * i] = vx; self.v[2 * i + 1] = vy;
            self.refresh();
        }
    }
    /// The ghost's nudge: body i's velocity multiplied by (1 + f). A body at rest instead gets
    /// f times a typical orbital speed, sqrt(total mass / typical distance), along x.
    pub fn nudge_velocity(&mut self, i: usize, f: f64) {
        if i >= self.m.len() { return; }
        let speed = self.v[2 * i].hypot(self.v[2 * i + 1]);
        if speed > 1e-12 { self.v[2 * i] *= 1.0 + f; self.v[2 * i + 1] *= 1.0 + f; }
        else { self.v[2 * i] += f * self.speed_scale(); }
    }
    /// A typical orbital speed for this system: sqrt(total mass / the mean distance from the centre).
    pub fn speed_scale(&self) -> f64 {
        let mt: f64 = self.m.iter().sum();
        let n = self.m.len() as f64;
        let cx: f64 = (0..self.m.len()).map(|i| self.m[i] * self.p[2 * i]).sum::<f64>() / mt;
        let cy: f64 = (0..self.m.len()).map(|i| self.m[i] * self.p[2 * i + 1]).sum::<f64>() / mt;
        let d: f64 = (0..self.m.len()).map(|i| (self.p[2 * i] - cx).hypot(self.p[2 * i + 1] - cy)).sum::<f64>() / n;
        (mt / d.max(1e-6)).sqrt()
    }

    /// Subtract the centre-of-mass position and velocity, so the centre of mass sits still at 0.
    pub fn recentre(&mut self) {
        let mt: f64 = self.m.iter().sum();
        for k in 0..2 {
            let c: f64 = (0..self.m.len()).map(|i| self.m[i] * self.p[2 * i + k]).sum::<f64>() / mt;
            let w: f64 = (0..self.m.len()).map(|i| self.m[i] * self.v[2 * i + k]).sum::<f64>() / mt;
            for i in 0..self.m.len() { self.p[2 * i + k] -= c; self.v[2 * i + k] -= w; }
        }
        self.refresh();
    }

    /// How far apart two systems' bodies are: the root-sum-square distance over all bodies.
    pub fn distance_to(&self, other: &System) -> f64 {
        self.p.iter().zip(&other.p).map(|(a, b)| (a - b) * (a - b)).sum::<f64>().sqrt()
    }
}

fn row(out: &mut Vec<f64>, s: &System) {
    let tot = s.totals();
    out.push(s.t);
    out.extend_from_slice(&s.p);
    out.push(tot[0]);
    out.push(tot[3]);
}

/// A whole run sampled every `stride` time units up to t_end: rows of [t, x1, y1, …, xN, yN, E, L],
/// flat, 2N + 3 numbers per row; the first row is the start.
#[wasm_bindgen]
pub fn run(m: &[f64], p: &[f64], v: &[f64], eps: f64, t_end: f64, stride: f64) -> Vec<f64> { sample(m, p, v, eps, t_end, stride, None) }

/// The same with a fixed step h instead of the adaptive one.
#[wasm_bindgen]
pub fn run_fixed(m: &[f64], p: &[f64], v: &[f64], eps: f64, t_end: f64, stride: f64, h: f64) -> Vec<f64> { sample(m, p, v, eps, t_end, stride, Some(h)) }

fn sample(m: &[f64], p: &[f64], v: &[f64], eps: f64, t_end: f64, stride: f64, h: Option<f64>) -> Vec<f64> {
    let mut sys = System::new(m, p, v, eps);
    let stride = stride.max(1e-6);
    let n = (t_end / stride).round().max(0.0) as usize;
    let mut out = Vec::with_capacity((2 * m.len() + 3) * (n + 1));
    row(&mut out, &sys);
    for _ in 1..=n {
        match h { Some(h) => sys.advance_fixed(stride, h), None => sys.advance(stride) }
        row(&mut out, &sys);
        if sys.stalled { break; }
    }
    out
}

/// Two runs, one from the given state and one with body i's velocity multiplied by (1 + f):
/// rows of [t, gap], where gap is the distance between the two copies (all bodies), every `stride`.
#[wasm_bindgen]
pub fn diverge(m: &[f64], p: &[f64], v: &[f64], eps: f64, i: usize, f: f64, t_end: f64, stride: f64) -> Vec<f64> {
    let mut a = System::new(m, p, v, eps);
    let mut b = a.copy();
    b.nudge_velocity(i, f);
    let stride = stride.max(1e-6);
    let n = (t_end / stride).round().max(0.0) as usize;
    let mut out = vec![0.0, a.distance_to(&b)];
    for k in 1..=n {
        a.advance(stride);
        b.advance(stride);
        out.push(k as f64 * stride);
        out.push(a.distance_to(&b));
        if a.stalled || b.stalled { break; }
    }
    out
}

/// Two bodies only: the exact orbit from Kepler's formula. Returns
/// [a, e, ω, p, energy of the relative motion, period (∞ if unbound), cx, cy, cvx, cvy]:
/// semi-major axis, eccentricity, the angle of the closest point, the semi-latus rectum,
/// then the centre of mass and its velocity. Inputs: the two bodies' masses, positions, velocities.
#[wasm_bindgen]
pub fn kepler(m1: f64, m2: f64, x1: f64, y1: f64, x2: f64, y2: f64, vx1: f64, vy1: f64, vx2: f64, vy2: f64) -> Vec<f64> {
    let mu = m1 + m2;
    let (rx, ry, vx, vy) = (x2 - x1, y2 - y1, vx2 - vx1, vy2 - vy1);
    let r = rx.hypot(ry);
    let v2 = vx * vx + vy * vy;
    let energy = 0.5 * v2 - mu / r;
    let h = rx * vy - ry * vx;                 // specific angular momentum (out of the plane)
    // the eccentricity vector: e = (v × h)/μ − r̂, with h along z: v × h = (vy h, −vx h)
    let ex = vy * h / mu - rx / r;
    let ey = -vx * h / mu - ry / r;
    let e = ex.hypot(ey);
    let p = h * h / mu;
    let a = if energy.abs() < 1e-15 { f64::INFINITY } else { -mu / (2.0 * energy) };
    let period = if energy < 0.0 { 2.0 * std::f64::consts::PI * (a * a * a / mu).sqrt() } else { f64::INFINITY };
    let mt = m1 + m2;
    vec![a, e, ey.atan2(ex), p, energy, period,
        (m1 * x1 + m2 * x2) / mt, (m1 * y1 + m2 * y2) / mt, (m1 * vx1 + m2 * vx2) / mt, (m1 * vy1 + m2 * vy2) / mt]
}

/// Points on the two bodies' paths from Kepler's formula, about a centre of mass held still:
/// n points for body 1 then n for body 2, flat [x, y, …]. For a bound orbit the whole ellipse;
/// for an unbound one the part of the hyperbola within `reach` of the centre.
#[wasm_bindgen]
pub fn kepler_paths(m1: f64, m2: f64, x1: f64, y1: f64, x2: f64, y2: f64, vx1: f64, vy1: f64, vx2: f64, vy2: f64, n: usize, reach: f64) -> Vec<f64> {
    let k = kepler(m1, m2, x1, y1, x2, y2, vx1, vy1, vx2, vy2);
    let (e, w, p, cx, cy) = (k[1], k[2], k[3], k[6], k[7]);
    let mt = m1 + m2;
    let n = n.max(8);
    let mut rel = Vec::with_capacity(2 * n);
    if e < 1.0 {
        for i in 0..n {
            let th = 2.0 * std::f64::consts::PI * i as f64 / n as f64;
            let r = p / (1.0 + e * th.cos());
            rel.push(r * (th + w).cos()); rel.push(r * (th + w).sin());
        }
    } else {
        // the hyperbola: true anomaly where 1 + e cos θ > 0, cut to a distance of `reach`
        let lim = (-1.0 / e).acos().min(((p / reach - 1.0) / e).max(-1.0).acos());
        for i in 0..n {
            let th = -lim + 2.0 * lim * i as f64 / (n - 1) as f64;
            let r = p / (1.0 + e * th.cos());
            rel.push(r * (th + w).cos()); rel.push(r * (th + w).sin());
        }
    }
    let mut out = Vec::with_capacity(4 * n);
    for q in rel.chunks(2) { out.push(cx - m2 / mt * q[0]); out.push(cy - m2 / mt * q[1]); }
    for q in rel.chunks(2) { out.push(cx + m1 / mt * q[0]); out.push(cy + m1 / mt * q[1]); }
    out
}

/// Equal masses m on a circle of radius r at the corners of an equilateral triangle: the speed that
/// keeps the triangle turning rigidly. The two pulls add to m/(√3 r²) toward the centre = v²/r.
pub fn lagrange_speed(m: f64, r: f64) -> f64 { (m / (3f64.sqrt() * r)).sqrt() }

/// The figure-eight (Moore 1993; Chenciner and Montgomery 2000; Simó's numbers), as
/// [m1, m2, m3, x1, y1, x2, y2, x3, y3, vx1, vy1, vx2, vy2, vx3, vy3].
#[wasm_bindgen]
pub fn figure_eight() -> Vec<f64> {
    let (x, y, vx, vy) = (0.97000436, 0.24308753, 0.4662036850, 0.4323657300);
    vec![1.0, 1.0, 1.0, -x, y, x, -y, 0.0, 0.0, vx, vy, vx, vy, -2.0 * vx, -2.0 * vy]
}

#[wasm_bindgen]
pub fn eight_period() -> f64 { EIGHT_PERIOD }

/// A 15-number state with its centre of mass put at rest at the origin.
fn balanced(mut s: Vec<f64>) -> Vec<f64> {
    let mut sys = System::new(&s[..3], &s[3..9], &s[9..], 0.0);
    sys.recentre();
    s[3..9].copy_from_slice(&sys.positions()); s[9..].copy_from_slice(&sys.velocities());
    s
}

/// The named three-body setups as 15 numbers (masses, positions, velocities): "eight", "lagrange",
/// "sun-planet-moon", "two-suns", "pythagorean". Anything else gives the figure eight.
#[wasm_bindgen]
pub fn preset(name: &str) -> Vec<f64> {
    match name {
        "lagrange" => {
            let v = lagrange_speed(1.0, 1.0);
            let mut pos = vec![];
            let mut vel = vec![];
            for deg in [90.0f64, 210.0, 330.0] {
                let a = deg.to_radians();
                pos.push(a.cos()); pos.push(a.sin());
                vel.push(-v * a.sin()); vel.push(v * a.cos());
            }
            let mut s = vec![1.0, 1.0, 1.0];
            s.extend(pos); s.extend(vel);
            s
        }
        // a sun of mass 1, a planet of 0.01 at distance 1 (circle speed 1), a moon of 1e-4 at 0.06
        // from the planet, going round it at its circle speed; the sun's recoil cancels the drift
        "sun-planet-moon" => {
            let (mp, mm, d): (f64, f64, f64) = (0.01, 1e-4, 0.06);
            let vm = (mp / d).sqrt();
            balanced(vec![1.0, mp, mm, 0.0, 0.0, 1.0, 0.0, 1.0 + d, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0 + vm])
        }
        // two equal suns 1 apart on a circle, and a small planet going round both at 3 (Tatooine)
        "two-suns" => {
            let vs = (2.0f64 / 1.0).sqrt() / 2.0;
            let vp = (2.0f64 / 3.0).sqrt();
            balanced(vec![1.0, 1.0, 0.001, -0.5, 0.0, 0.5, 0.0, 3.0, 0.0, 0.0, -vs, 0.0, vs, 0.0, vp])
        }
        "pythagorean" => vec![3.0, 4.0, 5.0, 1.0, 3.0, -2.0, -1.0, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        _ => figure_eight(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    fn near(a: &[f64], b: &[f64], tol: f64) -> bool { a.iter().zip(b).all(|(x, y)| (x - y).abs() < tol) }
    fn split(s: &[f64]) -> (&[f64], &[f64], &[f64]) { let n = s.len() / 5; (&s[..n], &s[n..3 * n], &s[3 * n..]) }
    fn sys(name: &str) -> System { let s = preset(name); let (m, p, v) = split(&s); System::new(m, p, v, 0.0) }
    /// The Pythagorean run has very close passes: a little softening (as the page uses) keeps it followable.
    const EPS: f64 = 1e-4;

    #[test]
    fn figure_eight_returns_to_its_start_after_one_period() {
        let s0 = preset("eight");
        let mut s = sys("eight");
        s.advance(EIGHT_PERIOD);
        assert!(near(&s.positions(), &s0[3..9], 1e-3), "{:?}", s.positions());
        assert!(near(&s.velocities(), &s0[9..], 1e-3), "{:?}", s.velocities());
        let t = s.totals();
        assert!(t[1].abs() < 1e-10 && t[2].abs() < 1e-10, "momentum {:?}", t);
    }

    #[test]
    fn figure_eight_bodies_swap_places_every_third_of_a_period() {
        let s0 = preset("eight");
        let mut s = sys("eight");
        s.advance(EIGHT_PERIOD / 3.0);
        let p = s.positions();
        // all three share one curve, a third of a period apart: 1 → where 2 was, 2 → 3, 3 → 1
        for (now, was) in [(0, 1), (1, 2), (2, 0)] {
            assert!(near(&p[2 * now..2 * now + 2], &s0[3 + 2 * was..5 + 2 * was], 1e-3), "body {now}: {:?}", p);
        }
    }

    #[test]
    fn energy_is_conserved_to_1e6_over_the_figure_eight_period() {
        let mut s = sys("eight");
        let e0 = s.totals()[0];
        assert!((e0 + 1.28714199).abs() < 1e-6, "energy {e0}");
        let mut worst: f64 = 0.0;
        for _ in 0..100 {
            s.advance(EIGHT_PERIOD / 100.0);
            let t = s.totals();
            worst = worst.max(((t[0] - e0) / e0).abs());
            assert!(t[1].hypot(t[2]) < 1e-10, "momentum {:?}", t);
            assert!(t[3].abs() < 1e-8, "angular momentum {}", t[3]);
        }
        assert!(worst < 1e-6, "energy drift {worst}");
    }

    #[test]
    fn energy_momentum_and_spin_hold_through_a_chaotic_run() {
        let s0 = preset("pythagorean");
        let (m, p, v) = split(&s0);
        let mut s = System::new(m, p, v, EPS);
        let t0 = s.totals();
        for _ in 0..600 {
            s.advance(0.1);
            let t = s.totals();
            assert!(((t[0] - t0[0]) / t0[0]).abs() < 1e-3, "energy drift at {}: {} vs {}", s.time(), t[0], t0[0]);
            assert!(t[1].hypot(t[2]) < 1e-9, "momentum {:?}", t);
            assert!((t[3] - t0[3]).abs() < 1e-6, "spin {}", t[3]);
        }
    }

    #[test]
    fn two_bodies_in_a_circle_keep_their_separation() {
        let v = 0.5f64.sqrt();   // masses 1 and 1, 1 apart: each goes at sqrt(μ/r)/2 with μ = 2
        let m = [1.0, 1.0];
        let p0 = [0.5, 0.0, -0.5, 0.0];
        let v0 = [0.0, v, 0.0, -v];
        let mut s = System::new(&m, &p0, &v0, 0.0);
        let period = 2.0 * PI * 0.5 / v;
        for _ in 0..50 {
            s.advance(period / 50.0);
            let p = s.positions();
            let d = (p[0] - p[2]).hypot(p[1] - p[3]);
            assert!((d - 1.0).abs() < 1e-6, "separation {d} at {}", s.time());
        }
        assert!(near(&s.positions(), &p0, 1e-5) && near(&s.velocities(), &v0, 1e-5), "{:?}", s.positions());
        let k = kepler(1.0, 1.0, 0.5, 0.0, -0.5, 0.0, 0.0, v, 0.0, -v);
        assert!((k[0] - 1.0).abs() < 1e-12 && k[1] < 1e-12 && (k[5] - period).abs() < 1e-9, "{:?}", k);
    }

    #[test]
    fn computed_two_body_path_lands_on_keplers_ellipse() {
        // an eccentric pair: masses 2 and 1, 1 apart, relative speed 1.2 × circle speed
        let (m1, m2) = (2.0, 1.0);
        let vrel = 1.2 * (3.0f64).sqrt();
        let (p, v) = ([-1.0 / 3.0, 0.0, 2.0 / 3.0, 0.0], [0.0, -vrel / 3.0, 0.0, 2.0 * vrel / 3.0]);
        let k = kepler(m1, m2, p[0], p[1], p[2], p[3], v[0], v[1], v[2], v[3]);
        assert!(k[1] > 0.3 && k[1] < 1.0, "eccentricity {}", k[1]);
        let r = run(&[m1, m2], &p, &v, 0.0, k[5], k[5] / 60.0);
        // every sample of body 1 sits at the Kepler radius for its angle
        let (e, w, pp) = (k[1], k[2], k[3]);
        for row in r.chunks(7) {
            let (x1, y1, x2, y2) = (row[1], row[2], row[3], row[4]);
            let (rx, ry) = (x2 - x1, y2 - y1);
            let th = ry.atan2(rx) - w;
            let want = pp / (1.0 + e * th.cos());
            assert!((rx.hypot(ry) - want).abs() < 1e-5, "t = {}: r {} vs {}", row[0], rx.hypot(ry), want);
        }
        let pts = kepler_paths(m1, m2, p[0], p[1], p[2], p[3], v[0], v[1], v[2], v[3], 200, 10.0);
        assert_eq!(pts.len(), 800);
        // the first point of body 1's path is its start
        assert!(near(&pts[..2], &p[..2], 1e-9), "{:?}", &pts[..2]);
    }

    #[test]
    fn a_tiny_nudge_grows_in_a_chaotic_setup_and_not_in_the_eight() {
        let s = preset("pythagorean");
        let (m, p, v) = split(&s);
        let g = diverge(m, p, v, EPS, 0, 1e-3, 60.0, 1.0);
        assert!(g[1] < 1e-3 * 3.0);
        // from 1e-3 of a typical speed to a gap of order the whole system: a hundredfold growth at least
        let biggest = g.iter().skip(1).step_by(2).cloned().fold(0.0, f64::max);
        assert!(biggest > 1.0, "biggest gap {biggest}");
        let s = preset("eight");
        let (m, p, v) = split(&s);
        let g = diverge(m, p, v, 0.0, 0, 1e-3, 60.0, 1.0);
        // the eight is stable: the copy only runs ahead on the same curve, so the gap grows about
        // linearly (at 60 it is less than twice and a half what it was at 30) and stays small
        let gap = |t: usize| g[2 * t + 1];
        assert!(gap(60) < 0.2 && gap(60) < 2.5 * gap(30), "eight gaps {} {}", gap(30), gap(60));
    }

    #[test]
    fn pythagorean_ejects_the_lightest_body() {
        let s0 = preset("pythagorean");
        let (m, p, v) = split(&s0);
        let mut s = System::new(m, p, v, EPS);
        // the lightest body (mass 3) is thrown out and the other two stay as a pair: at some point
        // within 200 time units its energy relative to the pair is positive and it is far away
        let mut thrown = false;
        for _ in 0..40 {
            s.advance(5.0);
            assert!(!s.stalled());
            let (m, p, v) = (s.masses(), s.positions(), s.velocities());
            // bodies 2 and 3 as one lump: its mass, centre and velocity
            let ml = m[1] + m[2];
            let cx = (m[1] * p[2] + m[2] * p[4]) / ml;
            let cy = (m[1] * p[3] + m[2] * p[5]) / ml;
            let cvx = (m[1] * v[2] + m[2] * v[4]) / ml;
            let cvy = (m[1] * v[3] + m[2] * v[5]) / ml;
            let (dx, dy, dvx, dvy) = (p[0] - cx, p[1] - cy, v[0] - cvx, v[1] - cvy);
            let d = dx.hypot(dy);
            let mu = m[0] * ml / (m[0] + ml);
            let e = 0.5 * mu * (dvx * dvx + dvy * dvy) - m[0] * ml / d;
            if e > 0.0 && d > 8.0 { thrown = true; break; }
        }
        assert!(thrown, "nobody was thrown out by t = {}", s.time());
    }

    #[test]
    fn lagrange_triangle_turns_rigidly() {
        let s0 = preset("lagrange");
        let mut s = sys("lagrange");
        s.advance(2.0 * PI / lagrange_speed(1.0, 1.0));
        assert!(near(&s.positions(), &s0[3..9], 1e-4), "{:?}", s.positions());
    }

    #[test]
    fn forces_pulls_and_totals_match_hand_calculation() {
        let m = [1.0, 2.0, 3.0];
        let p = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0];
        let v = [0.0; 6];
        let t = totals(&m, &p, &v, 0.0);
        assert!((t[0] + (2.0 + 3.0 + 6.0 / 2f64.sqrt())).abs() < 1e-7, "{}", t[0]);
        // the pulls on body 1: 2 to the right (from 2), 3 upwards (from 3), both at distance 1
        let pl = pulls(&m, &p, 0.0, 0);
        assert!(near(&pl, &[2.0, 0.0, 1.0, 0.0, 3.0, 1.0], 1e-9), "{:?}", pl);
        let f = forces(&m, &p, 0.0);
        assert!(near(&f[..2], &[2.0, 3.0], 1e-9));
        // Newton's third law: the forces add to nothing
        assert!((f[0] + f[2] + f[4]).abs() < 1e-12 && (f[1] + f[3] + f[5]).abs() < 1e-12);
        // softening weakens a close pull: at distance 1 with ε = 1, the pull is 1/2^(3/2) of it
        let pl = pulls(&m, &p, 1.0, 0);
        assert!((pl[0] - 2.0 / 2f64.powf(1.5)).abs() < 1e-9, "{:?}", pl);
    }

    #[test]
    fn a_fixed_step_too_big_leaves_the_figure_eight() {
        let s = preset("eight");
        let (m, p, v) = split(&s);
        let r = run_fixed(m, p, v, 0.0, EIGHT_PERIOD, EIGHT_PERIOD, 0.1);
        let end = &r[r.len() - 8..r.len() - 2];
        let off: f64 = end.iter().zip(p).map(|(a, b)| (a - b) * (a - b)).sum::<f64>().sqrt();
        assert!(off > 0.01, "with h = 0.1 the eight still closed to {off}");
        // and with the adaptive step it closes
        let r = run(m, p, v, 0.0, EIGHT_PERIOD, EIGHT_PERIOD);
        let end = &r[r.len() - 8..r.len() - 2];
        let off: f64 = end.iter().zip(p).map(|(a, b)| (a - b) * (a - b)).sum::<f64>().sqrt();
        assert!(off < 1e-3, "{off}");
    }

    #[test]
    fn presets_are_balanced_and_recentre_works() {
        for name in ["eight", "lagrange", "sun-planet-moon", "two-suns", "pythagorean"] {
            let s = preset(name);
            let (m, p, v) = split(&s);
            let t = totals(m, p, v, 0.0);
            assert!(t[1].abs() < 1e-8 && t[2].abs() < 1e-8, "{name}: momentum {:?}", t);
        }
        let mut s = System::new(&[1.0, 2.0, 3.0], &[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], &[0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 0.0);
        s.recentre();
        let t = s.totals();
        assert!(t[1].abs() < 1e-12 && t[2].abs() < 1e-12);
        let (m, p) = (s.masses(), s.positions());
        let cx: f64 = (0..3).map(|i| m[i] * p[2 * i]).sum();
        assert!(cx.abs() < 1e-12);
    }

    #[test]
    fn the_sun_planet_moon_keeps_its_moon_for_a_few_years() {
        let mut s = sys("sun-planet-moon");
        s.advance(4.0 * 2.0 * PI);
        let p = s.positions();
        let d = (p[2] - p[4]).hypot(p[3] - p[5]);
        assert!(d < 0.1, "moon at {d} from its planet");
    }

    #[test]
    fn works_for_other_n() {
        // four bodies at the corners of a square, at rest: they fall in symmetrically
        let m = [1.0; 4];
        let p = [1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
        let v = [0.0; 8];
        let mut s = System::new(&m, &p, &v, 0.01);
        s.advance(0.5);
        let q = s.positions();
        for i in 0..4 { assert!(q[2 * i].abs() < 1.0 && (q[2 * i].abs() - q[2 * i + 1].abs()).abs() < 1e-9); }
        assert_eq!(forces(&m, &p, 0.0).len(), 8);
        assert_eq!(pulls(&m, &p, 0.0, 2).len(), 9);
    }
}
