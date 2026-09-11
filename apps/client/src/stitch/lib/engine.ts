/**
 * StitchEngine, the renderer-agnostic imperative core of the playground.
 *
 * One shared timeline drives both renderers (SVG and WebGL): every placed
 * unit is flattened into legs with their own t0/t1 stitch window, physics
 * state (a spring-damper node lattice with one node per occupied cell,
 * plus per-leg softening), and material. Renderers just read `legs` each
 * frame. Ported from reference/stitch-webgl.html.
 *
 * Sleep/wake contract (consumed by lib/stitch/runtime.ts):
 * - Anything that creates future work (schedule, place, ripple, active
 *   pointer, grid change) notifies `onWake` subscribers.
 * - `tick()` keeps a `settled` flag; once true the owner may stop calling
 *   `tick()` entirely; the engine is inert until the next wake event.
 * - `shiftTimeline(dt)` moves pending stitch windows forward after the
 *   owner slept through wall-clock time (offscreen / hidden tab), so
 *   animations resume where they paused instead of skipping ahead.
 */

import {
  UNITS,
  THREADS,
  hexToRGB,
  isMotifUnit,
  saturateColor,
  unitDelay,
  type AnimMode,
  type PlacedUnit,
  type StitchOrder,
  type ThreadKey,
  type ThreadMaterial,
  type UnitKey,
  type WaveDir,
} from './units';

export type PhysicsMode = 'cloth' | 'jelly' | 'wind' | 'gravity' | 'magnet' | 'ripple';

export interface EngineMotion {
  mode: AnimMode;
  order: StitchOrder;
  waveDir: WaveDir;
  /** ms between units in coordinated/wave modes */
  stagger: number;
  /** ms one whole unit takes to stitch */
  speed: number;
  loop: boolean;
}

export interface EnginePhysics {
  mode: PhysicsMode;
  /** 4..30 → spring k = value/1000 */
  spring: number;
  /** cursor influence radius in canvas units */
  radius: number;
  /** idle sway (loose weave drape) */
  sway: boolean;
  /**
   * Pointer response multiplier; scales push force and offset clamps.
   * Displacement caps are in canvas units, so surfaces rendered far below
   * native size (small assets) need >1 for the deflection to stay visible.
   */
  intensity: number;
}

export interface EnginePlacement {
  unit: UnitKey;
  color: string;
  material: ThreadKey;
  /** dims overlap-layer placements */
  opacity?: number;
  /** named part; lets scheduleGroup animate subsets independently */
  group?: string;
  /** mid-crossfade; unstitching out, pruned by settleCrossfade() once done */
  removing?: boolean;
  /**
   * Loaded hidden and skipped by revealAll/scheduleAll; becomes visible
   * only when its group is explicitly scheduled (click-anim travelers).
   */
  latent?: boolean;
}

/**
 * A free thread segment in engine coordinates; not tied to a cell unit.
 * Satin fills load these; each segment becomes one leg anchored to the
 * lattice node under its midpoint, so cloth physics and motion modes
 * apply exactly as they do to placed units.
 */
export interface EngineSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  color: string;
  group?: string;
}

interface EngineNode {
  c: number;
  r: number;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  nbr: EngineNode[];
}

export interface EngineLeg {
  uid: string;
  key: string;
  c: number;
  r: number;
  layer: number;
  li: number;
  group?: string;
  /** hidden until its group is scheduled; see EnginePlacement.latent */
  latent?: boolean;
  node: EngineNode | null;
  /** rest endpoints */
  a: [number, number];
  b: [number, number];
  mid: [number, number];
  /** live geometry (endpoints fixed; control point bows) */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cxp: number;
  cyp: number;
  /** per-leg physics offset + velocity */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  color: string;
  rgb: [number, number, number];
  opacity: number;
  width: number;
  material: ThreadMaterial;
  showNeedle: boolean;
  motifFill: boolean;
  pinned: boolean;
  /** stitch window + reveal progress */
  t0: number;
  t1: number;
  reverse: boolean;
  progress: number;
  drawn: boolean;
}

export interface EngineTickResult {
  anyStitching: boolean;
  allDone: boolean;
  /** legs whose stitch completed this tick; drives the needle "punch" */
  punches: number;
  /** total cloth motion this tick; drives the rustle */
  motion: number;
}

/** reference tool's width tiers were tuned at CELL=22 */
const WIDTH_REF_CELL = 22;
/** delay between loop cycles */
const LOOP_REST = 600;
/** control-point bow multiplier; motif fills bow less than open stitches */
const bellyFor = (motifFill: boolean) => (motifFill ? 0.9 : 2);

export class StitchEngine {
  cols: number;
  rows: number;
  cell: number;
  pad: number;

  cells = new Map<string, EnginePlacement[]>();
  nodes = new Map<string, EngineNode>();
  /** free satin segments (engine coords) rebuilt alongside cell legs */
  private segments: EngineSegment[] = [];
  private segmentStyle: { material: ThreadKey; width: number } = {
    material: 'cotton',
    width: 4,
  };
  legs: EngineLeg[] = [];
  /** bumped whenever leg topology/static styling changes; renderers key static GPU uploads off this */
  legsRev = 0;

  motion: EngineMotion = {
    mode: 'coordinated',
    order: 'ltr',
    waveDir: 'right',
    stagger: 120,
    speed: 520,
    loop: false,
  };
  physics: EnginePhysics = { mode: 'cloth', spring: 14, radius: 80, sway: false, intensity: 1 };
  /** global thread thickness multiplier (rail "Thickness"); re-run rebuildLegs after changing */
  widthScale = 1;
  /** stitch inset as a fraction of the cell (0..0.5); pulls legs in from cell edges */
  inset = 0;
  /** sheen highlight; off renders every material matte (no lit core) */
  sheen = true;
  /** dark edge shading; off renders threads at their exact color (no dimming) */
  edgeShade = true;
  /** 0..1, vivid color style: saturation × (1 + 2.2·boost), lightness + 0.3·boost */
  colorBoost = 0;
  /** WebGL cast-shadow pass; off for flat surfaces like the hero platform */
  castShadow = true;
  /** Cast-shadow tuning for elevated surfaces (hero logo). */
  shadowDir: [number, number] = [0.6, 0.8];
  shadowOffset = 1.15;
  shadowSpread = 1.75;
  /** when true, schedules resolve instantly (prefers-reduced-motion) */
  reducedMotion = false;
  /** when false, the cloth lattice never simulates; pointer/ripples are inert (capability gate) */
  physicsEnabled = true;

  pointer = { x: -9999, y: -9999, down: false, active: false };
  private ripples: Array<{ x: number; y: number; t0: number }> = [];
  private loopAt: number | null = null;
  /** pending traveler steps (runTravel), consumed by tick() when due */
  private travelQueue: Array<{ group: string; at: number; reverse: boolean; stitchMs: number }> =
    [];
  /** physics lattice at rest; the spring pass can be skipped entirely */
  private physicsIdle = false;
  /** nothing animating, nothing pending; owner may stop ticking */
  private settled = false;
  private wakeListeners = new Set<() => void>();

  constructor(cols: number, rows: number, cell: number, pad = 6) {
    this.cols = cols;
    this.rows = rows;
    this.cell = cell;
    this.pad = pad;
  }

  get W() {
    return this.cols * this.cell + this.pad * 2;
  }
  get H() {
    return this.rows * this.cell + this.pad * 2;
  }

  /* ---------------- wake bus ---------------- */

  /** Subscribe to "this engine has new work" events. Returns unsubscribe. */
  onWake(fn: () => void): () => void {
    this.wakeListeners.add(fn);
    return () => this.wakeListeners.delete(fn);
  }

  private emitWake() {
    this.settled = false;
    for (const fn of this.wakeListeners) fn();
  }

  /** Force the physics lattice back into simulation (after mode/spring edits). */
  wakePhysics() {
    this.physicsIdle = false;
    this.emitWake();
  }

  /** True once every leg is drawn, physics is at rest and no loop is pending. */
  isSettled(): boolean {
    return this.settled;
  }

  /* ---------------- pointer ---------------- */

  /** Move the pointer; an active pointer wakes physics. */
  setPointer(x: number, y: number, opts: { down?: boolean; active?: boolean } = {}) {
    this.pointer.x = x;
    this.pointer.y = y;
    if (opts.down !== undefined) this.pointer.down = opts.down;
    if (opts.active !== undefined) this.pointer.active = opts.active;
    if (this.pointer.active && this.physicsEnabled) {
      this.physicsIdle = false;
      this.emitWake();
    }
  }

  releasePointer() {
    this.pointer.down = false;
  }

  clearPointer() {
    this.pointer.x = -9999;
    this.pointer.y = -9999;
    this.pointer.down = false;
    this.pointer.active = false;
  }

  /* ---------------- placement ---------------- */

  setGrid(cols: number, rows: number, cell = this.cell) {
    this.cols = cols;
    this.rows = rows;
    this.cell = cell;
    // free segments are in engine px space; a new grid invalidates them
    this.segments = [];
    // drop placements that no longer fit, rebuild node positions
    for (const key of [...this.cells.keys()]) {
      const [c, r] = key.split(',').map(Number);
      if (c >= cols || r >= rows) this.cells.delete(key);
    }
    this.nodes.clear();
    for (const key of this.cells.keys()) {
      const [c, r] = key.split(',').map(Number);
      this.ensureNode(c, r);
    }
    this.rebuildLegs();
  }

  clear() {
    this.cells.clear();
    this.nodes.clear();
    this.segments = [];
    this.legs = [];
    this.legsRev++;
    this.ripples = [];
    this.loopAt = null;
    this.travelQueue = [];
    this.emitWake();
  }

  /** Place one unit (stacks on occupied cells) and stitch just that unit. */
  place(c: number, r: number, unit: UnitKey, color: string, material: ThreadKey, group?: string) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const key = `${c},${r}`;
    const stack = this.cells.get(key) ?? [];
    const placed: EnginePlacement = { unit, color, material, group };
    stack.push(placed);
    this.cells.set(key, stack);
    const node = this.ensureNode(c, r);
    // incremental: append only this placement's legs (appended = drawn on top,
    // matching stack order) instead of rebuilding the whole field
    const layer = stack.length - 1;
    this.buildPlacementLegs(key, c, r, node, placed, layer, null, this.legs);
    this.legsRev++;
    this.scheduleUnit(key, layer);
  }

  /** Remove all placements at a cell (used by the erase tool). */
  eraseCell(c: number, r: number) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const key = `${c},${r}`;
    if (!this.cells.has(key)) return;
    this.cells.delete(key);
    this.nodes.clear();
    for (const k of this.cells.keys()) {
      const [cc, rr] = k.split(',').map(Number);
      this.ensureNode(cc, rr);
    }
    this.rebuildLegs();
  }

  /** Bulk-load placements (from layoutField / gridToUnits) and stitch all. */
  loadPlaced(
    units: PlacedUnit[],
    opts: { material: ThreadKey; clear?: boolean; schedule?: boolean; group?: string } = {
      material: 'cotton',
    }
  ) {
    if (opts.clear !== false) {
      this.cells.clear();
      this.nodes.clear();
      this.legs = [];
    }
    for (const u of units) {
      const key = `${u.c},${u.r}`;
      const stack = this.cells.get(key) ?? [];
      stack.push({
        unit: u.unit,
        color: u.color,
        material: opts.material,
        opacity: u.opacity,
        group: opts.group,
      });
      this.cells.set(key, stack);
      if (Number.isInteger(u.c) && Number.isInteger(u.r)) {
        this.ensureNode(u.c, u.r);
      }
    }
    this.rebuildLegs();
    if (opts.schedule !== false) this.scheduleAll();
  }

  /**
   * Bulk-load latent groups (click-anim travelers): placements stacked on
   * top of the current field but hidden — skipped by revealAll and
   * scheduleAll — until `runTravel` stitches them in group by group.
   * Out-of-grid cells are silently dropped. One legs rebuild for all groups.
   */
  loadLatentGroups(groups: Array<{ group: string; units: PlacedUnit[] }>, material: ThreadKey) {
    for (const g of groups) {
      for (const u of g.units) {
        if (u.c < 0 || u.c >= this.cols || u.r < 0 || u.r >= this.rows) continue;
        const key = `${u.c},${u.r}`;
        const stack = this.cells.get(key) ?? [];
        stack.push({
          unit: u.unit,
          color: u.color,
          material,
          opacity: u.opacity,
          group: g.group,
          latent: true,
        });
        this.cells.set(key, stack);
        if (Number.isInteger(u.c) && Number.isInteger(u.r)) this.ensureNode(u.c, u.r);
      }
    }
    this.rebuildLegs();
  }

  /**
   * Run a traveler along its waypoint groups: group i stitches in at
   * `steps[i].at` ms from now, and group i-1 unstitches at the same
   * moment, so the motif reads as one shape hopping waypoint to waypoint.
   * The final group stays drawn. Re-running resets and replays.
   */
  runTravel(steps: Array<{ group: string; at: number }>, durMs: number) {
    if (!steps.length) return;
    const groupSet = new Set(steps.map((s) => s.group));
    const last = steps[steps.length - 1].group;
    if (this.reducedMotion) {
      for (const lg of this.legs) {
        if (!lg.latent || !lg.group || !groupSet.has(lg.group)) continue;
        const on = lg.group === last;
        lg.progress = on ? 1 : 0;
        lg.drawn = on;
        lg.t0 = 0;
        lg.t1 = 0;
        lg.reverse = false;
      }
      this.travelQueue = [];
      this.emitWake();
      return;
    }
    // reset the whole run to hidden so a mid-run click replays cleanly
    for (const lg of this.legs) {
      if (!lg.latent || !lg.group || !groupSet.has(lg.group)) continue;
      lg.progress = 0;
      lg.drawn = false;
      lg.t0 = 0;
      lg.t1 = 0;
      lg.reverse = false;
    }
    const now = performance.now();
    this.travelQueue = [];
    steps.forEach((s, i) => {
      this.travelQueue.push({ group: s.group, at: now + s.at, reverse: false, stitchMs: durMs });
      if (i > 0) {
        this.travelQueue.push({
          group: steps[i - 1].group,
          at: now + s.at,
          reverse: true,
          stitchMs: durMs,
        });
      }
    });
    this.emitWake();
  }

  /**
   * Bulk-load free thread segments (satin fills). Each segment anchors to
   * the lattice node under its midpoint so pointer/cloth physics and the
   * motion scheduler treat it like any placed stitch.
   */
  loadSegments(
    segments: EngineSegment[],
    opts: {
      material: ThreadKey;
      /** thread width in engine px (satin: pitch × thickness × scale) */
      width: number;
      clear?: boolean;
      schedule?: boolean;
      group?: string;
    }
  ) {
    if (opts.clear !== false) {
      this.cells.clear();
      this.nodes.clear();
      this.segments = [];
    }
    this.segmentStyle = { material: opts.material, width: opts.width };
    for (const s of segments) {
      this.segments.push(opts.group ? { ...s, group: s.group ?? opts.group } : s);
    }
    this.rebuildLegs();
    if (opts.schedule !== false) this.scheduleAll();
  }

  /** cell under an engine-space point, clamped into the grid */
  private cellAt(x: number, y: number): [number, number] {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.pad) / this.cell)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.pad) / this.cell)));
    return [c, r];
  }

  /**
   * Resolve a material through the engine's render gates; sheen off mutes
   * the lit core, edgeShade off removes the dark edge that dims dense fills.
   */
  private matFor(key: ThreadKey): ThreadMaterial {
    const mat = THREADS[key] ?? THREADS.cotton;
    if (this.sheen && this.edgeShade) return mat;
    return {
      ...mat,
      ...(this.sheen ? {} : { sheen: 0, sheenW: 0 }),
      ...(this.edgeShade ? {} : { edge: 1 }),
    };
  }

  /** leg color after the vivid boost; HSL-space so colors pop, not wash out */
  private legColor(color: string): string {
    return this.colorBoost > 0
      ? saturateColor(color, 1 + this.colorBoost * 2.2, this.colorBoost * 0.3)
      : color;
  }

  /** Build legs for the free segments and push them onto `out`. */
  private buildSegmentLegs(prev: Map<string, EngineLeg> | null, out: EngineLeg[]) {
    if (!this.segments.length) return;
    const mat = this.matFor(this.segmentStyle.material);
    const width = this.segmentStyle.width * mat.widthMul * this.widthScale;
    this.segments.forEach((s, i) => {
      const midx = (s.ax + s.bx) / 2;
      const midy = (s.ay + s.by) / 2;
      const [c, r] = this.cellAt(midx, midy);
      const key = `${c},${r}`;
      const node = this.ensureNode(c, r);
      const uid = `seg|${i}`;
      const old = prev?.get(uid);
      const ox = old?.ox ?? node.ox;
      const oy = old?.oy ?? node.oy;
      out.push({
        uid,
        key,
        c,
        r,
        // unique layer per segment → the scheduler treats each thread as
        // its own unit, so wave/coordinated/spiral delays land per thread
        layer: 100000 + i,
        li: 0,
        group: s.group,
        node,
        a: [s.ax, s.ay],
        b: [s.bx, s.by],
        mid: [midx, midy],
        x0: s.ax,
        y0: s.ay,
        x1: s.bx,
        y1: s.by,
        cxp: midx + ox * 2,
        cyp: midy + oy * 2,
        ox,
        oy,
        vx: old?.vx ?? node.vx,
        vy: old?.vy ?? node.vy,
        color: this.legColor(s.color),
        rgb: hexToRGB(this.legColor(s.color)),
        opacity: 1,
        width,
        material: mat,
        showNeedle: false,
        motifFill: false,
        pinned: false,
        t0: old?.t0 ?? 0,
        t1: old?.t1 ?? 0,
        reverse: old?.reverse ?? false,
        progress: old?.progress ?? 1,
        drawn: old?.drawn ?? false,
      });
    });
  }

  private ensureNode(c: number, r: number): EngineNode {
    const key = `${c},${r}`;
    const existing = this.nodes.get(key);
    if (existing) return existing;
    const n: EngineNode = {
      c,
      r,
      cx: this.pad + c * this.cell + this.cell / 2,
      cy: this.pad + r * this.cell + this.cell / 2,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      nbr: [],
    };
    this.nodes.set(key, n);
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nb = this.nodes.get(`${c + dc},${r + dr}`);
      if (nb) {
        n.nbr.push(nb);
        nb.nbr.push(n);
      }
    }
    return n;
  }

  /** Build the legs for one placement layer and push them onto `out`. */
  private buildPlacementLegs(
    key: string,
    c: number,
    r: number,
    node: EngineNode | null,
    placed: EnginePlacement,
    layer: number,
    prev: Map<string, EngineLeg> | null,
    out: EngineLeg[]
  ) {
    const spec = UNITS[placed.unit];
    const mat = this.matFor(placed.material);
    const color = this.legColor(placed.color);
    const cellScale = this.cell / WIDTH_REF_CELL;
    const nLegs = spec.legs.length;
    const width =
      (nLegs > 14 ? 2.1 : nLegs > 6 ? 3.0 : 4.4) * mat.widthMul * cellScale * this.widthScale;
    const showNeedle = nLegs <= 14;
    const motif = isMotifUnit(placed.unit);
    const rgb = hexToRGB(color);

    const inset = this.inset * this.cell;
    const size = this.cell - inset * 2;

    spec.legs.forEach((leg, li) => {
      const ax = this.pad + c * this.cell + inset + leg[0][0] * size;
      const ay = this.pad + r * this.cell + inset + leg[0][1] * size;
      const bx = this.pad + c * this.cell + inset + leg[1][0] * size;
      const by = this.pad + r * this.cell + inset + leg[1][1] * size;
      const uid = `${key}|${layer}|${li}`;
      const old = prev?.get(uid);
      // legs without carried-over state start at their node's current cloth
      // offset (their steady-state chase target), so a mid-motion rebuild
      // doesn't snap threads back to rest pose for a frame
      const chase = !leg.pinned && node ? node : null;
      const ox = old?.ox ?? chase?.ox ?? 0;
      const oy = old?.oy ?? chase?.oy ?? 0;
      const motifFill = motif && !leg.pinned;
      const belly = bellyFor(motifFill);
      out.push({
        uid,
        key,
        c,
        r,
        layer,
        li,
        group: placed.group,
        node,
        a: [ax, ay],
        b: [bx, by],
        mid: [(ax + bx) / 2, (ay + by) / 2],
        x0: ax,
        y0: ay,
        x1: bx,
        y1: by,
        cxp: (ax + bx) / 2 + ox * belly,
        cyp: (ay + by) / 2 + oy * belly,
        ox,
        oy,
        vx: old?.vx ?? chase?.vx ?? 0,
        vy: old?.vy ?? chase?.vy ?? 0,
        color,
        rgb,
        opacity: placed.opacity ?? 1,
        width,
        material: mat,
        showNeedle,
        motifFill,
        pinned: !!leg.pinned,
        t0: old?.t0 ?? 0,
        t1: old?.t1 ?? 0,
        reverse: old?.reverse ?? false,
        // latent legs start hidden and stay so until their group runs
        progress: old?.progress ?? (placed.latent ? 0 : 1),
        drawn: old?.drawn ?? false,
        ...(placed.latent ? { latent: true } : {}),
      });
    });
  }

  /** Flatten placements into legs, preserving state across rebuilds. */
  rebuildLegs() {
    const prev = new Map<string, EngineLeg>();
    for (const lg of this.legs) prev.set(lg.uid, lg);
    const legs: EngineLeg[] = [];
    for (const [key, stack] of this.cells) {
      const [c, r] = key.split(',').map(Number);
      const node = this.nodes.get(key) ?? null;
      stack.forEach((placed, layer) => {
        this.buildPlacementLegs(key, c, r, node, placed, layer, prev, legs);
      });
    }
    this.buildSegmentLegs(prev, legs);
    this.legs = legs;
    this.legsRev++;
    this.emitWake();
  }

  /* ---------------- scheduler ---------------- */

  /** Snap every leg to fully revealed, used for image preview before re-stitching. */
  revealAll() {
    for (const lg of this.legs) {
      if (lg.latent) continue;
      lg.progress = 1;
      lg.drawn = true;
      lg.t0 = 0;
      lg.t1 = 0;
    }
    this.emitWake();
  }

  /** Re-stitch everything using the current motion settings. */
  scheduleAll(now = performance.now(), opts?: { reverse?: boolean; seed?: number }) {
    this.scheduleLegs(
      this.legs.filter((lg) => !lg.latent),
      now,
      opts
    );
  }

  /** Re-stitch only the legs placed under a named group. */
  scheduleGroup(
    group: string,
    now = performance.now(),
    opts?: { reverse?: boolean; seed?: number }
  ) {
    this.scheduleLegs(
      this.legs.filter((lg) => lg.group === group),
      now,
      opts
    );
  }

  private scheduleLegs(all: EngineLeg[], now: number, opts?: { reverse?: boolean; seed?: number }) {
    if (!all.length) return;
    const groups = new Map<string, EngineLeg[]>();
    for (const lg of all) {
      const g = `${lg.key}|${lg.layer}`;
      const arr = groups.get(g) ?? [];
      arr.push(lg);
      groups.set(g, arr);
    }
    // reuse unitDelay so playground timing matches the site vocabulary
    const cfgBase = {
      mode: this.motion.mode,
      stagger: this.motion.stagger,
      cols: this.cols,
      rows: this.rows,
      seed: opts?.seed ?? 7,
      order: this.motion.order,
      waveDir: this.motion.waveDir,
    };
    for (const legs of groups.values()) {
      const first = legs[0];
      const delay = unitDelay({ r: first.r, c: first.c, unit: 'cross', color: '' }, cfgBase);
      const reverse =
        opts?.reverse ??
        (this.motion.mode === 'uncoordinated' || this.motion.mode === 'random'
          ? Math.random() < 0.5
          : false);
      this.applyStitch(legs, now, delay, reverse);
    }
    this.loopAt = null;
    this.emitWake();
  }

  scheduleUnit(key: string, layer: number, now = performance.now()) {
    const legs = this.legs.filter((lg) => lg.key === key && lg.layer === layer);
    if (!legs.length) return;
    const reverse = this.motion.mode === 'uncoordinated' ? Math.random() < 0.5 : false;
    this.applyStitch(legs, now, 0, reverse);
    this.emitWake();
  }

  private applyStitch(legs: EngineLeg[], now: number, delay: number, reverse: boolean) {
    if (this.reducedMotion) {
      for (const lg of legs) {
        lg.t0 = 0;
        lg.t1 = 0;
        lg.progress = 1;
        lg.drawn = true;
        lg.reverse = false;
      }
      return;
    }
    const per = this.motion.speed / Math.max(1, legs.length);
    legs.forEach((lg, li) => {
      lg.t0 = now + delay + li * per * 0.75;
      lg.t1 = lg.t0 + per;
      lg.reverse = reverse;
      // reverse unstitch starts fully drawn (progress=1) and retracts to 0;
      // forward stitch starts hidden (progress=0) and grows to 1
      if (reverse) {
        // keep cloth offsets; these legs are visible; zeroing them would
        // snap every thread to rest pose the instant the unstitch schedules
        lg.progress = 1;
        lg.drawn = true;
      } else {
        lg.progress = 0;
        lg.drawn = false;
        lg.ox = lg.oy = lg.vx = lg.vy = 0;
      }
    });
  }

  /**
   * Cross-fade to a new field: every current cell is marked for removal and
   * scheduled to unstitch, while the new placements are added as a fresh
   * layer scheduled to stitch in; both using the *same* position-based
   * delay (from the current `motion` config), so the swap reads as one
   * continuous wave through the field instead of clear-then-redraw.
   * `restitchLagMs` shifts each cell's stitch-in behind its unstitch, so a
   * cell visibly empties before its replacement forms while the wave keeps
   * moving; 0 (default) retracts and re-forms simultaneously per cell.
   *
   * Set `motion.mode/order/waveDir/stagger/speed` for the incoming field
   * before calling. Call `settleCrossfade()` once `isSettled()` is true to
   * drop the now-invisible old layer.
   */
  crossfadeTo(
    newUnits: PlacedUnit[],
    opts: { material: ThreadKey; seed?: number; restitchLagMs?: number }
  ) {
    // drop any stale outgoing layer from a prior interrupted crossfade
    this.settleCrossfade();

    const now = performance.now();
    const cfgBase = {
      mode: this.motion.mode,
      stagger: this.motion.stagger,
      cols: this.cols,
      rows: this.rows,
      seed: opts.seed ?? 7,
      order: this.motion.order,
      waveDir: this.motion.waveDir,
    };
    const delayFor = (c: number, r: number) =>
      unitDelay({ r, c, unit: 'cross', color: '' }, cfgBase);

    // schedule unstitch only for the current (top, non-removing) layer per
    // cell; cells without a replacement wait until the wave tail passes
    const oldGroups = new Map<string, EngineLeg[]>();
    for (const [key, stack] of this.cells) {
      const topLayer = stack.length - 1;
      const top = stack[topLayer];
      if (!top || top.removing) continue;
      top.removing = true;
      for (const lg of this.legs) {
        if (lg.key !== key || lg.layer !== topLayer) continue;
        const g = `${lg.key}|${lg.layer}`;
        const arr = oldGroups.get(g) ?? [];
        arr.push(lg);
        oldGroups.set(g, arr);
      }
    }
    for (const legs of oldGroups.values()) {
      const first = legs[0];
      this.applyStitch(legs, now, delayFor(first.c, first.r), true);
    }

    // add incoming placements as a fresh layer on top of the outgoing one
    const newLegs: EngineLeg[] = [];
    for (const u of newUnits) {
      const key = `${u.c},${u.r}`;
      const stack = this.cells.get(key) ?? [];
      const layer = stack.length;
      const placed: EnginePlacement = {
        unit: u.unit,
        color: u.color,
        material: opts.material,
        opacity: u.opacity,
      };
      stack.push(placed);
      this.cells.set(key, stack);
      const node =
        Number.isInteger(u.c) && Number.isInteger(u.r) ? this.ensureNode(u.c, u.r) : null;
      this.buildPlacementLegs(key, u.c, u.r, node, placed, layer, null, newLegs);
    }
    this.legs.push(...newLegs);
    this.legsRev++;

    const newGroups = new Map<string, EngineLeg[]>();
    for (const lg of newLegs) {
      const g = `${lg.key}|${lg.layer}`;
      const arr = newGroups.get(g) ?? [];
      arr.push(lg);
      newGroups.set(g, arr);
    }
    const lag = opts.restitchLagMs ?? 0;
    for (const legs of newGroups.values()) {
      const first = legs[0];
      this.applyStitch(legs, now, delayFor(first.c, first.r) + lag, false);
    }

    this.loopAt = null;
    // static mode resolves both sweeps instantly; drop the outgoing layer
    // in the same frame so the two fields never render stacked
    if (this.reducedMotion) this.settleCrossfade();
    this.emitWake();
  }

  /**
   * Drop placements marked `removing` (fully unstitched by crossfadeTo) and
   * rebuild legs. Safe to call any time, a no-op once nothing is pending.
   */
  settleCrossfade() {
    // per touched cell: old layer index → post-prune index (-1 = removed)
    const remap = new Map<string, number[]>();
    for (const [key, stack] of this.cells) {
      if (!stack.some((p) => p.removing)) continue;
      const m: number[] = [];
      let next = 0;
      for (const p of stack) m.push(p.removing ? -1 : next++);
      remap.set(key, m);
      const kept = stack.filter((p) => !p.removing);
      if (kept.length > 0) this.cells.set(key, kept);
      else this.cells.delete(key);
    }
    if (remap.size === 0) return;

    // drop the removed layers' legs and re-key survivors to their new
    // layer index BEFORE rebuilding; a surviving layer shifts down after
    // the prune, and without the re-key its rebuilt legs would collide
    // with the removed layer's uids and inherit that retracted stitch
    // state (progress 0), blanking every cell both layouts shared
    const keptLegs: EngineLeg[] = [];
    for (const lg of this.legs) {
      const m = remap.get(lg.key);
      if (!m) {
        keptLegs.push(lg);
        continue;
      }
      const layer = m[lg.layer];
      if (layer === undefined || layer < 0) continue;
      if (layer !== lg.layer) {
        lg.layer = layer;
        lg.uid = `${lg.key}|${layer}|${lg.li}`;
      }
      keptLegs.push(lg);
    }
    this.legs = keptLegs;

    // rebuild the node lattice for the kept cells, carrying cloth state
    // over so the prune is invisible while sway/wind is mid-motion
    const prevNodes = new Map(this.nodes);
    this.nodes.clear();
    for (const key of this.cells.keys()) {
      const [c, r] = key.split(',').map(Number);
      if (!Number.isInteger(c) || !Number.isInteger(r)) continue;
      const n = this.ensureNode(c, r);
      const old = prevNodes.get(key);
      if (old) {
        n.ox = old.ox;
        n.oy = old.oy;
        n.vx = old.vx;
        n.vy = old.vy;
      }
    }
    this.rebuildLegs();
  }

  /**
   * Shift every pending stitch window forward by `dt` ms. Called by the
   * runtime after sleeping (offscreen / hidden tab) so mid-flight
   * animations resume where they paused instead of snapping to done.
   */
  shiftTimeline(dt: number) {
    if (dt <= 0) return;
    for (const lg of this.legs) {
      if (lg.t1 <= lg.t0) continue;
      // pending = the window still has visible work: a forward leg that
      // hasn't finished drawing, or a reverse leg still retracting;
      // reverse legs are drawn=true from schedule, so a !drawn check
      // alone would let their windows lapse while asleep and snap the
      // old layer away the moment the surface wakes
      const pending = lg.reverse ? lg.progress > 0 : !lg.drawn;
      if (pending) {
        lg.t0 += dt;
        lg.t1 += dt;
      }
    }
    if (this.loopAt != null) this.loopAt += dt;
    for (const q of this.travelQueue) q.at += dt;
  }

  addRipple(x: number, y: number) {
    if (!this.physicsEnabled) return;
    this.ripples.push({ x, y, t0: performance.now() });
    this.physicsIdle = false;
    this.emitWake();
  }

  /* ---------------- physics ---------------- */

  private physicsStep(): number {
    if (!this.physicsEnabled) {
      // capability gate; lattice never simulates; legs keep their rest
      // geometry (initialized at build) and the engine can settle
      this.physicsIdle = true;
      return 0;
    }
    const mode = this.physics.mode;
    // wind and sway are continuous, time-driven forces; never idle under them
    const continuous = mode === 'wind' || this.physics.sway;
    const excited = this.pointer.active || this.ripples.length > 0;
    if (this.physicsIdle && !excited && !continuous) return 0;

    let damp = 0.86;
    let couple = 0.14;
    let k = this.physics.spring / 1000;
    let gravity = 0;
    let magnet = false;
    let windForce = 0;
    if (mode === 'jelly') {
      damp = 0.94;
      couple = 0.34;
      k *= 0.5;
    } else if (mode === 'wind') {
      damp = 0.88;
      couple = 0.2;
      windForce = 1.0;
    } else if (mode === 'gravity') {
      damp = 0.9;
      couple = 0.16;
      gravity = 0.55;
    } else if (mode === 'magnet') {
      magnet = true;
    } else if (mode === 'ripple') {
      damp = 0.9;
      couple = 0.22;
    }

    const R = this.physics.radius;
    const boost = this.physics.intensity ?? 1;
    const grabForce = (this.pointer.down ? 1.9 : 0.55) * boost;
    const MAXN = this.cell * 0.5 * boost;
    const MAXO = this.cell * 0.32 * boost;
    const tms = performance.now();
    let motion = 0;

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      if (tms - this.ripples[i].t0 > 1400) this.ripples.splice(i, 1);
    }

    // pass 1, nodes
    for (const n of this.nodes.values()) {
      let fx = 0;
      let fy = 0;
      if (this.pointer.active) {
        const dx = n.cx + n.ox - this.pointer.x;
        const dy = n.cy + n.oy - this.pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const fall = 1 - d / R;
          const dirSign = magnet ? -1 : 1;
          const push = fall * fall * R * 0.9 * grabForce * dirSign;
          fx += (dx / d) * push;
          fy += (dy / d) * push;
        }
      }
      if (mode === 'ripple') {
        for (const rp of this.ripples) {
          const age = (tms - rp.t0) / 1400;
          const ringR = age * R * 2.2;
          const dx = n.cx + n.ox - rp.x;
          const dy = n.cy + n.oy - rp.y;
          const d = Math.hypot(dx, dy) || 1;
          const band = Math.exp(-(((d - ringR) / (this.cell * 1.2)) ** 2));
          const amp = (1 - age) * R * 0.9;
          fx += (dx / d) * band * amp;
          fy += (dy / d) * band * amp;
        }
      }
      if (windForce > 0) {
        const phase = tms * 0.004 - n.cx * 0.03 - n.cy * 0.01;
        fx += (Math.sin(phase) * 0.6 + 0.5) * windForce * 2.4;
        fy += Math.sin(phase * 1.7) * windForce * 0.9;
      }
      if (gravity > 0) fy += gravity * 3.0;
      if (this.physics.sway) {
        fx += Math.sin(tms * 0.001 + n.cy * 0.05) * 0.25;
        fy += Math.cos(tms * 0.0013 + n.cx * 0.05) * 0.25;
      }
      if (n.nbr.length > 0) {
        let ax = 0;
        let ay = 0;
        for (const nb of n.nbr) {
          ax += nb.ox;
          ay += nb.oy;
        }
        ax /= n.nbr.length;
        ay /= n.nbr.length;
        fx += (ax - n.ox) * couple * 40;
        fy += (ay - n.oy) * couple * 40;
      }
      n.vx = (n.vx + fx * 0.02 - n.ox * k) * damp;
      n.vy = (n.vy + fy * 0.02 - n.oy * k) * damp;
      n.ox += n.vx;
      n.oy += n.vy;
      const om = Math.hypot(n.ox, n.oy);
      if (om > MAXN) {
        const s = MAXN / om;
        n.ox *= s;
        n.oy *= s;
        n.vx *= 0.5;
        n.vy *= 0.5;
      }
      motion += Math.abs(n.vx) + Math.abs(n.vy);
    }

    // pass 2, legs chase their node, plus per-leg pointer response
    for (const lg of this.legs) {
      if (lg.progress <= 0) continue;
      if (lg.drawn && !lg.pinned) {
        const n = lg.node;
        const nx = n ? n.ox : 0;
        const ny = n ? n.oy : 0;
        lg.vx = (lg.vx + (nx - lg.ox) * 0.5) * 0.8;
        lg.vy = (lg.vy + (ny - lg.oy) * 0.5) * 0.8;
        if (this.pointer.active) {
          const mx = lg.mid[0] + lg.ox;
          const my = lg.mid[1] + lg.oy;
          const dx = mx - this.pointer.x;
          const dy = my - this.pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const fall = 1 - d / R;
            const dirSign = magnet ? -1 : 1;
            const scale = lg.motifFill ? 0.35 : 0.9;
            const push = fall * fall * grabForce * scale * dirSign;
            lg.vx += (dx / d) * push;
            lg.vy += (dy / d) * push;
          }
        }
        lg.ox += lg.vx;
        lg.oy += lg.vy;
        const maxo = lg.motifFill ? MAXO * 0.4 : MAXO;
        const om = Math.hypot(lg.ox, lg.oy);
        if (om > maxo) {
          const s = maxo / om;
          lg.ox *= s;
          lg.oy *= s;
        }
        motion += Math.abs(lg.vx) + Math.abs(lg.vy);
      }
      const belly = bellyFor(lg.motifFill);
      lg.x0 = lg.a[0];
      lg.y0 = lg.a[1];
      lg.x1 = lg.b[0];
      lg.y1 = lg.b[1];
      lg.cxp = lg.mid[0] + lg.ox * belly;
      lg.cyp = lg.mid[1] + lg.oy * belly;
    }

    // rest detection; threshold scales with body count so residual
    // sub-pixel velocities on large fields still count as "at rest"
    const eps = 0.05 + (this.nodes.size + this.legs.length) * 0.0004;
    this.physicsIdle = !excited && !continuous && motion < eps;
    return motion;
  }

  /* ---------------- timeline ---------------- */

  /** One frame: physics + reveal progress. Call from rAF before rendering. */
  tick(now = performance.now()): EngineTickResult {
    // fire due traveler steps (runTravel) before evaluating leg windows
    if (this.travelQueue.length) {
      const pending: typeof this.travelQueue = [];
      for (const q of this.travelQueue) {
        if (now < q.at) {
          pending.push(q);
          continue;
        }
        const legs = this.legs.filter((lg) => lg.latent && lg.group === q.group);
        const prevSpeed = this.motion.speed;
        this.motion.speed = q.stitchMs;
        this.applyStitch(legs, now, 0, q.reverse);
        this.motion.speed = prevSpeed;
      }
      this.travelQueue = pending;
    }

    const motion = this.physicsStep();
    let allDone = true;
    let anyStitching = false;
    let punches = 0;
    for (const lg of this.legs) {
      if (lg.t1 <= lg.t0) {
        // an unscheduled latent leg stays hidden (progress untouched)
        if (!lg.latent) {
          lg.progress = 1;
          lg.drawn = true;
        }
        continue;
      }
      let p = (now - lg.t0) / (lg.t1 - lg.t0);
      p = Math.max(0, Math.min(1, p));
      lg.progress = lg.reverse ? 1 - p : p;
      if (p >= 1 && !lg.drawn) {
        lg.drawn = true;
        punches++;
      }
      if (p < 1 && now >= lg.t0) {
        anyStitching = true;
        allDone = false;
      } else if (now < lg.t0) {
        allDone = false;
      }
    }

    // pending traveler steps are future work; keep the surface awake
    if (this.travelQueue.length) allDone = false;

    // loop cycles ride the tick (rAF-driven) instead of a setTimeout, so a
    // sleeping/offscreen surface stops looping instead of burning invisibly
    const looping = this.motion.loop && !this.reducedMotion;
    if (looping && allDone && this.legs.length) {
      if (this.loopAt == null) {
        this.loopAt = now + LOOP_REST;
      } else if (now >= this.loopAt) {
        this.scheduleAll(now);
        allDone = false;
      }
    } else if (!looping) {
      this.loopAt = null;
    }

    this.settled = allDone && !anyStitching && this.physicsIdle && !looping;
    return { anyStitching, allDone, punches, motion };
  }

  dispose() {
    this.wakeListeners.clear();
  }
}

/** point on a quadratic bezier */
export function quadPoint(
  t: number,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number
): [number, number] {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}
