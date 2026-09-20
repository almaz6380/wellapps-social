// Was TikToks Rueckmeldung aendern darf — und was nicht.
//
//   node tools/social/test-tiktok-stand.mjs
//
// --- Wofuer ----------------------------------------------------------------
//
// Josef am 20.09.2026: „Kannst du es nicht so machen, dass TikTok eine
// Rueckmeldung gibt?" Seitdem fragt `tiktok-stand.mjs` fuer jede gemerkte
// publish_id nach und schreibt die Antwort in die Merkliste zurueck.
//
// Damit hat die Merkliste zum ersten Mal eine Quelle, die nicht von uns
// stammt — und genau darin liegt die Gefahr. Eine falsch gedeutete Antwort
// aendert nicht die Anzeige, sondern den Stand, auf den die Freigabe-Seite und
// das Archiv bauen.
//
// --- Die zwei Fehler, die hier nicht passieren duerfen ----------------------
//
// ⚠ 1. Ein unbekannter Status darf NICHTS aendern. Die Doku nennt vier Werte;
// was TikTok fuer einen vom Menschen freigegebenen Entwurf antwortet, ist
// nicht dokumentiert. Raten hiesse: eine Zahl behaupten, die niemand gemessen
// hat.
//
// ⚠ 2. `veroeffentlicht` darf nie zurueckgestuft werden. Sonst stuende ein
// geposteter Beitrag wieder offen auf der Freigabe-Seite, und der naechste
// Tipper machte einen zweiten daraus — TikTok hat gegen Doppelposts keine
// Sperre.
//
// ⚠ Hier wird die ECHTE Fassung importiert, nicht eine abgeschriebene. Genau
// deshalb sitzt sie in `veroeffentlichen/tiktok-deutung.mjs` statt in
// `tiktok-stand.mjs`: Das Skript laeuft beim Import los.

import { deutung, darfErsetzen, POST_ID_FELDER }
  from './veroeffentlichen/tiktok-deutung.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

// --- 1. Die vier dokumentierten Statuswerte ---------------------------------

const faelle = [
  ['PUBLISH_COMPLETE heisst veroeffentlicht',
    { status: 'PUBLISH_COMPLETE' }, 'veroeffentlicht'],
  ['SEND_TO_USER_INBOX heisst: liegt als Entwurf da',
    { status: 'SEND_TO_USER_INBOX' }, 'posteingang'],
  ['FAILED heisst Fehler',
    { status: 'FAILED' }, 'fehler'],
  ['PROCESSING_UPLOAD heisst: laeuft noch',
    { status: 'PROCESSING_UPLOAD' }, 'laeuft'],
  ['PROCESSING_DOWNLOAD ebenso — TikTok holt die Bilder noch',
    { status: 'PROCESSING_DOWNLOAD' }, 'laeuft'],
];
for (const [name, antwort, erwartet] of faelle) {
  pruefe(name, deutung(antwort).stand === erwartet,
    `${deutung(antwort).stand}, erwartet ${erwartet}`);
}

// --- 2. Der wichtigste Fall: was wir NICHT kennen ---------------------------

for (const roh of [{ status: 'IRGENDWAS_NEUES' }, { status: '' }, {}, null, undefined]) {
  pruefe(`Unbekannte Antwort ${JSON.stringify(roh)} ergibt „nichts aendern"`,
    deutung(roh).stand === null, String(deutung(roh).stand));
}

// --- 3. Die Beitrags-ID schlaegt jeden Status -------------------------------
//
// ⚠ Sie ist der einzige Beleg, der nicht von unserer Deutung abhaengt: Den
// Beitrag gibt es, er hat eine Nummer. Und genau das ist der Fall, auf den es
// ankommt — ein Entwurf, den ein Mensch in der App freigegeben hat.
for (const feld of POST_ID_FELDER) {
  const antwort = { status: 'SEND_TO_USER_INBOX', [feld]: ['7123456789'] };
  const d = deutung(antwort);
  pruefe(`Mit ${feld} ist der Beitrag veroeffentlicht, auch bei SEND_TO_USER_INBOX`,
    d.stand === 'veroeffentlicht' && d.postIds[0] === '7123456789',
    `${d.stand} / ${JSON.stringify(d.postIds)}`);
}

pruefe('Ein LEERES ID-Feld belegt gar nichts',
  deutung({ status: 'SEND_TO_USER_INBOX', publicaly_available_post_id: [] }).stand === 'posteingang',
  String(deutung({ status: 'SEND_TO_USER_INBOX', publicaly_available_post_id: [] }).stand));

pruefe('Ein ID-Feld, das kein Array ist, kracht nicht',
  deutung({ status: 'FAILED', publicaly_available_post_id: 'kaputt' }).stand === 'fehler',
  String(deutung({ status: 'FAILED', publicaly_available_post_id: 'kaputt' }).stand));

// --- 4. Die Einbahnstrasse ---------------------------------------------------

pruefe('posteingang darf zu veroeffentlicht werden',
  darfErsetzen('posteingang', 'veroeffentlicht') === true,
  String(darfErsetzen('posteingang', 'veroeffentlicht')));

// ⚠ DIE PROBE, die den teuersten Fehler faengt.
pruefe('veroeffentlicht wird NIE wieder posteingang',
  darfErsetzen('veroeffentlicht', 'posteingang') === false,
  String(darfErsetzen('veroeffentlicht', 'posteingang')));

pruefe('veroeffentlicht wird auch nicht fehler',
  darfErsetzen('veroeffentlicht', 'fehler') === false,
  String(darfErsetzen('veroeffentlicht', 'fehler')));

pruefe('Ein unbekannter Stand (null) ersetzt nichts',
  darfErsetzen('posteingang', null) === false,
  String(darfErsetzen('posteingang', null)));

pruefe('Derselbe Stand ist keine Aenderung — sonst schriebe jeder Lauf die Merkliste neu',
  darfErsetzen('posteingang', 'posteingang') === false,
  String(darfErsetzen('posteingang', 'posteingang')));

pruefe('laeuft darf zu fehler werden — ein Upload kann noch scheitern',
  darfErsetzen('laeuft', 'fehler') === true,
  String(darfErsetzen('laeuft', 'fehler')));

pruefe('Ein erfundener Stand wird abgewiesen',
  darfErsetzen('posteingang', 'wunderbar') === false,
  String(darfErsetzen('posteingang', 'wunderbar')));

// --- 5. Die ganze Kette an einem echten Fall --------------------------------
//
// Der Fall, den Josef meint: Der Tageslauf hat den Entwurf in den Posteingang
// geladen, Josef hat ihn in der TikTok-App gepostet, und der naechste
// Stand-Lauf soll das mitbekommen.
{
  const eintrag = { stand: 'posteingang', publishId: 'v_pub_url~v2.123' };
  const antwort = { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['7351'] };
  const d = deutung(antwort);
  if (darfErsetzen(eintrag.stand, d.stand)) eintrag.stand = d.stand;
  pruefe('Ganze Kette: aus dem Entwurf wird ein veroeffentlichter Beitrag',
    eintrag.stand === 'veroeffentlicht', eintrag.stand);

  // Und der zweite Lauf am selben Beitrag darf nichts mehr tun.
  const d2 = deutung({ status: 'SEND_TO_USER_INBOX' });
  pruefe('Ganze Kette: der naechste Lauf ruehrt ihn nicht mehr an',
    darfErsetzen(eintrag.stand, d2.stand) === false,
    `${eintrag.stand} → ${d2.stand}`);
}

// --- 6. Ein Beitrag ohne publish_id -----------------------------------------
//
// Alles, was vor dem 20.09.2026 im Tageslauf hochging, hat keine — `posten.mjs`
// warf sie weg. Diese Beitraege bleiben fuer immer unbekannt, und das Werkzeug
// zaehlt sie getrennt, statt sie als „nichts Neues" durchgehen zu lassen.
{
  const alt = { stand: 'posteingang' };
  pruefe('Ohne publish_id gibt es nichts zu fragen — und nichts zu behaupten',
    !alt.publishId && darfErsetzen(alt.stand, deutung(null).stand) === false, 'ok');
}

// --- 7. Eine gescheiterte Abfrage darf den Beleg nicht wegwischen -----------
//
// ⚠ Das Archiv zaehlt einen TikTok-Beitrag nur, wenn `abfrage.status` da ist
// (`zaehltHier` in freigabe-app/api/freigabe.js). Wuerde eine voruebergehend
// gescheiterte Abfrage die alte Antwort ersetzen statt sie zu ergaenzen,
// verschwaende ein belegter Beitrag wieder aus dem Archiv — wegen eines
// Netzfehlers, nicht wegen einer Aenderung bei TikTok.
//
// ⚠ Die drei Zeilen stehen hier ein zweites Mal: Sie sitzen mitten in der
// Schleife von `tiktok-stand.mjs`, und das Skript laeuft beim Import los.
{
  const k = {
    stand: 'veroeffentlicht',
    abfrage: { status: 'PUBLISH_COMPLETE', postIds: ['7351'], wann: '2026-09-20T18:00:00Z' },
  };
  k.abfrage = { ...(k.abfrage ?? {}), fehler: 'HTTP 500', fehlerWann: '2026-09-21T18:00:00Z' };
  pruefe('Nach einer gescheiterten Abfrage bleibt die alte Antwort stehen',
    k.abfrage.status === 'PUBLISH_COMPLETE' && k.abfrage.fehler === 'HTTP 500',
    JSON.stringify(k.abfrage));

  // Und bei einem Beitrag, der noch nie beantwortet wurde, entsteht kein
  // Status aus dem Nichts.
  const neu = {};
  neu.abfrage = { ...(neu.abfrage ?? {}), fehler: 'HTTP 500', fehlerWann: 'jetzt' };
  pruefe('Eine gescheiterte Erstabfrage erfindet keinen Status',
    neu.abfrage.status === undefined, JSON.stringify(neu.abfrage));
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ TikToks Rueckmeldung hebt den Stand — aber sie senkt ihn nie und raet nie.');
