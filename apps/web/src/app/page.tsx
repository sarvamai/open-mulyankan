'use client';

import { Badge, Box, Button, Divider, Icon, Input, Text, toast } from '@sarvam/tatva';
import { useState } from 'react';

/**
 * Design-system smoke page. Its job is to prove the vendored @sarvam/tatva
 * tarball is wired correctly end to end: the preset's `tatva-*` utilities
 * compile, the token CSS variables resolve, the bundled Matter/Season fonts
 * load, and a client component with state, icons and a toast renders.
 *
 * Real surfaces replace this. Spacing follows the design system's three
 * proximity tiers — gap 2 (pair), 10 (field), 12 (region) — and every value
 * comes from a token. `Box` takes no className: layout goes through its props.
 */
export default function Home() {
  const [subject, setSubject] = useState('');

  return (
    <Box
      as="main"
      display="flex"
      direction="column"
      align="center"
      justify="center"
      p={12}
      h="full"
      overflow="auto"
      bg="secondary"
    >
      <Box
        display="flex"
        direction="column"
        gap={12}
        p={12}
        w={210}
        bg="surface-secondary"
        rounded="lg"
        shadow="l1"
      >
        <Box display="flex" direction="column" gap={2}>
          <Text as="h1" variant="heading-lg">
            Open Mulyankan
          </Text>
          <Text variant="body-sm" tone="secondary">
            Layer 1 content authoring workflow core.
          </Text>
        </Box>

        <Divider />

        <Box display="flex" direction="column" gap={10}>
          <Box display="flex" align="center" gap={2}>
            <Icon name="check" aria-label="Design system loaded" />
            <Text variant="label-md">Tatva 0.0.34 — vendored, no registry credential</Text>
          </Box>

          <Box display="flex" align="center" gap={2}>
            <Badge variant="green" icon="docs">
              Draft
            </Badge>
            <Badge variant="default">In Review</Badge>
            <Badge variant="brand">Sealed</Badge>
          </Box>

          <Input
            label="Subject"
            placeholder="e.g. Mathematics"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />

          <Button
            icon="plus"
            onClick={() => toast.success(subject ? `Added ${subject}` : 'Design system is live')}
          >
            Show a toast
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
