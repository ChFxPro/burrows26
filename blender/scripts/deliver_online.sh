#!/bin/bash
# Online deliverables for the spot, from the graded comp frames (render_burrows.sh comp).
# The film is the 720-frame cut plus a held last frame, out to the end of the animated end tag
# (endcard.json "tag": starts at film frame 613, ends at 816 = 34 s).
#
#   scripts/deliver_online.sh          -> $DELIVER (default: NORTHBEND .../Deliver/cut34 when mounted,
#                                         else renders/cut30/deliver; HeleneOYOH is full)
#
#   burrows_34s_MASTER_ProRes422HQ.mov   10-bit 4:2:2 master with the end tag (edit/archive, re-encodes)
#   burrows_34s_CLEAN_ProRes422HQ.mov    same length (photos included), no end tag (for re-versioning it)
#   burrows_34s_WEB_1080p.mp4            H.264 High for YouTube / Meta / CTV upload
#   burrows_34s_PREVIEW_720p.mp4         small review copy
#
# Finish applied to all of them (same filter, same grain seed): light sharpen + fine film grain
# (grain also keeps the skies from banding after platform re-compression). Colour is Rec.709,
# video range, tagged so players don't shift it. Silent stereo 48 kHz track: platforms and
# ad managers expect audio; replace it when music / VO arrives.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
RENDERS="${RENDERS:-/Volumes/HeleneOYOH/Burrows Campaign 26/renders}"
NBROOT="/Volumes/NORTHBEND/Burrows 26"
FR="$RENDERS/cut30/comp/frames"
if [ -d "$NBROOT" ]; then OUT="${DELIVER:-$NBROOT/Deliver/cut34}"; else OUT="${DELIVER:-$RENDERS/cut30/deliver}"; fi
mkdir -p "$OUT"
N=$(ls "$FR" | grep -cE '^c_[0-9]{4}\.png$')
[ "$N" -eq 720 ] || { echo "Expected 720 comp frames, found $N"; exit 1; }

# animated end tag (three.js, endcard/) -> RGBA frames; the film is held on its last frame to the tag's end
read -r TSTART TFR <<< "$(python3 -c "import json;t=json.load(open('$HERE/endcard.json'))['tag'];print(t['start_frame'],t['frames'])")"
TOTAL=$((TSTART + TFR - 1)); HOLD=$((TOTAL - N)); SECS=$(python3 -c "print($TOTAL/24)")
NAME="burrows_$(python3 -c "print(round($TOTAL/24))")s"
if [ -d "$NBROOT" ]; then TAG="${ENDTAG_DIR:-$NBROOT/Endtag/endtag}"; else TAG="${ENDTAG_DIR:-$HOME/Burrows Renders/endtag}"; fi
"$HERE/scripts/render_endtag.sh" "$TAG"
echo "== $NAME: $TOTAL frames ($SECS s), comp held $HOLD frames, end tag from frame $TSTART -> $OUT"
# campaign photos as physical prints over the film: photos.json -> print textures -> three.js build
# (photo3d/, lit, shadowed, headless GPU) -> transparent layer. The layer is ~1 GB, so it lives on
# the NORTHBEND work drive when it's mounted (HeleneOYOH is full); PHOTO_LAYER overrides.
python3 "$HERE/scripts/make_photo_prints.py" >/dev/null
NB="/Volumes/NORTHBEND/Burrows 26/Photo campaign extend"
if [ -d "$NB" ]; then PH="${PHOTO_LAYER:-$NB/photo3d_layer}"; else PH="${PHOTO_LAYER:-$RENDERS/cut30/photos}"; fi
[ -d "$HERE/photo3d/node_modules/three" ] || (cd "$HERE/photo3d" && npm install --no-audit --no-fund)
node "$HERE/photo3d/render.mjs" "$PH" | grep -v '^frame' 

FINISH="unsharp=5:5:0.35:3:3:0,noise=c0s=3:c1s=2:c2s=2:allf=t"
TAGS=(-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv)
TO709="scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
IN=(-framerate 24 -start_number 1 -i "$FR/c_%04d.png" -framerate 24 -start_number 1 -i "$PH/ph_%04d.png")
SILENT=(-f lavfi -t "$SECS" -i anullsrc=r=48000:cl=stereo)
TAGIN=(-framerate 24 -start_number 0 -i "$TAG/tag_%04d.png")
# comp held on its last frame; the photo layer (empty by then) holds its last frame too
PHOTOS="[0:v]tpad=stop_mode=clone:stop=$HOLD[base];[base][1:v]overlay=0:0:format=auto:eof_action=repeat"
WITH_CARD="[2:v]format=rgba,tpad=start=$((TSTART - 1)):color=black@0[c];$PHOTOS[f];[f][c]overlay=0:0:format=auto,$FINISH"

echo "== master (ProRes 422 HQ, end tag)"
ffmpeg -v error -y "${IN[@]}" "${TAGIN[@]}" "${SILENT[@]}" -filter_complex "$WITH_CARD,$TO709,format=yuv422p10le[v]" \
  -map "[v]" -map 3:a -frames:v $TOTAL -c:v prores_ks -profile:v 3 -vendor apl0 -bits_per_mb 8000 "${TAGS[@]}" \
  -c:a pcm_s24le -shortest "$OUT/${NAME}_MASTER_ProRes422HQ.mov"
echo "== clean master (no end tag)"
ffmpeg -v error -y "${IN[@]}" "${SILENT[@]}" -filter_complex "$PHOTOS,$FINISH,$TO709,format=yuv422p10le[v]" \
  -map "[v]" -map 2:a -frames:v $TOTAL -c:v prores_ks -profile:v 3 -vendor apl0 -bits_per_mb 8000 "${TAGS[@]}" \
  -c:a pcm_s24le -shortest "$OUT/${NAME}_CLEAN_ProRes422HQ.mov"
echo "== web (H.264 1080p from the master)"
ffmpeg -v error -y -i "$OUT/${NAME}_MASTER_ProRes422HQ.mov" -c:v libx264 -preset slow -crf 14 -maxrate 30M -bufsize 60M \
  -profile:v high -level 4.2 -pix_fmt yuv420p -g 48 -bf 2 "${TAGS[@]}" -c:a aac -b:a 192k -movflags +faststart \
  "$OUT/${NAME}_WEB_1080p.mp4"
echo "== preview (720p)"
ffmpeg -v error -y -i "$OUT/${NAME}_MASTER_ProRes422HQ.mov" -vf "scale=1280:-2:flags=lanczos" -c:v libx264 -preset slow \
  -b:v 5M -maxrate 6M -bufsize 10M -pix_fmt yuv420p "${TAGS[@]}" -c:a aac -b:a 128k -movflags +faststart \
  "$OUT/${NAME}_PREVIEW_720p.mp4"
ls -lh "$OUT"
