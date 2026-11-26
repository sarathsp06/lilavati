// Link previews for social media: a 1200×630 picture per page (web/og/<slug>.png, web/og/home.png) and the
// Open Graph / Twitter tags in each page's <head>, between <!-- share --> and <!-- /share -->.
// ./build.sh runs it on every build (serving web/ on a spare port), and tests/share.test.mjs then fails the
// build if any live page or the home page lacks its tags or picture. By hand: node tools/og.mjs <url of web/>
// Needs playwright-core and a Chromium (CHROME=/path/to/chrome-headless-shell, or Playwright's own).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE = 'https://lilavati.pages.dev';
const base = process.argv[2] || 'http://localhost:8080';
const web = new URL('../web/', import.meta.url).pathname;
const { chromium } = await import('playwright-core').catch(() => import(join(homedir(), 'node_modules/playwright-core/index.mjs')));
const shell = join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const exe = process.env.CHROME || (existsSync(shell) ? shell : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(base + '/', { waitUntil: 'networkidle' });
const live = await page.evaluate(async () => (await import('/concepts.js')).CONCEPTS.filter(c => c.status === 'live').map(c => c.slug));
await page.waitForFunction(n => Object.keys(window.__lilavatiPreviews || {}).length >= n, live.length, { timeout: 30000 });

// one card: the name or the everyday question big, the tagline, and the page's own home-card picture
async function card(file, slugs, big, small, chip, accent) {
  await page.evaluate(({ slugs, big, small, chip, accent }) => {
    document.getElementById('og-card')?.remove();
    const d = document.createElement('div');
    d.id = 'og-card';
    d.style.cssText = `position:fixed;inset:0;z-index:99999;width:1200px;height:630px;background:#f8f6f1;display:flex;flex-direction:column;padding:52px 60px 0;box-sizing:border-box;font-family:system-ui;border-top:14px solid ${accent}`;
    const esc = s => s.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    d.innerHTML = `<div style="display:flex;align-items:center;gap:14px;font:700 30px var(--serif);color:#1c1917"><span class="logo" style="width:30px;height:30px"></span>Lilavati${chip ? `<span style="margin-left:14px;font:700 17px system-ui;letter-spacing:.08em;text-transform:uppercase;background:#1c1917;color:#fff;border-radius:999px;padding:6px 16px">${esc(chip)}</span>` : ''}</div>
      <div style="font:700 ${slugs.length > 1 ? 92 : big.length > 40 ? 54 : 64}px/1.08 var(--serif);color:#1c1917;margin-top:26px;max-width:1080px">${esc(big)}</div>
      <div style="font:italic ${slugs.length > 1 ? 36 : 30}px/1.3 var(--serif);color:#57534e;margin-top:16px;max-width:1080px">${esc(small)}</div>
      <div id="og-pics" style="display:flex;gap:24px;margin-top:auto;justify-content:center;align-items:flex-end"></div>`;
    document.body.appendChild(d);
    const pics = d.querySelector('#og-pics'), w = slugs.length > 1 ? 340 : 560, h = Math.round(w * 260 / 560);
    for (const s of slugs) {
      const cv = document.createElement('canvas'); cv.width = 560 * 2; cv.height = 260 * 2;
      cv.style.cssText = `width:${slugs.length > 1 ? w : 700}px;height:${slugs.length > 1 ? h : 325}px;background:#fff;border:1px solid #e7e5e4;border-bottom:none;border-radius:16px 16px 0 0`;
      const c = cv.getContext('2d'); c.scale(2, 2); window.__lilavatiPreviews[s]?.(c, 560, 260, 2.6);
      pics.appendChild(cv);
    }
  }, { slugs, big, small, chip, accent });
  await page.waitForTimeout(100);
  await page.locator('#og-card').screenshot({ path: file });
}

mkdirSync(join(web, 'og'), { recursive: true });
const all = await page.evaluate(async () => (await import('/concepts.js')).CONCEPTS);
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function tags(html, url, image, alt) {
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]?.replace(/ · Lilavati$/, '') || 'Lilavati';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const block = `<!-- share -->
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Lilavati">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(alt)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:locale" content="en_GB">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${esc(alt)}">
  <!-- /share -->`;
  const old = /<!-- share -->[\s\S]*?<!-- \/share -->/;
  if (old.test(html)) return html.replace(old, block);
  return html.replace(/(<meta name="description"[^>]*>)/, `$1\n  ${block}`);
}

for (const c of all.filter(c => c.status === 'live')) {
  const f = join(web, c.slug, 'index.html'); if (!existsSync(f)) continue;
  const big = c.title || c.hook || c.name, small = c.title ? c.hook : c.tagline;
  await card(join(web, 'og', `${c.slug}.png`), [c.slug], big, small, c.title ? '' : c.name, c.color);
  writeFileSync(f, tags(readFileSync(f, 'utf8'), `${SITE}/${c.slug}/`, `${SITE}/og/${c.slug}.png`, `${big}: ${small}`));
  console.log('og', c.slug);
}
const n = all.filter(c => c.status === 'live').length;
await card(join(web, 'og', 'home.png'), ['fourier-series', 'chaos', 'three-body-problem'], 'Maths you can touch', `${n} interactive pages: play with each idea, then see it worked out step by step.`, '', '#15803d');
writeFileSync(join(web, 'index.html'), tags(readFileSync(join(web, 'index.html'), 'utf8'), `${SITE}/`, `${SITE}/og/home.png`, 'Lilavati: maths you can touch'));
console.log('og home');
await browser.close();
