'use client';

import { Box, Input, Select, Text, Textarea } from '@sarvam/tatva';

import { MOCK_ITEMS } from '@/components/knowledge-base/mock-items';
import { QUESTION_LANGUAGES } from './languages';
import type { QuestionBankDraft } from './types';

/** Subjects and classes offered come from the mock rows the bank draws on. */
const SUBJECTS = [...new Set(MOCK_ITEMS.map((item) => item.subject))].sort();
const CLASSES = [...new Set(MOCK_ITEMS.map((item) => item.class))].sort((a, b) => a - b);

/**
 * Step 1: what the bank is, and the one language the student will read it in.
 *
 * No field carries a required marker: this tatva version's `Input` does not
 * forward `required` to its label (it lands on the native input), so marking
 * the selects and not the name field would be the inconsistency. What is
 * still needed is said once, under the step, when Next is pressed.
 *
 * A bank carries a single language — not a set — so this is a single
 * searchable select over the configured list (`languages.ts`); the pending
 * note below stands in if that configuration is ever empty.
 */
export function StepDetails({
  draft,
  onChange,
}: {
  draft: QuestionBankDraft;
  onChange: (patch: Partial<QuestionBankDraft>) => void;
}) {
  return (
    <Box display="flex" direction="column" gap={12}>
      <Input
        label="Name"
        placeholder="e.g. Class 10 Science — board revision"
        value={draft.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />

      <Box display="flex" gap={10}>
        <Box grow minW="0">
          <Select
            label="Subject"
            searchable
            placeholder="Choose a subject"
            value={draft.subject}
            options={SUBJECTS.map((subject) => ({ value: subject, label: subject }))}
            onValueChange={(value) => onChange({ subject: value })}
          />
        </Box>
        <Box w={80} shrink={false}>
          <Select
            label="Class"
            placeholder="Class"
            value={draft.classLevel}
            options={CLASSES.map((level) => ({ value: String(level), label: `Class ${level}` }))}
            onValueChange={(value) => onChange({ classLevel: value })}
          />
        </Box>
      </Box>

      {QUESTION_LANGUAGES.length > 0 ? (
        <Select
          label="Question language"
          searchable
          helperText="The language the student reads the paper in. One per bank."
          placeholder="Search languages"
          value={draft.language}
          options={QUESTION_LANGUAGES.map((language) => ({ value: language, label: language }))}
          onValueChange={(value) => onChange({ language: value })}
        />
      ) : (
        /* The list is configuration, and configuration can be empty — see
         * `languages.ts`. The field says so rather than offering names this
         * client invented. */
        <Box display="flex" direction="column" gap={4} p={8} bg="secondary" rounded="sm">
          <Text variant="label-sm">Question language</Text>
          <Text variant="body-xs" tone="tertiary">
            No languages are configured yet, so there is nothing to choose. The pilot languages
            are the authority&rsquo;s decision (ADR-0006).
          </Text>
        </Box>
      )}

      <Textarea
        label="Description"
        helperText="Optional. What this bank is for."
        rows={3}
        value={draft.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </Box>
  );
}
