# Working on Lilavati

Notes for anyone (person or AI agent) adding to or changing this site.

- **What it is:** small interactive maths pages at https://lilavati.pages.dev. The maths is in Rust
  (`src/`, built to WebAssembly with `./build.sh`); the pages are plain HTML and JavaScript in `web/`.
- **Writing a concept page:** follow [docs/CONCEPT_PAGE.md](docs/CONCEPT_PAGE.md). Every page has the same
  sections in the same order (Play, Try this, Step by step, In symbols, Where you meet it, Fun facts,
  Common mix-ups, Read more, Next); start from [docs/concept-template.html](docs/concept-template.html).
  This structure is for authors only; the home page does not explain it to visitors.
- **Naming:** pages are named after the concept (Fourier series, Derivatives and integrals), not the
  example used to show it.
- **Phones:** controls that change the picture sit right next to it; on phones the picture and its key
  controls stay at the top of the screen while the rest scrolls.
- **Registering a page:** add it to `web/concepts.js` (single concepts or a chapter `series`); the home
  page cards, top bar and previous/next links are built from that list.
- **Checks:** `cargo test` for the maths; open every changed page in a browser at desktop and phone
  width before deploying. Deploy steps are in [README.md](README.md#deploy-cloudflare-pages-project-lilavati-direct-upload).
