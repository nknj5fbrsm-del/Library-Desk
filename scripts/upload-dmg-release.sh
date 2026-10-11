#!/usr/bin/env bash
# Upload (or replace) the Mac DMG on the GitHub Release for the package version.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
DMG="$(ls -t release/Library\ Desk-*-arm64.dmg 2>/dev/null | head -1 || true)"

if [[ -z "${DMG}" || ! -f "${DMG}" ]]; then
  echo "Kein DMG unter release/ gefunden. Zuerst: npm run dist:mac" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI fehlt." >&2
  exit 1
fi

# Prefer GH_TOKEN; otherwise reuse git's GitHub credentials.
if [[ -z "${GH_TOKEN:-}" ]]; then
  GH_TOKEN="$(
    printf 'protocol=https\nhost=github.com\n\n' \
      | git credential fill 2>/dev/null \
      | awk -F= '/^password=/{print $2; exit}'
  )"
  export GH_TOKEN
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Kein GitHub-Token (GH_TOKEN / git credential). Upload übersprungen." >&2
  exit 1
fi

ASSET_NAME="$(basename "${DMG}")"
NOTES="Mac Desktop (arm64). Aus \`npm run release:all\` — Asset wird bei jedem Neubau ersetzt."

if gh release view "${TAG}" >/dev/null 2>&1; then
  gh release upload "${TAG}" "${DMG}" --clobber
else
  gh release create "${TAG}" "${DMG}" \
    --title "Library Desk ${VERSION}" \
    --notes "${NOTES}" \
    --latest
fi

echo "GitHub Release ${TAG}: ${ASSET_NAME} aktualisiert."
echo "https://github.com/nknj5fbrsm-del/Library-Desk/releases/tag/${TAG}"
