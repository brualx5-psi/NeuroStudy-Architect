// Sobe o build em um servidor estatico minimo e captura a tela de login,
// que e a vitrine do app e concentra a maior parte da identidade visual.
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('../../dist');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json',
  '.gif':'image/gif', '.woff2':'font/woff2' };

const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(4173, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

// O proxy do sandbox responde 302 ao CDN do Tailwind e o headless nao segue,
// entao servimos uma copia local no lugar. Em producao o CDN carrega normalmente.
const TW = fs.readFileSync('/tmp/tw.js', 'utf-8');
await page.setRequestInterception(true);
page.on('request', (r) => {
  if (r.url().includes('cdn.tailwindcss.com')) {
    r.respond({ status: 200, contentType: 'text/javascript', body: TW });
  } else r.continue();
});
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500)); // deixa Tailwind CDN + fontes assentarem
await page.screenshot({ path: 'app-login.png' });
console.log('app-login.png capturado');

// Preenche o e-mail para sair do estado disabled e medir o contraste real do botao.
const input = await page.$('input[type=email], input[placeholder*="email"]');
if (input) {
  await input.type('teste@neurostudy.com.br');
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'app-login-ativo.png' });
  console.log('app-login-ativo.png capturado');

  const info = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Enviar link de acesso'));
    if (!btn) return null;
    const cs = getComputedStyle(btn);
    return { disabled: btn.disabled, opacity: cs.opacity, bgImage: cs.backgroundImage.slice(0, 90), color: cs.color };
  });
  console.log('  botao:', JSON.stringify(info));
}

// Modo escuro: confere se o escuro quente (#1c1917) substituiu o slate frio.
await page.evaluate(() => document.documentElement.classList.add('dark'));
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: 'app-login-escuro.png' });
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
console.log('  body no dark:', bg);

await browser.close();
server.close();
