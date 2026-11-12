// =====================================================================
//  AUDIO — an original score, synthesized in the browser (WebAudio)
//  72 BPM, 4/4, 72 bars = 240 s.  D major → B minor → D minor → E major
// =====================================================================
const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4;
const tb = (bar, beat = 0) => (bar * 4 + beat) * BEAT;
const NIX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nm(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error('bad note ' + s);
  return NIX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const pcOf = s => (NIX[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
const QUAL = {
  '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11],
  'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'add9': [0, 4, 7, 14], 'dim': [0, 3, 6], 'maj9': [0, 4, 7, 11, 14],
};
function chord(sym) {
  const [main, sl] = sym.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  const root = pcOf(m[1]), iv = QUAL[m[2]];
  if (!iv) throw new Error('chord ' + sym);
  return { root, bass: sl ? pcOf(sl) : root, pcs: iv.map(i => (root + i) % 12) };
}
const trc = (c, n) => ({ root: (c.root + n + 120) % 12, bass: (c.bass + n + 120) % 12, pcs: c.pcs.map(p => (p + n + 120) % 12) });
const upTo = (pc, lo) => { let m = lo; while (((m % 12) + 12) % 12 !== pc) m++; return m; };

function vLH(c) {             // spread left-hand voicing, 5 notes
  const b = upTo(c.bass, 38);
  const fifth = (c.root + 7) % 12;
  const n1 = upTo(fifth, b + 3), n2 = upTo(c.root, n1 + 1), n3 = upTo(c.pcs[1], n2 + 1);
  const n4 = upTo(c.pcs.length > 3 ? c.pcs[3] : fifth, n3 + 1);
  return [b, n1, n2, n3, n4];
}
function vPad(c, lo = 52) { return c.pcs.slice(0, 4).map(pc => upTo(pc, lo)).sort((a, b) => a - b); }
function vGtr(c) {
  const b = upTo(c.bass, 40); const out = [b]; let cur = b;
  for (const pc of [(c.root + 7) % 12, c.root, c.pcs[1], (c.root + 7) % 12, c.root]) { cur = upTo(pc, cur + 3); out.push(cur); }
  return out;
}
function seq(str) {           // "A4:1 D5:.5 r:1 | ..." → notes with beat offsets
  const out = []; let b = 0;
  for (const tok of str.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [n, d] = tok.split(':'); const dur = parseFloat(d);
    if (n !== 'r') for (const x of n.split('+')) out.push({ o: b, m: nm(x), d: dur });
    b += dur;
  }
  return out;
}

// ---- themes ----
const THEME_A = 'A4:1 D5:1 E5:1 F#5:1 | E5:2 C#5:1 A4:1 | D5:1 C#5:.5 D5:.5 F#5:1.5 E5:.5 | D5:3 B4:1 | G4:1 B4:1 E5:1 D5:.5 E5:.5 | F#5:1.5 E5:.5 C#5:1 A4:1 | B4:1 D5:1 G5:1.5 F#5:.5 | E5:2 D5:2';
const THEME_A4 = 'A4:1 D5:1 E5:1 F#5:1 | E5:2 C#5:1 A4:1 | D5:1 C#5:.5 D5:.5 F#5:1.5 E5:.5 | D5:3 B4:1';
const CH_A = [['D'], ['A/C#'], ['Bm'], ['G'], ['Em7'], ['A'], ['Bm7', 'G'], ['A', 'D']];
const THEME_B = 'B5:1.5 A5:.5 G5:1 F#5:1 | E5:1.5 F#5:.5 A5:2 | A5:1 F#5:1 C#5:1 E5:1 | D5:3 B4:1 | G5:1.5 F#5:.5 E5:1 B4:1 | C#5:1 E5:1 G5:1 A5:1 | F#5:2 E5:1 D5:1 | D5:4';
const CH_B = [['G'], ['A'], ['F#m'], ['Bm'], ['Em'], ['A7'], ['D'], ['D']];
const CODETTA = 'D6:.5 B5:.5 G5:.5 B5:.5 D6:1 r:1 | C#6:.5 A5:.5 E5:.5 A5:.5 C#6:1 r:1 | A5:.5 C#6:.5 F#5:1 B5:.5 D6:.5 F#6:1 | E6:1 D6:.5 B5:.5 C#6:1 A5:1';
const CH_COD = [['G'], ['A'], ['F#m', 'Bm'], ['Em', 'A7']];
const RAIN_MEL = 'F#5:2 D5:1 B4:1 | D5:3 r:1 | A4:1 D5:1 F#5:1 E5:1 | E5:2 C#5:1 r:1 | F#5:1.5 E5:.5 D5:1 B4:1 | G5:2 F#5:1 D5:1 | E5:2 G5:1 F#5:1 | F#5:2 E5:1 C#5:1 | B5:2 A5:1 F#5:1 | G5:2 D5:2 | E5:1 F#5:1 G5:1 E5:1 | F#5:4';
const CH_RAIN = [['Bm'], ['G'], ['D'], ['A'], ['Bm'], ['G'], ['Em'], ['F#7'], ['Bm'], ['G'], ['Em'], ['F#']];
const MASK_MEL = 'D5:1.5 E5:.5 F5:1 A5:1 | Bb5:2 A5:1 F5:1 | G5:1.5 F5:.5 E5:1 D5:1 | C#5:3 A4:1 | D5:1 F5:1 A5:1 D6:1 | D6:1.5 C6:.5 Bb5:1 A5:1 | G5:1 Bb5:1 A5:1 C#6:1 | A5:2 E5:1 C#5:1';
const CH_MASK = [['Dm'], ['Bb'], ['Gm'], ['A'], ['Dm'], ['Bb'], ['Gm', 'A'], ['A7']];

function buildScore() {
  const E = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const hum = (v, a = .08) => Math.max(.03, v * (1 + (rnd() - .5) * a));
  const ev = (t, d, i, m, v, x) => E.push({ t: Math.max(0, t), d, i, m, v, x });
  const mel = (bar, str, i, tr = 0, v = .6, leg = 1) => { for (const n of seq(str)) ev(tb(bar, n.o) + (rnd() - .5) * .012, n.d * BEAT * leg, i, n.m + tr, hum(v)); };
  const each = (bar, list, tr, fn) => list.forEach((syms, k) => {
    const per = 4 / syms.length;
    syms.forEach((s, j) => fn(trc(chord(s), tr), tb(bar + k, j * per), per * BEAT, bar + k, j));
  });
  const arp8 = (c, t, d, v = .3) => {
    const n = vLH(c), pat = [0, 1, 2, 3, 4, 3, 2, 1], steps = Math.round(d / (BEAT / 2));
    for (let k = 0; k < steps; k++) { const tt = t + k * BEAT / 2; ev(tt, t + d - tt + .2, 'pno', n[pat[k % 8]], hum(v * (k % 4 === 0 ? 1.15 : .95))); }
  };
  const pad = (c, t, d, v = .15, lo = 52, x = {}) => ev(t, d, 'str', 0, v, Object.assign({ notes: vPad(c, lo) }, x));
  const gpick = (c, t, d, v = .25) => {
    const n = vGtr(c), pat = [0, 2, 3, 4, 1, 3, 4, 5], steps = Math.round(d / (BEAT / 2));
    for (let k = 0; k < steps; k++) ev(t + k * BEAT / 2, 1.8, 'gtr', n[pat[k % 8] % n.length], hum(v * (k % 2 ? .82 : 1)));
  };
  const strum = (c, t, d, v = .25) => {
    const n = vGtr(c);
    for (const [b, dir, acc] of [[0, 1, 1], [1, 1, .8], [1.5, -1, .55], [2.5, -1, .6], [3, 1, .8], [3.5, -1, .55]]) {
      if (b * BEAT >= d - 1e-3) continue;
      const ns = dir > 0 ? n : [...n].reverse().slice(0, 4);
      ns.forEach((m, k) => ev(t + b * BEAT + k * .012, 1.3, 'gtr', m, hum(v * acc * (dir > 0 ? 1 : .8))));
    }
  };
  const bassL = (c, t, d, v = .45) => {
    const r = upTo(c.bass, 33);
    ev(t, Math.min(d, BEAT * 1.8), 'bass', r, hum(v));
    if (d >= BEAT * 4 - 1e-3) { ev(t + BEAT * 2, BEAT * 1.4, 'bass', r + (rnd() < .5 ? 0 : 7), hum(v * .85)); ev(t + BEAT * 3.5, BEAT * .5, 'bass', r + 12, hum(v * .55)); }
    else if (d >= BEAT * 2 - 1e-3) ev(t + BEAT * 1.5, BEAT * .5, 'bass', r + 7, hum(v * .6));
  };
  const drums = (b0, b1, lv = 1) => {
    for (let b = b0; b < b1; b++) {
      for (let k = 0; k < 4; k++) { const t = tb(b, k); if (k % 2 === 0) ev(t, .45, 'kick', 0, hum(.5 * lv)); else ev(t, .3, 'snare', 0, hum(.2 * lv)); }
      for (let k = 0; k < 8; k++) ev(tb(b, k * .5), .06, 'hat', 0, hum((k % 2 ? .08 : .12) * lv));
    }
  };

  // ── Prologue (bars 0–5): space, music box ─────────────────────────
  ev(0, tb(2.2), 'str', 0, .12, { notes: [nm('D3'), nm('A3'), nm('E4'), nm('F#4')], atk: 5, cut: 1100 });
  ev(0, tb(6), 'wind', 0, .5);
  [['A5', 0, 1], ['F#6', 0, 3], ['E6', 1, 1], ['D6', 1, 2.5], ['A5', 1, 3.5]].forEach(([n, b, bt], k) => ev(tb(b, bt), 3, 'mbox', nm(n), .3 - k * .02));
  ev(tb(2), 5, 'bell', nm('D6'), .22);
  ev(tb(2), 5, 'bell', nm('A6'), .1);
  mel(2, THEME_A4, 'mbox', 12, .48);
  each(2, [['D'], ['A/C#'], ['Bm'], ['G']], 0, (c, t, d) => {
    pad(c, t, d + .4, .13, 50, { atk: 2 });
    ev(t, d + .6, 'pno', upTo(c.bass, 38), .26);
    ev(t + BEAT * 2, d - BEAT * 2 + .6, 'pno', upTo((c.root + 7) % 12, 45), .17);
  });

  // ── I. Childhood (bars 6–17): piano theme, dusk ──────────────────
  ev(tb(6), tb(18) - tb(6), 'crickets', 0, .16);
  mel(6, THEME_A, 'pno', 0, .62);
  each(6, CH_A, 0, (c, t, d) => arp8(c, t, d, .26));
  each(10, CH_A.slice(4), 0, (c, t, d) => gpick(c, t, d, .14));
  each(10, CH_A.slice(4), 0, (c, t, d) => pad(c, t, d + .3, .07, 55));
  mel(14, CODETTA, 'mbox', 0, .42);
  mel(14, CODETTA, 'pno', -12, .22);
  each(14, CH_COD, 0, (c, t, d) => {
    const n = vGtr(c);
    for (let b = 0; b < d / BEAT - 1e-3; b++) { ev(t + b * BEAT, 1, 'gtr', n[b % 2 ? 3 : 0], hum(.2)); ev(t + b * BEAT + BEAT / 2, .8, 'gtr', n[4], hum(.13)); }
    pad(c, t, d + .2, .09, 55);
    ev(t, d + .3, 'pno', upTo(c.bass, 38), .22);
  });

  // ── II. Spring (bars 18–29): walk → stage ────────────────────────
  mel(18, THEME_B, 'pno', 0, .6);
  each(18, CH_B, 0, (c, t, d, bar) => {
    strum(c, t, d, bar < 22 ? .13 : .18);
    pad(c, t, d + .25, bar < 22 ? .08 : .13, 52);
    if (bar >= 20) bassL(c, t, d, .4);
    ev(t, d + .3, 'pno', upTo(c.bass, 38), .22);
  });
  ev(tb(23, 2), tb(24) - tb(23, 2), 'swell', 0, .2);
  ev(tb(24), 3, 'crash', 0, .22);
  drums(24, 29, 1);
  for (let k = 0; k < 4; k++) ev(tb(29, k), .45, 'kick', 0, .45 - k * .08);
  mel(26, THEME_A4, 'pno', 12, .5);
  mel(26, THEME_A4, 'vln', 0, .3);
  each(26, [['D'], ['A/C#'], ['Bm'], ['G']], 0, (c, t, d) => { strum(c, t, d, .18); pad(c, t, d + .25, .14, 52); bassL(c, t, d, .4); arp8(c, t, d, .17); });
  ev(tb(29, 2), 4, 'crash', 0, .12);

  // ── III. Rain (bars 30–41): B minor ──────────────────────────────
  ev(tb(29, 3), tb(42) - tb(29, 3) + .4, 'rain', 0, .55);
  ev(tb(31, 1), 6, 'thunderFar', 0, .25);
  mel(30, RAIN_MEL, 'pno', 0, .5);
  each(30, CH_RAIN, 0, (c, t, d, bar) => {
    ev(t, d + .5, 'pno', upTo(c.bass, 35), .3);
    const v = vPad(c, 57);
    v.slice(0, 3).forEach((m, k) => ev(t + BEAT + k * .03, d - BEAT + .4, 'pno', m, .14));
    ev(t, d + .4, 'cello', upTo(c.bass, 36), .2);
    if (bar >= 36) gpick(c, t, d, .12);
    if (bar >= 38) pad(c, t, d + .3, .09, 55);
  });
  ev(139.55, 6, 'thunder', 0, .75);

  // ── IV. Masquerade (bars 42–49): D minor ─────────────────────────
  each(42, CH_MASK, 0, (c, t, d, bar) => {
    const r = upTo(c.root, 62), th = upTo(c.pcs[1], r), fi = upTo(c.pcs[2], th);
    const arr = [r, th, fi, r + 12, th + 12, fi + 12, r + 24, fi + 12, th + 12, r + 12, fi, th];
    const steps = Math.round(d / (BEAT / 4));
    for (let k = 0; k < steps; k++) ev(t + k * BEAT / 4, .35, 'hpsi', arr[k % 12], hum(k % 4 === 0 ? .26 : .17));
    ev(t, d + .15, 'organ', 0, .15, { notes: vPad(c, 50) });
    ev(t, 2.2, 'timp', upTo(c.root, 38), .5);
    if (bar >= 46) ev(t + BEAT * 2.5, 1.6, 'timp', upTo(c.root, 38), .32);
    for (let k = 0; k < Math.round(d / (BEAT / 2)); k++) ev(t + k * BEAT / 2, BEAT / 2 * .85, 'cello', upTo(c.root, 38), hum(k % 2 ? .12 : .18));
  });
  mel(42, MASK_MEL, 'vln', 0, .36);
  mel(46, MASK_MEL.split('|').slice(4).join('|'), 'vln', 12, .16);
  ev(tb(49), BAR, 'swell', 0, .3);
  ev(tb(50), 6, 'bell', nm('A6'), .28);
  ev(tb(50), 6, 'bell', nm('E6'), .12);
  ev(167.2, 3, 'shatter', 0, .65);
  ev(167.2, 5, 'boom', 0, .45);

  // ── V. Beneath the stars (bars 51–66): E major ───────────────────
  ev(tb(50, 3), tb(67) - tb(50, 3), 'crickets', 0, .3);
  ev(tb(50, 3), tb(67) - tb(50, 3), 'wind', 0, .25);
  mel(51, THEME_A, 'pno', 2, .56);
  each(51, CH_A, 2, (c, t, d, bar) => {
    arp8(c, t, d, .21);
    if (bar >= 53) gpick(c, t, d, .12);
    if (bar >= 55) pad(c, t, d + .25, .09, 54);
  });
  ev(tb(58, 2), tb(59) - tb(58, 2), 'swell', 0, .2);
  ev(tb(59), 3, 'crash', 0, .18);
  mel(59, THEME_B, 'vln', 2, .36);
  mel(59, THEME_B, 'pno', 14, .42);
  each(59, CH_B, 2, (c, t, d, bar) => {
    strum(c, t, d, .17); pad(c, t, d + .25, .16, 52); bassL(c, t, d, .4); arp8(c, t, d, .16);
    if (bar >= 63) { const v = vPad(c, 76); for (let k = 0; k < 4; k++) ev(t + k * BEAT + BEAT / 2, 1.6, 'mbox', v[k % 3], .14); }
  });
  drums(61, 66, .8);
  for (let b = 59; b < 61; b++) for (let k = 0; k < 4; k += 2) ev(tb(b, k), .45, 'kick', 0, .35);
  ev(tb(67), 4, 'crash', 0, .13);

  // ── Epilogue (bars 67–71): dawn ──────────────────────────────────
  mel(67, 'B4:1 E5:1 F#5:1 G#5:1 | F#5:2 D#5:1 B4:1 | E5:1 D#5:.5 E5:.5 G#5:2', 'pno', 0, .5);
  each(67, [['E'], ['B/D#'], ['C#m', 'A']], 0, (c, t, d) => { arp8(c, t, d, .19); pad(c, t, d + .3, .11, 54); });
  ['E2', 'B2', 'E3', 'G#3', 'D#4', 'F#4', 'B4', 'E5'].forEach((n, k) => ev(tb(70) + k * .09, 9, 'pno', nm(n), .3 - k * .015));
  ev(tb(70), tb(72) - tb(70) + 1.5, 'str', 0, .13, { notes: [nm('E3'), nm('B3'), nm('D#4'), nm('F#4'), nm('G#4')], atk: 2.5, rel: 3 });
  ev(tb(70, 2), 4, 'mbox', nm('B6'), .18); ev(tb(71), 4, 'mbox', nm('E6'), .2); ev(tb(71, 2), 4, 'mbox', nm('G#6'), .13);

  E.sort((a, b) => a.t - b.t);
  return E;
}

// ---------------------------------------------------------------------
//  Offline sample synthesis
// ---------------------------------------------------------------------
function normalize(a, peak) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); if (m > 0) { const k = peak / m; for (let i = 0; i < a.length; i++) a[i] *= k; } return a; }
function fadeEdges(a, sr, atk = .002, rel = .04) { const A = Math.floor(sr * atk), F = Math.floor(sr * rel); for (let i = 0; i < A; i++) a[i] *= i / A; for (let i = 0; i < F; i++) a[a.length - 1 - i] *= i / F; return a; }
function addPartial(out, sr, f, amp, tau, phase = 0, tauFast = 0, fastMix = 0) {
  const w = 2 * Math.PI * f / sr, c2 = 2 * Math.cos(w);
  let y1 = Math.sin(phase - w), y2 = Math.sin(phase - 2 * w);
  const d = Math.exp(-1 / (tau * sr)), df = tauFast ? Math.exp(-1 / (tauFast * sr)) : 0;
  let e = amp * (1 - fastMix), ef = amp * fastMix;
  for (let n = 0; n < out.length; n++) {
    const y = c2 * y1 - y2; y2 = y1; y1 = y;
    out[n] += y * (e + ef); e *= d; ef *= df;
    if ((n & 1023) === 0 && e + ef < 1e-5) break;
  }
}
function synthPiano(sr, midi) {
  const f0 = mtof(midi);
  const dur = Math.max(1.6, Math.min(6.5, 6.5 * Math.pow(110 / f0, .5)));
  const out = new Float32Array(Math.floor(sr * dur));
  const B = .00007 * Math.pow(2, (midi - 48) / 16);
  const nP = Math.max(3, Math.min(12, Math.floor(7000 / f0)));
  const tb0 = 3.4 * Math.pow(262 / f0, .55);
  for (let k = 1; k <= nP; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k); if (fk > sr * .45) break;
    const amp = Math.pow(k, -1.05) * (.5 + .5 * Math.abs(Math.sin(Math.PI * k * .135))) * (k === 2 ? .85 : 1);
    const tau = Math.max(.2, tb0 / (1 + .5 * (k - 1))), tf = Math.max(.06, .35 * tb0 / k);
    const det = fk * .0004;
    addPartial(out, sr, fk - det, amp * .5, tau, k * .7, tf, .55);
    addPartial(out, sr, fk + det, amp * .5, tau * .97, k * .7 + 1.1, tf, .55);
  }
  let lp = 0; const hn = Math.floor(sr * .015);
  for (let n = 0; n < hn; n++) { lp += ((Math.random() * 2 - 1) - lp) * .3; out[n] += lp * .05 * Math.exp(-n / (sr * .003)); }
  return fadeEdges(normalize(out, .55), sr, .0015, .08);
}
function synthMbox(sr, midi) {
  const f0 = mtof(midi), out = new Float32Array(Math.floor(sr * 3));
  addPartial(out, sr, f0, 1, 1.9);
  addPartial(out, sr, f0 * 1.0013, .4, 1.6, 1);
  addPartial(out, sr, f0 * 3.01, .07, .35);
  addPartial(out, sr, f0 * 5.93, .1, .14);
  for (let n = 0; n < sr * .002; n++) out[n] += (Math.random() * 2 - 1) * .15 * (1 - n / (sr * .002));
  return fadeEdges(normalize(out, .5), sr, .0008, .1);
}
function synthBell(sr, midi) {
  const f0 = mtof(midi), out = new Float32Array(Math.floor(sr * 5));
  [[.5, .12, 3.5], [1, 1, 3.2], [1.002, .5, 2.9], [2.76, .42, 1.6], [5.4, .22, .8], [8.93, .1, .4]].forEach(([r, a, t], k) => addPartial(out, sr, f0 * r, a, t, k));
  return fadeEdges(normalize(out, .5), sr, .001, .2);
}
function ks(sr, f, dur, o) {
  const out = new Float32Array(Math.floor(sr * dur));
  const P = sr / f; let L = Math.floor(P - .5); if (L < 2) L = 2;
  const fr = P - .5 - L, C = (1 - fr) / (1 + fr);
  const buf = new Float32Array(L);
  let lp = 0; for (let i = 0; i < L; i++) { lp += ((Math.random() * 2 - 1) - lp) * o.bright; buf[i] = lp; }
  if (o.pick) { const D = Math.max(1, Math.floor(o.pick * L)), tmp = buf.slice(); for (let i = 0; i < L; i++) buf[i] = tmp[i] - .85 * tmp[(i - D + L) % L]; }
  let mean = 0; for (let i = 0; i < L; i++) mean += buf[i]; mean /= L; for (let i = 0; i < L; i++) buf[i] -= mean;
  const g = Math.pow(.001, 1 / (sr * o.t60));
  let p = 0, prev = 0, apx = 0, apy = 0;
  for (let n = 0; n < out.length; n++) {
    const x = buf[p]; out[n] = x;
    const avg = (1 - o.damp) * x + o.damp * prev; prev = x;
    const ap = C * avg + apx - C * apy; apx = avg; apy = ap;
    buf[p] = ap * g; if (++p >= L) p = 0;
  }
  return out;
}
function synthGtr(sr, midi) {
  const f = mtof(midi);
  const a = ks(sr, f, 3, { bright: .45, pick: .17, t60: 3.6 * Math.pow(110 / f, .35), damp: .5 });
  return fadeEdges(normalize(a, .5), sr, .001, .15);
}
function synthHpsi(sr, midi) {
  const f = mtof(midi);
  const a = ks(sr, f, 1.6, { bright: .95, pick: .1, t60: 1.5, damp: .38 });
  const b = ks(sr, f * 2, 1.6, { bright: .95, pick: .13, t60: 1.1, damp: .38 });
  for (let i = 0; i < a.length; i++) a[i] = a[i] + b[i] * .35;
  return fadeEdges(normalize(a, .45), sr, .0005, .1);
}

// ---------------------------------------------------------------------
//  Engine: graph, lookahead scheduler, instruments
// ---------------------------------------------------------------------
const LONG = new Set(['str', 'organ', 'rain', 'crickets', 'wind', 'cello']);
class Engine {
  constructor(score, ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = ctx || new AC({ latencyHint: 'playback' });
    const c = this.ctx; this.sr = c.sampleRate; this.E = score;
    this.out = c.createGain(); this.out.connect(c.destination);
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -15; this.comp.knee.value = 10; this.comp.ratio.value = 3; this.comp.attack.value = .008; this.comp.release.value = .3;
    this.comp.connect(this.out);
    this.master = c.createGain(); this.master.gain.value = .85; this.master.connect(this.comp);
    this.rev = c.createConvolver(); const rg = c.createGain(); rg.gain.value = .85; this.rev.connect(rg); rg.connect(this.master);
    this.bus = {};
    const mk = (name, gain, send, chain) => {
      const g = c.createGain(); g.gain.value = gain; let last = g;
      for (const f of (chain || [])) { const b = c.createBiquadFilter(); b.type = f[0]; b.frequency.value = f[1]; if (f[2] !== undefined) b.gain.value = f[2]; if (f[3] !== undefined) b.Q.value = f[3]; last.connect(b); last = b; }
      last.connect(this.master); const s = c.createGain(); s.gain.value = send; last.connect(s); s.connect(this.rev); this.bus[name] = g;
    };
    mk('pno', .95, .34, [['lowshelf', 180, 2], ['highshelf', 5000, -3]]);
    mk('mbox', .5, .6); mk('bell', .45, .75);
    mk('gtr', .75, .3, [['peaking', 210, 3, .9], ['lowpass', 5200]]);
    mk('str', .55, .55); mk('vln', .5, .5, [['highpass', 220], ['peaking', 2600, 2, 1]]);
    mk('org', .4, .55); mk('hpsi', .32, .38); mk('cello', .5, .35);
    mk('bass', .6, .06); mk('drum', .55, .14); mk('fx', .6, .45); mk('amb', .7, .12);
    this.lfo = c.createOscillator(); this.lfo.frequency.value = 5.2; this.lfoG = c.createGain(); this.lfoG.gain.value = 4; this.lfo.connect(this.lfoG); this.lfo.start();
    this.active = new Set(); this.buf = {}; this.idx = 0; this.startPos = 0; this.base = 0; this.ready = false; this.vol = 1;
  }
  async prepare(onProgress) {
    const c = this.ctx, sr = this.sr;
    const jobs = [];
    const need = {}; for (const e of this.E) if (['pno', 'mbox', 'gtr', 'hpsi', 'bell'].includes(e.i)) (need[e.i] = need[e.i] || new Set()).add(e.m);
    const fns = { pno: synthPiano, mbox: synthMbox, gtr: synthGtr, hpsi: synthHpsi, bell: synthBell };
    for (const k in need) for (const m of need[k]) jobs.push(() => { this.buf[k + m] = this.mkBuf([fns[k](sr, m)]); });
    jobs.push(() => { this.rev.buffer = this.mkIR(3.4); });
    jobs.push(() => { this.noise = this.mkNoise(4, 'white'); this.pink = this.mkNoise(6, 'pink'); this.brown = this.mkNoise(6, 'brown'); });
    jobs.push(() => { this.cricket = this.mkCrickets(4); this.shatterB = this.mkShatter(); });
    for (let i = 0; i < jobs.length; i++) {
      jobs[i]();
      if (i % 3 === 2) { onProgress && onProgress(i / jobs.length); await new Promise(r => setTimeout(r, 0)); }
    }
    this.org = c.createPeriodicWave(new Float32Array(10), new Float32Array([0, 1, .75, .1, .5, .05, .3, 0, .22, .1]));
    this.ready = true; onProgress && onProgress(1);
  }
  mkBuf(chs) { const b = this.ctx.createBuffer(chs.length, chs[0].length, this.sr); chs.forEach((d, i) => b.copyToChannel(d, i)); return b; }
  mkIR(sec) {
    const sr = this.sr, n = Math.floor(sr * sec), L = new Float32Array(n), R = new Float32Array(n);
    for (const ch of [L, R]) {
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, k = .12 + .85 * Math.exp(-t / 1.1);
        lp += ((Math.random() * 2 - 1) - lp) * k;
        ch[i] = lp * Math.pow(1 - i / n, 2.2) * Math.exp(-t / .9) * (t < .012 ? t / .012 : 1);
      }
    }
    return this.mkBuf([L, R]);
  }
  mkNoise(sec, kind) {
    const n = Math.floor(this.sr * sec), chs = [new Float32Array(n), new Float32Array(n)];
    for (const d of chs) {
      let b0 = 0, b1 = 0, b2 = 0, br = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'pink') { b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * .1848) * .2; }
        else if (kind === 'brown') { br = (br + .02 * w) / 1.02; d[i] = br * 3.5; }
        else d[i] = w * .5;
      }
      const F = 2000; for (let i = 0; i < F; i++) { const k = i / F; d[i] = d[i] * k + d[n - F + i] * (1 - k); }
    }
    return this.mkBuf(chs);
  }
  mkCrickets(sec) {
    const sr = this.sr, n = Math.floor(sr * sec), L = new Float32Array(n), R = new Float32Array(n);
    for (let c = 0; c < 26; c++) {
      const t0 = Math.random() * sec, f = 4000 + Math.random() * 1400, pan = Math.random(), a = .2 + Math.random() * .8, pulses = 2 + (Math.random() * 3 | 0);
      for (let p = 0; p < pulses; p++) {
        const s0 = Math.floor((t0 + p * .045) * sr), len = Math.floor(.028 * sr);
        for (let i = 0; i < len; i++) {
          const idx = (s0 + i) % n, env = Math.sin(Math.PI * i / len) ** 2, v = Math.sin(2 * Math.PI * f * i / sr) * env * a * .25;
          L[idx] += v * (1 - pan); R[idx] += v * pan;
        }
      }
    }
    return this.mkBuf([L, R]);
  }
  mkShatter() {
    const sr = this.sr, n = Math.floor(sr * 2.5), L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / sr, w = (Math.random() * 2 - 1) * Math.exp(-t / .09) * .6; L[i] += w; R[i] += w * (.7 + .3 * Math.random()); }
    for (let k = 0; k < 46; k++) {
      const t0 = Math.pow(Math.random(), 1.6) * .9, f = 1800 + Math.random() * 5200, tau = .08 + Math.random() * .5, a = .08 + Math.random() * .25, pan = Math.random();
      const s0 = Math.floor(t0 * sr), len = Math.min(n - s0, Math.floor(tau * 6 * sr));
      for (let i = 0; i < len; i++) { const v = Math.sin(2 * Math.PI * f * i / sr) * a * Math.exp(-i / (tau * sr)); L[s0 + i] += v * (1 - pan); R[s0 + i] += v * pan; }
    }
    normalize(L, .8); normalize(R, .8);
    return this.mkBuf([L, R]);
  }
  // ---- transport ----
  songTime() { return this.startPos + Math.max(0, this.ctx.currentTime - this.base); }
  stopAll() { for (const n of this.active) { try { n.stop(); } catch (e) { } } this.active.clear(); }
  track(n) { this.active.add(n); n.onended = () => this.active.delete(n); }
  startAt(pos) {
    this.stopAll(); const c = this.ctx;
    this.startPos = pos; this.base = c.currentTime + .06;
    let lo = 0, hi = this.E.length; while (lo < hi) { const m = (lo + hi) >> 1; if (this.E[m].t < pos) lo = m + 1; else hi = m; }
    this.idx = lo;
    for (let i = 0; i < lo; i++) { const e = this.E[i]; if (LONG.has(e.i) && e.t + e.d > pos + .4) this.play(e, this.base, pos - e.t); }
    this.tick();
  }
  tick() {
    if (!this.ready) return;
    const c = this.ctx, now = this.songTime(), until = now + .6;
    while (this.idx < this.E.length && this.E[this.idx].t < until) {
      const e = this.E[this.idx++];
      if (e.t < now - .08) continue;
      this.play(e, Math.max(c.currentTime + .005, this.base + (e.t - this.startPos)), 0);
    }
  }
  setVolume(v) { this.vol = v; this.out.gain.setTargetAtTime(v, this.ctx.currentTime, .05); }
  // ---- instruments ----
  env(g, when, v, a, d, r) { const p = g.gain; p.setValueAtTime(0, when); p.linearRampToValueAtTime(v, when + a); p.setValueAtTime(v, when + Math.max(a, d)); p.linearRampToValueAtTime(0, when + Math.max(a, d) + r); return when + Math.max(a, d) + r + .05; }
  sample(key, bus, when, dur, vel, off = 0, rel = .3, rate = 1) {
    const b = this.buf[key]; if (!b) return; const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = c.createGain(); const end = when + Math.max(.04, dur - off);
    g.gain.setValueAtTime(vel, when); g.gain.setValueAtTime(vel, end); g.gain.setTargetAtTime(0, end, rel / 3);
    s.connect(g); g.connect(this.bus[bus]);
    const o = Math.min(off, b.duration - .02); s.start(when, o); s.stop(Math.min(when + (b.duration - o) / rate, end + rel * 2.5)); this.track(s);
  }
  noiseSrc(buf, when, loop = false, off = 0) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.start(when, off % buf.duration); this.track(s); return s; }
  filt(type, f, q = .7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
  play(e, when, off) {
    const c = this.ctx, v = e.v;
    switch (e.i) {
      case 'pno': this.sample('pno' + e.m, 'pno', when, e.d, v * 1.1, off, .35); break;
      case 'mbox': this.sample('mbox' + e.m, 'mbox', when, e.d + 1.5, v, off, .5); break;
      case 'bell': this.sample('bell' + e.m, 'bell', when, e.d, v, off, 1); break;
      case 'gtr': this.sample('gtr' + e.m, 'gtr', when, e.d, v * 1.1, off, .25); break;
      case 'hpsi': this.sample('hpsi' + e.m, 'hpsi', when, e.d + .3, v, off, .15); break;
      case 'str': {
        const x = e.x, notes = x.notes, d = e.d - off, a = off > 0 ? .4 : (x.atk || 1.1);
        const g = c.createGain(), f = this.filt('lowpass', x.cut || 1600, .5);
        f.connect(g); g.connect(this.bus.str);
        const stop = this.env(g, when, v, a, d, x.rel || 1.5);
        for (const m of notes) for (const dt of [-8, 7]) {
          const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt; this.lfoG.connect(o.detune);
          const og = c.createGain(); og.gain.value = .28 / notes.length; o.connect(og); og.connect(f); o.start(when); o.stop(stop); this.track(o);
        }
        break;
      }
      case 'vln': {
        const f0 = mtof(e.m), g = c.createGain(), lp = this.filt('lowpass', 2900, .8);
        lp.connect(g); g.connect(this.bus.vln);
        const stop = this.env(g, when, v, .1, e.d, .3);
        const lfo = c.createOscillator(); lfo.frequency.value = 5.6; const lg = c.createGain(); lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(11, when + .45); lfo.connect(lg);
        for (const dt of [-4, 5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = dt; lg.connect(o.detune); const og = c.createGain(); og.gain.value = .3; o.connect(og); og.connect(lp); o.start(when); o.stop(stop); this.track(o); }
        lfo.start(when); lfo.stop(stop); this.track(lfo);
        break;
      }
      case 'organ': {
        const notes = e.x.notes, d = e.d - off, g = c.createGain(), lp = this.filt('lowpass', 2600, .5);
        lp.connect(g); g.connect(this.bus.org);
        const stop = this.env(g, when, v, off > 0 ? .3 : .15, d, .7);
        for (const m of notes) { const o = c.createOscillator(); o.setPeriodicWave(this.org); o.frequency.value = mtof(m); const og = c.createGain(); og.gain.value = .35 / notes.length; o.connect(og); og.connect(lp); o.start(when); o.stop(stop); this.track(o); }
        break;
      }
      case 'cello': {
        const f0 = mtof(e.m), g = c.createGain(), lp = this.filt('lowpass', 750, .6);
        lp.connect(g); g.connect(this.bus.cello);
        const stop = this.env(g, when, v, e.d > 1 ? .3 : .03, e.d - off, e.d > 1 ? .7 : .12);
        for (const dt of [-5, 5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = dt; const og = c.createGain(); og.gain.value = .35; o.connect(og); og.connect(lp); o.start(when); o.stop(stop); this.track(o); }
        break;
      }
      case 'bass': {
        const f0 = mtof(e.m), g = c.createGain(), lp = this.filt('lowpass', 700, .7);
        lp.connect(g); g.connect(this.bus.bass);
        const p = g.gain; p.setValueAtTime(0, when); p.linearRampToValueAtTime(v, when + .012); p.exponentialRampToValueAtTime(v * .55, when + .35); p.setValueAtTime(v * .55, when + e.d); p.linearRampToValueAtTime(0, when + e.d + .12);
        const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f0; const o2 = c.createOscillator(); o2.frequency.value = f0;
        const g2 = c.createGain(); g2.gain.value = .7; o2.connect(g2); g2.connect(lp); o1.connect(lp);
        for (const o of [o1, o2]) { o.start(when); o.stop(when + e.d + .2); this.track(o); }
        break;
      }
      case 'kick': {
        const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, when); o.frequency.exponentialRampToValueAtTime(46, when + .12);
        g.gain.setValueAtTime(v, when); g.gain.exponentialRampToValueAtTime(.001, when + .42); o.connect(g); g.connect(this.bus.drum); o.start(when); o.stop(when + .45); this.track(o);
        break;
      }
      case 'snare': {
        const s = this.noiseSrc(this.noise, when, false, Math.random()), bp = this.filt('bandpass', 1900, .7), g = c.createGain();
        g.gain.setValueAtTime(v, when); g.gain.exponentialRampToValueAtTime(.001, when + .2); this.chain(s, bp, g, this.bus.drum); s.stop(when + .25);
        const o = c.createOscillator(), og = c.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(v * .6, when); og.gain.exponentialRampToValueAtTime(.001, when + .09); o.connect(og); og.connect(this.bus.drum); o.start(when); o.stop(when + .1); this.track(o);
        break;
      }
      case 'hat': {
        const s = this.noiseSrc(this.noise, when, false, Math.random() * 3), hp = this.filt('highpass', 7500, .7), g = c.createGain();
        g.gain.setValueAtTime(v, when); g.gain.exponentialRampToValueAtTime(.001, when + .05); this.chain(s, hp, g, this.bus.drum); s.stop(when + .07);
        break;
      }
      case 'crash': {
        const s = this.noiseSrc(this.noise, when, false, Math.random() * 2), hp = this.filt('highpass', 4500, .5), g = c.createGain();
        g.gain.setValueAtTime(v, when); g.gain.exponentialRampToValueAtTime(.001, when + e.d); this.chain(s, hp, g, this.bus.fx); s.stop(when + e.d);
        break;
      }
      case 'swell': {
        const s = this.noiseSrc(this.pink, when, true, Math.random()), bp = this.filt('bandpass', 900, .6), g = c.createGain();
        bp.frequency.setValueAtTime(400, when); bp.frequency.exponentialRampToValueAtTime(6000, when + e.d);
        g.gain.setValueAtTime(.0001, when); g.gain.exponentialRampToValueAtTime(v, when + e.d); g.gain.linearRampToValueAtTime(0, when + e.d + .05);
        this.chain(s, bp, g, this.bus.fx); s.stop(when + e.d + .1);
        break;
      }
      case 'timp': {
        const f0 = mtof(e.m), o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(f0 * 1.04, when); o.frequency.exponentialRampToValueAtTime(f0, when + .15);
        g.gain.setValueAtTime(v, when); g.gain.exponentialRampToValueAtTime(.001, when + e.d); o.connect(g); g.connect(this.bus.drum); o.start(when); o.stop(when + e.d); this.track(o);
        const s = this.noiseSrc(this.brown, when, false, Math.random()), lp = this.filt('lowpass', 300), ng = c.createGain();
        ng.gain.setValueAtTime(v * 1.2, when); ng.gain.exponentialRampToValueAtTime(.001, when + .4); this.chain(s, lp, ng, this.bus.drum); s.stop(when + .45);
        break;
      }
      case 'boom': {
        const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(70, when); o.frequency.exponentialRampToValueAtTime(30, when + 2);
        g.gain.setValueAtTime(v, when); g.gain.exponentialRampToValueAtTime(.001, when + e.d); o.connect(g); g.connect(this.bus.fx); o.start(when); o.stop(when + e.d); this.track(o);
        break;
      }
      case 'shatter': { const s = c.createBufferSource(); s.buffer = this.shatterB; const g = c.createGain(); g.gain.value = v; s.connect(g); g.connect(this.bus.fx); s.start(when); this.track(s); break; }
      case 'rain': {
        const d = e.d - off, g = c.createGain(); const stop = this.env(g, when, v, off > 0 ? 1 : 3.5, d - 2, 2.5); g.connect(this.bus.amb);
        const s1 = this.noiseSrc(this.pink, when, true, off), hp = this.filt('highpass', 500), lp = this.filt('lowpass', 6500); this.chain(s1, hp, lp, g); s1.stop(stop);
        const s2 = this.noiseSrc(this.noise, when, true, off + 1.3), bp = this.filt('bandpass', 2600, .5), g2 = c.createGain(); g2.gain.value = .25; this.chain(s2, bp, g2, g); s2.stop(stop);
        break;
      }
      case 'thunder': case 'thunderFar': {
        const far = e.i === 'thunderFar', s = this.noiseSrc(this.brown, when, false, Math.random() * 2), lp = this.filt('lowpass', far ? 180 : 420), g = c.createGain(), p = g.gain;
        p.setValueAtTime(0, when); p.linearRampToValueAtTime(v, when + (far ? .6 : .05)); p.linearRampToValueAtTime(v * .5, when + 1.2); p.linearRampToValueAtTime(v * .8, when + 1.8); p.exponentialRampToValueAtTime(.001, when + e.d);
        this.chain(s, lp, g, this.bus.fx); s.stop(when + e.d);
        if (!far) { const s2 = this.noiseSrc(this.noise, when, false, 0), hp = this.filt('highpass', 1200), g2 = c.createGain(); g2.gain.setValueAtTime(v * .5, when); g2.gain.exponentialRampToValueAtTime(.001, when + .35); this.chain(s2, hp, g2, this.bus.fx); s2.stop(when + .4); }
        break;
      }
      case 'crickets': { const g = c.createGain(); const stop = this.env(g, when, v, off > 0 ? 1 : 3, e.d - off - 2, 2); g.connect(this.bus.amb); const s = this.noiseSrc(this.cricket, when, true, off); s.connect(g); s.stop(stop); break; }
      case 'wind': {
        const g = c.createGain(); const stop = this.env(g, when, v, off > 0 ? 1 : 4, e.d - off - 3, 3); g.connect(this.bus.amb);
        const s = this.noiseSrc(this.pink, when, true, off), bp = this.filt('bandpass', 380, .8); this.chain(s, bp, g); s.stop(stop);
        const l = c.createOscillator(); l.frequency.value = .09; const lg = c.createGain(); lg.gain.value = 160; l.connect(lg); lg.connect(bp.frequency); l.start(when); l.stop(stop); this.track(l);
        break;
      }
    }
  }
}
