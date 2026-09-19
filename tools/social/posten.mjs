// Die erzeugten Beitraege in die Kanaele bringen.
//
//   node tools/social/posten.mjs --trocken           was passieren wuerde
//   node tools/social/posten.mjs --trocken --app fullrep
//   node tools/social/posten.mjs --echt              wirklich senden
//
// ⚠ Ohne --echt wird nichts gesendet. Und --echt bricht ab, wenn ein
// Zugangsdatum fehlt, statt die Haelfte hochzuladen: Ein halb gepostetes
// Tagespaket ist schlimmer als ein gar nicht gepostetes, weil niemand mehr
// weiss, was schon draussen ist.
//
// --- Entwurf oder oeffentlich? Siehe AUTOMATIK weiter unten ------------------
//
// Hier geht ALLES nur als Entwurf raus. Oeffentlich wird ein Beitrag erst,
// wenn Josef ihn freigibt. Das war bis zum 07.09.2026 so, wurde an dem Tag
// auf volle Automatik umgestellt — und am 09.09. nach dem ersten
// Zeitplan-Lauf sofort wieder zurueckgenommen.
//
// Der Schalter dafuer steht an EINER Stelle, gleich unten. Wer wissen will,
// was heute wirklich passiert, liest dort — nicht hier.
//
// --- Die drei Kanaele koennen NICHT dasselbe --------------------------------
//
//   Facebook   nimmt die Datei direkt. `published` entscheidet zwischen
//              Entwurf und Veroeffentlichung — ein einziges Feld.
//   Instagram  KEIN Entwurf, und es nimmt KEINE Dateien, nur oeffentliche
//              Links. Also erst in den Blob-Speicher, dann Container, dann
//              veroeffentlichen. Drei Schritte fuer einen Beitrag.
//   TikTok     zwei getrennte Wege. Der Posteingang (`video.upload`) legt
//              einen Entwurf in die App; der Direktversand (`video.publish`)
//              postet selbst — verlangt aber eine gepruefte App, sonst
//              antwortet er mit
//              `unaudited_client_can_only_post_to_private_accounts`.
//
// Diese Ungleichheit ist keine Nachlaessigkeit, sondern das, was die drei
// Schnittstellen hergeben.

import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ladeApps } from './waehlen.mjs';
import { bericht as geheimBericht, zugaenge } from './veroeffentlichen/geheimnisse.mjs';
import { entwurfAnlegen } from './veroeffentlichen/facebook.mjs';
import { inPosteingang, direktPosten, fotoPosten, kontoAuskunft, frischerToken }
  from './veroeffentlichen/tiktok.mjs';
import { tiktokBildAdresse } from './veroeffentlichen/bildadresse.mjs';
import { hochladen, merklisteAblegen, merklistenLesen } from './veroeffentlichen/blob.mjs';
import { containerAnlegen, karussellAnlegen, aufBereitWarten, veroeffentlichen as igVeroeffentlichen }
  from './veroeffentlichen/instagram.mjs';
import { riechtNachBeiblatt } from './vorflug.mjs';
import { beschreibungBauen } from './beschreibung.mjs';
import { folienFinden } from './folien.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const wert = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const hat = (n) => process.argv.includes(`--${n}`);

const ECHT = hat('echt');
const DATUM = wert('datum', new Date().toISOString().slice(0, 10));
const NUR_APP = wert('app', null);

// ⚠ --kanal ist fuer den Fall gebaut, der am 05.09. eingetreten ist: Zwei von
// drei Kanaelen liefen durch, der dritte scheiterte. Ein einfacher zweiter
// Lauf haette die geglueckten Beitraege ein zweites Mal angelegt — zwei
// gleiche Entwuerfe auf der Seite, und niemand weiss mehr, welcher der neue
// ist. Mit `--kanal instagram` wird nur der offene nachgeholt.
const NUR_KANAELE = (wert('kanal', '') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

// ⚠ --seed holt GENAU EINEN Beitrag nach, nicht das Tagespaket.
//
// Gebraucht fuer die freie Karte: Die entsteht mitten am Tag auf Zuruf,
// waehrend die Beitraege von heute Morgen laengst abgelegt und vorgemerkt
// sind. Ein gewoehnlicher Lauf wuerde sie alle noch einmal in den Blob
// schieben und ein zweites Mal in die Merkliste haengen — in der
// Freigabe-Seite staende dann jeder Beitrag doppelt, und beim
// Instagram-Knopf wuesste niemand mehr, welcher der echte ist.
//
// Dieselbe Sorte Schutz wie --kanal, nur auf der anderen Achse: dort ein
// Kanal von dreien, hier ein Beitrag von mehreren.
const NUR_SEED = wert('seed', null);

// --- Wie weit die Automatik geht --------------------------------------------
//
// ⚠ HIER STEHT DIE FOLGENSCHWERSTE ENTSCHEIDUNG DES GANZEN WERKZEUGS.
//
// `true` heisst: Der Beitrag geht OEFFENTLICH, ohne dass ihn jemand gelesen
// hat. Kein Entwurf, keine zweite Ansicht, kein Zurueck ausser Loeschen.
//
// STAND 09.09.2026: ALLES AUS. Ohne Josefs Freigabe geht nichts raus.
//
// Die Geschichte dazu, damit sie niemand ein zweites Mal durchlaeuft:
// Bis zum 30.08. ging alles als Entwurf raus, mit guter Begruendung (die
// Beitraege tragen Saetze wie „Laut Studien"). Am 07.09. hat Josef das
// ausdruecklich umgestossen und die volle Automatik verlangt. Am 09.09. um
// 11:20 lief der erste Zeitplan-Lauf damit durch und postete auf allen fuenf
// Konten oeffentlich — Facebook und Instagram, ungelesen. Josef hat das
// sofort und unmissverstaendlich zurueckgenommen.
//
// ⚠ DIESE DREI WERTE STEHEN FEST UND KOMMEN NICHT MEHR AUS DER UMGEBUNG.
// Vorher stand hier `process.env.AUTO_FACEBOOK !== 'aus'` — also „an, solange
// niemand widerspricht". Eine vergessene Variable in einem Workflow reichte
// damit fuer einen oeffentlichen Beitrag. Die Voreinstellung einer
// folgenschweren Sache gehoert auf „passiert nicht", nicht auf „passiert,
// wenn niemand aufpasst".
//
// Wer das je wieder aufdreht, braucht dafuer Josefs ausdrueckliches Wort zu
// GENAU DIESEN ZEILEN — nicht zu „Automatik" im Allgemeinen.
const AUTOMATIK = {
  facebook: false,
  instagram: false,
  tiktok: false,
};

// ⚠ Ueber ladeApps(), NICHT direkt aus der Datei: Nur so greift die
// SOCIAL_WURZEL-Weiche (siehe waehlen.mjs). Wer hier wieder selbst liest,
// baut auf einem Runner Pfade zusammen, die es nicht gibt — und posten.mjs
// meldet dann seelenruhig „Nichts zu posten", statt zu scheitern.
const APPS = ladeApps();

// --- Was liegt fuer diesen Tag bereit? --------------------------------------
//
// Die Dateien auf der Platte allein reichen NICHT als Antwort, und daran haette
// man sich beim ersten echten Lauf boese verbrannt: Wer den Tageslauf zweimal
// startet, hat zwei Saetze Dateien im selben Ordner — beim Entwickeln waren es
// fuenf statt zwei. Alle zu posten hiesse, denselben Tag mehrfach zu
// veroeffentlichen.
//
// Deshalb entscheidet der LEDGER, was zaehlt: Er haelt je Tag genau eine Zeile
// pro Beitrag, mit dem Seed als Kennung („seed84273"). Der Seed steht auch im
// Dateinamen („…-s84273.jpg"). Die Schnittmenge aus beidem ist das Tagespaket.
//
// Der Ledger allein reicht umgekehrt auch nicht — er kennt keine Dateinamen.
// Beides zusammen ist die Antwort.
function tagesSeeds() {
  const pfad = join(HIER, 'ledger.json');
  if (!existsSync(pfad)) return null;
  const ledger = JSON.parse(readFileSync(pfad, 'utf8'));
  const raus = new Map();
  for (const z of ledger.zeilen ?? []) {
    if (z.datum !== DATUM) continue;
    if (!raus.has(z.app)) raus.set(z.app, new Set());
    // „seed84273" → „84273"
    raus.get(z.app).add(String(z.inhalt ?? '').replace(/^seed/, ''));
  }
  return raus;
}

/**
 * Die Ledger-Zeilen von heute, nach Seed.
 *
 * Bewusst neben tagesSeeds(): Das liefert nur die Seeds je App und wird an
 * einer heissen Stelle benutzt. Wer die ganze Zeile braucht — etwa um zu
 * sehen, WOHER ein Beitrag kommt — holt sie hier.
 */
function tagesZeilen() {
  const pfad = join(HIER, 'ledger.json');
  if (!existsSync(pfad)) return new Map();
  const ledger = JSON.parse(readFileSync(pfad, 'utf8'));
  const raus = new Map();
  for (const z of ledger.zeilen ?? []) {
    if (z.datum !== DATUM) continue;
    raus.set(String(z.inhalt ?? '').replace(/^seed/, ''), z);
  }
  return raus;
}

function tagesposten() {
  const seeds = tagesSeeds();
  const raus = [];
  for (const [k, app] of Object.entries(APPS.apps ?? APPS)) {
    if (NUR_APP && k !== NUR_APP) continue;
    if (!app.kanaele?.length) continue;

    const ordner = join(app.pfad, 'out', 'social', DATUM);
    if (!existsSync(ordner)) continue;

    for (const f of readdirSync(ordner).filter((x) => x.endsWith('.txt'))) {
      const beiblatt = readFileSync(join(ordner, f), 'utf8');
      const stamm = f.replace(/\.txt$/, '');

      // Steht der Seed dieser Datei nicht im Ledger, ist sie ein Rest aus
      // einem frueheren Lauf desselben Tages. Ueberspringen, nicht posten.
      const seed = stamm.match(/-s(\d+)(?:-[a-z]+)?$/)?.[1];
      if (seeds && !(seed && seeds.get(k)?.has(seed))) continue;
      if (NUR_SEED && seed !== String(NUR_SEED)) continue;
      // Das Feed-Bild ist das zu postende; das Story-Bild ist eine Beigabe.
      const medium = ['.mp4', '-feed.jpg', '.jpg'].map((e) => join(ordner, stamm + e))
        .find(existsSync);

      // ⚠ Ein KARUSSELL liegt als `<stamm>-1.jpg … -10.jpg` daneben.
      //
      // Erkannt wird es an den nummerierten Dateien, nicht an einem Feld im
      // Ledger: Was auf der Platte liegt, ist die Wahrheit ueber das, was
      // gerendert wurde — eine Absicht im Ledger kann daneben liegen, wenn
      // der Renderer zur Haelfte gescheitert ist.
      //
      // ⚠ Sortiert wird NUMERISCH. `sort()` allein stellt „-10.jpg" vor
      // „-2.jpg", und die Folien stuenden in der falschen Reihenfolge im
      // Beitrag — sichtbar erst nach dem Veroeffentlichen, korrigierbar gar
      // nicht mehr.
      const folien = folienFinden(readdirSync(ordner), stamm).map((x) => join(ordner, x));

      // ⚠ Beim Karussell fuehrt die ERSTE FOLIE, auch wenn daneben noch ein
      // Einzelbild liegt. Sonst haengen Vorschau, Dateiname in der Merkliste
      // und Aufraeumen an einer Datei, die gar nicht im Beitrag steht.
      const hauptdatei = folien.length >= 2 ? folien[0] : medium;
      if (!hauptdatei) continue;
      const kanaele = NUR_KANAELE.length
        ? app.kanaele.filter((x) => NUR_KANAELE.includes(x))
        : app.kanaele;
      if (!kanaele.length) continue;
      // Die Sprache steht im Dateinamen („…-de-s84273"). Seit 15.09.2026
      // fuehrt jede App ohnehin genau eine — der Rueckfall auf apps.json
      // ist deshalb kein Raten, sondern derselbe Wert auf anderem Weg.
      const sprache = stamm.match(/-([a-z]{2})-s\d+/)?.[1] ?? app.sprachen?.[0] ?? 'de';

      // ⚠ NICHT mehr nur captionAus(). Seit 18.09.2026 gehen App-Link und
      // hoechstens fuenf Hashtags mit raus — beides Josefs Regel, beides an
      // EINER Stelle fuer alle fuenf Apps (siehe beschreibung.mjs).
      raus.push({ app: k, name: app.name, kanaele, medium: hauptdatei, folien, sprache,
        text: beschreibungBauen({ app, beiblatt, sprache }).trim() });
    }
  }
  return raus;
}

/**
 * Was der Ledger fuer heute verspricht, aber hier nicht ankommt.
 *
 * ⚠ DIESE PRUEFUNG FEHLTE, UND SIE HAT SIEBEN BEITRAEGE GEKOSTET.
 *
 * Gefunden am 18.09.2026: Swaplys Bildbeitraege standen an jedem Lauftag im
 * Ledger und sind NIE in der Freigabe-Seite erschienen — am 05., 08., 09. und
 * heute, jedes Mal nur das Reel. Ursache: `swaply/scripts/post-bild.mjs`
 * schreibt kein Beiblatt (.txt), und `tagesposten()` findet Beitraege
 * ausschliesslich ueber deren .txt-Datei. Ohne Beiblatt existiert der Beitrag
 * fuer den Versand schlicht nicht.
 *
 * Das Tueckische war die Stille: Der Lauf meldete „1 Beitrag", nicht „einer
 * fehlt". Gemerkt hat es niemand, weil in der Liste ja etwas stand.
 *
 * Der Ledger ist die Wahrheit darueber, was heute entstanden ist — er wird
 * erst geschrieben, nachdem der Beitrag gerendert wurde UND die Leitplanke
 * bestanden hat. Was dort steht und hier fehlt, ist unterwegs verloren
 * gegangen, und das muss laut sein.
 */
function fehlendeBeitraege(gefunden) {
  const seeds = tagesSeeds();
  if (!seeds) return [];
  const zeilen = tagesZeilen();
  const da = new Set(gefunden.map((p) => basename(p.medium).match(/-s(\d+)/)?.[1]));
  const fehlt = [];
  for (const [k, menge] of seeds) {
    if (NUR_APP && k !== NUR_APP) continue;
    const app = (APPS.apps ?? APPS)[k];
    if (!app?.kanaele?.length) continue;

    // ⚠ Gibt es den Ausgabeordner gar nicht, ist das KEIN verlorener Beitrag —
    // dann laeuft dies nur auf einer anderen Maschine als das Rendern. Genau
    // so ist es beim Entwickeln: Der Tageslauf rendert im Runner, die Dateien
    // liegen dort und nie hier. Das als Fehlschlag zu melden hiesse, den
    // Alarm abzustumpfen, auf den es ankommt.
    const ordner = join(app.pfad, 'out', 'social', DATUM);
    const fremdeMaschine = !existsSync(ordner);

    for (const seed of menge) {
      if (NUR_SEED && seed !== String(NUR_SEED)) continue;
      if (da.has(seed)) continue;
      // ⚠ Eine freie Karte ist NICHT verloren, wenn sie hier fehlt.
      //
      // Sie entsteht in `social-karte.yml` — einem eigenen Lauf auf einem
      // eigenen Runner — und wird von DORT ausgeliefert. Ihre Datei hat auf
      // dieser Maschine nie gelegen, ihre Ledger-Zeile bleibt aber stehen
      // (lauf.mjs raeumt sie bewusst nicht weg, sonst verschwaende der
      // Tageslauf sie).
      //
      // `fremdeMaschine` faengt das nicht ab: Es prueft den Ordner der ganzen
      // App, und der EXISTIERT hier — der Tageslauf hat ja gerade zwei andere
      // Anigosha-Beitraege hineingerendert. Am 18.09.2026 hat der Lauf genau
      // deshalb rot gemeldet „1 Beitrag nie angekommen", waehrend die Karte
      // seit Stunden brav in der Freigabe-Seite stand.
      //
      // Ein Fehlalarm ist hier teurer als anderswo: Diese Pruefung existiert,
      // damit ein echter Verlust auffaellt. Wer sie regelmaessig grundlos
      // rot sieht, sieht irgendwann gar nichts mehr.
      if (zeilen.get(seed)?.schluessel === 'frei') continue;
      fehlt.push({ app: k, seed, fremdeMaschine });
    }
  }
  return fehlt;
}

// --- Lauf -------------------------------------------------------------------
const posten = tagesposten();
const fehlt = fehlendeBeitraege(posten);

// Nur die echten Verluste faerben den Lauf rot — siehe `fremdeMaschine`.
const verloren = fehlt.filter((f) => !f.fremdeMaschine);

if (fehlt.length) {
  if (fehlt.length !== verloren.length) {
    const n = fehlt.length - verloren.length;
    console.log(`(${n} Beitrag/Beitraege aus dem Ledger liegen nicht auf dieser`
      + ' Maschine — gerendert wurde woanders. Kein Fehler.)\n');
  }
}

if (verloren.length) {
  console.error('⚠ Im Ledger steht mehr, als hier ankommt:\n');
  for (const f of verloren) {
    const ordner = join((APPS.apps ?? APPS)[f.app].pfad, 'out', 'social', DATUM);
    const dateien = existsSync(ordner)
      ? readdirSync(ordner).filter((x) => x.includes(`-s${f.seed}`))
      : [];
    console.error(`  ${f.app} · Seed ${f.seed}`);
    console.error(dateien.length
      ? `    auf der Platte: ${dateien.join(', ')}`
      : '    auf der Platte: nichts');
    console.error(dateien.some((x) => x.endsWith('.txt'))
      ? '    → Beiblatt da, aber keine Mediendatei dazu.'
      : '    → KEIN Beiblatt (.txt). Ohne das findet der Versand den Beitrag nicht.');
  }
  console.error('\n  Der Generator dieser App muss ein Beiblatt schreiben —');
  console.error('  der Versand nimmt den Caption-Text von dort.\n');
}

console.log(`${ECHT ? 'Hochladen' : 'Trockenlauf (ohne --echt wird nichts gesendet)'} `
  + `fuer ${DATUM}\n`);

if (!posten.length) {
  console.log('Nichts zu posten.');
  console.log('  Entweder gibt es fuer diesen Tag keine Beitraege — dann erst');
  console.log('    node tools/social/lauf.mjs --echt');
  console.log('  oder in apps.json steht bei "kanaele" noch nichts. Solange die');
  console.log('  Profile nicht angelegt sind, ist das richtig so.');
  // ⚠ NICHT immer 0. „Nichts zu posten" ist harmlos, solange der Ledger auch
  // nichts verspricht — sagt er das Gegenteil, ist es der schlimmste Fall von
  // allen: Es war etwas da, und es ist komplett verschwunden.
  process.exit(verloren.length ? 1 : 0);
}

// ⚠ Je APP und Kanal, nicht je Kanal: Jede App hat eigene Konten. Eine
// gemeinsame Garnitur haette Mahjong-Werbung auf der WELLbooked!-Seite
// gepostet, und das faellt erst auf, wenn es draussen ist.
const gebraucht = [...new Map(
  posten.map((p) => [p.app, { app: p.app, kanaele: p.kanaele }]),
).values()];
// ⚠ Das Rettungsnetz unter captionAus(). Am 05.09. trug ein Facebook-Entwurf
// das ganze Beiblatt — mit den richtigen Antworten des Quiz. Aufgefallen ist
// das nur, weil jemand hingesehen hat. Ab jetzt faellt es hier auf, VOR dem
// Hochladen, und der Lauf bricht ab, statt die Haelfte zu posten.
const verdaechtig = posten
  .map((p) => ({ p, grund: p.text.trim() ? riechtNachBeiblatt(p.text) : 'leerer Text' }))
  .filter((x) => x.grund);

if (verdaechtig.length) {
  console.error('✗ Abbruch: Bei diesen Beitraegen ist der Text kein Caption-Text:\n');
  for (const { p, grund } of verdaechtig) {
    console.error(`  ${p.name} · ${basename(p.medium)}`);
    console.error(`    Verraeter: ${grund}`);
    console.error(`    Anfang:    ${p.text.slice(0, 90).replace(/\n/g, ' ⏎ ')}\n`);
  }
  console.error('  Wahrscheinlich hat sich das Beiblatt-Format eines Repos geaendert');
  console.error('  und captionAus() findet die Ueberschrift nicht mehr.');
  process.exit(1);
}

const g = geheimBericht(gebraucht);
console.log('Zugangsdaten');
console.log(g.text || '  (keine noetig)');
console.log();

if (ECHT && !g.vollstaendig) {
  console.error('✗ Abbruch: Es fehlen Zugangsdaten (siehe oben).\n');
  console.error('  Sie gehoeren nach GitHub → Settings → Secrets and variables →');
  console.error('  Actions — dorthin, wo auch die Signierschluessel liegen.');
  console.error('  NICHT ins Repo und NICHT in den Chat.\n');
  console.error('  Absichtlich wird gar nichts hochgeladen statt nur die Haelfte:');
  console.error('  Ein halb gepostetes Tagespaket ist schlimmer als ein gar nicht');
  console.error('  gepostetes, weil niemand mehr weiss, was schon draussen ist.');
  process.exit(1);
}

// Den TikTok-Zugang EINMAL je Lauf erneuern, nicht je Beitrag: Jede
// Erneuerung kann den Refresh-Token austauschen, und mehrere Erneuerungen
// hintereinander wuerden die Rotation nur unnoetig oft ausloesen.
// Den TikTok-Zugang EINMAL JE APP erneuern, nicht je Beitrag: Jede
// Erneuerung kann den Refresh-Token austauschen, und mehrere Erneuerungen
// hintereinander wuerden die Rotation nur unnoetig oft ausloesen.
// ⚠ Je App ein eigener Speicher — es sind verschiedene TikTok-Konten.
const ttSpeicher = new Map();
async function tiktokToken(appSchluessel) {
  if (!ECHT) return null;
  if (ttSpeicher.has(appSchluessel)) return ttSpeicher.get(appSchluessel);
  const z = zugaenge(appSchluessel);
  const r = await frischerToken({
    clientKey: z.tiktokKey, clientSecret: z.tiktokSecret, refreshToken: z.tiktokRefresh,
  });
  if (r.neuerRefresh) {
    // ⚠ Laut TikToks Doku: „You must use the newly-returned token if the value
    // is different than the previous one." Wer das ueberliest, bei dem laeuft
    // es genau einmal — der naechste Lauf scheitert mit einer Meldung, die
    // nach einem widerrufenen Zugang aussieht.
    //
    // Der neue Wert wird hier ABSICHTLICH NICHT ausgegeben: Er ist ein
    // Geheimnis, und diese Ausgabe landet in GitHub-Protokollen.
    const name = `TIKTOK_REFRESH_TOKEN_${appSchluessel.toUpperCase()}`;
    console.log(`\n   ⚠ TikTok hat den Refresh-Token fuer ${appSchluessel} AUSGETAUSCHT.`);
    console.log(`     Der neue Wert muss ins Secret ${name},`);
    console.log('     sonst schlaegt der naechste Lauf fehl. Er steht hier');
    console.log('     bewusst nicht — Protokolle sind kein Ort fuer Geheimnisse.');
    console.log('     (Der Zeitplan-Workflow schreibt ihn spaeter selbst zurueck.)\n');
  }
  ttSpeicher.set(appSchluessel, r.token);
  return r.token;
}

// Was Instagram spaeter freigeben soll, je App. Wird am Ende als Merkliste
// abgelegt — siehe merklisteAblegen() fuer den Grund.
const merkliste = new Map();

// ⚠ Was bei TikTok landet, landet OHNE Text.
//
// Der Aufruf, mit dem wir hochladen (`inbox/video/init`), hat schlicht kein
// Feld dafuer — Titel, Beschreibung und Hashtags gibt es dort nicht. Ein
// Textfeld kennt nur der Direktversand, und den duerfen ungepruefte Apps
// nicht benutzen (ihre Beitraege blieben privat, siehe tiktok.mjs).
//
// Der Text ist also da, er kommt nur nicht durch die Leitung. Damit er
// trotzdem am Handy zum Kopieren bereitsteht, sammeln wir ihn hier und
// schreiben ihn am Ende in die Zusammenfassung des Workflow-Laufs.
const nachzutragen = [];

// Was die Freigabe-Seite spaeter anzeigt: je App alle Beitraege des Tages mit
// dem Ergebnis JEDES Kanals — nicht nur der Instagram-Teil.
//
// ⚠ Getrennt von `merkliste`. Die entscheidet, was Instagram noch zu tun hat;
// diese hier ist reine Ansicht. Sie darf nie zur Grundlage einer
// Veroeffentlichung werden.
const uebersicht = new Map();

/**
 * Legt die Datei EINMAL oeffentlich ab und merkt sich die Adresse an `spur`.
 *
 * ⚠ Zwei Kanaele brauchen sie inzwischen: Instagram holt das Bild von dort ab
 * (seine API nimmt keine Dateien), und seit 09.09.2026 auch Facebook — dessen
 * Beitrag entsteht erst bei der Freigabe, und die laeuft auf einer anderen
 * Maschine, auf der die gerenderte Datei laengst weg ist.
 *
 * Ohne diese Klammer laedt jeder Kanal dieselbe Datei erneut hoch. Das ginge
 * (der Pfad ist vorhersagbar, `allowOverwrite` steht), kostet aber bei einem
 * Reel vier Megabyte Bandbreite fuer nichts.
 */
async function abgelegt(spur, p, z) {
  // ⚠ Kein `pfad` im gemerkten Fall: Seit dem Zufallsanhang liesse er sich
  // nicht mehr ausrechnen, und ein ausgerechneter waere eine Behauptung ueber
  // einen Ort, an dem nichts liegt. Gebraucht wird er ohnehin nur in der
  // Meldung des Trockenlaufs — und dort ist nichts gemerkt.
  if (spur.url) return { url: spur.url, urls: spur.urls };

  // ⚠ Ein Karussell braucht ALLE Folien oeffentlich, nicht nur die erste.
  // Instagram holt sich jedes Bild selbst von seiner Adresse; fehlt eine,
  // scheitert nicht der Upload, sondern erst das Anlegen der Folie — mitten
  // im Beitrag, mit sechs schon angelegten Kindern, die dann ins Leere
  // laufen. Deshalb hier alles hochladen, bevor irgendein Kanal loslegt.
  const folien = p.folien?.length >= 2 ? p.folien : [p.medium];
  const hoch = [];
  for (const datei of folien) {
    hoch.push(await hochladen({
      datei, token: z.blobToken, praefix: `social/${DATUM}`, trocken: !ECHT,
    }));
  }

  const erste = hoch[0];
  if (erste?.url) {
    spur.url = erste.url;
    if (folien.length >= 2) spur.urls = hoch.map((r) => r.url).filter(Boolean);
  }
  // ⚠ `folienZahl` auch im Trockenlauf, wo es keine `url` gibt. Sonst meldet
  // der Probelauf „das Bild" und laedt beim echten Lauf zehn hoch — genau die
  // Sorte Vorschau, die man nachher nicht wiedererkennt.
  return { ...erste, urls: spur.urls, folienZahl: folien.length };
}

let fertig = 0, offen = 0;
for (const p of posten) {
  console.log(`━━ ${p.name} · ${basename(p.medium)}`);
  const istVideo = /\.(mp4|mov)$/i.test(p.medium);
  const z = zugaenge(p.app);
  let inTiktok = false;
  const spur = { datei: basename(p.medium), text: p.text, istVideo, kanaele: {} };

  for (const kanal of p.kanaele) {
    try {
      if (kanal === 'facebook') {
        if (AUTOMATIK.facebook) {
          const r = await entwurfAnlegen({
            seitenId: z.fbSeitenId, token: z.fbToken,
            datei: p.medium, text: p.text, veroeffentlicht: true, trocken: !ECHT,
          });
          console.log(r.trocken
            ? `   ▸ facebook   wuerde ${r.art} OEFFENTLICH posten (${r.zeichen} Zeichen Text)`
            : `   ✓ facebook   veroeffentlicht — Beitrag ${r.id}`);
          fertig += r.trocken ? 0 : 1;
          spur.kanaele.facebook = {
            stand: r.trocken ? 'trocken' : 'veroeffentlicht', id: r.id ?? null,
          };
        } else {
          // ⚠ Hier entsteht BEWUSST kein Facebook-Entwurf mehr (bis 09.09.2026
          // legte dieser Zweig einen an, `published=false`).
          //
          // Grund: Josef gibt jetzt auf der Freigabe-Seite frei, und ein
          // Entwurf laesst sich per API nicht zuverlaessig nachtraeglich
          // veroeffentlichen — fuer ein unveroeffentlichtes Foto ist der Weg
          // ein anderer als fuer einen Feed-Beitrag. Wer beides baut (Entwurf
          // JETZT, Beitrag BEI DER FREIGABE), bekommt am Ende zwei Sachen auf
          // der Seite: den liegengebliebenen Entwurf und den neuen Beitrag.
          //
          // Also derselbe Weg wie bei Instagram: Datei oeffentlich ablegen,
          // vormerken, und der Beitrag entsteht erst beim Freigeben — aus
          // genau dieser Datei und genau diesem Text.
          const r = await abgelegt(spur, p, z);
          if (r.trocken) {
            console.log(`   ▸ facebook   wuerde ${r.folienZahl > 1 ? r.folienZahl + ' Folien' : 'die Datei'} ablegen unter ${r.pfad}`);
            spur.kanaele.facebook = { stand: 'trocken' };
          } else {
            console.log('   ✓ facebook   liegt bereit — freigeben auf der Freigabe-Seite');
            spur.kanaele.facebook = { stand: 'wartet' };
          }
          offen += 1;
        }

      } else if (kanal === 'tiktok') {
        // ⚠ Bis zum 19.09.2026 stand hier `if (!istVideo) continue` — Bilder
        // wurden uebersprungen, und im Repo stand, TikTok-Fotobeitraege seien
        // „ungeprueft". Das war kein Befund, sondern ein abgebrochener
        // Versuch: Die Doku rendert im Browser nach, Chromium kommt aus einer
        // Cloud-Sitzung nicht ins Netz, und `curl` ohne `-L` bekam eine 302.
        // Die Seite `content-posting-api-reference-photo-post` gibt es sehr
        // wohl; Fotobeitraege nehmen bis zu 35 Bilder.
        //
        // Merksatz: „Nicht nachweisbar" und „nicht nachgesehen" sehen im
        // Protokoll gleich aus. Nur eines davon ist ein Ergebnis.
        //
        // ⚠ Auch TikTok braucht die oeffentliche Ablage — seit es den Knopf
        // „Auf TikTok posten" auf der Freigabe-Seite gibt. `tiktok-posten.mjs`
        // laeuft auf einer anderen Maschine und holt sich das Video von genau
        // dieser Adresse; ohne sie bricht es mit `fetch(undefined)` ab.
        //
        // ⚠ Gefunden am 16.09.2026, auf dem denkbar unguenstigsten Weg: Ein
        // Lauf mit `--kanal tiktok` erzeugte einen Beitrag ohne Vorschau, und
        // der Knopf darunter waere still kaputt gewesen. Vorher hing die
        // Ablage allein an Facebook und Instagram — was stimmte, solange
        // TikTok nur in den Posteingang lud und die Datei nie wieder brauchte.
        //
        // `abgelegt` merkt sich die Adresse je Beitrag, ein zweiter Kanal
        // laedt also nicht noch einmal hoch.
        const ablage = await abgelegt(spur, p, z);
        if (!ablage.trocken && !ablage.url) {
          throw new Error('TikTok: Die Datei liess sich nicht oeffentlich ablegen — '
            + 'ohne ihre Adresse kann die Freigabe-Seite sie nicht posten.');
        }

        const token = await tiktokToken(p.app);
        const direkt = AUTOMATIK.tiktok;

        // ⚠ Fotos gehen einen ANDEREN Weg als Videos, und der Unterschied ist
        // nicht bloss ein Feld: Fuer Fotos gibt es keinen Dateiupload, TikTok
        // holt sie selbst von ihrer oeffentlichen Adresse (`PULL_FROM_URL`).
        // Deshalb wird hier die Adresse durchgereicht, nicht der Pfad — und
        // beim Karussell ALLE Folien, nicht nur die erste. Genau der Fehler
        // ist Facebook heute frueh passiert.
        const fotoUrls = ablage.urls?.length >= 2 ? ablage.urls : [ablage.url].filter(Boolean);

        // ⚠ Im Trockenlauf gibt `abgelegt` keine Adresse zurueck — es hat ja
        // nichts hochgeladen. `fotoUrls` ist dann ein LEERES Array, und ein
        // leeres Array ist nicht `null`: `?? platzhalter` greift nicht, und
        // `fotoPosten` warf „ohne Bildadresse".
        //
        // ⚠ Und der Platzhalter muss SO VIELE Eintraege haben, wie es Folien
        // gibt. Mit einem einzigen meldete der Trockenlauf „1 Bild", waehrend
        // sechs hochgegangen waeren — genau die Sorte Vorschau, die man
        // nachher nicht wiedererkennt, und die bei Instagram schon einmal
        // abgestellt werden musste. `folienZahl` liefert `abgelegt` auch
        // trocken.
        //
        // ⚠ Und fuer TikTok umgerechnet: Es holt die Bilder nur von einer
        // Adresse, deren Praefix im Entwicklerportal verifiziert ist. Der
        // Blob-Host ist das nicht, `wellapps-freigabe.vercel.app` schon.
        // Instagram und Facebook bekommen weiter die Blob-Adressen direkt.
        const bildUrls = fotoUrls.length ? fotoUrls.map(tiktokBildAdresse)
          : Array.from({ length: Math.max(1, ablage.folienZahl ?? 1) },
            (_, i) => `https://platzhalter.invalid/trocken-${i + 1}.jpg`);

        const r = istVideo
          ? (direkt
            ? await direktPosten({ token, datei: p.medium, titel: p.text, trocken: !ECHT })
            : await inPosteingang({ token, datei: p.medium, trocken: !ECHT }))
          // ⚠ `text`, nicht `titel`: Bei Fotos ist `title` eine Ueberschrift
          // von 90 Zeichen, die Bildunterschrift gehoert nach `description`.
          // `fotoPosten` teilt das selbst auf — die Grenze ist TikToks, also
          // gehoert sie dorthin und nicht hierher.
          : await fotoPosten({ token, bildUrls, text: p.text, direkt: false, trocken: !ECHT });

        // ⚠ Fotos gehen IMMER in den Posteingang, auch wenn AUTOMATIK.tiktok
        // eines Tages an waere. Direct Post verlangt eine Privatsphaere-Wahl,
        // und die muss laut TikToks Richtlinie von einem Menschen kommen —
        // im Tageslauf sitzt keiner. Der Knopf auf der Freigabe-Seite fragt
        // sie ab; dort ist der richtige Ort dafuer.
        const wirklichDirekt = istVideo && direkt;
        const was = istVideo ? `${r.mb} MB` : `${r.anzahl} Bild${r.anzahl > 1 ? 'er' : ''}`;
        if (r.trocken) {
          console.log(`   ▸ tiktok     wuerde ${was} ${wirklichDirekt ? 'OEFFENTLICH posten' : 'in den Posteingang laden'}`);
        } else {
          console.log(wirklichDirekt
            ? `   ✓ tiktok     veroeffentlicht (${was}, ${r.zeichen} Zeichen Text)`
            : `   ✓ tiktok     im Posteingang (${was}) — freigeben in der TikTok-App`);
        }
        fertig += r.trocken ? 0 : 1;
        // ⚠ Der Text muss nur nachgetragen werden, solange TikTok ueber den
        // Posteingang laeuft — der nimmt keinen an. Beim Direktversand geht er
        // mit, dann waere die Liste eine Einladung zum doppelten Posten.
        inTiktok = !wirklichDirekt;
        spur.kanaele.tiktok = {
          stand: r.trocken ? 'trocken' : (wirklichDirekt ? 'veroeffentlicht' : 'posteingang'),
        };

      } else if (kanal === 'instagram') {
        // Instagram bekommt hier NUR das Bild an eine oeffentliche Adresse
        // gelegt — den Container gibt es erst beim Freigeben.
        //
        // ⚠ Beides zugleich waere ein Fehler: Der Container verfaellt nach 24
        // Stunden. Einer, der morgens entsteht und abends freigegeben wird,
        // kann tot sein, und die Meldung saehe aus wie ein kaputter Zugang.
        const r = await abgelegt(spur, p, z);
        if (r.trocken) {
          console.log(`   ▸ instagram  wuerde ${r.folienZahl > 1 ? `ein Karussell aus ${r.folienZahl} Folien` : 'das Bild'} ablegen unter ${r.pfad}`
            + (AUTOMATIK.instagram ? ' und OEFFENTLICH posten' : ''));
          spur.kanaele.instagram = { stand: 'trocken' };
          offen += 1;
        } else {
          // ⚠ Beim Karussell ALLE Adressen ausgeben, nicht nur die erste.
          // Am 19.09.2026 lief der erste echte Karussell-Lauf durch und das
          // Protokoll zeigte genau eine Zeile — es liess sich hinterher nicht
          // sagen, ob sechs Folien oder eine hochgegangen waren. Der
          // Trockenlauf nannte die Zahl laengst, der echte Lauf nicht: die
          // Vorschau war ehrlicher als die Wirklichkeit.
          if (r.urls?.length >= 2) r.urls.forEach((u, i) => console.log(`     ${i + 1}. ${u}`));
          else console.log(`     ${r.url}`);
          spur.url = r.url;

          if (AUTOMATIK.instagram) {
            // ⚠ Container und Veroeffentlichung im SELBEN Lauf. Das war lange
            // verboten, weil der Container nach 24 Stunden verfaellt und die
            // Freigabe Stunden spaeter kam. Genau dieser Abstand faellt jetzt
            // weg — hier vergehen Sekunden, nicht Stunden.
            const c = r.urls?.length >= 2
              ? await karussellAnlegen({
                kontoId: z.igKontoId, token: z.fbToken, bildUrls: r.urls, text: p.text,
              })
              : await containerAnlegen({
                kontoId: z.igKontoId, token: z.fbToken,
                bildUrl: r.url, text: p.text, istReel: istVideo, trocken: false,
              });
            // ⚠ Beim Reel laedt Instagram das Video erst herunter und kodiert
            // es. Wer sofort veroeffentlicht, bekommt „Media ID is not
            // available" — eine Meldung, die nach einem kaputten Container
            // aussieht, obwohl er nur noch nicht fertig ist.
            await aufBereitWarten({ containerId: c.containerId, token: z.fbToken });
            const v = await igVeroeffentlichen({
              kontoId: z.igKontoId, token: z.fbToken,
              containerId: c.containerId, trocken: false,
            });
            console.log(`   ✓ instagram  veroeffentlicht — Beitrag ${v.id}`);
            spur.kanaele.instagram = { stand: 'veroeffentlicht', id: v.id };
            fertig += 1;
            // Aufgeraeumt wird NICHT hier: Instagram holt das Bild beim
            // Anlegen des Containers, aber ein spaeter Zugriff ist nicht
            // ausgeschlossen. `aufraeumen` bleibt Sache des Freigabe-Laufs.
          } else {
            console.log(`   ✓ instagram  ${r.urls?.length >= 2 ? `${r.urls.length} Folien liegen` : "Bild liegt"} bereit — Container entsteht beim Freigeben`);
            if (!merkliste.has(p.app)) merkliste.set(p.app, []);
            merkliste.get(p.app).push({
              datei: basename(p.medium), url: r.url, blobPfad: r.pfad,
              // ⚠ `urls` NUR beim Karussell setzen. freigeben.mjs erkennt
              // daran, welchen Weg es nimmt; ein `urls: [eine]` an einem
              // Einzelbild wuerde dort als Karussell mit einer Folie enden
              // und von Instagram abgelehnt.
              ...(r.urls?.length >= 2 ? { urls: r.urls } : {}),
              text: p.text, istVideo,
            });
            spur.kanaele.instagram = { stand: 'wartet' };
            offen += 1;
          }
        }
      }
    } catch (e) {
      console.log(`   ✗ ${kanal.padEnd(10)} ${e.message}`);
      spur.kanaele[kanal] = { stand: 'fehler', meldung: e.message };
    }
  }
  if (!uebersicht.has(p.app)) uebersicht.set(p.app, { name: p.name, posten: [] });
  uebersicht.get(p.app).posten.push(spur);
  if (inTiktok) nachzutragen.push({ name: p.name, datei: basename(p.medium), text: p.text });
  console.log();
}

// ⚠ Erst NACH allen Beitraegen, und nur bei einem echten Lauf: Die Liste ist
// die Verabredung mit dem Freigabelauf. Waere sie schon nach dem ersten
// Beitrag geschrieben, stuende beim Abbruch mittendrin eine unvollstaendige
// da, die vollstaendig aussieht.
// ⚠ Ueber die UEBERSICHT laufen, nicht ueber die Merkliste: Eine App, die
// heute nur ein TikTok-Video hat, steht in `merkliste` gar nicht — sie
// waere auf der Freigabe-Seite unsichtbar, und zwar so, dass es aussieht,
// als haette es fuer sie keinen Lauf gegeben.
// ⚠ Nur bei einem echten Lauf. Bisher ergab sich das von selbst, weil die
// Merkliste im Trockenlauf leer blieb; die Uebersicht fuellt sich dagegen
// IMMER. Ohne diese Zeile wuerde ein Trockenlauf in den Blob-Speicher
// schreiben — und „trocken" heisst: es geht nichts raus, auch nicht dorthin.
for (const [appSchluessel, u] of ECHT ? uebersicht : []) {
  const eintraege = merkliste.get(appSchluessel) ?? [];

  // ⚠ Die Kontoauskunft von TikTok gehoert in die Merkliste, weil die
  // Freigabe-Seite sie braucht: TikTok verlangt, dass die Privatsphaere-
  // Optionen, die dem Menschen angezeigt werden, aus `creator_info` stammen —
  // und die Seite selbst hat keine TikTok-Zugangsdaten (und soll auch keine).
  //
  // ⚠ Sie ist eine Momentaufnahme. Vor dem Posten wird SIE NOCH EINMAL
  // abgefragt (siehe direktPosten); was hier steht, ist nur die Vorlage fuer
  // die Anzeige. Wer sich allein darauf verliesse, postete mit veralteten
  // Optionen und bekaeme `privacy_level_option_mismatch`.
  let tiktok = null;
  if (u.posten.some((p) => p.kanaele?.tiktok)) {
    try {
      const a = await kontoAuskunft({ token: await tiktokToken(appSchluessel) });
      tiktok = {
        nickname: a.creator_nickname,
        username: a.creator_username,
        avatar: a.creator_avatar_url,
        privacyOptionen: a.privacy_level_options ?? [],
        maxSekunden: a.max_video_post_duration_sec,
        stand: new Date().toISOString(),
      };
    } catch (e) {
      // Kein Grund, den ganzen Lauf zu verlieren — die Seite zeigt dann
      // eben, dass TikTok gerade nicht antwortet.
      console.log(`   ⚠ TikTok-Kontoauskunft fuer ${appSchluessel}: ${e.message}`);
    }
  }

  // ⚠ ERGAENZEN, nicht ersetzen. Bis zum 09.09.2026 schrieb dieser Aufruf die
  // Merkliste des Tages einfach neu — was fuer den einen Lauf am Morgen auch
  // richtig war. Seit es den Nachlauf gibt (`--variante`, ausgeloest vom
  // Ablehnen eines Beitrags), gilt das nicht mehr: Der Nachlauf rendert NUR
  // den neuen Beitrag, und ein Ueberschreiben haette die uebrigen Beitraege
  // des Tages mitsamt ihrem Stand geloescht — auch die schon
  // veroeffentlichten. Auf der Seite waeren sie verschwunden, und die Sperre
  // gegen einen doppelten Beitrag mit ihnen.
  //
  // Zusammengefuehrt wird ueber den Dateinamen. Was dieser Lauf erzeugt hat,
  // gewinnt; alles andere bleibt so stehen, wie es war.
  let alteListe = null;
  try {
    const vorhanden = await merklistenLesen({
      datum: DATUM, token: zugaenge(appSchluessel).blobToken,
    });
    alteListe = vorhanden.find((l) => l.app === appSchluessel) ?? null;
  } catch (e) {
    // Kein Grund abzubrechen — beim ersten Lauf des Tages gibt es nichts.
    console.log(`   ⚠ Alte Merkliste nicht lesbar (${e.message}) — es wird neu angelegt.`);
  }

  const neueDateien = new Set(u.posten.map((p) => p.datei));
  const alteUebersicht = (alteListe?.uebersicht ?? [])
    .filter((p) => !neueDateien.has(p.datei));
  const alteEintraege = (alteListe?.eintraege ?? [])
    .filter((e) => !neueDateien.has(e.datei));

  const zusammen = [...alteUebersicht, ...u.posten];
  const alleEintraege = [...alteEintraege, ...eintraege];

  const r = await merklisteAblegen({
    datum: DATUM, appSchluessel, name: u.name,
    eintraege: alleEintraege, uebersicht: zusammen,
    tiktok, token: zugaenge(appSchluessel).blobToken,
  });
  console.log(`Merkliste: ${zusammen.length} Beitrag(e) (${u.posten.length} aus diesem Lauf), `
    + `davon ${alleEintraege.length} fuer Instagram offen → ${r.pfad}`);
}

// Die Texte zu den TikTok-Entwuerfen in die Zusammenfassung des Laufs.
//
// ⚠ Warum dorthin und nicht ins Protokoll: Josef arbeitet vom Handy. Die
// Zusammenfassung ist die erste Seite eines Laufs, das Protokoll liegt
// darunter und laesst sich dort kaum markieren. Ein Codeblock bekommt in
// GitHub ausserdem einen Kopierknopf — genau das, was hier gebraucht wird.
//
// ⚠ Nur bei einem echten Lauf und nur fuer TikTok. Facebook und Instagram
// tragen ihren Text selbst; sie hier mit aufzuzaehlen hiesse, zum Kopieren
// einzuladen, was schon drin steht.
if (nachzutragen.length && process.env.GITHUB_STEP_SUMMARY) {
  // ⚠ Der Workflow ruft dieses Skript je App EINMAL auf, alle schreiben in
  // dieselbe Datei. Die Ueberschrift darf deshalb nur beim ersten Mal
  // dazukommen — sonst steht sie fuenfmal da.
  const ueberschrift = `## Text fuer die TikTok-Entwuerfe (${DATUM})`;
  const schonDa = existsSync(process.env.GITHUB_STEP_SUMMARY)
    && readFileSync(process.env.GITHUB_STEP_SUMMARY, 'utf8').includes(ueberschrift);

  const zeilen = schonDa ? [] : [
    ueberschrift,
    '',
    ECHT
      ? 'TikToks Posteingang nimmt keinen Text an — hier zum Kopieren, bevor du in der App auf Posten tippst.'
      : 'Trockenlauf: So wuerde der Text lauten. Hochgeladen wurde nichts.',
    '',
  ];
  for (const e of nachzutragen) {
    // Ein Caption-Text mit ``` darin wuerde den Block sprengen; laenger
    // eingezaeunt bleibt er heil.
    const zaun = e.text.includes('```') ? '````' : '```';
    zeilen.push(`### ${e.name}`, `<sub>${e.datei}</sub>`, '',
      zaun, e.text || '(kein Text erzeugt)', zaun, '');
  }
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${zeilen.join('\n')}\n`);
    console.log(`Texte fuer ${nachzutragen.length} TikTok-Entwurf/-Entwuerfe stehen in der Zusammenfassung.`);
  } catch (e) {
    // Ein misslungener Merkzettel darf keinen geglueckten Versand rot faerben.
    console.log(`⚠ Zusammenfassung nicht geschrieben: ${e.message}`);
  }
}

console.log(ECHT
  ? `${fertig} Beitrag/Beitraege gesendet, ${offen} warten auf die Freigabe.`
  : `Trockenlauf beendet — nichts gesendet. Mit --echt wirklich senden.`);

// ⚠ GANZ ZUM SCHLUSS rot faerben, nicht vorher abbrechen.
//
// Was durchkam, soll durchkommen — ein fehlender Beitrag darf die geglueckten
// nicht aufhalten (dieselbe Regel wie im Tageslauf, wo eine gescheiterte App
// die anderen nicht mitreisst). Aber der Lauf darf nicht gruen sein: Genau
// dieser gruene Haken hat sieben Swaply-Bildbeitraege verschwinden lassen,
// ohne dass jemand etwas gemerkt hat.
if (verloren.length) {
  console.error(`\n✗ ${verloren.length} Beitrag/Beitraege aus dem Ledger sind hier nie angekommen.`);
  process.exit(1);
}
