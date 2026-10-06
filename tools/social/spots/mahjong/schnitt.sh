set -e
# Mahjong-Spot „Das Erbe“ schneiden: DE und EN, 15 s, 1080×1920. Siehe README.md.
cd "$(dirname "$0")"; Q=quellen
F=../../../../node_modules/ffmpeg-static/ffmpeg
N="fps=30,format=yuv420p,setsar=1"
for L in de en; do
  if [ $L = de ]; then V1=$Q/stimme-de.wav; V2=$V1; A1="0.3:3.0"
    S2="[7:a]atrim=4.0:7.95,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,adelay=10220|10220[s2]"
  else V1=$Q/stimme-en.wav; V2=$V1; A1="0.15:2.95"
    S2="[7:a]atrim=3.25:7.3,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,adelay=10270|10270[s2]"
  fi
  $F -y -loglevel error \
    -i $Q/clip-1-opa-zeigt.mp4 -i $Q/clip-2-schweben.mp4 -i $Q/clip-3-handy.mp4 \
    -i $Q/spiel-lvl18.mp4 \
    -loop 1 -t 2.6 -i $Q/endkarte-$L.png \
    -ss 21 -t 15 -i $Q/musik.mp3 \
    -i $V1 -i $V2 \
    -filter_complex "
    [0:v]scale=1080:1920:flags=lanczos,$N[a];
    [1:v]trim=0:3.6,setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,$N[b];
    [2:v]trim=0:3.6,setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,$N[c];
    [3:v]setpts=PTS-STARTPTS,scale=1080:1920,$N[d];
    [4:v]scale=1188:2112,zoompan=z='1.10-0.04*on/78':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,trim=0:2.6,setpts=PTS-STARTPTS,$N[e];
    [a][b]xfade=transition=fade:duration=0.3:offset=3.7[ab];
    [ab][c]xfade=transition=fade:duration=0.3:offset=7.0[abc];
    [abc][d]xfade=transition=fade:duration=0.3:offset=10.3[abcd];
    [abcd][e]xfade=transition=fade:duration=0.3:offset=12.4,fade=t=in:st=0:d=0.15[v];
    [5:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.3,afade=t=out:st=14.4:d=0.6,volume=0.32[m];
    [6:a]atrim=$A1,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,adelay=500|500[s1];
    $S2;
    [s1][s2]amix=inputs=2:normalize=0,apad=whole_dur=15,volume=1.6,asplit[vo][vk];
    [m][vk]sidechaincompress=threshold=0.015:ratio=12:attack=20:release=600[md];
    [md][vo]amix=inputs=2:normalize=0,atrim=0:15,loudnorm=I=-14:TP=-1.5:LRA=11[au]" \
    -map "[v]" -map "[au]" -t 15 -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart fertig/mahjong-spot-$L.mp4
  echo "fertig $L"
done
# Zweiter Lautheits-Durchgang: loudnorm in einem Durchgang landet zu leise (gemessen −14,7 / −16,3).
for L in de en; do
  J=$($F -i fertig/mahjong-spot-$L.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  g(){ echo "$J" | grep "\"$1\"" | grep -oE '[-0-9.]+'; }
  $F -y -loglevel error -i fertig/mahjong-spot-$L.mp4 -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart fertig/tmp-$L.mp4 && mv fertig/tmp-$L.mp4 fertig/mahjong-spot-$L.mp4
done
