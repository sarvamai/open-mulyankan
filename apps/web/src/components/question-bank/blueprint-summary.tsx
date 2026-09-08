'use client';

import { Badge, Box, Divider, Text } from '@sarvam/tatva';

import { chapterLabels, MOCK_ITEMS } from '@/components/knowledge-base/mock-items';
import {
  chapterCount,
  difficultyMarks,
  proposalCount,
  questionCount,
  rowMarks,
  typeMarks,
  usedTypes,
} from './blueprint';
import { MOCK_GROUPS } from './mock-groups';
import type { QuestionBankDraft } from './types';

/** A label over its value, the card's one repeating shape. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" align="baseline" justify="between" gap={5}>
      <Text variant="body-xs" tone="tertiary">
        {label}
      </Text>
      <Text variant="body-xs" textAlign="right">
        {value}
      </Text>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box display="flex" direction="column" gap={4}>
      <Text variant="label-sm">{title}</Text>
      {children}
    </Box>
  );
}

/** Nothing chosen yet — said once, rather than as a column of dashes. */
function Pending({ children }: { children: string }) {
  return (
    <Text variant="body-xs" tone="tertiary">
      {children}
    </Text>
  );
}

/** How the source reads once it is chosen. */
function sourceSummary(draft: QuestionBankDraft): string | null {
  if (draft.sourceMode === 'group') {
    const group = MOCK_GROUPS.find((entry) => entry.id === draft.groupId);
    return group ? `${group.name} — ${group.summary}` : null;
  }
  if (draft.bookIds.length === 0) return null;
  const books = `${draft.bookIds.length} text book${draft.bookIds.length === 1 ? '' : 's'}`;
  const total = draft.bookIds.reduce((sum, id) => {
    const book = MOCK_ITEMS.find((item) => item.id === id);
    return sum + (book ? chapterLabels(book).length : 0);
  }, 0);
  const chapters = chapterCount(draft);
  return `${books} · ${chapters} of ${total} chapters`;
}

/**
 * The draft as it stands, beside every step from the first to the last. It is
 * the one place the whole request is visible at once, so a reviewer can see
 * what step 3's numbers add up to without leaving step 1's fields — and it is
 * derived, never a second copy of the state.
 */
export function BlueprintSummary({ draft }: { draft: QuestionBankDraft }) {
  const source = sourceSummary(draft);
  const rows = usedTypes(draft);
  const byDifficulty = difficultyMarks(draft);
  const byType = typeMarks(draft);
  const questions = questionCount(draft);
  const proposals = proposalCount(draft);

  return (
    <Box
      display="flex"
      direction="column"
      gap={8}
      p={8}
      bg="surface-primary"
      borderColor="primary"
      rounded="md"
    >
      <Box display="flex" align="center" justify="between" gap={4}>
        <Text variant="label-md">Summary</Text>
        {draft.totalMarks > 0 && (
          <Badge
            size="sm"
            variant={byDifficulty === draft.totalMarks && byType === draft.totalMarks ? 'green' : 'yellow'}
          >
            {`${draft.totalMarks} marks`}
          </Badge>
        )}
      </Box>

      <Section title="Bank">
        {draft.name.trim() ? (
          <Box display="flex" direction="column" gap={2}>
            <Text variant="body-sm" lineClamp={2}>
              {draft.name}
            </Text>
            <Line
              label="Subject"
              value={draft.subject || '—'}
            />
            <Line label="Class" value={draft.classLevel ? `Class ${draft.classLevel}` : '—'} />
            <Line label="Language" value={draft.language || '—'} />
          </Box>
        ) : (
          <Pending>Not named yet.</Pending>
        )}
      </Section>

      <Divider />

      <Section title="Sources">
        {source ? (
          <Text variant="body-xs" tone="secondary">
            {source}
          </Text>
        ) : (
          <Pending>No source chosen yet.</Pending>
        )}
      </Section>

      <Divider />

      <Section title="Marks">
        {draft.totalMarks > 0 ? (
          <Box display="flex" direction="column" gap={2}>
            <Line label="Total" value={String(draft.totalMarks)} />
            <Line
              label="Easy / medium / hard"
              value={`${draft.difficulty.easy} / ${draft.difficulty.medium} / ${draft.difficulty.hard}`}
            />
            <Line
              label="Difficulty allocated"
              value={`${byDifficulty} of ${draft.totalMarks}`}
            />
            <Line label="Types allocated" value={`${byType} of ${draft.totalMarks}`} />
          </Box>
        ) : (
          <Pending>No total set yet.</Pending>
        )}
      </Section>

      <Divider />

      <Section title="Questions">
        {rows.length > 0 ? (
          <Box display="flex" direction="column" gap={2}>
            {rows.map(({ spec, allocation }) => (
              <Line
                key={spec.id}
                label={spec.label}
                value={`${allocation.count} × ${allocation.marksEach} = ${rowMarks(allocation)}${
                  allocation.alternates > 1 ? ` · ${allocation.alternates} alts` : ''
                }`}
              />
            ))}
            <Box pt={2}>
              <Line label="Questions" value={String(questions)} />
              <Line label="Proposals to review" value={String(proposals)} />
            </Box>
          </Box>
        ) : (
          <Pending>No question types chosen yet.</Pending>
        )}
      </Section>
    </Box>
  );
}
