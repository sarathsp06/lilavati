//! Superposition of waves: each wave is a·sin(2π f t + φ) (f in Hz, φ in radians, t in seconds),
//! and waves passing through the same place simply add, moment by moment.
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// One wave sampled at n equal steps from t0 to t1 (t1 included).
#[wasm_bindgen]
pub fn wave(f: f64, a: f64, phase: f64, t0: f64, t1: f64, n: usize) -> Vec<f64> {
    let n = n.max(2);
    (0..n).map(|i| { let t = t0 + (t1 - t0) * i as f64 / (n - 1) as f64; a * (2.0 * PI * f * t + phase).sin() }).collect()
}

/// The sum of several waves (lists of frequencies, amplitudes and phases), sampled the same way.
#[wasm_bindgen]
pub fn superpose(freqs: &[f64], amps: &[f64], phases: &[f64], t0: f64, t1: f64, n: usize) -> Vec<f64> {
    let mut out = vec![0.0; n.max(2)];
    for k in 0..freqs.len().min(amps.len()).min(phases.len()) {
        for (o, w) in out.iter_mut().zip(wave(freqs[k], amps[k], phases[k], t0, t1, n)) { *o += w; }
    }
    out
}

/// Two waves of the same frequency add to one wave of the same frequency; its size is the third side
/// of the triangle made by the two amplitudes with the phase gap between them (law of cosines).
#[wasm_bindgen]
pub fn combined_amplitude(a: f64, b: f64, phase_gap: f64) -> f64 { (a * a + b * b + 2.0 * a * b * phase_gap.cos()).max(0.0).sqrt() }

/// Two close frequencies swell and fade this many times a second.
#[wasm_bindgen]
pub fn beat_frequency(f1: f64, f2: f64) -> f64 { (f1 - f2).abs() }

#[cfg(test)]
mod tests {
    use super::*;
    fn peak(v: &[f64]) -> f64 { v.iter().fold(0.0f64, |m, x| m.max(x.abs())) }

    #[test]
    fn half_a_wave_apart_cancels() {
        let s = superpose(&[220.0, 220.0], &[1.0, 1.0], &[0.0, PI], 0.0, 0.05, 2000);
        assert!(peak(&s) < 1e-9);
        let s = superpose(&[220.0, 220.0], &[1.0, 1.0], &[0.0, 0.0], 0.0, 0.05, 2000);
        assert!((peak(&s) - 2.0).abs() < 1e-3, "in step: twice as tall");
    }

    #[test]
    fn same_frequency_gives_the_law_of_cosines() {
        for gap in [0.3, 1.2, 2.0, 2.9] {
            let s = superpose(&[100.0, 100.0], &[1.0, 0.6], &[0.0, gap], 0.0, 0.02, 20001);
            assert!((peak(&s) - combined_amplitude(1.0, 0.6, gap)).abs() < 1e-3, "gap {gap}");
        }
    }

    #[test]
    fn beats_swell_at_the_difference() {
        // 220 and 224 Hz: loud at t = 0, silent at 1/8 s, loud again at 1/4 s
        assert_eq!(beat_frequency(220.0, 224.0), 4.0);
        let around = |t: f64| peak(&superpose(&[220.0, 224.0], &[1.0, 1.0], &[0.0, 0.0], t - 0.003, t + 0.003, 400));
        assert!(around(0.0) > 1.9 && around(0.25) > 1.9);
        assert!(around(0.125) < 0.2);
    }

    #[test]
    fn odd_harmonics_build_a_square() {
        // sin x + sin 3x / 3 + sin 5x / 5 + … → π/4 in the middle of each half-cycle
        let n = 200;
        let f: Vec<f64> = (0..n).map(|k| (2 * k + 1) as f64).collect();
        let a: Vec<f64> = f.iter().map(|k| 1.0 / k).collect();
        let s = superpose(&f, &a, &vec![0.0; n], 0.25, 0.25, 2);
        assert!((s[0] - PI / 4.0).abs() < 0.01, "{}", s[0]);
    }
}
