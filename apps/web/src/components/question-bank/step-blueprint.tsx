'use client';

import { Fragment } from 'react';
import { Badge, Box, Checkbox, Input, Text, Tooltip } from '@sarvam/tatva';

import { difficultyMarks, rowMarks, typeMarks } from './blueprint';
import { QUESTION_TYPES } from './question-types';
import type { Difficulty, QuestionBankDraft, TypeAllocation } from './types';

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const NO_ALLOCATION: TypeAllocation = { count: 0, marksEach: 0, alternates: 1 };

/**
 * A whole-number field. Zero renders as an empty box against a `0`
 * placeholder: a blueprint is mostly zeroes to begin with, and a grid of
 * literal zeroes reads as noise.
 */
function NumberField({
  value,
  onChange,
  ariaLabel,
  label,
  disabled = false,
  min = 0,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name. Redundant when `label` is set, but harmless. */
  ariaLabel: string;
  /** Visible label, for the fields that stand on their own. */
  label?: string;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      placeholder="0"
      label={label}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value === 0 ? '' : String(value)}
      onChange={(event) => {
        const next = Number(event.target.value);
        onChange(Number.isFinite(next) ? Math.max(min, Math.floor(next)) : min);
      }}
    />
  );
}

/**
 * A difficulty's share of the total, to one decimal where it needs it.
 * Rounding to whole percentages makes an even three-way split read as
 * 38 + 38 + 25 = 101, which looks like an arithmetic bug.
 */
function share(marks: number, total: number): string {
  const percent = (marks / total) * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}% of total`;
}

/**
 * How an allocation compares with the total: balanced, short, or over. Drives
 * the chip beside each of the two allocations that must equal total marks.
 */
function BalanceChip({ allocated, total }: { allocated: number; total: number }) {
  if (total <= 0) return null;
  if (allocated === total) {
    return (
      <Badge size="sm" variant="green">
        Balanced
      </Badge>
    );
  }
  const short = total - allocated;
  return (
    <Badge size="sm" variant={short > 0 ? 'yellow' : 'red'}>
      {short > 0 ? `${short} marks left` : `${-short} marks over`}
    </Badge>
  );
}

/**
 * Step 3: the blueprint — a total, how it splits across difficulty, and which
 * question types make it up. Both splits are validated against total marks,
 * which is the one number the other two have to agree with.
 *
 * Nothing is generated here. The alternates column is how many proposals the
 * `gateway` SPI would be asked for per question, for a human to choose from;
 * a proposal is not a draft until someone adopts it (invariant 5).
 */
export function StepBlueprint({
  draft,
  onChange,
}: {
  draft: QuestionBankDraft;
  onChange: (patch: Partial<QuestionBankDraft>) => void;
}) {
  const byDifficulty = difficultyMarks(draft);
  const byType = typeMarks(draft);

  function patchType(id: string, patch: Partial<TypeAllocation>) {
    const current = draft.types[id] ?? NO_ALLOCATION;
    onChange({ types: { ...draft.types, [id]: { ...current, ...patch } } });
  }

  /** Turning a type on seeds its usual marks and one question. */
  function toggleType(id: string, used: boolean) {
    const spec = QUESTION_TYPES.find((entry) => entry.id === id);
    if (!used) {
      patchType(id, { count: 0 });
      return;
    }
    const current = draft.types[id];
    patchType(id, {
      count: Math.max(1, current?.count ?? 0),
      marksEach: current?.marksEach || (spec?.defaultMarks ?? 1),
      alternates: current?.alternates || 1,
    });
  }

  return (
    <Box display="flex" direction="column" gap={12}>
      <Box display="flex" direction="column" gap={4}>
        <Box w={80}>
          <NumberField
            value={draft.totalMarks}
            onChange={(value) => onChange({ totalMarks: value })}
            ariaLabel="Total marks"
            label="Total marks"
          />
        </Box>
        <Text variant="body-xs" tone="tertiary">
          Total marks for a paper drawn from this bank. The difficulty split and the question
          types below both have to add up to it.
        </Text>
      </Box>

      <Box display="flex" direction="column" gap={6}>
        <Box display="flex" align="center" gap={4}>
          <Text variant="label-md">Difficulty split</Text>
          <BalanceChip allocated={byDifficulty} total={draft.totalMarks} />
        </Box>
        <Box display="flex" gap={10}>
          {DIFFICULTIES.map(({ id, label }) => (
            <Box key={id} display="flex" direction="column" gap={4} grow minW="0">
              <Text variant="body-xs" tone="secondary">
                {label}
              </Text>
              <NumberField
                value={draft.difficulty[id]}
                ariaLabel={`${label} marks`}
                onChange={(value) =>
                  onChange({ difficulty: { ...draft.difficulty, [id]: value } })
                }
              />
              <Text variant="body-xs" tone="tertiary">
                {draft.totalMarks > 0 ? share(draft.difficulty[id], draft.totalMarks) : 'marks'}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box display="flex" direction="column" gap={6}>
        <Box display="flex" align="center" gap={4}>
          <Text variant="label-md">Question types</Text>
          <BalanceChip allocated={byType} total={draft.totalMarks} />
        </Box>

        {/* A grid rather than a `Table`: every cell but the first and last is
         * an input, which is not what Table's cell renderers are for. */}
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_84px_64px] items-center gap-x-tatva-5 gap-y-tatva-4">
          <Text variant="body-xs" tone="tertiary">
            Type
          </Text>
          <Text variant="body-xs" tone="tertiary" textAlign="center">
            Marks each
          </Text>
          <Text variant="body-xs" tone="tertiary" textAlign="center">
            Questions
          </Text>
          <Tooltip content="Proposals per question for a reviewer to choose from. 1 means no alternates.">
            <Text variant="body-xs" tone="tertiary" textAlign="center">
              Alternates
            </Text>
          </Tooltip>
          <Text variant="body-xs" tone="tertiary" textAlign="right">
            Marks
          </Text>

          {QUESTION_TYPES.map((spec) => {
            const allocation = draft.types[spec.id] ?? NO_ALLOCATION;
            const used = allocation.count > 0;
            return (
              <Fragment key={spec.id}>
                <Checkbox
                  label={spec.label}
                  checked={used}
                  onChange={(event) => toggleType(spec.id, event.target.checked)}
                />
                <NumberField
                  value={allocation.marksEach}
                  min={used ? 1 : 0}
                  disabled={!used}
                  ariaLabel={`Marks per ${spec.label} question`}
                  onChange={(value) => patchType(spec.id, { marksEach: value })}
                />
                <NumberField
                  value={allocation.count}
                  disabled={!used}
                  ariaLabel={`Number of ${spec.label} questions`}
                  onChange={(value) => patchType(spec.id, { count: value })}
                />
                <NumberField
                  value={allocation.alternates}
                  min={1}
                  disabled={!used}
                  ariaLabel={`Alternates per ${spec.label} question`}
                  onChange={(value) => patchType(spec.id, { alternates: value })}
                />
                <Text variant="body-sm" tone={used ? 'default' : 'tertiary'} textAlign="right">
                  {used ? rowMarks(allocation) : '—'}
                </Text>
              </Fragment>
            );
          })}
        </div>
      </Box>
    </Box>
  );
}
