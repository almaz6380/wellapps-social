// Spielt die Ledger-Aenderungen EINES Laufs auf einen neueren Stand ein.
//
//   node tools/social/ledger-einspielen.mjs <basis.json> <unsere.json> <ziel.json>
//
//   basis   der Ledger, wie dieser Lauf ihn ausgecheckt hat
//   unsere  der Ledger nach diesem Lauf
//   ziel    der Ledger, wie er JETZT auf main liegt — wird ueberschrieben
//
// --- Wofuer (23.09.2026) -----------------------------------------------------
//
// Am Abend des 22.09. wurden sieben Tageslaeufe rot, alle an derselben Zeile:
//
//   ! [rejected]        HEAD -> main (fetch first)
//
// Mehrere Laeufe waren innerhalb weniger Sekunden gestartet worden. Jeder hat
// gerendert und versendet — die Beitraege lagen alle in den Kanaelen —, aber
// nur der erste bekam seinen Ledger auf main. Die anderen verloren ihre
// Zeilen. Ein fehlender Ledger-Eintrag heisst: Die Rotation weiss nicht, dass
// der Winkel lief, und zieht ihn bald wieder; und `posten.mjs` findet den
// Beitrag bei einem Nachlauf nicht mehr.
//
// ⚠ Warum kein `git pull --rebase`: Zwei Laeufe haengen ihre Zeilen an
// DIESELBE Stelle, das Ende der Liste. Das ist fuer git ein Konflikt, jedes
// Mal. Und selbst ein sauberer Textmerge waere falsch — ein Tageslauf
// ERSETZT die Zeilen seiner Apps von heute (siehe lauf.mjs, tageslauf()),
// und das sieht git nicht.
//
// ⚠ Deshalb wird nicht der Text gemischt, sondern die ABSICHT des Laufs
// nachgespielt: Was er gegenueber seiner Basis entfernt hat, fliegt auch aus
// dem neuen Stand; was er hinzugefuegt hat, kommt dazu. Alles, was ein
// anderer Lauf inzwischen geschrieben hat, bleibt unangetastet. So traegt es
// jede Art von Lauf (Tageslauf, Nachlauf, freie Karte), ohne dass diese Datei
// ihre Regeln kennen muss.
//
// ⚠ Zeilen werden als MENGE MIT VIELFACHHEIT verglichen, nicht als Menge.
// Der Ledger kann dieselbe Zeile zweimal tragen (zwei Laeufe mit demselben
// Seed); eine einfache Menge wuerde beim Entfernen beide treffen.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Feste Feldreihenfolge, damit dieselbe Zeile immer denselben Schluessel hat
// — auch wenn ein Werkzeug die Felder einmal anders anordnet.
const schluessel = (z) => JSON.stringify(Object.keys(z).sort().map((k) => [k, z[k]]));

function zaehle(zeilen) {
  const m = new Map();
  for (const z of zeilen) {
    const k = schluessel(z);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function einspielen(basis, unsere, ziel) {
  const vorher = zaehle(basis.zeilen);
  const nachher = zaehle(unsere.zeilen);

  // Was dieser Lauf entfernt hat, je Zeile mit Anzahl.
  const weg = new Map();
  for (const [k, n] of vorher) {
    const rest = n - (nachher.get(k) ?? 0);
    if (rest > 0) weg.set(k, rest);
  }

  const zeilen = [];
  for (const z of ziel.zeilen) {
    const k = schluessel(z);
    const n = weg.get(k) ?? 0;
    if (n > 0) { weg.set(k, n - 1); continue; }
    zeilen.push(z);
  }

  // Was dieser Lauf hinzugefuegt hat — in seiner eigenen Reihenfolge, damit
  // der Ledger chronologisch bleibt.
  const neu = new Map();
  for (const [k, n] of nachher) {
    const mehr = n - (vorher.get(k) ?? 0);
    if (mehr > 0) neu.set(k, mehr);
  }
  let dazu = 0;
  for (const z of unsere.zeilen) {
    const k = schluessel(z);
    const n = neu.get(k) ?? 0;
    if (n > 0) { neu.set(k, n - 1); zeilen.push(z); dazu += 1; }
  }

  return { ledger: { ...ziel, zeilen }, dazu, entfernt: ziel.zeilen.length - (zeilen.length - dazu) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [basisPfad, unserePfad, zielPfad] = process.argv.slice(2);
  if (!zielPfad) {
    console.error('Aufruf: node tools/social/ledger-einspielen.mjs <basis.json> <unsere.json> <ziel.json>');
    process.exit(2);
  }
  const lies = (p) => JSON.parse(readFileSync(p, 'utf8'));
  const { ledger, dazu, entfernt } = einspielen(lies(basisPfad), lies(unserePfad), lies(zielPfad));
  writeFileSync(zielPfad, JSON.stringify(ledger, null, 2) + '\n');
  console.log(`Ledger eingespielt: ${dazu} Zeile(n) dazu, ${entfernt} entfernt.`);
}
