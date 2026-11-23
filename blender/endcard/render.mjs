// Render the end tag headless to an RGBA PNG sequence, one deterministic frame at a time.
//
//   node render.mjs --concept A --out DIR [--w 1920 --h 1080] [--from 0 --to 203] [--step 1] [--start 613]
//
// Writes DIR/tag_0000.png ... (numbered by tag frame). Tag frame 0 sits on film frame --start.
// Serves this folder, blender/endcard.json (/cfg/) and the campaign Branding folder (/brand/) on
// a local port, drives the page with Playwright's Chromium, and pulls each frame as a PNG.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = process.env.BURROWS_BRAND ||
  '/Users/jeffbannister/Desktop/Politics Local/Burrows 26/3D/images/NCDP-Burrows Shared Images/Branding';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const concept = arg('concept', 'A'), out = arg('out'), W = +arg('w', 1920), H = +arg('h', 1080);
const start = +arg('start', 613), step = +arg('step', 1);
if (!out) { console.error('--out DIR is required'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
                '.png': 'image/png', '.otf': 'font/otf', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (p.startsWith('/brand/')) file = path.join(BRAND, p.slice(7));
  else if (p === '/cfg/endcard.json') file = path.join(HERE, '..', 'endcard.json');
  else file = path.join(HERE, p === '/' ? 'index.html' : p);
  const root = p.startsWith('/brand/') ? BRAND : HERE;
  if (!path.resolve(file).startsWith(path.resolve(root)) && p !== '/cfg/endcard.json') { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('[page]', m.type(), m.text()); });
page.on('pageerror', e => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/?concept=${concept}&w=${W}&h=${H}&start=${start}`);
await page.waitForFunction(() => window.TAG_READY || window.TAG_ERROR, null, { timeout: 60000 });
const err = await page.evaluate(() => window.TAG_ERROR);
if (err) { console.error(err); process.exit(1); }
const frames = await page.evaluate(() => TAG.frames);
const from = +arg('from', 0), to = +arg('to', frames - 1);
const t0 = Date.now();
for (let f = from; f <= to; f += step) {
  const url = await page.evaluate(f => TAG.render(f), f);
  fs.writeFileSync(path.join(out, `tag_${String(f).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
console.log(`concept ${concept}: frames ${from}-${to} step ${step} at ${W}x${H} in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
await browser.close(); server.close();
