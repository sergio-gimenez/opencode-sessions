#!/usr/bin/env bash
# Renders docs/demo.cast into the docs/demo.gif that the README embeds.
#
# Uses agg (https://github.com/asciinema/agg). Prefers a local binary and falls
# back to the official container image, so this works with either installed.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"

[ -f "$root/docs/demo.cast" ] || { echo "No docs/demo.cast — run demo/record.sh first." >&2; exit 1; }

args=(--theme github-dark --font-size 14 --line-height 1.35 --fps-cap 20 --idle-time-limit 2)

if command -v agg >/dev/null; then
  agg "${args[@]}" "$root/docs/demo.cast" "$root/docs/demo.gif"
elif command -v docker >/dev/null; then
  # --user keeps the rendered GIF owned by the caller rather than root.
  docker run --rm --user "$(id -u):$(id -g)" -v "$root/docs:/data" \
    ghcr.io/asciinema/agg "${args[@]}" demo.cast demo.gif
else
  echo "Need either agg or docker on PATH." >&2
  exit 1
fi

echo "Wrote docs/demo.gif ($(du -h "$root/docs/demo.gif" | cut -f1))"
