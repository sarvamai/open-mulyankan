/**
 * Everything derived from a draft: the marks it has allocated, the questions
 * it asks for, and what still stands between it and being created. Pure
 * functions, so the summary card and the step gating cannot disagree.
 */

import { QUESTION_LANGUAGES } from './languages';
import { QUESTION_TYPES } from './question-types';
import type { QuestionBankDraft, StepId, TypeAllocation } from './types';

export const STEP_ORDER: readonly StepId[] = ['details', 'sources', 'blueprint'] as const;

export const STEP_LABELS: Record<StepId, string> = {
  details: 'Bank details',
  sources: 'Sources',
  blueprint: 'Marks and questions',
};

/** Marks one row of the type table accounts for. */
export function rowMarks(allocation: TypeAllocation): number {
  return allocation.count * allocation.marksEach;
}

/** The rows a draft actually uses, in the table's order. */
export function usedTypes(draft: QuestionBankDraft) {
  return QUESTION_TYPES.map((spec) => ({ spec, allocation: draft.types[spec.id] })).filter(
    (row): row is { spec: (typeof QUESTION_TYPES)[number]; allocation: TypeAllocation } =>
      row.allocation !== undefined && row.allocation.count > 0
  );
}

export function difficultyMarks(draft: QuestionBankDraft): number {
  const { easy, medium, hard } = draft.difficulty;
  return easy + medium + hard;
}

export function typeMarks(draft: QuestionBankDraft): number {
  return usedTypes(draft).reduce((sum, row) => sum + rowMarks(row.allocation), 0);
}

export function questionCount(draft: QuestionBankDraft): number {
  return usedTypes(draft).reduce((sum, row) => sum + row.allocation.count, 0);
}

/**
 * How many questions would be proposed in total: every question counted once
 * per alternate. A reviewer adopts one of each set, so this is the size of the
 * review queue, not of the bank.
 */
export function proposalCount(draft: QuestionBankDraft): number {
  return usedTypes(draft).reduce(
    (sum, row) => sum + row.allocation.count * Math.max(1, row.allocation.alternates),
    0
  );
}

/** How many chapters are selected across every chosen book. */
export function chapterCount(draft: QuestionBankDraft): number {
  return draft.bookIds.reduce((sum, id) => sum + (draft.chapters[id]?.length ?? 0), 0);
}

/**
 * What is stopping a step from being left, worded for the reader. An empty
 * list means the step is complete; the last step's list also gates "Create".
 */
export function stepIssues(draft: QuestionBankDraft, step: StepId): string[] {
  const issues: string[] = [];

  if (step === 'details') {
    if (!draft.name.trim()) issues.push('Give the bank a name.');
    if (!draft.subject) issues.push('Choose a subject.');
    if (!draft.classLevel) issues.push('Choose a class.');
    // The language list is configuration and may legitimately be empty (see
    // `languages.ts`), so a choice is only required once there is one to make.
    if (QUESTION_LANGUAGES.length > 0 && !draft.language) {
      issues.push('Choose the language the student will read the paper in.');
    }
    return issues;
  }

  if (step === 'sources') {
    if (draft.sourceMode === 'group') {
      if (!draft.groupId) issues.push('Choose a group to draw questions from.');
    } else {
      if (draft.bookIds.length === 0) issues.push('Choose at least one text book.');
      else if (chapterCount(draft) === 0) issues.push('Choose at least one chapter.');
    }
    return issues;
  }

  if (draft.totalMarks <= 0) {
    issues.push('Set the total marks.');
    return issues;
  }
  const byDifficulty = difficultyMarks(draft);
  if (byDifficulty !== draft.totalMarks) {
    issues.push(
      byDifficulty < draft.totalMarks
        ? `The difficulty split leaves ${draft.totalMarks - byDifficulty} of ${draft.totalMarks} marks unallocated.`
        : `The difficulty split is over the total by ${byDifficulty - draft.totalMarks} marks.`
    );
  }
  const byType = typeMarks(draft);
  if (byType !== draft.totalMarks) {
    issues.push(
      byType < draft.totalMarks
        ? `The question types account for ${byType} of ${draft.totalMarks} marks.`
        : `The question types are over the total by ${byType - draft.totalMarks} marks.`
    );
  }
  return issues;
}

/** Whether every step is complete — what "Create" waits on. */
export function draftComplete(draft: QuestionBankDraft): boolean {
  return STEP_ORDER.every((step) => stepIssues(draft, step).length === 0);
}
