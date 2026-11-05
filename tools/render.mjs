// 将 WebGL 动画逐帧导出为 MP4（含离线渲染的配乐）
// 用法: node tools/render.mjs [--w 1920] [--h 1080] [--fps 30] [--workers 3] [--out output/sakiko-mutsumi.mp4] [--from 0] [--to 123]
// 需要: playwright（自带 Chromium）与 ffmpeg
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1920), H = +arg('h', 1080), FPS = +arg('fps', 30), WORKERS = +arg('workers', 3);
const OUT = path.resolve(arg('out', path.join(root, 'output', 'sakiko-mutsumi.mp4')));
const FROM = +arg('from', 0), TO = +arg('to', 123);
const tmp = path.resolve(arg('tmp', path.join(root, '.render')));
const frameDir = path.join(tmp, `frames_${W}x${H}_${FPS}`);
fs.mkdirSync(frameDir, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const first = Math.round(FROM * FPS), last = Math.round(TO * FPS); // [first, last)
const todo = [];
for (let f = first; f < last; f++) if (!fs.existsSync(path.join(frameDir, `${String(f).padStart(5, '0')}.jpg`))) todo.push(f);
console.log(`frames ${first}..${last - 1}, ${todo.length} to render, ${WORKERS} workers @ ${W}x${H}`);

async function openPage() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1920), height: Math.min(H, 1080) } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.setDefaultTimeout(0);
  await page.goto(`file://${root}/index.html?export=1&w=${W}&h=${H}`, { waitUntil: 'domcontentloaded', timeout: 0 });
  await page.waitForFunction(() => window.SMX_READY || window.SMX_ERROR, null, { timeout: 0, polling: 1000 });
  const err = await page.evaluate(() => window.SMX_ERROR);
  if (err) throw new Error(err);
  return { browser, page };
}

const wavPath = path.join(tmp, 'soundtrack.wav');
async function renderAudio() {
  if (fs.existsSync(wavPath)) return;
  const { browser, page } = await openPage();
  const len = await page.evaluate(() => window.SMX.prepareAudio());
  const size = 1 << 20, parts = [];
  for (let i = 0; i * size < len; i++) parts.push(Buffer.from(await page.evaluate(([i, s]) => window.SMX.audioChunk(i, s), [i, size]), 'base64'));
  fs.writeFileSync(wavPath, Buffer.concat(parts));
  console.log('audio written', wavPath);
  await browser.close();
}

let done = 0;
const t0 = Date.now();
async function worker(id) {
  const { browser, page } = await openPage();
  // 预热（首帧包含着色器编译）
  await page.evaluate(() => window.SMX.frame(0.1, 0.5));
  for (;;) {
    const f = todo.shift();
    if (f == null) break;
    const url = await page.evaluate(([t, q]) => window.SMX.frame(t, q), [f / FPS, 0.95]);
    fs.writeFileSync(path.join(frameDir, `${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    done++;
    if (done % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`[${id}] ${done} frames, ${(done / el).toFixed(2)} fps, eta ${((todo.length / done) * el / 60).toFixed(1)} min`);
    }
  }
  await browser.close();
}

await Promise.all([renderAudio(), ...Array.from({ length: WORKERS }, (_, i) => worker(i))]);
console.log('frames done in', ((Date.now() - t0) / 60000).toFixed(1), 'min');

const ff = spawnSync('ffmpeg', [
  '-y', '-framerate', String(FPS), '-start_number', String(first), '-i', path.join(frameDir, '%05d.jpg'),
  '-ss', String(FROM), '-t', String(TO - FROM), '-i', wavPath,
  '-frames:v', String(last - first),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(arg('crf', 24)), '-pix_fmt', 'yuv420p', '-tune', 'film',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', OUT,
], { stdio: 'inherit' });
if (ff.status !== 0) process.exit(ff.status || 1);
console.log('video written', OUT);
