#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${BASE_REF:?BASE_REF required}"
PR_TITLE="${PR_TITLE:-PR review}"
TIER="${TIER:-standard}"
REVIEW_MODEL="${REVIEW_MODEL:-glm-5.3}"
REVIEW_REASONING_EFFORT="${REVIEW_REASONING_EFFORT:-high}"
TIMEOUT_SEC="${REVIEW_TIMEOUT_SEC:-1800}"

case "${TIER}" in
  trivial|lite)
    if [ "${REVIEW_TIMEOUT_SEC:-1800}" = "1800" ]; then
      TIMEOUT_SEC=600
    fi
    ;;
esac
PROMPT_FILE="${REVIEW_PROMPT_OUT:-/tmp/review-prompt.txt}"
OUTPUT_FILE="/tmp/native-review.txt"
LOG_FILE="/tmp/native-review.log"
STDOUT_LOG="/tmp/native-review-stdout.txt"
METRICS_FILE="/tmp/review-metrics.json"

export PATH="${HOME}/.local/bin:${PATH}"

run_review() {
  # sarvam-code disallows --base together with a custom [PROMPT]; the prompt instructs
  # the agent to run git diff origin/${BASE_REF}...HEAD against the checked-out PR head.
  # Prose findings stream to stdout; --log-file may not include them — tee for recovery.
  : > "${STDOUT_LOG}"
  # `model` is a per-slug config table; the session slug is `default_model` (and `-m`).
  # `--ignore-user-config` skips a stale runner ~/.sarvam/config.toml.
  timeout "${TIMEOUT_SEC}" sarvam-code exec review \
    -m "${REVIEW_MODEL}" \
    -c "default_model=\"${REVIEW_MODEL}\"" \
    -c approval_policy=never \
    -c sandbox_mode=read-only \
    -c "default_reasoning_effort=${REVIEW_REASONING_EFFORT}" \
    --ephemeral \
    --ignore-user-config \
    --title "${PR_TITLE}" \
    -o "${OUTPUT_FILE}" \
    --log-file "${LOG_FILE}" \
    - < "${PROMPT_FILE}" 2>&1 | tee "${STDOUT_LOG}"
}

START=$(date +%s)
set +e
run_review
EXIT=${PIPESTATUS[0]}
set -e
END=$(date +%s)
DURATION=$((END - START))

TIMED_OUT=false
if [ "${EXIT}" -eq 124 ]; then
  TIMED_OUT=true
  echo "::warning::Native review timed out after ${TIMEOUT_SEC}s — parsing partial output"
fi

# Merge stdout into log for downstream recovery (log-file alone is often JSON-only).
if [ -s "${STDOUT_LOG}" ]; then
  echo "" >> "${LOG_FILE}"
  echo "===== sarvam-code stdout =====" >> "${LOG_FILE}"
  cat "${STDOUT_LOG}" >> "${LOG_FILE}"
fi

# Recover output if -o is empty
if [ ! -s "${OUTPUT_FILE}" ]; then
  echo "::warning::Review -o file empty; recovering from log"
  for src in "${STDOUT_LOG}" "${LOG_FILE}"; do
    if [ -s "${src}" ]; then
      node "$(dirname "$0")/recover-native-output.js" "${src}" "${OUTPUT_FILE}" && break
    fi
  done || true
fi

count_findings() {
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  node -e "
    const fs = require('fs');
    const { extractObject } = require('${SCRIPT_DIR}/lib/json-utils');
    try {
      const raw = fs.readFileSync('${OUTPUT_FILE}', 'utf8');
      const p = extractObject(raw);
      console.log(Array.isArray(p?.findings) ? p.findings.length : 0);
    } catch { console.log(0); }
  "
}

FINDING_COUNT=$(count_findings)

# Retry once only if the run finished suspiciously fast with zero findings (likely silent failure).
# Do NOT retry on timeout — that doubles wall time to ~20 min with little benefit.
if [ "${FINDING_COUNT}" -eq 0 ] && [ "${DURATION}" -lt 60 ] && [ "${TIMED_OUT}" = false ] && [ "${EXIT}" -eq 0 ]; then
  echo "::warning::Review finished in ${DURATION}s with 0 findings — retrying once"
  START=$(date +%s)
  TIMED_OUT=false
  set +e
  run_review
  EXIT=${PIPESTATUS[0]}
  set -e
  END=$(date +%s)
  DURATION=$((END - START))
  if [ "${EXIT}" -eq 124 ]; then
    TIMED_OUT=true
  fi
  FINDING_COUNT=$(count_findings)
  if [ -s "${STDOUT_LOG}" ]; then
    echo "" >> "${LOG_FILE}"
    echo "===== sarvam-code stdout (retry) =====" >> "${LOG_FILE}"
    cat "${STDOUT_LOG}" >> "${LOG_FILE}"
  fi
  if [ ! -s "${OUTPUT_FILE}" ]; then
    for src in "${STDOUT_LOG}" "${LOG_FILE}"; do
      if [ -s "${src}" ]; then
        node "$(dirname "$0")/recover-native-output.js" "${src}" "${OUTPUT_FILE}" && break
      fi
    done || true
  fi
  FINDING_COUNT=$(count_findings)
fi

node -e "
const fs = require('fs');
const m = {
  nativeReview: true,
  durationSec: ${DURATION},
  timedOut: ${TIMED_OUT},
  exitCode: ${EXIT},
  model: process.env.REVIEW_MODEL || '${REVIEW_MODEL}',
  findingCount: ${FINDING_COUNT},
};
// Current run wins — never let stale /tmp metrics from a prior job overwrite these fields.
let prev = {};
try { prev = JSON.parse(fs.readFileSync('${METRICS_FILE}', 'utf8')); } catch {}
fs.writeFileSync('${METRICS_FILE}', JSON.stringify({ ...prev, ...m }, null, 2));
"

if [ "${EXIT}" -ne 0 ] && [ "${EXIT}" -ne 124 ]; then
  echo "::error::sarvam-code exec review failed with exit ${EXIT}"
  exit "${EXIT}"
fi

echo "Native review complete in ${DURATION}s (timedOut=${TIMED_OUT})"
