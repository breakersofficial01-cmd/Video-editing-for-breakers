#!/bin/sh
# One command: বন্দি সবুজ দানা — The Green Prisoner (Breaking Biology, Chalkboard style, 1920×1080, 30 fps)
#   sh build.sh
# Needs the Lemo-Opuscar library (core tier) at $LIB, ffmpeg, Node 20+, and this folder's .venv
# (uv venv .venv && uv pip install --python .venv/bin/python numpy pillow scikit-image scipy) for the Bangla tracer.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-$HOME/lemo-opuscar}
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
NAME=bondi-sobuj-dana
FPS=30
# the voiceover as 48 kHz WAV (the original upload is AAC)
[ -f "$HERE/src/voiceover.wav" ] || ffmpeg -v error -y -i "$HERE/src/voiceover.aac" -ar 48000 -ac 1 "$HERE/src/voiceover.wav"
# Bangla chalk handwriting: centre lines traced from the Atma font (OFL) → js/glyphs.js
"$HERE/.venv/bin/python" "$HERE/tools/trace.py" > /dev/null
cd "$LIB"
"$PY" core/audio/sampler.py --need "$HERE/mix.py"          # sample libraries first, before the long picture render
node core/render/events.mjs "$HERE"                          # events.json: strokes, voice, subtitles, cues
"$PY" "$HERE/mix.py"                                         # out/mix.wav
node core/render/video.mjs "$HERE" --fps $FPS --workers 3 --out "$HERE/out/video.mp4"
sh "$HERE/tools/master.sh" "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/$NAME.mp4"
node core/render/readcheck.mjs "$HERE" > "$HERE/out/readcheck.txt" && echo "readcheck ok" || { tail -20 "$HERE/out/readcheck.txt"; exit 1; }
"$PY" "$HERE/tools/srt.py" "$HERE/subtitles_bn.srt"
node core/render/still.mjs "$HERE" 53.2 --q nosubs --out "$HERE/out" --prefix poster_
cp "$HERE/out/poster_53.2.jpg" "$HERE/poster.jpg"
echo "done: $HERE/$NAME.mp4"
