/**
 * Monochrome treatment for a baked stitch config: keep the composition's
 * dominant hue and remap every other cloth colour (and ink/black) onto a
 * brick-offset shade ramp of that hue — an organic single-hue patchwork, not a
 * flat recolour. Shared so both the library playgrounds and product placements
 * (e.g. `StitchAsset id="…" monochrome`) render the same way.
 */

import { TATVA_INK } from './core/tatvaPalette';
import type { ImageStitchConfig } from './imageStitch';
import { shade, type PlacedUnit } from './units';

function normalizeHex(hex: string): string {
  return hex.replace('#', '').toLowerCase();
}

const INK = normalizeHex(TATVA_INK);

function isBlackish(hex: string): boolean {
  const n = normalizeHex(hex);
  if (n === INK) return true;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return r + g + b < 48;
}

/** Most-used non-black thread colour in the composition. */
function dominantHue(units: readonly PlacedUnit[]): string | null {
  const counts = new Map<string, number>();
  for (const unit of units) {
    if (isBlackish(unit.color)) continue;
    counts.set(unit.color, (counts.get(unit.color) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

function hashCell(a: number, b: number): number {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Remap cloth cells onto a 4-step shade ramp of the dominant hue.
 * Returns the same config identity when there is no cloth colour to ramp.
 *
 * `block` is the brick size of the ramp in cells — larger blocks read as a
 * coarser quilt, smaller as finer tweed.
 */
export function toMonochromeStitchConfig(config: ImageStitchConfig, block = 2): ImageStitchConfig {
  const primary = dominantHue(config.units);
  if (!primary) return config;

  const ramp = [
    shade(primary, -0.12),
    shade(primary, 0.1),
    shade(primary, 0.32),
    shade(primary, 0.52),
  ];

  return {
    ...config,
    units: config.units.map((unit) => {
      const br = Math.floor(unit.r / block);
      const shift = (br % 2) * Math.ceil(block / 2);
      const bc = Math.floor((unit.c + shift) / block);
      const h = hashCell(br, bc);
      return { ...unit, color: ramp[(h >>> 4) % ramp.length] };
    }),
  };
}
