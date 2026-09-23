// WELLbooked!: Anbieter-Reel aus einem KI-Clip — 1080×1920, Look C.
//
// Aufgerufen von make-reel.mjs bei `--marke wellbooked --format clip-reel`.
//
// --- Warum (23.09.2026) ------------------------------------------------------
//
// Josef zu den Typografie-Reels: „die reel sehen billig aus.. einfach eine
// schrift auf einem grünen hintergrund geklatscht". Stattdessen: ein echter
// Bewegtbild-Clip (fal.ai, einmalig erzeugt, liegt im wellbooked-Repo unter
// docs/social/clips/), darüber zwei Sätze nacheinander, am Ende eine
// Schlusskarte mit der Gründungspartner-Seite.
//
// Die erste Fassung legte zwei feste PNGs über den Clip und hängte eine
// flache grüne Karte an. Josef: „mir gefällt die schrift und der grüne
// hintergrund nicht. Mach es mit mehr effekte". Aus drei Looks hat er am
// 23.09. Look C gewählt (Warm & weich: runde Schrift auf Salbei-Bändern).
// Gerendert wird jetzt Bild für Bild in clip-reel-looks.mjs — Wörter gleiten
// ein, die Kamera zoomt, App-Benachrichtigungen („Einspielungen") kommen von
// oben, das Logo baut sich auf. Wer den Look wechseln will: LOOK unten.
//
// Die Botschaft ist immer dieselbe, auf Josefs Wunsch: WELLbooked! nimmt
// Anbieter:innen die Organisation ab — kein Telefonieren, kein Hin und Her,
// kein Papierkram. Keine Gebiete (weder Bereiche noch Regionen).
//
// ⚠ Die Clips sind KI-erzeugt. Zeigt ein Clip Menschen (`clips[].menschen`
// in anbieter.json), trägt JEDER Frame das AI-Plättchen, und das Beiblatt
// nennt „Medienherkunft: ki-menschen (Wasserzeichen gesetzt)" — lauf.mjs liest
// genau diesen Wortlaut, sonst verwirft vorflug.mjs den Beitrag. Ohne Menschen
// kein Plättchen (Josef, 23.09.2026: „ai wasserzeichen weg wenn keine person
// sichtbar"), Beiblatt dann „ki-bild". Fehlt `menschen`, bricht das Reel ab
// statt zu raten.
//
// ⚠ Stumm. Ohne `tonDatei` setzt videoSenke `-an`; die Leitplanke
// `tonspur-leer` in vorflug.mjs verwirft sonst den ganzen Beitrag.

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { lookRendern } from './clip-reel-looks.mjs';

const LOOK = 'C';

/**
 * @param {object} o
 * @param {string} o.appPfad   Wurzel des wellbooked-Repos
 * @param {() => number} o.wuerfel
 * @param {string} o.ziel      .mp4-Pfad
 */
export async function clipReel({ appPfad, wuerfel, ziel }) {
  const { TEXTE, GRATIS_MONATE, ZIEL } = await import(join(appPfad, 'docs', 'social', 'anbieter.mjs'));
  const ordner = join(appPfad, 'docs', 'social', 'clips');

  // ⚠ Nur freigegebene Clips, und nur solche, deren Datei wirklich da ist.
  const frei = TEXTE.clips.filter((c) => c.geprueft === true && existsSync(join(ordner, c.datei)));
  if (!frei.length) {
    throw new Error('Keine freigegebenen Clips in wellbooked/docs/social/anbieter.json (clips[].geprueft) '
      + '— oder die Dateien in docs/social/clips/ fehlen.');
  }
  const wahl = frei[Math.floor(wuerfel() * frei.length)];
  if (typeof wahl.menschen !== 'boolean') {
    throw new Error(`Clip ${wahl.datei}: \`menschen\` fehlt in anbieter.json — davon hängt das AI-Plättchen ab.`);
  }
  if (!Array.isArray(wahl.einspielungen) || wahl.einspielungen.length !== 2) {
    throw new Error(`Clip ${wahl.datei}: \`einspielungen\` braucht genau zwei Texte in anbieter.json.`);
  }
  const zusatz = TEXTE.clipSchluss.zusatz.replace('{gratis_monate}', String(GRATIS_MONATE));

  const sekunden = await lookRendern({
    quelle: join(ordner, wahl.datei),
    look: LOOK,
    satz1: wahl.saetze[0],
    satz2: wahl.saetze[1],
    einspielungen: wahl.einspielungen,
    zusatz,
    ziel: ZIEL,
    datei: ziel,
    menschen: wahl.menschen,
  });

  // ffmpeg kann mit 0 enden und trotzdem nur einen leeren Container
  // schreiben (Kalender-Reel, 23.09.: 261 Byte). Acht Sekunden in diesem
  // Format sind nie unter 100 KB.
  const groesse = statSync(ziel).size;
  if (groesse < 100_000) {
    throw new Error(`Clip-Reel ist nur ${groesse} Byte groß — ffmpeg hat kein Video geschrieben.`);
  }

  return {
    datei: wahl.datei,
    saetze: wahl.saetze,
    sprechtext: wahl.sprechtext ?? null,
    menschen: wahl.menschen,
    titel: TEXTE.clipSchluss.titel,
    zusatz,
    sekunden,
    gratisMonate: GRATIS_MONATE,
    ziel: ZIEL,
  };
}
