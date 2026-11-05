// 所有 GLSL 着色器
window.SM = window.SM || {};
(function () {
  const COMMON = `#version 300 es
precision highp float;
precision highp int;
#define PI 3.14159265359
#define TAU 6.28318530718
#define ASPECT 1.77777778
vec3 L(vec3 c){ return pow(c, vec3(2.2)); }
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for(int i=0;i<5;i++){ s += a*vnoise(p); p = m*p; a *= 0.5; } return s/0.97; }
float fbm3(vec2 p){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for(int i=0;i<3;i++){ s += a*vnoise(p); p = m*p; a *= 0.5; } return s/0.875; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
`;

  const FS_VS = COMMON + `
out vec2 vUV;
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); vUV = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

  const BG_HEAD = COMMON + `
in vec2 vUV; out vec4 oCol;
uniform float uT; uniform vec3 uCam; uniform vec4 uP; uniform vec4 uQ;
vec2 worldAt(float par){ vec2 q = (vUV - 0.5) * 2.0; q.x *= ASPECT; return q / uCam.z + uCam.xy * par; }
`;

  // ---------------- 夜空（序章 / 终章） ----------------
  const BG_NIGHT = BG_HEAD + `
float starField(vec2 p, float scale, float t){
  vec2 g = p*scale; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  vec2 o = hash22(id) - 0.5; float b = hash12(id + 17.3);
  float d = length(f - o*0.7);
  float tw = 0.6 + 0.4*sin(t*(0.7 + 2.0*b) + b*80.0);
  return smoothstep(0.10, 0.0, d) * step(0.6, b) * pow(b, 3.0) * tw;
}
void main(){
  vec2 p = worldAt(0.25);
  vec3 top = mix(L(vec3(0.02,0.03,0.08)), L(vec3(0.03,0.035,0.07)), uP.y);
  vec3 bot = mix(L(vec3(0.08,0.11,0.24)), L(vec3(0.12,0.11,0.20)), uP.y);
  vec3 col = mix(bot, top, smoothstep(-1.1, 1.0, p.y));
  float n1 = fbm(p*0.9 + vec2(uT*0.015, 0.0));
  float n2 = fbm(p*2.1 + n1*1.5 - vec2(0.0, uT*0.01));
  float side = smoothstep(-1.3, 1.3, p.x + (n1 - 0.5)*1.2);
  vec3 neb = mix(L(vec3(0.32,0.48,0.98)), L(vec3(0.32,0.88,0.62)), side);
  float band = exp(-pow((p.y + p.x*0.22 - 0.05)/0.6, 2.0));
  float dens = smoothstep(0.38, 0.9, n2) * band;
  col += neb * dens * 0.30 * uP.x;
  col += neb * band * 0.035 * uP.x;
  col += vec3(starField(p, 34.0, uT) + starField(p + 3.7, 64.0, uT*1.3)*0.6) * 0.9 * uP.x;
  col += L(vec3(0.75,0.85,1.0)) * exp(-dot(p,p)*2.2) * uP.z * 1.3;
  oCol = vec4(col * uP.w, 1.0);
}`;

  // ---------------- 春日庭院 ----------------
  const BG_GARDEN = BG_HEAD + `
void main(){
  vec2 p = worldAt(0.55);
  vec3 skyTop = L(vec3(0.42,0.62,0.90)), skyMid = L(vec3(0.76,0.86,0.95)), skyHor = L(vec3(1.0,0.91,0.78));
  vec3 col = mix(skyHor, skyMid, smoothstep(-0.25, 0.55, p.y));
  col = mix(col, skyTop, smoothstep(0.55, 1.9, p.y));
  vec2 sp = vec2(1.15, 1.10);
  float sd = length(p - sp);
  vec3 sunC = L(vec3(1.0,0.92,0.74));
  float cn = fbm(vec2(p.x*0.7 + uT*0.012, p.y*2.0)*1.4 + 5.0);
  float cl = smoothstep(0.52, 0.80, cn)*smoothstep(-0.1, 0.5, p.y);
  col = mix(col, mix(L(vec3(0.94,0.94,0.97)), L(vec3(1.0,0.97,0.90)), smoothstep(1.5, 0.3, sd)), cl*0.55);
  col += sunC*(exp(-sd*2.0)*0.55 + exp(-sd*7.0)*0.9)*uP.x;
  col += sunC*smoothstep(0.075, 0.06, sd)*3.0*uP.x;
  float ang = atan(p.y - sp.y, p.x - sp.x);
  float rays = fbm3(vec2(ang*5.0, uT*0.04));
  col += sunC*pow(rays, 3.0)*exp(-sd*0.7)*0.40*uP.x;

  vec2 p2 = worldAt(0.7);
  float tl = 0.04 + 0.11*fbm3(vec2(p2.x*2.2, 0.5)) + 0.05*sin(p2.x*1.1 + 1.0);
  float far = smoothstep(0.006, -0.006, p2.y - tl);
  vec3 farCol = mix(L(vec3(0.52,0.66,0.62)), L(vec3(0.84,0.86,0.82)), 0.3);
  farCol = mix(farCol, col, 0.25);
  col = mix(col, farCol, far);

  vec2 p3 = worldAt(0.85);
  float ml = -0.14 + 0.10*fbm(vec2(p3.x*2.6, 2.0));
  float mid = smoothstep(0.005, -0.005, p3.y - ml);
  float leaf = fbm(p3*vec2(11.0, 13.0));
  vec3 midCol = mix(L(vec3(0.12,0.25,0.13)), L(vec3(0.36,0.55,0.22)), leaf);
  midCol *= 0.6 + 0.6*smoothstep(ml - 0.3, ml, p3.y);
  midCol += sunC*0.25*smoothstep(ml - 0.06, ml, p3.y)*leaf;
  col = mix(col, midCol, mid);

  vec2 p4 = worldAt(1.0);
  float lawnTop = -0.30 + 0.012*sin(p4.x*3.0);
  float lawn = smoothstep(0.004, -0.004, p4.y - lawnTop);
  vec3 lawnCol = mix(L(vec3(0.28,0.45,0.18)), L(vec3(0.48,0.64,0.27)), fbm(p4*vec2(16.0,42.0)));
  lawnCol *= 0.75 + 0.35*smoothstep(-0.52, -0.30, p4.y);
  // 踏脚石
  vec2 st = vec2(p4.x*0.9, (p4.y + 0.42)*4.0);
  float stones = 0.0;
  for (int i = 0; i < 4; i++) { float fi = float(i); vec2 c = vec2(-0.9 + fi*0.55, sin(fi*2.1)*0.12); stones = max(stones, smoothstep(0.16, 0.13, length((st - c)*vec2(1.0, 0.75)))); }
  lawnCol = mix(lawnCol, L(vec3(0.62,0.60,0.56))*(0.8 + 0.3*vnoise(p4*60.0)), stones*0.85);
  col = mix(col, lawnCol, lawn);

  float edge = -0.52;
  if (p4.y < edge) {
    float dz = 0.12 - p4.y;
    float u = p4.x/dz;
    float pl = fract(u*1.6);
    float gap = smoothstep(0.0, 0.025, pl)*smoothstep(1.0, 0.975, pl);
    float grain = vnoise(vec2(u*24.0, log(dz)*30.0))*0.6 + vnoise(vec2(u*80.0, log(dz)*90.0))*0.4;
    vec3 wood = mix(L(vec3(0.30,0.19,0.11)), L(vec3(0.52,0.35,0.22)), grain);
    wood *= 0.85 + 0.3*hash11(floor(u*1.6)*7.3 + 3.0);
    wood *= mix(0.35, 1.0, gap);
    wood += sunC*0.30*exp(-(edge - p4.y)*6.0)*(0.6 + 0.4*grain);
    wood *= 0.70 + 0.30*smoothstep(-1.0, edge, p4.y);
    float beam = smoothstep(0.0, 0.006, edge - p4.y)*smoothstep(0.03, 0.02, edge - p4.y);
    wood += sunC*beam*0.45;
    col = wood;
  }
  oCol = vec4(col, 1.0);
}`;

  // ---------------- 夕阳与琴键 ----------------
  const BG_SUNSET = BG_HEAD + `
uniform float uKeys[36];
void main(){
  vec2 p = worldAt(0.5);
  float dim = uQ.y; // 渐暗（进入雨夜）
  vec3 c0 = L(vec3(1.00,0.70,0.42)), c1 = L(vec3(0.96,0.48,0.50)), c2 = L(vec3(0.42,0.28,0.58)), c3 = L(vec3(0.13,0.11,0.30));
  float h = p.y;
  vec3 col = mix(c0, c1, smoothstep(-0.35, 0.15, h));
  col = mix(col, c2, smoothstep(0.1, 0.65, h));
  col = mix(col, c3, smoothstep(0.6, 1.25, h));
  vec2 sp = vec2(0.0, -0.20);
  float sd = length(p - sp);
  float beat = uP.x;
  vec3 sunC = L(vec3(1.0,0.80,0.55));
  col += sunC*(exp(-sd*1.8)*0.30 + exp(-sd*7.0)*(0.32 + 0.14*beat));
  float disc = smoothstep(0.30, 0.29, sd);
  float band = smoothstep(0.42, 0.72, fbm(vec2(p.x*1.4 + uT*0.03, p.y*14.0)));
  vec3 sunCol = mix(L(vec3(1.0,0.93,0.76))*1.35, L(vec3(1.0,0.62,0.50))*0.95, band*0.75);
  col = mix(col, sunCol, disc);
  float cl = smoothstep(0.55, 0.78, fbm(vec2(p.x*1.1 - uT*0.02, p.y*5.0 + 3.0)));
  vec3 clc = mix(L(vec3(0.96,0.56,0.56)), L(vec3(1.0,0.80,0.62)), smoothstep(0.5, -0.2, p.y))*1.05;
  col = mix(col, clc, cl*0.5*smoothstep(-0.1, 0.3, p.y));
  // 两条交织的光带：蓝=钢琴(祥)，绿=吉他(睦)
  vec2 pr = worldAt(0.8);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float amp = fk < 0.5 ? uQ.x : uP.w;
    float yy = 0.30 + 0.20*sin(pr.x*1.5 + uT*0.8 + fk*PI) + 0.05*sin(pr.x*4.1 - uT*1.2 + fk*1.7);
    yy += amp*0.018*sin(pr.x*24.0 - uT*30.0 + fk);
    float w = 0.010 + 0.005*sin(pr.x*3.0 + uT + fk*2.0) + amp*0.004;
    float d = abs(pr.y - yy);
    vec3 rc = fk < 0.5 ? L(vec3(0.55,0.72,1.0)) : L(vec3(0.55,1.0,0.78));
    col += rc*(exp(-d*d/(w*w))*0.75 + exp(-d*16.0)*0.10)*uP.z*(0.7 + 0.5*amp);
  }
  // 琴键
  vec2 kp = worldAt(1.0);
  float kTop = -0.58, kBot = -1.02;
  float v = (kp.y - kBot)/(kTop - kBot);
  float s = mix(1.0, 0.80, v);
  float u = kp.x/(ASPECT*0.98*s)*0.5 + 0.5;
  if (v < 1.0 && u > 0.0 && u < 1.0) {
    float wi = u*21.0; float idx = floor(wi); float fu = fract(wi);
    int ii = int(idx); int oct = ii/7; int deg = ii - oct*7;
    int semis[7] = int[7](0,2,4,5,7,9,11);
    int mw = oct*12 + semis[deg];
    float press = uKeys[clamp(mw, 0, 35)];
    vec3 ivory = L(vec3(0.92,0.84,0.78));
    vec3 kc = ivory*(0.45 + 0.55*v);
    float gap = smoothstep(0.0, 0.05, fu)*smoothstep(1.0, 0.95, fu);
    kc *= mix(0.2, 1.0, gap);
    kc += L(vec3(1.0,0.8,0.6))*0.25*pow(v, 6.0);
    kc = mix(kc, L(vec3(0.50,0.70,1.0))*2.2, press*0.85*gap);
    float nb = floor(wi + 0.5); float fb = wi - nb;
    int ib = int(nb); int ob = ib/7; int db = ib - ob*7;
    int prev = (db + 6) % 7;
    bool hasBlack = (prev==0 || prev==1 || prev==3 || prev==4 || prev==5) && ib > 0 && ib < 21;
    if (hasBlack) {
      int octB = (db == 0) ? ob - 1 : ob;
      int mb = octB*12 + semis[prev] + 1;
      float pb = uKeys[clamp(mb, 0, 35)];
      float e = smoothstep(0.30, 0.27, abs(fb))*smoothstep(0.40, 0.43, v);
      vec3 bc = L(vec3(0.06,0.05,0.07)) + L(vec3(1.0,0.75,0.6))*0.10*smoothstep(0.25, 0.0, abs(fb - 0.08));
      bc = mix(bc, L(vec3(0.45,0.65,1.0))*2.4, pb*0.85);
      kc = mix(kc, bc, e);
    }
    col = mix(col, kc, smoothstep(1.0, 0.985, v));
  }
  // 琴键后挡板
  float fall = smoothstep(kTop - 0.002, kTop + 0.002, kp.y)*smoothstep(kTop + 0.055, kTop + 0.05, kp.y)*step(abs(kp.x), ASPECT*0.98*0.8);
  col = mix(col, L(vec3(0.05,0.03,0.04)) + L(vec3(1.0,0.75,0.55))*0.35*smoothstep(kTop + 0.045, kTop + 0.055, kp.y), fall);
  col *= mix(1.0, 0.35, dim);
  col = mix(col, vec3(dot(col, vec3(0.33))), dim*0.5);
  oCol = vec4(col, 1.0);
}`;

  // ---------------- 雨夜街道 ----------------
  const BG_RAIN = BG_HEAD + `
vec3 bokehLayer(vec2 p, float scale, float t, float seed){
  vec3 acc = vec3(0.0);
  vec2 g = p*scale; vec2 id = floor(g); vec2 f = fract(g);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cid = id + vec2(float(i), float(j));
    float pr = hash12(cid + seed + 3.1);
    if (pr < 0.58) continue;
    vec2 c = vec2(float(i), float(j)) + hash22(cid + seed);
    float rad = mix(0.22, 0.55, hash12(cid + seed + 7.7));
    float d = length(f - c);
    float disc = smoothstep(rad, rad*0.86, d);
    float ring = smoothstep(rad*0.7, rad*0.97, d)*disc;
    float hue = hash12(cid + seed + 11.0);
    vec3 cc = hue < 0.5 ? vec3(1.0,0.42,0.12) : (hue < 0.75 ? vec3(0.12,0.45,1.0) : (hue < 0.9 ? vec3(1.0,0.2,0.35) : vec3(0.3,1.0,0.6)));
    float flick = 0.85 + 0.15*sin(t*(0.5 + pr*2.0) + pr*30.0);
    acc += cc*(disc*0.30 + ring*0.22)*flick;
  }
  return acc;
}
vec3 city(vec2 p, float t){
  vec3 col = mix(L(vec3(0.10,0.12,0.24)), L(vec3(0.012,0.016,0.045)), smoothstep(-0.25, 0.95, p.y));
  col += L(vec3(0.34,0.30,0.46))*exp(-abs(p.y + 0.18)*4.0)*0.22*uP.y;
  float bx = floor(p.x*6.0 + 0.5);
  float bh = -0.16 + 0.40*hash11(bx*1.37 + 2.0)*(0.65 + 0.35*sin(bx*0.7));
  if (p.y < bh) {
    vec3 b = L(vec3(0.035,0.045,0.085));
    vec2 w = vec2(p.x*6.0*7.0, p.y*44.0); vec2 wid = floor(w); vec2 wf = fract(w);
    float on = step(0.74, hash12(wid + bx*3.1))*step(0.2, wf.x)*step(wf.x, 0.8)*step(0.25, wf.y)*step(wf.y, 0.75);
    b += L(vec3(1.0,0.74,0.45))*on*0.30*uP.y;
    col = mix(col, b, 0.8);
  }
  col += bokehLayer(p, 4.4, t, 1.0)*smoothstep(0.55, -0.05, p.y)*smoothstep(-0.45, -0.2, p.y)*0.32*uP.y;
  col += bokehLayer(p + vec2(5.3, 0.0), 8.5, t, 9.0)*smoothstep(0.30, -0.15, p.y)*smoothstep(-0.4, -0.2, p.y)*0.18*uP.y;
  return col;
}
void main(){
  vec2 p = worldAt(0.5);
  float gy = -0.30;
  vec3 col;
  if (p.y > gy) col = city(p, uT);
  else {
    float depth = gy - p.y;
    float wob = (vnoise(vec2(p.x*7.0, depth*55.0 - uT*1.5)) - 0.5)*0.035;
    vec2 rp = vec2(p.x + wob, gy + depth*0.85 + (vnoise(vec2(p.x*3.0, depth*18.0)) - 0.5)*0.05);
    vec3 refl = city(rp, uT);
    float grit = vnoise(p*vec2(90.0, 90.0/(depth*4.0 + 0.2)));
    vec3 asphalt = L(vec3(0.03,0.035,0.05))*(0.7 + 0.6*grit);
    float fres = mix(0.75, 0.30, smoothstep(0.0, 0.7, depth));
    col = asphalt + refl*fres;
    // 雨点涟漪
    vec2 gp = vec2(p.x/(depth + 0.06), 1.0/(depth + 0.06))*0.5;
    vec2 g = gp*vec2(3.0, 1.5); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float ph = fract(uT*0.8 + hash12(id));
    vec2 o = (hash22(id) - 0.5)*0.5;
    float rr = length((f - o)*vec2(1.0, 1.0));
    float ring = smoothstep(0.02, 0.0, abs(rr - ph*0.42))*(1.0 - ph)*(1.0 - ph);
    col += L(vec3(0.6,0.7,0.9))*ring*0.10*uP.z*smoothstep(0.0, 0.05, depth);
  }
  // 路灯
  vec2 q = worldAt(1.0);
  vec2 lamp = vec2(0.70, 0.86);
  vec2 dl = q - lamp;
  vec3 warm = L(vec3(1.0,0.80,0.52));
  if (dl.y < 0.0) {
    float ang = abs(dl.x)/(-dl.y + 0.04);
    float cone = smoothstep(0.62, 0.05, ang)*exp(dl.y*0.65);
    col += warm*cone*0.22*uP.x;
  }
  col += warm*(exp(-length(dl)*14.0)*1.6 + exp(-length(dl)*4.0)*0.25)*uP.x;
  float pool = exp(-pow((q.x - 0.50)/0.55, 2.0) - pow((q.y + 0.66)/0.10, 2.0));
  col += warm*pool*0.20*uP.x*step(q.y, -0.3);
  float pole = min(sdSeg(q, vec2(1.00, -0.62), vec2(1.00, 0.92)), sdSeg(q, vec2(1.00, 0.92), vec2(0.72, 0.90)));
  float pm = smoothstep(0.010, 0.006, pole);
  col = mix(col, L(vec3(0.02,0.022,0.03)) + warm*0.05, pm);
  float head = length((q - lamp)*vec2(1.0, 2.2));
  col = mix(col, warm*3.0, smoothstep(0.05, 0.035, head)*uP.x);
  oCol = vec4(col*uP.w, 1.0);
}`;

  // ---------------- 假面舞台 ----------------
  const BG_STAGE = BG_HEAD + `
uniform vec4 uB1, uB2, uB3; uniform vec3 uBI;
float beam(vec2 p, vec4 b){
  vec2 o = b.xy; vec2 d = b.zw - o; float len = length(d); d /= len;
  float al = dot(p - o, d); float pe = length(p - o - d*al);
  float w = 0.035 + al*0.17;
  return exp(-pow(pe/w, 2.0))*smoothstep(0.0, 0.25, al)*(1.0 - smoothstep(len*0.92, len*1.04, al));
}
vec3 rose(vec2 q, out float lead){
  float r = length(q); float a = atan(q.y, q.x);
  float sector = TAU/12.0;
  float am = mod(a + sector*0.5, sector) - sector*0.5;
  vec2 sq = vec2(cos(am), sin(am))*r;
  float am2 = mod(a, sector) - sector*0.5;
  vec2 sq2 = vec2(cos(am2), sin(am2))*r;
  lead = min(min(abs(r - 0.20), abs(r - 0.50)), min(abs(r - 0.80), abs(r - 0.99)));
  if (r > 0.20) lead = min(lead, abs(sin(am))*r);
  lead = min(lead, abs(length(sq - vec2(0.65, 0.0)) - 0.12));
  lead = min(lead, abs(length(sq2 - vec2(0.35, 0.0)) - 0.10));
  lead = min(lead, abs(length(sq2 - vec2(0.90, 0.0)) - 0.06));
  float a6 = mod(a, TAU/6.0) - TAU/12.0;
  vec2 c6 = vec2(cos(a6), sin(a6))*r;
  lead = min(lead, abs(length(c6 - vec2(0.11, 0.0)) - 0.065));
  float n = fbm3(q*14.0);
  vec3 g;
  if (r < 0.20) g = mix(L(vec3(1.0,0.75,0.30)), L(vec3(1.0,0.90,0.55)), n);
  else if (r < 0.50) g = length(sq2 - vec2(0.35,0.0)) < 0.10 ? L(vec3(0.95,0.75,0.30)) : mix(L(vec3(0.10,0.18,0.70)), L(vec3(0.35,0.20,0.75)), n);
  else if (r < 0.80) { float par = mod(floor((a + PI)/sector), 2.0); g = length(sq - vec2(0.65,0.0)) < 0.12 ? L(vec3(0.30,0.75,0.55)) : (par < 0.5 ? L(vec3(0.70,0.06,0.16)) : L(vec3(0.15,0.22,0.75))); g *= 0.75 + 0.5*n; }
  else g = mix(L(vec3(0.40,0.12,0.55)), L(vec3(0.70,0.12,0.30)), n);
  return g;
}
void main(){
  vec2 p = worldAt(0.6);
  vec3 col = mix(L(vec3(0.05,0.012,0.025)), L(vec3(0.015,0.006,0.012)), smoothstep(-0.6, 1.0, p.y));
  // 石墙纹理
  col *= 0.8 + 0.4*fbm(p*vec2(6.0, 9.0));
  vec2 wc = vec2(0.0, 0.30);
  vec2 q = (p - wc)/0.56;
  float r = length(q);
  float glow = uP.y*(1.0 + 0.25*uP.z);
  if (r < 1.0) {
    float lead; vec3 g = rose(q, lead);
    float lm = smoothstep(0.012, 0.022, lead);
    col = mix(L(vec3(0.02,0.01,0.015)), g*1.1*glow, lm);
  } else {
    col += L(vec3(0.55,0.20,0.45))*exp(-(r - 1.0)*3.0)*0.35*glow;
    float frame = smoothstep(0.03, 0.0, abs(r - 1.04));
    col = mix(col, L(vec3(0.10,0.06,0.07)), frame);
  }
  // 地板
  vec2 f = worldAt(1.0);
  float fy = -0.56;
  if (f.y < fy) {
    float dep = fy - f.y;
    vec2 rq = (vec2(f.x*0.6 + (vnoise(vec2(f.x*20.0, dep*60.0)) - 0.5)*0.02, fy + dep*1.2 - wc.y*0.0) - wc)/0.56;
    float lead; vec3 g = rose(rq*vec2(1.0, -1.0) + vec2(0.0, -1.6), lead);
    float rr = length(rq*vec2(1.0,-1.0) + vec2(0.0,-1.6));
    vec3 refl = rr < 1.0 ? g*0.06*glow*smoothstep(1.0, 0.6, rr) : vec3(0.0);
    float u = f.x/(0.25 + dep);
    float plank = smoothstep(0.0, 0.03, fract(u*2.0))*smoothstep(1.0, 0.97, fract(u*2.0));
    col = L(vec3(0.02,0.014,0.016))*(0.6 + 0.4*plank) + refl*smoothstep(0.5, 0.0, dep);
  }
  // 聚光灯
  float b1 = beam(f, uB1), b2 = beam(f, uB2), b3 = beam(f, uB3);
  vec3 cs = L(vec3(0.62,0.76,1.0)), cm = L(vec3(0.66,1.0,0.80)), cw = L(vec3(1.0,0.92,0.85));
  col += (cs*b1*uBI.x + cm*b2*uBI.y + cw*b3*uBI.z)*0.32*uP.w;
  // 地面光斑
  float p1 = exp(-pow((f.x - uB1.z)/0.26, 2.0) - pow((f.y - uB1.w)/0.06, 2.0));
  float p2 = exp(-pow((f.x - uB2.z)/0.26, 2.0) - pow((f.y - uB2.w)/0.06, 2.0));
  float p3 = exp(-pow((f.x - uB3.z)/0.42, 2.0) - pow((f.y - uB3.w)/0.08, 2.0));
  col += (cs*p1*uBI.x + cm*p2*uBI.y + cw*p3*uBI.z)*0.45*uP.w;
  // 幕布
  float open = uP.x;
  float fold = 0.5 + 0.5*sin(f.x*34.0 + sin(f.y*2.3 + f.x*3.0)*1.3);
  vec3 velvet = L(vec3(0.46,0.035,0.08))*(0.18 + 1.0*pow(fold, 2.2));
  velvet += L(vec3(0.62,0.76,1.0))*b1*0.08 + L(vec3(0.66,1.0,0.80))*b2*0.08;
  float edgeL = -0.02 - open*1.45 + 0.03*sin(f.y*3.0);
  float edgeR = 0.02 + open*1.45 - 0.03*sin(f.y*3.0 + 1.0);
  float cm2 = max(smoothstep(edgeL + 0.008, edgeL - 0.008, f.x), smoothstep(edgeR - 0.008, edgeR + 0.008, f.x));
  float val = 0.86 - 0.05*abs(sin(f.x*4.0));
  cm2 = max(cm2, smoothstep(val - 0.008, val + 0.008, f.y));
  col = mix(col, velvet*(0.55 + 0.45*smoothstep(1.0, 0.6, abs(f.x))), cm2);
  oCol = vec4(col, 1.0);
}`;

  // ---------------- 黎明山丘 ----------------
  const BG_DAWN = BG_HEAD + `
void main(){
  vec2 p = worldAt(0.4);
  float d = uP.x;
  vec3 top = mix(L(vec3(0.05,0.07,0.16)), L(vec3(0.38,0.58,0.88)), d);
  vec3 mid = mix(L(vec3(0.16,0.17,0.30)), L(vec3(0.98,0.74,0.70)), d);
  vec3 hor = mix(L(vec3(0.30,0.28,0.40)), L(vec3(1.00,0.83,0.56)), d);
  float h = p.y;
  vec3 col = mix(hor, mid, smoothstep(-0.32, 0.18, h));
  col = mix(col, top, smoothstep(0.15, 1.05, h));
  vec2 sp = vec2(0.0, mix(-0.46, -0.14, uP.z));
  float sd = length(p - sp);
  vec3 sunC = L(vec3(1.0,0.86,0.62));
  col += sunC*(exp(-sd*1.5)*0.22 + exp(-sd*6.0)*0.45)*d;
  col += sunC*1.4*smoothstep(0.11, 0.10, sd)*d;
  float ang = atan(p.y - sp.y, p.x - sp.x);
  float rays = pow(fbm3(vec2(ang*7.0, uT*0.06)), 2.5)*2.0;
  col += sunC*rays*exp(-sd*0.9)*0.16*d*smoothstep(sp.y - 0.05, sp.y + 0.25, p.y);
  // 云层（向两侧散开）
  vec2 cp = p; float part = uP.y;
  cp.x += sign(p.x)*part*0.7;
  vec2 cuv = vec2(cp.x*0.9 + uT*0.012, cp.y*2.4) + 2.0;
  float cn = fbm(cuv);
  float cover = mix(0.40, 0.66, part);
  float cd = smoothstep(cover, cover + 0.2, cn)*smoothstep(-0.25, 0.3, h);
  vec2 tow = normalize(sp - p);
  float cn2 = fbm(cuv + tow*vec2(0.9, 2.4)*0.04);
  float lit = clamp((cn - cn2)*10.0 + 0.35, 0.0, 1.0);
  vec3 cloudDark = mix(L(vec3(0.09,0.10,0.19)), L(vec3(0.66,0.50,0.60)), d);
  vec3 cloudLit = mix(L(vec3(0.28,0.30,0.44)), L(vec3(1.0,0.84,0.70))*1.35, d);
  col = mix(col, mix(cloudDark, cloudLit, lit)*(1.0 + exp(-sd*2.5)*d*0.6), cd*0.92);
  // 远处湖面
  float hz = -0.30;
  if (p.y < hz) {
    float dep = hz - p.y;
    float wave = vnoise(vec2(p.x*36.0, 2.0/(dep + 0.02) + uT*0.4));
    float ry = hz + dep*2.2 + (wave - 0.5)*0.03;
    vec3 refl = mix(hor, mid, smoothstep(-0.32, 0.18, ry));
    refl = mix(refl, top, smoothstep(0.15, 1.05, ry));
    refl *= 0.55 + 0.12*wave;
    float gl = exp(-abs(p.x - sp.x)*(3.0 + dep*4.0));
    float lines = pow(vnoise(vec2(p.x*9.0, 3.0/(dep + 0.03) + uT*0.6)), 5.0);
    col = refl + sunC*gl*(0.12 + 2.2*lines)*d + sunC*exp(-pow((p.y - hz)/0.012, 2.0))*0.25*d;
  }
  // 前景山丘
  vec2 q = worldAt(1.0);
  float hill = -0.53 + 0.10*cos(q.x*0.85) - 0.02*q.x + 0.010*pow(vnoise(vec2(q.x*110.0, 1.0)), 2.0) + 0.006*vnoise(vec2(q.x*30.0, 3.0));
  float hm = smoothstep(0.003, -0.003, q.y - hill);
  vec3 grass = mix(L(vec3(0.025,0.04,0.05)), L(vec3(0.08,0.15,0.10)), d);
  grass *= 0.8 + 0.4*fbm3(q*vec2(30.0, 60.0));
  grass += sunC*exp(-(hill - q.y)*45.0)*0.5*d;
  float dew = step(0.992, hash12(floor(q*vec2(260.0, 260.0))))*(0.5 + 0.5*sin(uT*3.0 + q.x*40.0));
  grass += sunC*dew*1.2*d*smoothstep(-1.0, hill, q.y);
  col = mix(col, grass, hm);
  oCol = vec4(col, 1.0);
}`;

  // ---------------- 粒子 ----------------
  const PART_VS = COMMON + `
layout(location=0) in vec2 aCorner;
uniform int uType; uniform int uSalt; uniform float uT; uniform vec3 uCam; uniform float uPar;
uniform vec4 uA, uB, uC, uD; uniform vec3 uCol1, uCol2; uniform float uAlpha; uniform float uCount;
out vec2 vQ; out vec4 vCol; flat out int vShape; out float vVar;
uvec4 pcg4d(uvec4 v){ v = v*1664525u + 1013904223u; v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z; v ^= v >> 16u; v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z; return v; }
vec4 rnd(int i, int s){ return vec4(pcg4d(uvec4(uint(i), uint(s), 40503u, 2654435u))) * (1.0/4294967295.0); }
vec2 orbPath(float k, float t, float mode){
  if (mode < 0.5) {
    if (t < 6.0) {
      float e = smoothstep(0.3, 6.0, t);
      float r = 1.95*(1.0 - e);
      float a = e*4.0*PI;
      vec2 pos = -vec2(cos(a), sin(a)*0.42)*r;
      return k > 0.5 ? -pos : pos;
    }
    float t2 = t - 6.0;
    float r2 = smoothstep(0.0, 1.8, t2);
    float a2 = t2*0.55 + k*PI;
    return -vec2(cos(a2)*1.18, sin(a2)*0.40)*r2 + vec2(0.0, 0.04)*r2;
  }
  float a = t*0.42 + k*PI;
  return -vec2(cos(a)*1.12, sin(a)*0.34) + vec2(0.0, 0.10);
}
float beamI(vec2 p, vec4 b){
  vec2 o = b.xy; vec2 d = b.zw - o; float len = length(d); d /= len;
  float al = dot(p - o, d); float pe = length(p - o - d*al);
  float w = 0.035 + al*0.17;
  return exp(-pow(pe/w, 2.0))*step(0.0, al)*step(al, len);
}
uniform vec4 uB1, uB2, uB3; uniform vec3 uBI;
void main(){
  int id = gl_InstanceID;
  vec4 r = rnd(id, uSalt);
  vec4 r2 = rnd(id, uSalt + 7919);
  vec2 c = vec2(0.0); vec2 sz = vec2(0.01); float ang = 0.0; vec4 col = vec4(0.0); int shape = 0; float par = uPar; float var = 0.0;
  float t = uT;
  if (uType == 0) { // 星
    c = vec2((r.x*2.0 - 1.0)*ASPECT*1.25, (r.y*2.0 - 1.0)*1.25);
    float b = pow(r.z, 7.0);
    float tw = 0.55 + 0.45*sin(t*(0.6 + 2.4*r.w) + r.w*70.0);
    sz = vec2(0.005 + 0.045*b);
    vec3 sc = mix(vec3(0.70,0.80,1.0), vec3(1.0,0.88,0.75), r2.x);
    col = vec4(sc*(0.25 + 2.6*b)*tw*uAlpha, 0.0);
    shape = b > 0.12 ? 5 : 0; ang = r2.y*0.3;
  } else if (uType == 1) { // 花瓣 / 玫瑰瓣
    float depth = r.w;
    par = uPar*mix(0.75, 1.3, depth);
    float top = uA.z + uCam.y*par, bot = uA.w + uCam.y*par;
    float H = top - bot;
    float sp = uA.y*(0.6 + 0.8*r.y)*(0.55 + 0.9*depth);
    float fall = mod(t*sp + r.z*H, H);
    float y = top - fall;
    float W = ASPECT*uB.z;
    float cx = uCam.x*par;
    float x = (r.x*2.0 - 1.0)*W + uA.x*fall + 0.10*sin(t*(0.5 + r2.x) + r2.y*TAU)*(0.6 + depth);
    x = mod(x - cx + W, 2.0*W) - W + cx;
    c = vec2(x, y);
    float s = uB.y*mix(0.010, 0.038, depth*depth);
    float tumble = cos(t*(0.8 + 1.8*r2.z) + r2.w*TAU);
    sz = vec2(s*(0.25 + 0.75*abs(tumble)), s);
    ang = t*(0.3 + 0.9*r2.x)*(r2.y > 0.5 ? 1.0 : -1.0) + r.x*TAU;
    float a = uB.w*(0.55 + 0.45*depth)*uAlpha*smoothstep(0.0, 0.06, fall/H);
    vec3 pc = uC.x < 0.5 ? mix(vec3(1.0,0.66,0.76), vec3(1.0,0.90,0.93), r2.y) : mix(vec3(0.50,0.02,0.07), vec3(0.85,0.10,0.18), r2.y);
    pc = pow(pc, vec3(2.2))*(0.65 + 0.55*abs(tumble))*uC.y;
    col = vec4(pc*a, a);
    shape = uC.x < 0.5 ? 1 : 7;
    var = 0.03 + 0.30*pow(depth, 4.0);
  } else if (uType == 2) { // 浮游光点 / 爱心
    float x = uA.x + (r.x*2.0 - 1.0)*uA.z + 0.06*sin(t*0.25*(0.5 + r.z) + r.w*TAU);
    float H = 2.0*uA.w;
    float fy = mod(r.y*H + t*uB.z*(0.3 + r.z), H);
    c = vec2(x, uA.y - uA.w + fy);
    sz = vec2(mix(uB.x, uB.y, r2.x*r2.x));
    float fl = 0.5 + 0.5*sin(t*(0.4 + r.w*1.2) + r.x*40.0);
    float ef = smoothstep(0.0, 0.15, fy/H)*smoothstep(1.0, 0.8, fy/H);
    col = vec4(mix(uCol1, uCol2, r2.y)*uB.w*fl*ef*uAlpha, 0.0);
    shape = uC.x > 1.5 ? 6 : (uC.x > 0.5 ? 5 : 2);
    ang = (r2.z - 0.5)*0.6;
    var = r2.z;
  } else if (uType == 3) { // 音符
    float P = uB.x*(0.7 + 0.6*r.z);
    float age = fract(t/P + r.y);
    c = vec2(mix(uA.x, uA.y, r.x) + 0.07*sin(age*TAU*1.3 + r.w*TAU), uA.z + age*uA.w);
    float a = smoothstep(0.0, 0.12, age)*(1.0 - smoothstep(0.65, 1.0, age))*uB.z*uAlpha;
    col = vec4((r.w < 0.5 ? uCol1 : uCol2)*a, 0.0);
    sz = vec2(uB.y*(0.7 + 0.6*r2.x));
    ang = 0.35*sin(age*TAU + r.x*10.0);
    shape = 3; var = floor(r2.y*2.99);
  } else if (uType == 4) { // 雨丝
    float depth = r.w;
    par = uPar*mix(0.6, 1.2, depth);
    float sp = uA.y*(0.55 + 0.6*depth);
    float top = uA.z + uCam.y*par, bot = uA.w + uCam.y*par;
    float H = top - bot;
    float fall = mod(t*sp + r.y*H, H);
    float W = ASPECT*uB.w;
    float cx = uCam.x*par;
    float x = (r.x*2.0 - 1.0)*W + uA.x*fall;
    x = mod(x - cx + W, 2.0*W) - W + cx;
    c = vec2(x, top - fall);
    vec2 dir = normalize(vec2(uA.x, -1.0));
    ang = atan(-dir.x, dir.y);
    sz = vec2(uB.y*mix(0.0016, 0.0042, depth), uB.x*mix(0.035, 0.10, depth));
    float b = 0.20 + 0.35*depth;
    vec2 lv = c - uC.xy;
    float cone = lv.y < 0.0 ? smoothstep(uC.z, uC.z*0.25, abs(lv.x)/(-lv.y + 0.05))*exp(lv.y*0.8) : 0.0;
    b += cone*uC.w;
    vec3 rc = mix(vec3(0.55,0.65,0.85), vec3(1.0,0.82,0.55), clamp(cone*uC.w*0.5, 0.0, 1.0));
    col = vec4(rc*b*uB.z*uAlpha, 0.0);
    shape = 4;
  } else if (uType == 5) { // 光点爆发
    float age = t - uA.z;
    float life = uB.x*(0.5 + 0.5*r.z);
    if (age >= 0.0 && age <= life) {
      float a0 = r.x*TAU; float spd = uA.w*(0.15 + 0.85*sqrt(r.y));
      float dist = spd*(1.0 - exp(-2.5*age))/2.5;
      c = uA.xy + vec2(cos(a0), sin(a0)*0.75)*dist + vec2(0.0, -uB.w*age*age);
      float a = (1.0 - smoothstep(0.0, life, age))*uB.z*uAlpha;
      col = vec4((r.w < 0.5 ? uCol1 : uCol2)*a*(0.6 + 0.8*r2.x), 0.0);
      sz = vec2(uB.y*(0.4 + 0.9*r2.y));
      shape = r2.z > 0.6 ? 5 : 0; ang = r2.w;
    }
  } else if (uType == 6) { // 两颗光球与拖尾
    int nh = int(uCount)/2;
    float k = float(id % 2); float i = float(id/2);
    float fi = i/float(nh);
    float tt = t - i*uA.y;
    c = orbPath(k, tt, uA.x) + (r.xy*2.0 - 1.0)*fi*uA.z + vec2(0.0, -fi*fi*0.05);
    float s = i < 0.5 ? uB.z : mix(uB.x, uB.y, pow(fi, 0.6));
    sz = vec2(s);
    float a = pow(1.0 - fi, 1.6)*uAlpha;
    col = vec4((k < 0.5 ? uCol1 : uCol2)*a*(i < 0.5 ? uB.w : 1.0), 0.0);
    shape = (r.z > 0.85 && i > 3.0) ? 5 : 0; ang = r2.x;
    if (tt < 0.0) col = vec4(0.0);
  } else if (uType == 7) { // 双螺旋 → 爱心
    float k = float(id % 2);
    float f = r.x;
    float tau = t - uA.z;
    float s = (tau - f*5.0)/4.5;
    float vis = step(0.0, s);
    s = fract(max(s, 0.0));
    float ph = s*13.0 + k*PI + t*1.2;
    float rad = uB.y*smoothstep(0.0, 0.25, s)*(1.0 - 0.35*s);
    vec2 hel = vec2(uA.x + rad*sin(ph), uA.y + s*uB.x);
    float z = cos(ph);
    float th = (k < 0.5 ? PI + f*PI : f*PI) + t*0.03;
    float sx = sin(th);
    vec2 hp = vec2(16.0*sx*sx*sx, 13.0*cos(th) - 5.0*cos(2.0*th) - 2.0*cos(3.0*th) - cos(4.0*th))/17.0;
    vec2 hrt = uC.xy + hp*uC.z + (r2.xy - 0.5)*0.018*(1.0 + sin(t*2.0 + r.z*9.0));
    float m = uA.w;
    c = mix(hel, hrt, m);
    float a = uB.w*uAlpha*mix(vis*smoothstep(0.0, 0.08, s)*(1.0 - smoothstep(0.8, 1.0, s))*(0.6 + 0.4*z), 1.0, m);
    float tw = 0.7 + 0.3*sin(t*4.0 + r.y*50.0);
    col = vec4((k < 0.5 ? uCol1 : uCol2)*a*tw, 0.0);
    sz = vec2(uB.z*(0.5 + 0.8*r.z)*mix(0.8 + 0.3*z, 1.0, m));
    shape = r.y > 0.82 ? 5 : 0; ang = r2.z;
  } else if (uType == 9) { // 光柱中的尘埃
    float x = (r.x*2.0 - 1.0)*1.7 + 0.05*sin(t*0.3 + r.z*TAU);
    float y = -0.62 + r.y*1.7 + 0.04*sin(t*0.23 + r.w*TAU);
    c = vec2(x, y);
    float b = beamI(c, uB1)*uBI.x + beamI(c, uB2)*uBI.y + beamI(c, uB3)*uBI.z;
    col = vec4(vec3(1.0,0.95,0.9)*b*uB.w*(0.4 + 0.6*r2.x)*uAlpha, 0.0);
    sz = vec2(mix(0.002, 0.0065, r2.y));
    shape = 0;
  }
  vec2 l = aCorner*sz; float cs = cos(ang), sn = sin(ang);
  vec2 w = c + vec2(cs*l.x - sn*l.y, sn*l.x + cs*l.y);
  vec2 q = (w - uCam.xy*par)*uCam.z;
  gl_Position = vec4(q.x/ASPECT, q.y, 0.0, 1.0);
  if (col.a <= 0.0 && max(col.r, max(col.g, col.b)) <= 0.0) gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
  vQ = aCorner; vCol = col; vShape = shape; vVar = var;
}`;

  const PART_FS = COMMON + `
in vec2 vQ; in vec4 vCol; flat in int vShape; in float vVar;
out vec4 oCol;
float sdHeart(vec2 p){ p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot(p - vec2(0.25,0.75), p - vec2(0.25,0.75))) - sqrt(2.0)/4.0;
  vec2 a = p - vec2(0.0,1.0); vec2 b = p - 0.5*max(p.x + p.y, 0.0);
  return sqrt(min(dot(a,a), dot(b,b)))*sign(p.x - p.y); }
void main(){
  vec2 q = vQ; float r = length(q); float a = 0.0; vec3 tint = vec3(1.0);
  if (vShape == 0) { a = exp(-r*r*5.0)*smoothstep(1.0, 0.7, r) + exp(-r*r*40.0)*0.8; }
  else if (vShape == 1) {
    float e = length(vec2(q.x*1.25, (q.y + 0.05)*0.95));
    e += 0.28*smoothstep(0.35, 0.95, q.y)*exp(-q.x*q.x*30.0);
    a = 1.0 - smoothstep(0.80 - vVar, 0.82 + vVar*0.6, e);
    tint = mix(vec3(1.06), vec3(0.88,0.72,0.80), smoothstep(-0.2, -0.9, q.y)*0.8);
  }
  else if (vShape == 2) { a = smoothstep(1.0, 0.86, r)*(0.45 + 0.55*smoothstep(0.55, 0.95, r)); }
  else if (vShape == 3) {
    vec2 hq = q - vec2(-0.22, -0.52);
    float ca = cos(0.45), sa = sin(0.45);
    hq = vec2(ca*hq.x + sa*hq.y, -sa*hq.x + ca*hq.y);
    float head = (length(hq/vec2(0.30, 0.21)) - 1.0)*0.2;
    float stem = max(abs(q.x - 0.06) - 0.045, abs(q.y - 0.12) - 0.64);
    float d = min(head, stem);
    if (vVar < 0.5) {
      vec2 fq = q - vec2(0.06, 0.76);
      float flag = max(abs(fq.y + fq.x*0.9 + 0.08*sin(fq.x*9.0)) - 0.08, max(-fq.x, fq.x - 0.40));
      d = min(d, flag);
    } else if (vVar > 1.5) {
      vec2 fq = q - vec2(0.06, 0.76);
      float f1 = max(abs(fq.y + fq.x*0.7) - 0.06, max(-fq.x, fq.x - 0.36));
      float f2 = max(abs(fq.y + 0.25 + fq.x*0.7) - 0.06, max(-fq.x, fq.x - 0.36));
      d = min(d, min(f1, f2));
    }
    a = smoothstep(0.035, -0.02, d) + exp(-max(d, 0.0)*14.0)*0.35;
  }
  else if (vShape == 4) { a = exp(-q.x*q.x*5.0)*smoothstep(1.0, 0.0, abs(q.y))*(0.35 + 0.65*smoothstep(-1.0, 1.0, q.y)); }
  else if (vShape == 5) {
    float core = exp(-r*r*28.0);
    float rays = exp(-abs(q.x)*22.0)*exp(-abs(q.y)*2.6) + exp(-abs(q.y)*22.0)*exp(-abs(q.x)*2.6);
    a = (core*1.2 + rays*0.8)*smoothstep(1.0, 0.8, max(abs(q.x), abs(q.y)));
  }
  else if (vShape == 6) {
    float d = sdHeart(q*0.95 + vec2(0.0, 0.55));
    a = smoothstep(0.03, -0.03, d) + exp(-max(d, 0.0)*9.0)*0.35;
  }
  else if (vShape == 7) {
    float e = length(q*vec2(1.1, 0.9));
    a = 1.0 - smoothstep(0.80, 0.86 + vVar, e);
    tint = vec3(0.7 + 0.5*smoothstep(0.85, 0.3, e))*(1.0 - 0.3*exp(-pow((q.x - q.y*0.3)*6.0, 2.0)));
  }
  oCol = vec4(vCol.rgb*tint*a, vCol.a*a);
}`;

  // ---------------- 精灵（剪影、物件、文字） ----------------
  const SPRITE_VS = COMMON + `
layout(location=0) in vec2 aCorner;
uniform vec2 uPos, uSize; uniform float uRot; uniform vec3 uCam; uniform float uPar; uniform vec4 uUV;
out vec2 vUV; out vec2 vC;
void main(){
  vec2 l = aCorner*uSize;
  float c = cos(uRot), s = sin(uRot);
  vec2 w = uPos + vec2(c*l.x - s*l.y, s*l.x + c*l.y);
  vec2 q = (w - uCam.xy*uPar)*uCam.z;
  gl_Position = vec4(q.x/ASPECT, q.y, 0.0, 1.0);
  vec2 uv = aCorner*0.5 + 0.5; uv.y = 1.0 - uv.y;
  vUV = uUV.xy + uv*uUV.zw; vC = aCorner;
}`;

  const SPRITE_FS = COMMON + `
in vec2 vUV; in vec2 vC; out vec4 oCol;
uniform sampler2D uTex; uniform int uMode; uniform float uAlpha;
uniform vec3 uC1, uC2, uC3; uniform vec3 uRimCol, uRim2Col; uniform vec2 uRimDir, uRim2Dir; uniform float uRimW; uniform vec2 uTexel;
uniform float uReveal, uBlur, uT, uDissolve, uBoost; uniform vec3 uTint, uGlowCol;
vec4 tap(vec2 uv){
  if (uBlur <= 0.0) return texture(uTex, uv);
  vec4 s = texture(uTex, uv)*0.2;
  for (int i = 0; i < 8; i++) { float a = float(i)*TAU/8.0; s += texture(uTex, uv + vec2(cos(a), sin(a))*uTexel*uBlur)*0.1; }
  return s;
}
void main(){
  vec2 uv = vUV;
  if (uMode == 3) uv.x += (vnoise(vec2(uv.y*28.0, uT*1.3)) - 0.5)*0.03*(1.0 - uv.y);
  vec4 t = tap(uv);
  vec4 o;
  if (uMode == 1 || uMode == 3) {
    float a = t.a;
    vec3 w = t.rgb/max(t.r + t.g + t.b, 1e-4);
    vec3 sc = t.rgb/max(a, 1e-4);
    float br = max(sc.r, max(sc.g, sc.b))/0.8;
    vec3 base = (w.r*uC1 + w.g*uC2 + w.b*uC3)*br;
    float ao = texture(uTex, uv + uRimDir*uTexel*uRimW).a;
    float ao2 = texture(uTex, uv + uRim2Dir*uTexel*uRimW*0.7).a;
    float rim = clamp(a - ao, 0.0, 1.0);
    float rim2 = clamp(a - ao2, 0.0, 1.0);
    vec3 col = base*a*(0.8 + 0.4*(1.0 - uv.y));
    col += uRimCol*rim*(0.75 + 0.5*w.g) + uRim2Col*rim2;
    o = vec4(col, a);
    if (uMode == 3) o *= smoothstep(0.15, 0.95, uv.y)*0.45;
  } else {
    o = t;
    if (uMode == 0 || uMode == 4) {
      vec3 c = t.a > 0.0 ? t.rgb/t.a : vec3(0.0);
      o.rgb = pow(c, vec3(2.2))*t.a*uTint*uBoost;
      if (uRimW > 0.0) { float ao = texture(uTex, uv + uRimDir*uTexel*uRimW).a; o.rgb += uRimCol*clamp(t.a - ao, 0.0, 1.0); }
    }
  }
  if (uMode == 2 || uMode == 4) { float m = clamp((uReveal*1.3 - vUV.x)/0.3, 0.0, 1.0); o *= m; }
  if (uDissolve > 0.0) {
    float n = fbm3(vUV*vec2(14.0, 22.0));
    float th = uDissolve*1.1 - 0.05;
    float m = smoothstep(th, th + 0.06, n);
    o.rgb += uGlowCol*exp(-pow((n - th)/0.03, 2.0))*t.a*(1.0 - m);
    o *= m;
  }
  oCol = o*uAlpha;
}`;

  // ---------------- 后期 ----------------
  const POST_HEAD = COMMON + `
in vec2 vUV; out vec4 oCol;
uniform sampler2D uTex; uniform vec2 uTexel;
`;
  const COMP_FS = COMMON + `
in vec2 vUV; out vec4 oCol;
uniform sampler2D uA, uB; uniform float uMix; uniform int uMode; uniform float uRain; uniform float uT;
vec2 dropLayer(vec2 uv, float t, float scale, float seed, inout float mask){
  vec2 g = uv*vec2(ASPECT, 1.0)*scale; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float h = hash12(id + seed);
  vec2 c = (hash22(id + seed*1.7) - 0.5)*0.6;
  float life = fract(t*0.06 + h*7.0);
  float exist = step(0.62, hash12(id + seed + 5.0));
  float rad = (0.10 + 0.16*hash12(id + seed + 9.0))*smoothstep(0.0, 0.06, life)*(1.0 - smoothstep(0.85, 1.0, life));
  vec2 d = (f - c)*vec2(1.0, 0.9);
  float m = smoothstep(rad, rad*0.7, length(d))*exist;
  mask = max(mask, m);
  return d/max(rad, 1e-3)*m;
}
vec2 slideLayer(vec2 uv, float t, inout float mask){
  vec2 g = uv*vec2(ASPECT, 1.0)*vec2(5.0, 1.0);
  float cx = floor(g.x); float fx = fract(g.x) - 0.5;
  float h = hash11(cx*3.7 + 1.0);
  float y = 1.0 - fract(t*(0.05 + 0.12*h) + h);
  float wob = 0.12*sin(uv.y*30.0 + h*10.0);
  vec2 d = vec2((fx - (h - 0.5)*0.5 - wob*0.3)*0.9, (uv.y - y)*5.0*1.0);
  float r = length(d);
  float rad = 0.13 + 0.05*h;
  float m = smoothstep(rad, rad*0.7, r)*step(0.45, h);
  float trail = smoothstep(0.05, 0.0, abs(d.x))*step(0.0, uv.y - y)*smoothstep(0.35, 0.0, uv.y - y)*step(0.45, h)*0.5;
  mask = max(mask, max(m, trail*0.5));
  return d/rad*m + vec2(d.x*8.0, 0.0)*trail*0.2;
}
void main(){
  vec2 uv = vUV;
  vec2 off = vec2(0.0); float dm = 0.0;
  if (uRain > 0.001) {
    off += dropLayer(uv, uT, 9.0, 1.0, dm);
    off += dropLayer(uv, uT*1.3, 17.0, 7.0, dm)*0.6;
    off += slideLayer(uv, uT, dm);
    off *= -0.018*uRain;
    dm *= uRain;
  }
  vec3 a = texture(uA, uv + off).rgb;
  vec3 col = a;
  if (uMix > 0.0) {
    vec3 b = texture(uB, uv + off).rgb;
    if (uMode == 0) col = mix(a, b, uMix);
    else if (uMode == 1) col = a*smoothstep(0.5, 0.0, uMix) + b*smoothstep(0.5, 1.0, uMix);
    else if (uMode == 2) {
      float n = fbm(uv*vec2(ASPECT, 1.0)*2.5)*0.85 + (1.0 - uv.y)*0.15;
      float th = uMix*1.25 - 0.12;
      float m2 = smoothstep(th + 0.04, th - 0.04, n);
      float edge = exp(-pow((n - th)/0.03, 2.0))*(1.0 - abs(uMix*2.0 - 1.0));
      col = mix(a, b, m2) + L(vec3(1.0,0.85,0.62))*edge*1.1;
    } else {
      col = mix(a, b, smoothstep(0.35, 0.65, uMix)) + L(vec3(1.0,0.96,0.9))*pow(sin(uMix*PI), 2.0)*0.35;
    }
  }
  col += L(vec3(0.6,0.7,0.9))*dm*0.05;
  oCol = vec4(col, 1.0);
}`;
  const PRE_FS = POST_HEAD + `
uniform float uThresh;
void main(){
  vec2 h = uTexel*0.5;
  vec3 c = (texture(uTex, vUV + vec2(-h.x,-h.y)).rgb + texture(uTex, vUV + vec2(h.x,-h.y)).rgb + texture(uTex, vUV + vec2(-h.x,h.y)).rgb + texture(uTex, vUV + vec2(h.x,h.y)).rgb)*0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThresh, uThresh*1.6 + 0.25, l);
  oCol = vec4(min(c*k, vec3(40.0)), 1.0);
}`;
  const DOWN_FS = POST_HEAD + `
void main(){
  vec2 h = uTexel;
  vec3 s = texture(uTex, vUV).rgb*4.0 + texture(uTex, vUV - h).rgb + texture(uTex, vUV + h).rgb + texture(uTex, vUV + vec2(h.x, -h.y)).rgb + texture(uTex, vUV - vec2(h.x, -h.y)).rgb;
  oCol = vec4(s/8.0, 1.0);
}`;
  const UP_FS = POST_HEAD + `
uniform float uW;
void main(){
  vec2 h = uTexel;
  vec3 s = texture(uTex, vUV + vec2(-h.x*2.0, 0.0)).rgb + texture(uTex, vUV + vec2(-h.x, h.y)).rgb*2.0 + texture(uTex, vUV + vec2(0.0, h.y*2.0)).rgb + texture(uTex, vUV + vec2(h.x, h.y)).rgb*2.0
         + texture(uTex, vUV + vec2(h.x*2.0, 0.0)).rgb + texture(uTex, vUV + vec2(h.x, -h.y)).rgb*2.0 + texture(uTex, vUV + vec2(0.0, -h.y*2.0)).rgb + texture(uTex, vUV + vec2(-h.x, -h.y)).rgb*2.0;
  oCol = vec4(s/12.0*uW, 1.0);
}`;
  const FINAL_FS = COMMON + `
in vec2 vUV; out vec4 oCol;
uniform sampler2D uScene, uBloom; uniform float uBloomAmt, uExposure, uFade, uT, uVig, uGrain, uSat; uniform vec3 uTint; uniform vec2 uRes;
vec3 shoulder(vec3 x){ vec3 k = vec3(0.72); return mix(x, k + 0.28*(1.0 - exp(-(x - k)/0.28)), step(k, x)); }
void main(){
  vec3 c = texture(uScene, vUV).rgb;
  vec3 b = texture(uBloom, vUV).rgb;
  c += b*uBloomAmt;
  c *= uExposure*uTint;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(lum), smoothstep(1.0, 6.0, lum)*0.7);
  c = mix(vec3(lum), c, uSat);
  c = shoulder(max(c, 0.0));
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2));
  vec2 q = vUV - 0.5;
  c *= 1.0 - uVig*smoothstep(0.3, 0.85, length(q*vec2(1.0, 0.8))*1.25);
  float g = hash12(vUV*uRes + fract(uT*7.13)*317.0) - 0.5;
  c += g*uGrain;
  oCol = vec4(c*uFade, 1.0);
}`;

  SM.SHADERS = {
    FS_VS, PART_VS, PART_FS, SPRITE_VS, SPRITE_FS, COMP_FS, PRE_FS, DOWN_FS, UP_FS, FINAL_FS,
    BG: { night: BG_NIGHT, garden: BG_GARDEN, sunset: BG_SUNSET, rain: BG_RAIN, stage: BG_STAGE, dawn: BG_DAWN },
  };
})();
