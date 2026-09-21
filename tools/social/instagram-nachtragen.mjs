// Veroeffentlichte Instagram-Beitraege in der Uebersicht nachtragen.
//
//   TAGE=30 node tools/social/instagram-nachtragen.mjs
//   TROCKEN=1 TAGE=30 node tools/social/instagram-nachtragen.mjs
//
// --- Wofuer (21.09.2026) -----------------------------------------------------
//
// `freigeben.mjs` hat das Ergebnis einer Instagram-Freigabe bis zum 21.09. nur
// in `eintraege` geschrieben (`e.veroeffentlicht`). Die `uebersicht` — also
// das, was die Freigabe-Seite anzeigt — behielt `instagram: wartet`.
//
// Aufgefallen an zwei Anigosha-Beitraegen vom 21.09., um 14:33 und 16:20
// veroeffentlicht: `eintraege` sagte veroeffentlicht, `kanaele` sagte wartet.
//
//   · Die Freigabe-Seite liest `kanaele`. Beide standen weiter in der offenen
//     Liste, MIT Instagram-Knopf — ein zweiter Druck haette sie ein zweites
//     Mal gepostet.
//   · Das Archiv liest ebenfalls `kanaele`. Veroeffentlichte
//     Instagram-Beitraege fehlten dort vollstaendig.
//
// Der Fehler ist in `freigeben.mjs` behoben; dieses Skript holt nach, was in
// den alten Merklisten steht. Danach wird es nicht mehr gebraucht — es bleibt
// trotzdem liegen, weil dieselbe Ungleichheit jederzeit wieder entstehen kann
// (zwei Orte fuer dieselbe Tatsache) und die Reparatur dann in Sekunden da ist.
//
// ⚠ Es ruft Instagram NICHT an und veroeffentlicht nichts. Es schreibt nur
// auf, was laut `eintraege` ohnehin schon passiert ist.

import { merklistenLesen, merklisteAblegen } from './veroeffentlichen/blob.mjs';
import { standNachtragen } from './instagram-stand.mjs';

const TAGE = Math.min(Math.max(Number(process.env.TAGE) || 30, 1), 90);
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const TROCKEN = ['1', 'true', 'ja'].includes((process.env.TROCKEN || '').trim().toLowerCase());

const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt.');
  process.exit(1);
}

let nachgetragen = 0;
let schonRichtig = 0;

for (let i = 0; i < TAGE; i++) {
  const d = new Date(`${DATUM}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - i);
  const tag = d.toISOString().slice(0, 10);

  for (const liste of await merklistenLesen({ datum: tag, token: blobToken })) {
    const r = standNachtragen(liste);
    schonRichtig += r.schonRichtig;
    for (const datei of r.geaendert) {
      console.log(`${TROCKEN ? '○' : '✓'} ${tag} · ${liste.app} · ${datei}`);
    }

    if (!r.geaendert.length) continue;
    nachgetragen += r.geaendert.length;
    if (TROCKEN) continue;

    // ⚠ `eintraege`, `name` und `tiktok` mitreichen: `merklisteAblegen` ist
    // ein Vollersatz der Datei, kein Patch.
    await merklisteAblegen({
      datum: tag, appSchluessel: liste.app, name: liste.name,
      eintraege: liste.eintraege, uebersicht: liste.uebersicht,
      tiktok: liste.tiktok, token: blobToken,
    });
  }
}

console.log(`\n${TROCKEN ? 'TROCKEN — nichts veraendert. ' : ''}`
  + `${nachgetragen} nachgetragen, ${schonRichtig} standen schon richtig.`);
