#!/usr/bin/env bash
# Encode the PNG sequence + soundtrack into the final MP4 (H.264 High, AAC, faststart).
#   showcase/render/encode.sh [fps] [output]
set -euo pipefail
cd "$(dirname "$0")/.."
FPS="${1:-30}"
OUT="${2:-task-manager-showcase.mp4}"
DUR=$(node -e "console.log(require('./audio/events.json').total)")
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -hide_banner -loglevel error -stats \
  -framerate "$FPS" -i frames/f%05d.png \
  -i audio/mix.wav \
  -filter_complex "[1:a]atrim=0:${DUR},loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=out:st=$(python3 -c "print(${DUR}-2.0)"):d=2.0[a]" \
  -map 0:v -map "[a]" \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -x264-params "keyint=60:min-keyint=30:aq-mode=3" \
  -c:a aac -b:a 224k -ar 48000 \
  -t "$DUR" -movflags +faststart "$OUT"
ls -lh "$OUT"
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate -of default=nw=1 "$OUT"
