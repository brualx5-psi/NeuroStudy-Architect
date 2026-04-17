#!/usr/bin/env node
// Renders each <section class="slide"> from slides.html into a 1080x1920 PNG.
// Usage:  node generate.mjs

import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLIDES_HTML = path.join(__dirname, 'slides.html');
const OUTPUT_DIR = path.join(__dirname, 'output');

const WIDTH = 1080;
const HEIGHT = 1920;
const SCALE = 1; // exact 1080x1920 output as requested

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--font-render-hinting=medium',
      '--disable-web-security',
    ],
    defaultViewport: {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: SCALE,
    },
  });

  try {
    const page = await browser.newPage();

    const fileUrl = pathToFileURL(SLIDES_HTML).href;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Wait a bit extra for Google Fonts to settle.
    await page.evaluate(() => document.fonts.ready);

    const slideIds = await page.$$eval('section.slide', (nodes) => nodes.map((n) => n.id));

    if (slideIds.length === 0) throw new Error('No .slide sections found.');

    for (let i = 0; i < slideIds.length; i++) {
      const id = slideIds[i];

      await page.evaluate((visibleId) => {
        document.querySelectorAll('section.slide').forEach((el) => {
          el.style.display = el.id === visibleId ? 'flex' : 'none';
        });
        window.scrollTo(0, 0);
      }, id);

      const el = await page.$(`#${id}`);
      if (!el) throw new Error(`Missing slide #${id}`);

      const outPath = path.join(OUTPUT_DIR, `slide-${i + 1}.png`);
      await el.screenshot({
        path: outPath,
        type: 'png',
        omitBackground: false,
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      });
      console.log(`  ✓ slide-${i + 1}.png`);
    }

    console.log(`\nDone. ${slideIds.length} slides → ${OUTPUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
