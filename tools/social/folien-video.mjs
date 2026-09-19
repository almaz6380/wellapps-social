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
// --- Zum Ton ----------------------------------------------------------------
//
// Fuer die Reels gilt `tonspur_muss_leer_sein`: Musik legt ein Mensch in der
// App darueber, passend zu dem, was gerade laeuft. Fuer die Diashow hat Josef
// am 19.09.2026 anders entschieden, und mit Grund: Ein stummes Video laesst
// TikTok im Editor einen Sound vorschlagen, und was dann darunterliegt, hat
// niemand gewaehlt. Ein eigener Teppich beendet die Frage.
//
// `tonDatei` ist deshalb optional: ohne sie stumm wie bisher, mit ihr wird
// der Teppich auf die Videolaenge zugeschnitten (s. `tonBett`).

import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { videoSenke, lauf } from '../reels/encode.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));

// Welche App welchen Musikteppich bekommt.
//
// ⚠ Die Dateien liegen in DIESEM Repo, nicht im jeweiligen App-Repo:
// `social-tiktok-posten.yml` checkt nur dieses eine aus. Herkunft und die
// Regel „Original bleibt in wellbooked" stehen in `musik/LIESMICH.md`.
//
// Kein Eintrag heisst stumm — das ist der bisherige Zustand, kein Fehler.
const MUSIK = {
  wellbooked: 'wellbooked-indie.mp3',
};

/** Pfad zum Musikteppich einer App, oder null. */
export function musikFuer(app) {
  const datei = MUSIK[app];
  if (!datei) return null;
  const pfad = join(HIER, 'musik', datei);
  // ⚠ Lieber stumm als abgebrochen: Fehlt die Datei, soll der Beitrag
  // trotzdem hochgehen. Der Ton ist eine Zutat, nicht der Beitrag.
  if (!existsSync(pfad)) {
    console.warn(`   ⚠ Musikteppich fehlt: ${pfad} — die Diashow bleibt stumm.`);
    return null;
  }
  return pfad;
}

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
 * Einen Musikteppich auf die Laenge des Videos bringen.
 *
 * ⚠ Warum eine eigene Vorstufe und kein Filter in `videoSenke`: Die kennt nur
 * `-shortest`, und das SCHNEIDET die Musik hart ab. Ein Teppich, der mitten im
 * Takt aufhoert, klingt nach Aussetzer — der haeufigste Grund, warum ein sonst
 * fertiges Video billig wirkt. Also vorher zurechtschneiden, mit Ein- und
 * Ausblende.
 *
 * ⚠ VOLLE LAUTSTAERKE, anders als bei den Reels.
 *
 * Dort laeuft der Teppich bei ~10 %, damit in der App noch ein Trending-Sound
 * darueberpasst. Diese Regel hier zu uebernehmen war ein Denkfehler: Der
 * Teppich IST der Ton des Beitrags, es kommt nichts mehr darueber — er
 * existiert ja gerade, damit TikTok keinen Sound vorschlaegt. Auf halber
 * Lautstaerke gemessen: mean −31,6 dB, also fast nicht zu hoeren.
 *
 * Die Quelle liegt bei mean −25,3 / max −7,0 dB; unveraendert uebernommen
 * bleibt also Luft bis zum Anschlag, und es kann nicht knacken.
 */
export async function tonBett({
  quelle, ziel, sekunden, lautstaerke = 1, ausblenden = 1.5,
}) {
  const aus = Math.max(0, sekunden - ausblenden).toFixed(3);
  await lauf([
    '-y', '-i', quelle,
    '-t', String(sekunden),
    '-af', `volume=${lautstaerke},afade=t=in:st=0:d=0.8,`
      + `afade=t=out:st=${aus}:d=${ausblenden}`,
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    ziel,
  ]);
  return ziel;
}

/**
 * @param {object} o
 * @param {string[]} o.bildUrls   oeffentliche Adressen der Folien, in Reihenfolge
 * @param {string} o.ziel         wohin die MP4-Datei geschrieben wird
 * @param {number} [o.sekunden]   Standzeit je Folie
 * @param {string|null} [o.filter] ffmpeg-Filter; Vorgabe fuellt 4:5 auf 9:16
 * @param {string|null} [o.tonDatei] Musikteppich; laenger als noetig ist richtig,
 *                                   er wird auf die Videolaenge zugeschnitten
 */
export async function folienVideo({
  bildUrls, ziel, sekunden = SEKUNDEN_JE_FOLIE, filter = TIKTOK_FILTER, tonDatei = null,
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

  const jeFolie = Math.max(1, Math.round(FPS * sekunden));
  const dauer = (bilder.length * jeFolie) / FPS;

  // Der zugeschnittene Teppich liegt neben dem Ziel und wird danach entfernt.
  let ton = null;
  if (tonDatei) {
    ton = `${ziel}.ton.m4a`;
    await tonBett({ quelle: tonDatei, ziel: ton, sekunden: dauer });
  }

  const senke = videoSenke({ fps: FPS, ziel, filter, tonDatei: ton });

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
  if (ton) rmSync(ton, { force: true });

  return { ziel, folien: bilder.length, sekunden: dauer, ton: Boolean(ton) };
}

// Kleiner Selbstlauf, damit sich das Ergebnis ansehen laesst:
//   node tools/social/folien-video.mjs out.mp4 https://… https://…
if (import.meta.url === `file://${process.argv[1]}`) {
  const [ziel, ...urls] = process.argv.slice(2);
  if (!ziel || !urls.length) {
    console.error('Aufruf: node tools/social/folien-video.mjs <ziel.mp4> <url> [url …]');
    process.exit(1);
  }
  // TON=… legt einen Musikteppich darunter.
  const r = await folienVideo({ bildUrls: urls, ziel, tonDatei: process.env.TON || null });
  console.log(`✓ ${r.ziel} — ${r.folien} Folien, ${r.sekunden} s${r.ton ? ', mit Ton' : ''}`);
}
