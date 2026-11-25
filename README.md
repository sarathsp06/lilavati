# Math Toys

Small pieces of maths you can play with in the browser: https://mathtoys.pages.dev

The maths is in Rust, compiled to WebAssembly; the pages are plain HTML and JavaScript with
[Pico CSS](https://picocss.com). Each toy has a step-by-step walk-through and fun facts below it.

| Toy | Page | Maths |
|---|---|---|
| **Fourier series**: draw a closed shape, get its equation and the spinning circles that draw it | `web/fourier-series/` | `src/fourier.rs` |
| **Derivatives and integrals**: draw a motion, get its rates of change by slopes and areas | `web/derivatives/` | `src/motion.rs` |
| **Orbits and escape velocity**: launch a satellite, burn, escape, build a tower into space | `web/orbits/` | `src/orbit.rs` |
| **Linear algebra for AI** (a chapter of five): vectors and the dot product, linear transformations, the determinant, eigenvectors, the SVD | `web/dot-product/`, `web/linear-transformations/`, `web/determinant/`, `web/eigenvectors/`, `web/svd/` (shared `web/la.js`) | `src/linalg.rs` |

Pages are named after the concept, not the example. Every concept page has the same sections (Play, Try this,
Step by step, In symbols, Where you meet it, Fun facts, Common mix-ups, Next): see
[docs/CONCEPT_PAGE.md](docs/CONCEPT_PAGE.md) and the blank [docs/concept-template.html](docs/concept-template.html).
The list of concepts (live and coming soon) is `web/concepts.js`; the home page and each page's navigation
are built from it.

## Run it

```sh
cargo install wasm-pack            # once
rustup target add wasm32-unknown-unknown
./build.sh                         # tests the maths, builds web/pkg and the site in dist/site
python3 -m http.server 8080 -d dist/site
```

## Add a concept

See [docs/CONCEPT_PAGE.md](docs/CONCEPT_PAGE.md#adding-a-concept).

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
