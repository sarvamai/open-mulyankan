import type { Metadata } from 'next';

import { KnowledgeBaseView } from '@/components/knowledge-base/knowledge-base-view';

export const metadata: Metadata = {
  title: 'Knowledge Base',
};

/**
 * Knowledge base: the text books and exam papers that question authoring
 * draws from. The manager runs on mock data — the platform API does not
 * exist yet — and reads its tab, filters and pagination from the URL, so it
 * suspends until search params are available during prerendering.
 */
export default function KnowledgeBasePage() {
  return <KnowledgeBaseView />;
}
