// =====================================================================
//  2D ART — posable silhouette puppets, props, scenery (Canvas2D)
//  Drawn as albedo; the WebGL layer pass adds ambient + rim lighting.
// =====================================================================
const TAU = Math.PI * 2;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function kf(t, keys, ease = easeIO) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [ta, va] = keys[i - 1], [tb2, vb] = keys[i]; const u = ease((t - ta) / (tb2 - ta));
    return Array.isArray(va) ? va.map((x, j) => lerp(x, vb[j], u)) : lerp(va, vb, u);
  }
  return keys[keys.length - 1][1];
}

const RIG = {
  teen: { headY: -458, hrx: 33, hry: 37, neckTop: -425, neckBot: -404, neckW: 12, shY: -400, shW: 37, chestW: 31, waistY: -318, waistW: 23, hipY: -290, hipW: 32, hemY: -194, hemW: 64, depth: 15, legW: 18, calfW: 13.5, thigh: 148, shin: 140, upper: 82, fore: 76, armW: 12, foreW: 9.5, handR: 7.5, footL: 26, tailL: 262, tailW: 18, hairLen: 128, sitH: 16, bow: 1 },
  child: { headY: -262, hrx: 40, hry: 43, neckTop: -222, neckBot: -211, neckW: 11, shY: -210, shW: 27, chestW: 25, waistY: -170, waistW: 22, hipY: -150, hipW: 24, hemY: -86, hemW: 48, depth: 13, legW: 12, calfW: 10, thigh: 76, shin: 70, upper: 50, fore: 46, armW: 10.5, foreW: 9, handR: 7, footL: 19, tailL: 150, tailW: 14, hairLen: 70, sitH: 14, bow: .85 },
};
const PAL = {
  saki: { hair: '#a8bdea', hairSh: '#8ba1d4', eye: '#d9a43f' },
  mutsu: { hair: '#afdcb7', hairSh: '#90c19c', eye: '#e4c04d' },
  skin: '#f5ddd3', skinSh: '#e6c3b6', lash: '#2a2232', ribbon: '#17161f',
};
const OUT = {
  uniform: { top: '#2c3152', skirt: '#2c3152', collar: '#e8ebf3', scarf: '#9c2f46', sock: '#1f2031', shoe: '#1a1a22', longSleeve: true },
  childS: { top: '#34436f', skirt: '#34436f', collar: '#eef1f7', sock: '#eeeeee', shoe: '#3b2a2c', longSleeve: false },
  childM: { top: '#eef0e8', skirt: '#eef0e8', collar: '#cfe2cf', sock: '#eeeeee', shoe: '#6c4c3c', longSleeve: false },
  gownS: { top: '#202339', skirt: '#202339', collar: '#d9dff0', accent: '#56679f', sock: '#111', shoe: '#111', longSleeve: true, gown: true },
  gownM: { top: '#1c2b25', skirt: '#1c2b25', collar: '#d6e4d7', accent: '#4c7a60', sock: '#111', shoe: '#111', longSleeve: true, gown: true },
};
const _shc = {};
function shade(c, k) {
  const key = c + k; if (_shc[key]) return _shc[key];
  const n = parseInt(c.slice(1), 16);
  return _shc[key] = `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

// ---------------------------------------------------------------- primitives
function seg(g, a, b, wa, wb, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-3, nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
  g.fillStyle = col; g.beginPath();
  g.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); g.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
  g.arc(b[0], b[1], wb / 2, an, an - Math.PI, true);
  g.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2);
  g.arc(a[0], a[1], wa / 2, an + Math.PI, an, true);
  g.closePath(); g.fill();
}
function ik(s, t, l1, l2, bend) {
  let dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy);
  const mx = (l1 + l2) * .995; if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
  const a = Math.atan2(dy, dx); d = Math.max(d, Math.abs(l1 - l2) + 1);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return [[s[0] + Math.cos(a + bend * A) * l1, s[1] + Math.sin(a + bend * A) * l1], [s[0] + Math.cos(a) * d, s[1] + Math.sin(a) * d]];
}
function strand(g, pts, wf, col) {
  const n = pts.length, L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = wf(i / (n - 1)) / 2;
    L.push([p[0] + nx * w, p[1] + ny * w]); Rr.push([p[0] - nx * w, p[1] - ny * w]);
  }
  g.fillStyle = col; g.beginPath(); g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) g.quadraticCurveTo(L[i - 1][0], L[i - 1][1], (L[i - 1][0] + L[i][0]) / 2, (L[i - 1][1] + L[i][1]) / 2);
  const tp = pts[n - 1], pv = pts[n - 2];
  g.quadraticCurveTo(tp[0] + (tp[0] - pv[0]) * .9, tp[1] + (tp[1] - pv[1]) * .9, Rr[n - 1][0], Rr[n - 1][1]);
  for (let i = n - 2; i >= 0; i--) g.quadraticCurveTo(Rr[i + 1][0], Rr[i + 1][1], (Rr[i + 1][0] + Rr[i][0]) / 2, (Rr[i + 1][1] + Rr[i][1]) / 2);
  g.lineTo(Rr[0][0], Rr[0][1]); g.closePath(); g.fill();
}
function poly(g, pts, col) { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }
function ell(g, x, y, rx, ry, col, rot = 0) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); g.fill(); }

// ---------------------------------------------------------------- hair pieces
function tailPts(ax, ay, len, dir, F, phase, n = 14) {
  const t = F.t || 0, A = (F.hairAmp ?? 1) * len * .05, wind = (F.wind || 0) * len * .22, pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const out = dir * len * (.1 * Math.sin(Math.min(u * 2.2, 1) * Math.PI / 2) + .05 * ss(.7, 1, u));
    const sw = A * Math.sin(t * 1.7 + phase - u * 2.4) * Math.pow(u, 1.3) + wind * Math.pow(u, 1.6) + (F.tailPull || 0) * dir * Math.pow(u, 1.2) * len * .12;
    pts.push([ax + out + sw, ay + u * len]);
  }
  return pts;
}
function tailW(R) { return u => R.tailW * (.5 + .85 * Math.sin(Math.min(u / .25, 1) * Math.PI / 2)) * (1 - .82 * Math.pow(u, 1.5)); }
function bow(g, x, y, s, ang, col) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s); g.fillStyle = col;
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(sx * 6, -13, sx * 21, -15, sx * 23, -4); g.bezierCurveTo(sx * 24, 5, sx * 10, 6, 0, 0); g.fill(); }
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 1, 2); g.lineTo(sx * 6, 20); g.lineTo(sx * 11, 17); g.closePath(); g.fill(); }
  g.beginPath(); g.ellipse(0, 0, 5, 4.5, 0, 0, TAU); g.fill(); g.restore();
}
function headXf(hc, tilt, R) { const c = Math.cos(tilt), s = Math.sin(tilt); return (ux, uy) => [hc[0] + c * ux * R.hrx - s * uy * R.hry, hc[1] + s * ux * R.hrx + c * uy * R.hry]; }
function headCenter(R, nx, ny, tilt) { const h = R.neckTop - R.headY; return [nx + h * Math.sin(tilt), ny - h * Math.cos(tilt)]; }

// long hair (Mutsumi) hanging mass; side: -1 left edge… built in body space
function longHair(g, F, R, P, hp, view, dy) {
  const t = F.t || 0, amp = (F.hairAmp ?? 1), wind = (F.wind || 0);
  const shY = R.shY + dy, bot = Math.min(shY + R.hairLen, (F.pose === 'sit' ? R.hipY + dy - 6 : 1e9));
  const sw = (u, ph) => (amp * 6 * Math.sin(t * 1.5 + ph - u * 2) + wind * 30) * u;
  g.fillStyle = P.hair; g.beginPath();
  if (view === 'side') {
    const A = hp(-.1, -1.02), B = hp(-1.06, -.2), C = hp(-.35, .8);
    g.moveTo(A[0], A[1]); g.quadraticCurveTo(hp(-.95, -.95)[0], hp(-.95, -.95)[1], B[0], B[1]);
    const o0 = B[0], oy = B[1];
    g.bezierCurveTo(o0 - 6, oy + 60, o0 - 14 + sw(.6, 0), shY + 60, o0 - 16 + sw(1, 0), bot);
    const tips = 4; for (let k = 1; k <= tips; k++) { const u = k / tips; const x = lerp(o0 - 16, C[0] - 8, u) + sw(1, u); g.lineTo(x + 3, bot - 14 * (k % 2) - 4 * u); }
    g.bezierCurveTo(C[0] - 8 + sw(.5, 1), shY + 60, C[0] - 2, C[1] + 30, C[0], C[1]);
    g.closePath(); g.fill();
  } else {
    const L = hp(-1.04, -.1), Rr = hp(1.04, -.1), T = hp(0, -1.05);
    g.moveTo(T[0], T[1]); g.quadraticCurveTo(hp(-1.1, -1.05)[0], hp(-1.1, -1.05)[1], L[0], L[1]);
    g.bezierCurveTo(L[0] - 10, L[1] + 70, -R.shW - 8 + sw(.5, 0), shY + 30, -R.shW - 2 + sw(1, 0), bot);
    const tips = 7; for (let k = 1; k < tips; k++) { const u = k / tips; const x = lerp(-R.shW - 2, R.shW + 2, u) + sw(1, u * 2); g.lineTo(x, bot + (k % 2 ? 10 : -2) - Math.sin(u * Math.PI) * 6); }
    g.lineTo(R.shW + 2 + sw(1, 2), bot);
    g.bezierCurveTo(R.shW + 8 + sw(.5, 2), shY + 30, Rr[0] + 10, Rr[1] + 70, Rr[0], Rr[1]);
    g.quadraticCurveTo(hp(1.1, -1.05)[0], hp(1.1, -1.05)[1], T[0], T[1]);
    g.closePath(); g.fill();
    if (view === 'back') { g.strokeStyle = shade(P.hair, .84); g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath();
      for (let i = -2; i <= 2; i++) { const x0 = hp(i * .32, -.2), xb = i * R.shW * .36 + sw(1, i); g.moveTo(x0[0], x0[1] + 8); g.quadraticCurveTo(xb * .9 + sw(.5, i), (x0[1] + bot) / 2, xb, bot - 10 - (i & 1) * 6); }
      g.stroke(); }
  }
}

// ---------------------------------------------------------------- heads
function eyesSide(g, F, P) {
  if (F.eyes === 'none') return;
  if (F.eyes === 'closed') { g.strokeStyle = PAL.lash; g.lineWidth = .07; g.lineCap = 'round'; g.beginPath(); g.moveTo(.56, .14); g.quadraticCurveTo(.69, .02, .82, .12); g.stroke(); }
  else {
    ell(g, .7, .14, .08, .15, P.eye); ell(g, .72, .2, .04, .06, shade(P.eye.length ? P.eye : '#cc9933', .6));
    ell(g, .69, .0, .15, .05, PAL.lash, -.12); ell(g, .74, .08, .025, .03, '#ffffff');
  }
  ell(g, .6, .44, .14, .06, 'rgba(240,120,140,.35)');
}
function headSide(g, F, R, P, hc, tilt) {
  const isS = F.who === 'saki';
  g.save(); g.translate(hc[0], hc[1]); g.rotate(tilt); g.scale(R.hrx, R.hry);
  ell(g, -.08, -.1, 1.06, 1.04, P.hair);
  g.fillStyle = PAL.skin; g.beginPath();
  g.moveTo(.15, -.5); g.quadraticCurveTo(.92, -.6, .97, -.08); g.lineTo(1.08, .16); g.lineTo(.96, .25);
  g.quadraticCurveTo(.99, .31, .95, .36); g.lineTo(.93, .4); g.quadraticCurveTo(.97, .46, .9, .52);
  g.quadraticCurveTo(.84, .82, .55, .95); g.quadraticCurveTo(.2, 1.02, -.05, .7); g.lineTo(-.1, .1); g.closePath(); g.fill();
  eyesSide(g, F, P);
  g.fillStyle = P.hair; g.beginPath();
  if (isS) { g.moveTo(.1, -.95); g.quadraticCurveTo(.85, -.95, 1.02, -.35); g.lineTo(1., .02); g.lineTo(.86, -.2); g.lineTo(.8, .07); g.lineTo(.66, -.18); g.lineTo(.56, .02); g.lineTo(.45, -.3); g.lineTo(.2, -.2); }
  else { g.moveTo(.05, -.98); g.quadraticCurveTo(.9, -.98, 1.03, -.3); g.lineTo(1.01, -.03); g.lineTo(.9, -.12); g.lineTo(.84, .01); g.lineTo(.72, -.1); g.lineTo(.62, .0); g.lineTo(.5, -.15); g.lineTo(.3, -.2); }
  g.closePath(); g.fill();
  g.fillStyle = P.hairSh; g.beginPath(); g.moveTo(.14, -.3); g.quadraticCurveTo(.3, .3, .2, 1.08); g.lineTo(.02, 1.0); g.quadraticCurveTo(.05, .3, -.1, -.25); g.closePath(); g.fill();
  g.restore();
}
function eyesFront(g, F, P) {
  if (F.eyes === 'none') return;
  for (const sx of [-1, 1]) {
    const x = sx * .42, y = .2;
    if (F.eyes === 'closed') { g.strokeStyle = PAL.lash; g.lineWidth = .07; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - .17, y + .04); g.quadraticCurveTo(x, y - .1, x + .17, y + .04); g.stroke(); continue; }
    ell(g, x, y + .04, .16, .23, '#fbf6f3'); ell(g, x, y + .07, .13, .2, P.eye); ell(g, x, y + .13, .07, .1, shade(P.eye, .55));
    ell(g, x, y - .14, .2, .06, PAL.lash, sx * .15); ell(g, x - sx * .04, y - .01, .04, .05, '#fff');
  }
  if (F.mouth !== 'none') { g.strokeStyle = '#b8636f'; g.lineWidth = .045; g.beginPath(); g.moveTo(-.07, .7); g.quadraticCurveTo(0, F.smile ? .76 : .72, .07, .7); g.stroke(); }
  ell(g, -.55, .48, .15, .06, 'rgba(240,120,140,.32)'); ell(g, .55, .48, .15, .06, 'rgba(240,120,140,.32)');
}
function headFront(g, F, R, P, hc, tilt) {
  const isS = F.who === 'saki';
  g.save(); g.translate(hc[0], hc[1]); g.rotate(tilt); g.scale(R.hrx, R.hry);
  g.fillStyle = PAL.skin; g.beginPath(); g.moveTo(-.92, -.2); g.quadraticCurveTo(-.95, .55, -.45, .88); g.quadraticCurveTo(0, 1.08, .45, .88); g.quadraticCurveTo(.95, .55, .92, -.2); g.quadraticCurveTo(.9, -1., 0, -1.); g.quadraticCurveTo(-.9, -1., -.92, -.2); g.fill();
  eyesFront(g, F, P);
  g.fillStyle = P.hair; g.beginPath(); g.moveTo(-1.08, .12); g.quadraticCurveTo(-1.16, -1.2, 0, -1.13); g.quadraticCurveTo(1.16, -1.2, 1.08, .12);
  const edge = isS ? [[.95, -.3], [.82, -.02], [.66, -.34], [.47, -.05], [.3, -.38], [.1, -.07], [-.1, -.4], [-.3, -.05], [-.5, -.35], [-.68, -.02], [-.85, -.3], [-.96, -.04]]
    : [[.96, -.16], [.85, -.08], [.72, -.15], [.58, -.06], [.42, -.14], [.26, -.05], [.1, -.13], [-.06, -.05], [-.22, -.14], [-.38, -.05], [-.54, -.14], [-.7, -.06], [-.85, -.15], [-.96, -.06]];
  for (const [x, y] of edge) g.lineTo(x, y); g.closePath(); g.fill();
  g.fillStyle = P.hairSh;
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 1.08, -.15); g.quadraticCurveTo(sx * 1.16, .6, sx * .92, 1.28); g.lineTo(sx * .74, 1.12); g.quadraticCurveTo(sx * .8, .4, sx * .82, -.12); g.closePath(); g.fill(); }
  g.restore();
}
function headBack(g, F, R, P, hc, tilt) {
  g.save(); g.translate(hc[0], hc[1]); g.rotate(tilt); g.scale(R.hrx, R.hry);
  ell(g, 0, -.06, 1.09, 1.08, P.hair);
  g.fillStyle = P.hair; g.beginPath(); g.moveTo(-.75, .45); g.quadraticCurveTo(-.45, 1.1, 0, 1.15); g.quadraticCurveTo(.45, 1.1, .75, .45); g.closePath(); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- items
function cucumber(g, x, y, ang, s) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  g.fillStyle = '#3c6a31'; g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(26, -10, 50, -2); g.quadraticCurveTo(54, 2, 50, 5); g.quadraticCurveTo(26, 6, 0, 5); g.quadraticCurveTo(-4, 0, 0, -4); g.fill();
  g.fillStyle = '#5b8c45'; g.beginPath(); g.moveTo(6, -2); g.quadraticCurveTo(26, -7, 46, -1); g.quadraticCurveTo(26, -3, 6, 0); g.fill();
  ell(g, 53, 1, 4, 3.5, '#e9c63c'); seg(g, [-2, 0], [-9, -3], 2.5, 2, '#4a6a2a');
  g.restore();
}
function umbrella(g, hx, hy, ang, s, e) {
  g.save(); g.translate(hx, hy); g.rotate(ang);
  const top = -232 * s, rx = 146 * s, ry = 70 * s;
  g.strokeStyle = '#2b2b33'; g.lineWidth = 3.5 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 22 * s); g.quadraticCurveTo(0, 34 * s, -10 * s, 32 * s); g.stroke();
  g.beginPath(); g.moveTo(0, 22 * s); g.lineTo(0, top - ry * .95); g.stroke();
  g.fillStyle = 'rgba(214,226,238,0.26)'; g.beginPath(); g.moveTo(-rx, top);
  g.bezierCurveTo(-rx, top - ry * 1.35, rx, top - ry * 1.35, rx, top);
  const k = 8; for (let i = k; i > 0; i--) { const x0 = lerp(-rx, rx, i / k), x1 = lerp(-rx, rx, (i - 1) / k); g.quadraticCurveTo((x0 + x1) / 2, top - 12 * s, x1, top); }
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(235,240,248,0.5)'; g.lineWidth = 1.6 * s;
  for (let i = 0; i <= k; i++) { const x = lerp(-rx, rx, i / k); g.beginPath(); g.moveTo(0, top - ry * 1.0); g.quadraticCurveTo(x * .7, top - ry * (1 - Math.pow(x / rx, 2)) * 1.05, x, top); g.stroke(); }
  g.restore();
  if (e) { e.save(); e.translate(hx, hy); e.rotate(ang); e.strokeStyle = 'rgba(255,226,180,.22)'; e.lineWidth = 2.2 * s; e.beginPath(); e.moveTo(-rx, top); e.bezierCurveTo(-rx, top - ry * 1.35, rx, top - ry * 1.35, rx, top); e.stroke();
    e.fillStyle = 'rgba(200,215,235,.05)'; e.fill(); e.restore(); }
}
function guitarFront(g, cx, cy, ang, s) {
  g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(s, s);
  seg(g, [8, -26], [178, -26], 13, 11, '#5b3b27');
  poly(g, [[176, -36], [210, -38], [212, -16], [176, -16]], '#3a2a20');
  g.fillStyle = '#ece5d4'; g.beginPath(); g.ellipse(-8, 10, 46, 38, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(28, -10, 34, 28, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(10, 0, 30, 28, 0, 0, TAU); g.fill();
  ell(g, 6, 8, 18, 12, '#2a2626', .2); ell(g, 22, -6, 7, 7, '#17140f');
  g.restore();
  const c = Math.cos(ang), sn = Math.sin(ang), P = (x, y) => [cx + (c * x - sn * y) * s, cy + (sn * x + c * y) * s];
  return { neck: P(96, -26), body: P(10, 0) };
}
function guitarCase(g, x, y, ang, s) { g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s); g.fillStyle = '#232229'; g.beginPath(); g.moveTo(-14, -120); g.quadraticCurveTo(0, -132, 14, -120); g.lineTo(18, 40); g.quadraticCurveTo(28, 60, 24, 92); g.quadraticCurveTo(0, 108, -24, 92); g.quadraticCurveTo(-28, 60, -18, 40); g.closePath(); g.fill(); g.restore(); }
function keyboard(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#151419'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-90, 0); g.lineTo(80, -232); g.moveTo(90, 0); g.lineTo(-80, -232); g.stroke();
  poly(g, [[-150, -258], [150, -258], [158, -232], [-158, -232]], '#1a1920');
  poly(g, [[-144, -262], [144, -262], [150, -250], [-150, -250]], '#e8e6ef');
  g.fillStyle = '#1a1920'; for (let i = 0; i < 28; i++) { if ([2, 6, 9, 13, 16, 20, 23, 27].includes(i)) continue; g.fillRect(-140 + i * 10.2, -262, 5.5, 6.5); }
  g.restore();
}
function maskShape(g, x, y, s, ang, kind) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s); g.beginPath();
  if (kind === 'saki') { // winged half-mask
    g.moveTo(0, -6); g.bezierCurveTo(14, -16, 30, -18, 44, -30); g.bezierCurveTo(42, -10, 40, 6, 30, 12); g.bezierCurveTo(18, 16, 8, 12, 0, 6);
    g.bezierCurveTo(-8, 12, -18, 16, -30, 12); g.bezierCurveTo(-40, 6, -42, -10, -44, -30); g.bezierCurveTo(-30, -18, -14, -16, 0, -6); g.closePath();
    g.moveTo(-8, -2); g.ellipse(-16, -2, 8, 5, 0, 0, TAU); g.moveTo(24, -2); g.ellipse(16, -2, 8, 5, 0, 0, TAU);
  } else { // porcelain full mask
    g.moveTo(0, -36); g.bezierCurveTo(26, -36, 32, -10, 30, 6); g.bezierCurveTo(28, 26, 12, 38, 0, 38); g.bezierCurveTo(-12, 38, -28, 26, -30, 6); g.bezierCurveTo(-32, -10, -26, -36, 0, -36); g.closePath();
    g.moveTo(-6, -4); g.ellipse(-13, -4, 7, 4, 0, 0, TAU); g.moveTo(20, -4); g.ellipse(13, -4, 7, 4, 0, 0, TAU);
  }
  g.restore();
}
function drawMask(g, e, x, y, s, ang, kind, crack = 0, glow = 1) {
  maskShape(g, x, y, s, ang, kind); g.fillStyle = '#f2ece6'; g.fill('evenodd');
  if (e) {
    maskShape(e, x, y, s, ang, kind); e.fillStyle = `rgba(255,236,226,${.32 * glow})`; e.fill('evenodd');
    e.save(); e.translate(x, y); e.rotate(ang); e.scale(s, s); e.strokeStyle = `rgba(255,214,150,${.75 * glow})`; e.lineWidth = 1.4; maskShape(e, 0, 0, 1, 0, kind); e.stroke(); e.restore();
    if (crack > 0) {
      e.save(); e.translate(x, y); e.rotate(ang); e.scale(s, s); e.strokeStyle = `rgba(255,250,240,${clamp(crack * 1.5)})`; e.lineWidth = 1.8; e.beginPath();
      const L = crack * 40; e.moveTo(0, -36); e.lineTo(-4, -36 + L * .5); e.lineTo(5, -36 + L); e.lineTo(-2, -36 + L * 1.5); e.moveTo(-4, -36 + L * .5); e.lineTo(-18, -30 + L * .6); e.moveTo(5, -36 + L); e.lineTo(22, -20 + L * .7);
      e.stroke(); e.restore();
    }
  }
}

// ---------------------------------------------------------------- the puppet
function standHands(R, view) {
  if (view === 'side') return { hf: [-4, R.shY + 8 + (R.upper + R.fore) * .985], hn: [6, R.shY + 8 + (R.upper + R.fore) * .985] };
  return { hl: [-R.shW - 9, R.shY + R.upper + R.fore - 4], hr: [R.shW + 9, R.shY + R.upper + R.fore - 4] };
}
function gait(R, ph, amt) {
  const st = R.thigh * .24 * amt, lift = R.thigh * .17 * amt, sw = .36 * amt, L = (R.upper + R.fore) * .985;
  const foot = p => [st * Math.cos(p), -lift * Math.max(0, -Math.sin(p))];
  return {
    fn: foot(ph), ff: foot(ph + Math.PI), bob: R.thigh * .035 * amt * (Math.abs(Math.cos(ph)) - .5),
    hn: [4 + L * Math.sin(-sw * Math.cos(ph)), R.shY + 8 + L * Math.cos(sw * Math.cos(ph))],
    hf: [-2 + L * Math.sin(sw * Math.cos(ph)), R.shY + 8 + L * Math.cos(sw * Math.cos(ph))],
  };
}
function arm(g, R, sh, tgt, col, skinCol, bend, O, held) {
  const [e, h] = ik(sh, tgt, R.upper, R.fore, bend);
  seg(g, sh, e, R.armW, R.armW * .9, col);
  seg(g, e, h, O.longSleeve ? R.foreW * 1.05 : R.foreW, R.foreW * .85, O.longSleeve ? col : skinCol);
  if (O.longSleeve) { const k = .82; seg(g, [lerp(e[0], h[0], k), lerp(e[1], h[1], k)], h, R.foreW * 1.15, R.foreW * 1.1, O.gown ? O.collar : col); }
  ell(g, h[0], h[1], R.handR, R.handR * .95, skinCol);
  if (held) held(h, e);
  return h;
}
function leg(g, R, hip, foot, O, bend, side, skin) {
  const [k, a] = ik(hip, foot, R.thigh, R.shin, bend);
  seg(g, hip, k, R.legW, R.legW * .82, skin);
  seg(g, k, a, R.calfW * 1.1, R.calfW * .8, skin);
  const kk = [lerp(k[0], a[0], .36), lerp(k[1], a[1], .36)];
  seg(g, kk, a, R.calfW * 1.02, R.calfW * .82, O.sock);
  if (side) { g.fillStyle = O.shoe; g.beginPath(); g.ellipse(a[0] + R.footL * .32, a[1] + 2, R.footL * .6, R.footL * .26, 0, 0, TAU); g.fill(); }
  else ell(g, a[0], a[1] + 1, R.footL * .34, R.footL * .25, O.shoe);
}

function drawSide(g, F, R, P, O) {
  const isS = F.who === 'saki', t = F.t || 0;
  const W = F.walk ? gait(R, F.ph || 0, F.walk) : null;
  const dy = (W ? W.bob : 0) + (F.bob || 0);
  const hipY = R.hipY + dy, shY = R.shY + dy, wY = R.waistY + dy, nb = R.neckBot + dy, hemY = R.hemY + dy, D = R.depth;
  const sh = [-2, shY + 8];
  const SH = standHands(R, 'side');
  const hf = F.hf || (W ? [W.hf[0], W.hf[1] + dy] : [SH.hf[0], SH.hf[1] + dy]);
  const hn = F.hn || (W ? [W.hn[0], W.hn[1] + dy] : [SH.hn[0], SH.hn[1] + dy]);
  const ff = F.ff || (W ? W.ff : [-6, 0]), fn = F.fn || (W ? W.fn : [8, 0]);
  const tilt = F.tilt || 0;
  const nx = (F.headDX || 0), ny = R.neckTop + dy + (F.headDY || 0);
  const hc = headCenter(R, nx, ny, tilt), hp = headXf(hc, tilt, R);
  const dk = .8;
  if (F.case) guitarCase(g, -D - 10, shY + 112, .12, R === RIG.teen ? 1 : .6);
  // far arm
  arm(g, R, [sh[0] + 3, sh[1] - 1], hf, shade(O.top, dk), PAL.skinSh, 1, { ...O, collar: shade(O.collar || '#ffffff', dk) }, F.heldF);
  // hair behind
  if (isS) {
    const a = hp(-.3, -.78); strand(g, tailPts(a[0] + 8, a[1] - 2, R.tailL, -1, F, 1.3), tailW(R), P.hairSh);
  } else longHair(g, F, R, P, hp, 'side', dy);
  // far leg
  leg(g, R, [-3, hipY], ff, { ...O, sock: shade(O.sock, dk), shoe: shade(O.shoe, dk) }, -1, true, PAL.skinSh);
  // torso
  g.fillStyle = O.top; g.beginPath();
  g.moveTo(-6, nb); g.quadraticCurveTo(-D - 1, shY + 2, -D, shY + 30); g.quadraticCurveTo(-D + 2, wY - 10, -D + 3, wY); g.lineTo(-D - 3, hipY);
  g.lineTo(D + 1, hipY); g.lineTo(D * .6, wY); g.quadraticCurveTo(D * 1.25, shY + 48, D, shY + 28); g.quadraticCurveTo(D * .8, shY + 6, 6, nb); g.closePath(); g.fill();
  const swing = W ? Math.sin(F.ph) * 4 * F.walk : 0;
  g.fillStyle = O.skirt; g.beginPath(); g.moveTo(-D - 3, hipY - 8);
  g.lineTo(-R.hemW * .78 + swing, hemY); g.quadraticCurveTo(0, hemY + 7, R.hemW * .6 + swing, hemY - 2); g.lineTo(D + 1, hipY - 8); g.closePath(); g.fill();
  if (O === OUT.uniform) {
    poly(g, [[-6, nb], [-D - 2, shY + 4], [-D - 1, shY + 46], [-D * .3, shY + 44], [-2, nb + 6]], O.collar);
    poly(g, [[4, nb + 2], [D * .9, shY + 22], [D * .5, shY + 40], [2, shY + 16]], O.collar);
    ell(g, D * .7, shY + 38, 6, 5, O.scarf); poly(g, [[D * .7, shY + 38], [D * .9, shY + 70], [D * .3, shY + 64]], O.scarf);
  } else if (O.collar) { poly(g, [[-6, nb], [-D, shY + 8], [-D * .2, shY + 22], [D * .9, shY + 12], [6, nb]], O.collar); }
  // near leg
  leg(g, R, [3, hipY], fn, O, -1, true, PAL.skin);
  // neck + head
  seg(g, [0, nb + 6], [nx * .5, ny + 4], R.neckW, R.neckW, PAL.skinSh);
  headSide(g, F, R, P, hc, tilt);
  if (isS) {
    const a = hp(-.36, -.72);
    strand(g, tailPts(a[0], a[1], R.tailL, -1, F, 0), tailW(R), P.hair);
    bow(g, a[0] + 2, a[1] - 2, R.bow * .9, -.3 + tilt, PAL.ribbon);
  }
  // near arm
  arm(g, R, sh, hn, O.top, PAL.skin, 1, O, F.heldN);
}

function drawFront(g, F, R, P, O) {
  const isS = F.who === 'saki', t = F.t || 0, dy = F.bob || 0;
  const hipY = R.hipY + dy, shY = R.shY + dy, wY = R.waistY + dy, nb = R.neckBot + dy, hemY = R.hemY + dy;
  const tilt = F.tilt || 0, nx = F.headDX || 0, ny = R.neckTop + dy + (F.headDY || 0);
  const hc = headCenter(R, nx, ny, tilt), hp = headXf(hc, tilt, R);
  const SH = standHands(R, 'front');
  let hl = F.hl || [SH.hl[0], SH.hl[1] + dy], hr = F.hr || [SH.hr[0], SH.hr[1] + dy];
  // hair behind
  if (isS) {
    for (const sx of [-1, 1]) { const a = hp(sx * .78, -.62); strand(g, tailPts(a[0] + sx * 6, a[1], R.tailL, sx, F, sx * .8), tailW(R), P.hairSh); }
  } else longHair(g, F, R, { hair: P.hairSh }, hp, 'front', dy);
  // legs
  if (!O.gown) for (const sx of [-1, 1]) leg(g, R, [sx * R.hipW * .42, hipY], F[sx < 0 ? 'fl' : 'fr'] || [sx * R.hipW * .5, 0], O, sx < 0 ? 1 : -1, false, PAL.skin);
  // torso
  g.fillStyle = O.top; g.beginPath(); g.moveTo(-R.neckW * .7, nb);
  g.quadraticCurveTo(-R.shW * .7, shY - 2, -R.shW, shY + 9); g.quadraticCurveTo(-R.chestW - 3, shY + 30, -R.chestW, shY + 46);
  g.quadraticCurveTo(-R.waistW - 1, wY - 20, -R.waistW, wY); g.lineTo(-R.hipW, hipY + 4); g.lineTo(R.hipW, hipY + 4); g.lineTo(R.waistW, wY);
  g.quadraticCurveTo(R.waistW + 1, wY - 20, R.chestW, shY + 46); g.quadraticCurveTo(R.chestW + 3, shY + 30, R.shW, shY + 9); g.quadraticCurveTo(R.shW * .7, shY - 2, R.neckW * .7, nb); g.closePath(); g.fill();
  if (O.gown) {
    const hw = R.hemW * 2.25, sway = Math.sin(t * .8) * 6;
    g.fillStyle = O.skirt; g.beginPath(); g.moveTo(-R.waistW, wY);
    g.bezierCurveTo(-R.hemW * .9, wY + 70, -hw - 10 + sway, -80, -hw + sway, -2);
    const k = 9; for (let i = 1; i <= k; i++) { const x0 = lerp(-hw, hw, (i - 1) / k) + sway, x1 = lerp(-hw, hw, i / k) + sway; g.quadraticCurveTo((x0 + x1) / 2, 14, x1, -2); }
    g.bezierCurveTo(hw + 10 + sway, -80, R.hemW * .9, wY + 70, R.waistW, wY); g.closePath(); g.fill();
    g.strokeStyle = O.accent; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 9; i++) { const x = lerp(-hw * .92, hw * .92, i / 9) + sway; g.moveTo(x * .3, wY + 30); g.quadraticCurveTo(x * .7, wY + 120, x, -12); } g.stroke();
    g.fillStyle = O.collar; g.beginPath(); for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); const x = -Math.cos(a) * R.shW * .62, y = nb + 2 + Math.sin(a) * 10; i ? g.lineTo(x, y) : g.moveTo(x, y); } for (let i = 12; i >= 0; i--) { const a = Math.PI * (i / 12); g.lineTo(-Math.cos(a) * R.shW * .5, nb - 2 + Math.sin(a) * 18 + (i % 2) * 6); } g.closePath(); g.fill();
    ell(g, -R.shW + 2, shY + 12, 15, 13, O.top); ell(g, R.shW - 2, shY + 12, 15, 13, O.top);
  } else {
    g.fillStyle = O.skirt; g.beginPath(); g.moveTo(-R.hipW + 2, hipY - 8); g.lineTo(-R.hemW, hemY); g.quadraticCurveTo(0, hemY + 9, R.hemW, hemY); g.lineTo(R.hipW - 2, hipY - 8); g.closePath(); g.fill();
    g.strokeStyle = shade(O.skirt.startsWith('#') ? O.skirt : '#333333', .78); g.lineWidth = 1.6; g.beginPath();
    for (let i = -3; i <= 3; i++) { g.moveTo(i * R.hipW * .28, hipY - 4); g.lineTo(i * R.hemW * .3, hemY + 3); } g.stroke();
    if (O === OUT.uniform) {
      poly(g, [[-R.shW * .86, shY + 6], [0, shY + 50], [R.shW * .86, shY + 6], [R.shW * .55, shY + 1], [0, shY + 34], [-R.shW * .55, shY + 1]], O.collar);
      poly(g, [[-7, shY + 44], [7, shY + 44], [0, shY + 74]], O.scarf); ell(g, 0, shY + 46, 7, 6, O.scarf);
    } else if (O.collar) { ell(g, -9, nb + 6, 12, 8, O.collar, .3); ell(g, 9, nb + 6, 12, 8, O.collar, -.3); }
    if (!O.longSleeve) { ell(g, -R.shW + 3, shY + 12, 11, 10, O.top); ell(g, R.shW - 3, shY + 12, 11, 10, O.top); }
  }
  if (F.guitar) { const gi = guitarFront(g, -10, hipY + 6, -.36, R === RIG.teen ? 1 : .7); hl = [gi.body[0] - 2, gi.body[1] - 4 + (F.strum || 0)]; hr = [gi.neck[0], gi.neck[1] + 3]; }
  if (F.preArms) F.preArms(g);
  // arms
  arm(g, R, [-R.shW + 4, shY + 9], hl, O.top, PAL.skin, 1, O, F.heldL);
  arm(g, R, [R.shW - 4, shY + 9], hr, O.top, PAL.skin, -1, O, F.heldR);
  // neck + head
  seg(g, [0, nb + 6], [nx * .5, ny + 4], R.neckW, R.neckW, PAL.skinSh);
  headFront(g, F, R, P, hc, tilt);
  if (isS) for (const sx of [-1, 1]) { const a = hp(sx * .8, -.7); bow(g, a[0], a[1], R.bow * .85, sx * .5 + tilt, PAL.ribbon); }
  if (F.mask > 0) { const m = hp(0, .12); drawMask(g, F.e, m[0], m[1], R.hrx / 34 * 1.02, tilt, F.who, F.crack || 0, F.maskGlow ?? 1); }
}

function drawBack(g, F, R, P, O) {
  const isS = F.who === 'saki', sit = F.pose === 'sit';
  const baseHip = sit ? -R.sitH : R.hipY;
  const dy = baseHip - R.hipY + (F.bob || 0);
  const hipY = R.hipY + dy, shY = R.shY + dy, wY = R.waistY + dy, nb = R.neckBot + dy, hemY = R.hemY + dy;
  const SH = standHands(R, 'back');
  if (sit) {
    ell(g, 0, -10, R.hemW * 1.12, 19, O.skirt);
    g.fillStyle = O.skirt; g.beginPath(); g.moveTo(-R.hipW - 4, hipY - 10); g.quadraticCurveTo(-R.hemW * 1.1, -14, -R.hemW * 1.08, -8); g.lineTo(R.hemW * 1.08, -8); g.quadraticCurveTo(R.hemW * 1.1, -14, R.hipW + 4, hipY - 10); g.closePath(); g.fill();
  } else {
    for (const sx of [-1, 1]) leg(g, R, [sx * R.hipW * .42, hipY], [sx * R.hipW * .48, 0], O, sx < 0 ? 1 : -1, false, PAL.skin);
    g.fillStyle = O.skirt; g.beginPath(); g.moveTo(-R.hipW + 2, hipY - 8); g.lineTo(-R.hemW, hemY); g.quadraticCurveTo(0, hemY + 9, R.hemW, hemY); g.lineTo(R.hipW - 2, hipY - 8); g.closePath(); g.fill();
  }
  g.save();
  if (F.lean) { g.translate(0, hipY); g.rotate(F.lean); g.translate(0, -hipY); }
  g.fillStyle = O.top; g.beginPath(); g.moveTo(-R.neckW * .7, nb);
  g.quadraticCurveTo(-R.shW * .7, shY - 2, -R.shW, shY + 9); g.quadraticCurveTo(-R.chestW - 3, shY + 30, -R.chestW, shY + 46);
  g.quadraticCurveTo(-R.waistW - 1, wY - 20, -R.waistW, wY); g.lineTo(-R.hipW, hipY + 4); g.lineTo(R.hipW, hipY + 4); g.lineTo(R.waistW, wY);
  g.quadraticCurveTo(R.waistW + 1, wY - 20, R.chestW, shY + 46); g.quadraticCurveTo(R.chestW + 3, shY + 30, R.shW, shY + 9); g.quadraticCurveTo(R.shW * .7, shY - 2, R.neckW * .7, nb); g.closePath(); g.fill();
  if (O === OUT.uniform) {
    poly(g, [[-R.shW * .78, shY + 4], [R.shW * .78, shY + 4], [R.shW * .7, shY + 52], [-R.shW * .7, shY + 52]], '#b9bfd0');
    g.strokeStyle = O.top; g.lineWidth = 2.6; g.strokeRect(-R.shW * .6, shY + 9, R.shW * 1.2, 36);
  }
  const hl = F.hl || [SH.hl[0], SH.hl[1] + dy], hr = F.hr || [SH.hr[0], SH.hr[1] + dy];
  arm(g, R, [-R.shW + 4, shY + 9], hl, O.top, PAL.skin, 1, O, F.heldL);
  arm(g, R, [R.shW - 4, shY + 9], hr, O.top, PAL.skin, -1, O, F.heldR);
  const tilt = F.tilt || 0, nx = F.headDX || 0, ny = R.neckTop + dy + (F.headDY || 0);
  const hc = headCenter(R, nx, ny, tilt), hp = headXf(hc, tilt, R);
  seg(g, [0, nb + 6], [nx * .6, ny + 6], R.neckW, R.neckW, PAL.skinSh);
  headBack(g, F, R, P, hc, tilt);
  if (isS) {
    for (const sx of [-1, 1]) { const a = hp(sx * .9, -.5); strand(g, tailPts(a[0] + sx * 3, a[1], R.tailL * (sit ? .8 : 1), sx, F, sx * 1.1), tailW(R), P.hair); const b = hp(sx * 1.0, -.66); bow(g, b[0] + sx * 6, b[1] - 4, R.bow * 1.0, sx * .55 + tilt, PAL.ribbon); }
  } else longHair(g, F, R, P, hp, 'back', dy);
  g.restore();
}

function fig(g, F) {
  const R = RIG[F.rig || 'teen'], P = PAL[F.who], O = OUT[F.outfit || 'uniform'];
  g.save(); g.translate(F.x, F.y);
  const s = F.s || 1; g.scale(s * (F.view === 'side' ? (F.f || 1) : 1), s);
  if (F.e) { F.e.save(); F.e.setTransform(g.getTransform()); }
  if (F.view === 'side') drawSide(g, F, R, P, O); else if (F.view === 'back') drawBack(g, F, R, P, O); else drawFront(g, F, R, P, O);
  if (F.e) F.e.restore();
  g.restore();
}
// world ↔ figure-local helpers
function toLocal(F, wx, wy) { const s = F.s || 1, f = F.view === 'side' ? (F.f || 1) : 1; return [(wx - F.x) / (s * f), (wy - F.y) / s]; }

// ---------------------------------------------------------------- hands close-up (back of hand, fingers pointing up-screen)
function hand(g, x, y, ang, s, mirror, spread, col, cuff, sleeve) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s * (mirror ? -1 : 1), s);
  poly(g, [[-40, 84], [40, 84], [60, 900], [-60, 900]], sleeve); poly(g, [[-38, 70], [38, 70], [41, 96], [-41, 96]], cuff);
  g.fillStyle = col; g.beginPath(); g.moveTo(-34, 70); g.quadraticCurveTo(-42, 10, -38, -40); g.quadraticCurveTo(0, -56, 40, -44); g.quadraticCurveTo(44, 10, 34, 70); g.closePath(); g.fill();
  const fing = [[-27, 66, 15.5], [-9, 78, 16.5], [9, 74, 16], [25, 56, 14]];
  fing.forEach(([fx, len, w], i) => { const a = (i - 1.5) * .07 * spread; seg(g, [fx, -40], [fx + Math.sin(a) * len, -40 - Math.cos(a) * len], w, w * .82, col); });
  seg(g, [-36, 20], [-66, -24], 19, 15, col);
  g.restore();
}

// ---------------------------------------------------------------- scenery
function makeTree(seed, w = 1500, h = 1150) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const r = mulberry32(seed);
  const ends = [];
  const branch = (x, y, ang, len, wd, depth) => {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.strokeStyle = '#4b3436'; g.lineCap = 'round'; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo((x + x2) / 2 + (r() - .5) * len * .3, (y + y2) / 2, x2, y2); g.stroke();
    if (depth <= 0 || len < 16) { ends.push([x2, y2]); return; }
    const n = depth > 4 ? 2 : (r() < .5 ? 2 : 3);
    for (let i = 0; i < n; i++) branch(x2, y2, ang + (r() - .5) * .9 + (i - (n - 1) / 2) * .62, len * (.66 + r() * .16), wd * .66, depth - 1);
    if (depth < 3) ends.push([x2, y2]);
  };
  branch(w * .5, h + 4, -Math.PI / 2 + (r() - .5) * .12, 300, 36, 6);
  const cols = ['#f6c4d2', '#f3b3c6', '#fbd9e3', '#eea9bf', '#fff0f4'];
  for (const [x, y] of ends) for (let k = 0; k < 12; k++) {
    const a = r() * TAU, d = r() * 44; g.globalAlpha = .5 + r() * .3; g.fillStyle = cols[(r() * cols.length) | 0];
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .8, 9 + r() * 19, 0, TAU); g.fill();
  }
  g.globalAlpha = 1; return c;
}
function makeTrellis() {
  const r = mulberry32(5), T = { poles: [1300, 1455, 1610, 1765, 1920], leaves: [], cukes: [], flowers: [], vines: [] };
  for (const x of T.poles) {
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([x + Math.sin(u * 9 + x) * 26, 882 - u * 330]); } T.vines.push(pts);
    for (let i = 0; i < 16; i++) { const p = pts[2 + ((r() * 21) | 0)]; T.leaves.push({ x: p[0] + (r() - .5) * 70, y: p[1] + (r() - .5) * 30, s: 14 + r() * 16, a: (r() - .5) * 1.6, ph: r() * 6 }); }
    for (let i = 0; i < 4; i++) { const p = pts[6 + ((r() * 16) | 0)]; T.flowers.push({ x: p[0] + (r() - .5) * 60, y: p[1] + (r() - .5) * 24 }); }
    for (let i = 0; i < 2; i++) { const p = pts[7 + ((r() * 12) | 0)]; T.cukes.push({ x: p[0] + (r() - .5) * 50, y: p[1], a: 1.45 + (r() - .5) * .3, s: .9 + r() * .3 }); }
  }
  T.cukes.unshift({ x: 1288, y: 676, a: 1.5, s: 1, pick: true });
  return T;
}
function leaf(g, x, y, s, a, col) { g.save(); g.translate(x, y); g.rotate(a); g.scale(s / 20, s / 20); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-18, -6, -22, -26, -6, -30); g.quadraticCurveTo(0, -24, 6, -30); g.bezierCurveTo(22, -26, 18, -6, 0, 0); g.fill(); g.restore(); }
function drawTrellis(g, T, t, picked) {
  g.strokeStyle = '#7d6a4c'; g.lineCap = 'round'; g.lineWidth = 6;
  for (const x of T.poles) { g.beginPath(); g.moveTo(x, 890); g.lineTo(x + 4, 548); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); for (let i = 0; i < T.poles.length - 1; i++) { const a = T.poles[i], b = T.poles[i + 1]; g.moveTo(a, 600); g.lineTo(b, 600); g.moveTo(a, 720); g.lineTo(b, 720); g.moveTo(a, 840); g.lineTo(b, 600); g.moveTo(a, 600); g.lineTo(b, 840); } g.stroke();
  g.strokeStyle = '#4a7135'; g.lineWidth = 3;
  for (const v of T.vines) { g.beginPath(); g.moveTo(v[0][0], v[0][1]); for (let i = 1; i < v.length; i++) g.lineTo(v[i][0] + Math.sin(t + i) * 1.5, v[i][1]); g.stroke(); }
  for (const c of T.cukes) { if (c.pick && picked) continue; const sw = Math.sin(t * 1.2 + c.x) * .04; seg(g, [c.x, c.y - 12], [c.x, c.y + 2], 2.5, 2, '#4a6a2a'); cucumber(g, c.x, c.y, c.a + sw, c.s); }
  for (const l of T.leaves) leaf(g, l.x, l.y, l.s, l.a + Math.sin(t * 1.3 + l.ph) * .08, l.ph > 3 ? '#4b7a37' : '#5a8a41');
  for (const f of T.flowers) { for (let k = 0; k < 5; k++) ell(g, f.x + Math.cos(k * 1.256) * 4, f.y + Math.sin(k * 1.256) * 4, 3.6, 3.6, '#f1d24a'); }
}
function grass(g, x0, x1, yfn, step, hmin, hmax, t, col, seed, wind = 1) {
  const r = mulberry32(seed); g.strokeStyle = col; g.lineCap = 'round';
  for (let x = x0; x < x1; x += step * (.6 + r() * .8)) {
    const h = hmin + r() * (hmax - hmin), y = yfn(x), b = Math.sin(t * 1.3 + x * .013) * h * .25 * wind + (r() - .5) * h * .35;
    g.lineWidth = 1.6 + r() * 2; g.beginPath(); g.moveTo(x, y + 3); g.quadraticCurveTo(x + b * .3, y - h * .5, x + b, y - h); g.stroke();
  }
}
function curtain(g, x0, x1, t, left) {
  const n = 9, w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w, sw = Math.sin(t * .5 + i) * 6;
    const grd = g.createLinearGradient(x, 0, x + w, 0); grd.addColorStop(0, '#4a0914'); grd.addColorStop(.5, '#a01b30'); grd.addColorStop(1, '#3a050e');
    g.fillStyle = grd; g.beginPath(); g.moveTo(x - 2, 60); g.lineTo(x + w + 2, 60); g.quadraticCurveTo(x + w + sw, 600, x + w + sw * 1.5 + (left ? -i * 3 : i * 3), 1000); g.lineTo(x + sw * 1.5 + (left ? -i * 3 : i * 3), 1000); g.quadraticCurveTo(x + sw, 600, x - 2, 60); g.fill();
  }
  g.fillStyle = '#4a0913'; g.beginPath(); g.moveTo(x0, 40); g.lineTo(x1, 40); g.lineTo(x1, 120);
  for (let i = 4; i >= 0; i--) { const xa = lerp(x0, x1, (i + 1) / 5), xb = lerp(x0, x1, i / 5); g.quadraticCurveTo((xa + xb) / 2, 190, xb, 120); }
  g.closePath(); g.fill();
}
