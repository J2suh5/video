// =====================================================================
//  WEBGL — scene backgrounds, 2D-layer lighting, particles, post
// =====================================================================
const GLSL_COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uView; uniform vec3 uCam;
float h11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 h22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 h32(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
const mat2 RM = mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=RM*p+vec2(3.1,7.7); a*=.5; } return s/.97; }
float fbm3(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vn(p); p=RM*p+vec2(3.1,7.7); a*=.5; } return s/.875; }
float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(h11(i),h11(i+1.),f); }
float ridge(float x, float s){ return n1(x+s)*.55 + n1(x*2.13+s*1.7)*.27 + n1(x*4.37+s*2.9)*.13 + n1(x*9.1+s)*.05; }
`;

const VS_FS = `#version 300 es
in vec2 aP; out vec2 vUv; void main(){ vUv=aP*.5+.5; gl_Position=vec4(aP,0.,1.); }`;

// ---------------------------------------------------------------- scene backgrounds
const FS_BG = GLSL_COMMON + `
in vec2 vUv; out vec4 o;
uniform float uT; uniform int uScene; uniform vec4 uP0, uP1, uP2; uniform vec4 uMet[4];
vec2 par(vec2 p, float d){ float z=mix(1.,uCam.z,d); return (p-vec2(960.,540.))/z + vec2(960.,540.) + (uCam.xy-vec2(960.,540.))*d; }
float pxs(){ return 1.3/uView.z; }
float cover(float d){ return smoothstep(-pxs(), pxs(), d); }
vec3 stars(vec2 p, float cell, float dens, float bright, float t){
  vec2 g=floor(p/cell), f=fract(p/cell); float h=h12(g);
  if(h>dens) return vec3(0.);
  vec2 c=.2+.6*h22(g+13.7); float d=length(f-c)*cell;
  float m=pow(h12(g+5.3),6.);
  float sz=max(.55+1.7*m, .9/uView.z);
  float tw=.6+.4*sin(t*(.7+2.3*h12(g+9.1))+h*80.);
  float core=exp(-d*d/(sz*sz)), halo=exp(-d/(sz*4.))*.16*(m+.1);
  vec3 col=mix(vec3(.72,.83,1.), vec3(1.,.88,.74), h12(g+2.9));
  return col*(core+halo)*tw*bright*(.35+1.6*m);
}
// ── 0 prologue: twin nebula
vec3 scPrologue(vec2 p, float t){
  vec2 q=par(p,.15)/1080.;
  vec3 col=mix(vec3(.004,.006,.016), vec3(.02,.026,.06), smoothstep(.9,.0,abs(q.y-.55)));
  float a=fbm(vec2(q.x*2.1+t*.012, q.y*2.6));
  float b=fbm(vec2(q.x*2.4-t*.01+4., q.y*2.2+a*1.3));
  float bandA=exp(-pow((q.y-.52-.11*sin(q.x*3.1+.6+t*.02))/.2,2.));
  float bandB=exp(-pow((q.y-.50+.11*sin(q.x*3.1+.6+t*.02))/.2,2.));
  col+=vec3(.16,.27,.66)*pow(a,2.2)*bandA*1.35;
  col+=vec3(.13,.52,.37)*pow(b,2.5)*bandB*1.15;
  col+=vec3(.55,.36,.62)*pow(fbm(q*7.+3.),4.)*.3*(bandA+bandB);
  vec2 sp=par(p,.1);
  col+=stars(sp,23.,.32,1.,t)+stars(sp+vec2(331.,97.),57.,.5,1.4,t)+stars(sp+vec2(71.,13.),11.,.17,.45,t);
  return col*uP0.x;
}
// ── 1 dusk
vec3 scDusk(vec2 p, float t){
  vec2 sun=uP0.xy; float y=p.y/1080.;
  vec3 col=mix(vec3(.12,.15,.36), vec3(.52,.32,.52), smoothstep(.0,.36,y));
  col=mix(col, vec3(.97,.54,.42), smoothstep(.28,.6,y));
  col=mix(col, vec3(1.,.8,.52), smoothstep(.53,.7,y));
  float d=length((p-sun)*vec2(1.,1.12));
  col+=vec3(1.,.6,.35)*exp(-d/430.)*.55 + vec3(1.,.86,.62)*exp(-d/105.)*.75;
  float ang=atan(p.y-sun.y, p.x-sun.x);
  float rays=pow(fbm3(vec2(ang*6., t*.04)),3.)*1.5;
  col+=vec3(1.,.72,.46)*rays*exp(-d/650.)*.33*smoothstep(0.,120.,d);
  vec2 cp=par(p,.12);
  float cn=fbm(vec2(cp.x/520.+t*.005, cp.y/95.));
  float cm=smoothstep(.52,.78,cn)*smoothstep(.06,.26,y)*smoothstep(.62,.4,y);
  float lit=exp(-abs(cp.x-sun.x)/650.);
  vec3 cc=mix(vec3(.42,.27,.46), vec3(1.,.62,.48), lit*.85+.1);
  cc+=vec3(1.,.8,.5)*pow(lit,3.)*smoothstep(.62,.9,cn)*.6;
  col=mix(col, cc, cm*.85);
  col=mix(col, vec3(1.,.95,.82)*2.4, smoothstep(47.,43.,length(p-sun)));
  vec2 a=par(p,.22); float hA=688.+60.*ridge(a.x/420.,3.);
  col=mix(col, mix(col, vec3(.8,.47,.52), .55), cover(a.y-hA));
  vec2 b=par(p,.42); float hB=742.+70.*ridge(b.x/330.,7.);
  col=mix(col, vec3(.5,.28,.4), cover(b.y-hB));
  vec2 c=par(p,.65); float hC=802.+50.*ridge(c.x/260.,13.);
  col=mix(col, vec3(.3,.17,.27), cover(c.y-hC));
  col+=vec3(1.,.6,.4)*exp(-abs(p.y-720.)/60.)*.1;
  return col;
}
// ── 2 sakura walk
vec3 scWalk(vec2 p, float t){
  float y=p.y/1080.;
  vec3 col=mix(vec3(.42,.58,.87), vec3(.8,.78,.93), smoothstep(.0,.5,y));
  col=mix(col, vec3(1.,.85,.87), smoothstep(.4,.72,y));
  vec2 sun=vec2(1560.,170.); float d=length(p-sun);
  col+=vec3(1.,.95,.88)*(exp(-d/380.)*.5+exp(-d/70.)*.55);
  vec2 cp=par(p,.06);
  float cn=fbm(vec2(cp.x/650.+t*.01, cp.y/170.));
  col=mix(col, vec3(1.,.97,.98), smoothstep(.5,.8,cn)*smoothstep(.62,.05,y)*.75);
  vec2 bp=par(p,.18);
  float bx=floor(bp.x/64.); float bh=655.-150.*pow(h11(bx*1.3),2.2)-40.*h11(bx*7.1);
  col=mix(col, mix(col, vec3(.74,.68,.86), .65), cover(bp.y-bh));
  vec2 tp=par(p,.4);
  float top=705.-95.*fbm3(vec2(tp.x/130.,2.));
  float tn=fbm(tp/38.);
  col=mix(col, mix(vec3(.95,.69,.8), vec3(1.,.87,.91), tn), cover(tp.y-top)*.95);
  vec2 tq=par(p,.55);
  float trunk=step(.82, h11(floor(tq.x/90.)))*step(abs(fract(tq.x/90.)-.5),.035);
  col=mix(col, vec3(.55,.4,.45), trunk*cover(tq.y-720.)*.6);
  vec2 gp=par(p,1.);
  vec3 g=mix(vec3(.88,.77,.79), vec3(.72,.6,.65), smoothstep(820.,1080.,p.y));
  float spots=smoothstep(.7,.78, vn(vec2(gp.x/9., gp.y/4.)));
  g=mix(g, vec3(1.,.83,.89), spots*.7);
  g=mix(g, vec3(.8,.66,.7), smoothstep(.45,.55,vn(vec2(gp.x/300.,1.)))*.15);
  col=mix(col, g, cover(p.y-822.));
  return col;
}
// ── 3 stage
vec3 scStage(vec2 p, float t){
  float on=uP0.x, beat=uP0.y;
  vec3 col=vec3(.012,.01,.026);
  col+=vec3(.24,.1,.34)*exp(-pow((p.y-470.)/260.,2.))*.55*on;
  col+=vec3(.08,.13,.34)*exp(-length((p-vec2(960.,500.))/vec2(760.,320.)))*.5*on;
  for(int i=0;i<9;i++){ float fi=float(i); vec2 lp=vec2(160.+fi*200., 135.); col+=vec3(1.,.9,.8)*exp(-length(p-lp)/6.)*.9*on; }
  for(int i=0;i<6;i++){
    float fi=float(i);
    vec2 o2=vec2(240.+fi*290.,135.);
    float sw=sin(t*.55+fi*1.9)*.36*(mod(fi,2.)*2.-1.);
    vec2 dir=vec2(cos(1.5708+sw), sin(1.5708+sw));
    vec2 v=p-o2; float al=dot(v,dir); float pe=abs(v.x*dir.y-v.y*dir.x);
    float w=12.+al*.16;
    float bm=exp(-pow(pe/w,2.))*smoothstep(0.,60.,al)*exp(-al/1500.);
    float hz=.45+.55*fbm3(vec2(p.x/160.+t*.05, p.y/120.-t*.04));
    float m3=mod(fi,3.);
    vec3 bc=m3<.5? vec3(.45,.62,1.) : (m3<1.5? vec3(.5,1.,.72) : vec3(1.,.6,.82));
    float pulse=.7+.3*pow(.5+.5*cos(beat*6.2832+fi*.7),3.);
    col+=bc*bm*hz*.5*on*pulse;
  }
  float fl=cover(p.y-862.);
  vec3 floorc=vec3(.035,.028,.045)+vec3(.15,.12,.25)*exp(-abs(p.y-862.)/40.)*on;
  floorc+=vec3(.3,.25,.5)*exp(-pow((p.x-960.)/500.,2.))*exp(-(p.y-862.)/90.)*.25*on;
  col=mix(col, floorc, fl);
  return col;
}
// ── 4 rain
vec3 rainSky(vec2 p, float t){
  float y=p.y/1080.;
  vec3 col=mix(vec3(.02,.03,.06), vec3(.08,.1,.14), smoothstep(0.,.75,y));
  vec2 cp=par(p,.05);
  col+=vec3(.17,.12,.11)*fbm(vec2(cp.x/500.+t*.01, cp.y/160.))*smoothstep(.0,.7,y)*.6;
  col+=vec3(.5,.55,.8)*uP1.x*smoothstep(.75,.0,y)*fbm3(cp/300.);
  vec2 b1=par(p,.25);
  float bx=floor(b1.x/90.); float h1=520.-260.*pow(h11(bx*3.7),1.5);
  vec3 bc=vec3(.035,.045,.07);
  vec2 wc=vec2(b1.x/14., b1.y/18.); vec2 wi=floor(wc), wf=fract(wc);
  float lit=step(.72,h12(wi+bx*7.))*step(.2,wf.x)*step(wf.x,.7)*step(.25,wf.y)*step(wf.y,.75);
  vec3 wcol=mix(vec3(1.,.75,.45), vec3(.7,.85,1.), step(.8,h12(wi+3.)));
  bc+=wcol*lit*.33*(.8+.2*sin(t*3.+h12(wi)*50.));
  col=mix(col, bc, cover(b1.y-h1));
  vec2 b2=par(p,.45);
  float bx2=floor(b2.x/150.); float h2=600.-200.*pow(h11(bx2*5.1+2.),1.3);
  vec3 b2c=vec3(.02,.025,.04);
  vec2 wc2=vec2(b2.x/20., b2.y/26.); vec2 wi2=floor(wc2), wf2=fract(wc2);
  float lit2=step(.78,h12(wi2+bx2*11.))*step(.2,wf2.x)*step(wf2.x,.75)*step(.2,wf2.y)*step(wf2.y,.7);
  b2c+=vec3(1.,.72,.4)*lit2*.45;
  col=mix(col, b2c, cover(b2.y-h2));
  vec2 bk=par(p,.6);
  for(int i=0;i<2;i++){
    float cs=i==0?110.:170.;
    vec2 g=floor(bk/cs), f=fract(bk/cs);
    vec2 c=.25+.5*h22(g+float(i)*17.);
    float r=(.2+.16*h12(g+4.))*cs*.5;
    float dd=length((f-c)*cs);
    float disc=smoothstep(r,r*.85,dd)*(.55+.45*smoothstep(r*.5,r,dd));
    vec3 kc=mix(vec3(1.,.6,.3), vec3(.4,.7,1.), h12(g+9.));
    kc=mix(kc, vec3(1.,.3,.35), step(.86,h12(g+1.)));
    float show=step(.45,h12(g+20.))*smoothstep(420.,680.,bk.y)*smoothstep(860.,760.,bk.y);
    col+=kc*disc*show*.2;
  }
  return col;
}
vec3 scRain(vec2 p, float t){
  float hor=805.; vec2 lamp=uP0.xy; float on=uP0.z;
  vec3 col;
  if(p.y<hor) col=rainSky(p,t);
  else {
    float k=p.y-hor;
    vec2 q=vec2(p.x+(vn(vec2(p.x/40., p.y/6.-t*2.))-.5)*18.*smoothstep(0.,200.,k), hor-k);
    col=rainSky(q,t)*.3;
    col=mix(col, vec3(.03,.035,.05), .4);
    vec2 rp=vec2(p.x, (p.y-hor)*3.2);
    vec2 g=floor(rp/62.), f=fract(rp/62.)-.5;
    float ph=fract(t*.9+h12(g));
    float rr=length(f)*62.;
    float ring=exp(-pow((rr-ph*28.)/2.,2.))*(1.-ph)*step(.35,h12(g+3.));
    col+=vec3(.4,.45,.55)*ring*.28;
    col+=vec3(.06,.07,.1)*smoothstep(1080.,hor,p.y)*.5;
  }
  vec2 v=p-lamp;
  if(v.y>0.){ float w=30.+v.y*.43; float cone=exp(-pow(v.x/w,2.)*1.4)*exp(-v.y/950.)*smoothstep(0.,40.,v.y);
    float hz=.55+.45*fbm3(vec2(p.x/90., p.y/70.-t*.3));
    col+=vec3(1.,.82,.55)*cone*hz*.36*on; }
  float pool=exp(-pow((p.x-lamp.x)/240.,2.)-pow((p.y-910.)/48.,2.));
  col+=vec3(1.,.8,.52)*pool*.38*step(hor,p.y)*on;
  col+=vec3(1.,.85,.6)*exp(-length(v)/42.)*.55*on;
  col+=vec3(.55,.6,.85)*uP1.x*.35;
  return col;
}
// ── 5 masquerade: rose window
vec3 scMask(vec2 p, float t){
  vec2 c=uP0.xy; float R=uP0.z;
  vec3 col=mix(vec3(.05,.0,.014), vec3(.006,0.,.004), smoothstep(150.,1000.,p.y));
  col+=vec3(.2,.02,.05)*exp(-length(p-c)/680.)*.9;
  vec2 v=p-c; float r=length(v); float a=atan(v.y,v.x);
  float N=12., seg=6.2831853/N;
  float fa=mod(a+seg*.5, seg)-seg*.5;
  vec2 fp=vec2(cos(fa),sin(fa))*r;
  if(r<R+8.){
    float tr=abs(r-R*.2);
    tr=min(tr, abs(r-R*.52)); tr=min(tr, abs(r-R));
    if(r>R*.2) tr=min(tr, abs(fp.y));
    tr=min(tr, abs(length(fp-vec2(R*.76,0.))-R*.19));
    tr=min(tr, abs(length(fp-vec2(R*.36,0.))-R*.1));
    tr=min(tr, abs(length(fp-vec2(R*.76,0.))-R*.06));
    float line=1.-smoothstep(2.5,5.,tr);
    float ring=floor(r/(R*.26));
    float id=floor((a+3.14159)/seg+.5)+ring*17.+step(R*.76, length(fp-vec2(R*.76,0.))+R*.57)*5.;
    float hh=h11(id*3.7+1.);
    vec3 g=hh<.35? vec3(.78,.06,.12) : hh<.6? vec3(.42,.08,.58) : hh<.85? vec3(.1,.2,.62) : vec3(1.,.64,.16);
    g*=.55+.45*vn(p/9.+t*.05);
    g*=1.65-r/R*.6;
    vec3 win=g*1.45*(.85+.15*sin(t*.7+r*.02));
    win=mix(win, vec3(1.,.95,.9)*1.7, smoothstep(R*.19,R*.1,r));
    col=mix(col, win, 1.-smoothstep(R-1.,R+1.,r));
    col=mix(col, vec3(.016,0.,.006), line);
  }
  col+=vec3(.95,.2,.28)*exp(-max(r-R,0.)/80.)*.28*step(R,r);
  vec2 sv=p-c;
  if(sv.y>0.){ float w=R*.55+sv.y*.32;
    float sh=exp(-pow(sv.x/w,2.))*exp(-sv.y/900.);
    float rays=.5+.5*fbm3(vec2(atan(sv.x,sv.y)*14., t*.08));
    col+=vec3(.8,.18,.3)*sh*rays*.2; }
  float sm=fbm(vec2(p.x/300.+t*.03, p.y/80.-t*.02));
  col+=vec3(.28,.05,.09)*sm*smoothstep(650.,1000.,p.y)*.55;
  if(p.y>905.){
    vec2 q=vec2(p.x, 2.*905.-p.y);
    vec2 rv=q-c; float rr=length(rv);
    col+=vec3(.9,.3,.4)*exp(-max(rr-R,0.)/120.)*.12*exp(-(p.y-905.)/80.);
    col=mix(col, col*.6+vec3(.02,0.,.01), .5);
  }
  return col;
}
// ── 6 starry hill / dawn
vec3 scStars(vec2 p, float t){
  float dawn=uP0.x, close=uP0.y, aur=uP0.z;
  float y=p.y/1080.;
  vec2 sp=par(p,.12);
  vec3 col=mix(vec3(.008,.014,.042), vec3(.03,.075,.15), smoothstep(.05,.85,sp.y/1080.));
  vec2 mw=sp-vec2(980.,380.);
  float ca=cos(-.42), sa=sin(-.42);
  mw=vec2(ca*mw.x-sa*mw.y, sa*mw.x+ca*mw.y);
  float band=exp(-pow(mw.y/(150.+40.*sin(mw.x/400.)),2.));
  float cl=fbm(mw/170.+2.);
  float dust=smoothstep(.45,.7,fbm(mw/75.+9.));
  vec3 mwc=mix(vec3(.18,.22,.5), vec3(.62,.48,.68), fbm(mw/50.));
  col+=mwc*band*cl*1.05*(1.-.75*dust*band);
  col+=vec3(.9,.8,.7)*pow(band,3.)*cl*cl*.25;
  float sd=1.+band*1.6;
  vec3 st=stars(sp,19.,.26*sd,1.,t)+stars(sp+vec2(211.,77.),47.,.55,1.5,t)+stars(sp+vec2(93.,151.),9.,.12*sd,.45,t);
  col+=st*(1.-close*.6);
  for(int i=0;i<2;i++){
    float fi=float(i), ph=fi*3.14159;
    float yc=300.+70.*sin(sp.x/310.+t*.12+ph)+30.*sin(sp.x/130.-t*.2+ph*1.3);
    float dy=sp.y-yc;
    float curtain=exp(-max(dy,0.)/16.)*exp(-max(-dy,0.)/150.);
    float streak=.5+.5*fbm3(vec2(sp.x/22.+t*.3*(fi*2.-1.), t*.1+fi*5.));
    float fold=.6+.4*sin(sp.x/60.+t*.5+fi*2.);
    vec3 ac=i==0? vec3(.38,.58,1.) : vec3(.36,1.,.68);
    col+=ac*curtain*streak*fold*.4*aur;
  }
  for(int i=0;i<4;i++){
    vec4 m=uMet[i]; float age=t-m.z;
    if(age>0. && age<1.3){
      vec2 dir=vec2(cos(m.w),sin(m.w));
      vec2 head=m.xy+dir*age*950.;
      float len=260.*min(age*3.,1.);
      vec2 v=sp-head; float al=-dot(v,dir); float pe=abs(v.x*dir.y-v.y*dir.x);
      float tail=step(0.,al)*smoothstep(len,0.,al)*exp(-pe*pe/2.5);
      float life=smoothstep(1.3,.65,age);
      col+=vec3(.85,.93,1.)*(tail*.9+exp(-dot(v,v)/10.)*2.)*life;
    }
  }
  vec3 dc=mix(vec3(.16,.2,.44), vec3(.62,.42,.6), smoothstep(.1,.55,y));
  dc=mix(dc, vec3(1.,.62,.46), smoothstep(.5,.72,y));
  dc=mix(dc, vec3(1.,.87,.64), smoothstep(.68,.78,y));
  vec2 sun=uP1.xy; float sd2=length(p-sun);
  dc+=vec3(1.,.72,.45)*exp(-sd2/400.)*.6 + vec3(1.,.9,.72)*exp(-sd2/80.)*.8;
  float dcl=fbm(vec2(sp.x/520.+t*.006, sp.y/90.));
  dc=mix(dc, mix(vec3(.55,.36,.55), vec3(1.,.72,.55), exp(-abs(sp.x-sun.x)/600.)), smoothstep(.55,.8,dcl)*smoothstep(.15,.3,y)*smoothstep(.62,.42,y)*.8);
  dc=mix(dc, vec3(1.,.96,.86)*2.5, smoothstep(40.,36.,sd2));
  col=mix(col, dc+st*.04, smoothstep(0.,1.,dawn));
  vec2 m1=par(p,.3); float hm=790.+55.*ridge(m1.x/380.,21.);
  vec3 mc=mix(vec3(.02,.035,.075), vec3(.45,.3,.42), dawn);
  col=mix(col, mc, cover(m1.y-hm));
  col+=mix(vec3(.05,.12,.2), vec3(1.,.6,.42), dawn)*exp(-abs(p.y-790.)/70.)*.3;
  if(close>0.){
    vec3 bok=vec3(0.);
    for(int i=0;i<2;i++){
      float cs=i==0?150.:240.;
      vec2 bq=p+vec2(t*(8.+float(i)*5.), 0.);
      vec2 g=floor(bq/cs), f=fract(bq/cs);
      vec2 c=.25+.5*h22(g+float(i)*31.);
      float r=(.25+.2*h12(g+7.))*cs*.5;
      float dd=length((f-c)*cs);
      float disc=smoothstep(r,r*.8,dd)*(.5+.5*smoothstep(r*.4,r,dd));
      vec3 kc=mix(vec3(.4,.6,1.), vec3(.45,1.,.7), step(.5,h12(g+2.)));
      bok+=kc*disc*step(.55,h12(g+40.))*(.5+.5*sin(t*.8+h12(g)*30.));
    }
    col=mix(col, col*.5+bok*.25, close);
  }
  return col;
}
void main(){
  vec2 f=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y);
  vec2 p=(f-uView.xy)/uView.z;
  vec3 c;
  if(uScene==0) c=scPrologue(p,uT);
  else if(uScene==1) c=scDusk(p,uT);
  else if(uScene==2) c=scWalk(p,uT);
  else if(uScene==3) c=scStage(p,uT);
  else if(uScene==4) c=scRain(p,uT);
  else if(uScene==5) c=scMask(p,uT);
  else c=scStars(p,uT);
  o=vec4(c,1.);
}`;

// ---------------------------------------------------------------- 2D layer composite (rim light + reflection + emissive)
const FS_LAYER = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uL, uE; uniform vec2 uTx; uniform vec2 uLight;
uniform vec3 uAmb, uRim; uniform float uRimW, uOmni, uEmis, uReflY, uReflK, uRip, uT;
vec4 lit(vec2 uv){
  vec4 c=texture(uL,uv);
  if(c.a<.002) return vec4(0.);
  vec2 px=uv/uTx;
  vec2 dir=normalize(uLight-px+vec2(1e-3));
  float a1=texture(uL, uv+dir*uTx*uRimW).a, a2=texture(uL, uv+dir*uTx*uRimW*2.3).a;
  float dr=clamp(c.a-(a1*.6+a2*.4),0.,1.);
  float s=texture(uL,uv+vec2(uRimW,0.)*uTx).a+texture(uL,uv-vec2(uRimW,0.)*uTx).a+texture(uL,uv+vec2(0.,uRimW)*uTx).a+texture(uL,uv-vec2(0.,uRimW)*uTx).a;
  float om=clamp(c.a-s*.25,0.,1.);
  float rim=max(dr, om*uOmni);
  vec3 alb=c.rgb/c.a;
  float mx=max(max(alb.r,alb.g),max(alb.b,.05));
  vec3 tint=mix(vec3(1.), alb/mx, .55);
  float far=exp(-length(uLight-px)*uTx.y*.9);
  vec3 col=alb*uAmb*(1.+far*.25)+rim*uRim*tint*1.6;
  return vec4(col*c.a, c.a);
}
void main(){
  vec4 r=lit(vUv);
  vec2 px=vUv/uTx;
  if(uReflY>0. && px.y<uReflY){
    float dy=uReflY-px.y;
    vec2 ruv=vec2(px.x+sin(px.y*.21+uT*4.)*uRip, uReflY+dy*1.02)*uTx;
    vec4 rc=texture(uL, ruv);
    if(rc.a>.002){ vec3 alb=rc.rgb/rc.a; float k=uReflK*exp(-dy*uTx.y*5.);
      r=r+vec4(alb*uAmb*.8*rc.a*k, rc.a*k)*(1.-r.a); }
  }
  if(uEmis>0.){ vec4 e=texture(uE,vUv); r.rgb+=e.rgb*uEmis;
    if(uReflY>0. && px.y<uReflY){ float dy=uReflY-px.y; vec4 re=texture(uE, vec2(px.x, uReflY+dy)*uTx); r.rgb+=re.rgb*uEmis*uReflK*.5*exp(-dy*uTx.y*5.); } }
  o=r;
}`;

// ---------------------------------------------------------------- particles (GPU-driven)
const VS_PART = `#version 300 es
precision highp float;
in vec2 aQ; in vec4 aS;
uniform vec2 uRes; uniform vec3 uView; uniform vec3 uCam; uniform float uT; uniform int uType; uniform vec4 uP, uP2; uniform vec4 uVis;
out vec2 vQ; out vec4 vC; flat out int vK;
vec2 toClip(vec2 d){ vec2 px=d*uView.z+uView.xy; return vec2(px.x/uRes.x*2.-1., 1.-px.y/uRes.y*2.); }
vec2 camT(vec2 w){ return (w-uCam.xy)*uCam.z+vec2(960.,540.); }
void main(){
  vec4 s=aS; float t=uT;
  float W=uVis.z-uVis.x+120., H=uVis.w-uVis.y+120.;
  vec2 pos=vec2(0.); vec2 sz=vec2(4.); float rot=0.; vec4 col=vec4(1.); int k=0;
  if(uType==0){ // warm dust motes
    pos=vec2(uVis.x-60.+mod(s.x*W+t*(8.+14.*s.z)+30.*sin(t*.3+s.w*6.28), W), uVis.y-60.+mod(s.y*H-t*(5.+10.*s.w), H));
    sz=vec2(1.5+4.*s.z*s.z); col=vec4(1.,.82,.58, (.25+.5*s.w)*(.5+.5*sin(t*(1.+s.x*2.)+s.y*20.))*uP.x);
  } else if(uType==1){ // fireflies
    vec2 base=mix(uP2.xy, uP2.zw, s.xy);
    pos=camT(base+vec2(55.*sin(t*.23*(1.+s.z)+s.w*30.), 32.*sin(t*.31*(1.+s.w)+s.z*20.)));
    float bl=pow(.5+.5*sin(t*(.8+1.2*s.z)+s.x*40.),3.);
    sz=vec2(4.+6.*s.z)*uCam.z;
    vec3 c=uP.y<.5? mix(vec3(.82,1.,.45), vec3(1.,.9,.5), s.w) : (s.w<.5? vec3(.55,.72,1.) : vec3(.55,1.,.75));
    col=vec4(c, bl*uP.x);
  } else if(uType==2 || uType==4){ // petals (sakura / rose)
    float fall=uType==2? 45.+55.*s.y : 32.+40.*s.y;
    float y=uVis.y-60.+mod(s.y*H*1.3+t*fall, H);
    float x=uVis.x-60.+mod(s.x*W+t*uP.y+50.*sin(t*.7+s.w*6.28)-(uCam.x-960.)*uP.z*(.6+.6*s.z), W);
    pos=vec2(x,y);
    float base=uType==2? 6.+7.*s.z : 9.+9.*s.z;
    sz=vec2(base*(.25+.75*abs(cos(t*(1.3+s.x*2.)+s.y*9.))), base)*uP.w;
    rot=t*(.6+s.z)+s.w*6.28;
    vec3 c=uType==2? mix(vec3(1.,.7,.8), vec3(1.,.88,.92), s.x) : mix(vec3(.5,.02,.08), vec3(.85,.12,.2), s.x);
    col=vec4(c, (.7+.3*s.w)*uP.x); k=1;
  } else if(uType==3){ // rain streaks
    float sp=1300.+900.*s.z;
    pos=vec2(uVis.x-60.+mod(s.x*W+t*uP.y, W), uVis.y-60.+mod(s.y*H+t*sp, H));
    sz=vec2(.7+1.1*s.z, 14.+34.*s.z);
    rot=atan(uP.y, sp);
    float ld=length(pos-uP2.xy);
    vec3 c=vec3(.62,.72,.95)+vec3(1.,.8,.5)*exp(-ld/230.)*2.2;
    col=vec4(c, (.1+.24*s.z)*uP.x); k=2;
  } else if(uType==5){ // penlights
    float row=floor(s.y*3.);
    vec2 piv=vec2(uVis.x+s.x*(W-120.), 1000.+row*34.+s.z*14.);
    float a=sin(uP.y*3.14159+s.z*1.4+row)*.55;
    pos=piv+vec2(sin(a),-cos(a))*22.;
    sz=vec2(3.6, 22.); rot=-a;
    vec3 c=s.w<.3? vec3(.45,.65,1.) : s.w<.6? vec3(.45,1.,.7) : s.w<.85? vec3(1.,.5,.8) : vec3(1.,.95,.85);
    col=vec4(c*1.4, uP.x*(.6+.4*s.y)); k=2;
  } else if(uType==6){ // shards
    float age=t-uP.y;
    float ang=s.x*6.2832, spd=220.+780.*s.y;
    vec2 w=uP2.xy+vec2(cos(ang),sin(ang))*spd*age*(1.-.22*age)+vec2(0.,160.*age*age);
    pos=camT(w);
    sz=vec2(5.+16.*s.z)*uCam.z*(age>0.?1.:0.);
    rot=s.z*6.28+age*(s.w-.5)*14.;
    col=vec4(mix(vec3(1.,.95,.9), vec3(1.,.8,.55), s.w), clamp(1.-age/2.4,0.,1.)*uP.x); k=3;
  } else if(uType==7){ // rising motes
    float ph=fract(t*.065*(1.+s.z)+s.y);
    vec2 w=vec2(mix(uP2.x,uP2.z,s.x)+42.*sin(ph*12.+s.w*6.28), uP2.w-ph*720.);
    pos=camT(w);
    sz=vec2(3.+5.*s.z)*uCam.z;
    col=vec4(s.w<.5? vec3(.55,.72,1.) : vec3(.55,1.,.76), sin(ph*3.14159)*uP.x);
  }
  vec2 q=aQ*sz; float cr=cos(rot), sr=sin(rot); q=vec2(cr*q.x-sr*q.y, sr*q.x+cr*q.y);
  gl_Position=vec4(toClip(pos+q),0.,1.);
  vQ=aQ; vC=col; vK=k;
}`;
const FS_PART = `#version 300 es
precision highp float;
in vec2 vQ; in vec4 vC; flat in int vK; out vec4 o;
void main(){
  if(vK==0){ float d=length(vQ); float a=exp(-d*d*4.)*smoothstep(1.,.5,d); o=vec4(vC.rgb*a*vC.a, 0.); }
  else if(vK==1){ vec2 q=vQ; q.y+=.12; float d=length(q*vec2(1.,.8));
    float notch=length(vec2(q.x*1.5, q.y-1.));
    float sh=smoothstep(1.,.82,d)*smoothstep(.12,.32,notch);
    vec3 c=mix(vC.rgb, vec3(1.), smoothstep(.85,0.,d)*.3);
    o=vec4(c*sh*vC.a, sh*vC.a); }
  else if(vK==2){ float a=smoothstep(1.,0.,abs(vQ.x))*smoothstep(1.,.3,abs(vQ.y)); o=vec4(vC.rgb*a*vC.a, 0.); }
  else { vec2 q=vQ; float d=max(abs(q.x)*1.6+q.y*.9, -q.y)-.55; float a=smoothstep(.06,-.04,d);
    o=vec4(vC.rgb*a*vC.a, a*vC.a*.85); }
}`;

// ---------------------------------------------------------------- flares (CPU-listed sprites)
const VS_FLARE = `#version 300 es
precision highp float;
in vec2 aQ; in vec4 aA; in vec4 aB;
uniform vec2 uRes; uniform vec3 uView;
out vec2 vQ; out vec4 vC; flat out int vK;
void main(){
  vec2 sz=vec2(aA.z); int k=int(aB.w+.5); if(k==2) sz.x*=5.;
  vec2 d=aA.xy+aQ*sz; vec2 px=d*uView.z+uView.xy;
  gl_Position=vec4(px.x/uRes.x*2.-1., 1.-px.y/uRes.y*2., 0., 1.);
  vQ=aQ; vC=vec4(aB.rgb, aA.w); vK=k;
}`;
const FS_FLARE = `#version 300 es
precision highp float;
in vec2 vQ; in vec4 vC; flat in int vK; out vec4 o;
void main(){
  float d=length(vQ); float g;
  if(vK==2) g=exp(-abs(vQ.y)*22.)*exp(-abs(vQ.x)*2.2)*.8 + exp(-d*d*18.)*.6;
  else { g=exp(-d*d*6.)*.85+exp(-d*3.)*.22;
    if(vK==1) g+=(exp(-abs(vQ.x)*55.)*exp(-abs(vQ.y)*2.4)+exp(-abs(vQ.y)*55.)*exp(-abs(vQ.x)*2.4))*.55; }
  g*=smoothstep(1.,.8,max(abs(vQ.x),abs(vQ.y)));
  o=vec4(vC.rgb*g*vC.a, 0.);
}`;

// ---------------------------------------------------------------- dissolve between two scenes
const FS_MIX = GLSL_COMMON + `
in vec2 vUv; out vec4 o;
uniform sampler2D uA, uB; uniform float uK; uniform vec3 uEdge;
void main(){
  vec3 a=texture(uA,vUv).rgb, b=texture(uB,vUv).rgb;
  float n=fbm(vUv*vec2(uRes.x/uRes.y,1.)*2.6)*.8+(1.-vUv.y)*.2;
  float th=uK*1.3-.15;
  float m=smoothstep(th-.05, th+.05, n);
  vec3 c=mix(b,a,m);
  c+=uEdge*exp(-abs(n-th)*38.)*(1.-abs(uK*2.-1.))*1.2;
  o=vec4(c,1.);
}`;

const FS_BRIGHT = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uS; uniform float uTh;
void main(){ vec3 c=texture(uS,vUv).rgb; float l=max(c.r,max(c.g,c.b)); o=vec4(c*smoothstep(uTh,uTh+.55,l),1.); }`;
const FS_BLUR = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uS; uniform vec2 uD;
void main(){ vec3 s=texture(uS,vUv).rgb*.227027;
  s+=(texture(uS,vUv+uD*1.3846).rgb+texture(uS,vUv-uD*1.3846).rgb)*.3162162;
  s+=(texture(uS,vUv+uD*3.2308).rgb+texture(uS,vUv-uD*3.2308).rgb)*.0702703; o=vec4(s,1.); }`;

const FS_FINAL = GLSL_COMMON + `
in vec2 vUv; out vec4 o;
uniform sampler2D uS, uB1, uB2;
uniform float uT, uBloom, uExpo, uSat, uGamma, uVig, uGrain, uFadeB, uFadeW, uCA, uLens, uLeak, uBox;
uniform vec3 uLift, uGain;
float drops(vec2 uv, float t){
  vec2 g=uv*vec2(26.,14.); vec2 id=floor(g); vec2 f=fract(g)-.5;
  vec3 n=h32(id);
  vec2 c=(n.xy-.5)*.6; float r=.16+.18*n.z;
  float life=fract(t*.07+n.z*7.);
  float d=length((f-c)*vec2(1.,1.15));
  float s=smoothstep(r,r*.3,d)*smoothstep(0.,.1,life)*smoothstep(1.,.7,life)*step(.45,n.x);
  vec2 g2=uv*vec2(9.,1.); float col=floor(g2.x); vec3 m=h32(vec2(col,3.));
  float y=fract(-t*(.06+.08*m.x)+m.y);
  vec2 f2=vec2(fract(g2.x)-.5-(m.z-.5)*.5, (uv.y-y)*9.);
  float slide=smoothstep(.22,.05,length(f2*vec2(1.,1.4)))*step(.6,m.z);
  float trail=smoothstep(.06,.0,abs(f2.x))*smoothstep(0.,1.5,f2.y)*smoothstep(5.,1.5,f2.y)*step(.6,m.z)*.35;
  return max(s, max(slide, trail));
}
vec3 tm(vec3 c){ float m=max(c.r,max(c.g,c.b)); if(m>.78){ float k=.78+.22*(1.-exp(-(m-.78)/.22)); c*=k/m; c=mix(c, vec3(k), smoothstep(1.2,3.5,m)*.5);} return c; }
void main(){
  vec2 uv=vUv;
  float asp=uRes.x/uRes.y;
  if(uLens>0.){ vec2 lu=vec2(uv.x*asp, uv.y)*1.;
    float e=.0025; float h=drops(lu,uT);
    vec2 nrm=vec2(drops(lu+vec2(e,0.),uT)-h, drops(lu+vec2(0.,e),uT)-h);
    uv+=nrm*uLens*6.; }
  vec3 c;
  if(uCA>0.){ vec2 dc=(uv-.5)*uCA; c=vec3(texture(uS,uv+dc).r, texture(uS,uv).g, texture(uS,uv-dc).b); }
  else c=texture(uS,uv).rgb;
  c+=(texture(uB1,uv).rgb*.65+texture(uB2,uv).rgb*.9)*uBloom;
  c*=uExpo;
  c=tm(c);
  c=pow(max(c,0.), vec3(uGamma))*uGain+uLift*(1.-c);
  float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l), c, uSat);
  vec2 vq=(vUv-.5)*vec2(asp*.75,1.);
  c*=mix(1., smoothstep(1.05,.2,length(vq)), uVig);
  if(uLeak>0.){ float lk=fbm3(vec2(vUv.x*1.4+uT*.035, vUv.y*1.1-uT*.02));
    float edge=pow(abs(vUv.x-.5)*2.,2.2);
    c+=vec3(1.,.48,.22)*pow(lk,2.5)*edge*uLeak*.55+vec3(1.,.4,.55)*pow(fbm3(vUv*2.+uT*.05+9.),3.)*uLeak*.08; }
  c+=(h12(gl_FragCoord.xy+fract(uT*7.13)*511.)-.5)*uGrain;
  c=mix(c, vec3(0.), uFadeB); c=mix(c, vec3(1.), uFadeW);
  vec2 f=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y); float dy=(f.y-uView.y)/uView.z;
  float bar=100.*uBox; float b=smoothstep(bar-1.2/uView.z, bar, dy)*smoothstep(1080.-bar+1.2/uView.z, 1080.-bar, dy);
  c*=b;
  c+=(h12(gl_FragCoord.xy*1.37)-.5)/255.;
  o=vec4(clamp(c,0.,1.),1.);
}`;

// ---------------------------------------------------------------- GL helper
class Renderer {
  constructor(canvas, test) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: !!test, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2');
    this.gl = gl; this.canvas = canvas;
    this.half = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    const tri = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.fsVao = gl.createVertexArray(); gl.bindVertexArray(this.fsVao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const P = (vs, fs, attrs) => this.prog(vs, fs, attrs);
    this.pBg = P(VS_FS, FS_BG, ['aP']); this.pLayer = P(VS_FS, FS_LAYER, ['aP']); this.pMix = P(VS_FS, FS_MIX, ['aP']);
    this.pBright = P(VS_FS, FS_BRIGHT, ['aP']); this.pBlur = P(VS_FS, FS_BLUR, ['aP']); this.pFinal = P(VS_FS, FS_FINAL, ['aP']);
    this.pPart = P(VS_PART, FS_PART, ['aQ', 'aS']); this.pFlare = P(VS_FLARE, FS_FLARE, ['aQ', 'aA', 'aB']);
    // quad + instance data
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const N = 3000, seeds = new Float32Array(N * 4); const r = mulberry32(99); for (let i = 0; i < N * 4; i++) seeds[i] = r();
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    this.partVao = gl.createVertexArray(); gl.bindVertexArray(this.partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(1, 1);
    this.flareData = new Float32Array(256 * 8);
    this.flareBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.flareBuf); gl.bufferData(gl.ARRAY_BUFFER, this.flareData.byteLength, gl.DYNAMIC_DRAW);
    this.flareVao = gl.createVertexArray(); gl.bindVertexArray(this.flareVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.flareBuf);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    this.texL = this.tex(); this.texE = this.tex();
    this.W = 0; this.H = 0;
  }
  prog(vs, fs, attrs) {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(log, src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n')); throw new Error('shader: ' + log); } return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    p.loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); p.loc[info.name.replace(/\[0\]$/, '')] = { l: gl.getUniformLocation(p, info.name), type: info.type }; }
    return p;
  }
  tex() { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  rt(w, h) {
    const gl = this.gl, t = this.tex();
    if (this.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && this.half) { this.half = false; gl.deleteFramebuffer(fb); gl.deleteTexture(t); return this.rt(w, h); }
    return { fb, t, w, h };
  }
  resize(W, H) {
    if (W === this.W && H === this.H) return;
    const gl = this.gl; this.W = W; this.H = H; this.canvas.width = W; this.canvas.height = H;
    for (const k of ['A', 'B', 'M', 'h', 'q1', 'q2', 'e1', 'e2']) if (this[k]) { gl.deleteFramebuffer(this[k].fb); gl.deleteTexture(this[k].t); }
    this.A = this.rt(W, H); this.B = this.rt(W, H); this.M = this.rt(W, H);
    const h = [Math.max(1, W >> 1), Math.max(1, H >> 1)], q = [Math.max(1, W >> 2), Math.max(1, H >> 2)], e = [Math.max(1, W >> 3), Math.max(1, H >> 3)];
    this.h = this.rt(...h); this.q1 = this.rt(...q); this.q2 = this.rt(...q); this.e1 = this.rt(...e); this.e2 = this.rt(...e);
  }
  use(p, u) {
    const gl = this.gl; gl.useProgram(p); let unit = 0;
    for (const k in u) {
      const L = p.loc[k]; if (!L) continue; const v = u[k];
      if (v && v.tex !== undefined) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(L.l, unit++); continue; }
      switch (L.type) {
        case gl.FLOAT: gl.uniform1f(L.l, v); break;
        case gl.INT: gl.uniform1i(L.l, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(L.l, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(L.l, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(L.l, v.length % 4 ? [...v, 0, 0, 0].slice(0, 4) : v); break;
      }
    }
  }
  target(rt) { const gl = this.gl; if (rt) { gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb); gl.viewport(0, 0, rt.w, rt.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); } }
  fs() { const gl = this.gl; gl.bindVertexArray(this.fsVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  upload(t, canvas) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
  blend(mode) { const gl = this.gl; if (!mode) { gl.disable(gl.BLEND); return; } gl.enable(gl.BLEND); if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
  particles(common, list) {
    const gl = this.gl; gl.useProgram(this.pPart); gl.bindVertexArray(this.partVao);
    for (const p of list) {
      if (!p.n || (p.p && p.p[0] <= 0)) continue;
      this.use(this.pPart, Object.assign({}, common, { uType: p.type, uP: p.p || [1, 0, 0, 1], uP2: p.p2 || [0, 0, 0, 0] }));
      this.blend(p.type === 2 || p.type === 4 || p.type === 6 ? 'over' : 'add');
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.min(3000, p.n));
    }
  }
  flares(common, list) {
    if (!list.length) return; const gl = this.gl, d = this.flareData; const n = Math.min(256, list.length);
    for (let i = 0; i < n; i++) { const f = list[i]; d.set([f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7] || 0], i * 8); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.flareBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, n * 8));
    this.use(this.pFlare, common); this.blend('add'); gl.bindVertexArray(this.flareVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  }
}
