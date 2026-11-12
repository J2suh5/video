// Inline src/ into a single page.
//   sakimutsu.html — page body for the Artifact viewer (it adds its own <html>/<head> skeleton)
//   index.html     — standalone file you can open directly in a browser
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => readFileSync(join(root, 'src', f), 'utf8');
const js = ['audio.js', 'gl.js', 'art.js', 'scenes.js', 'main.js'].map(rd).join('\n');
const page = rd('shell.html')
  .replace('/*CSS*/', () => rd('style.css'))
  .replace('/*JS*/', () => `(() => {\n'use strict';\n${js}\n})();`);

writeFileSync(join(root, 'sakimutsu.html'), page);
writeFileSync(join(root, 'index.html'),
  `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`);
console.log('built', (page.length / 1024).toFixed(1) + ' KB');
