/* ==========================================================================
   shapes.js — 粒子形状（每个形状 = 65536 个点的位置 + 亮度）
   文字形状通过在离屏 canvas 上绘字、再对像素采样得到。
   ========================================================================== */
(function () {
'use strict';
const N = E.N;
const S = {};
window.SHAPES = S;

const FONT_SERIF = '"GSerif", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif';
const FONT_MONO = '"GMono", "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';
const FONT_MATH = '"GMath", "GSerif", "Noto Serif SC", serif';
S.FONT_SERIF = FONT_SERIF; S.FONT_MONO = FONT_MONO; S.FONT_MATH = FONT_MATH;

function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* ---- 文字 → 点云 -------------------------------------------------------
   parts: [{text, font, size, dx, dy}]，在同一张画布上组合多段文字（用于上下标） */
function textShape(parts, opt = {}) {
  const r = E.rng(opt.seed || 7);
  const cw = 2600, ch = 1000;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
  // 先量出总宽度以便居中
  let total = 0;
  const items = parts.map((p) => {
    g.font = p.font;
    const w = g.measureText(p.text).width;
    const it = { ...p, x: total + (p.dx || 0), w };
    if (!p.overlay) total += w + (p.dx || 0) + (p.gap || 0);
    return it;
  });
  let x0 = (cw - total) / 2;
  for (const it of items) {
    g.font = it.font;
    g.fillText(it.text, x0 + it.x, ch / 2 + (it.dy || 0));
  }
  const img = g.getImageData(0, 0, cw, ch).data;
  const xs = [], ys = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < ch; y += 1) for (let x = 0; x < cw; x += 1) {
    if (img[(y * cw + x) * 4 + 3] > 110) {
      xs.push(x); ys.push(y);
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const wpx = maxX - minX, hpx = maxY - minY;
  const scale = Math.min((opt.width || 9) / wpx, (opt.height || 4) / hpx);
  const out = new Float32Array(N * 4);
  const M = xs.length;
  for (let i = 0; i < N; i++) {
    const k = Math.floor(r() * M);
    out[i * 4] = (xs[k] - cx + r() - 0.5) * scale + (opt.ox || 0);
    out[i * 4 + 1] = -(ys[k] - cy + r() - 0.5) * scale + (opt.oy || 0);
    out[i * 4 + 2] = gauss(r) * (opt.depth || 0.04);
    out[i * 4 + 3] = 0.55 + 0.45 * r();
  }
  return out;
}
S.textShape = textShape;

function galaxy() {
  const r = E.rng(11), out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    let x, y, z, w;
    if (i % 7 === 0) { // 核球
      const rr = Math.abs(gauss(r)) * 0.7;
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      x = rr * Math.sin(ph) * Math.cos(th); y = rr * Math.cos(ph) * 0.6; z = rr * Math.sin(ph) * Math.sin(th);
      w = 0.9 + 0.1 * r();
    } else {
      const arm = i % 3;
      const rad = 0.3 + Math.pow(r(), 0.75) * 5.6;
      const ang = Math.log(rad + 0.2) * 2.4 + arm * (Math.PI * 2 / 3) + gauss(r) * 0.32 / (0.4 + rad * 0.15);
      x = Math.cos(ang) * rad; z = Math.sin(ang) * rad;
      y = gauss(r) * 0.1 * (1.2 - rad / 6);
      x += gauss(r) * 0.12; z += gauss(r) * 0.12;
      w = (0.25 + 0.75 * r()) * (1 - rad / 8);
    }
    out.set([x, y, z, w], i * 4);
  }
  return out;
}

function dust(seed = 3, sx = 14, sy = 8, sz = 10) {
  const r = E.rng(seed), out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) out.set([(r() - 0.5) * 2 * sx, (r() - 0.5) * 2 * sy, (r() - 0.7) * sz, 0.15 + 0.35 * r()], i * 4);
  return out;
}

function shell(R0 = 10, R1 = 16, seed = 5) {
  const r = E.rng(seed), out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rr = R0 + (R1 - R0) * r();
    out.set([rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th), 0.3 + 0.7 * r()], i * 4);
  }
  return out;
}

function point(seed = 9) {
  const r = E.rng(seed), out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) out.set([gauss(r) * 0.05, gauss(r) * 0.05, gauss(r) * 0.05, 0.6 + 0.4 * r()], i * 4);
  return out;
}

// 宇宙大尺度结构：节点 + 纤维
function universe() {
  const r = E.rng(21), out = new Float32Array(N * 4);
  const nodes = [];
  for (let i = 0; i < 180; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rr = 5.5 * Math.cbrt(r());
    nodes.push([rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th), 0.3 + r()]);
  }
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    const d = nodes.map((n, j) => [Math.hypot(n[0] - nodes[i][0], n[1] - nodes[i][1], n[2] - nodes[i][2]), j]).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k <= 3; k++) edges.push([i, d[k][1]]);
  }
  for (let i = 0; i < N; i++) {
    let x, y, z, w;
    if (r() < 0.32) {
      const n = nodes[Math.floor(r() * nodes.length)];
      const s = 0.12 * n[3];
      x = n[0] + gauss(r) * s; y = n[1] + gauss(r) * s; z = n[2] + gauss(r) * s; w = 0.7 + 0.3 * r();
    } else {
      const e = edges[Math.floor(r() * edges.length)];
      const a = nodes[e[0]], b = nodes[e[1]], t = r();
      const s = 0.05;
      x = a[0] + (b[0] - a[0]) * t + gauss(r) * s; y = a[1] + (b[1] - a[1]) * t + gauss(r) * s; z = a[2] + (b[2] - a[2]) * t + gauss(r) * s;
      w = 0.25 + 0.45 * r();
    }
    out.set([x, y, z, w], i * 4);
  }
  return out;
}

// 吸积盘（平放在 xz 平面）
function disk() {
  const r = E.rng(31), out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const rad = 1.3 + Math.pow(r(), 1.6) * 2.6, a = r() * Math.PI * 2;
    out.set([Math.cos(a) * rad, gauss(r) * 0.03, Math.sin(a) * rad, 0.4 + 0.6 * r()], i * 4);
  }
  return out;
}

// 双纽线 ∞（三维细管）
function lemniscate() {
  const r = E.rng(41), out = new Float32Array(N * 4);
  const a = 4.2;
  for (let i = 0; i < N; i++) {
    const t = r() * Math.PI * 2;
    const s = Math.sin(t), c = Math.cos(t), d = 1 + s * s;
    const x = a * c / d, y = a * s * c / d;
    const rr = Math.abs(gauss(r)) * 0.13 + (r() < 0.12 ? Math.abs(gauss(r)) * 0.5 : 0);
    const ph = r() * Math.PI * 2;
    out.set([x + Math.cos(ph) * rr * 0.4, y + Math.sin(ph) * rr * 0.4, Math.sin(ph) * rr + Math.sin(t * 2) * 0.6, 0.5 + 0.5 * r()], i * 4);
  }
  return out;
}

/* ---- 字形图集：第 0 行衬线数字，第 1 行等宽数字 ---------------------- */
S.makeAtlas = function () {
  const cell = 128;
  const cv = document.createElement('canvas'); cv.width = cell * 16; cv.height = cell * 2;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${cell * 0.92}px ${FONT_SERIF}`;
  for (let i = 0; i < 10; i++) g.fillText(String(i), i * cell + cell / 2, cell * 0.54);
  g.font = `500 ${cell * 0.86}px ${FONT_MONO}`;
  for (let i = 0; i < 10; i++) g.fillText(String(i), i * cell + cell / 2, cell + cell * 0.53);
  return E.textureFromCanvas(cv, true);
};

S.build = function () {
  const sz = (px, w = 700, f = FONT_SERIF) => `${w} ${px}px ${f}`;
  const T = {};
  T.galaxy = galaxy();
  T.dust = dust();
  T.dust2 = dust(17, 16, 9, 14);
  T.burst = shell(9, 18);
  T.point = point();
  T.universe = universe();
  T.disk = disk();
  T.lemni = lemniscate();
  T.title = textShape([{ text: '葛立恒数', font: sz(300, 900) }], { width: 8.6, height: 3, seed: 1 });
  T.n7 = textShape([{ text: '7,625,597,484,987', font: sz(230, 600, FONT_MATH) }], { width: 11, height: 2.2, seed: 2 });
  T.G = textShape([{ text: 'G', font: sz(760, 600, FONT_MATH) }], { width: 6, height: 4.6, seed: 3, depth: 0.12 });
  T.n13 = textShape([{ text: '13', font: sz(620, 600, FONT_MATH) }], { width: 5, height: 4.4, seed: 4, depth: 0.1 });
  T.tree3 = textShape([{ text: 'TREE(3)', font: sz(300, 600, FONT_MATH) }], { width: 6.2, height: 1.9, seed: 5 });
  T.endTitle = textShape([{ text: '葛立恒数', font: sz(300, 900) }], { width: 7.2, height: 2.6, seed: 6, oy: 0.55 });
  for (const k in T) E.shapeTex(k, T[k]);
  S.atlas = S.makeAtlas();
};
})();
