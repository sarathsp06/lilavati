#!/bin/sh
# Builds the Rust maths to WebAssembly into web/pkg (needs wasm-pack: cargo install wasm-pack).
# Then serve the web folder with any static server, e.g.: python3 -m http.server 8080 -d web
set -e
cd "$(dirname "$0")"
cargo test
node --test tests/*.test.mjs
wasm-pack build --target web --out-dir web/pkg --release
echo "built web/pkg; run: python3 -m http.server 8080 -d web"
# the publishable site: web/ without wasm-pack's packaging files
rm -rf dist && mkdir -p dist && cp -R web dist/site
rm -f dist/site/pkg/.gitignore dist/site/_redirects dist/site/pkg/package.json dist/site/pkg/README.md dist/site/pkg/LICENSE dist/site/pkg/*.d.ts
echo "site ready in dist/site (web/_redirects is sent with the deployment, not as a file)"
