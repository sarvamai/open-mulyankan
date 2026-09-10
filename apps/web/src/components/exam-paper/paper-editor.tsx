'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Accordion,
  AccordionItem,
  AccordionRoot,
  Badge,
  Box,
  Button,
  Filters,
  Icon,
  Input,
  Menu,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from '@sarvam/tatva';
import type { FilterCondition, FilterFieldConfig } from '@sarvam/tatva';

import { PageShell } from '@/components/shell/page-shell';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { SegmentedOption } from '@/components/ui/segmented-control';
import type { Difficulty, ExamPaperDoc, PaperSection, Question, QuestionType } from './mock-paper';

type DifficultyTone = 'positive' | 'warning' | 'danger';

interface FilterableField {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  valueOf: (question: Question, section: PaperSection) => string;
}

const DIFFICULTY_OPTIONS: SegmentedOption<Difficulty>[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const DIFFICULTY_TONE: Record<Difficulty, DifficultyTone> = {
  easy: 'positive',
  medium: 'warning',
  hard: 'danger',
};

const DIFFICULTY_BADGE: Record<Difficulty, 'green' | 'yellow' | 'red'> = {
  easy: 'green',
  medium: 'yellow',
  hard: 'red',
};

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const COGNITIVE_LEVELS = [
  'Recall',
  'Understanding',
  'Application',
  'Analysis',
  'Evaluation',
  'Creation',
];

const QUESTION_TYPES: QuestionType[] = [
  'Multiple Choice',
  'Multiple Select',
  'Short Answer',
  'Long Answer',
  'Fill in the Blank',
  'True / False',
  'Match the Following',
  'Assertion Reason',
];

const BULK_ACTIONS = [
  { label: 'Regenerate weak questions', onClick: () => toast.success('Regeneration queued') },
  { label: 'Shuffle questions', onClick: () => toast.success('Shuffle queued') },
  { label: 'Rebalance difficulty', onClick: () => toast.success('Rebalance queued') },
];

const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

function summaryLine(questions: Question[]): string {
  const marks = questions.reduce((sum, question) => sum + question.marks, 0);
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) counts[question.difficulty] += 1;
  return `${questions.length} Questions · ${marks} Marks · Easy ${counts.easy} · Medium ${counts.medium} · Hard ${counts.hard}`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Box display="flex" direction="column" gap={1}>
      <Text variant="heading-sm">{value}</Text>
      <Text variant="body-xs" tone="tertiary">
        {label}
      </Text>
    </Box>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: DifficultyTone }) {
  return (
    <Box display="flex" direction="column" gap={1}>
      <Text variant="body-xs" tone="tertiary">
        {label}
      </Text>
      <Text variant="body-sm" tone={tone ?? 'secondary'}>
        {value}
      </Text>
    </Box>
  );
}

function MetadataGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box display="flex" direction="column" gap={4}>
      <Text variant="label-sm" tone="tertiary">
        {title}
      </Text>
      <Box display="flex" direction="column" gap={10}>
        {children}
      </Box>
    </Box>
  );
}

function MarksStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <Box display="flex" direction="column" gap={4}>
      <Text variant="label-sm" tone="tertiary">
        {label}
      </Text>
      <Box display="flex" align="center" gap={2}>
        <Button
          variant="secondary"
          size="sm"
          icon="minus"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, value - 1))}
        />
        <Text variant="body-md">{value}</Text>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onChange(value + 1)}
        />
      </Box>
    </Box>
  );
}

function QuestionCard({
  question,
  expanded,
  onToggle,
  onChange,
  chapterOptions,
  topicsFor,
}: {
  question: Question;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Question>) => void;
  chapterOptions: { value: string; label: string }[];
  topicsFor: (chapter: string, currentTopic: string) => { value: string; label: string }[];
}) {
  const [editingText, setEditingText] = useState(false);

  return (
    <Box bg="surface-primary" rounded="md" p={10} display="flex" direction="column" gap={6}>
      <Box display="flex" align="start" justify="between" gap={6}>
        <div className="flex min-w-0 flex-1 flex-col gap-tatva-4">
          {editingText ? (
            <Textarea
              label="Question Text"
              value={question.text}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          ) : (
            <div
              className={`flex min-w-0 items-start gap-tatva-6${expanded ? '' : ' cursor-pointer'}`}
              onClick={expanded ? undefined : onToggle}
            >
              <Text variant="label-md" tone="tertiary">
                Q{question.number}
              </Text>
              <Text variant="body-lg">{question.text}</Text>
            </div>
          )}
          {expanded && (
            <Box display="flex" justify="end">
              {editingText ? (
                <Button variant="secondary" size="sm" onClick={() => setEditingText(false)}>
                  Done
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="pencil-edit"
                  onClick={() => setEditingText(true)}
                >
                  Edit Question Text
                </Button>
              )}
            </Box>
          )}
        </div>
        <Button variant="secondary" size="sm" icon="pencil-edit" onClick={onToggle}>
          {expanded ? 'Close' : 'Edit'}
        </Button>
      </Box>

      {expanded ? (
        <Box display="flex" direction="column" gap={8}>
          <Box display="flex" direction="column" gap={4}>
            <Text variant="label-sm" tone="tertiary">
              CLASSIFICATION
            </Text>
            <Box display="flex" wrap="wrap" gap={10}>
              <Select
                label="Question Type"
                size="sm"
                options={toOptions(QUESTION_TYPES)}
                value={question.type}
                onValueChange={(value) => onChange({ type: value as QuestionType })}
              />
              <Select
                label="Chapter"
                size="sm"
                options={chapterOptions}
                value={question.chapter}
                onValueChange={(value) => onChange({ chapter: value })}
              />
              <Select
                label="Topic"
                size="sm"
                options={topicsFor(question.chapter, question.topic)}
                value={question.topic}
                onValueChange={(value) => onChange({ topic: value })}
              />
            </Box>
          </Box>

          <Box display="flex" wrap="wrap" align="start" gap={10}>
            <Box display="flex" direction="column" gap={4}>
              <Text variant="label-sm" tone="tertiary">
                DIFFICULTY
              </Text>
              <SegmentedControl
                options={DIFFICULTY_OPTIONS}
                value={question.difficulty}
                onChange={(difficulty) => onChange({ difficulty })}
              />
            </Box>
            <MarksStepper
              label="MARKS"
              value={question.marks}
              onChange={(marks) => onChange({ marks })}
            />
          </Box>

          <Accordion heading="More Metadata" variant="subtle">
            <Box display="flex" direction="column" gap={10}>
              <MetadataGroup title="LEARNING">
                <Input
                  label="Learning Objective"
                  size="sm"
                  value={question.learningObjective}
                  onChange={(event) => onChange({ learningObjective: event.target.value })}
                />
                <Input
                  label="Learning Outcome"
                  size="sm"
                  value={question.learningOutcome}
                  onChange={(event) => onChange({ learningOutcome: event.target.value })}
                />
                <Input
                  label="Skill / Competency"
                  size="sm"
                  value={question.competency}
                  onChange={(event) => onChange({ competency: event.target.value })}
                />
                <Select
                  label="Cognitive Level"
                  size="sm"
                  options={toOptions(COGNITIVE_LEVELS)}
                  value={question.cognitiveLevel}
                  onValueChange={(value) => onChange({ cognitiveLevel: value })}
                />
              </MetadataGroup>
              <MetadataGroup title="QUESTION">
                <Textarea
                  label="Correct Answer"
                  value={question.correctAnswer}
                  onChange={(event) => onChange({ correctAnswer: event.target.value })}
                />
                <Textarea
                  label="Explanation"
                  value={question.explanation}
                  onChange={(event) => onChange({ explanation: event.target.value })}
                />
                <Input
                  label="Hint"
                  size="sm"
                  value={question.hint}
                  onChange={(event) => onChange({ hint: event.target.value })}
                />
              </MetadataGroup>
              <MetadataGroup title="ASSESSMENT">
                <Input
                  label="Estimated Time"
                  size="sm"
                  value={question.estimatedTime}
                  onChange={(event) => onChange({ estimatedTime: event.target.value })}
                />
                <MarksStepper
                  label="NEGATIVE MARKS"
                  value={question.negativeMarks}
                  onChange={(negativeMarks) => onChange({ negativeMarks })}
                />
                <Box display="flex" align="center" justify="between" gap={4}>
                  <Text variant="body-sm">Partial Marking</Text>
                  <Switch
                    checked={question.partialMarking}
                    onCheckedChange={(partialMarking) => onChange({ partialMarking })}
                  />
                </Box>
              </MetadataGroup>
            </Box>
          </Accordion>

          <Accordion heading="Advanced Metadata" variant="subtle">
            <Box display="flex" wrap="wrap" gap={10}>
              <Meta label="Question ID" value={question.id} />
              <Meta label="AI Generated" value={question.aiGenerated ? 'Yes' : 'No'} />
              <Meta label="Generation Source" value={question.generationSource} />
              <Meta label="Generation Model" value={question.generationModel} />
              <Meta label="Created At" value={question.createdAt} />
              <Meta label="Last Updated" value={question.updatedAt} />
              <Meta label="Version" value={question.version} />
              <Meta label="Tags" value={question.tags.join(', ')} />
              <Meta label="Keywords" value={question.keywords.join(', ') || '—'} />
              <Meta label="Source Reference" value={question.sourceReference} />
            </Box>
          </Accordion>
        </Box>
      ) : (
        <Box bg="surface-secondary" rounded="md" p={6} display="flex" wrap="wrap" gap={10}>
          <Meta label="Chapter" value={question.chapter} />
          <Meta label="Topic" value={question.topic} />
          <Meta
            label="Difficulty"
            value={DIFFICULTY_LABEL[question.difficulty]}
            tone={DIFFICULTY_TONE[question.difficulty]}
          />
          <Meta label="Marks" value={question.marks === 1 ? '1 Mark' : `${question.marks} Marks`} />
        </Box>
      )}
    </Box>
  );
}

/**
 * Exam paper editor: review and edit an AI-generated draft. The URL is
 * the source of truth for filters (the list pages' pattern), so refresh,
 * share and back/forward restore the view; search stays local. Every edit
 * applies immediately — there is no Save button, only a quiet confirmation.
 */
export function PaperEditor({ paper }: { paper: ExamPaperDoc }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sections, setSections] = useState<PaperSection[]>(paper.sections);
  const [openSections, setOpenSections] = useState<string[]>(paper.sections.map((s) => s.id));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const allQuestions = useMemo(() => sections.flatMap((section) => section.questions), [sections]);
  const totalMarks = useMemo(
    () => allQuestions.reduce((sum, question) => sum + question.marks, 0),
    [allQuestions]
  );
  const difficultyCounts = useMemo(() => {
    const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const question of allQuestions) counts[question.difficulty] += 1;
    return counts;
  }, [allQuestions]);

  const chapterOptions = useMemo(
    () => toOptions([...new Set(allQuestions.map((question) => question.chapter))].sort()),
    [allQuestions]
  );

  const topicsByChapter = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const question of allQuestions) {
      const topics = map.get(question.chapter) ?? new Set<string>();
      topics.add(question.topic);
      map.set(question.chapter, topics);
    }
    return map;
  }, [allQuestions]);

  const topicsFor = useCallback(
    (chapter: string, currentTopic: string) => {
      const topics = new Set(topicsByChapter.get(chapter));
      // The current topic stays selectable even when the chapter just changed.
      topics.add(currentTopic);
      return toOptions([...topics].sort());
    },
    [topicsByChapter]
  );

  const fields = useMemo<FilterableField[]>(() => {
    const optionsOf = (pick: (question: Question) => string) =>
      toOptions([...new Set(allQuestions.map(pick))].sort());
    return [
      {
        id: 'section',
        label: 'Section',
        options: paper.sections.map((section) => ({ value: section.id, label: section.label })),
        valueOf: (_question, section) => section.id,
      },
      {
        id: 'chapter',
        label: 'Chapter',
        options: optionsOf((question) => question.chapter),
        valueOf: (question) => question.chapter,
      },
      {
        id: 'topic',
        label: 'Topic',
        options: optionsOf((question) => question.topic),
        valueOf: (question) => question.topic,
      },
      {
        id: 'difficulty',
        label: 'Difficulty',
        options: DIFFICULTIES.map((value) => ({ value, label: DIFFICULTY_LABEL[value] })),
        valueOf: (question) => question.difficulty,
      },
      {
        id: 'type',
        label: 'Question Type',
        options: optionsOf((question) => question.type),
        valueOf: (question) => question.type,
      },
    ];
  }, [allQuestions, paper.sections]);

  const filterFields = useMemo<FilterFieldConfig[]>(
    () => fields.map(({ id, label, options }) => ({ id, label, type: 'select', options })),
    [fields]
  );

  // One condition per field; the operator is always equals, so `difficulty=easy`
  // is the whole param.
  const activeFilters = useMemo<FilterCondition[]>(() => {
    const conditions: FilterCondition[] = [];
    for (const field of fields) {
      const raw = searchParams.get(field.id);
      if (raw && field.options.some((option) => option.value === raw)) {
        conditions.push({ id: field.id, field: field.id, operator: 'equals', value: raw });
      }
    }
    return conditions;
  }, [fields, searchParams]);

  // Pushes param updates, omitting defaults so URLs stay clean. Next 16.2
  // silently drops router.push() calls that only change search params on
  // prerendered routes, so drive the History API directly; the App Router
  // syncs useSearchParams from it.
  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mutate(params);
      const query = params.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      if (next !== `${window.location.pathname}${window.location.search}`) {
        window.history.pushState({}, '', next);
      }
    },
    [pathname]
  );

  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function handleSearchInput(value: string) {
    setSearchText(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value), 300);
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sections
      .map((section) => ({
        section,
        questions: section.questions.filter(
          (question) =>
            activeFilters.every((condition) => {
              const field = fields.find((entry) => entry.id === condition.field);
              return !field || field.valueOf(question, section) === condition.value;
            }) &&
            (!needle ||
              question.text.toLowerCase().includes(needle) ||
              question.chapter.toLowerCase().includes(needle) ||
              question.topic.toLowerCase().includes(needle))
        ),
      }))
      .filter((entry) => entry.questions.length > 0);
  }, [sections, activeFilters, fields, search]);

  const updateQuestion = useCallback((id: string, patch: Partial<Question>) => {
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        questions: section.questions.map((question) =>
          question.id === id ? { ...question, ...patch, updatedAt: '9 Sep 2026' } : question
        ),
      }))
    );
    // Auto-save feedback: no Save button, just a quiet confirmation.
    clearTimeout(savedTimer.current);
    setSaved(true);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }, []);

  function handleFiltersChange(next: FilterCondition[]) {
    updateParams((params) => {
      for (const field of fields) params.delete(field.id);
      // One condition per field; re-adding a field replaces it.
      const byField = new Map(next.map((condition) => [condition.field, condition]));
      for (const condition of byField.values()) params.set(condition.field, condition.value);
    });
  }

  function toggleFilter(id: string, value: string) {
    updateParams((params) => {
      if (params.get(id) === value) params.delete(id);
      else params.set(id, value);
    });
  }

  return (
    <PageShell
      onBack={() => router.push('/exam-paper')}
      left={{ title: paper.title, badge: { variant: 'yellow', children: 'Draft' } }}
    >
      <Box display="flex" direction="column" gap={12}>
        <Box display="flex" wrap="wrap" align="center" justify="between" gap={6}>
          <Text variant="body-sm" tone="tertiary">
            Class {paper.class} · {paper.subject} · {totalMarks} Marks · {paper.duration}
          </Text>
          <Box display="flex" align="center" gap={4}>
            <Menu align="end" options={BULK_ACTIONS}>
              <Button variant="secondary" size="sm" icon="more-horizontal">
                Bulk Actions
              </Button>
            </Menu>
            <Button
              variant="secondary"
              size="sm"
              icon="download"
              onClick={() => toast.success('Export queued')}
            >
              Export
            </Button>
          </Box>
        </Box>

        <Box display="flex" wrap="wrap" align="center" justify="between" gap={6}>
          <Box display="flex" align="center" gap={10}>
            <Stat value={String(allQuestions.length)} label="Questions" />
            <Stat value={String(sections.length)} label="Sections" />
            <Stat value={String(totalMarks)} label="Marks" />
          </Box>
          <Box display="flex" align="center" gap={4}>
            {DIFFICULTIES.map((difficulty) => (
              <Badge
                key={difficulty}
                variant={DIFFICULTY_BADGE[difficulty]}
                selected={searchParams.get('difficulty') === difficulty}
                onClick={() => toggleFilter('difficulty', difficulty)}
              >
                {DIFFICULTY_LABEL[difficulty]} {difficultyCounts[difficulty]}
              </Badge>
            ))}
          </Box>
        </Box>

        {/* Sticky below the 64px PageShell header (top-tatva-32 = 64px). */}
        <div className="sticky top-tatva-32 z-20 bg-tatva-surface-secondary py-tatva-3">
          <Box display="flex" wrap="wrap" align="center" gap={6}>
            <Box w={100}>
              <Input
                placeholder="Search questions..."
                icon="search"
                value={searchText}
                onChange={(event) => handleSearchInput(event.target.value)}
              />
            </Box>
            <Filters
              fields={filterFields}
              value={activeFilters}
              onChange={handleFiltersChange}
              showOperators={false}
            />
            <div
              className="flex w-tatva-32 items-center gap-tatva-2 transition-opacity duration-tatva-fast"
              style={{ opacity: saved ? 1 : 0 }}
            >
              <Icon name="check" size="xs" tone="success" />
              <Text variant="body-sm" tone="positive">
                Saved
              </Text>
            </div>
            <Box ml="auto" display="flex" align="center" gap={4}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpenSections(sections.map((section) => section.id))}
              >
                Expand All
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setOpenSections([])}>
                Collapse All
              </Button>
            </Box>
          </Box>
        </div>

        {visible.length === 0 ? (
          <Box
            bg="surface-primary"
            rounded="md"
            p={14}
            display="flex"
            direction="column"
            align="center"
            gap={2}
          >
            <Text variant="body-md">No questions found</Text>
            <Text variant="body-sm" tone="tertiary">
              Try a different search or filters.
            </Text>
          </Box>
        ) : (
          <AccordionRoot
            type="multiple"
            value={openSections}
            onValueChange={(value) => setOpenSections(Array.isArray(value) ? value : [value])}
          >
            {visible.map(({ section, questions }) => (
              <AccordionItem
                key={section.id}
                value={section.id}
                heading={`${section.label} — ${section.name}`}
                badge={{ variant: 'brand', children: questions.length }}
              >
                <Box display="flex" direction="column" gap={6}>
                  <Text variant="body-sm" tone="tertiary">
                    {summaryLine(questions)}
                  </Text>
                  {questions.map((question) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      expanded={editingId === question.id}
                      onToggle={() => setEditingId(editingId === question.id ? null : question.id)}
                      onChange={(patch) => updateQuestion(question.id, patch)}
                      chapterOptions={chapterOptions}
                      topicsFor={topicsFor}
                    />
                  ))}
                </Box>
              </AccordionItem>
            ))}
          </AccordionRoot>
        )}
      </Box>
    </PageShell>
  );
}
