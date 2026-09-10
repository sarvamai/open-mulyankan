/**
 * Stitch motif core — the shared primitives every motif module builds on.
 *
 * - ascii:   asciiMotif silhouette authoring
 * - palette: epoch palette + topic-marker vocabulary
 * - cells:   cell/silhouette primitives (geometry, placement)
 * - fills:   silhouette → PlacedUnit fill helpers
 * - bake:    bakeConfig envelope
 * - registry: auto-registration backbone + library types
 * - defineMotif: the declarative authoring API
 */

export { asciiMotif, type AsciiMotif } from './ascii';
export { C, TOPIC_MARKER_COLORS, TOPIC_MARKER_UNITS } from './palette';
export { cell, discCells, offsetSilhouette, ringCells, roundedRectCells, stamp } from './cells';
export { patchwork, quilted, solid, tinted } from './fills';
export { bakeConfig, type BuiltMotif } from './bake';
export {
  getRegisteredCollection,
  getRegisteredCollections,
  registerMotifEntry,
  requireRegisteredCollection,
  type StitchLibraryCollection,
  type StitchLibraryEntry,
} from './registry';
export {
  defineMotif,
  defineMotifFamily,
  defineMotifFromUnits,
  defineThemedMotifFromUnits,
  type MotifLayer,
} from './defineMotif';
export {
  hasThemedColor,
  isThemedConfig,
  pickThemedConfig,
  resolveThemedColor,
  STITCH_THEMES,
  themed,
  type StitchTheme,
  type ThemedColor,
  type ThemedStitchConfig,
} from './theme';
