#!/usr/bin/env bash
# Purpose: Configure this repository to use versioned git hooks in .githooks.
# Usage: ./scripts/install_git_hooks.sh
# Notes/Environment: Run from any directory; applies to the current navigator repo clone.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "${repo_root}/.git" ]]; then
  echo "Not inside a git repository root: ${repo_root}" >&2
  exit 1
fi

chmod +x "${repo_root}/.githooks/commit-msg"
git -C "${repo_root}" config core.hooksPath .githooks

echo "Git hooks installed. core.hooksPath=$(git -C "${repo_root}" config core.hooksPath)"
