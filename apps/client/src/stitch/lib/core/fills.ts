/**
 * Fill helpers — map a bare silhouette (`Array<[row, col]>`) to stitched
 * `PlacedUnit`s in the house cloth-fill idiom. Dense cloth fills only; never
 * single-thread units (they read as scratchy lines at 6px).
 */

import type { PlacedUnit, UnitKey } from '../units';
import { cell } from './cells';
import { TOPIC_MARKER_COLORS, TOPIC_MARKER_UNITS } from './palette';

/** Map a filled silhouette through the seeded topic-marker patchwork cycle. */
export function patchwork(silhouette: Array<[number, number]>, seed: number): PlacedUnit[] {
  return silhouette.map(([r, c], i) =>
    cell(
      r,
      c,
      TOPIC_MARKER_UNITS[(seed + i) % TOPIC_MARKER_UNITS.length],
      TOPIC_MARKER_COLORS[(seed + i * 2) % TOPIC_MARKER_COLORS.length]
    )
  );
}

/** Map a silhouette through cycling cloth units in a single flat color (for "copy" ghosts). */
export function tinted(silhouette: Array<[number, number]>, color: string, seed = 0): PlacedUnit[] {
  return silhouette.map(([r, c], i) =>
    cell(r, c, TOPIC_MARKER_UNITS[(seed + i) % TOPIC_MARKER_UNITS.length], color)
  );
}

/**
 * Solid fill: every cell gets the SAME unit and color. For motifs whose
 * texture is hand-picked per shape (Explore pictograms, product glyphs)
 * rather than derived from the seeded cycle.
 */
export function solid(
  silhouette: Array<[number, number]>,
  unit: UnitKey,
  color: string
): PlacedUnit[] {
  return silhouette.map(([r, c]) => cell(r, c, unit, color));
}

/**
 * Quilt-block fill: color and unit vary per BLOCK of cells, not per cell,
 * so dense grids read as calm patches of cloth instead of per-cell
 * confetti. Position-derived (not index-derived), so separate silhouettes
 * (a bubble and its tail) blend seamlessly.
 */
export function quilted(
  silhouette: Array<[number, number]>,
  colors: string[],
  units: UnitKey[],
  block = 3
): PlacedUnit[] {
  return silhouette.map(([r, c]) => {
    const br = Math.floor(r / block);
    const bc = Math.floor(c / block);
    return cell(r, c, units[(br * 2 + bc) % units.length], colors[(br * 3 + bc) % colors.length]);
  });
}
