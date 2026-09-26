// Instagram: der Sonderfall unter den dreien.
//
// ⚠ ZWEI EIGENHEITEN, die das ganze Design bestimmen:
//
// 1. INSTAGRAM KENNT KEINEN ENTWURF. Die API ist zweistufig — Container
//    anlegen, dann veroeffentlichen. Ein nicht veroeffentlichter Container
//    ist „bereit zum Absenden", aber in der Instagram-App sieht man davon
//    NICHTS. Wer hier von einem Entwurf spricht, verspricht zu viel.
//
// 2. INSTAGRAM NIMMT KEINE DATEIEN. Aus der Doku woertlich: „We will cURL
//    your image using the passed in URL so it must be on a public server."
//    Das Bild muss also unter einer oeffentlich erreichbaren Adresse liegen,
//    BEVOR der Container entsteht. Facebook und TikTok koennen die Datei
//    direkt schlucken, Instagram nicht.
//
// Daraus folgt der Ablauf: Der Container wird ERST BEIM FREIGEBEN angelegt,
// nicht schon beim naechtlichen Lauf. Grund: Er verfaellt nach 24 Stunden.
// Ein Container, der am Morgen entsteht und am Abend freigegeben wird, kann
// abgelaufen sein — und der Fehler saehe aus wie ein kaputter Zugang.

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Schritt 1: Container anlegen. Gilt 24 Stunden. */
export async function containerAnlegen({ kontoId, token, bildUrl, text, istReel, trocken }) {
  if (trocken) {
    return { trocken: true, bildUrl, art: istReel ? 'REELS' : 'IMAGE', zeichen: text.length };
  }

  const felder = new URLSearchParams({ access_token: token, caption: text });
  if (istReel) { felder.set('media_type', 'REELS'); felder.set('video_url', bildUrl); }
  else felder.set('image_url', bildUrl);

  const antwort = await fetch(`${GRAPH}/${kontoId}/media`, { method: 'POST', body: felder });
  const daten = await antwort.json();
  if (!antwort.ok) {
    throw new Error(`Instagram (Container) ${antwort.status}: `
      + `${daten.error?.message ?? JSON.stringify(daten)}`);
  }
  return { containerId: daten.id };
}

/** Wie viele Folien ein Karussell traegt. Instagrams Grenze, nicht unsere. */
export const KARUSSELL_MAX = 10;
export const KARUSSELL_MIN = 2;

/**
 * Ein Karussell — mehrere Bilder in EINEM Beitrag.
 *
 * Drei Stufen statt zwei, und das ist der ganze Unterschied zum Einzelbild:
 *
 *   1. je Folie ein KIND-Container (`is_carousel_item=true`)
 *   2. ein ELTERN-Container (`media_type=CAROUSEL`, `children=<id>,<id>,…`)
 *   3. veroeffentlichen — mit der Eltern-ID, wie gewohnt
 *
 * ⚠ DIE BILDUNTERSCHRIFT GEHOERT AN DEN ELTERN-CONTAINER, nicht an die
 * Kinder. Ein Kind mit `caption` nimmt Instagram zwar an, sichtbar wird der
 * Text aber nie — man sucht ihn dann im Beitrag und findet nichts.
 *
 * ⚠ Nur JPEG. Steht so in der Doku („JPEG is the only image format
 * supported"), und PNG scheitert nicht beim Anlegen, sondern erst beim
 * Verarbeiten — mit einer Meldung, die nach einem kaputten Server aussieht.
 *
 * ⚠ Die Reihenfolge der Folien ist die Reihenfolge in `bildUrls`. Sie wird
 * hier NICHT sortiert: Wer sortiert, vertauscht irgendwann Folie 10 und
 * Folie 2, weil „10" alphabetisch vor „2" steht.
 *
 * Fuers Kontingent zaehlt ein Karussell als EIN Beitrag, nicht als zehn.
 */
export async function karussellAnlegen({ kontoId, token, bildUrls, text, trocken }) {
  const folien = (bildUrls ?? []).filter(Boolean);
  if (folien.length < KARUSSELL_MIN) {
    throw new Error(`Karussell braucht mindestens ${KARUSSELL_MIN} Folien, hier sind es ${folien.length}. `
      + 'Fuer eine einzelne nimmt man containerAnlegen().');
  }
  if (folien.length > KARUSSELL_MAX) {
    throw new Error(`Instagram nimmt hoechstens ${KARUSSELL_MAX} Folien, hier sind es ${folien.length}.`);
  }

  if (trocken) {
    return { trocken: true, art: 'CAROUSEL', folien: folien.length, zeichen: text.length };
  }

  // --- 1. Kinder -----------------------------------------------------------
  // Nacheinander, nicht parallel: Instagram zaehlt jeden Aufruf aufs
  // Kontingent, und bei einem Fehler will man wissen, WELCHE Folie es war.
  const kinder = [];
  for (const [i, url] of folien.entries()) {
    const felder = new URLSearchParams({
      access_token: token, image_url: url, is_carousel_item: 'true',
    });
    const antwort = await fetch(`${GRAPH}/${kontoId}/media`, { method: 'POST', body: felder });
    const daten = await antwort.json();
    if (!antwort.ok) {
      throw new Error(`Instagram (Folie ${i + 1}/${folien.length}) ${antwort.status}: `
        + `${daten.error?.message ?? JSON.stringify(daten)}`);
    }
    kinder.push(daten.id);
  }

  // --- 2. Eltern -----------------------------------------------------------
  const felder = new URLSearchParams({
    access_token: token, media_type: 'CAROUSEL',
    children: kinder.join(','), caption: text,
  });
  const antwort = await fetch(`${GRAPH}/${kontoId}/media`, { method: 'POST', body: felder });
  const daten = await antwort.json();
  if (!antwort.ok) {
    throw new Error(`Instagram (Karussell-Container) ${antwort.status}: `
      + `${daten.error?.message ?? JSON.stringify(daten)}`);
  }
  return { containerId: daten.id, kinder };
}

/**
 * Schritt 1b: warten, bis der Container fertig verarbeitet ist.
 *
 * ⚠ Nur scheinbar ueberfluessig. Bei einem BILD ist der Container sofort
 * benutzbar; bei einem REEL laedt Instagram das Video erst von der Adresse
 * herunter und kodiert es. Wer sofort veroeffentlicht, bekommt „Media ID is
 * not available" — eine Meldung, die nach einem falschen Container aussieht,
 * obwohl er nur noch nicht fertig ist.
 *
 * Deshalb fragen statt raten: `status_code` ist IN_PROGRESS, FINISHED,
 * ERROR oder EXPIRED.
 */
export async function aufBereitWarten({ containerId, token, maxSekunden = 300 }) {
  const bis = Date.now() + maxSekunden * 1000;
  let zuletzt = 'unbekannt';

  while (Date.now() < bis) {
    const antwort = await fetch(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    const daten = await antwort.json();
    zuletzt = daten.status_code ?? zuletzt;

    if (zuletzt === 'FINISHED') return { bereit: true };
    if (zuletzt === 'ERROR' || zuletzt === 'EXPIRED') {
      throw new Error(`Instagram: Container ${zuletzt} — ${daten.status ?? 'ohne naehere Angabe'}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Instagram: Container nach ${maxSekunden}s noch ${zuletzt}. `
    + 'Nicht veroeffentlicht — lieber gar nichts als ein halber Beitrag.');
}

/** Schritt 2: veroeffentlichen. Erst hier wird der Beitrag sichtbar. */
export async function veroeffentlichen({ kontoId, token, containerId, trocken }) {
  if (trocken) return { trocken: true, containerId };

  const felder = new URLSearchParams({ access_token: token, creation_id: containerId });
  const antwort = await fetch(`${GRAPH}/${kontoId}/media_publish`, { method: 'POST', body: felder });
  const daten = await antwort.json();
  if (!antwort.ok) {
    throw new Error(`Instagram (Veroeffentlichen) ${antwort.status}: `
      + `${daten.error?.message ?? JSON.stringify(daten)}`);
  }
  return { id: daten.id };
}

/**
 * Einen Instagram-Beitrag loeschen (26.09.2026, FullRep-Reel mit falschem Clip).
 *
 * `DELETE /<IG_MEDIA_ID>` — laut Meta-Doku („Instagram API with Facebook
 * Login", Referenz IG Media) fuer Beitraege, Reels und ganze Karussells.
 * ⚠ Unwiderruflich; nur mit ausdruecklich genannter Nummer aufrufen
 * (instagram-loeschen.mjs prueft sie gegen die Merkliste).
 */
export async function beitragLoeschen({ id, token }) {
  if (!/^\d+$/.test(String(id))) throw new Error(`Keine Beitragsnummer: ${id}`);
  const antwort = await fetch(`${GRAPH}/${id}?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  const daten = await antwort.json().catch(() => ({}));
  if (!antwort.ok || daten.success !== true) {
    throw new Error(`Loeschen von ${id} fehlgeschlagen: HTTP ${antwort.status} ${JSON.stringify(daten.error ?? daten).slice(0, 300)}`);
  }
  return true;
}
