/**
 * Minimal type definitions for baked image-stitch compositions.
 * Only includes what StitchComposition needs to render.
 */

import type { AnimConfig, PlacedUnit, StitchStyle, UnitKey } from './units';

export const IMAGE_STITCH_CONFIG_VERSION = 1;

export type ImageStitchMode = 'fill' | 'outline' | 'alpha';
export type ImageColorMode = 'mono' | 'sampled' | 'palette' | 'byUnit';
export type ImageUnitSource =
  | 'bands'
  | 'random'
  | 'bandPools'
  | 'density'
  | 'gradient'
  | 'hue'
  | 'posterize'
  | 'edgeFill';

export interface ImageStitchRecipe {
  mode: ImageStitchMode;
  threshold: number;
  invert: boolean;
  colorMode: ImageColorMode;
  detail: number;
  resolution: number;
  unitSource: ImageUnitSource;
  unitLight: UnitKey;
  unitMid: UnitKey;
  unitDark: UnitKey;
  randomUnits: UnitKey[];
  unitSeed: number;
  unitColors: Partial<Record<UnitKey, string>>;
  contrastStretch?: boolean;
  posterizeLevels?: number;
  dither?: boolean;
  fillBackground?: boolean;
  bgUnits?: UnitKey[];
  bgColor?: string;
  poolsLight?: UnitKey[];
  poolsMid?: UnitKey[];
  poolsDark?: UnitKey[];
}

/**
 * Click-triggered traveler animation: a small motif (e.g. a flag) that
 * hops along `path` when the rendered asset is clicked. Geometry lives
 * here per asset; timing is canonical (ASSET_CLICK_ANIM in presets.ts).
 */
export interface ClickAnimConfig {
  /** Traveler cells; `r`/`c` are offsets relative to the current path anchor. */
  traveler: PlacedUnit[];
  /** Anchor waypoints ([row, col]) the traveler visits, in order. */
  path: Array<[number, number]>;
}

export interface ImageStitchConfig {
  version: typeof IMAGE_STITCH_CONFIG_VERSION;
  name?: string;
  cols: number;
  rows: number;
  cell: number;
  insetPct: number;
  style: StitchStyle;
  anim: AnimConfig;
  units: PlacedUnit[];
  recipe?: ImageStitchRecipe;
  /** Optional click-triggered traveler run (e.g. the roadmap's finishing flag). */
  clickAnim?: ClickAnimConfig;
}
