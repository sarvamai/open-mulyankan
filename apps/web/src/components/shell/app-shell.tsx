'use client';

import { Sidebar, SidebarProvider, Text } from '@sarvam/tatva';
import type { SidebarMenuItem } from '@sarvam/tatva';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Primary navigation. Flat items, not groups: a one-item group would
 * violate the design system's no-single-item-groups rule. Add future
 * destinations here; keep Settings in the footer below.
 *
 * `global-education` and `files-01` are not tatva built-ins — they come
 * from `AppIconProvider` (`icon-registry.tsx`).
 */
const MENU_ITEMS: SidebarMenuItem[] = [
  {
    label: 'Knowledge Base',
    href: '/knowledge-base',
    icon: 'global-education',
  },
  {
    label: 'Question Bank',
    href: '/question-bank',
    icon: 'files-01',
  },
  {
    label: 'Exam Paper',
    href: '/exam-paper',
    icon: 'file',
  },
];

/**
 * Pinned to the sidebar footer — Tatva renders these just above where a
 * profile section would sit, whatever the menu scroll position.
 */
const FOOTER_MENU_ITEMS: SidebarMenuItem[] = [
  {
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
  },
];

/**
 * Universal app shell: every route renders inside the sidebar + content
 * frame. Structure follows mulyankan-frontend's GlobalShell (same @sarvam/tatva
 * 0.0.34): a surface-primary page behind an inset, rounded surface-secondary
 * card holding the sidebar, a 1px divider, and the content area.
 *
 * The external SidebarProvider is deliberate: Tatva's Sidebar nests its own
 * provider, so the controlled `open`/`onOpenChange` pair keeps the two in
 * sync — and lets any Header inside the shell (PageShell) open the mobile
 * drawer via `useSidebar()`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="relative flex h-svh max-h-svh w-full max-w-full flex-col overflow-hidden bg-tatva-surface-primary">
        <div className="flex min-h-0 w-full flex-1">
          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden bg-tatva-surface-secondary p-0 md:m-tatva-4 md:rounded-tatva-md">
            <Sidebar
              header={{
                children: (
                  <span className="block overflow-hidden whitespace-nowrap">
                    <Text variant="heading-md">Open Mulyankan</Text>
                  </span>
                ),
              }}
              menuItems={MENU_ITEMS}
              footerMenuItems={FOOTER_MENU_ITEMS}
              linkComponent={NextLink}
              activePath={pathname ?? '/'}
              sidebarColor="surfaceSecondary"
              open={sidebarOpen}
              onOpenChange={setSidebarOpen}
            />
            {/* Hidden below md: on mobile the sidebar is a fixed drawer, and
                this would leave a stray 1px line at the content edge. */}
            <div className="hidden w-px shrink-0 bg-tatva-divider-primary dark:bg-tatva-border-primary md:block" />
            <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
