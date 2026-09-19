// Die TikTok-Signaturdatei in den Blob-Speicher legen.
//
//   BLOB_TOKEN=… TIKTOK_VERIFY=7dD2Rlg… node tools/social/tiktok-domain-datei.mjs
//   … --trocken     nur sagen, was entstuende
//
// --- Wofuer das gebraucht wird -----------------------------------------------
//
// TikTok-Fotobeitraege kennen KEINEN Dateiupload. `photo_images` nimmt nur
// Adressen, und TikTok holt die Bilder selbst ab (`PULL_FROM_URL`). Dazu sagt
// die Doku einen Nebensatz, an dem alles haengt:
//
//     „The URLs must be publicly accessible and VERIFIED BY YOUR APP."
//
// Es genuegt also nicht, dass eine Adresse oeffentlich erreichbar ist. Ihr
// Praefix muss im Entwicklerportal unter „URL prefix" eingetragen und
// verifiziert sein — derselbe Mechanismus wie bei den Login-Domains
// (`anigosha.vercel.app`, `wellapps-freigabe.vercel.app`).
//
// Unsere Bilder liegen im Vercel-Blob-Speicher, und der hat eine eigene
// Adresse. Diese Datei macht sie verifizierbar.
//
// --- Der Ablauf, und wer welchen Schritt macht -------------------------------
//
//   1. JOSEF: Portal → App → URL properties → URL prefix hinzufuegen,
//      z. B. https://<kennung>.public.blob.vercel-storage.com/social/
//      TikTok nennt daraufhin einen Token.
//   2. DIESES SKRIPT legt die Datei an der richtigen Stelle ab.
//   3. JOSEF: im Portal auf „Verify" tippen.
//
// ⚠ Schritt 1 muss zuerst kommen. Der Token entsteht im Portal; raten laesst
// er sich nicht.
//
// ⚠ `addRandomSuffix: false` ist hier PFLICHT. Der Blob-Speicher haengt sonst
// an jeden Dateinamen einen Zufallsanhang (seit 10.09.2026, damit Adressen
// nicht erratbar sind) — und TikTok sucht die Datei unter genau dem Namen,
// den es nennt. Mit Anhang findet es nichts und sagt nur „nicht verifiziert".
//
// ⚠ Sollte TikTok den Blob-Host als Praefix ABLEHNEN: Rueckfall ist eine Route
// auf wellapps-freigabe.vercel.app, die die Bytes durchreicht — jene Domain
// ist bereits verifiziert. Das steht erst dann an; raten kostet hier nichts,
// probieren eine Minute.

import { put } from '@vercel/blob';

const TOKEN = (process.env.TIKTOK_VERIFY || '').trim();
const BLOB = process.env.BLOB_TOKEN;
const TROCKEN = process.argv.includes('--trocken');
// Der Ordner, unter dem die Bilder liegen. Er ist zugleich das Praefix, das
// im Portal einzutragen ist.
const ORDNER = (process.env.ORDNER || 'social').replace(/^\/+|\/+$/g, '');

if (!TOKEN) {
  console.error('TIKTOK_VERIFY fehlt — der Token, den das Portal beim Anlegen des');
  console.error('URL-Praefix nennt. Ohne ihn gibt es nichts abzulegen.');
  console.error('Portal → deine App → URL properties → URL prefix hinzufuegen.');
  process.exit(1);
}
if (!/^[A-Za-z0-9]{8,64}$/.test(TOKEN)) {
  console.error(`„${TOKEN}" sieht nicht nach einem TikTok-Token aus (erwartet: 8–64 Zeichen,`);
  console.error('nur Buchstaben und Ziffern). Der DATEINAME steht im Portal daneben —');
  console.error('gebraucht wird hier nur der Teil zwischen „tiktok" und „.txt".');
  process.exit(1);
}

const name = `tiktok${TOKEN}.txt`;
const pfad = `${ORDNER}/${name}`;
const inhalt = `tiktok-developers-site-verification=${TOKEN}`;

if (TROCKEN) {
  console.log('Trockenlauf — es wird nichts abgelegt.\n');
  console.log(`   Datei   ${pfad}`);
  console.log(`   Inhalt  ${inhalt}`);
  console.log('\nDanach im Portal als URL prefix eintragen:');
  console.log(`   https://<kennung>.public.blob.vercel-storage.com/${ORDNER}/`);
  process.exit(0);
}

if (!BLOB) {
  console.error('BLOB_TOKEN fehlt — ohne ihn laesst sich nichts ablegen.');
  process.exit(1);
}

const { url } = await put(pfad, inhalt, {
  access: 'public',
  token: BLOB,
  contentType: 'text/plain; charset=utf-8',
  // s. o. — ohne das findet TikTok die Datei nicht.
  addRandomSuffix: false,
  allowOverwrite: true,
});

console.log(`✓ abgelegt: ${url}`);
console.log('\nJetzt im Portal:');
console.log(`   1. URL prefix eintragen: ${url.replace(new RegExp(`${name}$`), '')}`);
console.log('   2. „Verify" tippen.');
console.log('\nDie Datei muss liegen bleiben — TikTok prueft sie spaeter erneut.');
