// 原创配乐：乐谱 + Web Audio 合成（OfflineAudioContext 离线渲染，保证与画面逐帧同步）
// 80 BPM，4/4 拍，每小节 3 秒，共 41 小节 = 123 秒。
window.SM = window.SM || {};
(function () {
  const U = SM.U;
  const BPM = 80, BEAT = 60 / BPM, BAR = BEAT * 4, DURATION = 123, SR = 44100;
  const events = [];
  const at = (bar, beat = 0) => bar * BAR + beat * BEAT;
  const E = (i, bar, beat, m, d, v = 0.6, x) => events.push(Object.assign({ i, t: at(bar, beat), m, d: d * BEAT, v }, x || {}));

  // 和弦：b = 低音，n = 上方声部
  const C = {
    Dmaj7: { b: 38, n: [62, 66, 69, 73] }, Bm7: { b: 47, n: [59, 62, 66, 69] }, Gmaj7: { b: 43, n: [55, 59, 62, 66] },
    Asus4: { b: 45, n: [57, 62, 64, 69] }, A: { b: 45, n: [57, 61, 64, 69] }, D: { b: 38, n: [57, 62, 66, 69] },
    AC: { b: 37, n: [57, 61, 64, 69] }, Bm: { b: 47, n: [59, 62, 66, 71] }, FmA: { b: 45, n: [57, 61, 66, 69] },
    G: { b: 43, n: [55, 59, 62, 67] }, DF: { b: 42, n: [57, 62, 66, 69] }, Em7: { b: 40, n: [55, 59, 62, 64] },
    A7: { b: 45, n: [57, 61, 64, 67] }, Fm: { b: 42, n: [57, 61, 66, 69] }, Fs: { b: 42, n: [58, 61, 66, 70] },
    Em: { b: 40, n: [55, 59, 64, 67] }, Dmaj9: { b: 38, n: [62, 66, 69, 73, 76] },
  };
  const PROG = [
    'Dmaj7', 'Bm7', 'Gmaj7', 'Asus4',
    'D', 'AC', 'Bm', 'FmA', 'G', 'DF', 'Em7', 'A7',
    'G', 'A', 'Fm', 'Bm', 'G', 'A',
    'Bm', 'G', 'D', 'A', 'Bm', 'Em', 'G', 'Fs',
    'Bm', 'G', 'Em', 'Fs', 'G', 'A',
    'D', 'AC', 'Bm', 'FmA', 'G', 'DF', 'Em7',
    'Dmaj9', 'Dmaj9',
  ];
  const chordAt = (bar, beat = 0) => {
    if (bar === 3 && beat >= 2) return C.A;
    if (bar === 31 && beat >= 2) return C.A;
    if (bar === 38 && beat >= 2) return C.A7;
    return C[PROG[bar]];
  };

  // 主题（童年 / 重逢）
  const THEME = [
    [[0, 78, 1], [1, 76, 0.5], [1.5, 74, 0.5], [2, 76, 1], [3, 69, 1]],
    [[0, 76, 1], [1, 78, 0.5], [1.5, 76, 0.5], [2, 73, 2]],
    [[0, 74, 1], [1, 73, 0.5], [1.5, 71, 0.5], [2, 73, 1], [3, 66, 1]],
    [[0, 69, 1.5], [1.5, 71, 0.5], [2, 73, 2]],
    [[0, 71, 1], [1, 74, 1], [2, 79, 1], [3, 78, 0.5], [3.5, 76, 0.5]],
    [[0, 78, 1.5], [1.5, 81, 0.5], [2, 78, 1], [3, 74, 1]],
    [[0, 76, 1], [1, 79, 1], [2, 78, 0.5], [2.5, 76, 0.5], [3, 74, 1]],
    [[0, 76, 1.5], [1.5, 74, 0.5], [2, 73, 2]],
  ];
  const BAND = [
    [[0, 74, 0.5], [0.5, 76, 0.5], [1, 78, 0.5], [1.5, 79, 1], [2.5, 78, 0.5], [3, 76, 0.5], [3.5, 74, 0.5]],
    [[0, 76, 0.5], [0.5, 78, 0.5], [1, 81, 1], [2, 81, 0.5], [2.5, 83, 0.5], [3, 81, 1]],
    [[0, 81, 0.5], [0.5, 79, 0.5], [1, 78, 1], [2, 73, 0.5], [2.5, 78, 0.5], [3, 76, 1]],
    [[0, 74, 1.5], [1.5, 73, 0.5], [2, 74, 0.5], [2.5, 78, 0.5], [3, 83, 1]],
    [[0, 83, 0.5], [0.5, 81, 0.5], [1, 79, 0.5], [1.5, 78, 0.5], [2, 79, 1], [3, 74, 1]],
    [[0, 76, 1], [1, 78, 0.5], [1.5, 79, 0.5], [2, 81, 2]],
  ];
  const RAIN = [
    [[0, 78, 2], [2, 74, 1], [3, 71, 1]],
    [[0, 71, 1], [1, 74, 1], [2, 79, 1.5], [3.5, 78, 0.5]],
    [[0, 78, 2], [2, 76, 1], [3, 74, 1]],
    [[0, 73, 1.5], [1.5, 74, 0.5], [2, 76, 2]],
    [[0, 74, 1], [1, 71, 1], [2, 78, 2]],
    [[0, 79, 1.5], [1.5, 78, 0.5], [2, 76, 1], [3, 71, 1]],
    [[0, 74, 1], [1, 76, 0.5], [1.5, 74, 0.5], [2, 71, 2]],
    [[0, 70, 2], [2, 73, 1], [3, 78, 1]],
  ];
  const MASQ = [
    [[0, 78, 1], [1, 83, 1], [2, 81, 0.5], [2.5, 79, 0.5], [3, 78, 1]],
    [[0, 79, 1], [1, 74, 1], [2, 76, 0.5], [2.5, 78, 0.5], [3, 79, 1]],
    [[0, 76, 1], [1, 83, 1.5], [2.5, 81, 0.5], [3, 79, 1]],
    [[0, 78, 1.5], [1.5, 76, 0.5], [2, 73, 1], [3, 70, 1]],
    [[0, 71, 1], [1, 74, 1], [2, 79, 1], [3, 83, 1]],
    [[0, 76, 1], [1, 78, 0.5], [1.5, 79, 0.5], [2, 81, 2]],
  ];
  const mel = (inst, bar0, phrase, v, tr = 0, extra) => phrase.forEach((bar, k) => bar.forEach(([b, m, d]) => E(inst, bar0 + k, b, m + tr, d, v, extra)));

  function build() {
    // ---- 序章 0–3 ----
    for (let b = 0; b < 4; b++) {
      const ch = C[PROG[b]];
      ch.n.forEach((m) => E('pad', b, 0, m, 4.2, 0.30));
      if (b >= 1) {
        const pat = [0, 1, 2, 3, 2, 1, 2, 3];
        for (let k = 0; k < 8; k++) {
          const c2 = chordAt(b, k * 0.5);
          E('mbox', b, k * 0.5, c2.n[pat[k] % c2.n.length] + 12, 0.5, 0.22 + (k % 4 === 0 ? 0.08 : 0));
        }
      } else {
        E('mbox', 0, 2, 85, 1, 0.18); E('mbox', 0, 3, 81, 1, 0.16); E('mbox', 0, 3.5, 78, 1, 0.14);
      }
    }
    E('swell', 1, 2, 0, 2, 0.5);
    E('boom', 2, 0, 38, 4, 0.8);
    E('bell', 2, 0, 74, 6, 0.45);
    E('bell', 2, 0, 81, 6, 0.25);
    E('bass', 2, 0, 38, 4, 0.35); E('bass', 3, 0, 45, 4, 0.35);

    // ---- 童年 4–11 ----
    mel('mbox', 4, THEME, 0.52);
    for (let b = 4; b < 12; b++) {
      const ch = chordAt(b);
      const pat = [ch.b + 12, ch.n[0], ch.n[1], ch.n[2], ch.n[3], ch.n[2], ch.n[1], ch.n[2]];
      pat.forEach((m, k) => E('piano', b, k * 0.5, m, k === 0 ? 2 : 0.6, k === 0 ? 0.32 : 0.2));
      ch.n.slice(0, 3).forEach((m) => E('pad', b, 0, m, 4.1, 0.16));
    }
    E('swell', 11, 2, 0, 2, 0.4);
    [[5, 1], [6, 2.5], [7, 0.5], [9, 3]].forEach(([b, bt]) => E('bird', b, bt, 0, 1, 0.35));
    [[8, 0, 86], [8, 0.25, 90], [8, 0.5, 93], [9, 2, 86], [9, 2.25, 88], [9, 2.5, 93], [9, 2.75, 97]].forEach(([b, bt, m]) => E('mbox', b, bt + 0.33, m, 1, 0.16));

    // ---- CRYCHIC 12–17 ----
    mel('piano', 12, BAND, 0.58);
    for (let b = 12; b < 18; b++) {
      const ch = chordAt(b);
      const gv = [ch.b + 12, ch.n[0], ch.n[1], ch.n[2], ch.n[3]];
      const pat = [0, 1, 2, 3, 4, 3, 2, 1];
      const stop = b === 17;
      for (let k = 0; k < 8; k++) {
        if (stop && k >= 4) break;
        E('guitar', b, k * 0.5, gv[pat[k]], 1.2, k % 2 ? 0.30 : 0.40);
      }
      E('piano', b, 0, ch.b + 12, 2, 0.30);
      E('piano', b, 0, ch.b, 2, 0.22);
      for (let k = 0; k < (stop ? 2 : 4); k++) E('bass', b, k, ch.b, 0.9, 0.5);
      ch.n.forEach((m) => E('pad', b, 0, m, stop ? 6 : 4.1, stop ? 0.22 : 0.14));
      if (!stop) {
        E('kick', b, 0, 0, 1, 0.85); E('kick', b, 1.5, 0, 1, 0.5); E('kick', b, 2, 0, 1, 0.8);
        E('snare', b, 1, 0, 1, 0.55); E('snare', b, 3, 0, 1, 0.6);
        for (let k = 0; k < 8; k++) E('hat', b, k * 0.5, 0, 1, k % 2 ? 0.22 : 0.38);
        if (b === 16) { E('snare', b, 3.5, 0, 1, 0.35); E('snare', b, 3.75, 0, 1, 0.45); }
      } else {
        E('kick', b, 0, 0, 1, 0.85); E('crash', b, 0, 0, 1, 0.5); E('snare', b, 1, 0, 1, 0.5);
      }
    }
    E('crash', 12, 0, 0, 1, 0.45);
    E('swell', 11, 2, 0, 2, 0.35);

    // ---- 雨夜 18–25 ----
    mel('piano', 18, RAIN, 0.40);
    for (let b = 18; b < 26; b++) {
      const ch = chordAt(b);
      [ch.b + 12, ch.n[0], ch.n[1]].forEach((m, k) => E('piano', b, k * 0.12, m, 3.6, 0.16));
      E('strings', b, 0, ch.b + 12, 4.1, 0.30);
      E('strings', b, 0, ch.n[1], 4.1, 0.16);
      if (b >= 22) E('guitar', b, 2, ch.n[3] + 12, 3, 0.26);
    }
    E('thunder', 18, 1, 0, 4, 0.5);
    E('thunder', 22, 0.5, 0, 4, 0.3);

    // ---- 假面舞台 26–31 ----
    mel('choir', 26, MASQ, 0.5);
    for (let b = 26; b < 32; b++) {
      const ch = chordAt(b);
      ch.n.forEach((m) => E('organ', b, 0, m, b === 31 ? 2 : 4, 0.26));
      if (b === 31) C.A.n.forEach((m) => E('organ', b, 2, m, 2.2, 0.26));
      const arr = [ch.n[0], ch.n[1], ch.n[2], ch.n[3], ch.n[0] + 12, ch.n[1] + 12];
      const pat = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3];
      for (let k = 0; k < 12; k++) {
        const c2 = chordAt(b, k / 3);
        const a2 = [c2.n[0], c2.n[1], c2.n[2], c2.n[3], c2.n[0] + 12, c2.n[1] + 12];
        E('harpsi', b, k / 3, a2[pat[k]], 0.5, k % 3 === 0 ? 0.36 : 0.26);
      }
      E('bell', b, 0, 52 + ((((ch.b - 52) % 12) + 12) % 12), 6, 0.42);
      E('kick', b, 0, 0, 1, 0.7); E('kick', b, 0.3, 0, 1, 0.45);
      E('kick', b, 2, 0, 1, 0.6); E('kick', b, 2.3, 0, 1, 0.38);
      E('strings', b, 0, ch.b, 4.1, 0.26);
    }
    E('swell', 25, 2, 0, 2, 0.35);
    E('swell', 31, 1, 0, 3, 0.6);

    // ---- 重逢 32–38 ----
    const REUNION = THEME.slice(0, 6).concat([[[0, 76, 1], [1, 79, 0.5], [1.5, 78, 0.5], [2, 76, 1], [3, 73, 1]]]);
    mel('piano', 32, REUNION, 0.6);
    mel('mbox', 32, REUNION, 0.24, 12);
    E('boom', 32, 0, 38, 4, 0.7);
    E('crash', 32, 0, 0, 1, 0.45);
    for (let b = 32; b < 39; b++) {
      for (let h = 0; h < 2; h++) {
        const ch = chordAt(b, h * 2);
        ch.n.forEach((m) => E('strings', b, h * 2, m, 2.1, 0.24));
        E('strings', b, h * 2, ch.b + 12, 2.1, 0.22);
        E('bass', b, h * 2, ch.b, 1.9, 0.48);
        if (b >= 33) {
          const gv = [ch.b + 12, ch.n[0], ch.n[1], ch.n[2], ch.n[3]];
          [0, 1, 2, 3].forEach((k) => E('guitar', b, h * 2 + k * 0.5, gv[[0, 2, 3, 4][k]], 1.2, k ? 0.26 : 0.34));
        }
      }
      if (b >= 34) {
        E('kick', b, 0, 0, 1, 0.65); E('kick', b, 2, 0, 1, 0.6);
        E('snare', b, 1, 0, 1, 0.34); E('snare', b, 3, 0, 1, 0.38);
        for (let k = 0; k < 8; k++) E('hat', b, k * 0.5, 0, 1, k % 2 ? 0.14 : 0.24);
      }
    }
    E('swell', 35, 2, 0, 2, 0.45);
    E('crash', 36, 0, 0, 1, 0.5);

    // ---- 终章 39–40 ----
    C.Dmaj9.n.forEach((m) => E('pad', 39, 0, m, 8, 0.26));
    E('strings', 39, 0, 50, 8, 0.22);
    E('bass', 39, 0, 38, 7, 0.4);
    E('piano', 39, 0, 74, 6, 0.5); E('piano', 39, 0, 62, 6, 0.3); E('piano', 39, 0, 50, 6, 0.3);
    [[0, 86], [0.5, 81], [1, 78], [1.5, 74], [2.5, 81], [3.5, 85], [5, 88], [6.5, 93]].forEach(([bt, m], k) => E('mbox', 39, bt, m, 2, 0.24 - k * 0.015));
    E('bell', 39, 0, 74, 8, 0.32);
    E('bell', 40, 0, 86, 8, 0.18);
    E('rainAmb', 0, 0, 0, 0, 0); // 占位：环境雨声由 ambience() 统一安排
    events.sort((a, b) => a.t - b.t);
  }
  build();

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- 合成器 ----------
  function Synth(ctx) {
    this.ctx = ctx;
    this.rnd = U.mulberry32(20240613);
    const rnd = this.rnd;
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, 0);
    this.master.gain.linearRampToValueAtTime(0.9, 0.6);
    this.master.gain.setValueAtTime(0.9, DURATION - 3.2);
    this.master.gain.linearRampToValueAtTime(0.0, DURATION - 0.1);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.25;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.7;
    this.master.connect(hp); hp.connect(comp);
    comp.connect(ctx.destination);
    this.verb = ctx.createConvolver();
    this.verb.buffer = makeIR(ctx, 3.6, rnd);
    const vo = ctx.createGain();
    vo.gain.value = 0.8;
    this.verb.connect(vo);
    vo.connect(this.master);
    this.bus = {};
    const def = {
      piano: [0.62, 0.30, 0], mbox: [0.34, 0.55, -0.25], guitar: [0.46, 0.26, 0.28], bass: [0.62, 0.04, 0], pad: [0.22, 0.55, 0],
      strings: [0.24, 0.5, 0.05], organ: [0.17, 0.6, 0], harpsi: [0.26, 0.35, -0.22], bell: [0.32, 0.7, 0.1], choir: [0.22, 0.6, 0],
      kick: [0.75, 0.05, 0], snare: [0.30, 0.22, 0.05], hat: [0.10, 0.12, 0.25], sfx: [0.32, 0.45, 0], rain: [0.15, 0.12, 0],
    };
    for (const k in def) {
      const [g, send, pan] = def[k];
      const gn = ctx.createGain(); gn.gain.value = g;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      gn.connect(p); p.connect(this.master);
      const s = ctx.createGain(); s.gain.value = send;
      p.connect(s); s.connect(this.verb);
      this.bus[k] = gn;
    }
    this.noise = makeNoise(ctx, 3.0, rnd);
    const h = [0, 1, 0.55, 0.30, 0.18, 0.10, 0.06, 0.04, 0.025];
    this.pianoWave = ctx.createPeriodicWave(new Float32Array(h.length), new Float32Array(h));
    const o = [0, 1, 0.8, 0.5, 0.55, 0, 0.3, 0, 0.25];
    this.organWave = ctx.createPeriodicWave(new Float32Array(o.length), new Float32Array(o));
    this.ks = new Map();
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 5.2; this.lfo.start(0);
  }
  function makeIR(ctx, sec, rnd) {
    const n = Math.floor(SR * sec), b = ctx.createBuffer(2, n, SR);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        lp += ((rnd() * 2 - 1) - lp) * (0.55 - 0.35 * (t / sec));
        d[i] = lp * Math.pow(1 - t / sec, 2.2) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    return b;
  }
  function makeNoise(ctx, sec, rnd) {
    const n = Math.floor(SR * sec), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
    return b;
  }
  Synth.prototype.env = function (g, t, a, peak, tau, rel, end) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(0, t + a, tau);
    if (end != null) g.gain.setTargetAtTime(0, end, rel);
  };
  Synth.prototype.osc = function (type, f, t, stop, wave) {
    const o = this.ctx.createOscillator();
    if (wave) o.setPeriodicWave(wave); else o.type = type;
    o.frequency.value = f;
    o.start(t); o.stop(stop);
    return o;
  };
  Synth.prototype.noiseSrc = function (t, stop) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    s.start(t, this.rnd() * 2); s.stop(stop);
    return s;
  };
  Synth.prototype.ksBuf = function (m, bright, decay) {
    const key = m + ':' + bright + ':' + decay;
    if (this.ks.has(key)) return this.ks.get(key);
    const f = mtof(m), N = SR / f - 0.5;
    const D = Math.floor(N), fr = N - D;
    const len = Math.floor(SR * 3.2), y = new Float32Array(len);
    let lp = 0;
    for (let i = 0; i <= D + 1; i++) { lp += ((this.rnd() * 2 - 1) - lp) * bright; y[i] = lp; }
    let mean = 0; for (let i = 0; i <= D + 1; i++) mean += y[i]; mean /= D + 2;
    for (let i = 0; i <= D + 1; i++) y[i] -= mean;
    const dec = decay - (m - 40) * 0.00006;
    for (let i = D + 2; i < len; i++) {
      const a = 0.5 * (y[i - D] + y[i - D - 1]), b = 0.5 * (y[i - D - 1] + y[i - D - 2 >= 0 ? i - D - 2 : 0]);
      y[i] = dec * ((1 - fr) * a + fr * b);
    }
    let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(y[i]));
    for (let i = 0; i < len; i++) y[i] /= pk || 1;
    const buf = this.ctx.createBuffer(1, len, SR);
    buf.getChannelData(0).set(y);
    this.ks.set(key, buf);
    return buf;
  };
  Synth.prototype.play = function (e) {
    const ctx = this.ctx, t = e.t, v = e.v, f = mtof(e.m), end = t + e.d;
    const B = this.bus;
    switch (e.i) {
      case 'piano': {
        const dec = Math.max(0.5, 2.6 - (e.m - 48) * 0.04);
        const o = this.osc(null, f, t, end + 1.2, this.pianoWave);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
        lp.frequency.setValueAtTime(Math.min(16000, f * (5 + 7 * v) + 900), t);
        lp.frequency.setTargetAtTime(f * 2.2 + 400, t + 0.01, dec * 0.4);
        const g = ctx.createGain();
        this.env(g, t, 0.004, v, dec * 0.45, 0.14, end);
        o.connect(lp); lp.connect(g); g.connect(B.piano);
        const o2 = this.osc('sine', f * 2.003, t, t + 1.0);
        const g2 = ctx.createGain(); this.env(g2, t, 0.003, v * 0.18, 0.22);
        o2.connect(g2); g2.connect(B.piano);
        break;
      }
      case 'mbox': {
        for (const [mul, amp, tau] of [[1, 1, 0.9], [2.0, 0.16, 0.35], [3.0, 0.07, 0.18], [5.4, 0.035, 0.07]]) {
          const o = this.osc('sine', f * mul, t, t + tau * 6 + 0.1);
          const g = ctx.createGain(); this.env(g, t, 0.002, v * amp, tau);
          o.connect(g); g.connect(B.mbox);
        }
        break;
      }
      case 'guitar': case 'harpsi': {
        const harp = e.i === 'harpsi';
        const s = ctx.createBufferSource();
        s.buffer = this.ksBuf(e.m, harp ? 0.85 : 0.45, harp ? 0.9955 : 0.9975);
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, t);
        g.gain.setTargetAtTime(0, end, harp ? 0.12 : 0.25);
        const fl = ctx.createBiquadFilter();
        fl.type = harp ? 'highpass' : 'lowpass';
        fl.frequency.value = harp ? 260 : 4200;
        s.connect(fl); fl.connect(g); g.connect(harp ? B.harpsi : B.guitar);
        s.start(t); s.stop(Math.min(t + 3.1, end + 1.2));
        break;
      }
      case 'bass': {
        const o = this.osc('sine', f, t, end + 0.6), o2 = this.osc('triangle', f, t, end + 0.6);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012);
        g.gain.setTargetAtTime(v * 0.6, t + 0.012, 0.25); g.gain.setTargetAtTime(0, end, 0.08);
        const g2 = ctx.createGain(); g2.gain.value = 0.35;
        o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(B.bass);
        break;
      }
      case 'pad': case 'strings': {
        const str = e.i === 'strings';
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.value = str ? 1500 + f * 1.5 : 1100 + f; lp.Q.value = 0.7;
        const g = ctx.createGain();
        const atk = str ? 0.5 : 1.1;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + atk);
        g.gain.setValueAtTime(v, Math.max(t + atk, end - 0.05)); g.gain.setTargetAtTime(0, end, str ? 0.35 : 0.6);
        for (const dt of [-7, 0, 7]) {
          const o = this.osc('sawtooth', f, t, end + 3);
          o.detune.value = dt + (this.rnd() - 0.5) * 4;
          if (str) { const lg = ctx.createGain(); lg.gain.value = 5; this.lfo.connect(lg); lg.connect(o.detune); }
          o.connect(lp);
        }
        lp.connect(g); g.connect(str ? B.strings : B.pad);
        break;
      }
      case 'organ': {
        const o = this.osc(null, f, t, end + 1, this.organWave);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.06);
        g.gain.setValueAtTime(v, Math.max(t + 0.06, end - 0.02)); g.gain.setTargetAtTime(0, end, 0.18);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        o.connect(lp); lp.connect(g); g.connect(B.organ);
        break;
      }
      case 'choir': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.18);
        g.gain.setValueAtTime(v, Math.max(t + 0.18, end - 0.02)); g.gain.setTargetAtTime(0, end, 0.28);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 3;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 4;
        const f3 = ctx.createBiquadFilter(); f3.type = 'lowpass'; f3.frequency.value = 2400;
        const lg = ctx.createGain(); lg.gain.value = 9; this.lfo.connect(lg);
        for (const dt of [-6, 6]) {
          const o = this.osc('sawtooth', f, t, end + 1.5);
          o.detune.value = dt; lg.connect(o.detune);
          o.connect(f1); o.connect(f2); o.connect(f3);
        }
        const m1 = ctx.createGain(); m1.gain.value = 1.6;
        const m2 = ctx.createGain(); m2.gain.value = 1.0;
        const m3 = ctx.createGain(); m3.gain.value = 0.12;
        f1.connect(m1); f2.connect(m2); f3.connect(m3);
        m1.connect(g); m2.connect(g); m3.connect(g); g.connect(B.choir);
        break;
      }
      case 'bell': {
        const parts = [[0.5, 0.5, 4.0], [1, 1, 2.8], [1.183, 0.45, 2.0], [1.506, 0.35, 1.6], [2, 0.4, 1.2], [2.514, 0.25, 0.9], [2.662, 0.2, 0.8], [3.011, 0.15, 0.6], [4.166, 0.1, 0.4]];
        for (const [mul, amp, tau] of parts) {
          const o = this.osc('sine', f * mul, t, t + tau * 5);
          const g = ctx.createGain(); this.env(g, t, 0.003, v * amp * 0.5, tau);
          o.connect(g); g.connect(B.bell);
        }
        break;
      }
      case 'kick': {
        const o = this.osc('sine', 140, t, t + 0.6);
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
        const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t + 0.02, 0.12);
        o.connect(g); g.connect(B.kick);
        break;
      }
      case 'snare': {
        const n = this.noiseSrc(t, t + 0.4);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
        const g = ctx.createGain(); this.env(g, t, 0.002, v, 0.06);
        n.connect(bp); bp.connect(g); g.connect(B.snare);
        const o = this.osc('triangle', 190, t, t + 0.3);
        const g2 = ctx.createGain(); this.env(g2, t, 0.002, v * 0.5, 0.04);
        o.connect(g2); g2.connect(B.snare);
        break;
      }
      case 'hat': {
        const n = this.noiseSrc(t, t + 0.15);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
        const g = ctx.createGain(); this.env(g, t, 0.001, v, 0.018);
        n.connect(hp); hp.connect(g); g.connect(B.hat);
        break;
      }
      case 'crash': {
        const n = this.noiseSrc(t, t + 4);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
        const g = ctx.createGain(); this.env(g, t, 0.002, v * 0.5, 0.9);
        n.connect(hp); hp.connect(g); g.connect(B.hat);
        break;
      }
      case 'swell': {
        const n = this.noiseSrc(t, end + 0.05);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(7000, end);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, end - 0.02); g.gain.linearRampToValueAtTime(0, end + 0.04);
        n.connect(bp); bp.connect(g); g.connect(B.sfx);
        break;
      }
      case 'boom': {
        const o = this.osc('sine', 60, t, t + 4);
        o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(34, t + 2.5);
        const g = ctx.createGain(); this.env(g, t, 0.02, v, 0.9);
        o.connect(g); g.connect(B.kick);
        const n = this.noiseSrc(t, t + 3);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        const g2 = ctx.createGain(); this.env(g2, t, 0.01, v * 0.5, 0.5);
        n.connect(lp); lp.connect(g2); g2.connect(B.sfx);
        break;
      }
      case 'thunder': {
        const n = this.noiseSrc(t, t + 6);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.4); g.gain.setTargetAtTime(v * 0.4, t + 0.5, 0.4);
        g.gain.linearRampToValueAtTime(v * 0.7, t + 1.3); g.gain.setTargetAtTime(0, t + 1.4, 1.1);
        n.connect(lp); lp.connect(g); g.connect(B.sfx);
        break;
      }
      case 'bird': {
        for (let k = 0; k < 4; k++) {
          const tt = t + k * 0.11 + this.rnd() * 0.03;
          const o = this.osc('sine', 3400, tt, tt + 0.1);
          o.frequency.setValueAtTime(3200 + this.rnd() * 600, tt);
          o.frequency.exponentialRampToValueAtTime(4600 + this.rnd() * 800, tt + 0.05);
          o.frequency.exponentialRampToValueAtTime(3600, tt + 0.08);
          const g = ctx.createGain(); this.env(g, tt, 0.005, v * 0.25, 0.025);
          o.connect(g); g.connect(B.sfx);
        }
        break;
      }
    }
  };
  // 环境雨声：雨夜 53–79 秒，重逢开头 95–100 秒的余雨
  Synth.prototype.ambience = function () {
    const ctx = this.ctx;
    const n = this.noiseSrc(52, 101);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 52); g.gain.linearRampToValueAtTime(1, 55); g.gain.setValueAtTime(1, 76);
    g.gain.linearRampToValueAtTime(0, 79.5); g.gain.setValueAtTime(0, 95.5); g.gain.linearRampToValueAtTime(0.35, 96.5); g.gain.linearRampToValueAtTime(0, 100.5);
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.bus.rain);
    const n2 = this.noiseSrc(52, 80);
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 380;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, 52); g2.gain.linearRampToValueAtTime(0.6, 56); g2.gain.setValueAtTime(0.6, 76); g2.gain.linearRampToValueAtTime(0, 79.5);
    n2.connect(lp2); lp2.connect(g2); g2.connect(this.bus.rain);
  };

  async function render() {
    const ctx = new OfflineAudioContext(2, SR * DURATION, SR);
    const syn = new Synth(ctx);
    for (const e of events) if (e.i !== 'rainAmb') syn.play(e);
    syn.ambience();
    const buf = await ctx.startRendering();
    let pk = 0;
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }
    const k = pk > 0 ? 0.89 / pk : 1;
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
    return buf;
  }
  function toWav(buf) {
    const n = buf.length, ch = buf.numberOfChannels;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, SR, true); out.setUint32(28, SR * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    ws(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); o += 2; }
    return out.buffer;
  }

  // ---------- 画面同步用查询 ----------
  const byInst = {};
  for (const e of events) (byInst[e.i] = byInst[e.i] || []).push(e);
  // 某乐器在 t 时刻的包络强度（用于光效脉冲）
  function level(inst, t, tau = 0.3, win = 2.5) {
    const arr = byInst[inst];
    if (!arr) return 0;
    let s = 0;
    for (const e of arr) {
      if (e.t > t) break;
      const dt = t - e.t;
      if (dt < win) s += e.v * Math.exp(-dt / tau);
    }
    return s;
  }
  // 钢琴琴键亮度：MIDI 48..83
  function keys(t, out) {
    out.fill(0);
    const arr = byInst.piano;
    for (const e of arr) {
      if (e.t > t) break;
      const dt = t - e.t;
      if (dt > e.d + 0.8) continue;
      let m = e.m;
      while (m < 48) m += 12;
      while (m > 83) m -= 12;
      const lv = Math.exp(-dt * 1.6) * (dt < e.d ? 1 : Math.exp(-(dt - e.d) * 6));
      out[m - 48] = Math.max(out[m - 48], Math.min(1, lv * (0.6 + e.v)));
    }
    return out;
  }

  SM.Music = { BPM, BEAT, BAR, DURATION, SR, events, render, toWav, level, keys };
})();
