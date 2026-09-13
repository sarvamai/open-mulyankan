'use client';

import { useState } from 'react';
import { Box, Button, Dialog, FileUpload, Input, Select, Text, toast } from '@sarvam/tatva';

import { QUESTION_LANGUAGES } from '@/components/question-bank/languages';
import { ApiError, uploadSource, type SourceKind } from '@/lib/sources-api';

/** Classes the pilot covers. Nothing in `platform/` names a set yet. */
const CLASSES = [6, 7, 8, 9, 10, 11, 12];

const SUBJECTS = [
  'Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Social Science',
  'History',
  'Geography',
  'Civics',
  'Economics',
  'English',
  'Hindi',
  'Computer Applications',
];

const MAX_MB = 64;

/** `name` defaults to the file's own stem — the reader can overwrite it. */
function stem(filename: string): string {
  return filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
}

interface Draft {
  file: File | null;
  name: string;
  subject: string;
  classLevel: string;
  meta: string;
}

const EMPTY: Draft = { file: null, name: '', subject: '', classLevel: '', meta: '' };

/**
 * Upload a source document. One PDF, plus the facts extraction cannot read
 * off it — what the book is, whose class it is for, which medium it is in.
 *
 * The server starts extracting and answers before it finishes, so this
 * closes as soon as the job is registered; the shelf shows the card moving
 * through its stages. Failures after that point are reported on the card,
 * not here.
 */
export function UploadDialog({
  open,
  kind,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  kind: SourceKind;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [sending, setSending] = useState(false);
  // What is missing is said only once the reader has tried to submit.
  const [attempted, setAttempted] = useState(false);

  // Reopening the dialog must not show the last upload's draft. Adjusting
  // state during render is React's own answer to "reset when a prop
  // changes" — an effect would render the stale draft once before clearing.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(EMPTY);
      setAttempted(false);
      setSending(false);
    }
  }

  const label = kind === 'textbook' ? 'text book' : 'exam paper';
  const metaLabel = kind === 'textbook' ? 'Medium' : 'Set';

  const missing = [
    !draft.file && 'a PDF',
    !draft.name.trim() && 'a name',
    !draft.subject && 'a subject',
    !draft.classLevel && 'a class',
  ].filter(Boolean) as string[];

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function submit() {
    setAttempted(true);
    if (missing.length > 0 || !draft.file) return;

    setSending(true);
    try {
      await uploadSource({
        file: draft.file,
        kind,
        name: draft.name.trim(),
        subject: draft.subject,
        classLevel: Number(draft.classLevel),
        meta: draft.meta,
      });
      toast.success(`Extracting ${draft.name.trim()}`);
      onUploaded();
      onOpenChange(false);
    } catch (caught) {
      // The server's own reason is the useful one — it is the side that
      // actually refused, and this client is not authoritative.
      toast.error(caught instanceof ApiError ? caught.message : 'Upload failed');
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !sending) onOpenChange(false);
      }}
      size="lg"
      title={`Upload ${label}`}
      description="The PDF is read on the server: its text, its images, and a cover from page one."
      showCloseButton
    >
      <Box display="flex" direction="column" gap={12}>
        <FileUpload
          selectedFile={draft.file}
          acceptedTypes={{ 'application/pdf': ['.pdf'] }}
          maxSize={MAX_MB * 1024 * 1024}
          primaryText="Drop a PDF here, or browse"
          secondaryText={`PDF only, up to ${MAX_MB} MB`}
          disabled={sending}
          onFileSelect={(file) =>
            patch({
              file,
              // Only fill a name the reader has not written themselves.
              name: draft.name || (file ? stem(file.name) : ''),
            })
          }
        />

        <Input
          label="Name"
          placeholder="e.g. Science"
          value={draft.name}
          disabled={sending}
          onChange={(event) => patch({ name: event.target.value })}
        />

        <Box display="flex" gap={10}>
          <Box grow minW="0">
            <Select
              label="Subject"
              searchable
              placeholder="Choose a subject"
              value={draft.subject}
              options={SUBJECTS.map((subject) => ({ value: subject, label: subject }))}
              onValueChange={(value) => patch({ subject: value })}
            />
          </Box>
          <Box w={80} shrink={false}>
            <Select
              label="Class"
              placeholder="Class"
              value={draft.classLevel}
              options={CLASSES.map((level) => ({
                value: String(level),
                label: `Class ${level}`,
              }))}
              onValueChange={(value) => patch({ classLevel: value })}
            />
          </Box>
        </Box>

        {kind === 'textbook' ? (
          <Select
            label={metaLabel}
            searchable
            helperText="The language the book is written in."
            placeholder="Choose a medium"
            value={draft.meta}
            options={QUESTION_LANGUAGES.map((language) => ({
              value: language,
              label: language,
            }))}
            onValueChange={(value) => patch({ meta: value })}
          />
        ) : (
          <Input
            label={metaLabel}
            placeholder="e.g. Set 1"
            value={draft.meta}
            disabled={sending}
            onChange={(event) => patch({ meta: event.target.value })}
          />
        )}

        {/* No field carries a required marker: this tatva version's `Input`
         * does not forward `required` to its label while `Select` does, so
         * marking some and not others is the inconsistency. What is still
         * needed is said here instead, once submit has been tried. */}
        {attempted && missing.length > 0 ? (
          <Text variant="body-xs" tone="danger">
            {`Still needed: ${missing.join(', ')}.`}
          </Text>
        ) : null}

        <Box display="flex" justify="end" gap={8}>
          <Button
            variant="secondary"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" isLoading={sending} onClick={() => void submit()}>
            Upload
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
