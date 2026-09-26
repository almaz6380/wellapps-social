// Ein Bild oeffentlich ablegen, damit Instagram es abholen kann.
//
// ⚠ Nur Instagram braucht das. Facebook und TikTok nehmen die Datei direkt
// entgegen. Instagram nicht: „We will cURL your image using the passed in URL
// so it must be on a public server."
//
// --- Warum jetzt doch das SDK und nicht der CLI ------------------------------
//
// Hier stand bis zum 05.09.2026 die Begruendung fuer `npx vercel blob put`:
// Das SDK haette ein `npm install` gebraucht, und das raeumt die per
// `--no-save` installierten Pakete (playwright, ffmpeg-static) weg.
//
// Der erste echte Tageslauf hat den CLI-Weg widerlegt. Vercel CLI 59 antwortet
// auf `blob put --rw-token …` mit:
//
//   Error: No existing credentials found. Please run `vercel login` or pass "--token"
//
// Der Blob-Token allein genuegt ihr nicht mehr; sie will zusaetzlich eine
// Konto-Anmeldung. Auf einem Runner gibt es die nicht, und ein weiteres
// Geheimnis nur fuer einen Bild-Upload waere der falsche Preis.
//
// Also `@vercel/blob` als devDependency — damit ist es in package.json und
// `npm ci` bringt es mit. Die alte Sorge bleibt trotzdem richtig und ist im
// Workflow beruecksichtigt: playwright und ffmpeg-static werden NACH `npm ci`
// nachinstalliert, in EINEM Aufruf.
//
// REST/HTTP direkt bleibt ausgeschlossen: Vercel dokumentiert die Route nicht,
// und die API-Version steckt in einem Kopf-Feld, das sich mit dem SDK
// mitbewegt. Nachbauen hiesse wetten, dass sich nichts aendert.
//
// --- Kosten -----------------------------------------------------------------
//
// Auf dem Hobby-Tarif ist Blob im Freibetrag kostenlos, und Vercel rechnet
// Mehrverbrauch NICHT ab, sondern schaltet ab: „You will not pay for any
// additional usage. However, you will not be able to access Vercel Blob if
// limits are exceeded."
//
// Verbrauch hier: acht Bilder taeglich zu je rund 150 kB, also etwa 36 MB im
// Monat gegen 5 GB Freibetrag. Dazu werden die Bilder nach dem Posten wieder
// geloescht (`del()` ist gratis). Der Freibetrag gilt geteilt ueber alle
// Vercel-Dienste des Kontos — bei diesen Groessen ohne Belang.

import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

import { put, del, list, get, BlobPreconditionFailedError } from '@vercel/blob';

/**
 * Laedt eine Datei oeffentlich hoch und gibt ihre Adresse zurueck.
 *
 * @param {object} o
 * @param {string} o.datei
 * @param {string} o.token   BLOB_TOKEN (Read-Write-Token aus Vercel)
 * @param {string} o.praefix Ordner im Blob-Speicher, z. B. „social/2026-08-30"
 * @param {boolean} o.trocken
 */
export async function hochladen({ datei, token, praefix, trocken }) {
  const pfad = `${praefix}/${basename(datei)}`;
  if (trocken) return { trocken: true, pfad };

  // ⚠ addRandomSuffix seit 10.09.2026 AN. Vorher war der Pfad vorhersagbar
  // (`social/<datum>/<dateiname>`) — wer die Kennung des Speichers kannte,
  // konnte sich jede Adresse zusammenreimen.
  //
  // Ein Passwort ist hier keine Option und wird auch nie eine: Instagram holt
  // die Datei SELBST ab, als anonymer Besucher („We will cURL your image using
  // the passed in URL so it must be on a public server"). Jede Sperre traefe
  // also Instagram. Unerratbar ist damit die Obergrenze des Machbaren.
  //
  // Die alte Begruendung gegen den Anhang („damit `aufraeumen` den Pfad
  // wiederfindet") war falsch: `aufraeumen` bekommt die fertige URL aus der
  // Merkliste, es baut nie einen Pfad zusammen.
  //
  // ⚠ Nebenwirkung: Ein zweiter Lauf ueberschreibt die Datei nicht mehr,
  // sondern legt eine zweite daneben. Weggeraeumt wird die, die in der
  // Merkliste steht; eine verwaiste kostet ein paar Kilobyte. `allowOverwrite`
  // bleibt trotzdem stehen — es schadet nicht und faengt den Fall ab, falls
  // der Anhang einmal ausbleibt.
  //
  // Als Strom, nicht als Puffer: Ein Reel sind vier Megabyte, und die muessen
  // nicht erst vollstaendig in den Speicher.
  const { url, pathname } = await put(pfad, createReadStream(datei), {
    access: 'public',
    token,
    allowOverwrite: true,
    addRandomSuffix: true,
  });
  // ⚠ `pathname` aus der Antwort, nicht der Pfad von oben: Seit dem Anhang
  // unterscheiden sich die beiden. Wer den angefragten zurueckgibt, meldet
  // einen Ort, an dem nichts liegt.
  return { url, pfad: pathname ?? pfad };
}

/**
 * Legt eine Merkliste ab (JSON) und liest sie wieder.
 *
 * ⚠ Warum ueberhaupt eine Liste? Instagram wird nicht im Tageslauf
 * veroeffentlicht, sondern spaeter bei der Freigabe. Dazwischen liegen
 * Stunden und zwei verschiedene Laeufe auf verschiedenen Maschinen. Der
 * Freigabelauf muesste sonst alles neu rendern, nur um an die Bildtexte zu
 * kommen — vier Minuten fuer etwas, das schon fertig war.
 *
 * ⚠ Sie liegt im selben Speicher wie die Bilder und ist damit oeffentlich
 * lesbar. Das ist vertretbar: Sie enthaelt genau das, was ohnehin gleich
 * veroeffentlicht wird — Bildadresse und Bildtext. Zugangsdaten stehen NICHT
 * darin und duerfen dort nie landen.
 *
 * Je App eine eigene Datei, weil posten.mjs je App einmal laeuft; eine
 * gemeinsame wuerde sich beim zweiten Aufruf selbst ueberschreiben.
 */
export async function merklisteAblegen({ datum, appSchluessel, eintraege, uebersicht, tiktok, token, name, ifMatch }) {
  const pfad = `social/${datum}/freigabe-${appSchluessel}.json`;
  // ⚠ `eintraege` ist der Vertrag mit freigeben.mjs und bleibt unangetastet:
  // Dort steht, was Instagram noch offen hat, und dort wird vermerkt, was
  // veroeffentlicht ist. `uebersicht` liegt bewusst DANEBEN statt darin —
  // sie ist nur zum Ansehen (Freigabe-Seite) und darf die Logik, die wirklich
  // etwas veroeffentlicht, nicht beeinflussen. Wer beides vermischt, riskiert
  // beim naechsten Umbau einen doppelten Instagram-Beitrag.
  const inhalt = { datum, app: appSchluessel, name: name ?? appSchluessel, eintraege };
  if (uebersicht) inhalt.uebersicht = uebersicht;
  // Kontoauskunft fuer die TikTok-Oberflaeche der Freigabe-Seite.
  if (tiktok) inhalt.tiktok = tiktok;
  // ⚠ `ifMatch` (26.09.2026): nur schreiben, wenn die Datei seit dem Lesen
  // unveraendert ist. Sonst wirft `put` BlobPreconditionFailedError, und
  // merklisteAendern liest neu. Ohne das gewann, wer zuletzt schrieb.
  const { url } = await put(pfad, JSON.stringify(inhalt, null, 2), {
    access: 'public',
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
    ...(ifMatch ? { ifMatch } : {}),
  });
  return { url, pfad };
}

/**
 * Eine Merkliste AENDERN statt ueberschreiben (26.09.2026).
 *
 * ⚠ Warum es das gibt. `freigeben.mjs` (Instagram), `facebook-posten.mjs` und
 * `ablehnen.mjs` lasen die Merkliste am Anfang und schrieben sie am Ende
 * VOLLSTAENDIG zurueck. Laufen zwei parallel — und die Freigabe-Seite startet
 * Instagram und Facebook genau so, wenn man beide Knoepfe kurz nacheinander
 * tippt —, gewinnt, wer zuletzt schreibt. Am 26.09. zwischen 18:47 und 18:49
 * dreimal gemessen: Instagram las 3 s vor Facebooks Eintrag, schrieb 33 s
 * danach zurueck, und der Facebook-Vermerk war weg. Die Seite zeigte „wartet",
 * und weil genau dieser Vermerk die einzige Sperre gegen einen zweiten
 * Facebook-Beitrag ist, haette der naechste Tipper doppelt gepostet. Josefs
 * Ablehnung einer FullRep-Karte ging im selben Durchgang verloren.
 *
 * Jetzt: unmittelbar vor dem Schreiben FRISCH lesen, nur die eigene Aenderung
 * darauf anwenden, schreiben — und NACHLESEN. Fehlt die eigene Aenderung, hat
 * jemand im Fenster dazwischen geschrieben; dann dasselbe noch einmal (bis zu
 * drei Versuche). Das Fenster schrumpft von „Laufzeit des Werkzeugs" (bis 40 s)
 * auf Lesen+Schreiben (~1 s), und selbst ein Treffer darin wird bemerkt.
 *
 * `aendern(liste)` MUSS idempotent sein (Felder setzen, nichts anhaengen) — es
 * laeuft beim Wiederholen ein zweites Mal. `drin(liste)` sagt, ob die eigene
 * Aenderung in einer gelesenen Fassung steht. `lesen`/`ablegen` sind fuer den
 * Test einspritzbar (test-merkliste-parallel.mjs).
 */
export async function merklisteAendern({
  datum, appSchluessel, token, aendern, drin,
  lesen = async () => (await merklistenLesen({ datum, token })).find((l) => l.app === appSchluessel),
  ablegen = (l) => merklisteAblegen({
    datum, appSchluessel, name: l.name, eintraege: l.eintraege,
    uebersicht: l.uebersicht, tiktok: l.tiktok, token, ifMatch: l._etag,
  }),
  versuche = 4, pauseMs = 1500,
}) {
  for (let versuch = 1; versuch <= versuche; versuch++) {
    const frisch = await lesen();
    if (!frisch) throw new Error(`Keine Merkliste fuer ${appSchluessel} am ${datum}.`);
    aendern(frisch);
    try {
      await ablegen(frisch);
    } catch (e) {
      // Jemand hat seit unserem Lesen geschrieben (ETag passt nicht mehr):
      // nichts ist verloren, einfach frisch lesen und noch einmal.
      if (!istVorbedingungsFehler(e)) throw e;
      if (versuch < versuche) await new Promise((r) => setTimeout(r, pauseMs * versuch));
      continue;
    }
    const nachher = await lesen();
    if (nachher && drin(nachher)) return { liste: nachher, versuche: versuch };
    if (versuch < versuche) await new Promise((r) => setTimeout(r, pauseMs * versuch));
  }
  throw new Error(`Merkliste ${appSchluessel}/${datum}: eigene Aenderung nach ${versuche} Versuchen `
    + 'nicht drin — ein anderer Lauf schreibt dauernd dazwischen.');
}

export function istVorbedingungsFehler(e) {
  return e instanceof BlobPreconditionFailedError || e?.name === 'BlobPreconditionFailedError'
    || /precondition/i.test(String(e?.message));
}

/** Alle Merklisten eines Tages, je App eine. */
export async function merklistenLesen({ datum, token }) {
  const { blobs } = await list({ prefix: `social/${datum}/freigabe-`, token });
  const raus = [];
  for (const b of blobs) {
    if (!b.pathname.endsWith('.json')) continue;
    // ⚠ DIREKT AUS DEM SPEICHER, am CDN vorbei (`useCache: false`, 26.09.2026).
    //
    // Bis dahin stand hier `fetch(url?frisch=<Zeit>, no-store)` — in der
    // Annahme, der Parameter umgehe den Cache. Er tut es nicht: Am 26.09.
    // gemessen `x-vercel-cache: HIT, age: 56` trotz jedes Mal neuem Parameter.
    // Ein Lauf konnte also eine bis zu eine Minute alte Merkliste lesen — ein
    // eben veroeffentlichter Beitrag saehe wieder offen aus (doppelter
    // Beitrag), und beim Zurueckschreiben gingen fremde Vermerke verloren.
    //
    // `_etag` gehoert zum gelesenen Stand und geht als `ifMatch` ins Schreiben
    // (merklisteAendern). merklisteAblegen schreibt nur benannte Felder, das
    // `_etag` landet also nie in der Datei.
    let liste = null;
    try {
      const r = await get(b.url, { access: 'public', useCache: false, token });
      if (r?.statusCode === 200 && r.stream) {
        liste = { ...JSON.parse(await new Response(r.stream).text()), _etag: r.blob?.etag };
      }
    } catch (e) {
      console.log(`   (Merkliste ${b.pathname}: direktes Lesen fehlgeschlagen — ${e.message}; lese ueber das CDN)`);
    }
    if (!liste) {
      const antwort = await fetch(`${b.url}?frisch=${Date.now()}`, { cache: 'no-store' });
      if (!antwort.ok) continue;
      liste = await antwort.json();
    }
    raus.push({ ...liste, pfad: b.pathname });
  }
  return raus;
}

/**
 * Raeumt ein hochgeladenes Bild wieder weg.
 *
 * ⚠ Erst NACH dem Veroeffentlichen aufrufen. Instagram holt das Bild beim
 * Anlegen des Containers — wer vorher loescht, bekommt einen Container, der
 * beim Veroeffentlichen ins Leere greift.
 *
 * Loeschen ist gratis und haelt den Speicher bei nahezu null. Ohne das waeren
 * es nach einem Jahr rund 400 MB toter Bilder.
 */
/**
 * Braucht noch irgendein Kanal diese Datei?
 *
 * ⚠ Seit es drei Wege gibt, die aus dem Blob-Speicher lesen (Instagram beim
 * Freigeben, Facebook beim Freigeben, TikTok beim Direktversand), darf der
 * erste von ihnen die Datei nicht mehr einfach wegraeumen. Wer das tut, nimmt
 * den beiden anderen die Grundlage — und ihr Fehler liest sich dann wie ein
 * kaputter Zugang („Video nicht erreichbar: HTTP 404"), obwohl nur zu frueh
 * geloescht wurde.
 *
 * Gefragt wird gegen die frisch gelesene Merkliste, nicht gegen den Speicher:
 * Was dort noch offen steht, ist noch offen.
 */
export function nochGebraucht({ liste, datei }) {
  const post = (liste.uebersicht ?? []).find((p) => p.datei === datei);
  // Ein abgelehnter Beitrag geht nirgends mehr hin — auch dann nicht, wenn ein
  // Kanal ihn formal noch als „wartet" fuehrt.
  if (post?.abgelehnt) return false;
  const offenBeiInstagram = (liste.eintraege ?? [])
    .some((e) => e.datei === datei && !e.veroeffentlicht);
  const offenBeiFacebook = post?.kanaele?.facebook?.stand === 'wartet';
  // Ein Beitrag im TikTok-Posteingang laesst sich von der Freigabe-Seite aus
  // immer noch direkt posten — dafuer braucht es die Datei.
  //
  // ⚠ „uebersprungen" zaehlt NICHT: Das heisst, der Beitrag ist kein Video,
  // und die Freigabe-Seite bietet fuer ihn gar keinen TikTok-Knopf an. Wer das
  // mitzaehlt, raeumt die Datei nie wieder weg.
  const offenBeiTiktok = ['posteingang', 'wartet']
    .includes(post?.kanaele?.tiktok?.stand);
  return Boolean(offenBeiInstagram || offenBeiFacebook || offenBeiTiktok);
}

export async function aufraeumen({ url, urls, token }) {
  // ⚠ Ein Karussell liegt als MEHRERE Dateien im Speicher. Wer hier nur
  // `url` (die erste Folie) loescht, laesst die uebrigen neun fuer immer
  // liegen — und merkt es nie, weil der Beitrag ja veroeffentlicht ist.
  const ziele = [...new Set([...(urls ?? []), url].filter(Boolean))];
  if (!ziele.length) return false;
  try {
    await del(ziele.length === 1 ? ziele[0] : ziele, { token });
    return true;
  } catch {
    // Ein misslungenes Aufraeumen darf einen gelungenen Beitrag nicht zum
    // Fehlschlag machen. Der Speicher laeuft davon nicht voll.
    return false;
  }
}
