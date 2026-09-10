/**
 * Mock groups for the source step's group picker.
 *
 * Nothing is modelled behind groups anywhere yet: the knowledge base's own
 * groups live in that page's React state and start empty, so there is no list
 * to read here. These rows stand in until a group API exists, which is also
 * why they carry a member count rather than resolving member ids — the ids
 * would not match anything the knowledge base holds.
 */

export interface MockGroup {
  id: string;
  name: string;
  /** How the group's membership reads in the picker. */
  summary: string;
}

export const MOCK_GROUPS: readonly MockGroup[] = [
  { id: 'group-mock-0', name: 'Class 10 — Board revision', summary: '6 text books · 4 exam papers' },
  { id: 'group-mock-1', name: 'Class 10 — Science core', summary: '3 text books · 2 exam papers' },
  { id: 'group-mock-2', name: 'Class 12 — Physics and Chemistry', summary: '4 text books · 5 exam papers' },
  { id: 'group-mock-3', name: 'Class 8 — Social science set', summary: '3 text books' },
] as const;
