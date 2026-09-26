// Einen veroeffentlichten Instagram-Beitrag LOESCHEN — auf ausdruecklichen Zuruf.
//
//   APPS=fullrep DATUM=2026-09-26 DATEI=fullrep-…-s20835.mp4 LOESCHEN=<Beitragsnummer> \
//   node tools/social/instagram-loeschen.mjs
//
// --- Wofuer (26.09.2026) -----------------------------------------------------
//
// Das FullRep-Reel „Schulterdrücken sitzend (KH)" zeigte eine STEHENDE Puppe
// (falsche Clip-Zuordnung in der App, dort behoben). Facebook liess sich mit
// facebook-posten.mjs (LOESCHEN) entfernen; das hier ist dasselbe fuer
// Instagram.
//
// ⚠ Nur mit Beitragsnummer UND Datei, und nur wenn die Merkliste genau diese
// Nummer fuer genau diese Datei fuehrt. Eine vertippte Nummer loescht sonst
// einen fremden Beitrag — unwiderruflich.
//
// ⚠ Danach steht in der Uebersicht `instagram: geloescht`. Der Eintrag in
// `eintraege` behaelt `veroeffentlicht` (mit `geloescht` daneben): Das ist die
// Sperre, die freigeben.mjs liest — ohne sie boete die Seite den falschen
// Beitrag erneut zum Posten an.

import { merklistenLesen, merklisteAendern } from './veroeffentlichen/blob.mjs';
import { beitragLoeschen } from './veroeffentlichen/instagram.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const APP = (process.env.APPS || process.env.APP || '').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const DATEI = (process.env.DATEI || '').trim();
const LOESCHEN = (process.env.LOESCHEN || '').trim();

if (!APP || APP.includes(',') || !DATEI || !LOESCHEN) {
  console.error('Genau EINE App (APPS), DATEI und LOESCHEN (Beitragsnummer) muessen gesetzt sein.');
  process.exit(1);
}
const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) { console.error('BLOB_TOKEN fehlt.'); process.exit(1); }

const liste = (await merklistenLesen({ datum: DATUM, token: blobToken })).find((l) => l.app === APP);
if (!liste) { console.error(`Keine Merkliste fuer ${APP} am ${DATUM}.`); process.exit(1); }
const eintrag = (liste.eintraege ?? []).find((e) => e.datei === DATEI);
const spur = (liste.uebersicht ?? []).find((p) => p.datei === DATEI);
const bekannt = [eintrag?.beitragId, spur?.kanaele?.instagram?.beitragId].filter(Boolean).map(String);
if (!bekannt.includes(LOESCHEN)) {
  console.error(`Die Merkliste fuehrt fuer „${DATEI}" die Instagram-Nummer(n) ${bekannt.join(', ') || '(keine)'} —`);
  console.error(`nicht ${LOESCHEN}. Nichts geloescht.`);
  process.exit(1);
}

const z = zugaenge(APP);
console.log(`Instagram · ${liste.name} · ${DATEI}`);
console.log(`   LOESCHEN — Beitrag ${LOESCHEN}`);
await beitragLoeschen({ id: LOESCHEN, token: z.fbToken });
console.log(`✓ ${LOESCHEN} geloescht.`);

const wann = new Date().toISOString();
const { versuche } = await merklisteAendern({
  datum: DATUM, appSchluessel: APP, token: blobToken,
  aendern: (l) => {
    const e = (l.eintraege ?? []).find((x) => x.datei === DATEI);
    if (e) e.geloescht = wann;
    const p = (l.uebersicht ?? []).find((x) => x.datei === DATEI);
    if (p) p.kanaele = { ...(p.kanaele ?? {}), instagram: { stand: 'geloescht', beitragId: LOESCHEN, wann } };
  },
  drin: (l) => (l.uebersicht ?? []).find((x) => x.datei === DATEI)?.kanaele?.instagram?.stand === 'geloescht',
});
console.log(`   Merkliste aktualisiert${versuche > 1 ? ` (im ${versuche}. Versuch)` : ''}.`);
