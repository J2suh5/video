// 极简 WebGL2 引擎：着色器程序、帧缓冲、纹理、全屏/实例化绘制
window.SM = window.SM || {};
(function () {
  function Engine(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('当前浏览器不支持 WebGL2');
    this.gl = gl;
    this.canvas = canvas;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    // 单位四边形（三角带），供精灵与实例化粒子共用
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // 全屏三角形不需要顶点缓冲（用 gl_VertexID）
    this.emptyVAO = gl.createVertexArray();
    gl.bindVertexArray(null);
  }

  Engine.prototype.program = function (vs, fs, name) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
        console.error(name, log, lines);
        throw new Error('Shader compile error in ' + name + ': ' + log);
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aCorner');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error in ' + name + ': ' + gl.getProgramInfoLog(p));
    const uni = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const key = info.name.replace(/\[0\]$/, '');
      uni[key] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
    }
    return new Program(gl, p, uni, name);
  };

  function Program(gl, p, uni, name) {
    this.gl = gl;
    this.p = p;
    this.uni = uni;
    this.name = name;
    this.unit = 0;
  }
  Program.prototype.use = function () {
    this.gl.useProgram(this.p);
    this.unit = 0;
    return this;
  };
  Program.prototype.set = function (name, v) {
    const u = this.uni[name];
    if (!u) return this;
    const gl = this.gl, L = u.loc;
    switch (u.type) {
      case gl.FLOAT: u.size > 1 ? gl.uniform1fv(L, v) : gl.uniform1f(L, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(L, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(L, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(L, v); break;
      case gl.INT: case gl.BOOL: u.size > 1 ? gl.uniform1iv(L, v) : gl.uniform1i(L, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(L, false, v); break;
      case gl.SAMPLER_2D: {
        const unit = this.unit++;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v && v.tex ? v.tex : v);
        gl.uniform1i(L, unit);
        break;
      }
      default: console.warn('unknown uniform type', name);
    }
    return this;
  };
  Program.prototype.setAll = function (obj) {
    for (const k in obj) this.set(k, obj[k]);
    return this;
  };

  Engine.prototype.target = function (w, h, hdr = true) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const useHdr = hdr && this.hdr;
    gl.texImage2D(gl.TEXTURE_2D, 0, useHdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, useHdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  };

  Engine.prototype.bind = function (t) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, t ? t.w : this.canvas.width, t ? t.h : this.canvas.height);
  };

  Engine.prototype.clear = function (r = 0, g = 0, b = 0, a = 1) {
    const gl = this.gl;
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  // 0: 不混合  1: 预乘 alpha  2: 叠加
  Engine.prototype.blend = function (mode) {
    const gl = this.gl;
    if (!mode) { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND);
    if (mode === 1) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE);
  };

  Engine.prototype.fullscreen = function () {
    const gl = this.gl;
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  Engine.prototype.quad = function (instances = 0) {
    const gl = this.gl;
    gl.bindVertexArray(this.quadVAO);
    if (instances > 0) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instances);
    else gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // 从 Canvas2D 上传 / 更新纹理
  Engine.prototype.canvasTexture = function (cv, existing) {
    const gl = this.gl;
    const tex = existing || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (!existing) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    return tex;
  };

  SM.Engine = Engine;
})();
