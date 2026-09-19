// TikTok: Video in den Entwurfs-Posteingang des Kontos laden.
//
// ⚠ EINE STELLE, DIE HIER SCHON EINMAL FALSCH STAND (korrigiert 07.09.2026).
//
// Aus TikToks Doku zum DIREKTVERSAND:
//
//     „all content uploaded via this endpoint will be restricted to
//      private viewing mode."
//
// „this endpoint" ist Direct Post — NICHT der Posteingang, den wir benutzen.
// Hier stand bis zum 07.09. die Verallgemeinerung „jeder automatisch gepostete
// Clip ist privat", und die ist so nicht belegt: Die Doku zu
// `/v2/post/publish/inbox/video/init/` sagt dazu gar nichts. Sie sagt nur:
// „users must click on inbox notifications to continue the editing flow in
// TikTok and complete the post."
//
// **Was daraus folgt und was nicht.** Ein Entwurf, den ein Mensch in der App
// fertigstellt, ist allem Anschein nach ein gewoehnlicher Beitrag. Bewiesen
// ist das nicht — das sagt erst der erste veroeffentlichte Entwurf. Wer es
// wissen will, sieht nach dem Posten im Profil nach, ob der Beitrag oeffentlich
// steht.
//
// Der Weg ueber den Posteingang bleibt trotzdem der richtige, aber aus einem
// anderen Grund als dem hier frueher genannten: Ein Mensch soll den letzten
// Schritt ohnehin tun (siehe posten.mjs). Die Pruefung braucht es erst, wenn
// das WEGFALLEN soll — dann greift beim Direktversand die Sperre oben wirklich.
//
// TikTok nimmt die Datei direkt entgegen (FILE_UPLOAD), es braucht also
// keinen oeffentlichen Host. Der zweite Weg (PULL_FROM_URL) verlangt eine bei
// TikTok verifizierte Domain und faellt damit ohnehin aus.

const API = 'https://open.tiktokapis.com/v2';

/**
 * Holt einen frischen Access-Token.
 *
 * ⚠ WARUM DAS NOETIG IST: TikToks Access-Token haelt laut Doku „24 hours after
 * initial issuance". Ein fest in den Secrets hinterlegter Token waere am
 * naechsten Tag tot — und der Fehler saehe aus wie ein Zugangsproblem, nicht
 * wie ein Ablauf. Der Refresh-Token haelt dagegen 365 Tage.
 *
 * ⚠ UND DIE FALLE DARIN — woertlich aus der Doku:
 *
 *     „The returned `refresh_token` may be different than the one passed in
 *      the payload. You must use the newly-returned token if the value is
 *      different than the previous one."
 *
 * Der Refresh-Token kann sich also bei jeder Erneuerung AENDERN. Wer den neuen
 * Wert nicht zurueckschreibt, bei dem laeuft das Ganze genau einmal und
 * scheitert danach mit einer Meldung, die nach einem widerrufenen Zugang
 * aussieht. Deshalb meldet diese Funktion eine Rotation ausdruecklich zurueck
 * (`neuerRefresh`), statt sie zu verschlucken.
 */
export async function frischerToken({ clientKey, clientSecret, refreshToken }) {
  const antwort = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const daten = await antwort.json();

  if (!antwort.ok || !daten.access_token) {
    throw new Error(`TikTok (Token erneuern) ${antwort.status}: `
      + `${daten.error_description ?? daten.error ?? JSON.stringify(daten).slice(0, 300)}`);
  }

  return {
    token: daten.access_token,
    // null, wenn TikTok denselben zurueckgibt — nur eine echte Aenderung ist
    // eine Rotation, und nur die muss jemand irgendwo nachtragen.
    neuerRefresh: daten.refresh_token && daten.refresh_token !== refreshToken
      ? daten.refresh_token : null,
    haeltNoch: daten.expires_in,
  };
}

/**
 * Was das Konto beim Direktversand ueberhaupt darf.
 *
 * ⚠ Dieser Aufruf ist NICHT optional. TikTok verlangt ihn vor jedem
 * Direktversand, und der `privacy_level`, den wir gleich mitschicken, MUSS aus
 * dieser Antwort stammen — sonst antwortet die API mit
 * `privacy_level_option_mismatch`. Er ist zugleich die einzige ehrliche
 * Auskunft darueber, ob das Konto ueberhaupt oeffentlich posten darf.
 */
export async function kontoAuskunft({ token }) {
  const antwort = await fetch(`${API}/post/publish/creator_info/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
  });
  const daten = await antwort.json();
  if (!antwort.ok || daten.error?.code !== 'ok') {
    throw new Error(`TikTok (Kontoauskunft) ${antwort.status}: `
      + `${daten.error?.message ?? JSON.stringify(daten).slice(0, 300)}`);
  }
  return daten.data;
}

/**
 * Direktversand: das Video geht OHNE Zutun eines Menschen auf das Konto.
 *
 * ⚠ Das braucht den Scope `video.publish` — `video.upload` (Posteingang)
 * genuegt NICHT. Und aus TikToks Doku, hier woertlich zutreffend:
 *
 *     „All content posted by unaudited clients will be restricted to private
 *      viewing mode."
 *
 * Solange die App nicht geprueft ist, bleibt ein so gepostetes Video also
 * privat — und bei einem oeffentlichen Konto kommt nicht einmal das, sondern
 * der Fehler `unaudited_client_can_only_post_to_private_accounts`.
 *
 * Anders als beim Posteingang ist die Sperre hier real. Deshalb steht dieser
 * Weg in posten.mjs auf einem Schalter, der erst nach der Freigabe umgelegt
 * wird.
 */
export async function direktPosten({ token, datei, titel, wahl, trocken }) {
  const { statSync, readFileSync } = await import('node:fs');
  const groesse = statSync(datei).size;

  // TikTok schneidet laengere Beschreibungen ab; lieber selbst und sichtbar.
  const text = String(titel ?? '').slice(0, 2200);

  // ⚠ Ein Trockenlauf fasst das Netz nicht an. Sonst braeuchte er einen
  // gueltigen Token, um zu sagen, was er tun WUERDE — und scheiterte auf
  // einem Rechner ohne Zugangsdaten an etwas, das gar nicht sein Thema ist.
  if (trocken) {
    return { trocken: true, groesse, mb: (groesse / 1024 / 1024).toFixed(1),
      zeichen: text.length, wahl };
  }

  // ⚠ Die Wahl kommt vom Menschen, nicht aus dem Code. TikToks Richtlinie
  // verlangt das ausdruecklich: Der Creator waehlt die Privatsphaere-Stufe
  // selbst, ohne Voreinstellung. Ein hier fest eingetragener Wert waere
  // genau der Verstoss, wegen dem die Pruefung fehlschlaegt.
  if (!wahl?.privacy) {
    throw new Error('Ohne gewaehlte Privatsphaere-Stufe wird nicht gepostet. '
      + 'Sie muss aus der Oberflaeche kommen — TikTok verbietet eine Voreinstellung.');
  }

  // ⚠ NOCH EINMAL fragen, unmittelbar vor dem Posten. Die Oberflaeche hat die
  // Auswahl aus einer Auskunft von vorhin gebaut; aendert der Nutzer inzwischen
  // seine Kontoeinstellungen, antwortet TikTok sonst mit
  // `privacy_level_option_mismatch` — und die Meldung sagt nicht, warum.
  const auskunft = await kontoAuskunft({ token });
  const moeglich = auskunft.privacy_level_options ?? [];
  if (!moeglich.includes(wahl.privacy)) {
    throw new Error(`TikTok laesst „${wahl.privacy}" fuer dieses Konto nicht (mehr) zu `
      + `(moeglich: ${moeglich.join(', ') || 'nichts'}). Nichts gepostet.`);
  }

  const init = await fetch(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: text,
        privacy_level: wahl.privacy,
        // ⚠ Umgekehrte Logik, und das ist eine echte Falle: In der Oberflaeche
        // heisst das Haekchen „Kommentare erlauben", die API kennt aber
        // `disable_comment`. Wer das eins zu eins durchreicht, schaltet genau
        // das ab, was der Nutzer angehakt hat.
        disable_comment: !wahl.kommentare,
        disable_duet: !wahl.duett,
        disable_stitch: !wahl.stitch,
        // Werbekennzeichnung. Beide standardmaessig aus; `brand_content_toggle`
        // ist bezahlte Partnerschaft, `brand_organic_type` die eigene Marke.
        brand_content_toggle: Boolean(wahl.fremdeMarke),
        brand_organic_type: Boolean(wahl.eigeneMarke),
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: groesse,
        chunk_size: groesse,
        total_chunk_count: 1,
      },
    }),
  });
  const initDaten = await init.json();
  if (!init.ok || initDaten.error?.code !== 'ok') {
    throw new Error(`TikTok (Direktversand init) ${init.status}: `
      + `${initDaten.error?.message ?? JSON.stringify(initDaten).slice(0, 300)}`);
  }

  const { upload_url: url, publish_id: id } = initDaten.data;
  const hoch = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(groesse),
      'Content-Range': `bytes 0-${groesse - 1}/${groesse}`,
    },
    body: readFileSync(datei),
  });
  if (!hoch.ok) {
    throw new Error(`TikTok (Direktversand Upload) ${hoch.status}: `
      + `${(await hoch.text()).slice(0, 200)}`);
  }

  return { publishId: id, mb: (groesse / 1024 / 1024).toFixed(1), zeichen: text.length };
}

/**
 * Laedt ein Video in den Entwurfs-Posteingang.
 *
 * Zwei Schritte: Upload-Adresse anfordern, dann die Datei dorthin schieben.
 * TikTok verlangt beim ersten Schritt die exakte Dateigroesse — sie muss mit
 * dem uebereinstimmen, was danach ankommt, sonst bricht der zweite Schritt ab.
 */
export async function inPosteingang({ token, datei, trocken }) {
  const { statSync, readFileSync } = await import('node:fs');
  const groesse = statSync(datei).size;

  if (trocken) {
    return { trocken: true, groesse, mb: (groesse / 1024 / 1024).toFixed(1) };
  }

  const init = await fetch(`${API}/post/publish/inbox/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: groesse,
        // In einem Stueck hochladen. Eine Stueckelung waere erst bei sehr
        // grossen Dateien noetig; unsere Reels liegen bei rund 0,3 MB.
        chunk_size: groesse,
        total_chunk_count: 1,
      },
    }),
  });
  const initDaten = await init.json();
  if (!init.ok || initDaten.error?.code !== 'ok') {
    throw new Error(`TikTok (init) ${init.status}: `
      + `${initDaten.error?.message ?? JSON.stringify(initDaten)}`);
  }

  const { upload_url: url, publish_id: id } = initDaten.data;
  const bytes = readFileSync(datei);

  const hoch = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(groesse),
      'Content-Range': `bytes 0-${groesse - 1}/${groesse}`,
    },
    body: bytes,
  });
  if (!hoch.ok) {
    throw new Error(`TikTok (Upload) ${hoch.status}: ${(await hoch.text()).slice(0, 200)}`);
  }

  return { publishId: id, mb: (groesse / 1024 / 1024).toFixed(1) };
}

/** Hoechstens so viele Fotos je Beitrag — TikToks Grenze, nicht unsere. */
export const FOTO_MAX = 35;

/**
 * Einen FOTO-Beitrag anlegen: ein Einzelbild oder ein Wischstreifen.
 *
 * ⚠ Bis zum 19.09.2026 stand im Repo, TikTok-Fotobeitraege seien „ungeprueft".
 * Der Grund war kein Befund, sondern ein abgebrochener Versuch: Chromium kommt
 * aus einer Cloud-Sitzung nicht ins Netz, und `curl` ohne `-L` bekam von
 * developers.tiktok.com nur eine 302. Mit `-L` und einem Browser-User-Agent
 * kommt die Seite `content-posting-api-reference-photo-post` sehr wohl. Alles
 * unten steht dort.
 *
 * --- Worin sich Fotos vom Video unterscheiden -------------------------------
 *
 *   Endpunkt    /post/publish/content/init/   (nicht .../video/init/)
 *   media_type  nur PHOTO
 *   Quelle      NUR `PULL_FROM_URL`. Einen Dateiupload gibt es fuer Fotos
 *               NICHT — deshalb faellt der ganze zweistufige Weg des Videos
 *               (Upload-Adresse holen, PUT) hier weg.
 *   Grenze      bis zu 35 Bilder, dazu photo_cover_index
 *
 * ⚠ DIE HUERDE STECKT IN EINEM NEBENSATZ DER DOKU: „The URLs must be publicly
 * accessible and VERIFIED BY YOUR APP." Es genuegt nicht, dass eine Adresse
 * oeffentlich erreichbar ist — ihr Praefix muss im Entwicklerportal unter
 * „URL prefix" verifiziert sein, genau wie die Domains fuer den Login. Ist es
 * das nicht, holt TikTok das Bild gar nicht erst ab.
 *
 * @param {object} o
 * @param {string} o.token
 * @param {string[]} o.bildUrls  oeffentliche Adressen, in Reihenfolge
 * @param {string} o.titel
 * @param {string} [o.beschreibung]
 * @param {object} [o.wahl]      nur bei `direkt`: Privatsphaere und Haekchen
 * @param {boolean} [o.direkt]   true = DIRECT_POST, false = Posteingang
 * @param {boolean} [o.trocken]
 */
export async function fotoPosten({
  token, bildUrls, titel, beschreibung, wahl, direkt = false, trocken,
}) {
  const bilder = (bildUrls ?? []).filter(Boolean);
  if (!bilder.length) throw new Error('fotoPosten ohne Bildadresse.');
  if (bilder.length > FOTO_MAX) {
    throw new Error(`${bilder.length} Bilder — TikTok nimmt hoechstens ${FOTO_MAX}.`);
  }
  // ⚠ Nur http(s). Ein lokaler Pfad waere hier der naheliegende Fehler, und
  // TikTok meldete darauf nur, es habe nichts abholen koennen.
  const schlecht = bilder.find((u) => !/^https:\/\//i.test(u));
  if (schlecht) {
    throw new Error(`Bildadresse ist keine https-Adresse: ${String(schlecht).slice(0, 80)}. `
      + 'TikTok holt die Bilder selbst ab; ein Dateiupload ist fuer Fotos nicht vorgesehen.');
  }

  const text = String(titel ?? '').slice(0, 2200);
  const rumpf = {
    media_type: 'PHOTO',
    post_mode: direkt ? 'DIRECT_POST' : 'MEDIA_UPLOAD',
    post_info: {
      title: text,
      ...(beschreibung ? { description: String(beschreibung).slice(0, 4000) } : {}),
    },
    source_info: {
      source: 'PULL_FROM_URL',
      photo_images: bilder,
      // Die erste Folie ist das Titelbild — dieselbe Reihenfolge wie bei
      // Instagram und Facebook, wo Folie 1 den Beitrag anfuehrt.
      photo_cover_index: 0,
    },
  };

  if (direkt) {
    // ⚠ Dieselbe Regel wie beim Video: Die Privatsphaere-Stufe kommt vom
    // Menschen, nie aus dem Code. Eine Voreinstellung hier ist genau der
    // Verstoss, an dem TikToks Pruefung scheitert.
    if (!wahl?.privacy) {
      throw new Error('Ohne gewaehlte Privatsphaere-Stufe wird nicht gepostet. '
        + 'Sie muss aus der Oberflaeche kommen — TikTok verbietet eine Voreinstellung.');
    }
    Object.assign(rumpf.post_info, {
      privacy_level: wahl.privacy,
      // Umgekehrte Logik wie beim Video: die Oberflaeche fragt „erlauben",
      // die API kennt `disable_comment`.
      disable_comment: !wahl.kommentare,
      brand_content_toggle: Boolean(wahl.fremdeMarke),
      brand_organic_toggle: Boolean(wahl.eigeneMarke),
      // ⚠ TikTok wuerde hier von sich aus Musik unterlegen. Das widerspricht
      // der Regel `tonspur_muss_leer_sein`: Musik legt Josef selbst darueber,
      // passend zu dem, was gerade laeuft. Also ausdruecklich false, nicht
      // weggelassen — bei einem Feld, das etwas hinzufuegt, ist „nicht
      // gesetzt" keine Aussage, die man nachlesen kann.
      auto_add_music: false,
    });
  }

  if (trocken) return { trocken: true, anzahl: bilder.length, zeichen: text.length, direkt, rumpf };

  if (direkt) {
    // Noch einmal fragen, unmittelbar vor dem Posten — der Nutzer kann seine
    // Kontoeinstellungen seit der Auskunft geaendert haben.
    const auskunft = await kontoAuskunft({ token });
    const moeglich = auskunft.privacy_level_options ?? [];
    if (!moeglich.includes(wahl.privacy)) {
      throw new Error(`TikTok laesst „${wahl.privacy}" fuer dieses Konto nicht (mehr) zu `
        + `(moeglich: ${moeglich.join(', ') || 'nichts'}). Nichts gepostet.`);
    }
  }

  const antwort = await fetch(`${API}/post/publish/content/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(rumpf),
  });
  const daten = await antwort.json();
  if (!antwort.ok || daten.error?.code !== 'ok') {
    // ⚠ Den FEHLERCODE mitgeben, nicht nur die Meldung. Am 16.09. hat genau
    // das zwei Stunden gekostet: `direktPosten` gab „Please review our
    // integration guidelines" aus, und der Code
    // `unaudited_client_can_only_post_to_private_accounts` haette in einem
    // Satz gesagt, dass es am Kontostatus liegt.
    throw new Error(`TikTok (Foto ${direkt ? 'direkt' : 'Posteingang'}) ${antwort.status}: `
      + `${daten.error?.message ?? JSON.stringify(daten).slice(0, 300)}`
      + `${daten.error?.code && daten.error.code !== 'ok' ? ` [${daten.error.code}]` : ''}`);
  }

  return { publishId: daten.data?.publish_id, anzahl: bilder.length, zeichen: text.length, direkt };
}
