// Was TikToks Statusantwort fuer uns bedeutet — und wann sie NICHTS bedeutet.
//
// ⚠ Diese Datei steht getrennt von `tiktok-stand.mjs`, damit der Test sie
// WIRKLICH importieren kann. `tiktok-stand.mjs` laeuft beim Import los (es
// liest Merklisten und spricht mit TikTok); ein Test dagegen muesste die
// Logik abschreiben, und abgeschriebene Logik laeuft auseinander. Genau dieses
// Zugestaendnis steht in `test-merkliste-merge.mjs` als Warnung — hier war es
// vermeidbar.

// ⚠ TikTok schreibt dieses Feld in seiner eigenen Doku FALSCH: „publicaly"
// statt „publicly". Beide Schreibweisen werden angenommen. Wer nur auf die
// richtige prueft, misst je nachdem, welche TikTok gerade ausliefert, gar
// nichts — und das saehe aus wie „noch nicht veroeffentlicht".
// ⚠ Und sie steht in der Doku auch noch falsch herum: „publicaly" statt
// „publicly". Beide Schreibweisen werden angenommen. Am 20.09.2026 gemessen
// liefert TikTok die falsche.
export const POST_ID_FELDER = ['publicaly_available_post_id', 'publicly_available_post_id'];

/**
 * Die Beitrags-IDs GENAU aus dem Rohtext holen, statt sie JSON.parse zu
 * ueberlassen.
 *
 * --- ⚠ Warum das sein muss — am 20.09.2026 im ersten echten Lauf gesehen ---
 *
 * TikTok antwortete fuer einen freigegebenen Entwurf:
 *
 *     {"publicaly_available_post_id":[7687305154307182000],"status":"PUBLISH_COMPLETE"}
 *
 * Die drei Nullen am Ende sind kein Zufall. Die ID ist 19-stellig, also
 * groesser als 2^53; `JSON.parse` macht daraus eine Gleitkommazahl und
 * rundet. Gespeichert haetten wir eine Nummer, die auf KEINEN Beitrag zeigt —
 * und niemandem waere es aufgefallen, weil sie wie eine plausible ID aussieht.
 *
 * Deshalb wird der Rohtext noch einmal gelesen und die Ziffernfolge
 * unveraendert als Zeichenkette uebernommen. Das ist derselbe Grund, aus dem
 * Facebook und TikTok ihre IDs ueberall als Strings fuehren.
 *
 * Ohne Rohtext (etwa in einem Test mit fertigem Objekt) bleibt es bei dem,
 * was da ist — dann ist die Genauigkeit eben schon verloren, und so zu tun,
 * als waere sie es nicht, waere die schlechtere Antwort.
 */
export function genaueIds(daten, rohtext) {
  if (!daten || typeof daten !== 'object' || !rohtext) return daten;
  const raus = { ...daten };
  for (const feld of POST_ID_FELDER) {
    if (!Array.isArray(raus[feld])) continue;
    const m = new RegExp(`"${feld}"\\s*:\\s*\\[([^\\]]*)\\]`).exec(rohtext);
    if (!m) continue;
    const genau = m[1].split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
    // Nur uebernehmen, wenn gleich viele herauskommen — sonst hat der
    // Ausdruck etwas anderes erwischt als das Feld, und eine halb ersetzte
    // Liste waere schlimmer als die gerundete.
    if (genau.length === raus[feld].length) raus[feld] = genau;
  }
  return raus;
}

/**
 * Aus TikToks Antwort einen unserer Staende machen — oder ausdruecklich keinen.
 *
 * `stand: null` heisst „unbekannt, nichts aendern". Das ist der wichtigste
 * Rueckgabewert dieser Funktion: Die Doku nennt vier Statuswerte, und was
 * TikTok fuer einen vom Menschen freigegebenen Entwurf antwortet, ist nicht
 * dokumentiert. Ein unbekannter Wert darf deshalb nie zu einer Behauptung
 * werden.
 */
export function deutung(daten) {
  const status = String(daten?.status ?? '').toUpperCase();
  const postIds = POST_ID_FELDER
    .flatMap((f) => (Array.isArray(daten?.[f]) ? daten[f] : []))
    .filter(Boolean)
    .map(String);

  // Eine oeffentliche Beitrags-ID haengt nicht von unserer Deutung ab: Den
  // Beitrag gibt es, er hat eine Nummer. Sie schlaegt jeden Status.
  if (postIds.length) return { stand: 'veroeffentlicht', status, postIds };

  if (status === 'PUBLISH_COMPLETE') return { stand: 'veroeffentlicht', status, postIds };
  if (status === 'FAILED') return { stand: 'fehler', status, postIds };
  if (status === 'SEND_TO_USER_INBOX') return { stand: 'posteingang', status, postIds };
  if (status.startsWith('PROCESSING') || status === 'DOWNLOAD_IN_PROGRESS') {
    return { stand: 'laeuft', status, postIds };
  }
  return { stand: null, status, postIds };
}

/** Die Staende, die wir kennen. */
const BEKANNT = new Set(['fehler', 'laeuft', 'posteingang', 'veroeffentlicht']);

/**
 * Darf der neue Stand den alten ersetzen?
 *
 * ⚠ `veroeffentlicht` ist eine Einbahnstrasse. Deutete eine Antwort einen
 * geposteten Beitrag zurueck auf „im Posteingang", stuende er wieder offen auf
 * der Freigabe-Seite — und jemand postete ihn ein zweites Mal. TikTok hat
 * gegen Doppelposts keine Sperre.
 *
 * Alles andere darf sich in beide Richtungen bewegen: Ein Upload kann erst
 * `laeuft` und dann `fehler` sein.
 */
export function darfErsetzen(alt, neu) {
  if (!neu || !BEKANNT.has(neu)) return false;
  if (alt === neu) return false;
  if (alt === 'veroeffentlicht') return false;
  return true;
}
