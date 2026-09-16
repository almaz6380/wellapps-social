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
