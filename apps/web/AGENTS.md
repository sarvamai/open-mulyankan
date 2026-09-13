<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# `apps/web` — experience layer

Next.js 16 App Router · React 19 · Tailwind **3** · pnpm 10 (pinned in
`package.json` `packageManager`) · Node >= 20.9.
`pnpm dev | build | start | lint | check-types`. Root `AGENTS.md` has the
invariants; `design-system/AGENTS.md` covers the vendored tarball.

## What exists

`src/app/{layout,page,globals.css}`, the knowledge base at
`src/app/knowledge-base/page.tsx` (text book / exam paper / group tabs; the
**text book tab is wired to core-api** and the other two are still mock —
every tab is a shelf of cards, and text
books and exam papers also switch to a table (`?view=table`; groups have no
table — nothing is modelled behind them to put in columns). “Create group” in
the header opens the composer in `PageShell`'s rail — not a `Sheet` — so the
shelf stays visible and draggable while items are dragged in; the drag payload
is the item id alone, see `components/knowledge-base/drag.ts`. Groups exist
only in this page's state: nothing is modelled behind them), exam papers at
`src/app/exam-paper/page.tsx` (the same card shelf and table over its own mock
rows — name, class, subject, question count, marks, created) with the paper
editor at `src/app/exam-paper/[id]/page.tsx` (mock authored draft — section
accordions, inline question editing), the question bank at
`src/app/question-bank/page.tsx` (still a placeholder list — nothing is
stored — carrying the three-step “New question bank” dialog: details and
question language, then sources, then the marks blueprint, with a summary
card beside every step. The draft lives in the dialog's state and is
described by counts and source refs only, never question text), and a
placeholder at `src/app/settings/page.tsx` (it exists so its sidebar
destination resolves; nothing is modelled behind it). `src/components/shell/` holds the universal
layout: `AppShell` (sidebar + content frame, modelled on
mulyankan-frontend's GlobalShell), `PageShell` (sticky Header +
scrolling capped content, modelled on its PageShell, plus a full-height
rail slot beside it that a page fills with `createPortal` via
`usePageAside`) and
`icon-registry.tsx` (`AppIconProvider`, mounted in `layout.tsx`, which
extends tatva's icon set with hugeicons glyphs it lacks — `book-03`,
`book-upload`, `drag-drop`, `files-01`, `folder-add`, `folder-library`,
`global-education`, `grid-view`, `layout-table-01`, `question`, keyed by
glyph so a name says what renders).
`src/components/shelf/` is the browsing vocabulary both pages share:
`ItemCard` (one card — preview on a 3D stage, title, `CardStats`, actions
menu, optional corner badge), `CardShelf` (grid + empty state +
`ShelfPager`), `ViewToggle` (the cards/table switch, `?view=`, a
`SegmentedControl` from `src/components/ui/` — small primitives no one
feature owns; use that control rather than `Tabs variant="segmented"`,
which stretches to its container and reads as navigation),
`StatusChip`, and the two previews that stand on the stage —
`book-card.tsx` (`BookObject`/`MiniCover`) and `paper-card.tsx`
(`PaperObject`/`MiniSheet`). A page maps its own row type onto `BookFace`
or `PaperFace`: the shelf declares those shapes rather than depending on
any page's rows, and the knowledge base's mapping lives in
`knowledge-base/item-face.tsx`.
**A card's stats and its page's table columns come from one list of field
definitions** (`ITEM_FIELDS` in `knowledge-base-manager.tsx`,
`PAPER_FIELDS` in `exam-paper-manager.tsx`): label, value, column width.
Add a field there and both views get it — a card that writes its own
summary line is how the two drifted apart before. In the knowledge base
that list also owns the `meta` column, labelled `Medium` for a text book
and `Set` for an exam paper, so it no longer rides unlabelled under the
name.
`src/components/knowledge-base/`, `src/components/exam-paper/` and
`src/components/question-bank/` hold the page views (client view owning
the header, plus the manager and editor).
**The one live API surface is `/sources`**: `src/lib/sources-api.ts` is
the typed client (its shapes mirror `core_api/routers/sources.py`; when
they drift the router is right), `knowledge-base/use-sources.ts` reads the
list and polls it *only* while a source is still being extracted, and
`knowledge-base/upload-dialog.tsx` posts the PDF with the facts extraction
cannot read off it — name, subject, class, medium. A card's cover is the
server-rendered first page, a 512px lossy JPEG from
`GET /sources/{id}/cover`; rename and delete go to the server for real
rows and to local state for mock ones, keyed on which ids came from the
API. `knowledge-base/mock-items.ts` now backs the **exam paper** tab only
(no ingest route for papers yet), though the question bank's source step
still draws text books from it — a chapter there is a number
(`chapterLabels`) because no table of contents is modelled.
**`chapters` is `number | null`.** Null means the PDF declares no table of
contents and nothing has inferred one; the column shows an em dash. Zero
would be a claim about the book, so don't coalesce it.
`question-bank/blueprint.ts` holds every derivation the wizard and its
summary card share, so the gating and the card cannot disagree;
`question-bank/languages.ts` is the question language list and
`question-bank/question-types.ts` the type vocabulary (the exam paper
editor's `QuestionType` is the same vocabulary from the other end — the
two are not yet reconciled in code). Both previews' 3D geometry lives in `globals.css`
(`.book*` — `preserve-3d` plus a rotated spine face; `.paper*` — an A4
sheet over two leaves, printed with a container-query type scale) because
utility classes cannot express it; a paper's ink is fixed rather than
tokenised, since the stock is white in every theme. `coverUrl` on either
face carries the server-rendered first page for a real source; mock rows
have none, so their covers and every sheet are generated art.
`page.tsx` is a design-system smoke page. No auth, store, tests, or
Storybook yet, and `/sources` is the only API client — check before
importing, and don't copy structure from the sibling `mulyankan-frontend`
repo on the assumption it is here.

## This app is an untrusted client

The server state machine is authoritative (ADR-0001 amended, ADR-0008). A
React **server** component here is still a client of `platform/core`: no
database reads, no privileged credentials, no authorization decisions. A
client-side check is a courtesy; the server must refuse independently. No
question content in `console.log`, error messages, URLs, or telemetry.

This app is the **oversight client** — coordinator, administrator,
integrity operator, auditor (ADR-0011 settled the role mapping). Content
roles use the Tauri client (`apps/client`); never build a content-role
surface here.

## Load-bearing wires

Break one and it looks like a component bug, not a config error:

| File | Why |
|---|---|
| `tailwind.config.ts` | `presets: [tatvaPreset]` gives the `tatva-*` tokens; the `content` glob over `node_modules/@sarvam/tatva/dist/**` is what generates tatva's own classes |
| `src/app/layout.tsx` | `@sarvam/tatva/styles.css` imported **before** `./globals.css` — tokens and fonts first, app utilities second |
| `next.config.ts` | `transpilePackages: ['@sarvam/tatva']` — the package ships untranspiled ESM |
| `.npmrc` | `strict-peer-dependencies=false` — tatva declares `sonner@^1.4`, this app tracks 2.x |
| `src/components/shell/icon-registry.tsx` | `IconProvider` must be imported from `@sarvam/tatva`, **not** `@sarvam/tatva/icon-context`: the subpath ships a second copy of the context and `Icon` reads the one bundled into `index.mjs`, so registering through the subpath silently resolves nothing (and the root export is missing from the type declarations) |
| `src/lib/sources-api.ts` | `NEXT_PUBLIC_MULYANKAN_API` defaults to `http://localhost:8000`, which is the port the root `AGENTS.md` starts core-api on. core-api's own CORS allow-list defaults to `http://localhost:3000` — change one and change the other, or every call fails preflight with nothing in the network tab but a blocked request |
| `package.json` | `pnpm.overrides` pin transitive deps to fixed, patched versions (arriving via tatva and next: `@ai-sdk/provider-utils`, `ai`, `jsondiffpatch`, `linkify-it`, `postcss`, `sharp`) — deliberate, not redundant |

**No Tailwind 4** (tatva ships a v3 CommonJS preset). **No registry auth, no
`@hugeicons-pro`** — credential-free is the point. `@hugeicons/core-free-icons`
(the free set tatva itself draws from) is a direct dependency, pinned to the
version tatva already resolves, purely to feed the icon registry above.

## Writing UI

Compose tatva components; don't hand-roll what it covers. Its own rules are at
`node_modules/@sarvam/tatva/.agent/rules/tatva-frontend.mdc` — written for a
later release, so **verify every component and prop against the installed
version** rather than trusting those rules or your memory:

```bash
node -e "import('@sarvam/tatva').then(m=>console.log('AppShell' in m))"   # exports
grep -n "interface ButtonProps" -A 30 node_modules/@sarvam/tatva/dist/index.d.ts
```

Runtime beats types here: some components are re-exported from subpath modules
and never appear in `dist/index.d.ts`'s export list. `AppShell` is one thing
those rules recommend that this version does not have.

Constraints that cause type errors or silent breakage:

- **`Box` takes no `className`** — use its props (`p`, `gap`, `bg`, `rounded`,
  `shadow`, `w`, `h`, `display`, `direction`, `align`, `justify`, `overflow`).
- **Only `tatva-*` tokens**, never raw Tailwind (`p-4`, `text-gray-500`).
  Spacing is a 2px base (`p={8}` = 16px); three tiers only — `gap={2}` within
  one thing, `gap={10}` between fields, `gap={12}` between regions. Spacing is
  the parent's `gap`, never a child's margin.
- **Icon names are a closed set** (88 of them). Never guess; read `iconNames`.
  A name that is genuinely absent goes through `AppIconProvider`, not a
  hand-rolled SVG.
- `Text` uses `variant` + `tone`, not `size`/`color`.
- **`Button` takes `isLoading`, not `loading`.**
- **A `Table` with no rows fetches `/images/empty-table.png`**, which this
  app does not serve — so a view that renders the table before its data
  arrives logs a 404 and flashes "no rows found". Gate on the loading
  state instead; the knowledge base does this with `awaitingSources`.
- **`Input` does not render a required marker.** `InputWrapper` supports
  `required` and draws the red asterisk, but `Input` never forwards it — it
  spreads onto the native `<input>` instead — while `Select` does. Mixing the
  two in one form gives asterisks on some fields and not others, so the
  question bank's steps mark none and say what is missing under the step.

`pnpm check-types && pnpm lint && pnpm build` — all three run in CI's `web`
job. The build is the real check: a wrong `content` glob or CSS order compiles
fine and renders unstyled.

## Keeping this file true

Update it when you add a real surface or dependency (the "what exists" list),
change any of the wires, or bump the tatva version — component and prop
claims are version-specific, so re-verify them with the commands above.
