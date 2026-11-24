#!/bin/sh
# Master the film with the ffmpeg this machine has (the library's mux.sh needs ffmpeg 7+; this one runs on 6.x too):
#   sh tools/master.sh video.mp4 mix.wav out.mp4
# Two-pass loudnorm to −14 LUFS / −1.5 dBTP (linear), a 4× oversampled limiter, the audio padded to the picture's
# exact length (never cut short), a light film grain, H.264 + AAC. Prints the measured loudness of the result.
set -e
LC_ALL=C; export LC_ALL
V="$1"; A="$2"; O="$3"; FPS=30
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
M=$(ffmpeg -hide_banner -nostats -i "$A" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1)
g() { echo "$M" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p" | tail -1; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
TMP="$O.part.mp4"
ffmpeg -hide_banner -v error -y -i "$V" -i "$A" \
  -filter_complex "[0:v]fps=$FPS,noise=c0s=1:allf=t[v];[1:a]$LN,aresample=192000,alimiter=limit=0.84:attack=10:release=200:level=disabled,aresample=48000,apad,atrim=0:$DUR[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r $FPS -c:a aac -b:a 256k -movflags +faststart -t "$DUR" "$TMP"
mv "$TMP" "$O"
ffmpeg -hide_banner -nostats -i "$O" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)" | tr -s ' '
echo "$O"
