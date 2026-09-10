#!/usr/bin/env bash
# Records the demo against the synthetic fixture and writes docs/demo.cast.
#
# Regenerating the cast needs only asciinema. Turning it into the GIF that the
# README embeds also needs agg — see demo/README.md.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"
fixture_home="$here/.fixture/home"
cast="$root/docs/demo.cast"

command -v asciinema >/dev/null || { echo "asciinema not found" >&2; exit 1; }

tsc="$root/node_modules/.bin/tsc"
[ -x "$tsc" ] || { echo "Run 'npm install' first." >&2; exit 1; }
"$tsc" -p "$root/tsconfig.json"

node "$here/build-fixtures.mjs"
mkdir -p "$root/docs"

export HOME="$fixture_home"
export OCS_DRY_RUN=1
# Nothing from the recorder's own environment should reach the recording.
unset CLAUDE_CONFIG_DIR CLAUDE_PROJECTS_PATH CODEX_HOME CODEX_SESSIONS_PATH \
      OPENCODE_DB_PATH OCS_CONFIG_PATH

node "$here/keys.mjs" | asciinema rec \
  --overwrite --quiet \
  --cols 120 --rows 32 \
  --title "ocs - one picker for OpenCode, Claude Code and Codex sessions" \
  --command "node $root/dist/cli.js" \
  "$cast"

echo "Wrote ${cast#"$root"/}"
