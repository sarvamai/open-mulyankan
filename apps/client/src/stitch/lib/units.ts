/**
 * Stitch units, the atomic vocabulary of the Epoch identity.
 *
 * Each unit is an ordered list of half-stitches ("legs"). A leg is one
 * straight run of thread in 0..1 cell space: needle up at the start hole,
 * thread laid over the cloth, needle back under at the end hole.
 * Order matters; later legs lie OVER earlier ones at any crossing.
 */

export type Pt = [number, number];
/** A leg may be pinned; cloth physics leaves it anchored (motif outlines). */
export type Leg = [Pt, Pt] & { pinned?: boolean };
export type UnitKey =
  | 'cross'
  | 'slash'
  | 'back'
  | 'vert'
  | 'horiz'
  | 'half'
  | 'box'
  | 'vee'
  | 'plus'
  | 'weave3'
  | 'weave5'
  | 'hatchH'
  | 'hatchV'
  | 'hatchR'
  | 'hatchL'
  | 'crossH'
  | 'satin'
  | 'tweed'
  | 'circleFill'
  | 'diamondFill'
  | 'heartFill'
  | 'starFill'
  | 'leaf'
  | 'sunburst';

/* ------------------------------------------------------------------
   Cloth fill generators, a cell packed with several parallel threads
   so it reads as woven cloth. Same half-stitch legs, so animation,
   stacking and physics work unchanged.
   ------------------------------------------------------------------ */

/** n horizontal threads, top→bottom, alternating direction like real rows */
function fillH(n: number): Leg[] {
  const legs: Leg[] = [];
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) / n;
    legs.push(
      i % 2
        ? [
            [1, y],
            [0, y],
          ]
        : [
            [0, y],
            [1, y],
          ]
    );
  }
  return legs;
}

function fillV(n: number): Leg[] {
  const legs: Leg[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    legs.push(
      i % 2
        ? [
            [x, 1],
            [x, 0],
          ]
        : [
            [x, 0],
            [x, 1],
          ]
    );
  }
  return legs;
}

/** n parallel diagonals clipped to the cell, evenly spaced */
function fillDiag(n: number, dir: '/' | '\\'): Leg[] {
  const legs: Leg[] = [];
  const m = 2 * n - 1;
  for (let i = 1; i <= m; i++) {
    const t = i / (m + 1);
    const lo = Math.max(0, 2 * t - 1);
    const hi = Math.min(1, 2 * t);
    if (dir === '/')
      legs.push([
        [lo, hi],
        [hi, lo],
      ]);
    else
      legs.push([
        [lo, lo],
        [hi, hi],
      ]);
  }
  return legs;
}

/** over-under woven look: all horizontals, then all verticals on top */
function weave(n: number): Leg[] {
  return [...fillH(n), ...fillV(n)];
}

/* ------------------------------------------------------------------
   Creative units, polygon motifs stitched as a pinned outline plus a
   satin scan-line fill (ported from the reference studio). Outline
   legs are pinned so cloth physics keeps the shape anchored while the
   fill threads lift and sway.
   ------------------------------------------------------------------ */

function pinned(leg: Leg): Leg {
  const l = [...leg] as Leg;
  l.pinned = true;
  return l;
}

/** round to 5 decimals; keeps server/client SVG path strings identical */
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Satin scan-line fill of a polygon (handles concave shapes). */
function fillPolygon(pts: Pt[], rows: number): Leg[] {
  const ys = pts.map((p) => p[1]);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const legs: Leg[] = [];
  let flip = false;
  for (let r = 0; r < rows; r++) {
    const y = ymin + ((ymax - ymin) * (r + 0.5)) / rows;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const y0 = a[1];
      const y1 = b[1];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(a[0] + ((b[0] - a[0]) * (y - y0)) / (y1 - y0));
      }
    }
    xs.sort((p, q) => p - q);
    const ry = r5(y);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = r5(xs[k]);
      const xb = r5(xs[k + 1]);
      legs.push(
        flip
          ? [
              [xb, ry],
              [xa, ry],
            ]
          : [
              [xa, ry],
              [xb, ry],
            ]
      );
      flip = !flip;
    }
  }
  return legs;
}

function polyOutline(pts: Pt[]): Leg[] {
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return pinned([
      [a[0], a[1]],
      [b[0], b[1]],
    ] as Leg);
  });
}

function circlePts(n: number, cx: number, cy: number, r: number): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push([r5(cx + Math.cos(a) * r), r5(cy + Math.sin(a) * r)]);
  }
  return p;
}

function heartPts(): Pt[] {
  const p: Pt[] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    p.push([r5(0.5 + x / 38), r5(0.5 - y / 34)]);
  }
  return p;
}

function starPts(): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 0.18 : 0.45;
    p.push([r5(0.5 + Math.cos(a) * r), r5(0.5 + Math.sin(a) * r)]);
  }
  return p;
}

const CIRCLE_PTS = circlePts(18, 0.5, 0.5, 0.42);
const DIAMOND_PTS: Pt[] = [
  [0.5, 0.05],
  [0.95, 0.5],
  [0.5, 0.95],
  [0.05, 0.5],
];
const LEAF_PTS: Pt[] = [
  [0.5, 0.05],
  [0.85, 0.35],
  [0.7, 0.75],
  [0.5, 0.95],
  [0.3, 0.75],
  [0.15, 0.35],
];

function sunburstLegs(): Leg[] {
  const legs: Leg[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    legs.push([
      [0.5, 0.5],
      [r5(0.5 + Math.cos(a) * 0.45), r5(0.5 + Math.sin(a) * 0.45)],
    ]);
  }
  return legs;
}

export const UNITS: Record<UnitKey, { name: string; legs: Leg[] }> = {
  cross: {
    name: 'Cross',
    legs: [
      [
        [0, 1],
        [1, 0],
      ],
      [
        [0, 0],
        [1, 1],
      ],
    ],
  },
  slash: {
    name: 'Slash',
    legs: [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  },
  back: {
    name: 'Back',
    legs: [
      [
        [0, 0],
        [1, 1],
      ],
    ],
  },
  vert: {
    name: 'Upright',
    legs: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
    ],
  },
  horiz: {
    name: 'Bar',
    legs: [
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
  },
  half: {
    name: 'Half',
    legs: [
      [
        [0, 1],
        [1, 1],
      ],
      [
        [1, 1],
        [1, 0],
      ],
    ],
  },
  box: {
    name: 'Box',
    legs: [
      [
        [0.12, 0.12],
        [0.88, 0.12],
      ],
      [
        [0.88, 0.12],
        [0.88, 0.88],
      ],
      [
        [0.88, 0.88],
        [0.12, 0.88],
      ],
      [
        [0.12, 0.88],
        [0.12, 0.12],
      ],
    ],
  },
  vee: {
    name: 'Vee',
    legs: [
      [
        [0, 0],
        [0.5, 1],
      ],
      [
        [0.5, 1],
        [1, 0],
      ],
    ],
  },
  plus: {
    name: 'Plus',
    legs: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
  },
  // cloth fills
  weave3: { name: 'Weave 3×3', legs: weave(3) },
  weave5: { name: 'Weave 5×5', legs: weave(5) },
  hatchH: { name: 'Rows', legs: fillH(6) },
  hatchV: { name: 'Columns', legs: fillV(6) },
  hatchR: { name: 'Hatch /', legs: fillDiag(4, '/') },
  hatchL: { name: 'Hatch \\', legs: fillDiag(4, '\\') },
  crossH: { name: 'Cross-hatch', legs: [...fillDiag(4, '/'), ...fillDiag(4, '\\')] },
  satin: { name: 'Satin fill', legs: fillDiag(7, '/') },
  tweed: { name: 'Tweed', legs: [...fillH(3), ...fillDiag(3, '/'), ...fillDiag(3, '\\')] },
  // creative motifs, pinned outline + satin fill
  circleFill: {
    name: 'Circle',
    legs: [...polyOutline(CIRCLE_PTS), ...fillPolygon(CIRCLE_PTS, 12)],
  },
  diamondFill: {
    name: 'Diamond',
    legs: [...polyOutline(DIAMOND_PTS), ...fillPolygon(DIAMOND_PTS, 10)],
  },
  heartFill: { name: 'Heart', legs: [...polyOutline(heartPts()), ...fillPolygon(heartPts(), 12)] },
  starFill: { name: 'Star', legs: [...polyOutline(starPts()), ...fillPolygon(starPts(), 11)] },
  leaf: { name: 'Leaf', legs: [...polyOutline(LEAF_PTS), ...fillPolygon(LEAF_PTS, 10)] },
  sunburst: { name: 'Sunburst', legs: sunburstLegs() },
};

/** the nine fundamental single-stitch units */
export const UNIT_KEYS: UnitKey[] = [
  'cross',
  'slash',
  'back',
  'vert',
  'horiz',
  'half',
  'box',
  'vee',
  'plus',
];

/** dense multi-thread cloth fills */
export const CLOTH_KEYS: UnitKey[] = [
  'weave3',
  'weave5',
  'hatchH',
  'hatchV',
  'hatchR',
  'hatchL',
  'crossH',
  'satin',
  'tweed',
];

/** creative polygon motifs, pinned outline + satin fill */
export const CREATIVE_KEYS: UnitKey[] = [
  'circleFill',
  'diamondFill',
  'heartFill',
  'starFill',
  'leaf',
  'sunburst',
];

/** cloth fills read as dense; thinner threads, capped leg time, no needle */
export function isDense(unit: UnitKey): boolean {
  return UNITS[unit].legs.length > 4;
}

/** a motif unit has pinned outline legs; its unpinned legs are fills */
export function isMotifUnit(unit: UnitKey): boolean {
  return UNITS[unit].legs.some((l) => l.pinned);
}

/**
 * Effective stroke width for a unit: cloth fills thin their threads as
 * the cell packs tighter (ported from the reference tool, where a base
 * width of 2.7 maps to max(1.3, 3.2 - legs*0.13)).
 */
export function threadWidth(unit: UnitKey, base: number): number {
  const n = UNITS[unit].legs.length;
  if (n <= 4) return base;
  return Math.max(base * 0.48, (base * (3.2 - n * 0.13)) / 2.7);
}

/** Epoch palette; ink on paper, two thread accents. */
export const THREAD = {
  ink: '#141414',
  red: '#C20D26',
  indigo: '#2859C0',
  paper: '#faf8f5',
  faint: '#b0aaa0',
} as const;

/* ------------------------------------------------------------------
   Thread materials; each has a distinct render signature, used by
   the live renderers (WebGL shader + layered SVG) and static export.
   ------------------------------------------------------------------ */

export interface ThreadMaterial {
  name: string;
  /** base thickness multiplier */
  widthMul: number;
  /** highlight strength; lifts a lighter shade of the base color (0..1) */
  sheen: number;
  /** width of the sheen core (fraction of thread) */
  sheenW: number;
  /** twist-band strength (0 = smooth, 1+ = bold twist) */
  ply: number;
  /** twist frequency multiplier */
  plyFreq: number;
  /** edge darkness (0 = black rim, 1 = none); lower = deeper */
  edge: number;
  /** optional multiplicative tint for the sheen [r,g,b] 0..1 (metallic = cool) */
  tint: [number, number, number] | null;
}

export const THREADS = {
  cotton: {
    name: 'Stranded Cotton',
    widthMul: 1.0,
    sheen: 0.72,
    sheenW: 0.26,
    ply: 1.0,
    plyFreq: 0.55,
    edge: 0.42,
    tint: null,
  },
  siteCotton: {
    name: 'Site Cotton',
    widthMul: 1.0,
    sheen: 0.35,
    sheenW: 0.16,
    ply: 0.35,
    plyFreq: 0.45,
    edge: 0.36,
    tint: null,
  },
  heroCotton: {
    name: 'Hero Cotton',
    widthMul: 1.0,
    sheen: 0.56,
    sheenW: 0.24,
    ply: 0.4,
    plyFreq: 0.48,
    edge: 0.32,
    tint: [0.85, 0.9, 1.0],
  },
  silk: {
    name: 'Silk',
    widthMul: 0.95,
    sheen: 0.92,
    sheenW: 0.42,
    ply: 0.25,
    plyFreq: 0.3,
    edge: 0.55,
    tint: null,
  },
  metallic: {
    name: 'Metallic',
    widthMul: 0.9,
    sheen: 1.0,
    sheenW: 0.2,
    ply: 1.4,
    plyFreq: 1.3,
    edge: 0.3,
    tint: [0.85, 0.88, 1.0],
  },
  pearl: {
    name: 'Pearl Cotton',
    widthMul: 1.15,
    sheen: 0.85,
    sheenW: 0.3,
    ply: 1.3,
    plyFreq: 0.7,
    edge: 0.38,
    tint: null,
  },
} satisfies Record<string, ThreadMaterial>;

export type ThreadKey = keyof typeof THREADS;
export const THREAD_KEYS = Object.keys(THREADS) as ThreadKey[];

/** lighten (t>0) or darken (t<0) a hex color */
export function shade(hex: string, t: number): string {
  const c = hex.replace('#', '');
  let r = parseInt(c.slice(0, 2), 16);
  let g = parseInt(c.slice(2, 4), 16);
  let b = parseInt(c.slice(4, 6), 16);
  if (t >= 0) {
    r += (255 - r) * t;
    g += (255 - g) * t;
    b += (255 - b) * t;
  } else {
    r *= 1 + t;
    g *= 1 + t;
    b *= 1 + t;
  }
  const h = (x: number) => ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2);
  return '#' + h(r) + h(g) + h(b);
}

/** multiply a hex color by a normalized [r,g,b] tint (0..1) */
export function mix3(hex: string, tint: [number, number, number]): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) * tint[0];
  const g = parseInt(c.slice(2, 4), 16) * tint[1];
  const b = parseInt(c.slice(4, 6), 16) * tint[2];
  const h = (x: number) => ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2);
  return '#' + h(r) + h(g) + h(b);
}

/**
 * Boost a color in HSL space; multiply saturation, add lightness.
 * Unlike `shade()` (which blends toward white and washes colors out),
 * this makes colors pop without desaturating them.
 */
export function saturateColor(hex: string, satMul: number, lightAdd: number): string {
  // hexToRGB is already normalized 0..1
  const [r0, g0, b0] = hexToRGB(hex);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const l0 = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l0 - 1));
    if (max === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0)) % 6;
    else if (max === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h *= 60;
  }
  const s1 = Math.min(1, s * satMul);
  const l1 = Math.max(0, Math.min(0.92, l0 + lightAdd));
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l1 - c / 2;
  const [r1, g1, b1] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to = (v: number) => `0${Math.round((v + m) * 255).toString(16)}`.slice(-2);
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}

export function hexToRGB(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

/* ───────────────────────────────────────────────────────────
   Motif sizing, one canonical cell size and inset used
   everywhere. Override per-component only when deliberate.
   ─────────────────────────────────────────────────────────── */

/** Standard stitch cell size in px (SVG coordinate space). */
export const CELL_SIZE = 16;

/**
 * THE site-wide on-screen stitch cell, in px. Procedural fields, measured
 * surfaces, dividers, card rails, footer, and ImageStitchFromSource (with
 * fitCellPx) derive cols/rows from this so cells render at the same visual
 * size across the page.
 */
export const SITE_CELL_SIZE = 20;

/**
 * On-screen cell size for baked playground compositions (StitchComposition).
 * Smaller than SITE_CELL_SIZE so decorative side art (FAQ ornaments, etc.)
 * doesn't dominate adjacent content. Baked grids keep their authored cols/rows;
 * rendered width is cols × COMPOSITION_CELL_SIZE.
 */
export const COMPOSITION_CELL_SIZE = 16;

/** Thread padding inside a cell; 0 fills the full cell, minimal gap. */
export const CELL_INSET = 0;

export interface StitchStyle {
  color: string;
  /** stroke width in px of the svg coordinate space */
  width: number;
  sheen: boolean;
  shadow: boolean;
  holes: boolean;
}

export type FieldPattern =
  | 'plain'
  | 'checker'
  | 'scatter'
  | 'twill'
  | 'ribbon'
  | 'motif-strip'
  | 'column-weave'
  | 'side-rail';
/** "ltr" and "random" are legacy aliases for coordinated / uncoordinated */
export type AnimMode = 'coordinated' | 'together' | 'uncoordinated' | 'wave' | 'ltr' | 'random';
export type StitchOrder = 'ltr' | 'spiral' | 'diag' | 'random';
export type WaveDir = 'right' | 'down' | 'diag' | 'out';

export interface AnimConfig {
  mode: AnimMode;
  /** ms one leg takes to draw */
  legDur: number;
  /** ms between neighbouring units (column for wave/ltr) */
  stagger: number;
  /** sequence order when mode is "coordinated" */
  order?: StitchOrder;
  /** sweep direction when mode is "wave" */
  waveDir?: WaveDir;
}

export interface FieldConfig {
  cols: number;
  rows: number;
  cell: number;
  unit: UnitKey;
  pattern: FieldPattern;
  /** 0..1, chance a cell is stitched when pattern is "scatter" */
  density: number;
  seed: number;
  style: StitchStyle;
  /** every Nth stitched cell takes an accent colour (0 = none) */
  accentStride: number;
  accentColors: string[];
  anim: AnimConfig;
  /** mix of units woven through the field; falls back to `unit` */
  unitSeq?: UnitKey[];
  unitPick?: 'cycle' | 'random';
  /**
   * Units used only in the top/bottom `verticalFade` ramps (e.g. a little
   * tweed at the edges). Falls back to `unitSeq` / `unit` when omitted.
   */
  edgeUnitSeq?: UnitKey[];
  /** 0..1, density of a faint second layer offset by half a cell */
  overlap?: number;
  /**
   * Fraction of field height (0..0.5) used for top/bottom density ramps.
   * Top ramps 0→density, middle stays solid, bottom ramps density→0.
   * Applied to scatter (and any pattern when set).
   */
  verticalFade?: number;
  /**
   * Extra rows added to the solid centre band (split across top/bottom).
   * Shrinks each fade ramp so the filled middle is taller.
   */
  solidExtraRows?: number;
  /**
   * When set (0..0.2), only the last fraction of field height maps into
   * the final palette stop; keeps a narrow blue tail at the bottom.
   */
  colorBottomBookend?: number;
}

/** Deterministic PRNG so server and client render the same cloth. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlacedUnit {
  r: number;
  c: number;
  unit: UnitKey;
  color: string;
  opacity?: number;
}

/** Smootherstep, C2-continuous ease for density ramps. */
function smootherstep(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Deterministic 0..1 hash, used for jagged frontiers without a PRNG stream. */
function hash01(seed: number, n: number): number {
  let x = Math.imul(seed ^ n, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Inclusive row range for the fully-filled centre band. */
function solidBandRows(cfg: FieldConfig): { start: number; end: number } {
  const fade = Math.min(cfg.verticalFade ?? 0, 0.45);
  const last = Math.max(0, cfg.rows - 1);
  const fadeRows = Math.round(fade * last);
  const pad = Math.floor((cfg.solidExtraRows ?? 0) / 2);
  return {
    start: Math.max(0, fadeRows - pad),
    end: Math.min(last, last - fadeRows + pad),
  };
}

/**
 * Per-cell stitch probability for `verticalFade` fields.
 *
 * The centre band is always fully stitched; no gaps, no column noise.
 * Top/bottom ramps dissolve with per-column shift (peaks & valleys) and
 * cell noise (inconsistent gaps) only in the outer fringe.
 */
function densityAtCell(cfg: FieldConfig, r: number, c: number): number {
  const fade = Math.min(cfg.verticalFade ?? 0, 0.45);
  if (fade <= 0) return cfg.density;

  const { start: solidStart, end: solidEnd } = solidBandRows(cfg);

  // Guaranteed solid middle, every cell, every column
  if (r >= solidStart && r <= solidEnd) return cfg.density;

  const isTop = r < solidStart;
  const colN = hash01(cfg.seed, c * 2 + (isTop ? 1 : 2));
  const shift = (colN - 0.5) * 0.4;
  const rampRows = Math.max(1, isTop ? solidStart : cfg.rows - 1 - solidEnd);
  const depth = isTop ? r : cfg.rows - 1 - r;
  const u = Math.max(0, Math.min(1, depth / rampRows + shift));
  const envelope = smootherstep(u);

  // Inner ramp is solid so the filled middle reads wide; only the outer
  // fringe dissolves with inconsistent gaps.
  if (envelope >= 0.4) return cfg.density;

  const cellN = hash01(cfg.seed + 91, r * 131 + c);
  const threshold = Math.pow(envelope, 1.35) * (0.15 + 0.85 * cellN);
  return Math.min(1, cfg.density * threshold);
}

/**
 * Map a row onto `accentColors` as a vertical colour gradient, with light
 * horizontal dither so bands don't read as hard stripes.
 *
 * When `verticalFade` is set, cosine easing lingers on palette bookends and
 * per-cell wobble breaks up horizontal banding.
 */
function colorAtRow(cfg: FieldConfig, r: number, c: number): string {
  const palette = cfg.accentColors.length > 0 ? cfg.accentColors : [cfg.style.color];
  if (palette.length === 1) return palette[0];
  const rows = Math.max(1, cfg.rows - 1);
  const drift = (((r * 7 + c * 13) % 11) - 5) / 48;
  let t = Math.max(0, Math.min(1, r / rows + drift));

  if ((cfg.verticalFade ?? 0) > 0) {
    t = (1 - Math.cos(t * Math.PI)) / 2;
    const wobble =
      (hash01(cfg.seed + 31, r * 19 + c * 23) - 0.5) * 0.11 +
      (hash01(cfg.seed + 53, r * 41 + c * 7) - 0.5) * 0.07;
    t = Math.max(0, Math.min(1, t + wobble));
  }

  const idx = paletteIndexAtT(cfg, t, palette.length);
  const i0 = Math.floor(idx);
  const i1 = Math.min(palette.length - 1, i0 + 1);
  const f = idx - i0;
  const dither = ((r * 3 + c * 5 + Math.floor(hash01(cfg.seed + 67, r + c * 11) * 4)) % 10) / 10;
  return dither < f ? palette[i1] : palette[i0];
}

/** Map eased vertical position onto palette index. */
function paletteIndexAtT(cfg: FieldConfig, t: number, paletteLen: number): number {
  if (paletteLen <= 1) return 0;
  const maxIdx = paletteLen - 1;
  const bottom = cfg.colorBottomBookend;
  if (bottom != null && bottom > 0) {
    const span = Math.min(bottom, 0.2);
    const split = 1 - span;
    const warmEnd = maxIdx - 1;
    if (t >= split) {
      const u = (t - split) / span;
      return warmEnd + u;
    }
    return (t / split) * warmEnd;
  }
  return t * maxIdx;
}

/** Lay out a field of units according to a config. Deterministic. */
export function layoutField(cfg: FieldConfig): PlacedUnit[] {
  if (cfg.pattern === 'side-rail') {
    return layoutSideRail(cfg);
  }
  if (cfg.pattern === 'column-weave') {
    return layoutColumnWeave(cfg);
  }
  if (cfg.pattern === 'motif-strip') {
    return layoutMotifStrip(cfg);
  }
  if (cfg.pattern === 'ribbon') {
    return layoutRibbon(cfg);
  }

  const rand = mulberry32(cfg.seed);
  const seq = cfg.unitSeq?.length ? cfg.unitSeq : [cfg.unit];
  const edgeSeq = cfg.edgeUnitSeq?.length ? cfg.edgeUnitSeq : seq;
  const out: PlacedUnit[] = [];
  const fade = cfg.verticalFade != null && cfg.verticalFade > 0;
  const solid = fade ? solidBandRows(cfg) : { start: 0, end: cfg.rows - 1 };
  let stitched = 0;
  for (let r = 0; r < cfg.rows; r++) {
    const onEdge = fade && (r < solid.start || r > solid.end);
    const activeSeq = onEdge ? edgeSeq : seq;
    for (let c = 0; c < cfg.cols; c++) {
      if (cfg.pattern === 'checker' && (r + c) % 2 === 1) continue;
      if (cfg.pattern === 'twill' && (c + r * 2) % 4 >= 2) continue;

      if (fade) {
        const p = densityAtCell(cfg, r, c);
        // p === 1 → solid band, always stitch. Ramp: scatter for jagged gaps.
        if (p < 1 && hash01(cfg.seed + 7, r * 10007 + c) >= p) continue;
      } else if (cfg.pattern === 'scatter' && rand() > cfg.density) {
        continue;
      }

      stitched++;
      let color = cfg.style.color;
      if (fade && cfg.accentColors.length > 0) {
        color = colorAtRow(cfg, r, c);
      } else if (
        cfg.accentStride > 0 &&
        cfg.accentColors.length > 0 &&
        stitched % cfg.accentStride === 0
      ) {
        const i = Math.floor(stitched / cfg.accentStride) % cfg.accentColors.length;
        color = cfg.accentColors[i];
      }
      const unit =
        cfg.unitPick === 'random'
          ? activeSeq[Math.floor(rand() * activeSeq.length)]
          : activeSeq[stitched % activeSeq.length];
      out.push({ r, c, unit, color });
    }
  }
  // Overlap layer is disabled for vertical-fade fields (no stacked cells).
  if (cfg.overlap && cfg.overlap > 0 && !fade) {
    const rand2 = mulberry32(cfg.seed * 13 + 5);
    for (let r = 0; r < cfg.rows - 1; r++) {
      for (let c = 0; c < cfg.cols - 1; c++) {
        if (rand2() > cfg.overlap) continue;
        const unit = seq[Math.floor(rand2() * seq.length)];
        out.push({
          r: r + 0.5,
          c: c + 0.5,
          unit,
          color: cfg.style.color,
          opacity: 0.3,
        });
      }
    }
  }
  return out;
}

/**
 * Deterministic side-rail fill, staggered weave3 / hatchR / crossH checker.
 * Same config on left and right gives identical columns and rows.
 */
function layoutSideRail(cfg: FieldConfig): PlacedUnit[] {
  const palette = cfg.accentColors.length > 0 ? cfg.accentColors : [cfg.style.color];
  const units: UnitKey[] = ['weave3', 'hatchR', 'crossH'];
  const out: PlacedUnit[] = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      out.push({
        r,
        c,
        unit: units[(c + r) % units.length],
        color: palette[(c + r) % palette.length],
      });
    }
  }
  return out;
}

/**
 * 3-row column weave, 8-column repeat: grid pillars, cross-hatch / diagonal
 * blocks, then a green · orange checker tail.
 */
function layoutColumnWeave(cfg: FieldConfig): PlacedUnit[] {
  const blue = cfg.accentColors[0] ?? '#3333cc';
  const green = cfg.accentColors[1] ?? '#6ea335';
  const orange = cfg.accentColors[2] ?? '#e6651b';
  const ink = THREAD.ink;

  type Cell = { unit: UnitKey; color: string };
  const period: Cell[][] = [
    [
      { unit: 'weave3', color: orange },
      { unit: 'weave3', color: orange },
      { unit: 'weave3', color: orange },
    ],
    [
      { unit: 'crossH', color: ink },
      { unit: 'hatchR', color: blue },
      { unit: 'crossH', color: ink },
    ],
    [
      { unit: 'hatchR', color: blue },
      { unit: 'hatchR', color: blue },
      { unit: 'hatchR', color: blue },
    ],
    [
      { unit: 'crossH', color: ink },
      { unit: 'hatchR', color: blue },
      { unit: 'crossH', color: ink },
    ],
    [
      { unit: 'weave3', color: orange },
      { unit: 'weave3', color: orange },
      { unit: 'weave3', color: orange },
    ],
    [
      { unit: 'hatchR', color: orange },
      { unit: 'crossH', color: green },
      { unit: 'hatchR', color: orange },
    ],
    [
      { unit: 'crossH', color: green },
      { unit: 'hatchR', color: orange },
      { unit: 'crossH', color: green },
    ],
    [
      { unit: 'hatchR', color: orange },
      { unit: 'crossH', color: green },
      { unit: 'hatchR', color: orange },
    ],
  ];

  const rows = Math.min(cfg.rows, 3);
  const out: PlacedUnit[] = [];
  for (let c = 0; c < cfg.cols; c++) {
    const col = period[c % period.length];
    for (let r = 0; r < rows; r++) {
      out.push({ r, c, unit: col[r].unit, color: col[r].color });
    }
  }
  return out;
}

type StripMotifCell = {
  dr: number;
  dc: number;
  unit: UnitKey;
  color: string;
};

function stampStripMotif(
  grid: Map<string, PlacedUnit>,
  anchorR: number,
  anchorC: number,
  cells: StripMotifCell[],
  cfg: FieldConfig
) {
  for (const { dr, dc, unit, color } of cells) {
    const r = anchorR + dr;
    const c = anchorC + dc;
    if (r < 0 || r >= cfg.rows || c < 0 || c >= cfg.cols) continue;
    grid.set(`${r},${c}`, { r, c, unit, color });
  }
}

/** 3×3 filled diamond, core plus four arms. */
function buildDiamond3(palette: string[], colorIdx: number): StripMotifCell[] {
  const core = palette[colorIdx % palette.length];
  const arm = palette[(colorIdx + 1) % palette.length];
  const cells: StripMotifCell[] = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const dist = Math.abs(dr - 1) + Math.abs(dc - 1);
      if (dist > 1) continue;
      cells.push({
        dr,
        dc,
        unit: dist === 0 ? 'weave5' : 'weave3',
        color: dist === 0 ? core : arm,
      });
    }
  }
  return cells;
}

/** 3×3 hollow diamond ring, centre left open. */
function buildRing3(palette: string[], colorIdx: number): StripMotifCell[] {
  const edge = palette[(colorIdx + 2) % palette.length];
  const cells: StripMotifCell[] = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const dist = Math.abs(dr - 1) + Math.abs(dc - 1);
      if (dist !== 1) continue;
      cells.push({ dr, dc, unit: 'hatchH', color: edge });
    }
  }
  return cells;
}

function buildX3(palette: string[], colorIdx: number): StripMotifCell[] {
  const color = palette[(colorIdx + 1) % palette.length];
  return [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ].map(([dr, dc]) => ({ dr, dc, unit: 'cross' as UnitKey, color }));
}

/** 3×3 soft circle, centre plus ring, corners open. */
function buildCircle3(palette: string[], colorIdx: number): StripMotifCell[] {
  const core = palette[(colorIdx + 2) % palette.length];
  const mid = palette[colorIdx % palette.length];
  const cells: StripMotifCell[] = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const d2 = (dr - 1) ** 2 + (dc - 1) ** 2;
      if (d2 > 2) continue;
      cells.push({
        dr,
        dc,
        unit: d2 === 0 ? 'weave5' : 'satin',
        color: d2 === 0 ? core : mid,
      });
    }
  }
  return cells;
}

/** Middle-row bar spanning 3 columns. */
function buildBar3(palette: string[], colorIdx: number): StripMotifCell[] {
  const color = palette[colorIdx % palette.length];
  return [0, 1, 2].map((dc) => ({
    dr: 1,
    dc,
    unit: 'hatchV' as UnitKey,
    color,
  }));
}

/** Diagonal chevron stack. */
function buildChevron3(palette: string[], colorIdx: number): StripMotifCell[] {
  const a = palette[colorIdx % palette.length];
  const b = palette[(colorIdx + 1) % palette.length];
  return [
    { dr: 0, dc: 1, unit: 'slash', color: a },
    { dr: 1, dc: 1, unit: 'plus', color: b },
    { dr: 2, dc: 1, unit: 'back', color: a },
  ];
}

/**
 * 3-row tiled border, compact diamond · x · circle · ring motifs with
 * sparse connector stitches on the top and bottom rows between motifs.
 */
function layoutMotifStrip(cfg: FieldConfig): PlacedUnit[] {
  const palette = cfg.accentColors.length > 0 ? cfg.accentColors : [cfg.style.color];
  const grid = new Map<string, PlacedUnit>();

  type MotifKind = 'diamond' | 'x' | 'circle' | 'ring' | 'bar' | 'chevron';
  const sequence: Array<{ kind: MotifKind; w: number; gap: number }> = [
    { kind: 'diamond', w: 3, gap: 2 },
    { kind: 'x', w: 3, gap: 2 },
    { kind: 'circle', w: 3, gap: 2 },
    { kind: 'x', w: 3, gap: 2 },
    { kind: 'ring', w: 3, gap: 2 },
    { kind: 'bar', w: 3, gap: 2 },
    { kind: 'x', w: 3, gap: 2 },
    { kind: 'chevron', w: 3, gap: 3 },
  ];

  const builders: Record<MotifKind, (palette: string[], idx: number) => StripMotifCell[]> = {
    diamond: buildDiamond3,
    x: buildX3,
    circle: buildCircle3,
    ring: buildRing3,
    bar: buildBar3,
    chevron: buildChevron3,
  };

  let col = 0;
  let motifIdx = 0;
  while (col < cfg.cols) {
    const entry = sequence[motifIdx % sequence.length];
    if (col + entry.w > cfg.cols) break;

    stampStripMotif(grid, 0, col, builders[entry.kind](palette, motifIdx), cfg);

    const gapStart = col + entry.w;
    for (let g = 0; g < entry.gap && gapStart + g < cfg.cols; g++) {
      const gc = gapStart + g;
      if (g === 0 && cfg.rows >= 1) {
        grid.set(`0,${gc}`, {
          r: 0,
          c: gc,
          unit: 'cross',
          color: palette[(motifIdx + g) % palette.length],
        });
      }
      if (g === entry.gap - 1 && cfg.rows >= 3) {
        grid.set(`2,${gc}`, {
          r: 2,
          c: gc,
          unit: 'cross',
          color: palette[(motifIdx + g + 1) % palette.length],
        });
      }
    }

    col += entry.w + entry.gap;
    motifIdx++;
  }

  return [...grid.values()];
}

/**
 * Hero strip, three rows with different character: dense cloth on top/bottom,
 * sparse punctuation in the middle, colour bands, and intentional gaps.
 */
function layoutRibbon(cfg: FieldConfig): PlacedUnit[] {
  const palette = cfg.accentColors.length > 0 ? cfg.accentColors : [cfg.style.color];
  const rowDensity = [0.76, 0.4, 0.68];
  const rowUnits: UnitKey[][] = [
    ['weave3', 'satin', 'hatchH', 'weave5', 'crossH'],
    ['cross', 'plus', 'slash', 'vert', 'horiz', 'vee', 'half'],
    ['tweed', 'satin', 'hatchR', 'hatchL', 'weave3'],
  ];

  const colColors: string[] = [];
  const bandRand = mulberry32(cfg.seed + 99);
  let bandColor = 0;
  while (colColors.length < cfg.cols) {
    const bandW = 3 + Math.floor(bandRand() * 4);
    const color = palette[bandColor % palette.length];
    for (let i = 0; i < bandW && colColors.length < cfg.cols; i++) {
      colColors.push(color);
    }
    bandColor++;
  }

  const out: PlacedUnit[] = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (c % 11 === 5) continue;
      if ((c * 3 + r * 5 + cfg.seed) % 17 === 0) continue;
      if (r === 1 && c % 6 === 2) continue;

      const cellRand = mulberry32(cfg.seed + r * 1009 + c * 17);
      if (cellRand() > rowDensity[r]) continue;

      const units = rowUnits[Math.min(r, rowUnits.length - 1)];
      const unit = units[(c + r * 3 + cfg.seed) % units.length];
      let color = colColors[c];
      if ((c + r) % 13 === 0) {
        color = palette[(palette.indexOf(color) + 1) % palette.length];
      }

      out.push({ r, c, unit, color });
    }
  }
  return out;
}

/* ------------------------------------------------------------------
   Motifs, small figures composed from units, used as decorative
   icons: hero flourishes, section ornaments, empty states.
   ------------------------------------------------------------------ */

export type MotifName = 'diamond' | 'star' | 'temple' | 'chevron';

export function motifUnits(
  name: MotifName,
  base: string,
  accent: string
): { cells: PlacedUnit[]; rows: number; cols: number } {
  const cells: PlacedUnit[] = [];
  if (name === 'diamond') {
    const s = 4;
    for (let r = 0; r <= s * 2; r++) {
      for (let c = 0; c <= s * 2; c++) {
        if (Math.abs(r - s) + Math.abs(c - s) === s) {
          cells.push({ r, c, unit: 'cross', color: base });
        }
      }
    }
    cells.push({ r: s, c: s, unit: 'plus', color: accent });
    return { cells, rows: s * 2 + 1, cols: s * 2 + 1 };
  }
  if (name === 'star') {
    const spots: Array<[number, number, UnitKey]> = [
      [4, 4, 'plus'],
      [2, 2, 'back'],
      [2, 6, 'slash'],
      [6, 2, 'slash'],
      [6, 6, 'back'],
      [2, 4, 'vert'],
      [6, 4, 'vert'],
      [4, 2, 'horiz'],
      [4, 6, 'horiz'],
      [0, 4, 'vert'],
      [8, 4, 'vert'],
      [4, 0, 'horiz'],
      [4, 8, 'horiz'],
      [1, 1, 'back'],
      [1, 7, 'slash'],
      [7, 1, 'slash'],
      [7, 7, 'back'],
    ];
    spots.forEach(([r, c, unit], i) => cells.push({ r, c, unit, color: i === 0 ? accent : base }));
    return { cells, rows: 9, cols: 9 };
  }
  if (name === 'temple') {
    // gopuram border, repeating stepped triangles
    const tris = 4;
    for (let t = 0; t < tris; t++) {
      const c0 = t * 4;
      cells.push({ r: 0, c: c0 + 1, unit: 'vee', color: t % 2 ? base : accent });
      for (let c = c0; c <= c0 + 2; c++) {
        cells.push({ r: 1, c, unit: 'cross', color: base });
      }
    }
    return { cells, rows: 2, cols: tris * 4 - 1 };
  }
  // chevron, running zigzag
  const n = 12;
  for (let c = 0; c < n; c++) {
    cells.push({
      r: 0,
      c,
      unit: c % 2 ? 'back' : 'slash',
      color: c % 6 === 3 ? accent : base,
    });
  }
  return { cells, rows: 1, cols: n };
}

/** Animation delay for one placed unit under a given mode. */
export function unitDelay(
  u: PlacedUnit,
  cfg: {
    mode: AnimMode;
    stagger: number;
    cols: number;
    rows: number;
    seed: number;
    order?: StitchOrder;
    waveDir?: WaveDir;
  }
): number {
  const cx = (cfg.cols - 1) / 2;
  const cy = (cfg.rows - 1) / 2;
  const scattered = () => {
    const rand = mulberry32(cfg.seed + u.r * 31 + u.c * 7);
    return rand() * cfg.stagger * cfg.cols * 0.8;
  };
  switch (cfg.mode) {
    case 'together':
      return 0;
    case 'uncoordinated':
      return scattered();
    case 'random':
      return scattered();
    case 'wave': {
      const dir = cfg.waveDir ?? 'right';
      const v =
        dir === 'right'
          ? u.c
          : dir === 'down'
            ? u.r
            : dir === 'diag'
              ? (u.r + u.c) * 0.7
              : Math.hypot(u.c - cx, u.r - cy) * 1.2;
      return v * cfg.stagger;
    }
    case 'coordinated':
    case 'ltr': {
      const order = cfg.order ?? 'ltr';
      if (order === 'spiral') return Math.hypot(u.c - cx, u.r - cy) * cfg.stagger * 1.6;
      if (order === 'diag') return (u.r + u.c) * cfg.stagger;
      if (order === 'random') return scattered();
      return (u.r * cfg.cols + u.c) * cfg.stagger * 0.35;
    }
  }
}

/* ------------------------------------------------------------------
   Composable shapes, cell lists for stamping figures onto a grid.
   Ported from the reference tool, scaled to the target grid.
   ------------------------------------------------------------------ */

export type ShapeName = 'heart' | 'circle' | 'diamond' | 'star' | 'letterA';
export const SHAPE_NAMES: ShapeName[] = ['heart', 'circle', 'diamond', 'star', 'letterA'];

export function shapeCells(shape: ShapeName, cols: number, rows: number): Array<[number, number]> {
  const cx = cols / 2;
  const cy = rows / 2;
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  const put = (r: number, c: number) => {
    r = Math.round(r);
    c = Math.round(c);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const k = `${r},${c}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push([r, c]);
  };
  if (shape === 'circle') {
    const rad = Math.min(cols, rows) / 2 - 2;
    for (let a = 0; a < 360; a += 3) {
      put(cy + Math.sin((a * Math.PI) / 180) * rad, cx + Math.cos((a * Math.PI) / 180) * rad);
    }
  } else if (shape === 'diamond') {
    const s = Math.min(8, Math.floor(Math.min(cols, rows) / 2) - 2);
    for (let i = -s; i <= s; i++) {
      put(cy + i, cx - (s - Math.abs(i)));
      put(cy + i, cx + (s - Math.abs(i)));
    }
  } else if (shape === 'heart') {
    const ky = 0.6 * (rows / 22);
    const kx = 0.42 * (cols / 26);
    for (let t = 0; t < Math.PI * 2; t += 0.06) {
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      put(cy - y * ky, cx + x * kx);
    }
  } else if (shape === 'star') {
    const spikes = 5;
    const outer = Math.min(cols, rows) / 2 - 2;
    const inner = outer * 0.42;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + (i * Math.PI) / spikes;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    pts.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let s = 0; s <= steps; s++) {
        put(ay + ((by - ay) * s) / steps, ax + ((bx - ax) * s) / steps);
      }
    }
  } else {
    const map = ['..XX..', '..XX..', '.X..X.', '.X..X.', '.XXXX.', 'X....X', 'X....X', 'X....X'];
    const or_ = cy - map.length / 2;
    const oc = cx - 3;
    map.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === 'X') put(or_ + r, oc + c);
      })
    );
  }
  return out;
}

/** Cells of a stitched heart, for the register thank-you moment. */
export function heartCells(cols = 18, rows = 15): Array<[number, number]> {
  const cx = cols / 2;
  const cy = rows / 2 - 0.5;
  const seen = new Set<string>();
  const cells: Array<[number, number]> = [];
  for (let t = 0; t < Math.PI * 2; t += 0.05) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const r = Math.round(cy - y * 0.38);
    const c = Math.round(cx + x * 0.42);
    const k = `${r},${c}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (r >= 0 && r < rows && c >= 0 && c < cols) cells.push([r, c]);
  }
  return cells;
}
