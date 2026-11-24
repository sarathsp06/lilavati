//! Motion along a line over time: distance s(t), velocity v = ds/dt and acceleration a = dv/dt.
//! Going down is differentiation (the slope), going up is integration (the area under the curve).
//!
//! Signals are samples at equal time steps `dt`. Hand-drawn curves are wobbly, and every derivative
//! makes the wobble worse, so they can be smoothed first: a local straight-line fit with Gaussian
//! weights, which keeps a straight line straight right up to the ends (a plain moving average would
//! bend it there and give the velocity a spike at the start and end).
use wasm_bindgen::prelude::*;

/// The slope at each sample: central differences inside, second-order one-sided ones at the ends,
/// so a quadratic's slope is exact everywhere.
#[wasm_bindgen]
pub fn derivative(v: &[f64], dt: f64) -> Vec<f64> {
    let n = v.len();
    if n < 2 || dt <= 0.0 {
        return vec![0.0; n];
    }
    if n == 2 {
        let d = (v[1] - v[0]) / dt;
        return vec![d, d];
    }
    (0..n)
        .map(|i| match i {
            0 => (-3.0 * v[0] + 4.0 * v[1] - v[2]) / (2.0 * dt),
            _ if i == n - 1 => (3.0 * v[n - 1] - 4.0 * v[n - 2] + v[n - 3]) / (2.0 * dt),
            _ => (v[i + 1] - v[i - 1]) / (2.0 * dt),
        })
        .collect()
}

/// The running area under the samples (trapezoids), starting from `start`: out[i] = start + ∫₀^{t_i}.
#[wasm_bindgen]
pub fn integral(v: &[f64], dt: f64, start: f64) -> Vec<f64> {
    let mut out = Vec::with_capacity(v.len());
    let mut acc = start;
    for (i, &x) in v.iter().enumerate() {
        if i > 0 {
            acc += (v[i - 1] + x) * dt / 2.0;
        }
        out.push(acc);
    }
    out
}

/// Smooth by fitting a straight line around each sample with Gaussian weights of width `sigma`
/// samples (0: unchanged). Straight lines pass through untouched, also at the ends.
#[wasm_bindgen]
pub fn smooth(v: &[f64], sigma: f64) -> Vec<f64> {
    let n = v.len();
    if sigma <= 0.0 || n < 3 {
        return v.to_vec();
    }
    let reach = (3.0 * sigma).ceil() as isize;
    let w: Vec<f64> = (0..=reach).map(|d| (-(d * d) as f64 / (2.0 * sigma * sigma)).exp()).collect();
    (0..n as isize)
        .map(|i| {
            // weighted least squares for y = α + β·(j − i); the smoothed value is α
            let (mut s0, mut s1, mut s2, mut t0, mut t1) = (0.0, 0.0, 0.0, 0.0, 0.0);
            for j in (i - reach).max(0)..=(i + reach).min(n as isize - 1) {
                let d = (j - i) as f64;
                let wj = w[(j - i).unsigned_abs()];
                let y = v[j as usize];
                s0 += wj;
                s1 += wj * d;
                s2 += wj * d * d;
                t0 += wj * y;
                t1 += wj * d * y;
            }
            let det = s0 * s2 - s1 * s1;
            if det.abs() < 1e-12 { t0 / s0 } else { (t0 * s2 - t1 * s1) / det }
        })
        .collect()
}

/// One motion: all three graphs, worked out from whichever one was given.
#[wasm_bindgen]
pub struct Motion {
    s: Vec<f64>,
    v: Vec<f64>,
    a: Vec<f64>,
}

#[wasm_bindgen]
impl Motion {
    /// From distance: v is its slope, a the slope of v (both after smoothing by `sigma` samples).
    pub fn from_distance(s: &[f64], dt: f64, sigma: f64) -> Motion {
        let v = derivative(&smooth(s, sigma), dt);
        let a = derivative(&smooth(&v, sigma), dt);
        Motion { s: s.to_vec(), v, a }
    }

    /// From velocity: s is the area under it (starting at `s0`), a its slope.
    pub fn from_velocity(v: &[f64], dt: f64, s0: f64, sigma: f64) -> Motion {
        let s = integral(v, dt, s0);
        let a = derivative(&smooth(v, sigma), dt);
        Motion { s, v: v.to_vec(), a }
    }

    /// From acceleration: v is the area under it (starting at `v0`), s the area under v (from `s0`).
    pub fn from_acceleration(a: &[f64], dt: f64, v0: f64, s0: f64) -> Motion {
        let v = integral(a, dt, v0);
        let s = integral(&v, dt, s0);
        Motion { s, v, a: a.to_vec() }
    }

    pub fn distance(&self) -> Vec<f64> { self.s.clone() }
    pub fn velocity(&self) -> Vec<f64> { self.v.clone() }
    pub fn acceleration(&self) -> Vec<f64> { self.a.clone() }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DT: f64 = 0.02;
    fn times(n: usize) -> Vec<f64> { (0..n).map(|i| i as f64 * DT).collect() }
    fn close(a: &[f64], b: &[f64], tol: f64) -> bool { a.iter().zip(b).all(|(x, y)| (x - y).abs() < tol) }

    #[test]
    fn slope_of_a_parabola_is_exact() {
        let t = times(101);
        let s: Vec<f64> = t.iter().map(|t| 3.0 * t * t + 2.0 * t + 1.0).collect();
        let v: Vec<f64> = t.iter().map(|t| 6.0 * t + 2.0).collect();
        assert!(close(&derivative(&s, DT), &v, 1e-9));
    }

    #[test]
    fn area_and_slope_undo_each_other() {
        let t = times(201);
        let v: Vec<f64> = t.iter().map(|t| 4.0 - 2.0 * t).collect();   // braking: linear, so trapezoids are exact
        let s = integral(&v, DT, 5.0);
        assert!(close(&s, &t.iter().map(|t| 5.0 + 4.0 * t - t * t).collect::<Vec<_>>(), 1e-9));
        assert!(close(&derivative(&s, DT), &v, 1e-9));
    }

    #[test]
    fn constant_acceleration_gives_the_textbook_motion() {
        let n = 501;
        let m = Motion::from_acceleration(&vec![-9.81; n], DT, 20.0, 0.0);   // a ball thrown up at 20 m/s
        let t = times(n);
        assert!(close(&m.velocity(), &t.iter().map(|t| 20.0 - 9.81 * t).collect::<Vec<_>>(), 1e-9));
        assert!(close(&m.distance(), &t.iter().map(|t| 20.0 * t - 4.905 * t * t).collect::<Vec<_>>(), 1e-6));
    }

    #[test]
    fn smoothing_keeps_lines_straight_and_calms_wobble() {
        let t = times(301);
        let line: Vec<f64> = t.iter().map(|t| 3.0 * t - 1.0).collect();
        assert!(close(&smooth(&line, 6.0), &line, 1e-9), "a straight line is untouched, ends included");
        // a hand-drawn ramp: 2 m/s with ±5 cm of jitter. Unsmoothed its acceleration is wild;
        // smoothed it is close to the true 0.
        let wobbly: Vec<f64> = line.iter().enumerate().map(|(i, y)| y + 0.05 * ((i * 7919 % 13) as f64 / 6.0 - 1.0)).collect();
        let raw = Motion::from_distance(&wobbly, DT, 0.0);
        let calm = Motion::from_distance(&wobbly, DT, 8.0);
        let peak = |v: Vec<f64>| v.iter().fold(0.0f64, |m, x| m.max(x.abs()));
        assert!(peak(raw.acceleration()) > 50.0);
        assert!(peak(calm.acceleration()) < 2.0, "{}", peak(calm.acceleration()));
        assert!(calm.velocity()[150] > 2.9 && calm.velocity()[150] < 3.1);
    }
}
