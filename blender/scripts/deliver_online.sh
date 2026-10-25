#!/bin/bash
# Online deliverables for the 30-second spot, from the graded comp frames (render_burrows.sh comp).
#
#   scripts/deliver_online.sh          -> renders/cut30/deliver/
#
#   burrows_30s_MASTER_ProRes422HQ.mov   10-bit 4:2:2 master, end card (edit/archive, re-encodes)
#   burrows_30s_CLEAN_ProRes422HQ.mov    same, no end card (for re-versioning the card)
#   burrows_30s_WEB_1080p.mp4            H.264 High for YouTube / Meta / CTV upload
#   burrows_30s_PREVIEW_720p.mp4         small review copy
#
# Finish applied to all of them (same filter, same grain seed): light sharpen + fine film grain
# (grain also keeps the skies from banding after platform re-compression). Colour is Rec.709,
# video range, tagged so players don't shift it. Silent stereo 48 kHz track: platforms and
# ad managers expect audio; replace it when music / VO arrives.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
RENDERS="${RENDERS:-/Volumes/HeleneOYOH/Burrows Campaign 26/renders}"
FR="$RENDERS/cut30/comp/frames"; OUT="$RENDERS/cut30/deliver"; mkdir -p "$OUT"
N=$(ls "$FR" | grep -cE '^c_[0-9]{4}\.png$')
[ "$N" -eq 720 ] || { echo "Expected 720 comp frames, found $N"; exit 1; }

CARD="$HERE/endcard/endcard.png"
python3 "$HERE/scripts/make_endcard.py" "$CARD" >/dev/null
read -r CS CF <<< "$(python3 -c "import json;c=json.load(open('$HERE/endcard.json'));print(c['start_seconds'],c['fade_seconds'])")"

FINISH="unsharp=5:5:0.35:3:3:0,noise=c0s=3:c1s=2:c2s=2:allf=t"
TAGS=(-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv)
TO709="scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
IN=(-framerate 24 -start_number 1 -i "$FR/c_%04d.png")
SILENT=(-f lavfi -t 30 -i anullsrc=r=48000:cl=stereo)
CARDIN=(-framerate 24 -loop 1 -t 30 -i "$CARD")
WITH_CARD="[1:v]format=rgba,fade=t=in:st=$CS:d=$CF:alpha=1[c];[0:v][c]overlay=0:0:format=auto,$FINISH"

echo "== master (ProRes 422 HQ, end card)"
ffmpeg -v error -y "${IN[@]}" "${CARDIN[@]}" "${SILENT[@]}" -filter_complex "$WITH_CARD,$TO709,format=yuv422p10le[v]" \
  -map "[v]" -map 2:a -frames:v 720 -c:v prores_ks -profile:v 3 -vendor apl0 -bits_per_mb 8000 "${TAGS[@]}" \
  -c:a pcm_s24le -shortest "$OUT/burrows_30s_MASTER_ProRes422HQ.mov"
echo "== clean master (no end card)"
ffmpeg -v error -y "${IN[@]}" "${SILENT[@]}" -filter_complex "[0:v]$FINISH,$TO709,format=yuv422p10le[v]" \
  -map "[v]" -map 1:a -frames:v 720 -c:v prores_ks -profile:v 3 -vendor apl0 -bits_per_mb 8000 "${TAGS[@]}" \
  -c:a pcm_s24le -shortest "$OUT/burrows_30s_CLEAN_ProRes422HQ.mov"
echo "== web (H.264 1080p from the master)"
ffmpeg -v error -y -i "$OUT/burrows_30s_MASTER_ProRes422HQ.mov" -c:v libx264 -preset slow -crf 14 -maxrate 30M -bufsize 60M \
  -profile:v high -level 4.2 -pix_fmt yuv420p -g 48 -bf 2 "${TAGS[@]}" -c:a aac -b:a 192k -movflags +faststart \
  "$OUT/burrows_30s_WEB_1080p.mp4"
echo "== preview (720p)"
ffmpeg -v error -y -i "$OUT/burrows_30s_MASTER_ProRes422HQ.mov" -vf "scale=1280:-2:flags=lanczos" -c:v libx264 -preset slow \
  -b:v 5M -maxrate 6M -bufsize 10M -pix_fmt yuv420p "${TAGS[@]}" -c:a aac -b:a 128k -movflags +faststart \
  "$OUT/burrows_30s_PREVIEW_720p.mp4"
ls -lh "$OUT"
