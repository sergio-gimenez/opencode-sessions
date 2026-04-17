#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="${HOME}/.local/bin"
TARGET="${BIN_DIR}/ocs"
LEGACY_TARGET="${BIN_DIR}/ocsessions"

mkdir -p "${BIN_DIR}"
cd "${ROOT_DIR}"

npm run build >/dev/null

cat >"${TARGET}" <<EOF
#!/usr/bin/env bash
exec node "${ROOT_DIR}/dist/cli.js" "\$@"
EOF

chmod +x "${TARGET}"
rm -f "${LEGACY_TARGET}"

printf 'Installed ocs at %s\n' "${TARGET}"
