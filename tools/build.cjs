/* 把 index.html 及其引用的 CSS / JS 全部内联，生成一个可离线打开、可随意分享的单文件：
 *   dist/graham-number.html   完整 HTML 文档
 * 运行: node tools/build.cjs
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(root, f), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'graham-number.html');
fs.writeFileSync(out, html);
console.log('wrote', path.relative(root, out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
