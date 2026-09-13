# ADR-0009: An `extraction` SPI separate from `ocr`, and a per-page routing rule

- Status: Accepted
- Date: 2026-09-10

## Context

Source material arrives as PDFs. Two quite different things can get text out
of one: reading a text layer the document already carries, which is exact,
local, free and deterministic; and recognising characters in an image of a
page, which is none of those. ADR-0003 names an `ocr` provider nowhere and a
`sanitize` provider for upload handling, so neither was specified.

The prior art we are porting from (the sibling `adhyapak` repository) treats
these as one stage with a document-level branch: it averages extractable
characters per page across the whole PDF and, under fifty, sends the entire
document to a hosted OCR API. On a book with three hundred digital pages and
thirty scanned plates, the average clears the threshold and those thirty
pages are silently indexed as empty. The inverse fails too.

A third case appears in practice and in neither design: a PDF whose fonts
declare no `ToUnicode` CMap. Every page yields a full complement of
characters — the font's own glyph indices, landing in the dingbat and
private-use blocks — so any check for "has a text layer" says the page is
readable when none of it is. A widely distributed NCERT Class 10 Science PDF
behaves exactly this way on all 281 of its text-bearing pages.

## Decision

**Two SPIs, not one.**

- `extraction` reads what a document already carries: text layer, embedded
  raster images, its own outline, and a rasterised page as a thumbnail.
  Providers declare `deterministic=True` and the conformance suite holds them
  to it, including byte-identical thumbnails across sessions. The reference
  provider is `providers/extraction-pymupdf/`.
- `ocr` will recognise characters in page images. It is not deterministic, it
  is remote, and it is metered. It is not part of this slice.

**The routing decision is the platform's, and it is per page.** The pipeline
in `mulyankan_platform.ingestion`, never a provider, decides which pages a
deterministic extractor could read:

- a page with no text layer — `pages_without_text`;
- a page whose text layer decodes mostly to unmappable glyphs —
  `pages_with_unusable_text`, by the check in
  `ingestion.pipeline.text_is_usable`;

and reports their sum as `pages_needing_ocr`. Those are the pages the `ocr`
SPI will be given, page by page, and the counts are reported until it exists
rather than being hidden behind a status of "ready".

**Nothing is inferred.** Chapters come from the document's own table of
contents or are reported as absent (`chapter_count` is null, not zero). No
regex heuristic and no model reads structure in this slice.

## Consequences

- The cheap, deterministic, network-free path is the default, and the AI-free
  core keeps its guarantee (invariant 7): OCR arrives as a bound provider
  behind an interface, not as a branch inside extraction.
- Adding OCR changes no route and no client. `POST /sources` is already
  job-shaped and answers before extraction finishes precisely so that a slow
  provider needs no new surface.
- A book can be `ready` and still carry pages needing OCR. That is the honest
  report, and the client shows the count rather than implying full coverage.
- The garbled-text check is a threshold on character classes, so it is a
  heuristic — a deterministic one, unit-tested against real samples in
  `platform/core/tests/test_text_usability.py`. If it ever misfires on a
  script we care about, the fix is that test plus the ranges, in one place.
- `extraction` and `ocr` are not in ADR-0003's SPI table; that table is
  amended by this record rather than rewritten.

## Not decided here

- Where extraction output lives. This slice keeps an in-memory index over
  files in a workspace directory (`mulyankan_platform.sources.store`) because
  `db/` does not exist. **Ingestion therefore writes no audit events**: an
  audit event must commit in the same transaction as the state change it
  records (invariant 2), and a store with no transaction cannot honour that.
  Ingestion becomes auditable in the change that gives it a database, and
  that change is owed.
- The classification of extracted source text. It is treated as Restricted
  (DAT-01) throughout — kept out of logs, exception messages and list
  responses, and reachable only through an explicit page route — but the
  spec's own classification of source material is still unwritten.
