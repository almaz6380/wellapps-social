#!/usr/bin/env node
// Typografie-Reels fuer Swaply und WELLbooked! — 1080×1920, stumm.
//
//   node tools/social/reels-fremd/make-reel.mjs --marke swaply \
//        --format tausch --lang de --seed 7 --out <ordner>
//   … --marke wellbooked --format kategorie-loop --lang de
//
// --- ⚠ Warum diese Datei HIER liegt und nicht in den beiden Repos ----------
//
// Sie gehoert dorthin. Der Grundsatz in motoren.mjs stimmt: „Was ein Reel
// schoen macht, weiss der Motor des Repos." Anigosha, Mahjong und FullRep
// haben ihren Reel-Generator jeweils bei sich.
//
// Der Grund fuer die Ausnahme ist kein technischer, sondern ein Zugangs:
// Dieser Arbeitsplatz darf in `swaply` und `wellbooked` nur LESEN
// (REPOS_TOKEN, Contents:Read). Ein Generator, der dort liegen muesste,
// koennte nicht eingecheckt werden. Also liegt er hier — und zieht seine
// Inhalte aus den Repos, statt sie abzuschreiben.
//
// **Wer spaeter Schreibzugriff hat, sollte ihn verschieben.** Je Marke ist es
// eine Datei plus der Eintrag in motoren.mjs.
//
// --- Was er bewusst NICHT tut -----------------------------------------------
//
// Keine Zahlen. WELLbooked!s Bildgenerator liest Preise und Provisionssaetze
// aus `src/lib/constants.ts`, weil in alten Posts falsche Preise stehen —
// einmal abgeschrieben, nie korrigiert. Ein Reel, das Preise zeigt, muesste
// dieselbe Kette mitschleppen (TypeScript-Import zur Laufzeit). Solange das
// nicht gebraucht wird, zeigt es lieber gar keine Zahl als eine veraltete.
//
// Keine Tonspur. Fuer WELLbooked! ist das Pflicht — die Leitplanke in
// vorflug.mjs verwirft jedes Video mit Ton (`tonspur-leer`). Fuer Swaply ist
// es eine Entscheidung: In der App laesst sich ohnehin ein Trending-Sound
// darueberlegen, und der ist der staerkere Reichweitenhebel.
//
// --- Die eine Regel, die man nicht sieht ------------------------------------
//
// ⚠ Kein `setTimeout`, keine CSS-Animation. Alles haengt an
// `window.setFrame(n)` und muss reine Funktion des Frame-Index sein — sonst
// verrutschen Frames und nichts ist reproduzierbar. Dieselbe Regel wie bei
// den Quiz-Reels.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { videoSenke } from '../../reels/encode.mjs';
import { ladeApps } from '../waehlen.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };

const MARKE = arg('marke', null);
const FORMAT = arg('format', null);
const LANG = arg('lang', 'de');
const SEED = Number(arg('seed', 1));
const NAME = arg('name', null);
const OUT = arg('out', join(WURZEL, 'out', 'social'));

const B = 1080;
const H = 1920;
const FPS = 30;

const MARKEN = JSON.parse(readFileSync(join(WURZEL, 'tools', 'social', 'kanal', 'marken.json'), 'utf8'));
const APPS = ladeApps();

if (!['swaply', 'wellbooked'].includes(MARKE)) {
  console.error('✗ --marke muss swaply oder wellbooked sein.');
  process.exit(1);
}

const M = MARKEN[MARKE];
const APP = (APPS.apps ?? APPS)[MARKE];

// Derselbe Wuerfel wie ueberall: derselbe Seed ergibt dasselbe Reel. Ohne das
// waere ein Fehler im Video nicht reproduzierbar.
function mulberry32(a) {
  return function wurf() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * Die Store-Knoepfe fuer den Abspann, als data:-URI.
 *
 * ⚠ Die Seite wird mit `setContent()` geladen und hat deshalb keinen Origin:
 * `file://` laedt dort nicht, die Bilder MUESSEN eingebettet sein. Dieselbe
 * Regel wie fuer Schrift und Logo.
 *
 * ⚠ Gezeigt wird nur, was `apps.json` unter `stores` bestaetigt. Ein Badge fuer
 * einen Store, in dem es die App nicht gibt, ist eine Falschaussage im Video —
 * dieselbe Regel, nach der FullReps Bildposts ihre Badges waehlen.
 *
 * Bis zum 18.09.2026 gab es hier ueberhaupt keine. Josef hat sie im fertigen
 * Reel vermisst; Anigoshas Vorlage konnte sie da laengst, nur hat sie nie
 * jemand angeschlossen.
 */
function storeBadges() {
  const ordner = join(WURZEL, 'tools', 'social', 'kanal', 'badges');
  const raus = [];
  const dazu = (bedingung, datei) => {
    if (!bedingung) return;
    const voll = join(ordner, datei);
    if (existsSync(voll)) raus.push(`data:image/png;base64,${readFileSync(voll).toString('base64')}`);
  };
  dazu(APP.stores?.ios, 'appstore-en.png');
  dazu(APP.stores?.android, 'googleplay-en.png');
  return raus;
}

// --- Heller oder dunkler Grund? ---------------------------------------------
//
// ⚠ Marken MIT `grundVerlauf` (Swaply seit 18.09.2026) tragen den Icon-Verlauf
// als HINTERGRUND — und dann MUSS die Schrift dunkel sein. Weiss misst auf den
// drei Punkten des Swaply-Verlaufs 3,22 / 2,61 / 2,13:1; noetig sind 4,5:1 fuer
// Fliesstext. Mit #06171c sind es 5,68 / 7,02 / 8,60:1.
//
// Marken OHNE den Schluessel (WELLbooked!) bleiben beim dunklen Schema — hier
// aendert sich fuer sie nichts.
const HELL = Array.isArray(M.grundVerlauf) && M.grundVerlauf.length >= 2;
const GRUND = HELL
  ? `linear-gradient(135deg, ${M.grundVerlauf.join(', ')})`
  : M.grund;
const TINTE = HELL ? (M.tinte ?? '#06171c') : M.schrift;
const TINTE_LEISE = HELL ? (M.tinteLeise ?? 'rgba(6,23,28,.62)') : M.gedaempft;
// Der Schimmer von oben: auf dunklem Grund ein farbiger Hauch, auf hellem ein
// heller — ein dunkler Fleck saehe dort wie ein Druckfehler aus.
const SCHIMMER = HELL ? 'rgba(255,255,255,.22)' : M.grundTief;

const wuerfel = mulberry32(SEED * 2654435761);
const waehle = (a) => a[Math.floor(wuerfel() * a.length)];

// --- Inhalte: aus den Repos gelesen, nicht abgeschrieben ---------------------

async function swaplyInhalt() {
  // ⚠ Direkt das Datenmodul des Repos importieren. Es liest die Kategorien aus
  // src/i18n/<sprache>.ts — dieselbe Quelle, aus der die App ihre Texte nimmt.
  // Eine Kopie hier waere am Tag der naechsten Textaenderung falsch.
  const modul = await import(join(APP.pfad, 'scripts', 'social-daten.mjs'));
  const alle = modul.kategorien(LANG);
  const mitNotfall = alle.filter((k) => k.notfall?.schritte?.length);

  if (FORMAT === 'notfall-loop') {
    const k = waehle(mitNotfall.length ? mitNotfall : alle);
    return {
      kopf: { de: 'Wenn der Impuls kommt', en: 'When the urge hits', es: 'Cuando llega el impulso' }[LANG],
      akzent: k.akzent,
      karten: (k.notfall?.schritte ?? []).slice(0, 4).map((s, i) => ({ zahl: String(i + 1), text: s })),
      fuss: k.label,
      caption: `${k.label} — ${k.notfall?.titel ?? ''}`.trim(),
    };
  }

  // tausch-loop: der Kern der App. Alte Routine klein, neue gross.
  const k = waehle(alle);
  const ersatz = (k.ersatz ?? []).slice(0, 3);
  return {
    kopf: { de: 'Tausch statt Verzicht', en: 'Swap, don’t quit', es: 'Cambia, no renuncies' }[LANG],
    akzent: k.akzent,
    vorher: k.alteRoutine ?? k.label,
    karten: ersatz.map((e) => ({ zahl: '→', text: e })),
    fuss: k.label,
    caption: `${k.label}: ${k.alteRoutine ?? ''}`.trim(),
  };
}

function wellbookedInhalt() {
  // ⚠ ZWEI Formen, nicht eine. Fuenf Winkel, die alle dasselbe Video ergeben,
  // taeuschen der Rotation Vielfalt vor: waehlen.mjs zaehlt Winkel, nicht
  // Aussehen — und meldet dann „5 verschiedene Winkel", waehrend der Kanal
  // fuenfmal dasselbe zeigt.
  const alsAblauf = ['bauchbinde', 'mythos', 'ablauf'].includes(FORMAT);

  if (alsAblauf) {
    const schritte = M.leiste[LANG] ?? M.leiste.de;
    return {
      kopf: M.spruch[LANG] ?? M.spruch.de,
      akzent: M.mint,
      karten: schritte.map((s, i) => ({ zahl: String(i + 1), text: s })),
      fuss: { de: 'Österreich und Deutschland', en: 'Austria and Germany' }[LANG] ?? '',
      caption: M.spruch[LANG] ?? M.spruch.de,
    };
  }

  // Kategorien stehen in marken.json. Preise kommen bewusst NICHT vor —
  // siehe Kopf der Datei.
  const kats = M.dreiklang[LANG] ?? M.dreiklang.de;
  return {
    kopf: { de: 'Freie Termine, heute', en: 'Free slots, today' }[LANG] ?? 'Freie Termine, heute',
    akzent: M.mint,
    karten: kats.slice(0, 4).map((k) => ({ zahl: '·', text: k })),
    fuss: { de: 'Österreich und Deutschland', en: 'Austria and Germany' }[LANG] ?? '',
    caption: M.spruch[LANG] ?? M.spruch.de,
  };
}

// Hashtags für Anbieter-Reels. ⚠ Kein Bereich, keine Region (Josef,
// 23.09.2026: „du sollst auf keine gebiete eingehen"). Dieselben fünf wie
// ANBIETER_TAGS in wellbooked/docs/social/post-bild.mjs.
const ANBIETER_HASHTAGS = '#WELLbooked #Selbstständig #Terminbuchung #Terminplanung #Kleinunternehmen';

// --- Sonderweg: KI-Clip mit zwei Sätzen (23.09.2026) -------------------------
//
// Ersetzt das Typografie-Reel für Anbieter:innen — Josef: „die reel sehen
// billig aus". Eigene Datei, eigener Ablauf, siehe clip-reel.mjs.
if (MARKE === 'wellbooked' && FORMAT === 'clip-reel') {
  const { clipReel } = await import('./clip-reel.mjs');
  const dateiname = NAME ?? `${MARKE}-${FORMAT}-${LANG}-s${SEED}`;
  const zielOrdner = resolve(OUT);
  mkdirSync(zielOrdner, { recursive: true });
  const ziel = join(zielOrdner, `${dateiname}.mp4`);
  const r = await clipReel({ appPfad: APP.pfad, marke: M, wuerfel, ziel, wurzel: WURZEL });

  writeFileSync(join(zielOrdner, `${dateiname}.txt`), [
    dateiname,
    '='.repeat(dateiname.length),
    '',
    `Marke: ${M.wortmarke}   Format: ${FORMAT}   Sprache: ${LANG.toUpperCase()}`,
    `Laenge: ${r.sekunden.toFixed(1)} s   Seed: ${SEED}   Ton: keiner (stumm)   Clip: ${r.datei}`,
    '',
    '── CAPTION ZUM KOPIEREN ──────────────────────────────',
    '',
    `${r.saetze[0]} ${r.saetze[1]}`,
    '',
    'Buchung, Bestätigung, Erinnerung und Zahlung laufen über WELLbooked! – '
      + 'du konzentrierst dich voll und ganz auf deine Arbeit. Kein Telefonieren, '
      + 'kein Hin und Her wegen der Terminvereinbarung.',
    '',
    `Als Gründungspartner:in: ${r.gratisMonate} Monate ohne Abo und ohne Provision.`,
    '',
    'Was kostet dich im Alltag am meisten Zeit – Telefon, Nachrichten oder Papierkram? 👇',
    '',
    ANBIETER_HASHTAGS,
    '',
    '── LINK ──────────────────────────────────────────────',
    '',
    `Gründungspartner:in werden: ${r.ziel}`,
    '',
    '── VOR DEM POSTEN ────────────────────────────────────',
    '',
    '• Das Video ist stumm und bleibt es — bei WELLbooked! ist Stille Vorgabe.',
    '',
    '- Medienherkunft: ki-menschen (Wasserzeichen gesetzt) — KI-Clip aus '
      + 'wellbooked/docs/social/clips/, Herkunft in HERKUNFT.md',
    '',
  ].join('\n'));
  console.log(`✓ ${dateiname}.mp4  ${r.sekunden.toFixed(1)} s  ${B}×${H}  stumm  (${r.datei})`);
  console.log(`✓ ${dateiname}.txt`);
  process.exit(0);
}

// --- Sonderweg: der echte Kalender (23.09.2026) ------------------------------
//
// Kein Typografie-Reel, sondern ein Bildschirmmitschnitt mit Streifen darüber
// und darunter — eigene Datei, eigener Ablauf, siehe kalender-reel.mjs.
if (MARKE === 'wellbooked' && FORMAT === 'kalender-demo') {
  const { kalenderReel } = await import('./kalender-reel.mjs');
  const dateiname = NAME ?? `${MARKE}-${FORMAT}-${LANG}-s${SEED}`;
  const zielOrdner = resolve(OUT);
  mkdirSync(zielOrdner, { recursive: true });
  const ziel = join(zielOrdner, `${dateiname}.mp4`);
  const r = await kalenderReel({ appPfad: APP.pfad, marke: M, wuerfel, ziel, wurzel: WURZEL });

  // ⚠ Eigene Linkzeile (── LINK ──): beschreibung.mjs setzt sie statt
  // „Hier buchen: wellbooked.at" — der Post richtet sich an Anbieter:innen.
  writeFileSync(join(zielOrdner, `${dateiname}.txt`), [
    dateiname,
    '='.repeat(dateiname.length),
    '',
    `Marke: ${M.wortmarke}   Format: ${FORMAT}   Sprache: ${LANG.toUpperCase()}`,
    `Laenge: ${r.sekunden.toFixed(1)} s   Seed: ${SEED}   Ton: keiner (stumm)   Aufnahme: ${r.datei}`,
    '',
    '── CAPTION ZUM KOPIEREN ──────────────────────────────',
    '',
    `${r.text}`,
    '',
    'So sieht dein Kalender in WELLbooked! aus – eine echte Aufnahme, keine Attrappe. '
      + 'Arbeitszeiten, Pausen und dein Team an einem Ort, Buchungen kommen direkt hinein.',
    '',
    `Als Gründungspartner:in: ${r.gratisMonate} Monate ohne Abo und ohne Provision.`,
    '',
    'Wie planst du deine Termine heute – Buch, Handy oder Kopf? 👇',
    '',
    ANBIETER_HASHTAGS,
    '',
    '── LINK ──────────────────────────────────────────────',
    '',
    `Gründungspartner:in werden: ${r.ziel}`,
    '',
    '── VOR DEM POSTEN ────────────────────────────────────',
    '',
    '• Das Video ist stumm und bleibt es — bei WELLbooked! ist Stille Vorgabe.',
    '',
    '- Medienherkunft: bildschirmaufnahme (echte Kalender-Komponenten, Demo-Daten — kein KI-Bild)',
    '',
  ].join('\n'));
  console.log(`✓ ${dateiname}.mp4  ${r.sekunden.toFixed(1)} s  ${B}×${H}  stumm  (${r.datei})`);
  console.log(`✓ ${dateiname}.txt`);
  process.exit(0);
}

const inhalt = MARKE === 'swaply' ? await swaplyInhalt() : wellbookedInhalt();

// --- Szenen -----------------------------------------------------------------
//
// Bewusst kurz: 14 Sekunden. Ein Typografie-Reel ohne Ton haelt niemanden
// laenger, und TikTok bewertet die ANTEILIGE Sehdauer — ein kurzes, das zu
// Ende gesehen wird, schlaegt ein langes, das nach fuenf Sekunden weggewischt
// wird.
const SZENEN = [
  { art: 'kopf', sek: 2.5 },
  ...(inhalt.vorher ? [{ art: 'vorher', sek: 2 }] : []),
  ...inhalt.karten.map(() => ({ art: 'karte', sek: 2 })),
  { art: 'schluss', sek: 3 },
];

function html() {
  const schrift = readFileSync(join(WURZEL, 'tools', 'reels', 'assets', 'outfit.woff2')).toString('base64');
  const daten = JSON.stringify({
    szenen: SZENEN, inhalt, marke: M, fps: FPS, lang: LANG, badges: storeBadges(),
  });

  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${schrift}) format('woff2');
  font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden;background:${GRUND}}
body{font-family:Outfit,sans-serif;color:${TINTE}}
.buehne{position:relative;width:100%;height:100%}
.buehne::before{content:'';position:absolute;inset:0;
  background:radial-gradient(90% 55% at 50% 12%, ${SCHIMMER}, transparent 70%)}
.karte{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:150px 90px;text-align:center;opacity:0}
.marke{position:absolute;top:96px;left:0;right:0;text-align:center;
  font-size:34px;font-weight:700;letter-spacing:.18em;color:${TINTE};opacity:.9}
.fuss{position:absolute;bottom:110px;left:0;right:0;text-align:center;
  font-size:32px;font-weight:500;color:${TINTE_LEISE}}
.kopfzeile{font-size:88px;font-weight:700;line-height:1.08;max-width:860px}
.vorherWort{font-size:40px;font-weight:600;letter-spacing:.14em;color:${TINTE_LEISE};
  margin-bottom:26px}
.vorherText{font-size:76px;font-weight:600;line-height:1.15;max-width:860px;
  text-decoration:line-through;text-decoration-thickness:5px;color:${TINTE_LEISE}}
.zahl{width:120px;height:120px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:56px;font-weight:700;margin-bottom:46px;
  border:3px solid ${HELL ? TINTE : inhalt.akzent};color:${HELL ? TINTE : inhalt.akzent}}
.text{font-size:70px;font-weight:600;line-height:1.2;max-width:880px}
.schluss{font-size:80px;font-weight:700;line-height:1.1;max-width:880px}
.schlussZusatz{font-size:36px;font-weight:400;color:${TINTE_LEISE};margin-top:36px;
  line-height:1.4;max-width:820px}
/* ⚠ Store-Knoepfe: feste HOEHE, Breite aus dem Bild — so bleibt jedes Badge in
   seinem eigenen Seitenverhaeltnis. Apple und Google untersagen in ihren
   Richtlinien beides: verzerren und nachzeichnen. Und sie werden NICHT
   animiert; die Einblendung der ganzen Szene genuegt. */
.badges{display:flex;flex-direction:column;align-items:center;gap:24px;margin-top:48px}
.badges img{height:108px;width:auto;display:block}
</style></head><body><div class="buehne" id="b"></div><script>
const D = ${daten};
const b = document.getElementById('b');

const marke = document.createElement('div');
marke.className = 'marke';
marke.textContent = D.marke.wortmarke.toUpperCase();
b.appendChild(marke);

let kartenIndex = 0;
const bloecke = D.szenen.map((s) => {
  const d = document.createElement('div');
  d.className = 'karte';
  if (s.art === 'kopf') {
    d.innerHTML = '<div class="kopfzeile"></div>';
    d.querySelector('.kopfzeile').textContent = D.inhalt.kopf;
  } else if (s.art === 'vorher') {
    d.innerHTML = '<div class="vorherWort"></div><div class="vorherText"></div>';
    d.querySelector('.vorherWort').textContent =
      ({ de: 'STATT', en: 'INSTEAD OF', es: 'EN VEZ DE' })[D.lang] || 'STATT';
    d.querySelector('.vorherText').textContent = D.inhalt.vorher;
  } else if (s.art === 'karte') {
    const k = D.inhalt.karten[kartenIndex++];
    d.innerHTML = '<div class="zahl"></div><div class="text"></div>';
    d.querySelector('.zahl').textContent = k.zahl;
    d.querySelector('.text').textContent = k.text;
  } else {
    d.innerHTML = '<div class="schluss"></div><div class="schlussZusatz"></div>'
      + '<div class="badges"></div>';
    d.querySelector('.schluss').textContent = D.marke.spruch[D.lang] || D.marke.spruch.de;
    d.querySelector('.schlussZusatz').textContent = D.marke.zusatz[D.lang] || D.marke.zusatz.de;
    // ⚠ Nur die Stores, in denen es die App wirklich gibt — D.badges ist leer,
    // wenn apps.json das sagt oder eine Datei fehlt.
    const kasten = d.querySelector('.badges');
    for (const quelle of D.badges) {
      const img = document.createElement('img');
      img.src = quelle;
      kasten.appendChild(img);
    }
  }
  b.appendChild(d);
  return d;
});

const fuss = document.createElement('div');
fuss.className = 'fuss';
fuss.textContent = D.inhalt.fuss || '';
b.appendChild(fuss);

const grenzen = [];
let summe = 0;
for (const s of D.szenen) { const von = summe; summe += Math.round(s.sek * D.fps); grenzen.push([von, summe]); }
window.__gesamt = summe;

window.setFrame = (n) => {
  bloecke.forEach((k, i) => {
    const [von, bis] = grenzen[i];
    let o = 0;
    if (n >= von && n < bis) {
      const rel = n - von, laenge = bis - von, rand = Math.round(0.3 * D.fps);
      o = Math.min(1, rel / rand, (laenge - rel) / rand);
    }
    k.style.opacity = String(Math.max(0, o));
  });
  // Die Fusszeile blendet erst nach der Kopfszene ein — sonst konkurriert sie
  // mit der Ueberschrift um den Blick.
  const abFrame = grenzen[0][1];
  fuss.style.opacity = n > abFrame ? '1' : '0';
};

document.fonts.ready.then(() => { window.setFrame(0); window.__bereit = true; });
</script></body></html>`;
}

// --- Beiblatt ---------------------------------------------------------------
//
// ⚠ Die Ueberschrift „CAPTION ZUM KOPIEREN" ist Pflicht: captionAus() sucht
// genau sie. Fehlt sie, gibt es keinen Beitragstext — und posten.mjs bricht
// ab, statt etwas Falsches hochzuladen (Rettungsnetz vom 05.09.).
function beiblatt(dateiname, sekunden) {
  const hashtags = MARKE === 'swaply'
    ? '#gewohnheiten #swaply #routine #selfcare'
    : '#wellness #wellbooked #massage #kosmetik';
  const caption = [
    inhalt.caption,
    '',
    M.spruch[LANG] ?? M.spruch.de,
    '',
    hashtags,
  ].join('\n');

  return [
    dateiname,
    '='.repeat(dateiname.length),
    '',
    `Marke: ${M.wortmarke}   Format: ${FORMAT}   Sprache: ${LANG.toUpperCase()}`,
    `Laenge: ${sekunden.toFixed(1)} s   Seed: ${SEED}   Ton: keiner (stumm)`,
    '',
    '── CAPTION ZUM KOPIEREN ──────────────────────────────',
    '',
    caption,
    '',
    '── VOR DEM POSTEN ────────────────────────────────────',
    '',
    '• Das Video ist stumm. In der App einen Trending-Sound drueberlegen —',
    '  bei WELLbooked! NICHT: dort ist Stille Vorgabe.',
    '• Erste Zeile der Caption ist der Hook.',
    '',
  ].join('\n');
}

// --- Lauf -------------------------------------------------------------------

const dateiname = NAME ?? `${MARKE}-${FORMAT}-${LANG}-s${SEED}`;
const zielOrdner = resolve(OUT);
mkdirSync(zielOrdner, { recursive: true });
const ziel = join(zielOrdner, `${dateiname}.mp4`);

const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const ctx = await browser.newContext({ viewport: { width: B, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(html(), { waitUntil: 'load' });
await page.waitForFunction('window.__bereit === true', null, { timeout: 20000 });

const gesamt = await page.evaluate('window.__gesamt');
const senke = videoSenke({ fps: FPS, ziel });

for (let n = 0; n < gesamt; n++) {
  await page.evaluate((i) => window.setFrame(i), n);
  const bild = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!senke.stdin.write(bild)) await new Promise((r) => senke.stdin.once('drain', r));
}
senke.stdin.end();
await senke.fertig;
await browser.close();

writeFileSync(join(zielOrdner, `${dateiname}.txt`), beiblatt(dateiname, gesamt / FPS));

console.log(`✓ ${dateiname}.mp4  ${(gesamt / FPS).toFixed(1)} s  ${B}×${H}  stumm`);
console.log(`✓ ${dateiname}.txt`);
