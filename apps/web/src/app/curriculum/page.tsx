import type { Metadata } from 'next';

import { CurriculumManager } from '@/components/curriculum/curriculum-manager';
import { PageShell } from '@/components/shell/page-shell';

export const metadata: Metadata = {
  title: 'Curriculum',
};

/**
 * Curriculum management: upload, delete, and manage the course curriculums
 * that question authoring draws from. The manager currently runs on mock
 * data — the platform API does not exist yet.
 */
export default function CurriculumPage() {
  return (
    <PageShell left={{ title: 'Curriculum' }}>
      <CurriculumManager />
    </PageShell>
  );
}
