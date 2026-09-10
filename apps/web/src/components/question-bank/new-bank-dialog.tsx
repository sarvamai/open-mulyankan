'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Dialog, Icon, Stepper, Text, toast } from '@sarvam/tatva';

import { BlueprintSummary } from './blueprint-summary';
import { STEP_LABELS, STEP_ORDER, stepIssues } from './blueprint';
import { StepBlueprint } from './step-blueprint';
import { StepDetails } from './step-details';
import { StepSources } from './step-sources';
import { EMPTY_DRAFT } from './types';
import type { QuestionBankDraft } from './types';

/** What each step asks for, under its heading. */
const STEP_HINTS = [
  'Name the bank and say which subject, class and language it is for.',
  'Choose where its questions are drawn from.',
  'Set the marks, how they split across difficulty, and which question types make them up.',
];

/**
 * The three-step dialog that describes a new question bank: details, sources,
 * then the marks blueprint, with the summary card beside every step.
 *
 * The draft lives here and nowhere else. There is no question bank API, so
 * "Create" reports what would be requested and closes — and even when there
 * is one, the blueprint is a request, not content: the `gateway` SPI proposes
 * and a human adopts before anything becomes a draft (invariant 5).
 */
export function NewBankDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<QuestionBankDraft>(EMPTY_DRAFT);
  // What is missing is said only once the reader has tried to leave the step.
  // Listing it on arrival would flag every field of an untouched form.
  const [attempted, setAttempted] = useState(false);

  // The step body is its own scroller, so a new step has to be shown from its
  // top — otherwise step 3 opens part-way down, where step 2 was left.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const stepId = STEP_ORDER[step];
  const issues = stepIssues(draft, stepId);
  const isLast = step === STEP_ORDER.length - 1;

  function patch(next: Partial<QuestionBankDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function close() {
    onOpenChange(false);
    // Reset after the close so the dialog does not visibly rewind on its way
    // out; a fresh press of "New question bank" starts from step 1.
    setStep(0);
    setDraft(EMPTY_DRAFT);
    setAttempted(false);
  }

  /** Leaves the step if it is complete, and otherwise says what is missing. */
  function advance() {
    if (issues.length > 0) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    setStep((current) => current + 1);
  }

  function handleCreate() {
    if (issues.length > 0) {
      setAttempted(true);
      return;
    }
    // No content and no ids in the message: a bank is described by counts.
    toast.info('Question bank creation is coming soon');
    close();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      size="xxl"
      title="New question bank"
      description={STEP_HINTS[step]}
      showCloseButton
    >
      <Box display="flex" direction="column" gap={12}>
        <Box display="flex" direction="column" gap={5}>
          {/* tatva's Stepper is a progress rail: every bar up to `currentStep`
           * fills, so passing the active index reads as "this far". */}
          <Stepper
            steps={STEP_ORDER.map((id) => ({ label: STEP_LABELS[id] }))}
            currentStep={step}
          />
          <Text variant="body-xs" tone="tertiary">
            {`Step ${step + 1} of ${STEP_ORDER.length}`}
          </Text>
        </Box>

        {/* Steps left, summary right — the card is a sibling of the step, not
         * part of it, which is what keeps it on screen from step 1 to the
         * last. Below lg it stacks under the step body. */}
        <div className="grid gap-tatva-12 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div ref={bodyRef} className="max-h-[52vh] overflow-y-auto pr-tatva-2">
            {stepId === 'details' && <StepDetails draft={draft} onChange={patch} />}
            {stepId === 'sources' && <StepSources draft={draft} onChange={patch} />}
            {stepId === 'blueprint' && <StepBlueprint draft={draft} onChange={patch} />}
          </div>
          <div className="lg:sticky lg:top-0 lg:self-start">
            <BlueprintSummary draft={draft} />
          </div>
        </div>

        {/* What is stopping this step, rather than a disabled button with no
         * explanation. */}
        {attempted && issues.length > 0 && (
          <Box display="flex" direction="column" gap={2}>
            {issues.map((issue) => (
              <Box key={issue} display="flex" align="center" gap={4}>
                <Icon name="info" size="xs" tone="tertiary" />
                <Text variant="body-xs" tone="tertiary">
                  {issue}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* The dialog's own footer takes a cancel and a submit; a stepper
         * needs Back as well, so the footer is rendered here instead. */}
        <Box display="flex" align="center" justify="between" gap={6}>
          <Button
            variant="secondary"
            icon="arrow-left"
            disabled={step === 0}
            onClick={() => {
              setAttempted(false);
              setStep((current) => Math.max(0, current - 1));
            }}
          >
            Back
          </Button>
          <Box display="flex" align="center" gap={4}>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {/* Enabled either way: pressing it is how the reader asks what is
             * left, and a disabled button answers nothing. */}
            <Button variant="primary" onClick={isLast ? handleCreate : advance}>
              {isLast ? 'Create question bank' : 'Next'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
