// 导演：时间轴、各幕画面、转场与后期
window.SM = window.SM || {};
(function () {
  const U = SM.U, F = SM.Fig, M = SM.Music;
  const lin = (hex, s = 1) => U.hex(hex).map((c) => Math.pow(c, 2.2) * s);
  const mul = (a, s) => a.map((x) => x * s);
  const lerp2 = (a, b, k) => [U.mix(a[0], b[0], k), U.mix(a[1], b[1], k)];
  const T = { STAR: 0, PETAL: 1, MOTE: 2, NOTE: 3, RAIN: 4, BURST: 5, ORB: 6, HELIX: 7, DUST: 9 };
  const BLUE = lin('#8fb0ff'), GREEN = lin('#8ff0bf');
  const SAKI = { hair: lin('#7b9ce4'), body: lin('#1c2238'), skin: lin('#a07c78') };
  const MUTSU = { hair: lin('#86bea0'), body: lin('#1c2622'), skin: lin('#a07c78') };

  // 分镜边界与转场
  const BOUNDS = [0, 12, 36, 54, 78, 96, 117, 123];
  const TRANS = [null, { d: 1.6, mode: 3 }, { d: 1.8, mode: 0 }, { d: 2.0, mode: 0 }, { d: 1.8, mode: 1 }, { d: 2.4, mode: 2 }, { d: 1.8, mode: 0 }];
  const LOOK = [
    { bloom: 0.85, exp: 1.0, tint: [1, 1, 1], vig: 0.55, sat: 1.0 },
    { bloom: 0.40, exp: 1.0, tint: [1.02, 1.0, 0.97], vig: 0.40, sat: 1.05 },
    { bloom: 0.45, exp: 1.0, tint: [1.03, 0.99, 0.97], vig: 0.45, sat: 1.05 },
    { bloom: 0.70, exp: 1.08, tint: [0.95, 0.99, 1.06], vig: 0.55, sat: 0.95 },
    { bloom: 0.75, exp: 1.05, tint: [1.02, 0.97, 1.02], vig: 0.60, sat: 1.05 },
    { bloom: 0.50, exp: 0.95, tint: [1.03, 1.0, 0.97], vig: 0.45, sat: 1.06 },
    { bloom: 0.85, exp: 1.0, tint: [1, 1, 1], vig: 0.55, sat: 1.0 },
  ];

  function Director(eng) {
    this.eng = eng;
    this.gl = eng.gl;
    const S = SM.SHADERS;
    this.P = {
      part: eng.program(S.PART_VS, S.PART_FS, 'particles'),
      sprite: eng.program(S.SPRITE_VS, S.SPRITE_FS, 'sprite'),
      comp: eng.program(S.FS_VS, S.COMP_FS, 'composite'),
      pre: eng.program(S.FS_VS, S.PRE_FS, 'bloom-pre'),
      down: eng.program(S.FS_VS, S.DOWN_FS, 'bloom-down'),
      up: eng.program(S.FS_VS, S.UP_FS, 'bloom-up'),
      fin: eng.program(S.FS_VS, S.FINAL_FS, 'final'),
      bg: {},
    };
    for (const k in S.BG) this.P.bg[k] = eng.program(S.FS_VS, S.BG[k], 'bg-' + k);
    this.keyArr = new Float32Array(36);
    this.cam = [0, 0, 1];
    this.buildAssets();
    this.resize(eng.canvas.width, eng.canvas.height);
    this.scenes = [this.intro, this.garden, this.music, this.rain, this.stage, this.dawn, this.ending];
  }
  const D = Director.prototype;

  D.resize = function (w, h) {
    const e = this.eng;
    this.W = w; this.H = h;
    this.tA = e.target(w, h);
    this.tB = e.target(w, h);
    this.tC = e.target(w, h);
    this.bl = [];
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 5; i++) { this.bl.push(e.target(Math.max(1, bw), Math.max(1, bh))); bw >>= 1; bh >>= 1; }
  };

  // ---------- 资源 ----------
  D.buildAssets = function () {
    const e = this.eng;
    const st = (cv) => ({ tex: e.canvasTexture(cv), w: cv.width, h: cv.height });
    this.A = {
      branch: st(F.makeBranch()),
      trellis: st(F.makeTrellis()),
      umbrella: st(F.makeUmbrella()),
      cucumber: st(F.makeCucumber()),
      maskS: st(F.makeMask(0)),
      maskM: st(F.makeMask(1)),
    };
    this.L = {
      kids: new F.Layer(e, [-0.78, -0.60, 0.78, 0.32], 700),
      rainM: new F.Layer(e, [0.05, -0.74, 0.85, 0.45], 640),
      rainS: new F.Layer(e, [-1.05, -0.66, 0.15, 0.36], 560),
      stage: new F.Layer(e, [-0.62, -0.66, 0.62, 0.34], 640),
      dawn: new F.Layer(e, [-0.88, -0.50, 0.62, 0.42], 700),
    };
    const SC = SM.SCRIPT;
    const serif = (w, px) => `${w} ${px}px SMSerif, "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
    const latin = (px) => `italic 500 ${px}px SMLatin, "Cormorant Garamond", Georgia, serif`;
    this.T = {
      sa: this.text('祥', { font: serif(600, 200), color: '#e6eeff', glow: 'rgba(120,160,255,0.9)', blur: 40 }),
      mu: this.text('睦', { font: serif(600, 200), color: '#e6fff0', glow: 'rgba(110,230,170,0.9)', blur: 40 }),
      dot: this.text('·', { font: serif(600, 160), color: '#ffffff', glow: 'rgba(255,255,255,0.8)', blur: 30 }),
      sub: this.text(SC.title.sub, { font: latin(50), color: '#f2f0ff', glow: 'rgba(200,210,255,0.6)', blur: 16, spacing: 3 }),
      tag: this.text(SC.title.tag, { font: serif(400, 34), color: '#eceaf6', glow: 'rgba(200,210,255,0.5)', blur: 14, spacing: 6 }),
      endMain: this.text(SC.ending.main, { font: serif(600, 150), color: '#f4f2ff', glow: 'rgba(170,200,255,0.8)', blur: 34, spacing: 10 }),
      fin: this.text(SC.ending.fin, { font: latin(80), color: '#ffffff', glow: 'rgba(220,230,255,0.7)', blur: 20 }),
      c1: this.text(SC.ending.credit1, { font: serif(400, 26), color: '#d9d6e6', glow: 'rgba(0,0,0,0.6)', blur: 8, spacing: 2 }),
      c2: this.text(SC.ending.credit2, { font: serif(400, 22), color: '#bfbcd0', glow: 'rgba(0,0,0,0.6)', blur: 8, spacing: 1 }),
    };
    const sty = {
      n: { color: '#f5efe4', glow: 'rgba(10,6,20,0.85)', blur: 14, glow2: 'rgba(255,230,200,0.25)' },
      s: { color: '#e3ebff', glow: 'rgba(10,20,60,0.85)', blur: 14, glow2: 'rgba(130,165,255,0.55)' },
      m: { color: '#e4f7ec', glow: 'rgba(5,30,20,0.85)', blur: 14, glow2: 'rgba(110,220,165,0.55)' },
    };
    this.caps = SC.captions.map(([a, b, str, k]) => ({ a, b, k, t: this.text(str, Object.assign({ font: serif(k === 'n' ? 400 : 600, 44), spacing: 4 }, sty[k])) }));
  };

  D.text = function (str, o) {
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    ctx.font = o.font;
    if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
    const m = ctx.measureText(str);
    const px = parseFloat(/(\d+)px/.exec(o.font)[1]);
    const pad = Math.ceil((o.blur || 0) * 2.2 + px * 0.15);
    cv.width = Math.ceil(m.width + pad * 2);
    cv.height = Math.ceil(px * 1.45 + pad * 2);
    ctx.font = o.font;
    if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const x = cv.width / 2 + (o.spacing || 0) / 2, y = cv.height / 2 + px * 0.04;
    ctx.fillStyle = o.color;
    if (o.glow2) { ctx.shadowColor = o.glow2; ctx.shadowBlur = o.blur * 2.2; ctx.fillText(str, x, y); }
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur; ctx.fillText(str, x, y); ctx.fillText(str, x, y); }
    ctx.shadowBlur = 0;
    ctx.fillText(str, x, y);
    return { tex: this.eng.canvasTexture(cv), w: cv.width, h: cv.height, em: px };
  };
  const gh = (img, g) => (g * img.h) / img.em;

  // ---------- 绘制助手 ----------
  D.bg = function (name, u) {
    const p = this.P.bg[name].use();
    this.eng.blend(0);
    p.set('uCam', this.cam).setAll(u);
    this.eng.fullscreen();
  };
  D.parts = function (type, count, u) {
    const p = this.P.part.use();
    this.eng.blend(1);
    p.setAll({ uType: type, uCount: count, uCam: this.cam, uPar: 1, uAlpha: 1, uSalt: 1, uCol1: [1, 1, 1], uCol2: [1, 1, 1], uA: [0, 0, 0, 0], uB: [0, 0, 0, 0], uC: [0, 0, 0, 0], uD: [0, 0, 0, 0] });
    p.setAll(u);
    this.eng.quad(count);
  };
  D.sprite = function (img, u) {
    const p = this.P.sprite.use();
    this.eng.blend(1);
    const screen = !!u.screen;
    p.setAll({
      uTex: img.tex, uCam: screen ? [0, 0, 1] : this.cam, uPar: screen ? 0 : 1, uRot: 0, uUV: [0, 0, 1, 1], uMode: 0, uAlpha: 1,
      uTexel: [1 / img.w, 1 / img.h], uRimW: 0, uRimDir: [0, -1], uRim2Dir: [0, -1], uRimCol: [0, 0, 0], uRim2Col: [0, 0, 0],
      uC1: [0, 0, 0], uC2: [0, 0, 0], uC3: [0, 0, 0], uReveal: 1, uBlur: 0, uT: 0, uDissolve: 0, uBoost: 1, uTint: [1, 1, 1], uGlowCol: [0, 0, 0],
    });
    if (u.h && !u.uSize) { const hh = u.h / 2; u.uSize = [(hh * img.w) / img.h, hh]; }
    delete u.h; delete u.screen;
    p.setAll(u);
    this.eng.quad();
  };
  D.layer = function (L, u) {
    L.upload();
    const s = L.spriteArgs();
    this.sprite({ tex: L.tex, w: L.cv.width, h: L.cv.height }, Object.assign({ uPos: s.pos, uSize: s.size, uMode: 1 }, u));
  };
  D.reflect = function (L, groundY, u) {
    const s = L.spriteArgs();
    const pos = [s.pos[0], 2 * groundY - s.pos[1]];
    this.sprite({ tex: L.tex, w: L.cv.width, h: L.cv.height }, Object.assign({ uPos: pos, uSize: [s.size[0], -s.size[1]], uMode: 3 }, u));
  };

  // ---------- 主渲染 ----------
  D.render = function (gt) {
    const e = this.eng;
    gt = U.clamp(gt, 0, M.DURATION);
    let i = 0;
    while (i < BOUNDS.length - 2 && gt >= BOUNDS[i + 1]) i++;
    let a = i, b = -1, m = 0, mode = 0;
    const tin = TRANS[i];
    const tout = TRANS[i + 1];
    if (tin && gt < BOUNDS[i] + tin.d / 2) { a = i - 1; b = i; m = (gt - (BOUNDS[i] - tin.d / 2)) / tin.d; mode = tin.mode; }
    else if (tout && gt > BOUNDS[i + 1] - tout.d / 2) { a = i; b = i + 1; m = (gt - (BOUNDS[i + 1] - tout.d / 2)) / tout.d; mode = tout.mode; }
    m = U.clamp(m);
    this.rainFx = 0;
    e.bind(this.tA); e.clear();
    this.scenes[a].call(this, gt - BOUNDS[a], gt);
    let rainA = this.rainFx, rainB = 0;
    if (b >= 0) {
      this.rainFx = 0;
      e.bind(this.tB); e.clear();
      this.scenes[b].call(this, gt - BOUNDS[b], gt);
      rainB = this.rainFx;
    }
    // 合成
    e.bind(this.tC);
    e.blend(0);
    this.P.comp.use().setAll({ uA: this.tA.tex, uB: this.tB.tex, uMix: b >= 0 ? m : 0, uMode: mode, uRain: U.mix(rainA, rainB, b >= 0 ? m : 0), uT: gt });
    e.fullscreen();
    // 泛光
    const bl = this.bl;
    e.bind(bl[0]);
    this.P.pre.use().setAll({ uTex: this.tC.tex, uTexel: [1 / this.W, 1 / this.H], uThresh: 0.85 });
    e.fullscreen();
    for (let k = 1; k < bl.length; k++) {
      e.bind(bl[k]);
      this.P.down.use().setAll({ uTex: bl[k - 1].tex, uTexel: [1 / bl[k - 1].w, 1 / bl[k - 1].h] });
      e.fullscreen();
    }
    e.blend(2);
    for (let k = bl.length - 1; k > 0; k--) {
      e.bind(bl[k - 1]);
      this.P.up.use().setAll({ uTex: bl[k].tex, uTexel: [1 / bl[k].w, 1 / bl[k].h], uW: 1 });
      e.fullscreen();
    }
    e.blend(0);
    // 输出
    const la = LOOK[a], lb = b >= 0 ? LOOK[b] : la, k = b >= 0 ? U.smooth(0, 1, m) : 0;
    const mixv = (x, y) => (Array.isArray(x) ? x.map((v, j) => U.mix(v, y[j], k)) : U.mix(x, y, k));
    e.bind(null);
    const fade = U.smooth(0.0, 1.2, gt) * (1 - U.smooth(121.4, 122.9, gt));
    this.P.fin.use().setAll({
      uScene: this.tC.tex, uBloom: bl[0].tex, uBloomAmt: mixv(la.bloom, lb.bloom), uExposure: mixv(la.exp, lb.exp), uTint: mixv(la.tint, lb.tint),
      uVig: mixv(la.vig, lb.vig), uSat: mixv(la.sat, lb.sat), uGrain: 0.018, uFade: fade, uT: gt, uRes: [this.W, this.H],
    });
    e.fullscreen();
    this.captions(gt);
  };

  D.captions = function (gt) {
    for (const c of this.caps) {
      if (gt < c.a - 0.1 || gt > c.b + 0.1) continue;
      const al = U.smooth(c.a, c.a + 0.7, gt) * (1 - U.smooth(c.b - 0.8, c.b, gt));
      const rev = U.smooth(c.a, c.a + 1.1, gt);
      const y = -0.80 + 0.012 * (1 - U.easeOut((gt - c.a) / 1.5));
      this.sprite(c.t, { screen: true, uMode: 2, uPos: [0, y], h: c.t.h / 540, uAlpha: al, uReveal: rev });
    }
  };

  // ======================= 第一幕：序章 =======================
  D.intro = function (lt) {
    this.cam = [0, 0, 1.0 + lt * 0.006];
    const neb = U.smooth(0, 3.5, lt);
    const flash = lt > 6 ? Math.exp(-(lt - 6) * 2.2) : 0;
    this.bg('night', { uT: lt, uP: [neb, 0, flash, 1] });
    this.parts(T.STAR, 700, { uT: lt, uAlpha: neb, uPar: 0.3, uSalt: 11 });
    const orbA = 1 - U.smooth(11.0, 12.6, lt);
    this.parts(T.ORB, 440, { uT: lt, uA: [0, 0.008, 0.05, 0], uB: [0.004, 0.028, 0.085, 2.4], uCol1: mul(BLUE, 2.2), uCol2: mul(GREEN, 2.2), uAlpha: orbA, uSalt: 3 });
    this.parts(T.BURST, 520, { uT: lt, uA: [0, 0, 6.0, 1.7], uB: [3.4, 0.016, 1.2, 0.02], uCol1: mul(BLUE, 2.5), uCol2: mul(GREEN, 2.5), uSalt: 5 });
    const ta = U.smooth(6.2, 7.8, lt) * (1 - U.smooth(10.9, 12.3, lt));
    const blur = (1 - U.smooth(6.2, 8.0, lt)) * 7;
    const sc = 1.0 + 0.06 * (1 - U.easeOut((lt - 6.2) / 3));
    const ty = 0.12;
    this.sprite(this.T.sa, { uMode: 4, uPos: [-0.34 * sc, ty], h: gh(this.T.sa, 0.30 * sc), uAlpha: ta, uBlur: blur, uBoost: 1.5 });
    this.sprite(this.T.dot, { uMode: 4, uPos: [0, ty + 0.01], h: gh(this.T.dot, 0.24 * sc), uAlpha: ta * 0.9, uBlur: blur, uBoost: 1.3 });
    this.sprite(this.T.mu, { uMode: 4, uPos: [0.34 * sc, ty], h: gh(this.T.mu, 0.30 * sc), uAlpha: ta, uBlur: blur, uBoost: 1.5 });
    const sa = U.smooth(7.4, 8.8, lt) * (1 - U.smooth(10.9, 12.2, lt));
    this.sprite(this.T.sub, { uMode: 4, uPos: [0, -0.20], h: this.T.sub.h / 540, uAlpha: sa, uReveal: U.smooth(7.4, 9.0, lt), uBoost: 1.1 });
    const ga = U.smooth(8.6, 9.8, lt) * (1 - U.smooth(10.9, 12.2, lt));
    this.sprite(this.T.tag, { uMode: 4, uPos: [0, -0.36], h: this.T.tag.h / 540, uAlpha: ga, uReveal: U.smooth(8.6, 10.2, lt), uBoost: 1.0 });
  };

  // ======================= 第二幕：庭院童年 =======================
  D.garden = function (lt) {
    const camY = U.keys([[0, 0.80], [1.5, 0.80], [10.0, 0.0]], lt);
    this.cam = [0.04 * Math.sin(lt * 0.1), camY, 1.0 + 0.05 * U.smooth(9, 24, lt)];
    this.bg('garden', { uT: lt, uP: [1, 0, 0, 0] });
    const warm = lin('#ffe2b0');
    const tr = this.A.trellis;
    this.sprite(tr, { uPos: [1.08, -0.04], h: 0.98, uTint: [0.95, 0.97, 0.93], uRimW: 3, uRimDir: [0.6, -0.8], uRimCol: mul(warm, 0.8), uPar: 0.9 });
    this.sprite(tr, { uPos: [-1.30, -0.10], uSize: [-0.40, 0.36], uTint: [0.85, 0.9, 0.85], uPar: 0.88 });
    this.parts(T.MOTE, 110, { uT: lt, uA: [0.2, 0.1, 1.9, 1.0], uB: [0.006, 0.024, 0.02, 0.6], uCol1: mul(lin('#fff1c8'), 1.4), uCol2: mul(lin('#ffd9e4'), 1.1), uSalt: 21, uPar: 0.9 });
    // 两个孩子
    const L = this.L.kids;
    L.clear();
    const kh = 0.70, wy = -0.515;
    const offer = U.smooth(10.6, 12.2, lt) * (1 - U.smooth(15.6, 17.2, lt));
    const take = U.smooth(14.0, 15.8, lt);
    const lean = U.smooth(19.0, 21.0, lt);
    const sx = -0.25, mx = 0.25;
    const ks = kh / 430;
    const meet = [0.0, wy + 200 * ks - 0.075];
    const mShoulderL = [mx - 58 * ks, wy + 200 * ks], sShoulderR = [sx + 58 * ks, wy + 200 * ks];
    const mRest = [mShoulderL[0] + 0.02, mShoulderL[1] - 0.20];
    const sRest = [sShoulderR[0] - 0.02, sShoulderR[1] - 0.20];
    const sHold = [sShoulderR[0] - 0.035, sShoulderR[1] - 0.16];
    let sTarget = lerp2(sRest, meet, take);
    if (lt > 16) sTarget = lerp2(meet, sHold, U.smooth(16.0, 18.0, lt));
    const kidT = lt;
    const S = L.kid({ wx: sx, wy, h: kh, hair: 'saki', t: kidT, wind: 0.35, headTilt: 0.04 * Math.sin(lt * 1.1) + 0.10 * U.smooth(14.0, 15.5, lt) * (1 - lean) + 0.24 * lean, armRW: sTarget });
    const Mu = L.kid({ wx: mx, wy, h: kh, hair: 'mutsu', t: kidT + 3, wind: 0.3, headTilt: 0.02 * Math.sin(lt * 0.7 + 1) - 0.12 * U.smooth(10.4, 11.8, lt) * (1 - lean) - 0.10 * lean, armLW: lerp2(mRest, meet, offer) });
    const rim = { uRimW: 4.0, uRimDir: [0.6, -0.8], uRimCol: mul(warm, 2.6), uRim2Dir: [-0.55, -0.83], uRim2Col: mul(lin('#d6e4ff'), 0.3), uT: lt };
    this.splitLayer(L, Object.assign({ uC1: mul(lin('#4a5a8c'), 0.55), uC2: mul(SAKI.hair, 0.75), uC3: mul(SAKI.skin, 0.75) }, rim), { uC1: mul(lin('#56705a'), 0.55), uC2: mul(MUTSU.hair, 0.75) }, 0, true);
    // 黄瓜
    const hold = lt < 16 ? Mu.handL : S.handR;
    const ca = U.smooth(10.4, 11.2, lt) * (1 - U.smooth(18.0, 19.0, lt) * 0.0);
    if (ca > 0.001) {
      const rot = lt < 16 ? 0.35 : -0.6 * U.smooth(16, 18, lt) + 0.35 * (1 - U.smooth(16, 18, lt));
      this.sprite(this.A.cucumber, { uPos: [hold[0] - 0.045 * Math.cos(rot), hold[1] + 0.014], h: 0.062, uRot: rot, uAlpha: ca, uRimW: 2, uRimDir: [0.6, -0.8], uRimCol: mul(warm, 0.9) });
    }
    this.parts(T.MOTE, 26, { uT: lt, uA: [0.0, -0.02, 0.12, 0.22], uB: [0.010, 0.022, 0.05, 1.4], uCol1: lin('#ffb3c8'), uCol2: lin('#ffd6e2'), uC: [2, 0, 0, 0], uAlpha: U.smooth(19.5, 21.0, lt), uSalt: 41 });
    // 前景樱枝
    const br = this.A.branch;
    this.sprite(br, { uPos: [-1.02, 1.30], h: 0.95, uRot: 0.015 * Math.sin(lt * 0.8), uPar: 1.18, uTint: [1.0, 0.98, 0.98], uRimW: 2.5, uRimDir: [0.6, -0.8], uRimCol: mul(warm, 0.6) });
    this.parts(T.PETAL, 260, { uT: lt + 40, uA: [0.22, 0.16, 1.2, -1.2], uB: [1, 1, 1.15, 0.95], uC: [0, 1.05, 0, 0], uSalt: 31 });
  };

  // ======================= 第三幕：钢琴与吉他 =======================
  D.music = function (lt, gt) {
    this.cam = [0.06 * Math.sin(lt * 0.15), 0.02, 1.0 + 0.004 * lt];
    M.keys(gt, this.keyArr);
    const beat = U.clamp(M.level('kick', gt, 0.12));
    const pa = U.clamp(M.level('piano', gt, 0.3) * 0.5, 0, 1.5);
    const ga = U.clamp(M.level('guitar', gt, 0.25) * 0.35, 0, 1.5);
    const dim = U.smooth(15.0, 18.6, lt);
    this.bg('sunset', { uT: lt, uP: [beat, 0, 1.0 - dim * 0.7, ga], uQ: [pa, dim, 0, 0], uKeys: this.keyArr });
    this.parts(T.MOTE, 90, { uT: lt, uA: [0, 0.15, 1.9, 0.9], uB: [0.012, 0.05, 0.015, 0.35], uCol1: lin('#ffd2a0'), uCol2: lin('#ffb0c0'), uAlpha: 1 - dim, uSalt: 51, uPar: 0.6 });
    this.parts(T.NOTE, 70, { uT: lt, uA: [-1.6, 1.6, -0.58, 1.35], uB: [5.0, 0.034, 1.0, 0], uCol1: mul(BLUE, 2.0), uCol2: mul(GREEN, 2.0), uAlpha: 1 - dim, uSalt: 52, uPar: 0.85 });
    this.parts(T.PETAL, 90, { uT: lt + 80, uA: [0.3, 0.14, 1.2, -1.2], uB: [1, 0.9, 1.15, 0.55], uC: [0, 1.2, 0, 0], uAlpha: 1 - dim, uSalt: 53 });
    this.parts(T.BURST, 160, { uT: lt, uA: [0, -0.2, 0.0, 1.2], uB: [2.4, 0.016, 1.0, 0.0], uCol1: mul(BLUE, 2.2), uCol2: mul(GREEN, 2.2), uSalt: 54 });
    const ra = U.smooth(15.5, 18.5, lt);
    if (ra > 0) this.parts(T.RAIN, 260, { uT: lt, uA: [0.10, 2.2, 1.3, -1.3], uB: [0.8, 0.8, 0.6, 1.15], uC: [9, 9, 0.5, 0], uAlpha: ra, uSalt: 55 });
  };

  // ======================= 第四幕：雨夜 =======================
  D.rain = function (lt) {
    const k = U.smooth(0, 24, lt);
    this.cam = [0.16 * k, 0.02 * k, 1.0 + 0.10 * k];
    this.bg('rain', { uT: lt, uP: [1, 1, 1, 1] });
    const lamp = [0.70, 0.86];
    this.parts(T.RAIN, 650, { uT: lt, uA: [0.12, 2.3, 1.3, -1.3], uB: [0.8, 0.75, 0.55, 1.2], uC: [lamp[0], lamp[1], 0.62, 1.8], uPar: 0.7, uSalt: 61 });
    // 祥：渐行渐远
    const LS = this.L.rainS;
    LS.clear();
    const w = U.clamp((lt - 1.0) / 13.0);
    const walking = lt > 0.6 && lt < 14.5;
    const sHgt = U.mix(0.86, 0.50, w);
    const sWy = U.mix(-0.60, -0.36, w), sWx = U.mix(-0.26, -0.72, U.easeInOut(w));
    LS.girl({ wx: sWx, wy: sWy, h: sHgt, hair: 'saki', t: lt, wind: 0.12, walk: walking ? lt * 0.85 : null, headDown: 6, armL: { a1: 0.12 + (walking ? 0.10 * Math.sin(lt * 0.85 * Math.PI * 2) : 0), a2: 0.1 }, armR: { a1: 0.12 - (walking ? 0.10 * Math.sin(lt * 0.85 * Math.PI * 2) : 0), a2: 0.1 }, tailBounce: walking ? 6 * Math.abs(Math.sin(lt * 0.85 * Math.PI * 2)) : 0 });
    const dis = U.smooth(9.5, 14.6, lt);
    const cool = lin('#9fb6ff');
    const sCol = { uC1: mul(SAKI.body, 0.22), uC2: mul(SAKI.hair, 0.24), uC3: mul(SAKI.skin, 0.22), uRimW: 2.5, uRimDir: [0, -1], uRimCol: mul(cool, 0.9), uRim2Dir: [0.8, -0.6], uRim2Col: mul(lin('#ffc890'), 0.35), uT: lt };
    if (dis < 1) {
      this.layer(LS, Object.assign({ uDissolve: dis, uGlowCol: mul(BLUE, 2.5) }, sCol));
      this.reflect(LS, sWy, Object.assign({ uDissolve: dis }, sCol));
    }
    // 睦：撑伞伫立
    const LM = this.L.rainM;
    LM.clear();
    const mWx = 0.42, mWy = -0.66, mH = 0.95;
    const hand = [mWx + 0.11, mWy + 0.71];
    const R = LM.girl({ wx: mWx, wy: mWy, h: mH, hair: 'mutsu', t: lt, wind: 0.10, headDown: 14 * U.smooth(12.5, 15.5, lt), headTilt: -0.05 * U.smooth(2, 6, lt) * (1 - U.smooth(12, 15, lt)), armRW: hand, armL: { a1: 0.10, a2: 0.12 } });
    const warm = lin('#ffcf8a');
    const mCol = { uC1: mul(MUTSU.body, 0.24), uC2: mul(MUTSU.hair, 0.24), uC3: mul(MUTSU.skin, 0.24), uRimW: 2.8, uRimDir: [0.32, -0.95], uRimCol: mul(warm, 1.6), uRim2Dir: [-0.8, -0.6], uRim2Col: mul(cool, 0.45), uT: lt };
    this.reflect(LM, mWy, mCol);
    this.layer(LM, mCol);
    // 伞
    const um = this.A.umbrella;
    const uw = 0.62, s = uw / um.w;
    const rot = -0.12;
    const hp = R.handR;
    const off = [(um.w / 2 - 420) * s, (630 - um.h / 2) * s];
    const c = [hp[0] + off[0] * Math.cos(rot) - off[1] * Math.sin(rot), hp[1] + off[0] * Math.sin(rot) + off[1] * Math.cos(rot)];
    this.sprite(um, { uPos: c, uSize: [uw / 2, (um.h * s) / 2], uRot: rot, uTint: [0.55, 0.6, 0.75], uRimW: 3, uRimDir: [0.3, -0.95], uRimCol: mul(warm, 1.3) });
    this.parts(T.RAIN, 240, { uT: lt + 3, uA: [0.12, 2.6, 1.3, -1.3], uB: [1.3, 1.25, 0.75, 1.2], uC: [lamp[0], lamp[1], 0.62, 1.6], uPar: 1.0, uSalt: 62 });
    this.rainFx = U.smooth(0.5, 3.0, lt) * (1 - U.smooth(22.0, 24.6, lt));
  };

  // ======================= 第五幕：假面舞台 =======================
  D.stage = function (lt, gt) {
    this.cam = [0, 0.02, 1.0 + 0.05 * U.smooth(0, 18, lt)];
    const open = U.smooth(0.2, 3.6, lt);
    const bell = U.clamp(M.level('bell', gt, 0.7) * 1.2);
    const glow = 0.3 + 0.9 * U.smooth(0.5, 4.0, lt);
    const conv = U.smooth(5.5, 8.5, lt);
    const msx = U.mix(-0.62, -0.20, conv), mmx = -msx;
    const B1 = [-1.15, 1.15, U.mix(msx, -0.16, U.smooth(9, 11, lt)), -0.58];
    const B2 = [1.15, 1.15, U.mix(mmx, 0.16, U.smooth(9, 11, lt)), -0.58];
    const B3 = [0, 1.25, 0, -0.60];
    const BI = [U.smooth(0.4, 1.6, lt) * (1 - 0.45 * U.smooth(9, 11, lt)), U.smooth(1.0, 2.2, lt) * (1 - 0.45 * U.smooth(9, 11, lt)), 0.55 * U.smooth(8.5, 10.8, lt)];
    this.bg('stage', { uT: lt, uP: [open, glow, bell, 1.0], uB1: B1, uB2: B2, uB3: B3, uBI: BI });
    this.parts(T.DUST, 520, { uT: lt, uB1: B1, uB2: B2, uB3: B3, uBI: BI, uB: [0, 0, 0, 1.4], uSalt: 71 });
    // 面具
    const ma = U.smooth(0.8, 2.6, lt);
    const mdis = U.smooth(8.4, 10.4, lt);
    if (mdis < 1) {
      for (const [img, x, ph, col] of [[this.A.maskS, msx, 0, BLUE], [this.A.maskM, mmx, 1.7, GREEN]]) {
        const yaw = Math.cos(0.55 * Math.sin(lt * 0.6 + ph));
        const y = 0.06 + 0.03 * Math.sin(lt * 0.9 + ph);
        this.sprite(img, { uPos: [x, y], uSize: [0.40 * yaw, 0.40 * img.h / img.w], uRot: 0.06 * Math.sin(lt * 0.7 + ph), uAlpha: ma, uTint: [0.95, 0.95, 1.0], uBoost: 0.85 + 0.25 * bell, uRimW: 3, uRimDir: [0, -1], uRimCol: mul(col, 1.6), uDissolve: mdis, uGlowCol: mul(col, 3.0) });
      }
    }
    this.parts(T.BURST, 400, { uT: lt, uA: [0, 0.06, 9.2, 1.6], uB: [3.0, 0.02, 1.4, 0.03], uCol1: mul(BLUE, 2.5), uCol2: mul(GREEN, 2.5), uSalt: 72 });
    // 两人身着礼服
    const fa = U.smooth(9.0, 11.2, lt);
    if (fa > 0) {
      const L = this.L.stage;
      L.clear();
      const wy = -0.60, h = 0.88;
      const reach = U.smooth(13.0, 16.0, lt);
      const mSh = [0.16 - 64 * h / 1000, wy + 802 * h / 1000];
      L.girl({ wx: -0.16, wy, h, hair: 'saki', dress: 'gown', t: lt, wind: 0.08, headTilt: 0.03 * U.smooth(14, 17, lt) });
      L.girl({ wx: 0.16, wy, h, hair: 'mutsu', dress: 'gown', t: lt + 2, wind: 0.08, armLW: lerp2([mSh[0] + 0.01, mSh[1] - 0.29], [mSh[0] - 0.06, mSh[1] - 0.26], reach), headTilt: -0.04 * U.smooth(14, 17, lt) });
      const sCol = { uC1: mul(lin('#241a30'), 0.55), uC2: mul(SAKI.hair, 0.55), uC3: mul(lin('#d8d0e8'), 0.30), uRimW: 3, uRimDir: [0, -1], uRimCol: mul(lin('#fff2e8'), 2.2), uRim2Dir: [0, 1], uRim2Col: mul(lin('#c070ff'), 0.4), uAlpha: fa, uT: lt };
      // 左半（祥）与右半（睦）头发颜色不同：分两次绘制并用 UV 裁切
      this.splitLayer(L, sCol, { uC2: mul(MUTSU.hair, 0.55) }, wy);
    }
    this.parts(T.PETAL, 200, { uT: lt + 120, uA: [0.15, 0.12, 1.2, -1.2], uB: [1, 1.1, 1.1, 0.9], uC: [1, 1.0, 0, 0], uAlpha: U.smooth(1, 3.5, lt), uSalt: 73 });
  };

  // 双人画布：左半按祥的配色，右半按睦的配色（两人之间按 x=0 切分）
  D.splitLayer = function (L, colA, overB, groundY, noReflect) {
    L.upload();
    const s = L.spriteArgs();
    const r = L.rect;
    const cut = (0 - r[0]) / (r[2] - r[0]);
    const img = { tex: L.tex, w: L.cv.width, h: L.cv.height };
    const colB = Object.assign({}, colA, overB);
    const halves = [[r[0], 0, 0, cut, colA], [0, r[2], cut, 1 - cut, colB]];
    for (const [x0, x1, u0, uw, col] of halves) {
      const pos = [(x0 + x1) / 2, s.pos[1]], size = [(x1 - x0) / 2, s.size[1]];
      if (!noReflect) this.sprite(img, Object.assign({}, col, { uPos: [pos[0], 2 * groundY - pos[1]], uSize: [size[0], -size[1]], uMode: 3, uUV: [u0, 0, uw, 1] }));
      this.sprite(img, Object.assign({}, col, { uPos: pos, uSize: size, uMode: 1, uUV: [u0, 0, uw, 1] }));
    }
  };

  // ======================= 第六幕：雨停 · 重逢 =======================
  D.dawn = function (lt) {
    const d = U.smooth(0.5, 11, lt);
    const part = U.smooth(1, 10, lt);
    const sunH = U.smooth(1, 16, lt);
    this.cam = [0, U.mix(-0.04, 0.10, U.smooth(8, 20, lt)), U.mix(1.12, 1.0, U.smooth(0, 18, lt))];
    this.bg('dawn', { uT: lt, uP: [d, part, sunH, 0] });
    const ra = 1 - U.smooth(0.3, 3.6, lt);
    if (ra > 0) this.parts(T.RAIN, 400, { uT: lt, uA: [0.08, 2.0, 1.3, -1.3], uB: [0.9, 0.8, 0.5, 1.2], uC: [9, 9, 0.5, 0], uAlpha: ra, uSalt: 81 });
    this.parts(T.MOTE, 120, { uT: lt, uA: [0, 0.1, 1.9, 1.0], uB: [0.006, 0.022, 0.025, 0.8], uCol1: mul(lin('#ffe6b8'), 1.4), uCol2: mul(lin('#ffd0dc'), 1.2), uAlpha: d, uSalt: 82, uPar: 0.8 });
    // 两人
    const L = this.L.dawn;
    L.clear();
    const hill = (x) => -0.53 + 0.10 * Math.cos(x * 0.85) - 0.02 * x;
    const h = 0.80;
    const walkK = U.smooth(2.2, 6.6, lt);
    const sWx = U.mix(-0.52, -0.125, walkK), mWx = 0.125;
    const walking = lt > 2.0 && lt < 6.8;
    const sSh = [sWx + 64 * h / 1000, hill(sWx) - 0.008 + 802 * h / 1000];
    const mSh = [mWx - 64 * h / 1000, hill(mWx) - 0.008 + 802 * h / 1000];
    const reach = U.smooth(6.4, 8.8, lt);
    const meet = [(sSh[0] + mSh[0]) / 2, Math.min(sSh[1], mSh[1]) - 0.215];
    const sRest = [sSh[0] - 0.012, sSh[1] - 0.265], mRest = [mSh[0] + 0.012, mSh[1] - 0.265];
    const lean = U.smooth(15.0, 17.2, lt);
    const wph = lt * 0.9 * Math.PI * 2;
    L.girl({
      wx: sWx, wy: hill(sWx) - 0.008, h, hair: 'saki', t: lt, wind: 0.35, walk: walking ? lt * 0.9 : null,
      armRW: lerp2(sRest, meet, reach), armL: { a1: 0.12 + (walking ? 0.12 * Math.sin(wph) : 0), a2: 0.1 },
      headTilt: 0.20 * lean + 0.03 * U.smooth(6, 8, lt), headDown: 6 * lean, tailBounce: walking ? 6 * Math.abs(Math.sin(wph)) : 0,
    });
    L.girl({
      wx: mWx, wy: hill(mWx) - 0.008, h, hair: 'mutsu', t: lt + 2, wind: 0.35,
      armLW: lerp2(mRest, meet, reach), armR: { a1: 0.08, a2: 0.08 },
      headTilt: -0.12 * U.smooth(12.4, 14.2, lt) + 0.04 * lean,
    });
    const gold = lin('#ffd49a');
    const col = {
      uC1: mul(lin('#1e2236'), U.mix(0.35, 0.55, d)), uC2: mul(SAKI.hair, U.mix(0.35, 0.62, d)), uC3: mul(lin('#9c7a76'), U.mix(0.3, 0.55, d)),
      uRimW: 3.2, uRimDir: [0.0, 1.0], uRimCol: mul(gold, 0.5 + 1.3 * d), uRim2Dir: [0, -1], uRim2Col: mul(lin('#ffc0d0'), 0.25 + 0.45 * d), uT: lt,
    };
    this.splitLayer(L, col, { uC2: mul(MUTSU.hair, U.mix(0.35, 0.62, d)) }, 0, true);
    // 双螺旋 → 爱心
    const morph = U.smooth(14.6, 17.6, lt);
    const ha = 1 - U.smooth(20.4, 21.8, lt);
    if (lt > 8.6) this.parts(T.HELIX, 900, { uT: lt, uA: [meet[0], meet[1], 9.0, morph], uB: [0.72, 0.085, 0.011, 1.3], uC: [0.0, 0.66, 0.25, 0], uCol1: mul(BLUE, 2.4), uCol2: mul(GREEN, 2.4), uAlpha: ha, uSalt: 83 });
    this.parts(T.BURST, 420, { uT: lt, uA: [0.0, 0.66, 17.4, 1.5], uB: [3.2, 0.02, 1.4, 0.02], uCol1: mul(BLUE, 2.6), uCol2: mul(lin('#ffd0e0'), 2.4), uSalt: 84 });
    this.parts(T.PETAL, 220, { uT: lt + 200, uA: [0.25, 0.15, 1.2, -1.2], uB: [1, 1, 1.15, 0.9], uC: [0, 1.15, 0, 0], uAlpha: U.smooth(7.0, 10.0, lt), uSalt: 85 });
  };

  // ======================= 终章 =======================
  D.ending = function (lt) {
    this.cam = [0, 0, 1.0 + 0.004 * lt];
    this.bg('night', { uT: lt + 30, uP: [0.55, 1.0, 0, 0.9] });
    this.parts(T.STAR, 600, { uT: lt + 30, uAlpha: 0.8, uPar: 0.3, uSalt: 91 });
    this.parts(T.ORB, 440, { uT: lt, uA: [1, 0.012, 0.05, 0], uB: [0.004, 0.026, 0.07, 2.2], uCol1: mul(BLUE, 2.2), uCol2: mul(GREEN, 2.2), uAlpha: U.smooth(-0.6, 1.0, lt), uSalt: 92 });
    const a1 = U.smooth(0.3, 1.6, lt);
    this.sprite(this.T.endMain, { uMode: 4, uPos: [0, 0.14], h: gh(this.T.endMain, 0.22), uAlpha: a1, uBlur: (1 - a1) * 6, uBoost: 1.35 });
    const a2 = U.smooth(1.3, 2.4, lt);
    this.sprite(this.T.fin, { uMode: 4, uPos: [0, -0.10], h: this.T.fin.h / 540, uAlpha: a2, uReveal: U.smooth(1.3, 2.6, lt), uBoost: 1.2 });
    const a3 = U.smooth(2.0, 3.0, lt);
    this.sprite(this.T.c1, { uMode: 4, uPos: [0, -0.60], h: this.T.c1.h / 540, uAlpha: a3 * 0.9 });
    this.sprite(this.T.c2, { uMode: 4, uPos: [0, -0.68], h: this.T.c2.h / 540, uAlpha: a3 * 0.8 });
  };

  SM.Director = Director;
})();
