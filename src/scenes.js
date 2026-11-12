// =====================================================================
//  SCENES — choreography for each chapter (local time tl, seconds)
// =====================================================================
const G0 = { expo: 1, sat: 1, gamma: 1, lift: [0, 0, 0], gain: [1, 1, 1], vig: .5, bloom: .6, th: .6, grain: .04, leak: 0, ca: .0015, box: 1 };
function baseState() {
  return { cam: { x: 960, y: 540, z: 1 }, light: [960, 300], amb: [.5, .5, .5], rim: [1, 1, 1], rimW: 3, omni: .4, P0: [0, 0, 0, 0], P1: [0, 0, 0, 0], P2: [0, 0, 0, 0], met: null, refl: null, parts: [], flares: [], emis: false, grade: Object.assign({}, G0), fadeB: 0, fadeW: 0, lens: 0 };
}
const W2S = (st, x, y, d = 1) => { const z = 1 + (st.cam.z - 1) * d; return [(x - 960 - (st.cam.x - 960) * d) * z + 960, (y - 540 - (st.cam.y - 540) * d) * z + 540]; };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
function grade(o) { return Object.assign({}, G0, o); }
function lensFlare(st, L, k, col) {
  st.flares.push([L[0], L[1], 150, .32 * k, col[0], col[1], col[2], 2]);
  const C = [960, 540];
  [[.45, 26, .07], [1.25, 54, .045], [1.65, 18, .09], [2.05, 88, .03]].forEach(([f, r, a]) => st.flares.push([lerp(L[0], C[0], f), lerp(L[1], C[1], f), r, a * k, col[0] * .8, col[1], col[2] * 1.1, 0]));
}
function twinLights(st, c, t, amp, rad, wobble = 0) {
  if (amp <= 0) return;
  const pos = (tt, ph) => { const a = tt * 1.15 + ph; return [c[0] + Math.cos(a) * rad * (1 + .25 * Math.sin(tt * .7 + ph)) , c[1] + Math.sin(a) * rad * .55 + Math.sin(tt * .9 + ph) * wobble]; };
  [[0, [.55, .72, 1]], [Math.PI, [.55, 1, .74]]].forEach(([ph, col]) => {
    for (let i = 26; i >= 1; i--) { const p = W2S(st, ...pos(t - i * .05, ph)); const k = Math.pow(1 - i / 27, 1.6); st.flares.push([p[0], p[1], 22 * k + 6, .32 * k * amp, col[0], col[1], col[2], 0]); }
    const p = W2S(st, ...pos(t, ph));
    st.flares.push([p[0], p[1], 70, .95 * amp, col[0], col[1], col[2], 1]);
    st.flares.push([p[0], p[1], 190, .22 * amp, col[0], col[1], col[2], 0]);
    st.flares.push([p[0], p[1], 46, .28 * amp, col[0], col[1], col[2], 2]);
  });
}
const blink = (t, seed) => { const p = (t * .37 + seed) % 1; return p > .965 ? 'closed' : 'open'; };
function walkInfo(posFn, t, R, amtDiv) {
  const x = posFn(t), v = (posFn(t + .05) - posFn(t - .05)) / .1;
  return { x, amt: clamp(Math.abs(v) / amtDiv), ph: (x / (4 * R.thigh * .24)) * TAU };
}

// ───────────────────────────────────────────────────────── 0 · Prologue
function stPrologue(tl) {
  const st = baseState();
  st.P0 = [ss(0, 5, tl), 0, 0, 0];
  st.cam = { x: 960, y: 540 - 30 * ss(0, 20, tl), z: 1 + .05 * ss(0, 20, tl) };
  const c = [lerp(700, 960, ss(0, 15, tl)), lerp(420, 300, ss(0, 13, tl)) + 520 * ss(15, 20.5, tl)];
  twinLights(st, c, tl, ss(1.2, 4.5, tl), 74 * (1 - .45 * ss(14, 19, tl)), 10);
  st.grade = grade({ expo: 1.05, sat: 1.12, vig: .65, bloom: .95, th: .42, grain: .05, ca: .002, lift: [0, .005, .02] });
  return st;
}

// ───────────────────────────────────────────────────────── 1 · Dusk / cucumbers
let TRELLIS = null;
function stDusk(tl) {
  const st = baseState();
  st.cam = { x: kf(tl, [[-2, 1040], [30, 960], [40, 950]]), y: kf(tl, [[-2, 540], [31, 540], [40, 508]]), z: kf(tl, [[-2, 1.08], [28, 1.0], [40, 1.03]]) };
  const sun = W2S(st, 935, 612, .1);
  st.P0 = [sun[0], sun[1], 0, 0];
  st.light = sun; st.amb = [.3, .22, .26]; st.rim = [.9, .62, .4]; st.omni = .25; st.rimW = 2.6;
  st.parts = [{ type: 0, n: 150, p: [.95, 0, 0, 1] }, { type: 1, n: 40, p: [ss(24, 31, tl) * .95, 0], p2: [480, 640, 1900, 880] }];
  lensFlare(st, sun, 1, [1, .78, .52]);
  st.grade = grade({ expo: 1.02, sat: 1.1, lift: [.015, 0, .03], gamma: 1.0, gain: [1.05, .99, .92], vig: .5, bloom: .48, th: .7, grain: .045, leak: .45, ca: .0015 });
  const D = duskPose(tl);
  if (D.promise > 0) { const p = W2S(st, D.meet[0], D.meet[1]); st.flares.push([p[0], p[1], 46, .6 * D.promise * (.75 + .25 * Math.sin(tl * 3)), 1, .85, .6, 1]); }
  st.D = D;
  return st;
}
function duskPose(tl) {
  const R = RIG.child, s = 1, Y = 880;
  const sPos = t => 360 + (820 - 360) * easeIO(clamp((t - 3) / 9)) + 35 * ss(28, 30.5, t);
  const mPos = t => 1200 - 170 * easeIO(clamp((t - 12.8) / 3)) - 30 * ss(28, 30.5, t);
  const sw = walkInfo(sPos, tl, R, 55), mw = walkInfo(mPos, tl, R, 55);
  const S = { who: 'saki', rig: 'child', outfit: 'childS', view: 'side', f: 1, x: sw.x, y: Y, s, t: tl, walk: sw.amt, ph: sw.ph, hairAmp: 1 + sw.amt, eyes: blink(tl, .1) };
  const M = { who: 'mutsu', rig: 'child', outfit: 'childM', view: 'side', f: tl < 12.6 ? 1 : -1, x: mw.x, y: Y, s, t: tl + 3, walk: mw.amt, ph: mw.ph + 1, hairAmp: .8 + mw.amt, eyes: blink(tl, .55) };
  const SH = standHands(R, 'side');
  const meet = [(sw.x + mw.x) / 2, Y + (R.shY + 66) * s];
  const promise = ss(29.5, 31.5, tl);
  // Mutsumi: reach, pick, hold, offer, promise
  const cuke = TRELLIS ? TRELLIS.cukes[0] : { x: 1288, y: 676 };
  const reach = ss(1.5, 4, tl) * (1 - ss(6.4, 8.4, tl));
  const offer = ss(14.6, 16.6, tl) * (1 - ss(21, 23, tl));
  const pick = tl > 6.3;
  let mh = [SH.hn[0], SH.hn[1]];
  const chest = [20, R.shY + 72];
  if (pick) mh = [lerp(mh[0], chest[0], ss(6.4, 8.4, tl) * (1 - ss(21, 23, tl))), lerp(mh[1], chest[1], ss(6.4, 8.4, tl) * (1 - ss(21, 23, tl)))];
  const cl = toLocal(M, cuke.x - 4, cuke.y + 2);
  mh = [lerp(mh[0], cl[0], reach), lerp(mh[1], cl[1], reach)];
  mh = [lerp(mh[0], 54, offer), lerp(mh[1], R.shY + 44, offer)];
  const ml = toLocal(M, meet[0], meet[1]);
  mh = [lerp(mh[0], ml[0], promise), lerp(mh[1], ml[1], promise)];
  M.hn = mh;
  const mHas = pick && tl < 20.5;
  if (mHas) M.heldN = h => cucumber(this_g(), h[0], h[1], tl < 12.6 ? -.4 : .5, .78);
  M.tilt = .1 * ss(21, 23, tl) * (1 - ss(28, 30, tl)) - .04 * promise;
  // Sakiko: take, raise, hop, promise
  const SH2 = gait(R, sw.ph, sw.amt);
  let sh = sw.amt > .02 ? [SH2.hn[0], SH2.hn[1]] : [SH.hn[0], SH.hn[1]];
  const mHandW = [M.x + mh[0] * s * M.f, Y + mh[1] * s];
  const take = ss(17.8, 20.3, tl) * (1 - ss(21, 22.4, tl));
  const tlocal = toLocal(S, mHandW[0] + 6, mHandW[1]);
  sh = [lerp(sh[0], tlocal[0], take), lerp(sh[1], tlocal[1], take)];
  const raise = ss(21.6, 23, tl) * (1 - ss(26.4, 27.6, tl));
  sh = [lerp(sh[0], 14, raise), lerp(sh[1], R.headY - 40, raise)];
  const sl = toLocal(S, meet[0], meet[1]);
  sh = [lerp(sh[0], sl[0], promise), lerp(sh[1], sl[1], promise)];
  S.hn = sh;
  const hops = ss(22.4, 23, tl) * (1 - ss(25.6, 26.2, tl));
  S.bob = -Math.abs(Math.sin(tl * 6.5)) * 9 * hops;
  if (tl > 20.5 && tl < 27.6) S.heldN = h => cucumber(this_g(), h[0], h[1], -1.1 + raise * .6, .78);
  if (tl >= 27.6) { S.hf = [12, R.shY + 70]; S.heldF = h => cucumber(this_g(), h[0], h[1], -.9, .74); }
  if ((tl > 22.4 && tl < 27.2) || (tl > 31.5 && tl < 35)) S.eyes = 'closed';
  S.tilt = .06 * ss(18, 19.5, tl) * (1 - ss(21, 22, tl)) + .05 * promise;
  return { S, M, promise, meet, picked: pick };
}
let _g = null; const this_g = () => _g;
function drDusk(g, tl, st) {
  _g = g; const t = tl;
  if (!TRELLIS) TRELLIS = makeTrellis();
  const gy = x => 882 + 6 * Math.sin(x * .006);
  g.fillStyle = '#4f6a3e'; g.beginPath(); g.moveTo(-600, 1300); for (let x = -600; x <= 2600; x += 40) g.lineTo(x, gy(x)); g.lineTo(2600, 1300); g.closePath(); g.fill();
  grass(g, -600, 2600, gy, 7, 6, 18, t, '#4a6538', 3);
  drawTrellis(g, TRELLIS, t, st.D.picked);
  fig(g, st.D.M); fig(g, st.D.S);
  grass(g, -600, 2600, x => 1004 + 10 * Math.sin(x * .01), 12, 26, 66, t, '#2f4527', 7, 1.4);
  for (let i = 0; i < 26; i++) { const x = -300 + i * 103 + Math.sin(i * 7.1) * 30, y = 905 + (i % 4) * 22; ell(g, x, y, 3.4, 3.4, i % 3 ? '#f4f0e6' : '#f2d14a'); }
}

// ───────────────────────────────────────────────────────── 2a · Sakura walk
let TREES = null;
function walkDist(t) { let x = 0; const dt = 1 / 60; for (let u = 0; u < t; u += dt) x += 95 * (1 - ss(6.5, 8.5, u)) * Math.min(dt, t - u); return x; }
function stWalk(tl) {
  const st = baseState();
  const X = walkDist(Math.max(0, tl)) + Math.min(0, tl) * 95;
  st.cam = { x: 960 + X, y: 540, z: 1 + .035 * ss(8, 20, tl) };
  st.X = X;
  st.light = [1560, 170]; st.amb = [.95, .88, .92]; st.rim = [1, .93, .9]; st.omni = .18; st.rimW = 2.5;
  st.parts = [{ type: 2, n: 240, p: [1, 38, .9, 1] }];
  lensFlare(st, [1560, 170], .7, [1, .95, .9]);
  st.grade = grade({ expo: 1.02, sat: .96, lift: [.05, .03, .06], gamma: 1, gain: [1.02, .98, 1], vig: .35, bloom: .45, th: .8, grain: .035, leak: .35, ca: .001 });
  return st;
}
function drWalk(g, tl, st) {
  _g = g;
  if (!TREES) TREES = [makeTree(3), makeTree(8), makeTree(21)];
  const R = RIG.teen, X = st.X, speed = 95 * (1 - ss(6.5, 8.5, tl)), amt = clamp(speed / 95);
  for (let i = 0; i < 6; i++) { const tx = 520 + i * 820, tr = TREES[i % 3]; g.drawImage(tr, tx - 600, 836 - 920, 1200, 920); }
  const ph = X / (4 * R.thigh * .24) * TAU;
  const turn = tl > 8.8;
  const M = { who: 'mutsu', view: 'side', f: 1, x: st.cam.x - 110, y: 890, s: .86, t: tl, walk: amt, ph: ph + 1.4, hairAmp: 1.1, wind: .35, case: true, eyes: blink(tl, .3) };
  const S = { who: 'saki', view: 'side', f: turn ? -1 : 1, x: st.cam.x + 60, y: 912, s: .9, t: tl + 2, walk: amt, ph, hairAmp: 1.3, wind: turn ? -.35 : .35, eyes: blink(tl, .8) };
  const off = ss(12.4, 14.4, tl);
  const meet = [lerp(S.x, M.x, .5), 912 - 250];
  if (off > 0) { const l = toLocal(S, lerp(S.x - 60, meet[0], ss(17.6, 19.4, tl)), lerp(912 - 260, meet[1], ss(17.6, 19.4, tl))); S.hn = [lerp(7, l[0], off), lerp(R.shY + 150, l[1], off)]; }
  const take = ss(17.6, 19.4, tl);
  if (take > 0) { const l = toLocal(M, meet[0] - 4, meet[1] + 4); M.hn = [lerp(4, l[0], take), lerp(R.shY + 150, l[1], take)]; }
  const nod = ss(16.4, 16.8, tl) * (1 - ss(17, 17.6, tl));
  M.headDY = 6 * nod; M.tilt = .14 * nod;
  S.tilt = turn ? .05 : 0;
  if (tl > 12.8 && tl < 14.6) S.eyes = 'closed';
  fig(g, M); fig(g, S);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); const v = VIEW; g.setTransform(v.s, 0, 0, v.s, v.ox, v.oy);
  g.drawImage(TREES[1], -900 + Math.sin(tl * .4) * 6, -620, 1560, 1196);
  g.restore();
}

// ───────────────────────────────────────────────────────── 2b · Stage
function stStage(tl) {
  const st = baseState();
  const b = (tl + 80) / BEAT; st.beat = b;
  const on = ss(.05, 1.0, tl);
  st.P0 = [on, b, 0, 0];
  st.cam = { x: 960, y: 540 + 8 * Math.sin(tl * .25), z: kf(tl, [[0, 1.0], [14, 1.09], [20, 1.05]]) };
  st.light = [960, 70]; st.amb = [.2, .17, .3]; st.rim = [.8, .86, 1.05]; st.omni = .7; st.rimW = 3.5;
  const fy = W2S(st, 0, 862)[1]; st.refl = { y: fy, k: .3, rip: 0 };
  st.parts = [{ type: 5, n: 130, p: [on, b, 0, 0] }];
  for (let i = 0; i < 9; i++) st.flares.push([160 + i * 200, 135, 34, .35 * on * (.7 + .3 * Math.sin(tl * 2 + i)), 1, .92, .82, 1]);
  st.flares.push([960, 470, 520, .05 * on * (1 + Math.cos(b * TAU)), .6, .5, 1, 0]);
  st.grade = grade({ expo: 1.08, sat: 1.12, lift: [.02, 0, .05], gain: [1, .98, 1.06], vig: .55, bloom: .9, th: .48, grain: .05, ca: .0025 });
  st.fadeW = .25 * Math.pow(1 - ss(.0, .5, tl), 2) * ss(-.1, .05, tl);
  return st;
}
function drStage(g, tl, st) {
  _g = g; const b = st.beat, bp = b % 1;
  poly(g, [[-300, 862], [2200, 862], [2200, 875], [-300, 875]], '#121018');
  for (const ax of [360, 1560]) { poly(g, [[ax - 80, 862], [ax + 80, 862], [ax + 80, 662], [ax - 80, 662]], '#1b1a21'); for (const yy of [712, 800]) ell(g, ax, yy, 46, 46, '#26252d'); }
  g.strokeStyle = '#18171d'; g.lineWidth = 5; g.beginPath(); g.moveTo(960, 862); g.lineTo(960, 640); g.lineTo(985, 612); g.stroke(); ell(g, 990, 606, 9, 7, '#202027', -.6);
  poly(g, [[930, 862], [990, 862], [960, 850]], '#18171d');
  const S = { who: 'saki', view: 'front', x: 700, y: 862, s: .92, t: tl, eyes: 'closed', mouth: 'none', headDY: 3 * Math.abs(Math.sin(Math.PI * b)), tilt: .05 * Math.sin(tl * .9),
    hl: [-62 + 14 * Math.sin(tl * 4.3), -266], hr: [58 + 12 * Math.sin(tl * 3.7 + 1), -266], preArms: g2 => keyboard(g2, 0, 0, 1), hairAmp: 1.1 };
  const M = { who: 'mutsu', view: 'front', x: 1225, y: 862, s: .92, t: tl + 1, eyes: 'closed', mouth: 'none', guitar: true, strum: 11 * Math.sin(b * TAU * 2), tilt: -.07, headDY: 2 + 2 * Math.abs(Math.sin(Math.PI * b)) };
  fig(g, S); fig(g, M);
  const r = mulberry32(4);
  for (let i = 0; i < 34; i++) { const x = -260 + i * 72 + r() * 30, y = 966 + r() * 26 + Math.abs(Math.sin(Math.PI * (b + r()))) * -7; ell(g, x, y, 22 + r() * 6, 26, '#0b0a10'); ell(g, x, y + 66, 54, 46, '#0b0a10'); }
}

// ───────────────────────────────────────────────────────── 3 · Rain
function stRain(tl) {
  const st = baseState();
  st.cam = { x: kf(tl, [[0, 960], [10, 960], [30, 1078], [40, 1088]]), y: kf(tl, [[0, 540], [10, 540], [30, 575], [40, 580]]), z: kf(tl, [[0, 1.0], [10, 1.0], [30, 1.2], [40, 1.23]]) };
  const lamp = W2S(st, 1236, 336);
  const flash = (tl > 4.8 && tl < 5.4 ? .35 * Math.abs(Math.sin((tl - 4.8) * 18)) : 0) + (tl > 38.9 && tl < 39.3 ? 1 : 0) + ss(39.4, 40, tl);
  st.P0 = [lamp[0], lamp[1], 1, 0]; st.P1 = [flash, 0, 0, 0];
  st.light = lamp; st.amb = [.12, .15, .23]; st.rim = [1, .82, .58]; st.omni = .3;
  st.refl = { y: W2S(st, 0, 905)[1], k: .5, rip: 2.2 };
  st.parts = [{ type: 3, n: 1200, p: [ss(-1, 1.5, tl), -170, 0, 0], p2: [lamp[0], lamp[1], 0, 0] }];
  st.flares.push([lamp[0], lamp[1] + 4, 60 * st.cam.z, .9, 1, .84, .6, 1]);
  st.flares.push([lamp[0], lamp[1] + 4, 200 * st.cam.z, .2, 1, .8, .55, 0]);
  st.emis = true; st.lens = .0018 * ss(1, 5, tl);
  st.fadeW = (tl > 38.9 && tl < 39.25 ? .55 : 0);
  st.grade = grade({ expo: 1.02, sat: .78, lift: [0, .02, .05], gamma: 1.04, gain: [.92, 1, 1.1], vig: .65, bloom: .72, th: .5, grain: .06, ca: .0025 });
  return st;
}
function drRain(g, tl, st, e) {
  _g = g; const R = RIG.teen;
  g.fillStyle = '#26272e'; g.fillRect(1284, 300, 12, 612);
  g.strokeStyle = '#26272e'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(1290, 306); g.quadraticCurveTo(1290, 286, 1250, 300); g.stroke();
  poly(g, [[1214, 336], [1258, 336], [1250, 316], [1222, 316]], '#2b2c34');
  e.save(); e.setTransform(g.getTransform()); e.fillStyle = 'rgba(255,214,150,.95)'; e.beginPath(); e.ellipse(1236, 338, 16, 5, 0, 0, TAU); e.fill(); e.restore();
  const mPos = t => 420 + (1105 - 420) * clamp((t - 9) / 14) - 0;
  const mpos = t => { const u = clamp((t - 9) / 14); return 420 + (1062 - 420) * (u < .1 ? u * u * 5 : u > .9 ? .9 - (1 - u) * (1 - u) * 5 : u - .05) / .9; };
  const mw = walkInfo(mpos, tl, R, 50);
  const raise = ss(23.2, 27, tl);
  const M = { who: 'mutsu', view: 'side', f: 1, x: mw.x, y: 905, s: .9, t: tl, walk: mw.amt * .9, ph: mw.ph, hairAmp: .4, eyes: 'open',
    e, hn: [lerp(22, 66, raise), lerp(R.shY + 66, R.shY + 18, raise)], heldN: h => umbrella(this_g(), h[0], h[1], lerp(.03, .3, raise), 1, e) };
  const tremble = ss(33, 33.6, tl) * (1 - ss(37, 38, tl));
  const S = { who: 'saki', view: 'back', x: 1214, y: 905, s: .9, t: tl + 4, hairAmp: .25, headDY: 8 - 3 * ss(34, 37, tl), tilt: -.1 * ss(34, 37.5, tl), bob: Math.sin(tl * 23) * 1.1 * tremble };
  fig(g, S); fig(g, M);
}

// ───────────────────────────────────────────────────────── 4 · Masquerade
const jerk = t => Math.floor(t) + ss(0, .38, t - Math.floor(t));
function stMask(tl) {
  const st = baseState();
  st.cam = { x: kf(tl, [[0, 960], [20, 980], [26, 1075]]), y: kf(tl, [[0, 560], [26, 585]]), z: kf(tl, [[0, 1.0], [20, 1.08], [26, 1.24], [28.4, 1.3]]) };
  const wc = W2S(st, 960, 392, .2), zf = 1 + (st.cam.z - 1) * .2;
  st.P0 = [wc[0], wc[1], 285 * zf, 0];
  st.light = wc; st.amb = [.17, .06, .08]; st.rim = [1.1, .46, .52]; st.omni = .45;
  st.refl = { y: W2S(st, 0, 905)[1], k: .35, rip: 0 };
  st.parts = [{ type: 4, n: 130, p: [1, 22, .5, 1] }];
  st.emis = true;
  st.flares.push([wc[0], wc[1], 330 * zf, .12, 1, .45, .5, 0]);
  st.grade = grade({ expo: 1.04, sat: 1.12, lift: [.03, 0, .015], gain: [1.06, .95, .98], vig: .7, bloom: .85, th: .5, grain: .06, ca: .003 });
  st.shatter = 27.2;
  if (tl > st.shatter) st.parts.push({ type: 6, n: 90, p: [1, st.shatter, 0, 0], p2: [1170 + 0, 905 - 462 * .95 + 4, 0, 0] });
  return st;
}
function drMask(g, tl, st, e) {
  _g = g; const R = RIG.teen, s = .95;
  curtain(g, -320, 340, tl, true); curtain(g, 1580, 2240, tl, false);
  poly(g, [[-300, 905], [2300, 905], [2300, 915], [-300, 915]], '#120507');
  // Sakiko — Oblivionis
  const u = ss(3, 6, tl) * (1 - ss(17, 19.5, tl));
  const face = [-6, R.headY + 16];
  const hang = [-R.shW - 12, R.shY + R.upper + R.fore - 10];
  const reachS = ss(20, 24, tl);
  const S = { who: 'saki', view: 'front', outfit: 'gownS', x: 760, y: 905, s, t: tl, e, eyes: 'closed', mouth: 'none', tilt: .06 * ss(19, 21, tl),
    hl: [lerp(hang[0], face[0], u), lerp(hang[1], face[1], u)], mask: u > .97 ? 1 : 0, maskGlow: 1 };
  const reachL = toLocal(S, 930, 650);
  S.hr = [lerp(R.shW + 10, reachL[0], reachS), lerp(R.shY + R.upper + R.fore - 6, reachL[1], reachS)];
  if (u <= .97) S.heldL = h => drawMask(g, e, h[0] + 4, h[1] - 6, .9, -.5 + u * .5, 'saki', 0, .8);
  if (tl > 19.5) S.eyes = 'open';
  // Mutsumi — Mortis, marionette
  const snap = 21.5, cut = tl > snap;
  const j1 = jerk(tl * 1.25), j2 = jerk(tl * 1.25 + .5);
  const drop = ss(snap, snap + .9, tl), rise = ss(23, 26, tl);
  const M = { who: 'mutsu', view: 'front', outfit: 'gownM', x: 1170, y: 905, s, t: tl + 2, e, eyes: 'none', mouth: 'none', mask: tl < st.shatter ? 1 : 0, crack: ss(25.4, 27.0, tl) };
  const pl = [-74 - 22 * Math.sin(j1 * 1.3), -430 - 70 * Math.max(0, Math.sin(j1 * .9))];
  const pr = [74 + 22 * Math.sin(j2 * 1.1), -410 - 80 * Math.max(0, Math.sin(j2 * 1.2 + 1))];
  const restL = [-R.shW - 9, R.shY + R.upper + R.fore - 4], restR = [R.shW + 9, R.shY + R.upper + R.fore - 4];
  const reachM = toLocal(M, 990, 652);
  let hl = [lerp(pl[0], restL[0], drop), lerp(pl[1], restL[1], drop)], hr = [lerp(pr[0], restR[0], drop), lerp(pr[1], restR[1], drop)];
  hl = [lerp(hl[0], reachM[0], rise), lerp(hl[1], reachM[1], rise)];
  M.hl = hl; M.hr = hr;
  M.tilt = (1 - drop) * .14 * Math.sin(jerk(tl * .9) * 1.7) + .22 * drop * (1 - rise) - .06 * rise;
  M.headDY = 10 * drop * (1 - rise); M.bob = -6 * Math.max(0, Math.sin(j1 * 2)) * (1 - drop) + 6 * drop * (1 - rise);
  fig(g, S); fig(g, M);
  // strings (emissive)
  e.save(); e.setTransform(g.getTransform());
  const W = (lx, ly) => [M.x + lx * s, M.y + ly * s];
  const hcM = W(M.tilt * 30, R.headY - 34 + (M.headDY || 0) + (M.bob || 0));
  const ends = [W(hl[0], hl[1]), W(hr[0], hr[1]), hcM];
  const tops = [[1060, 40], [1290, 40], [1172, 20]];
  e.lineWidth = 1.3; e.lineCap = 'round';
  ends.forEach((p, i) => {
    const top = tops[i];
    if (!cut) { e.strokeStyle = 'rgba(255,214,150,.55)'; e.beginPath(); e.moveTo(top[0], top[1]); e.quadraticCurveTo(lerp(top[0], p[0], .5) + Math.sin(tl * 2 + i) * 4, lerp(top[1], p[1], .5), p[0], p[1]); e.stroke(); }
    else { const k = clamp((tl - snap) / 1.4); if (k < 1) { e.strokeStyle = `rgba(255,214,150,${.6 * (1 - k)})`; const cy = lerp(p[1] - 40, top[1], easeIO(k)); e.beginPath(); e.moveTo(top[0], top[1]); e.quadraticCurveTo(top[0] + Math.sin(k * 9 + i) * 30, (top[1] + cy) / 2, lerp(p[0], top[0], k * .7), cy); e.stroke(); } }
  });
  e.restore();
  if (cut && tl < snap + 1.2) { const k = 1 - (tl - snap) / 1.2; ends.forEach(p => { const q = W2S(st, p[0], p[1] - 40); st.flares.push([q[0], q[1], 60 * st.cam.z, 1.1 * k, 1, .86, .6, 1]); }); }
  if (tl > st.shatter - .3 && tl < st.shatter + .6) { const q = W2S(st, M.x, M.y + (R.headY + 6) * s); st.flares.push([q[0], q[1], 240 * st.cam.z, 1.4 * (1 - Math.abs(tl - st.shatter) / .6), 1, .95, .9, 1]); }
  st.parts.forEach(p => { if (p.type === 6) p.p2 = [M.x, M.y + (R.headY + 10) * s, 0, 0]; });
}

// ───────────────────────────────────────────────────────── 5 · Beneath the stars → dawn
const HILL = x => 868 + Math.pow((x - 960) / 900, 2) * 150 + 4 * Math.sin(x * .01);
const SHOTS = { closeA: 13.8, closeB: 25.6 };
function stStars(tl) {
  const st = baseState();
  const close = tl > SHOTS.closeA && tl < SHOTS.closeB;
  const dawn = ss(47, 63, tl);
  const aur = (.35 + .65 * ss(28, 40, tl)) * (1 - dawn);
  if (tl < SHOTS.closeA) st.cam = { x: 960, y: kf(tl, [[0, 250], [1, 250], [11, 540]]), z: kf(tl, [[0, 1.0], [8, 1.0], [13.8, 1.12]]) };
  else if (close) st.cam = { x: 960, y: 540, z: 1 + .05 * ss(13.8, 25.6, tl) };
  else st.cam = { x: kf(tl, [[25.6, 962], [36, 960]]), y: kf(tl, [[25.6, 770], [34, 760], [40, 560], [46, 540], [55, 440], [62, 470], [71.7, 500]]), z: kf(tl, [[25.6, 1.75], [34, 1.68], [40, 1.04], [55, 1.0]]) };
  const sunW = [1380, kf(tl, [[55, 880], [71.7, 712]], t => t)];
  const sun = W2S(st, sunW[0], sunW[1], .1);
  st.P0 = [dawn, close ? 1 : 0, aur, 0]; st.P1 = [sun[0], sun[1], 0, 0];
  st.met = [1500, 120, 34.7, 2.55, 520, 90, 37.7, .62, 1250, 60, 40.2, 2.6, 820, 140, 42.7, 2.45];
  st.amb = mix3([.16, .2, .32], [.52, .4, .46], dawn);
  st.rim = mix3([.4, .5, .8], [1.1, .8, .52], dawn);
  st.light = close ? [960, -300] : [lerp(960, sun[0], dawn), lerp(120, sun[1], dawn)];
  st.omni = .12; st.rimW = 2.1;
  st.fadeB = Math.max(1 - ss(0, .45, Math.abs(tl - SHOTS.closeA)), 1 - ss(0, .45, Math.abs(tl - SHOTS.closeB)), ss(70.4, 71.6, tl));
  const night = { expo: 1.06, sat: 1.06, lift: [0, .01, .045], gamma: 1, gain: [.98, 1, 1.06], vig: .55, bloom: .8, th: .5, grain: .045, ca: .0015, leak: 0 };
  const day = { expo: 1.04, sat: 1.1, lift: [.03, .01, .02], gamma: .98, gain: [1.07, 1, .93], vig: .5, bloom: .72, th: .6, grain: .04, ca: .0015, leak: .3 };
  st.grade = lerpGrade(grade(night), grade(day), dawn);
  if (close) {
    st.amb = [.34, .38, .5]; st.rim = [.42, .52, .8]; st.omni = .1; st.light = [960, 380];
    st.parts = [{ type: 1, n: 46, p: [.9, 1], p2: [200, 300, 1720, 900] }];
  } else {
    st.parts = [{ type: 1, n: 50, p: [.8 * (1 - dawn * .8), 1], p2: [560, 700, 1360, 900] }, { type: 7, n: 150, p: [ss(44, 48, tl) * (1 - ss(58, 64, tl)), 0], p2: [640, 0, 1280, 880] }];
    twinLights(st, [960, 255], tl, ss(44, 47.5, tl) * (1 - ss(57, 63, tl)), 62, 8);
    if (dawn > .3) lensFlare(st, sun, ss(.3, 1, dawn) * ss(56, 64, tl), [1, .8, .55]);
  }
  st.close = close;
  return st;
}
function lerpGrade(a, b, t) { const o = {}; for (const k in a) o[k] = Array.isArray(a[k]) ? mix3(a[k], b[k], t) : lerp(a[k], b[k], t); return o; }
function drStars(g, tl, st) {
  _g = g;
  if (st.close) return drHands(g, tl, st);
  const t = tl;
  g.fillStyle = '#21352a'; g.beginPath(); g.moveTo(-500, 1400); for (let x = -500; x <= 2500; x += 30) g.lineTo(x, HILL(x)); g.lineTo(2500, 1400); g.closePath(); g.fill();
  grass(g, -500, 2500, HILL, 6, 9, 28, t, '#2b4535', 11);
  const R = RIG.teen, Y = 868;
  const held = tl > SHOTS.closeB;
  const meet = [961, 900];
  const S = { who: 'saki', view: 'back', pose: 'sit', x: 905, y: Y, s: .92, t, hairAmp: .7, wind: .12 };
  const M = { who: 'mutsu', view: 'back', pose: 'sit', x: 1017, y: Y, s: .9, t: t + 2, hairAmp: .7, wind: .12 };
  S.hl = [-88, 30]; S.hr = [84, 32]; M.hl = [-82 - 8 * ss(9, 13.6, tl), 32]; M.hr = [88, 30];
  if (held) { S.hr = toLocal(S, meet[0] - 4, meet[1]); M.hl = toLocal(M, meet[0] + 4, meet[1] - 1); }
  const u = ss(30.7, 33.7, tl);
  M.tilt = -.36 * u; M.headDX = -9 * u; M.lean = -.07 * u;
  S.tilt = .1 * u; S.headDX = 3 * u;
  fig(g, S); fig(g, M);
  for (let i = 0; i < 9; i++) { const x = 700 + i * 70 + Math.sin(i * 3.3) * 20; const y = HILL(x) + 6 + (i % 3) * 5; for (let k = 0; k < 5; k++) ell(g, x + Math.cos(k * 1.256) * 3.4, y + Math.sin(k * 1.256) * 3.4, 2.8, 2.8, '#e9e9f3'); }
  if (held) { const p = W2S(st, meet[0], meet[1] - 2); st.flares.push([p[0], p[1], 30 * st.cam.z, .3 * (.7 + .3 * Math.sin(tl * 2.2)), 1, .85, .65, 0]); }
}
function drHands(g, tl, st) {
  const k = tl - SHOTS.closeA;
  const grd = g.createRadialGradient(960, 540, 80, 960, 540, 1150); grd.addColorStop(0, '#3e634d'); grd.addColorStop(.55, '#22392c'); grd.addColorStop(1, '#101b15');
  g.fillStyle = grd; g.fillRect(-600, -200, 3200, 1500);
  const lr = mulberry32(12); for (let i = 0; i < 26; i++) ell(g, lr() * 1920, 120 + lr() * 860, 60 + lr() * 140, 14 + lr() * 22, lr() < .5 ? '#30513d' : '#203628', (lr() - .5) * .3);
  const fr = mulberry32(77); for (let i = 0; i < 46; i++) { const x = fr() * 1920, y = 130 + fr() * 840, c = fr() < .7 ? '#eceef5' : '#f0d470'; if (Math.abs(y - 560) < 110 && Math.abs(x - 960) < 520) continue; for (let k2 = 0; k2 < 5; k2++) ell(g, x + Math.cos(k2 * 1.256) * 4.5, y + Math.sin(k2 * 1.256) * 4.5, 3.8, 3.8, c); ell(g, x, y, 2.2, 2.2, '#f3d36a'); }
  const sx = kf(k, [[0, 560], [5.8, 770], [7, 776], [10, 724]]);
  const mx = kf(k, [[0, 1500], [5.8, 1146], [7, 1140], [10, 1000]]);
  const my = kf(k, [[0, 590], [7, 584], [10, 552]]);
  const sa = kf(k, [[0, 1.62], [7, 1.6], [10, 1.52]]), ma = kf(k, [[0, -1.6], [7, -1.58], [10, -1.66]]);
  const sp = .5 + .8 * ss(7.2, 10, k);
  hand(g, sx, 560, sa, 1.55, false, sp, PAL.skin, '#e8ebf3', '#2c3152');
  hand(g, mx, my, ma, 1.5, true, sp, PAL.skin, '#e8ebf3', '#2c3152');
  const tip = (x, y, a, s, m) => { const lx = (m ? 1 : -1) * 9, ly = -118; return [x + (Math.cos(a) * lx - Math.sin(a) * ly) * s, y + (Math.sin(a) * lx + Math.cos(a) * ly) * s]; };
  const pa = tip(sx, 560, sa, 1.55, false), pb = tip(mx, my, ma, 1.5, true);
  const touch = ss(5.4, 6.2, k);
  if (touch > 0) { const c = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2]; const q = W2S(st, c[0], c[1]); st.flares.push([q[0], q[1], 100, .95 * touch * (1 - .45 * ss(8, 11, k)) * (.8 + .2 * Math.sin(tl * 4)), 1, .86, .62, 1]); st.flares.push([q[0], q[1], 320, .14 * touch, .6, .8, 1, 0]); }
}

const SCENES = [
  { key: 'prologue', t0: 0, t1: 20, bg: 0, state: stPrologue, draw: null },
  { key: 'dusk', t0: 20, t1: 60, bg: 1, state: stDusk, draw: drDusk },
  { key: 'walk', t0: 60, t1: 80, bg: 2, state: stWalk, draw: drWalk },
  { key: 'stage', t0: 80, t1: 100, bg: 3, state: stStage, draw: drStage },
  { key: 'rain', t0: 100, t1: 140, bg: 4, state: stRain, draw: drRain },
  { key: 'mask', t0: 140, t1: 168.33, bg: 5, state: stMask, draw: drMask },
  { key: 'stars', t0: 168.33, t1: 240, bg: 6, state: stStars, draw: drStars },
];
const TRANS = [
  { at: 20, dur: 2.6, style: 'dissolve', edge: [1, .75, .45] },
  { at: 60, dur: 2.2, style: 'dissolve', edge: [1, .62, .8] },
  { at: 80, dur: 1.3, style: 'black' },
  { at: 100, dur: 2.8, style: 'dissolve', edge: [.45, .65, 1] },
  { at: 140, dur: 1.1, style: 'white' },
  { at: 168.33, dur: 2.4, style: 'white' },
];

// ───────────────────────────────────────────────────────── text cues
const CHAPTERS = [
  { t0: 21, t1: 26, num: '壹', title: '黄瓜与夕阳', en: 'I · Cucumbers at Dusk', at: 20 },
  { t0: 61, t1: 66, num: '贰', title: '春日', en: 'II · Spring Days', at: 60 },
  { t0: 101.2, t1: 106.2, num: '叁', title: '雨夜', en: 'III · The Rain', at: 100 },
  { t0: 141, t1: 146, num: '肆', title: '假面', en: 'IV · Masquerade', at: 140 },
  { t0: 171, t1: 176, num: '终', title: '星空之下', en: 'V · Beneath the Stars', at: 168.33 },
];
const SUBS = [
  [1.8, 5.8, 'n', '如果回忆也有颜色——'],
  [23.6, 27.6, 'n', '那是很久以前的一个夏天。'],
  [28.2, 31.8, 'n', '她总是一个人，蹲在黄瓜藤下。'],
  [34.6, 37.4, 'm', '「……给你。」'],
  [38.6, 41.6, 's', '「诶？是……黄瓜？」'],
  [43, 46.4, 's', '「谢谢你，睦！我会好好珍惜的。」'],
  [46.8, 50.8, 'n', '那天的夕阳，比钢琴的音色还要温柔。'],
  [51.6, 54.8, 's', '「约好了哦，以后也要一直在一起。」'],
  [55.6, 58.4, 'm', '「……嗯。」'],
  [63.2, 67.2, 'n', '樱花开了又落，我们都长大了。'],
  [68.6, 72, 's', '「睦，我想组一支乐队。」'],
  [72.6, 76, 's', '「你愿意……为我弹吉他吗？」'],
  [76.6, 79.4, 'm', '「……嗯。祥想要的话。」'],
  [82.2, 86.2, 'n', '第一次站上舞台的那一天，'],
  [86.6, 90.6, 'n', '你的琴声和我的吉他，交织在一起。'],
  [92, 97, 'n', '那是我见过的，最耀眼的春日。'],
  [103.6, 107.4, 'n', '然后，春天结束了。'],
  [108.6, 112.6, 'n', '那个雨夜，你一个人离开了。'],
  [114, 118.2, 'n', '我不知道该说些什么，只是没办法停下脚步。'],
  [122, 125, 'm', '「……祥。」'],
  [128, 132, 'n', '至少，不想让你一个人淋雨。'],
  [133.6, 137.6, 's', '「……为什么，你总是这样。」'],
  [143.2, 147.2, 'n', '我们戴上面具，站上了另一座舞台。'],
  [148.2, 152.4, 'n', '被看不见的丝线牵引着，扮演着别人。'],
  [154, 157.6, 's', '「如果戴着面具，就能忘记一切的话——」'],
  [158.6, 162.2, 'm', '「……我不想忘记。」'],
  [162.8, 166.4, 'm', '「我想用自己的声音，叫你的名字。」'],
  [172.6, 176.6, 'n', '后来，在一个星星很多的夜晚，'],
  [177.2, 181.2, 'n', '我们又一次，并肩坐在了一起。'],
  [183.2, 187.4, 'n', '指尖之间，只隔着一点点夜风。'],
  [190.8, 192.8, 's', '「睦。」'],
  [193.4, 195.4, 'm', '「……嗯。」'],
  [196, 199.8, 's', '「谢谢你，一直在等我。」'],
  [201.4, 205, 'm', '「因为……是祥啊。」'],
  [206, 209.6, 'm', '「无论戴上多少张面具，」'],
  [210, 213.6, 'm', '「我都会找到你。」'],
  [214.6, 218.6, 's', '在所有想要忘却的回忆里，'],
  [219, 223, 's', '唯独你，我一次也没有忘记。'],
  [224.6, 228, 'n', '夜晚过去了。'],
  [228.6, 232.2, 'n', '而你，还在我身边。'],
];
const TITLES = [{ t0: 6.6, t1: 17.6 }, { t0: 233.2, t1: 239.4, end: true }];
