/**
 * The draft a new question bank is assembled from. It exists only in the
 * dialog's state: `platform/core` has no question bank API, so nothing is
 * persisted and nothing is generated — the blueprint is a request a human
 * would later hand to the `gateway` SPI, whose proposals a human adopts
 * before they become drafts (invariant 5).
 *
 * No question text appears anywhere in here, by construction: a bank is
 * described by counts, marks and source refs only.
 */

/** The three steps, in order. */
export type StepId = 'details' | 'sources' | 'blueprint';

/** Where a bank's questions are drawn from. */
export type SourceMode = 'group' | 'uploads';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Marks allotted to each difficulty. Must sum to `totalMarks`. */
export type DifficultySplit = Record<Difficulty, number>;

/** One row of the question type table. */
export interface TypeAllocation {
  /** How many questions of this type. 0 means the type is not used. */
  count: number;
  /** Marks each question of this type carries. */
  marksEach: number;
  /**
   * How many alternates to propose for each question of this type, so a
   * reviewer picks one. 1 means no alternates.
   */
  alternates: number;
}

export interface QuestionBankDraft {
  name: string;
  subject: string;
  /** Class level, as typed — kept a string so the field can be empty. */
  classLevel: string;
  description: string;
  /**
   * The single language the student reads the paper in. Empty until chosen;
   * the pilot languages are configuration, not code — see `languages.ts`.
   */
  language: string;
  sourceMode: SourceMode;
  /** Selected group id, when `sourceMode` is `'group'`. */
  groupId: string | null;
  /** Selected text book ids, when `sourceMode` is `'uploads'`. */
  bookIds: string[];
  /** Chapter labels per selected book id — `{ 'textbook-0': ['Chapter 1'] }`. */
  chapters: Record<string, string[]>;
  totalMarks: number;
  difficulty: DifficultySplit;
  /** Keyed by `QuestionTypeId`; a type absent from the map is unused. */
  types: Record<string, TypeAllocation>;
}

export const EMPTY_DRAFT: QuestionBankDraft = {
  name: '',
  subject: '',
  classLevel: '',
  description: '',
  language: '',
  sourceMode: 'group',
  groupId: null,
  bookIds: [],
  chapters: {},
  totalMarks: 0,
  difficulty: { easy: 0, medium: 0, hard: 0 },
  types: {},
};
