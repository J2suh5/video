// Render score sections offline and report levels: node tools/audiotest.mjs [wavOut]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { join, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(pathToFileURL(join(root, 'index.html')).href + '?test&t=0');
await page.waitForTimeout(800);
const secs = [[0, 20], [20, 60], [60, 100], [100, 140], [140, 170], [170, 222], [222, 244]];
const res = await page.evaluate(async (secs) => {
  const { Engine, buildScore } = window.__audio; const E = buildScore(); const out = [];
  const counts = {}; for (const e of E) counts[e.i] = (counts[e.i] || 0) + 1;
  for (const [a, b] of secs) {
    const sr = 22050, ctx = new OfflineAudioContext(2, Math.ceil(sr * (b - a + 4)), sr);
    const en = new Engine(E, ctx); await en.prepare();
    for (const e of E) { if (e.t >= a && e.t < b) en.play(e, e.t - a + .01, 0); else if (e.t < a && e.t + e.d > a + .4 && ['str','organ','rain','crickets','wind','cello'].includes(e.i)) en.play(e, .01, a - e.t); }
    const buf = await ctx.startRendering(); const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const per = []; let peak = 0, nan = 0;
    for (let s = 0; s < (b - a); s += 2) { let sum = 0, pk = 0; const i0 = Math.floor(s * sr), i1 = Math.min(L.length, Math.floor((s + 2) * sr)); for (let i = i0; i < i1; i++) { const v = (L[i] + R[i]) / 2; if (!isFinite(v)) nan++; sum += v * v; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); } per.push([+(20 * Math.log10(Math.sqrt(sum / (i1 - i0)) + 1e-9)).toFixed(1), +pk.toFixed(2)]); peak = Math.max(peak, pk); }
    out.push({ a, b, peak: +peak.toFixed(3), nan, per: per.map(p => p[0]).join(' ') });
    if (a === 170) { window.__wav = Array.from(L.subarray(0, sr * 24)).map(v => Math.round(Math.max(-1, Math.min(1, v)) * 32767)); }
  }
  return { out, counts };
}, secs);
console.log(JSON.stringify(res.counts));
for (const r of res.out) console.log(`${r.a}-${r.b}s peak=${r.peak} nan=${r.nan}\n  rms dB per 2s: ${r.per}`);
if (process.argv[2]) {
  const pcm = await page.evaluate(() => window.__wav); const sr = 22050;
  const b = Buffer.alloc(44 + pcm.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((v, i) => b.writeInt16LE(v, 44 + i * 2)); writeFileSync(process.argv[2], b);
}
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await browser.close();
