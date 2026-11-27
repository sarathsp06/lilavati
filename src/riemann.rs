//! Riemann sums: the area under a curve from thin rectangles.
//!
//! A curve f on an interval [a, b] is cut into n strips of width Δx = (b − a)/n. Each strip becomes a
//! rectangle (or, for the trapezoid rule, a trapezoid) whose height is the curve's height at a chosen
//! point: the strip's left edge, right edge or middle. Their areas added up are the Riemann sum; as n
//! grows the sum closes in on the exact area, the integral. Curves are picked by number:
//!
//! 0. a 100 m sprint: speed v(t) = 11.93·(1 − e^(−t/1.2)) metres a second, t in seconds;
//!    the area under it from 0 to 9.58 s is about 100 m
//! 1. the parabola y = x·x
//! 2. the sine wave y = sin x
//! 3. the half circle y = √(1 − x·x), area π/2 from −1 to 1
//! 4. the hyperbola y = 1/x, area 1 from 1 to e
//!
//! Rules: 0 left edge, 1 right edge, 2 middle, 3 trapezoid (the average of the two edges).
use wasm_bindgen::prelude::*;

const VMAX: f64 = 11.93;
const TAU: f64 = 1.2;

/// The height of curve `kind` at x.
#[wasm_bindgen]
pub fn curve(kind: u32, x: f64) -> f64 {
    match kind {
        0 => VMAX * (1.0 - (-x / TAU).exp()),
        1 => x * x,
        2 => x.sin(),
        3 => (1.0 - x * x).max(0.0).sqrt(),
        _ => 1.0 / x,
    }
}

// a function whose slope is the curve (an antiderivative), for the exact areas
fn antiderivative(kind: u32, x: f64) -> f64 {
    match kind {
        0 => VMAX * (x + TAU * (-x / TAU).exp()),
        1 => x * x * x / 3.0,
        2 => -x.cos(),
        3 => { let x = x.clamp(-1.0, 1.0); 0.5 * (x * (1.0 - x * x).max(0.0).sqrt() + x.asin()) }
        _ => x.ln(),
    }
}

/// The exact area under curve `kind` from a to b (below the axis counts as negative).
#[wasm_bindgen]
pub fn exact(kind: u32, a: f64, b: f64) -> f64 { antiderivative(kind, b) - antiderivative(kind, a) }

/// The x values where the curve may be drawn: [smallest, largest], and a starting interval [a, b].
#[wasm_bindgen]
pub fn domain(kind: u32) -> Vec<f64> {
    match kind {
        0 => vec![0.0, 12.0, 0.0, 9.58],
        1 => vec![-1.0, 1.5, 0.0, 1.0],
        2 => vec![0.0, 2.0 * std::f64::consts::PI, 0.0, std::f64::consts::PI],
        3 => vec![-1.0, 1.0, -1.0, 1.0],
        _ => vec![0.25, 5.0, 1.0, std::f64::consts::E],
    }
}

/// n + 1 heights of the curve, at the edges of the n strips.
#[wasm_bindgen]
pub fn edges(kind: u32, a: f64, b: f64, n: u32) -> Vec<f64> {
    let n = n.max(1);
    (0..=n).map(|i| curve(kind, a + (b - a) * i as f64 / n as f64)).collect()
}

/// For each strip, the height of its top at the left and at the right edge: [l0, r0, l1, r1, …].
/// A rectangle has l = r; a trapezoid joins the curve's heights at the two edges.
#[wasm_bindgen]
pub fn tops(kind: u32, a: f64, b: f64, n: u32, rule: u32) -> Vec<f64> {
    let n = n.max(1);
    let dx = (b - a) / n as f64;
    let mut out = Vec::with_capacity(2 * n as usize);
    for i in 0..n {
        let x0 = a + dx * i as f64;
        let (l, r) = match rule {
            0 => { let h = curve(kind, x0); (h, h) }
            1 => { let h = curve(kind, x0 + dx); (h, h) }
            2 => { let h = curve(kind, x0 + dx / 2.0); (h, h) }
            _ => (curve(kind, x0), curve(kind, x0 + dx)),
        };
        out.push(l);
        out.push(r);
    }
    out
}

/// The Riemann sum: each strip's width times its average top height, added up.
#[wasm_bindgen]
pub fn riemann(kind: u32, a: f64, b: f64, n: u32, rule: u32) -> f64 {
    let n = n.max(1);
    let dx = (b - a) / n as f64;
    tops(kind, a, b, n, rule).chunks(2).map(|t| dx * (t[0] + t[1]) / 2.0).sum()
}

/// How far the shapes miss the curve: [area of shape above the curve (too much), area of curve
/// above the shape (too little)], measured strip by strip on a fine grid.
/// Too much − too little = the sum − the exact area (for a curve above the axis).
#[wasm_bindgen]
pub fn misses(kind: u32, a: f64, b: f64, n: u32, rule: u32) -> Vec<f64> {
    let n = n.max(1);
    let dx = (b - a) / n as f64;
    let t = tops(kind, a, b, n, rule);
    let m = 256; // fine steps per strip, midpoint-sampled
    let (mut over, mut under) = (0.0, 0.0);
    for i in 0..n as usize {
        let x0 = a + dx * i as f64;
        for j in 0..m {
            let u = (j as f64 + 0.5) / m as f64;
            let top = t[2 * i] + (t[2 * i + 1] - t[2 * i]) * u;
            let d = (top - curve(kind, x0 + dx * u)) * dx / m as f64;
            if d > 0.0 { over += d } else { under -= d }
        }
    }
    vec![over, under]
}

/// For each strip, how far the curve spreads up and down inside it: its highest minus its lowest height
/// there (found on a fine grid). Whatever height a strip's rectangle takes from the curve, it misses by
/// at most a box Δx wide and this tall, so the sum is never further from the exact area than
/// Δx · (all the spreads added up).
#[wasm_bindgen]
pub fn spreads(kind: u32, a: f64, b: f64, n: u32) -> Vec<f64> {
    let n = n.max(1);
    let dx = (b - a) / n as f64;
    let m = 64;
    (0..n).map(|i| {
        let x0 = a + dx * i as f64;
        let (mut lo, mut hi) = (f64::INFINITY, f64::NEG_INFINITY);
        for j in 0..=m { let y = curve(kind, x0 + dx * j as f64 / m as f64); lo = lo.min(y); hi = hi.max(y); }
        hi - lo
    }).collect()
}

/// The sum split by sign: [area of the shapes above the axis, area of those below (as a positive number)].
#[wasm_bindgen]
pub fn signed_parts(kind: u32, a: f64, b: f64, n: u32, rule: u32) -> Vec<f64> {
    let n = n.max(1);
    let dx = (b - a) / n as f64;
    let (mut up, mut down) = (0.0, 0.0);
    for t in tops(kind, a, b, n, rule).chunks(2) {
        let s = dx * (t[0] + t[1]) / 2.0;
        if s >= 0.0 { up += s } else { down -= s }
    }
    vec![up, down]
}

/// The sum for n = 1, 2, 4, … up to 2^(steps−1) strips, to watch it close in on the exact area.
#[wasm_bindgen]
pub fn sums_doubling(kind: u32, a: f64, b: f64, rule: u32, steps: u32) -> Vec<f64> {
    (0..steps.min(20)).map(|k| riemann(kind, a, b, 1 << k, rule)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    const PI: f64 = std::f64::consts::PI;
    const E: f64 = std::f64::consts::E;

    #[test]
    fn small_sums_by_hand() {
        // x·x on [0, 1] with 4 strips: left (0 + 1 + 4 + 9)/64, right (1 + 4 + 9 + 16)/64
        assert!((riemann(1, 0.0, 1.0, 4, 0) - 14.0 / 64.0).abs() < 1e-12);
        assert!((riemann(1, 0.0, 1.0, 4, 1) - 30.0 / 64.0).abs() < 1e-12);
        // one middle rectangle: height (1/2)² = 1/4; the trapezoid is the average of left and right
        assert!((riemann(1, 0.0, 1.0, 1, 2) - 0.25).abs() < 1e-12);
        assert!((riemann(1, 0.0, 1.0, 4, 3) - 22.0 / 64.0).abs() < 1e-12);
    }

    #[test]
    fn exact_areas_known() {
        assert!((exact(1, 0.0, 1.0) - 1.0 / 3.0).abs() < 1e-12);
        assert!((exact(2, 0.0, PI) - 2.0).abs() < 1e-12);
        assert!(exact(2, 0.0, 2.0 * PI).abs() < 1e-12);
        assert!((exact(3, -1.0, 1.0) - PI / 2.0).abs() < 1e-12);
        assert!((exact(4, 1.0, E) - 1.0).abs() < 1e-12);
        // the sprint model covers 100 m in 9.58 s (to within 10 cm)
        assert!((exact(0, 0.0, 9.58) - 100.0).abs() < 0.1, "{}", exact(0, 0.0, 9.58));
    }

    #[test]
    fn sums_close_in_on_the_exact_area() {
        for kind in 0..5 {
            let d = domain(kind);
            let (a, b) = (d[2], d[3]);
            let ex = exact(kind, a, b);
            for rule in 0..4 {
                let err = (riemann(kind, a, b, 4096, rule) - ex).abs();
                assert!(err < 1e-2 * (1.0 + ex.abs()), "kind {kind} rule {rule}: {err}");
            }
        }
    }

    #[test]
    fn edge_rules_halve_middle_rules_quarter() {
        // doubling n: left error about halves; middle and trapezoid errors about quarter
        let ex = exact(1, 0.0, 1.0);
        let e = |n, r| (riemann(1, 0.0, 1.0, n, r) - ex).abs();
        assert!((e(64, 0) / e(128, 0) - 2.0).abs() < 0.05);
        assert!((e(64, 2) / e(128, 2) - 4.0).abs() < 0.01);
        assert!((e(64, 3) / e(128, 3) - 4.0).abs() < 0.01);
        // for x·x on [0, 1] the middle sum falls short by exactly Δx²/12: 1/1200 with 10 strips
        assert!((riemann(1, 0.0, 1.0, 10, 2) - (ex - 1.0 / 1200.0)).abs() < 1e-12);
    }

    #[test]
    fn misses_add_up_to_the_error() {
        for (kind, rule) in [(1, 0), (1, 1), (0, 2), (3, 3), (4, 0)] {
            let d = domain(kind);
            let (a, b) = (d[2], d[3]);
            let m = misses(kind, a, b, 8, rule);
            let err = riemann(kind, a, b, 8, rule) - exact(kind, a, b);
            assert!((m[0] - m[1] - err).abs() < 1e-4 * (1.0 + exact(kind, a, b).abs()), "kind {kind} rule {rule}: {m:?} vs {err}");
        }
        // a rising curve: left rectangles are always too low, right ones always too high
        let m = misses(1, 0.0, 1.0, 8, 0);
        assert!(m[0] < 1e-12 && m[1] > 0.0);
        let m = misses(1, 0.0, 1.0, 8, 1);
        assert!(m[1] < 1e-12 && m[0] > 0.0);
    }

    #[test]
    fn edge_error_is_bounded_by_the_column() {
        for kind in 0..5 {
            let d = domain(kind);
            let (a, b) = (d[2], d[3]);
            for n in [1, 3, 10, 50] {
                let bound = (b - a) / n as f64 * spreads(kind, a, b, n).iter().sum::<f64>();
                for rule in 0..4 {
                    let err = (riemann(kind, a, b, n, rule) - exact(kind, a, b)).abs();
                    assert!(err <= bound + 1e-12, "kind {kind} n {n} rule {rule}: {err} > {bound}");
                }
            }
        }
        // a curve that only rises: the spreads stack up to just f(b) − f(a)
        assert!((spreads(1, 0.0, 1.0, 7).iter().sum::<f64>() - 1.0).abs() < 1e-12);
    }

    #[test]
    fn below_the_axis_takes_away() {
        let p = signed_parts(2, 0.0, 2.0 * PI, 100, 2);
        assert!((p[0] - 2.0).abs() < 1e-3 && (p[1] - 2.0).abs() < 1e-3);
        assert!(riemann(2, 0.0, 2.0 * PI, 100, 2).abs() < 1e-9);
    }

    #[test]
    fn doubling_list() {
        let s = sums_doubling(1, 0.0, 1.0, 0, 3);
        assert_eq!(s.len(), 3);
        assert!((s[0] - 0.0).abs() < 1e-12 && (s[1] - 0.125).abs() < 1e-12 && (s[2] - 14.0 / 64.0).abs() < 1e-12);
    }
}
