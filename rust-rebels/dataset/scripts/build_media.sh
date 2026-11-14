#!/usr/bin/env sh
# Prepares audio, video and 3D models for the browser.
# Needs ffmpeg. Run from the rust-rebels folder: sh dataset/scripts/build_media.sh
set -eu
RAW="dataset/raw"
OUT="public/dataset"
mkdir -p "$OUT/audio" "$OUT/video" "$OUT/models"
FF="ffmpeg -hide_banner -loglevel error -y"

# Audio: full sound tracks. Nobody has picked loop points by ear yet.
$FF -i "$RAW/media/sounds_of_mars_no_voiceover.mp4" -vn -ac 2 -ar 44100 -b:a 128k "$OUT/audio/sounds_of_mars.mp3"
$FF -i "$RAW/media/ingenuity_flight_audio.mp4" -vn -ac 2 -ar 44100 -b:a 128k "$OUT/audio/ingenuity_flight.mp3"

# Video: 720p H.264, small enough to stream from the site, with a poster frame each.
web_video() { # input output crf [extra ffmpeg args]
  in="$1"; out="$2"; crf="$3"; shift 3
  $FF -i "$in" "$@" -vf "scale=-2:720" -c:v libx264 -preset slow -crf "$crf" -pix_fmt yuv420p \
    -movflags +faststart -c:a aac -b:a 96k "$out"
  $FF -ss 3 -i "$out" -frames:v 1 -q:v 4 "${out%.mp4}.jpg"
}
web_video "$RAW/media/ingenuity_third_flight_mastcamz.mp4" "$OUT/video/ingenuity_third_flight.mp4" 27
web_video "$RAW/media/perseverance_explores_jezero_delta.mp4" "$OUT/video/jezero_delta_overview.mp4" 29

# 3D models: NASA's own glTF binaries, unchanged.
cp "$RAW/models/25042_Perseverance.glb" "$OUT/models/perseverance.glb"
cp "$RAW/models/25043_Ingenuity_v3.glb" "$OUT/models/ingenuity.glb"

ls -la "$OUT/audio" "$OUT/video" "$OUT/models"
