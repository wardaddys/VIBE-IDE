#!/usr/bin/env bash
# One-shot: clear stale lock, verify the zero-Tensora invariant, commit the
# working tree, and push to origin/main. Excludes itself from the commit and
# deletes itself on success. Run from your own terminal:  bash push.sh
set -euo pipefail
cd "$(dirname "$0")"
SELF="$(basename "$0")"

echo "[1/5] clearing stale lock + sandbox probe files"
rm -f .git/index.lock .git/.claude_write_test .claude_write_test

echo "[2/5] zero-Tensora invariant"
if grep -rniE "tensora|camofox|kali|bola_test|browser_fetch" src *.json *.yml 2>/dev/null; then
  echo "ABORT: invariant tripped — the lines above must not ship." >&2
  exit 1
fi
echo "      clean"

echo "[3/5] staging (this script excluded)"
git add -A
git reset -q -- "$SELF" 2>/dev/null || true

if git diff --cached --quiet; then
  echo "ABORT: nothing staged — already committed?" >&2
  exit 1
fi

echo "[4/5] commit"
git commit -m "Land agent kernel, background intelligence, and 4-surface UI; add .gitattributes (LF)"

echo "[5/5] push origin main"
git push origin main

echo "OK — origin/main is now $(git rev-parse --short HEAD)"
rm -f -- "$SELF"
