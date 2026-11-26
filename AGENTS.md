# Working on Lilavati

Notes for anyone (person or AI agent) adding to or changing this site.

- **What it is:** small interactive maths pages at https://lilavati.pages.dev. The maths is in Rust
  (`src/`, built to WebAssembly with `./build.sh`); the pages are plain HTML and JavaScript in `web/`.
- **Writing a concept page:** follow [docs/CONCEPT_PAGE.md](docs/CONCEPT_PAGE.md). Every page has the same
  sections in the same order (Play, Try this, Step by step, In symbols, Where you meet it, Fun facts,
  Common mix-ups, Read more, Next); start from [docs/concept-template.html](docs/concept-template.html).
  This structure is for authors only; the home page does not explain it to visitors.
- **Explanations are visual derivations (the person's rule, 2026-11-25):** every Step by step figure must
  show *how* a result is obtained, not just the result. If a step produces a number or a formula, its figure
  derives it on screen: the intermediate quantities drawn and, where it helps, animated (for example the
  Fourier page scans a test wave across the signal, fills the product green/red and lets the running total
  arrive at the coefficient). A bar chart of the answers or a finished picture alone is not an explanation.
  Figures follow what the reader set up above, and offer a small control (pick k, pick a case) when a
  derivation has cases.
- **Say what the concept is (the person's rule, 2026-11-25):** right after the heading, every page has a short
  **What it is** block (`id="what"`) that defines the concept itself in plain words, at a high level, and says
  how the page's example is an instance of it. The demo never replaces the definition: the Fourier page must say
  what a Fourier series is, not only draw with circles.
- **Show the bare concept before the application (the person's rule, 2026-11-26):** when the page's main demo is an
  application of the concept (drawing with circles is an application of Fourier series), the reader must first
  see the concept itself on its simplest example. Right after "What it is", add a small **The idea** section
  (`id="idea"`, `data-label="The idea"`): one interactive figure of the plainest case (for Fourier, a square wave
  built from sine waves), with the formula written out with its actual numbers and one line leading into the main
  demo. Pages whose demo already is the plain concept don't need it. "What it is" itself stays short and plain:
  one sentence, then a few bullets for the parts, not one dense paragraph.
- **Symbols the reader can read (same rule):** the first use of every symbol says what it is; products are written
  so they cannot be misread (`cos(3·t)`, read "three times t", never a bare `3t` that could be "the third t");
  subscripts and indices are explained; every formula has a one-line plain reading under it. See docs/CONCEPT_PAGE.md.
- **Words on the site:** call it Lilavati; don't call pages "toys" in visible text. Keep visible text plain;
  prefer a simple readout or nothing over a busy strip that is hard to read.
- **Headings (the person's choice, 2026-11-25, revised 2026-11-26):** each page's big heading is a real-world hook, a short
  question or claim from everyday life ("Why the space station never falls down"), with a one-line tagline under
  it. The concept name stays in the URL, the page title and a chip above the heading. Set `hook` and `tagline`
  in `web/concepts.js`. **Exception, by popularity:** when the concept's own name is widely known (the butterfly
  effect, the three-body problem, Monty Hall, Nash equilibrium, the double-slit experiment, the fourth dimension),
  set `title` in `web/concepts.js` as well: the page's h1 and home card show that name, and the hook sits under it
  as `<p class="hook">` (home: `.chook`). Keep `<title>` as "Name · hook · Lilavati".
- **README:** don't list concepts in README.md; the site is the list. Registering a page in `web/concepts.js` is enough.
- **Naming:** pages are named after the concept (Fourier series, Derivatives and integrals), not the
  example used to show it.
- **Phones:** controls that change the picture sit right next to it; on phones the picture and its key
  controls stay at the top of the screen while the rest scrolls.
- **Registering a page:** add it to `web/concepts.js` (single concepts or a chapter `series`); the home
  page cards, top bar and previous/next links are built from that list. A page's animated home-page card
  lives in `web/<slug>/preview.js` (default export `(c, w, h, sec) => void`, a 560×260 canvas 2D context)
  with `previewFile: true` on its entry; page-specific styles go in `web/<slug>/page.css`, linked from the
  page, so pages never edit `web/home.js` or `web/style.css`.
- **Planned concepts (the person's list, 2026-11-25):** the `soon` entries in `web/concepts.js` are the
  queue, in the person's order: Monty Hall, brachistochrone, chaos, three-body, topology, fourth dimension,
  double slit, then Riemann sums and Taylor series.
- **Together (shared sessions, 2026-11-25):** people can invite others with a link and explore a page together
  (chat, and one person's changes show for everyone). Every page must work with it; see
  [docs/TOGETHER.md](docs/TOGETHER.md). Controls in `<main>` and its buttons are shared automatically. State
  that lives only in JavaScript (dragged points, drawings, simulations) must be handed over with
  `share(get, set)` from `web/together/share.js` at the end of `app.js`; a page with nothing beyond its
  controls still calls `share()`. Validate what `set` receives (it comes from other browsers; `nums()` helps).
  Mark controls that must stay personal (copy buttons, sound, a playback clock) with `data-local`. Pages
  where people act separately (a game with hidden guesses) use `room` from the same file instead.
- **Link previews (social media):** every page carries Open Graph and Twitter card tags and a 1200×630 picture
  (`web/og/<slug>.png`), made from its title, hook and home-card preview. After adding or renaming a page run
  `node tools/og.mjs http://localhost:8080` with `web/` served there; it rewrites the `<!-- share -->` block in
  each page's `<head>`. Pages also get a **Share** button (the device's share sheet, or copy the link).
- **Checks:** `./build.sh` runs `cargo test` for the maths and `node --test tests/*.test.mjs` for Together; open every changed page in a browser at desktop and phone
  width before deploying. Deploy steps are in [docs/DEPLOY.md](docs/DEPLOY.md).
