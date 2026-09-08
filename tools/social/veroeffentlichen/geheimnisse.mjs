// Welche Zugangsdaten welcher Kanal braucht — und was fehlt.
//
// ⚠ KEIN Schluessel steht in dieser Datei oder sonstwo im Repo. Hier stehen
// nur die NAMEN der Umgebungsvariablen und wo man sie herbekommt. Die Werte
// liegen in GitHub → Settings → Secrets and variables → Actions, dort, wo
// auch die Signierschluessel liegen.
//
// Ein Schluessel, der im Chat oder im Repo landet, gilt als verbrannt und
// muss ersetzt werden.
//
// --- ⚠ JE APP EIGENE ZUGAENGE, NICHT EINE GARNITUR FUER ALLE ----------------
//
// Der erste Entwurf las EIN `FB_SEITEN_ID` fuer alles. Das war falsch, und der
// Fehler waere teuer gewesen: Anigosha, Mahjong Royale und WELLbooked! haben
// je eine EIGENE Facebook-Seite, ein eigenes Instagram-Konto und ein eigenes
// TikTok-Konto. Mit einer gemeinsamen Garnitur waeren alle Beitraege auf
// derselben Seite gelandet — Mahjong-Werbung auf der WELLbooked!-Seite, und
// das faellt erst auf, wenn es draussen ist.
//
// Deshalb tragen die Namen das App-Kuerzel: `FB_SEITEN_ID_ANIGOSHA`,
// `FB_SEITEN_ID_MAHJONG`, `FB_SEITEN_ID_WELLBOOKED`.
//
// --- Was geteilt wird und was nicht ------------------------------------------
//
// GETEILT, weil es je EINE Entwickler-App ist, nicht je Kanal eine:
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET  (eine TikTok-App bedient mehrere
//                                             Konten)
//   BLOB_TOKEN                                (ein Speicher reicht)
//
// JE APP, weil es je App ein eigenes Konto ist:
//   FB_SEITEN_ID_*, FB_SEITEN_TOKEN_*, IG_KONTO_ID_*, TIKTOK_REFRESH_TOKEN_*
//
// --- Ein Geheimnis ist entfallen ---------------------------------------------
//
// Frueher stand hier ein eigenes `IG_TOKEN`. Es gibt keines: Instagram wird
// ueber den Weg „Facebook Login for Business" mit demselben SEITEN-Token
// angesprochen wie die Seite selbst. Zwei Felder mit demselben Wert sind kein
// Komfort, sondern eine Gelegenheit, sie auseinanderlaufen zu lassen.
//
// --- Zwei weitere sind ins Repo gewandert (03.09.2026) -----------------------
//
// `FB_SEITEN_ID_*` und `IG_KONTO_ID_*` sind KEINE Geheimnisse: Jede
// Facebook-Seite zeigt ihre ID oeffentlich, und die Instagram-ID ist ohne
// Token wertlos. Sie stehen deshalb in apps.json unter `meta` — das spart
// zehn Eingaben am Handy und macht die Zuordnung Seite ↔ App im Repo
// nachlesbar. Eine gesetzte Umgebungsvariable gewinnt trotzdem, damit ein
// Testlauf gegen eine andere Seite ohne Aenderung am Repo moeglich bleibt.
// Geheim bleibt allein der Seiten-Token.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'apps.json'), 'utf8'),
);

/** Aus „mahjong" wird „MAHJONG" — das Kuerzel im Namen des Geheimnisses. */
const kuerzel = (appSchluessel) => appSchluessel.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Der im Repo hinterlegte Wert (apps.json → meta), falls es einen gibt. */
const ausRepo = (appSchluessel, feld) => APPS[appSchluessel]?.meta?.[feld];

/** Umgebung schlaegt Repo; sonst der Repo-Wert. */
const wertVon = (name, appSchluessel, feld) => process.env[name] ?? ausRepo(appSchluessel, feld);

/**
 * Die Zugaenge, die ein Kanal FUER EINE BESTIMMTE APP braucht.
 *
 * `holen` ist bewusst Fliesstext und keine Link-Liste: Josef arbeitet vom
 * Handy, und eine Anweisung, die man lesen kann, ist dort mehr wert als ein
 * Link, der in einer App aufgeht.
 */
export function bedarf(kanal, appSchluessel) {
  const K = kuerzel(appSchluessel);

  if (kanal === 'facebook') {
    return [
      {
        name: `FB_SEITEN_ID_${K}`,
        imRepo: ausRepo(appSchluessel, 'fbSeitenId'),
        zweck: `Die Facebook-Seite von ${appSchluessel}`,
        holen: 'Steht in apps.json unter meta.fbSeitenId (oeffentlicher Wert). Fehlt '
          + 'sie dort: Access Token Debugger → „Granulare Bereiche" → pages_show_list '
          + 'listet jede freigegebene Seite mit ID. ⚠ GET /me/accounts kommt LEER '
          + 'zurueck, wenn die Seiten ueber ein Business-Portfolio laufen — die '
          + 'Seite direkt per ID abfragen.',
      },
      {
        name: `FB_SEITEN_TOKEN_${K}`,
        zweck: 'Erlaubt Entwuerfe auf dieser Seite — und traegt auch Instagram',
        holen: 'Graph API Explorer → App WELLapps → Nutzer-Token mit pages_show_list, '
          + 'pages_read_engagement, pages_manage_posts, instagram_basic, '
          + 'instagram_content_publish → im Dialog ALLE Seiten freigeben. Dann '
          + `GET /${ausRepo(appSchluessel, 'fbSeitenId') ?? '<Seiten-ID>'}`
          + '?fields=name,access_token → Feld `access_token`. Vorher im Debugger '
          + 'pruefen, dass der Nutzer-Token ~2 Monate gueltig ist (Business-Login '
          + 'liefert das direkt; steht dort „1 Stunde", erst verlaengern). Nur ein aus '
          + 'einem LANGLEBIGEN Nutzer-Token abgeleiteter Seiten-Token ist unbefristet.',
      },
    ];
  }

  if (kanal === 'instagram') {
    return [
      {
        name: `IG_KONTO_ID_${K}`,
        imRepo: ausRepo(appSchluessel, 'igKontoId'),
        zweck: `Das Instagram-Konto von ${appSchluessel}`,
        holen: 'Steht in apps.json unter meta.igKontoId (oeffentlicher Wert). Fehlt '
          + `sie dort: GET /<Seiten-ID>?fields=instagram_business_account. `
          + 'Einen eigenen Instagram-Token gibt es NICHT — es laeuft ueber den '
          + `Seiten-Token FB_SEITEN_TOKEN_${K}.`,
      },
      {
        name: 'BLOB_TOKEN',
        geteilt: true,
        zweck: 'Legt das Bild oeffentlich ab, damit Instagram es abholen kann',
        holen: 'Vercel → Storage → Blob-Store anlegen → Reiter „.env.local" → Wert von '
          + 'BLOB_READ_WRITE_TOKEN. Auf Hobby kostenlos; bei Ueberschreitung schaltet '
          + 'Vercel ab, statt abzurechnen. Gilt fuer alle Apps zusammen.',
      },
    ];
  }

  if (kanal === 'tiktok') {
    return [
      {
        name: 'TIKTOK_CLIENT_KEY',
        geteilt: true,
        zweck: 'Weist die TikTok-App aus — eine App bedient alle Konten',
        holen: 'developers.tiktok.com → Manage apps → deine App → Basic information',
      },
      {
        name: 'TIKTOK_CLIENT_SECRET',
        geteilt: true,
        zweck: 'Gehoert zum Client Key',
        holen: 'Ebenda. Wird nur EINMAL angezeigt — sofort wegspeichern.',
      },
      {
        name: `TIKTOK_REFRESH_TOKEN_${K}`,
        zweck: `Der Zugang zum TikTok-Konto von ${appSchluessel}`,
        holen: 'Einmalig den OAuth-Ablauf mit Scope video.upload durchlaufen — je '
          + 'Konto einmal. Haelt 365 Tage. ⚠ Den Access-Token NICHT hinterlegen, er '
          + 'haelt nur 24 Stunden; der Code holt sich damit selbst einen frischen.',
      },
    ];
  }

  return [];
}

/** Was fehlt fuer diesen Kanal dieser App? Leere Liste = alles da. */
export function fehlende(kanal, appSchluessel) {
  // Ein Wert gilt als vorhanden, wenn er in der Umgebung ODER im Repo steht.
  return bedarf(kanal, appSchluessel).filter((v) => !process.env[v.name] && !v.imRepo);
}

/**
 * Bericht ueber alle gebrauchten Kombinationen aus App und Kanal.
 *
 * Bewusst LESBAR statt maschinenlesbar: Diese Ausgabe ist das, was Josef auf
 * dem Handy sieht, wenn etwas fehlt. Geteilte Werte werden nur EINMAL
 * aufgefuehrt, sonst stuende BLOB_TOKEN dreimal da und man suchte drei
 * verschiedene Werte, wo es nur einen gibt.
 *
 * @param {Array<{app: string, kanaele: string[]}>} paare
 */
export function bericht(paare) {
  const zeilen = [];
  const schonGenannt = new Set();
  let vollstaendig = true;

  for (const { app, kanaele } of paare) {
    for (const kanal of kanaele) {
      const alle = bedarf(kanal, app);
      const fehlt = fehlende(kanal, app).filter((v) => !schonGenannt.has(v.name));
      const zuPruefen = alle.filter((v) => !(v.geteilt && schonGenannt.has(v.name)));
      if (!zuPruefen.length) continue;

      if (!fehlt.length) {
        zeilen.push(`  ✓ ${app}/${kanal} vollstaendig`);
      } else {
        vollstaendig = false;
        zeilen.push(`  ✗ ${app}/${kanal}`);
        for (const v of fehlt) {
          zeilen.push(`      ${v.name}${v.geteilt ? '   (fuer alle Apps derselbe)' : ''}`);
          zeilen.push(`        wozu:  ${v.zweck}`);
          zeilen.push(`        woher: ${v.holen}`);
        }
      }
      for (const v of alle) if (v.geteilt) schonGenannt.add(v.name);
    }
  }
  return { vollstaendig, text: zeilen.join('\n') };
}

/** Die Werte einer App, gebuendelt — so, wie posten.mjs sie braucht. */
export function zugaenge(appSchluessel) {
  const K = kuerzel(appSchluessel);
  return {
    // IDs: Umgebung schlaegt apps.json → meta. Beide sind oeffentliche Werte.
    fbSeitenId: wertVon(`FB_SEITEN_ID_${K}`, appSchluessel, 'fbSeitenId'),
    // ⚠ Instagram nutzt DENSELBEN Token wie die Seite. Kein eigenes Geheimnis.
    fbToken: process.env[`FB_SEITEN_TOKEN_${K}`],
    igKontoId: wertVon(`IG_KONTO_ID_${K}`, appSchluessel, 'igKontoId'),
    tiktokRefresh: process.env[`TIKTOK_REFRESH_TOKEN_${K}`],
    tiktokKey: process.env.TIKTOK_CLIENT_KEY,
    tiktokSecret: process.env.TIKTOK_CLIENT_SECRET,
    blobToken: process.env.BLOB_TOKEN,
  };
}
