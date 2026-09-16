// Einen einzelnen Facebook-Beitrag veroeffentlichen — auf Knopfdruck von der
// Freigabe-Seite.
//
//   APP=anigosha DATUM=2026-09-10 DATEI=anigosha-…-s1.mp4 \
//   node tools/social/facebook-posten.mjs
//
// --- Warum der Beitrag erst hier entsteht ------------------------------------
//
// Bis zum 09.09.2026 legte der Tageslauf einen Facebook-ENTWURF an
// (`published=false`), und freigegeben wurde er in der Meta Business Suite.
// Josef gibt jetzt alles auf einer Seite frei, also musste der Entwurf von
// dort aus veroeffentlicht werden koennen.
//
// Der naheliegende Weg — den vorhandenen Entwurf nachtraeglich auf
// `published=true` setzen — ist bei Facebook kein einzelner, verlaesslicher
// Aufruf: Ein unveroeffentlichtes FOTO ist etwas anderes als ein
// unveroeffentlichter Feed-Beitrag, und beide werden verschieden
// veroeffentlicht. Statt das zu erraten, entsteht der Beitrag jetzt erst hier
// — mit demselben Aufruf, der vorher den Entwurf angelegt hat, nur mit
// `veroeffentlicht: true`.
//
// ⚠ Deshalb legt der Tageslauf KEINEN Entwurf mehr an. Beides zusammen ergaebe
// zwei Dinge auf der Seite: den liegengebliebenen Entwurf und den Beitrag.
//
// --- Warum die Datei aus dem Blob-Speicher kommt -----------------------------
//
// Der Tageslauf lief auf einem Rechner, den es nicht mehr gibt. Die gerenderte
// Datei liegt aber ohnehin oeffentlich im Blob (Instagram braucht das so), und
// die Merkliste kennt ihre Adresse. Also von dort holen statt neu rendern.

import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { merklistenLesen, merklisteAblegen, aufraeumen, nochGebraucht } from './veroeffentlichen/blob.mjs';
import { entwurfAnlegen } from './veroeffentlichen/facebook.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const APP = (process.env.APP || '').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const DATEI = (process.env.DATEI || '').trim();

if (!APP || !DATEI) {
  console.error('APP und DATEI muessen gesetzt sein.');
  process.exit(1);
}

const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt — ohne ihn ist die Datei nicht zu finden.');
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
  console.error('Facebook nicht mit, oder der Lauf stammt noch aus der Zeit der');
  console.error('Entwuerfe (vor dem 09.09.2026).');
  process.exit(1);
}

// ⚠ Die einzige Sperre gegen einen doppelten Beitrag. Facebook selbst hat
// keine: Zweimal posten ergibt zwei Beitraege.
if (post.kanaele?.facebook?.stand === 'veroeffentlicht') {
  console.log(`„${DATEI}" ist am ${post.kanaele.facebook.wann} schon gepostet worden.`);
  console.log('Nichts getan.');
  process.exit(0);
}

const z = zugaenge(APP);
console.log(`Facebook · ${liste.name} · ${DATEI}`);
console.log(`   ${post.text.length} Zeichen Text`);

const antwort = await fetch(post.url);
if (!antwort.ok) throw new Error(`Datei nicht erreichbar: HTTP ${antwort.status}`);
const tmp = join(tmpdir(), DATEI);
writeFileSync(tmp, Buffer.from(await antwort.arrayBuffer()));

try {
  const r = await entwurfAnlegen({
    seitenId: z.fbSeitenId, token: z.fbToken,
    datei: tmp, text: post.text, veroeffentlicht: true,
  });
  console.log(`✓ veroeffentlicht — ${r.art}, Beitrag ${r.id}`);

  // ⚠ Sofort vermerken. Ohne den Vermerk sieht der Beitrag auf der
  // Freigabe-Seite weiter offen aus, und der naechste Tipper macht einen
  // zweiten daraus.
  //
  // Zurueckgeschrieben wird die GANZE Merkliste dieser App: Sie liegt als eine
  // Datei im Blob. `liste` ist eben frisch gelesen worden, `post` ist ein
  // Verweis hinein — die Aenderung ist also schon drin.
  post.kanaele = post.kanaele ?? {};
  post.kanaele.facebook = {
    stand: 'veroeffentlicht', id: r.id ?? null, wann: new Date().toISOString(),
  };
  await merklisteAblegen({
    datum: DATUM, appSchluessel: APP, name: liste.name,
    eintraege: liste.eintraege, uebersicht: liste.uebersicht,
    tiktok: liste.tiktok, token: z.blobToken,
  });
  console.log('   Merkliste aktualisiert.');

  // Aufraeumen nur, wenn kein anderer Kanal die Datei noch braucht.
  if (nochGebraucht({ liste, datei: DATEI })) {
    console.log('   Datei bleibt liegen — ein anderer Kanal ist noch offen.');
  } else {
    await aufraeumen({ url: post.url, token: z.blobToken });
    console.log('   Datei weggeraeumt.');
  }
} finally {
  try { unlinkSync(tmp); } catch { /* der Ordner raeumt sich selbst */ }
}
