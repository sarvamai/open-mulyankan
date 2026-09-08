/**
 * Generated cover art, keyed off a stable string — the subject — so an item
 * keeps the same livery across renders and across the surfaces it appears
 * on. Class strings are written out in full: Tailwind only generates classes
 * it can see literally in the source.
 *
 * A book uses the whole board (`board` + `ink` against it); an exam paper is
 * printed on white stock, so it takes only `accent` for its rules and marks.
 */

export interface Livery {
  /** Full-bleed board, for a book cover. */
  board: string;
  /** Text colour that reads against `board`. */
  ink: string;
  /** Text colour that reads on white stock, for a printed paper. */
  accent: string;
}

export const LIVERIES: readonly Livery[] = [
  {
    board: 'bg-gradient-to-br from-tatva-indigo-700 to-tatva-indigo-400',
    ink: 'text-tatva-indigo-50',
    accent: 'text-tatva-indigo-700',
  },
  {
    board: 'bg-gradient-to-br from-tatva-green-700 to-tatva-green-400',
    ink: 'text-tatva-green-50',
    accent: 'text-tatva-green-700',
  },
  {
    board: 'bg-gradient-to-br from-tatva-orange-700 to-tatva-orange-400',
    ink: 'text-tatva-orange-50',
    accent: 'text-tatva-orange-700',
  },
  {
    board: 'bg-gradient-to-br from-tatva-pink-700 to-tatva-pink-400',
    ink: 'text-tatva-pink-50',
    accent: 'text-tatva-pink-700',
  },
  {
    board: 'bg-gradient-to-br from-tatva-red-700 to-tatva-red-400',
    ink: 'text-tatva-red-50',
    accent: 'text-tatva-red-700',
  },
  {
    board: 'bg-gradient-to-br from-tatva-yellow-700 to-tatva-yellow-400',
    ink: 'text-tatva-yellow-50',
    accent: 'text-tatva-yellow-700',
  },
] as const;

/** Stable index from a string, so the same subject always gets one livery. */
export function liveryFor(key: string): Livery {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 100000;
  }
  return LIVERIES[hash % LIVERIES.length];
}
