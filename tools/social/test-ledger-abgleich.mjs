// Der Abgleich „schon ausgeliefert ist nicht verloren".
//
//   node tools/social/test-ledger-abgleich.mjs
//
// --- Wofuer --------------------------------------------------------------
//
// Ein zweiter Lauf am selben Tag rendert nur seine eigenen Beitraege. Die vom
// Morgen stehen weiter im Ledger, ihre Dateien liegen aber nicht mehr auf der
// Platte — jeder Workflow-Lauf bekommt einen frischen Container. Am
// 20.09.2026 faerbte das drei Laeufe hintereinander rot, und es wurde mit
// jedem Lauf schlimmer (2 → 4 Beitraege).
//
// posten.mjs gleicht solche Seeds deshalb gegen die Merkliste im Blob ab.
// Dieser Test haelt die eine Zeile fest, an der das haengt: die Regex, die
// den Seed aus einem Dateinamen holt.
//
// ⚠ Sie steht hier ABSICHTLICH ein zweites Mal statt als Import. posten.mjs
// laesst sich nicht importieren, ohne den ganzen Versand zu starten (Module
// mit top-level await und Netzzugriff). Faellt dieser Test um, waehrend
// posten.mjs laeuft, sind die beiden auseinandergelaufen — auch das ist ein
// Befund.

const SEED_AUS_DATEI = /-s(\d+)(?:[-.]|$)/;
const seedVon = (datei) => SEED_AUS_DATEI.exec(datei ?? '')?.[1] ?? null;

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

// --- Die Formen, die wirklich vorkommen -----------------------------------
//
// ⚠ ZWEI Quellen mit unterschiedlichen Namen:
//   Merkliste  `datei: basename(p.medium)` — der lokale Name, ohne Anhang.
//   Blob       Vercel haengt seit 10.09.2026 einen Zufallsanhang an.
// Der Abgleich muss beide vertragen; welcher wo landet, hat sich schon
// einmal verschoben.
const faelle = [
  ['fullrep-peptid-de-s30218.jpg', '30218', 'Einzelbild, lokal'],
  ['fullrep-peptid-de-s30218-NPNTxed5DOTCevV1irNek6nnWb4AdM.jpg', '30218', 'Einzelbild, Blob-Anhang'],
  ['wellbooked-anruf-de-s3709-1.jpg', '3709', 'Karussell-Folie 1'],
  ['wellbooked-anruf-de-s3709-6.jpg', '3709', 'Karussell-Folie 6'],
  ['wellbooked-anruf-de-s3709-1-J33tZIBgj1YMHRXg0i8jRRSBHsS284.jpg', '3709', 'Karussell + Anhang'],
  ['anigosha-fandom-one_piece-de-s42.mp4', '42', 'Reel'],
  ['mahjong-paar-de-s777', '777', 'ohne Endung'],
];
for (const [datei, erwartet, was] of faelle) {
  const g = seedVon(datei);
  pruefe(`${was}: ${datei}`, g === erwartet, `${g} statt ${erwartet}`);
}

// --- Und was NICHT als Seed durchgehen darf -------------------------------
//
// Ein falscher Treffer ist hier teurer als ein verpasster: Er wuerde einen
// echten Verlust als „schon ausgeliefert" abhaken — genau den Alarm, fuer
// den es diese Pruefung gibt.
for (const [datei, was] of [
  ['ohne-seed.jpg', 'kein Seed im Namen'],
  ['seltsam-s12ab.jpg', 'Buchstaben direkt hinter der Zahl'],
  ['', 'leerer Name'],
  [undefined, 'gar kein Name'],
]) {
  const g = seedVon(datei);
  pruefe(`kein Treffer bei ${was}`, g === null, String(g));
}

// --- Der Abgleich selbst ---------------------------------------------------
{
  const uebersicht = [
    { datei: 'fullrep-peptid-de-s30218.jpg' },
    { datei: 'fullrep-studien-fakt-de-s97432.jpg' },
  ];
  const geliefert = new Set();
  for (const e of uebersicht) {
    const t = seedVon(e.datei);
    if (t) geliefert.add(`fullrep:${t}`);
  }
  const verloren = [
    { app: 'fullrep', seed: '30218' },  // steht in der Merkliste
    { app: 'fullrep', seed: '97432' },  // steht in der Merkliste
    { app: 'fullrep', seed: '11111' },  // steht NICHT drin → echter Verlust
  ].filter((f) => !geliefert.has(`${f.app}:${f.seed}`));

  pruefe('zwei ausgelieferte fallen weg, einer bleibt',
    verloren.length === 1 && verloren[0].seed === '11111',
    JSON.stringify(verloren));
}

console.log(`\n${schlecht.length ? '✗' : '✓'} ${gut} von ${gut + schlecht.length} bestanden`);
for (const s of schlecht) console.log(`   ✗ ${s}`);
process.exit(schlecht.length ? 1 : 0);
