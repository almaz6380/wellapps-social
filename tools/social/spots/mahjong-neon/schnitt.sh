set -e
# Mahjong-Spot „Neonstreit“ schneiden: DE und EN, 15 s, 1080×1920. Siehe README.md.
cd "$(dirname "$0")"; Q=quellen; M=../mahjong/quellen   # Spielszene und Musik teilt er mit „Das Erbe“
F=../../../../node_modules/ffmpeg-static/ffmpeg
N="fps=30,format=yuv420p,setsar=1,settb=1/30"
K="scale=-2:1920:flags=lanczos,crop=1080:1920"   # Grok liefert 416×720, minimal breiter als 9:16
T=15.0
for L in de en; do
  if [ $L = de ]; then D2=12000; else D2=12500; fi
  $F -y -loglevel error \
    -i $Q/clip-1.mp4 -i $Q/clip-2.mp4 -i $Q/clip-3.mp4 -i $M/spiel-lvl18.mp4 \
    -loop 1 -t 3.4 -i $Q/endkarte-$L.png \
    -ss 5 -t $T -i $M/musik.mp3 \
    -i $Q/vo-$L-0.wav -i $Q/vo-$L-1.wav -i $Q/vo-$L-2.wav \
    -i $Q/whoosh.aac -i $Q/whoosh.aac \
    -filter_complex "
    [0:v]trim=0:3.5,setpts=PTS-STARTPTS,$K,$N[a];
    [1:v]trim=0.4:3.9,setpts=PTS-STARTPTS,$K,$N[b];
    [2:v]trim=1.0:4.4,setpts=PTS-STARTPTS,$K,$N[c];
    [3:v]setpts=PTS-STARTPTS,scale=1080:1920,$N[d];
    [4:v]scale=1188:2112,zoompan=z='1.10-0.04*on/102':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,trim=0:3.4,setpts=PTS-STARTPTS,$N[e];
    [a][b]xfade=transition=fade:duration=0.3:offset=3.2[ab];
    [ab][c]xfade=transition=fade:duration=0.3:offset=6.4[abc];
    [abc][d]xfade=transition=fade:duration=0.3:offset=9.5[abcd];
    [abcd][e]xfade=transition=fade:duration=0.3:offset=11.6,fade=t=in:st=0:d=0.15[v];
    [5:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.3,afade=t=out:st=14.3:d=0.7,volume=0.32[m];
    [6:a]aresample=48000,aformat=channel_layouts=stereo,adelay=500|500[s0];
    [7:a]aresample=48000,aformat=channel_layouts=stereo,adelay=4600|4600[s1];
    [8:a]aresample=48000,aformat=channel_layouts=stereo,adelay=$D2|$D2[s2];
    [s0][s1][s2]amix=inputs=3:normalize=0,apad=whole_dur=$T,volume=1.6,asplit[vo][vk];
    [9:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.35,adelay=3050|3050[x1];
    [10:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.35,adelay=9350|9350[x2];
    [x1][x2]amix=inputs=2:normalize=0,apad=whole_dur=$T[fx];
    [m][vk]sidechaincompress=threshold=0.015:ratio=12:attack=20:release=600[md];
    [md][fx][vo]amix=inputs=3:normalize=0,atrim=0:$T,loudnorm=I=-14:TP=-1.5:LRA=11[au]" \
    -map "[v]" -map "[au]" -t $T -c:v libx264 -preset slow -crf 20 -profile:v high -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart fertig/mahjong-neon-$L.mp4
  echo "fertig $L"
done
# Zweiter Lautheits-Durchgang (ein Durchgang landet zu leise, siehe „Das Erbe“).
for L in de en; do
  J=$($F -i fertig/mahjong-neon-$L.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  g(){ echo "$J" | grep "\"$1\"" | grep -oE '[-0-9.]+'; }
  $F -y -loglevel error -i fertig/mahjong-neon-$L.mp4 -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart fertig/tmp-$L.mp4 && mv fertig/tmp-$L.mp4 fertig/mahjong-neon-$L.mp4
done
