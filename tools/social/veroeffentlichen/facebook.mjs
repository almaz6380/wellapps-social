// Facebook-Seite: Beitrag anlegen — als Entwurf ODER sofort oeffentlich.
//
// Von den drei Kanaelen ist das der einfachste: Als einziger kennt Facebook
// unveroeffentlichte Beitraege (`published=false`), und der Unterschied
// zwischen Entwurf und Veroeffentlichung ist genau EIN Feld.
//
// ⚠ `veroeffentlicht: true` heisst SOFORT OEFFENTLICH. Kein Zwischenschritt,
// keine zweite Ansicht, kein Zurueck ausser Loeschen. Ob das gewollt ist,
// entscheidet posten.mjs — dort steht der Schalter und die Begruendung.
//
// ⚠ Facebook nimmt die Datei DIREKT entgegen (multipart `source`). Es braucht
// also keinen oeffentlichen Bild-Host — anders als Instagram, siehe dort.

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * @param {object} o
 * @param {string} o.seitenId
 * @param {string} o.token
 * @param {string} o.datei    Pfad zum Bild oder Video
 * @param {string} o.text     Die Caption
 * @param {boolean} o.veroeffentlicht  true = sofort oeffentlich, false = Entwurf
 * @param {boolean} o.trocken Nur pruefen, nichts senden
 */
export async function entwurfAnlegen({ seitenId, token, datei, text, veroeffentlicht = false, trocken }) {
  const istVideo = /\.(mp4|mov)$/i.test(datei);
  const ziel = `${GRAPH}/${seitenId}/${istVideo ? 'videos' : 'photos'}`;

  if (trocken) {
    return { trocken: true, ziel, art: istVideo ? 'Video' : 'Bild',
      zeichen: text.length, veroeffentlicht };
  }

  const { readFileSync } = await import('node:fs');
  const { basename } = await import('node:path');

  const form = new FormData();
  form.append('access_token', token);
  form.append('published', veroeffentlicht ? 'true' : 'false');
  // Bei Videos heisst das Textfeld `description`, bei Bildern `caption`.
  // Wer das verwechselt, bekommt einen Beitrag ohne Text und keinen Fehler.
  form.append(istVideo ? 'description' : 'caption', text);
  form.append('source', new Blob([readFileSync(datei)]), basename(datei));

  const antwort = await fetch(ziel, { method: 'POST', body: form });
  const daten = await antwort.json();

  if (!antwort.ok) {
    throw new Error(`Facebook ${antwort.status}: ${daten.error?.message ?? JSON.stringify(daten)}`);
  }
  return { id: daten.id ?? daten.post_id, art: istVideo ? 'Video' : 'Bild', veroeffentlicht };
}

/**
 * Mehrere Bilder in EINEM Beitrag — Facebooks Gegenstueck zum Instagram-Karussell.
 *
 * Der Weg ist zweistufig und anders herum als bei Instagram:
 *
 *   1. je Folie POST /{seitenId}/photos mit `published=false` → `media_fbid`
 *   2. POST /{seitenId}/feed mit `message` und `attached_media[i]`
 *
 * ⚠ Schritt 1 ist IMMER `published=false`, auch wenn der Beitrag oeffentlich
 * werden soll. Ein veroeffentlichtes Foto laesst sich nicht mehr anhaengen — es
 * ist dann selbst ein Beitrag. Ob oeffentlich oder Entwurf, entscheidet allein
 * das `published` in Schritt 2.
 *
 * ⚠ Die Bildunterschrift gehoert an den FEED-Beitrag (`message`), nicht an die
 * einzelnen Fotos. Ein `caption` am Foto nimmt Facebook an, sichtbar wird es im
 * Beitrag aber nie — dieselbe Falle wie beim Instagram-Kind-Container.
 *
 * ⚠ Kein Rueckfall auf „dann eben Folie 1". Scheitert einer der Schritte,
 * wirft diese Funktion. Ein Einzelbild mit der Bildunterschrift fuer sechs
 * Folien waere ein halber Beitrag, und ein halber Beitrag ist schlechter als
 * keiner: Der Text verspricht eine Geschichte, die das Bild nicht erzaehlt.
 *
 * @param {object} o
 * @param {string} o.seitenId
 * @param {string} o.token
 * @param {string[]} o.dateien  Pfade zu den Bildern, in Reihenfolge
 * @param {string} o.text       Die Bildunterschrift des Beitrags
 * @param {boolean} o.veroeffentlicht
 * @param {boolean} o.trocken
 */
export async function mehrbildAnlegen({
  seitenId, token, dateien, text, veroeffentlicht = false, trocken,
}) {
  if (!Array.isArray(dateien) || dateien.length < 2) {
    throw new Error(`mehrbildAnlegen braucht mindestens zwei Dateien, bekam ${dateien?.length ?? 0}.`);
  }
  if (dateien.some((d) => /\.(mp4|mov)$/i.test(d))) {
    throw new Error('mehrbildAnlegen nimmt nur Bilder — ein Video gehoert in entwurfAnlegen.');
  }

  if (trocken) {
    return { trocken: true, ziel: `${GRAPH}/${seitenId}/feed`, art: `${dateien.length} Bilder`,
      zeichen: text.length, veroeffentlicht };
  }

  const { readFileSync } = await import('node:fs');
  const { basename } = await import('node:path');

  const ids = [];
  for (const datei of dateien) {
    const form = new FormData();
    form.append('access_token', token);
    form.append('published', 'false');
    form.append('source', new Blob([readFileSync(datei)]), basename(datei));

    const antwort = await fetch(`${GRAPH}/${seitenId}/photos`, { method: 'POST', body: form });
    const daten = await antwort.json();
    if (!antwort.ok || !daten.id) {
      throw new Error(`Facebook ${antwort.status} bei Folie ${ids.length + 1} `
        + `(${basename(datei)}): ${daten.error?.message ?? JSON.stringify(daten)}`);
    }
    ids.push(daten.id);
  }

  const form = new FormData();
  form.append('access_token', token);
  form.append('message', text);
  form.append('published', veroeffentlicht ? 'true' : 'false');
  ids.forEach((id, i) => form.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));

  const antwort = await fetch(`${GRAPH}/${seitenId}/feed`, { method: 'POST', body: form });
  const daten = await antwort.json();
  if (!antwort.ok) {
    // ⚠ Die Fotos aus Schritt 1 liegen jetzt unveroeffentlicht auf der Seite.
    // Sichtbar sind sie nicht, aufraeumen laesst sich das nur von Hand — die
    // IDs stehen deshalb in der Meldung.
    throw new Error(`Facebook ${antwort.status} beim Beitrag: `
      + `${daten.error?.message ?? JSON.stringify(daten)}\n`
      + `   ${ids.length} unveroeffentlichte Fotos bleiben liegen: ${ids.join(', ')}`);
  }
  return { id: daten.id ?? daten.post_id, art: `${dateien.length} Bilder`, veroeffentlicht };
}
