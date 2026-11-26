#!/bin/sh
# Builds the Rust maths to WebAssembly into web/pkg (needs wasm-pack: cargo install wasm-pack).
# Then serve the web folder with any static server, e.g.: python3 -m http.server 8080 -d web
set -e
cd "$(dirname "$0")"
cargo test
wasm-pack build --target web --out-dir web/pkg --release
echo "built web/pkg; run: python3 -m http.server 8080 -d web"
# link previews for social media: a 1200×630 picture and Open Graph / Twitter tags for every live page and
# the home page, made fresh on every build (tools/og.mjs); tests/share.test.mjs checks none is missing
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1])')
python3 -m http.server "$PORT" -d web >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1
node tools/og.mjs "http://localhost:$PORT" >/dev/null
kill $SERVER 2>/dev/null || true
node --test tests/*.test.mjs
# the publishable site: web/ without wasm-pack's packaging files
rm -rf dist && mkdir -p dist && cp -R web dist/site
rm -f dist/site/pkg/.gitignore dist/site/_redirects dist/site/pkg/package.json dist/site/pkg/README.md dist/site/pkg/LICENSE dist/site/pkg/*.d.ts
echo "site ready in dist/site (web/_redirects is sent with the deployment, not as a file)"
