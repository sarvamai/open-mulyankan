import tatvaPreset from '@sarvam/tatva/tailwind-preset';
import type { Config } from 'tailwindcss';

const config = {
  // The preset defines every `tatva-*` token: colours, the 2px-base spacing
  // scale, radii, shadows, and the Matter/Season/mono font families.
  presets: [tatvaPreset],
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Tatva's compiled components reference utility classes that Tailwind can
    // only generate if it scans them. The package is a `file:` dependency, so
    // pnpm links it into this app's own node_modules.
    './node_modules/@sarvam/tatva/dist/**/*.{js,mjs}',
  ],
  theme: {
    // Intentionally empty: use the preset's tokens rather than adding a second,
    // divergent scale. `theme.extend` here would shadow the preset's own.
    extend: {},
  },
  plugins: [],
} satisfies Config;

export default config;
