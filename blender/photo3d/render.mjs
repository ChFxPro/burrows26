// Render the three.js photo build to a transparent PNG per film frame.
//
//   node photo3d/render.mjs OUT_DIR [FIRST LAST] [--only 40,122,...]
//      -> OUT_DIR/ph_0001.png ... ph_0720.png   (composited over the film by deliver_online.sh)
//
// Serves blender/ over a local http server (ES modules + textures), drives headless Chromium via
// playwright-core with the GPU on, and asks the page for one frame at a time.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // blender/
const args = process.argv.slice(2);
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args.splice(onlyAt, 2)[1].split(',').map(Number) : null;
const [OUT, a, b] = args;
if (!OUT) { console.error('usage: node photo3d/render.mjs OUT_DIR [FIRST LAST] [--only f,f]'); process.exit(2); }
const FIRST = +a || 1, LAST = +b || 720;
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/photo3d/index.html`;

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.error('page:', m.text()); });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.PH_READY || window.PH_ERROR, null, { timeout: 120000 });
console.log('renderer', await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
}));

const frames = only || Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
const t0 = Date.now();
for (const f of frames) {
  const data = await page.evaluate(n => window.PH.render(n), f);
  fs.writeFileSync(path.join(OUT, `ph_${String(f).padStart(4, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
  if (f % 60 === 0) console.log(`frame ${f}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log('PHOTO3D', OUT, frames.length, 'frames', `${((Date.now() - t0) / 1000).toFixed(0)} s`);
await browser.close();
server.close();
