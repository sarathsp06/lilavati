// The list of concepts, and the parts every concept page shares (docs/CONCEPT_PAGE.md): the top bar,
// the topic and level chips, the "On this page" bar built from the sections, the Next cards, the
// fade-in on scroll. The home page uses the same list for its cards.
const SERIES = { name: 'Linear algebra for AI', slugs: ['dot-product', 'linear-transformations', 'determinant', 'eigenvectors', 'svd'] };
export const CHAPTERS = [SERIES];
export const CONCEPTS = [
  { slug: 'fourier-series', name: 'Fourier series', status: 'live', topic: 'Waves and signals', level: 'Curious', color: '#2563eb',
    idea: 'Any closed shape is a sum of circles spinning at different speeds.',
    blurb: 'Draw a shape and get its equation. A chain of spinning circles draws it back.',
    related: ['derivatives', 'superposition'] },
  { slug: 'derivatives', name: 'Derivatives and integrals', status: 'live', topic: 'Calculus', level: 'Starter', color: '#059669',
    idea: 'The slope of a graph tells how fast it changes; the area under it adds the changes back up.',
    blurb: 'Draw how something moves and watch its rate of change, and the rate of that, appear.',
    related: ['orbits', 'riemann-sums'] },
  { slug: 'orbits', name: 'Orbits and escape velocity', status: 'live', topic: 'Gravity and space', level: 'Curious', color: '#0891b2',
    idea: 'A satellite is always falling, but moves sideways so fast that it keeps missing the Earth.',
    blurb: 'Launch a satellite, speed it up, slow it down, escape, and build a tower into space.',
    related: ['derivatives', 'fourier-series'] },
  // a chapter: five pages in order (series), from vectors to the SVD, after the deep learning maths outline
  { slug: 'dot-product', name: 'Vectors and the dot product', status: 'live', topic: 'Linear algebra', level: 'Starter', color: '#0d9488', series: SERIES,
    idea: 'A vector is a list of numbers and an arrow; the dot product measures how much two arrows point the same way.',
    blurb: 'Drag two arrows and watch their dot product, angle and lengths, then train a one-neuron classifier by hand.',
    related: ['linear-transformations'] },
  { slug: 'linear-transformations', name: 'Linear transformations and matrices', status: 'live', topic: 'Linear algebra', level: 'Starter', color: '#4f46e5', series: SERIES,
    idea: 'A matrix is a recipe for moving every point of space: its columns say where the two basic arrows land.',
    blurb: 'Drag two arrows and the whole grid follows. Multiply matrices, undo them, and see what a neural network layer does.',
    related: ['determinant'] },
  { slug: 'determinant', name: 'The determinant', status: 'live', topic: 'Linear algebra', level: 'Starter', color: '#c2410c', series: SERIES,
    idea: 'The determinant says how much a matrix stretches area, and whether it flips space over.',
    blurb: 'Watch a square become a parallelogram: its area is the determinant. Zero means space is squashed flat.',
    related: ['eigenvectors'] },
  { slug: 'eigenvectors', name: 'Eigenvectors and eigenvalues', status: 'live', topic: 'Linear algebra', level: 'Curious', color: '#9333ea', series: SERIES,
    idea: 'An eigenvector is a direction a matrix only stretches and never turns; the eigenvalue is by how much.',
    blurb: 'Find the arrows that stay on their own line, apply a matrix again and again, and see why Google needed them.',
    related: ['svd'] },
  { slug: 'svd', name: 'Singular value decomposition', status: 'live', topic: 'Linear algebra', level: 'Curious', color: '#0369a1', series: SERIES,
    idea: 'Every matrix is a turn, then a stretch along two directions, then another turn.',
    blurb: 'Take any matrix apart into three simple moves, compress a picture, and find the main direction in data (PCA).',
    related: ['eigenvectors', 'fourier-series'] },
  { slug: 'riemann-sums', name: 'Riemann sums', status: 'soon', topic: 'Calculus', level: 'Starter', color: '#d97706',
    idea: 'Thinner and thinner rectangles fill the area under any curve.', related: ['derivatives'] },
  { slug: 'superposition', name: 'Superposition of waves', status: 'soon', topic: 'Waves and signals', level: 'Starter', color: '#7c3aed',
    idea: 'Simple waves add up into chords, beats and every sound you hear.', related: ['fourier-series'] },
  { slug: 'taylor-series', name: 'Taylor series', status: 'soon', topic: 'Calculus', level: 'Curious', color: '#db2777',
    idea: 'A curve near one point, rebuilt from its derivatives there.', related: ['derivatives'] },
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
  bar.innerHTML = `<a class="brand" href="../"><span class="logo" aria-hidden="true"></span>Lilavati</a><nav class="toc" aria-label="On this page"></nav>`;
  document.body.prepend(bar);
  // chips under the name
  const h1 = document.querySelector('#hero h1');
  const part = me.series ? `<span class="chip">${me.series.name} · ${me.series.slugs.indexOf(slug) + 1} of ${me.series.slugs.length}</span>` : '';
  h1.insertAdjacentHTML('beforebegin', `<p class="chips"><span class="chip">${me.topic}</span>${part}<span class="chip">${me.level}</span></p>`);
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
    <h3>${c.name}</h3><p>${c.idea}</p>${live && c.blurb ? `<p class="muted">${c.blurb}</p>` : ''}${live ? '<span class="go">Open →</span>' : ''}</div></${live ? 'a' : 'div'}>`;
}
