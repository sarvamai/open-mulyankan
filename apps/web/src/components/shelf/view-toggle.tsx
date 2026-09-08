'use client';

import { SegmentedControl } from '@/components/ui/segmented-control';
import type { SegmentedOption } from '@/components/ui/segmented-control';

/** Which way a browsing surface renders its rows. */
export type View = 'cards' | 'table';

export const VIEWS = ['cards', 'table'] as const;

/**
 * `grid-view` and `layout-table-01` come from the app's extended icon
 * registry — see `shell/icon-registry.tsx`.
 */
const OPTIONS: SegmentedOption<View>[] = [
  { value: 'cards', label: 'Card view', icon: 'grid-view', tooltip: 'Card view' },
  { value: 'table', label: 'Table view', icon: 'layout-table-01', tooltip: 'Table view' },
];

/**
 * Cards / table switch, shared by the knowledge base and the exam paper page.
 * The view is a URL param, so a shared link opens the way it was left.
 *
 * Icon-only: it sits on a toolbar beside the search box and the filters, where
 * two words of label each would crowd them out.
 */
export function ViewToggle({
  view,
  onViewChange,
}: {
  view: View;
  onViewChange: (view: View) => void;
}) {
  return <SegmentedControl options={OPTIONS} value={view} onChange={onViewChange} iconOnly />;
}
