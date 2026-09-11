/**
 * bakeConfig — wrap a built `{ cols, rows, units }` in the canonical
 * ImageStitchConfig envelope (version, cell size, style, draw-on anim) so
 * StitchAsset can render it. Every motif ends here.
 *
 * The style/anim baked here are defaults; StitchAsset overrides the draw-on
 * and hover with the canonical presets at render time. Author geometry only.
 */

import type { ClickAnimConfig, ImageStitchConfig } from '../imageStitch';
import { SITE_CELL_SIZE, type PlacedUnit } from '../units';
import { C } from './palette';

export interface BuiltMotif {
  cols: number;
  rows: number;
  units: PlacedUnit[];
  clickAnim?: ClickAnimConfig;
}

export function bakeConfig(name: string, built: BuiltMotif): ImageStitchConfig {
  return {
    version: 1,
    name,
    cols: built.cols,
    rows: built.rows,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: C.red, width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units: built.units,
    ...(built.clickAnim ? { clickAnim: built.clickAnim } : {}),
  };
}
