/**
 * ASCII silhouette authoring — the default way to draw stitch motifs.
 *
 * Author silhouettes as a character grid instead of coordinate lists — far
 * easier to draw, review, and diff. '.' and ' ' are empty; every other
 * character is a layer. Cells come out row-major (top→bottom, left→right),
 * the same order the seeded patchwork/tinted cycles consume, so a shape
 * re-authored in ASCII with identical cells renders identically.
 *
 * Layering convention: the body fill must INCLUDE accent cells (accents are
 * stitched OVER body cloth), so pass `art.union('Bi')` to patchwork and then
 * `art.layer('i')` to tinted:
 *
 *     const art = asciiMotif(`
 *       .BBBB.
 *       BiBBiB
 *       BBBBBB
 *       .B....
 *     `);
 *     ...patchwork(art.union('Bi'), 2),
 *     ...tinted(art.layer('i'), THREAD.ink),
 */

export interface AsciiMotif {
  rows: number;
  cols: number;
  /** Cells of one character, row-major. Throws if the char isn't in the art. */
  layer: (ch: string) => Array<[number, number]>;
  /** Cells of several characters merged and re-sorted row-major. */
  union: (chars: string) => Array<[number, number]>;
}

export function asciiMotif(art: string): AsciiMotif {
  const rawLines = art.replace(/\t/g, ' ').split('\n');
  while (rawLines.length > 0 && rawLines[0].trim() === '') rawLines.shift();
  while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') rawLines.pop();
  if (rawLines.length === 0) throw new Error('asciiMotif: empty art');

  // Strip the common indentation of the template literal so interior
  // spaces can still be used as empty cells.
  const indent = Math.min(
    ...rawLines
      .filter((l) => l.trim() !== '')
      .map((l) => (/^ */.exec(l) as RegExpExecArray)[0].length)
  );
  const lines = rawLines.map((l) => l.slice(indent));

  const byChar = new Map<string, Array<[number, number]>>();
  lines.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '.' || ch === ' ') continue;
      let cells = byChar.get(ch);
      if (!cells) {
        cells = [];
        byChar.set(ch, cells);
      }
      cells.push([r, c]);
    }
  });

  const layer = (ch: string): Array<[number, number]> => {
    const cells = byChar.get(ch);
    if (!cells) {
      throw new Error(
        `asciiMotif: no '${ch}' cells in art (layers present: ${[...byChar.keys()].join(' ')})`
      );
    }
    return cells;
  };

  return {
    rows: lines.length,
    cols: Math.max(...lines.map((l) => l.length)),
    layer,
    union: (chars) =>
      chars
        .split('')
        .flatMap(layer)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  };
}
