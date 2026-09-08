#!/usr/bin/env bash
# Trilochana secret scan wrapper for pre-commit.
#
# Trilochana ships as source/binary only (no hosted .pre-commit-hooks.yaml), so
# it is wired in as a local hook that shells out to the binary on PATH.
set -euo pipefail

if ! command -v trilochana > /dev/null 2>&1; then
  cat >&2 << 'MSG'
error: trilochana not found on PATH.

Install it, then retry:
  git clone https://github.com/miteshbsjat/trilochana.git
  cd trilochana && go mod tidy && go build -o trilochana .
  sudo mv trilochana /usr/local/bin/

(A pre-built macOS binary is shared internally if you would rather not install Go.)
MSG
  exit 1
fi

exec trilochana --min-entropy 4.0 --git-ignore=true --format text
