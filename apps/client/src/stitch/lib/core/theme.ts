/**
 * Theme-aware stitch colors.
 *
 * A stitch asset bakes fixed hex into every cell, so it's normally
 * theme-blind. These primitives let an asset declare colors that differ by
 * theme and bake one config per theme — the renderer still gets plain hex,
 * but `StitchAsset` picks the config matching the active theme.
 *
 * Scaling to a full app theme system: today only `light`/`dark` exist and
 * `StitchAsset` resolves the theme via `useStitchTheme` (see the component).
 * When the app ships a real theme provider, point that one hook at it and
 * every themed asset follows — no per-asset change.
 */

import type { ImageStitchConfig } from '../imageStitch';

export type StitchTheme = 'light' | 'dark';
export const STITCH_THEMES: readonly StitchTheme[] = ['light', 'dark'];

/**
 * A color that may vary by theme. A plain string is theme-agnostic (same in
 * both); a `{ light, dark }` pair resolves per theme. Authoring helper:
 * `themed('#141414', '#faf8f5')`.
 */
export type ThemedColor = string | Record<StitchTheme, string>;

/** Build a themed color from explicit light/dark values. */
export function themed(light: string, dark: string): ThemedColor {
  return { light, dark };
}

/** Resolve a themed color for one theme. */
export function resolveThemedColor(color: ThemedColor, theme: StitchTheme): string {
  return typeof color === 'string' ? color : color[theme];
}

/** True if any color in the set actually varies by theme. */
export function hasThemedColor(colors: ThemedColor[]): boolean {
  return colors.some((c) => typeof c !== 'string');
}

/**
 * One baked config per theme. Produced by the themed `defineMotif*` helpers
 * and consumed by `StitchAsset` (via `pickThemedConfig`) and the library.
 */
export type ThemedStitchConfig = Record<StitchTheme, ImageStitchConfig>;

/** Narrow a config union to the themed pair. */
export function isThemedConfig(
  config: ImageStitchConfig | ThemedStitchConfig
): config is ThemedStitchConfig {
  // A plain ImageStitchConfig has `units`; a themed pair has `light`/`dark`.
  return (
    typeof (config as ThemedStitchConfig).light === 'object' &&
    typeof (config as ThemedStitchConfig).dark === 'object' &&
    !('units' in config)
  );
}

/* ── Automatic dark-mode tone-mapping ──────────────────────────────────────
 *
 * The systematic answer to "does it work in dark mode?": every plain config
 * derives its dark variant from the light one by a single, hue-preserving
 * tone-map — no per-asset editing. Dark mode is defined as "guarantee contrast
 * against the dark surface while keeping hue": lift any color darker than
 * mid-lightness to `L' = max(L, 1−L)` (bright hues untouched, near-black ink →
 * near-white, dark navy → light navy). Light mode is the identity, so the
 * shipped look never changes.
 *
 * A `themed()` pair (explicit art direction) bypasses this entirely.
 */

function hexToHsl(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const to2 = (x: number) => ('0' + Math.round(x * 255).toString(16)).slice(-2);
  return '#' + to2(r) + to2(g) + to2(b);
}

/**
 * Tone-map one color for a theme. Light is the identity; dark lifts any color
 * darker than mid-lightness to keep contrast against the dark surface, holding
 * hue and saturation fixed.
 */
export function adaptColorForTheme(hex: string, theme: StitchTheme): string {
  if (theme === 'light') return hex;
  const [h, s, l] = hexToHsl(hex);
  const lifted = Math.max(l, 1 - l);
  return lifted === l ? hex : hslToHex(h, s, lifted);
}

// Baked configs are stable module-level objects, so a WeakMap keyed on the
// light config yields a referentially stable derived dark config (units
// identity holds across renders — the StitchComposition reload invariant).
const darkCache = new WeakMap<ImageStitchConfig, ImageStitchConfig>();

function deriveDarkConfig(light: ImageStitchConfig): ImageStitchConfig {
  const cached = darkCache.get(light);
  if (cached) return cached;
  const dark: ImageStitchConfig = {
    ...light,
    style: { ...light.style, color: adaptColorForTheme(light.style.color, 'dark') },
    units: light.units.map((u) => ({ ...u, color: adaptColorForTheme(u.color, 'dark') })),
  };
  darkCache.set(light, dark);
  return dark;
}

/**
 * Resolve a plain or themed config to the single config for `theme`.
 *
 * - Explicit `ThemedStitchConfig` (art direction) → the authored per-theme config.
 * - Plain config → light as-authored; dark is auto-derived via the tone-map.
 */
export function pickThemedConfig(
  config: ImageStitchConfig | ThemedStitchConfig,
  theme: StitchTheme
): ImageStitchConfig {
  if (isThemedConfig(config)) return config[theme];
  return theme === 'dark' ? deriveDarkConfig(config) : config;
}
