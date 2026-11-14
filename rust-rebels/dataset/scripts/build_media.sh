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

# Perseverance microphone clips, levelled so they sit together in the game.
# The recordings are quiet (the laser clip averages -54 dB), so loudness is raised; nothing else is changed.
for clip in mars_wind_supercam_sol4 mars_first_audio_sol1 rover_driving_sol16; do
  $FF -i "$RAW/audio/$clip.mp3" -af "loudnorm=I=-20:TP=-2:LRA=11" -ac 2 -ar 44100 -b:a 128k "$OUT/audio/$clip.mp3"
done
$FF -i "$RAW/audio/supercam_laser_sol12.mp3" -af "volume=13dB" -ac 2 -ar 44100 -b:a 128k "$OUT/audio/supercam_laser_sol12.mp3"
# The helicopter track is silent for its first 5 s and last 12 s; keep the flight itself for looping.
$FF -ss 8 -t 140 -i "$OUT/audio/ingenuity_flight.mp3" -af "afade=t=in:d=1.5,afade=t=out:st=138:d=2" -b:a 128k "$OUT/audio/ingenuity_flight_loop.mp3"

# Video: 720p H.264, small enough to stream from the site, with a poster frame each.
web_video() { # input output crf [extra ffmpeg args]
  in="$1"; out="$2"; crf="$3"; shift 3
  $FF -i "$in" "$@" -vf "scale=-2:720" -c:v libx264 -preset slow -crf "$crf" -pix_fmt yuv420p \
    -movflags +faststart -c:a aac -b:a 96k "$out"
  $FF -ss 3 -i "$out" -frames:v 1 -q:v 4 "${out%.mp4}.jpg"
}
web_video "$RAW/media/ingenuity_third_flight_mastcamz.mp4" "$OUT/video/ingenuity_third_flight.mp4" 27
web_video "$RAW/media/perseverance_explores_jezero_delta.mp4" "$OUT/video/jezero_delta_overview.mp4" 29

# 3D models: NASA's own glTF binaries. Rover and helicopter are unchanged.
cp "$RAW/models/25042_Perseverance.glb" "$OUT/models/perseverance.glb"
cp "$RAW/models/25043_Ingenuity_v3.glb" "$OUT/models/ingenuity.glb"
# The Z2 suit ships 4096 px textures (17 MB); 1024 px is plenty at game distance (1 MB).
python3 dataset/scripts/shrink_glb.py "$RAW/models/z2_spacesuit.glb" "$OUT/models/z2_spacesuit.glb" 1024

ls -la "$OUT/audio" "$OUT/video" "$OUT/models"
