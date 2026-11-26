//! Guessing games: everyone picks a number from 0 to 100 and whoever is closest to p times the
//! average wins (p = 2/3 in the classic game). Levels of thinking, the best reply, the equilibrium,
//! and computer players that think a few levels deep and learn from the last round.
use wasm_bindgen::prelude::*;

/// The average of the guesses (0 for none).
#[wasm_bindgen]
pub fn average(guesses: &[f64]) -> f64 {
    if guesses.is_empty() { 0.0 } else { guesses.iter().sum::<f64>() / guesses.len() as f64 }
}

/// The number to be closest to: p times the average.
#[wasm_bindgen]
pub fn target(guesses: &[f64], p: f64) -> f64 { p * average(guesses) }

/// Who wins: the indices of the guesses closest to the target (more than one on a tie).
#[wasm_bindgen]
pub fn winners(guesses: &[f64], p: f64) -> Vec<u32> {
    let t = target(guesses, p);
    let best = guesses.iter().map(|g| (g - t).abs()).fold(f64::INFINITY, f64::min);
    guesses.iter().enumerate().filter(|(_, g)| ((*g - t).abs() - best).abs() < 1e-9).map(|(i, _)| i as u32).collect()
}

/// The best guess if everyone else's average is x (with many players, your own guess hardly moves it).
#[wasm_bindgen]
pub fn best_reply(x: f64, p: f64) -> f64 { p * x }

/// Level-k thinking: level 0 guesses the anchor (50, the middle, in a first round); level k assumes
/// everyone else is level k−1 and replies to that, so guesses anchor·p^k.
#[wasm_bindgen]
pub fn level_guess(k: u32, p: f64, anchor: f64) -> f64 { anchor * p.powi(k as i32) }

/// Replying to the reply again and again from x0: x0, p·x0, p²·x0, … (n + 1 values). For p < 1 it
/// shrinks towards 0, the only guess that is a best reply to itself: the Nash equilibrium.
#[wasm_bindgen]
pub fn iterate_replies(x0: f64, p: f64, n: usize) -> Vec<f64> {
    let mut out = Vec::with_capacity(n + 1);
    let mut x = x0;
    for _ in 0..=n { out.push(x); x = best_reply(x, p); }
    out
}

/// How many levels of thinking bring 50 below `within` (the levels to reach the equilibrium, roughly).
#[wasm_bindgen]
pub fn levels_to_reach(p: f64, within: f64) -> u32 {
    if !(p > 0.0 && p < 1.0) || within <= 0.0 { return u32::MAX; }
    let mut k = 0; let mut x = 50.0;
    while x >= within { x *= p; k += 1; }
    k
}

// a small repeatable random generator, so every browser in a session makes the same computer guesses
fn rng(seed: u64) -> impl FnMut() -> f64 {
    let mut s = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ 0xD1B5_4A32_D192_ED03;
    move || { s ^= s << 13; s ^= s >> 7; s ^= s << 17; (s >> 11) as f64 / (1u64 << 53) as f64 }
}

/// n computer players' guesses for a round. In the first round (last_avg < 0) each thinks 0 to 3
/// levels deep from 50 (mostly 1 or 2, as people do); later rounds start from the last average
/// instead, so the group drifts down round after round. A little noise each, kept within 0..100.
/// The same (n, round, last_avg, p, seed) always gives the same guesses.
#[wasm_bindgen]
pub fn computer_guesses(n: usize, round: u32, last_avg: f64, p: f64, seed: u32) -> Vec<f64> {
    let mut r = rng(((seed as u64) << 32) ^ round as u64);
    (0..n).map(|_| {
        let u = r();
        let (anchor, k) = if last_avg < 0.0 {
            (50.0, if u < 0.2 { 0 } else if u < 0.6 { 1 } else if u < 0.9 { 2 } else { 3 })
        } else {
            (last_avg, if u < 0.15 { 0 } else if u < 0.75 { 1 } else { 2 })
        };
        // noise: about ±12% of the guess, a bit more in the first round
        let spread = if last_avg < 0.0 { 0.18 } else { 0.12 };
        let g = level_guess(k, p, anchor) * (1.0 + spread * (r() + r() - 1.0));
        (g * 10.0).round() / 10.0
    }).map(|g| g.clamp(0.0, 100.0)).collect()
}

/// A game of two players with two choices each, the plainest place to see a Nash equilibrium.
/// `you` and `them` hold the points for each cell, row by row: [row 1 col 1, row 1 col 2, row 2 col 1,
/// row 2 col 2]; you pick the row, they pick the column. For each cell: 1 if you would gain by switching
/// rows on your own, 2 if they would gain by switching columns, 3 if both would, 0 if nobody would.
/// The cells with 0 are the Nash equilibria.
#[wasm_bindgen]
pub fn switch_gains(you: &[f64], them: &[f64]) -> Vec<u8> {
    if you.len() < 4 || them.len() < 4 { return vec![]; }
    (0..4).map(|i| {
        let (r, c) = (i / 2, i % 2);
        let other_row = (1 - r) * 2 + c;
        let other_col = r * 2 + (1 - c);
        (if you[other_row] > you[i] { 1 } else { 0 }) | (if them[other_col] > them[i] { 2 } else { 0 })
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    const P: f64 = 2.0 / 3.0;

    #[test]
    fn target_and_winner() {
        let g = [50.0, 30.0, 20.0, 0.0];   // average 25, target 16.67
        assert!((target(&g, P) - 50.0 / 3.0).abs() < 1e-12);
        assert_eq!(winners(&g, P), vec![2]);
        assert_eq!(winners(&[10.0, 10.0], P), vec![0, 1]);
        assert!(winners(&[], P).is_empty());
    }

    #[test]
    fn levels_of_thinking() {
        assert!((level_guess(1, P, 50.0) - 33.333_333).abs() < 1e-5);
        assert!((level_guess(2, P, 50.0) - 22.222_222).abs() < 1e-5);
        assert_eq!(level_guess(0, P, 50.0), 50.0);
        // below 1 after 10 levels (50·(2/3)^10 = 0.867); 27 levels to get within a thousandth
        assert_eq!(levels_to_reach(P, 1.0), 10);
        assert_eq!(levels_to_reach(P, 1e-3), 27);
    }

    #[test]
    fn zero_is_the_only_fixed_point() {
        let xs = iterate_replies(100.0, P, 60);
        assert!(xs.windows(2).all(|w| w[1] < w[0]));
        assert!(xs[60] < 1e-8);
        assert_eq!(best_reply(0.0, P), 0.0);
        // with p = 1 every guess is a best reply to itself
        assert_eq!(best_reply(42.0, 1.0), 42.0);
    }

    #[test]
    fn computer_players_are_repeatable_and_drift_down() {
        let (a, b) = (computer_guesses(7, 1, -1.0, P, 1), computer_guesses(7, 1, -1.0, P, 1));
        assert_eq!(a, b);
        assert!(a.iter().all(|g| (0.0..=100.0).contains(g)));
        let avg1 = average(&computer_guesses(400, 1, -1.0, P, 3));
        assert!(avg1 > 20.0 && avg1 < 40.0, "first round average {avg1}");
        // replaying round after round from their own average, they head for 0
        let mut last = avg1;
        for round in 2..12 { last = average(&computer_guesses(400, round, last, P, 3)); }
        assert!(last < avg1 / 4.0, "after 10 rounds {last}");
    }

    #[test]
    fn two_by_two_equilibria() {
        // two shops pick a price, high or low: both low is the only equilibrium, though both high pays more
        let (you, them) = ([3.0, 0.0, 5.0, 1.0], [3.0, 5.0, 0.0, 1.0]);
        assert_eq!(switch_gains(&you, &them), vec![3, 1, 2, 0]);
        // meeting up: both at the café and both at the cinema are equilibria
        assert_eq!(switch_gains(&[2.0, 0.0, 0.0, 1.0], &[2.0, 0.0, 0.0, 1.0]), vec![0, 3, 3, 0]);
        // a penalty kick: someone always wants to switch, so there is no equilibrium in plain choices
        let g = switch_gains(&[0.0, 1.0, 1.0, 0.0], &[1.0, 0.0, 0.0, 1.0]);
        assert!(g.iter().all(|&x| x != 0), "{g:?}");
        assert!(switch_gains(&[1.0], &[1.0]).is_empty());
    }
}
