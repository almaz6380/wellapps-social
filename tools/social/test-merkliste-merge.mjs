// Das Zusammenfuehren der Merkliste — je KANAL, nicht je Datei.
//
//   node tools/social/test-merkliste-merge.mjs
//
// --- Wofuer ----------------------------------------------------------------
//
// Ein Nachlauf mit `--kanal tiktok` bearbeitet dieselbe Datei wie der Lauf
// davor, aber nur fuer EINEN Kanal. Bis zum 20.09.2026 ersetzte er den
// Eintrag dieser Datei trotzdem komplett — der Instagram-Eintrag fiel weg,
// und ein neuer entstand nicht, weil Instagram gar nicht lief. Der Beitrag
// war damit aus der Freigabe-Seite verschwunden.
//
// Zweimal am selben Tag passiert, beide Male still:
//   Lauf 27 (alle Kanaele) → 13 offen · Lauf 28 (nur tiktok) → 12
//   Lauf 32 (alle Kanaele) → 13 offen · Lauf 33 (nur tiktok) → 12
//
// Der Lauf meldet „Merkliste: 14 Beitraege", nicht „ein Eintrag geloescht".
// Aufgefallen ist es erst, als Josef den Beitrag in der App gesucht hat.
//
// ⚠ Die Logik steht hier ABSICHTLICH ein zweites Mal statt als Import.
// posten.mjs laesst sich nicht importieren, ohne den ganzen Versand zu
// starten (top-level await, Netzzugriff). Faellt dieser Test um, waehrend
// posten.mjs laeuft, sind die beiden auseinandergelaufen — auch das ist ein
// Befund, und zwar einer, den man sehen will.

/** Die Fassung aus posten.mjs, Stand 20.09.2026. */
function zusammenfuehren({ alteListe, posten, eintraege, nurKanaele }) {
  const neueDateien = new Set(posten.map((p) => p.datei));
  const neueSpur = new Map(posten.map((p) => [p.datei, p]));

  const alteUebersicht = [];
  for (const alt of alteListe?.uebersicht ?? []) {
    const neu = neueSpur.get(alt.datei);
    if (!neu) { alteUebersicht.push(alt); continue; }
    neu.kanaele = { ...(alt.kanaele ?? {}), ...(neu.kanaele ?? {}) };
  }

  const instagramLief = nurKanaele.length === 0 || nurKanaele.includes('instagram');
  const alteEintraege = (alteListe?.eintraege ?? [])
    .filter((e) => !(instagramLief && neueDateien.has(e.datei)));

  return {
    uebersicht: [...alteUebersicht, ...posten],
    eintraege: [...alteEintraege, ...eintraege],
  };
}

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const DATEI = 'fullrep-peptid-de-s9030.jpg';
const ANDERE = 'fullrep-studien-fakt-de-s7931.jpg';

// Der Zustand nach einem vollstaendigen Lauf: alle drei Kanaele bedient,
// Instagram wartet auf die Freigabe.
const nachVollLauf = {
  uebersicht: [
    { datei: DATEI, kanaele: { tiktok: { stand: 'fehler' }, facebook: { stand: 'wartet' }, instagram: { stand: 'wartet' } } },
    { datei: ANDERE, kanaele: { tiktok: { stand: 'fertig' }, facebook: { stand: 'wartet' }, instagram: { stand: 'wartet' } } },
  ],
  eintraege: [{ datei: DATEI, text: 'Ipamorelin …' }, { datei: ANDERE, text: 'Studie …' }],
};

// --- 1. Der Fall, der den Fehler ausgeloest hat ------------------------------
{
  const r = zusammenfuehren({
    alteListe: nachVollLauf,
    posten: [{ datei: DATEI, kanaele: { tiktok: { stand: 'fertig' } } }],
    eintraege: [],
    nurKanaele: ['tiktok'],
  });
  const eintrag = r.eintraege.find((e) => e.datei === DATEI);
  pruefe('Nachlauf nur-tiktok: der Instagram-Eintrag BLEIBT',
    Boolean(eintrag), `${r.eintraege.length} Eintraege: ${r.eintraege.map((e) => e.datei).join(', ')}`);
  pruefe('Nachlauf nur-tiktok: der andere Beitrag bleibt unberuehrt',
    r.eintraege.some((e) => e.datei === ANDERE), r.eintraege.map((e) => e.datei).join(', '));
  pruefe('Nachlauf nur-tiktok: die Uebersicht zaehlt weiter zwei Beitraege',
    r.uebersicht.length === 2, `${r.uebersicht.length}`);

  const spur = r.uebersicht.find((p) => p.datei === DATEI);
  pruefe('Nachlauf nur-tiktok: TikTok wird auf den NEUEN Stand gehoben',
    spur.kanaele.tiktok.stand === 'fertig', JSON.stringify(spur.kanaele.tiktok));
  pruefe('Nachlauf nur-tiktok: Facebook und Instagram behalten ihren Stand',
    spur.kanaele.facebook?.stand === 'wartet' && spur.kanaele.instagram?.stand === 'wartet',
    JSON.stringify(spur.kanaele));
}

// --- 2. Die Gegenprobe: ein Lauf MIT Instagram muss ersetzen -----------------
//
// Ohne sie waere der Test von Fall 1 auch dann gruen, wenn gar nichts mehr
// ersetzt wuerde — und dann stuende jeder Beitrag doppelt in der Liste.
{
  const r = zusammenfuehren({
    alteListe: nachVollLauf,
    posten: [{ datei: DATEI, kanaele: { tiktok: { stand: 'fertig' }, instagram: { stand: 'wartet' } } }],
    eintraege: [{ datei: DATEI, text: 'Ipamorelin, neue Fassung' }],
    nurKanaele: [],
  });
  const fuerDatei = r.eintraege.filter((e) => e.datei === DATEI);
  pruefe('Voller Lauf: der Instagram-Eintrag wird ERSETZT, nicht verdoppelt',
    fuerDatei.length === 1, `${fuerDatei.length} Eintraege fuer dieselbe Datei`);
  pruefe('Voller Lauf: es gewinnt der neue Text',
    fuerDatei[0]?.text === 'Ipamorelin, neue Fassung', fuerDatei[0]?.text);
  pruefe('Voller Lauf: die Uebersicht zaehlt weiter zwei Beitraege',
    r.uebersicht.length === 2, `${r.uebersicht.length}`);
}

// --- 3. Nachholen NUR fuer Instagram ----------------------------------------
{
  const r = zusammenfuehren({
    alteListe: nachVollLauf,
    posten: [{ datei: DATEI, kanaele: { instagram: { stand: 'fertig' } } }],
    eintraege: [],
    nurKanaele: ['instagram'],
  });
  pruefe('Nachlauf nur-instagram: der erledigte Eintrag faellt raus',
    !r.eintraege.some((e) => e.datei === DATEI),
    r.eintraege.map((e) => e.datei).join(', ') || '(leer)');
  const spur = r.uebersicht.find((p) => p.datei === DATEI);
  pruefe('Nachlauf nur-instagram: TikTok behaelt seinen alten Stand',
    spur.kanaele.tiktok?.stand === 'fehler', JSON.stringify(spur.kanaele));
}

// --- 4. Erster Lauf des Tages: es gibt nichts zusammenzufuehren --------------
{
  const r = zusammenfuehren({
    alteListe: null,
    posten: [{ datei: DATEI, kanaele: { tiktok: { stand: 'fertig' } } }],
    eintraege: [{ datei: DATEI, text: 'neu' }],
    nurKanaele: [],
  });
  pruefe('Erster Lauf: ein Beitrag, ein Eintrag',
    r.uebersicht.length === 1 && r.eintraege.length === 1,
    `${r.uebersicht.length} / ${r.eintraege.length}`);
}

// --- 5. Ein Beitrag, den dieser Lauf gar nicht anfasst -----------------------
{
  const r = zusammenfuehren({
    alteListe: nachVollLauf,
    posten: [{ datei: 'fullrep-app-schau-de-s44648.jpg', kanaele: { tiktok: { stand: 'fertig' } } }],
    eintraege: [],
    nurKanaele: ['tiktok'],
  });
  pruefe('Fremde Datei: beide alten Eintraege bleiben',
    r.eintraege.length === 2, `${r.eintraege.length}`);
  pruefe('Fremde Datei: die Uebersicht waechst auf drei',
    r.uebersicht.length === 3, `${r.uebersicht.length}`);
}


// --- 6. Was posten.mjs ueberhaupt FINDET ------------------------------------
//
// ⚠ Nicht die Mediendatei entscheidet, sondern das BEIBLATT daneben.
// posten.mjs liest jede `.txt` im Tagesordner und sucht dann `<stamm>.mp4`,
// `<stamm>-feed.jpg` oder `<stamm>.jpg` dazu. Ein Video ohne .txt existiert
// fuer den Versand nicht.
//
// Gemessen in Lauf 37 vom 20.09.2026: Drei Reels wurden gerendert (die Stufe
// „Beitraege erzeugen" brauchte 68 Sekunden statt 6) und standen im Ledger —
// versendet wurde trotzdem nur das Bild, „1 Beitrag aus diesem Lauf". Kein
// Fehler, keine Warnung, der Lauf gruen.
//
// Diese Probe steht hier, weil sie dieselbe Frage stellt wie der Rest der
// Datei: Was ueberlebt den Weg vom Renderer bis in den Kanal?
{
  const ordner = ['fullrep-app-schau-de-s81669.txt', 'fullrep-app-schau-de-s81669.jpg',
    'fullrep-app-schau-reel-de-s81669.mp4'];
  const gefunden = ordner.filter((x) => x.endsWith('.txt'))
    .map((f) => f.replace(/\.txt$/, ''))
    .map((stamm) => ['.mp4', '-feed.jpg', '.jpg'].map((e) => stamm + e).find((n) => ordner.includes(n)))
    .filter(Boolean);
  pruefe('Ein Reel OHNE Beiblatt wird nicht gefunden (der Fehler von Lauf 37)',
    gefunden.length === 1 && gefunden[0].endsWith('.jpg'), gefunden.join(', '));

  const mitBeiblatt = [...ordner, 'fullrep-app-schau-reel-de-s81669.txt'];
  const jetzt = mitBeiblatt.filter((x) => x.endsWith('.txt'))
    .map((f) => f.replace(/\.txt$/, ''))
    .map((stamm) => ['.mp4', '-feed.jpg', '.jpg'].map((e) => stamm + e).find((n) => mitBeiblatt.includes(n)))
    .filter(Boolean);
  pruefe('Mit Beiblatt werden BEIDE gefunden — Bild und Reel',
    jetzt.length === 2 && jetzt.some((x) => x.endsWith('.mp4')) && jetzt.some((x) => x.endsWith('.jpg')),
    jetzt.join(', '));
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Kein Kanal loescht einen anderen, und ein Reel ohne Beiblatt faellt auf.');
