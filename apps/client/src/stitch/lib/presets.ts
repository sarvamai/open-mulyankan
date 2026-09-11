/**
 * Trimmed stitch presets for the platform frontend.
 *
 * The full sarvam-epoch presets.ts is 4144 lines and pulls in
 * epochLogoStitch, svgStitch, imageStitch, and epochColors (plus a
 * runtime fetch of /epoch-logo.svg). StitchField only needs the
 * constants below, so this file stays minimal. If you adopt more stitch
 * surfaces later, copy the relevant exports from the epoch repo.
 */

import { THREAD, type StitchStyle, type AnimConfig } from './units';

/** Thread material for every site runtime surface; matte cotton, less shader lift. */
export const SITE_THREAD_MATERIAL = 'siteCotton' as const;

/** Home hero, deeper navy with richer satin highlights. */
export const HERO_THREAD_MATERIAL = 'heroCotton' as const;

/**
 * Canonical pointer-cloth physics, shared by every runtime surface
 * (StitchField and LogoFooter) so the fabric feels identical site-wide.
 * `radiusCells` scales by the engine cell to stay resolution-independent.
 */
export const SITE_CLOTH_PHYSICS = {
  spring: 14,
  radiusCells: 3.5,
  sway: false,
} as const;

/** Canonical thread look; shared across footer, divider, and stitch fields. */
export const siteStitchStyle: StitchStyle = {
  color: THREAD.ink,
  width: 3.0,
  sheen: true,
  shadow: false,
  holes: false,
};

/** Canonical draw-on animation, wave sweeps left to right. */
export const siteStitchAnim: AnimConfig = {
  mode: 'wave',
  legDur: 180,
  stagger: 8,
  waveDir: 'right',
};

/**
 * Canonical draw-on animation for StitchAsset surfaces. Every asset uses
 * this regardless of what its baked config carries, so the stitch-in feel
 * is uniform site-wide. Tune here, changes apply everywhere.
 */
export const assetStitchAnim: AnimConfig = {
  mode: 'wave',
  legDur: 120,
  stagger: 4,
  waveDir: 'right',
};

/**
 * Canonical timing for click-triggered traveler animations (assets whose
 * config carries a `clickAnim`, e.g. the roadmap's finishing flag). The
 * traveler moves at constant speed along its path; tune here, changes
 * everywhere.
 */
export const ASSET_CLICK_ANIM = {
  /** ms to travel one grid cell */
  cellMs: 18,
  /** cells between traveler waypoints (hop granularity vs leg count) */
  stepCells: 3,
} as const;

/**
 * Canonical hover-cloth response for StitchAsset, in SCREEN pixels.
 *
 * The engine's deflection caps and cursor radius live in grid-cell units,
 * so the same numbers feel wildly different across assets: a 6×6 pictogram
 * at 36px wobbles by a third of its size while a 44×44 composition at
 * 120px barely moves. Expressing the targets in screen px and letting
 * StitchAsset normalize per config makes every asset feel identical.
 *
 * Two registers: `rest` is what the cloth gives the instant a cursor
 * crosses it, `hover` is where it settles while the cursor stays — the
 * cloth loosens, the grab reaches further, and an all-over drape rustle
 * turns on. `riseMs`/`fallMs` ease between them so arriving and leaving
 * both read as one continuous motion rather than a jolt.
 *
 * Rest values are tuned to the MCP cherry blossom (44×44 grid at 120px),
 * the reference for the site-wide subtle effect.
 */
export const ASSET_HOVER_PHYSICS = {
  /** Cursor influence radius on screen, px. */
  radiusPx: 20,
  /** Max thread deflection on screen, px. */
  deflectionPx: 5.5,
  /** Influence radius once the cursor has settled on the asset, px. */
  hoverRadiusPx: 28,
  /** Max thread deflection once the cursor has settled, px. */
  hoverDeflectionPx: 8,
  /** Ease into the hover register, ms. */
  riseMs: 220,
  /** Ease back out after the cursor leaves, ms. */
  fallMs: 520,
} as const;
