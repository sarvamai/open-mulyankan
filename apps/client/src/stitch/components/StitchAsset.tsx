'use client';

import { useEffect, useState } from 'react';

import { ASSET_HOVER_PHYSICS, assetStitchAnim } from '../lib/presets';
import type { ImageStitchConfig } from '../lib/imageStitch';
import {
  pickThemedConfig,
  type StitchTheme,
  type ThemedStitchConfig,
} from '../lib/core';
import { toMonochromeStitchConfig } from '../lib/monochrome';
import {
  toSoftCornerStitchConfig,
  type SmoothCornerStrength,
} from '../lib/softCorners';
import { useStitchTheme } from './useStitchTheme';
// Direct import — the client has no SSR, so the next/dynamic ssr:false wrapper
// the reference repo uses has nothing to guard against here.
import StitchComposition from './StitchComposition';

type StitchConfig = ImageStitchConfig | ThemedStitchConfig;

type StitchAssetBaseProps = {
  width?: number | string;
  height?: number | string;
  className?: string;
  /**
   * Draw-on stitch animation on mount. Default `false` — product marks paint
   * already woven; motion is hover cloth (`physics`). Pass `true` only for
   * deliberate reveals (product intro, library motion toggle).
   */
  animate?: boolean;
  /** Pointer-cloth hover response, normalized site-wide via ASSET_HOVER_PHYSICS. */
  physics?: boolean;
  /** Force a theme; defaults to the app theme (`useStitchTheme`). Plain configs ignore it. */
  theme?: StitchTheme;
  /**
   * Supersample multiplier on top of DPR. Default `1` (cheap). Pass `2`–`4`
   * only for small icons where 1× aliases — never for large heroes; static
   * mode still pays the framebuffer cost on first paint.
   */
  resolutionScale?: number;
  /**
   * Stretch to fill the parent box on both axes (cells scale non-uniformly).
   * `width`/`height` then only serve as the nominal on-screen size for
   * physics tuning — pass the size the asset typically renders at.
   */
  fill?: boolean;
  /**
   * Multiplier on the canonical hover cloth (deflection + radius). Use >1 for
   * large hero panels where the default screen-px targets feel too subtle.
   */
  physicsScale?: number;
  /**
   * Scale so the larger side is `maxSize` px, preserving aspect. Only applies
   * with `id` when width/height are omitted.
   */
  maxSize?: number;
  /**
   * Render at this many px per cell. With `id`, overrides the registry's
   * authored cell size. Ignored when an explicit `width`/`height` is passed.
   */
  cellPx?: number;
  /**
   * Multiply the authored cell size — `cellScale={2}` doubles both axes.
   * Only applies with `id`. Ignored when `cellPx` or `width`/`height` is passed.
   */
  cellScale?: number;
  /** Remap onto a single-hue shade ramp (dominant hue kept). Only with `id`. */
  monochrome?: boolean;
  /**
   * Chamfer outer silhouette corners (`subtle` / `medium` / `strong`).
   * Only with `id`. Default `off`.
   */
  smoothCorners?: SmoothCornerStrength;
};

type StitchAssetProps =
  | (StitchAssetBaseProps & {
      /** Baked config (library tiles, direct motif imports). */
      config: StitchConfig;
      id?: never;
    })
  | (StitchAssetBaseProps & {
      /**
       * Product registry id — lazy-loads only that motif module
       * (`../product-registry`). Prefer this on product pages.
       */
      id: string;
      config?: never;
    });

/**
 * Renders a baked stitch composition as a small decorative asset.
 *
 * Pass either `config` (tree-shakeable direct import / library entry) or `id`
 * (lazy lookup in the shared product registry — same pattern as product intro).
 *
 * Draw-on timing uses the canonical `assetStitchAnim`; hover uses
 * `ASSET_HOVER_PHYSICS` from `lib/presets.ts`. Call sites choose `animate` /
 * `physics` on or off — `animate` defaults off so empty states and cards
 * paint settled; opt in for hero reveals.
 */
export default function StitchAsset(props: StitchAssetProps) {
  // Discriminate on `'id' in props` — a truthy `props.id` check does not narrow
  // the XOR union enough for `props.config` (TS still sees `config?: never`).
  if ('id' in props && typeof props.id === 'string') {
    return <StitchAssetFromId {...props} id={props.id} />;
  }
  return <StitchAssetWithConfig {...props} config={props.config} />;
}

function StitchAssetFromId({
  id,
  width,
  height,
  maxSize,
  cellPx: cellPxOverride,
  cellScale = 1,
  monochrome = false,
  smoothCorners = 'off',
  theme,
  ...rest
}: StitchAssetBaseProps & { id: string }) {
  const [loaded, setLoaded] = useState<{
    config: StitchConfig;
    cellPx: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    // Dynamic import keeps the product registry out of config-only StitchAsset chunks.
    void import('../product-registry').then(({ loadProductStitchConfig }) => {
      if (cancelled) return;
      void loadProductStitchConfig(id).then((result) => {
        if (cancelled) return;
        if (!result) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn(`StitchAsset: no product registry entry for id "${id}"`);
          }
          return;
        }
        setLoaded(result);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!loaded) return null;

  const authoredCellPx = loaded.cellPx;
  const cellPx = cellPxOverride ?? authoredCellPx * cellScale;
  const resolved = pickThemedConfig(loaded.config, theme ?? 'light');
  const canonicalW = resolved.cols * cellPx;
  const canonicalH = resolved.rows * cellPx;

  let finalW = width ?? canonicalW;
  let finalH = height ?? canonicalH;
  if (width == null && height == null && maxSize) {
    const scale = maxSize / Math.max(canonicalW, canonicalH);
    finalW = Math.round(canonicalW * scale);
    finalH = Math.round(canonicalH * scale);
  }

  // Transforms need a resolved ImageStitchConfig. With none applied, keep the
  // themed pair so StitchAssetWithConfig can re-resolve against the live theme.
  let displayConfig: StitchConfig = loaded.config;
  if (smoothCorners !== 'off' || monochrome) {
    let next = resolved;
    if (smoothCorners !== 'off') {
      next = toSoftCornerStitchConfig(next, smoothCorners);
    }
    if (monochrome) {
      next = toMonochromeStitchConfig(next);
    }
    displayConfig = next;
  }

  return (
    <StitchAssetWithConfig
      {...rest}
      config={displayConfig}
      width={finalW}
      height={finalH}
      theme={theme}
    />
  );
}

function StitchAssetWithConfig({
  config,
  width = 120,
  height = 120,
  className,
  animate = false,
  physics = false,
  resolutionScale = 1,
  fill = false,
  physicsScale = 1,
  theme,
}: StitchAssetBaseProps & { config: StitchConfig }) {
  const appTheme = useStitchTheme();
  // Themed pairs are pre-baked per theme, so this returns a referentially
  // stable config per theme — units identity holds across renders.
  const resolved = pickThemedConfig(config, theme ?? appTheme);
  // Hero panels (e.g. product intro) keep a slightly longer weave so the
  // draw-on reads on a large surface; small assets stay on the canonical preset.
  const anim =
    physicsScale > 1
      ? { mode: 'wave' as const, legDur: 160, stagger: 8, waveDir: 'down' as const }
      : { ...assetStitchAnim };
  const finalConfig = { ...resolved, anim };

  // The engine's deflection caps and cursor radius are in grid-cell units,
  // so identical settings feel huge on a sparse 6×6 pictogram and invisible
  // on a dense 44×44 composition. Convert the screen-px targets from
  // ASSET_HOVER_PHYSICS into this asset's cell units so hover feels the
  // same regardless of grid density or rendered size.
  const widthPx = typeof width === 'number' ? width : typeof height === 'number' ? height : 120;
  const displayCellPx = widthPx / resolved.cols;
  // Engine cap: deflection = cell * 0.5 * intensity (screen: displayCellPx * 0.5 * intensity)
  const toIntensity = (deflectionPx: number) =>
    (deflectionPx * physicsScale) / (0.5 * displayCellPx);
  const toRadiusCells = (radiusPx: number) => (radiusPx * physicsScale) / displayCellPx;
  const physicsIntensity = toIntensity(ASSET_HOVER_PHYSICS.deflectionPx);
  const physicsRadiusCells = toRadiusCells(ASSET_HOVER_PHYSICS.radiusPx);
  const hoverPhysics = {
    intensity: toIntensity(ASSET_HOVER_PHYSICS.hoverDeflectionPx),
    radiusCells: toRadiusCells(ASSET_HOVER_PHYSICS.hoverRadiusPx),
    riseMs: ASSET_HOVER_PHYSICS.riseMs,
    fallMs: ASSET_HOVER_PHYSICS.fallMs,
  };

  return (
    <div className={className} style={fill ? { width: '100%', height: '100%' } : { width, height }}>
      <StitchComposition
        config={finalConfig}
        animate={animate}
        physics={physics}
        physicsMode="cloth"
        physicsIntensity={physicsIntensity}
        physicsRadiusCells={physicsRadiusCells}
        hoverPhysics={hoverPhysics}
        renderCellPx="fill"
        fillHeight={fill}
        resolutionScale={resolutionScale}
      />
    </div>
  );
}
