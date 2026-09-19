// Einen einzelnen TikTok-Beitrag posten — mit den Optionen, die ein Mensch
// auf der Freigabe-Seite gewaehlt hat.
//
//   APP=anigosha DATUM=2026-09-08 DATEI=anigosha-…-s1.mp4 \
//   PRIVACY=PUBLIC_TO_EVERYONE ERLAUBT=kommentare,duett WERBUNG=eigene \
//   node tools/social/tiktok-posten.mjs
//
// --- Warum es dieses Werkzeug getrennt vom Tageslauf gibt --------------------
//
// TikToks Richtlinie zum Direktversand verlangt woertlich:
//
//     „API Clients must only start sending content materials to TikTok after
//      the user has expressly consented to the upload."
//
// Vollautomatisches Posten ist damit nicht schwierig, sondern untersagt. Der
// Tageslauf darf das Video also NICHT selbst posten; er bereitet es vor, und
// erst ein Mensch loest hier aus.
//
// Was TikTok vor jedem Beitrag angezeigt haben will, steht deshalb in der
// Freigabe-Seite: Kontoname, Privatsphaere-Stufe OHNE Voreinstellung, die drei
// Haekchen fuer Kommentare/Duett/Stitch (alle aus), der Schalter fuer
// Werbekennzeichnung (aus) und der Satz zur Music Usage Confirmation. Die
// Auswahl kommt von dort hierher.
//
// ⚠ Dieses Skript darf nie eine Voreinstellung erfinden. Fehlt PRIVACY,
// bricht es ab — genau das ist der Sinn.
//
// --- Warum das Video aus dem Blob-Speicher kommt -----------------------------
//
// Der Tageslauf lief auf einem anderen Rechner, der laengst weg ist. Das
// Video liegt aber ohnehin oeffentlich im Blob (Instagram braucht das), und
// die Merkliste kennt seine Adresse. Also von dort holen statt neu rendern.

import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { merklistenLesen, merklisteAblegen } from './veroeffentlichen/blob.mjs';
import { direktPosten, fotoPosten, frischerToken } from './veroeffentlichen/tiktok.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const APP = (process.env.APP || '').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const DATEI = (process.env.DATEI || '').trim();
const PRIVACY = (process.env.PRIVACY || '').trim();
// Kommagetrennt, weil ein Workflow hoechstens zehn Eingaben hat und drei
// einzelne Haekchen davon drei verbrauchen wuerden.
const ERLAUBT = (process.env.ERLAUBT || '').split(',').map((s) => s.trim()).filter(Boolean);
const WERBUNG = (process.env.WERBUNG || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!APP || !DATEI) {
  console.error('APP und DATEI muessen gesetzt sein.');
  process.exit(1);
}
if (!PRIVACY) {
  console.error('PRIVACY fehlt. Das ist Absicht: TikTok verlangt, dass der Mensch');
  console.error('die Privatsphaere-Stufe waehlt — eine Voreinstellung waere ein');
  console.error('Verstoss gegen die Richtlinie, kein Komfort.');
  process.exit(1);
}

const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt — ohne ihn ist das Video nicht zu finden.');
  process.exit(1);
}

const listen = await merklistenLesen({ datum: DATUM, token: blobToken });
const liste = listen.find((l) => l.app === APP);
if (!liste) {
  console.error(`Keine Merkliste fuer ${APP} am ${DATUM}.`);
  process.exit(1);
}

const post = (liste.uebersicht ?? []).find((p) => p.datei === DATEI);
if (!post) {
  console.error(`„${DATEI}" steht nicht in der Merkliste vom ${DATUM}.`);
  process.exit(1);
}
if (!post.url) {
  console.error(`Fuer „${DATEI}" ist keine Adresse hinterlegt — an dem Tag lief`);
  console.error('Instagram nicht mit, und nur dort wird die Datei abgelegt.');
  process.exit(1);
}

// ⚠ Die einzige Sperre gegen einen doppelten Beitrag. TikTok selbst hat keine:
// Zweimal posten ergibt zwei Beitraege.
if (post.kanaele?.tiktok?.stand === 'veroeffentlicht') {
  console.log(`„${DATEI}" ist am ${post.kanaele.tiktok.wann} schon gepostet worden.`);
  console.log('Nichts getan.');
  process.exit(0);
}

console.log(`TikTok · ${liste.name} · ${DATEI}`);
console.log(`   Privatsphaere: ${PRIVACY}`);
console.log(`   erlaubt: ${ERLAUBT.join(', ') || 'nichts'}`);
console.log(`   Werbekennzeichnung: ${WERBUNG.join(', ') || 'keine'}`);

// ⚠ Fotos gehen einen anderen Weg als Videos, und zwar von Grund auf: Fuer
// Fotos gibt es bei TikTok KEINEN Dateiupload. `photo_images` nimmt Adressen,
// TikTok holt die Bilder selbst ab (`PULL_FROM_URL`). Also wird hier nichts
// heruntergeladen — die Blob-Adressen gehen direkt mit.
//
// ⚠ Beim Karussell ALLE Folien, nicht nur die erste. `urls` ist gesetzt, `url`
// bleibt daneben die erste Folie; wer auf `!post.url` prueft, haelt jedes
// Karussell fuer kaputt.
const folien = Array.isArray(post.urls) ? post.urls.filter(Boolean) : [];
const bildUrls = folien.length >= 2 ? folien : [post.url].filter(Boolean);

let tmp = null;
if (post.istVideo) {
  const antwort = await fetch(post.url);
  if (!antwort.ok) throw new Error(`Video nicht erreichbar: HTTP ${antwort.status}`);
  tmp = join(tmpdir(), DATEI);
  writeFileSync(tmp, Buffer.from(await antwort.arrayBuffer()));
} else {
  console.log(`   ${bildUrls.length} Bild${bildUrls.length > 1 ? 'er' : ''} — TikTok holt sie selbst ab`);
}

try {
  const z = zugaenge(APP);
  const { token } = await frischerToken({
    clientKey: z.tiktokKey, clientSecret: z.tiktokSecret, refreshToken: z.tiktokRefresh,
  });

  const wahl = {
    privacy: PRIVACY,
    kommentare: ERLAUBT.includes('kommentare'),
    duett: ERLAUBT.includes('duett'),
    stitch: ERLAUBT.includes('stitch'),
    eigeneMarke: WERBUNG.includes('eigene'),
    fremdeMarke: WERBUNG.includes('fremde'),
  };

  const r = post.istVideo
    ? await direktPosten({ token, datei: tmp, titel: post.text, wahl })
    // ⚠ `text`, nicht `titel`: Bei Fotos ist `title` eine Ueberschrift von
    // 90 Zeichen, die Bildunterschrift gehoert nach `description`.
    // `fotoPosten` teilt das selbst auf. Beim Video daneben ist `titel`
    // richtig — dort gibt es nur das eine Feld, mit 2200 Zeichen.
    : await fotoPosten({ token, bildUrls, text: post.text, wahl, direkt: true });

  console.log(`✓ gepostet — publish_id ${r.publishId} `
    + `(${post.istVideo ? `${r.mb} MB` : `${r.anzahl} Bild${r.anzahl > 1 ? 'er' : ''}`}, `
    + `${r.zeichen} Zeichen)`);

  // ⚠ Sofort vermerken. Ohne den Vermerk sieht der Beitrag auf der
  // Freigabe-Seite weiter offen aus, und der naechste Tipper macht einen
  // zweiten daraus — TikTok hat dagegen keine Sperre.
  //
  // Zurueckgeschrieben wird die GANZE Merkliste dieser App, nicht nur der eine
  // Eintrag: Sie liegt als eine Datei im Blob. `liste` ist eben frisch gelesen
  // worden, `post` ist ein Verweis hinein — die Aenderung ist also schon drin.
  post.kanaele = post.kanaele ?? {};
  post.kanaele.tiktok = {
    stand: 'veroeffentlicht',
    publishId: r.publishId,
    privacy: PRIVACY,
    wann: new Date().toISOString(),
  };
  await merklisteAblegen({
    datum: DATUM, appSchluessel: APP, name: liste.name,
    eintraege: liste.eintraege, uebersicht: liste.uebersicht,
    tiktok: liste.tiktok, token: zugaenge(APP).blobToken,
  });
  console.log('   Merkliste aktualisiert.');
} finally {
  // Ohne Video gibt es keine Temp-Datei — Fotos holt TikTok selbst ab.
  if (tmp) { try { unlinkSync(tmp); } catch { /* der Ordner raeumt sich selbst */ } }
}
