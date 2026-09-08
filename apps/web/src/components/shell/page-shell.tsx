'use client';

import { Header } from '@sarvam/tatva';
import type { HeaderProps } from '@sarvam/tatva';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface PageShellProps extends HeaderProps {
  children: ReactNode;
}

/**
 * Page frame inside the AppShell: a sticky Header over a scrolling,
 * width-capped content column. Follows mulyankan-frontend's PageShell
 * (default `full` layout): 16px page padding on mobile / 28px on desktop,
 * content capped at max-w-7xl and centred, and the header's bottom border
 * appearing only once the content scrolls under it.
 *
 * The Header's mobile menu button (rendered below md, inside the shell's
 * SidebarProvider) opens the sidebar drawer.
 */
export function PageShell({ children, ...headerProps }: PageShellProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setHasScrolled(scrollRef.current.scrollTop > 0);
    }
  }, []);

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-hide"
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
    </div>
  );
}
