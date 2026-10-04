// Die freie Karte für die vier Apps, die sie in ihrem eigenen Repo nicht haben:
// Mahjong Royale, WELLbooked!, FullRep und Swaply. 1080×1350.
//
//   CHROMIUM_PFAD=… node tools/social/karten-fremd/freie-karte.mjs \
//     --app swaply --lang de --seed 4711 --name probe --out /tmp/x \
//     --text "Dein Satz." [--haken "Wusstest du?"] [--marke "Swaply 2.0"] [--cta "Jetzt tauschen"]
//
// --- Warum (Josef, 04.10.2026: „bau die karten für alle apps") --------------
//
// Die freie Karte gab es seit dem 18.09. nur für Anigosha, weil das Format
// `freie-karte` in anigosha/tools/post-bild.mjs steckt. Auf der Freigabe-Seite
// stand deshalb ein Auswahlmenü mit genau einer Zeile, und `lauf.mjs --karte`
// brach bei den anderen vier ab. Das war ehrlich, aber es war eine Lücke.
//
// ⚠ WARUM DER GENERATOR HIER LIEGT UND NICHT IN DEN VIER REPOS. Derselbe
// Grund wie bei reels-fremd/ nebenan, nur schärfer: Bei Swaply und
// WELLbooked! darf dieser Arbeitsplatz nur LESEN — ein Generator wäre dort
// nicht einzuchecken. Und er wäre VIERMAL zu pflegen: Eine freie Karte zieht
// nichts aus den Daten der App, sie zeigt einen Satz, den ein Mensch tippt.
// Vier Kopien desselben Layouts laufen nach dem zweiten Repo auseinander.
//
// ⚠ ER BRAUCHT KEIN APP-REPO. Alles, was er zeichnet, liegt in diesem Repo:
// Farben, Schriften und Zeichen in kanal/marken.json und kanal/marken-mittel/,
// die Store-Abzeichen in kanal/badges/. Das ist der Unterschied zu
// reels-fremd/fullrep-uebung-schritte.mjs, das seine Übungsbilder aus mypeak
// holt — und der Grund, warum der Workflow für eine Karte kein App-Repo mehr
// auschecken muss.
//
// ⚠ ANIGOSHA BLEIBT BEI SEINEM EIGENEN GENERATOR. Seine Karte steht seit dem
// 18.09. im Feed, sie trägt das Wasserzeichen mit den beiden Figuren und die
// Randfigur aus apps.json — beides kennt diese Datei nicht. Sie hier
// nachzubauen hieße, einen laufenden Beitrag ohne Not zu verändern.
// `motoren.mjs` schickt deshalb nur die vier anderen hierher.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HIER = dirname(fileURLToPath(import.meta.url));
const KANAL = join(HIER, '..', 'kanal');
const B = 1080, H = 1350;

const arg = (n, s = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? s : process.argv[i + 1];
};

// ⚠ `--app` ist hier der MARKENSCHLÜSSEL (swaply, mahjong, …), nicht der Pfad
// zum App-Repo — anders als in reels-fremd/, wo `--app` das Repo meint. Der
// Grund ist nicht Laune: `--marke` ist in dieser Datei schon vergeben, nämlich
// für Josefs Pille ganz oben auf der Karte (dasselbe Feld wie bei Anigosha).
// Zwei Bedeutungen für ein Argument wären schlimmer als zwei Namen für eine
// Sache, deshalb fängt die Probe unten einen Pfad ausdrücklich ab.
const SCHLUESSEL = arg('app');
const LANG = arg('lang', 'de');
const SEED = arg('seed', '0');
const OUT = arg('out', '.');
const STORE_SATZ = arg('store');

const frei = {
  text: arg('text'),
  haken: arg('haken'),
  marke: arg('marke'),
  cta: arg('cta'),
};

const MARKEN = JSON.parse(readFileSync(join(KANAL, 'marken.json'), 'utf8'));
const bekannt = Object.keys(MARKEN).filter((k) => !k.startsWith('_'));

if (SCHLUESSEL && SCHLUESSEL.includes('/')) {
  console.error(`✗ --app ${SCHLUESSEL} sieht nach einem Pfad aus.`);
  console.error('  Diese Datei will den Markenschluessel, nicht das App-Repo:');
  console.error(`  --app <${bekannt.join('|')}>. Ein App-Repo braucht sie nicht.`);
  process.exit(1);
}
const M = MARKEN[SCHLUESSEL];
if (!M) {
  console.error(`✗ unbekannte Marke: ${SCHLUESSEL}\n  Bekannt: ${bekannt.join(', ')}`);
  process.exit(1);
}
// Die freie Karte hat keine Datenquelle, aus der ein fehlender Text zu
// ersetzen wäre. Ohne `--text` entstünde eine Karte mit Logo, Fußzeile und
// nichts dazwischen — und die fällt erst auf, wenn sie in der Freigabe steht.
if (!frei.text) {
  console.error('✗ Fehlt: --text "Dein Satz."   (Pflicht)');
  process.exit(1);
}

/**
 * Die Hashtags je Marke — höchstens fünf gehen ohnehin raus (MAX_HASHTAGS in
 * vorflug.mjs), hier stehen vier.
 *
 * ⚠ Die Reihenfolge ist spezifisch → allgemein, wie in allen fünf Repos:
 * beschreibung.mjs nimmt die ERSTEN fünf, nicht die besten. Wer hier
 * umsortiert, ändert, welche Schlagwörter wirklich rausgehen.
 *
 * ⚠ Nicht erfunden, sondern aus dem `dreiklang` der jeweiligen Marke in
 * marken.json abgelesen — das ist die Liste, die auch auf den Kanalbildern
 * steht. Anigosha fehlt: seine Karte baut sein eigener Generator.
 */
const HASHTAGS = {
  mahjong: ['mahjongroyale', 'mahjong', 'solitaire', 'puzzle'],
  wellbooked: ['wellbooked', 'wellness', 'massage', 'kosmetik'],
  fullrep: ['fullrep', 'krafttraining', 'muskelaufbau', 'fitness'],
  swaply: ['swaply', 'gewohnheiten', 'dranbleiben', 'kleineschritte'],
  anigosha: ['anigosha', 'animequiz', 'anime', 'quiz'],
};

const b64 = (p) => readFileSync(p).toString('base64');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Zeilenumbrüche aus dem Textfeld der Freigabe-Seite überleben. ⚠ ERST
// escapen, dann die Umbrüche setzen — andersherum fräse `esc` das eigene
// <br> wieder zu Text.
const mitUmbruch = (s) => esc(s).replace(/\r?\n/g, '<br>');

// --- Markenmittel -----------------------------------------------------------
//
// ⚠ Eine per Datei-URL geladene Seite lädt zwar file://, aber die Schriften
// und das Zeichen werden trotzdem eingebettet: So ist es bei allen anderen
// Generatoren dieses Portfolios, und so bleibt die Seite ein einziges
// Dokument, das man zum Nachsehen irgendwohin kopieren kann.
const mittelPfad = (rel) => join(KANAL, rel);
for (const [feld, rel] of Object.entries(M.mittel ?? {})) {
  if (!existsSync(mittelPfad(rel))) {
    console.error(`✗ ${M.name}: ${feld} fehlt (${rel}).`);
    console.error('  Markenmittel liegen in tools/social/kanal/marken-mittel/<marke>/.');
    process.exit(1);
  }
}
const ICON = `data:image/png;base64,${b64(mittelPfad(M.mittel.icon))}`;
const schriftRegel = (name, rel) =>
  `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${b64(mittelPfad(rel))}) format('woff2')}`;

// Die Store-Abzeichen. ⚠ Gezeigt wird nur, was zutrifft — ein Abzeichen für
// einen Store ohne App ist eine Falschaussage IM BILD, die kein Textprüfer
// je findet. `stores` ist dieselbe Angabe, aus der vorflug.mjs den
// Verfügbarkeitssatz baut.
const badges = [
  M.stores?.ios && 'appstore-en.png',
  M.stores?.android && 'googleplay-en.png',
].filter(Boolean)
  .map((f) => join(KANAL, 'badges', f))
  .filter(existsSync)
  .map((f) => `<img src="data:image/png;base64,${b64(f)}" alt="">`)
  .join('');

// --- Farben -----------------------------------------------------------------
//
// ⚠ SWAPLYS FALLE, und sie ist in marken.json ausführlich aufgeschrieben:
// Steht dort `grundVerlauf`, ist der HELLE Icon-Verlauf der Hintergrund — und
// dann MUSS die Schrift dunkel sein (`tinte`). Weiß misst auf den drei Punkten
// des Verlaufs 3,22 / 2,61 / 2,13:1; nötig sind 4,5:1. Wer den Verlauf nimmt
// und die helle Schrift stehen lässt, baut einen unlesbaren Beitrag, dem man
// das im Entwurf nicht ansieht.
const hell = Array.isArray(M.grundVerlauf) && M.grundVerlauf.length > 0;
const grund = hell
  ? `linear-gradient(150deg,${M.grundVerlauf.join(',')})`
  : `radial-gradient(120% 90% at 14% 0%,${M.grundTief ?? M.grund} 0%,${M.grund} 64%)`;
const tinte = hell ? (M.tinte ?? '#111') : M.schrift;
const tinteLeise = hell ? (M.tinteLeise ?? 'rgba(0,0,0,.62)') : M.gedaempft;
const akzent = hell ? (M.tinte ?? '#111') : (M.mint ?? M.verlauf?.[0] ?? M.schrift);

/**
 * Kontrastverhältnis nach WCAG 2.1 — damit die Farbwahl unten gemessen ist
 * und nicht geschätzt.
 *
 * ⚠ Genau diese Rechnung steht schon in marken.json bei Swaplys
 * `_grund_hinweis` („Weiss misst auf den drei Punkten des Verlaufs 3,22 /
 * 2,61 / 2,13:1"). Sie hier zu wiederholen ist billiger, als die Zahlen von
 * Hand nachzutragen, sobald jemand eine Farbe ändert.
 */
function kanal(c) { return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function leuchtkraft(hex) {
  const h = String(hex).replace('#', '');
  const voll = h.length === 3 ? [...h].map((x) => x + x).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(voll.slice(i, i + 2), 16) / 255);
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}
function kontrast(a, b) {
  const [x, y] = [leuchtkraft(a), leuchtkraft(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// --- Die Farbe des Hakens, gemessen -----------------------------------------
//
// ⚠ DER MARKENVERLAUF IST NICHT IMMER LESBAR. Der Haken lief zuerst bei allen
// vier Marken im Verlauf, wie auf Anigoshas Karte. Am gerenderten JPEG fiel
// auf: Bei WELLbooked! steht damit Dunkelgrün (#2d6a4f) auf Dunkelgrün
// (#1b4332) — gemessen 1,73:1, und die Zeile verschwindet fast. Anigosha
// kommt damit durch, weil SEIN Verlauf hell ist (#a78bfa auf #0f0a1e).
//
// Also gemessen statt übernommen: Der Verlauf trägt den Haken nur, wenn BEIDE
// Stufen mindestens 3:1 gegen den Grund schaffen (WCAG-Schwelle für grosse,
// fette Schrift — der Haken ist 30px und 700). Sonst nimmt er den Akzent der
// Marke, und wenn auch der zu dunkel ist, die gewöhnliche Schriftfarbe.
//
// ⚠ Gemessen wird gegen die HELLERE der beiden Grundfarben. Der Grund ist ein
// Verlauf von `grundTief` nach `grund`, und der Haken kann über beiden liegen;
// für helle Schrift ist der hellere Grund der schlechtere Fall. Gegen den
// dunkleren zu messen hiesse, sich das Ergebnis auszusuchen.
const grundBezug = hell
  ? (M.grundVerlauf?.[1] ?? '#fff')
  : [M.grund, M.grundTief ?? M.grund].sort((a, b) => leuchtkraft(b) - leuchtkraft(a))[0];
const verlaufStufen = (!hell && Array.isArray(M.verlauf)) ? M.verlauf.slice(0, 2) : [];
const verlaufTraegt = verlaufStufen.length > 1
  && verlaufStufen.every((f) => kontrast(f, grundBezug) >= 3);
const hakenEinzel = kontrast(akzent, grundBezug) >= 3 ? akzent : tinte;
const hakenFarbe = verlaufTraegt
  ? `background:linear-gradient(100deg,${verlaufStufen.join(',')});`
    + '-webkit-background-clip:text;background-clip:text;color:transparent'
  : `color:${hakenEinzel}`;
// Die gemessenen Werte gehören ins Protokoll und ins Beiblatt: Sonst steht am
// Ende eine Farbwahl da, die niemand nachrechnen kann.
const hakenBericht = verlaufTraegt
  ? `Markenverlauf ${verlaufStufen.join(' → ')} `
    + `(${verlaufStufen.map((f) => kontrast(f, grundBezug).toFixed(2)).join(' / ')}:1 gegen ${grundBezug})`
  : `einfarbig ${hakenEinzel} (${kontrast(hakenEinzel, grundBezug).toFixed(2)}:1 gegen ${grundBezug})`
    + (verlaufStufen.length > 1 ? ' — der Markenverlauf bleibt unter 3:1' : ' — die Marke hat keinen Verlauf');

// --- Die beiden weichen Lichter ---------------------------------------------
//
// ⚠ ZWEIMAL DERSELBE AKZENT FLUTET DIE KARTE. Die Lichter nehmen die erste
// und letzte Stufe des Markenverlaufs — wo es keinen gibt (FullRep: flaches
// Amber), wäre es zweimal dasselbe Amber in voller Stärke. Am gerenderten
// JPEG gesehen: FullReps nahezu schwarzer Grund wurde damit durchgehend
// oliv-braun. Deshalb bei einfarbigen Marken die halbe Deckung.
//
// Die Deckung hängt als Hex-Paar am Farbwert; alle Farben in marken.json sind
// sechsstellige Hexwerte, und nur dort ist das zulässig.
const schein = hell ? null : {
  a: `${M.verlauf?.[0] ?? akzent}${M.verlauf ? '44' : '22'}`,
  b: `${M.verlauf?.[2] ?? M.verlauf?.[0] ?? akzent}${M.verlauf ? '33' : '16'}`,
};

const spruch = M.spruch?.[LANG] ?? M.spruch?.de ?? '';
const versalien = M.displayVersalien ? 'text-transform:uppercase;letter-spacing:.005em;' : '';

// --- Die Karte --------------------------------------------------------------
//
// ⚠ Die Schriftgröße der Schlagzeile wird GEMESSEN, nicht aus einer Tabelle
// geholt. Anigoshas Karte kann sich eine Stufentabelle leisten: eine Marke,
// eine Schrift. Hier sind es vier Marken mit drei verschiedenen Schriften —
// Anton (sehr schmal, Versalien) trägt bei derselben Größe fast doppelt so
// viele Zeichen je Zeile wie Fredoka. Eine Tabelle wäre für drei der vier
// Marken geraten; die Seite misst stattdessen selbst und nimmt die größte
// Stufe, bei der nichts überläuft.
const STUFEN = [118, 104, 92, 84, 76, 68, 60, 54, 48, 44, 40, 36];

const html = `<!doctype html><html lang="${esc(LANG)}"><head><meta charset="utf-8"><style>
${schriftRegel('Display', M.mittel.display)}
${schriftRegel('Text', M.mittel.body)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden}
body{font-family:'Text',system-ui,sans-serif;color:${tinte};background:${grund};
  position:relative;display:flex;flex-direction:column;padding:90px}
/* Zwei weiche Lichter aus dem Markenverlauf — dasselbe Mittel wie auf den
   Kanalbildern. Auf hellem Grund entfallen sie: Dort trägt der Verlauf
   selbst, und ein Licht darauf wäre ein grauer Fleck. */
.schein{position:absolute;border-radius:50%;filter:blur(110px);pointer-events:none}
.s1{width:${Math.round(B * 0.75)}px;height:${Math.round(B * 0.75)}px;right:-14%;top:4%;
  background:${schein?.a ?? 'transparent'}}
.s2{width:${Math.round(B * 0.8)}px;height:${Math.round(B * 0.8)}px;left:-18%;bottom:2%;
  background:${schein?.b ?? 'transparent'}}
.kopf,.inhalt,.fuss{position:relative;z-index:2}
.kopf{display:flex;align-items:center;gap:16px}
.kopf img{width:52px;height:52px;border-radius:12px;display:block}
.kopf span{font-weight:700;letter-spacing:.3em;font-size:24px;color:${tinteLeise};
  text-transform:uppercase}
/* ⚠ KEIN min-height:0 — so verlockend es an einem Flex-Element aussieht.
   Mit min-height:0 darf dieser Block SCHRUMPFEN, der Text läuft sichtbar über
   seine Kanten hinaus, und der Body meldet trotzdem keinen Überlauf. Genau so
   gemessen (04.10.2026): 444 Zeichen gingen als „passt" durch, auf dem
   fertigen JPEG lag die Schlagzeile über der Wortmarke und die Schlusszeile
   über der Fußzeile. Mit dem Vorgabewert min-height:auto WÄCHST der Block
   über die Karte hinaus, und genau daran erkennt die Messung unten den
   Überlauf. */
.inhalt{flex:1;display:flex;flex-direction:column;justify-content:center;gap:26px;
  padding:40px 0}
.marke{align-self:flex-start;border-radius:999px;padding:10px 24px;font-size:26px;
  font-weight:700;color:${tinte};border:2px solid ${M.linie ?? 'rgba(255,255,255,.14)'};
  background:${hell ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.08)'}}
.haken{font-size:30px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  ${hakenFarbe}}
h1{font-family:'Display',system-ui,sans-serif;font-size:76px;line-height:1.14;
  font-weight:700;letter-spacing:-.01em;${versalien}}
.cta{font-size:34px;font-weight:700;color:${akzent}}
.fuss{display:flex;justify-content:space-between;align-items:center;gap:24px;
  font-size:24px;color:${tinteLeise}}
.fuss span:first-child{max-width:560px}
.badges{display:flex;align-items:center;gap:14px;flex:none}
/* ⚠ Feste HOEHE, Breite aus dem Bild — Apple und Google untersagen beides:
   verzerren und nachzeichnen. */
.badges img{height:52px;width:auto;display:block}
</style></head><body>
<div class="schein s1"></div><div class="schein s2"></div>
<div class="kopf"><img src="${ICON}"><span>${esc(M.wortmarke ?? M.name)}</span></div>
<div class="inhalt">
  ${[
    frei.marke && `<div class="marke">${esc(frei.marke)}</div>`,
    frei.haken && `<div class="haken">${mitUmbruch(frei.haken)}</div>`,
    `<h1 id="satz">${mitUmbruch(frei.text)}</h1>`,
    frei.cta && `<div class="cta">${mitUmbruch(frei.cta)}</div>`,
  ].filter(Boolean).join('\n  ')}
</div>
<div class="fuss"><span>${esc(spruch)}</span><span class="badges">${badges}</span></div>
<script>
// Die größte Stufe nehmen, bei der nichts überläuft.
//
// ⚠ Gemessen wird am BODY, nicht am Inhaltsblock. Der steht auf flex:1 und
// hat damit min-height:auto — er WÄCHST über die Karte hinaus, statt seinen
// Inhalt abzuschneiden, und meldet deshalb nie einen Überlauf. Genau diese
// Messung hat Anigoshas Generator am 18.09. schon einmal in die Irre geführt
// (dort steht sie als Warnung im Code). Abgeschnitten wird am Body, also wird
// dort gemessen.
const stufen = ${JSON.stringify(STUFEN)};
const satz = document.getElementById('satz');
document.fonts.ready.then(() => {
  let gewaehlt = stufen[stufen.length - 1];
  for (const px of stufen) {
    satz.style.fontSize = px + 'px';
    if (document.body.scrollHeight - window.innerHeight <= 2) { gewaehlt = px; break; }
  }
  satz.style.fontSize = gewaehlt + 'px';
  window.__groesse = gewaehlt;
  window.__ueber = document.body.scrollHeight - window.innerHeight;
  window.__bereit = true;
});
</script></body></html>`;

mkdirSync(OUT, { recursive: true });
const name = arg('name', `${SCHLUESSEL}-freie-karte-${LANG}-s${SEED}`);
const ziel = join(OUT, `${name}.jpg`);

const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
let groesse = 0;
try {
  const seite = await browser.newPage({ viewport: { width: B, height: H }, deviceScaleFactor: 1 });
  await seite.setContent(html, { waitUntil: 'load' });
  await seite.waitForFunction('window.__bereit === true', null, { timeout: 20000 });
  groesse = await seite.evaluate(() => window.__groesse);
  const ueber = await seite.evaluate(() => window.__ueber);

  // ⚠ Abbrechen statt abschneiden. `overflow:hidden` schneidet zu langen Text
  // lautlos ab — das Bild sieht dann fertig aus und ist mittendrin zu Ende.
  // Anders als beim Tageslauf lässt sich das hier beheben: Der Text kommt von
  // außen, ein Mensch kann ihn kürzen.
  if (ueber > 2) {
    console.error(`✗ Der Text passt nicht: ${ueber}px zu viel, schon bei der kleinsten Stufe (${groesse}px).`);
    console.error(`  ${[...frei.text].length} Zeichen im Satz`
      + `${frei.haken ? `, dazu ein Haken` : ''}${frei.cta ? `, dazu eine Schlusszeile` : ''}.`);
    console.error('  Kuerze --text, oder lass --haken/--marke/--cta weg.');
    process.exit(1);
  }
  writeFileSync(ziel, await seite.screenshot({ type: 'jpeg', quality: 92 }));
} finally {
  await browser.close();
}

// --- Das Beiblatt -----------------------------------------------------------
//
// ⚠ DIE RUBRIK „ZUR KONTROLLE" IST EINE GRENZE, KEIN TEXT. `captionAus()` in
// vorflug.mjs schneidet die Caption an der nächsten unterstrichenen
// Überschrift ab. Fehlt sie, läuft die Caption bis ans Dateiende und nimmt
// „Store-Satz: …" mit — und der Versand bricht ab mit „Verräter: Store-Satz
// im Bild". Genau das ist Anigoshas freier Karte am 18.09. passiert; die
// Leitplanke hat getan, wofür sie da ist, aber der Lauf war weg.
//
// ⚠ Die Hashtags stehen INNERHALB der Caption, als eigene Zeile. Das ist
// Absicht und dieselbe Bauart wie bei reels-fremd/fullrep-uebung-schritte.mjs:
// beschreibung.mjs löst sie dort heraus, kürzt auf fünf und hängt sie hinter
// den App-Link. Ein eigener Abschnitt „## Hashtags" ginge auch — zwei Wege
// für dieselbe Sache sind einer zu viel.
const tags = (HASHTAGS[SCHLUESSEL] ?? []).map((t) => `#${t}`).join(' ');
writeFileSync(join(OUT, `${name}.txt`), `${name}

CAPTION ZUM KOPIEREN
--------------------
${[frei.haken, frei.text, frei.cta].filter(Boolean).join('\n\n')}

${tags}

ZUR KONTROLLE (nicht posten)
----------------------------
Freier Text, von Hand gegeben — keine Daten der App, keine Loesung, keine
Erklaerung. Wer ihn prueft, prueft ihn gegen die Wirklichkeit, nicht gegen
eine Quelle im Repo.

Medienherkunft: typografie
Im Bild: Wortmarke, Zeichen, der Satz und die Store-Abzeichen${badges ? '' : ' (keine)'}.
Store-Satz (aus apps.json gebaut, steht NICHT im Bild): ${STORE_SATZ ?? '—'}
Schriftgroesse der Schlagzeile: ${groesse}px bei ${[...frei.text].length} Zeichen
Haken: ${hakenBericht}
`);

console.log(`✓ ${ziel}`);
console.log(`  ${B}×${H} · freie Karte · ${M.name} · ${LANG} · ${[...frei.text].length} Zeichen bei ${groesse}px`);
console.log(`  Haken: ${hakenBericht}`);
