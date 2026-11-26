// Every live page and the home page carries its link-preview tags and a 1200×630 picture (tools/og.mjs makes
// them on every build), so a link pasted into WhatsApp, LinkedIn, Facebook, Slack or X shows a proper card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const web = new URL('../web/', import.meta.url).pathname;
const SITE = 'https://lilavati.pages.dev';
const src = readFileSync(web + 'concepts.js', 'utf8');
const live = [...src.matchAll(/slug: '([a-z0-9-]+)'[^}]*?status: 'live'/g)].map(m => m[1]);

function pngSize(f) { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20), b.length]; }
function check(file, url, image) {
  const html = readFileSync(file, 'utf8'), tag = (attr, name) => (html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)) || [])[1];
  assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`), `${file}: canonical`);
  for (const p of ['og:title', 'og:description', 'og:site_name', 'og:type', 'og:image:alt']) assert.ok(tag('property', p), `${file}: ${p}`);
  assert.equal(tag('property', 'og:url'), url, `${file}: og:url`);
  assert.equal(tag('property', 'og:image'), image, `${file}: og:image`);
  assert.equal(tag('property', 'og:image:width'), '1200'); assert.equal(tag('property', 'og:image:height'), '630');
  assert.equal(tag('name', 'twitter:card'), 'summary_large_image', `${file}: twitter:card`);
  for (const n of ['twitter:title', 'twitter:description', 'twitter:image']) assert.ok(tag('name', n), `${file}: ${n}`);
  assert.ok(tag('property', 'og:description').length >= 40, `${file}: a real description`);
  const png = web + image.slice(SITE.length + 1);
  assert.ok(existsSync(png), `${png} exists`);
  const [w, h, bytes] = pngSize(png);
  assert.deepEqual([w, h], [1200, 630], `${png} is 1200×630`);
  assert.ok(bytes < 300_000, `${png} is under 300 KB for WhatsApp (${bytes})`);
}

test('there are live pages to check', () => assert.ok(live.length >= 10, String(live.length)));
test('the home page has its link preview', () => check(web + 'index.html', `${SITE}/`, `${SITE}/og/home.png`));
for (const slug of live) test(`${slug} has its link preview`, () => check(web + slug + '/index.html', `${SITE}/${slug}/`, `${SITE}/og/${slug}.png`));
