/**
 * Motif registry — the auto-registration backbone for the Stitch library.
 *
 * Motif domain modules (declared via `defineMotif` / `defineMotifFromUnits`
 * in `./defineMotif`) register their collections here as a side effect of
 * being imported. `library.ts` then reads the registered collections instead
 * of maintaining a parallel hand-written list. Adding a normal asset is one
 * declaration — no separate library edit.
 *
 * The library types live here (not in `library.ts`) so the registry has no
 * dependency on the library module; `library.ts` re-exports them for
 * backwards compatibility.
 */

import type { ImageStitchConfig } from '../imageStitch';
import type { ThemedStitchConfig } from './theme';

export interface StitchLibraryEntry {
  id: string;
  name: string;
  /** A plain config, or a themed pair the gallery/StitchAsset resolves per theme. */
  config: ImageStitchConfig | ThemedStitchConfig;
  /** On-screen px per cell for this asset; defaults to STITCH_CELL_PX (6). */
  cellPx?: number;
  /** Quilt block size in cells, for assets using the quilted fill. */
  quiltBlock?: number;
}

export interface StitchLibraryCollection {
  id: string;
  name: string;
  description: string;
  entries: StitchLibraryEntry[];
}

// Insertion-ordered so the gallery renders collections in the order their
// modules first register — stable across runs given a stable import order.
const collections = new Map<string, StitchLibraryCollection>();

/**
 * Register one entry into a collection, creating the collection on first use.
 * `name`/`description` set the collection metadata the first time it's seen;
 * later entries only need to match the collection `id`.
 */
export function registerMotifEntry(args: {
  collection: string;
  collectionName?: string;
  collectionDescription?: string;
  entry: StitchLibraryEntry;
}): void {
  const { collection, collectionName, collectionDescription, entry } = args;
  let group = collections.get(collection);
  if (!group) {
    group = {
      id: collection,
      name: collectionName ?? collection,
      description: collectionDescription ?? '',
      entries: [],
    };
    collections.set(collection, group);
  } else {
    // Fill in metadata if the collection was created by an entry that omitted it.
    if (collectionName && group.name === group.id) group.name = collectionName;
    if (collectionDescription && !group.description) group.description = collectionDescription;
  }

  // Replace on re-register so motif HMR updates art instead of throwing
  // (the registry Map survives when only the motif module is invalidated).
  const existing = group.entries.findIndex((e) => e.id === entry.id);
  if (existing >= 0) {
    group.entries[existing] = entry;
  } else {
    group.entries.push(entry);
  }
}

/** A registered collection by id, or `undefined` if no module registered it. */
export function getRegisteredCollection(id: string): StitchLibraryCollection | undefined {
  return collections.get(id);
}

/** A registered collection by id; throws if the owning module wasn't imported. */
export function requireRegisteredCollection(id: string): StitchLibraryCollection {
  const group = collections.get(id);
  if (!group) {
    throw new Error(
      `requireRegisteredCollection: "${id}" is not registered — is its motif module imported?`
    );
  }
  return group;
}

/** Every registered collection, in registration order. */
export function getRegisteredCollections(): StitchLibraryCollection[] {
  return [...collections.values()];
}
