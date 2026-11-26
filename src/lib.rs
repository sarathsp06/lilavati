//! Maths toys: the maths behind each visualisation on the site, in Rust, built for the browser with
//! wasm-bindgen and tested natively (`cargo test`). One module per toy.
//!
//! - `fourier`: draw a closed shape, get its Fourier series and the spinning circles that draw it.
//! - `motion`: position, velocity and acceleration over time; draw one, get the others (derivatives).
//! - `orbit`: a satellite around the Earth under gravity; orbits, escape speed, towers into space.
//! - `linalg`: matrices as moves of the plane, determinants, eigenvectors, the SVD, dot products.
//! - `waves`: adding waves: cancelling, beats, harmonics.
//! - `games`: guess two-thirds of the average: levels of thinking, best replies, the Nash equilibrium.
//! - `monty`: the Monty Hall game: dealing games, the host's move, many games at once, the exact chances.
pub mod fourier;
pub mod motion;
pub mod orbit;
pub mod linalg;
pub mod waves;
pub mod games;
pub mod monty;
pub mod brachistochrone;
pub mod chaos;
pub mod threebody;
pub mod topology;
pub mod tesseract;
pub mod slits;
