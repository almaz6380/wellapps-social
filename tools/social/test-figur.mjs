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

import { figurArgs, aufruf, OHNE_FIGUR, NEUE_FORMATE } from './motoren.mjs';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// --- 3b. Essen ohne Figur, Wissen mit (22.09.2026) --------------------------
//
// Josef: „Essensposts ohne die figur. Die figur bei wissensposts einfügen."
//
// Seit dem 22.09. liegt hinter jeder Rezeptkarte ein Foto des fertigen
// Gerichts. Die Figur stand mitten darin — zwei Motive um dieselbe Flaeche.
//
// ⚠ BEIDE RICHTUNGEN, und die zweite ist die wichtigere. Die Figur von der
// Rezeptkarte zu nehmen ist eine Zeile; sie versehentlich ueberall zu nehmen
// auch. Ohne die Gegenprobe faellt das erst im Feed auf — an einer
// Wissenskarte, auf der ploetzlich niemand mehr steht.
{
  pruefe('⚠ rezept-karte bekommt KEINE Figur — dort ist das Gericht das Motiv',
    figurArgs({ figur: 'trainer.png' }, bild('rezept-karte')).length === 0,
    JSON.stringify(figurArgs({ figur: 'trainer.png' }, bild('rezept-karte'))));

  // Die vier Bildkarten, die bei FullRep Wissen zeigen. Sie stehen NICHT in
  // OHNE_FIGUR — genau das ist hier die Aussage.
  for (const f of ['studien-fakt', 'wissens-karte', 'peptid-karte', 'naehrstoff']) {
    pruefe(`${f} traegt die Figur`,
      figurArgs({ figur: 'trainer.png' }, bild(f)).join(' ') === '--figur trainer.png',
      figurArgs({ figur: 'trainer.png' }, bild(f)).join(' ') || '(nichts)');
  }

  pruefe('Die Ausnahmeliste ist genau {app-schau, rezept-karte}',
    [...OHNE_FIGUR].sort().join() === 'app-schau,rezept-karte', [...OHNE_FIGUR].join());
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
  // ⚠ Den Fall „ohne Figur" AUSDRUECKLICH bauen, nicht aus apps.json nehmen.
  // Seit dem 22.09.2026 steht dort eine Figur; die Probe haette sonst nur
  // geprueft, was gerade eingetragen ist, statt was die Weiche tut.
  const ohneFigur = { ...apps.anigosha };
  delete ohneFigur.figur;
  const ohne = aufruf({
    appSchluessel: 'anigosha', app: ohneFigur, post: bild('zitat-karte'),
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

// --- 6b. Die neuen Formate aus reels-fremd/ (24.09.2026) --------------------
//
// Sie haben keine Figur-Option: ein --figur wuerde still verschluckt. Und
// --out muss ABSOLUT sein, weil das Skript in wellapps-social laeuft, nicht
// im App-Repo — relativ landete die Datei dort, wo posten.mjs nie sucht.
{
  const apps = ladeApps();
  const HIER = dirname(fileURLToPath(import.meta.url));
  for (const [schluessel, { skript, endung }] of Object.entries(NEUE_FORMATE)) {
    const [k, format] = schluessel.split(':');
    const post = { ...bild(format), medium: endung === '.mp4' ? 'reel' : 'bild' };
    const r = aufruf({ appSchluessel: k, app: { ...apps[k], figur: 'x.png' }, post, wuerfel: () => 0.5, out: 'out/social/x' });
    const a = r.schritte[0].args.map(String);
    const out = a[a.indexOf('--out') + 1];
    pruefe(`${schluessel}: eigenes Skript, keine Figur, --out absolut, Endung ${endung}`,
      a[0] === `tools/social/reels-fremd/${skript}` && !a.includes('--figur')
        && out.startsWith('/') && r.endung === endung
        && existsSync(join(HIER, 'reels-fremd', skript)),
      a.join(' '));
  }
}

// --- 7. Was eingetragen ist, muss auch dort liegen ---------------------------
//
// ⚠ DIE PROBE, DIE EINEN ROTEN TAGESLAUF VERHINDERT. Ein `figur`-Eintrag ohne
// Datei laesst den Generator abbrechen — und zwar bei JEDER Bildkarte dieser
// App, im selben Durchgang wie die vier anderen. Der Fehler ist statisch
// pruefbar, also wird er hier geprueft und nicht im Lauf entdeckt.
//
// Bis zum 22.09.2026 stand hier die umgekehrte Probe („noch keine Figur
// scharfgeschaltet"). Sie war die Erinnerung, Eintrag und Datei gemeinsam zu
// machen, und hat ihren Zweck an dem Tag erfuellt.
{
  const apps = ladeApps();
  const ORT = {
    anigosha: 'store-assets/social/figuren',
    fullrep: 'store-assets/social/figuren',
    swaply: 'marketing/social/figuren',
  };
  const fehlend = [];
  for (const [k, ordner] of Object.entries(ORT)) {
    const datei = apps[k]?.figur;
    if (!datei) continue;
    if (!existsSync(join(apps[k].pfad, ordner, datei))) fehlend.push(`${k}/${datei}`);
  }
  pruefe('⚠ Jede eingetragene Figur liegt wirklich im App-Repo',
    fehlend.length === 0, fehlend.length ? `fehlt: ${fehlend.join(', ')}` : '—');

  const scharf = Object.keys(ORT).filter((k) => apps[k]?.figur);
  pruefe('Die drei Figuren sind scharfgeschaltet',
    scharf.length === 3, scharf.join(', ') || 'keine');
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Die Figur faehrt nur mit, wenn sie eingetragen ist — und nie zweimal.');
