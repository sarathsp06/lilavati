//! Taylor series: a curve near one point a, rebuilt from its height, slope, bend and so on at a.
//!
//! The series of f around a is c₀ + c₁·(x − a) + c₂·(x − a)² + …, with cₖ = f⁽ᵏ⁾(a) ÷ k!, the k-th
//! derivative at a divided by k factorial. Keeping the first n + 1 terms gives the Taylor polynomial of
//! degree n. Curves are picked by number:
//!
//! 0. sin x        1. cos x        2. eˣ        3. ln(1 + x)        4. 1 ÷ (1 − x)        5. arctan x
//!
//! The series of sin, cos and eˣ work for every x. The others only work closer to a than the nearest point
//! where the curve breaks down: ln(1 + x) at x = −1, 1 ÷ (1 − x) at x = 1, and arctan x at the two
//! imaginary numbers ±i, which are √(1 + a²) away from a. That distance is the radius of convergence.
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// The most terms anything here uses.
pub const MAX_TERMS: usize = 40;

/// The height of curve `kind` at x (NaN where it is not defined).
#[wasm_bindgen]
pub fn tcurve(kind: u32, x: f64) -> f64 {
    match kind {
        0 => x.sin(),
        1 => x.cos(),
        2 => x.exp(),
        3 => if x > -1.0 { (1.0 + x).ln() } else { f64::NAN },
        4 => if x != 1.0 { 1.0 / (1.0 - x) } else { f64::NAN },
        _ => x.atan(),
    }
}

fn tidy(v: f64) -> f64 { if v.abs() < 1e-14 { 0.0 } else { v } }

/// The coefficients c₀ … c_{n} of the series of curve `kind` around a: cₖ = f⁽ᵏ⁾(a) ÷ k!.
#[wasm_bindgen]
pub fn coefficients(kind: u32, a: f64, n: u32) -> Vec<f64> {
    let n = (n as usize).min(MAX_TERMS);
    let mut c = Vec::with_capacity(n + 1);
    let mut fact = 1.0;
    for k in 0..=n {
        if k > 0 { fact *= k as f64; }
        let v = match kind {
            // the derivatives of sin and cos go round sin, cos, −sin, −cos: a quarter turn each time
            // (a quarter turn is not exact in floating point, so sin π comes out as 1e-16: call that 0)
            0 => tidy((a + k as f64 * PI / 2.0).sin()) / fact,
            1 => tidy((a + k as f64 * PI / 2.0).cos()) / fact,
            2 => a.exp() / fact,
            3 => if k == 0 { (1.0 + a).ln() } else { let s = if k % 2 == 1 { 1.0 } else { -1.0 }; s / (k as f64 * (1.0 + a).powi(k as i32)) },
            4 => 1.0 / (1.0 - a).powi(k as i32 + 1),
            _ => f64::NAN,   // filled in below
        };
        c.push(v);
    }
    if kind == 5 {
        // arctan′ = 1 ÷ (1 + x²). Around a, 1 + x² = (1 + a²) + 2a·h + h² with h = x − a, and dividing 1 by
        // that, term by term, gives q₀ = 1 ÷ (1 + a²) and qₖ = −(2a·qₖ₋₁ + qₖ₋₂) ÷ (1 + a²). Then cₖ = qₖ₋₁ ÷ k.
        let d = 1.0 + a * a;
        let mut q = vec![0.0; n + 1];
        for k in 0..n {
            q[k] = if k == 0 { 1.0 / d } else { -(2.0 * a * q[k - 1] + if k >= 2 { q[k - 2] } else { 0.0 }) / d };
        }
        c[0] = a.atan();
        for k in 1..=n { c[k] = q[k - 1] / k as f64; }
    }
    c
}

/// The terms c₀, c₁·(x − a), c₂·(x − a)², … of the series at x: add them up for the Taylor polynomial.
#[wasm_bindgen]
pub fn terms(kind: u32, a: f64, n: u32, x: f64) -> Vec<f64> {
    let h = x - a;
    let mut p = 1.0;
    coefficients(kind, a, n).iter().map(|c| { let t = c * p; p *= h; t }).collect()
}

/// The Taylor polynomial of degree n around a, at x.
#[wasm_bindgen]
pub fn taylor(kind: u32, a: f64, n: u32, x: f64) -> f64 {
    // Horner's way: c₀ + h·(c₁ + h·(c₂ + …))
    let h = x - a;
    coefficients(kind, a, n).iter().rev().fold(0.0, |s, c| s * h + c)
}

/// How far from a the series works: infinite for sin, cos and eˣ.
#[wasm_bindgen]
pub fn radius(kind: u32, a: f64) -> f64 {
    match kind {
        3 => (a + 1.0).abs(),
        4 => (1.0 - a).abs(),
        5 => (1.0 + a * a).sqrt(),
        _ => f64::INFINITY,
    }
}

/// The stretch [lo, hi] around a where the polynomial of degree n is within tol of the curve, searched
/// within [x0, x1] in steps of (x1 − x0) ÷ 2000.
#[wasm_bindgen]
pub fn good_range(kind: u32, a: f64, n: u32, tol: f64, x0: f64, x1: f64) -> Vec<f64> {
    let c = coefficients(kind, a, n);
    let ok = |x: f64| {
        let f = tcurve(kind, x);
        let h = x - a;
        let p = c.iter().rev().fold(0.0, |s, k| s * h + k);
        f.is_finite() && (p - f).abs() <= tol
    };
    let step = (x1 - x0) / 2000.0;
    let (mut lo, mut hi) = (a, a);
    while lo - step >= x0 && ok(lo - step) { lo -= step; }
    while hi + step <= x1 && ok(hi + step) { hi += step; }
    vec![lo, hi]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    #[test]
    fn coefficients_are_derivatives_over_factorials() {
        // sin around 0: 0, 1, 0, −1/6, 0, 1/120
        let s = coefficients(0, 0.0, 5);
        for (got, want) in s.iter().zip([0.0, 1.0, 0.0, -1.0 / 6.0, 0.0, 1.0 / 120.0]) { assert!(close(*got, want, 1e-15)); }
        // eˣ around 0: 1/k!
        let e = coefficients(2, 0.0, 10);
        assert!(close(e.iter().sum::<f64>(), std::f64::consts::E, 3e-8));
        // ln(1 + x) around 0: x − x²/2 + x³/3 …
        let l = coefficients(3, 0.0, 4);
        for (got, want) in l.iter().zip([0.0, 1.0, -0.5, 1.0 / 3.0, -0.25]) { assert!(close(*got, want, 1e-15)); }
        // arctan around 0: x − x³/3 + x⁵/5
        let t = coefficients(5, 0.0, 5);
        for (got, want) in t.iter().zip([0.0, 1.0, 0.0, -1.0 / 3.0, 0.0, 0.2]) { assert!(close(*got, want, 1e-15)); }
    }

    #[test]
    fn arctan_coefficients_away_from_zero() {
        // check against derivatives worked out by finite differences of the polynomial itself
        let a = 0.7;
        for x in [0.5, 0.8, 1.1] { assert!(close(taylor(5, a, 30, x), x.atan(), 1e-9), "{x}"); }
        let c = coefficients(5, a, 2);
        assert!(close(c[1], 1.0 / (1.0 + a * a), 1e-15));
        assert!(close(c[2], -a / (1.0 + a * a).powi(2), 1e-15));   // f″/2 = −2a/(1+a²)² ÷ 2
    }

    #[test]
    fn the_calculator_gets_sin_37_degrees() {
        let x = 37f64.to_radians();
        // four terms that are not zero: x − x³/6 + x⁵/120 − x⁷/5040
        let p = taylor(0, 0.0, 7, x);
        // off by about the first term left out, x⁹/9! = 5.4e-8: right to 7 decimals, 0.6018150
        assert!(close(p, x.sin(), 6e-8) && (p * 1e7).round() == (x.sin() * 1e7).round(), "{p}");
        let t = terms(0, 0.0, 7, x);
        assert!(close(t.iter().sum::<f64>(), p, 1e-15));
    }

    #[test]
    fn every_curve_matches_near_its_centre() {
        for kind in 0..6 {
            for a in [-0.4, 0.0, 0.3] {
                for n in [3, 8] {
                    let h = 0.05;
                    let err = (taylor(kind, a, n, a + h) - tcurve(kind, a + h)).abs();
                    // the error is about the first term left out: about (h ÷ R)^(n+1), R the radius (at most 1 here)
                    let r = radius(kind, a).min(1.0);
                    assert!(err < 10.0 * (h / r).powi(n as i32 + 1), "kind {kind} a {a} n {n}: {err}");
                }
            }
        }
    }

    #[test]
    fn inside_the_radius_it_works_outside_it_fails() {
        // ln(1 + x) around 0 at x = 0.5 converges, at x = 1.5 the terms grow and it does not
        let inside: Vec<f64> = [10, 20, 40].iter().map(|&n| (taylor(3, 0.0, n, 0.5) - 1.5f64.ln()).abs()).collect();
        assert!(inside[2] < inside[1] && inside[1] < inside[0] && inside[2] < 1e-12);
        let outside: Vec<f64> = [10, 20, 40].iter().map(|&n| (taylor(3, 0.0, n, 1.5) - 2.5f64.ln()).abs()).collect();
        assert!(outside[2] > outside[1] && outside[1] > outside[0]);
        // arctan: radius √(1 + a²); around 0 at x = 1.2 it fails even though arctan is smooth there
        assert!(close(radius(5, 0.0), 1.0, 1e-15) && close(radius(5, 2.0), 5f64.sqrt(), 1e-15));
        assert!((taylor(5, 0.0, 40, 1.2) - 1.2f64.atan()).abs() > 1.0);
        assert!(radius(0, 3.0).is_infinite());
    }

    #[test]
    fn sin_error_is_less_than_the_next_term() {
        // Lagrange: |sin x − Pₙ(x)| ≤ |x − a|^(n+1) ÷ (n+1)!, since no derivative of sin is bigger than 1
        let mut fact = 1.0;
        for n in 0..15u32 {
            fact *= (n + 1) as f64;
            for x in [-3.0, -1.0, 0.5, 2.0, 4.0] {
                let err = (taylor(0, 0.0, n, x) - x.sin()).abs();
                assert!(err <= f64::abs(x).powi(n as i32 + 1) / fact + 1e-15, "n {n} x {x}");
            }
        }
    }

    #[test]
    fn good_range_grows_with_more_terms() {
        let mut last = 0.0;
        for n in [1, 3, 5, 9, 15] {
            let r = good_range(0, 0.0, n, 0.01, -10.0, 10.0);
            let width = r[1] - r[0];
            assert!(width > last && r[0] < 0.0 && r[1] > 0.0, "{n}: {r:?}");
            last = width;
        }
        // ln(1 + x) never gets good past its radius, however many terms
        let r = good_range(3, 0.0, 40, 0.01, -0.99, 3.0);
        assert!(r[1] < 1.05, "{r:?}");
    }

    #[test]
    fn leibniz_series_for_pi() {
        // arctan 1 = π/4 = 1 − 1/3 + 1/5 − …, very slowly: 20 nonzero terms are still off by about 0.0125
        let p = 4.0 * taylor(5, 0.0, 39, 1.0);
        assert!((p - PI).abs() < 0.06 && (p - PI).abs() > 0.04, "{p}");
    }
}
