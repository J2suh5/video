// 通用数学与缓动函数
window.SM = window.SM || {};
(function () {
  const U = {};
  U.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  U.mix = (a, b, t) => a + (b - a) * t;
  U.smooth = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  U.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.easeOut = (t) => 1 - Math.pow(1 - U.clamp(t), 3);
  U.easeIn = (t) => Math.pow(U.clamp(t), 3);
  // 区间淡入淡出：在 [a,b] 内为 1，两端各用 f 秒过渡
  U.window = (t, a, b, fi = 0.8, fo = 0.8) => U.smooth(a, a + fi, t) * (1 - U.smooth(b - fo, b, t));
  U.mulberry32 = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // 关键帧插值: keys = [[t, v], ...]，v 为数字或数组
  U.keys = (keys, t, ease = U.easeInOut) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t < t1) {
        const k = ease((t - t0) / (t1 - t0));
        if (Array.isArray(v0)) return v0.map((x, j) => U.mix(x, v1[j], k));
        return U.mix(v0, v1, k);
      }
    }
    return keys[keys.length - 1][1];
  };
  U.hex = (h, s = 1) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255 * s, ((n >> 8) & 255) / 255 * s, (n & 255) / 255 * s];
  };
  SM.U = U;
})();
