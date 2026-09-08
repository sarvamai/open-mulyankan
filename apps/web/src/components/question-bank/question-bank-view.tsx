'use client';

import { useState } from 'react';
import { Box, Text } from '@sarvam/tatva';

import { PageShell } from '@/components/shell/page-shell';
import { NewBankDialog } from './new-bank-dialog';

/**
 * Question bank page frame. Nothing is modelled behind the surface yet, so
 * the page is still a placeholder — what it does carry is the header action
 * that opens the three-step dialog describing a new bank.
 */
export function QuestionBankView() {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageShell
        left={{ title: 'Question Bank' }}
        actions={[
          {
            label: 'New question bank',
            icon: 'question',
            variant: 'primary',
            onClick: () => setCreating(true),
          },
        ]}
      >
        <Box display="flex" direction="column" gap={12}>
          <Box display="flex" direction="column" gap={2}>
            <Text as="h2" variant="heading-lg">
              Question Bank
            </Text>
            <Text variant="body-md" tone="secondary">
              Reusable questions, drawn on when authoring a paper.
            </Text>
          </Box>
          <Text variant="body-sm" tone="tertiary">
            No banks yet — “New question bank” describes one; nothing is stored until there is an
            API behind it.
          </Text>
        </Box>
      </PageShell>

      <NewBankDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
