'use strict';

const { normalizeTitle, dedupeFindings } = require('./json-utils');

/** Strip GitHub Actions log prefixes so model text is easier to match. */
function stripLogPrefixes(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^[^\t]*\t[^\t]*\t\d{4}-\d{2}-\d{2}T[^\t]*Z\s?/, ''))
    .join('\n');
}

function parseFileRef(ref) {
  const trimmed = String(ref || '')
    .trim()
    .replace(/^[`'"]+|[`'"]+$/g, '');
  const m = trimmed.match(/^([^:]+):(\d+)(?:-(\d+))?$/);
  if (m) {
    return { file: m[1].trim(), line: parseInt(m[2], 10) || 0 };
  }
  return { file: trimmed, line: 0 };
}

function parseFileWithLine(ref) {
  const trimmed = String(ref || '').trim();
  const lineMatch = trimmed.match(/^(.+?)\s+line\s+(\d+)\b/i);
  if (lineMatch) {
    return {
      file: lineMatch[1].replace(/^[`'"]+|[`'"]+$/g, ''),
      line: parseInt(lineMatch[2], 10) || 0,
    };
  }
  return parseFileRef(ref);
}

function normalizeSeverity(raw) {
  const s = String(raw || '').toLowerCase();
  if (/\bcritical\b/.test(s)) return 'critical';
  if (/\bnit\b/.test(s)) return 'nit';
  if (/\bwarning\b/.test(s)) return 'warning';
  return 'warning';
}

function inferSeverity(title, body) {
  const combined = `${title} ${body}`.toLowerCase();
  if (/\bcritical\b/.test(combined)) return 'critical';
  if (/\bnit\b/.test(combined)) return 'nit';
  if (/\bwarning\b/.test(combined)) return 'warning';
  if (/no logging|no timeout|missing test|swallows errors|silent catch/i.test(combined)) {
    return 'warning';
  }
  return 'warning';
}

/** Model thinking often lists points it later dismisses — skip those. */
function isDismissiveOrPositiveFinding(title, body) {
  const combined = `${title} ${body}`.toLowerCase();
  if (
    /\b(is fine|is good|is correct|is actually correct|which is fine|that's fine|this is fine|not a concern|isn't a concern|no real bug|no concern here|not a real bug|not really hop-by-hop)\b/.test(
      combined
    )
  ) {
    return true;
  }
  if (/^(is good|.*\bis good)$/i.test(String(title || '').trim())) {
    return true;
  }
  if (/\b(ssrf|redirect).*\b(fine|good|correct|not a concern)\b/i.test(combined)) {
    return true;
  }
  return false;
}

/** Keep markdown recovery focused on actionable issue signals. */
function looksLikeIssue(title, body) {
  const combined = `${title} ${body}`.toLowerCase();
  if (isDismissiveOrPositiveFinding(title, body)) return false;
  if (/\b(critical|warning|nit)\b/.test(combined)) return true;
  return (
    /\bno (?:[\w-]+ )*?(timeout|logging|tests?|fallback|request timeout|unit tests?)\b/.test(
      combined
    ) ||
    /\bmissing (tests?|logging|timeout|fallback)\b/.test(combined) ||
    /\bwithout (a )?(timeout|logging|tests?)\b/.test(combined) ||
    /\b(silent(ly)?|swallow(s|ed|ing)?)\b/.test(combined) ||
    /\b(inconsistent|operability|convention gap|hard 503|should (add|use|log)|must (add|use|log))\b/.test(
      combined
    )
  );
}

function pushFinding(
  findings,
  { file = '', line = 0, title, body, severity, category = 'general' }
) {
  const t = String(title || '').trim();
  const b = String(body || t).trim();
  if (!t || !looksLikeIssue(t, b)) return;
  findings.push({
    file,
    line,
    side: 'RIGHT',
    severity: severity || inferSeverity(t, b),
    category,
    title: t.length > 200 ? `${t.slice(0, 197)}...` : t,
    body: b.slice(0, 2000),
  });
}

/**
 * Recover findings from prose/markdown when JSON findings are missing or empty.
 */
function extractMarkdownFindings(text) {
  const body = stripLogPrefixes(text);
  const findings = [];

  const issueHeader = /###\s+Issue\s+\d+:\s*(?:`([^`]+)`|([^\n-]+?))\s*[-–—]\s*(.+?)(?:\n|$)/gi;
  let match;
  while ((match = issueHeader.exec(body)) !== null) {
    const fileRef = match[1] || match[2] || '';
    const title = match[3].trim().replace(/[`"]/g, '');
    const { file, line } = parseFileRef(fileRef.trim());
    pushFinding(findings, { file, line, title, body: title });
  }

  const numberedBoldTitle = /^\s*\d+\.\s+\*\*([^*]+?)\*\*:?\s*(.+)$/gim;
  while ((match = numberedBoldTitle.exec(body)) !== null) {
    const title = match[1].trim();
    const detail = match[2].trim();
    const fileLine =
      detail.match(/`([^`\n]+):(\d+)`/) ||
      title.match(/`([^`\n]+):(\d+)`/) ||
      detail.match(/([^\s`]+\.[a-z0-9]+):(\d+)/i);
    pushFinding(findings, {
      file: fileLine ? fileLine[1].trim() : '',
      line: fileLine ? parseInt(fileLine[2], 10) || 0 : 0,
      title,
      body: detail,
    });
  }

  const numberedFileLineTitle =
    /^\s*\d+\.\s+\*\*`([^`]+)`\s+line\s+(\d+)\s+(.+?)\*\*\s*[—–-]\s*(.+)$/gim;
  while ((match = numberedFileLineTitle.exec(body)) !== null) {
    const tail = match[4].trim();
    pushFinding(findings, {
      file: match[1].trim(),
      line: parseInt(match[2], 10) || 0,
      title: match[3].trim(),
      body: tail,
      severity: normalizeSeverity(tail),
    });
  }

  const numberedFileSpaceTitle = /^\s*\d+\.\s+\*\*`([^`]+)`\s+([^*]+?)\*\*\s*[—–-]\s*(.+)$/gim;
  while ((match = numberedFileSpaceTitle.exec(body)) !== null) {
    const { file, line } = parseFileWithLine(match[1]);
    pushFinding(findings, {
      file,
      line,
      title: match[2].trim(),
      body: match[3].trim(),
      severity: normalizeSeverity(match[3]),
    });
  }

  const severityLabeled =
    /^\s*\d+\.\s+\*\*(Critical|Warning|Nit)\*\*:\s*([^\s—–-]+)\s*[—–-]\s*(.+)$/gim;
  while ((match = severityLabeled.exec(body)) !== null) {
    pushFinding(findings, {
      file: match[2].trim(),
      line: 0,
      title: match[3].trim(),
      body: match[3].trim(),
      severity: normalizeSeverity(match[1]),
    });
  }

  const numberedFileTitle =
    /^\s*\d+\.\s+\*\*`([^`]+)`(?!`\s+line\s+\d+)(?:\s*[—–-]\s*)?(.+?)\*\*\s*[—–-]\s*(.+)$/gim;
  while ((match = numberedFileTitle.exec(body)) !== null) {
    const { file, line } = parseFileWithLine(match[1]);
    pushFinding(findings, {
      file,
      line,
      title: match[2].trim(),
      body: match[3].trim(),
      severity: normalizeSeverity(match[3]),
    });
  }

  const numbered =
    /^\s*\d+\.\s+\*\*`?([^*`]+?)`?\*\*\s*[—–-]\s*(.+?)(?:\.\s*`(critical|warning|nit)`\.?)?\s*$/gim;
  while ((match = numbered.exec(body)) !== null) {
    const { file, line } = parseFileWithLine(match[1]);
    let desc = match[2].trim();
    const severity = normalizeSeverity(
      match[3] || desc.match(/`(critical|warning|nit)`\s*\.?\s*$/i)?.[1]
    );
    desc = desc.replace(/\s*`(critical|warning|nit)`\s*\.?\s*$/i, '').trim();
    pushFinding(findings, { file, line, title: desc, body: desc, severity });
  }

  const inline =
    /\*\*`([^:`]+):(\d+(?:-\d+)?)`\*\*\s*[—–-]\s*(.+?)(?:\.\s*`(critical|warning|nit)`\.?)?/gi;
  while ((match = inline.exec(body)) !== null) {
    const { file, line } = parseFileRef(`${match[1]}:${match[2]}`);
    let desc = match[3].trim();
    const severity = normalizeSeverity(
      match[4] || desc.match(/`(critical|warning|nit)`\s*\.?\s*$/i)?.[1]
    );
    desc = desc.replace(/\s*`(critical|warning|nit)`\s*\.?\s*$/i, '').trim();
    pushFinding(findings, { file, line, title: desc, body: desc, severity });
  }

  const severityHeader =
    /\*\*(CRITICAL|WARNING|NIT):\s*([^*]+?)\*\*(?:\s*·\s*_([^_\n]+)_)?[^\n]*(?:\n+([\s\S]*?)(?=\n\*\*(?:CRITICAL|WARNING|NIT):|\n###\s|$))?/gi;
  while ((match = severityHeader.exec(body)) !== null) {
    const title = match[2].trim();
    const category = (match[3] || 'general').trim();
    const detail = (match[4] || title).trim();
    const fileLine =
      detail.match(/`([^`\n]+):(\d+)`/) ||
      detail.match(/([^\s`]+\.[a-z0-9]+):(\d+)/i) ||
      title.match(/`([^`\n]+):(\d+)`/);
    pushFinding(findings, {
      file: fileLine ? fileLine[1].trim() : '',
      line: fileLine ? parseInt(fileLine[2], 10) || 0 : 0,
      title: title.slice(0, 200),
      body: detail.slice(0, 2000),
      severity: normalizeSeverity(match[1]),
      category,
    });
  }

  const proseIssue =
    /\*\*(No (?:timeout|logging|request timeout)[^*]*|Missing tests?[^*]*|Error handling swallows errors[^*]*|catch block[^*]*)\*\*[:.]?\s*([^\n]+)/gi;
  while ((match = proseIssue.exec(body)) !== null) {
    pushFinding(findings, { title: match[1].trim(), body: match[2].trim() });
  }

  return dedupeFindings(findings.filter((f) => f.title && normalizeTitle(f.title).length > 0));
}

module.exports = {
  extractMarkdownFindings,
  stripLogPrefixes,
  isDismissiveOrPositiveFinding,
  looksLikeIssue,
};
