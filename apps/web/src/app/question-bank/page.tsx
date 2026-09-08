import type { Metadata } from 'next';

import { QuestionBankView } from '@/components/question-bank/question-bank-view';

export const metadata: Metadata = {
  title: 'Question Bank',
};

/**
 * Question bank surface, reachable from the sidebar. Nothing is modelled
 * behind it yet — the page carries the header action that opens the new bank
 * dialog, and the dialog's draft lives only in its own state.
 */
export default function QuestionBankPage() {
  return <QuestionBankView />;
}
