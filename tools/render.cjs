/* ==========================================================================
   把影片逐帧渲染成 MP4（1920×1080，含配乐）
   依赖：Node 18+、playwright（自带 Chromium）、ffmpeg

     node tools/render.cjs                         # 全片，30fps，3 个进程并行
     node tools/render.cjs --from 60 --to 80       # 只渲染一段（调试用）
     node tools/render.cjs --workers 4 --fps 30 --crf 24 --out dist/graham-number.mp4

   原理：页面以 ?render 模式打开后暴露 window.__frame(t)，画面只依赖时间 t，
   因此可以把时间轴切成若干段，交给多个浏览器进程并行渲染成近无损的中间片段，
   最后统一做一次轻度降噪 + 限码率的成片编码（星空、粒子和数字隧道细节极多，不限码率会非常大）。
   配乐由同一份乐谱经 OfflineAudioContext 离线合成。
   ========================================================================== */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html') + '?render';
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const FPS = +arg('fps', 30);
const FROM = +arg('from', 0);
const TO = +arg('to', 320);
const WORKERS = +arg('workers', 3);
const CRF = arg('crf', '24');
const OUT = path.resolve(ROOT, arg('out', 'dist/graham-number.mp4'));
const TMP = path.resolve(arg('tmp', path.join(os.tmpdir(), 'graham-render')));
// 有独立显卡的机器可以设 GPU=1 使用硬件渲染；默认用 SwiftShader 软件渲染，结果在任何机器上都一致
const LAUNCH = { args: process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

async function openPage() {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(URL);
  await page.evaluate(() => window.__ready);
  return { browser, page };
}

/* ---------------------------------------------------------- worker ---- */
async function worker(f0, f1, seg, id) {
  const { browser, page } = await openPage();
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-g', String(FPS * 4), '-r', String(FPS), seg],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((t) => window.__frame(t), f / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 149) {
      const el = (Date.now() - t0) / 1000, k = f - f0 + 1;
      console.log(`[w${id}] ${k}/${f1 - f0} 帧  ${(el / k * 1000).toFixed(0)} ms/帧  剩余约 ${((f1 - f0 - k) * el / k / 60).toFixed(1)} 分钟`);
    }
  }
  ff.stdin.end();
  await done;
  await browser.close();
}

/* ---------------------------------------------------------- audio ----- */
async function renderAudio(file) {
  const { browser, page } = await openPage();
  const len = await page.evaluate(() => window.__audio());
  const size = 4 << 20, parts = [];
  for (let i = 0; i * size < len; i++) parts.push(Buffer.from(await page.evaluate(([k, s]) => window.__audioChunk(k, s), [i, size]), 'base64'));
  fs.writeFileSync(file, Buffer.concat(parts));
  await browser.close();
}

/* ---------------------------------------------------------- master ---- */
async function main() {
  if (process.env.GRAHAM_WORKER) {
    const [f0, f1, seg, id] = process.env.GRAHAM_WORKER.split('|');
    await worker(+f0, +f1, seg, id);
    return;
  }
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const F0 = Math.round(FROM * FPS), F1 = Math.round(TO * FPS);
  const per = Math.ceil((F1 - F0) / WORKERS);
  console.log(`渲染 ${FROM}s–${TO}s，共 ${F1 - F0} 帧，${WORKERS} 个进程`);
  const t0 = Date.now();
  const segs = [];
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const a = F0 + w * per, b = Math.min(F1, a + per);
    if (a >= b) break;
    const seg = path.join(TMP, `seg_${w}.mp4`);
    segs.push(seg);
    jobs.push(run(process.execPath, [__filename], { env: { ...process.env, GRAHAM_WORKER: `${a}|${b}|${seg}|${w}` } }));
  }
  const wav = path.join(TMP, 'sound.wav');
  jobs.push(renderAudio(wav).then(() => console.log('配乐已合成')));
  await Promise.all(jobs);
  const list = path.join(TMP, 'list.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
  const video = path.join(TMP, 'video.mp4');
  await run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
  await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, '-ss', String(FROM), '-t', String(TO - FROM), '-i', wav,
    '-map', '0:v', '-map', '1:a', '-vf', 'hqdn3d=1.5:1.5:4:4', '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF,
    '-maxrate', '7M', '-bufsize', '14M', '-pix_fmt', 'yuv420p', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k',
    '-ar', '48000', '-shortest', '-movflags', '+faststart', OUT]);
  console.log(`完成：${path.relative(ROOT, OUT)}  ${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB，用时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟`);
}

main().catch((e) => { console.error(e); process.exit(1); });
