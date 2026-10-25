#!/bin/bash
# Burrows WNC route film — render pipeline (Cycles plate -> EEVEE overlays -> comp -> MP4).
# Resumable: frames already on disk are skipped, so you can stop (Ctrl-C) and re-run anytime.
#
#   ./render_burrows.sh            everything: plate, overlays, comp, MP4
#   ./render_burrows.sh plate      Cycles plate only (the long part)
#   ./render_burrows.sh overlays   EEVEE overlays only
#   ./render_burrows.sh comp       comp + MP4 only (after plate and overlays exist)
#   ./render_burrows.sh preview    fast low-res pass of the whole timeline (long version only)
#
# Options (environment variables, combine freely):
#   CUT=30          the 30-second cut (burrows_30s.blend) instead of the long version
#   STOP_AT=06:30   stop at that time (today or tomorrow) and free the GPU; re-run to carry on
#   RANGE=528-603   only these frames (for quick tests)
#   RENDERS=/path   write somewhere other than the HeleneOYOH drive
#
#   e.g. tonight:   CUT=30 STOP_AT=06:30 ./render_burrows.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
BL=/Applications/Blender.app/Contents/MacOS/Blender
SCRIPTS="$HERE/scripts"
MODE="${1:-full}"
RENDERS="${RENDERS:-/Volumes/HeleneOYOH/Burrows Campaign 26/renders}"
if [ "$CUT" = "30" ]; then
  SCENE="$HERE/burrows_30s.blend"; COMP="$HERE/burrows_comp_30s.blend"
  OUT="$RENDERS/cut30"; PLATE="burrows30_"; MP4="burrows_30s.mp4"
else
  SCENE="$HERE/burrows_wnc_route_tour.blend"; COMP="$HERE/burrows_comp.blend"
  OUT="$RENDERS"; PLATE="burrows_"; MP4="burrows_full.mp4"
fi
[ -d "$(dirname "$RENDERS")" ] || { echo "Output drive not found: $RENDERS (is HeleneOYOH connected?)"; exit 1; }
mkdir -p "$OUT/exr" "$OUT/overlays" "$OUT/comp/frames" "$OUT/preview"
AWAKE="caffeinate -ims"   # keep the Mac from sleeping; the display may still sleep

# A frame cut short (stop time, crash) leaves an empty placeholder that would be skipped later.
clean_partial() { find "$OUT/exr" "$OUT/overlays" "$OUT/comp/frames" -type f -size 0 -delete 2>/dev/null || true; }

STOPFLAG=""
if [ -n "$STOP_AT" ]; then
  NOW=$(date +%s); T=$(date -j -f "%H:%M:%S" "$STOP_AT:00" +%s)
  [ "$T" -le "$NOW" ] && T=$((T + 86400))
  STOPFLAG="$(mktemp -u -t burrows_stop)"
  ( sleep $((T - NOW)); touch "$STOPFLAG"; pkill -f -- "-b $SCENE"; pkill -f -- "-b $COMP" ) &
  WATCH=$!
  trap 'kill $WATCH 2>/dev/null || true' EXIT
  echo "Will stop at $(date -r "$T" '+%a %H:%M')"
fi
stop_if_due() {
  if [ -n "$STOPFLAG" ] && [ -e "$STOPFLAG" ]; then
    clean_partial; rm -f "$STOPFLAG"
    echo "Stop time reached at $(date '+%H:%M'); finished frames are kept. Re-run to continue."
    exit 0
  fi
}
# run a Blender command up to 4 times (Blender's Metal shader-cache bug crashes it at random)
retry() {
  local what="$1"; shift
  for try in 1 2 3 4; do
    stop_if_due; clean_partial
    echo "-- $what (try $try) $(date '+%H:%M')"
    $AWAKE "$@" && return 0
    stop_if_due
  done
  echo "$what failed 4 times; stopping"; exit 1
}
# clip a frame range to RANGE (prints nothing if outside it)
clip() {
  local s=$1 e=$2
  if [ -n "$RANGE" ]; then
    local rs=${RANGE%-*} re=${RANGE#*-}
    [ "$s" -lt "$rs" ] && s=$rs; [ "$e" -gt "$re" ] && e=$re
  fi
  [ "$s" -le "$e" ] && echo "$s $e"
}
FIRST=1; LAST=$("$BL" -b "$SCENE" --factory-startup --python-expr "import bpy;print('LAST',bpy.context.scene.frame_end)" 2>/dev/null | sed -n 's/^LAST //p')
read -r FS FE <<< "$(clip $FIRST $LAST)"

if [ "$MODE" = "preview" ]; then
  # quarter-res Cycles, low samples, compositing on in-scene (mist/glare) -> one MP4 for timing/look review
  $AWAKE "$BL" -b "$SCENE" --python "$SCRIPTS/preview_cycles.py" -a -- "$OUT/preview/burrows_preview_"
  exit 0
fi

if [ "$MODE" = "full" ] || [ "$MODE" = "plate" ]; then
  echo "== Cycles plate (EXR multipass) =="
  if [ "$CUT" = "30" ]; then
    # the 30s intro (frames 1-119) is identical to the long version's: reuse those renders
    for f in $(seq 1 119); do
      src="$RENDERS/exr/burrows_$(printf %04d $f).exr"; dst="$OUT/exr/${PLATE}$(printf %04d $f).exr"
      [ -s "$src" ] && [ ! -s "$dst" ] && cp "$src" "$dst"
    done
  fi
  # Segments split at camera cuts and where tree visibility changes, tree keyframes frozen per
  # segment: same pixels, ~15 s less scene prep per frame.
  SEGS=$("$BL" -b "$SCENE" --factory-startup --python "$SCRIPTS/freeze_tree_visibility.py" -- list 2>/dev/null | sed -n 's/^SEGMENTS //p')
  [ -n "$SEGS" ] || { echo "Could not read tree segments"; exit 1; }
  for seg in $SEGS; do
    r=$(clip ${seg%-*} ${seg#*-}) || continue; [ -n "$r" ] || continue
    read -r S E <<< "$r"
    retry "plate $S-$E" "$BL" -b "$SCENE" --python-exit-code 1 -o "$OUT/exr/$PLATE" \
      --python "$SCRIPTS/freeze_tree_visibility.py" -a -- "$S" "$E"
  done
  stop_if_due
fi
[ "$MODE" = "plate" ] && { echo "Plate done: $OUT/exr"; exit 0; }

if [ "$MODE" = "full" ] || [ "$MODE" = "overlays" ]; then
  echo "== EEVEE overlays (labels, pins, borders, trail) =="
  retry "overlays $FS-$FE" "$BL" -b "$SCENE" --python-exit-code 1 \
    --python "$SCRIPTS/overlay_pass.py" -a -- "$OUT/overlays/ov_" "$FS" "$FE"
  stop_if_due
fi
[ "$MODE" = "overlays" ] && { echo "Overlays done: $OUT/overlays"; exit 0; }

echo "== Comp (GPU, 40-frame chunks) =="
for s in $(seq "$FS" 40 "$FE"); do
  e=$((s + 39)); [ "$e" -gt "$FE" ] && e=$FE
  retry "comp $s-$e" "$BL" -b "$COMP" --python-exit-code 1 --python "$SCRIPTS/comp_frames.py" -a -- \
    "$OUT/comp/frames/c_" "$s" "$e" "$OUT/exr/${PLATE}0001.exr" "$OUT/overlays/ov_0001.png"
done
stop_if_due
echo "== MP4 =="
NAME="$MP4"; [ -n "$RANGE" ] && NAME="${MP4%.mp4}_${FS}-${FE}.mp4"
FRAMES=(-framerate 24 -start_number "$FS" -i "$OUT/comp/frames/c_%04d.png")
ENC=(-frames:v $((FE - FS + 1)) -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart)
if [ "$CUT" = "30" ]; then
  # End card (text in endcard.json) laid over the last seconds; a clean copy is kept without it.
  CARD="$HERE/endcard/endcard.png"
  python3 "$SCRIPTS/make_endcard.py" "$CARD" >/dev/null
  read -r CS CF <<< "$(python3 -c "import json;c=json.load(open('$HERE/endcard.json'));print(c['start_seconds'],c['fade_seconds'])")"
  OFF=$(python3 -c "print(max(0.0, $CS - ($FS - 1) / 24))")   # card start, relative to this encode
  CLEAN="${NAME%.mp4}_clean.mp4"
  ffmpeg -v error -y "${FRAMES[@]}" "${ENC[@]}" "$OUT/comp/$CLEAN"
  if python3 -c "import sys; sys.exit(0 if $CS < $FE / 24 else 1)"; then
    ffmpeg -v error -y "${FRAMES[@]}" -framerate 24 -loop 1 -i "$CARD" -filter_complex \
      "[1:v]format=rgba,fade=t=in:st=$OFF:d=$CF:alpha=1[card];[0:v][card]overlay=0:0:shortest=1:format=auto" \
      "${ENC[@]}" "$OUT/comp/$NAME"
    echo "Done: $OUT/comp/$NAME (end card from ${CS}s)  +  $OUT/comp/$CLEAN (no card)"
  else
    cp "$OUT/comp/$CLEAN" "$OUT/comp/$NAME"
    echo "Done: $OUT/comp/$NAME (range ends before the end card)"
  fi
else
  ffmpeg -v error -y "${FRAMES[@]}" "${ENC[@]}" "$OUT/comp/$NAME"
  echo "Done: $OUT/comp/$NAME"
fi
