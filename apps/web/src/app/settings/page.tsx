import type { Metadata } from 'next';
import { Box, Text } from '@sarvam/tatva';

import { PageShell } from '@/components/shell/page-shell';

export const metadata: Metadata = {
  title: 'Settings',
};

/**
 * Settings surface placeholder, reachable from the sidebar footer. No
 * settings exist yet; the page exists so the footer navigation destination
 * resolves.
 */
export default function SettingsPage() {
  return (
    <PageShell left={{ title: 'Settings' }}>
      <Box display="flex" direction="column" gap={12}>
        <Box display="flex" direction="column" gap={2}>
          <Text as="h2" variant="heading-lg">
            Settings
          </Text>
          <Text variant="body-md" tone="secondary">
            Workspace and application preferences.
          </Text>
        </Box>
        <Text variant="body-sm" tone="tertiary">
          Nothing to configure yet — this surface is a placeholder for now.
        </Text>
      </Box>
    </PageShell>
  );
}
