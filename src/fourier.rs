//! A closed outline as a Fourier series, and the circles (epicycles) that draw it.
//!
//! The pen's position along the outline is two periodic signals, x(t) and y(t), t in [0, 2π):
//!
//!   x(t) = a₀ + Σₖ aₖ cos(kt) + bₖ sin(kt)
//!   y(t) = c₀ + Σₖ cₖ cos(kt) + dₖ sin(kt)
//!
//! `t` runs with arc length (the outline is resampled at equal spacing first), so a stroke drawn
//! slowly in one place and quickly in another gives the same series. The coefficients are the
//! averages of the samples against each frequency (a discrete Fourier transform). The same series
//! as one complex sum Σ cₖ e^{ikt}, k = -N..N, is the chain of rotating arms (`arms`).
//!
//! No allocation per frame beyond the returned vectors.
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// Resample a closed polyline at `n` points equally spaced along its length.
/// `pts` is [x0, y0, x1, y1, ...]; the last point joins back to the first.
pub fn resample(pts: &[f64], n: usize) -> Vec<f64> {
    let m = pts.len() / 2;
    if m == 0 || n == 0 {
        return Vec::new();
    }
    if m == 1 {
        return (0..n).flat_map(|_| [pts[0], pts[1]]).collect();
    }
    // cumulative length round the loop (segment m-1 -> 0 included)
    let seg = |i: usize| {
        let j = (i + 1) % m;
        ((pts[2 * j] - pts[2 * i]).powi(2) + (pts[2 * j + 1] - pts[2 * i + 1]).powi(2)).sqrt()
    };
    let mut cum = Vec::with_capacity(m + 1);
    cum.push(0.0);
    for i in 0..m {
        cum.push(cum[i] + seg(i));
    }
    let total = cum[m];
    if total <= 0.0 {
        return (0..n).flat_map(|_| [pts[0], pts[1]]).collect();
    }
    let mut out = Vec::with_capacity(2 * n);
    let mut i = 0;
    for k in 0..n {
        let s = total * k as f64 / n as f64;
        while i + 1 < m && cum[i + 1] < s {
            i += 1;
        }
        let len = cum[i + 1] - cum[i];
        let f = if len > 0.0 { (s - cum[i]) / len } else { 0.0 };
        let j = (i + 1) % m;
        out.push(pts[2 * i] + (pts[2 * j] - pts[2 * i]) * f);
        out.push(pts[2 * i + 1] + (pts[2 * j + 1] - pts[2 * i + 1]) * f);
    }
    out
}

/// The real coefficients of one signal `v` sampled at equal steps round the loop:
/// returns (a, b) with a[k], b[k] for k = 0..=terms (b[0] is always 0, a[0] the mean).
pub fn series(v: &[f64], terms: usize) -> (Vec<f64>, Vec<f64>) {
    let m = v.len();
    let mut a = vec![0.0; terms + 1];
    let mut b = vec![0.0; terms + 1];
    if m == 0 {
        return (a, b);
    }
    a[0] = v.iter().sum::<f64>() / m as f64;
    for k in 1..=terms {
        let (mut sa, mut sb) = (0.0, 0.0);
        for (j, &x) in v.iter().enumerate() {
            let t = 2.0 * PI * k as f64 * j as f64 / m as f64;
            sa += x * t.cos();
            sb += x * t.sin();
        }
        a[k] = 2.0 * sa / m as f64;
        b[k] = 2.0 * sb / m as f64;
    }
    (a, b)
}

fn fmt(v: f64, digits: usize) -> String {
    let s = format!("{:.*}", digits, v);
    if s.starts_with('-') && s[1..].chars().all(|c| c == '0' || c == '.') { s[1..].to_string() } else { s }
}

/// One signal's series as text: "a₀ + a₁ cos(t) + b₁ sin(t) + …" (plain) or LaTeX.
fn signal_text(a: &[f64], b: &[f64], terms: usize, digits: usize, latex: bool) -> String {
    let mut out = fmt(a[0], digits);
    let term = |coef: f64, f: &str, k: usize| -> String {
        let mag_s = fmt(coef.abs(), digits);
        let zero = mag_s.chars().all(|c| c == '0' || c == '.');
        let (sign, mag) = if coef < 0.0 && !zero { ("−", -coef) } else { ("+", coef.abs()) };
        let arg = if k == 1 { "t".to_string() } else { format!("{k}t") };
        if latex {
            let sign = if sign == "−" { "-" } else { "+" };
            format!(" {sign} {}\\{f}({arg})", fmt(mag, digits))
        } else {
            format!(" {sign} {} {f}({arg})", fmt(mag, digits))
        }
    };
    for k in 1..=terms.min(a.len() - 1) {
        out.push_str(&term(a[k], "cos", k));
        out.push_str(&term(b[k], "sin", k));
    }
    out
}

/// An outline's Fourier series: fit once, then evaluate at any number of terms.
#[wasm_bindgen]
pub struct Fourier {
    ax: Vec<f64>, bx: Vec<f64>, // x(t): a_k, b_k
    ay: Vec<f64>, by: Vec<f64>, // y(t): c_k, d_k
    samples: Vec<f64>,          // the resampled outline, for the error
}

#[wasm_bindgen]
impl Fourier {
    /// Fit the closed outline `pts` ([x0, y0, x1, y1, ...]) with up to `max_terms` frequencies.
    /// The outline is first resampled to `samples` equally spaced points (0: 4 × max_terms, at least 512).
    pub fn fit(pts: &[f64], max_terms: usize, samples: usize) -> Fourier {
        let n = if samples == 0 { (4 * max_terms).max(512) } else { samples };
        let rs = resample(pts, n);
        let xs: Vec<f64> = rs.iter().step_by(2).copied().collect();
        let ys: Vec<f64> = rs.iter().skip(1).step_by(2).copied().collect();
        let (ax, bx) = series(&xs, max_terms);
        let (ay, by) = series(&ys, max_terms);
        Fourier { ax, bx, ay, by, samples: rs }
    }

    /// How many frequencies were fitted.
    pub fn max_terms(&self) -> usize { self.ax.len() - 1 }

    /// A coefficient: kind 0 = aₖ (x cos), 1 = bₖ (x sin), 2 = cₖ (y cos), 3 = dₖ (y sin).
    pub fn coefficient(&self, kind: u8, k: usize) -> f64 {
        let v = match kind { 0 => &self.ax, 1 => &self.bx, 2 => &self.ay, _ => &self.by };
        v.get(k).copied().unwrap_or(0.0)
    }

    /// The pen at time t (radians) using the first `terms` frequencies: [x, y].
    pub fn at(&self, terms: usize, t: f64) -> Vec<f64> {
        let n = terms.min(self.max_terms());
        let (mut x, mut y) = (self.ax[0], self.ay[0]);
        for k in 1..=n {
            let (s, c) = (k as f64 * t).sin_cos();
            x += self.ax[k] * c + self.bx[k] * s;
            y += self.ay[k] * c + self.by[k] * s;
        }
        vec![x, y]
    }

    /// The whole curve with `terms` frequencies, `steps` points round the loop: [x0, y0, x1, y1, ...].
    pub fn trace(&self, terms: usize, steps: usize) -> Vec<f64> {
        let mut out = Vec::with_capacity(2 * steps);
        for i in 0..steps {
            out.extend(self.at(terms, 2.0 * PI * i as f64 / steps as f64));
        }
        out
    }

    /// The spinning circles at time t: the same series as rotating arms, largest first.
    /// Returns groups of 4 per arm: [cx, cy, radius, angle]; the arm starts at (cx, cy) and its
    /// tip (the next arm's centre, or the pen) is at (cx + r cos angle, cy + r sin angle).
    /// Frequencies ±k both appear (2 × terms arms) unless the ±k arm has no size.
    pub fn arms(&self, terms: usize, t: f64) -> Vec<f64> {
        let n = terms.min(self.max_terms());
        // complex coefficients: z(t) = Σ C_k e^{ikt}; from the real series
        // C_{+k} = ((a + d) + i(c − b)) / 2,  C_{−k} = ((a − d) + i(c + b)) / 2
        let mut list: Vec<(f64, f64, f64)> = Vec::with_capacity(2 * n); // (freq, re, im)
        for k in 1..=n {
            let (a, b, c, d) = (self.ax[k], self.bx[k], self.ay[k], self.by[k]);
            list.push((k as f64, (a + d) / 2.0, (c - b) / 2.0));
            list.push((-(k as f64), (a - d) / 2.0, (c + b) / 2.0));
        }
        list.retain(|(_, re, im)| re * re + im * im > 1e-18);
        list.sort_by(|p, q| (q.1 * q.1 + q.2 * q.2).partial_cmp(&(p.1 * p.1 + p.2 * p.2)).unwrap());
        let (mut x, mut y) = (self.ax[0], self.ay[0]);
        let mut out = Vec::with_capacity(4 * list.len());
        for (f, re, im) in list {
            let r = (re * re + im * im).sqrt();
            let ang = im.atan2(re) + f * t;
            out.extend([x, y, r, ang]);
            x += r * ang.cos();
            y += r * ang.sin();
        }
        out
    }

    /// Root-mean-square distance between the outline and its `terms`-frequency approximation.
    pub fn error(&self, terms: usize) -> f64 {
        let m = self.samples.len() / 2;
        if m == 0 {
            return 0.0;
        }
        let mut s = 0.0;
        for j in 0..m {
            let p = self.at(terms, 2.0 * PI * j as f64 / m as f64);
            s += (p[0] - self.samples[2 * j]).powi(2) + (p[1] - self.samples[2 * j + 1]).powi(2);
        }
        (s / m as f64).sqrt()
    }

    /// The resampled outline the series was fitted to: [x0, y0, ...].
    pub fn outline(&self) -> Vec<f64> { self.samples.clone() }

    /// Both equations as plain text (two lines: x(t) = …, y(t) = …).
    pub fn equations(&self, terms: usize, digits: usize) -> String {
        let n = terms.min(self.max_terms());
        format!("x(t) = {}\ny(t) = {}", signal_text(&self.ax, &self.bx, n, digits, false), signal_text(&self.ay, &self.by, n, digits, false))
    }

    /// Both equations as LaTeX (aligned environment).
    pub fn latex(&self, terms: usize, digits: usize) -> String {
        let n = terms.min(self.max_terms());
        format!("\\begin{{aligned}}\nx(t) &= {} \\\\\ny(t) &= {}\n\\end{{aligned}}", signal_text(&self.ax, &self.bx, n, digits, true), signal_text(&self.ay, &self.by, n, digits, true))
    }

    /// All coefficients as JSON: { terms, a: [...], b: [...], c: [...], d: [...] } (index k).
    pub fn json(&self, terms: usize) -> String {
        let n = terms.min(self.max_terms());
        let list = |v: &[f64]| v[..=n].iter().map(|x| format!("{x}")).collect::<Vec<_>>().join(",");
        format!("{{\"terms\":{n},\"a\":[{}],\"b\":[{}],\"c\":[{}],\"d\":[{}]}}", list(&self.ax), list(&self.bx), list(&self.ay), list(&self.by))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn circle(r: f64, n: usize) -> Vec<f64> {
        (0..n).flat_map(|i| { let t = 2.0 * PI * i as f64 / n as f64; [r * t.cos(), r * t.sin()] }).collect()
    }
    fn square(s: f64) -> Vec<f64> { vec![-s, -s, s, -s, s, s, -s, s] }

    #[test]
    fn a_circle_is_one_term() {
        let f = Fourier::fit(&circle(3.0, 400), 8, 0);
        assert!((f.coefficient(0, 1) - 3.0).abs() < 1e-3, "a1 = r (a 400-gon, so not exact)");
        assert!((f.coefficient(3, 1) - 3.0).abs() < 1e-3, "d1 = r");
        assert!(f.coefficient(1, 1).abs() < 1e-3 && f.coefficient(2, 1).abs() < 1e-3);
        for k in 2..=8 { for kind in 0..4 { assert!(f.coefficient(kind, k).abs() < 1e-3, "k={k} kind={kind}"); } }
        assert!(f.error(1) < 1e-3);
        // one arm of radius r, spinning once per lap
        let arms = f.arms(1, 0.0);
        assert_eq!(arms.len(), 4, "arms: {arms:?}");
        assert!((arms[2] - 3.0).abs() < 1e-3);
    }

    #[test]
    fn resampling_is_even_and_closed() {
        let rs = resample(&square(1.0), 8);
        assert_eq!(rs.len(), 16);
        assert_eq!(&rs[0..2], &[-1.0, -1.0]);
        assert_eq!(&rs[2..4], &[0.0, -1.0], "halfway along the first side");
        assert_eq!(&rs[14..16], &[-1.0, 0.0], "halfway back up the last side: the loop is closed");
    }

    #[test]
    fn a_square_needs_many_terms_and_improves_with_each() {
        let f = Fourier::fit(&square(1.0), 40, 0);
        let e: Vec<f64> = [1, 3, 9, 21, 39].iter().map(|&n| f.error(n)).collect();
        assert!(e.windows(2).all(|w| w[1] < w[0]), "error falls with terms: {e:?}");
        assert!(e[0] > 0.1 && e[4] < 0.02);
        // even frequencies carry nothing for a symmetric square
        assert!(f.coefficient(0, 2).abs() < 1e-9);
    }

    #[test]
    fn arms_end_at_the_pen() {
        let f = Fourier::fit(&square(1.0), 12, 0);
        for &t in &[0.0, 0.7, 2.5, 5.9] {
            let arms = f.arms(12, t);
            let last = &arms[arms.len() - 4..];
            let tip = [last[0] + last[2] * last[3].cos(), last[1] + last[2] * last[3].sin()];
            let p = f.at(12, t);
            assert!((tip[0] - p[0]).abs() < 1e-9 && (tip[1] - p[1]).abs() < 1e-9);
        }
    }

    #[test]
    fn equations_read_as_text() {
        let f = Fourier::fit(&circle(2.0, 200), 2, 0);
        let eq = f.equations(1, 2);
        assert_eq!(eq, "x(t) = 0.00 + 2.00 cos(t) + 0.00 sin(t)\ny(t) = 0.00 + 0.00 cos(t) + 2.00 sin(t)");
        assert!(f.latex(1, 2).contains("2.00\\cos(t)"));
        assert!(f.json(1).starts_with("{\"terms\":1,\"a\":[") );
    }
}
