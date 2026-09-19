// Aus den Folien eines Karussells ein Diashow-Video machen.
//
// --- Warum es das gibt -------------------------------------------------------
//
// TikTok nimmt Fotos und Videos auf zwei grundverschiedenen Wegen entgegen:
//
//   Video  FILE_UPLOAD    — wir laden die Bytes hoch. TikTok braucht keine
//                           Adresse, also auch keine Verifizierung.
//   Foto   PULL_FROM_URL  — es GIBT keinen Upload. TikTok holt die Bilder
//                           selbst ab, und das Praefix ihrer Adresse muss im
//                           Entwicklerportal verifiziert sein.
//
// Genau daran ist der erste Karussell-Versuch am 19.09.2026 gescheitert
// (`url_ownership_unverified`), waehrend das taegliche Reel seit Wochen
// anstandslos im Posteingang landet. Der Posteingang war nie das Problem —
// die Bilder kamen gar nicht erst dort an.
//
// Aus derselben Tabelle folgt der Ausweg: Sind die Folien ein Video, ist es
// ein Upload. Kein Portal, kein Praefix, keine Wartezeit.
//
// ⚠ Das ist kein gleichwertiger Ersatz, sondern ein anderer Beitragstyp. Beim
// Karussell wischt man selbst, hier laeuft es von allein. Auf TikTok ist das
// eher ein Vorteil (Watchtime), auf Instagram waere es einer weniger —
// deshalb bekommt NUR TikTok das Video, Instagram und Facebook behalten das
// echte Karussell.
//
// ⚠ Ohne Ton. Die Regel `tonspur_muss_leer_sein` gilt hier wie beim Reel:
// Musik legt ein Mensch in der App darueber, passend zu dem, was gerade
// laeuft.

import { videoSenke } from '../reels/encode.mjs';

export const FPS = 30;
export const SEKUNDEN_JE_FOLIE = 3;

// ⚠ DIE FOLIEN SIND 1080×1350, TIKTOK WILL 1080×1920.
//
// Gemessen am ersten Versuch: `Video: h264 … 1080x1350 [DAR 4:5]`. Das
// Seitenverhaeltnis stammt von Instagram, wo 4:5 das hoechste erlaubte
// Hochformat ist. Auf TikTok haette dieses Video oben und unten schwarze
// Balken — oder TikTok schneidet selbst zu, und dann ist unbestimmt, was
// wegfaellt.
//
// Gefuellt wird mit einer vergroesserten, weichgezeichneten Fassung des
// Bildes selbst. Eine einfarbige Flaeche waere einfacher, saehe aber schlecht
// aus: Die Folien tragen oben ein Foto und unten eine gruene Textflaeche —
// eine Farbe passt also nie zu beiden Raendern gleichzeitig.
export const TIKTOK_FILTER = 'split[a][b];'
  + '[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40[bg];'
  + '[b]scale=1080:-2,setsar=1[fg];'
  + '[bg][fg]overlay=(W-w)/2:(H-h)/2';

/**
 * @param {object} o
 * @param {string[]} o.bildUrls   oeffentliche Adressen der Folien, in Reihenfolge
 * @param {string} o.ziel         wohin die MP4-Datei geschrieben wird
 * @param {number} [o.sekunden]   Standzeit je Folie
 * @param {string|null} [o.filter] ffmpeg-Filter; Vorgabe fuellt 4:5 auf 9:16
 */
export async function folienVideo({
  bildUrls, ziel, sekunden = SEKUNDEN_JE_FOLIE, filter = TIKTOK_FILTER,
}) {
  const folien = (bildUrls ?? []).filter(Boolean);
  if (!folien.length) throw new Error('folienVideo ohne Folien.');

  // ⚠ Erst ALLE holen, dann kodieren. Bricht eine Adresse mittendrin weg,
  // laege sonst eine halbe Datei da, die aussieht wie ein fertiges Video.
  const bilder = [];
  for (const [i, u] of folien.entries()) {
    const a = await fetch(u);
    if (!a.ok) throw new Error(`Folie ${i + 1} nicht erreichbar: HTTP ${a.status} (${u})`);
    bilder.push(Buffer.from(await a.arrayBuffer()));
  }

  const senke = videoSenke({ fps: FPS, ziel, filter });
  const jeFolie = Math.max(1, Math.round(FPS * sekunden));

  // ⚠ Auf den Abfluss warten. `write` gibt false zurueck, wenn der Puffer
  // voll ist; wer das ignoriert, haelt bei sechs Folien à 90 Frames schnell
  // hundert Megabyte im Speicher, statt sie an ffmpeg durchzureichen.
  for (const bild of bilder) {
    for (let f = 0; f < jeFolie; f += 1) {
      if (!senke.stdin.write(bild)) {
        await new Promise((res) => senke.stdin.once('drain', res));
      }
    }
  }
  senke.stdin.end();
  await senke.fertig;

  return { ziel, folien: bilder.length, sekunden: (bilder.length * jeFolie) / FPS };
}

// Kleiner Selbstlauf, damit sich das Ergebnis ansehen laesst:
//   node tools/social/folien-video.mjs out.mp4 https://… https://…
if (import.meta.url === `file://${process.argv[1]}`) {
  const [ziel, ...urls] = process.argv.slice(2);
  if (!ziel || !urls.length) {
    console.error('Aufruf: node tools/social/folien-video.mjs <ziel.mp4> <url> [url …]');
    process.exit(1);
  }
  const r = await folienVideo({ bildUrls: urls, ziel });
  console.log(`✓ ${r.ziel} — ${r.folien} Folien, ${r.sekunden} s`);
}
