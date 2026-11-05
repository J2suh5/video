// 从 Google Fonts 拉取仅包含所用字符的字体子集，内嵌为 base64 写入 src/fonts.js。
// 用法: node tools/fetch-fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcDir = path.join(root, 'src');
let text = '';
for (const f of fs.readdirSync(srcDir)) if (f.endsWith('.js') && f !== 'fonts.js') text += fs.readFileSync(path.join(srcDir, f), 'utf8');
text += fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
const cjk = [...new Set([...text].filter((c) => c.codePointAt(0) > 0x2000))].join('');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function get(family, spec, chars) {
  const url = `https://fonts.googleapis.com/css2?family=${family}:${spec}&text=${encodeURIComponent(chars)}`;
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
  if (!urls.length) throw new Error('no font url for ' + family + '\n' + css);
  const buf = Buffer.from(await (await fetch(urls[0], { headers: { 'User-Agent': UA } })).arrayBuffer());
  return buf.toString('base64');
}
const fonts = {
  serifSC: await get('Noto+Serif+SC', 'wght@600', cjk + ascii),
  serifSCLight: await get('Noto+Serif+SC', 'wght@400', cjk + ascii),
  latin: await get('Cormorant+Garamond', 'ital,wght@1,500', ascii + '×·—'),
};
let out = '// 自动生成：node tools/fetch-fonts.mjs  (字体: Noto Serif SC, Cormorant Garamond — SIL Open Font License)\n';
out += 'window.SM = window.SM || {};\nSM.FONT_DATA = ' + JSON.stringify(fonts) + ';\n';
fs.writeFileSync(path.join(srcDir, 'fonts.js'), out);
console.log('chars:', cjk.length, 'sizes(KB):', Object.fromEntries(Object.entries(fonts).map(([k, v]) => [k, Math.round(v.length * 0.75 / 1024)])));
