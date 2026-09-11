/**
 * defineMotif — declare a stitch asset with one object literal.
 *
 * The common case (an ASCII silhouette + a few cloth-fill layers) needs no
 * builder function and no manual library entry: `defineMotif` parses the art,
 * applies the fills, bakes the config once, and auto-registers a library
 * entry. Families of related variants use `defineMotifFamily`; procedural /
 * non-ASCII assets (loops, noise, multi-scene heroes) use the
 * `defineMotifFromUnits` escape hatch.
 *
 * Everything bakes once, at module load, so the returned config's `units`
 * array is referentially stable across renders (StitchComposition reloads
 * when units identity changes — see the runtime invariant in the skill doc).
 *
 * Layer-char convention (see `./ascii`): `B` body, `g` ghost/copy, `i` ink
 * accent. The body fill must INCLUDE accent cells (`chars: 'Bi'`) so ink is
 * stitched OVER body cloth, then the accent layer (`chars: 'i'`) draws on top.
 */

import type { ClickAnimConfig, ImageStitchConfig } from '../imageStitch';
import { THREAD, type PlacedUnit, type UnitKey } from '../units';
import { asciiMotif } from './ascii';
import { bakeConfig, type BuiltMotif } from './bake';
import { patchwork, quilted, solid, tinted } from './fills';
import { registerMotifEntry, type StitchLibraryEntry } from './registry';
import {
  hasThemedColor,
  resolveThemedColor,
  type StitchTheme,
  type ThemedColor,
  type ThemedStitchConfig,
} from './theme';

/**
 * One cloth-fill layer of a motif. `chars` names the ASCII characters this
 * layer draws (drawing order = declaration order; later layers stitch over
 * earlier ones). `color` accepts a `THREAD` key (`'ink'`), a raw hex value,
 * or a themed pair via `themed(light, dark)` — any themed color makes the
 * whole motif bake per theme (see `defineMotif`).
 */
export type MotifLayer =
  | { chars: string; fill: 'solid'; unit: UnitKey; color: ThemedColor }
  | { chars: string; fill: 'patchwork'; seed?: number }
  | { chars: string; fill: 'tinted'; color: ThemedColor; seed?: number }
  | { chars: string; fill: 'quilted'; colors: ThemedColor[]; units: UnitKey[]; block?: number };

/** Fields shared by every declarative (ASCII) motif spec. */
interface AsciiMotifSpecBase {
  /** Library entry id (kebab-case); also the export filename for SVG/PNG. */
  id: string;
  /** Library display name. */
  name: string;
  /** ASCII silhouette; see `./ascii`. */
  art: string;
  /** Cloth-fill layers, in draw order. */
  layers: MotifLayer[];
  /** On-screen px per cell for the library tile; defaults to 6. */
  cellPx?: number;
  /** Quilt block size in cells, for the library tile (quilted fills). */
  quiltBlock?: number;
  /** Optional click-triggered traveler run. */
  clickAnim?: ClickAnimConfig;
  /** Override the baked `config.name`; defaults to `${collection}-${id}`. */
  bakeName?: string;
}

interface CollectionMeta {
  /** Collection id (kebab-case) this asset belongs to. */
  collection: string;
  /** Collection display name — set by the first entry that provides it. */
  collectionName?: string;
  /** Collection description — set by the first entry that provides it. */
  collectionDescription?: string;
}

/** Resolve a themed color for `theme`, then a `THREAD` key, else raw hex. */
function resolveColor(color: ThemedColor, theme: StitchTheme): string {
  const c = resolveThemedColor(color, theme);
  return (THREAD as Record<string, string>)[c] ?? c;
}

/** Apply one layer's fill to its cells for the given theme. */
function fillLayer(
  cells: Array<[number, number]>,
  layer: MotifLayer,
  theme: StitchTheme
): PlacedUnit[] {
  switch (layer.fill) {
    case 'solid':
      return solid(cells, layer.unit, resolveColor(layer.color, theme));
    case 'patchwork':
      return patchwork(cells, layer.seed ?? 0);
    case 'tinted':
      return tinted(cells, resolveColor(layer.color, theme), layer.seed ?? 0);
    case 'quilted':
      return quilted(
        cells,
        layer.colors.map((c) => resolveColor(c, theme)),
        layer.units,
        layer.block
      );
  }
}

/** Every color referenced by the layers — used to decide if a motif is themed. */
function layerColors(layers: MotifLayer[]): ThemedColor[] {
  const out: ThemedColor[] = [];
  for (const layer of layers) {
    if (layer.fill === 'solid' || layer.fill === 'tinted') out.push(layer.color);
    else if (layer.fill === 'quilted') out.push(...layer.colors);
  }
  return out;
}

/** Parse `art` + `layers` into a built motif for one theme (draw order = layer order). */
function buildFromArt(art: string, layers: MotifLayer[], theme: StitchTheme): BuiltMotif {
  const motif = asciiMotif(art);
  const units = layers.flatMap((layer) => fillLayer(motif.union(layer.chars), layer, theme));
  return { cols: motif.cols, rows: motif.rows, units };
}

/**
 * Bake an ASCII spec. If any layer color varies by theme, bake one config per
 * theme (a `ThemedStitchConfig`); otherwise a single `ImageStitchConfig`. The
 * light bake of a themed motif is identical to its non-themed bake, so opting
 * a color into `themed()` never changes light-mode output.
 */
function bakeAsciiConfig(
  spec: AsciiMotifSpecBase,
  bakeName: string
): ImageStitchConfig | ThemedStitchConfig {
  const bake = (theme: StitchTheme): ImageStitchConfig => {
    const built = buildFromArt(spec.art, spec.layers, theme);
    return bakeConfig(bakeName, spec.clickAnim ? { ...built, clickAnim: spec.clickAnim } : built);
  };
  if (!hasThemedColor(layerColors(spec.layers))) return bake('light');
  return { light: bake('light'), dark: bake('dark') };
}

/** Register a library entry (single or themed config) as a side effect. */
function registerConfig(
  meta: CollectionMeta,
  base: { id: string; name: string; cellPx?: number; quiltBlock?: number },
  config: ImageStitchConfig | ThemedStitchConfig
): void {
  const entry: StitchLibraryEntry = {
    id: base.id,
    name: base.name,
    config,
    ...(base.cellPx !== undefined ? { cellPx: base.cellPx } : {}),
    ...(base.quiltBlock !== undefined ? { quiltBlock: base.quiltBlock } : {}),
  };
  registerMotifEntry({
    collection: meta.collection,
    collectionName: meta.collectionName,
    collectionDescription: meta.collectionDescription,
    entry,
  });
}

/**
 * Declare a single ASCII motif. Returns the baked config (stable identity)
 * and auto-registers its library entry. Themed when any layer color is a
 * `themed()` pair, otherwise a plain config. Call once at module scope.
 */
export function defineMotif(
  spec: AsciiMotifSpecBase & CollectionMeta
): ImageStitchConfig | ThemedStitchConfig {
  const config = bakeAsciiConfig(spec, spec.bakeName ?? `${spec.collection}-${spec.id}`);
  registerConfig(spec, spec, config);
  return config;
}

/**
 * Declare a family of related ASCII motifs under one collection. Every
 * variant bakes once at definition and registers in declaration order;
 * returns a `(name) => config` selector reading from the baked cache, so
 * repeated calls return the same stable config. A variant is themed
 * independently — the selector's return is `ImageStitchConfig | ThemedStitchConfig`.
 */
export function defineMotifFamily<Name extends string>(
  spec: {
    variants: Record<Name, AsciiMotifSpecBase>;
  } & CollectionMeta
): (name: Name) => ImageStitchConfig | ThemedStitchConfig {
  const cache = {} as Record<Name, ImageStitchConfig | ThemedStitchConfig>;
  // Object insertion order preserves declaration order for the registry.
  for (const key of Object.keys(spec.variants) as Name[]) {
    const variant = spec.variants[key];
    const config = bakeAsciiConfig(variant, variant.bakeName ?? `${spec.collection}-${variant.id}`);
    registerConfig(spec, variant, config);
    cache[key] = config;
  }
  return (name: Name) => cache[name];
}

/**
 * Escape hatch for procedural / non-ASCII assets (loops, noise, gradients,
 * multi-scene heroes). Bakes `build()` once, registers the entry, returns the
 * stable config. Author geometry in `build`; everything else matches
 * `defineMotif`.
 */
export function defineMotifFromUnits(
  spec: CollectionMeta & {
    id: string;
    name: string;
    bakeName?: string;
    cellPx?: number;
    quiltBlock?: number;
    build: () => BuiltMotif;
  }
): ImageStitchConfig {
  const config = bakeConfig(spec.bakeName ?? `${spec.collection}-${spec.id}`, spec.build());
  registerConfig(spec, spec, config);
  return config;
}

/**
 * Theme-aware sibling of `defineMotifFromUnits`: bakes one config per theme
 * from `build(theme)` (author theme-varying colors inside `build`) and
 * registers a single library entry carrying the themed pair. `StitchAsset`
 * picks the config for the active theme. Each per-theme config is baked once
 * at module load, so its `units` identity stays stable across renders.
 */
export function defineThemedMotifFromUnits(
  spec: CollectionMeta & {
    id: string;
    name: string;
    bakeName?: string;
    cellPx?: number;
    quiltBlock?: number;
    build: (theme: StitchTheme) => BuiltMotif;
  }
): ThemedStitchConfig {
  const bakeName = spec.bakeName ?? `${spec.collection}-${spec.id}`;
  const config: ThemedStitchConfig = {
    light: bakeConfig(bakeName, spec.build('light')),
    dark: bakeConfig(bakeName, spec.build('dark')),
  };
  const entry: StitchLibraryEntry = {
    id: spec.id,
    name: spec.name,
    config,
    ...(spec.cellPx !== undefined ? { cellPx: spec.cellPx } : {}),
    ...(spec.quiltBlock !== undefined ? { quiltBlock: spec.quiltBlock } : {}),
  };
  registerMotifEntry({
    collection: spec.collection,
    collectionName: spec.collectionName,
    collectionDescription: spec.collectionDescription,
    entry,
  });
  return config;
}
