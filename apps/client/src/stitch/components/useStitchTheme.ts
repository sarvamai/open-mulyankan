'use client';

import { useEffect, useState } from 'react';

import type { StitchTheme } from '../lib/core';

/**
 * The active theme for stitch assets — the SINGLE place the asset system
 * learns light vs dark.
 *
 * Today the app has no theme provider, so this reads `<html data-theme>`
 * (unset → `light`) and follows changes to it. When the real theme system
 * ships, replace the body of this hook with the app's theme hook and every
 * `StitchAsset` follows automatically — no per-asset change.
 */
function readTheme(): StitchTheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useStitchTheme(): StitchTheme {
  const [theme, setTheme] = useState<StitchTheme>('light');

  useEffect(() => {
    setTheme(readTheme());
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
