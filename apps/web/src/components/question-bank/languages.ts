/**
 * The languages a question bank can be authored in — one per bank, the
 * language the student reads the paper in.
 *
 * ADR-0006 records that the specific pilot languages are the authority's
 * decision and that the platform treats required languages as cycle
 * configuration (`cycle.required_languages`), never as code. This list is the
 * client's stand-in for that configuration until there is an API to read it
 * from: the names live in one array, not in the components, so settling or
 * narrowing the pilot set is a one-line change here.
 *
 * The set is the Eighth Schedule's twenty-two plus English. Hindi and English
 * lead the list because they are the ones most banks will pick; the rest are
 * alphabetical. The step's select is searchable, which is what makes
 * twenty-three options usable.
 */
export const QUESTION_LANGUAGES: readonly string[] = [
  'Hindi',
  'English',
  'Assamese',
  'Bengali',
  'Bodo',
  'Dogri',
  'Gujarati',
  'Kannada',
  'Kashmiri',
  'Konkani',
  'Maithili',
  'Malayalam',
  'Manipuri',
  'Marathi',
  'Nepali',
  'Odia',
  'Punjabi',
  'Sanskrit',
  'Santali',
  'Sindhi',
  'Tamil',
  'Telugu',
  'Urdu',
] as const;
