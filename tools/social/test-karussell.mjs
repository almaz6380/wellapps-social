// Karussell-Mechanik: Reihenfolge, Schwelle, Grenzen.
//
//   node tools/social/test-karussell.mjs
//
// Warum es diesen Test gibt: Die drei Dinge, die hier geprueft werden, lassen
// sich nach dem Veroeffentlichen NICHT mehr korrigieren. Ein Karussell mit
// vertauschten Folien bleibt vertauscht; loeschen kann es nur ein Mensch im
// Netzwerk. Commit 3828145 hat sie von Hand gemessen — von Hand gemessen heisst
// beim naechsten Umbau ungemessen.
//
// Geprueft wird die Logik, nicht das Netz: `folienFinden` bekommt eine
// Dateiliste, die Instagram-Grenzen werden gegen den Trockenlauf von
// `karussellAnlegen` gehalten. Es geht nichts raus.

import { folienFinden } from './folien.mjs';
import { karussellAnlegen, KARUSSELL_MIN, KARUSSELL_MAX } from './veroeffentlichen/instagram.mjs';

let gut = 0;
const schlecht = [];

function pruefe(name, bedingung, gemessen) {
  if (bedingung) { gut += 1; return; }
  schlecht.push(`${name}\n      gemessen: ${gemessen}`);
}

const STAMM = 'wellbooked-anruf-de-s12345';

// --- 1. Sechs Folien, Reihenfolge 1 → 6 -------------------------------------
{
  // Bewusst durcheinander in den Ordner gelegt: readdirSync gibt keine
  // garantierte Reihenfolge, und auf manchen Dateisystemen kommt sie
  // tatsaechlich anders heraus als alphabetisch.
  const dateien = [`${STAMM}-3.jpg`, `${STAMM}-1.jpg`, `${STAMM}.txt`,
    `${STAMM}-6.jpg`, `${STAMM}-2.jpg`, `${STAMM}-5.jpg`, `${STAMM}-4.jpg`];
  const f = folienFinden(dateien, STAMM);
  pruefe('sechs Folien werden gefunden', f.length === 6, `${f.length} Folien`);
  pruefe('Reihenfolge 1 → 6',
    f.join() === [1, 2, 3, 4, 5, 6].map((n) => `${STAMM}-${n}.jpg`).join(),
    f.map((x) => x.match(/-(\d+)\.jpg$/)[1]).join('→'));
  pruefe('das Beiblatt ist keine Folie', !f.some((x) => x.endsWith('.txt')), f.join(' '));
}

// --- 2. Zehn Folien: 1→2→…→10, NICHT 1→10→2 ---------------------------------
//
// Das ist der Fall, an dem `sort()` ohne Vergleichsfunktion scheitert. Bei
// sechs Folien faellt er nicht auf, bei zehn schon.
{
  const dateien = Array.from({ length: 10 }, (_, i) => `${STAMM}-${i + 1}.jpg`);
  const zahlen = folienFinden(dateien.slice().reverse(), STAMM)
    .map((x) => Number(x.match(/-(\d+)\.jpg$/)[1]));
  pruefe('zehn Folien numerisch sortiert',
    zahlen.join() === [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].join(), zahlen.join('→'));
  pruefe('10 steht NICHT an zweiter Stelle', zahlen[1] === 2, `an Position 2: ${zahlen[1]}`);
}

// --- 3. Eine Folie ist kein Karussell ---------------------------------------
{
  const f = folienFinden([`${STAMM}-1.jpg`, `${STAMM}.txt`], STAMM);
  pruefe('eine Datei wird gefunden', f.length === 1, `${f.length}`);
  pruefe('eine Datei liegt unter der Schwelle', f.length < KARUSSELL_MIN,
    `${f.length} < ${KARUSSELL_MIN}?`);
}

// --- 4. Nachbardateien duerfen nicht als Folie durchgehen -------------------
//
// `-feed.jpg` und `-story.jpg` schreibt anzeige.py fuer alle anderen Formate;
// `.jpeg` nimmt Instagram fuer Karussells nicht an; ein fremder Stamm gehoert
// zu einem anderen Beitrag desselben Tages.
{
  const dateien = [`${STAMM}-1.jpg`, `${STAMM}-2.jpg`,
    `${STAMM}-1-feed.jpg`, `${STAMM}-feed.jpg`, `${STAMM}-story.jpg`,
    `${STAMM}-3.jpeg`, `wellbooked-tirol-wien-de-s999-1.jpg`];
  const f = folienFinden(dateien, STAMM);
  pruefe('nur die beiden echten Folien', f.length === 2, f.join(' '));
  pruefe('kein -1-feed.jpg', !f.includes(`${STAMM}-1-feed.jpg`), f.join(' '));
  pruefe('kein .jpeg', !f.some((x) => x.endsWith('.jpeg')), f.join(' '));
  pruefe('kein fremder Stamm', !f.some((x) => x.startsWith('wellbooked-tirol')), f.join(' '));
}

// --- 5. Ein Stamm mit Regex-Zeichen darf nicht danebengreifen ---------------
{
  const s = 'app-a.b+c-de-s1';
  const f = folienFinden([`${s}-1.jpg`, 'app-aXbYc-de-s1-2.jpg'], s);
  pruefe('Punkt und Plus im Stamm werden maskiert',
    f.length === 1 && f[0] === `${s}-1.jpg`, f.join(' '));
}

// --- 6. Instagrams Grenzen, gegen den Trockenlauf ---------------------------
//
// ⚠ `trocken: true` — es geht kein einziger Aufruf ins Netz. Geprueft wird
// allein, ob die Funktion 0, 1 und 11 Folien ablehnt und 2 bis 10 annimmt.
{
  const url = (n) => `https://example.invalid/f${n}.jpg`;
  const versuch = async (anzahl) => {
    try {
      await karussellAnlegen({
        kontoId: '1', token: 'x', text: 'Probe', trocken: true,
        bildUrls: Array.from({ length: anzahl }, (_, i) => url(i + 1)),
      });
      return 'angenommen';
    } catch (e) { return `abgelehnt (${e.message})`; }
  };

  for (const n of [0, 1, KARUSSELL_MAX + 1]) {
    pruefe(`${n} Folien werden abgelehnt`,
      (await versuch(n)).startsWith('abgelehnt'), await versuch(n));
  }
  for (const n of [KARUSSELL_MIN, 6, KARUSSELL_MAX]) {
    pruefe(`${n} Folien werden angenommen`,
      (await versuch(n)) === 'angenommen', await versuch(n));
  }
}

// --- Ergebnis ---------------------------------------------------------------
console.log(`\nKarussell: ${gut} von ${gut + schlecht.length} Faellen gruen.`);
if (schlecht.length) {
  console.error('\n✗ Fehlgeschlagen:');
  for (const z of schlecht) console.error(`   • ${z}`);
  process.exit(1);
}
