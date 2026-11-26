//! The double-slit experiment: particles fired one at a time at two slits. Each way through (slit 1
//! or slit 2) gives an arrow (a complex amplitude) turned by 2π · path length / wavelength; add the
//! two arrows, then square the length, and the cross term 2 Re(ψ1* ψ2) makes the stripes. A
//! which-slit detector of strength D scales the cross term by the coherence c = √(1 − D²); at c = 0
//! what is seen is the plain sum of the two single-slit patterns. All lengths in millimetres
//! (550 nm = 5.5e-4 mm); the screen is a distance l from the slits, which sit at y = ±d/2.
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// Distances from the two slit centres (at +d/2 and −d/2) to the screen point y, a distance l away:
/// [r1, r2].
#[wasm_bindgen]
pub fn path_lengths(y: f64, d: f64, l: f64) -> Vec<f64> {
    vec![(l * l + (y - d / 2.0).powi(2)).sqrt(), (l * l + (y + d / 2.0).powi(2)).sqrt()]
}

/// Path difference r2 − r1 without losing digits to cancellation (r1, r2 ≈ l, the difference ≈ d·y/l):
/// r2² − r1² = 2 y d exactly, so r2 − r1 = 2 y d / (r1 + r2).
#[wasm_bindgen]
pub fn path_difference(y: f64, d: f64, l: f64) -> f64 {
    let r = path_lengths(y, d, l);
    2.0 * y * d / (r[0] + r[1])
}

/// (sin β / β)² for a slit of width a seen at sinθ = s: the single-slit envelope. 1 at s = 0.
fn sinc2(s: f64, lambda: f64, a: f64) -> f64 {
    let b = PI * a * s / lambda;
    if b.abs() < 1e-12 { 1.0 } else { (b.sin() / b).powi(2) }
}

/// Single-slit envelope for a slit centred at y = 0: (sin β / β)², β = π a sinθ / λ,
/// sinθ = y / √(l² + y²). 1 at y = 0, first zero at sinθ = λ / a.
#[wasm_bindgen]
pub fn single_slit_envelope(y: f64, lambda: f64, a: f64, l: f64) -> f64 {
    sinc2(y / (l * l + y * y).sqrt(), lambda, a)
}

/// Each slit's own pattern, centred on that slit: slit 1 at +d/2 and slit 2 at −d/2. Each alone
/// gives 1/4 at its own centre, so the two together add to 1 there with the cross term at full
/// strength. [|ψ1|², |ψ2|²].
#[wasm_bindgen]
pub fn single_slit_intensities(y: f64, lambda: f64, d: f64, a: f64, l: f64) -> Vec<f64> {
    vec![single_slit_envelope(y - d / 2.0, lambda, a, l) / 4.0, single_slit_envelope(y + d / 2.0, lambda, a, l) / 4.0]
}

/// The amplitude (arrow) from each slit at screen point y: [re1, im1, re2, im2]. Length √|ψk|²,
/// angle 2π r_k / λ, the number of wavelengths along the path.
#[wasm_bindgen]
pub fn slit_amplitudes(y: f64, lambda: f64, d: f64, a: f64, l: f64) -> Vec<f64> {
    let r = path_lengths(y, d, l);
    let p = single_slit_intensities(y, lambda, d, a, l);
    let (m1, m2) = (p[0].sqrt(), p[1].sqrt());
    // keep the angle modulo 2π before multiplying: r/λ is around 2 million turns
    let ang = |rk: f64| 2.0 * PI * (rk / lambda).fract();
    let (a1, a2) = (ang(r[0]), ang(r[1]));
    vec![m1 * a1.cos(), m1 * a1.sin(), m2 * a2.cos(), m2 * a2.sin()]
}

/// The four pieces at one point, for coherence c in 0..=1 (clamped):
/// [|ψ1|², |ψ2|², 2c·Re(ψ1*ψ2), total]. The total is 1 at the centre when c = 1 and the slits are
/// narrow. δ = 2π (r2 − r1)/λ from the real path lengths (no small-angle approximation).
#[wasm_bindgen]
pub fn two_slit_terms(y: f64, lambda: f64, d: f64, a: f64, l: f64, coherence: f64) -> Vec<f64> {
    let c = coherence.clamp(0.0, 1.0);
    let p = single_slit_intensities(y, lambda, d, a, l);
    let delta = 2.0 * PI * path_difference(y, d, l) / lambda;
    let cross = 2.0 * c * (p[0] * p[1]).sqrt() * delta.cos();
    vec![p[0], p[1], cross, p[0] + p[1] + cross]
}

/// The total only (last entry of two_slit_terms). coherence 1: no which-path information;
/// 0: which-path known, the stripes are gone.
#[wasm_bindgen]
pub fn two_slit_intensity(y: f64, lambda: f64, d: f64, a: f64, l: f64, coherence: f64) -> f64 {
    two_slit_terms(y, lambda, d, a, l, coherence)[3]
}

/// two_slit_intensity at each y in ys.
#[wasm_bindgen]
pub fn two_slit_profile(ys: &[f64], lambda: f64, d: f64, a: f64, l: f64, coherence: f64) -> Vec<f64> {
    ys.iter().map(|&y| two_slit_intensity(y, lambda, d, a, l, coherence)).collect()
}

/// With which-path information (or classical balls): |ψ1|² + |ψ2|² at each y, no cross term.
#[wasm_bindgen]
pub fn which_path_profile(ys: &[f64], lambda: f64, d: f64, a: f64, l: f64) -> Vec<f64> {
    ys.iter().map(|&y| { let p = single_slit_intensities(y, lambda, d, a, l); p[0] + p[1] }).collect()
}

/// Each slit's own pattern at each y, interleaved: [p1(y0), p2(y0), p1(y1), p2(y1), …].
#[wasm_bindgen]
pub fn single_slit_profiles(ys: &[f64], lambda: f64, d: f64, a: f64, l: f64) -> Vec<f64> {
    ys.iter().flat_map(|&y| single_slit_intensities(y, lambda, d, a, l)).collect()
}

/// The Fraunhofer formula in the angle: cos²(π d sinθ/λ) · sinc²(π a sinθ/λ), 1 at θ = 0.
#[wasm_bindgen]
pub fn fraunhofer(sin_theta: f64, lambda: f64, d: f64, a: f64) -> f64 {
    (PI * d * sin_theta / lambda).cos().powi(2) * sinc2(sin_theta, lambda, a)
}

/// Stripe spacing near the middle of the screen: λ l / d.
#[wasm_bindgen]
pub fn fringe_spacing(lambda: f64, l: f64, d: f64) -> f64 { lambda * l / d }

/// First dark line of one slit's envelope: y = λ l / a (small angles).
#[wasm_bindgen]
pub fn envelope_half_width(lambda: f64, l: f64, a: f64) -> f64 { lambda * l / a }

/// Detector strength D (0 off … 1 certain) → coherence c = √(1 − D²); the cross term is scaled by c.
#[wasm_bindgen]
pub fn coherence_from_detector(detect: f64) -> f64 { let d = detect.clamp(0.0, 1.0); (1.0 - d * d).max(0.0).sqrt() }

/// (max − min)/(max + min) of a profile; 0 for an all-zero (or empty) profile.
#[wasm_bindgen]
pub fn visibility(profile: &[f64]) -> f64 {
    if profile.is_empty() { return 0.0; }
    let mx = profile.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let mn = profile.iter().cloned().fold(f64::INFINITY, f64::min);
    if mx + mn <= 0.0 { 0.0 } else { (mx - mn) / (mx + mn) }
}

/// Angles (radians, modulo 2π) of n small arrows for one slit of width a centred at y = centre, cut
/// into n strips, seen from screen point y: 2π · r_k / λ, r_k the distance from strip k's middle.
/// Adding the n arrows head to tail gives the slit's amplitude; their spread makes the envelope.
#[wasm_bindgen]
pub fn sub_source_phases(y: f64, centre: f64, lambda: f64, a: f64, l: f64, n: usize) -> Vec<f64> {
    (0..n).map(|k| {
        let s = centre - a / 2.0 + (k as f64 + 0.5) * a / n as f64;
        let r = (l * l + (y - s).powi(2)).sqrt();
        2.0 * PI * (r / lambda).fract()
    }).collect()
}

/// A counter-based generator: uniform in [0, 1) from (seed, i) alone (the splitmix64 finaliser, the
/// same multiplier as games.rs). Hit i depends only on (seed, i), never on the hits before it.
fn uniform(seed: u32, i: u64) -> f64 {
    let mut z = (seed as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ (i + 1).wrapping_mul(0xD1B5_4A32_D192_ED03);
    z = z.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^= z >> 31;
    (z >> 11) as f64 / (1u64 << 53) as f64
}

const BINS: usize = 2048;

/// A cumulative table of f over −y_max..y_max in BINS bins, scaled to end at 1 (None if f is zero).
fn cdf(y_max: f64, f: impl Fn(f64) -> f64) -> Option<Vec<f64>> {
    let w = 2.0 * y_max / BINS as f64;
    let mut c = Vec::with_capacity(BINS + 1);
    c.push(0.0);
    let mut sum = 0.0;
    for k in 0..BINS { sum += f(-y_max + (k as f64 + 0.5) * w).max(0.0); c.push(sum); }
    if sum <= 0.0 { return None; }
    for v in c.iter_mut() { *v /= sum; }
    Some(c)
}

/// Inverse of a cumulative table at u in [0, 1): the y where the table passes u.
fn invert(c: &[f64], y_max: f64, u: f64) -> f64 {
    let w = 2.0 * y_max / BINS as f64;
    let k = c.partition_point(|&v| v <= u).clamp(1, BINS) - 1;
    let (lo, hi) = (c[k], c[k + 1]);
    let f = if hi > lo { (u - lo) / (hi - lo) } else { 0.5 };
    (-y_max + (k as f64 + f) * w).clamp(-y_max, y_max)
}

/// Where particles number `from` .. `to` (0-based, `to` excluded) land, sampled from the two-slit
/// pattern on −y_max..y_max at the given coherence. Hit i depends only on (seed, i) and the
/// settings, so the screen can be extended without redrawing earlier dots and two browsers with the
/// same seed agree. At most 100 000 per call.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn sample_hits(from: usize, to: usize, seed: u32, y_max: f64, lambda: f64, d: f64, a: f64, l: f64, coherence: f64) -> Vec<f64> {
    if to <= from { return Vec::new(); }
    let to = to.min(from + 100_000);
    match cdf(y_max, |y| two_slit_intensity(y, lambda, d, a, l, coherence)) {
        None => (from..to).map(|i| -y_max + 2.0 * y_max * uniform(seed, i as u64)).collect(),
        Some(c) => (from..to).map(|i| invert(&c, y_max, uniform(seed, i as u64))).collect(),
    }
}

/// With a which-path detector: each particle is seen at slit 1 or slit 2 (a fair coin), then lands
/// by that slit's own pattern. Returns [y, slit, y, slit, …] with slit 1.0 or 2.0. Together the
/// hits follow |ψ1|² + |ψ2|²: no cross term. Same seeding rule as sample_hits.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn sample_hits_with_path(from: usize, to: usize, seed: u32, y_max: f64, lambda: f64, d: f64, a: f64, l: f64) -> Vec<f64> {
    if to <= from { return Vec::new(); }
    let to = to.min(from + 100_000);
    let c1 = cdf(y_max, |y| single_slit_intensities(y, lambda, d, a, l)[0]);
    let c2 = cdf(y_max, |y| single_slit_intensities(y, lambda, d, a, l)[1]);
    let mut out = Vec::with_capacity(2 * (to - from));
    for i in from..to {
        let slit = if uniform(seed ^ 0x5A5A_5A5A, i as u64) < 0.5 { 1 } else { 2 };
        let u = uniform(seed, i as u64);
        let c = if slit == 1 { &c1 } else { &c2 };
        out.push(match c { Some(c) => invert(c, y_max, u), None => -y_max + 2.0 * y_max * u });
        out.push(slit as f64);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    const LAM: f64 = 5.5e-4;
    const L: f64 = 1000.0;
    const D: f64 = 0.10;
    const A: f64 = 0.03;
    fn grid(a: f64, b: f64, step: f64) -> Vec<f64> { let n = ((b - a) / step).round() as usize; (0..=n).map(|i| a + step * i as f64).collect() }
    fn peaks(ys: &[f64], p: &[f64]) -> Vec<f64> { (1..p.len() - 1).filter(|&i| p[i] > p[i - 1] && p[i] >= p[i + 1]).map(|i| ys[i]).collect() }

    #[test]
    fn central_fringe_at_zero_and_first_dark_at_known_angle() {
        let ys = grid(-12.0, 12.0, 0.001);
        let p = two_slit_profile(&ys, LAM, D, 1e-6, L, 1.0);
        let pk = peaks(&ys, &p);
        // the brightest peak is at the middle, and the pattern is 1 there
        let (imax, _) = p.iter().enumerate().fold((0, f64::MIN), |m, (i, &v)| if v > m.1 { (i, v) } else { m });
        assert!(ys[imax].abs() < 0.002, "brightest at {}", ys[imax]);
        assert!((two_slit_intensity(0.0, LAM, D, 1e-6, L, 1.0) - 1.0).abs() < 1e-9);
        assert!(pk.iter().any(|y| y.abs() < 0.002));
        // the first dark line: d sinθ = λ/2, so y = l tan(asin(λ/2d))
        let y_dark = L * (LAM / (2.0 * D)).asin().tan();
        assert!((y_dark - 2.75).abs() < 0.01);
        assert!(two_slit_intensity(y_dark, LAM, D, 1e-6, L, 1.0) < 1e-9);
        assert!(two_slit_intensity(0.9 * y_dark, LAM, D, 1e-6, L, 1.0) > 0.01);
        // in the angle form, the same
        assert!(fraunhofer(LAM / (2.0 * D), LAM, D, 1e-6) < 1e-20);
        assert!((fraunhofer(0.0, LAM, D, A) - 1.0).abs() < 1e-12);
    }

    #[test]
    fn maxima_are_lambda_l_over_d_apart() {
        let ys = grid(-12.0, 12.0, 0.001);
        let pk = peaks(&ys, &two_slit_profile(&ys, LAM, D, 1e-6, L, 1.0));
        assert!(pk.len() >= 4, "found {} maxima", pk.len());
        let s = fringe_spacing(LAM, L, D);
        assert!((s - 5.5).abs() < 1e-12);
        for w in pk.windows(2) { assert!(((w[1] - w[0]) - s).abs() / s < 0.005, "spacing {}", w[1] - w[0]); }
    }

    #[test]
    fn spacing_scales_with_wavelength_and_inverse_separation() {
        let ys = grid(-12.0, 12.0, 0.001);
        let measured = |lam: f64, d: f64| {
            let pk = peaks(&ys, &two_slit_profile(&ys, lam, d, 1e-6, L, 1.0));
            let two = pk.iter().filter(|y| y.abs() < 1e-3 || (y.abs() - fringe_spacing(lam, L, d)).abs() < 0.05).count();
            assert!(two >= 2, "no neighbouring peaks for λ={lam} d={d}");
            pk.iter().find(|y| **y > 1e-3).copied().unwrap()
        };
        let base = measured(LAM, D);
        // twice the wavelength: twice the spacing; twice the separation: half the spacing
        assert!((measured(2.0 * LAM, D) / base - 2.0).abs() < 0.01);
        assert!((measured(LAM, 2.0 * D) / base - 0.5).abs() < 0.01);
        assert!((fringe_spacing(2.0 * LAM, L, D) / fringe_spacing(LAM, L, D) - 2.0).abs() < 1e-12);
        assert!((fringe_spacing(LAM, L, 2.0 * D) / fringe_spacing(LAM, L, D) - 0.5).abs() < 1e-12);
    }

    #[test]
    fn which_path_is_the_smooth_sum_with_no_dark_lines() {
        let ys = grid(-5.0, 5.0, 0.001);
        let q = which_path_profile(&ys, LAM, D, A, L);
        let s = two_slit_profile(&ys, LAM, D, A, L, 0.0);
        for (x, y) in q.iter().zip(&s) { assert!((x - y).abs() < 1e-12); }
        // no local minima inside the central lobe (the stripes' dark lines at ±2.75, ±8.25 are gone)
        let dips = (1..q.len() - 1).filter(|&i| q[i] < q[i - 1] && q[i] <= q[i + 1]).count();
        assert_eq!(dips, 0);
        let mn = q.iter().cloned().fold(f64::INFINITY, f64::min);
        assert!(mn > 0.3, "min {mn}");   // the envelope at y = ±5 mm is still about 0.78
        // and stripes against the envelope: full contrast at c = 1, none at c = 0, 0.6 at 0.6
        let ratio = |c: f64| -> Vec<f64> { ys.iter().map(|&y| { let p = single_slit_intensities(y, LAM, D, A, L); two_slit_intensity(y, LAM, D, A, L, c) / (p[0] + p[1]) }).collect() };
        assert!(visibility(&ratio(0.0)) < 1e-6);
        assert!(visibility(&ratio(1.0)) > 0.999);
        assert!((visibility(&ratio(0.6)) - 0.6).abs() < 1e-3);
        assert!((coherence_from_detector(0.8) - 0.6).abs() < 1e-12);
        assert_eq!(visibility(&[0.0, 0.0]), 0.0);
    }

    #[test]
    fn amplitudes_add_to_the_terms() {
        for y in grid(-20.0, 20.0, 0.37) {
            let z = slit_amplitudes(y, LAM, D, A, L);
            let t = two_slit_terms(y, LAM, D, A, L, 1.0);
            let (re, im) = (z[0] + z[2], z[1] + z[3]);
            assert!((re * re + im * im - t[3]).abs() < 1e-9, "|ψ1+ψ2|² vs total at y={y}");
            assert!((z[0] * z[0] + z[1] * z[1] - t[0]).abs() < 1e-12);
            assert!((2.0 * (z[0] * z[2] + z[1] * z[3]) - t[2]).abs() < 1e-9);
            for c in [0.0, 0.4, 1.0] {
                let t = two_slit_terms(y, LAM, D, A, L, c);
                assert!((t[0] + t[1] + t[2] - t[3]).abs() < 1e-12);
                assert!(t[2].abs() <= t[0] + t[1] + 1e-15);
            }
        }
        let r = path_lengths(3.0, D, L);
        assert!((path_difference(3.0, D, L) - (r[1] - r[0])).abs() < 1e-9);
        // the small arrows of one slit add up to that slit's arrow (same length, up to the strip count)
        let ph = sub_source_phases(4.0, D / 2.0, LAM, A, L, 400);
        let (sx, sy): (f64, f64) = ph.iter().fold((0.0, 0.0), |(x, y), p| (x + p.cos(), y + p.sin()));
        let len = (sx * sx + sy * sy).sqrt() / 400.0;
        assert!((len * len - single_slit_envelope(4.0 - D / 2.0, LAM, A, L)).abs() < 1e-3);
    }

    #[test]
    fn envelope_zero_at_lambda_l_over_a() {
        let y = envelope_half_width(LAM, L, A);
        assert!((y - 18.333333333333332).abs() < 1e-9);
        assert!(single_slit_envelope(y, LAM, A, L) < 1e-6);
        assert_eq!(single_slit_envelope(0.0, LAM, A, L), 1.0);
        let p = single_slit_profiles(&[0.0, D / 2.0], LAM, D, A, L);
        assert_eq!(p.len(), 4);
        assert!((p[2] - 0.25).abs() < 1e-12);     // slit 1's own centre
    }

    // a chi-square-ish check: binned counts against the expected counts from the profile
    fn chi2(hits: &[f64], ym: f64, bins: usize, f: impl Fn(f64) -> f64) -> f64 {
        let mut h = vec![0.0; bins];
        for &y in hits { h[(((y + ym) / (2.0 * ym) * bins as f64) as usize).min(bins - 1)] += 1.0; }
        let fine = grid(-ym, ym, 2.0 * ym / 4000.0);
        let mut e = vec![0.0; bins];
        for &y in &fine { e[(((y + ym) / (2.0 * ym) * bins as f64) as usize).min(bins - 1)] += f(y); }
        let tot: f64 = e.iter().sum();
        let n = hits.len() as f64;
        h.iter().zip(&e).filter(|(_, &ex)| ex / tot * n >= 5.0).map(|(&o, &ex)| { let ex = ex / tot * n; (o - ex).powi(2) / ex }).sum::<f64>() / bins as f64
    }

    #[test]
    fn sampled_dots_follow_the_pattern() {
        let (seed, ym) = (7, 20.0);
        let mut hits = sample_hits(0, 100_000, seed, ym, LAM, D, A, L, 1.0);
        hits.extend(sample_hits(100_000, 200_000, seed, ym, LAM, D, A, L, 1.0));
        assert_eq!(hits.len(), 200_000);
        assert!(hits.iter().all(|&y| (-ym..=ym).contains(&y)));
        // reduced chi-square near 1 for a matching distribution; a wrong one is far above
        let x = chi2(&hits, ym, 80, |y| two_slit_intensity(y, LAM, D, A, L, 1.0));
        assert!(x < 2.0, "reduced chi-square {x}");
        let wrong = chi2(&hits, ym, 80, |y| two_slit_intensity(y, LAM, D, A, L, 0.0));
        assert!(wrong > 20.0, "against the wrong pattern: {wrong}");
        // the central bright stripe |y| < 2.75: the share of hits against the integral of the profile
        let fine = grid(-ym, ym, 0.001);
        let total: f64 = fine.iter().map(|&y| two_slit_intensity(y, LAM, D, A, L, 1.0)).sum();
        let mid: f64 = fine.iter().filter(|y| y.abs() < 2.75).map(|&y| two_slit_intensity(y, LAM, D, A, L, 1.0)).sum();
        let share = hits.iter().filter(|y| y.abs() < 2.75).count() as f64 / hits.len() as f64;
        assert!((share - mid / total).abs() / (mid / total) < 0.02, "share {share} vs {}", mid / total);
    }

    #[test]
    fn detected_dots_follow_the_sum_and_are_tagged() {
        let (seed, ym) = (11, 20.0);
        let v = sample_hits_with_path(0, 100_000, seed, ym, LAM, D, A, L);
        assert_eq!(v.len(), 200_000);
        let ys: Vec<f64> = v.chunks(2).map(|p| p[0]).collect();
        let ones = v.chunks(2).filter(|p| p[1] == 1.0).count();
        assert!(v.chunks(2).all(|p| p[1] == 1.0 || p[1] == 2.0));
        assert!((ones as f64 / 100_000.0 - 0.5).abs() < 0.01);
        let x = chi2(&ys, ym, 80, |y| two_slit_intensity(y, LAM, D, A, L, 0.0));
        assert!(x < 2.0, "reduced chi-square {x}");
        let striped = chi2(&ys, ym, 80, |y| two_slit_intensity(y, LAM, D, A, L, 1.0));
        assert!(striped > 20.0, "against the striped pattern: {striped}");
        // each group follows its own slit's pattern
        let g1: Vec<f64> = v.chunks(2).filter(|p| p[1] == 1.0).map(|p| p[0]).collect();
        assert!(chi2(&g1, ym, 40, |y| single_slit_intensities(y, LAM, D, A, L)[0]) < 2.0);
    }

    #[test]
    fn sampler_is_prefix_stable_and_seeded() {
        let s = |f, t, seed| sample_hits(f, t, seed, 20.0, LAM, D, A, L, 1.0);
        let mut joined = s(0, 50, 3);
        joined.extend(s(50, 100, 3));
        assert_eq!(s(0, 100, 3), joined);
        assert_ne!(s(0, 100, 4), s(0, 100, 3));
        assert!(s(10, 10, 3).is_empty() && s(10, 5, 3).is_empty());
        let w = |f, t, seed| sample_hits_with_path(f, t, seed, 20.0, LAM, D, A, L);
        let mut j = w(0, 50, 3); j.extend(w(50, 100, 3));
        assert_eq!(w(0, 100, 3), j);
    }
}
