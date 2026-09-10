/**
 * Tatva design-system accent colors as baked hex for stitch assets.
 *
 * Values mirror `@sarvam/tatva` light-mode CSS tokens (space-separated RGB in
 * styles.css). WebGL thread rendering cannot read CSS variables, so motifs
 * bake these literals at module load.
 */

function rgb(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Core content ink — tatva-content-primary (20 20 20) */
export const TATVA_INK = rgb(20, 20, 20);

/** Knockout fill on saturated cloth — tatva-content-inverse (255 255 255) */
export const TATVA_CONTENT_INVERSE = rgb(255, 255, 255);

/** Accent families — content + mid steps from Tatva light tokens */
export const TATVA = {
  indigo: {
    content: rgb(51, 51, 204), // indigo-800 / indigo-content
    mid: rgb(81, 108, 220), // indigo-500
  },
  orange: {
    content: rgb(230, 101, 27), // orange-800 / orange-content
    mid: rgb(240, 120, 60), // orange-500
  },
  green: {
    content: rgb(56, 84, 24), // green-800 / green-content
    mid: rgb(95, 150, 55), // green-500
  },
  pink: {
    content: rgb(157, 32, 85), // pink-600 / pink-content
    mid: rgb(200, 70, 115), // pink-500
  },
  red: {
    content: rgb(184, 21, 20), // red-500 / red-content
    mid: rgb(220, 100, 80), // red-400
  },
  yellow: {
    content: rgb(192, 136, 39), // yellow-700 / yellow-content
    mid: rgb(240, 185, 90), // yellow-400
  },
} as const;

/** Per-icon accent pairing for the design-system palette test section. */
export interface DesignSystemIconPalette {
  primary: string;
  secondary: string;
  ink: string;
}

export const DESIGN_SYSTEM_PRODUCT_PALETTES = {
  models: { primary: TATVA.yellow.mid, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  api: { primary: TATVA.orange.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  integrations: { primary: TATVA.green.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  agents: { primary: TATVA.green.mid, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  templates: { primary: TATVA.yellow.mid, secondary: TATVA.yellow.content, ink: TATVA_INK },
  campaigns: { primary: TATVA.orange.content, secondary: TATVA.red.content, ink: TATVA_INK },
  analytics: { primary: TATVA.indigo.mid, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  docs: { primary: TATVA.indigo.content, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  security: { primary: TATVA.green.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  search: { primary: TATVA.indigo.mid, secondary: TATVA.orange.mid, ink: TATVA_INK },
} as const satisfies Record<string, DesignSystemIconPalette>;

/** Agent family — rounded plus-head shell (top/bottom nubs + wide face + eyes). */
export const DESIGN_SYSTEM_AGENT_PALETTES = {
  /** Pinned keepers — do not reshape without user ask. */
  'agent-bot': { primary: TATVA.indigo.mid, secondary: TATVA.indigo.content, ink: TATVA_INK },
  'agent-round': { primary: TATVA.green.mid, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'agent-grin': { primary: TATVA.pink.mid, secondary: TATVA.pink.content, ink: TATVA_INK },
  'agent-squint': { primary: TATVA.orange.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  'agent-gaze': { primary: TATVA.green.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  'agent-shades': { primary: TATVA.indigo.content, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'agent-wow': { primary: TATVA.red.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  'agent-calm': { primary: TATVA.yellow.content, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  'agent-beam': { primary: TATVA.pink.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  'agent-stem': { primary: TATVA.green.mid, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  /** Shape explorations — Stem eyes, shell varies (not expression). */
  'agent-hex': { primary: TATVA.indigo.content, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'agent-pill': { primary: TATVA.green.content, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  'agent-soft': { primary: TATVA.orange.mid, secondary: TATVA.orange.content, ink: TATVA_INK },
  'agent-oval': { primary: TATVA.pink.mid, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'agent-shield': { primary: TATVA.yellow.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  'agent-twin': { primary: TATVA.indigo.mid, secondary: TATVA.pink.content, ink: TATVA_INK },
  'agent-stack': { primary: TATVA.green.mid, secondary: TATVA.orange.content, ink: TATVA_INK },
  'agent-bracket': { primary: TATVA.red.content, secondary: TATVA.indigo.content, ink: TATVA_INK },
  'agent-node': { primary: TATVA.yellow.mid, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'agent-tile': { primary: TATVA.pink.content, secondary: TATVA.yellow.content, ink: TATVA_INK },
  'agent-arch': { primary: TATVA.orange.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'agent-orbit': { primary: TATVA.indigo.content, secondary: TATVA.green.mid, ink: TATVA_INK },
} as const satisfies Record<string, DesignSystemIconPalette>;

/**
 * Telephony agents — Gaze/Beam face language + phone mass (secondary).
 * Shape carries the call/outbound read; not expression variants.
 *
 * `telephony-seal*` = Gaze/Beam face (palette varies); badge is a gallery overlay.
 */
export const DESIGN_SYSTEM_TELEPHONY_PALETTES = {
  'telephony-side': { primary: TATVA.indigo.mid, secondary: TATVA.indigo.content, ink: TATVA_INK },
  'telephony-mask': { primary: TATVA.orange.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  'telephony-ear': { primary: TATVA.green.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  'telephony-handset': { primary: TATVA.pink.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'telephony-stem': {
    primary: TATVA.yellow.content,
    secondary: TATVA.orange.content,
    ink: TATVA_INK,
  },
  'telephony-inset': { primary: TATVA.red.content, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'telephony-left': { primary: TATVA.indigo.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'telephony-dual': { primary: TATVA.green.mid, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  /** Face + white corner badge; phone stitched finer on denser grid. */
  'telephony-seal': { primary: TATVA.green.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  'telephony-seal-indigo': {
    primary: TATVA.indigo.mid,
    secondary: TATVA.indigo.content,
    ink: TATVA_INK,
  },
  'telephony-seal-orange': {
    primary: TATVA.orange.content,
    secondary: TATVA.orange.mid,
    ink: TATVA_INK,
  },
  'telephony-seal-pink': { primary: TATVA.pink.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'telephony-seal-yellow': {
    primary: TATVA.yellow.content,
    secondary: TATVA.yellow.mid,
    ink: TATVA_INK,
  },
  'telephony-seal-red': { primary: TATVA.red.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  'telephony-seal-lime': { primary: TATVA.green.mid, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  'telephony-seal-violet': {
    primary: TATVA.indigo.content,
    secondary: TATVA.pink.mid,
    ink: TATVA_INK,
  },
  'telephony-badge': { primary: TATVA.orange.mid, secondary: TATVA.red.content, ink: TATVA_INK },
  'telephony-frame': { primary: TATVA.pink.mid, secondary: TATVA.indigo.content, ink: TATVA_INK },
  'telephony-flip': { primary: TATVA.yellow.mid, secondary: TATVA.green.content, ink: TATVA_INK },
  'telephony-horn': { primary: TATVA.red.mid, secondary: TATVA.orange.content, ink: TATVA_INK },
  'telephony-boom': { primary: TATVA.indigo.mid, secondary: TATVA.yellow.content, ink: TATVA_INK },
  'telephony-signal': { primary: TATVA.green.content, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  'telephony-pocket': { primary: TATVA.pink.content, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'telephony-corner': { primary: TATVA.orange.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'telephony-dock': { primary: TATVA.indigo.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  'telephony-wave': {
    primary: TATVA.yellow.content,
    secondary: TATVA.pink.content,
    ink: TATVA_INK,
  },
} as const satisfies Record<string, DesignSystemIconPalette>;

/**
 * Voice & audio family — circular cloth discs as background/shape.
 * Glyph cutouts are optional experiments; the base read is the disc itself.
 */
export const DESIGN_SYSTEM_VOICE_PALETTES = {
  /** Solid disc — background/shape only, no center glyph. */
  'voice-disc': { primary: TATVA.indigo.content, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  /** Disc + solid-fill play triangle (ink over cloth). */
  'voice-disc-play': { primary: TATVA.indigo.content, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  /** Solid disc-family shape explorations (no glyphs). */
  'voice-disc-soft': { primary: TATVA.indigo.mid, secondary: TATVA.indigo.content, ink: TATVA_INK },
  'voice-disc-tight': { primary: TATVA.pink.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'voice-disc-wide': { primary: TATVA.green.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  'voice-disc-lens': { primary: TATVA.orange.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  'voice-disc-pill': {
    primary: TATVA.yellow.content,
    secondary: TATVA.orange.content,
    ink: TATVA_INK,
  },
  'voice-disc-blob': { primary: TATVA.pink.mid, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'voice-disc-coin': { primary: TATVA.green.mid, secondary: TATVA.yellow.mid, ink: TATVA_INK },
  'voice-disc-ring': { primary: TATVA.indigo.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'voice-disc-crescent': {
    primary: TATVA.red.content,
    secondary: TATVA.orange.mid,
    ink: TATVA_INK,
  },
  'voice-disc-twin': { primary: TATVA.yellow.mid, secondary: TATVA.indigo.mid, ink: TATVA_INK },
  'voice-disc-stack': { primary: TATVA.orange.mid, secondary: TATVA.pink.content, ink: TATVA_INK },
  'voice-disc-petal': {
    primary: TATVA.green.content,
    secondary: TATVA.indigo.content,
    ink: TATVA_INK,
  },
  'voice-play': { primary: TATVA.indigo.mid, secondary: TATVA.indigo.content, ink: TATVA_INK },
  'voice-pause': { primary: TATVA.pink.mid, secondary: TATVA.pink.content, ink: TATVA_INK },
  'voice-record': { primary: TATVA.red.content, secondary: TATVA.red.mid, ink: TATVA_INK },
  'voice-stop': { primary: TATVA.orange.content, secondary: TATVA.orange.mid, ink: TATVA_INK },
  'voice-mic': { primary: TATVA.green.content, secondary: TATVA.green.mid, ink: TATVA_INK },
  'voice-wave': { primary: TATVA.indigo.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'voice-ring': { primary: TATVA.green.mid, secondary: TATVA.green.content, ink: TATVA_INK },
  'voice-eq': { primary: TATVA.yellow.mid, secondary: TATVA.orange.content, ink: TATVA_INK },
  'voice-note': { primary: TATVA.pink.content, secondary: TATVA.pink.mid, ink: TATVA_INK },
  'voice-sound': { primary: TATVA.orange.mid, secondary: TATVA.yellow.content, ink: TATVA_INK },
} as const satisfies Record<string, DesignSystemIconPalette>;

/** @deprecated Use DESIGN_SYSTEM_PRODUCT_PALETTES */
export const DESIGN_SYSTEM_ICON_PALETTES = DESIGN_SYSTEM_PRODUCT_PALETTES;

export type DesignSystemProductIconName = keyof typeof DESIGN_SYSTEM_PRODUCT_PALETTES;
export type DesignSystemAgentIconName = keyof typeof DESIGN_SYSTEM_AGENT_PALETTES;
export type DesignSystemTelephonyIconName = keyof typeof DESIGN_SYSTEM_TELEPHONY_PALETTES;
export type DesignSystemVoiceIconName = keyof typeof DESIGN_SYSTEM_VOICE_PALETTES;
