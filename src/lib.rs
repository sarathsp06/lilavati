//! Maths toys: the maths behind each visualisation on the site, in Rust, built for the browser with
//! wasm-bindgen and tested natively (`cargo test`). One module per toy.
//!
//! - `fourier`: draw a closed shape, get its Fourier series and the spinning circles that draw it.
//! - `motion`: distance, velocity and acceleration over time; draw one, get the others.
pub mod fourier;
pub mod motion;
