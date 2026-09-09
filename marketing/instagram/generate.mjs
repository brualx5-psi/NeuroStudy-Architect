#!/usr/bin/env node
// Renderiza os carrosseis do Instagram: cada <section class="slide"> de
// posts/<slug>/slides.html vira output/slide-N.png em exatos 1080x1920.
//
// Uso:
//   node generate.mjs        # todos os posts
//   node generate.mjs 02     # so os posts cujo slug comeca com "02"

import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, 'posts');

const WIDTH = 1080;
const HEIGHT = 1920;

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
    console.warn(`  · pulando ${slug} (sem slides.html)`);
    return;
  }
  await fs.mkdir(outDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(slidesHtml).href, { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);

  const ids = await page.$$eval('section.slide', (n) => n.map((e) => e.id));
  if (!ids.length) {
    console.warn(`  · ${slug} nao tem .slide`);
    await page.close();
    return;
  }

  console.log(`\n▸ ${slug} — ${ids.length} slides`);
  for (let i = 0; i < ids.length; i++) {
    await page.evaluate((visible) => {
      document.querySelectorAll('section.slide').forEach((el) => {
        el.style.display = el.id === visible ? 'flex' : 'none';
      });
      window.scrollTo(0, 0);
    }, ids[i]);

    const el = await page.$(`#${ids[i]}`);
    if (!el) throw new Error(`slide #${ids[i]} sumiu em ${slug}`);

    const out = path.join(outDir, `slide-${i + 1}.png`);
    await el.screenshot({
      path: out,
      type: 'png',
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    console.log(`  ✓ ${path.relative(__dirname, out)}`);
  }
  await page.close();
}

const filter = process.argv[2];
const slugs = await listPosts(filter);
if (!slugs.length) {
  console.error('nenhum post encontrado' + (filter ? ` para "${filter}"` : ''));
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium'],
});
try {
  for (const slug of slugs) await renderPost(browser, slug);
  console.log('\nPronto.');
} finally {
  await browser.close();
}
