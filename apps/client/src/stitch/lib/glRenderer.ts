/**
 * SharedThreadRenderer, ONE WebGL context for every stitch surface.
 *
 * The context lives on a detached canvas that never enters the layout.
 * Each surface (playground stage, footer logo, future hero boxes) is a
 * plain 2D canvas in normal document flow; per frame the shared context
 * renders that surface's threads into a sub-rect of its drawbuffer
 * (viewport + scissor) and the pixels are blitted across with
 * `drawImage`; GPU-side on modern browsers, and synchronous, so no
 * `preserveDrawingBuffer` is needed. The drawbuffer only ever grows to
 * the largest registered surface; it is never resized per frame.
 *
 * Thread shading is mostly unchanged from the original per-surface
 * renderer: each leg is one instance of a (TESS+1)×2 triangle strip
 * extruded along its quadratic bezier in the vertex shader; the fragment
 * shader shades a rounded cross-section with material sheen, twisted-ply
 * banding, fiber noise and rim darkening (which also anti-aliases the
 * edge; the context itself runs with MSAA off). Every surface now
 * renders in two instanced draw calls per frame instead of one: a
 * `uShadow`-toggled cast-shadow pass first (same buffers, offset toward
 * a fixed light direction and widened per-leg via `aWidth`, with a
 * softer alpha falloff standing in for blur) so raised satin/running
 * stitches read as sitting proud of the cloth, then the normal thread
 * pass on top. Both passes reuse one draw call each; cost is one extra
 * instanced draw per surface per frame, not per leg.
 *
 * Per-surface instance data is split into two buffers:
 * - static  (endpoints, color, width, material), re-uploaded only when
 *   the owning engine's `legsRev` changes;
 * - dynamic (bezier control point, progress, reverse), uploaded on
 *   every rendered frame, which the runtime only produces while the
 *   surface is visible and animating.
 */

import type { EngineLeg } from './engine';

const TESS = 24;
const VERTS = (TESS + 1) * 2;
/** p0(2) p1(2) color(3) width(1) mat(4) mat2(4) */
const STATIC_FLOATS = 16;
/** ctrl(2) progress(1) reverse(1) */
const DYN_FLOATS = 4;

/** retina cap; thread AA lives in the shader, full 3× DPR is wasted heat */
export const MAX_STITCH_DPR = 2;

const VSRC = `
precision highp float;
attribute float aSeg;
attribute float aSide;
attribute vec2 aP0;
attribute vec2 aP1;
attribute vec2 aCtrl;
attribute vec3 aColor;
attribute float aWidth;
attribute float aProgress;
attribute float aReverse;
attribute vec4 aMat;       // sheen, sheenW, ply, plyFreq
attribute vec4 aMat2;      // edge, tintR, tintG, tintB
uniform vec2 uRes;
uniform float uShadow;      // 0 = thread pass, 1 = cast-shadow pass
uniform vec2 uShadowDir;    // normalized light-relative offset direction
uniform float uShadowOffset; // offset distance, in units of aWidth
uniform float uShadowSpread; // half-width multiplier for the shadow silhouette
varying vec3 vColor;
varying float vSide;
varying float vAlong;
varying float vLen;
varying vec4 vMat;
varying vec4 vMat2;
varying float vShadow;
vec2 qbez(float t, vec2 p0, vec2 c, vec2 p1){
  float u=1.0-t; return u*u*p0 + 2.0*u*t*c + t*t*p1;
}
void main(){
  float prog = clamp(aProgress,0.0,1.0);
  float t = aSeg * prog;
  float tt = (aReverse>0.5) ? (1.0 - aSeg*prog) : t;
  vec2 p0=aP0, p1=aP1, c=aCtrl;
  vec2 pos = qbez(tt, p0,c,p1);
  float dt=0.01;
  vec2 pa = qbez(clamp(tt-dt,0.0,1.0), p0,c,p1);
  vec2 pb = qbez(clamp(tt+dt,0.0,1.0), p0,c,p1);
  vec2 dir = normalize(pb-pa + vec2(0.0001,0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  float taper = smoothstep(0.0,0.10,aSeg) * (1.0 - smoothstep(0.90,1.0,aSeg));
  float halfW = (aWidth*0.5) * mix(0.72,1.0,taper);
  bool shadow = uShadow > 0.5;
  if(shadow) halfW *= uShadowSpread;
  pos += nrm * aSide * halfW;
  if(shadow) pos += uShadowDir * aWidth * uShadowOffset;
  vec2 clip = (pos/uRes)*2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip,0.0,1.0);
  vColor=aColor; vSide=aSide;
  vAlong = aSeg;
  vLen = length(p1-p0);
  vMat = aMat; vMat2 = aMat2;
  vShadow = uShadow;
}`;

const FSRC = `
precision highp float;
varying vec3 vColor;
varying float vSide;
varying float vAlong;
varying float vLen;
varying vec4 vMat;
varying vec4 vMat2;
varying float vShadow;
void main(){
  float s=abs(vSide);
  if(vShadow > 0.5){
    // soft cast-shadow silhouette; wider, blur-like falloff standing in
    // for a gaussian blur the shared context can't afford per-thread.
    // Two-zone falloff: a darker, tighter core reads as contact shadow
    // where the stitch meets the cloth right underneath it, softening
    // out to a lighter penumbra at the silhouette's edge.
    float core = (1.0 - smoothstep(0.0, 0.55, s)) * 0.5;
    float penumbra = (1.0 - smoothstep(0.15, 1.0, s)) * 0.4;
    float shAlpha = max(core, penumbra);
    gl_FragColor = vec4(0.07, 0.045, 0.03, shAlpha);
    return;
  }
  float sheenAmt = vMat.x, sheenW = vMat.y, plyAmt = vMat.z, plyFreq = vMat.w;
  float edgeDark = vMat2.x;
  vec3  tint = vMat2.yzw;
  float lift = sqrt(max(0.0,1.0 - s*s));
  vec3 edge  = vColor*edgeDark;
  vec3 body  = vColor;
  // Highlight = lighter shade of the thread color (not chalk white)
  float liftAmt = sheenAmt * 0.34;
  vec3 pale = vColor + (vec3(1.0) - vColor) * liftAmt;
  vec3 sheenCol = mix(min(vec3(1.0), vColor * (1.0 + sheenAmt * 0.65)), pale, 0.4);
  // Metallic keeps a cool bias; still rooted in the base hue
  if(dot(tint,tint) > 0.001) sheenCol *= mix(vec3(1.0), tint, 0.4);
  vec3 col = mix(edge, body, smoothstep(0.0,0.55,lift));
  float sheenBand = sheenW * 0.7;
  col = mix(col, sheenCol, smoothstep(1.0-sheenBand, 1.0, lift));
  float twists = max(3.0, vLen*plyFreq);
  float ply = sin((vAlong*twists + vSide*0.9) * 6.2831853);
  col *= 1.0 + ply*0.12*plyAmt;
  float fibre = sin(vAlong*twists*6.0 + vSide*8.0);
  col += fibre * 0.02 * plyAmt * vColor;
  // occlusion: legs sitting deeper in a stack (dimmed via lift) read as
  // recessed; darken their body slightly so raised top-layer stitches
  // read as sitting proud of the cloth, not just differently tinted.
  // edgeDark == 1 means "true color" (no edge shading requested): skip the
  // rim occlusion too so dense fills keep their exact colors.
  float occAmt = edgeDark > 0.995 ? 0.0 : 0.25;
  col *= 1.0 - smoothstep(0.78,1.0,s)*occAmt;
  float alpha = 1.0 - smoothstep(0.90,1.0,s);
  gl_FragColor = vec4(clamp(col,0.0,1.0), alpha);
}`;

interface GLLocs {
  aSeg: number;
  aSide: number;
  aP0: number;
  aP1: number;
  aCtrl: number;
  aColor: number;
  aWidth: number;
  aProgress: number;
  aReverse: number;
  aMat: number;
  aMat2: number;
  uRes: WebGLUniformLocation | null;
  uShadow: WebGLUniformLocation | null;
  uShadowDir: WebGLUniformLocation | null;
  uShadowOffset: WebGLUniformLocation | null;
  uShadowSpread: WebGLUniformLocation | null;
}

interface ClientBuffers {
  staticBuf: WebGLBuffer;
  dynBuf: WebGLBuffer;
  /** allocated capacities in floats */
  staticCap: number;
  dynCap: number;
  /** engine legsRev signature the static buffer was built from */
  rev: string;
  count: number;
  dynData: Float32Array;
}

export class SharedThreadRenderer {
  failed = false;
  /** notified after a context-loss rebuild so surfaces can repaint */
  onRestored: (() => void) | null = null;

  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private ext: ANGLE_instanced_arrays | null = null;
  private prog: WebGLProgram | null = null;
  private loc: GLLocs | null = null;
  private geoBuf: WebGLBuffer | null = null;
  private clients = new Map<string, ClientBuffers>();
  private ready = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
    const gl = this.canvas.getContext('webgl', {
      antialias: false,
      premultipliedAlpha: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    if (!gl) {
      this.failed = true;
      return;
    }
    this.gl = gl;
    this.ext = gl.getExtension('ANGLE_instanced_arrays');
    if (!this.ext) {
      this.failed = true;
      return;
    }
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ready = false;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      // all GPU objects died with the context; rebuild the program and
      // drop client buffers; rev mismatch re-uploads them on next render
      this.clients.clear();
      this.build();
      this.onRestored?.();
    });
    this.build();
  }

  private compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      // eslint-disable-next-line no-console -- shader compile failure is a rare WebGL debug signal
      console.warn(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  private build() {
    const gl = this.gl;
    if (!gl) return;
    const vs = this.compile(gl.VERTEX_SHADER, VSRC);
    const fs = this.compile(gl.FRAGMENT_SHADER, FSRC);
    if (!vs || !fs) {
      this.failed = true;
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      // eslint-disable-next-line no-console -- program link failure is a rare WebGL debug signal
      console.warn(gl.getProgramInfoLog(prog));
      this.failed = true;
      return;
    }
    gl.useProgram(prog);
    this.prog = prog;

    const geo: number[] = [];
    for (let i = 0; i <= TESS; i++) {
      const s = i / TESS;
      geo.push(s, -1, s, 1);
    }
    this.geoBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.geoBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo), gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.loc = {
      aSeg: gl.getAttribLocation(prog, 'aSeg'),
      aSide: gl.getAttribLocation(prog, 'aSide'),
      aP0: gl.getAttribLocation(prog, 'aP0'),
      aP1: gl.getAttribLocation(prog, 'aP1'),
      aCtrl: gl.getAttribLocation(prog, 'aCtrl'),
      aColor: gl.getAttribLocation(prog, 'aColor'),
      aWidth: gl.getAttribLocation(prog, 'aWidth'),
      aProgress: gl.getAttribLocation(prog, 'aProgress'),
      aReverse: gl.getAttribLocation(prog, 'aReverse'),
      aMat: gl.getAttribLocation(prog, 'aMat'),
      aMat2: gl.getAttribLocation(prog, 'aMat2'),
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uShadow: gl.getUniformLocation(prog, 'uShadow'),
      uShadowDir: gl.getUniformLocation(prog, 'uShadowDir'),
      uShadowOffset: gl.getUniformLocation(prog, 'uShadowOffset'),
      uShadowSpread: gl.getUniformLocation(prog, 'uShadowSpread'),
    };
    this.ready = true;
  }

  /** grow-only drawbuffer; sized by the largest surface ever rendered */
  private ensureSize(w: number, h: number) {
    if (this.canvas.width < w) this.canvas.width = w;
    if (this.canvas.height < h) this.canvas.height = h;
  }

  private clientFor(id: string, n: number, rev: string, legs: EngineLeg[]): ClientBuffers | null {
    const gl = this.gl!;
    let cb = this.clients.get(id);
    if (!cb) {
      const staticBuf = gl.createBuffer();
      const dynBuf = gl.createBuffer();
      if (!staticBuf || !dynBuf) return null;
      cb = {
        staticBuf,
        dynBuf,
        staticCap: 0,
        dynCap: 0,
        rev: '',
        count: 0,
        dynData: new Float32Array(0),
      };
      this.clients.set(id, cb);
    }
    if (cb.rev !== rev || cb.count !== n) {
      const data = new Float32Array(n * STATIC_FLOATS);
      let o = 0;
      for (const lg of legs) {
        const mat = lg.material;
        const tint = mat.tint ?? [0, 0, 0];
        // dim overlap-layer legs toward a lighter base shade (not chalk white)
        const dim = lg.opacity < 1 ? 1 - lg.opacity * 0.9 : 0;
        const lift = dim * 0.28;
        data[o++] = lg.a[0];
        data[o++] = lg.a[1];
        data[o++] = lg.b[0];
        data[o++] = lg.b[1];
        data[o++] = lg.rgb[0] + (1 - lg.rgb[0]) * lift;
        data[o++] = lg.rgb[1] + (1 - lg.rgb[1]) * lift;
        data[o++] = lg.rgb[2] + (1 - lg.rgb[2]) * lift;
        data[o++] = lg.width;
        data[o++] = mat.sheen;
        data[o++] = mat.sheenW;
        data[o++] = mat.ply;
        data[o++] = mat.plyFreq;
        data[o++] = mat.edge;
        data[o++] = tint[0];
        data[o++] = tint[1];
        data[o++] = tint[2];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, cb.staticBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      cb.staticCap = data.length;
      cb.rev = rev;
      cb.count = n;
      if (cb.dynData.length < n * DYN_FLOATS) {
        cb.dynData = new Float32Array(n * DYN_FLOATS);
      }
    }
    return cb;
  }

  /**
   * Render one surface's legs into the shared drawbuffer and blit them
   * into that surface's own 2D canvas.
   *
   * @param id      stable surface id; keys the per-surface GPU buffers
   * @param rev     static-data signature (engine legsRev); changes force re-upload
   * @param W,H     engine-space size (shader maps engine units → clip)
   * @param dest    the surface's on-page 2d context
   * @param dw,dh   dest backing-store pixel size
   */
  render(
    id: string,
    legs: EngineLeg[],
    rev: string,
    W: number,
    H: number,
    dest: CanvasRenderingContext2D,
    dw: number,
    dh: number,
    castShadow = true,
    shadowDir: [number, number] = [0.6, 0.8],
    shadowOffset = 1.15,
    shadowSpread = 1.75
  ) {
    const gl = this.gl;
    const ext = this.ext;
    const loc = this.loc;
    if (!gl || !ext || !loc || !this.ready || dw < 1 || dh < 1) return;
    this.ensureSize(dw, dh);

    // sub-rect at the top-left of the drawbuffer: GL y counts from the
    // bottom, image space from the top, so the viewport sits at height-dh
    const vy = this.canvas.height - dh;
    gl.viewport(0, vy, dw, dh);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, vy, dw, dh);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const n = legs.length;
    if (n > 0) {
      const cb = this.clientFor(id, n, rev, legs);
      if (!cb) {
        gl.disable(gl.SCISSOR_TEST);
        return;
      }
      const d = cb.dynData;
      let o = 0;
      for (const lg of legs) {
        d[o++] = lg.cxp;
        d[o++] = lg.cyp;
        d[o++] = lg.progress;
        d[o++] = lg.reverse ? 1 : 0;
      }

      gl.useProgram(this.prog);
      gl.uniform2f(loc.uRes, W, H);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.geoBuf);
      const geoSet = (l: number, off: number) => {
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, 1, gl.FLOAT, false, 8, off);
        ext.vertexAttribDivisorANGLE(l, 0);
      };
      geoSet(loc.aSeg, 0);
      geoSet(loc.aSide, 4);

      const inst = (l: number, size: number, stride: number, off: number) => {
        if (l < 0) return;
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off);
        ext.vertexAttribDivisorANGLE(l, 1);
      };

      gl.bindBuffer(gl.ARRAY_BUFFER, cb.staticBuf);
      const ss = STATIC_FLOATS * 4;
      inst(loc.aP0, 2, ss, 0);
      inst(loc.aP1, 2, ss, 8);
      inst(loc.aColor, 3, ss, 16);
      inst(loc.aWidth, 1, ss, 28);
      inst(loc.aMat, 4, ss, 32);
      inst(loc.aMat2, 4, ss, 48);

      gl.bindBuffer(gl.ARRAY_BUFFER, cb.dynBuf);
      const need = n * DYN_FLOATS;
      if (cb.dynCap < need) {
        gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, need), gl.DYNAMIC_DRAW);
        cb.dynCap = need;
      } else {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, need));
      }
      const ds = DYN_FLOATS * 4;
      inst(loc.aCtrl, 2, ds, 0);
      inst(loc.aProgress, 1, ds, 8);
      inst(loc.aReverse, 1, ds, 12);

      // pass 1, cast-shadow silhouette (skipped when castShadow is false)
      if (castShadow) {
        gl.uniform2f(loc.uShadowDir, shadowDir[0], shadowDir[1]);
        gl.uniform1f(loc.uShadowOffset, shadowOffset);
        gl.uniform1f(loc.uShadowSpread, shadowSpread);
        gl.uniform1f(loc.uShadow, 1);
        ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, VERTS, n);
      }

      gl.uniform1f(loc.uShadow, 0);
      ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, VERTS, n);
    }
    gl.disable(gl.SCISSOR_TEST);

    // synchronous same-task blit; the drawbuffer is valid until this
    // task yields, so no preserveDrawingBuffer is needed
    dest.clearRect(0, 0, dw, dh);
    dest.drawImage(this.canvas, 0, 0, dw, dh, 0, 0, dw, dh);
  }

  /** Drop a surface's GPU buffers when its runtime unmounts. */
  releaseClient(id: string) {
    const cb = this.clients.get(id);
    if (!cb) return;
    this.clients.delete(id);
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      gl.deleteBuffer(cb.staticBuf);
      gl.deleteBuffer(cb.dynBuf);
    }
  }
}

let shared: SharedThreadRenderer | null = null;
let sharedTried = false;

/**
 * The page-lifetime shared renderer. Returns null on the server or when
 * WebGL is unavailable; callers fall back to SVGThreadRenderer.
 */
export function getSharedThreadRenderer(): SharedThreadRenderer | null {
  if (typeof window === 'undefined') return null;
  if (!sharedTried) {
    sharedTried = true;
    const r = new SharedThreadRenderer();
    shared = r.failed ? null : r;
  }
  return shared;
}
