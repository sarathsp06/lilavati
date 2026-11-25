# Math Toys

**Maths you can touch.** Small interactive pages where you draw, drag and play with one big idea at a time,
then scroll down and it explains itself step by step, with fun facts along the way.

<p align="center"><img src="docs/media/circles.gif" width="360" alt="Spinning circles, each riding on the last, drawing a heart: a Fourier series"></p>
<p align="center"><em>Circles riding on circles, drawing a heart. That's a Fourier series.</em></p>

**Try it:** https://mathtoys.pages.dev, in any browser, on a phone too. Nothing to install.

## What's inside

| Concept | What you do |
|---|---|
| [Fourier series](https://mathtoys.pages.dev/fourier-series/) | Draw any closed shape and get its equation; a chain of spinning circles draws it back |
| [Derivatives and integrals](https://mathtoys.pages.dev/derivatives/) | Draw how something moves and watch velocity and acceleration appear, as slopes and areas |
| [Orbits and escape velocity](https://mathtoys.pages.dev/orbits/) | Launch a satellite, fire its engine, escape the Earth, build a tower into space |

**Chapter: Linear algebra for AI**, the matrix maths every neural network is made of:

1. [Vectors and the dot product](https://mathtoys.pages.dev/dot-product/), and a neuron you can train by hand
2. [Linear transformations and matrices](https://mathtoys.pages.dev/linear-transformations/)
3. [The determinant](https://mathtoys.pages.dev/determinant/)
4. [Eigenvectors and eigenvalues](https://mathtoys.pages.dev/eigenvectors/)
5. [Singular value decomposition](https://mathtoys.pages.dev/svd/), with picture compression and PCA

Every page has the same shape: a toy to play with, small experiments to try, a step-by-step walk-through
drawn from whatever you made, the formulas read out in plain words, where you meet it in real life, fun
facts, common mix-ups and further reading.

## How it's built

- **The maths is in Rust** (`src/`), compiled to WebAssembly and run in your browser: Fourier series,
  numerical derivatives and integrals, an orbit integrator, eigenvalues and the SVD. `cargo test` checks it
  against known answers (a circle is one Fourier term, the space station goes round in about 92 minutes,
  turn × stretch × turn rebuilds the matrix).
- **The pages are plain HTML and JavaScript** (`web/`) with [Pico CSS](https://picocss.com). No framework,
  no build step for the pages themselves.
- **Hosted on Cloudflare Pages.**

| Where | What |
|---|---|
| `src/fourier.rs`, `motion.rs`, `orbit.rs`, `linalg.rs` | The maths, one module per topic, with tests |
| `web/<concept>/` | One folder per concept page |
| `web/concepts.js` | The list of concepts and chapters; builds the home page and page navigation |
| `web/la.js` | Shared drawing for the linear algebra pages |
| [AGENTS.md](AGENTS.md), [docs/CONCEPT_PAGE.md](docs/CONCEPT_PAGE.md) | How to write a new page |

## Run it

```sh
cargo install wasm-pack            # once
rustup target add wasm32-unknown-unknown
./build.sh                         # tests the maths, builds web/pkg and the site in dist/site
python3 -m http.server 8080 -d dist/site
```

## Add a concept

See [AGENTS.md](AGENTS.md) and [docs/CONCEPT_PAGE.md](docs/CONCEPT_PAGE.md#adding-a-concept).

## Deploy (Cloudflare Pages project `mathtoys`, direct upload)

Get the project's upload token (`GET /accounts/{id}/pages/projects/mathtoys/upload-token`, `result.jwt`)
into a private file, then:

```sh
(cd tools && npm i)
./build.sh
CF_PAGES_JWT_FILE=/path/to/jwt node tools/pages_upload.mjs   # uploads dist/site, writes /tmp/mathtoys-manifest.json
```

and create the deployment: `POST /accounts/{id}/pages/projects/mathtoys/deployments` with form fields
`manifest` (that JSON), `branch=main` and `_redirects` (the contents of `web/_redirects`, which sends the old
`/fourier/` and `/motion/` addresses to the new ones).

## License

MIT, see [LICENSE](LICENSE).
