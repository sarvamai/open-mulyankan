/**
 * Procedural stitch-avatar generator for agents, in the spirit of
 * `faceGen` but authored in the house asset idiom (calm quilt fills in
 * the topic-marker palette, satin ink features).
 *
 * Two kinds, deterministic per (kind, seed):
 * - `conversational` — soft round heads with speech cues: headsets,
 *   sound waves, typing bubbles, antennae; smiles and blush cheeks.
 * - `work` — boxier bot heads with utility cues: visors, hard hats,
 *   torsos with buttons/badges, little feet.
 *
 * Self-contained on purpose: geometry helpers and the palette are local
 * so this file has no coupling to the hand-authored motifs.
 */

import type { ImageStitchConfig } from './imageStitch';
import { SITE_CELL_SIZE, THREAD, mulberry32, shade, type PlacedUnit, type UnitKey } from './units';

type Cell = [number, number];
type Rng = () => number;

const PAPER = '#faf8f5';

// Topic-marker hues (same derivation as motifs.ts), kept local.
const HUES = [
  shade('#1E2E57', -0.1), // blue
  shade('#FFB73A', -0.1), // yellow
  shade('#F16A03', -0.1), // orange
  shade('#4FAC33', -0.1), // green
  shade('#E82D82', -0.1), // pink
];

const SMOOTH_UNITS: UnitKey[] = ['weave3', 'satin', 'weave5'];

/* ── geometry ── */

function rect(r0: number, r1: number, c0: number, c1: number): Cell[] {
  const out: Cell[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) out.push([r, c]);
  }
  return out;
}

function roundedRect(rows: number, cols: number, cornerRadius: number): Cell[] {
  const out: Cell[] = [];
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

function disc(size: number, radiusSq: number): Cell[] {
  const mid = (size - 1) / 2;
  const out: Cell[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r - mid) ** 2 + (c - mid) ** 2 <= radiusSq) out.push([r, c]);
    }
  }
  return out;
}

function offset(cells: Cell[], dr: number, dc: number): Cell[] {
  return cells.map(([r, c]) => [r + dr, c + dc]);
}

/* ── fills ── */

/** Quilt-block fill: unit and color vary per block of cells (calm cloth). */
function quilt(cells: Cell[], colors: string[], block = 2): PlacedUnit[] {
  return cells.map(([r, c]) => {
    const br = Math.floor((r + 64) / block); // +64 keeps negatives on-grid
    const bc = Math.floor((c + 64) / block);
    return {
      r,
      c,
      unit: SMOOTH_UNITS[(br * 2 + bc) % SMOOTH_UNITS.length],
      color: colors[(br * 3 + bc) % colors.length],
    };
  });
}

/** Solid satin patches — features (eyes, mouths) are always satin. */
function satin(cells: Cell[], color: string): PlacedUnit[] {
  return cells.map(([r, c]) => ({ r, c, unit: 'satin' as UnitKey, color }));
}

/* ── shared face features ── */

interface FaceSpec {
  W: number;
  eyeRow: number;
  mouthRow: number;
  mcL: number; // left column of the 2-wide center block
}

function buildEyes(spec: FaceSpec, rand: Rng): PlacedUnit[] {
  const { W, eyeRow, mcL } = spec;
  const gap = 2 + (W >= 13 && rand() < 0.5 ? 1 : 0);
  const roll = rand();
  const out: PlacedUnit[] = [];
  if (roll < 0.35) {
    // Tall 1×2 eyes
    const l = mcL - gap;
    const r = mcL + 1 + gap;
    out.push(...satin(rect(eyeRow, eyeRow + 1, l, l), THREAD.ink));
    out.push(...satin(rect(eyeRow, eyeRow + 1, r, r), THREAD.ink));
  } else {
    // 2×2 eyes, sometimes with a paper glint in the top-outer cell
    const l0 = mcL - gap - 1;
    const r0 = mcL + 1 + gap;
    out.push(...satin(rect(eyeRow, eyeRow + 1, l0, l0 + 1), THREAD.ink));
    out.push(...satin(rect(eyeRow, eyeRow + 1, r0, r0 + 1), THREAD.ink));
    if (roll > 0.7) {
      out.push(
        ...satin(
          [
            [eyeRow, l0],
            [eyeRow, r0 + 1],
          ],
          PAPER
        )
      );
    }
  }
  return out;
}

function buildMouth(
  spec: FaceSpec,
  style: 'smile' | 'open' | 'grin' | 'grill' | 'flat',
  color: string
): PlacedUnit[] {
  const { mouthRow: mr, mcL } = spec;
  switch (style) {
    case 'smile':
      return satin(
        [[mr, mcL - 2], [mr, mcL + 3], ...rect(mr + 1, mr + 1, mcL - 1, mcL + 2)],
        color
      );
    case 'open':
      return satin(rect(mr, mr + 1, mcL, mcL + 1), color);
    case 'grin':
      return satin(rect(mr, mr, mcL - 2, mcL + 3), color);
    case 'grill': {
      const cells = rect(mr, mr + 1, mcL - 2, mcL + 3);
      const out = satin(cells, color);
      // Paper slits give the grill its speaker read
      out.push(
        ...satin(
          [
            [mr, mcL],
            [mr + 1, mcL + 1],
          ],
          PAPER
        )
      );
      return out;
    }
    case 'flat':
      return satin(rect(mr, mr, mcL - 1, mcL + 2), color);
  }
}

/* ── conversational agents ── */

function buildConversational(seed: number): PlacedUnit[] {
  const rand = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const h = HUES[Math.floor(rand() * HUES.length)];
  const ramp = [shade(h, 0.3), shade(h, 0.45), shade(h, 0.62)];
  const deep = shade(h, -0.3);

  // Head silhouette: squircle, wide pill, or disc
  let head: Cell[];
  let W: number;
  let H: number;
  const shapeRoll = rand();
  if (shapeRoll < 0.4) {
    H = 9 + Math.floor(rand() * 2);
    W = 11 + Math.floor(rand() * 3);
    head = roundedRect(H, W, 3);
  } else if (shapeRoll < 0.7) {
    H = 8;
    W = 12 + Math.floor(rand() * 3);
    head = roundedRect(H, W, 2);
  } else {
    const size = 11 + Math.floor(rand() * 2);
    H = size;
    W = size;
    head = disc(size, ((size - 1) / 2 + 0.3) ** 2);
  }

  const spec: FaceSpec = {
    W,
    eyeRow: H <= 8 ? 2 : H <= 10 ? 3 : 4,
    mouthRow: 0,
    mcL: Math.floor((W - 2) / 2),
  };
  spec.mouthRow = Math.max(spec.eyeRow + 3, H - 3);

  const behind: PlacedUnit[] = [];
  const over: PlacedUnit[] = [];

  // One speech-flavored accessory per avatar
  const aRoll = rand();
  if (aRoll < 0.3) {
    // Headset: band + earcups, sometimes a mic boom to the chin
    behind.push(...satin(rect(-1, -1, 2, W - 3), deep));
    behind.push(...satin(rect(spec.eyeRow - 1, spec.eyeRow + 1, -2, -1), deep));
    behind.push(...satin(rect(spec.eyeRow - 1, spec.eyeRow + 1, W, W + 1), deep));
    if (rand() < 0.6) {
      over.push(
        ...satin(
          [
            [spec.eyeRow + 2, -1],
            [spec.eyeRow + 3, -1],
            [spec.eyeRow + 3, 0],
          ],
          deep
        )
      );
      over.push(...satin(rect(spec.mouthRow, spec.mouthRow + 1, 0, 1), deep));
    }
  } else if (aRoll < 0.55) {
    // Antenna with a contrast knob
    const knob = shade(HUES[(HUES.indexOf(h) + 2) % HUES.length], 0.1);
    behind.push(...satin(rect(-2, -1, spec.mcL, spec.mcL + 1), deep));
    behind.push(...satin(rect(-4, -3, spec.mcL, spec.mcL + 1), knob));
  } else if (aRoll < 0.8) {
    // Stepped sound waves to the right
    behind.push(...quilt(rect(spec.eyeRow, spec.eyeRow + 2, W + 1, W + 1), [shade(h, -0.15)]));
    behind.push(...quilt(rect(spec.eyeRow - 2, spec.eyeRow + 4, W + 3, W + 3), [shade(h, -0.15)]));
  } else {
    // Typing bubble ("…") floating top-right
    const ghost = shade(h, 0.55);
    behind.push(...quilt(offset(roundedRect(4, 8, 1), -6, W - 6), [ghost]));
    behind.push(
      ...satin(
        [
          [-2, W - 4],
          [-1, W - 5],
        ],
        ghost
      )
    );
    behind.push(
      ...satin(
        [
          [-4, W - 4],
          [-4, W - 2],
          [-4, W],
        ],
        deep
      )
    );
  }

  const units: PlacedUnit[] = [...behind, ...quilt(head, ramp)];
  units.push(...buildEyes(spec, rand));

  const mRoll = rand();
  units.push(
    ...buildMouth(spec, mRoll < 0.45 ? 'smile' : mRoll < 0.7 ? 'open' : 'grin', THREAD.ink)
  );

  if (rand() < 0.55) {
    const blush = shade(HUES[4], 0.35);
    units.push(
      ...satin(
        [
          [spec.mouthRow, 1],
          [spec.mouthRow, W - 2],
        ],
        blush
      )
    );
  }

  units.push(...over);
  return units;
}

/* ── work agents ── */

function buildWork(seed: number): PlacedUnit[] {
  const rand = mulberry32((seed >>> 0) ^ 0x517cc1b7);
  const h = HUES[Math.floor(rand() * HUES.length)];
  const ramp = [shade(h, 0.2), shade(h, 0.38), shade(h, 0.55)];
  const deep = shade(h, -0.3);

  // Boxy head
  const H = 7 + Math.floor(rand() * 2);
  const W = 11 + Math.floor(rand() * 4);
  const head = roundedRect(H, W, 1);

  const spec: FaceSpec = {
    W,
    eyeRow: 2,
    mouthRow: 5,
    mcL: Math.floor((W - 2) / 2),
  };

  const behind: PlacedUnit[] = [];
  const over: PlacedUnit[] = [];

  // Headgear: hard hat, antenna, or bare
  const gRoll = rand();
  if (gRoll < 0.4) {
    const hatHue = HUES.indexOf(h) === 1 ? HUES[2] : HUES[1];
    const hat = shade(hatHue, 0.05);
    behind.push(...quilt(offset(roundedRect(2, W - 4, 1), -2, 2), [hat, shade(hatHue, 0.25)]));
    over.push(...satin(rect(0, 0, -1, W), hat));
  } else if (gRoll < 0.75) {
    const knob = shade(HUES[(HUES.indexOf(h) + 3) % HUES.length], 0.1);
    behind.push(...satin(rect(-2, -1, spec.mcL, spec.mcL + 1), deep));
    behind.push(...satin(rect(-4, -3, spec.mcL, spec.mcL + 1), knob));
  }

  // Torso with a detail, and sometimes feet
  const hasTorso = rand() < 0.75;
  if (hasTorso) {
    behind.push(...quilt(rect(H, H + 2, 3, W - 4), [shade(h, 0.08), shade(h, 0.25)]));
    const dRoll = rand();
    if (dRoll < 0.4) {
      over.push(
        ...satin(
          [
            [H + 1, spec.mcL - 1],
            [H + 1, spec.mcL + 2],
          ],
          THREAD.ink
        )
      );
    } else if (dRoll < 0.7) {
      const badge = shade(HUES[(HUES.indexOf(h) + 2) % HUES.length], 0.1);
      over.push(...satin(rect(H, H + 1, spec.mcL, spec.mcL + 1), badge));
    } else {
      over.push(...satin(rect(H + 1, H + 1, 4, W - 5), deep));
    }
    // Feet need a torso wide enough to keep them apart
    if (W >= 13 && rand() < 0.5) {
      over.push(...satin(rect(H + 3, H + 3, 4, 5), deep));
      over.push(...satin(rect(H + 3, H + 3, W - 6, W - 5), deep));
    }
  }

  const units: PlacedUnit[] = [...behind, ...quilt(head, ramp)];

  // Visor eyes or regular eyes
  if (rand() < 0.35) {
    units.push(...satin(rect(spec.eyeRow, spec.eyeRow + 1, 2, W - 3), shade(h, -0.45)));
    units.push(...satin(rect(spec.eyeRow, spec.eyeRow + 1, spec.mcL - 2, spec.mcL - 2), PAPER));
    units.push(...satin(rect(spec.eyeRow, spec.eyeRow + 1, spec.mcL + 3, spec.mcL + 3), PAPER));
  } else {
    units.push(...buildEyes(spec, rand));
  }

  const mRoll = rand();
  units.push(
    ...buildMouth(spec, mRoll < 0.5 ? 'grill' : mRoll < 0.75 ? 'flat' : 'smile', THREAD.ink)
  );

  units.push(...over);
  return units;
}

/* ── mini avatars (8×8) ── */

/**
 * Compact avatar that fits an 8×8 grid exactly — for tight slots
 * (list rows, pickers). Render at 4px/cell (32×32). Always welcoming:
 * every seed gets an upturned smile or an open laughing mouth, most get
 * blush cheeks. Bodies stay light and pastel so the ink features read
 * as a face, not makeup — hence the friendlier sky blue instead of the
 * navy used by the bigger avatars.
 */
const MINI_HUES = ['#4D9CDB', '#FFB73A', '#F16A03', '#4FAC33', '#E82D82'];

function buildMini(seed: number): PlacedUnit[] {
  const rand = mulberry32((seed >>> 0) ^ 0x2545f491);
  const h = MINI_HUES[Math.floor(rand() * MINI_HUES.length)];
  const ramp = [shade(h, 0.4), shade(h, 0.52), shade(h, 0.66)];
  const deep = shade(h, -0.3);
  const blush = shade(MINI_HUES[4], 0.45);

  const units: PlacedUnit[] = [];
  const shapeRoll = rand();

  // Head fills the 8×8 frame; some seeds trade the top rows for a hat
  // (antenna knob) or the side columns for ear nubs.
  let head: Cell[];
  let faceTop = 0; // rows above this are headgear
  let faceL = 0;
  let faceR = 7;
  if (shapeRoll < 0.3) {
    head = roundedRect(8, 8, 2);
  } else if (shapeRoll < 0.55) {
    // Antenna: contrast knob on rows 0–1, head on rows 2–7
    const knob = shade(MINI_HUES[(MINI_HUES.indexOf(h) + 2) % MINI_HUES.length], 0.2);
    units.push(...satin(rect(1, 1, 3, 4), deep));
    units.push(...satin(rect(0, 0, 3, 4), knob));
    head = offset(roundedRect(6, 8, 1), 2, 0);
    faceTop = 2;
  } else if (shapeRoll < 0.8) {
    // Ear nubs on the outer columns
    head = offset(roundedRect(8, 6, 1), 0, 1);
    units.push(...satin(rect(2, 3, 0, 0), deep));
    units.push(...satin(rect(2, 3, 7, 7), deep));
    faceL = 1;
    faceR = 6;
  } else {
    head = disc(8, 14.5);
  }

  units.push(...quilt(head, ramp));

  // Eyes — tall single-column dots, or chunky 2×2 with a paper glint
  const eyeTop = faceTop + (faceTop === 0 ? 2 : 1);
  if (faceL === 0 && rand() < 0.45) {
    units.push(...satin(rect(eyeTop, eyeTop + 1, 1, 2), THREAD.ink));
    units.push(...satin(rect(eyeTop, eyeTop + 1, 5, 6), THREAD.ink));
    units.push(
      ...satin(
        [
          [eyeTop, 1],
          [eyeTop, 6],
        ],
        PAPER
      )
    );
  } else {
    units.push(...satin(rect(eyeTop, eyeTop + 1, 2, 2), THREAD.ink));
    units.push(...satin(rect(eyeTop, eyeTop + 1, 5, 5), THREAD.ink));
  }

  // Mouth — never flat, and never wider than the eye span (a near
  // full-width grin plus edge blush is what reads as clown makeup)
  if (rand() < 0.6) {
    units.push(
      ...satin(
        [
          [5, 2],
          [5, 5],
        ],
        THREAD.ink
      )
    );
    units.push(...satin(rect(6, 6, 3, 4), THREAD.ink));
  } else {
    units.push(
      ...satin(
        [
          [5, 2],
          [5, 5],
        ],
        THREAD.ink
      )
    );
    units.push(...satin(rect(5, 6, 3, 4), THREAD.ink));
  }

  // Blush cheeks tucked under the eyes (skipped for headgear faces,
  // where the shorter face leaves no clear cheek row)
  if (faceTop === 0 && rand() < 0.75) {
    units.push(
      ...satin(
        [
          [4, faceL + 1],
          [4, faceR - 1],
        ],
        blush
      )
    );
  }

  return units;
}

/* ── abstract agent marks (8×8, non-face) ── */

/**
 * Non-face identity marks for conversational agents, fitting the same
 * 8×8 / 4px/cell (32px) slot as the mini avatars. Where the avatars ask
 * "who is this agent?", these ask "what does this agent sound like?" —
 * each concept encodes conversation without drawing a creature, so the
 * set scales to unlimited seeds without ever repeating a face.
 *
 * Four concepts, deterministic per (concept, seed):
 * - `waveform` — the agent's voice fingerprint: centred bars random-
 *   walking across the tile, one bar picked out in a contrast hue.
 * - `pulse` — a sonar ping mid-flight: deep core, inner ring, and a
 *   pale outer ring that is sometimes dashed. The "always listening" read.
 * - `weave` — identicon cloth: a mirror-symmetric seeded patch pattern,
 *   a woven badge unique to each agent.
 * - `duet` — two voices: two cloth blocks in different hues meeting
 *   across the tile's diagonal, each carrying its own speech mark.
 */

function buildWaveformMark(seed: number): PlacedUnit[] {
  const rand = mulberry32((seed >>> 0) ^ 0x85ebca6b);
  const hi = Math.floor(rand() * MINI_HUES.length);
  const hue = MINI_HUES[hi];
  const ramp = [shade(hue, 0.15), shade(hue, 0.32), shade(hue, 0.5)];
  const accent = shade(MINI_HUES[(hi + 2) % MINI_HUES.length], 0.05);

  // Half-heights walk one step at a time so the profile reads as one
  // continuous wave rather than random noise
  const halves: number[] = [];
  let half = 2 + Math.floor(rand() * 2);
  for (let c = 0; c < 8; c++) {
    halves.push(half);
    half = Math.min(4, Math.max(1, half + (rand() < 0.5 ? -1 : 1)));
  }
  halves[1 + Math.floor(rand() * 6)] = 4; // guarantee one full-height peak
  const accentC = Math.floor(rand() * 8);

  const units: PlacedUnit[] = [];
  halves.forEach((hh, c) => {
    const bar = rect(4 - hh, 3 + hh, c, c);
    units.push(...(c === accentC ? satin(bar, accent) : quilt(bar, ramp)));
  });
  return units;
}

function buildPulseMark(seed: number): PlacedUnit[] {
  const rand = mulberry32((seed >>> 0) ^ 0xc2b2ae35);
  const hi = Math.floor(rand() * MINI_HUES.length);
  const hue = MINI_HUES[hi];
  const accent = shade(MINI_HUES[(hi + 2) % MINI_HUES.length], 0.05);

  // Annulus of cells around the tile centre (radius² band, in cells)
  const band = (loSq: number, hiSq: number): Cell[] => {
    const out: Cell[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const d = (r - 3.5) ** 2 + (c - 3.5) ** 2;
        if (d >= loSq && d <= hiSq) out.push([r, c]);
      }
    }
    return out;
  };

  const units: PlacedUnit[] = [];

  // Outer ring — pale, sometimes dashed into a broken ping
  let outer = band(12, 15);
  if (rand() < 0.5) {
    const phase = Math.floor(rand() * 3);
    outer = outer.filter(([r, c]) => (r + c + phase) % 3 !== 0);
  }
  units.push(...quilt(outer, [shade(hue, 0.42), shade(hue, 0.55)]));

  // Inner ring — mid tone, or the contrast hue
  const innerColor = rand() < 0.35 ? accent : shade(hue, 0.12);
  units.push(...quilt(band(4, 7), [innerColor]));

  // Core — deep satin, tight square or chunky plus
  const core = rand() < 0.5 ? band(0, 0.6) : band(0, 2.6);
  units.push(...satin(core, shade(hue, -0.25)));
  return units;
}

function buildWeaveMark(seed: number): PlacedUnit[] {
  const rand = mulberry32((seed >>> 0) ^ 0x27d4eb2f);
  const hi = Math.floor(rand() * MINI_HUES.length);
  const hue = MINI_HUES[hi];
  const ramp = [shade(hue, 0.2), shade(hue, 0.38), shade(hue, 0.55)];
  const accent = shade(MINI_HUES[(hi + 3) % MINI_HUES.length], 0.05);

  // Left half seeded, mirrored right — identicon symmetry
  const on: boolean[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < 4; c++) row.push(rand() < 0.58);
    on.push(row);
  }
  // Anchor the frame so every seed fills the full 8×8 tile
  on[0][3] = true;
  on[7][3] = true;
  on[3][0] = true;
  on[4][0] = true;

  const body: Cell[] = [];
  const accents: Cell[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      if (!on[r][c]) continue;
      const target = rand() < 0.12 ? accents : body;
      target.push([r, c], [r, 7 - c]);
    }
  }
  return [...quilt(body, ramp), ...satin(accents, accent)];
}

function buildDuetMark(seed: number, hueShift = 0): PlacedUnit[] {
  const rand = mulberry32((seed >>> 0) ^ 0x165667b1);
  // hueShift rotates both voices through the palette while keeping the
  // seed's geometry (block sizes, diagonal, speech marks) untouched.
  const i1 = (Math.floor(rand() * MINI_HUES.length) + hueShift) % MINI_HUES.length;
  // Offset 1..4 keeps the second hue always distinct from the first
  const i2 = (i1 + 1 + Math.floor(rand() * (MINI_HUES.length - 1))) % MINI_HUES.length;

  const speaker = (hueIdx: number, size: number, top: number, left: number): PlacedUnit[] => {
    const hue = MINI_HUES[hueIdx];
    const block = offset(roundedRect(size, size, 1), top, left);
    const out = quilt(block, [shade(hue, 0.25), shade(hue, 0.42), shade(hue, 0.58)]);
    // Speech mark in the block's own deep tone: a dash or dot pair
    const deep = shade(hue, -0.25);
    const rowM = top + Math.floor(size / 2);
    if (rand() < 0.5) {
      out.push(...satin(rect(rowM, rowM, left + 1, left + size - 2), deep));
    } else {
      out.push(
        ...satin(
          [
            [rowM, left + 1],
            [rowM, left + size - 2],
          ],
          deep
        )
      );
    }
    return out;
  };

  const flip = rand() < 0.5; // which diagonal the two voices sit on
  const s1 = 4 + Math.floor(rand() * 2);
  const s2 = 4 + Math.floor(rand() * 2);
  return [...speaker(i1, s1, 0, flip ? 8 - s1 : 0), ...speaker(i2, s2, 8 - s2, flip ? 0 : 8 - s2)];
}

/**
 * The duet mark's blue voice alone, grown to fill the whole 8×8 tile —
 * one speaker holding the floor. Derived from `duet` seed 4's first
 * block (sky blue, dot-pair speech mark); fixed, not seeded. Variants
 * move the dot pair and vary the quilt block size; colors and threading
 * stay identical across all of them.
 */
function buildSoloMark(eyes: Cell[], block: number, hueIdx = 0): PlacedUnit[] {
  const hue = MINI_HUES[hueIdx % MINI_HUES.length];
  const units = quilt(
    roundedRect(8, 8, 1),
    [shade(hue, 0.25), shade(hue, 0.42), shade(hue, 0.58)],
    block
  );
  units.push(...satin(eyes, shade(hue, -0.25)));
  return units;
}

export interface SoloMarkVariant {
  id: string;
  name: string;
  eyes: Cell[];
  /** Quilt block size — how many cells share one unit+color patch. */
  block: number;
  /** Rendered px per cell in the library (4 = standard mini slot, 2 = micro). */
  cellPx: number;
}

export const SOLO_MARK_VARIANTS: SoloMarkVariant[] = [
  {
    id: 'solo',
    name: 'Solo',
    eyes: [
      [4, 1],
      [4, 6],
    ],
    block: 2,
    cellPx: 4,
  },
  {
    id: 'solo-high',
    name: 'Solo eyes high',
    eyes: [
      [2, 1],
      [2, 6],
    ],
    block: 2,
    cellPx: 4,
  },
  {
    id: 'solo-low',
    name: 'Solo eyes low',
    eyes: [
      [6, 1],
      [6, 6],
    ],
    block: 3,
    cellPx: 4,
  },
  {
    id: 'solo-close',
    name: 'Solo eyes close',
    eyes: [
      [3, 2],
      [3, 5],
    ],
    block: 3,
    cellPx: 4,
  },
  {
    id: 'solo-micro',
    name: 'Solo micro',
    eyes: [
      [3, 2],
      [3, 5],
    ],
    block: 2,
    cellPx: 2,
  },
  {
    id: 'solo-micro-low',
    name: 'Solo micro low',
    eyes: [
      [5, 1],
      [5, 6],
    ],
    block: 3,
    cellPx: 2,
  },
];

/** A fixed non-face mark: the solo blue voice on the full 8×8 tile. */
export function abstractSoloMarkStitchConfig(
  variant: SoloMarkVariant = SOLO_MARK_VARIANTS[0]
): ImageStitchConfig {
  return {
    version: 1,
    name: `agent-abstract-${variant.id}`,
    cols: 8,
    rows: 8,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: '#c43d2b', width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units: buildSoloMark(variant.eyes, variant.block),
  };
}

/**
 * Hue variations of the `duet` seed-3 mark: identical geometry (block
 * sizes, diagonal, speech marks), palette rotated by `hueShift`
 * (0..MINI_HUES.length-1). Exploratory — agent identity marks that vary
 * only in color so a list reads as one family.
 */
export const DUET_HUE_VARIANT_COUNT = MINI_HUES.length;

/**
 * Hue variations of a solo mark: identical geometry (full tile, eye
 * placement, quilt block), one flat hue ramp per variant. Exploratory —
 * per-agent identity marks that vary only in color.
 */
export const SOLO_HUE_VARIANT_COUNT = MINI_HUES.length;

export const SOLO_CLOSE_VARIANT = SOLO_MARK_VARIANTS.find((v) => v.id === 'solo-close')!;

/**
 * The solo-close face taking a call: the face itself is the untouched
 * `solo-close` mark (same geometry, quilt and eyes, facing forward),
 * with a small handset stitched at one ear. Variants explore the side,
 * handset width/height/hue, overlap vs a gap, and optional speech
 * waves; the face never changes. Same 4px/cell register as the solo
 * marks — the tile just gains the columns the handset needs.
 */
export interface SoloPhoneVariant {
  id: string;
  name: string;
  side: 'left' | 'right';
  /** Handset hue — MINI_HUES index. */
  hueIdx: number;
  /** Handset columns (2 = slim, 3 = full). */
  width: number;
  /** Handset vertical span, rows inclusive (face is rows 0–7). */
  top: number;
  bottom: number;
  /** Columns stitched over the face edge (0 = resting beside it). */
  overlap: number;
  /** Pale screen slot down the handset center (width 3 only). */
  screen?: boolean;
  /** Home dot near the handset bottom (width 3 only). */
  homeDot?: boolean;
  /** Earpiece dash near the handset top (slim handsets). */
  earDash?: boolean;
  /** Speech waves radiating outward from the handset. */
  waves?: boolean;
  /** Darker cloth ramp — for tonal (blue-on-blue) handsets. */
  deep?: boolean;
}

export const SOLO_PHONE_VARIANTS: SoloPhoneVariant[] = [
  // The baseline: full-width orange handset, ear to chin
  {
    id: 'call-right',
    name: 'Call right',
    side: 'right',
    hueIdx: 2,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
  },
  {
    id: 'call-left',
    name: 'Call left',
    side: 'left',
    hueIdx: 2,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
  },
  // Slim handsets — quieter, just a bar with an earpiece dash
  {
    id: 'call-slim-right',
    name: 'Slim right',
    side: 'right',
    hueIdx: 2,
    width: 2,
    top: 2,
    bottom: 7,
    overlap: 1,
    earDash: true,
  },
  {
    id: 'call-slim-left',
    name: 'Slim left',
    side: 'left',
    hueIdx: 2,
    width: 2,
    top: 2,
    bottom: 7,
    overlap: 1,
    earDash: true,
  },
  // Hue walk — same geometry, different handset colors
  {
    id: 'call-yellow-right',
    name: 'Yellow right',
    side: 'right',
    hueIdx: 1,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
  },
  {
    id: 'call-green-right',
    name: 'Green right',
    side: 'right',
    hueIdx: 3,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
  },
  {
    id: 'call-pink-left',
    name: 'Pink left',
    side: 'left',
    hueIdx: 4,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
  },
  {
    id: 'call-mono-right',
    name: 'Tonal blue right',
    side: 'right',
    hueIdx: 0,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
    deep: true,
  },
  // Height studies
  {
    id: 'call-tall-right',
    name: 'Tall right',
    side: 'right',
    hueIdx: 2,
    width: 3,
    top: 0,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
  },
  {
    id: 'call-short-right',
    name: 'Short right',
    side: 'right',
    hueIdx: 2,
    width: 3,
    top: 3,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
  },
  // Held just off the ear — no overlap with the face
  {
    id: 'call-gap-right',
    name: 'Gap right',
    side: 'right',
    hueIdx: 2,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 0,
    screen: true,
    homeDot: true,
  },
  // Speaking — speech waves radiating from the handset
  {
    id: 'call-waves-right',
    name: 'Waves right',
    side: 'right',
    hueIdx: 2,
    width: 3,
    top: 2,
    bottom: 7,
    overlap: 1,
    screen: true,
    homeDot: true,
    waves: true,
  },
  {
    id: 'call-waves-slim-left',
    name: 'Waves slim left',
    side: 'left',
    hueIdx: 2,
    width: 2,
    top: 2,
    bottom: 7,
    overlap: 1,
    earDash: true,
    waves: true,
  },
];

function buildSoloPhoneMark(variant: SoloPhoneVariant): PlacedUnit[] {
  const blue = MINI_HUES[0];
  const hue = MINI_HUES[variant.hueIdx % MINI_HUES.length];
  const { side, width, top, bottom, overlap } = variant;
  const extra = width - overlap; // columns the handset adds beyond the face
  const wavePad = variant.waves ? 2 : 0;
  const faceLeft = side === 'left' ? extra + wavePad : 0;
  const handLeft = side === 'left' ? wavePad : faceLeft + 8 - overlap;

  // The solo-close face, exactly as the base mark builds it
  const units = buildSoloMark(SOLO_CLOSE_VARIANT.eyes, SOLO_CLOSE_VARIANT.block).map((u) => ({
    ...u,
    c: u.c + faceLeft,
  }));

  // Handset cloth — stitched over (or beside) the face edge
  const shape =
    width >= 3
      ? offset(roundedRect(bottom - top + 1, width, 1), top, handLeft)
      : rect(top, bottom, handLeft, handLeft + width - 1).filter(([r, c]) => {
          const outerC = side === 'left' ? handLeft : handLeft + width - 1;
          return !(c === outerC && (r === top || r === bottom)); // round the outer corners
        });
  const ramp = variant.deep
    ? [shade(hue, -0.12), shade(hue, 0.06)]
    : [shade(hue, 0.2), shade(hue, 0.38)];
  units.push(...quilt(shape, ramp, 2));

  const centerC = handLeft + 1; // handset center column (width 3)
  if (variant.screen) {
    units.push(...satin(rect(top + 1, bottom - 2, centerC, centerC), shade(blue, 0.66)));
  }
  if (variant.homeDot) {
    units.push(...satin([[bottom - 1, centerC]], shade(hue, -0.25)));
  }
  if (variant.earDash) {
    units.push(...satin(rect(top + 1, top + 1, handLeft, handLeft + width - 1), shade(hue, -0.25)));
  }
  if (variant.waves) {
    const mid = Math.floor((top + bottom) / 2);
    const x1 = side === 'left' ? handLeft - 1 : handLeft + width;
    const x2 = side === 'left' ? handLeft - 2 : handLeft + width + 1;
    units.push(...satin(rect(mid, mid + 1, x1, x1), shade(blue, 0.12)));
    units.push(...satin(rect(mid - 1, mid + 2, x2, x2), shade(blue, 0.12)));
  }
  return units;
}

/** The solo-close mark holding a phone to its ear — fixed geometry per variant, 4px/cell. */
export function abstractSoloPhoneMarkStitchConfig(
  variant: SoloPhoneVariant = SOLO_PHONE_VARIANTS[0]
): ImageStitchConfig {
  const wavePad = variant.waves ? 2 : 0;
  return {
    version: 1,
    name: `agent-abstract-solo-close-${variant.id}`,
    cols: 8 + (variant.width - variant.overlap) + wavePad,
    rows: 8,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: '#c43d2b', width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units: buildSoloPhoneMark(variant),
  };
}

export function abstractSoloHueVariantStitchConfig(
  hueIdx: number,
  variant: SoloMarkVariant = SOLO_CLOSE_VARIANT
): ImageStitchConfig {
  const idx = ((hueIdx % SOLO_HUE_VARIANT_COUNT) + SOLO_HUE_VARIANT_COUNT) % SOLO_HUE_VARIANT_COUNT;
  return {
    version: 1,
    name: `agent-abstract-${variant.id}-hue-${idx}`,
    cols: 8,
    rows: 8,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: '#c43d2b', width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units: buildSoloMark(variant.eyes, variant.block, idx),
  };
}

export function abstractDuetHueVariantStitchConfig(hueShift: number): ImageStitchConfig {
  const shift =
    ((hueShift % DUET_HUE_VARIANT_COUNT) + DUET_HUE_VARIANT_COUNT) % DUET_HUE_VARIANT_COUNT;
  return {
    version: 1,
    name: `agent-abstract-duet-3-hue-${shift}`,
    cols: 8,
    rows: 8,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: '#c43d2b', width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units: buildDuetMark(3, shift),
  };
}

/* ── bot-head marks (8×8) ── */

/**
 * A friendly bot-head mark in the app-icon idiom: antenna nub, rounded
 * head, side ears, and two pale rectangular eyes stitched over the
 * cloth. Fixed geometry across all variants — only the cloth colors
 * change (single-hue ramps or multi-hue patchwork), so a set reads as
 * one family.
 */
function buildBotHeadMark(colors: string[], block: number): PlacedUnit[] {
  const body: Cell[] = [
    ...rect(0, 0, 3, 4), // antenna nub
    ...offset(roundedRect(7, 6, 1), 1, 1), // head
    ...rect(3, 5, 0, 0), // left ear
    ...rect(3, 5, 7, 7), // right ear
  ];
  const units = quilt(body, colors, block);
  units.push(...satin(rect(3, 5, 2, 2), PAPER));
  units.push(...satin(rect(3, 5, 5, 5), PAPER));
  return units;
}

export interface BotHeadVariant {
  id: string;
  name: string;
  colors: string[];
  /** Quilt block size — how many cells share one unit+color patch. */
  block: number;
}

const botRamp = (hue: string) => [shade(hue, 0.25), shade(hue, 0.42), shade(hue, 0.58)];

export const BOT_HEAD_VARIANTS: BotHeadVariant[] = [
  { id: 'bot-blue', name: 'Bot blue', colors: botRamp(MINI_HUES[0]), block: 2 },
  { id: 'bot-yellow', name: 'Bot yellow', colors: botRamp(MINI_HUES[1]), block: 2 },
  { id: 'bot-green', name: 'Bot green', colors: botRamp(MINI_HUES[3]), block: 3 },
  { id: 'bot-pink', name: 'Bot pink', colors: botRamp(MINI_HUES[4]), block: 3 },
  {
    id: 'bot-multi',
    name: 'Bot multi',
    colors: MINI_HUES.map((hue) => shade(hue, 0.35)),
    block: 2,
  },
  {
    id: 'bot-multi-warm',
    name: 'Bot multi warm',
    colors: [shade(MINI_HUES[1], 0.3), shade(MINI_HUES[2], 0.3), shade(MINI_HUES[4], 0.35)],
    block: 3,
  },
];

/** A fixed bot-head mark on the 8×8 tile, in the given colorway. */
export function botHeadMarkStitchConfig(variant: BotHeadVariant): ImageStitchConfig {
  return {
    version: 1,
    name: `agent-${variant.id}`,
    cols: 8,
    rows: 8,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: '#c43d2b', width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units: buildBotHeadMark(variant.colors, variant.block),
  };
}

export type AbstractAgentConcept = 'waveform' | 'pulse' | 'weave' | 'duet';

const ABSTRACT_AGENT_BUILDERS: Record<AbstractAgentConcept, (seed: number) => PlacedUnit[]> = {
  waveform: buildWaveformMark,
  pulse: buildPulseMark,
  weave: buildWeaveMark,
  duet: buildDuetMark,
};

/**
 * A seeded non-face agent mark on a fixed 8×8 grid, for the 4px/cell
 * register. Deterministic: the same (concept, seed) always yields the
 * same mark.
 */
export function abstractAgentStitchConfig(
  concept: AbstractAgentConcept,
  seed: number
): ImageStitchConfig {
  return {
    version: 1,
    name: `agent-abstract-${concept}-${seed}`,
    cols: 8,
    rows: 8,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: '#c43d2b', width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units: ABSTRACT_AGENT_BUILDERS[concept](seed),
  };
}

/* ── entry point ── */

export type AgentAvatarKind = 'conversational' | 'work' | 'mini';

/**
 * A seeded agent avatar as a baked composition for StitchAsset.
 * Deterministic: the same (kind, seed) always yields the same avatar.
 */
export function agentAvatarStitchConfig(kind: AgentAvatarKind, seed: number): ImageStitchConfig {
  const raw =
    kind === 'conversational'
      ? buildConversational(seed)
      : kind === 'work'
        ? buildWork(seed)
        : buildMini(seed);

  // Normalize flush to row 0 / col 0
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  for (const u of raw) {
    minR = Math.min(minR, u.r);
    minC = Math.min(minC, u.c);
    maxR = Math.max(maxR, u.r);
    maxC = Math.max(maxC, u.c);
  }
  const units = raw.map((u) => ({ ...u, r: u.r - minR, c: u.c - minC }));

  return {
    version: 1,
    name: `agent-avatar-${kind}-${seed}`,
    cols: maxC - minC + 1,
    rows: maxR - minR + 1,
    cell: SITE_CELL_SIZE,
    insetPct: 0,
    style: { color: '#c43d2b', width: 2.6, sheen: true, shadow: false, holes: false },
    anim: { mode: 'wave', legDur: 120, stagger: 12, waveDir: 'right' },
    units,
  };
}
