/**
 * Cell + silhouette primitives shared by every motif builder.
 *
 * A "silhouette" is a bare `Array<[row, col]>` (which cells are filled); a
 * `PlacedUnit` is a stitched cell (`{ r, c, unit, color }`). The fill helpers
 * in `./fills` turn silhouettes into placed units; these helpers build and
 * transform the silhouettes themselves.
 */

import type { PlacedUnit, UnitKey } from '../units';

/** A single stitched cell. */
export function cell(r: number, c: number, unit: UnitKey, color: string): PlacedUnit {
  return { r, c, unit, color };
}

/** Stamp a set of `[dr, dc, unit, color]` offsets around an anchor, clipped to the grid. */
export function stamp(
  out: PlacedUnit[],
  anchorR: number,
  anchorC: number,
  offsets: Array<[number, number, UnitKey, string]>,
  cols: number,
  rows: number
): void {
  for (const [dr, dc, unit, color] of offsets) {
    const r = anchorR + dr;
    const c = anchorC + dc;
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      out.push(cell(r, c, unit, color));
    }
  }
}

/** Translate a silhouette by (dr, dc) — place a shape at an anchor. */
export function offsetSilhouette(
  silhouette: Array<[number, number]>,
  dr: number,
  dc: number
): Array<[number, number]> {
  return silhouette.map(([r, c]) => [r + dr, c + dc]);
}

/**
 * Axis-aligned rect of cells with corners cut for a rounded read.
 * `cornerRadius` is the Manhattan distance from each corner that gets cut;
 * 1 (default) trims just the corner cell, 3 gives a visible curve on
 * large shapes.
 */
export function roundedRectCells(
  rows: number,
  cols: number,
  cornerRadius = 1
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dr = Math.min(r, rows - 1 - r);
      const dc = Math.min(c, cols - 1 - c);
      if (dr + dc < cornerRadius) continue;
      out.push([r, c]);
    }
  }
  return out;
}

/** Disc of cells inside a size×size box (radius² in cell units). */
export function discCells(size: number, radiusSq: number): Array<[number, number]> {
  const mid = (size - 1) / 2;
  const out: Array<[number, number]> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r - mid) ** 2 + (c - mid) ** 2 <= radiusSq) out.push([r, c]);
    }
  }
  return out;
}

/** Annulus of cells inside a size×size box (inner/outer radius² in cell units). */
export function ringCells(size: number, innerSq: number, outerSq: number): Array<[number, number]> {
  const mid = (size - 1) / 2;
  const out: Array<[number, number]> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const d = (r - mid) ** 2 + (c - mid) ** 2;
      if (d >= innerSq && d <= outerSq) out.push([r, c]);
    }
  }
  return out;
}
