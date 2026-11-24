# Math Toys

Small pieces of maths you can play with in the browser: https://mathtoys.pages.dev

The maths is in Rust, compiled to WebAssembly; the pages are plain HTML and JavaScript with
[Pico CSS](https://picocss.com). Each toy has a step-by-step walk-through and fun facts below it.

| Toy | Page | Maths |
|---|---|---|
| **Circles**: draw a closed shape, get its Fourier series and the spinning circles that draw it | `web/fourier/` | `src/fourier.rs` |
| **Distance, speed, acceleration**: draw one graph, get the other two by slopes and areas | `web/motion/` | `src/motion.rs` |

## Run it

```sh
cargo install wasm-pack            # once
rustup target add wasm32-unknown-unknown
./build.sh                         # tests the maths, builds web/pkg and the site in dist/site
python3 -m http.server 8080 -d dist/site
```

## Add a toy

1. Maths in a new `src/<toy>.rs` with `#[wasm_bindgen]` exports and `cargo test` tests; add `pub mod <toy>;` to `src/lib.rs`.
2. A page in `web/<toy>/` (`index.html` + `app.js` importing `../pkg/mathtoys.js`), using `../style.css`
   and the `.step` / `.facts` / `.reveal` sections for the walk-through.
3. A card on `web/index.html`.

## Deploy (Cloudflare Pages project `mathtoys`, direct upload)

Get the project's upload token (`GET /accounts/{id}/pages/projects/mathtoys/upload-token`, `result.jwt`)
into a private file, then:

```sh
(cd tools && npm i)
./build.sh
CF_PAGES_JWT_FILE=/path/to/jwt node tools/pages_upload.mjs   # uploads dist/site, writes /tmp/mathtoys-manifest.json
```

and create the deployment: `POST /accounts/{id}/pages/projects/mathtoys/deployments` with form fields
`manifest` (that JSON) and `branch=main`.
