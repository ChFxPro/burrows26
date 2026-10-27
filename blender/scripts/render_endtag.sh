#!/bin/bash
# Render the animated end tag (three.js, blender/endcard/) to an RGBA PNG sequence.
#
#   scripts/render_endtag.sh OUT_DIR [CONCEPT]      -> OUT_DIR/tag_0000.png ... (one per tag frame)
#
# Concept, start frame and length come from the "tag" block in endcard.json (concept B = Mountain
# Mark). Text (tagline, dates, "Paid for by" line) comes from the same file. Rendered headless by
# Playwright's Chromium on a frame-stepped clock, so every run gives identical frames.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: render_endtag.sh OUT_DIR [CONCEPT]}"
read -r CON START FR <<< "$(python3 -c "import json;t=json.load(open('$HERE/endcard.json'))['tag'];print(t['concept'],t['start_frame'],t['frames'])")"
CON="${2:-$CON}"
[ -d "$HERE/endcard/node_modules/three" ] || (cd "$HERE/endcard" && npm ci --no-audit --no-fund)
mkdir -p "$OUT"; rm -f "$OUT"/tag_*.png
node "$HERE/endcard/render.mjs" --concept "$CON" --out "$OUT" --start "$START"
N=$(ls "$OUT" | grep -cE '^tag_[0-9]{4}\.png$')
[ "$N" -eq "$FR" ] || { echo "end tag: expected $FR frames, got $N (concepts.js FRAMES vs endcard.json tag.frames)"; exit 1; }
