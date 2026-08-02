#!/usr/bin/env bash
# Runs ocs against the synthetic demo fixture instead of your real sessions.
#
# HOME points at the fixture home, so ocs finds its config, the OpenCode
# database and both Claude accounts at their normal default paths. Opening a
# session is stubbed out (OCS_DRY_RUN), so nothing is ever launched.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"
fixture_home="$here/.fixture/home"

node "$here/build-fixtures.mjs" >/dev/null

# Resolved before HOME is swapped, and run directly rather than through npx, so
# the fake home never has to hold a node/npm cache.
tsx="$root/node_modules/.bin/tsx"
[ -x "$tsx" ] || { echo "Run 'npm install' first." >&2; exit 1; }

export HOME="$fixture_home"
export OCS_DRY_RUN=1
unset CLAUDE_CONFIG_DIR CLAUDE_PROJECTS_PATH OPENCODE_DB_PATH OCS_CONFIG_PATH

exec "$tsx" "$root/src/cli.ts" "$@"
