//! The brachistochrone: the cycloid, the time along any path under gravity, racing paths.
//!
//! Coordinates: x to the right and y *down* (depth below the start), both in metres. A bead starts
//! at rest at A = (0, 0) and slides without friction to B = (bx, by) with bx > 0, by > 0. Gravity g
//! in m/s². Without friction, energy conservation gives the speed at any depth, v = √(2 g y), on any
//! smooth path; a sharp corner knocks some of that speed away (see `slide_time`).
//!
//! Paths are flat lists of points [x0, y0, x1, y1, …]. Along a straight segment the push along the
//! track is constant, so the time for a segment is exactly its length divided by the average of the
//! speeds at its two ends: that is what `slide_time` adds up, segment by segment.
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// Speed after dropping `depth` metres from rest: v = √(2 g depth). Zero above the start.
#[wasm_bindgen]
pub fn speed_at_depth(g: f64, depth: f64) -> f64 { (2.0 * g * depth).max(0.0).sqrt() }

/// The cycloid x = a(θ − sin θ), y = a(1 − cos θ) through (0, 0) and (bx, by): returns [a, θ_end].
/// (1 − cos θ)/(θ − sin θ) falls from ∞ to 0 as θ goes from 0 to 2π, so one bisection finds θ_end.
#[wasm_bindgen]
pub fn cycloid_params(bx: f64, by: f64) -> Vec<f64> {
    let bx = bx.max(1e-9);
    let by = by.max(1e-9);
    let ratio = by / bx;
    let f = |t: f64| (1.0 - t.cos()) / (t - t.sin());
    let (mut lo, mut hi) = (1e-6, 2.0 * PI - 1e-9);
    for _ in 0..200 {
        let mid = 0.5 * (lo + hi);
        if f(mid) > ratio { lo = mid } else { hi = mid }
    }
    let theta = 0.5 * (lo + hi);
    vec![bx / (theta - theta.sin()), theta]
}

/// The cycloid from (0, 0) to (bx, by), n points.
#[wasm_bindgen]
pub fn cycloid_points(bx: f64, by: f64, n: usize) -> Vec<f64> {
    let p = cycloid_params(bx, by);
    let (a, te) = (p[0], p[1]);
    let n = n.max(2);
    let mut out = Vec::with_capacity(2 * n);
    for i in 0..n {
        let t = te * i as f64 / (n - 1) as f64;
        out.push(a * (t - t.sin()));
        out.push(a * (1.0 - t.cos()));
    }
    // land exactly on B
    let l = out.len();
    out[l - 2] = bx;
    out[l - 1] = by;
    out
}

/// The straight line from (0, 0) to (bx, by), n points.
#[wasm_bindgen]
pub fn line_points(bx: f64, by: f64, n: usize) -> Vec<f64> {
    let n = n.max(2);
    (0..n).flat_map(|i| { let u = i as f64 / (n - 1) as f64; [bx * u, by * u] }).collect()
}

/// A circular arc from (0, 0) to (bx, by) that starts straight down (its centre is level with the
/// start, at (r, 0) with r = (bx² + by²)/(2bx)), n points.
#[wasm_bindgen]
pub fn arc_points(bx: f64, by: f64, n: usize) -> Vec<f64> {
    let n = n.max(2);
    let r = (bx * bx + by * by) / (2.0 * bx.max(1e-9));
    let end = by.atan2(bx - r);   // the angle of B seen from the centre; A is at angle π
    (0..n).flat_map(|i| {
        let u = i as f64 / (n - 1) as f64;
        let ang = PI + (end - PI) * u;
        [r + r * ang.cos(), r * ang.sin()]
    }).collect()
}

/// How long a bead takes to slide along a path from rest at its first point to its last: infinite if
/// it never gets there (it runs out of speed and slides back, or the path rises above the start).
///
/// Along a straight segment the push along the track is constant (g times the segment's slope), so
/// every piece of the motion is exact. Smooth bends cost nothing. A sharp corner does: the bead keeps
/// only the part of its velocity that points along the new direction, v·cos(turn), as a real bead or
/// ball does when it is knocked round a kink. Bends of up to CORNER per point count as smooth, so a
/// finely sampled curve (the cycloid, the arc, a carefully drawn track) loses nothing.
#[wasm_bindgen]
pub fn slide_time(pts: &[f64], g: f64) -> f64 {
    let run = Run::new(pts, g);
    if run.arrives { run.legs.last().map_or(0.0, |l| l.t0 + l.dur) } else { f64::INFINITY }
}

/// Bends sharper than this (radians, at one point of the path) are corners that cost speed.
pub const CORNER: f64 = 0.12;

/// The time each segment takes on the way forward (one number per segment, so n points give n − 1
/// times); infinite from the segment where the bead runs out of speed and turns back.
#[wasm_bindgen]
pub fn slide_segment_times(pts: &[f64], g: f64) -> Vec<f64> {
    let run = Run::new(pts, g);
    let n = run.seg.len();
    let mut out = vec![0.0; n];
    let mut reached = vec![false; n];
    for l in &run.legs {
        if l.v0 < 0.0 || l.back { break; }
        out[l.i] += l.dur;
        if l.done { reached[l.i] = true; }
    }
    for i in 0..n { if !reached[i] && run.seg[i].len > 1e-12 { out[i] = f64::INFINITY; } }
    out
}

/// The speed the bead has as it reaches each point on the way forward, after any corner there
/// (NaN from the point where it turns back).
#[wasm_bindgen]
pub fn slide_speeds(pts: &[f64], g: f64) -> Vec<f64> {
    let run = Run::new(pts, g);
    let mut out = vec![f64::NAN; run.seg.len() + 1];
    out[0] = 0.0;
    for l in &run.legs {
        if l.v0 < 0.0 || l.back { break; }
        if l.done { out[l.i + 1] = l.v0 + l.a * l.dur; }
    }
    out
}

/// Where a bead released at time 0 is at time t: [x, y, speed, done, stuck] with done = 1 once it has
/// arrived at the end of the path (it then sits there), and stuck = 1 when it will never arrive.
#[wasm_bindgen]
pub fn slide_position(pts: &[f64], g: f64, t: f64) -> Vec<f64> {
    let run = Run::new(pts, g);
    let stuck = if run.arrives { 0.0 } else { 1.0 };
    let n = pts.len() / 2;
    if n == 0 { return vec![0.0, 0.0, 0.0, 1.0, 0.0]; }
    let t = t.max(0.0);
    for l in &run.legs {
        if t <= l.t0 + l.dur {
            let (tau, sg) = (t - l.t0, &run.seg[l.i]);
            let s = (l.s0 + l.v0 * tau + 0.5 * l.a * tau * tau).clamp(0.0, sg.len);
            let u = if sg.len > 0.0 { s / sg.len } else { 0.0 };
            return vec![sg.x0 + (sg.x1 - sg.x0) * u, sg.y0 + (sg.y1 - sg.y0) * u, (l.v0 + l.a * tau).abs(), 0.0, stuck];
        }
    }
    match run.legs.last() {
        Some(l) if !run.arrives => {
            let sg = &run.seg[l.i];
            let s = (l.s0 + l.v0 * l.dur + 0.5 * l.a * l.dur * l.dur).clamp(0.0, sg.len);
            let u = if sg.len > 0.0 { s / sg.len } else { 0.0 };
            vec![sg.x0 + (sg.x1 - sg.x0) * u, sg.y0 + (sg.y1 - sg.y0) * u, 0.0, 0.0, 1.0]
        }
        _ => vec![pts[2 * n - 2], pts[2 * n - 1], if run.arrives { run.v_end } else { 0.0 }, if run.arrives { 1.0 } else { 0.0 }, stuck],
    }
}

struct Seg { x0: f64, y0: f64, x1: f64, y1: f64, len: f64 }
/// One stretch of motion inside one segment with a constant push: from distance s0 along it at
/// speed v0 (negative when sliding back), accelerating at a, for dur seconds. done: it reached the
/// segment's far end going forward; back: it is on its way back.
struct Leg { i: usize, t0: f64, s0: f64, v0: f64, a: f64, dur: f64, done: bool, back: bool }
struct Run { seg: Vec<Seg>, legs: Vec<Leg>, arrives: bool, v_end: f64 }

impl Run {
    /// Follows the bead: through each segment exactly, round corners with v·cos(turn), back down when it
    /// runs out of speed, until it arrives, comes to rest, or a minute of its time has passed.
    fn new(pts: &[f64], g: f64) -> Run {
        let m = pts.len() / 2;
        let mut seg = Vec::new();
        for i in 1..m {
            let (x0, y0, x1, y1) = (pts[2 * i - 2], pts[2 * i - 1], pts[2 * i], pts[2 * i + 1]);
            let len = ((x1 - x0).powi(2) + (y1 - y0).powi(2)).sqrt();
            if len > 1e-12 { seg.push(Seg { x0, y0, x1, y1, len }); }
        }
        let mut run = Run { seg, legs: Vec::new(), arrives: false, v_end: 0.0 };
        let n = run.seg.len();
        if n == 0 { run.arrives = true; return run; }
        let acc = |sg: &Seg| g * (sg.y1 - sg.y0) / sg.len;
        // what survives of the speed going round the point between segments j and j + 1
        let keep = |a: &Seg, b: &Seg| {
            let c = ((a.x1 - a.x0) * (b.x1 - b.x0) + (a.y1 - a.y0) * (b.y1 - b.y0)) / (a.len * b.len);
            let turn = c.clamp(-1.0, 1.0).acos();
            if turn <= CORNER { 1.0 } else { turn.cos().max(0.0) }
        };
        let (mut i, mut s, mut v, mut t) = (0usize, 0.0f64, 0.0f64, 0.0f64);
        let mut back = false;
        for _ in 0..200_000 {
            if t > 60.0 { break; }
            let sg = &run.seg[i];
            let a = acc(sg);
            if v.abs() < 1e-12 && a.abs() < 1e-12 { break; }   // at rest on the level: it stays
            // time to reach the far end (v ≥ 0) or the near end (v < 0), or to stop and turn
            let hit = |target: f64| -> Option<f64> {
                let d = target - s;   // solve v τ + ½ a τ² = d for the first τ > 0
                if a.abs() < 1e-12 { return if v.abs() > 1e-12 && d / v > 0.0 { Some(d / v) } else { None }; }
                let disc = v * v + 2.0 * a * d;
                if disc < 0.0 { return None; }
                let r = disc.sqrt();
                [(-v + r) / a, (-v - r) / a].into_iter().filter(|&x| x > 1e-12).fold(None, |m: Option<f64>, x| Some(m.map_or(x, |y| y.min(x))))
            };
            let moving_fwd = v > 0.0 || (v == 0.0 && a > 0.0);
            let tau_end = if moving_fwd { hit(sg.len) } else { hit(0.0) };
            let tau_turn = if a != 0.0 && v != 0.0 && v.signum() != a.signum() { Some(-v / a) } else { None };
            match (tau_end, tau_turn) {
                (Some(te), tt) if tt.map_or(true, |x| te <= x) => {
                    let ve = v + a * te;
                    run.legs.push(Leg { i, t0: t, s0: s, v0: v, a, dur: te, done: moving_fwd, back });
                    t += te;
                    if moving_fwd {
                        if i + 1 == n { run.arrives = true; run.v_end = ve; return run; }
                        v = ve * keep(&run.seg[i], &run.seg[i + 1]); i += 1; s = 0.0;
                    } else {
                        if i == 0 { return run; }   // back at the start, at rest
                        v = ve * keep(&run.seg[i - 1], &run.seg[i]); i -= 1; s = run.seg[i].len;
                    }
                }
                (_, Some(tt)) => {
                    run.legs.push(Leg { i, t0: t, s0: s, v0: v, a, dur: tt, done: false, back });
                    t += tt; s = (s + v * tt + 0.5 * a * tt * tt).clamp(0.0, sg.len); v = 0.0; back = true;
                }
                _ => break,
            }
            // at rest at a point between two segments that both rise away from it: it stays there
            if v == 0.0 && ((s <= 1e-12 && i > 0 && acc(&run.seg[i]) <= 0.0 && acc(&run.seg[i - 1]) >= 0.0)
                || (s >= run.seg[i].len - 1e-12 && i + 1 < n && acc(&run.seg[i]) >= 0.0 && acc(&run.seg[i + 1]) <= 0.0)) { break; }
            if v == 0.0 && s <= 1e-12 && i > 0 && acc(&run.seg[i]) <= 0.0 { i -= 1; s = run.seg[i].len; }
            if v == 0.0 && s >= run.seg[i].len - 1e-12 && i + 1 < n && acc(&run.seg[i]) >= 0.0 { i += 1; s = 0.0; }
            if i == 0 && s <= 1e-12 && v == 0.0 && acc(&run.seg[0]) <= 0.0 { break; }   // level or rising at the start
        }
        run
    }
}

/// The same path with n points spaced evenly along its length (for drawn paths with uneven points).
#[wasm_bindgen]
pub fn slide_resample(pts: &[f64], n: usize) -> Vec<f64> {
    let m = pts.len() / 2;
    let n = n.max(2);
    if m < 2 { return pts.to_vec(); }
    let mut cum = vec![0.0; m];
    for i in 1..m { cum[i] = cum[i - 1] + ((pts[2 * i] - pts[2 * i - 2]).powi(2) + (pts[2 * i + 1] - pts[2 * i - 1]).powi(2)).sqrt(); }
    let total = cum[m - 1];
    let mut out = Vec::with_capacity(2 * n);
    let mut j = 0;
    for k in 0..n {
        let s = total * k as f64 / (n - 1) as f64;
        while j + 2 < m && cum[j + 1] < s { j += 1; }
        let seg = (cum[j + 1] - cum[j]).max(1e-12);
        let u = ((s - cum[j]) / seg).clamp(0.0, 1.0);
        out.push(pts[2 * j] + (pts[2 * j + 2] - pts[2 * j]) * u);
        out.push(pts[2 * j + 1] + (pts[2 * j + 3] - pts[2 * j + 1]) * u);
    }
    out
}

/// Snell's law view: the space below the start cut into `layers` level slabs, each with the speed of
/// its middle depth, and a bead that crosses them like light: sin(angle from vertical) / speed is
/// the same in every slab. With the cycloid's constant (sin α = √(y / 2a)), the slabs reach down to
/// the cycloid's lowest point and the bead comes back up on the far side if B is beyond it. Returns
/// the corner points [x, y, …]; as the layers get thinner they close in on the cycloid.
#[wasm_bindgen]
pub fn snell_path(bx: f64, by: f64, layers: usize) -> Vec<f64> {
    let p = cycloid_params(bx, by);
    let (a, te) = (p[0], p[1]);
    let layers = layers.max(1);
    let deep = if te > PI { 2.0 * a } else { by };   // how far down the slabs go
    let h = deep / layers as f64;
    let mut out = vec![0.0, 0.0];
    let (mut x, mut y) = (0.0, 0.0);
    // down
    for k in 0..layers {
        let mid = (k as f64 + 0.5) * h;
        let s = (mid / (2.0 * a)).sqrt().min(0.999_999);
        let tan = s / (1.0 - s * s).sqrt();
        x += h * tan; y += h;
        out.push(x); out.push(y);
    }
    // and back up to B's depth when B lies beyond the lowest point
    if te > PI {
        let mut k = layers;
        while k > 0 && y - h >= by - 1e-12 {
            k -= 1;
            let mid = (k as f64 + 0.5) * h;
            let s = (mid / (2.0 * a)).sqrt().min(0.999_999);
            let tan = s / (1.0 - s * s).sqrt();
            x += h * tan; y -= h;
            out.push(x); out.push(y);
        }
        if y > by + 1e-12 && k > 0 {
            k -= 1;
            let mid = (k as f64 + 0.5) * h;
            let s = (mid / (2.0 * a)).sqrt().min(0.999_999);
            let tan = s / (1.0 - s * s).sqrt();
            x += (y - by) * tan; y = by;
            out.push(x); out.push(y);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    const G: f64 = 9.81;

    #[test]
    fn cycloid_through_a_known_point() {
        // θ = π at B = (π a, 2a): with a = 1, B = (π, 2)
        let p = cycloid_params(PI, 2.0);
        assert!((p[0] - 1.0).abs() < 1e-9 && (p[1] - PI).abs() < 1e-9, "{p:?}");
        // θ = π/2 at (a(π/2 − 1), a): a = 2 gives (1.1416, 2)
        let p = cycloid_params(2.0 * (PI / 2.0 - 1.0), 2.0);
        assert!((p[0] - 2.0).abs() < 1e-9 && (p[1] - PI / 2.0).abs() < 1e-9, "{p:?}");
        // the sampled cycloid starts at A and ends at B
        let c = cycloid_points(3.0, 1.0, 50);
        assert_eq!((c[0], c[1]), (0.0, 0.0));
        assert_eq!((c[98], c[99]), (3.0, 1.0));
    }

    #[test]
    fn the_paths_start_at_a_and_end_at_b() {
        for pts in [line_points(4.0, 3.0, 20), arc_points(4.0, 3.0, 20), arc_points(1.0, 3.0, 20), cycloid_points(4.0, 3.0, 20)] {
            let n = pts.len();
            assert!(pts[0].abs() < 1e-9 && pts[1].abs() < 1e-9);
            assert!((pts[n - 2] - 4.0).abs() < 1e-9 || (pts[n - 2] - 1.0).abs() < 1e-9);
            assert!((pts[n - 1] - 3.0).abs() < 1e-9);
            assert!(pts.iter().skip(1).step_by(2).all(|&y| y >= -1e-9), "never above the start");
        }
    }

    #[test]
    fn straight_slope_matches_the_closed_form() {
        // a straight slope of length L at angle α: constant push g sin α, so L = ½ g sin α t², t = √(2L / (g sin α)).
        // at 45° with drop d: L = d√2, sin α = 1/√2, so t = 2√(d/g).
        let d = 3.0;
        let t = slide_time(&line_points(3.0, d, 2), G);
        assert!((t - 2.0 * (d / G).sqrt()).abs() < 1e-12, "{t}");
        // and the same with the line cut into many pieces (the segment rule is exact for a straight line)
        let t2 = slide_time(&line_points(3.0, d, 400), G);
        assert!((t2 - t).abs() < 1e-9, "{t2} vs {t}");
        // any angle: bx = 5, by = 2
        let (bx, by) = (5.0f64, 2.0f64);
        let l = (bx * bx + by * by).sqrt();
        let want = (2.0 * l / (G * by / l)).sqrt();
        assert!((slide_time(&line_points(bx, by, 7), G) - want).abs() < 1e-9);
        // straight down: free fall, d = ½ g t²
        assert!((slide_time(&[0.0, 0.0, 0.0, 4.9], G) - (2.0 * 4.9 / G).sqrt()).abs() < 1e-12);
    }

    #[test]
    fn cycloid_time_matches_its_closed_form() {
        // along the cycloid T = θ_end √(a/g): B = (π, 2) gives a = 1 and T = π/√g
        let t = slide_time(&cycloid_points(PI, 2.0, 4000), G);
        assert!((t - PI / G.sqrt()).abs() < 2e-4, "{t} vs {}", PI / G.sqrt());
    }

    #[test]
    fn the_cycloid_beats_the_line_and_the_arc() {
        for (bx, by) in [(4.0, 3.0), (6.0, 2.0), (2.0, 5.0), (9.0, 1.0)] {
            let line = slide_time(&line_points(bx, by, 400), G);
            let arc = slide_time(&arc_points(bx, by, 400), G);
            let cyc = slide_time(&cycloid_points(bx, by, 400), G);
            assert!(cyc < line && cyc < arc, "B=({bx},{by}): cycloid {cyc}, line {line}, arc {arc}");
            // the arc also beats the straight line when B is not too steep below A
            if bx >= by { assert!(arc < line, "B=({bx},{by}): arc {arc}, line {line}"); }
        }
        // weaker gravity makes everything slower by the same factor, so the order never changes
        let on_earth = slide_time(&cycloid_points(4.0, 3.0, 400), 9.81);
        let on_moon = slide_time(&cycloid_points(4.0, 3.0, 400), 1.62);
        assert!((on_moon / on_earth - (9.81f64 / 1.62).sqrt()).abs() < 1e-9);
    }

    #[test]
    fn impossible_paths_take_forever() {
        assert!(slide_time(&[0.0, 0.0, 1.0, -0.5, 2.0, 1.0], G).is_infinite(), "rises above the start");
        assert!(slide_time(&[0.0, 0.0, 1.0, 0.0, 2.0, 1.0], G).is_infinite(), "level at the start: no speed");
        assert!(slide_time(&[0.0, 0.0, 0.0, 0.0, 2.0, 1.0], G).is_finite(), "a repeated point is skipped");
    }

    #[test]
    fn position_follows_the_bead() {
        let pts = cycloid_points(4.0, 3.0, 400);
        let total = slide_time(&pts, G);
        let start = slide_position(&pts, G, 0.0);
        assert_eq!(&start[..2], &[0.0, 0.0]);
        let end = slide_position(&pts, G, total + 1.0);
        assert!((end[0] - 4.0).abs() < 1e-9 && (end[1] - 3.0).abs() < 1e-9 && end[3] == 1.0);
        // halfway in time it is somewhere on the path, with the speed of its depth
        let mid = slide_position(&pts, G, total / 2.0);
        assert!(mid[0] > 0.0 && mid[0] < 4.0 && mid[3] == 0.0);
        assert!((mid[2] - speed_at_depth(G, mid[1])).abs() < 1e-6);
        // free fall: after t seconds it has dropped ½ g t²
        let p = slide_position(&[0.0, 0.0, 0.0, 10.0], G, 1.0);
        assert!((p[1] - 0.5 * G).abs() < 1e-9 && (p[2] - G).abs() < 1e-9);
    }

    #[test]
    fn sharp_corners_cost_speed_and_smooth_bends_do_not() {
        // straight down 2 m, then a sharp right angle onto the level: all the speed points the wrong way
        let drop_level = [0.0, 0.0, 0.0, 2.0, 3.0, 2.0];
        assert!(slide_time(&drop_level, G).is_infinite(), "a square corner stops it dead");
        let p = slide_position(&drop_level, G, 5.0);
        assert!(p[4] == 1.0 && p[3] == 0.0 && (p[1] - 2.0).abs() < 1e-9, "it sits at the corner: {p:?}");
        // the same turn rounded off (a quarter circle in many small steps) keeps the speed
        let mut round = vec![0.0, 0.0, 0.0, 1.0];
        for k in 1..=60 { let th = PI / 2.0 * k as f64 / 60.0; round.extend([1.0 - th.cos(), 1.0 + th.sin()]); }
        round.extend([3.0, 2.0]);
        let t = slide_time(&round, G);
        assert!(t.is_finite());
        let v = slide_speeds(&round, G);
        assert!((v[v.len() - 1] - speed_at_depth(G, 2.0)).abs() < 1e-9, "no speed lost on the bend: {}", v[v.len() - 1]);
        // a 45° kink keeps cos 45° of the speed
        let kink = [0.0, 0.0, 0.0, 1.0, 1.0, 2.0];
        let v = slide_speeds(&kink, G);
        assert!((v[1] - speed_at_depth(G, 1.0)).abs() < 1e-9);
        let want = (speed_at_depth(G, 1.0) * (PI / 4.0).cos()).powi(2) + 2.0 * G * 1.0;
        assert!((v[2] - want.sqrt()).abs() < 1e-9, "{} vs {}", v[2], want.sqrt());
    }

    #[test]
    fn a_bead_that_runs_out_of_speed_slides_back_and_never_arrives() {
        // a smooth dip 2 m deep that climbs out to `end` metres below A (negative: above A)
        let dip = |end: f64| { let mut p = vec![0.0, 0.0];
            for k in 1..=200 { let x = 6.0 * k as f64 / 200.0; p.extend([x, 2.0 * (PI * x / 6.0).sin() + end * x / 6.0]); } p };
        assert!(slide_time(&dip(-0.05), G).is_infinite(), "it can't climb higher than it started");
        let late = slide_position(&dip(-0.05), G, 4.0);
        assert!(late[4] == 1.0 && late[1] > 0.0, "it has turned back into the dip: {late:?}");
        assert!(slide_time(&dip(0.3), G).is_finite(), "ending 0.3 m below A it makes it");
        // a hairpin (a sharp turn back the way it came) stops it, so it can't climb the next bump
        let hairpin = [0.0, 0.0, 0.0, 3.0, 0.5, 1.0, 1.0, 3.0, 3.0, 1.5];
        assert!(slide_time(&hairpin, G).is_infinite());
    }

    #[test]
    fn resampling_keeps_the_ends_and_spaces_evenly() {
        let r = slide_resample(&[0.0, 0.0, 1.0, 0.0, 1.0, 1.0], 5);
        assert_eq!(r.len(), 10);
        assert_eq!((r[0], r[1]), (0.0, 0.0));
        assert!((r[8] - 1.0).abs() < 1e-12 && (r[9] - 1.0).abs() < 1e-12);
        assert!((r[2] - 0.5).abs() < 1e-12 && (r[7] - 0.5).abs() < 1e-12);
    }

    #[test]
    fn snell_layers_close_in_on_the_cycloid() {
        for (bx, by) in [(4.0, 3.0), (8.0, 1.5)] {
            let coarse = snell_path(bx, by, 4);
            let fine = snell_path(bx, by, 400);
            let miss = |p: &[f64]| { let n = p.len(); ((p[n - 2] - bx).powi(2) + (p[n - 1] - by).powi(2)).sqrt() };
            assert!(miss(&fine) < miss(&coarse), "B=({bx},{by})");
            assert!(miss(&fine) < 0.03 * bx, "B=({bx},{by}): misses by {}", miss(&fine));
        }
    }
}
