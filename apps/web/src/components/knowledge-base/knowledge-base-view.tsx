'use client';

import { Suspense, useState } from 'react';
import { toast } from '@sarvam/tatva';
import type { HeaderProps } from '@sarvam/tatva';

import { PageShell } from '@/components/shell/page-shell';
import { KnowledgeBaseManager } from './knowledge-base-manager';
import type { Tab } from './knowledge-base-manager';

export type { Tab } from './knowledge-base-manager';

const UPLOAD_LABEL: Record<Tab, string> = {
  textbook: 'Upload text book',
  paper: 'Upload exam paper',
  group: 'Upload text book',
};

// `book-upload` is not in tatva's built-in set — it comes from the app's
// extended registry (`shell/icon-registry.tsx`).
const UPLOAD_ICON: Record<Tab, string> = {
  textbook: 'book-upload',
  paper: 'plus',
  group: 'book-upload',
};

/**
 * Knowledge base page frame. Both header actions live here: the upload label
 * follows the active tab, which the manager reports from the URL, and
 * "Create group" toggles the composer panel the manager renders beside the
 * browsing column.
 */
export function KnowledgeBaseView() {
  const [tab, setTab] = useState<Tab>('textbook');
  const [composing, setComposing] = useState(false);
  // Bumped on every open so the manager can key a fresh composer draft.
  const [composeSession, setComposeSession] = useState(0);

  // Header renders the first two actions as buttons, in order — "Create
  // group" sits to the left of the upload action.
  // `HeaderAction` is declared but not exported by this tatva version, so the
  // action shape is read back off `HeaderProps`.
  const actions: NonNullable<HeaderProps['actions']> = [
    {
      label: 'Create group',
      icon: 'folder-add',
      variant: 'secondary',
      disabled: composing,
      tooltip: composing ? 'Finish or cancel the group you are building' : undefined,
      onClick: () => {
        setComposeSession((session) => session + 1);
        setComposing(true);
      },
    },
    {
      label: UPLOAD_LABEL[tab],
      icon: UPLOAD_ICON[tab],
      variant: 'primary',
      onClick: () => toast.info('Upload is coming soon'),
    },
  ];

  return (
    <PageShell left={{ title: 'Knowledge Base' }} actions={actions}>
      <Suspense>
        <KnowledgeBaseManager
          onTabChange={setTab}
          composing={composing}
          composeSession={composeSession}
          onComposingChange={setComposing}
        />
      </Suspense>
    </PageShell>
  );
}
