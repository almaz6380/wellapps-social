// Einen Beitrag des Tages zusaetzlich als Story posten — Instagram und die
// Facebook-Seite, auf Knopfdruck aus der Freigabe-Seite („Auch als Story").
//
//   APPS=swaply DATEI=swaply-film-zucker-de-s93312.mp4 DATUM=2026-09-27 \
//   BLOB_TOKEN=… FB_SEITEN_TOKEN_SWAPLY=… node tools/social/story.mjs
//
// --- Warum (27.09.2026) ------------------------------------------------------
//
// Josef: „kannst du auch storys posten?" → „ja will ich" → auf die Frage nach
// Links: Link-Sticker gehen ueber die Schnittstellen nicht, also Weg 1:
// automatisch posten, der Hinweis „Gratis laden · Link in Bio ↑" steckt im
// Bild (tools/social/story/pille-<sprache>.png).
//
// --- Ablauf ----------------------------------------------------------------
//
//   1. Merkliste lesen, den Beitrag finden (dieselbe Datei wie fuer Instagram).
//   2. Datei holen und ins Story-Format bringen: 1080×1920. Ein Reel passt
//      schon; ein Bild (1080×1350) liegt mittig auf seiner eigenen,
//      unscharfen Vergroesserung. Darueber die Pille.
//   3. Story-Datei oeffentlich ablegen (Instagram und Facebook holen sie ab).
//   4. Instagram-Story, dann Facebook-Seiten-Story — getrennt: Scheitert die
//      eine, bleibt die andere trotzdem.
//   5. In der Merkliste vermerken (`uebersicht[].story`), damit die Seite den
//      Knopf als erledigt zeigt und kein zweiter Lauf dieselbe Story postet.
//
// ⚠ Doppel-Sperre wie beim Instagram-Beitrag: `sperreSetzen` mit Kanal
// `story`. Ein zweiter Knopfdruck, waehrend der erste Lauf noch arbeitet,
// tut nichts.

import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { merklistenLesen, merklisteAendern, hochladen, sperreSetzen, sperreLoesen } from './veroeffentlichen/blob.mjs';
import { storyAnlegen, aufBereitWarten, veroeffentlichen } from './veroeffentlichen/instagram.mjs';
import { storyPosten } from './veroeffentlichen/facebook.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';
import { lauf } from '../reels/encode.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const APP = (process.env.APPS || '').split(',').map((s) => s.trim()).filter(Boolean);
const DATEI = (process.env.DATEI || '').trim();
const blobToken = process.env.BLOB_TOKEN;

if (APP.length !== 1 || !DATEI) {
  console.error('Story braucht genau EINE App (APPS) und EINE Datei (DATEI).');
  process.exit(1);
}
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt — ohne ihn ist die Merkliste nicht zu finden.');
  process.exit(1);
}
const app = APP[0];
const z = zugaenge(app);

const liste = (await merklistenLesen({ datum: DATUM, token: blobToken })).find((l) => l.app === app);
const eintrag = liste?.eintraege?.find((e) => e.datei === DATEI);
const spur = liste?.uebersicht?.find((p) => p.datei === DATEI);
const quelle = eintrag ? (eintrag.urls?.[0] ?? eintrag.url) : null;
if (!quelle) {
  console.error(`„${DATEI}" steht nicht in der Merkliste ${app} vom ${DATUM} (oder hat keine Datei).`);
  process.exit(1);
}
if (spur?.story?.instagram?.id || spur?.story?.facebook?.id) {
  console.log(`Story zu ${DATEI} gibt es schon (${spur.story.wann}) — nichts getan.`);
  process.exit(0);
}

const istVideo = /\.(mp4|mov)$/i.test(DATEI);
const sprache = DATEI.match(/-([a-z]{2})-s\d+/)?.[1] ?? 'de';
const pille = join(HIER, 'story', `pille-${sprache}.png`);
const pilleDa = existsSync(pille) ? pille : join(HIER, 'story', 'pille-en.png');

if (!(await sperreSetzen({ datum: DATUM, kanal: 'story', datei: DATEI, token: z.blobToken, lauf: process.env.GITHUB_RUN_ID ?? null }))) {
  console.log('⚠ Ein anderer Lauf postet diese Story gerade (oder hat es getan) — nichts getan.');
  process.exit(0);
}

const tmp = join(tmpdir(), `story-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const ergebnis = { wann: new Date().toISOString() };
let erfolgreich = false;
try {
  // --- 1. Datei holen und ins Story-Format bringen -------------------------
  const roh = join(tmp, istVideo ? 'roh.mp4' : 'roh.jpg');
  const antwort = await fetch(quelle);
  if (!antwort.ok) throw new Error(`Datei nicht mehr abrufbar (${antwort.status}) — vermutlich schon aufgeraeumt.`);
  writeFileSync(roh, Buffer.from(await antwort.arrayBuffer()));

  const ziel = join(tmp, DATEI.replace(/\.(mp4|mov|jpe?g|png)$/i, istVideo ? '-story.mp4' : '-story.jpg'));
  // Hintergrund = das Motiv selbst, vergroessert und unscharf; darueber das
  // Motiv ganz; darueber die Pille. Bei einem Reel (schon 9:16) deckt das
  // Motiv den Hintergrund vollstaendig — die Kette ist fuer beide dieselbe.
  const kette = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:3,eq=brightness=-0.12[hg];'
    + '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[vg];'
    // Ein Bild (1080×1350) rutscht nach oben (y ≤ 170), sonst saesse die Pille
    // bei y 1560 auf seinem unteren Rand — dort stehen die Store-Knoepfe.
    + "[hg][vg]overlay=(W-w)/2:'min((H-h)/2,170)'[m];[m][1:v]overlay=0:0,format=yuv420p[v]";
  await lauf(istVideo
    ? ['-y', '-i', roh, '-i', pilleDa, '-filter_complex', kette, '-map', '[v]', '-map', '0:a?',
      // Instagram nimmt Story-Videos bis 60 s.
      '-t', '59', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', ziel]
    : ['-y', '-i', roh, '-i', pilleDa, '-filter_complex', kette, '-map', '[v]', '-frames:v', '1', '-q:v', '2', ziel]);

  // --- 2. Oeffentlich ablegen ---------------------------------------------
  // ⚠ Bleibt liegen: Facebook holt Videos asynchron ab und verarbeitet sie
  // noch, wenn der Aufruf laengst zurueck ist. Ein Loeschen hier liesse die
  // Facebook-Story still scheitern.
  const { url } = await hochladen({ datei: ziel, token: z.blobToken, praefix: `social/${DATUM}/story` });
  console.log(`Story-Datei: ${url}`);

  // --- 3. Instagram --------------------------------------------------------
  try {
    const c = await storyAnlegen({ kontoId: z.igKontoId, token: z.fbToken, url, istVideo });
    await aufBereitWarten({ containerId: c.containerId, token: z.fbToken });
    const r = await veroeffentlichen({ kontoId: z.igKontoId, token: z.fbToken, containerId: c.containerId });
    ergebnis.instagram = { id: r.id };
    console.log(`✓ Instagram-Story ${r.id}`);
  } catch (e) {
    ergebnis.instagram = { fehler: e.message };
    console.log(`✗ Instagram-Story: ${e.message}`);
  }

  // --- 4. Facebook-Seite ---------------------------------------------------
  try {
    const r = await storyPosten({ seitenId: z.fbSeitenId, token: z.fbToken, url, istVideo });
    ergebnis.facebook = { id: r.id };
    console.log(`✓ Facebook-Story ${r.id}`);
  } catch (e) {
    ergebnis.facebook = { fehler: e.message };
    console.log(`✗ Facebook-Story: ${e.message}`);
  }
  erfolgreich = Boolean(ergebnis.instagram?.id || ergebnis.facebook?.id);
} catch (e) {
  console.log(`✗ ${e.message}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (!erfolgreich) {
  // Nichts gepostet → Sperre wieder frei, ein neuer Knopfdruck darf es noch
  // einmal versuchen.
  await sperreLoesen({ datum: DATUM, kanal: 'story', datei: DATEI, token: z.blobToken });
  process.exit(1);
}

// --- 5. Vermerken -----------------------------------------------------------
await merklisteAendern({
  datum: DATUM, appSchluessel: app, token: z.blobToken,
  aendern: (l) => {
    const p = (l.uebersicht ?? []).find((x) => x.datei === DATEI);
    if (p) p.story = ergebnis;
  },
  drin: (l) => (l.uebersicht ?? []).find((x) => x.datei === DATEI)?.story?.wann === ergebnis.wann,
});
console.log('Merkliste: Story vermerkt.');
// Teilerfolg (eine Plattform gescheitert) soll im Lauf rot sichtbar sein.
if (ergebnis.instagram?.fehler || ergebnis.facebook?.fehler) process.exit(1);
