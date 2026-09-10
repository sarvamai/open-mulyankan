/**
 * Stitch runtime, the lifecycle layer between engines and the page.
 *
 * One StitchRuntime per visible surface (playground stage, footer logo,
 * hero box…). A module-wide StitchScheduler owns:
 * - ONE IntersectionObserver, offscreen surfaces are skipped entirely;
 * - ONE requestAnimationFrame loop, it only runs while at least one
 *   surface wants a frame, and cancels itself when everything sleeps.
 *
 * A surface is stepped only when it is (a) intersecting the viewport and
 * (b) not settled, i.e. stitching, physics in motion, pointer engaged,
 * or explicitly woken (engine wake events, resize, prop changes). A
 * settled surface costs nothing: no physics, no upload, no blit; its
 * last frame stays painted in its own canvas.
 *
 * Rendering goes through the page-wide SharedThreadRenderer (one WebGL
 * context, blitted into this surface's 2D canvas). When WebGL is
 * unavailable the surface falls back to its own SVGThreadRenderer.
 */

import {
  onStitchModeChange,
  sampleActiveFrame,
  stitchModeInfo,
  stitchMotionEnabled,
} from './capability';
import { StitchEngine, type EngineTickResult } from './engine';
import { getSharedThreadRenderer, MAX_STITCH_DPR, type SharedThreadRenderer } from './glRenderer';
import { SVGThreadRenderer } from './svgLiveRenderer';

export type RendererKind = 'webgl' | 'svg';
export type RuntimeState = 'offscreen' | 'idle' | 'active';

export interface RuntimeHud {
  fps: number;
  renderMs: number;
  threads: number;
}

export interface StitchRuntimeOptions {
  renderer: RendererKind;
  /** class applied to the canvas/svg layer the runtime mounts into the host */
  layerClass?: string;
  /**
   * Supersample multiplier on the destination framebuffer (on top of DPR).
   * Surfaces rendered far below native cell size (icons, small assets) alias
   * badly at 1×; rendering larger and letting the browser downscale
   * anti-aliases the result. Keep ≤4 and only for small surfaces.
   */
  resolutionScale?: number;
  /** WebGL unavailable, surface fell back to SVG */
  onFallback?: () => void;
  /** per-frame tick results, one per engine (render order) */
  onTick?: (results: EngineTickResult[], runtime: StitchRuntime) => void;
  /** throttled (~2/s) perf readout while active */
  onHud?: (hud: RuntimeHud) => void;
  onState?: (state: RuntimeState) => void;
}

const NS = 'http://www.w3.org/2000/svg';
/** a frame gap larger than this means we slept; shift pending timelines */
const SLEEP_GAP_MS = 250;
const HUD_INTERVAL_MS = 500;

/* ------------------------------------------------------------------ */
/* scheduler                                                           */
/* ------------------------------------------------------------------ */

class StitchScheduler {
  private runtimes = new Set<StitchRuntime>();
  private byEl = new Map<Element, StitchRuntime>();
  private io: IntersectionObserver | null = null;
  private running = false;

  register(rt: StitchRuntime, el: Element) {
    this.runtimes.add(rt);
    this.byEl.set(el, rt);
    if (!this.io && typeof IntersectionObserver !== 'undefined') {
      // wake slightly before entry so stitching is underway as it scrolls in
      this.io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            this.byEl.get(e.target)?.setVisible(e.isIntersecting);
          }
        },
        { rootMargin: '120px' }
      );
    }
    this.io?.observe(el);
    this.requestFrame();
  }

  unregister(rt: StitchRuntime, el: Element) {
    this.runtimes.delete(rt);
    this.byEl.delete(el);
    this.io?.unobserve(el);
  }

  /** ensure the shared loop is running (some surface wants a frame) */
  requestFrame() {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.frame);
  }

  wakeAll() {
    for (const rt of this.runtimes) rt.wake();
  }

  private lastFrameAt: number | null = null;

  private frame = (now: number) => {
    // consecutive scheduler frames = active animation; their deltas are
    // the real frame times the adaptive-demotion governor decides on
    if (this.lastFrameAt != null) sampleActiveFrame(now - this.lastFrameAt);
    let anyAwake = false;
    for (const rt of this.runtimes) {
      if (rt.step(now)) anyAwake = true;
    }
    if (anyAwake) {
      this.lastFrameAt = now;
      requestAnimationFrame(this.frame);
    } else {
      // everything settled or offscreen, stop the loop entirely;
      // wake events / IO restart it via requestFrame()
      this.lastFrameAt = null;
      this.running = false;
    }
  };

  /** Adaptive demotion fired mid-page; snap every surface to static. */
  applyStaticMode() {
    for (const rt of this.runtimes) rt.applyStaticMode();
  }

  debug() {
    return {
      ...stitchModeInfo(),
      surfaces: [...this.runtimes].map((rt) => ({
        id: rt.id,
        state: rt.state,
        threads: rt.engines.reduce((n, e) => n + e.legs.length, 0),
      })),
    };
  }
}

let scheduler: StitchScheduler | null = null;

export function getStitchScheduler(): StitchScheduler | null {
  if (typeof window === 'undefined') return null;
  if (!scheduler) {
    scheduler = new StitchScheduler();
    const shared = getSharedThreadRenderer();
    if (shared) shared.onRestored = () => scheduler?.wakeAll();
    // adaptive demotion mid-page → settle every live surface instantly
    onStitchModeChange((mode) => {
      if (mode === 'static') scheduler?.applyStaticMode();
    });
    // dev/manual-testing hook: __stitchDebug() lists mode + surfaces
    (window as unknown as Record<string, unknown>).__stitchDebug = () => scheduler?.debug();
  }
  return scheduler;
}

/* ------------------------------------------------------------------ */
/* runtime                                                             */
/* ------------------------------------------------------------------ */

let nextId = 1;

export class StitchRuntime {
  readonly id = `stitch-${nextId++}`;
  /** render order; engines[primary] defines the coordinate space */
  engines: StitchEngine[];
  readonly primary: StitchEngine;
  activeRenderer: RendererKind;
  state: RuntimeState = 'idle';

  private opts: StitchRuntimeOptions;
  private host: HTMLElement | null = null;
  private gl: SharedThreadRenderer | null = null;
  private destCtx: CanvasRenderingContext2D | null = null;
  private destCanvas: HTMLCanvasElement | null = null;
  private svg: SVGThreadRenderer | null = null;
  private svgViewBox = '';
  private ro: ResizeObserver | null = null;
  private unsubs = new Map<StitchEngine, () => void>();
  private dw = 0;
  private dh = 0;

  private visible = true;
  private wantFrame = true;
  private pendingResize = false;
  private lastNow: number | null = null;
  private pausedAt: number | null = null;

  private fpsAcc = 0;
  private fpsCnt = 0;
  private renderMs = 0;
  private hudAt = 0;

  constructor(engine: StitchEngine | StitchEngine[], opts: StitchRuntimeOptions) {
    this.engines = Array.isArray(engine) ? [...engine] : [engine];
    this.primary = this.engines[this.engines.length - 1];
    this.opts = opts;
    this.activeRenderer = opts.renderer;
  }

  /** Mount the render layer into `host` and start being scheduled. */
  attach(host: HTMLElement) {
    this.host = host;

    if (this.opts.renderer === 'webgl') {
      const shared = getSharedThreadRenderer();
      if (shared) {
        this.gl = shared;
        const canvas = document.createElement('canvas');
        if (this.opts.layerClass) canvas.setAttribute('class', this.opts.layerClass);
        host.appendChild(canvas);
        this.destCanvas = canvas;
        this.destCtx = canvas.getContext('2d');
        this.activeRenderer = 'webgl';
      } else {
        this.mountSvg(host);
        this.opts.onFallback?.();
      }
    } else {
      this.mountSvg(host);
    }

    // capability gate (covers prefers-reduced-motion, missing/software
    // GPU, low-end devices, and manual overrides; see capability.ts):
    // threads render instantly and the cloth never simulates
    if (!stitchMotionEnabled()) {
      for (const e of this.engines) {
        e.reducedMotion = true;
        e.physicsEnabled = false;
        e.physics.sway = false;
      }
    }

    for (const e of this.engines) this.subscribe(e);

    this.ro = new ResizeObserver(() => this.sizeDest());
    this.ro.observe(host);
    this.sizeDest();

    getStitchScheduler()?.register(this, host);
    this.wake();
  }

  private mountSvg(host: HTMLElement) {
    const el = document.createElementNS(NS, 'svg') as SVGSVGElement;
    el.setAttribute('preserveAspectRatio', 'none');
    if (this.opts.layerClass) el.setAttribute('class', this.opts.layerClass);
    host.appendChild(el);
    this.svg = new SVGThreadRenderer(el);
    this.activeRenderer = 'svg';
  }

  private subscribe(e: StitchEngine) {
    if (this.unsubs.has(e)) return;
    this.unsubs.set(
      e,
      e.onWake(() => this.onEngineWake())
    );
  }

  /**
   * An engine scheduled fresh work, anchored at the current clock. If this
   * surface isn't being stepped right now (offscreen pause, hidden tab,
   * stopped loop), re-anchor the sleep bookkeeping to now; otherwise the
   * wake-up timeline shift (sized to the full sleep) would push the new
   * windows into the future and the surface would sit blank until they
   * arrived. While actively stepping this is a no-op.
   */
  private onEngineWake() {
    const now = performance.now();
    if (this.pausedAt != null) {
      this.pausedAt = now;
    } else if (this.lastNow != null) {
      this.lastNow = Math.max(this.lastNow, now - 16);
    }
    this.wake();
  }

  /** Stack another engine into the frame (crossfades). `index` is render order. */
  addEngine(e: StitchEngine, index = this.engines.length) {
    if (!stitchMotionEnabled()) {
      e.reducedMotion = true;
      e.physicsEnabled = false;
      e.physics.sway = false;
    }
    this.engines.splice(index, 0, e);
    this.subscribe(e);
    this.wake();
  }

  removeEngine(e: StitchEngine) {
    const i = this.engines.indexOf(e);
    if (i < 0) return;
    this.engines.splice(i, 1);
    this.unsubs.get(e)?.();
    this.unsubs.delete(e);
    this.wake();
  }

  /** Request at least one frame (engine wake events land here). */
  wake() {
    this.wantFrame = true;
    getStitchScheduler()?.requestFrame();
  }

  /**
   * Adaptive demotion: finish any pending stitches instantly, kill the
   * cloth simulation, and let the surface settle. One repaint follows
   * (revealAll emits a wake), then the surface sleeps like any other.
   */
  applyStaticMode() {
    for (const e of this.engines) {
      e.reducedMotion = true;
      e.physicsEnabled = false;
      e.physics.sway = false;
      e.motion.loop = false;
      e.clearPointer();
      e.revealAll();
    }
  }

  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    if (v) {
      if (this.pendingResize) this.applyCanvasSize();
      this.wake();
    } else {
      this.setState('offscreen');
    }
  }

  private setState(s: RuntimeState) {
    if (s === this.state) return;
    this.state = s;
    this.opts.onState?.(s);
  }

  private sizeDest() {
    const host = this.host;
    if (!host || !this.destCanvas) return;
    const box = host.getBoundingClientRect();
    const dpr =
      Math.min(window.devicePixelRatio || 1, MAX_STITCH_DPR) * (this.opts.resolutionScale ?? 1);
    const dw = Math.max(1, Math.round(box.width * dpr));
    const dh = Math.max(1, Math.round(box.height * dpr));
    if (dw === this.dw && dh === this.dh) return;
    this.dw = dw;
    this.dh = dh;
    // Resizing clears the 2D canvas; defer while offscreen so the last
    // painted frame survives scroll-away until we can repaint on wake.
    if (!this.visible) {
      this.pendingResize = true;
      return;
    }
    this.applyCanvasSize();
    this.wake();
  }

  private applyCanvasSize() {
    if (!this.destCanvas) return;
    this.destCanvas.width = this.dw;
    this.destCanvas.height = this.dh;
    this.pendingResize = false;
  }

  /**
   * One scheduler frame. Returns true while this surface wants more
   * frames; false lets the scheduler drop it (and, if nothing else is
   * awake, stop the shared loop).
   */
  step(now: number): boolean {
    if (!this.visible || !this.host) {
      this.notePause(now);
      return false;
    }

    // sleeping (offscreen, hidden tab, stopped loop) must not fast-forward
    // pending stitches; shift their windows by the slept duration
    if (this.pausedAt != null) {
      const dt = now - this.pausedAt;
      if (dt > SLEEP_GAP_MS) for (const e of this.engines) e.shiftTimeline(dt);
      this.pausedAt = null;
    } else if (this.lastNow != null) {
      const gap = now - this.lastNow;
      if (gap > SLEEP_GAP_MS) for (const e of this.engines) e.shiftTimeline(gap - 16);
    }
    const frameMs = this.lastNow != null ? now - this.lastNow : 0;
    this.lastNow = now;

    const results = this.engines.map((e) => e.tick(now));
    this.opts.onTick?.(results, this);

    const r0 = performance.now();
    this.render();
    this.renderMs = performance.now() - r0;
    this.hud(now, frameMs);

    this.wantFrame = false;
    const settled = this.engines.every((e) => e.isSettled());
    if (settled && !this.wantFrame) {
      this.setState('idle');
      this.notePause(now);
      return false;
    }
    this.setState('active');
    return true;
  }

  private notePause(now: number) {
    if (this.pausedAt == null) this.pausedAt = now;
    this.lastNow = null;
  }

  private render() {
    const legs =
      this.engines.length === 1 ? this.engines[0].legs : this.engines.flatMap((e) => e.legs);
    const { W, H } = this.primary;
    if (this.gl && this.destCtx) {
      const rev = this.engines.map((e) => `${e.legsRev}:${e.legs.length}`).join('|');
      this.gl.render(
        this.id,
        legs,
        rev,
        W,
        H,
        this.destCtx,
        this.dw,
        this.dh,
        this.primary.castShadow,
        this.primary.shadowDir,
        this.primary.shadowOffset,
        this.primary.shadowSpread
      );
    } else if (this.svg) {
      const vb = `0 0 ${W} ${H}`;
      if (vb !== this.svgViewBox) {
        this.svgViewBox = vb;
        this.svg.svg.setAttribute('viewBox', vb);
      }
      this.svg.render(legs);
    }
  }

  private hud(now: number, frameMs: number) {
    if (!this.opts.onHud) return;
    if (frameMs > 0) {
      this.fpsAcc += frameMs;
      this.fpsCnt++;
    }
    if (now - this.hudAt < HUD_INTERVAL_MS) return;
    this.hudAt = now;
    this.opts.onHud({
      fps: this.fpsCnt ? Math.round(1000 / (this.fpsAcc / this.fpsCnt)) : 0,
      renderMs: Math.round(this.renderMs * 100) / 100,
      threads: this.engines.reduce((n, e) => n + e.legs.length, 0),
    });
    this.fpsAcc = 0;
    this.fpsCnt = 0;
  }

  dispose() {
    if (this.host) getStitchScheduler()?.unregister(this, this.host);
    this.ro?.disconnect();
    this.ro = null;
    for (const unsub of this.unsubs.values()) unsub();
    this.unsubs.clear();
    this.gl?.releaseClient(this.id);
    this.gl = null;
    this.destCanvas?.remove();
    this.destCanvas = null;
    this.destCtx = null;
    if (this.svg) {
      this.svg.dispose();
      this.svg.svg.remove();
      this.svg = null;
    }
    this.host = null;
  }
}
