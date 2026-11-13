// =====================================================================
//  MAIN — clock, render pipeline, text overlay, controls
// =====================================================================
const DURATION = 240;
const $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search);
const TEST = QS.has('test');
const canvas = $('gl');
const VIEW = { s: 1, ox: 0, oy: 0, css: 1 };
const MET0 = new Float32Array(16).fill(-99);
let R = null, quality = 1, engine = null, started = false, glLost = false;
const lay = document.createElement('canvas'), emi = document.createElement('canvas');
const g2 = lay.getContext('2d'), ge = emi.getContext('2d');

try { R = new Renderer(canvas, TEST); } catch (err) {
  console.error(err);
  $('s-note').textContent = '这台设备的浏览器无法运行 WebGL2，短片没法播放。请换用最新版的 Chrome、Edge、Safari 或 Firefox 打开。';
  $('play-btn').disabled = true;
}

function layout() {
  if (!R) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = window.innerWidth, ch = window.innerHeight;
  let W = Math.round(cw * dpr * quality), H = Math.round(ch * dpr * quality);
  const maxPix = 2.3e6; if (W * H > maxPix) { const k = Math.sqrt(maxPix / (W * H)); W = Math.round(W * k); H = Math.round(H * k); }
  R.resize(W, H);
  if (lay.width !== W || lay.height !== H) { lay.width = emi.width = W; lay.height = emi.height = H; }
  const s = Math.min(H / 1080, W / 1440);
  VIEW.s = s; VIEW.ox = (W - 1920 * s) / 2; VIEW.oy = (H - 1080 * s) / 2; VIEW.css = cw / W;
  const k = VIEW.css, st = document.documentElement.style, u = s * k;
  st.setProperty('--u', u.toFixed(4));
  st.setProperty('--subY', ((VIEW.oy + 1030 * s) * k).toFixed(1) + 'px');
  st.setProperty('--midY', ((VIEW.oy + 520 * s) * k).toFixed(1) + 'px');
  st.setProperty('--cardX', Math.max(18, (VIEW.ox + 150 * s) * k).toFixed(1) + 'px');
  st.setProperty('--cardY', ((VIEW.oy + 150 * s) * k).toFixed(1) + 'px');
}

const sceneAt = T => { let s = SCENES[0]; for (const x of SCENES) if (T >= x.t0) s = x; return s; };
const pxOf = p => [VIEW.ox + p[0] * VIEW.s, R.H - (VIEW.oy + p[1] * VIEW.s)];

function renderScene(sc, tl, rt) {
  const st = sc.state(tl);
  R.target(rt); R.blend(null);
  const common = { uRes: [R.W, R.H], uView: [VIEW.ox, VIEW.oy, VIEW.s], uCam: [st.cam.x, st.cam.y, st.cam.z] };
  R.use(R.pBg, Object.assign({ uT: tl, uScene: sc.bg, uP0: st.P0, uP1: st.P1, uP2: st.P2, uMet: st.met ? new Float32Array(st.met) : MET0 }, common));
  R.fs();
  if (sc.draw) {
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, lay.width, lay.height);
    if (st.emis) { ge.setTransform(1, 0, 0, 1, 0, 0); ge.clearRect(0, 0, emi.width, emi.height); }
    const z = st.cam.z * VIEW.s;
    const M = [z, 0, 0, z, VIEW.ox + VIEW.s * (960 - st.cam.x * st.cam.z), VIEW.oy + VIEW.s * (540 - st.cam.y * st.cam.z)];
    g2.setTransform(...M); if (st.emis) ge.setTransform(...M);
    sc.draw(g2, tl, st, ge);
    R.upload(R.texL, lay); if (st.emis) R.upload(R.texE, emi);
    R.blend('over');
    R.use(R.pLayer, {
      uL: { tex: R.texL }, uE: { tex: R.texE }, uTx: [1 / R.W, 1 / R.H], uLight: pxOf(st.light), uAmb: st.amb, uRim: st.rim,
      uRimW: Math.max(1.5, st.rimW * VIEW.s * st.cam.z), uOmni: st.omni, uEmis: st.emis ? 1.7 : 0,
      uReflY: st.refl ? R.H - (VIEW.oy + st.refl.y * VIEW.s) : -1, uReflK: st.refl ? st.refl.k : 0, uRip: st.refl ? st.refl.rip * VIEW.s : 0, uT: tl,
    });
    R.fs();
  }
  const vis = [-VIEW.ox / VIEW.s, -VIEW.oy / VIEW.s, (R.W - VIEW.ox) / VIEW.s, (R.H - VIEW.oy) / VIEW.s];
  R.particles(Object.assign({ uT: tl, uVis: vis }, common), st.parts);
  R.flares(common, st.flares);
  R.blend(null);
  return st;
}

function post(src, gr, fb, fw, lens, T) {
  R.blend(null);
  R.target(R.h); R.use(R.pBright, { uS: { tex: src.t }, uTh: gr.th }); R.fs();
  R.target(R.q1); R.use(R.pBlur, { uS: { tex: R.h.t }, uD: [1 / R.h.w, 0] }); R.fs();
  R.target(R.q2); R.use(R.pBlur, { uS: { tex: R.q1.t }, uD: [0, 1 / R.q1.h] }); R.fs();
  R.target(R.e1); R.use(R.pBlur, { uS: { tex: R.q2.t }, uD: [1.5 / R.q2.w, 0] }); R.fs();
  R.target(R.e2); R.use(R.pBlur, { uS: { tex: R.e1.t }, uD: [0, 1.5 / R.e1.h] }); R.fs();
  R.target(R.e1); R.use(R.pBlur, { uS: { tex: R.e2.t }, uD: [2.2 / R.e2.w, 0] }); R.fs();
  R.target(R.e2); R.use(R.pBlur, { uS: { tex: R.e1.t }, uD: [0, 2.2 / R.e1.h] }); R.fs();
  R.target(null);
  R.use(R.pFinal, {
    uRes: [R.W, R.H], uView: [VIEW.ox, VIEW.oy, VIEW.s], uS: { tex: src.t }, uB1: { tex: R.q2.t }, uB2: { tex: R.e2.t }, uT: T,
    uBloom: gr.bloom, uExpo: gr.expo, uSat: gr.sat, uGamma: gr.gamma, uVig: gr.vig, uGrain: gr.grain, uFadeB: clamp(fb), uFadeW: clamp(fw),
    uCA: gr.ca, uLens: lens, uLeak: gr.leak, uBox: gr.box, uLift: gr.lift, uGain: gr.gain,
  });
  R.fs();
}

function renderAt(T, opt = {}) {
  if (!R) return;
  T = clamp(T, 0, DURATION);
  let tr = null; for (const x of TRANS) if (T >= x.at - x.dur / 2 && T < x.at + x.dur / 2) { tr = x; break; }
  let src, gr, fb, fw, lens;
  if (tr && tr.style === 'dissolve') {
    const A = sceneAt(tr.at - .001), B = sceneAt(tr.at + .001), k = ss(tr.at - tr.dur / 2, tr.at + tr.dur / 2, T);
    const sa = renderScene(A, T - A.t0, R.A), sb = renderScene(B, T - B.t0, R.B);
    R.target(R.M); R.blend(null); R.use(R.pMix, { uRes: [R.W, R.H], uA: { tex: R.A.t }, uB: { tex: R.B.t }, uK: k, uEdge: tr.edge }); R.fs();
    src = R.M; gr = lerpGrade(sa.grade, sb.grade, k); fb = lerp(sa.fadeB, sb.fadeB, k); fw = lerp(sa.fadeW, sb.fadeW, k); lens = lerp(sa.lens, sb.lens, k);
  } else {
    const sc = sceneAt(T), st = renderScene(sc, T - sc.t0, R.A);
    src = R.A; gr = st.grade; fb = st.fadeB; fw = st.fadeW; lens = st.lens;
    if (tr) { const a = T < tr.at ? ss(tr.at - tr.dur / 2, tr.at, T) : 1 - ss(tr.at, tr.at + tr.dur / 2, T); if (tr.style === 'black') fb = Math.max(fb, a); else fw = Math.max(fw, a); }
  }
  if (opt.poster) { gr = Object.assign({}, gr, { box: 0 }); fb = Math.max(fb, .25); }
  post(src, gr, fb, fw, lens, T);
  if (!opt.poster) updateText(T); else hideText();
}

// ---------------------------------------------------------------- text overlay
const subEls = SUBS.map(([t0, t1, who, text]) => { const d = document.createElement('div'); d.className = 'sub ' + who; d.textContent = text; $('subs').appendChild(d); return d; });
const cardEl = $('card'), titleEl = $('title'), creditEl = $('credit');
const fade = (T, t0, t1, a = .55, b = .7) => ss(t0, t0 + a, T) * (1 - ss(t1 - b, t1, T));
let lastCard = -1;
function setO(el, o) { const v = o < .003 ? 0 : o; if (el._o === v) return; el._o = v; el.style.opacity = v.toFixed(3); el.style.visibility = v ? 'visible' : 'hidden'; }
function updateText(T) {
  SUBS.forEach(([t0, t1], i) => { const o = fade(T, t0, t1); setO(subEls[i], o); if (o) subEls[i].style.transform = `translateY(calc(-50% + ${(1 - ss(t0, t0 + .8, T)) * 6}px))`; });
  let ci = -1, co = 0;
  CHAPTERS.forEach((c, i) => { const o = fade(T, c.t0, c.t1, 1, 1.1); if (o > co) { co = o; ci = i; } });
  if (ci !== lastCard && ci >= 0) { const c = CHAPTERS[ci]; cardEl.querySelector('.c-num').textContent = c.num; cardEl.querySelector('.c-title').textContent = c.title; cardEl.querySelector('.c-en').textContent = c.en; lastCard = ci; }
  setO(cardEl, co);
  if (ci >= 0) cardEl.style.setProperty('--sp', (1 - ss(CHAPTERS[ci].t0, CHAPTERS[ci].t0 + 3, T)).toFixed(3));
  let to = 0, end = false; for (const x of TITLES) { const o = fade(T, x.t0, x.t1, 1.6, 1.4); if (o > to) { to = o; end = !!x.end; } }
  setO(titleEl, to); titleEl.classList.toggle('end', end);
  if (to) titleEl.style.setProperty('--sp', (1 - ss(end ? 233.2 : 6.6, (end ? 233.2 : 6.6) + 5, T)).toFixed(3));
  setO(creditEl, fade(T, 235.2, 239.4, 1.2, 1.2));
}
function hideText() { subEls.forEach(e => setO(e, 0)); setO(cardEl, 0); setO(titleEl, 0); setO(creditEl, 0); }

// ---------------------------------------------------------------- clock + transport
// The picture runs on its own wall clock, eased toward the audio clock while audio is healthy.
// If the browser stalls the AudioContext (screen lock, call, headphones switching…), the
// picture keeps going and the music rejoins at the right spot once audio wakes up.
const clock = { playing: false, pos: 0, t0: 0, sync: false };
const AH = { lastCt: -1, lastWall: 0, ok: false, retry: 0 };
function now() { return clock.playing ? clock.pos + (performance.now() - clock.t0) / 1000 : clock.pos; }
function wakeAudio() { if (engine && engine.ctx.state !== 'running') engine.ctx.resume().catch(() => { }); }
function syncAudio() {
  if (!engine || !engine.ready || !clock.playing || !clock.sync) return;
  const c = engine.ctx, w = performance.now();
  if (c.state === 'running' && c.currentTime !== AH.lastCt) { AH.lastCt = c.currentTime; AH.lastWall = w; }
  if (c.state === 'running' && w - AH.lastWall < 500) {
    const T = now();
    if (!AH.ok || T >= DURATION) { if (T < DURATION) engine.startAt(T); AH.ok = true; }
    else { const d = engine.songTime() - T; if (Math.abs(d) > .4) engine.startAt(T); else clock.t0 -= d * 120; }
    engine.tick(document.hidden ? 3 : .7);
  } else {
    if (AH.ok) { AH.ok = false; engine.stopAll(); }
    if (w - AH.retry > 1000) { AH.retry = w; wakeAudio(); }
  }
}
function play() {
  if (clock.pos >= DURATION - .05) clock.pos = 0;
  clock.playing = true; clock.t0 = performance.now(); clock.sync = !!engine; AH.ok = false; AH.lastCt = -1;
  wakeAudio(); updateUI(); showPaused();
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
}
function pause() {
  clock.pos = now(); clock.playing = false; clock.sync = false; AH.ok = false;
  if (engine) { engine.stopAll(); engine.ctx.suspend().catch(() => { }); }
  updateUI(); showPaused();
}
function seek(t) {
  t = clamp(t, 0, DURATION); clock.pos = t; clock.t0 = performance.now();
  if (engine) { engine.prio = t; if (clock.playing && AH.ok) engine.startAt(t); }
  if (!clock.playing) { safeRender(t); showPaused(); }
  updateUI();
}
const pausedEl = $('paused');
function showPaused() {
  if (!started || TEST) { pausedEl.hidden = true; return; }
  const ended = !clock.playing && clock.pos >= DURATION - .05;
  pausedEl.hidden = clock.playing;
  pausedEl.querySelector('.p-label').textContent = ended ? '再看一次' : '已暂停 · 点按继续';
}
const fmt = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

// ---------------------------------------------------------------- UI wiring
const ui = $('ui'), track = $('track'), fill = track.querySelector('.track-fill'), knob = track.querySelector('.track-knob');
const marks = track.querySelector('.track-marks');
[{ at: 0, title: '序' }].concat(CHAPTERS.map(c => ({ at: c.at, title: c.num + ' · ' + c.title }))).forEach(c => {
  const m = document.createElement('button'); m.className = 'mark'; m.style.left = (c.at / DURATION * 100) + '%'; m.title = c.title; m.setAttribute('aria-label', '跳到 ' + c.title);
  m.addEventListener('click', ev => { ev.stopPropagation(); seek(c.at + .01); poke(); });
  const lab = document.createElement('span'); lab.textContent = c.title; m.appendChild(lab); marks.appendChild(m);
});
function updateUI() {
  const T = now();
  $('t-cur').textContent = fmt(T);
  const p = T / DURATION * 100; fill.style.width = p + '%'; knob.style.left = p + '%';
  track.setAttribute('aria-valuenow', Math.round(T)); track.setAttribute('aria-valuetext', fmt(T) + ' / 4:00');
  $('b-play').classList.toggle('is-playing', clock.playing); $('b-play').setAttribute('aria-label', clock.playing ? '暂停' : '播放');
}
let hideTimer = 0;
function poke() { ui.classList.remove('hide'); document.body.classList.remove('nocursor'); clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (clock.playing && !ui.matches(':hover') && !ui.querySelector(':focus-visible')) { ui.classList.add('hide'); document.body.classList.add('nocursor'); } }, 2600); }
window.addEventListener('pointermove', poke); window.addEventListener('pointerdown', poke);
$('b-play').addEventListener('click', () => { clock.playing ? pause() : play(); poke(); });
let tapRevealed = false;
$('stage-hit').addEventListener('pointerdown', () => { tapRevealed = ui.classList.contains('hide'); });
$('stage-hit').addEventListener('click', () => { if (!started) return; if (!tapRevealed) clock.playing ? pause() : play(); tapRevealed = false; poke(); });
$('p-btn').addEventListener('click', () => { play(); poke(); });
['pointerdown', 'keydown'].forEach(n => window.addEventListener(n, () => { if (clock.playing && !AH.ok) wakeAudio(); }));
let muted = false;
$('b-mute').addEventListener('click', () => { muted = !muted; if (engine) engine.setVolume(muted ? 0 : 1); $('b-mute').classList.toggle('is-muted', muted); $('b-mute').setAttribute('aria-label', muted ? '取消静音' : '静音'); poke(); });
$('b-full').addEventListener('click', () => { const d = document; if (d.fullscreenElement) d.exitFullscreen().catch(() => { }); else (d.documentElement.requestFullscreen ? d.documentElement.requestFullscreen() : Promise.reject()).catch(() => { }); poke(); });
let dragging = false;
const seekFromEvent = ev => { const r = track.getBoundingClientRect(); seek((ev.clientX - r.left) / r.width * DURATION); };
track.addEventListener('pointerdown', ev => { dragging = true; track.setPointerCapture(ev.pointerId); seekFromEvent(ev); });
track.addEventListener('pointermove', ev => { if (dragging) seekFromEvent(ev); });
track.addEventListener('pointerup', () => { dragging = false; });
track.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight') { seek(now() + 5); ev.preventDefault(); } if (ev.key === 'ArrowLeft') { seek(now() - 5); ev.preventDefault(); } });
window.addEventListener('keydown', ev => {
  if (!started || ev.target.closest && ev.target.closest('#track')) return;
  if (ev.key === ' ' || ev.key === 'k') { ev.preventDefault(); clock.playing ? pause() : play(); }
  else if (ev.key === 'ArrowRight') seek(now() + 5); else if (ev.key === 'ArrowLeft') seek(now() - 5);
  else if (ev.key === 'f') $('b-full').click(); else if (ev.key === 'm') $('b-mute').click();
  poke();
});
window.addEventListener('resize', () => { layout(); if (!clock.playing) safeRender(started ? now() : 205.5, { poster: !started }); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && clock.playing) wakeAudio(); });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); glLost = true; });
canvas.addEventListener('webglcontextrestored', () => {
  try { R = new Renderer(canvas, TEST); layout(); glLost = false; if (!clock.playing) safeRender(started ? now() : 205.5, { poster: !started }); }
  catch (e) { console.error(e); }
});

$('play-btn').addEventListener('click', async () => {
  if (started || !R) return;
  const btn = $('play-btn'), lab = btn.querySelector('span');
  btn.disabled = true; lab.textContent = '调音中…';
  try {
    engine = new Engine(buildScore());
    engine.ctx.resume().catch(() => { });
    try { const s = engine.ctx.createBufferSource(); s.buffer = engine.ctx.createBuffer(1, 1, engine.sr); s.connect(engine.ctx.destination); s.start(0); } catch (e) { }
    await engine.prepare(p => { lab.textContent = '调音中 ' + Math.round(p * 100) + '%'; }, 9);
  } catch (e) { console.warn('audio unavailable', e); engine = null; }
  started = true;
  document.body.classList.add('started');
  $('start').hidden = true;
  clock.pos = 0; play(); poke();
});

// ---------------------------------------------------------------- loop
let lastF = performance.now(), ema = 16, slowMs = 0, errCount = 0;
function safeRender(T, opt) { if (!R || glLost) return; try { renderAt(T, opt); } catch (err) { if (errCount++ < 5) console.error(err); } }
function frame() {
  requestAnimationFrame(frame);
  const t0 = performance.now(), dt = Math.min(250, t0 - lastF); lastF = t0;
  if (!started) return;
  syncAudio();
  let T = now();
  if (clock.playing && T >= DURATION) { clock.pos = DURATION; clock.playing = false; clock.sync = false; AH.ok = false; T = DURATION; ui.classList.remove('hide'); showPaused(); }
  safeRender(T);
  updateUI();
  ema = ema * .92 + dt * .08;
  if (clock.playing && ema > 40) slowMs += dt; else slowMs = Math.max(0, slowMs - dt);
  if (slowMs > 1500 && quality > .5) { quality = Math.max(.5, quality * (ema > 90 ? .72 : .86)); slowMs = 0; ema = 30; layout(); }
}
setInterval(syncAudio, 60);
if (QS.has('debug')) window.__sm = { get engine() { return engine; }, now, get quality() { return quality; } };

layout();
if (R) {
  if (TEST) {
    started = true; $('start').hidden = true; ui.hidden = true;
    window.__render = (t, poster) => { renderAt(t, { poster }); return true; };
    window.__audio = { Engine, buildScore };
    const t = parseFloat(QS.get('t') || '0'); clock.pos = t; renderAt(t);
  } else {
    safeRender(205.5, { poster: true });
    requestAnimationFrame(frame);
  }
}
updateUI();
