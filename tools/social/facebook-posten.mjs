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

import { merklistenLesen, merklisteAendern, aufraeumen, nochGebraucht, sperreSetzen, sperreLoesen } from './veroeffentlichen/blob.mjs';
import { entwurfAnlegen, mehrbildAnlegen, beitragLoeschen } from './veroeffentlichen/facebook.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const APP = (process.env.APP || '').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const DATEI = (process.env.DATEI || '').trim();
// Reparatur (26.09.2026): nur den Vermerk nachtragen, NICHTS posten. Fuer
// Beitraege, die draussen sind, deren Vermerk aber verloren ging (siehe
// merklisteAendern in blob.mjs). Wert = die Facebook-Beitragsnummer aus dem
// Protokoll des Laufs, der wirklich gepostet hat.
const NUR_VERMERKEN = (process.env.NUR_VERMERKEN || '').trim();
// Doppel entfernen (26.09.2026): LOESCHEN=<Beitragsnummer> loescht genau diesen
// Beitrag auf Facebook; BEHALTEN=<Beitragsnummer> ist der, der stehen bleibt
// und danach in der Merkliste steht. Postet nichts.
const LOESCHEN = (process.env.LOESCHEN || '').trim();
const BEHALTEN = (process.env.BEHALTEN || '').trim();

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

const z = zugaenge(APP);

if (LOESCHEN) {
  console.log(`Facebook · ${liste.name} · ${DATEI}`);
  console.log(`   LOESCHEN — Beitrag ${LOESCHEN}${BEHALTEN ? `, es bleibt ${BEHALTEN}` : ''}`);
  if (BEHALTEN && BEHALTEN === LOESCHEN) {
    console.error('LOESCHEN und BEHALTEN sind derselbe Beitrag.');
    process.exit(1);
  }
  // Wuerde der Vermerk danach auf einen geloeschten Beitrag zeigen, braucht
  // es den, der bleibt — sonst saehe der Beitrag auf der Seite offen aus.
  if (post.kanaele?.facebook?.id === LOESCHEN && !BEHALTEN) {
    console.error(`Die Merkliste fuehrt ${LOESCHEN} als den Beitrag — BEHALTEN muss gesetzt sein.`);
    process.exit(1);
  }
  await beitragLoeschen({ id: LOESCHEN, token: z.fbToken });
  console.log(`✓ ${LOESCHEN} geloescht.`);
  if (BEHALTEN) {
    await vermerken({
      stand: 'veroeffentlicht', id: BEHALTEN, wann: post.kanaele?.facebook?.wann ?? new Date().toISOString(),
      doppelGeloescht: LOESCHEN,
    });
  }
  process.exit(0);
}

// ⚠ Erste Sperre: der Vermerk in der Merkliste. Facebook selbst hat keine —
// zweimal posten ergibt zwei Beitraege. Sie allein reicht NICHT (die Liste
// kommt ueber das CDN und kann eine Minute alt sein); die harte Sperre
// (sperreSetzen) kommt unten, unmittelbar vor dem Posten.
if (post.kanaele?.facebook?.stand === 'veroeffentlicht') {
  console.log(`„${DATEI}" ist am ${post.kanaele.facebook.wann} schon gepostet worden.`);
  console.log('Nichts getan.');
  process.exit(0);
}


/** Den Facebook-Vermerk setzen — auf der FRISCH gelesenen Liste, nicht auf `liste`. */
async function vermerken(kanal) {
  const { liste: frisch, versuche } = await merklisteAendern({
    datum: DATUM, appSchluessel: APP, token: z.blobToken,
    aendern: (l) => {
      const p = (l.uebersicht ?? []).find((x) => x.datei === DATEI);
      if (!p) throw new Error(`„${DATEI}" fehlt in der frischen Merkliste.`);
      p.kanaele = { ...(p.kanaele ?? {}), facebook: kanal };
    },
    drin: (l) => (l.uebersicht ?? []).find((x) => x.datei === DATEI)
      ?.kanaele?.facebook?.id === kanal.id,
  });
  console.log(`   Merkliste aktualisiert${versuche > 1 ? ` (im ${versuche}. Versuch — es schrieb jemand dazwischen)` : ''}.`);
  return frisch;
}

if (NUR_VERMERKEN) {
  console.log(`Facebook · ${liste.name} · ${DATEI}`);
  console.log(`   NUR VERMERKEN — es wird nichts gepostet. Beitrag ${NUR_VERMERKEN}`);
  await vermerken({
    stand: 'veroeffentlicht', id: NUR_VERMERKEN, wann: new Date().toISOString(), nachgetragen: true,
  });
  process.exit(0);
}

console.log(`Facebook · ${liste.name} · ${DATEI}`);
console.log(`   ${post.text.length} Zeichen Text`);


// ⚠ Ein Karussell erkennt man an `urls`, NICHT daran, dass `url` fehlt. `url`
// bleibt gesetzt (die erste Folie) — dieselbe Regel wie in freigeben.mjs.
//
// ⚠ Bis zum 19.09.2026 stand hier nur `fetch(post.url)`: Facebook bekam
// stillschweigend Folie 1 mit der Bildunterschrift, die fuer sechs Folien
// geschrieben war. Das war kein Grenzfall, sondern der Normalfall fuer jedes
// Karussell — und es sah im Protokoll nach Erfolg aus.
const folien = Array.isArray(post.urls) ? post.urls.filter(Boolean) : [];
const quellen = folien.length >= 2 ? folien : [post.url];
if (folien.length >= 2) console.log(`   ${folien.length} Folien`);

const tmpDateien = [];
for (const [i, quelle] of quellen.entries()) {
  const antwort = await fetch(quelle);
  if (!antwort.ok) {
    throw new Error(`Folie ${i + 1} nicht erreichbar: HTTP ${antwort.status} — ${quelle}`);
  }
  // Der Name muss je Folie verschieden sein, sonst ueberschreiben sie sich im
  // selben Temp-Ordner und Facebook bekaeme sechsmal dasselbe Bild.
  const name = quellen.length > 1 ? `${i + 1}-${DATEI}` : DATEI;
  const pfad = join(tmpdir(), name);
  writeFileSync(pfad, Buffer.from(await antwort.arrayBuffer()));
  tmpDateien.push(pfad);
}

// ⚠ DIE HARTE SPERRE (26.09.2026, nach dem FullRep-Doppel um 21:31/21:35).
// Nur EIN Lauf je Datei bekommt sie — egal, was Merkliste und Seite gerade
// anzeigen. Siehe sperreSetzen in blob.mjs.
if (!(await sperreSetzen({ datum: DATUM, kanal: 'facebook', datei: DATEI, token: z.blobToken, lauf: process.env.GITHUB_RUN_ID ?? null }))) {
  console.log('   ⚠ Ein anderer Lauf hat diesen Beitrag schon auf Facebook gepostet (oder postet ihn gerade).');
  console.log('   Nichts getan. Die Freigabe-Seite zieht in bis zu einer Minute nach.');
  process.exit(0);
}
let gepostet = false;

try {
  const r = tmpDateien.length >= 2
    ? await mehrbildAnlegen({
      seitenId: z.fbSeitenId, token: z.fbToken,
      dateien: tmpDateien, text: post.text, veroeffentlicht: true,
    })
    : await entwurfAnlegen({
      seitenId: z.fbSeitenId, token: z.fbToken,
      datei: tmpDateien[0], text: post.text, veroeffentlicht: true,
    });
  gepostet = true;
  console.log(`✓ veroeffentlicht — ${r.art}, Beitrag ${r.id}`);

  // ⚠ Sofort vermerken. Ohne den Vermerk sieht der Beitrag auf der
  // Freigabe-Seite weiter offen aus, und der naechste Tipper macht einen
  // zweiten daraus.
  //
  // ⚠ Auf der FRISCH gelesenen Liste (merklisteAendern), nicht auf `liste`
  // vom Anfang: Bis hierher sind 10 bis 20 s vergangen, in denen die
  // Instagram-Freigabe oder ein Ablehnen dieselbe Datei geschrieben haben
  // kann. Die GANZE alte Liste zurueckzuschreiben loeschte deren Vermerke —
  // und umgekehrt (26.09.2026, siehe blob.mjs).
  const frisch = await vermerken({
    stand: 'veroeffentlicht', id: r.id ?? null, wann: new Date().toISOString(),
  });

  // Aufraeumen nur, wenn kein anderer Kanal die Datei noch braucht — gefragt
  // gegen die frische Liste.
  if (nochGebraucht({ liste: frisch, datei: DATEI })) {
    console.log('   Datei bleibt liegen — ein anderer Kanal ist noch offen.');
  } else {
    // ⚠ `urls` mitgeben. Ohne sie loescht das Aufraeumen nur Folie 1 und laesst
    // 2 bis 6 fuer immer im Blob liegen — unbemerkt, weil der Beitrag ja steht.
    await aufraeumen({ url: post.url, urls: folien, token: z.blobToken });
    console.log('   Datei weggeraeumt.');
  }
} catch (e) {
  // Nicht gepostet → Sperre frei, damit ein neuer Versuch geht. Gepostet
  // (und nur das Vermerken scheiterte) → Sperre BLEIBT: Der Beitrag ist draussen.
  if (!gepostet) await sperreLoesen({ datum: DATUM, kanal: 'facebook', datei: DATEI, token: z.blobToken });
  throw e;
} finally {
  for (const p of tmpDateien) {
    try { unlinkSync(p); } catch { /* der Ordner raeumt sich selbst */ }
  }
}
