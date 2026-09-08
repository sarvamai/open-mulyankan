'use client';

import {
  Book03Icon,
  BookUploadIcon,
  DragDropIcon,
  Files01Icon,
  FolderAddIcon,
  FolderLibraryIcon,
  GlobalEducationIcon,
  GridViewIcon,
  LayoutTable01Icon,
  QuestionIcon,
} from '@hugeicons/core-free-icons';
import * as Tatva from '@sarvam/tatva';
import type { ExtendedIconComponents, IconProviderProps } from '@sarvam/tatva/icon-context';
import type { FunctionComponent, ReactNode } from 'react';

/*
 * `IconProvider` is exported from the package root at runtime but missing from
 * its type declarations — the documented "runtime beats types" case for this
 * tatva version. It has to come from the root: `@sarvam/tatva/icon-context`
 * exports a *second* copy of the context, and `Icon` reads the one bundled
 * into `index.mjs`, so registering through the subpath silently does nothing.
 */
const IconProvider = (Tatva as unknown as { IconProvider: FunctionComponent<IconProviderProps> })
  .IconProvider;

/*
 * Icons this app needs that tatva's 88-name built-in set does not carry.
 * Keyed by the hugeicons glyph they come from, not by use, so a name always
 * says which glyph will render.
 * Registered by name, so `<Icon name="book-upload" />` — and any component
 * taking an `icon` prop — resolves them exactly like a built-in.
 *
 * Only `@hugeicons/core-free-icons`, the same free package tatva itself draws
 * from. No `@hugeicons-pro`: this tree stays credential-free.
 *
 * The cast is deliberate: tatva 0.0.34 types an extended icon as a single
 * `[tag, attrs, children?]` tuple, while core-free-icons 3.x exports an array
 * of those. `Icon` hands whatever it resolves straight to `HugeiconsIcon`,
 * which takes the array form, so the value is right and only the type narrow.
 */
const EXTENDED_ICONS = {
  'book-03': Book03Icon,
  'book-upload': BookUploadIcon,
  'drag-drop': DragDropIcon,
  'files-01': Files01Icon,
  'folder-add': FolderAddIcon,
  'folder-library': FolderLibraryIcon,
  'global-education': GlobalEducationIcon,
  'grid-view': GridViewIcon,
  'layout-table-01': LayoutTable01Icon,
  question: QuestionIcon,
} as unknown as ExtendedIconComponents;

export function AppIconProvider({ children }: { children: ReactNode }) {
  return <IconProvider extend={EXTENDED_ICONS}>{children}</IconProvider>;
}
