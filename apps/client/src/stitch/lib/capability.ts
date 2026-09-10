/**
 * Stitch capability gate; ONE universal decision for motion & physics.
 *
 * Machines without a real GPU (WebGL missing, or software-emulated via
 * SwiftShader/llvmpipe) and low-end devices shouldn't pay for stitch
 * animation at all: they get `static` mode; threads still render, fully
 * legible, but instantly revealed with no physics, no auto-cycles, no
 * CSS draw-on animation. Everything that animates must consult
 * `stitchMotionEnabled()` instead of checking media queries or GPU state
 * itself; this module is the single source of truth.
 *
 * Resolution order (first match wins):
 *   1. STITCH_MODE_OVERRIDE below; the hardcoded code toggle
 *   2. URL param   ?stitch=full|static; per-load testing override
 *   3. localStorage "epoch-stitch-mode"; persisted user/debug override
 *   4. auto-detection; reduced-motion, GPU, device class
 *
 * Manual testing: `__stitchMode()` in the console reads the resolved
 * mode; `__stitchMode("static" | "full" | "auto")` persists an override
 * and reloads. The resolved mode is mirrored onto
 * `<html data-stitch-mode="…">` so CSS can gate draw-on animations.
 */

export type StitchMode = 'full' | 'static';

/**
 * ── THE UNIVERSAL TOGGLE ──
 * "auto"   → detect per device (default)
 * "full"   → force motion + physics everywhere
 * "static" → force everything inert everywhere
 */
export const STITCH_MODE_OVERRIDE: StitchMode | 'auto' = 'auto';

/** auto-detect: at or below these, the CPU-side physics isn't worth it */
const MIN_CORES = 3;
const MIN_DEVICE_MEMORY_GB = 3;

/** GPU strings that mean WebGL exists but runs on the CPU */
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;

const STORAGE_KEY = 'epoch-stitch-mode';
/** timestamped record of an adaptive demotion; separate from manual overrides */
const DEMOTED_KEY = 'epoch-stitch-demoted';
/** a demoted device gets another chance at full motion after this long */
const DEMOTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* ── adaptive demotion (production safety net) ──
 * Static heuristics can't judge every device, so while animating we
 * watch real frame times (fed by the scheduler via sampleActiveFrame).
 * Sustained low fps → demote this page live and persist the decision.
 */
/** an active frame slower than this (~25fps) counts against the device;
 *  comfortably above a 30Hz display's natural ~33ms so those don't trip it */
const FRAME_BUDGET_MS = 40;
/** rolling window of active-frame samples the decision is made over */
const SAMPLE_WINDOW = 60;
/** demote when this fraction of the window is over budget */
const DEMOTE_FRACTION = 0.5;
/** ignore the first active frames; page-load compile/GC jank isn't the GPU */
const WARMUP_SAMPLES = 20;
/** deltas above this are sleeps/stalls (tab switch, breakpoint), not slow frames */
const MAX_SAMPLE_MS = 240;

/** how the current mode was decided; explicit choices are never demoted */
export type StitchModeSource = 'override' | 'param' | 'storage' | 'demoted' | 'auto';

let resolved: StitchMode | null = null;
let source: StitchModeSource = 'auto';
const changeListeners = new Set<(mode: StitchMode) => void>();

/** True when the device should run stitch animation and cloth physics. */
export function stitchMotionEnabled(): boolean {
  return stitchMode() === 'full';
}

/** The resolved mode for this page load (memoized; "full" during SSR). */
export function stitchMode(): StitchMode {
  if (typeof window === 'undefined') return 'full';
  if (resolved) return resolved;

  if (STITCH_MODE_OVERRIDE !== 'auto') {
    resolved = STITCH_MODE_OVERRIDE;
    source = 'override';
    return resolved;
  }

  const param = new URLSearchParams(window.location.search).get('stitch');
  if (param === 'full' || param === 'static') {
    resolved = param;
    source = 'param';
    return resolved;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'full' || saved === 'static') {
      resolved = saved;
      source = 'storage';
      return resolved;
    }
  } catch {}

  try {
    const demotedAt = Number(localStorage.getItem(DEMOTED_KEY));
    if (demotedAt && Date.now() - demotedAt < DEMOTE_TTL_MS) {
      resolved = 'static';
      source = 'demoted';
      return resolved;
    }
  } catch {}

  resolved = detect();
  source = 'auto';
  return resolved;
}

/** Mode plus how it was decided; surfaced by __stitchDebug(). */
export function stitchModeInfo(): { mode: StitchMode; source: StitchModeSource } {
  return { mode: stitchMode(), source };
}

/** Notified when the mode changes mid-page (adaptive demotion). */
export function onStitchModeChange(fn: (mode: StitchMode) => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

/**
 * Persist an override ("auto" clears it, and clears any adaptive
 * demotion record). Takes full effect on the next page load; engines
 * already scheduled keep their current behaviour.
 */
export function setStitchMode(mode: StitchMode | 'auto') {
  try {
    if (mode === 'auto') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DEMOTED_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {}
  resolved = null;
  applyStitchModeToDom();
}

/* ── adaptive demotion sampling ── */

let warmupLeft = WARMUP_SAMPLES;
const samples: number[] = [];
let overBudget = 0;

/**
 * Feed one active-animation frame delta (ms) from the scheduler loop.
 * Only auto-resolved "full" mode is ever demoted; explicit choices
 * (code override, URL param, saved preference) are respected.
 */
export function sampleActiveFrame(dt: number) {
  if (dt <= 0 || dt > MAX_SAMPLE_MS) return;
  if (stitchMode() !== 'full' || source !== 'auto') return;
  if (warmupLeft > 0) {
    warmupLeft--;
    return;
  }
  samples.push(dt);
  if (dt > FRAME_BUDGET_MS) overBudget++;
  if (samples.length > SAMPLE_WINDOW) {
    const dropped = samples.shift()!;
    if (dropped > FRAME_BUDGET_MS) overBudget--;
  }
  if (samples.length === SAMPLE_WINDOW && overBudget >= SAMPLE_WINDOW * DEMOTE_FRACTION) {
    demoteToStatic();
  }
}

/**
 * Drop this device to static mode immediately and remember the decision
 * for DEMOTE_TTL_MS. The scheduler listens via onStitchModeChange and
 * snaps every live surface to its settled state.
 */
export function demoteToStatic() {
  if (stitchMode() === 'static') return;
  try {
    localStorage.setItem(DEMOTED_KEY, String(Date.now()));
  } catch {}
  resolved = 'static';
  source = 'demoted';
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.stitchMode = 'static';
  }
  // eslint-disable-next-line no-console -- one-time diagnostic when a device is demoted to static mode
  console.info(
    "[stitch] sustained frame drops; motion demoted to static for this device (undo: __stitchMode('auto') or __stitchMode('full'))"
  );
  for (const fn of changeListeners) fn('static');
}

/**
 * Mirror the resolved mode onto <html data-stitch-mode> (CSS gate) and
 * install the `__stitchMode` console hook. Called once on the client by
 * StitchModeInit in the root layout.
 */
export function applyStitchModeToDom() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.stitchMode = stitchMode();
  (window as unknown as Record<string, unknown>).__stitchMode = (mode?: StitchMode | 'auto') => {
    if (mode !== undefined) {
      setStitchMode(mode);
      window.location.reload();
      return mode;
    }
    return stitchMode();
  };
}

function detect(): StitchMode {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'static';

  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.hardwareConcurrency && nav.hardwareConcurrency < MIN_CORES) {
    return 'static';
  }
  if (nav.deviceMemory && nav.deviceMemory < MIN_DEVICE_MEMORY_GB) {
    return 'static';
  }

  return probeGPU();
}

/**
 * One-time 1×1 WebGL probe, released immediately. No context → static;
 * software rasterizer → static. Unknown/masked renderer strings count as
 * capable; false positives here would punish good hardware.
 */
function probeGPU(): StitchMode {
  let gl: WebGLRenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    gl =
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext('webgl');
    if (!gl) return 'static';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) {
      const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
      if (SOFTWARE_GL.test(renderer)) return 'static';
    }
    return 'full';
  } catch {
    return 'static';
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
