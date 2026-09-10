'use client';

/**
 * React binding for StitchRuntime: mounts a runtime into a host div,
 * relays HUD/state into React state (change-detected, so an idle surface
 * never re-renders the tree), and tears everything down on unmount.
 */

import { useEffect, useRef, useState } from 'react';
import type { StitchEngine, EngineTickResult } from './engine';
import { StitchRuntime, type RendererKind, type RuntimeHud, type RuntimeState } from './runtime';

export interface UseStitchRuntimeOptions {
  engine: StitchEngine;
  renderer: RendererKind;
  layerClass?: string;
  /** Supersample multiplier for tiny surfaces; see StitchRuntimeOptions. */
  resolutionScale?: number;
  onFallback?: () => void;
  onTick?: (results: EngineTickResult[], runtime: StitchRuntime) => void;
  onState?: (state: RuntimeState) => void;
}

export function useStitchRuntime({
  engine,
  renderer,
  layerClass,
  resolutionScale,
  onFallback,
  onTick,
  onState,
}: UseStitchRuntimeOptions) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<StitchRuntime | null>(null);
  const [state, setState] = useState<RuntimeState>('idle');
  const [hud, setHud] = useState<RuntimeHud>({ fps: 0, renderMs: 0, threads: 0 });
  const [activeRenderer, setActiveRenderer] = useState<RendererKind>(renderer);

  // latest callbacks without re-mounting the runtime
  const onFallbackRef = useRef(onFallback);
  const onTickRef = useRef(onTick);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onFallbackRef.current = onFallback;
    onTickRef.current = onTick;
    onStateRef.current = onState;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rt = new StitchRuntime(engine, {
      renderer,
      layerClass,
      resolutionScale,
      onFallback: () => onFallbackRef.current?.(),
      onTick: (results, runtime) => onTickRef.current?.(results, runtime),
      onState: (next) => {
        onStateRef.current?.(next);
        setState(next);
      },
      onHud: (next) =>
        setHud((prev) =>
          prev.fps === next.fps && prev.renderMs === next.renderMs && prev.threads === next.threads
            ? prev
            : next
        ),
    });
    rt.attach(host);
    runtimeRef.current = rt;
    setActiveRenderer(rt.activeRenderer);
    return () => {
      rt.dispose();
      runtimeRef.current = null;
    };
    // layerClass/resolutionScale are stable per call site; renderer/engine changes re-mount
  }, [engine, renderer]);

  return { hostRef, runtimeRef, state, hud, activeRenderer };
}
