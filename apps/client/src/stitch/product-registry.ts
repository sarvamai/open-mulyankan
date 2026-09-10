/**
 * Product-shipped stitch assets — pruned from mulyankan-frontend's
 * product-registry to the one motif the thin client renders (the auth-login
 * cloth). The reference registry is a curated id → lazy config loader map;
 * the same shape is kept here so `StitchAsset id="…"` works unchanged and
 * further motifs can be added one loader at a time.
 */

import type { ImageStitchConfig } from './lib/imageStitch';
import type { ThemedStitchConfig } from './lib/core';

export type ProductStitchConfig = ImageStitchConfig | ThemedStitchConfig;

export type ProductStitchEntry = {
  /** Authored px-per-cell (library tile register). Used when sizing via cellPx/maxSize. */
  cellPx: number;
  load: () => Promise<ProductStitchConfig>;
};

/**
 * Stable surface → motif id map. Call sites import these keys; change the
 * target motif once here instead of hunting string literals in pages.
 */
export const PRODUCT_STITCH = {
  /** The interactive stitch cloth on the sign-in screen's left panel. */
  authLogin: 'studio-forest-stream-4',
} as const;

export type ProductStitchId = typeof PRODUCT_STITCH[keyof typeof PRODUCT_STITCH];

const PRODUCT_STITCH_REGISTRY: Record<ProductStitchId, ProductStitchEntry> = {
  [PRODUCT_STITCH.authLogin]: {
    cellPx: 4,
    load: () =>
      import('./lib/motifs/studio-forest-stream-visuals').then(
        (m) => m.studioForestStream4Mark
      ),
  },
};

/** Load a product stitch config by id. Returns `undefined` for unknown ids. */
export async function loadProductStitchConfig(
  id: string
): Promise<{ config: ProductStitchConfig; cellPx: number } | undefined> {
  if (!(id in PRODUCT_STITCH_REGISTRY)) return undefined;
  const entry = PRODUCT_STITCH_REGISTRY[id as ProductStitchId];
  return { config: await entry.load(), cellPx: entry.cellPx };
}
