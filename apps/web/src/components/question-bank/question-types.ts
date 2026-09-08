/**
 * The question types a bank's blueprint can ask for.
 *
 * The exam paper editor's `QuestionType` (`exam-paper/mock-paper.ts`) is the
 * same vocabulary seen from the other end — an authored paper's questions —
 * and its spellings are kept here so a blueprint and a paper describe a
 * question the same way. `essay` and `numerical` are additions this list
 * needs and that one does not yet carry; if the two ever have to agree in
 * code, this is the file to reconcile from.
 */

export interface QuestionTypeSpec {
  id: string;
  label: string;
  /** Marks a question of this type usually carries — the row's starting value. */
  defaultMarks: number;
}

export const QUESTION_TYPES: readonly QuestionTypeSpec[] = [
  { id: 'multiple-choice', label: 'Multiple choice', defaultMarks: 1 },
  { id: 'multiple-select', label: 'Multiple select', defaultMarks: 2 },
  { id: 'true-false', label: 'True / false', defaultMarks: 1 },
  { id: 'fill-in-the-blank', label: 'Fill in the blank', defaultMarks: 1 },
  { id: 'numerical', label: 'Numerical', defaultMarks: 3 },
  { id: 'short-note', label: 'Short note', defaultMarks: 3 },
  { id: 'long-note', label: 'Long note', defaultMarks: 5 },
  { id: 'essay', label: 'Essay', defaultMarks: 8 },
  { id: 'match-the-following', label: 'Match the following', defaultMarks: 4 },
  { id: 'assertion-reason', label: 'Assertion and reason', defaultMarks: 2 },
] as const;
