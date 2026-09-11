/**
 * Shared stitch-asset palettes.
 *
 * - `C`: the epoch botanical palette (plant/flower artwork register).
 * - `TOPIC_MARKER_*`: the landing-page topic-bullet vocabulary — dense
 *   cloth-fill units + the five topic hues — used by every patchwork/tinted
 *   asset (Explore pictograms, product marks, concept pictograms, …).
 */

import { shade, type UnitKey } from '../units';

/* ── epoch palette (from sarvam-epoch botanical.ts / epochColors.ts) ── */

export const C = {
  pink: '#d4508e',
  darkPink: '#9d2055',
  lightPink: '#f0b0d0',
  palePink: '#fde8f2',
  green: '#6ea335',
  darkGreen: '#385418',
  red: '#c43d2b',
  brown: '#5c3d2e',
  darkBrown: '#3d2213',
  indigo: '#3333cc',
  gold: '#c08827',
} as const;

// Dense cloth fills only — sparse single-thread units disappear at marker
// sizes (mirrors the epoch TOPIC_MARKER_UNITS selection).
export const TOPIC_MARKER_UNITS: UnitKey[] = [
  'weave3',
  'weave5',
  'hatchH',
  'hatchV',
  'crossH',
  'tweed',
];

// Epoch "home" topic palette: siteStitchColor(x) = shade(x, -0.1).
export const TOPIC_MARKER_COLORS = [
  shade('#1E2E57', -0.1), // blue 500
  shade('#FFB73A', -0.1), // yellow 400
  shade('#F16A03', -0.1), // orange 200
  shade('#4FAC33', -0.1), // green 100
  shade('#E82D82', -0.1), // pink 400
];
