#!/usr/bin/env bash
# Install the repo's pre-commit hooks.
#
# Handles the machine-wide-hook case: if `core.hooksPath` is set globally,
# `pre-commit install` refuses to run ("Cowardly refusing to install hooks with
# core.hooksPath set"). In that case the global hook is expected to chain this
# repo's .pre-commit-config.yaml itself.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v pre-commit > /dev/null 2>&1; then
  echo "error: pre-commit not found. Install it with one of:"
  echo "  brew install pre-commit"
  echo "  pip install --user pre-commit"
  exit 1
fi

missing=0
check_tool() {
  command -v "$1" > /dev/null 2>&1 && return 0
  echo "error: $1 not found on PATH — $2"
  missing=1
}

check_tool gitleaks "brew install gitleaks (or a release binary from https://github.com/gitleaks/gitleaks/releases)"
check_tool trivy "brew install trivy (https://trivy.dev)"
check_tool trilochana "build from https://github.com/miteshbsjat/trilochana, or use the internally shared macOS binary"

if [ "$missing" -ne 0 ]; then
  echo
  echo "Install the tools above first — the hooks fail without them."
  exit 1
fi

# Trivy refuses `--skip-db-update` on a cold cache, so prime the DB once here.
# This is a no-op when the local DB is already current. Refresh it out of band
# (e.g. a weekly `trivy image --download-db-only`) rather than per commit.
echo "Ensuring the Trivy vulnerability DB is present..."
trivy image --download-db-only

hooks_path="$(git config --get core.hooksPath || true)"

if [ -n "$hooks_path" ]; then
  echo "core.hooksPath is set to '$hooks_path' (machine-wide hooks)."
  echo "Not running 'pre-commit install' — it would refuse anyway."
  echo
  echo "Make sure your global hook chains repo-local configs, i.e. that"
  echo "$hooks_path/pre-commit contains:"
  echo
  echo '  if [ -f ".pre-commit-config.yaml" ]; then'
  echo '    pre-commit run --hook-stage pre-commit'
  echo '  fi'
  echo
  echo "Verifying this repo's config runs cleanly:"
  pre-commit run --all-files
  exit $?
fi

pre-commit install --hook-type pre-commit --hook-type pre-push
echo "Installed. Run './scripts/install-hooks.sh' again after changing .pre-commit-config.yaml."
