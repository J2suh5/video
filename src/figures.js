// 角色剪影与道具（Canvas2D 绘制 → WebGL 纹理）
// 剪影纹理使用通道编码：R=衣物  G=头发  B=皮肤，着色器再按角色配色与轮廓光上色。
window.SM = window.SM || {};
(function () {
  const U = SM.U;
  const CH = { body: 'rgb(204,0,0)', hair: 'rgb(0,204,0)', skin: 'rgb(0,0,204)', trim: 'rgb(204,0,204)', dark: 'rgba(150,150,0,0.55)', shine: 'rgba(0,255,0,0.55)' };
  // 通道亮度（0.8 为基准）用于头发的体积感与高光
  const hairGrad = (ctx, y0, y1, a = 225, b = 150) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgb(0,${a},0)`); g.addColorStop(1, `rgb(0,${b},0)`); return g; };
  function shineArc(ctx, hp, cx, cy, rx, ry, a0, a1, w) {
    ctx.strokeStyle = CH.shine; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * i / 16; const p = hp(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
  }

  // ---------- 几何工具 ----------
  function sampleCR(P, N) {
    const out = [], n = P.length;
    for (let k = 0; k < N; k++) {
      const u = (k / (N - 1)) * (n - 1);
      const i = Math.min(Math.floor(u), n - 2), f = u - i;
      const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, n - 1)];
      const f2 = f * f, f3 = f2 * f;
      const c = (a0, a1, a2, a3) => 0.5 * (2 * a1 + (-a0 + a2) * f + (2 * a0 - 5 * a1 + 4 * a2 - a3) * f2 + (-a0 + 3 * a1 - 3 * a2 + a3) * f3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
    return out;
  }
  function crClosed(ctx, P) {
    const n = P.length;
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  }
  function smoothFill(ctx, P, color) {
    ctx.beginPath();
    crClosed(ctx, P);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function polyFill(ctx, P, color) {
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function strand(C, wL, wR) {
    const Lp = [], Rp = [];
    for (let i = 0; i < C.length; i++) {
      const a = C[Math.max(i - 1, 0)], b = C[Math.min(i + 1, C.length - 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      Lp.push([C[i][0] - ty * wL[i], C[i][1] + tx * wL[i]]);
      Rp.push([C[i][0] + ty * wR[i], C[i][1] - tx * wR[i]]);
    }
    return Lp.concat(Rp.reverse());
  }
  const lerpArr = (arr, u) => {
    const x = U.clamp(u) * (arr.length - 1);
    const i = Math.min(Math.floor(x), arr.length - 2);
    return U.mix(arr[i], arr[i + 1], x - i);
  };
  function limb(ctx, pts, widths, color, caps = true) {
    const C = sampleCR(pts, 18);
    const W = C.map((_, i) => lerpArr(widths, i / (C.length - 1)));
    polyFill(ctx, strand(C, W, W), color);
    if (caps) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(C[0][0], C[0][1], W[0], 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(C[C.length - 1][0], C[C.length - 1][1], W[W.length - 1], 0, Math.PI * 2); ctx.fill();
    }
  }
  function ellipse(ctx, x, y, rx, ry, rot, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // 两段式手臂：角度或目标点（IK）
  function armSolve(S, sgn, spec, L1, L2) {
    if (spec && spec.target) {
      const T = spec.target;
      const dx = T[0] - S[0], dy = T[1] - S[1];
      let d = Math.hypot(dx, dy);
      d = U.clamp(d, 20, L1 + L2 - 0.5);
      const phi = Math.atan2(dy, dx);
      const A = Math.acos(U.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const e1 = [S[0] + Math.cos(phi + A) * L1, S[1] + Math.sin(phi + A) * L1];
      const e2 = [S[0] + Math.cos(phi - A) * L1, S[1] + Math.sin(phi - A) * L1];
      const E = e1[1] > e2[1] ? e1 : e2;
      return { E, H: [S[0] + Math.cos(phi) * d, S[1] + Math.sin(phi) * d] };
    }
    const a1 = spec ? spec.a1 : 0.08, a2 = spec ? spec.a2 : 0.06;
    const E = [S[0] + sgn * Math.sin(a1) * L1, S[1] + Math.cos(a1) * L1];
    const H = [E[0] + sgn * Math.sin(a1 + a2) * L2, E[1] + Math.cos(a1 + a2) * L2];
    return { E, H };
  }
  function drawArm(ctx, S, A, wU, wF, hand, sleeveColor) {
    const dx = A.H[0] - A.E[0], dy = A.H[1] - A.E[1];
    const l = Math.hypot(dx, dy) || 1;
    const W = [A.H[0] - (dx / l) * hand * 1.1, A.H[1] - (dy / l) * hand * 1.1];
    limb(ctx, [S, A.E, W], [wU, (wU + wF) / 2, wF], sleeveColor);
    ellipse(ctx, A.H[0], A.H[1], hand * 0.85, hand, Math.atan2(dy, dx) - Math.PI / 2, CH.skin);
  }

  // ---------- 少女（背影，站立），单位：身高 1000 ----------
  function drawGirl(ctx, o) {
    const t = o.t || 0, wind = o.wind == null ? 0.3 : o.wind;
    const dress = o.dress || 'school';
    ctx.save();
    let bob = 0, liftL = 0, liftR = 0, sway = 0;
    if (o.walk != null) {
      const ph = o.walk * Math.PI * 2;
      bob = -Math.abs(Math.cos(ph)) * 8 + 4;
      liftL = Math.max(0, Math.sin(ph));
      liftR = Math.max(0, -Math.sin(ph));
      sway = Math.sin(ph) * 3;
    }
    const tx = (x) => o.x + (x + sway) * o.s;
    const ty = (y) => o.y + (y + bob) * o.s;
    const toCanvas = (P) => [tx(P[0]), ty(P[1])];
    const toLocal = (P) => [(P[0] - o.x) / o.s - sway, (P[1] - o.y) / o.s - bob];
    ctx.translate(o.x, o.y);
    ctx.scale(o.s, o.s);
    ctx.translate(sway, bob);

    if (dress === 'school') {
      leg(ctx, -1, liftL);
      leg(ctx, 1, liftR);
      skirtSchool(ctx, t, wind, o.walk);
    } else {
      gown(ctx, t, wind);
    }
    torso(ctx, dress, o.hair);

    const SL = [-64, -802], SR = [64, -802];
    const spec = (s) => (s && s.target ? { target: toLocal(s.target) } : s);
    const aL = armSolve(SL, -1, spec(o.armL), 160, 178);
    const aR = armSolve(SR, 1, spec(o.armR), 160, 178);
    const sleeve = dress === 'gown' ? CH.body : CH.body;
    drawArm(ctx, SL, aL, 17, 12, 17, sleeve);
    drawArm(ctx, SR, aR, 17, 12, 17, sleeve);
    if (dress === 'gown') {
      ellipse(ctx, -76, -792, 30, 25, -0.3, CH.body);
      ellipse(ctx, 76, -792, 30, 25, 0.3, CH.body);
    }
    ctx.fillStyle = CH.skin;
    ctx.fillRect(-16, -878, 32, 66);

    const tilt = o.headTilt || 0, down = o.headDown || 0;
    const pv = [0, -850];
    const hp = (x, y) => {
      const k = y < -860 ? 1 : Math.max(0.12, 1 - (y + 860) / 230);
      const a = tilt * k;
      const dx = x - pv[0], dy = y - pv[1];
      const c = Math.cos(a), s = Math.sin(a);
      return [pv[0] + c * dx - s * dy, pv[1] + s * dx + c * dy + down * k];
    };
    if (o.hair === 'saki') sakikoHair(ctx, hp, t, wind, o);
    else mutsumiHair(ctx, hp, t, wind, o);
    if (dress === 'gown') gownBow(ctx, t, wind, o.hair);
    ctx.restore();
    return { handL: toCanvas(aL.H), handR: toCanvas(aR.H), head: toCanvas(hp(0, -930)), shoulderL: toCanvas(SL), shoulderR: toCanvas(SR) };
  }

  function leg(ctx, sgn, lift) {
    const hip = [sgn * 30, -470], knee = [sgn * 27, -262 - lift * 18];
    const calf = [sgn * 28.5, -178 - lift * 55], ankle = [sgn * 25, -62 - lift * 90];
    limb(ctx, [hip, knee, calf, ankle], [24, 16, 18.5, 11], CH.skin);
    limb(ctx, [[sgn * 27.5, -215 - lift * 48], calf, ankle], [17, 19, 11.5], CH.body, false);
    ellipse(ctx, sgn * 25, -30 - lift * 95, 19, 27 - lift * 9, 0, CH.body);
  }
  function skirtSchool(ctx, t, wind, walk) {
    const sw = wind * 5 * Math.sin(t * 1.7) + (walk != null ? Math.sin(walk * Math.PI * 2) * 6 : 0);
    const P = [[-48, -664], [-62, -615], [-84, -545], [-106, -478]];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = U.mix(-117, 117, u) + sw;
      const y = -446 + (i % 2 ? 7 : 0) + 6 * Math.sin(u * Math.PI);
      P.push([x, y]);
    }
    P.push([106 + sw * 0.6, -478], [84, -545], [62, -615], [48, -664]);
    polyFill(ctx, sampleCR(P.slice(0, 4), 8).concat(P.slice(4, 4 + n + 1), sampleCR(P.slice(4 + n + 1), 8)), CH.body);
    ctx.strokeStyle = CH.dark;
    ctx.lineWidth = 3;
    for (let i = 1; i < 8; i++) {
      const u = i / 8;
      ctx.beginPath();
      ctx.moveTo(U.mix(-44, 44, u), -650);
      ctx.lineTo(U.mix(-112, 112, u) + sw, -452);
      ctx.stroke();
    }
  }
  function gown(ctx, t, wind) {
    const sw = wind * 8 * Math.sin(t * 1.3);
    const side = [[-46, -660], [-62, -590], [-98, -470], [-150, -300], [-196, -140], [-222, -30]];
    const L = sampleCR(side, 14);
    const hem = [];
    const n = 16;
    for (let i = 0; i <= n * 4; i++) {
      const u = i / (n * 4);
      const x = U.mix(-226, 226, u) + sw * Math.sin(u * Math.PI);
      const sc = Math.abs(Math.sin(u * n * Math.PI));
      hem.push([x, -4 - sc * 18 + 4 * Math.sin(u * Math.PI)]);
    }
    const R = sampleCR(side.map(([x, y]) => [-x, y]).reverse(), 14);
    polyFill(ctx, L.concat(hem, R), CH.body);
    // 蕾丝边
    ctx.strokeStyle = CH.trim;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i <= n * 4; i++) {
      const u = i / (n * 4);
      const x = U.mix(-214, 214, u) + sw * Math.sin(u * Math.PI);
      const sc = Math.abs(Math.sin(u * n * Math.PI));
      const y = -34 - sc * 14 + 4 * Math.sin(u * Math.PI);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const x = U.mix(-150, 150, u);
      const y = -310 - Math.abs(Math.sin(u * 10 * Math.PI)) * 14 + 18 * Math.sin(u * Math.PI) * 0;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = CH.dark;
    ctx.lineWidth = 3;
    for (let i = 1; i < 10; i++) {
      const u = i / 10;
      ctx.beginPath();
      ctx.moveTo(U.mix(-40, 40, u), -640);
      ctx.quadraticCurveTo(U.mix(-120, 120, u), -330, U.mix(-210, 210, u) + sw * 0.5, -40);
      ctx.stroke();
    }
  }
  function gownBow(ctx, t, wind, hair) {
    const sw = Math.sin(t * 1.5) * 4 * wind;
    ctx.save();
    ctx.translate(0, -652);
    const c = CH.trim;
    ellipse(ctx, -46, -6, 44, 22, 0.25, c);
    ellipse(ctx, 46, -6, 44, 22, -0.25, c);
    polyFill(ctx, [[-10, 0], [-46 + sw, 150], [-28 + sw, 140], [-18 + sw, 160], [4, 6]], c);
    polyFill(ctx, [[10, 0], [44 + sw, 150], [26 + sw, 140], [16 + sw, 160], [-4, 6]], c);
    ellipse(ctx, 0, -4, 15, 15, 0, CH.body);
    ctx.restore();
  }
  function torso(ctx, dress, hair) {
    const P = [[-20, -838], [-58, -826], [-79, -802], [-84, -768], [-76, -716], [-62, -676], [-50, -648], [50, -648], [62, -676], [76, -716], [84, -768], [79, -802], [58, -826], [20, -838]];
    smoothFill(ctx, P, CH.body);
    if (dress === 'school') {
      // 水手服后领
      ctx.fillStyle = CH.body;
      ctx.strokeStyle = CH.trim;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-58, -828); ctx.lineTo(-62, -716); ctx.lineTo(62, -716); ctx.lineTo(58, -828);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-50, -826); ctx.lineTo(-53, -726); ctx.lineTo(53, -726); ctx.lineTo(50, -826);
      ctx.stroke();
    } else {
      ctx.strokeStyle = CH.trim;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-30, -836); ctx.quadraticCurveTo(0, -818, 30, -836);
      ctx.stroke();
    }
  }

  // 祥子：双马尾 + 螺旋卷
  function drillTail(ctx, pts, N, w0, w1, turns, curlAmp) {
    const C = sampleCR(pts, N);
    const wl = [], wr = [];
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      let w = w0 + (w1 - w0) * U.smooth(0, 0.2, s);
      w *= 1 - 0.78 * U.smooth(0.78, 1.0, s);
      const ph = s * turns * Math.PI * 2;
      const k = curlAmp * U.smooth(0.08, 0.3, s);
      wl.push(w * (1 + k * Math.sin(ph)));
      wr.push(w * (1 + k * Math.sin(ph + Math.PI)));
    }
    const outline = strand(C, wl, wr);
    polyFill(ctx, outline, hairGrad(ctx, C[0][1], C[N - 1][1], 215, 140));
    // 卷发阴影线
    ctx.strokeStyle = CH.dark;
    ctx.lineCap = 'round';
    const L = outline.slice(0, N), R = outline.slice(N).reverse();
    const segs = Math.round(turns * 2);
    for (let k = 1; k < segs; k++) {
      const s = k / segs;
      const i = Math.round(s * (N - 1));
      const j = Math.min(N - 1, i + Math.round((N / segs) * 0.55));
      if (s < 0.12 || s > 0.95) continue;
      ctx.strokeStyle = CH.dark;
      ctx.lineWidth = Math.max(1.5, wl[i] * 0.09);
      ctx.beginPath();
      ctx.moveTo(L[i][0], L[i][1]);
      ctx.quadraticCurveTo(C[i][0] * 0.5 + C[j][0] * 0.5, C[i][1] * 0.5 + C[j][1] * 0.5, R[j][0], R[j][1]);
      ctx.stroke();
      const i2 = Math.max(0, i - Math.round(N / segs * 0.28)), j2 = Math.max(0, j - Math.round(N / segs * 0.28));
      ctx.strokeStyle = CH.shine;
      ctx.lineWidth = Math.max(1.5, wl[i] * 0.13);
      ctx.beginPath();
      ctx.moveTo(U.mix(L[i2][0], C[i2][0], 0.25), U.mix(L[i2][1], C[i2][1], 0.25));
      ctx.quadraticCurveTo(C[i2][0] * 0.5 + C[j2][0] * 0.5, C[i2][1] * 0.5 + C[j2][1] * 0.5, U.mix(R[j2][0], C[j2][0], 0.35), U.mix(R[j2][1], C[j2][1], 0.35));
      ctx.stroke();
    }
  }
  function bow(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    polyFill(ctx, sampleCR([[0, 0], [-14, -16], [-30, -18], [-34, -4], [-28, 10], [-12, 8], [0, 0]], 16), CH.body);
    polyFill(ctx, sampleCR([[0, 0], [14, -16], [30, -18], [34, -4], [28, 10], [12, 8], [0, 0]], 16), CH.body);
    polyFill(ctx, [[-4, 2], [-16, 30], [-8, 28], [-4, 34], [2, 4]], CH.body);
    polyFill(ctx, [[4, 2], [14, 28], [8, 26], [6, 32], [-2, 4]], CH.body);
    ellipse(ctx, 0, 0, 7, 7, 0, CH.body);
    ctx.restore();
  }
  function sakikoHair(ctx, hp, t, wind, o) {
    ellipse(ctx, -71, -912, 9, 16, 0, CH.skin);
    ellipse(ctx, 71, -912, 9, 16, 0, CH.skin);
    for (const sgn of [-1, 1]) {
      const base = [[60, -966], [98, -946], [116, -880], [112, -790], [104, -700], [100, -625], [94, -560], [90, -528]];
      const pts = base.map(([x, y], i) => {
        const s = i / (base.length - 1);
        const sw = wind * 24 * Math.sin(t * 1.3 + sgn * 0.7 + s * 2.4) * Math.pow(s, 1.3) + (o.tailSwing || 0) * s * s * sgn;
        return hp(sgn * x + sw, y + (o.tailBounce || 0) * s * s);
      });
      drillTail(ctx, pts, 72, 15, 33, 4.5, 0.22);
    }
    const M = [];
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      let r = 1;
      if (Math.sin(a) > 0.6) r = 1 - 0.04 * Math.sin(a * 9);
      M.push(hp(Math.cos(a) * 77 * r, -930 + Math.sin(a) * 83 * r));
    }
    polyFill(ctx, M, hairGrad(ctx, -1013, -850, 220, 150));
    shineArc(ctx, hp, 0, -925, 60, 50, Math.PI * 1.15, Math.PI * 1.85, 9);
    ctx.strokeStyle = CH.dark;
    ctx.lineWidth = 2.5;
    for (let i = -3; i <= 3; i++) {
      const a = hp(i * 4, -1005), b = hp(i * 20, -940), c = hp(i * 19, -856);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
    }
    for (const sgn of [-1, 1]) {
      const p = hp(sgn * 62, -966);
      bow(ctx, p[0], p[1], 1.15, sgn * 0.5 + (o.headTilt || 0));
    }
  }
  // 睦：长直发
  function mutsumiHair(ctx, hp, t, wind, o) {
    const sw = (y) => {
      const k = U.clamp((y + 830) / 250);
      return wind * 15 * Math.sin(t * 1.1 + y * 0.004) * Math.pow(k, 1.2) + (o.hairSwing || 0) * k;
    };
    const left = [[-70, -958], [-79, -905], [-85, -845], [-89, -780], [-88, -705], [-84, -640], [-80, -598]];
    const tips = [-588, -574, -596, -580, -600, -582, -597, -576, -590];
    const P = [];
    sampleCR(left, 20).forEach(([x, y]) => P.push(hp(x + sw(y), y)));
    for (let i = 0; i < tips.length; i++) {
      const x = U.mix(-78, 78, i / (tips.length - 1));
      P.push(hp(x + sw(tips[i]), tips[i]));
    }
    sampleCR(left.map(([x, y]) => [-x, y]).reverse(), 20).forEach(([x, y]) => P.push(hp(x + sw(y), y)));
    for (let i = 1; i < 24; i++) {
      const a = Math.PI * (i / 24);
      P.push(hp(Math.cos(a) * 72, -958 - Math.sin(a) * 58));
    }
    polyFill(ctx, P, hairGrad(ctx, -1016, -580, 222, 135));
    shineArc(ctx, hp, 0, -930, 62, 48, Math.PI * 1.12, Math.PI * 1.88, 9);
    ctx.strokeStyle = CH.dark;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const x0 = i * 9, x1 = i * 18;
      const a = hp(x0, -1000), b = hp(x1 + sw(-760), -800), c = hp(x1 * 1.05 + sw(-640), -620 + Math.abs(i) * 4);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
    }
  }

  // ---------- 童年（坐姿背影），单位：坐高约 430 ----------
  function drawKid(ctx, o) {
    const t = o.t || 0, wind = o.wind == null ? 0.25 : o.wind;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.s, o.s);
    const toCanvas = (P) => [o.x + P[0] * o.s, o.y + P[1] * o.s];
    const body = [[-26, -230], [-56, -220], [-70, -198], [-68, -150], [-74, -95], [-96, -42], [-112, -8], [-100, 4], [0, 8], [100, 4], [112, -8], [96, -42], [74, -95], [68, -150], [70, -198], [56, -220], [26, -230]];
    smoothFill(ctx, body, CH.body);
    const SL = [-58, -200], SR = [58, -200];
    const loc = (s) => (s && s.target ? { target: [(s.target[0] - o.x) / o.s, (s.target[1] - o.y) / o.s] } : s);
    const aL = armSolve(SL, -1, loc(o.armL) || { a1: 0.12, a2: 0.2 }, 82, 74);
    const aR = armSolve(SR, 1, loc(o.armR) || { a1: 0.12, a2: 0.2 }, 82, 74);
    drawArm(ctx, SL, aL, 11, 9, 13, CH.skin);
    drawArm(ctx, SR, aR, 11, 9, 13, CH.skin);
    ellipse(ctx, -60, -203, 22, 20, 0, CH.body);
    ellipse(ctx, 60, -203, 22, 20, 0, CH.body);
    // 圆领
    ctx.fillStyle = CH.trim;
    ctx.beginPath();
    ctx.ellipse(-26, -226, 32, 15, 0.25, 0, Math.PI * 2);
    ctx.ellipse(26, -226, 32, 15, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CH.skin;
    ctx.fillRect(-13, -262, 26, 40);
    const tilt = o.headTilt || 0;
    const pv = [0, -238];
    const hp = (x, y) => {
      const k = y < -250 ? 1 : Math.max(0.2, 1 - (y + 250) / 140);
      const a = tilt * k;
      const dx = x - pv[0], dy = y - pv[1];
      const c = Math.cos(a), s = Math.sin(a);
      return [pv[0] + c * dx - s * dy, pv[1] + s * dx + c * dy];
    };
    if (o.hair === 'saki') {
      for (const sgn of [-1, 1]) {
        const base = [[80, -385], [118, -365], [130, -305], [124, -240], [116, -180], [110, -150]];
        const pts = base.map(([x, y], i) => {
          const s = i / (base.length - 1);
          return hp(sgn * x + wind * 14 * Math.sin(t * 1.4 + sgn + s * 2) * s * s, y);
        });
        drillTail(ctx, pts, 48, 12, 27, 2.6, 0.2);
      }
      const M = [];
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; M.push(hp(Math.cos(a) * 98, -334 + Math.sin(a) * 99)); }
      polyFill(ctx, M, hairGrad(ctx, -433, -235, 222, 150));
      shineArc(ctx, hp, 0, -330, 76, 62, Math.PI * 1.15, Math.PI * 1.85, 11);
      for (const sgn of [-1, 1]) { const p = hp(sgn * 80, -388); bow(ctx, p[0], p[1], 1.25, sgn * 0.5 + tilt); }
    } else {
      const sw = (y) => wind * 8 * Math.sin(t * 1.2 + y * 0.01) * U.clamp((y + 300) / 110);
      const left = [[-92, -360], [-99, -300], [-98, -250], [-94, -205]];
      const P = [];
      sampleCR(left, 12).forEach(([x, y]) => P.push(hp(x + sw(y), y)));
      const tips = [-198, -190, -201, -192, -200, -191, -199];
      for (let i = 0; i < tips.length; i++) P.push(hp(U.mix(-92, 92, i / (tips.length - 1)) + sw(tips[i]), tips[i]));
      sampleCR(left.map(([x, y]) => [-x, y]).reverse(), 12).forEach(([x, y]) => P.push(hp(x + sw(y), y)));
      for (let i = 1; i < 24; i++) { const a = Math.PI * (i / 24); P.push(hp(Math.cos(a) * 92, -360 - Math.sin(a) * 72)); }
      polyFill(ctx, P, hairGrad(ctx, -432, -195, 222, 145));
      shineArc(ctx, hp, 0, -335, 74, 60, Math.PI * 1.13, Math.PI * 1.87, 11);
      ctx.strokeStyle = CH.dark;
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        if (!i) continue;
        const a = hp(i * 8, -420), b = hp(i * 22, -320), c = hp(i * 26, -210);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
      }
    }
    ctx.restore();
    return { handL: toCanvas(aL.H), handR: toCanvas(aR.H), head: toCanvas(hp(0, -334)) };
  }

  // ---------- 图层：一张画布映射到世界坐标的矩形 ----------
  function Layer(eng, rect, ppw) {
    this.eng = eng;
    this.rect = rect; // [x0, y0, x1, y1] 世界坐标（y 向上）
    this.ppw = ppw;
    this.cv = document.createElement('canvas');
    this.cv.width = Math.ceil((rect[2] - rect[0]) * ppw);
    this.cv.height = Math.ceil((rect[3] - rect[1]) * ppw);
    this.ctx = this.cv.getContext('2d');
    this.tex = null;
  }
  Layer.prototype.cx = function (wx) { return (wx - this.rect[0]) * this.ppw; };
  Layer.prototype.cy = function (wy) { return (this.rect[3] - wy) * this.ppw; };
  Layer.prototype.wx = function (cx) { return this.rect[0] + cx / this.ppw; };
  Layer.prototype.wy = function (cy) { return this.rect[3] - cy / this.ppw; };
  Layer.prototype.w = function (p) { return [this.wx(p[0]), this.wy(p[1])]; };
  Layer.prototype.clear = function () { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); };
  Layer.prototype.upload = function () { this.tex = this.eng.canvasTexture(this.cv, this.tex); };
  // 站立少女：wx = 双脚中心，wy = 地面，h = 身高（世界单位）
  Layer.prototype.girl = function (o) {
    const s = (o.h * this.ppw) / 1000;
    const tgt = (P) => (P ? { target: [this.cx(P[0]), this.cy(P[1])] } : null);
    const res = drawGirl(this.ctx, Object.assign({}, o, {
      x: this.cx(o.wx), y: this.cy(o.wy), s,
      armL: o.armLW ? tgt(o.armLW) : o.armL,
      armR: o.armRW ? tgt(o.armRW) : o.armR,
    }));
    return { handL: this.w(res.handL), handR: this.w(res.handR), head: this.w(res.head), shoulderL: this.w(res.shoulderL), shoulderR: this.w(res.shoulderR) };
  };
  Layer.prototype.kid = function (o) {
    const s = (o.h * this.ppw) / 430;
    const tgt = (P) => (P ? { target: [this.cx(P[0]), this.cy(P[1])] } : null);
    const res = drawKid(this.ctx, Object.assign({}, o, {
      x: this.cx(o.wx), y: this.cy(o.wy), s,
      armL: o.armLW ? tgt(o.armLW) : o.armL,
      armR: o.armRW ? tgt(o.armRW) : o.armR,
    }));
    return { handL: this.w(res.handL), handR: this.w(res.handR), head: this.w(res.head) };
  };
  Layer.prototype.spriteArgs = function () {
    const r = this.rect;
    return { pos: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], size: [(r[2] - r[0]) / 2, (r[3] - r[1]) / 2], texel: [1 / this.cv.width, 1 / this.cv.height] };
  };

  // ---------- 静态道具 ----------
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function blossom(ctx, x, y, r, rot, rnd) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * Math.PI * 2);
      const g = ctx.createLinearGradient(0, 0, 0, -r);
      g.addColorStop(0, '#f39ab4');
      g.addColorStop(0.45, '#fcd3df');
      g.addColorStop(1, '#fff3f6');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-r * 0.55, -r * 0.3, -r * 0.55, -r * 0.95, -r * 0.12, -r);
      ctx.lineTo(0, -r * 0.86);
      ctx.lineTo(r * 0.12, -r);
      ctx.bezierCurveTo(r * 0.55, -r * 0.95, r * 0.55, -r * 0.3, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#d9577f';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e07a96';
    ctx.lineWidth = Math.max(1, r * 0.04);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rnd() * 0.3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42); ctx.stroke();
      ctx.fillStyle = '#ffe28a';
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.44, Math.sin(a) * r * 0.44, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function makeBranch() {
    const c = canvas(1500, 900), ctx = c.getContext('2d');
    const rnd = U.mulberry32(77);
    const flowers = [];
    function br(x, y, a, len, w, depth) {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      const mx = (x + x2) / 2 + (rnd() - 0.5) * len * 0.3, my = (y + y2) / 2 + (rnd() - 0.5) * len * 0.3;
      const g = ctx.createLinearGradient(x, y - w, x, y + w);
      g.addColorStop(0, '#6b4a3e');
      g.addColorStop(1, '#2b1a16');
      ctx.strokeStyle = g;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      if (depth > 0) {
        const n = depth > 2 ? 2 : 3;
        for (let i = 0; i < n; i++) {
          const u = 0.45 + rnd() * 0.5;
          const bx = U.mix(x, x2, u), by = U.mix(y, y2, u);
          br(bx, by, a + (rnd() - 0.5) * 1.5 + (i % 2 ? 0.5 : -0.4), len * (0.45 + rnd() * 0.3), w * 0.6, depth - 1);
        }
      }
      if (depth <= 2) {
        const k = depth === 0 ? 7 : 4;
        for (let i = 0; i < k; i++) {
          const u = rnd();
          flowers.push([U.mix(x, x2, u) + (rnd() - 0.5) * 50, U.mix(y, y2, u) + (rnd() - 0.5) * 50, 16 + rnd() * 16, rnd() * 6]);
        }
      }
    }
    br(-40, 40, 0.32, 620, 46, 4);
    br(-30, 260, -0.05, 420, 30, 3);
    for (const f of flowers) {
      if (f[0] < 0 || f[1] < 0 || f[0] > 1500 || f[1] > 900) continue;
      blossom(ctx, f[0], f[1], f[2], f[3], rnd);
    }
    for (let i = 0; i < 30; i++) {
      const f = flowers[Math.floor(rnd() * flowers.length)];
      ctx.fillStyle = '#e66b8e';
      ctx.beginPath(); ctx.ellipse(f[0] + 22, f[1] + 10, 6, 9, rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
    return c;
  }
  function leafShape(ctx, x, y, r, rot, light) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, light ? '#9fd36b' : '#6fae4c');
    g.addColorStop(1, light ? '#3f7a32' : '#25522a');
    ctx.fillStyle = g;
    ctx.beginPath();
    const pts = 5;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const lobe = 0.78 + 0.22 * Math.abs(Math.cos(a * pts * 0.5));
      const rr = r * lobe * (a > Math.PI * 1.35 && a < Math.PI * 1.65 ? 0.82 : 1);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,240,170,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      ctx.beginPath(); ctx.moveTo(0, r * 0.2); ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); ctx.stroke();
    }
    ctx.restore();
  }
  function cucumberShape(ctx, x, y, len, w, rot, flower) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, '#7fbf5a');
    g.addColorStop(0.45, '#3e8a3a');
    g.addColorStop(1, '#1d4f25');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.bezierCurveTo(-len / 2, -w * 1.1, len / 2, -w * 1.2, len / 2, 0);
    ctx.bezierCurveTo(len / 2, w * 1.1, -len / 2, w * 1.0, -len / 2, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(230,255,200,0.6)';
    for (let i = 0; i < 14; i++) {
      const u = (i / 14 - 0.5) * 0.85;
      ctx.beginPath(); ctx.arc(u * len, ((i % 3) - 1) * w * 0.4, Math.max(0.8, w * 0.07), 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,230,0.35)';
    ctx.lineWidth = Math.max(1, w * 0.12);
    ctx.beginPath(); ctx.moveTo(-len * 0.35, -w * 0.45); ctx.quadraticCurveTo(0, -w * 0.75, len * 0.35, -w * 0.45); ctx.stroke();
    if (flower) {
      ctx.fillStyle = '#f7d23e';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(len / 2 + w * 0.5 + Math.cos(a) * w * 0.45, Math.sin(a) * w * 0.45, w * 0.38, w * 0.25, a, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  function makeCucumber() {
    const c = canvas(260, 90), ctx = c.getContext('2d');
    cucumberShape(ctx, 115, 45, 190, 26, -0.05, true);
    return c;
  }
  function makeTrellis() {
    const c = canvas(1100, 1000), ctx = c.getContext('2d');
    const rnd = U.mulberry32(9);
    ctx.filter = 'blur(1.2px)';
    const poles = [140, 420, 700, 980];
    for (const x of poles) {
      const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
      g.addColorStop(0, '#8b7346'); g.addColorStop(0.5, '#d8c38a'); g.addColorStop(1, '#6e5a35');
      ctx.fillStyle = g;
      ctx.fillRect(x - 10, 60, 20, 940);
      ctx.fillStyle = 'rgba(80,60,30,0.6)';
      for (let y = 160; y < 1000; y += 170) ctx.fillRect(x - 11, y, 22, 5);
    }
    ctx.strokeStyle = '#b9a676';
    ctx.lineWidth = 11;
    for (const y of [150, 520]) { ctx.beginPath(); ctx.moveTo(110, y); ctx.lineTo(1010, y + 10); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(240,235,210,0.5)';
    ctx.lineWidth = 2;
    for (let x = 140; x <= 980; x += 70) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x + 6, 1000); ctx.stroke(); }
    for (let y = 150; y <= 1000; y += 70) { ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(980, y + 5); ctx.stroke(); }
    // 藤蔓
    ctx.strokeStyle = '#3d6b2c';
    ctx.lineWidth = 4;
    const leaves = [];
    for (let v = 0; v < 9; v++) {
      let x = 160 + v * 100 + rnd() * 40, y = 1000;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 14; k++) {
        const nx = x + (rnd() - 0.5) * 90, ny = y - 50 - rnd() * 40;
        ctx.quadraticCurveTo(x + (rnd() - 0.5) * 60, (y + ny) / 2, nx, ny);
        x = nx; y = ny;
        if (y < 140) break;
        if (rnd() < 0.85) leaves.push([x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 30, 30 + rnd() * 34, rnd() * 6, rnd() < 0.5]);
      }
      ctx.stroke();
    }
    leaves.sort((a, b) => a[2] - b[2]);
    for (const l of leaves) leafShape(ctx, l[0], l[1], l[2], l[3], l[4]);
    for (let i = 0; i < 14; i++) {
      const l = leaves[Math.floor(rnd() * leaves.length)];
      ctx.fillStyle = '#f6d13a';
      ctx.save(); ctx.translate(l[0] + 20, l[1] + 10);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 8, 8, 5, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e09a1e'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) {
      const x = 200 + rnd() * 720, y = 300 + rnd() * 600;
      ctx.strokeStyle = '#3d6b2c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x, y - 8); ctx.stroke();
      cucumberShape(ctx, x, y + 50, 120 + rnd() * 50, 15, Math.PI / 2 + (rnd() - 0.5) * 0.4, rnd() < 0.5);
    }
    ctx.filter = 'none';
    return c;
  }
  function makeUmbrella() {
    const c = canvas(760, 640), ctx = c.getContext('2d');
    const cx = 380, top = 70, R = 340, H = 190;
    // 伞柄
    ctx.strokeStyle = '#1b1d26';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + 40, 630); ctx.stroke();
    // 伞面
    const ribs = 8;
    const edge = [];
    for (let i = 0; i <= ribs; i++) {
      const u = i / ribs;
      edge.push([cx - R + 2 * R * u, top + H + Math.sin(u * Math.PI) * 16]);
    }
    const g = ctx.createRadialGradient(cx - 40, top - 30, 20, cx, top + 80, R * 1.1);
    g.addColorStop(0, 'rgba(120,135,180,0.95)');
    g.addColorStop(0.5, 'rgba(48,58,92,0.93)');
    g.addColorStop(1, 'rgba(22,26,44,0.92)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(edge[0][0], edge[0][1]);
    ctx.bezierCurveTo(cx - R, top + 20, cx - R * 0.5, top - 8, cx, top - 8);
    ctx.bezierCurveTo(cx + R * 0.5, top - 8, cx + R, top + 20, edge[ribs][0], edge[ribs][1]);
    for (let i = ribs - 1; i >= 0; i--) {
      const a = edge[i + 1], b = edge[i];
      ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 30, b[0], b[1]);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,175,220,0.35)';
    ctx.lineWidth = 3;
    for (let i = 1; i < ribs; i++) {
      ctx.beginPath(); ctx.moveTo(cx, top - 6); ctx.quadraticCurveTo(U.mix(cx, edge[i][0], 0.6), top + 30, edge[i][0], edge[i][1]); ctx.stroke();
    }
    ctx.fillStyle = '#1b1d26';
    ctx.fillRect(cx - 4, top - 34, 8, 28);
    return c;
  }
  // 假面：kind 0 = 祥（银蓝），1 = 睦（象牙绿）
  function makeMask(kind) {
    const c = canvas(900, 640), ctx = c.getContext('2d');
    const cx = 450, cy = 340;
    const base = kind === 0 ? ['#f4f6ff', '#aeb9d8', '#5c6a92'] : ['#fbf6ea', '#d7cfb4', '#7f8a6a'];
    const accent = kind === 0 ? '#5f86ff' : '#55c48f';
    const gold = kind === 0 ? '#c9d4f2' : '#e9c873';
    // 羽饰 / 藤蔓
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 7; i++) {
      const a = -1.2 - i * 0.16 + (kind ? 0.0 : 0.0);
      const s = kind === 0 ? 1 : -1;
      ctx.save();
      ctx.scale(s, 1);
      ctx.rotate(a + 0.9);
      const g = ctx.createLinearGradient(0, 0, 0, -300);
      g.addColorStop(0, kind === 0 ? 'rgba(60,80,160,0.95)' : 'rgba(40,110,80,0.95)');
      g.addColorStop(1, kind === 0 ? 'rgba(170,190,255,0.6)' : 'rgba(170,240,200,0.6)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(60, -40);
      ctx.bezierCurveTo(30, -150, 90, -230, 70 + i * 6, -300 + i * 14);
      ctx.bezierCurveTo(130, -220, 120, -120, 70, -40);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // 面具主体
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 330, cy - 40);
      ctx.bezierCurveTo(cx - 300, cy - 170, cx - 120, cy - 170, cx - 30, cy - 95);
      ctx.quadraticCurveTo(cx, cy - 75, cx + 30, cy - 95);
      ctx.bezierCurveTo(cx + 120, cy - 170, cx + 300, cy - 170, cx + 330, cy - 40);
      ctx.bezierCurveTo(cx + 320, cy + 60, cx + 200, cy + 120, cx + 90, cy + 90);
      ctx.bezierCurveTo(cx + 40, cy + 75, cx + 25, cy + 30, cx, cy + 30);
      ctx.bezierCurveTo(cx - 25, cy + 30, cx - 40, cy + 75, cx - 90, cy + 90);
      ctx.bezierCurveTo(cx - 200, cy + 120, cx - 320, cy + 60, cx - 330, cy - 40);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(cx, cy - 170, cx, cy + 120);
    g.addColorStop(0, base[0]); g.addColorStop(0.55, base[1]); g.addColorStop(1, base[2]);
    ctx.fillStyle = g;
    shape(); ctx.fill();
    // 眼洞
    ctx.globalCompositeOperation = 'destination-out';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 50, cy - 20);
      ctx.bezierCurveTo(cx + s * 90, cy - 75, cx + s * 200, cy - 80, cx + s * 240, cy - 30);
      ctx.bezierCurveTo(cx + s * 200, cy + 15, cx + s * 100, cy + 20, cx + s * 50, cy - 20);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 金边与花纹
    ctx.strokeStyle = gold;
    ctx.lineWidth = 7;
    shape(); ctx.stroke();
    ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 50, cy - 20);
      ctx.bezierCurveTo(cx + s * 90, cy - 75, cx + s * 200, cy - 80, cx + s * 240, cy - 30);
      ctx.bezierCurveTo(cx + s * 200, cy + 15, cx + s * 100, cy + 20, cx + s * 50, cy - 20);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const ox = cx + s * (250 - k * 10), oy = cy + 10 + k * 22;
        ctx.arc(ox, oy, 26 - k * 6, s > 0 ? Math.PI * 0.9 : -Math.PI * 0.1, s > 0 ? Math.PI * 2.3 : Math.PI * 1.3);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx + s * 70, cy - 100);
      ctx.bezierCurveTo(cx + s * 140, cy - 150, cx + s * 230, cy - 120, cx + s * 270, cy - 80);
      ctx.stroke();
    }
    // 宝石
    const gem = ctx.createRadialGradient(cx - 6, cy - 120, 2, cx, cy - 112, 26);
    gem.addColorStop(0, '#ffffff'); gem.addColorStop(0.35, accent); gem.addColorStop(1, '#101830');
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 145); ctx.lineTo(cx + 20, cy - 112); ctx.lineTo(cx, cy - 80); ctx.lineTo(cx - 20, cy - 112); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = gold; ctx.lineWidth = 3; ctx.stroke();
    // 缎带
    ctx.strokeStyle = kind === 0 ? 'rgba(70,90,170,0.9)' : 'rgba(60,130,95,0.9)';
    ctx.lineWidth = 10;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 325, cy - 30);
      ctx.bezierCurveTo(cx + s * 380, cy + 40, cx + s * 330, cy + 140, cx + s * 400, cy + 260);
      ctx.stroke();
    }
    if (kind === 1) {
      for (const [x, y, r, a] of [[cx - 280, cy - 130, 34, 0.4], [cx - 230, cy - 175, 26, -0.3], [cx + 250, cy + 80, 30, 2.2]]) leafShape(ctx, x, y, r, a, true);
    } else {
      ctx.fillStyle = 'rgba(200,215,255,0.9)';
      for (const [x, y, r] of [[cx + 270, cy - 150, 14], [cx + 230, cy - 190, 9], [cx + 300, cy - 110, 7]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    }
    return c;
  }

  SM.Fig = { drawGirl, drawKid, Layer, makeBranch, makeTrellis, makeUmbrella, makeCucumber, makeMask, CH };
})();
