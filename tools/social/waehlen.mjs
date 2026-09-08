// Redaktion: waehlt fuer einen Tag die Posts aus.
//
// Der ganze Auftrag steht und faellt mit diesem Modul. "Immer wieder neue
// Ideen" ist keine Frage der Kreativitaet beim Rendern, sondern der
// Buchfuehrung: Was gestern lief, darf heute nicht wieder laufen, und die
// Frage von vor drei Monaten darf nicht als neu verkauft werden.
//
// Zwei Sperrfristen, und die wichtigere ist nicht die, die man zuerst vermutet.
//
//   WINKEL-SPERRE   ergibt sich aus dem Vorrat, sie wird NICHT frei gewaehlt.
//                   Bei 10 Winkeln und 2 Posts am Tag ist der Vorrat nach fuenf
//                   Tagen einmal durch — eine Sperre von 14 Tagen waere
//                   mathematisch unerfuellbar und wuerde sich bei jedem Lauf
//                   selbst aushebeln. Formel unten in winkelSperre().
//                   Ein wiederkehrendes FORMAT ist ohnehin nicht das Problem:
//                   Jeder laufende Kanal hat drei bis fuenf Rubriken.
//
//   INHALT_SPERRE   90 Tage. Das ist die Sperre, an der Zuschauer eine
//                   Wiederholung tatsaechlich merken — dieselbe Frage,
//                   dieselbe Figur, dieselbe Uebung. Sie ist die eigentliche
//                   Zusage hinter "immer wieder neue Ideen".
//
// Alles ist eine reine Funktion aus (Datum, Ledger). Zweimal derselbe Tag
// ergibt dieselbe Auswahl — nur so laesst sich ein Lauf nachstellen, und nur
// so kann das Repo das Rezept statt des Videos speichern.

import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));

export const INHALT_SPERRE = 90;

/**
 * Wie viele Tage ein Winkel pausieren muss, abgeleitet aus dem Vorrat.
 *
 * Bei `n` Winkeln und `p` Posts am Tag ist der Vorrat nach n/p Tagen einmal
 * durch. Eine Sperre darf hoechstens so lang sein — ein Tag Sicherheitsabstand
 * abgezogen, sonst gibt es am Wendepunkt keine Auswahl mehr, nur noch Zwang.
 * Wer laengere Pausen will, legt Winkel nach; das ist die ehrliche Stellschraube.
 */
export function winkelSperre(anzahlWinkel, postsProTag) {
  return Math.max(1, Math.floor(anzahlWinkel / Math.max(1, postsProTag)) - 1);
}

// --- Zufall, der keiner ist -------------------------------------------------
// Derselbe Seed ergibt dieselbe Folge. Uebernommen aus tools/reels/storyboard.mjs,
// damit beide Seiten dieselbe Zahl gleich verstehen.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function saat(...teile) {
  const s = teile.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// --- Laden ------------------------------------------------------------------
// ⚠ apps.json fuehrt ABSOLUTE Pfade (/home/user/mahjong-app). Das ist auf
// Josefs Rechner und in einer Cloud-Sitzung richtig — dort liegen die fuenf
// Repos genau so nebeneinander. Ein GitHub-Runner checkt sie aber unter
// $GITHUB_WORKSPACE aus, und dort gaebe es /home/user gar nicht.
//
// Deshalb diese eine Weiche: Steht SOCIAL_WURZEL, wird nur der VORDERE Teil
// des Pfades ersetzt, der Ordnername bleibt. Aus /home/user/mahjong-app wird
// <wurzel>/mahjong-app. Der Workflow checkt die Repos genau unter diesen
// Namen aus.
//
// Absichtlich keine Pfade in apps.json aendern: Die Datei beschreibt die
// gewohnte Arbeitsumgebung, und die soll ohne Umgebungsvariable weiter
// funktionieren.
export function ladeApps() {
  const roh = JSON.parse(readFileSync(join(HIER, 'apps.json'), 'utf8'));
  const wurzel = process.env.SOCIAL_WURZEL;
  if (!wurzel) return roh;
  for (const [k, app] of Object.entries(roh.apps ?? roh)) {
    if (k.startsWith('_') || !app?.pfad) continue;
    app.pfad = join(wurzel, basename(app.pfad));
  }
  return roh;
}

export function ladeWinkel(app) {
  return JSON.parse(readFileSync(join(HIER, 'ideen', `${app}.json`), 'utf8')).winkel;
}

export function ladeLedger() {
  const p = join(HIER, 'ledger.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { zeilen: [] };
}

// --- Sperrfristen -----------------------------------------------------------
const TAG = 86400000;

function tageHer(datum, heute) {
  return Math.round((Date.parse(heute) - Date.parse(datum)) / TAG);
}

/** Winkel, die heute nicht laufen duerfen, weil sie zu kurz her sind. */
function gesperrteWinkel(ledger, app, heute, sperre) {
  return new Set(
    ledger.zeilen
      .filter((z) => z.app === app && tageHer(z.datum, heute) < sperre)
      .map((z) => z.winkel),
  );
}

/** Inhalte, die heute nicht drankommen duerfen. */
function gesperrteInhalte(ledger, app, heute) {
  return new Set(
    ledger.zeilen
      .filter((z) => z.app === app && tageHer(z.datum, heute) < INHALT_SPERRE)
      .map((z) => `${z.schluessel}=${z.inhalt}`),
  );
}

// --- Saisonale Winkel -------------------------------------------------------
// Mahjongs Festivals haben echte Zeitfenster in src/game/festivals.ts. Ein
// Sakura-Post im November ist kein Aufhaenger, sondern ein Fehler.
const FESTIVAL_FENSTER = [
  { id: 'laterne', von: [2, 10], bis: [2, 24] },
  { id: 'sakura', von: [3, 20], bis: [4, 10] },
  { id: 'drache', von: [5, 28], bis: [6, 10] },
  { id: 'mond', von: [9, 15], bis: [10, 1] },
];

export function aktivesFestival(heute) {
  const d = new Date(heute);
  const m = d.getUTCMonth() + 1, t = d.getUTCDate();
  const nach = ([mm, tt]) => m > mm || (m === mm && t >= tt);
  const vor = ([mm, tt]) => m < mm || (m === mm && t <= tt);
  return FESTIVAL_FENSTER.find((f) => nach(f.von) && vor(f.bis)) ?? null;
}

function winkelErlaubt(w, heute) {
  if (w.nur_im_fenster) return aktivesFestival(heute) !== null;
  return true;
}

// --- Die Auswahl ------------------------------------------------------------
/**
 * Waehlt fuer eine App die Posts eines Tages.
 *
 * @param {object} o
 * @param {string} o.app          Schluessel aus apps.json
 * @param {string} o.heute        ISO-Datum, z.B. '2026-08-30'
 * @param {object} o.ledger       geladener Ledger
 * @param {number} o.anzahl       Posts fuer diesen Tag
 * @param {boolean} o.nurVorhanden  nur Winkel, deren Format schon gebaut ist
 * @returns {Array} Posts mit Winkel, Seed und Begruendung
 */
export function waehlePosts({ app, heute, ledger, anzahl = 2, nurVorhanden = false }) {
  const alle = ladeWinkel(app);
  const verfuegbar = alle
    .filter((w) => winkelErlaubt(w, heute))
    .filter((w) => (nurVorhanden ? w.status === 'vorhanden' : true));

  const sperre = winkelSperre(verfuegbar.length, anzahl);
  const gesperrt = gesperrteWinkel(ledger, app, heute, sperre);
  const inhalteWeg = gesperrteInhalte(ledger, app, heute);

  let kandidaten = verfuegbar.filter((w) => !gesperrt.has(w.id));

  // Notausgang. Er sollte nach der Ableitung der Sperre nie noetig sein —
  // ausser wenn saisonale Winkel wegfallen und der Vorrat schrumpft. Lieber
  // eine Wiederholung als eine Luecke, aber sichtbar, damit es auffaellt.
  let gelockert = false;
  if (kandidaten.length < anzahl) {
    gelockert = true;
    kandidaten = verfuegbar;
  }
  if (kandidaten.length === 0) return [];

  // Deterministisch mischen: derselbe Tag ergibt dieselbe Reihenfolge.
  const wuerfel = mulberry32(saat(heute, app));
  const gemischt = [...kandidaten].sort(() => wuerfel() - 0.5);

  // Mischung aus Bild und Reel anstreben. Ein Kanal, der nur Videos postet,
  // verliert die Leute, die im Feed scrollen; einer, der nur Bilder postet,
  // bekommt keine Watchtime. Erzwungen wird es nicht — wenn der Vorrat es
  // nicht hergibt, ist ein zweiter Reel besser als gar kein Post.
  const gewaehlt = [];
  for (const medium of ['reel', 'bild']) {
    if (gewaehlt.length >= anzahl) break;
    const treffer = gemischt.find((w) => w.medium === medium && !gewaehlt.includes(w));
    if (treffer) gewaehlt.push(treffer);
  }
  for (const w of gemischt) {
    if (gewaehlt.length >= anzahl) break;
    if (!gewaehlt.includes(w)) gewaehlt.push(w);
  }

  return gewaehlt.slice(0, anzahl).map((w, i) => ({
    app,
    datum: heute,
    winkel: w.id,
    medium: w.medium,
    format: w.format,
    schluessel: w.schluessel,
    haken: w.haken,
    bereich: w.bereich ?? null,
    // Die Leitplanke braucht diese beiden — ohne sie verlangte sie den
    // Gesundheitshinweis auch auf einer reinen Uebungskarte.
    hinweis_pflicht: w.hinweis_pflicht === true,
    quelle_pflicht: w.quelle_pflicht === true,
    sprache: w.sprachen[saat(heute, app, w.id) % w.sprachen.length],
    seed: saat(heute, app, w.id, String(i)) % 100000,
    gesperrteInhalte: [...inhalteWeg],
    winkelSperre: sperre,
    gelockert,
  }));
}

/** Trockenlauf ueber mehrere Tage — beweist die Nicht-Wiederholung. */
export function vorschau({ app, start, tage = 14, anzahl = 2, nurVorhanden = false }) {
  const ledger = ladeLedger();
  const zeilen = [...ledger.zeilen];
  const ergebnis = [];
  for (let i = 0; i < tage; i++) {
    const d = new Date(Date.parse(start) + i * TAG).toISOString().slice(0, 10);
    const posts = waehlePosts({ app, heute: d, ledger: { zeilen }, anzahl, nurVorhanden });
    ergebnis.push({ datum: d, posts });
    // So tun, als waeren sie gelaufen — sonst sieht jeder Tag gleich aus.
    for (const p of posts) {
      zeilen.push({ app, datum: d, winkel: p.winkel, schluessel: p.schluessel, inhalt: `seed${p.seed}` });
    }
  }
  return ergebnis;
}
