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
