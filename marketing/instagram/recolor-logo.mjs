#!/usr/bin/env node
// Recolore PNGs da marca: rotaciona o matiz de indigo (~243 graus) para teal (~175 graus)
// em espaco HSL real. O filtro hue-rotate do CSS e uma aproximacao matricial que tambem
// desloca saturacao e luminancia, entao nao serve para um recolor fiel.
//
// Uso:  node recolor-logo.mjs --report <png...>   # so analisa, nao escreve
//       node recolor-logo.mjs <png...>            # reescreve no lugar

import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

// O shift NAO e fixo: cada asset tem seu proprio matiz dominante (o logo puxa para
// violeta 270 graus, os icones para indigo 243). Medimos o matiz dominante de cada
// arquivo e deslocamos ele ate o teal da marca, preservando a variacao interna da arte.
const TARGET_HUE = 174.7; // #0d9488 teal-600

const argv = process.argv.slice(2);
const reportOnly = argv.includes('--report');
const files = argv.filter((a) => !a.startsWith('--'));

if (!files.length) {
  console.error('informe ao menos um PNG');
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();

for (const file of files) {
  const abs = path.resolve(file);
  const b64 = (await fs.readFile(abs)).toString('base64');

  const res = await page.evaluate(async (dataUri, targetHue, dryRun) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();

    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const px = imageData.data;

    const toHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2;
      if (mx === mn) return [0, 0, l];
      const d = mx - mn;
      const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      let h;
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      return [h * 60, s, l];
    };
    const toRgb = (h, s, l) => {
      h = (((h % 360) + 360) % 360) / 360;
      if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const k = (t) => {
        t = (t + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return [k(h + 1 / 3), k(h), k(h - 1 / 3)].map((v) => Math.round(v * 255));
    };

    const buckets = {};
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 16) continue;
      const [h, s] = toHsl(px[i], px[i + 1], px[i + 2]);
      if (s < 0.12) continue;
      const key = Math.round(h / 15) * 15;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    const hist = Object.entries(buckets)
      .map(([h, n]) => [Number(h), n])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const dominant = hist.length ? hist[0][0] : 0;
    const shift = targetHue - dominant;

    if (dryRun) return { hist, dominant, shift, out: null, w: c.width, h: c.height };

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const [h, s, l] = toHsl(px[i], px[i + 1], px[i + 2]);
      if (s < 0.06) continue; // preserva branco/cinza/preto
      const [r, g, b] = toRgb(h + shift, s, l);
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
    return { hist, dominant, shift, out: c.toDataURL('image/png'), w: c.width, h: c.height };
  }, `data:image/png;base64,${b64}`, TARGET_HUE, reportOnly);

  console.log(`${path.relative(process.cwd(), abs)}  ${res.w}x${res.h}`);
  console.log(`   matizes: ${res.hist.map(([h, n]) => `${h}° x${n}`).join('  ') || '(sem cor)'}`);

  if (!reportOnly && res.out) {
    await fs.writeFile(abs, Buffer.from(res.out.split(',')[1], 'base64'));
    console.log(`   reescrito (dominante ${res.dominant}° -> ${TARGET_HUE}°, shift ${res.shift.toFixed(1)}°)`);
  }
}

await browser.close();
