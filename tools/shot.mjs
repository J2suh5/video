// Render selected timestamps to PNGs for visual checks.
//   node tools/shot.mjs <outDir> t1 t2 ...   (add --w=1280 --h=720)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = args.shift();
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const times = args.filter(a => !a.startsWith('--')).map(Number);
mkdirSync(out, { recursive: true });
const W = +(opt.w || 1280), H = +(opt.h || 720);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 2000)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await page.goto(pathToFileURL(join(root, 'index.html')).href + '?test&t=' + (times[0] || 0));
await page.waitForTimeout(1500);
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate(t => window.__render && window.__render(t), t);
  await page.screenshot({ path: join(out, `t${String(t).padStart(6, '0')}.png`) });
  console.log('t=' + t, (Date.now() - t0) + 'ms');
}
if (errs.length) console.log('CONSOLE:\n' + errs.join('\n'));
await browser.close();
