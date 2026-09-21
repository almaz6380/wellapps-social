// Der Instagram-Stand steht an zwei Orten — sagen sie dasselbe?
//
//   node tools/social/test-instagram-stand.mjs
//
// --- Wofuer (21.09.2026) -----------------------------------------------------
//
// Beim Nachzaehlen nach dem grossen Aufraeumlauf fielen zwei Anigosha-Beitraege
// auf, die als „offen" dastanden, obwohl sie laengst auf Instagram waren
// (14:33 und 16:20 desselben Tages):
//
//     eintraege:  veroeffentlicht 2026-09-21T16:20:07.377Z
//     kanaele:    { instagram: { stand: 'wartet' } }
//
// `freigeben.mjs` schrieb das Ergebnis nur in `eintraege`. Die Uebersicht —
// das, was die Freigabe-Seite anzeigt — erfuhr nie davon.
//
// ⚠ Der Fehler war unsichtbar, weil der GEFAEHRLICHE Pfad richtig lag:
// `nochGebraucht` liest `eintraege`, die Dateien wurden also korrekt
// weggeraeumt. Falsch war nur, was Josef sah — und genau deshalb hat es
// wochenlang niemand bemerkt:
//
//   · Der Beitrag stand weiter in der offenen Liste, MIT Instagram-Knopf.
//     Ein zweiter Druck haette ihn ein zweites Mal gepostet; Instagram hat
//     dagegen keine Sperre.
//   · Im Archiv („Gepostet") fehlte er, weil `zaehltHier` `kanaele` liest.
//
// Merksatz: Eine Tatsache an zwei Orten laeuft auseinander. Wenn beide Orte
// gebraucht werden, muss EINE Stelle sie setzen — das ist instagram-stand.mjs,
// und das hier ist ihre Probe.

import { instagramKanal, standNachtragen } from './instagram-stand.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

// --- 1. Der Fall, der den Fehler ausgeloest hat -----------------------------
{
  const liste = {
    eintraege: [
      { datei: 'a.jpg', veroeffentlicht: '2026-09-21T16:20:07.377Z', beitragId: '178…' },
      { datei: 'b.jpg' },
    ],
    uebersicht: [
      { datei: 'a.jpg', kanaele: { instagram: { stand: 'wartet' } } },
      { datei: 'b.jpg', kanaele: { instagram: { stand: 'wartet' } } },
    ],
  };
  const r = standNachtragen(liste);

  pruefe('Der veroeffentlichte wird nachgetragen',
    r.geaendert.length === 1 && r.geaendert[0] === 'a.jpg',
    JSON.stringify(r.geaendert));

  pruefe('… mit Zeitpunkt und Beitrags-ID aus dem Eintrag',
    liste.uebersicht[0].kanaele.instagram.stand === 'veroeffentlicht'
      && liste.uebersicht[0].kanaele.instagram.wann === '2026-09-21T16:20:07.377Z'
      && liste.uebersicht[0].kanaele.instagram.beitragId === '178…',
    JSON.stringify(liste.uebersicht[0].kanaele));

  pruefe('⚠ Der NICHT veroeffentlichte bleibt auf wartet',
    liste.uebersicht[1].kanaele.instagram.stand === 'wartet',
    JSON.stringify(liste.uebersicht[1].kanaele));
}

// --- 2. Andere Kanaele bleiben unangetastet ---------------------------------
//
// `kanaele` wird zusammengefuehrt, nicht ersetzt. Wer hier zuweist statt zu
// mischen, loescht den TikTok-Stand samt publishId.
{
  const liste = {
    eintraege: [{ datei: 'a.jpg', veroeffentlicht: '2026-09-21T10:00:00Z' }],
    uebersicht: [{
      datei: 'a.jpg',
      kanaele: {
        facebook: { stand: 'wartet' },
        tiktok: { stand: 'posteingang', publishId: 'p_inbox_url~v2.768…' },
      },
    }],
  };
  standNachtragen(liste);
  const k = liste.uebersicht[0].kanaele;

  pruefe('⚠ TikTok behaelt Stand UND publishId',
    k.tiktok.stand === 'posteingang' && k.tiktok.publishId === 'p_inbox_url~v2.768…',
    JSON.stringify(k.tiktok));
  pruefe('Facebook bleibt, wie es war',
    k.facebook.stand === 'wartet', JSON.stringify(k.facebook));
  pruefe('Instagram kommt dazu, auch wenn es vorher gar nicht drinstand',
    k.instagram.stand === 'veroeffentlicht', JSON.stringify(k.instagram));
}

// --- 3. Nur hochstufen, nie zurueck -----------------------------------------
{
  const liste = {
    eintraege: [{ datei: 'a.jpg', veroeffentlicht: '2026-09-21T10:00:00Z' }],
    uebersicht: [{
      datei: 'a.jpg',
      kanaele: { instagram: { stand: 'veroeffentlicht', wann: '2026-09-20T08:00:00Z', beitragId: 'alt' } },
    }],
  };
  const r = standNachtragen(liste);

  pruefe('Ein schon richtiger Stand wird nicht ueberschrieben',
    r.geaendert.length === 0 && r.schonRichtig === 1
      && liste.uebersicht[0].kanaele.instagram.beitragId === 'alt',
    JSON.stringify(liste.uebersicht[0].kanaele));
}

// --- 4. Zweimal laufen aendert nichts ---------------------------------------
{
  const liste = {
    eintraege: [{ datei: 'a.jpg', veroeffentlicht: '2026-09-21T10:00:00Z' }],
    uebersicht: [{ datei: 'a.jpg', kanaele: { instagram: { stand: 'wartet' } } }],
  };
  standNachtragen(liste);
  const vorher = JSON.stringify(liste);
  const zweiter = standNachtragen(liste);

  pruefe('Zweiter Lauf: nichts geaendert, nichts doppelt',
    zweiter.geaendert.length === 0 && JSON.stringify(liste) === vorher,
    JSON.stringify(zweiter));
}

// --- 5. Loecher in den Daten brechen nichts ---------------------------------
//
// Eine Merkliste kann einen Eintrag ohne Gegenstueck in der Uebersicht haben
// (eine abgelehnte wurde dort entfernt) oder gar keine Uebersicht.
{
  const ohneSpur = {
    eintraege: [{ datei: 'weg.jpg', veroeffentlicht: '2026-09-21T10:00:00Z' }],
    uebersicht: [],
  };
  let warf = null;
  try { standNachtragen(ohneSpur); } catch (e) { warf = e.message; }
  pruefe('Ein Eintrag ohne Uebersichtszeile wird uebergangen, nicht geworfen',
    !warf, warf ?? 'nichts geworfen');

  let warf2 = null;
  try { standNachtragen({}); } catch (e) { warf2 = e.message; }
  pruefe('Eine leere Merkliste ebenso', !warf2, warf2 ?? 'nichts geworfen');
}

// --- 6. Der gemeinsame Kanaleintrag -----------------------------------------
//
// Dieselbe Form beim Veroeffentlichen und beim Nachtragen — zwei Fassungen
// desselben Objekts waren der Anfang des Problems.
{
  const mit = instagramKanal({ wann: 'X', beitragId: '1' });
  const ohne = instagramKanal({ wann: 'X' });
  pruefe('Mit Beitrags-ID: drei Felder',
    mit.stand === 'veroeffentlicht' && mit.wann === 'X' && mit.beitragId === '1',
    JSON.stringify(mit));
  pruefe('Ohne Beitrags-ID: das Feld fehlt, statt null zu sein',
    !('beitragId' in ohne), JSON.stringify(ohne));
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Was auf Instagram draussen ist, steht an beiden Orten gleich.');
