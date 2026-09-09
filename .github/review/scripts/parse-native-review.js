#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {
  extractObject,
  dedupeFindings,
  sortBySeverity,
  countsFromFindings,
  riskDecisionFromCounts,
  recoverStructuredOutput,
} = require('./lib/json-utils');
const { extractMarkdownFindings } = require('./lib/markdown-findings');

const tier = process.env.TIER || '';

const raw = (() => {
  try {
    return fs.readFileSync('/tmp/native-review.txt', 'utf8').trim();
  } catch {
    return '';
  }
})();

const readOptional = (path) => {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

const log = readOptional('/tmp/native-review.log');
const stdoutLog = readOptional('/tmp/native-review-stdout.txt');
const recoveryText = [stdoutLog, log, raw].filter(Boolean).join('\n');

// A model that copies the output schema verbatim instead of filling it in
// produces one finding whose file is the placeholder from prompt.md. Match the
// placeholder exactly so a real file called `root.py` is never dropped.
const TEMPLATE_PLACEHOLDERS = new Set([
  'relative/path/from/repo/root.py',
  'relative/path/from/repo/root.ts',
  'relative/path/from/repo/root.tsx',
  'relative/path/from/repo/root',
]);

function isExactTemplatePlaceholder(f) {
  return TEMPLATE_PLACEHOLDERS.has(String(f?.file || '').trim());
}

let parsed = extractObject(raw);
let recoveredFromMarkdown = false;
let recoveredViaStructuredOutput = false;
let parseMismatch = false;

if (!parsed || !Array.isArray(parsed.findings)) {
  const recovered =
    recoverStructuredOutput(raw) ||
    recoverStructuredOutput(stdoutLog) ||
    recoverStructuredOutput(recoveryText);
  if (recovered) {
    parsed = extractObject(recovered);
    recoveredViaStructuredOutput = true;
  }
} else {
  const bestRecovered =
    recoverStructuredOutput(raw) ||
    recoverStructuredOutput(stdoutLog) ||
    recoverStructuredOutput(recoveryText);
  if (bestRecovered) {
    const best = extractObject(bestRecovered);
    if (
      best &&
      Array.isArray(best.findings) &&
      best.findings.length > (parsed.findings?.length || 0)
    ) {
      parsed = best;
      recoveredViaStructuredOutput = true;
      parseMismatch = true;
    }
  }
}

const validJson =
  parsed &&
  typeof parsed === 'object' &&
  Array.isArray(parsed.findings) &&
  typeof parsed.summary === 'string';

if (!validJson) {
  parsed = parsed && typeof parsed === 'object' ? parsed : {};
  if (!Array.isArray(parsed.findings)) parsed.findings = [];
  if (typeof parsed.summary !== 'string') parsed.summary = '';
}

const jsonFindingCount = parsed.findings.length;
// Markdown recovery is a safety net for empty/missing JSON — not a merge pass on top of
// structured findings (merging inflates counts from thinking-log prose).
const shouldRecoverFromMarkdown = !validJson || jsonFindingCount === 0;
const markdownFindings = shouldRecoverFromMarkdown ? extractMarkdownFindings(recoveryText) : [];

if (shouldRecoverFromMarkdown && markdownFindings.length > 0) {
  const merged = dedupeFindings([...parsed.findings, ...markdownFindings]);
  if (merged.length > jsonFindingCount) {
    parsed.findings = merged;
    recoveredFromMarkdown = true;
    if (validJson && jsonFindingCount === 0) {
      parseMismatch = true;
      if (!parsed.summary || parsed.summary.includes('No issues found')) {
        parsed.summary = `${merged.length} finding(s) recovered from review log (JSON had empty findings).`;
      }
      parsed.parseError = true;
    }
  }
}

if (recoveredViaStructuredOutput && !extractObject(raw)) {
  parsed.parseError = true;
  parsed.recoveredFromPartialJson = true;
}

if (!parsed || typeof parsed !== 'object') {
  parsed = { summary: 'Review output could not be parsed.', findings: [], parseError: true };
} else if (!Array.isArray(parsed.findings)) {
  parsed.findings = [];
  parsed.parseError = true;
}

const validSeverity = new Set(['critical', 'warning', 'nit']);
parsed.findings = parsed.findings
  .filter((f) => f && typeof f === 'object' && f.title)
  .map((f) => ({
    file: f.file || '',
    line: typeof f.line === 'number' ? f.line : parseInt(f.line, 10) || 0,
    side: f.side === 'LEFT' ? 'LEFT' : 'RIGHT',
    severity: validSeverity.has(f.severity) ? f.severity : 'warning',
    category: f.category || 'general',
    title: String(f.title).trim(),
    body: String(f.body || '').trim(),
  }))
  .filter((f) => f.title);

parsed.findings = dedupeFindings(parsed.findings);

const beforeTemplateFilter = parsed.findings.length;
parsed.findings = parsed.findings.filter((f) => !isExactTemplatePlaceholder(f));
const droppedByTemplate = beforeTemplateFilter - parsed.findings.length;
if (droppedByTemplate > 0) {
  console.log(`Dropped ${droppedByTemplate} schema-template placeholder finding(s)`);
}

if (parseMismatch) {
  parsed.parseMismatch = true;
}

parsed.findings = sortBySeverity(parsed.findings);
const counts = countsFromFindings(parsed.findings);
const derived = riskDecisionFromCounts(counts);
parsed.risk =
  parsed.risk && ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : derived.risk;
parsed.decision =
  parsed.decision && ['approve', 'comment', 'request_changes'].includes(parsed.decision)
    ? parsed.decision
    : derived.decision;

if (!parsed.summary || typeof parsed.summary !== 'string') {
  parsed.summary =
    parsed.findings.length === 0
      ? 'No issues found.'
      : `${parsed.findings.length} finding(s) in this PR.`;
}

fs.writeFileSync('/tmp/review-parsed.json', JSON.stringify(parsed));
fs.writeFileSync('/tmp/native-review-parsed.json', JSON.stringify(parsed));

const metrics = (() => {
  try {
    return JSON.parse(fs.readFileSync('/tmp/review-metrics.json', 'utf8'));
  } catch {
    return {};
  }
})();
metrics.tier = tier;
metrics.finalFindings = parsed.findings.length;
metrics.droppedByLedger = 0;
metrics.droppedByTemplate = droppedByTemplate;
metrics.parseError = !!parsed.parseError;
metrics.parseMismatch = !!parsed.parseMismatch;
metrics.recoveredFromMarkdown = recoveredFromMarkdown;
metrics.recoveredFromPartialJson = !!parsed.recoveredFromPartialJson;
fs.writeFileSync('/tmp/review-metrics.json', JSON.stringify(metrics, null, 2));

const out = process.env.GITHUB_OUTPUT;
if (out) {
  fs.appendFileSync(out, `has_critical=${counts.critical > 0 ? 'true' : 'false'}\n`);
  fs.appendFileSync(out, `decision=${parsed.decision}\n`);
  fs.appendFileSync(out, `risk=${parsed.risk}\n`);
}

console.log(
  `Findings: ${parsed.findings.length} (${counts.critical} critical, ${counts.warning} warning, ${counts.nit} nit); markdown recovered=${recoveredFromMarkdown}; parseMismatch=${parseMismatch}`
);
