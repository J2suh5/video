/* ==========================================================================
   main.js — 播放器：时间轴、控制条、键盘快捷键、渲染模式接口
   ========================================================================== */
(function () {
'use strict';
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
window.__RENDER = RENDER;
const DUR = FILM.DURATION;

const frameEl = $('#frame'), canvas = $('#gl'), ovEl = $('#ov');
const ui = {
  poster: $('#poster'), play: $('#btn-play'), big: $('#btn-big'), time: $('#time'), seek: $('#seek'),
  fill: $('#seek-fill'), chap: $('#chapter'), mute: $('#btn-mute'), cc: $('#btn-cc'), fs: $('#btn-fs'),
  q: $('#btn-q'), controls: $('#controls'), marks: $('#marks'), loading: $('#loading'), err: $('#error'),
};

let t = 0, playing = false, lastNow = 0, showCaps = true, quality = 0, dirty = true, idleTimer = 0;
const QUAL = [[1, '高清'], [0.75, '标准'], [0.5, '流畅']];

function fmt(s) { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

function sizeCanvas() {
  if (RENDER) { E.resize(1920, 1080); return; }
  const r = frameEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * QUAL[quality][0];
  let w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  const maxPix = 2560 * 1440;
  if (w * h > maxPix) { const s = Math.sqrt(maxPix / (w * h)); w = Math.round(w * s); h = Math.round(h * s); }
  E.resize(Math.max(2, w), Math.max(2, h));
  dirty = true;
}

function draw() {
  FILM.renderFrame(t);
  FILM.updateOverlay(t, showCaps);
}

function chapterAt(x) { let c = FILM.CHAPTERS[0]; for (const ch of FILM.CHAPTERS) if (x >= ch[0]) c = ch; return c; }

function updateUI() {
  ui.time.textContent = fmt(t) + ' / ' + fmt(DUR);
  ui.seek.value = String(t);
  ui.fill.style.width = (t / DUR * 100).toFixed(3) + '%';
  const c = chapterAt(t);
  const idx = FILM.CHAPTERS.indexOf(c);
  ui.chap.textContent = (idx + 1) + ' · ' + c[1];
}

function setPlaying(p) {
  playing = p;
  document.body.classList.toggle('playing', p);
  ui.play.setAttribute('aria-label', p ? '暂停' : '播放');
  if (p) {
    if (t >= DUR - 0.05) t = 0;
    if (!document.body.classList.contains('started')) { document.body.classList.add('started'); t = params.get('t') ? t : 0; }
    ui.poster.hidden = true;
    AUDIO.start(t);
    lastNow = performance.now();
    poke();
  } else {
    clearTimeout(seekTimer);
    AUDIO.stop();
    showControls();
  }
}
let seekTimer = 0;
function seek(x) {
  t = Math.min(DUR, Math.max(0, x));
  dirty = true;
  if (playing) {
    // 拖动进度条时先停掉声音，停手 0.18 秒后再从新位置重新排程，避免反复重建音频图
    AUDIO.stop();
    lastNow = performance.now();
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => { if (playing) { AUDIO.start(t); lastNow = performance.now(); } }, 180);
  }
}

function loop(now) {
  if (playing) {
    const at = AUDIO.time();
    if (at !== null && AUDIO.running()) t = at;
    else t += (now - lastNow) / 1000;
    lastNow = now;
    if (t >= DUR) { t = DUR; setPlaying(false); }
    dirty = true;
  }
  if (dirty) { draw(); updateUI(); dirty = false; }
  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------- 控制条 --- */
function showControls() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
}
function poke() {
  showControls();
  if (playing) idleTimer = setTimeout(() => document.body.classList.add('idle'), 2600);
}
function toggleFS() {
  const el = $('#app');
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  } catch (e) { /* 某些环境不支持全屏 */ }
}
function bindUI() {
  ui.play.addEventListener('click', () => setPlaying(!playing));
  ui.big.addEventListener('click', (e) => { e.stopPropagation(); setPlaying(true); });
  ui.poster.addEventListener('click', () => setPlaying(true));
  canvas.addEventListener('click', () => setPlaying(!playing));
  ovEl.addEventListener('click', () => setPlaying(!playing));
  ui.seek.addEventListener('input', () => seek(parseFloat(ui.seek.value)));
  ui.mute.addEventListener('click', () => { AUDIO.setMuted(!AUDIO.muted()); ui.mute.classList.toggle('off', AUDIO.muted()); ui.mute.setAttribute('aria-pressed', String(AUDIO.muted())); });
  ui.cc.addEventListener('click', () => { showCaps = !showCaps; ui.cc.classList.toggle('off', !showCaps); ui.cc.setAttribute('aria-pressed', String(showCaps)); dirty = true; });
  ui.fs.addEventListener('click', toggleFS);
  ui.q.addEventListener('click', () => { quality = (quality + 1) % 3; ui.q.textContent = QUAL[quality][1]; sizeCanvas(); });
  document.addEventListener('mousemove', poke);
  document.addEventListener('touchstart', poke, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const k = e.key;
    if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); setPlaying(!playing); }
    else if (k === 'ArrowRight') { e.preventDefault(); seek(t + 5); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(t - 5); }
    else if (k === 'f' || k === 'F') toggleFS();
    else if (k === 'm' || k === 'M') ui.mute.click();
    else if (k === 'c' || k === 'C') ui.cc.click();
    else return;
    poke();
  });
  // 章节刻度
  for (const [ct, name] of FILM.CHAPTERS) {
    if (ct === 0) continue;
    const m = document.createElement('button');
    m.className = 'mark'; m.style.left = (ct / DUR * 100) + '%';
    m.title = name; m.setAttribute('aria-label', '跳到：' + name);
    m.addEventListener('click', (e) => { e.stopPropagation(); seek(ct); });
    ui.marks.appendChild(m);
  }
  ui.seek.max = String(DUR);
  new ResizeObserver(sizeCanvas).observe(frameEl);
}

/* ---------------------------------------------------------- 启动 ----- */
async function loadFonts() {
  const specs = ['900 40px GSerif', '600 40px GSerif', '400 40px GSans', '500 40px GSans', '500 40px GMath', '600 40px GMath', 'italic 500 40px GMath', '500 40px GMono'];
  try { await Promise.all(specs.map((s) => document.fonts.load(s, '葛立恒数0123456789G↑'))); } catch (e) { /* 回退字体 */ }
  try { await document.fonts.ready; } catch (e) { /* ignore */ }
}

async function boot() {
  if (RENDER) document.body.classList.add('render');
  E.init(canvas);
  await loadFonts();
  SHAPES.build();
  FILM.buildGeometry();
  FILM.initOverlay(ovEl);
  sizeCanvas();
  if (RENDER) return true;
  bindUI();
  const start = params.get('t');
  t = start ? Math.min(DUR, Math.max(0, parseFloat(start) || 0)) : 14.8;   // 封面停在标题成形的一帧
  ui.loading.hidden = true;
  ui.poster.hidden = false;
  dirty = true;
  requestAnimationFrame(loop);
  return true;
}

window.__ready = boot().catch((e) => {
  console.error(e);
  if (ui.loading) ui.loading.hidden = true;
  if (ui.err) { ui.err.hidden = false; ui.err.querySelector('p').textContent = '无法启动 WebGL2：' + e.message; }
  throw e;
});

/* -------------------------------------------- 渲染模式（导出视频用） --- */
window.__frame = function (x) {
  t = x;
  FILM.renderFrame(x);
  FILM.updateOverlay(x, true);
  E.gl.finish();
  return true;
};
let wav = null;
window.__audio = async function () { wav = await AUDIO.renderWav(); return wav.length; };
window.__audioChunk = function (i, size) {
  const part = wav.subarray(i * size, (i + 1) * size);
  let s = '';
  for (let k = 0; k < part.length; k += 0x8000) s += String.fromCharCode.apply(null, part.subarray(k, k + 0x8000));
  return btoa(s);
};
})();
