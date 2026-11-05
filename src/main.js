// 启动、播放器与导出接口
window.SM = window.SM || {};
(async function () {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const EXPORT = params.has('export');
  const canvas = $('#stage');
  const DUR = SM.Music.DURATION;

  async function loadFonts() {
    const F = SM.FONT_DATA;
    if (!F || !window.FontFace) return;
    const defs = [['SMSerif', F.serifSC, { weight: '600' }], ['SMSerif', F.serifSCLight, { weight: '400' }], ['SMLatin', F.latin, { style: 'italic', weight: '500' }]];
    await Promise.all(defs.map(async ([fam, b64, desc]) => {
      try {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const face = new FontFace(fam, bin.buffer, desc);
        await face.load();
        document.fonts.add(face);
      } catch (e) { console.warn('font', fam, e); }
    }));
  }
  await loadFonts();

  if (EXPORT) {
    canvas.width = +(params.get('w') || 1920);
    canvas.height = +(params.get('h') || 1080);
  } else {
    fit();
  }
  let eng, dir;
  try {
    eng = new SM.Engine(canvas);
    dir = new SM.Director(eng);
  } catch (e) {
    console.error(e);
    const st = $('#status');
    if (st) st.textContent = '无法初始化 WebGL2：' + e.message;
    window.SMX_ERROR = String(e && e.stack || e);
    return;
  }

  if (EXPORT) {
    let wav = null;
    window.SMX = {
      frame(t, q) { dir.render(t); return canvas.toDataURL('image/jpeg', q || 0.94); },
      async prepareAudio() { const buf = await SM.Music.render(); wav = new Uint8Array(SM.Music.toWav(buf)); return wav.length; },
      audioChunk(i, size) {
        const sub = wav.subarray(i * size, Math.min(wav.length, (i + 1) * size));
        let s = '';
        for (let k = 0; k < sub.length; k += 0x8000) s += String.fromCharCode.apply(null, sub.subarray(k, k + 0x8000));
        return btoa(s);
      },
    };
    window.SMX_READY = true;
    return;
  }

  // ---------------- 播放器 ----------------
  const ui = {
    overlay: $('#overlay'), play: $('#play'), status: $('#status'), bar: $('#bar'), fill: $('#fill'), time: $('#time'),
    toggle: $('#toggle'), full: $('#full'), controls: $('#controls'), wrap: $('#wrap'),
  };
  let buf = null, actx = null, src = null, playing = false, offset = 0, startAt = 0, ended = false;
  const now = () => (playing ? (actx ? actx.currentTime - startAt : performance.now() / 1000 - startAt) : offset);
  const fmt = (t) => { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };

  function fit() {
    const W = window.innerWidth, H = window.innerHeight;
    let cw = W, ch = (W * 9) / 16;
    if (ch > H) { ch = H; cw = (H * 16) / 9; }
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const q = params.get('q');
    const maxH = q === '720' ? 720 : q === '540' ? 540 : 1080;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ih = Math.min(maxH, Math.round(ch * dpr));
    const iw = Math.round((ih * 16) / 9);
    if (canvas.width !== iw || canvas.height !== ih) {
      canvas.width = iw; canvas.height = ih;
      if (dir) dir.resize(iw, ih);
    }
  }
  window.addEventListener('resize', fit);

  function startAudio() {
    if (!buf) { startAt = performance.now() / 1000 - offset; return; }
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    actx.resume();
    src = actx.createBufferSource();
    src.buffer = buf;
    src.connect(actx.destination);
    startAt = actx.currentTime - offset;
    src.start(0, Math.min(offset, DUR - 0.01));
  }
  function play() {
    if (playing) return;
    if (ended || offset >= DUR - 0.05) { offset = 0; ended = false; }
    startAudio();
    playing = true;
    ui.overlay.classList.add('hidden');
    ui.toggle.textContent = '❚❚';
    ui.toggle.setAttribute('aria-label', '暂停');
  }
  function pause() {
    if (!playing) return;
    offset = now();
    if (src) { try { src.stop(); } catch (e) {} src = null; }
    playing = false;
    ui.toggle.textContent = '▶';
    ui.toggle.setAttribute('aria-label', '播放');
  }
  function seek(t) {
    const was = playing;
    pause();
    offset = Math.max(0, Math.min(DUR, t));
    ended = false;
    if (was) play();
  }
  ui.play.addEventListener('click', play);
  ui.toggle.addEventListener('click', () => (playing ? pause() : play()));
  ui.full.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else ui.wrap.requestFullscreen && ui.wrap.requestFullscreen();
  });
  const seekFromEvent = (e) => {
    const r = ui.bar.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * DUR);
  };
  let dragging = false;
  ui.bar.addEventListener('pointerdown', (e) => { dragging = true; ui.bar.setPointerCapture(e.pointerId); seekFromEvent(e); });
  ui.bar.addEventListener('pointermove', (e) => { if (dragging) seekFromEvent(e); });
  ui.bar.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    else if (e.code === 'ArrowRight') seek(now() + 5);
    else if (e.code === 'ArrowLeft') seek(now() - 5);
    else if (e.code === 'KeyF') ui.full.click();
  });
  let idle;
  const wake = () => { ui.controls.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => playing && ui.controls.classList.add('idle'), 2200); };
  window.addEventListener('pointermove', wake);

  ui.status.textContent = '正在谱写配乐…';
  ui.play.disabled = true;
  try {
    buf = await SM.Music.render();
    ui.status.textContent = '建议戴上耳机 · 全屏观看（F）';
  } catch (e) {
    console.warn(e);
    ui.status.textContent = '音频不可用，将静音播放';
  }
  ui.play.disabled = false;

  let preview = 8.2;
  function loop() {
    let t = now();
    if (playing && t >= DUR) { pause(); offset = DUR; ended = true; t = DUR; ui.overlay.classList.remove('hidden'); ui.play.textContent = '↻ 重新播放'; }
    dir.render(playing || offset > 0 ? t : preview);
    ui.fill.style.width = (t / DUR) * 100 + '%';
    ui.time.textContent = fmt(t) + ' / ' + fmt(DUR);
    requestAnimationFrame(loop);
  }
  loop();
})();
