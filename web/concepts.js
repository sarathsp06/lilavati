// The list of concepts, and the parts every concept page shares (docs/CONCEPT_PAGE.md): the top bar,
// the topic and level chips, the "On this page" bar built from the sections, the Next cards, the
// fade-in on scroll. The home page uses the same list for its cards.
const SERIES = { name: 'Linear algebra for AI', slugs: ['dot-product', 'linear-transformations', 'determinant', 'eigenvectors', 'svd'] };
export const CHAPTERS = [SERIES];
export const CONCEPTS = [
  { slug: 'fourier-series', hook: 'How to draw anything with circles', tagline: 'Every shape you can trace is just circles spinning on circles.', name: 'Fourier series', status: 'live', topic: 'Waves and signals', level: 'Curious', color: '#2563eb',
    idea: 'Any closed shape is a sum of circles spinning at different speeds.',
    blurb: 'Draw a shape and get its equation. A chain of spinning circles draws it back.',
    related: ['superposition', 'derivatives'] },
  { slug: 'derivatives', hook: 'What your speedometer actually measures', tagline: 'Speed is how fast distance changes; distance is all the speed added up.', name: 'Derivatives and integrals', status: 'live', topic: 'Calculus', level: 'Starter', color: '#059669',
    idea: 'The slope of a graph tells how fast it changes; the area under it adds the changes back up.',
    blurb: 'Draw how something moves and watch its rate of change, and the rate of that, appear.',
    related: ['orbits', 'riemann-sums'] },
  { slug: 'orbits', hook: 'Why the space station never falls down', tagline: "It's always falling. It just keeps missing the Earth.", name: 'Orbits and escape velocity', status: 'live', topic: 'Gravity and space', level: 'Curious', color: '#0891b2',
    idea: 'A satellite is always falling, but moves sideways so fast that it keeps missing the Earth.',
    blurb: 'Launch a satellite, fire its engine to speed it up or slow it down, and push it past escape velocity.',
    related: ['derivatives', 'fourier-series'] },
  // a chapter: five pages in order (series), from vectors to the SVD, after the deep learning maths outline
  { slug: 'dot-product', hook: 'How Spotify knows two songs are alike', tagline: 'Turn things into arrows; similar things point the same way.', name: 'Vectors and the dot product', status: 'live', topic: 'Linear algebra', level: 'Starter', color: '#0d9488', series: SERIES,
    idea: 'A vector is a list of numbers and an arrow; the dot product measures how much two arrows point the same way.',
    blurb: 'Drag two arrows and watch their dot product, angle and lengths, then train a one-neuron classifier by hand.',
    related: ['linear-transformations'] },
  { slug: 'linear-transformations', hook: 'What one layer of a neural network does', tagline: 'It stretches, turns and folds space, and a matrix is the recipe.', name: 'Linear transformations and matrices', status: 'live', topic: 'Linear algebra', level: 'Starter', color: '#4f46e5', series: SERIES,
    idea: 'A matrix is a recipe for moving every point of space: its columns say where the two basic arrows land.',
    blurb: 'Drag two arrows and the whole grid follows. Multiply matrices, undo them, and see what a neural network layer does.',
    related: ['determinant'] },
  { slug: 'determinant', hook: 'How much a move stretches the world', tagline: 'One number says how areas grow, shrink or flip inside out.', name: 'The determinant', status: 'live', topic: 'Linear algebra', level: 'Starter', color: '#c2410c', series: SERIES,
    idea: 'The determinant says how much a matrix stretches area, and whether it flips space over.',
    blurb: 'Watch a square become a parallelogram: its area is the determinant. Zero means space is squashed flat.',
    related: ['eigenvectors'] },
  { slug: 'eigenvectors', hook: 'How Google ranked the whole web', tagline: 'Find the directions a matrix only stretches, never turns.', name: 'Eigenvectors and eigenvalues', status: 'live', topic: 'Linear algebra', level: 'Curious', color: '#9333ea', series: SERIES,
    idea: 'An eigenvector is a direction a matrix only stretches and never turns; the eigenvalue is by how much.',
    blurb: 'Find the arrows that stay on their own line, apply a matrix again and again, and see why Google needed them.',
    related: ['svd'] },
  { slug: 'svd', hook: 'How to shrink a photo to a few numbers', tagline: 'Any matrix is a turn, a stretch and another turn. Keep the big stretches.', name: 'Singular value decomposition', status: 'live', topic: 'Linear algebra', level: 'Curious', color: '#0369a1', series: SERIES,
    idea: 'Every matrix is a turn, then a stretch along two directions, then another turn.',
    blurb: 'Take any matrix apart into three simple moves, compress a picture, and find the main direction in data (PCA).',
    related: ['eigenvectors', 'fourier-series'] },
  { slug: 'nash-equilibrium', hook: 'Why the stock market is a guessing game about guesses', tagline: 'Everyone picks a number from 0 to 100. Whoever is closest to two-thirds of the average wins.', name: 'Nash equilibrium', status: 'live', topic: 'Games and decisions', level: 'Starter', color: '#be123c',
    idea: 'When everyone guesses what everyone else will guess, the group settles where nobody gains by changing alone.',
    blurb: 'Play guess two-thirds of the average against computer players or friends, and watch levels of thinking lead to the equilibrium.',
    related: ['eigenvectors', 'derivatives'] },
  { slug: 'riemann-sums', name: 'Riemann sums', status: 'soon', topic: 'Calculus', level: 'Starter', color: '#d97706',
    idea: 'Thinner and thinner rectangles fill the area under any curve.', related: ['derivatives'] },
  { slug: 'superposition', hook: 'How noise-cancelling headphones make silence', tagline: 'Add a sound to its mirror image and you hear nothing at all.', name: 'Superposition of waves', status: 'live', topic: 'Waves and signals', level: 'Starter', color: '#7c3aed',
    idea: 'Waves that meet simply add up, moment by moment: into chords, beats, silence and every sound you hear.',
    blurb: 'Mix three waves, listen to them, and see cancelling, beats and square waves appear.',
    related: ['fourier-series', 'derivatives'] },
  { slug: 'taylor-series', name: 'Taylor series', status: 'soon', topic: 'Calculus', level: 'Curious', color: '#db2777',
    idea: 'A curve near one point, rebuilt from its derivatives there.', related: ['derivatives'] },
  // the person's list of 2026-11-25, in their order; each page gets its preview from web/<slug>/preview.js
  { slug: 'monty-hall', hook: 'Why you should always switch doors', tagline: 'Three doors, one car, one goat revealed. Switching wins twice as often, and you can prove it by playing.', name: 'The Monty Hall problem', status: 'soon', topic: 'Probability', level: 'Starter', color: '#b45309', previewFile: true,
    idea: 'Your first pick is right one time in three; the host\u2019s reveal moves the other two-thirds onto one door.', related: ['nash-equilibrium'] },
  { slug: 'brachistochrone', hook: 'The fastest slide is not the straight one', tagline: 'Drop steeply first, then coast: the curve that beats the straight line every time.', name: 'The brachistochrone', status: 'soon', topic: 'Calculus', level: 'Curious', color: '#0e7490', previewFile: true,
    idea: 'The quickest path between two points under gravity is a cycloid, found by comparing whole paths, not points.', related: ['derivatives', 'orbits'] },
  { slug: 'chaos', hook: 'Why the weather forecast stops at ten days', tagline: 'Two almost identical starts, two completely different futures. Deterministic, yet unpredictable.', name: 'Chaos and the butterfly effect', status: 'live', topic: 'Dynamics', level: 'Curious', color: '#7c2d12', previewFile: true,
    idea: 'Simple rules can amplify a tiny difference until the future is unknowable in practice.',
    blurb: 'Start two points a millionth apart on Lorenz\u2019s butterfly, watch the gap double and double, and see why forecasts have a horizon.', related: ['three-body-problem', 'derivatives'] },
  { slug: 'three-body-problem', hook: 'Why three planets can\u2019t be predicted forever', tagline: 'Two bodies dance in ellipses. Add a third and the dance turns to chaos.', name: 'The three-body problem', status: 'soon', topic: 'Gravity and space', level: 'Curious', color: '#1d4ed8', previewFile: true,
    idea: 'Gravity between three bodies has no formula for the future; only step-by-step computation, and tiny errors grow.', related: ['orbits', 'chaos'] },
  { slug: 'topology', hook: 'Why a coffee cup is a doughnut', tagline: 'Stretch, bend and squeeze all you like, never tear or glue: only the holes count.', name: 'Topology', status: 'soon', topic: 'Shapes', level: 'Starter', color: '#15803d', previewFile: true,
    idea: 'Shapes that can be deformed into each other without tearing are the same; the number of holes tells them apart.', related: ['linear-transformations'] },
  { slug: 'fourth-dimension', hook: 'What a four-dimensional cube looks like from here', tagline: 'A cube\u2019s shadow is flat. A tesseract\u2019s shadow is a cube. Turn it and watch the shadow change.', name: 'Four-dimensional geometry', status: 'soon', topic: 'Geometry', level: 'Curious', color: '#6d28d9', previewFile: true,
    idea: 'A fourth direction at right angles to all three; we see it only as projections that shift as it turns.', related: ['linear-transformations', 'topology'] },
  { slug: 'double-slit', hook: 'Why one electron goes through both slits', tagline: 'Fire them one at a time and the stripes still build up. Look which slit, and they vanish.', name: 'The double-slit experiment', status: 'soon', topic: 'Quantum', level: 'Curious', color: '#be185d', previewFile: true,
    idea: 'Add the two paths\u2019 amplitudes before squaring; the cross term is the interference pattern.', related: ['superposition', 'fourier-series'] },
];
export const bySlug = Object.fromEntries(CONCEPTS.map(c => [c.slug, c]));

// fade sections in as they come into view
const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }, { threshold: 0.1 });
for (const el of document.querySelectorAll('.reveal')) io.observe(el);

const slug = document.body.dataset.concept, me = bySlug[slug];
if (me) {
  document.documentElement.style.setProperty('--accent', me.color);
  // the top bar
  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML = `<a class="brand" href="../"><span class="logo" aria-hidden="true"></span>Lilavati</a><nav class="toc" aria-label="On this page"></nav><a class="gh" href="https://github.com/sarathsp06/lilavati" target="_blank" rel="noopener" title="Source code on GitHub" aria-label="Source code on GitHub"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>`;
  document.body.prepend(bar);
  // chips under the name
  const h1 = document.querySelector('#hero h1');
  const part = me.series ? `<span class="chip">${me.series.name} · ${me.series.slugs.indexOf(slug) + 1} of ${me.series.slugs.length}</span>` : '';
  h1.insertAdjacentHTML('beforebegin', `<p class="chips"><span class="chip concept">${me.name}</span><span class="chip">${me.topic}</span>${part}<span class="chip">${me.level}</span></p>`);
  // "On this page", with the current section marked while scrolling
  const toc = bar.querySelector('.toc'), secs = [...document.querySelectorAll('section[data-label]')];
  for (const s of secs) toc.insertAdjacentHTML('beforeend', `<a href="#${s.id}">${s.dataset.label}</a>`);
  // the current section is the last one whose top has passed a third of the way down the screen
  const mark = () => {
    let cur = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top < innerHeight / 3) cur = s;
    if (innerHeight + scrollY >= document.body.scrollHeight - 4) cur = secs[secs.length - 1];
    for (const a of toc.children) a.classList.toggle('on', a.getAttribute('href') === '#' + cur.id);
  };
  addEventListener('scroll', mark, { passive: true }); mark();
  // Next: the related concepts
  const next = document.getElementById('next');
  // a chapter page links back and forward along its chapter
  if (next && me.series) {
    const k = me.series.slugs.indexOf(slug), prev = bySlug[me.series.slugs[k - 1]], after = bySlug[me.series.slugs[k + 1]];
    next.insertAdjacentHTML('beforebegin', `<nav class="series" aria-label="${me.series.name}">${prev ? `<a href="../${prev.slug}/">← ${k}. ${prev.name}</a>` : `<span class="muted">${me.series.name}: start</span>`}${after ? `<a href="../${after.slug}/">${k + 2}. ${after.name} →</a>` : `<span class="muted">End of ${me.series.name}</span>`}</nav>`);
  }
  if (next) {
    next.innerHTML = `<h2>Next</h2><div class="cards small">${me.related.map(r => bySlug[r]).filter(Boolean).map(card).join('')}</div>`;
  }
}

// a concept as a card (home page and Next)
export function card(c) {
  const live = c.status === 'live';
  return `<${live ? 'a' : 'div'} class="ccard${live ? '' : ' soon'}" ${live ? `href="${slug ? '../' : ''}${c.slug}/"` : ''} style="--accent:${c.color}">
    ${live && !slug ? `<canvas class="preview" data-preview="${c.slug}" width="560" height="260" aria-hidden="true"></canvas>` : ''}
    <div class="body">${c.series ? `<span class="num">Part ${c.series.slugs.indexOf(c.slug) + 1}</span>` : ''}<p class="chips"><span class="chip">${c.topic}</span>${live ? '' : '<span class="chip">Coming soon</span>'}</p>
    <h3>${c.hook || c.name}</h3>${c.hook ? `<p class="cname">${c.name}</p>` : ''}<p>${c.tagline || c.idea}</p>${live && c.blurb ? `<p class="muted">${c.blurb}</p>` : ''}${live ? '<span class="go">Open →</span>' : ''}</div></${live ? 'a' : 'div'}>`;
}

// Together: invite people to explore a page with you (together/index.js)
import('./together/index.js').catch(e => console.warn('[together] not available', e));
