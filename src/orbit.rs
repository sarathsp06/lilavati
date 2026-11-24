//! Orbits: one small body (a satellite, a ball dropped from a tower) around the Earth under Newton's
//! gravity, a = −GM r / |r|³, seen from above the North Pole. Positions in metres, speeds in m/s,
//! times in seconds, everything in the plane of the orbit.
//!
//! The motion is stepped with leapfrog (kick-drift-kick), which keeps an orbit closed lap after lap
//! instead of slowly spiralling like simpler methods do. The step is a small fraction of the local
//! orbital time sqrt(r³/GM), so it is short near the Earth and long far away.
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// Earth's gravitational parameter G·M, m³/s².
pub const GM: f64 = 3.986004418e14;
/// Earth's radius at the equator, m (towers stand on the equator; satellites are measured from it too).
pub const R_EARTH: f64 = 6.378137e6;
/// Earth's spin, rad/s: one turn per sidereal day (23 h 56 min 4 s).
pub const OMEGA: f64 = 7.2921159e-5;
const STEP: f64 = 0.005; // step, as a fraction of sqrt(r³/GM): about 1,250 steps per circular lap

#[wasm_bindgen] pub fn earth_radius() -> f64 { R_EARTH }
#[wasm_bindgen] pub fn earth_spin() -> f64 { OMEGA }

/// The pull of gravity at distance r from the Earth's centre, m/s².
#[wasm_bindgen] pub fn gravity(r: f64) -> f64 { GM / (r * r) }

/// What a scale would feel standing on a tower at the equator, r from the centre: gravity minus the
/// part used up by being carried round once a day (ω²r). Negative above the geostationary height:
/// there the tower has to hold you down.
#[wasm_bindgen] pub fn felt_gravity(r: f64) -> f64 { GM / (r * r) - OMEGA * OMEGA * r }

/// The speed for a circular orbit at distance r: where gravity is exactly what it takes to turn you.
#[wasm_bindgen] pub fn circular_speed(r: f64) -> f64 { (GM / r).sqrt() }

/// The speed that never comes back from distance r (kinetic energy = the depth of the gravity well).
#[wasm_bindgen] pub fn escape_speed(r: f64) -> f64 { (2.0 * GM / r).sqrt() }

/// The distance from the centre where one orbit takes exactly one Earth day: geostationary orbit.
#[wasm_bindgen] pub fn synchronous_radius() -> f64 { (GM / (OMEGA * OMEGA)).cbrt() }

/// The orbit through a point with a velocity, as numbers:
/// [energy per kg, semi-major axis, eccentricity, periapsis radius, apoapsis radius, period].
/// Energy ≥ 0 means it escapes; then the apoapsis and period are infinite.
#[wasm_bindgen]
pub fn elements(x: f64, y: f64, vx: f64, vy: f64) -> Vec<f64> {
    let r = x.hypot(y);
    let energy = (vx * vx + vy * vy) / 2.0 - GM / r;
    let h = x * vy - y * vx; // angular momentum per kg
    let e = (1.0 + 2.0 * energy * h * h / (GM * GM)).max(0.0).sqrt();
    let rp = h * h / GM / (1.0 + e);
    if energy < 0.0 {
        let a = -GM / (2.0 * energy);
        vec![energy, a, e, rp, a * (1.0 + e), 2.0 * PI * (a * a * a / GM).sqrt()]
    } else {
        vec![energy, f64::INFINITY, e, rp, f64::INFINITY, f64::INFINITY]
    }
}

fn accel(x: f64, y: f64) -> (f64, f64) {
    let r2 = x * x + y * y;
    let k = -GM / (r2 * r2.sqrt());
    (k * x, k * y)
}

/// A satellite (or anything thrown): its position and velocity, moved forward in time.
#[wasm_bindgen]
pub struct Craft { x: f64, y: f64, vx: f64, vy: f64, t: f64, crashed: bool }

#[wasm_bindgen]
impl Craft {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, vx: f64, vy: f64) -> Craft { Craft { x, y, vx, vy, t: 0.0, crashed: false } }

    fn r(&self) -> f64 { self.x.hypot(self.y) }
    fn step_size(&self) -> f64 { let r = self.r(); STEP * (r * r * r / GM).sqrt() }
    fn step(&mut self, h: f64) {
        let (ax, ay) = accel(self.x, self.y);
        self.vx += ax * h / 2.0; self.vy += ay * h / 2.0;
        self.x += self.vx * h; self.y += self.vy * h;
        let (ax, ay) = accel(self.x, self.y);
        self.vx += ax * h / 2.0; self.vy += ay * h / 2.0;
        self.t += h;
    }
    // hit the ground: stop on the surface where it came down
    fn land(&mut self) {
        let k = R_EARTH / self.r();
        self.x *= k; self.y *= k; self.vx = 0.0; self.vy = 0.0; self.crashed = true;
    }

    /// Move `dt` seconds forward (stops on the ground).
    pub fn advance(&mut self, dt: f64) {
        let mut left = dt;
        while left > 1e-9 && !self.crashed {
            let h = self.step_size().min(left);
            self.step(h);
            left -= h;
            if self.r() < R_EARTH { self.land(); }
        }
    }

    /// Fire the engine along the direction of travel: dv > 0 speeds up, dv < 0 slows down (m/s).
    pub fn burn(&mut self, dv: f64) {
        let v = self.vx.hypot(self.vy);
        if v > 0.0 && !self.crashed {
            let k = ((v + dv).max(0.0)) / v;
            self.vx *= k; self.vy *= k;
        }
    }

    /// [x, y, vx, vy, t]
    pub fn state(&self) -> Vec<f64> { vec![self.x, self.y, self.vx, self.vy, self.t] }
    pub fn crashed(&self) -> bool { self.crashed }
}

/// Where a craft will go from here: the path ahead, and how it ends.
#[wasm_bindgen]
pub struct Path { pts: Vec<f64>, outcome: u8, time: f64 }

#[wasm_bindgen]
impl Path {
    /// [x0, y0, x1, y1, ...]
    pub fn points(&self) -> Vec<f64> { self.pts.clone() }
    /// 0: comes round once (an orbit), 1: hits the Earth, 2: escapes beyond `far`, 3: undecided.
    pub fn outcome(&self) -> u8 { self.outcome }
    /// Seconds until it came round, hit, or left.
    pub fn time(&self) -> f64 { self.time }
}

/// Follow a craft from (x, y) with velocity (vx, vy) until it has gone once round the Earth, hit
/// the ground, or got further than `far`; return at most `max_points` points of the way.
#[wasm_bindgen]
pub fn predict(x: f64, y: f64, vx: f64, vy: f64, far: f64, max_points: usize) -> Path {
    let mut c = Craft::new(x, y, vx, vy);
    let mut all = vec![x, y];
    let (mut ang, mut swept, mut outcome) = (y.atan2(x), 0.0, 3u8);
    for _ in 0..400_000 {
        let h = c.step_size();
        c.step(h);
        if c.r() < R_EARTH { c.land(); outcome = 1; }
        else if c.r() > far { outcome = 2; }
        all.extend([c.x, c.y]);
        if outcome != 3 { break; }
        let a = c.y.atan2(c.x);
        let mut d = a - ang;
        if d > PI { d -= 2.0 * PI } else if d < -PI { d += 2.0 * PI }
        swept += d; ang = a;
        if swept.abs() >= 2.0 * PI { outcome = 0; break; }
    }
    let n = all.len() / 2;
    let stride = (n + max_points.max(2) - 1) / max_points.max(2);
    let mut pts: Vec<f64> = (0..n).step_by(stride.max(1)).flat_map(|i| [all[2 * i], all[2 * i + 1]]).collect();
    pts.extend([all[2 * n - 2], all[2 * n - 1]]); // always end where it ended
    Path { pts, outcome, time: c.t }
}

#[cfg(test)]
mod tests {
    use super::*;
    const ISS: f64 = R_EARTH + 400e3;

    #[test]
    fn a_circular_orbit_comes_back_round() {
        let v = circular_speed(ISS);
        let el = elements(ISS, 0.0, 0.0, v);
        assert!(el[2] < 1e-9, "a circle has eccentricity 0");
        assert!((el[5] - 5554.0).abs() < 5.0, "the space station goes round in about 92 minutes: {}", el[5]);
        let mut c = Craft::new(ISS, 0.0, 0.0, v);
        for _ in 0..100 { c.advance(el[5] / 100.0); }
        let s = c.state();
        assert!((s[0].hypot(s[1]) - ISS).abs() < 1e-4 * ISS, "still at the same height");
        assert!((s[0] - ISS).abs() < 2e-3 * ISS && s[1].abs() < 2e-3 * ISS, "back where it started: {s:?}");
    }

    #[test]
    fn too_slow_falls_too_fast_escapes() {
        let v = circular_speed(ISS);
        assert_eq!(predict(ISS, 0.0, 0.0, 0.7 * v, 30.0 * R_EARTH, 500).outcome(), 1, "70% hits the ground");
        assert_eq!(predict(ISS, 0.0, 0.0, 1.2 * v, 30.0 * R_EARTH, 500).outcome(), 0, "120% is an ellipse");
        let ve = escape_speed(ISS);
        assert!((ve / v - 2f64.sqrt()).abs() < 1e-12, "escape is √2 × circular");
        assert!(elements(ISS, 0.0, 0.0, ve)[0].abs() < 1e-3, "escape speed: total energy zero");
        assert_eq!(predict(ISS, 0.0, 0.0, 1.01 * ve, 30.0 * R_EARTH, 500).outcome(), 2);
        assert!((escape_speed(R_EARTH) - 11180.0).abs() < 2.0, "11.2 km/s from the ground");
    }

    #[test]
    fn speeding_up_raises_the_far_side() {
        let v = circular_speed(ISS);
        let mut c = Craft::new(ISS, 0.0, 0.0, v);
        c.burn(100.0);
        let s = c.state();
        let el = elements(s[0], s[1], s[2], s[3]);
        assert!((el[3] - ISS).abs() < 1.0, "the burn point becomes the lowest point");
        assert!(el[4] - ISS > 300e3, "the opposite side rises by hundreds of km: {}", el[4] - ISS);
        assert!(el[5] > 5554.0, "and a lap takes longer");
    }

    #[test]
    fn towers_and_the_geostationary_height() {
        let geo = synchronous_radius();
        assert!((geo - 42_164e3).abs() < 2e3, "{geo}");
        assert!((geo - R_EARTH - 35_786e3).abs() < 2e3, "35,786 km above the equator");
        assert!(felt_gravity(geo).abs() < 1e-9, "at geostationary height you weigh nothing on a tower");
        assert!(felt_gravity(geo * 1.1) < 0.0, "above it the tower holds you down");
        // the top of the Burj Khalifa (828 m): gravity about 0.026% weaker
        let k = gravity(R_EARTH + 828.0) / gravity(R_EARTH);
        assert!((1.0 - k - 0.00026).abs() < 0.00001, "{}", 1.0 - k);
        // let go from the top of towers: carried round at the Earth's spin
        let drop = |h: f64| { let r = R_EARTH + h; predict(r, 0.0, 0.0, OMEGA * r, 30.0 * R_EARTH, 300).outcome() };
        assert_eq!(drop(1000e3), 1, "from 1,000 km it falls back");
        assert_eq!(drop(30_000e3), 0, "from 30,000 km it goes round");
        let mut c = Craft::new(geo, 0.0, 0.0, OMEGA * geo);
        c.advance(86_164.0);
        let s = c.state();
        assert!((s[0].hypot(s[1]) - geo).abs() < 1e-4 * geo, "from the geostationary top it just floats there");
    }
}
