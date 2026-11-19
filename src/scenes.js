/* ==========================================================================
   scenes.js — 分镜、字幕与画面
   时间单位：秒。所有画面都是时间 t 的纯函数。
   ========================================================================== */
(function () {
'use strict';
const { M4, clamp, lerp, seg, smooth, ease, easeOut, easeIn, fade, mixv } = E;

const DURATION = 320;

/* ------------------------------------------------------------ palette -- */
const GOLD = [1.7, 1.05, 0.45], GOLD2 = [2.0, 1.55, 0.9], WHITE = [1.5, 1.5, 1.7];
const CYAN = [0.45, 1.15, 1.8], VIOLET = [1.1, 0.5, 1.8], RED = [1.7, 0.16, 0.2], BLUE = [0.16, 0.42, 1.9];
const ICE = [0.75, 1.0, 1.8], ROSE = [1.8, 0.6, 1.0];
const WARM = { c1: [0.10, 0.11, 0.36], c2: [0.62, 0.30, 0.08], c3: [0.42, 0.14, 0.30] };
const COOL = { c1: [0.03, 0.15, 0.34], c2: [0.24, 0.10, 0.50], c3: [0.04, 0.32, 0.40] };

const rotM = (...ops) => ops.reduce((m, [i, j, a]) => M4.mul(m, M4.rot(i, j, a)), M4.ident());
const scaleM = (m, s, tx = 0, ty = 0, tz = 0) => { const o = m.slice(); for (let k = 0; k < 12; k++) o[k] *= s; o[12] += tx; o[13] += ty; o[14] += tz; return o; };
const transM = (tx, ty, tz) => { const m = M4.ident(); m[12] = tx; m[13] = ty; m[14] = tz; return m; };
function integ(f, a, b, dt = 1 / 60) { if (b <= a) return 0; let s = 0; for (let x = a; x < b; x += dt) s += f(Math.min(x + dt / 2, b)) * Math.min(dt, b - x); return s; }
const group = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const uvLeft = (x) => (50 + x * 56.25).toFixed(3) + '%';
// 中文字体里的 ↑ 是全角字形，连写时间距过大：包一层收紧
const arrows = (h) => h.replace(/↑/g, '<span class="ar">↑</span>');

/* ==================================================== 字幕与叠加文字 === */
const OV = [];
function ov(t0, t1, html, cls, pos = '', opt = {}) { OV.push({ t0, t1, html, cls, pos, ...opt }); }
function cap(t0, t1, html) { ov(t0, t1, html, 'cap', '', { fi: 0.35, fo: 0.35, rise: 0.25 }); }

/* --- 第一章 引子 --- */
cap(1.0, 5.2, '有一个数，大到整个可观测宇宙都写不下它；');
cap(5.6, 9.8, '可在另一种意义上，它又小得……几乎微不足道。');
ov(11.8, 17.2, 'GRAHAM’S NUMBER', 'kicker', 'left:50%;top:68%', { fi: 1.2 });
ov(12.6, 17.2, '有多大？又有多小？', 'subtitle', 'left:50%;top:76%', { fi: 1.2 });

/* --- 第二章 问题的起源 --- */
cap(18.0, 22.6, '20 世纪 70 年代，数学家<b>罗纳德·葛立恒</b>在研究一个看似简单的问题。');
cap(23.0, 27.0, '取一个 <i>n</i> 维立方体，把它的每两个顶点都用线段连起来，');
cap(27.4, 31.4, '再把每条线段随意涂成<b class="r">红色</b>或<b class="bl">蓝色</b>。');
cap(31.8, 37.8, '问：<i>n</i> 至少多大，才能保证无论怎么涂，都一定能找到 4 个<b>共面</b>的顶点，它们之间的 6 条连线颜色全部相同？');
cap(38.2, 42.6, '葛立恒证明了这样的 <i>n</i> 一定存在，并给出了一个上界。');
cap(43.0, 46.6, '1977 年，马丁·加德纳在《科学美国人》的专栏里介绍了它，');
cap(47.0, 50.6, '它还曾作为“数学证明中用过的最大的数”，登上吉尼斯世界纪录。');
ov(19.2, 31.6, '<span class="k">维数</span> <i>n</i> = 3', 'tag', 'left:9%;top:16%');
ov(32.0, 38.2, '<span class="k">维数</span> <i>n</i> = 4', 'tag', 'left:9%;top:16%');
ov(38.6, 47.0, '<span class="k">维数</span> <i>n</i> = ?', 'tag', 'left:9%;top:16%');
ov(35.0, 38.4, '<b class="r">同色</b> · 共面 · 4 点 6 线', 'tag small', 'left:9%;top:23%');
ov(44.0, 50.6, '<span class="k">GUINNESS · 1980</span><br>数学证明中用过的最大的数', 'badge', 'left:50%;top:44%', { fi: 1.0 });

/* --- 第三章 箭头记号 --- */
cap(51.0, 54.6, '要写出葛立恒数，普通的记号已经不够用了。');
cap(55.0, 58.4, '乘法，是重复的加法；');
cap(58.8, 62.8, '乘方，是重复的乘法，可以写作 3↑3；');
cap(63.2, 68.6, '高德纳发明了箭头记号：两个箭头 ↑↑，表示重复的乘方。');
cap(69.0, 74.0, '3↑↑3 = 3 的 3 的 3 次方 = 7,625,597,484,987，大约 7.6 万亿。');
cap(74.4, 79.6, '如果每秒数一个数，不吃不睡，也要数上 24 万年。');
ov(51.6, 58.4, '3 × 3 <span class="op">=</span> 3 + 3 + 3', 'eq', 'left:50%;top:42%');
ov(58.8, 65.4, '3↑3 <span class="op">=</span> 3 × 3 × 3 <span class="op">=</span> 27', 'eq', 'left:50%;top:42%');
ov(65.6, 69.2, '3↑↑3 <span class="op">=</span> 3↑3↑3 <span class="op">=</span> 3<sup>3<sup>3</sup></sup> <span class="op">=</span> 3<sup>27</sup>', 'eq', 'left:50%;top:42%', { fo: 0.4 });
ov(69.2, 79.8, '3↑↑3 <span class="op">=</span> 3<sup>3<sup>3</sup></sup> <span class="op">=</span>', 'eq', 'left:50%;top:22%', { fi: 0.4 });
ov(75.0, 79.8, '≈ 24 万年 <span class="k">· 每秒数一个</span>', 'tag center', 'left:50%;top:70%');

/* --- 第四章 指数塔 --- */
cap(80.6, 85.0, '再加一层：3↑↑4，也就是 3 的 7,625,597,484,987 次方。');
cap(85.4, 90.6, '它一共有 3,638,334,640,025 位数字，约 3.6 万亿位。');
cap(91.0, 95.6, '每位数字只占 1 毫米，排成一行，可以在地球和月球之间往返四次多。');
cap(96.0, 101.2, '这些就是它真实的数字：开头是 1258014290……，结尾是 ……6100739387。');
ov(80.6, 101.4, '3↑↑4 <span class="op">=</span> 3<sup>3<sup>3<sup>3</sup></sup></sup> <span class="op">=</span> 3<sup>7,625,597,484,987</sup>', 'eq sm', 'left:50%;top:12%');
ov(85.6, 95.6, '', 'counter', 'left:50%;top:50%', {
  update(t, el) {
    const p = easeOut(seg(t, 85.8, 88.6));
    el.innerHTML = group(Math.round(3638334640025 * p)) + '<span class="k"> 位</span>';
  },
});
ov(96.0, 101.4, '<span class="k">开头</span>' + GDATA.head.slice(0, 20) + '…', 'digits', 'left:27%;top:50%');
ov(96.4, 101.4, '<span class="k">结尾</span>…' + GDATA.tail.slice(-20), 'digits', 'left:73%;top:50%');

cap(101.8, 105.6, '再加一层：3↑↑5，也就是 3 的 3↑↑4 次方。');
cap(106.0, 111.6, '把整个可观测宇宙切成普朗克尺度的小格子，大约 10¹⁸⁵ 个，每格写一位数字——');
cap(112.0, 117.4, '也远远写不下 3↑↑5。光是它的位数，就已经是一个 3.6 万亿位的数。');
ov(101.8, 117.6, '3↑↑5 <span class="op">=</span> 3<sup>3↑↑4</sup>', 'eq sm', 'left:50%;top:12%');
ov(106.4, 117.6, '<span class="k">可观测宇宙能写下的位数</span><br><span class="big">≈ 10<sup>185</sup></span><span class="k">（每个普朗克体积写一位）</span>', 'card', 'left:20%;top:47%');
ov(108.0, 117.6, '<span class="k">3↑↑5 的位数</span><br><span class="big">≈ 6 × 10<sup>3,638,334,640,023</sup></span><span class="k">（一个 3.6 万亿位的数）</span>', 'card', 'left:80%;top:47%');

cap(117.8, 122.2, '三个箭头：3↑↑↑3 = 3↑↑(3↑↑3) = 3↑↑7,625,597,484,987。');
cap(122.6, 127.0, '这是一座由 3 堆成的指数塔，足足 7.6 万亿层。');
cap(127.4, 133.0, '如果每层只有 1 厘米高，这座塔会高达 7600 万公里，相当于地球到太阳距离的一半。');
cap(133.4, 139.0, '计算这座塔，要从塔顶开始往下算：才算到第 5 层，结果就已经装不进宇宙了。');
cap(139.4, 144.4, '而在它下面，还有 7,625,597,484,982 层。');
cap(144.8, 150.0, '这，就是 3↑↑↑3。');
ov(117.8, 150.2, '3↑↑↑3 <span class="op">=</span> 3↑↑7,625,597,484,987', 'eq sm', 'left:50%;top:12%');
// 高度表
const ALT_MS = [
  [884800, '珠穆朗玛峰', '8,848 米'],
  [4e7, '国际空间站', '400 公里'],
  [3.844e10, '月球', '38.4 万公里'],
  [7625597484987, '塔顶', '约 7,626 万公里'],
];
const altK = (t) => 12.88227 * clamp((t - 122.4) / (137.6 - 122.4));
function fmtAlt(cm) {
  if (cm < 100) return Math.max(1, Math.round(cm)) + ' 厘米';
  const m = cm / 100;
  if (m < 1000) return group(m) + ' 米';
  const km = m / 1000;
  if (km < 100) return km.toFixed(1) + ' 公里';
  if (km < 10000) return group(km) + ' 公里';
  if (km < 1e6) return (km / 1e4).toFixed(1) + ' 万公里';
  return group(km / 1e4) + ' 万公里';
}
ov(120.0, 140.0, '', 'hud', 'left:9%;top:50%', {
  update(t, el) {
    const cm = Math.pow(10, altK(t));
    let ms = '';
    for (const [h, name, txt] of ALT_MS) {
      const tp = 122.4 + Math.log10(h) / 12.88227 * 15.2;
      const a = fade(t, tp - 0.15, h > 1e12 ? 140 : tp + 2.6, 0.3, 0.6);
      if (a > 0) ms = `<div class="ms" style="opacity:${a.toFixed(3)}"><span class="k">经过</span> ${name} · ${txt}</div>`;
    }
    el.innerHTML = `<div class="k">高度</div><div class="alt">${fmtAlt(cm)}</div><div class="k">第 ${group(Math.max(1, cm))} 层</div>${ms}`;
  },
});
ov(133.6, 144.6, `<div class="k">从塔顶往下算</div>
<div class="row"><span class="lv">第 1 层</span>3</div>
<div class="row"><span class="lv">第 2 层</span>3<sup>3</sup> = 27</div>
<div class="row"><span class="lv">第 3 层</span>3<sup>27</sup> = 7,625,597,484,987</div>
<div class="row"><span class="lv">第 4 层</span>3<sup>7.6万亿</sup>（3.6 万亿位）</div>
<div class="row bad"><span class="lv">第 5 层</span>宇宙装不下</div>
<div class="row dim"><span class="lv">……</span>还有 7,625,597,484,982 层</div>`, 'ladder', 'left:80%;top:48%', {
  update(t, el) {
    el.querySelectorAll('.row').forEach((r, i) => { r.style.opacity = smooth(seg(t, 134.0 + i * 0.75, 134.5 + i * 0.75)).toFixed(3); });
  },
});

/* --- 第五章 从 g1 到 g64 --- */
cap(150.6, 154.6, '四个箭头：g₁ = 3↑↑↑↑3 = 3↑↑↑(3↑↑↑3)。');
cap(155.0, 160.6, '从 3 开始造塔，把塔算出的结果作为下一座塔的层数，再把新的结果作为下下一座塔的层数……');
cap(161.0, 166.6, '这个步骤要重复的次数，正是刚才那座 7.6 万亿层高塔算出的结果。');
cap(167.0, 172.0, '这个数，叫做 g₁。');
ov(150.6, 172.4, 'g<sub>1</sub> <span class="op">=</span> 3↑↑↑↑3 <span class="op">=</span> 3↑↑↑(3↑↑↑3)', 'eq sm', 'left:50%;top:12%');
ov(155.2, 172.4, `<div class="row"><i>a</i><sub>1</sub> = 3</div>
<div class="row"><i>a</i><sub>2</sub> = 3↑↑<i>a</i><sub>1</sub> = 7,625,597,484,987</div>
<div class="row"><i>a</i><sub>3</sub> = 3↑↑<i>a</i><sub>2</sub> <span class="k">（7.6 万亿层的塔）</span></div>
<div class="row"><i>a</i><sub>4</sub> = 3↑↑<i>a</i><sub>3</sub> <span class="k">（层数为 <i>a</i><sub>3</sub> 的塔）</span></div>
<div class="row dim">⋮</div>
<div class="row hl">g<sub>1</sub> = <i>a</i><sub>3↑↑↑3</sub></div>`, 'chain', 'left:20%;top:52%', {
  update(t, el) {
    const ts = [155.4, 156.6, 157.8, 159.0, 160.0, 167.0];
    el.querySelectorAll('.row').forEach((r, i) => { r.style.opacity = smooth(seg(t, ts[i], ts[i] + 0.6)).toFixed(3); });
  },
});

cap(172.6, 176.6, '然而，g₁ 只是第一步。');
cap(177.0, 182.0, 'g₂ 中间的箭头不是 4 个，而是 g₁ 个。');
cap(182.4, 187.2, 'g₃ 的箭头数是 g₂ 个，g₄ 的箭头数是 g₃ 个……');
cap(187.6, 192.8, '就这样一层一层套下去，直到第 64 层——');
cap(193.6, 198.0, 'g₆₄，就是葛立恒数。');
const portalCam = (t) => { const x = seg(t, 173.6, 192.8), k = 3.4; return 64 * (Math.exp(k * x) - 1) / (Math.exp(k) - 1); };
ov(174.0, 193.0, '', 'portal-label', 'left:50%;top:50%', {
  fi: 0.8, fo: 0.25,
  update(t, el) {
    const c = portalCam(t);
    const n = clamp(Math.floor(c) + 1, 1, 64);
    const pulse = 1 + 0.12 * Math.exp(-(c % 1) * 6) * (c > 0.5 ? 1 : 0);
    const sub = n === 1 ? '3↑↑↑↑3' : `3 ↑<sup>g<sub>${n - 1}</sub></sup> 3`;
    el.innerHTML = arrows(`<div class="g">g<sub>${n}</sub></div><div class="k">${sub}</div>`);
    el.style.setProperty('--pulse', pulse.toFixed(3));
  },
});
ov(195.2, 198.4, 'G <span class="op">=</span> g<sub>64</sub>', 'eq', 'left:50%;top:81.5%', { fi: 0.8 });

/* --- 大到…… --- */
cap(198.6, 204.0, '它大到：如果你想把它的全部数字记在脑子里，你的大脑会先坍缩成一个黑洞——');
cap(204.4, 209.6, '因为物理学允许一个脑袋大小的空间储存的信息，最多只有大约 10⁶⁸ 比特。');
cap(210.0, 215.6, '可奇妙的是，我们依然能精确地算出它的最后几位。');
cap(216.0, 221.6, '当指数塔足够高时，末尾的数字会稳定下来。葛立恒数，以 ……2464195387 结尾。');
ov(204.6, 209.8, '<span class="k">半径 10 厘米的球体最多能储存</span><br><span class="big">≈ 1.7 × 10<sup>68</sup> 比特</span><span class="k">（全息原理上限）</span>', 'card', 'left:80%;top:44%');
const G40 = GDATA.gTail.slice(-40);
ov(210.2, 222.0, '', 'odo', 'left:50%;top:47%', {
  update(t, el) {
    let s = '<span class="dots">…</span>';
    for (let i = 0; i < 40; i++) {
      const ts = 210.8 + (39 - i) * 0.11;
      const done = t >= ts;
      const d = done ? G40[i] : String(Math.floor(t * 31 + i * 7.3) % 10);
      s += `<span class="${done ? 'd' : 'd roll'}"${t < ts - 1.4 ? ' style="opacity:.12"' : ''}>${d}</span>`;
      if (i % 10 === 9 && i < 39) s += '<span class="sp"></span>';
    }
    el.innerHTML = `<div class="k">葛立恒数的最后 40 位</div><div class="num">${s}</div>`;
  },
});

/* --- 第六章 又有多小 --- */
cap(223.0, 228.4, '那么，葛立恒数又有多小呢？');
ov(223.2, 229.4, '葛立恒数又有多小？', 'title', 'left:50%;top:21%', { fi: 1.2 });
cap(229.6, 234.6, '首先，葛立恒数只是那个超立方体问题答案的“上界”。');
cap(235.0, 240.2, '后来人们证明，答案至少是 13；上界也一再被压缩，如今已降到 2↑↑↑5。');
cap(240.6, 245.4, '那个问题真正的答案，也许只是一个不大的数。');
ov(229.8, 245.8, '13 <span class="op">≤</span> <i>N</i> <span class="op">≤</span> G', 'eq sm', 'left:50%;top:22%', { fo: 0.3, until: 237.0 });
ov(237.0, 245.8, '13 <span class="op">≤</span> <i>N</i> <span class="op">&lt;</span> 2↑↑↑5 <span class="op">≪</span> G', 'eq sm', 'left:50%;top:22%', { fi: 0.3 });
const NL0 = -0.74;
const ubX = (t) => lerp(0.64, 0.30, ease(seg(t, 236.4, 239.2)));
ov(230.6, 245.8, '0', 'mk', `left:${uvLeft(NL0)};top:58%`);
ov(231.2, 245.8, '<b>13</b><span class="k">已知下界</span>', 'mk cy', `left:${uvLeft(NL0 + 0.1)};top:40%`);
ov(231.8, 245.8, '<b>G</b><span class="k">葛立恒数</span>', 'mk au', `left:${uvLeft(0.64)};top:40%`);
ov(236.4, 245.8, '<b>2↑↑↑5</b><span class="k">新的上界</span>', 'mk vi', 'top:40%', {
  update(t, el) { el.style.left = uvLeft(ubX(t)); },
});

cap(245.8, 250.4, '其次，比它更大的数随手就能写出来：G + 1，G 的 G 次方……');
cap(250.8, 255.6, '或者，把那 64 层的构造重复 G 层，得到 g<sub>G</sub>。');
ov(246.2, 256.0, '', 'ladder2', 'left:50%;top:45%', {
  update(t, el) {
    const items = ['G', 'G + 1', 'G<sup>G</sup>', 'G↑↑G', 'g<sub>G</sub>'];
    const ts = [246.2, 247.6, 249.0, 250.4, 251.8];
    el.innerHTML = arrows(items.map((s, i) => `<span style="opacity:${smooth(seg(t, ts[i], ts[i] + 0.6)).toFixed(3)}">${i ? '<span class="op">&lt;</span>' : ''}${s}</span>`).join(''));
  },
});
cap(256.2, 261.8, '数学中还有大得多的数。比如 TREE(3)，它来自一个用三种颜色画树的游戏。');
cap(262.2, 267.8, 'TREE(1) = 1，TREE(2) = 3，而 TREE(3) 大到：葛立恒数与它相比，几乎可以忽略不计。');
cap(268.2, 270.6, '');
ov(262.4, 270.8, 'TREE(1) = 1 <span class="sep"></span> TREE(2) = 3 <span class="sep"></span> TREE(3) = <span class="q">远大于 G</span>', 'tag center', 'left:50%;top:79%');
ov(256.4, 262.0, '<span class="k">规则</span>第 <i>k</i> 棵树最多 <i>k</i> 个节点 · 后面的树不能“包含”前面的任何一棵', 'tag center small', 'left:50%;top:17%');

/* --- 第七章 无穷 --- */
cap(270.8, 275.0, '最后，也是最重要的：葛立恒数是<b>有限</b>的。');
cap(275.4, 280.6, '从 1 开始一个一个地数，无论要数多久，总有一天能数到它。');
cap(281.0, 287.0, '而在它之后，还有无穷多个自然数：比它小的只有有限个，比它大的却有无穷多个。');
cap(287.4, 293.0, '无论把数轴缩小多少倍，葛立恒数都会被挤向原点，而数轴的另一端永远没有尽头。');
cap(293.4, 299.6, '在无穷面前，葛立恒数和 1 一样渺小。');
const gX = (t) => t < 281.5 ? 0.55 : NL0 + (0.55 - NL0) * Math.exp(-(t - 281.5) * 0.55);
ov(271.4, 293.4, '<b>1</b>', 'mk', `left:${uvLeft(NL0 + 0.06)};top:58%`, { update(t) { return 1 - smooth(seg(t, 282, 285)); } });
ov(271.8, 293.4, '<b>G</b>', 'mk au', 'top:41%', { update(t, el) { el.style.left = uvLeft(gX(t)); } });
ov(275.6, 281.0, '', 'counter sm', 'left:50%;top:30%', {
  update(t, el) {
    const p = seg(t, 275.8, 280.0);
    const k = Math.pow(p, 1.6) * 15;
    const v = Math.floor(Math.pow(10, k));
    el.innerHTML = p >= 1 ? '1, 2, 3, …, G' : '1, 2, 3, …, ' + group(v);
  },
});
const BIGS = ['10G', 'G<sup>2</sup>', 'G<sup>G</sup>', 'g<sub>G</sub>', 'TREE(3)', 'TREE(G)', '…'];
ov(283.0, 293.4, '', 'mk vi right', 'left:92%;top:41%', {
  update(t, el) {
    const i = clamp(Math.floor((t - 283.0) / 1.45), 0, BIGS.length - 1);
    el.innerHTML = `<b>${BIGS[i]}</b><span class="k">→ ∞</span>`;
  },
});

/* --- 尾声 --- */
cap(300.4, 305.0, '大到宇宙写不下，小到在无穷面前不值一提。');
cap(305.4, 311.0, '这就是葛立恒数：一个我们永远无法写下，却可以精确谈论的数。');
ov(307.6, 318.0, '有多大？又有多小？', 'subtitle', 'left:50%;top:70%', { fi: 1.4, fo: 1.6 });
ov(311.6, 318.0, '画面中的数字（3↑↑4 的首尾、葛立恒数的末 100 位）均由程序真实计算', 'credit', 'left:50%;top:91%', { fi: 1.2, fo: 1.6 });

const CHAPTERS = [
  [0, '引子'], [17, '问题的起源'], [50, '箭头记号'], [80, '指数塔'], [150, '从 g₁ 到 g₆₄'],
  [198, '大到……'], [222, '又有多小'], [270, '无穷'], [300, '尾声'],
];

/* ============================================================ 几何数据 === */
let G = {};
function buildGeometry() {
  const r = E.rng(1977);
  const col = () => (r() < 0.5 ? RED : BLUE);
  // 三维立方体的完全图 K8
  const v3 = [];
  for (let i = 0; i < 8; i++) v3.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, 0]);
  const e3 = [];
  let extra = 0;
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const ham = [0, 1, 2].filter((k) => v3[i][k] !== v3[j][k]).length;
    e3.push({ a: v3[i], b: v3[j], c: col(), r: ham === 1 ? 0 : 0.12 + 0.8 * (extra++ / 15) });
  }
  // 四维超立方体的完全图 K16，其中强制一组共面 4 点同色
  const v4 = [];
  for (let i = 0; i < 16; i++) v4.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  const special = [[1, 1, 1, 1], [1, 1, -1, -1], [-1, -1, 1, 1], [-1, -1, -1, -1]];
  const isSp = (v) => special.some((s) => s.every((x, k) => x === v[k]));
  const e4 = [], eh = [];
  for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) {
    const sp = isSp(v4[i]) && isSp(v4[j]);
    const c = sp ? RED : col();
    e4.push({ a: v4[i], b: v4[j], c, r: 0 });
    if (sp) eh.push({ a: v4[i], b: v4[j], c: [2.4, 0.5, 0.5], r: 0 });
  }
  G.k8 = E.lineSet(e3);
  G.k16 = E.lineSet(e4);
  G.k4 = E.lineSet(eh);
  G.p8 = E.pointSet(v3.map((p) => ({ p, c: [1.4, 1.5, 1.8], r: 0 })));
  G.p16 = E.pointSet(v4.map((p) => ({ p, c: isSp(p) ? [2.6, 1.0, 1.0] : [1.4, 1.5, 1.8], r: 0 })));

  // TREE 游戏里的树：节点 = [颜色, 子节点…]
  const TC = [GOLD2, CYAN, ROSE];
  const trees = [
    [0, []],
    [1, [[1, []]]],
    [1, [[2, []], [2, []]]],
    [2, [[2, [[2, [[2, []]]]]]]],
    [2, [[2, [[2, []]]], [1, []]]],
    [2, [[1, [[2, []]]], [2, []], [2, [[1, []]]]]],
    [1, [[2, [[2, []], [2, []]]], [2, [[2, [[2, []]]]]]]],
    [2, [[2, [[1, []], [2, []]]], [2, []], [2, [[2, []], [2, [[2, []]]]]]]],
  ];
  const tEdges = [], tPts = [];
  let order = 0;
  const total = trees.reduce((s, tr) => { const cnt = (n) => 1 + n[1].reduce((a, c) => a + cnt(c), 0); return s + cnt(tr); }, 0);
  const leaves = (n) => (n[1].length ? n[1].reduce((a, c) => a + leaves(c), 0) : 1);
  trees.forEach((tr, ti) => {
    const cx = -6.0 + ti * 1.72;
    const place = (n, x0, x1, depth, parent) => {
      const x = (x0 + x1) / 2, y = -1.55 + depth * 0.62;
      const th = (order++) / total;
      tPts.push({ p: [x, y, 0, 0], c: TC[n[0]], r: th });
      if (parent) tEdges.push({ a: [parent[0], parent[1], 0, 0], b: [x, y, 0, 0], c: [0.55, 0.6, 0.8], r: th - 0.004 });
      const L = leaves(n);
      let cur = x0;
      for (const ch of n[1]) { const w = (x1 - x0) * leaves(ch) / L; place(ch, cur, cur + w, depth + 1, [x, y]); cur += w; }
    };
    const w = Math.min(1.5, 0.42 * leaves(tr));
    place(tr, cx - w / 2, cx + w / 2, 0, null);
  });
  G.treeE = E.lineSet(tEdges);
  G.treeP = E.pointSet(tPts);

  G.digits = E.digitTexture(GDATA.head);
  G.sprites = new Float32Array(4200 * 8);
}

/* =========================================================== 场景 ===== */
const camDefault = (t, d = 10) => E.camera([Math.sin(t * 0.05) * 0.8, Math.sin(t * 0.07) * 0.3, d], [0, 0, 0], 40);

// 指数塔的"视觉高度"（以层为单位），与真实高度分开：真实高度呈指数增长
const towerV = (x) => 1.2 + 26 * smooth(seg(x, 122.4, 126.5)) * (1 - 0.95 * smooth(seg(x, 135.5, 138.2)));
const towerY = (t) => integ(towerV, 117.5, Math.min(t, 140), 1 / 30);

const SCENES = [
  /* ---------------- 引子 ---------------- */
  { t0: 0, t1: 19.5, draw(t) {
    const cam = E.camera([Math.sin(t * 0.1) * 0.6, 0.9 - 0.9 * smooth(seg(t, 8, 13)), 11 - 1.2 * smooth(seg(t, 0, 12))], [0, 0, 0], 40);
    const gs = 0.62 + 0.1 * smooth(seg(t, 0, 9));
    const mA = scaleM(rotM([0, 1, 0.25], [1, 2, 1.05 - 0.35 * smooth(seg(t, 5, 12))], [0, 2, t * 0.1]), gs);
    if (t < 14.6) {
      const m = ease(seg(t, 8.2, 12.8));
      E.particles({ A: 'galaxy', B: 'title', mix: m, mA, mB: transM(0, 0.35, 0), vp: cam.VP, alpha: smooth(seg(t, 0.2, 4)) * (1 + 0.3 * m),
        c1: GOLD, c2: [1.0, 1.15, 1.9], size: 17 + 1 * m, swirl: 0.9 });
    } else {
      const m = ease(seg(t, 15.4, 19.0));
      E.particles({ A: 'title', B: 'dust', mix: m, mA: transM(0, 0.35, 0), vp: cam.VP, alpha: 1.3 * (1 - smooth(seg(t, 17, 19.5))),
        c1: GOLD, c2: [1.0, 1.15, 1.9], size: 18 + 6 * m, swirl: 1.4 });
    }
  } },

  /* ---------------- 超立方体 ---------------- */
  { t0: 17, t1: 51.5, draw(t) {
    const a = fade(t, 17.5, 51.2, 2.0, 2.4);
    const dist = 8.0 + 9 * easeIn(seg(t, 45.5, 51.2));
    const ph = t * 0.22;
    const cam = E.camera([Math.sin(ph) * dist, 2.2 + Math.sin(t * 0.13) * 0.6, Math.cos(ph) * dist], [0, -0.15, 0], 40);
    const m4 = smooth(seg(t, 31.8, 35.2));
    const r4 = rotM([0, 3, 0.55 * m4 * (t - 31.8) * 0.35 + 0.0], [1, 3, 0.35 * m4 * Math.sin((t - 31.8) * 0.3)]);
    const reveal = 0.1 + 0.95 * seg(t, 23.2, 27.0);
    const cmix = smooth(seg(t, 27.6, 30.0));
    const hl = smooth(seg(t, 35.0, 36.2)) * (1 - smooth(seg(t, 39.5, 42)));
    const dim = 1 - 0.65 * hl;
    const D4 = 3.4;
    if (m4 < 1) {
      E.lines(G.k8, { vp: cam.VP, width: 2.0, alpha: a * (1 - m4) * dim, reveal, colorMix: cmix, d4: 0 });
      E.points(G.p8, { vp: cam.VP, size: 70, alpha: a * (1 - m4) });
    }
    if (m4 > 0) {
      E.lines(G.k16, { vp: cam.VP, r4, d4: D4, wScale: m4, width: 1.7, alpha: a * m4 * dim * 0.9, colorMix: 1 });
      E.points(G.p16, { vp: cam.VP, r4, d4: D4, wScale: m4, size: 62, alpha: a * m4 });
    }
    if (hl > 0) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 6);
      E.lines(G.k4, { vp: cam.VP, r4, d4: D4, wScale: m4, width: 5.5, alpha: a * hl * pulse * 1.3, colorMix: 1 });
    }
  } },

  /* ---------------- 箭头 & 7.6 万亿 ---------------- */
  { t0: 49.5, t1: 82, draw(t) {
    const cam = camDefault(t, 10);
    if (t < 66.5) {
      E.particles({ A: 'dust', vp: cam.VP, mix: 0, mA: transM(0, 0, 0), alpha: 0.5 * fade(t, 49.5, 82, 2, 1), c1: GOLD, c2: ICE, size: 20, swirl: 0, jitter: 0.08 });
    } else {
      const m = ease(seg(t, 66.6, 70.6));
      const out = ease(seg(t, 79.2, 81.8));
      E.particles({ A: out > 0 ? 'n7' : 'dust', B: out > 0 ? 'dust2' : 'n7', mix: out > 0 ? out : m,
        mA: out > 0 ? transM(0, -0.3, 0) : transM(0, 0, 0), mB: out > 0 ? transM(0, 0, 0) : transM(0, -0.3, 0),
        vp: cam.VP, alpha: (0.5 + 0.8 * m) * (1 - out), c1: GOLD2, c2: [1.9, 1.2, 0.6], size: 20, swirl: 1.0 });
    }
  } },

  /* ---------------- 数字隧道 3↑↑4 ---------------- */
  { t0: 80, t1: 102.5, draw(t) {
    const travel = integ((x) => 0.35 + 1.6 * smooth(seg(x, 81, 86)) - 1.2 * smooth(seg(x, 95, 98)), 80, t, 1 / 30);
    E.fullscreen('tunnel', { uTravel: travel, uTwist: 0.35, uAtlas: SHAPES.atlas, uDigits: G.digits,
      uC1: [1.6, 0.95, 0.4], uC2: [1.5, 1.4, 1.6], alpha: fade(t, 80, 102.5, 1.8, 1.8) });
  } },

  /* ---------------- 宇宙 3↑↑5 ---------------- */
  { t0: 101, t1: 118.5, draw(t) {
    const d = 9.5 + 3.5 * smooth(seg(t, 101, 118));
    const cam = E.camera([Math.sin(t * 0.06) * d, 1.5, Math.cos(t * 0.06) * d], [0, 0, 0], 42);
    const m = ease(seg(t, 101.2, 105));
    E.particles({ A: 'dust2', B: 'universe', mix: m, mB: rotM([0, 2, t * 0.03]), vp: cam.VP,
      alpha: fade(t, 101, 118.4, 1.2, 1.4) * 1.1, c1: [0.6, 0.8, 1.7], c2: GOLD, c3: VIOLET, size: 22, swirl: 1.2 });
  } },

  /* ---------------- 指数塔 3↑↑↑3 ---------------- */
  { t0: 117.4, t1: 151, draw(t) {
    const SP = 1.3;                       // 每层的间距
    const yc = towerY(t) * SP;
    const v = towerV(Math.min(t, 140));
    const pull = ease(seg(t, 138.5, 147));
    const a = fade(t, 117.4, 150.8, 1.6, 2.6);
    const near = smooth(seg(t, 120.5, 123.5));
    const eye = mixv([1.6, yc + 0.5, lerp(9, 5, near)], [5, yc - 9, 24], pull);
    const tgt = mixv([0, yc + lerp(3.5, 4.6, near), 0], [0, yc + 8, 0], pull);
    const cam = E.camera(eye, tgt, 46);
    const inst = G.sprites;
    let n = 0;
    const lo = Math.max(0, Math.floor(yc / SP) - (pull > 0 ? 400 : 30));
    const hi = Math.floor(yc / SP) + (pull > 0 ? 3000 : 220);
    const stretch = 1 + v * 0.035;
    const appear = (lv) => smooth(seg(t, 117.6 + lv * 0.35, 118.2 + lv * 0.35));
    for (let lv = lo; lv < hi && n < 4200; lv++) {
      const k = lv * 0.618034;
      const hue = k - Math.floor(k);
      const b = (0.65 + 0.6 * hue) * (lv < 14 ? appear(lv) : smooth(seg(t, 121.6, 123.6)));
      inst.set([0, lv * SP, 0, 0.9, 3, b * 1.5, stretch, hue], n * 8);
      n++;
    }
    E.sprites(inst, n, { cam, atlas: SHAPES.atlas, c1: [1.8, 1.1, 0.45], c2: [1.6, 1.5, 1.7], alpha: a });
  } },

  /* ---------------- 递归之塔 g1 ---------------- */
  { t0: 150, t1: 173.5, draw(t) {
    const z = integ((x) => 0.12 + 0.38 * smooth(seg(x, 154, 166)), 150, t, 1 / 30);
    E.fullscreen('recur', { uZoom: z, uC1: [1.7, 1.0, 0.4], uC2: [1.6, 0.55, 0.3], uC3: [2.2, 2.0, 1.8], alpha: fade(t, 150, 173.5, 1.6, 1.6) });
  } },

  /* ---------------- 传送门 g1 → g64 ---------------- */
  { t0: 172.5, t1: 194, draw(t) {
    const c = portalCam(t);
    const x = seg(t, 173.6, 192.8);
    const speed = clamp(Math.exp(3.4 * x) / Math.exp(3.4) * 1.2, 0, 1.2);
    E.fullscreen('portal', { uCam: c, uSpeed: speed, uC1: [1.6, 0.9, 0.4], uC2: [0.8, 0.9, 1.8], alpha: fade(t, 172.5, 193.6, 1.4, 0.5) });
  } },

  /* ---------------- G 现身、坠入黑洞 ---------------- */
  { t0: 192.6, t1: 204, draw(t) {
    const cam = camDefault(t, 10);
    if (t < 199.2) {
      const m = ease(seg(t, 192.9, 196.2));
      E.particles({ A: 'burst', B: 'G', mix: m, mB: transM(0, 0.55, 0), vp: cam.VP, alpha: 1.3 * smooth(seg(t, 192.8, 193.6)), c1: GOLD2, c2: WHITE, size: 20, swirl: 2.0, spread: 0.5 });
    } else {
      const m = ease(seg(t, 199.5, 202.8));
      E.particles({ A: 'G', B: 'point', mix: m, mA: transM(0, 0.55, 0), mB: transM(0, 0.29, 0), vp: cam.VP, alpha: 1.3 * (1 - smooth(seg(t, 201.8, 203.6))), c1: GOLD2, c2: WHITE, size: 20, swirl: 2.5, spread: 0.6 });
    }
  } },

  /* ---------------- 末尾数字 ---------------- */
  { t0: 209, t1: 223, draw(t) {
    const cam = camDefault(t, 10);
    E.particles({ A: 'dust2', vp: cam.VP, alpha: 0.35 * fade(t, 209, 223, 1.5, 1.5), c1: GOLD, c2: ICE, size: 18, jitter: 0.1 });
  } },

  /* ---------------- 转折：G 缩成一点 ---------------- */
  { t0: 221.5, t1: 231, draw(t) {
    const cam = camDefault(t, 10);
    const m = ease(seg(t, 221.8, 224.4));
    const s = lerp(0.62, 0.015, ease(seg(t, 225.0, 229.0)));
    const mA = scaleM(M4.ident(), s, 0, lerp(-0.35, -0.8, s / 0.62));
    E.particles({ A: 'dust', B: 'G', mix: m, mA: M4.ident(), mB: mA, vp: cam.VP, alpha: fade(t, 221.5, 231, 1, 1.6) * (1 + 1.5 * (1 - s)), c1: ICE, c2: [1.2, 1.6, 2.2], c3: VIOLET, size: 18, swirl: 1.2 });
  } },

  /* ---------------- 上下界 ---------------- */
  { t0: 229.5, t1: 246.5, draw(t) {
    const a = fade(t, 229.6, 246.4, 1.2, 1.2);
    const M = new Float32Array([
      NL0, smooth(seg(t, 230.6, 231.4)) * 0.6, 3, 0.0,
      NL0 + 0.1, smooth(seg(t, 231.2, 232.0)), 1, 0.12,
      0.64, smooth(seg(t, 231.8, 232.6)), 0, 0.12,
      ubX(t), smooth(seg(t, 236.4, 237.2)), 2, 0.12,
    ]);
    E.fullscreen('numline', { uM: M, uZoom: 0, uBreak: 1, uX0: NL0, uC1: GOLD2, uC2: CYAN, uC3: VIOLET, alpha: a });
  } },

  /* ---------------- 更大的数 & TREE(3) ---------------- */
  { t0: 245, t1: 271.5, draw(t) {
    const cam = E.camera([Math.sin(t * 0.07) * 1.2, 0.3, 10.5], [0, 0.2, 0], 40);
    const tr = fade(t, 256.0, 271.0, 1.2, 1.6);
    if (tr > 0) {
      const reveal = seg(t, 256.6, 264.0) * 1.02;
      E.lines(G.treeE, { vp: cam.VP, width: 3.0, alpha: tr * 0.9, reveal, colorMix: 1 });
      E.points(G.treeP, { vp: cam.VP, size: 210, alpha: tr * 1.3, reveal });
    }
    const m = ease(seg(t, 263.0, 266.8));
    E.particles({ A: 'dust', B: 'tree3', mix: m, mB: transM(0, 2.5, 0), vp: cam.VP, alpha: fade(t, 245, 271.4, 1.5, 1.6) * (0.35 + 0.9 * m), c1: ICE, c2: VIOLET, c3: [2, 2, 2], size: 18, swirl: 1.2 });
  } },

  /* ---------------- 数轴与无穷 ---------------- */
  { t0: 270.5, t1: 301, draw(t) {
    const a = fade(t, 270.6, 296.5, 1.2, 2.5);
    const zoom = Math.max(0, t - 281.5) * 0.55 / Math.LN10 * 1.0;
    const M = new Float32Array([
      NL0, 0.6, 3, 0.0,
      NL0 + 0.06, 0.9 * (1 - smooth(seg(t, 282, 285))), 3, 0.08,
      gX(t), smooth(seg(t, 271.8, 272.6)), 0, 0.14,
      0.82, smooth(seg(t, 283, 284)) * 0.8, 2, 0.1,
    ]);
    E.fullscreen('numline', { uM: M, uZoom: zoom, uBreak: 1 - smooth(seg(t, 281, 282.5)), uX0: NL0, uC1: GOLD2, uC2: CYAN, uC3: VIOLET, alpha: a });
    const cam = camDefault(t, 10);
    const m = ease(seg(t, 292.6, 297.0));
    E.particles({ A: 'dust2', B: 'lemni', mix: m, mB: rotM([0, 2, Math.sin(t * 0.3) * 0.3]), vp: cam.VP, alpha: m * 1.2, c1: ICE, c2: VIOLET, c3: GOLD2, size: 20, swirl: 1.5 });
  } },

  /* ---------------- 尾声 ---------------- */
  { t0: 300, t1: 320, draw(t) {
    const cam = camDefault(t, 10);
    const m = ease(seg(t, 303.4, 307.6));
    E.particles({ A: 'lemni', B: 'endTitle', mix: m, mA: rotM([0, 2, Math.sin(t * 0.3) * 0.3]), vp: cam.VP, alpha: 1.2 * (1 - smooth(seg(t, 314.5, 318.5))),
      c1: mixv(ICE, GOLD, m), c2: mixv(VIOLET, [1.0, 1.15, 1.9], m), c3: GOLD2, size: 20 - 2 * m, swirl: 1.2 });
  } },
];

/* ======================================================== 全局参数 ==== */
function bgParams(t) {
  const cool = smooth(seg(t, 221.5, 227)) * (1 - 0.55 * smooth(seg(t, 301, 308)));
  const P = { c1: mixv(WARM.c1, COOL.c1, cool), c2: mixv(WARM.c2, COOL.c2, cool), c3: mixv(WARM.c3, COOL.c3, cool) };
  let neb = 1, star = 1;
  // 全屏特效场景时压暗星云
  neb *= 1 - 0.75 * fade(t, 80, 102.5, 1.8, 1.8);
  neb *= 1 - 0.8 * fade(t, 150, 173.5, 1.6, 1.6);
  neb *= 1 - 0.7 * fade(t, 172.5, 193.6, 1.4, 0.6);
  star *= 1 - 0.8 * fade(t, 150, 173.5, 1.6, 1.6);
  neb *= 1 - 0.4 * fade(t, 101, 118.4, 1.2, 1.4);
  const bh = fade(t, 199.0, 210.6, 2.4, 2.0);
  const skyA = fade(t, 117.4, 150.8, 1.6, 2.6) * (1 - smooth(seg(t, 125.5, 131.5)));
  const drift = [t * 0.004, Math.sin(t * 0.01) * 0.05];
  // 指数塔上升时星空向下流动
  if (t > 117) drift[1] -= towerY(t) * 0.0025;
  return { ...P, neb, star, bh: [0, 0.04, 0.085, bh], sky: [0.07, 0.17, 0.42, skyA * 0.85], drift, spin: t * 0.002 };
}
function postParams(t) {
  let flash = 0;
  flash += 0.85 * Math.exp(-Math.max(0, t - 192.85) * 2.2) * smooth(seg(t, 192.3, 192.85));
  flash += 0.25 * Math.exp(-Math.max(0, t - 69.0) * 3) * smooth(seg(t, 68.7, 69.0));
  flash += 0.18 * Math.exp(-Math.max(0, t - 137.6) * 2.5) * smooth(seg(t, 137.3, 137.6));
  const fadeG = smooth(seg(t, 0, 2.5)) * (1 - smooth(seg(t, 316.5, 319.8)));
  // 导出视频时颗粒调低：真实的胶片颗粒会白白吃掉码率
  return { flash, fade: fadeG, bloom: 0.24, grain: window.__RENDER ? 0.006 : 0.022, grainStatic: !!window.__RENDER, vignette: 0.9 };
}

/* ========================================================== 叠加层 ==== */
let ovRoot = null;
function initOverlay(root) {
  ovRoot = root;
  for (const o of OV) {
    const el = document.createElement('div');
    el.className = 'ov ' + o.cls;
    el.style.cssText = o.pos;
    el.innerHTML = arrows(o.html);
    el.style.display = 'none';
    root.appendChild(el);
    o.el = el; o.vis = false;
  }
}
function updateOverlay(t, showCaps = true) {
  for (const o of OV) {
    const t1 = o.until ?? o.t1;
    let a = fade(t, o.t0, t1, o.fi ?? 0.6, o.fo ?? 0.6);
    if (o.cls === 'cap' && !showCaps) a = 0;
    if (!o.html && !o.update) a = 0;
    if (a <= 0.001) { if (o.vis) { o.el.style.display = 'none'; o.vis = false; } continue; }
    if (!o.vis) { o.el.style.display = ''; o.vis = true; }
    if (o.update) { const k = o.update(t, o.el, a); if (typeof k === 'number') a *= k; }
    const rise = (1 - easeOut(seg(t, o.t0, o.t0 + (o.fi ?? 0.6) * 1.4))) * (o.rise ?? 0.6);
    o.el.style.opacity = a.toFixed(3);
    o.el.style.setProperty('--rise', rise.toFixed(3) + 'em');
    o.el.style.setProperty('--blur', ((1 - a) * 8).toFixed(2) + 'px');
  }
}

/* ============================================================ 渲染 ==== */
function renderFrame(t) {
  E.begin(t);
  E.bg(bgParams(t));
  for (const s of SCENES) if (t >= s.t0 && t < s.t1) s.draw(t);
  E.end(postParams(t));
}

window.FILM = { DURATION, CHAPTERS, buildGeometry, renderFrame, initOverlay, updateOverlay };
})();
