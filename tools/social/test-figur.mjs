// Wann die Randfigur mitfaehrt — und wann auf keinen Fall.
//
//   node tools/social/test-figur.mjs
//
// --- Wofuer (21.09.2026) -----------------------------------------------------
//
// Josef: „Ich will einen Prompt fuer eine Figur fuer FullRep (Fitnessmann) und
// fuer Swaply (passende Figur). Und fuer Anigosha soll es der Junge sein. Diese
// sollen immer so am Rand des Bildes sein."
//
// Die Bilder erzeugt Josef. Bis sie da sind, darf die Option NICHT mitfahren —
// ein Generator, der auf eine fehlende Datei zeigt, bricht bei jedem Lauf ab,
// und zwar bei allen fuenf Apps im selben Tageslauf. Deshalb ist die Quelle
// apps.json und nicht eine Tabelle im Code: Solange dort kein `figur` steht,
// aendert sich am Lauf nichts.
//
// ⚠ Die drei Faelle, die hier wirklich zaehlen, sind alle stille Fehlschlaege:
//
//   1. Figur ohne Eintrag -> die Option faehrt trotzdem mit -> jeder Lauf rot.
//   2. Figur auf der App-Schau -> der Generator bricht ab, und im Protokoll
//      steht nur, dass ein Beitrag fehlt.
//   3. Anigosha bekaeme Figur UND Wasserzeichen -> dieselbe Figur zweimal auf
//      einer Karte. Der Generator lehnt das ab; ohne diese Probe faellt es
//      erst im Lauf auf.
//
// ⚠ Geprueft wird die ECHTE `figurArgs` aus motoren.mjs, nicht eine
// abgeschriebene Zweitfassung.

import { figurArgs, aufruf } from './motoren.mjs';
import { ladeApps } from './waehlen.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const bild = (format) => ({ format, medium: 'bild', sprache: 'de', seed: 1, dateiname: 'x', winkel: format });
const reel = (format) => ({ ...bild(format), medium: 'reel' });

// --- 1. Ohne Eintrag in apps.json faehrt nichts mit -------------------------
{
  pruefe('⚠ Keine `figur` in apps.json: die Option bleibt weg',
    figurArgs({}, bild('zitat-karte')).length === 0,
    JSON.stringify(figurArgs({}, bild('zitat-karte'))));

  pruefe('… auch wenn der Eintrag leer ist',
    figurArgs({ figur: '' }, bild('zitat-karte')).length === 0,
    JSON.stringify(figurArgs({ figur: '' }, bild('zitat-karte'))));
}

// --- 2. Mit Eintrag faehrt sie mit ------------------------------------------
{
  const r = figurArgs({ figur: 'junge.png' }, bild('zitat-karte'));
  pruefe('Mit Eintrag: --figur mit Dateinamen',
    r.join(' ') === '--figur junge.png', r.join(' '));
}

// --- 3. Nie auf der App-Schau -----------------------------------------------
//
// Dort zeigt die Karte die App selbst. Beide Generatoren brechen ab, wenn
// beides gesetzt ist — diese Probe haelt den Abbruch von vornherein fern.
{
  pruefe('⚠ app-schau bekommt NIE eine Figur',
    figurArgs({ figur: 'junge.png' }, bild('app-schau')).length === 0,
    JSON.stringify(figurArgs({ figur: 'junge.png' }, bild('app-schau'))));
}

// --- 4. Nie an ein Reel ------------------------------------------------------
//
// Die Reel-Generatoren kennen `--figur` nicht. Ein unbekanntes Argument stuende
// dort still im argv herum: Wirkung null, Ursache unauffindbar — dieselbe
// Falle, vor der der Kommentar zu `--stil` in motoren.mjs warnt.
{
  pruefe('⚠ Ein Reel bekommt NIE eine Figur',
    figurArgs({ figur: 'junge.png' }, reel('fandom')).length === 0,
    JSON.stringify(figurArgs({ figur: 'junge.png' }, reel('fandom'))));
}

// --- 5. Anigosha: die Figur verdraengt das Wasserzeichen --------------------
//
// ⚠ DIE WICHTIGSTE PROBE DER DATEI. Beides zugleich waere dieselbe Figur
// zweimal auf einer Karte, einmal blass hinten und einmal scharf am Rand.
{
  const apps = ladeApps();
  const ohne = aufruf({
    appSchluessel: 'anigosha', app: apps.anigosha, post: bild('zitat-karte'),
    wuerfel: () => 0.5, out: '/tmp/o',
  }).schritte[0].args.map(String);

  pruefe('Ohne Figur: Anigosha traegt weiter das Wasserzeichen',
    ohne.includes('--wz') && !ohne.includes('--figur'),
    ohne.join(' '));

  const mit = aufruf({
    appSchluessel: 'anigosha', app: { ...apps.anigosha, figur: 'junge.png' },
    post: bild('zitat-karte'), wuerfel: () => 0.5, out: '/tmp/o',
  }).schritte[0].args.map(String);

  pruefe('⚠ Mit Figur: --figur statt --wz, nie beides',
    mit.includes('--figur') && !mit.includes('--wz'),
    mit.join(' '));

  const schau = aufruf({
    appSchluessel: 'anigosha', app: { ...apps.anigosha, figur: 'junge.png' },
    post: bild('app-schau'), wuerfel: () => 0.5, out: '/tmp/o',
  }).schritte[0].args.map(String);

  pruefe('App-Schau bekommt weder das eine noch das andere',
    !schau.includes('--figur') && !schau.includes('--wz'), schau.join(' '));
}

// --- 6. FullRep und Swaply reichen sie durch --------------------------------
{
  const apps = ladeApps();
  const f = aufruf({
    appSchluessel: 'fullrep', app: { ...apps.fullrep, figur: 'trainer.png' },
    post: bild('studien-fakt'), wuerfel: () => 0.5, out: '/tmp/o',
  }).schritte[0].args.map(String);
  pruefe('FullRep: --figur kommt am Generator an',
    f.join(' ').includes('--figur trainer.png'), f.join(' '));

  const s = aufruf({
    appSchluessel: 'swaply', app: { ...apps.swaply, figur: 'begleiter.png' },
    post: bild('notfall'), wuerfel: () => 0.5, out: '/tmp/o',
  }).schritte[0].args.map(String);
  pruefe('Swaply: --figur kommt am Generator an',
    s.join(' ').includes('--figur begleiter.png'), s.join(' '));
}

// --- 7. Der Stand von heute -------------------------------------------------
//
// ⚠ Diese Probe faellt um, sobald jemand `figur` in apps.json eintraegt —
// und genau dann MUSS die Datei auch wirklich im App-Repo liegen. Sie ist die
// Erinnerung daran, beides gemeinsam zu tun.
{
  const apps = ladeApps();
  const eingetragen = ['anigosha', 'fullrep', 'swaply'].filter((k) => apps[k].figur);
  pruefe('Heute ist noch keine Figur scharfgeschaltet (Josef erzeugt die Bilder)',
    eingetragen.length === 0,
    eingetragen.length ? `eingetragen: ${eingetragen.join(', ')} — liegen die PNGs wirklich da?` : '—');
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Die Figur faehrt nur mit, wenn sie eingetragen ist — und nie zweimal.');
