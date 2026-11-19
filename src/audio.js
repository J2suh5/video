/* ==========================================================================
   audio.js — 用 Web Audio 实时合成的配乐（无需任何音频文件）
   同一份"乐谱"既用于网页实时播放，也用于离线渲染成 WAV 混进视频。
   ========================================================================== */
(function () {
'use strict';
const DUR = 320;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const EV = [];
const pad = (t0, t1, notes, o = {}) => EV.push({ type: 'pad', t0, t1, notes, gain: o.g ?? 0.045, cut: o.cut ?? 900, atk: o.atk ?? 3, rel: o.rel ?? 3.5 });
const sub = (t0, t1, note, g = 0.055) => EV.push({ type: 'sub', t0, t1, note, gain: g });
const bell = (t, note, g = 0.05, dec = 3.5) => EV.push({ type: 'bell', t0: t, t1: t + dec, note, gain: g, dec });
const hit = (t, g = 0.5) => EV.push({ type: 'hit', t0: t, t1: t + 4, gain: g });
const noise = (t0, t1, f0, f1, g = 0.04, shape = 'swell', q = 1.4) => EV.push({ type: 'noise', t0, t1, f0, f1, gain: g, shape, q });
const pluck = (t, note, g = 0.04, dec = 0.5) => EV.push({ type: 'pluck', t0: t, t1: t + dec + 0.1, note, gain: g, dec });

/* ------------------------------------------------------------- 乐谱 --- */
const rng = E.rng(42);
// 第一章 引子
pad(0, 19, [50, 57, 64, 65], { cut: 700, atk: 5 }); sub(0, 19, 38);
noise(9.4, 12.6, 300, 4200, 0.03, 'rise');
[74, 77, 81, 88].forEach((n, i) => bell(11.2 + i * 0.32, n, 0.045, 4));
hit(12.4, 0.22);
// 第二章 起源
pad(16.5, 26, [46, 53, 57, 62], { cut: 800 }); sub(16.5, 26, 34);
pad(24, 34, [45, 53, 57, 60, 65], { cut: 850 }); sub(24, 34, 33);
pad(32, 42, [43, 50, 53, 58, 62], { cut: 900 }); sub(32, 42, 31);
pad(40, 51, [45, 52, 57, 61, 64], { cut: 950 }); sub(40, 51, 33);
const PENT = [74, 76, 77, 81, 84, 86, 88];
for (let k = 0; k < 16; k++) pluck(23.2 + k * 0.24, PENT[Math.floor(rng() * PENT.length)], 0.025);
bell(27.7, 81, 0.04); bell(28.0, 79, 0.035);
noise(31.6, 35.6, 250, 1600, 0.025, 'swell');
bell(35.0, 86, 0.05); bell(35.25, 81, 0.04);
bell(44.0, 74, 0.04, 5);
// 第三章 箭头
pad(49.5, 59, [50, 57, 62, 65]); sub(49.5, 59, 38);
pad(57, 66, [46, 53, 58, 62]); sub(57, 66, 34);
pad(64, 70.5, [48, 55, 60, 64, 67], { cut: 1100 }); sub(64, 70.5, 36);
pad(68.8, 81.5, [50, 57, 62, 65, 69, 74], { g: 0.048, cut: 1400, atk: 0.4 }); sub(68.8, 81.5, 38);
bell(51.6, 69); bell(58.8, 72); bell(65.6, 74); bell(65.9, 77);
noise(66.6, 69.0, 200, 5000, 0.045, 'rise');
hit(69.0, 0.55);
// 第四章 数字隧道
pad(80, 102.5, [50, 57, 60, 65], { cut: 1000 }); sub(80, 102.5, 38);
noise(80, 84.5, 400, 2500, 0.03, 'swell');
const PAT = [74, 81, 77, 81, 76, 81, 77, 72];
for (let t = 81, i = 0; t < 100.5; t += 0.25, i++) {
  const g = 0.022 * Math.min(1, (t - 81) / 3) * Math.min(1, (100.5 - t) / 2);
  pluck(t, PAT[i % 8], g, 0.35);
}
// 宇宙
hit(101.6, 0.35);
pad(101, 118.5, [38, 45, 52, 57, 64], { cut: 600, atk: 4, g: 0.05 });
for (let k = 0; k < 12; k++) bell(103 + rng() * 14, [81, 84, 86, 88, 93][Math.floor(rng() * 5)], 0.022, 5);
// 指数塔
pad(117.4, 139, [46, 53, 58, 62, 65], { cut: 900 }); sub(117.4, 139, 34);
const DM = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84];
for (let lv = 0; lv < 14; lv++) pluck(117.8 + lv * 0.35, DM[lv], 0.03, 0.6);
noise(122.4, 137.6, 150, 6000, 0.055, 'rise');
hit(137.6, 0.6);
pad(137.5, 151, [43, 50, 55, 58, 62, 67], { cut: 700, atk: 1 }); sub(137.5, 151, 31);
[86, 84, 81, 79, 74, 69].forEach((n, i) => bell(134.0 + i * 0.75, n, 0.035, 2.5));
// 第五章 递归之塔
pad(150, 157.5, [50, 57, 64], { cut: 900 });
pad(155, 162.5, [52, 59, 66], { cut: 950 });
pad(160, 167.5, [54, 61, 68], { cut: 1000 });
pad(165, 173.5, [56, 63, 70], { cut: 1050 });
sub(150, 173.5, 38, 0.05);
[155.4, 156.6, 157.8, 159.0, 160.0, 167.0].forEach((t, i) => bell(t, [74, 76, 78, 80, 82, 86][i], 0.04));
// 传送门
pad(172.5, 193, [50, 57, 62, 69], { cut: 1200 }); sub(172.5, 193, 38);
noise(176, 192.8, 200, 8000, 0.065, 'rise');
const SC = [62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
for (let n = 1; n <= 64; n++) {
  const k = 3.4, x = Math.log(1 + n / 64 * (Math.exp(k) - 1)) / k;
  bell(173.6 + x * 19.2, SC[Math.min(14, Math.floor(n / 4.6))], 0.032 * (1 - n / 90), 1.4);
}
hit(192.85, 0.9);
pad(192.8, 199.5, [38, 50, 57, 62, 66, 69, 74], { g: 0.05, cut: 2200, atk: 0.3 });
[74, 78, 81, 86].forEach((n, i) => bell(193.2 + i * 0.15, n, 0.045, 4));
// 黑洞
pad(198.5, 210.5, [38, 39, 45, 50], { cut: 380, g: 0.06 }); sub(198.5, 210.5, 38, 0.07);
noise(199, 203.2, 2200, 140, 0.035, 'swell');
// 末尾数字
pad(209.5, 223, [50, 57, 62, 65, 72], { cut: 1100 });
for (let i = 0; i < 40; i++) pluck(210.8 + (39 - i) * 0.11, 96 - (i % 3) * 5, 0.012, 0.15);
bell(215.2, 81, 0.04, 5);
// 第六章 又有多小（转为明亮、清冷的色彩）
pad(221.5, 231, [53, 60, 64, 69], { cut: 1500, g: 0.04 }); sub(221.5, 231, 41);
bell(223.2, 88, 0.04, 5); bell(223.6, 84, 0.035, 5);
pad(229, 238, [52, 59, 62, 67], { cut: 1500, g: 0.04 }); sub(229, 238, 40);
pad(236, 246.5, [50, 57, 64, 65, 69], { cut: 1500, g: 0.04 }); sub(236, 246.5, 38);
bell(230.6, 74); bell(231.2, 81); bell(231.8, 86); bell(236.4, 79);
pad(244.5, 256.5, [48, 55, 59, 64], { cut: 1500, g: 0.04 }); sub(244.5, 256.5, 36);
[72, 76, 79, 83, 86].forEach((n, i) => bell(246.2 + i * 1.4, n, 0.04));
pad(255, 264, [53, 60, 64, 69, 72], { cut: 1600, g: 0.04 }); sub(255, 264, 41);
for (let k = 0; k < 40; k++) pluck(256.6 + k / 40 * 7.3, [79, 74, 83, 86, 81][k % 5], 0.02, 0.4);
pad(262, 271.5, [55, 62, 66, 71, 74], { cut: 1700, g: 0.04 }); sub(262, 271.5, 43);
// 第七章 无穷
pad(270.5, 287, [50, 57, 62, 66, 69], { cut: 1300, g: 0.04 }); sub(270.5, 287, 38);
for (let k = 0, t = 275.8; k < 22 && t < 280; k++) { pluck(t, 86 + (k % 4) * 2, 0.018, 0.2); t += 0.42 * Math.pow(0.86, k); }
pad(285, 301, [47, 54, 59, 62, 66, 71], { cut: 1600, g: 0.04 }); sub(285, 301, 35);
noise(292, 297, 300, 2200, 0.025, 'swell');
[86, 90, 93].forEach((n, i) => bell(296 + i * 0.4, n, 0.035, 5));
// 尾声
pad(299.5, 320, [38, 50, 57, 62, 66, 69, 76], { g: 0.048, cut: 1500, atk: 4, rel: 6 }); sub(299.5, 320, 38, 0.05);
[74, 78, 81, 85, 86].forEach((n, i) => bell(304 + i * 0.45, n, 0.04, 5));
bell(311.6, 86, 0.035, 7);

/* ----------------------------------------------------------- 合成 --- */
function makeIR(ctx, dur = 5) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const r = E.rng(7);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const x = i / len;
      d[i] = (r() * 2 - 1) * Math.pow(1 - x, 2.6) * (i < 400 ? i / 400 : 1);
    }
  }
  return buf;
}
const noiseBufs = new WeakMap();
function noiseBuf(ctx) {
  if (noiseBufs.has(ctx)) return noiseBufs.get(ctx);
  const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), r = E.rng(3);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  noiseBufs.set(ctx, b);
  return b;
}

function build(ctx, dest) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
  const master = ctx.createGain(); master.gain.value = 0.95;
  const bus = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.7;
  const conv = ctx.createConvolver(); conv.buffer = makeIR(ctx, 5);
  const wet = ctx.createGain(); wet.gain.value = 0.6;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = 0.7;
  bus.connect(dry); dry.connect(hp);
  bus.connect(conv); conv.connect(wet); wet.connect(hp);
  hp.connect(comp); comp.connect(master); master.connect(dest);
  return { bus, master };
}

function schedule(ctx, bus, from, when, srcs) {
  const track = (n) => { srcs.push(n); return n; };
  for (const e of EV) {
    if (e.t1 <= from + 0.05) continue;
    const st = when + (e.t0 - from), en = when + (e.t1 - from);
    const s = Math.max(st, when);
    if (en - s < 0.1) continue;
    if (e.type === 'pad' || e.type === 'sub') {
      const g = ctx.createGain();
      const atk = e.type === 'sub' ? 2 : e.atk, rel = e.type === 'sub' ? 2.5 : e.rel;
      const atkEnd = st + atk, relStart = Math.max(en - rel, atkEnd);
      g.gain.setValueAtTime(0.0001, s);
      if (s < relStart) {
        g.gain.linearRampToValueAtTime(e.gain, Math.max(atkEnd, s + 0.25));
        g.gain.setValueAtTime(e.gain, Math.max(relStart, s + 0.26));
      } else {
        g.gain.linearRampToValueAtTime(e.gain * (en - s) / rel, s + 0.05);
      }
      g.gain.linearRampToValueAtTime(0.0001, en);
      g.connect(bus);
      if (e.type === 'sub') {
        const o = track(ctx.createOscillator()); o.type = 'sine'; o.frequency.value = midi(e.note);
        o.connect(g); o.start(s); o.stop(en + 0.05);
      } else {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = e.cut; f.Q.value = 0.6;
        const lfo = track(ctx.createOscillator()); lfo.frequency.value = 0.06 + (e.t0 % 7) * 0.01;
        const lg = ctx.createGain(); lg.gain.value = e.cut * 0.35;
        lfo.connect(lg); lg.connect(f.frequency); lfo.start(s); lfo.stop(en + 0.05);
        f.connect(g);
        e.notes.forEach((n, i) => {
          for (const det of [-9, 8]) {
            const o = track(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det + i * 0.7;
            o.connect(f); o.start(s); o.stop(en + 0.05);
          }
        });
      }
    } else if (e.type === 'bell') {
      if (st < when) continue;
      const parts = [[1, 1, 1], [2.0, 0.32, 0.6], [3.01, 0.16, 0.4], [4.18, 0.07, 0.28]];
      for (const [mul, amp, dk] of parts) {
        const o = track(ctx.createOscillator()); o.type = 'sine'; o.frequency.value = midi(e.note) * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(e.gain * amp, st + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, st + e.dec * dk);
        o.connect(g); g.connect(bus); o.start(st); o.stop(st + e.dec * dk + 0.05);
      }
    } else if (e.type === 'pluck') {
      if (st < when) continue;
      const o = track(ctx.createOscillator()); o.type = 'triangle'; o.frequency.value = midi(e.note);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(e.gain, st + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, st + e.dec);
      o.connect(g); g.connect(bus); o.start(st); o.stop(st + e.dec + 0.05);
    } else if (e.type === 'hit') {
      if (st < when) continue;
      const o = track(ctx.createOscillator()); o.type = 'sine';
      o.frequency.setValueAtTime(120, st); o.frequency.exponentialRampToValueAtTime(30, st + 1.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(e.gain, st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 3.2);
      o.connect(g); g.connect(bus); o.start(st); o.stop(st + 3.3);
      const nz = track(ctx.createBufferSource()); nz.buffer = noiseBuf(ctx); nz.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, st); f.frequency.exponentialRampToValueAtTime(120, st + 1.2);
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, st); ng.gain.linearRampToValueAtTime(e.gain * 0.35, st + 0.01); ng.gain.exponentialRampToValueAtTime(0.0001, st + 1.4);
      nz.connect(f); f.connect(ng); ng.connect(bus); nz.start(st); nz.stop(st + 1.5);
    } else if (e.type === 'noise') {
      const nz = track(ctx.createBufferSource()); nz.buffer = noiseBuf(ctx); nz.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = e.q;
      const D = e.t1 - e.t0, el = s - st;
      const fAt = (x) => e.f0 * Math.pow(e.f1 / e.f0, Math.min(1, Math.max(0, x / D)));
      f.frequency.setValueAtTime(fAt(el), s); f.frequency.exponentialRampToValueAtTime(e.f1, en);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      if (e.shape === 'rise') {
        g.gain.linearRampToValueAtTime(e.gain, Math.max(s + 0.05, en - 0.08));
      } else {
        const mid = st + D * 0.6;
        if (s < mid) { g.gain.linearRampToValueAtTime(e.gain, mid); }
        else g.gain.linearRampToValueAtTime(e.gain * 0.6, s + 0.05);
      }
      g.gain.linearRampToValueAtTime(0.0001, en);
      nz.connect(f); f.connect(g); g.connect(bus); nz.start(s); nz.stop(en + 0.05);
    }
  }
}

/* ------------------------------------------------------- 实时播放 --- */
let ctx = null, sess = null, muted = false;
const A = {};
A.available = () => !!(window.AudioContext || window.webkitAudioContext);
A.start = function (from) {
  if (!A.available()) return false;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  A.stop();
  const { bus, master } = build(ctx, ctx.destination);
  master.gain.value = muted ? 0 : 0.95;
  const when = ctx.currentTime + 0.12;
  const srcs = [];
  schedule(ctx, bus, from, when, srcs);
  sess = { master, when, from, srcs };
  return true;
};
A.time = function () {
  if (!sess || !ctx) return null;
  return sess.from + Math.max(0, ctx.currentTime - sess.when);
};
A.running = () => !!sess && ctx && ctx.state === 'running';
A.stop = function () {
  if (!sess) return;
  const s = sess; sess = null;
  const now = ctx.currentTime;
  s.master.gain.setTargetAtTime(0, now, 0.04);
  for (const n of s.srcs) { try { n.stop(now + 0.25); } catch (e) { /* 已停止 */ } }
  setTimeout(() => { try { s.master.disconnect(); } catch (e) { /* 忽略 */ } }, 400);
};
A.setMuted = function (m) {
  muted = m;
  if (sess && ctx) sess.master.gain.setTargetAtTime(m ? 0 : 0.95, ctx.currentTime, 0.05);
};
A.muted = () => muted;

/* ------------------------------------------- 离线渲染（用于导出视频） --- */
A.renderWav = async function () {
  const sr = 48000;
  const octx = new OfflineAudioContext(2, Math.ceil(sr * DUR), sr);
  const { bus } = build(octx, octx.destination);
  schedule(octx, bus, 0, 0, []);
  const buf = await octx.startRendering();
  const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
  const out = new Uint8Array(44 + n * 4);
  const dv = new DataView(out.buffer);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); wstr(8, 'WAVE'); wstr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); wstr(36, 'data'); dv.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    dv.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    dv.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    o += 4;
  }
  return out;
};

window.AUDIO = A;
})();
