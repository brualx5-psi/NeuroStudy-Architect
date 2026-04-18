#!/usr/bin/env node
// Renders Instagram carousels for every post under ./posts/<slug>/slides.html.
// Each slide section becomes output/slide-N.png at exactly 1080x1920.
//
// Usage:
//   node generate.mjs            # renders every post
//   node generate.mjs 02         # renders only posts whose slug starts with "02"

import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, 'posts');

const WIDTH = 1080;
const HEIGHT = 1920;
const SCALE = 1;

async function listPosts(filter) {
  const entries = await fs.readdir(POSTS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !filter || name.startsWith(filter))
    .sort();
}

async function renderPost(browser, slug) {
  const postDir = path.join(POSTS_DIR, slug);
  const slidesHtml = path.join(postDir, 'slides.html');
  const outDir = path.join(postDir, 'output');

  try {
    await fs.access(slidesHtml);
  } catch {
    console.warn(`  · skipping ${slug} (no slides.html)`);
    return;
  }
  await fs.mkdir(outDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });

  const fileUrl = pathToFileURL(slidesHtml).href;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);

  const slideIds = await page.$$eval('section.slide', (nodes) => nodes.map((n) => n.id));
  if (!slideIds.length) {
    console.warn(`  · no .slide sections in ${slug}`);
    await page.close();
    return;
  }

  console.log(`\n▸ ${slug} — ${slideIds.length} slides`);
  for (let i = 0; i < slideIds.length; i++) {
    const id = slideIds[i];
    await page.evaluate((visibleId) => {
      document.querySelectorAll('section.slide').forEach((el) => {
        el.style.display = el.id === visibleId ? 'flex' : 'none';
      });
      window.scrollTo(0, 0);
    }, id);

    const el = await page.$(`#${id}`);
    if (!el) throw new Error(`Missing slide #${id} in ${slug}`);

    const outPath = path.join(outDir, `slide-${i + 1}.png`);
    await el.screenshot({
      path: outPath,
      type: 'png',
      omitBackground: false,
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    console.log(`  ✓ ${path.relative(__dirname, outPath)}`);
  }
  await page.close();
}

async function main() {
  const filter = process.argv[2];
  const slugs = await listPosts(filter);
  if (!slugs.length) {
    console.error('No posts found' + (filter ? ` for "${filter}"` : '') + '.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--font-render-hinting=medium',
      '--disable-web-security',
    ],
  });

  try {
    for (const slug of slugs) {
      await renderPost(browser, slug);
    }
    console.log('\nDone.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
