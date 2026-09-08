import { AnimationProvider, Toaster, TooltipProvider } from '@sarvam/tatva';
import type { Metadata, Viewport } from 'next';

import { AppShell } from '@/components/shell/app-shell';

// Design system first: tokens, base styles, and the bundled Matter/Season font
// faces. globals.css follows so app utilities can win on source order.
import '@sarvam/tatva/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Open Mulyankan',
    template: '%s | Open Mulyankan',
  },
  description: 'Layer 1 content authoring workflow core.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="default">
      <body className="h-svh overflow-hidden">
        {/* AnimationProvider is tatva's micro-interaction layer: without it
            every component renders static. Reduced-motion is respected
            automatically, so it is always safe to mount at the root. */}
        <AnimationProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </AnimationProvider>
      </body>
    </html>
  );
}
