'use strict';

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (_) {}
  try {
    const repaired = str.replace(/[\x00-\x1f]/g, (ch) =>
      ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : ''
    );
    return JSON.parse(repaired);
  } catch (_) {}
  return null;
}

function extractObject(raw) {
  if (!raw || !String(raw).trim()) return null;
  let cleaned = String(raw)
    .trim()
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const whole = tryParseJSON(cleaned);
  if (whole) return whole;

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const obj = tryParseJSON(cleaned.slice(first, last + 1));
    if (obj) return obj;
  }
  return null;
}

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeFindings(findings) {
  const seen = new Set();
  const out = [];
  for (const f of findings) {
    const key = `${f.file || ''}::${f.line || 0}::${normalizeTitle(f.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function sortBySeverity(findings) {
  const order = { critical: 0, warning: 1, nit: 2 };
  return [...findings].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
}

function countsFromFindings(findings) {
  const counts = { critical: 0, warning: 0, nit: 0 };
  for (const f of findings) {
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  }
  return counts;
}

function riskDecisionFromCounts(counts) {
  if (counts.critical > 0) return { risk: 'high', decision: 'request_changes' };
  if (counts.warning > 0) return { risk: 'medium', decision: 'comment' };
  return { risk: 'low', decision: 'approve' };
}

const COORDINATOR_SUMMARY_LEAK =
  /^(let me |i('|')ll |i need to |looking at |first,|wait,|ok,? |okay,? |hmm)/i;

function isValidCoordinatorOutput(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.findings)) return false;
  if (typeof obj.summary !== 'string' || !obj.summary.trim()) return false;
  if (!['low', 'medium', 'high'].includes(obj.risk)) return false;
  if (!['approve', 'comment', 'request_changes'].includes(obj.decision)) return false;
  if (obj.summary.length > 400) return false;
  if (COORDINATOR_SUMMARY_LEAK.test(obj.summary.trim())) return false;
  for (const f of obj.findings) {
    if (!f || typeof f !== 'object') return false;
    if (!['critical', 'warning', 'nit'].includes(f.severity)) return false;
  }
  return true;
}

function buildDeterministicMerge(findings, tierLabel) {
  const merged = sortBySeverity(dedupeFindings(findings));
  const counts = countsFromFindings(merged);
  const { risk, decision } = riskDecisionFromCounts(counts);
  const summary =
    merged.length === 0
      ? 'No issues found.'
      : `${merged.length} finding(s) from specialist review (${tierLabel} tier — deterministic merge).`;
  return { summary, risk, decision, findings: merged };
}

function extractBalancedJson(text, start) {
  if (!text || start < 0 || text[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Pull complete finding objects from truncated JSON (e.g. timeout mid-stream). */
function extractFindingObjects(text) {
  if (!text) return [];
  const findings = [];
  const seen = new Set();
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const fileIdx = text.indexOf('"file"', searchFrom);
    if (fileIdx === -1) break;
    const objStart = text.lastIndexOf('{', fileIdx);
    if (objStart === -1 || objStart < searchFrom) {
      searchFrom = fileIdx + 6;
      continue;
    }
    const balanced = extractBalancedJson(text, objStart);
    if (!balanced) {
      searchFrom = fileIdx + 6;
      continue;
    }
    const obj = extractObject(balanced);
    if (obj && obj.title && obj.file) {
      const key = `${obj.file}::${obj.line || 0}::${normalizeTitle(obj.title)}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push(obj);
      }
    }
    searchFrom = objStart + balanced.length;
  }
  return findings;
}

function extractSummaryFromChunk(chunk) {
  const m = chunk.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return m[1];
  }
}

function stripLogPrefixes(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^[^\t]*\t[^\t]*\t\d{4}-\d{2}-\d{2}T[^\t]*Z\s?/, ''))
    .join('\n');
}

/** Recover JSON from ```json fences, including unclosed fences after timeout. */
function recoverFromJsonFences(log) {
  if (!log) return null;
  const body = stripLogPrefixes(log);
  const chunks = [];
  const fenceRe = /```json\s*([\s\S]*?)(?:```|$)/gi;
  let m;
  while ((m = fenceRe.exec(body)) !== null) {
    if (m[1]?.trim()) chunks.push(m[1].trim());
  }

  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    const whole = extractObject(chunk);
    if (whole && Array.isArray(whole.findings)) {
      return JSON.stringify(whole);
    }
    const findings = extractFindingObjects(chunk);
    if (findings.length > 0) {
      const summary =
        extractSummaryFromChunk(chunk) ||
        `${findings.length} finding(s) recovered from partial JSON.`;
      return JSON.stringify({ summary, findings });
    }
  }
  return null;
}

function repairTruncatedReviewJson(log) {
  if (!log) return null;
  const body = stripLogPrefixes(log);
  const markers = ['{"summary"', '"summary":', '{\n  "summary"'];
  for (const marker of markers) {
    let idx = body.lastIndexOf(marker);
    while (idx !== -1) {
      const braceStart = body.indexOf('{', idx);
      if (braceStart !== -1) {
        const balanced = extractBalancedJson(body, braceStart);
        if (balanced) {
          const obj = extractObject(balanced);
          if (obj && Array.isArray(obj.findings)) return JSON.stringify(obj);
        }
        const slice = body.slice(braceStart);
        const findings = extractFindingObjects(slice);
        if (findings.length > 0) {
          const summary =
            extractSummaryFromChunk(slice) ||
            `${findings.length} finding(s) recovered from truncated JSON.`;
          return JSON.stringify({ summary, findings });
        }
      }
      idx = body.lastIndexOf(marker, idx - 1);
    }
  }
  return null;
}

/** Collect all review JSON blobs from log text. */
function collectReviewJsonCandidates(log, { requiredKeys = ['findings'] } = {}) {
  if (!log) return [];

  const matches = (obj) => obj && typeof obj === 'object' && requiredKeys.every((k) => k in obj);

  const tryCandidate = (candidate) => {
    if (!candidate) return null;
    const obj = extractObject(candidate);
    return matches(obj) ? obj : null;
  };

  const seen = new Set();
  const candidates = [];

  const addObj = (obj) => {
    if (!obj || !Array.isArray(obj.findings)) return;
    const key = JSON.stringify({ summary: obj.summary, findings: obj.findings });
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(obj);
  };

  const fenced = recoverFromJsonFences(log);
  if (fenced) addObj(tryCandidate(fenced));

  const partial = repairTruncatedReviewJson(log);
  if (partial) addObj(tryCandidate(partial));

  const markers = ['{"thought_process"', '{"summary"', '{"findings"'];
  for (const marker of markers) {
    let idx = 0;
    while ((idx = log.indexOf(marker, idx)) !== -1) {
      const balanced = extractBalancedJson(log, idx);
      addObj(tryCandidate(balanced) || tryCandidate(log.slice(idx)));
      idx += marker.length;
    }
  }

  for (const line of String(log).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    addObj(tryCandidate(trimmed));
  }

  return candidates;
}

/** Recover structured JSON — prefer the blob with the most findings. */
function recoverStructuredOutput(log, { requiredKeys = ['findings'] } = {}) {
  const candidates = collectReviewJsonCandidates(log, { requiredKeys });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const diff = (b.findings?.length || 0) - (a.findings?.length || 0);
    if (diff !== 0) return diff;
    return String(b.summary || '').length - String(a.summary || '').length;
  });

  return JSON.stringify(candidates[0]);
}

const TEMPLATE_PHRASES = [
  'short one-line summary',
  'markdown explanation and fix',
  'one or two sentences on overall pr quality and risk',
  'relative/path/from/repo/root',
];

function containsTemplatePhrase(text) {
  const norm = normalizeTitle(text);
  return TEMPLATE_PHRASES.some((phrase) => norm.includes(phrase));
}

function isTemplateFinding(f) {
  if (!f || typeof f !== 'object') return true;
  const file = String(f.file || '').trim();
  if (file === 'relative/path/from/repo/root.tsx' || file === 'relative/path/from/repo/root') {
    return true;
  }
  if (containsTemplatePhrase(f.title) || containsTemplatePhrase(f.body)) return true;
  return false;
}

function isTemplateSummary(summary) {
  return containsTemplatePhrase(summary);
}

module.exports = {
  tryParseJSON,
  extractObject,
  normalizeTitle,
  dedupeFindings,
  sortBySeverity,
  countsFromFindings,
  riskDecisionFromCounts,
  isValidCoordinatorOutput,
  buildDeterministicMerge,
  recoverStructuredOutput,
  recoverFromJsonFences,
  repairTruncatedReviewJson,
  extractFindingObjects,
  isTemplateFinding,
  isTemplateSummary,
};
