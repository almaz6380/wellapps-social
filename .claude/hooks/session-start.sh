#!/bin/bash
# Richtet eine Cloud-Sitzung so ein, dass die Werkzeuge sofort laufen.
# Lokal tut der Hook nichts — dort sind node_modules laengst da.
#
# ⚠ Bewusst KEIN `npx playwright install`: Das Abbild der Cloud-Sitzung bringt
# unter /opt/pw-browsers ein Chromium mit, und tools/pruefbrowser.mjs wie
# tools/reels/render.mjs finden es ueber CHROMIUM_PFAD bzw. den bekannten Pfad.
# 150 MB nachzuladen waere reine Wartezeit.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

if [ ! -d node_modules ]; then
  # --ignore-scripts: ffmpeg-static laedt sein Binary im postinstall von GitHub;
  # das scheitert hinter dem Proxy der Sitzung gelegentlich und wuerde den
  # ganzen Hook abbrechen. Ohne Binary laufen alle Bild-Werkzeuge trotzdem —
  # nur ein Reel braucht ffmpeg, und der Tageslauf rendert ohnehin in GitHub Actions.
  npm install --no-audit --no-fund --silent --ignore-scripts || true
  echo "Startup-Hook: Abhaengigkeiten installiert."
fi
