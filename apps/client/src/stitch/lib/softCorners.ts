/**
 * Smooth-corner treatment for a baked stitch config: chamfer outer silhouette
 * cells by Manhattan distance from the occupied bounding box — same cut as
 * `roundedRectCells` in core/cells.ts.
 *
 * Shared so library playgrounds and product placements
 * (`StitchAsset id="…" smoothCorners="subtle"`) render the same way.
 */

import type { ImageStitchConfig } from './imageStitch';

export type SmoothCornerStrength = 'off' | 'subtle' | 'medium' | 'strong';

export const SMOOTH_CORNER_OPTIONS = [
  { value: 'off', label: 'Off', icon: 'agents' as const },
  { value: 'subtle', label: 'Subtle', icon: 'agents' as const },
  { value: 'medium', label: 'Medium', icon: 'agents' as const },
  { value: 'strong', label: 'Strong', icon: 'agents' as const },
] as const;

const STRENGTH_RADIUS: Record<SmoothCornerStrength, number> = {
  off: 0,
  subtle: 1,
  medium: 2,
  strong: 3,
};

/**
 * Drop occupied cells in bbox corner pockets where dr + dc < R.
 * R === 0 returns the same config reference.
 */
export function toSoftCornerStitchConfig(
  config: ImageStitchConfig,
  strength: SmoothCornerStrength = 'off'
): ImageStitchConfig {
  const radius = STRENGTH_RADIUS[strength];
  if (radius === 0 || config.units.length === 0) return config;

  let minR = Number.POSITIVE_INFINITY;
  let maxR = Number.NEGATIVE_INFINITY;
  let minC = Number.POSITIVE_INFINITY;
  let maxC = Number.NEGATIVE_INFINITY;

  for (const unit of config.units) {
    minR = Math.min(minR, unit.r);
    maxR = Math.max(maxR, unit.r);
    minC = Math.min(minC, unit.c);
    maxC = Math.max(maxC, unit.c);
  }

  const units = config.units.filter((unit) => {
    const dr = Math.min(unit.r - minR, maxR - unit.r);
    const dc = Math.min(unit.c - minC, maxC - unit.c);
    return dr + dc >= radius;
  });

  if (units.length === config.units.length) return config;

  return { ...config, units };
}
