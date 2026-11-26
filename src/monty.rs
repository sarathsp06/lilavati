//! Monty Hall: the game, strategies, many games at once, and the maths of why switching wins.
//!
//! n doors, one car. You pick a door; the host opens n − 2 of the others, all goats, and leaves one
//! other door shut. Stay with your door or switch to that one. A host who knows where the car is never
//! opens it; a host who guesses opens doors at random, and the games where he shows the car don't count.
//! Games are dealt from a seed and a game number, so every browser in a session deals the same games.
use wasm_bindgen::prelude::*;

// a small repeatable random number in [0, 1) for game i of a seed (splitmix64)
fn unit(seed: u32, i: u32, k: u32) -> f64 {
    let mut z = ((seed as u64) << 32 | i as u64).wrapping_add((k as u64 + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15));
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^= z >> 31;
    (z >> 11) as f64 / (1u64 << 53) as f64
}
fn pick_of(u: f64, n: u32) -> u32 { ((u * n as f64) as u32).min(n.saturating_sub(1)) }

/// Game i of a seed with n doors: [the car's door, a first pick, a number 0..n−2 for the host's choice].
/// Doors are numbered 0 to n − 1.
#[wasm_bindgen]
pub fn deal(seed: u32, i: u32, doors: u32) -> Vec<u32> {
    let n = doors.max(3);
    vec![pick_of(unit(seed, i, 0), n), pick_of(unit(seed, i, 1), n), pick_of(unit(seed, i, 2), n - 1)]
}

/// The other door the host leaves shut. A host who knows leaves the car's door shut whenever you
/// didn't pick it, and otherwise a door chosen by r (0..n−2) among the others; a host who guesses
/// always leaves the door chosen by r, whatever is behind it.
#[wasm_bindgen]
pub fn kept_door(doors: u32, car: u32, pick: u32, r: u32, knows: bool) -> u32 {
    let n = doors.max(3);
    if knows && car != pick { return car; }
    // the r-th door that isn't your pick
    let r = r.min(n - 2);
    if r < pick { r } else { r + 1 }
}

/// The doors the host opens: every door except your pick and the one he keeps shut.
#[wasm_bindgen]
pub fn opened_doors(doors: u32, pick: u32, kept: u32) -> Vec<u32> {
    (0..doors.max(3)).filter(|&d| d != pick && d != kept).collect()
}

/// Did the host show the car? (Only a guessing host can; such a game doesn't count.)
#[wasm_bindgen]
pub fn car_shown(car: u32, pick: u32, kept: u32) -> bool { car != pick && car != kept }

/// Play games start..start+count of a seed with first picks from the deal.
/// Returns [games that count, stay wins, switch wins, games voided because the car was shown].
#[wasm_bindgen]
pub fn simulate(seed: u32, start: u32, count: u32, doors: u32, knows: bool) -> Vec<f64> {
    let (mut games, mut stay, mut switch, mut void) = (0.0, 0.0, 0.0, 0.0);
    for i in start..start.saturating_add(count) {
        let d = deal(seed, i, doors);
        let (car, pick) = (d[0], d[1]);
        let kept = kept_door(doors, car, pick, d[2], knows);
        if car_shown(car, pick, kept) { void += 1.0; continue; }
        games += 1.0;
        if car == pick { stay += 1.0 } else { switch += 1.0 }
    }
    vec![games, stay, switch, void]
}

/// The exact chances, by adding up every possible world: the car behind each door (1/n each) and,
/// for each, every door the host might keep shut (equally likely among those he may keep). Only
/// the worlds where the host shows no car count; their total is shared out again.
/// Returns [chance staying wins, chance switching wins].
#[wasm_bindgen]
pub fn chances(doors: u32, knows: bool) -> Vec<f64> {
    let n = doors.max(3);
    let pick = 0;
    let (mut stay, mut switch, mut total) = (0.0, 0.0, 0.0);
    for car in 0..n {
        // the doors the host could keep shut in this world, each equally likely
        let options: Vec<u32> = (0..n - 1).map(|r| kept_door(n, car, pick, r, knows)).collect();
        let distinct: Vec<u32> = { let mut o = options.clone(); o.sort(); o.dedup(); o };
        for kept in distinct {
            let w = (1.0 / n as f64) * options.iter().filter(|&&k| k == kept).count() as f64 / options.len() as f64;
            if car_shown(car, pick, kept) { continue; }
            total += w;
            if car == pick { stay += w } else { switch += w }
        }
    }
    vec![stay / total, switch / total]
}

/// The worlds left once you have seen the host keep door `kept` shut (and show only goats):
/// [weight before, if the car is behind your pick; weight before, if it is behind the kept door].
/// A knowing host: 1/(n·(n−1)) and 1/n. A guessing host: 1/(n·(n−1)) each.
#[wasm_bindgen]
pub fn surviving_worlds(doors: u32, knows: bool) -> Vec<f64> {
    let n = doors.max(3) as f64;
    vec![1.0 / (n * (n - 1.0)), if knows { 1.0 / n } else { 1.0 / (n * (n - 1.0)) }]
}

#[cfg(test)]
mod tests {
    use super::*;
    const EPS: f64 = 1e-12;

    #[test]
    fn exact_chances_match_the_known_answers() {
        let c = chances(3, true);
        assert!((c[0] - 1.0 / 3.0).abs() < EPS && (c[1] - 2.0 / 3.0).abs() < EPS);
        let c = chances(100, true);
        assert!((c[0] - 0.01).abs() < EPS && (c[1] - 0.99).abs() < EPS);
        // a host who opens doors at random and happens to show goats: 50/50 (the "Monty Fall" problem)
        for n in [3, 10, 100] { let c = chances(n, false); assert!((c[0] - 0.5).abs() < EPS && (c[1] - 0.5).abs() < EPS, "{n}"); }
    }

    #[test]
    fn surviving_worlds_give_the_same_odds() {
        for n in [3u32, 10, 100] {
            for knows in [true, false] {
                let (w, c) = (surviving_worlds(n, knows), chances(n, knows));
                assert!((w[1] / (w[0] + w[1]) - c[1]).abs() < EPS);
            }
        }
        let w = surviving_worlds(3, true);
        assert!((w[0] - 1.0 / 6.0).abs() < EPS && (w[1] - 1.0 / 3.0).abs() < EPS);
    }

    #[test]
    fn the_host_never_opens_your_door_or_the_car() {
        for i in 0..2000 {
            let d = deal(7, i, 3);
            let kept = kept_door(3, d[0], d[1], d[2], true);
            assert_ne!(kept, d[1]);
            let open = opened_doors(3, d[1], kept);
            assert_eq!(open.len(), 1);
            assert!(!open.contains(&d[0]) && !open.contains(&d[1]));
        }
        assert_eq!(opened_doors(100, 5, 42).len(), 98);
    }

    #[test]
    fn many_games_settle_near_a_third_and_two_thirds() {
        let r = simulate(12345, 0, 300_000, 3, true);
        assert_eq!(r[0], 300_000.0); assert_eq!(r[3], 0.0);
        assert_eq!(r[1] + r[2], r[0]);   // with three doors, exactly one of the two strategies wins
        assert!((r[2] / r[0] - 2.0 / 3.0).abs() < 0.005, "{}", r[2] / r[0]);
        let r = simulate(9, 0, 300_000, 3, false);
        assert!((r[3] / 300_000.0 - 1.0 / 3.0).abs() < 0.005);   // a guessing host shows the car a third of the time
        assert!((r[2] / r[0] - 0.5).abs() < 0.005, "{}", r[2] / r[0]);
    }

    #[test]
    fn deals_are_repeatable_and_in_range() {
        assert_eq!(deal(1, 2, 3), deal(1, 2, 3));
        for i in 0..1000 { let d = deal(3, i, 10); assert!(d[0] < 10 && d[1] < 10 && d[2] < 9); }
    }
}
