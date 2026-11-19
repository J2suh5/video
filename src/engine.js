/* ==========================================================================
   engine.js — 极简 WebGL2 渲染引擎
   - HDR 场景缓冲 + 双重 Kawase 泛光 + ACES 色调映射 + 暗角/颗粒/色散
   - 粒子形变系统（65536 个粒子，在两个"形状纹理"之间插值）
   - 四维线框（实例化粗线，支持 4D 旋转与透视）
   - 字形精灵（指数塔里的"3"）
   - 若干全屏特效着色器（星云、数字隧道、递归塔、传送门、数轴）
   所有画面都只依赖时间 t，因此可以逐帧确定性地渲染成视频。
   ========================================================================== */
(function () {
'use strict';

const E = {};
window.E = E;

/* ---------------------------------------------------------------- math -- */
const M4 = {
  persp(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt(e, c, up = [0, 1, 0]) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  // 在坐标轴 i、j 张成的平面内旋转（适用于 3D 与 4D）
  rot(i, j, a) {
    const m = M4.ident(), c = Math.cos(a), s = Math.sin(a);
    m[i * 4 + i] = c; m[j * 4 + j] = c; m[i * 4 + j] = s; m[j * 4 + i] = -s;
    return m;
  },
  trs(tx, ty, tz, rx, ry, rz, s = 1) {
    let m = M4.mul(M4.rot(0, 2, ry), M4.mul(M4.rot(1, 2, rx), M4.rot(0, 1, rz)));
    for (let k = 0; k < 12; k++) m[k] *= s;
    m[12] = tx; m[13] = ty; m[14] = tz;
    return m;
  },
};
E.M4 = M4;

/* ------------------------------------------------------------- easing -- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = (x) => Math.pow(clamp(x), 3);
// 在 [t0,t1] 区间内淡入淡出
const fade = (t, t0, t1, fi = 0.8, fo = 0.8) => Math.min(smooth(seg(t, t0, t0 + fi)), 1 - smooth(seg(t, t1 - fo, t1)));
const mixv = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
Object.assign(E, { clamp, lerp, seg, smooth, ease, easeOut, easeIn, fade, mixv });

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
E.rng = mulberry32;

/* -------------------------------------------------------------- GLSL ---- */
const HDR = `#version 300 es
precision highp float;
precision highp int;
`;
const COMMON = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ v+=a*vnoise(p); p=m*p; a*=.5;} return v; }
float fbm3(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<3;i++){ v+=a*vnoise(p); p=m*p; a*=.5;} return v; }
uint pcg(uint v){ uint s = v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float rnd(uint v){ return float(pcg(v))/4294967295.; }
`;
const FS_VERT = HDR + `
out vec2 vUv;
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); vUv = p; gl_Position = vec4(p*2.-1., 0., 1.); }
`;

/* ------------------------------------------------------------ GL core --- */
let gl, canvas, W = 0, H = 0, hdrFmt, hdrType, quadVAO;
const progs = {};

function compile(type, src, name) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
    console.error(name + '\n' + log + '\n' + lines);
    throw new Error('Shader compile failed: ' + name + ' ' + log);
  }
  return s;
}
function program(name, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs, name + '.vs'));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs, name + '.fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed: ' + name + ' ' + gl.getProgramInfoLog(p));
  const loc = {};
  const P = {
    p,
    use() { gl.useProgram(p); return P; },
    l(n) { if (!(n in loc)) loc[n] = gl.getUniformLocation(p, n); return loc[n]; },
    f(n, ...v) {
      const L = P.l(n); if (L === null) return P;
      if (v.length === 1 && Array.isArray(v[0])) v = v[0];
      [gl.uniform1f, gl.uniform1f, gl.uniform2f, gl.uniform3f, gl.uniform4f][v.length].call(gl, L, ...v);
      return P;
    },
    i(n, v) { const L = P.l(n); if (L !== null) gl.uniform1i(L, v); return P; },
    m(n, v) { const L = P.l(n); if (L !== null) gl.uniformMatrix4fv(L, false, v); return P; },
    tex(n, unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); return P.i(n, unit); },
  };
  progs[name] = P;
  return P;
}

function makeTarget(w, h, fmt = hdrFmt, type = hdrType) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb, w, h };
}
function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }

let scene, bloomLv = [];
function resize(w, h) {
  if (w === W && h === H) return;
  W = w; H = h;
  canvas.width = w; canvas.height = h;
  freeTarget(scene); bloomLv.forEach(freeTarget);
  scene = makeTarget(w, h);
  bloomLv = [];
  let bw = w >> 1, bh = h >> 1;
  for (let i = 0; i < 6; i++) { bloomLv.push(makeTarget(Math.max(1, bw), Math.max(1, bh))); bw >>= 1; bh >>= 1; }
}
E.resize = resize;
E.size = () => [W, H];

function drawQuad() { gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); }

/* --------------------------------------------------------- shaders ------ */
const BG_FS = HDR + COMMON + `
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uC1, uC2, uC3;
uniform float uNeb, uStar, uAlpha;
uniform vec4 uBH;          // 黑洞：中心xy、事件视界半径、强度
uniform vec2 uDrift;
uniform vec4 uSky;         // 天空渐变：rgb + 强度
uniform float uSpin;

vec3 starLayer(vec2 p, float dens, float px, float t){
  vec2 i = floor(p), f = fract(p);
  vec2 h = hash22(i);
  if (h.x > dens) return vec3(0);
  vec2 sp = hash22(i + 7.13)*0.8 + 0.1;
  float d = length(f - sp) * px;            // 以像素计的距离
  float b = hash12(i + 3.3);
  float tw = 0.8 + 0.2*sin(t*(0.35 + b*1.1) + b*40.);
  float s = exp(-d*d*0.9) * (0.06 + b*b*b*b*3.5) * tw;
  s += exp(-d*0.5) * 0.06 * b*b*b*b;         // 星芒光晕
  vec3 col = mix(vec3(1.0,0.82,0.62), vec3(0.65,0.8,1.0), hash12(i + 9.1));
  return col * s;
}

vec3 background(vec2 uv){
  float t = uTime;
  vec2 q = uv * 1.25 + uDrift;
  float c = cos(uSpin), s = sin(uSpin);
  q = mat2(c, -s, s, c) * q;
  float w = fbm3(q*1.4 + vec2(t*0.012, -t*0.008));
  float n1 = fbm(q + w*1.3 + vec2(0., t*0.01));
  float n2 = fbm(q*2.1 - 3.7 + w*0.9 - vec2(t*0.006, 0.));
  vec3 neb = uC1 * pow(n1, 3.4) * 0.6 + uC2 * pow(n2, 4.6) * 0.9 + uC3 * pow(max(n1*n2*1.9 - 0.2, 0.), 2.) * 0.4;
  // 暗尘带
  neb *= 0.55 + 0.45*smoothstep(0.25, 0.75, fbm3(q*3.1 + 11.));
  vec3 col = neb * uNeb;
  float px = uRes.y;
  col += uStar * starLayer(uv*  60. + uDrift*20., 0.16, px/60., t);
  col += uStar * starLayer(uv* 120. + uDrift*40., 0.10, px/120., t) * 0.7;
  col += uStar * starLayer(uv* 220. + uDrift*70., 0.07, px/220., t) * 0.45;
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  vec2 d = uv - uBH.xy; float r = length(d); float rs = uBH.z; float bw = uBH.w;
  vec2 suv = uv;
  if (bw > 0.001) {
    float defl = bw * rs*rs*1.6 / max(r, rs*0.3);
    suv = uv - d/max(r,1e-4) * defl;
  }
  vec3 col = background(suv);
  // 天空渐变（指数塔场景）
  col = mix(col, col*0.3 + uSky.rgb * (0.35 + 0.65*smoothstep(0.7, -0.6, uv.y)), uSky.a);
  if (bw > 0.001) {
    // 吸积盘：倾斜的椭圆环
    vec2 dd = vec2(d.x, d.y / 0.24);
    float rd = length(dd);
    float ang = atan(dd.y, dd.x);
    float disk = smoothstep(rs*1.25, rs*1.7, rd) * smoothstep(rs*4.2, rs*2.2, rd);
    float sw = fbm3(vec2(ang*2.0 - uTime*0.9 + rd*7., rd*9.));
    float dop = 1.0 + 0.7*(-dd.x/max(rd,1e-4));
    vec3 dc = mix(vec3(1.0,0.42,0.12), vec3(1.0,0.88,0.65), sw) * disk * (0.5 + 1.6*sw) * dop * 1.6;
    // 盘的后半部分被事件视界遮挡，同时被引力透镜"抬"到黑洞上方
    float behind = step(0., d.y);
    float shadow = smoothstep(rs*0.97, rs*1.03, r);
    vec3 front = dc * (1. - behind);
    vec3 back = dc * behind * shadow;
    // 透镜化的上方光弧
    float arcR = rs*1.35;
    float arc = exp(-pow((r - arcR)/(rs*0.10), 2.)) * smoothstep(-0.2*rs, 0.6*rs, d.y);
    float arcSw = fbm3(vec2(atan(d.y, d.x)*3. + uTime*0.7, r*10.));
    vec3 arcC = vec3(1.0,0.7,0.4) * arc * (0.6 + arcSw) * 1.3;
    float ring = exp(-pow((r - rs*1.06)/(rs*0.025), 2.)) * 2.2;
    col = col * mix(1., shadow, bw) + bw * (front + back + arcC + vec3(1.0,0.8,0.55)*ring);
  }
  o = vec4(col * uAlpha, 1.);
}
`;

const POINT_FS = HDR + `
in vec3 vCol; in float vA; out vec4 o;
void main(){ vec2 d = gl_PointCoord - 0.5; float r2 = dot(d,d)*4.; if (r2 > 1.) discard;
  float a = exp(-r2*3.2) * (1.0 - r2*0.2); o = vec4(vCol * a * vA, 1.); }
`;

const PART_VS = HDR + COMMON + `
uniform sampler2D uA, uB;
uniform mat4 uVP, uMA, uMB;
uniform float uMix, uTime, uSize, uSwirl, uJitter, uPx, uAlpha, uSpread;
uniform vec3 uC1, uC2, uC3;
out vec3 vCol; out float vA;
void main(){
  int id = gl_VertexID;
  ivec2 ij = ivec2(id & 255, id >> 8);
  vec4 a = texelFetch(uA, ij, 0);
  vec4 b = texelFetch(uB, ij, 0);
  vec3 pa = (uMA * vec4(a.xyz, 1.)).xyz;
  vec3 pb = (uMB * vec4(b.xyz, 1.)).xyz;
  uint u = uint(id);
  float r1 = rnd(u), r2 = rnd(u + 99991u), r3 = rnd(u + 7777u), r4 = rnd(u + 31337u);
  float m = clamp((uMix - r1*uSpread) / (1. - uSpread), 0., 1.);
  m = m*m*(3. - 2.*m);
  vec3 p = mix(pa, pb, m);
  float sw = sin(3.14159265*m);
  vec3 off = vec3(sin(r1*61. + uTime*0.9 + p.y), sin(r2*53. + uTime*0.7 + p.x), sin(r3*47. - uTime*0.8));
  p += off * (uSwirl*sw*(0.5 + r4) + uJitter);
  // 形变途中向外鼓起，形成漩涡
  p.xy += vec2(-p.y, p.x) * sw * uSwirl * 0.25;
  vec4 cp = uVP * vec4(p, 1.);
  gl_Position = cp;
  float w = mix(a.w, b.w, m);
  float tw = 0.7 + 0.3*sin(uTime*(1.2 + r2*2.) + r3*30.);
  float ps = uSize * uPx * (0.55 + 0.9*r2*r2) / max(cp.w, 0.05);
  gl_PointSize = clamp(ps, 1.0, 64.);
  vec3 c = mix(uC1, uC2, smoothstep(0.2, 0.9, r3));
  c = mix(c, uC3, step(0.93, r4));
  vCol = c;
  // 小屏幕上点被钳制到 1 像素时，按面积补偿亮度，避免过曝
  vA = uAlpha * tw * w * min(1., ps*ps);
}
`;

const LINE_VS = HDR + `
layout(location=0) in vec4 aA;
layout(location=1) in vec4 aB;
layout(location=2) in vec4 aCol;
uniform mat4 uVP, uR4; uniform float uD4, uWScale, uWidth, uAlpha, uColorMix, uReveal; uniform vec2 uRes;
uniform vec3 uBase;
out float vSide; out vec3 vCol; out float vA;
vec4 proj(vec4 p){ p.w *= uWScale; vec4 q = uR4 * p; float k = uD4 > 0. ? uD4 / (uD4 - q.w) : 1.; return uVP * vec4(q.xyz*k, 1.); }
void main(){
  float end = float(gl_VertexID & 1);
  float side = float(gl_VertexID >> 1) * 2. - 1.;
  vec4 ca = proj(aA), cb = proj(aB);
  vec2 sa = ca.xy / ca.w * uRes * 0.5, sb = cb.xy / cb.w * uRes * 0.5;
  vec2 dv = sb - sa; float len = length(dv);
  vec2 dir = len > 1e-4 ? dv / len : vec2(1., 0.);
  vec2 n = vec2(-dir.y, dir.x);
  vec4 c = mix(ca, cb, end);
  vec2 ext = (n * side * uWidth + dir * (end*2. - 1.) * uWidth * 0.5) / (uRes * 0.5);
  c.xy += ext * c.w;
  gl_Position = c;
  vSide = side;
  vCol = mix(uBase, aCol.rgb, uColorMix);
  vA = uAlpha * smoothstep(aCol.a, aCol.a + 0.08, uReveal);
}
`;
const LINE_FS = HDR + `
in float vSide; in vec3 vCol; in float vA; out vec4 o;
void main(){ float g = exp(-vSide*vSide*4.0); float core = exp(-vSide*vSide*30.); o = vec4((vCol*g + vec3(core)*0.12*length(vCol)) * vA, 1.); }
`;

const PTS_VS = HDR + `
layout(location=0) in vec4 aP;
layout(location=1) in vec4 aC;
uniform mat4 uVP, uR4; uniform float uD4, uWScale, uSize, uAlpha, uPx, uReveal;
out vec3 vCol; out float vA;
void main(){
  vec4 p = aP; p.w *= uWScale; vec4 q = uR4 * p; float k = uD4 > 0. ? uD4/(uD4 - q.w) : 1.;
  vec4 c = uVP * vec4(q.xyz*k, 1.);
  gl_Position = c;
  float ps = uSize * uPx / max(c.w, 0.05);
  gl_PointSize = clamp(ps, 1., 96.);
  vCol = aC.rgb; vA = uAlpha * smoothstep(aC.a, aC.a + 0.05, uReveal) * min(1., ps*ps);
}
`;

const SPRITE_VS = HDR + `
layout(location=0) in vec4 aI0;   // xyz, size
layout(location=1) in vec4 aI1;   // glyph, brightness, stretch, hue
uniform mat4 uV, uP; uniform vec3 uC1, uC2;
out vec2 vUv; out vec3 vCol; out float vA;
void main(){
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec4 vp = uV * vec4(aI0.xyz, 1.);
  vec2 off = (corner - 0.5) * aI0.w * vec2(0.62, 1.0 * aI1.z);
  vp.xy += off;
  gl_Position = uP * vp;
  float g = aI1.x;
  vUv = vec2((mod(g, 16.) + corner.x) / 16., (floor(g / 16.) + 1. - corner.y) / 2.);
  vCol = mix(uC1, uC2, aI1.w);
  vA = aI1.y / max(aI1.z, 1.);
}
`;
const SPRITE_FS = HDR + `
in vec2 vUv; in vec3 vCol; in float vA; out vec4 o; uniform sampler2D uAtlas;
void main(){ float a = texture(uAtlas, vUv).r; o = vec4(vCol * a * vA, 1.); }
`;

/* 数字隧道：墙面上写满 3↑↑4 的真实数字 */
const TUNNEL_FS = HDR + COMMON + `
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uTime, uTravel, uAlpha, uTwist;
uniform sampler2D uAtlas, uDigits;
uniform vec3 uC1, uC2;
const float COLS = 44.;
float digitAt(vec2 cell){
  float idx = mod(cell.y * COLS + mod(cell.x, COLS), 4096.);
  return texelFetch(uDigits, ivec2(int(mod(idx, 64.)), int(idx / 64.)), 0).r * 255.;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  uv.y *= 1.15;
  float r = length(uv);
  float depth = 0.32 / max(r, 1e-3);
  float z = depth + uTravel;
  float a = atan(uv.y, uv.x) / 6.2831853 + 0.5;
  float u = a * COLS + z * uTwist;
  float v = z * 3.2;
  // 解决 atan 接缝处的导数跳变
  float a2 = fract(atan(-uv.y, -uv.x) / 6.2831853 + 1.0);
  float u2 = a2 * COLS + z * uTwist;
  vec2 gx = vec2(dFdx(u), dFdx(v)), gy = vec2(dFdy(u), dFdy(v));
  vec2 gx2 = vec2(dFdx(u2), dFdx(v)), gy2 = vec2(dFdy(u2), dFdy(v));
  if (dot(gx2,gx2) + dot(gy2,gy2) < dot(gx,gx) + dot(gy,gy)) { gx = gx2; gy = gy2; }
  vec2 cell = floor(vec2(u, v));
  vec2 f = fract(vec2(u, v));
  float dg = digitAt(cell);
  vec2 guv = vec2((dg + 0.12 + f.x*0.76) / 16., 0.5 + (0.06 + (1.0 - f.y)*0.88) * 0.5);
  vec2 gs = vec2(0.76/16., 0.44);
  float glyph = textureGrad(uAtlas, guv, gx*gs, gy*gs).r;
  float hl = hash12(cell + floor(uTime*1.5));
  float pulse = smoothstep(0.985, 1.0, hl);
  float fog = exp(-depth*0.22) * smoothstep(0.02, 0.2, r);
  float near = smoothstep(0.95, 0.3, r);
  vec3 col = mix(uC1, uC2, hash12(cell*0.37)) * glyph * (0.26 + 2.2*pulse);
  col += uC1 * 0.03 * fog;            // 隧道深处的辉光
  col *= fog * (0.12 + 0.88*near);
  // 中心光点
  col += uC2 * exp(-r*r*160.) * 0.7 + uC1 * exp(-r*14.) * 0.12;
  o = vec4(col * uAlpha, 1.);
}
`;

/* 递归之塔：塔由塔组成，无限放大 */
const RECUR_FS = HDR + COMMON + `
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uTime, uZoom, uAlpha;
uniform vec3 uC1, uC2, uC3;
const float B = 9.0;
float box(vec2 p, vec2 b, float w){ vec2 d = abs(p) - b; float e = length(max(d,0.)) + min(max(d.x,d.y),0.); return exp(-abs(e)/w); }
vec3 layer(vec2 p, float k, float px){
  // 一排塔，每座塔由若干方块叠成；中央那座的塔顶方块将成为下一层
  vec3 c = vec3(0);
  float cw = 1.0;
  float ix = floor(p.x / cw + 0.5);
  if (abs(ix) > 7.) return c;
  float hgt = ix == 0. ? 7. : 2. + floor(hash12(vec2(ix, k)) * 7.);
  vec2 q = vec2(p.x - ix*cw, p.y);
  float iy = floor(q.y + 0.5);
  if (iy < -6. || iy > -6. + hgt - 1.) return c;
  vec2 cq = vec2(q.x, q.y - iy);
  float w = max(px*1.4, 0.006);
  float e = box(cq, vec2(0.36, 0.36), w);
  float fill = smoothstep(0.38, 0.30, max(abs(cq.x), abs(cq.y))) * 0.03;
  float h = hash12(vec2(ix, iy) + k*3.1);
  vec3 col = mix(uC1, uC2, h);
  if (ix == 0. && iy == 0.) col = uC3;
  c = col * (e + fill) * (0.6 + 0.6*h);
  return c;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float z = uZoom;
  float fz = fract(z);
  vec3 col = vec3(0);
  for (int i = 0; i < 4; i++) {
    float k = float(i) - fz;                       // 层级（相对）
    float s = pow(B, k) * 0.12;                    // 该层的缩放
    vec2 p = uv / s;
    float px = 1.0 / (uRes.y * s);
    float big = smoothstep(1.75, 0.7, k);          // 太大时淡出
    float small = smoothstep(-1.0, 0.0, k);        // 太小时淡入
    col += layer(p, floor(z) + float(i), px) * big * small;
  }
  col *= (1.0 - 0.35*length(uv)) * 0.85;
  o = vec4(col * uAlpha, 1.);
}
`;

/* 传送门隧道：64 道门，g1 → g64 */
const PORTAL_FS = HDR + COMMON + `
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uTime, uCam, uAlpha, uSpeed;
uniform vec3 uC1, uC2;
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float r = length(uv); float a = atan(uv.y, uv.x);
  vec3 col = vec3(0);
  // 环
  for (int i = 0; i < 12; i++) {
    float n = floor(uCam) + 1. + float(i);
    if (n > 64.) break;
    float dz = n - uCam;
    float R = 0.55 / dz;
    float sides = 6.;
    float an = mod(a + n*0.21 + uTime*0.1, 6.2831853/sides) - 3.14159265/sides;
    float pr = r * cos(an) / cos(3.14159265/sides);
    float w = 0.004 + 0.012/dz;
    float ring = exp(-abs(pr - R) / w);
    float seg = 0.6 + 0.4*smoothstep(-0.2, 0.6, sin(a*12. + n*1.7 + uTime));
    float f = smoothstep(9., 2., dz) * smoothstep(0.05, 0.6, dz);
    vec3 c = mix(uC1, uC2, fract(n*0.137));
    if (n == 64.) c = vec3(1.4, 1.2, 1.0);
    col += c * ring * seg * f * 0.85;
    col += c * exp(-abs(pr - R)/(w*12.)) * f * 0.05;
  }
  // 径向流星线（速度感）
  float sp = uSpeed;
  vec2 st = vec2(a * 40. / 6.2831853, 0.);
  float lane = floor(st.x * 3.);
  float h = hash12(vec2(lane, 1.));
  float zz = fract(log(max(r,1e-3))*0.8 - uTime*(0.2 + sp*0.8) * (0.5 + h));
  float streak = smoothstep(0.0, 0.02, zz) * smoothstep(0.08 + sp*0.25, 0.0, zz) * step(0.6, h);
  float laneW = exp(-pow(fract(st.x*3.) - 0.5, 2.) * 400.);
  col += mix(uC1, uC2, h) * streak * laneW * smoothstep(0.05, 0.5, r) * (0.3 + sp);
  col += uC2 * exp(-r*r*90.) * (0.12 + 0.3*sp);
  o = vec4(col * uAlpha, 1.);
}
`;

/* 数轴：从 0 指向无穷 */
const NUMLINE_FS = HDR + COMMON + `
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uTime, uAlpha, uZoom, uBreak;
uniform vec4 uM[4];     // 标记：x, 强度, 色相(0金/1青/2紫/3白), 光柱高度
uniform vec3 uC1, uC2, uC3;
uniform float uX0;
vec3 hueCol(float h){ return h < 0.5 ? uC1 : h < 1.5 ? uC2 : h < 2.5 ? uC3 : vec3(1.2); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float aspect = uRes.x / uRes.y;
  float y = uv.y + 0.02;
  float px = 1.0 / uRes.y;
  // 主线：从原点向右延伸，并在右侧逐渐消失于无穷
  float right = smoothstep(uX0 - 0.002, uX0 + 0.002, uv.x);
  float line = exp(-abs(y) / (px*1.4)) * right;
  float glow = exp(-abs(y) / 0.012) * right * 0.25;
  // 断裂符号（表示"不按比例"）
  float br = 0.;
  if (uBreak > 0.) {
    float bx = 0.0;
    float gap = smoothstep(0.024, 0.018, abs(uv.x - bx));
    line *= 1. - gap*uBreak; glow *= 1. - gap*uBreak;
    for (int k = -1; k <= 1; k += 2) {
      vec2 q = uv - vec2(bx + float(k)*0.022, 0.02*0. - 0.02);
      q = mat2(0.8, -0.6, 0.6, 0.8) * q;
      br += exp(-abs(q.x)/(px*1.5)) * step(abs(q.y), 0.035) * uBreak;
    }
  }
  // 多尺度刻度（随缩放连续变化）
  float ticks = 0.;
  float lz = uZoom;
  for (int i = 0; i < 3; i++) {
    float lev = float(i) - fract(lz);
    float sp = 0.12 * pow(10., lev);
    float xx = (uv.x - uX0) / sp;
    float d = abs(fract(xx + 0.5) - 0.5) * sp;
    float a = smoothstep(-1., 0.2, lev) * smoothstep(2.2, 1.0, lev);
    float th = 0.008 + 0.012 * smoothstep(0., 2., lev);
    ticks += exp(-d / (px*1.1)) * step(abs(y), th) * a * right * 0.7;
  }
  vec3 col = vec3(0.75, 0.82, 1.0) * (line*1.3 + glow + ticks*0.6) + vec3(0.8,0.85,1.0)*br;
  // 右端：通向无穷的渐亮
  col += uC2 * exp(-abs(y)/0.02) * smoothstep(aspect*0.3, aspect*0.5, uv.x) * 0.5;
  // 标记
  for (int i = 0; i < 4; i++) {
    vec4 m = uM[i];
    if (m.y <= 0.) continue;
    vec3 mc = hueCol(m.z);
    vec2 d = uv - vec2(m.x, -0.02);
    col += mc * m.y * (exp(-dot(d,d)*9000.) * 3.0 + exp(-length(d)*28.) * 0.5);
    float beam = exp(-abs(d.x)/(px*1.6)) * smoothstep(m.w, 0., d.y) * step(0., d.y) * step(0.001, m.w);
    col += mc * m.y * beam * 0.8;
  }
  o = vec4(col * uAlpha, 1.);
}
`;

const PREFILTER_FS = HDR + `
in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uTh, uKnee;
void main(){
  vec2 h = uTexel * 0.5;
  vec3 c = (texture(uSrc, vUv + vec2(-h.x,-h.y)).rgb + texture(uSrc, vUv + vec2(h.x,-h.y)).rgb + texture(uSrc, vUv + vec2(-h.x,h.y)).rgb + texture(uSrc, vUv + vec2(h.x,h.y)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uTh + uKnee, 0., 2.*uKnee); soft = soft*soft / (4.*uKnee + 1e-4);
  float k = max(soft, br - uTh) / max(br, 1e-4);
  o = vec4(c * k, 1.);
}
`;
const DOWN_FS = HDR + `
in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel;
void main(){ vec2 h = uTexel;
  vec3 s = texture(uSrc, vUv).rgb * 4.;
  s += texture(uSrc, vUv - h).rgb + texture(uSrc, vUv + h).rgb + texture(uSrc, vUv + vec2(h.x,-h.y)).rgb + texture(uSrc, vUv - vec2(h.x,-h.y)).rgb;
  o = vec4(s / 8., 1.); }
`;
const UP_FS = HDR + `
in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uK;
void main(){ vec2 h = uTexel;
  vec3 s = texture(uSrc, vUv + vec2(-h.x*2., 0.)).rgb + texture(uSrc, vUv + vec2(-h.x, h.y)).rgb*2. + texture(uSrc, vUv + vec2(0., h.y*2.)).rgb
         + texture(uSrc, vUv + vec2(h.x, h.y)).rgb*2. + texture(uSrc, vUv + vec2(h.x*2., 0.)).rgb + texture(uSrc, vUv + vec2(h.x, -h.y)).rgb*2.
         + texture(uSrc, vUv + vec2(0., -h.y*2.)).rgb + texture(uSrc, vUv + vec2(-h.x, -h.y)).rgb*2.;
  o = vec4(s / 12. * uK, 1.); }
`;
const COMPOSITE_FS = HDR + COMMON + `
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom; uniform vec2 uRes;
uniform float uBloomK, uExposure, uFlash, uFade, uGrain, uTime, uVig, uCA, uGrainT;
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03)) / (x*(2.43*x + 0.59) + 0.14), 0., 1.); }
void main(){
  vec2 uv = vUv; vec2 dc = uv - 0.5;
  vec3 c;
  c.r = texture(uScene, uv - dc*uCA).r;
  c.g = texture(uScene, uv).g;
  c.b = texture(uScene, uv + dc*uCA).b;
  c += texture(uBloom, uv).rgb * uBloomK;
  c *= uExposure;
  c = aces(c);
  c = pow(c, vec3(1./2.2));
  float vig = smoothstep(1.05, 0.2, length(dc*vec2(1.0, 0.9)));
  c *= mix(1., vig, uVig);
  c += uFlash;
  float g = hash12(gl_FragCoord.xy + fract(uGrainT*7.13)*517.) - 0.5;
  c += g * (uGrain + 1.5/255.);
  c *= uFade;
  o = vec4(c, 1.);
}
`;

/* ------------------------------------------------------- init / setup -- */
E.N = 65536;
E.init = function (cv) {
  canvas = cv;
  gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('当前浏览器不支持 WebGL2');
  E.gl = gl;
  const cbf = gl.getExtension('EXT_color_buffer_float');
  if (cbf) { hdrFmt = gl.RGBA16F; hdrType = gl.HALF_FLOAT; } else { hdrFmt = gl.RGBA8; hdrType = gl.UNSIGNED_BYTE; }
  E.hdr = !!cbf;
  quadVAO = gl.createVertexArray();

  program('bg', FS_VERT, BG_FS);
  program('part', PART_VS, POINT_FS);
  program('line', LINE_VS, LINE_FS);
  program('pts', PTS_VS, POINT_FS);
  program('sprite', SPRITE_VS, SPRITE_FS);
  program('tunnel', FS_VERT, TUNNEL_FS);
  program('recur', FS_VERT, RECUR_FS);
  program('portal', FS_VERT, PORTAL_FS);
  program('numline', FS_VERT, NUMLINE_FS);
  program('prefilter', FS_VERT, PREFILTER_FS);
  program('down', FS_VERT, DOWN_FS);
  program('up', FS_VERT, UP_FS);
  program('composite', FS_VERT, COMPOSITE_FS);
  partVAO = gl.createVertexArray();
  spriteVAO = gl.createVertexArray();
  spriteBuf = gl.createBuffer();
};

/* ---------------------------------------------------------- textures --- */
E.shapes = {};
E.shapeTex = function (name, data) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 256, 256, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  E.shapes[name] = tex;
  return tex;
};
E.textureFromCanvas = function (cv, mip = true, single = false) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
};
E.digitTexture = function (str) {
  const data = new Uint8Array(4096);
  for (let i = 0; i < 4096; i++) data[i] = str.charCodeAt(i % str.length) - 48;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 64, 64, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return tex;
};

/* -------------------------------------------------------- line sets ---- */
// edges: [{a:[x,y,z,w], b:[...], c:[r,g,b], r: revealThreshold}]
E.lineSet = function (edges) {
  const data = new Float32Array(edges.length * 12);
  edges.forEach((e, i) => {
    data.set([...e.a, ...e.b, ...e.c, e.r ?? 0], i * 12);
  });
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  for (let k = 0; k < 3; k++) {
    gl.enableVertexAttribArray(k);
    gl.vertexAttribPointer(k, 4, gl.FLOAT, false, 48, k * 16);
    gl.vertexAttribDivisor(k, 1);
  }
  gl.bindVertexArray(null);
  return { vao, count: edges.length };
};
// points: [{p:[x,y,z,w], c:[r,g,b], r}]
E.pointSet = function (pts) {
  const data = new Float32Array(pts.length * 8);
  pts.forEach((q, i) => data.set([...q.p, ...q.c, q.r ?? 0], i * 8));
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.bindVertexArray(null);
  return { vao, count: pts.length };
};

/* ---------------------------------------------------------- frame ------ */
let partVAO, spriteVAO, spriteBuf, frameTime = 0;
const px = () => H / 1080;

E.begin = function (time) {
  frameTime = time;
  gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
};

E.aspect = () => W / H;
E.camera = function (eye, target, fov = 40, up = [0, 1, 0]) {
  const V = M4.lookAt(eye, target, up);
  const P = M4.persp(fov * Math.PI / 180, W / H, 0.05, 5000);
  return { V, P, VP: M4.mul(P, V) };
};

E.bg = function (o) {
  const p = progs.bg.use();
  p.f('uRes', W, H).f('uTime', frameTime).f('uC1', o.c1).f('uC2', o.c2).f('uC3', o.c3 || [0.5, 0.3, 0.6])
    .f('uNeb', o.neb ?? 1).f('uStar', o.star ?? 1).f('uAlpha', o.alpha ?? 1)
    .f('uBH', o.bh || [0, 0, 0, 0]).f('uDrift', o.drift || [0, 0]).f('uSky', o.sky || [0, 0, 0, 0]).f('uSpin', o.spin || 0);
  drawQuad();
};

E.particles = function (o) {
  if ((o.alpha ?? 1) <= 0.001) return;
  const p = progs.part.use();
  p.tex('uA', 0, E.shapes[o.A]).tex('uB', 1, E.shapes[o.B || o.A])
    .m('uVP', o.vp).m('uMA', o.mA || M4.ident()).m('uMB', o.mB || o.mA || M4.ident())
    .f('uMix', o.mix ?? 0).f('uTime', frameTime).f('uSize', o.size ?? 22).f('uSwirl', o.swirl ?? 0.6)
    .f('uJitter', o.jitter ?? 0.0).f('uPx', px()).f('uAlpha', o.alpha ?? 1).f('uSpread', o.spread ?? 0.35)
    .f('uC1', o.c1).f('uC2', o.c2).f('uC3', o.c3 || [1.4, 1.4, 1.5]);
  gl.bindVertexArray(partVAO);
  gl.drawArrays(gl.POINTS, 0, o.count || E.N);
};

E.lines = function (set, o) {
  if ((o.alpha ?? 1) <= 0.001) return;
  const p = progs.line.use();
  p.m('uVP', o.vp).m('uR4', o.r4 || M4.ident()).f('uD4', o.d4 ?? 0).f('uWScale', o.wScale ?? 1)
    .f('uWidth', (o.width ?? 2) * px()).f('uAlpha', o.alpha ?? 1).f('uColorMix', o.colorMix ?? 1)
    .f('uReveal', o.reveal ?? 2).f('uRes', W, H).f('uBase', o.base || [0.8, 0.85, 1.0]);
  gl.bindVertexArray(set.vao);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, set.count);
};

E.points = function (set, o) {
  if ((o.alpha ?? 1) <= 0.001) return;
  const p = progs.pts.use();
  p.m('uVP', o.vp).m('uR4', o.r4 || M4.ident()).f('uD4', o.d4 ?? 0).f('uWScale', o.wScale ?? 1)
    .f('uSize', o.size ?? 60).f('uAlpha', o.alpha ?? 1).f('uPx', px()).f('uReveal', o.reveal ?? 2);
  gl.bindVertexArray(set.vao);
  gl.drawArrays(gl.POINTS, 0, set.count);
};

// inst: Float32Array of [x,y,z,size, glyph,bright,stretch,hue] * n
E.sprites = function (inst, n, o) {
  if (n <= 0 || (o.alpha ?? 1) <= 0.001) return;
  const p = progs.sprite.use();
  p.m('uV', o.cam.V).m('uP', o.cam.P).f('uC1', o.c1).f('uC2', o.c2).tex('uAtlas', 0, o.atlas);
  gl.bindVertexArray(spriteVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuf);
  gl.bufferData(gl.ARRAY_BUFFER, inst.subarray(0, n * 8), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, 1);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, 1);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
};

E.fullscreen = function (name, o) {
  if ((o.alpha ?? 1) <= 0.001) return;
  const p = progs[name].use();
  p.f('uRes', W, H).f('uTime', frameTime);
  let unit = 0;
  for (const k in o) {
    const v = o[k];
    if (k === 'alpha') p.f('uAlpha', v);
    else if (v instanceof WebGLTexture) p.tex(k, unit++, v);
    else if (k === 'uM') { const L = p.l('uM'); if (L) gl.uniform4fv(L, v); }
    else if (typeof v === 'number') p.f(k, v);
    else if (Array.isArray(v)) p.f(k, v);
  }
  drawQuad();
};

E.end = function (o = {}) {
  gl.disable(gl.BLEND);
  // 泛光：预过滤 → 逐级降采样 → 逐级升采样叠加
  const pre = progs.prefilter.use();
  gl.bindFramebuffer(gl.FRAMEBUFFER, bloomLv[0].fb);
  gl.viewport(0, 0, bloomLv[0].w, bloomLv[0].h);
  pre.tex('uSrc', 0, scene.tex).f('uTexel', 1 / W, 1 / H).f('uTh', o.threshold ?? 0.9).f('uKnee', 0.5);
  drawQuad();
  const dn = progs.down.use();
  for (let i = 1; i < bloomLv.length; i++) {
    const s = bloomLv[i - 1], d = bloomLv[i];
    gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
    gl.viewport(0, 0, d.w, d.h);
    dn.tex('uSrc', 0, s.tex).f('uTexel', 1 / s.w, 1 / s.h);
    drawQuad();
  }
  const up = progs.up.use();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = bloomLv.length - 1; i > 0; i--) {
    const s = bloomLv[i], d = bloomLv[i - 1];
    gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
    gl.viewport(0, 0, d.w, d.h);
    up.tex('uSrc', 0, s.tex).f('uTexel', 1 / s.w, 1 / s.h).f('uK', 1.0);
    drawQuad();
  }
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  const c = progs.composite.use();
  c.tex('uScene', 0, scene.tex).tex('uBloom', 1, bloomLv[0].tex).f('uRes', W, H)
    .f('uBloomK', o.bloom ?? 0.22).f('uExposure', o.exposure ?? 1.0).f('uFlash', o.flash ?? 0)
    .f('uFade', o.fade ?? 1).f('uGrain', o.grain ?? 0.025).f('uTime', frameTime).f('uGrainT', o.grainStatic ? 0 : frameTime).f('uVig', o.vignette ?? 0.85)
    .f('uCA', o.ca ?? 0.0025);
  drawQuad();
};

})();
