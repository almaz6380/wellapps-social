// Einen Beitrag ablehnen — auf Knopfdruck von der Freigabe-Seite.
//
//   APP=anigosha DATUM=2026-09-10 DATEI=anigosha-…-s1.jpg \
//   node tools/social/ablehnen.mjs
//
// --- Was Ablehnen heisst und was nicht ---------------------------------------
//
// Es heisst: Dieser Beitrag geht nicht raus. Er wird in der Merkliste als
// `abgelehnt` vermerkt, sein Instagram-Eintrag verschwindet aus `eintraege`
// (damit ihn auch ein Freigabe-Lauf nicht mehr anfassen kann), und die
// Freigabe-Seite zeigt ihn danach nur noch durchgestrichen.
//
// Es heisst NICHT: Der Beitrag verschwindet. Er bleibt in der Uebersicht
// stehen — sonst waere hinterher nicht mehr nachvollziehbar, was an dem Tag
// verworfen wurde und warum ein Nachlauf existiert.
//
// ⚠ Was schon oeffentlich ist, laesst sich hier nicht zurueckholen. Steht ein
// Kanal auf `veroeffentlicht`, bricht das Skript ab: Ein „abgelehnt" ueber
// einem laufenden Beitrag waere eine Luege in der Anzeige. Loeschen muss
// Josef dann im jeweiligen Netzwerk.
//
// --- Und der Ersatz? ---------------------------------------------------------
//
// Den erzeugt dieses Skript NICHT. Ein neuer Beitrag braucht die fuenf Repos
// und einen Browser zum Rendern; das ist der Tageslauf, und der laeuft mit
// `variante: N`. Die Freigabe-Seite loest beides nacheinander aus. Getrennt,
// weil Ablehnen in zwei Sekunden fertig ist und Rendern zehn Minuten dauert —
// wer beides in einen Lauf packt, laesst den Menschen zehn Minuten im Unklaren
// darueber, ob wenigstens das Ablehnen geklappt hat.

import { merklistenLesen, merklisteAblegen, aufraeumen, nochGebraucht } from './veroeffentlichen/blob.mjs';
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
  console.error('BLOB_TOKEN fehlt — ohne ihn ist die Merkliste nicht zu finden.');
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

if (post.abgelehnt) {
  console.log(`„${DATEI}" ist am ${post.abgelehnt} schon abgelehnt worden. Nichts getan.`);
  process.exit(0);
}

// ⚠ Die eine Sperre: Was draussen ist, ist draussen.
const draussen = Object.entries(post.kanaele ?? {})
  .filter(([, e]) => e.stand === 'veroeffentlicht')
  .map(([kanal]) => kanal);
const igDraussen = (liste.eintraege ?? [])
  .some((e) => e.datei === DATEI && e.veroeffentlicht);
if (draussen.length || igDraussen) {
  const wo = [...new Set([...draussen, ...(igDraussen ? ['instagram'] : [])])];
  console.error(`„${DATEI}" ist bereits veroeffentlicht (${wo.join(', ')}).`);
  console.error('Ablehnen waere hier nur ein falscher Vermerk — der Beitrag ist');
  console.error('draussen. Loeschen geht nur im jeweiligen Netzwerk.');
  process.exit(1);
}

const z = zugaenge(APP);

post.abgelehnt = new Date().toISOString();
// Der TikTok-Entwurf liegt eventuell schon im Posteingang der App. Loeschen
// kann ihn die API nicht — der Vermerk sagt deshalb, was Josef selbst tun muss.
const tiktokImPosteingang = post.kanaele?.tiktok?.stand === 'posteingang';

// ⚠ Instagram-Eintrag RAUS, nicht nur markieren. `eintraege` ist der Vertrag
// mit freigeben.mjs: Was dort steht, wird bei der naechsten Freigabe
// veroeffentlicht. Ein abgelehnter Beitrag, der dort stehen bleibt, geht beim
// naechsten Sammel-Freigabelauf trotzdem raus.
const vorher = (liste.eintraege ?? []).length;
liste.eintraege = (liste.eintraege ?? []).filter((e) => e.datei !== DATEI);
const raus = vorher - liste.eintraege.length;

await merklisteAblegen({
  datum: DATUM, appSchluessel: APP, name: liste.name,
  eintraege: liste.eintraege, uebersicht: liste.uebersicht,
  tiktok: liste.tiktok, token: z.blobToken,
});

console.log(`✓ „${DATEI}" abgelehnt.`);
if (raus) console.log('   Instagram-Eintrag entfernt — er geht nicht mehr raus.');
if (tiktokImPosteingang) {
  console.log('   ⚠ Der TikTok-Entwurf liegt schon im Posteingang der App.');
  console.log('     Den muss Josef dort selbst verwerfen — die API kann das nicht.');
}

// Die Datei wegraeumen, wenn kein Kanal sie mehr braucht. Nach dem Ablehnen
// ist das der Normalfall.
if (post.url) {
  if (nochGebraucht({ liste, datei: DATEI })) {
    console.log('   Datei bleibt liegen — ein anderer Kanal ist noch offen.');
  } else {
    // ⚠ `urls` mitgeben, sonst bleibt beim Karussell alles ausser Folie 1 fuer
    // immer liegen. Ablehnen ist der wahrscheinliche Weg fuer ein missratenes
    // Karussell — genau hier faellt das Leck also am ehesten an.
    const folien = Array.isArray(post.urls) ? post.urls.filter(Boolean) : [];
    await aufraeumen({ url: post.url, urls: folien, token: z.blobToken });
    console.log(folien.length >= 2
      ? `   ${folien.length} Folien weggeraeumt.` : '   Datei weggeraeumt.');
  }
}
