'use strict';

const fs = require('fs');
const path = require('path');

// The review prompt stays short by pointing at AGENTS.md rather than restating
// it — but the agent runs read-only with a small cross-file read budget, so the
// invariants (the rules that make a finding critical here) are inlined instead
// of spent on a file read.
//
// Each entry lifts one section out of a real AGENTS.md. `start`/`end` are
// heading prefixes, matched literally; if either moves, the fallback below is
// used and the review is merely thinner, never wrong.
const SECTIONS = [
  {
    file: 'AGENTS.md',
    label: 'Invariants (root AGENTS.md)',
    start: '## Invariants',
    end: '## Commands',
    maxLines: 45,
  },
  {
    file: 'apps/web/AGENTS.md',
    label: 'apps/web is an untrusted client (apps/web/AGENTS.md)',
    start: '## This app is an untrusted client',
    end: '## Load-bearing wires',
    maxLines: 20,
    // Only worth the prompt space when the PR actually touches the web app.
    when: (files) => files.some((f) => f.startsWith('apps/web/')),
  },
  {
    file: 'apps/web/AGENTS.md',
    label: 'Tatva constraints (apps/web/AGENTS.md)',
    start: '## Writing UI',
    end: '## Keeping this file true',
    maxLines: 45,
    when: (files) => files.some((f) => /^apps\/web\/.*\.(tsx|jsx|css)$/.test(f)),
  },
];

const FALLBACK = [
  '- The server state machine is authoritative — a client claim is never trusted,',
  "  including this repo's own React server components.",
  '- A state change and its audit event commit in one transaction.',
  '- Audit events are append-only, hash-chained and content-free — opaque refs and',
  '  a payload hash, never plaintext.',
  '- No path may seal, unseal, or read sealed plaintext, for any role.',
  '- No AI in the core: models only *propose* via the `gateway` SPI.',
  '- Validation is deterministic — nothing probabilistic or external on it.',
  '- No question content in logs, audit events, exception strings, or URLs.',
  '- `apps/web` is an untrusted client: no database reads, no privileged',
  '  credentials, no authorization decisions.',
  '- Tatva tokens only in UI — no raw Tailwind, no `className` on `Box`.',
];

function extractSection(workspace, { file, start, end, maxLines }) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(workspace, file), 'utf8');
  } catch {
    return '';
  }

  // Match at the start of a line, not anywhere in the text: these files discuss
  // their own headings in prose (AGENTS.md documents this very lookup), and a
  // substring match would slice from the prose mention instead of the heading.
  const lines = raw.split('\n');
  const from = lines.findIndex((line) => line.startsWith(start));
  if (from === -1) return '';

  // A missing end heading means the section runs to EOF — still usable.
  const rest = lines.slice(from + 1).findIndex((line) => line.startsWith(end));
  const to = rest === -1 ? lines.length : from + 1 + rest;

  return lines
    .slice(from, to)
    .slice(0, maxLines)
    // A lifted `## Heading` would sit at the same level as the prompt's own
    // sections and read as if it ended the cheat sheet. Demote it under the
    // `### <label>` this block is wrapped in.
    .map((line) => line.replace(/^(#{1,3}) /, '#### '))
    .join('\n')
    .trim();
}

/**
 * Build the house-rules block for the review prompt.
 *
 * @param {string} workspace repo root
 * @param {string[]} changedFiles PR file list, used to skip irrelevant sections
 */
function loadAgentsCheatSheet(workspace, changedFiles = []) {
  const blocks = [];
  const missing = [];
  for (const section of SECTIONS) {
    if (section.when && !section.when(changedFiles)) continue;
    const body = extractSection(workspace, section);
    if (body) {
      blocks.push(`### ${section.label}\n\n${body}`);
    } else {
      // The heading moved or the file did. Recoverable — the fallback still
      // states the invariants — but the caller should say so out loud, because
      // a thinner prompt means a thinner review and nothing else reveals it.
      missing.push(`${section.file} → "${section.start}"`);
    }
  }

  const content = blocks.length > 0 ? blocks.join('\n\n') : FALLBACK.join('\n');
  return {
    text: ['## House rules cheat sheet', '', content].join('\n'),
    missing,
  };
}

/**
 * Every section, ignoring the `when` filters — for the pre-commit check that
 * asserts the headings this file matches on still exist.
 */
function allSections() {
  return SECTIONS.map(({ file, label, start }) => ({ file, label, start }));
}

module.exports = { loadAgentsCheatSheet, allSections, extractSection, SECTIONS };
