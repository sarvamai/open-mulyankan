'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StitchEngine, type PhysicsMode } from '../lib/engine';
import { useStitchRuntime } from '../lib/useStitchRuntime';
import {
  ASSET_CLICK_ANIM,
  SITE_CLOTH_PHYSICS,
  SITE_THREAD_MATERIAL,
} from '../lib/presets';
import type { ClickAnimConfig, ImageStitchConfig } from '../lib/imageStitch';
import { COMPOSITION_CELL_SIZE, type PlacedUnit, type ThreadKey } from '../lib/units';

const LAYER_CLASS = 'absolute inset-0 block size-full pointer-events-none';

interface TravelPlan {
  groups: Array<{ group: string; units: PlacedUnit[] }>;
  steps: Array<{ group: string; at: number }>;
  stitchMs: number;
}

/**
 * Expand a config's `clickAnim` into engine-ready latent groups and a
 * timed step list: the waypoint path is walked cell by cell, sampled
 * every `stepCells`, and each sample becomes one traveler position.
 * Timing is canonical (ASSET_CLICK_ANIM) — assets only author geometry.
 */
function planClickAnim(anim: ClickAnimConfig): TravelPlan {
  const { cellMs, stepCells } = ASSET_CLICK_ANIM;
  const trail: Array<[number, number]> = [];
  anim.path.forEach(([r, c], i) => {
    if (i === 0) {
      trail.push([r, c]);
      return;
    }
    const [r0, c0] = anim.path[i - 1];
    const len = Math.max(Math.abs(r - r0), Math.abs(c - c0), 1);
    for (let k = 1; k <= len; k++) {
      trail.push([Math.round(r0 + ((r - r0) * k) / len), Math.round(c0 + ((c - c0) * k) / len)]);
    }
  });
  const anchors: Array<{ r: number; c: number; dist: number }> = [];
  for (let i = 0; i < trail.length; i += stepCells) {
    anchors.push({ r: trail[i][0], c: trail[i][1], dist: i });
  }
  const last = trail.length - 1;
  if (anchors[anchors.length - 1].dist !== last) {
    anchors.push({ r: trail[last][0], c: trail[last][1], dist: last });
  }
  return {
    groups: anchors.map((a, i) => ({
      group: `click-travel-${i}`,
      units: anim.traveler.map((u) => ({ ...u, r: u.r + a.r, c: u.c + a.c })),
    })),
    steps: anchors.map((a, i) => ({ group: `click-travel-${i}`, at: a.dist * cellMs })),
    stitchMs: stepCells * cellMs,
  };
}

/**
 * Renders a baked image-stitch composition: explicit unit placements
 * exported from the playground. Use instead of StitchField when the
 * layout comes from an ImageStitchConfig, not a procedural FieldConfig.
 *
 * Mounts through `useStitchRuntime()`, shared WebGL context, scheduler-gated.
 */
export default function StitchComposition({
  config,
  className,
  animate = true,
  reveal: _reveal = true,
  physics = true,
  physicsMode = 'cloth',
  physicsIntensity = 1,
  physicsRadiusCells = SITE_CLOTH_PHYSICS.radiusCells,
  hoverPhysics,
  ambient = false,
  pad = 0,
  renderCellPx = COMPOSITION_CELL_SIZE,
  fillHeight = false,
  onStitchProgress,
  material = SITE_THREAD_MATERIAL,
  resolutionScale,
}: {
  config: ImageStitchConfig;
  className?: string;
  animate?: boolean;
  /** kept for API compat, visibility is gated by the stitch scheduler */
  reveal?: boolean;
  /** Enable physics simulation (wind, cloth pointer interaction, etc.) */
  physics?: boolean;
  /** Physics mode when `physics` is true. Wind runs continuously; cloth is pointer-reactive. */
  physicsMode?: PhysicsMode;
  /**
   * Pointer response multiplier. Deflection caps live in canvas units, so
   * surfaces rendered well below native cell size need >1 to stay visible.
   */
  physicsIntensity?: number;
  /**
   * Cursor influence radius in cells. The site default suits near-native
   * rendering; small assets need more cells under the cursor to react.
   */
  physicsRadiusCells?: number;
  /**
   * Amplified pointer response the surface eases into while the cursor is over
   * it, and eases back out of on leave. Applied imperatively, so hovering never
   * rebuilds the field or restarts the stitch-in. Cloth mode only.
   */
  hoverPhysics?: {
    intensity: number;
    radiusCells: number;
    riseMs: number;
    fallMs: number;
  };
  /**
   * Keep the surface continuously alive with idle sway (drape rustle) instead
   * of settling and sleeping after the stitch-in. Works alongside cloth
   * pointer reactivity; use for ambient backgrounds.
   */
  ambient?: boolean;
  pad?: number;
  /**
   * On-screen cell size in px. Defaults to COMPOSITION_CELL_SIZE (16) for
   * baked exports. Pass `"fill"` to stretch to the parent width (e.g.
   * ImageStitchFromSource with fitCellPx).
   */
  renderCellPx?: number | 'fill';
  /** With `renderCellPx="fill"`, stretch to parent height instead of aspect-ratio letterboxing. */
  fillHeight?: boolean;
  /** Normalized stitch-in progress (0–1), averaged across legs. */
  onStitchProgress?: (progress: number) => void;
  /** Thread material override, defaults to site cotton. */
  material?: ThreadKey;
  /** Supersample multiplier for surfaces rendered far below native size. */
  resolutionScale?: number;
}) {
  const { cols, rows, cell, style, anim, units, clickAnim } = config;

  const [engine] = useState(() => new StitchEngine(cols, rows, cell, pad));

  const travel = useMemo(() => (clickAnim ? planClickAnim(clickAnim) : null), [clickAnim]);

  const onStitchProgressRef = useRef(onStitchProgress);
  useEffect(() => {
    onStitchProgressRef.current = onStitchProgress;
  }, [onStitchProgress]);

  const onTick = useCallback(() => {
    const report = onStitchProgressRef.current;
    if (!report || engine.legs.length === 0) return;
    let sum = 0;
    for (const leg of engine.legs) sum += leg.progress;
    report(sum / engine.legs.length);
  }, [engine]);

  const { hostRef, runtimeRef } = useStitchRuntime({
    engine,
    renderer: 'webgl',
    layerClass: LAYER_CLASS,
    resolutionScale,
    onTick,
  });

  /* eslint-disable react-hooks/immutability -- StitchEngine is a mutable
       imperative class instance stored in useState for stable identity;
       direct mutation is its intended API (see ARCHITECTURE.md). */

  // 0 at rest, 1 with the cursor settled on the surface. Held in a ref and
  // written straight onto the engine so hovering never re-renders the tree or
  // re-runs the effect below (which would reload the field).
  const hoverTRef = useRef(0);
  const rampRef = useRef<number | null>(null);
  const swayAlways = ambient || physicsMode === 'wind' || SITE_CLOTH_PHYSICS.sway;
  // Read as primitives: call sites build `hoverPhysics` inline, and a fresh
  // object identity per render would otherwise reload the whole field.
  const hoverIntensity = hoverPhysics?.intensity;
  const hoverRadiusCells = hoverPhysics?.radiusCells;
  const riseMs = hoverPhysics?.riseMs ?? 0;
  const fallMs = hoverPhysics?.fallMs ?? 0;

  const applyPhysics = useCallback(
    (t: number) => {
      if (!physics) {
        engine.physics.mode = 'cloth';
        engine.physics.sway = false;
        engine.physics.radius = 0;
        engine.physics.intensity = 1;
        return;
      }
      const lerp = (from: number, to: number | undefined) =>
        to === undefined ? from : from + (to - from) * t;
      engine.physics.mode = physicsMode;
      engine.physics.spring = SITE_CLOTH_PHYSICS.spring;
      engine.physics.intensity = lerp(physicsIntensity, hoverIntensity);
      engine.physics.radius = cell * lerp(physicsRadiusCells, hoverRadiusCells);
      // The drape rustle runs only while the cursor is on the surface, so an
      // untouched asset settles and the runtime sleeps. Its amplitude is capped
      // by `intensity`, so it fades with the ramp instead of cutting out.
      engine.physics.sway = swayAlways || t > 0.01;
    },
    [
      engine,
      physics,
      physicsMode,
      physicsIntensity,
      physicsRadiusCells,
      hoverIntensity,
      hoverRadiusCells,
      cell,
      swayAlways,
    ]
  );

  const rampHover = useCallback(
    (to: number) => {
      if (hoverIntensity === undefined || !physics) return;
      if (rampRef.current !== null) cancelAnimationFrame(rampRef.current);
      const from = hoverTRef.current;
      const dur = to > from ? riseMs : fallMs;
      const t0 = performance.now();
      const step = () => {
        const p = dur > 0 ? Math.min(1, (performance.now() - t0) / dur) : 1;
        const eased = p * p * (3 - 2 * p);
        hoverTRef.current = from + (to - from) * eased;
        applyPhysics(hoverTRef.current);
        engine.wakePhysics();
        runtimeRef.current?.wake();
        rampRef.current = p < 1 ? requestAnimationFrame(step) : null;
      };
      rampRef.current = requestAnimationFrame(step);
    },
    [applyPhysics, engine, hoverIntensity, riseMs, fallMs, physics, runtimeRef]
  );

  useEffect(
    () => () => {
      if (rampRef.current !== null) cancelAnimationFrame(rampRef.current);
    },
    []
  );

  useEffect(() => {
    engine.pad = pad;
    engine.motion.mode = anim.mode;
    engine.motion.order = anim.order ?? 'ltr';
    engine.motion.waveDir = anim.waveDir ?? 'right';
    engine.motion.stagger = anim.stagger;
    engine.motion.speed = Math.max(1, anim.legDur * 2);
    engine.motion.loop = false;
    engine.widthScale = style.width / 2.6;
    engine.sheen = style.sheen;
    engine.castShadow = style.shadow ?? true;
    applyPhysics(hoverTRef.current);
    engine.wakePhysics();

    engine.setGrid(cols, rows, cell);
    engine.loadPlaced(units, {
      material,
      schedule: animate,
    });
    if (!animate) engine.revealAll();
    if (travel) engine.loadLatentGroups(travel.groups, material);
    runtimeRef.current?.wake();
    /* eslint-enable react-hooks/immutability */
  }, [
    engine,
    runtimeRef,
    cols,
    rows,
    cell,
    pad,
    style.width,
    style.sheen,
    style.color,
    style.shadow,
    anim.mode,
    anim.legDur,
    anim.stagger,
    anim.order,
    anim.waveDir,
    units,
    animate,
    applyPhysics,
    material,
    travel,
  ]);

  const w = cols * cell + pad * 2;
  const h = rows * cell + pad * 2;

  const toEngineXY = (e: React.PointerEvent): [number, number] => {
    const host = hostRef.current!;
    const b = host.getBoundingClientRect();
    return [
      ((e.clientX - b.left) / b.width) * engine.W,
      ((e.clientY - b.top) / b.height) * engine.H,
    ];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = toEngineXY(e);
    engine.setPointer(x, y, { down: true, active: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = toEngineXY(e);
    engine.setPointer(x, y, { active: true });
    // Covers a cursor that was already inside when the canvas mounted, so it
    // never sits on a surface stuck at the rest register.
    if (hoverTRef.current < 1 && rampRef.current === null) rampHover(1);
  };
  const enterPointer = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    rampHover(1);
  };
  const endPointer = () => {
    engine.releasePointer();
  };
  const leavePointer = () => {
    engine.clearPointer();
    rampHover(0);
  };

  const pointerPhysics = physics && physicsMode === 'cloth';

  const onClickTravel = travel
    ? () => {
        engine.runTravel(travel.steps, travel.stitchMs);
      }
    : undefined;

  const width = renderCellPx === 'fill' ? '100%' : cols * renderCellPx + pad * 2;

  return (
    <div
      className={className}
      style={
        renderCellPx === 'fill' && fillHeight
          ? { position: 'relative', width: '100%', height: '100%' }
          : {
              position: 'relative',
              width,
              aspectRatio: `${w} / ${h}`,
            }
      }
      role="presentation"
      aria-hidden="true"
    >
      <div
        ref={hostRef}
        className={pointerPhysics ? 'absolute inset-0 touch-pan-y' : 'absolute inset-0'}
        onPointerDown={pointerPhysics ? onPointerDown : undefined}
        onPointerEnter={pointerPhysics ? enterPointer : undefined}
        onPointerMove={pointerPhysics ? onPointerMove : undefined}
        onPointerUp={pointerPhysics ? endPointer : undefined}
        onPointerLeave={pointerPhysics ? leavePointer : undefined}
        onClick={onClickTravel}
      />
    </div>
  );
}
