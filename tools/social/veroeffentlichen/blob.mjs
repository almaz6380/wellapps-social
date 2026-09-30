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
// ⚠ NICHT der Speicherplatz ist die Grenze, an die man stoesst (28.09.2026).
// Hier stand: „acht Bilder taeglich zu je rund 150 kB, also etwa 36 MB im Monat
// gegen 5 GB Freibetrag." Das stimmt und ist harmlos — und hat genau deshalb
// verdeckt, was wirklich knapp ist. Am 28.09. stand das Konto bei 2.800 von
// 2.000 ADVANCED OPERATIONS, und Vercel hat den gesamten Account pausiert:
// Freigabe-Seite, Einnahmen, App-Dashboard, alles offline. Ursache war die
// Nachlese-Schleife in merklisteAendern, die je Aenderung bis zu 69 `list()`
// abfeuerte.
//
// Die Freibetraege, die wirklich zaehlen:
//
//   Advanced Operations   2.000/Monat   put(), copy(), list(), Store anlegen
//   Simple Operations    10.000/Monat   head(), Cache-Fehltreffer beim Abruf
//   Speicherplatz             1 GB      unkritisch bei acht Bildern am Tag
//   del()                    gratis
//
// Wer hier etwas aendert, rechnet in OPERATIONEN, nicht in Megabyte. Ein
// Beitrag darf ein put() fuer das Bild und eines fuer die Merkliste kosten —
// mehr nicht. Jede Schleife um einen Blob-Aufruf ist verdaechtig.
//
// Die Bilder werden nach dem Posten wieder geloescht (`del()` ist gratis). Der
// Freibetrag gilt geteilt ueber alle Vercel-Dienste des Kontos: Wer ihn hier
// aufbraucht, schaltet auch jedes andere Projekt des Kontos ab.

// --- Seit 30.09.2026: eigener Speicher auf Cloudflare statt Vercel Blob ------
//
// Vercel hat den ganzen Account pausiert, weil DIESER Speicher sein Kontingent
// gesprengt hatte (siehe oben). Die Dateien liegen jetzt im Freigabe-Worker
// (freigabe-app/worker/index.js): Bilder und Videos in Workers KV, Merklisten und
// Sperren in D1. Beides kostenlos, ohne Kreditkarte, und eine Ueberschreitung
// sperrt dort nur den einzelnen Aufruf, nie das Konto.
//
// Die Schnittstelle dieser Datei ist gleich geblieben - kein Aufrufer musste sich
// aendern. `token` ist jetzt das gemeinsame Geheimnis mit dem Worker (weiterhin
// das GitHub-Secret BLOB_TOKEN, nur mit neuem Wert).
//
// Was sich dadurch verbessert: D1 ist sofort konsistent. Die Merkliste, die man
// liest, ist die, die zuletzt geschrieben wurde - kein CDN, das eine Minute lang
// den alten Stand zeigt. Die Nachlese-Schleife in merklisteAendern findet ihre
// Aenderung deshalb beim ersten Blick, und `ifMatch` funktioniert wieder.

import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

/** Wo der Speicher liegt. Zum Testen gegen `wrangler dev` umstellbar. */
export const SPEICHER = (process.env.SPEICHER_URL ?? 'https://freigabe.almaz6380.workers.dev').replace(/\/$/, '');

/** MD5 als Hex — derselbe Wert, den das Blob-CDN als ETag ausliefert (gemessen 26.09.2026). */
export const md5 = (text) => createHash('md5').update(text).digest('hex');

// --- Reissleine gegen Ausreisser (28.09.2026, angepasst 30.09.2026) ----------
//
// ⚠ Warum. Auf Vercel hat eine Schleife um einen Speicheraufruf den ganzen
// Account abgeschaltet. Workers KV erlaubt im Free-Tarif 1.000 Schreibvorgaenge
// am Tag; ueber der Grenze scheitert nur der einzelne Aufruf, aber eine Schleife
// wuerde den Tag trotzdem leerraeumen. Also weiter mitzaehlen: Reisst ein Lauf
// die Obergrenze, bricht er ab.
//
// Ein Tageslauf mit zehn Beitraegen kommt auf rund 25 Schreibvorgaenge. 60 laesst
// Luft fuer Nachzuegler und Wiederholungen, faengt aber jede echte Schleife.
const GRENZE = Number(process.env.BLOB_GRENZE ?? 60);
let verbraucht = 0;

/** Wie viele Schreibvorgaenge dieser Lauf bisher verbraucht hat. */
export const operationenVerbraucht = () => verbraucht;

function zaehlen(was) {
  verbraucht += 1;
  if (verbraucht > GRENZE) {
    throw new Error(
      `Speicher-Reissleine: ${verbraucht} Schreibvorgaenge in diesem Lauf (Grenze ${GRENZE}, `
      + `zuletzt ${was}). Vermutlich liegt ein Speicheraufruf in einer Schleife. Nicht die `
      + 'Grenze hochsetzen, sondern die Schleife suchen. (Notfalls BLOB_GRENZE setzen.)',
    );
  }
}

class SpeicherFehler extends Error {}
/** Gleicher Name wie beim Vercel-SDK, damit istVorbedingungsFehler ihn erkennt. */
class BlobPreconditionFailedError extends Error {
  constructor(m) { super(m); this.name = 'BlobPreconditionFailedError'; }
}

async function speicher(pfad, { methode = 'GET', token, body, typ, kopf = {} } = {}) {
  if (!token) throw new SpeicherFehler('BLOB_TOKEN fehlt - ohne ihn nimmt der Speicher nichts an.');
  if (methode === 'PUT') zaehlen(`PUT ${pfad}`);
  return fetch(`${SPEICHER}/${pfad}`, {
    method: methode,
    headers: { authorization: `Bearer ${token}`, ...(typ ? { 'content-type': typ } : {}), ...kopf },
    body,
  });
}

async function fehlerText(antwort) {
  return `${antwort.status} ${(await antwort.text().catch(() => '')).slice(0, 200)}`;
}

const TYPEN = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.json': 'application/json', '.txt': 'text/plain' };

/** Aus einer oeffentlichen Adresse des Speichers den Pfad darin machen. */
function pfadAus(url) {
  const u = new URL(url);
  if (u.origin !== new URL(SPEICHER).origin) throw new SpeicherFehler(`Fremde Adresse: ${u.origin}`);
  return decodeURIComponent(u.pathname.slice(1));
}

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

  // ⚠ Zufallsanhang wie vorher bei Vercel (`addRandomSuffix`, seit 10.09.2026):
  // Die Adresse ist oeffentlich, weil Instagram sie als anonymer Besucher abholt.
  // Ein Passwort geht also nicht - unerratbar ist die Obergrenze des Machbaren.
  // Nebenwirkung wie gehabt: Ein zweiter Lauf legt eine zweite Datei daneben;
  // weggeraeumt wird die, die in der Merkliste steht.
  const endung = extname(datei);
  const ziel = `${praefix}/${basename(datei, endung)}-${randomBytes(15).toString('base64url')}${endung}`;
  // Als Puffer: Ein Reel sind rund vier Megabyte, KV nimmt bis 25 MB.
  const antwort = await speicher(ziel, {
    methode: 'PUT', token, body: readFileSync(datei), typ: TYPEN[endung.toLowerCase()] ?? 'application/octet-stream',
  });
  if (!antwort.ok) throw new SpeicherFehler(`Hochladen ${ziel}: ${await fehlerText(antwort)}`);
  const { url } = await antwort.json();
  return { url, pfad: ziel };
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
  const text = JSON.stringify(inhalt, null, 2);
  const antwort = await speicher(pfad, {
    methode: 'PUT', token, body: text, typ: 'application/json',
    kopf: ifMatch ? { 'if-match': `"${ifMatch}"` } : {},
  });
  if (antwort.status === 412) throw new BlobPreconditionFailedError(`Merkliste ${pfad}: Vorbedingung verletzt.`);
  if (!antwort.ok) throw new SpeicherFehler(`Merkliste ${pfad}: ${await fehlerText(antwort)}`);
  const { url } = await antwort.json();
  // `md5` = woran merklisteAendern die eigene Fassung beim Nachlesen erkennt.
  return { url, pfad, md5: md5(text) };
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
    uebersicht: l.uebersicht, tiktok: l.tiktok, token,
    // `ifMatch` wieder an (30.09.2026): Auf Vercel lieferte das CDN einen anderen
    // ETag als die Speicher-API, jeder Schreibversuch scheiterte. Der eigene
    // Speicher prueft gegen den MD5 genau des Inhalts, den `lesen` geliefert hat.
    ifMatch: l._md5,
  }),
  versuche = 3, pauseMs = 1500,
  // ⚠ Das CDN zeigt nach dem Schreiben noch bis zu einer Minute den ALTEN
  // Stand (26.09.: 15 s lang in allen Nachlesungen, Lauf 36259599833 —
  // geschrieben war richtig, gemeldet wurde rot). Deshalb wird so lange
  // nachgelesen, und waehrenddessen NICHT neu geschrieben.
  nachlesen = 22, nachlesenTakt = 3000,
}) {
  for (let versuch = 1; versuch <= versuche; versuch++) {
    const frisch = await lesen();
    if (!frisch) throw new Error(`Keine Merkliste fuer ${appSchluessel} am ${datum}.`);
    aendern(frisch);
    let geschrieben;
    let adresse = frisch.url ?? null;
    try {
      const abgelegt = await ablegen(frisch);
      geschrieben = abgelegt?.md5;
      // Die Adresse aus dem Schreibvorgang ist die verlaesslichste: `put` gibt
      // sie zurueck, und sie ist ueber alle Schreibvorgaenge dieselbe.
      adresse = abgelegt?.url ?? adresse;
    } catch (e) {
      if (!istVorbedingungsFehler(e)) throw e;
      if (versuch < versuche) await new Promise((r) => setTimeout(r, pauseMs * versuch));
      continue;
    }
    // ⚠ Nachgelesen wird ueber die ADRESSE, nicht ueber `lesen()` (28.09.2026).
    // `lesen()` macht ein `list()`, und das ist eine Advanced Operation; diese
    // Schleife laeuft bis zu 22-mal je Versuch. Genau das hat den Hobby-Tarif
    // gesprengt und den ganzen Vercel-Account pausiert. Der Abruf ueber die
    // CDN-Adresse liefert denselben Inhalt zum Nulltarif.
    //
    // Nur wenn keine Adresse bekannt ist — die Tests spritzen `lesen`/`ablegen`
    // ein und liefern keine —, bleibt der alte Weg.
    const nachlesenMit = adresse
      ? () => merklisteLesenVonUrl({ url: adresse, pfad: frisch.pfad })
      : lesen;
    // Nachlesen, bis entweder die EIGENE Fassung (gleicher MD5) oder eine mit
    // der eigenen Aenderung darin zu sehen ist. Alles andere kann ein alter
    // CDN-Stand sein — oder ein Lauf, der danach geschrieben hat. Unterscheiden
    // laesst sich das erst, wenn das CDN sicher nachgezogen hat; erst DANN
    // wird neu angewendet und geschrieben.
    for (let blick = 0; blick < nachlesen; blick++) {
      const nachher = await nachlesenMit();
      if (nachher && ((geschrieben && nachher._md5 === geschrieben) || drin(nachher))) {
        return { liste: nachher, versuche: versuch };
      }
      if (blick < nachlesen - 1) await new Promise((r) => setTimeout(r, nachlesenTakt));
    }
    if (versuch < versuche) await new Promise((r) => setTimeout(r, pauseMs * versuch));
  }
  throw new Error(`Merkliste ${appSchluessel}/${datum}: eigene Aenderung nach ${versuche} Versuchen `
    + 'nicht drin — ein anderer Lauf schreibt dauernd dazwischen.');
}

/**
 * Die harte Sperre gegen doppelte Beitraege (26.09.2026).
 *
 * ⚠ Warum. Die Sperre bis dahin war der Vermerk in der Merkliste — und die
 * liest jeder Lauf ueber das CDN, das bis zu einer Minute den alten Stand
 * zeigt. Am 26.09. um 21:31 und 21:35 zweimal dasselbe FullRep-Video auf
 * Facebook: Der zweite Lauf las „wartet", obwohl der erste laengst gepostet
 * und vermerkt hatte.
 *
 * Jetzt legt jeder Lauf VOR dem Posten eine Sperrdatei an, mit
 * „nur anlegen, wenn neu“ — der Speicher nimmt sie genau einmal an (seit
 * 30.09.2026 D1 mit INSERT … ON CONFLICT DO NOTHING, vorher Vercels
 * `allowOverwrite: false`).
 * Gibt `false` zurueck, wenn schon ein Lauf fuer diesen Kanal und diese Datei
 * gepostet hat (oder gerade postet). Scheitert das Posten, gibt
 * `sperreLoesen` sie wieder frei, damit ein neuer Versuch moeglich ist.
 */
export function sperrPfad({ datum, kanal, datei }) {
  return `social/${datum}/sperren/${kanal}-${datei}.json`;
}

export async function sperreSetzen({ datum, kanal, datei, token, lauf = null }) {
  const pfad = sperrPfad({ datum, kanal, datei });
  // `?nurNeu=1`: D1 legt die Zeile genau einmal an (INSERT ... ON CONFLICT DO
  // NOTHING). 201 = diese Sperre gehoert uns, 409 = ein anderer Lauf war schneller.
  const antwort = await fetch(`${SPEICHER}/${pfad}?nurNeu=1`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ kanal, datei, wann: new Date().toISOString(), lauf }),
  });
  zaehlen(`Sperre ${pfad}`);
  if (antwort.status === 201) return true;
  if (antwort.status === 409) return false;
  // Jeder andere Ausgang: NICHT blind posten.
  throw new Error(`Sperre ${pfad} nicht setzbar - ${await fehlerText(antwort)}`);
}

export async function sperreLoesen({ datum, kanal, datei, token }) {
  const pfad = sperrPfad({ datum, kanal, datei });
  try { await speicher(pfad, { methode: 'DELETE', token }); } catch { /* schon weg */ }
}

export function istVorbedingungsFehler(e) {
  return e instanceof BlobPreconditionFailedError || e?.name === 'BlobPreconditionFailedError'
    || /precondition/i.test(String(e?.message));
}

/**
 * Eine EINZELNE Merkliste ueber ihre bekannte Adresse lesen — ohne `list()`.
 *
 * ⚠ Warum es das gibt (28.09.2026). `list()` ist eine Advanced Operation, und
 * davon hat der Hobby-Tarif 2.000 im Monat. `merklisteAendern` las beim
 * Nachlesen bis zu 22-mal je Versuch neu, dreimal — bis zu 69 Auflistungen
 * fuer EINE Aenderung. Am 28.09. stand das Konto bei 2.800 von 2.000 und
 * Vercel hat den GESAMTEN Account pausiert, samt Freigabe-Seite, Einnahmen
 * und App-Dashboard.
 *
 * Der Abruf ueber die CDN-Adresse liefert denselben Inhalt und kostet KEINE
 * Advanced Operation (hoechstens eine Simple Operation bei einem
 * Cache-Fehltreffer, davon gibt es 10.000). Die Adresse ist stabil, weil
 * `merklisteAblegen` mit `addRandomSuffix: false` schreibt.
 *
 * Gibt `null` zurueck, wenn die Datei (noch) nicht abrufbar ist — der
 * Aufrufer behandelt das wie einen alten CDN-Stand und liest erneut.
 */
export async function merklisteLesenVonUrl({ url, pfad = null }) {
  const antwort = await fetch(`${url}?frisch=${Date.now()}`, { cache: 'no-store' });
  if (!antwort.ok) return null;
  const text = await antwort.text();
  return { ...JSON.parse(text), _md5: md5(text), url, ...(pfad ? { pfad } : {}) };
}

/** Alle Merklisten eines Tages, je App eine. */
export async function merklistenLesen({ datum, token }) {
  const antwort = await fetch(`${SPEICHER}/api/speicher?praefix=${encodeURIComponent(`social/${datum}/freigabe-`)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!antwort.ok) throw new SpeicherFehler(`Merklisten ${datum}: ${await fehlerText(antwort)}`);
  const { dateien } = await antwort.json();
  const raus = [];
  for (const d of dateien) {
    if (!d.pfad.endsWith('.json')) continue;
    // Direkt aus D1 - kein CDN dazwischen, der Stand ist der zuletzt geschriebene.
    const liste = await merklisteLesenVonUrl({ url: d.url, pfad: d.pfad });
    if (liste) raus.push(liste);
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
    for (const ziel of ziele) {
      const antwort = await speicher(pfadAus(ziel), { methode: 'DELETE', token });
      if (!antwort.ok && antwort.status !== 404) return false;
    }
    return true;
  } catch {
    // Ein misslungenes Aufraeumen darf einen gelungenen Beitrag nicht zum
    // Fehlschlag machen. Der Speicher laeuft davon nicht voll.
    return false;
  }
}
