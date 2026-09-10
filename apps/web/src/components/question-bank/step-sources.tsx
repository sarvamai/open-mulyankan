'use client';

import { useMemo, useState } from 'react';
import { Badge, Box, Checkbox, Icon, Input, Radio, RadioGroup, Text } from '@sarvam/tatva';

import { chapterLabels, MOCK_ITEMS } from '@/components/knowledge-base/mock-items';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { SegmentedOption } from '@/components/ui/segmented-control';
import { MOCK_GROUPS } from './mock-groups';
import type { QuestionBankDraft, SourceMode } from './types';

/**
 * The same control the cards/table toggle uses, so a switch between two views
 * looks like one thing across the app. `folder-library` and `book-03` come
 * from the app's extended icon registry.
 */
const SOURCE_OPTIONS: SegmentedOption<SourceMode>[] = [
  { value: 'group', label: 'Group', icon: 'folder-library' },
  { value: 'uploads', label: 'Individual uploads', icon: 'book-03' },
];

const BOOKS = MOCK_ITEMS.filter((item) => item.kind === 'textbook');

/** The books a chapter picker is shown for, in the order they were chosen. */
function selectedBooks(draft: QuestionBankDraft) {
  return draft.bookIds
    .map((id) => BOOKS.find((book) => book.id === id))
    .filter((book): book is (typeof BOOKS)[number] => book !== undefined);
}

/** One book's chapters, with select-all and clear. */
function ChapterPicker({
  book,
  selected,
  onChange,
}: {
  book: (typeof BOOKS)[number];
  selected: string[];
  onChange: (chapters: string[]) => void;
}) {
  const chapters = chapterLabels(book);
  const allSelected = selected.length === chapters.length;

  function toggle(chapter: string, checked: boolean) {
    onChange(
      checked
        ? chapters.filter((label) => label === chapter || selected.includes(label))
        : selected.filter((label) => label !== chapter)
    );
  }

  return (
    <Box display="flex" direction="column" gap={5} p={8} bg="secondary" rounded="sm">
      <Box display="flex" align="center" justify="between" gap={4}>
        <Box display="flex" direction="column" gap={1} minW="0">
          <Text variant="label-sm" lineClamp={1}>
            {book.name}
          </Text>
          <Text variant="body-xs" tone="tertiary">
            Class {book.class} · {book.subject} · {chapters.length} chapters
          </Text>
        </Box>
        <Box shrink={false}>
          <Checkbox
            variant="select-all"
            checked={allSelected}
            label={allSelected ? 'Clear all' : 'Select all'}
            onChange={() => onChange(allSelected ? [] : chapters)}
          />
        </Box>
      </Box>
      <div className="grid grid-cols-2 gap-tatva-4 sm:grid-cols-3">
        {chapters.map((chapter) => (
          <Checkbox
            key={chapter}
            label={chapter}
            checked={selected.includes(chapter)}
            onChange={(event) => toggle(chapter, event.target.checked)}
          />
        ))}
      </div>
    </Box>
  );
}

/**
 * Step 2: where the questions come from — a group, or text books picked one
 * by one and then narrowed to chapters. The two are alternatives, so the tab
 * is the choice: switching it changes `sourceMode`, and each side keeps what
 * it had so a switch back is not a reset.
 */
export function StepSources({
  draft,
  onChange,
}: {
  draft: QuestionBankDraft;
  onChange: (patch: Partial<QuestionBankDraft>) => void;
}) {
  const [bookSearch, setBookSearch] = useState('');

  const books = useMemo(() => {
    const needle = bookSearch.trim().toLowerCase();
    if (!needle) return BOOKS;
    return BOOKS.filter((book) =>
      [book.name, book.subject, `class ${book.class}`].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }, [bookSearch]);

  function toggleBook(id: string, checked: boolean) {
    if (checked) {
      onChange({ bookIds: [...draft.bookIds, id] });
      return;
    }
    // Dropping a book drops its chapter selection with it — a chapter has no
    // meaning without the book it belongs to.
    const chapters = { ...draft.chapters };
    delete chapters[id];
    onChange({ bookIds: draft.bookIds.filter((bookId) => bookId !== id), chapters });
  }

  return (
    <Box display="flex" direction="column" gap={12}>
      <SegmentedControl
        options={SOURCE_OPTIONS}
        value={draft.sourceMode}
        onChange={(sourceMode) => onChange({ sourceMode })}
      />

      {draft.sourceMode === 'group' ? (
        <Box display="flex" direction="column" gap={6}>
          <Text variant="body-sm" tone="secondary">
            Draw on everything in one group — the books and papers it holds.
          </Text>
          <RadioGroup
            value={draft.groupId ?? ''}
            onValueChange={(value) => onChange({ groupId: value })}
          >
            {MOCK_GROUPS.map((group) => (
              <Radio
                key={group.id}
                value={group.id}
                label={group.name}
                description={group.summary}
              />
            ))}
          </RadioGroup>
        </Box>
      ) : (
        <Box display="flex" direction="column" gap={12}>
          <Input
            placeholder="Search text books..."
            icon="search"
            value={bookSearch}
            onChange={(event) => setBookSearch(event.target.value)}
          />

          <Box display="flex" direction="column" gap={5}>
            <Box display="flex" align="center" gap={4}>
              <Text variant="label-sm">Text books</Text>
              <Badge size="sm" variant={draft.bookIds.length > 0 ? 'brand' : 'default'}>
                {`${draft.bookIds.length} selected`}
              </Badge>
            </Box>
            {/* Capped and scrolling: the mock list is 22 books and a real one
             * is longer, and the dialog's own height is the budget. */}
            <div className="max-h-tatva-124 overflow-y-auto">
              <Box display="flex" direction="column" gap={4}>
                {books.map((book) => (
                  <Checkbox
                    key={book.id}
                    label={`${book.name} · Class ${book.class} · ${book.subject}`}
                    checked={draft.bookIds.includes(book.id)}
                    onChange={(event) => toggleBook(book.id, event.target.checked)}
                  />
                ))}
                {books.length === 0 && (
                  <Box display="flex" align="center" gap={4} py={8}>
                    <Icon name="search" size="sm" tone="tertiary" />
                    <Text variant="body-xs" tone="tertiary">
                      No text books match that search.
                    </Text>
                  </Box>
                )}
              </Box>
            </div>
          </Box>

          {draft.bookIds.length > 0 && (
            <Box display="flex" direction="column" gap={6}>
              <Text variant="label-sm">Chapters</Text>
              {selectedBooks(draft).map((book) => (
                <ChapterPicker
                  key={book.id}
                  book={book}
                  selected={draft.chapters[book.id] ?? []}
                  onChange={(chapters) =>
                    onChange({ chapters: { ...draft.chapters, [book.id]: chapters } })
                  }
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
