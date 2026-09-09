#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadAgentsCheatSheet } = require('./lib/cheat-sheet');

const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const baseRef = process.env.BASE_REF || 'main';
const tier = process.env.TIER || 'standard';
const promptPath = path.join(workspace, '.github/review/prompt.md');

// Small PRs get the diff and the changed files inlined: the agent then spends
// its budget reasoning instead of re-running git. Bigger ones read the tree
// themselves — inlining a 600-line diff plus whole files crowds out the rules.
const PREFETCH_TIERS = new Set(['trivial', 'lite']);
const MAX_DIFF_CHARS = 120_000;
const MAX_FILE_CHARS = 8_000;
const MAX_PREFETCH_TOTAL = 80_000;

const changedFiles = (() => {
  try {
    return JSON.parse(fs.readFileSync('/tmp/full-file-list.json', 'utf8'));
  } catch {
    return [];
  }
})();

const fileList =
  changedFiles.length > 0 ? changedFiles.map((f) => `- ${f}`).join('\n') : '(unavailable)';

function loadPrefetchedContext() {
  if (!PREFETCH_TIERS.has(tier)) return '';

  const sections = [];
  try {
    const patch = fs.readFileSync('/tmp/filtered-diff.patch', 'utf8').trim();
    if (patch) {
      sections.push(
        '## Pre-fetched diff',
        '',
        'Use this diff — do not run `git diff` unless something is missing.',
        '',
        '```diff',
        patch.slice(0, MAX_DIFF_CHARS),
        '```'
      );
    }
  } catch {
    /* optional */
  }

  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync('/tmp/diff-manifest.json', 'utf8'));
  } catch {
    manifest = changedFiles.map((file) => ({ file }));
  }

  let totalChars = 0;
  const fileSections = [];
  for (const entry of manifest) {
    const file = entry.file;
    if (!file || totalChars >= MAX_PREFETCH_TOTAL) break;
    try {
      const content = fs.readFileSync(path.join(workspace, file), 'utf8');
      const slice = content.slice(0, MAX_FILE_CHARS);
      fileSections.push(`### ${file}`, '', '```', slice, '```', '');
      totalChars += slice.length;
    } catch {
      /* file may be deleted in the PR */
    }
  }

  if (fileSections.length > 0) {
    sections.push('## Pre-fetched changed files', '', ...fileSections);
  }

  return sections.length > 0 ? sections.join('\n') : '';
}

let basePrompt = '';
try {
  basePrompt = fs.readFileSync(promptPath, 'utf8').replace(/\{BASE_REF\}/g, baseRef);
} catch (e) {
  console.error(`Failed to read ${promptPath}:`, e.message);
  process.exit(1);
}

const prefetched = loadPrefetchedContext();
// Which sections appear depends on what the PR touched — see lib/cheat-sheet.js.
const cheatSheet = loadAgentsCheatSheet(workspace, changedFiles);
for (const ref of cheatSheet.missing) {
  // Annotates the run rather than failing it: a renamed heading must not stop
  // a review, but it must not pass unnoticed either.
  console.log(`::warning::Cheat-sheet section not found (${ref}) — review prompt is thinner than intended. Fix .github/review/scripts/lib/cheat-sheet.js.`);
}

const sections = [
  basePrompt.trim(),
  '',
  cheatSheet.text,
  '',
  '## PR context',
  `- Title: ${process.env.PR_TITLE || '(unknown)'}`,
  `- PR: #${process.env.PR_NUMBER || '?'}`,
  `- Base: origin/${baseRef}`,
  `- Tier: ${tier}`,
  ...(process.env.PR_BODY ? ['', '## PR intent', process.env.PR_BODY.trim()] : []),
  '',
  '## Changed files',
  fileList,
];

if (prefetched) {
  sections.push('', prefetched);
}

const prompt = sections.filter(Boolean).join('\n');
const outPath = process.env.REVIEW_PROMPT_OUT || '/tmp/review-prompt.txt';
fs.writeFileSync(outPath, prompt);
console.log(`Review prompt written (${prompt.length} chars, prefetch=${Boolean(prefetched)}) → ${outPath}`);
