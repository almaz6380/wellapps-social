// Der Instagram-Stand steht an ZWEI Orten — hier wird er angeglichen.
//
// ⚠ Warum es zwei Orte gibt: `eintraege` ist die Arbeitsliste („was muss noch
// auf Instagram"), `uebersicht.kanaele` ist die Anzeige („wo steht dieser
// Beitrag ueberall"). Beide werden gebraucht, und beide muessen dasselbe
// sagen. Bis zum 21.09.2026 taten sie das nicht: `freigeben.mjs` schrieb nur
// in `eintraege`.
//
// Die Folgen waren still — die Dateien wurden richtig weggeraeumt
// (`nochGebraucht` liest `eintraege`), nur die Anzeige log: Die
// Freigabe-Seite zeigte einen laengst geposteten Beitrag weiter als offen,
// samt Instagram-Knopf fuer den zweiten Beitrag, und im Archiv fehlte er.
//
// Diese Datei ist die EINE Stelle, die aus einem `eintraege`-Eintrag den
// Kanalstand macht — benutzt beim Veroeffentlichen (freigeben.mjs) und beim
// Nachtragen (instagram-nachtragen.mjs). Zwei Fassungen desselben Objekts
// waren der Anfang des Problems.

/** Der Kanaleintrag, der zu einem veroeffentlichten Instagram-Beitrag gehoert. */
export function instagramKanal({ wann, beitragId = null }) {
  return {
    stand: 'veroeffentlicht',
    wann,
    ...(beitragId ? { beitragId } : {}),
  };
}

/**
 * Traegt in `liste.uebersicht` nach, was `liste.eintraege` schon weiss.
 *
 * ⚠ Es wird nur HOCHGESTUFT, nie zurueck: Ein Beitrag, der laut Uebersicht
 * schon veroeffentlicht ist, wird nicht angefasst. Sonst koennte ein Lauf
 * einen Stand ueberschreiben, den ein anderer Kanal gesetzt hat.
 *
 * Veraendert die Liste und gibt zurueck, was sich geaendert hat.
 */
export function standNachtragen(liste) {
  const geaendert = [];
  let schonRichtig = 0;

  for (const e of liste.eintraege ?? []) {
    if (!e.veroeffentlicht) continue;
    const spur = (liste.uebersicht ?? []).find((p) => p.datei === e.datei);
    if (!spur) continue;
    if (spur.kanaele?.instagram?.stand === 'veroeffentlicht') { schonRichtig += 1; continue; }

    spur.kanaele = {
      ...(spur.kanaele ?? {}),
      instagram: instagramKanal({ wann: e.veroeffentlicht, beitragId: e.beitragId }),
    };
    geaendert.push(e.datei);
  }

  return { geaendert, schonRichtig };
}
