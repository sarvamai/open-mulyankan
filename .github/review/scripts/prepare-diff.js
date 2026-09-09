#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');

const baseRef = process.env.BASE_REF;
const baseRange = `origin/${baseRef}...HEAD`;
const reviewRange = baseRange;

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const out = process.env.GITHUB_OUTPUT;
if (!out) {
  console.error('GITHUB_OUTPUT is required');
  process.exit(1);
}

// Files whose diffs are machine-authored: reviewing them burns budget and
// produces nothing. `uv.lock` and the vendored tatva tarball plus its
// SHA256SUMS are this repo's additions to the usual list — a tarball is
// unreviewable as text, and CI already verifies the checksums.
const NOISE = [
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lock|Cargo\.lock|go\.sum|poetry\.lock|Pipfile\.lock|flake\.lock|uv\.lock)$/i,
  /\.(min\.js|min\.css|bundle\.js|map|tgz)$/i,
  /(^|\/)SHA256SUMS$/,
];
const firstLines = (f) => {
  try {
    return fs.readFileSync(f, 'utf8').split('\n').slice(0, 5).join('\n');
  } catch {
    return '';
  }
};
const isNoise = (f) => NOISE.some((re) => re.test(f));
const isGenerated = (f) => {
  if (/migrations?\//i.test(f)) return false;
  return /@generated|auto-generated|do not edit/i.test(firstLines(f));
};

let fullFiles = [];
try {
  fullFiles = sh(`git diff --name-only ${baseRange}`)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  console.error('git diff (full) failed:', e.message);
}
const keptFull = fullFiles.filter((f) => !isNoise(f) && !isGenerated(f));
fs.writeFileSync('/tmp/full-file-list.json', JSON.stringify(keptFull));

let files = [];
try {
  files = sh(`git diff --name-only ${reviewRange}`)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  console.error('git diff (review) failed:', e.message);
}

const kept = files.filter((f) => !isNoise(f) && !isGenerated(f));
fs.mkdirSync('/tmp/diff', { recursive: true });

let total = 0;
const manifest = [];
const parts = [];
const changedLines = {};
const formattingOnlyFiles = [];

function linesFromPatch(patch) {
  const lines = new Set();
  let newLine = 0;
  for (const line of patch.split('\n')) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) {
      lines.add(newLine);
      newLine++;
    } else if (line.startsWith('-')) {
      // removed — no new-file line
    } else if (line.startsWith(' ') || line.startsWith('\\')) {
      lines.add(newLine);
      newLine++;
    }
  }
  return [...lines];
}

for (const f of kept) {
  let patch = '';
  try {
    patch = sh(`git diff ${reviewRange} -- "${f}"`);
  } catch {
    patch = '';
  }
  if (!patch) continue;
  let wsPatch = '';
  try {
    wsPatch = sh(`git diff -w ${reviewRange} -- "${f}"`);
  } catch {
    wsPatch = '';
  }
  if (patch && !wsPatch.trim()) {
    formattingOnlyFiles.push(f);
  }
  const added = (patch.match(/^\+(?!\+\+)/gm) || []).length;
  const removed = (patch.match(/^-(?!--)/gm) || []).length;
  total += added + removed;
  const safe = f.replace(/[^a-zA-Z0-9._-]/g, '__');
  fs.writeFileSync(`/tmp/diff/${safe}.patch`, patch);
  manifest.push({ file: f, added, removed });
  changedLines[f] = linesFromPatch(patch);
  parts.push(patch);
}
fs.writeFileSync('/tmp/changed-lines.json', JSON.stringify(changedLines));
fs.writeFileSync('/tmp/formatting-only-files.json', JSON.stringify(formattingOnlyFiles));
fs.writeFileSync('/tmp/filtered-diff.patch', parts.join('\n'));
fs.writeFileSync('/tmp/diff-manifest.json', JSON.stringify(manifest));

const fileCount = manifest.length;
const isDocsOnly = kept.every((f) => /\.(md|txt|rst)$/i.test(f) || /^(LICENSE|CHANGELOG)/i.test(f));

let tier;
if (fileCount === 0) tier = 'empty';
else if (isDocsOnly && total <= 50 && fileCount <= 5) tier = 'trivial';
else if (total <= 10 && fileCount <= 2) tier = 'trivial';
else if (total <= 200) tier = 'lite';
else if (total <= 600) tier = 'standard';
else tier = 'full';

fs.appendFileSync(out, `tier=${tier}\n`);
fs.appendFileSync(out, `skip=${tier === 'empty' ? 'true' : 'false'}\n`);
fs.appendFileSync(out, `file_count=${fileCount}\n`);
fs.appendFileSync(out, `total_lines=${total}\n`);
fs.appendFileSync(out, `formatting_only_count=${formattingOnlyFiles.length}\n`);

console.log(`Range=${reviewRange} (full PR)`);
console.log(
  `Tier=${tier} files=${fileCount} lines=${total} formatting_only=${formattingOnlyFiles.length}`
);
