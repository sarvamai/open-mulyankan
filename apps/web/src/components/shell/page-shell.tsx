'use client';

import { Header } from '@sarvam/tatva';
import type { HeaderProps } from '@sarvam/tatva';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

/**
 * The rail slot beside the scrolling content, or `null` before the shell has
 * mounted it. A page fills it with `createPortal`, which keeps the rail's
 * state inside the page's own component tree while it renders as a
 * full-height sibling of the content column — the page cannot render a
 * full-height rail from inside `children`, which is nested in the scroller.
 */
const PageAsideContext = createContext<HTMLElement | null>(null);

const NEVER_CHANGES = () => () => {};

/**
 * The rail slot, or `null` until the calling component has hydrated.
 *
 * The slot node comes from a ref, so it exists on the client but never in the
 * server HTML. A page under its own `Suspense` boundary hydrates *after* the
 * shell has mounted, so without this gate its first client render would
 * include a portal the server HTML does not — a hydration mismatch. The
 * portal mounts on the render straight after instead.
 */
export function usePageAside() {
  const node = useContext(PageAsideContext);
  const hydrated = useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false
  );
  return hydrated ? node : null;
}

interface PageShellProps extends HeaderProps {
  children: ReactNode;
}

/**
 * Page frame inside the AppShell: a sticky Header over a scrolling,
 * width-capped content column, with a full-height rail slot to its right.
 * Follows mulyankan-frontend's PageShell (default `full` layout): 16px page
 * padding on mobile / 28px on desktop, content capped at max-w-7xl and
 * centred, and the header's bottom border appearing only once the content
 * scrolls under it.
 *
 * The Header's mobile menu button (rendered below md, inside the shell's
 * SidebarProvider) opens the sidebar drawer.
 */
export function PageShell({ children, ...headerProps }: PageShellProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [asideNode, setAsideNode] = useState<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setHasScrolled(scrollRef.current.scrollTop > 0);
    }
  }, []);

  return (
    <PageAsideContext.Provider value={asideNode}>
      {/* `relative` is load-bearing: below lg the rail positions against this
       * box to overlay the page rather than squeezing the content column. */}
      <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto scrollbar-hide"
          >
            <div
              className={`sticky top-0 z-30 border-b bg-tatva-surface-secondary transition-colors duration-200 ${
                hasScrolled ? 'border-tatva-divider-primary' : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-tatva-3 px-tatva-8 md:px-tatva-14">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <Header {...headerProps} />
                </div>
              </div>
            </div>
            <div className="mx-auto max-w-7xl p-tatva-8 md:p-tatva-14">{children}</div>
          </div>
          {/* Full height by construction — a flex row item stretches. Takes no
           * space until a page portals a rail into it. */}
          <div ref={setAsideNode} className="flex min-h-0 shrink-0" />
        </div>
      </div>
    </PageAsideContext.Provider>
  );
}
