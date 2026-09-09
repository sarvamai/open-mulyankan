#!/usr/bin/env node
'use strict';

// Asserts that every AGENTS.md heading the review prompt lifts still exists.
//
// The reviewer inlines the invariants by slicing sections out of the AGENTS.md
// files, matched by heading text (lib/cheat-sheet.js). Rename a heading and the
// slice silently returns nothing: the review still runs, just against a shorter
// summary — a stale-line failure of exactly the kind AGENTS.md warns about.
//
// Wired in as a pre-commit hook. Run directly with:
//   node .github/review/scripts/check-cheat-sheet.js

const path = require('path');
const { extractSection, SECTIONS } = require('./lib/cheat-sheet');

const workspace = path.resolve(__dirname, '../../..');

const broken = SECTIONS.filter((section) => !extractSection(workspace, section));

if (broken.length > 0) {
  console.error('Review cheat sheet is broken — these sections no longer resolve:\n');
  for (const { file, start, label } of broken) {
    console.error(`  ${file}: heading "${start}"  (block: ${label})`);
  }
  console.error(
    '\nEither restore the heading, or update SECTIONS in' +
      '\n.github/review/scripts/lib/cheat-sheet.js to match the new text.'
  );
  process.exit(1);
}

console.log(`Review cheat sheet OK — ${SECTIONS.length} section(s) resolve.`);
