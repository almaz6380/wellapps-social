// Kanal-Ausstattung fuer eine Marke: Profilbild, Titelbild, Kopfzeilen, Bios.
//
//   CHROMIUM_PFAD=/opt/pw-browsers/chromium node tools/social/kanal/assets.mjs --marke swaply
//   node tools/social/kanal/assets.mjs --marke swaply --sprache en
//   node tools/social/kanal/assets.mjs --marke swaply --raster    (Beschnittrahmen)
//
// Muster: mypeak/scripts/kanal-assets.mjs, aber MARKENGESTEUERT — die Daten
// stehen in marken.json, nicht im Code. So kommen Mahjong und Anigosha ohne
// Codeaenderung dazu.
//
// ⚠ Eine per setContent() gebaute Seite hat KEINEN Origin; file:// laedt dort
// nicht. Schrift und Zeichen muessen eingebettet sein.
//
// --- Was es NICHT gibt, und warum -------------------------------------------
//
// „Titelbild fuer TikTok und Instagram" existiert nicht. Beide Profile haben
// ausschliesslich ein rundes Avatar. Statt Platzhalter fuer nicht vorhandene
// Plaetze liefert diese Datei, was dort tatsaechlich die Kopfzeile bildet:
// bei Instagram drei Rasterkacheln, bei TikTok das Trailer-Cover. Ein echtes
// Titelbild hat nur Facebook.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..', '..');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const MARKE = arg('marke', null);
const LANG = arg('sprache', 'de');
const RASTER = process.argv.includes('--raster');

const MARKEN = JSON.parse(readFileSync(join(HIER, 'marken.json'), 'utf8'));
const M = MARKEN[MARKE];
if (!M) {
  console.error(`✗ unbekannte Marke: ${MARKE}\n  Bekannt: `
    + Object.keys(MARKEN).filter((k) => !k.startsWith('_')).join(', '));
  process.exit(1);
}

// ⚠ NICHT nach out/ — das ist gitignoriert (dort liegen die taeglichen Posts,
// die aus ihrem Seed jederzeit neu entstehen). Kanal-Ausstattung ist das
// Gegenteil: Sie wird einmal gebaut und jahrelang benutzt. Ein Container einer
// Cloud-Sitzung ist fluechtig — was hier nicht committet wird, ist weg.
const OUT = join(WURZEL, arg('out', `tools/social/kanal/fertig/${MARKE}`));

// Zeichen zaehlen, wie es ein Mensch tut: „🔄" ist EINES, nicht zwei.
const zeichen = (s) => [...String(s)].length;
const GRENZEN = { tiktok: 80, instagram: 150, facebook: 101 };

// ⚠ Harte Grenzen. Ein Text darueber wird von der Plattform ohne Vorwarnung
// abgeschnitten, meist mitten im wichtigsten Wort. Deshalb bricht der Lauf ab,
// BEVOR er zehn Minuten lang Bilder rendert.
const bioBericht = [];
for (const [sprache, satz] of Object.entries(M.bios)) {
  for (const [kanal, grenze] of Object.entries(GRENZEN)) {
    const n = zeichen(satz[kanal]);
    bioBericht.push({ sprache, kanal, n, grenze, ok: n <= grenze });
    if (n > grenze) {
      throw new Error(`Bio ${sprache}/${kanal} ist ${n} Zeichen lang, erlaubt sind ${grenze}.\n  „${satz[kanal]}"`);
    }
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const b64 = (p) => readFileSync(p).toString('base64');

// --- Markenmittel -----------------------------------------------------------
// ⚠ Das echte App-Icon und die echten Schriften der Marke, nicht nachgebaut.
// Der erste Entwurf hat das Tausch-Zeichen nachgezeichnet und eine
// Fremdschrift genommen — das Ergebnis war „irgendein Verlauf mit Kreis" und
// hatte mit Swaplys Auftritt nichts zu tun.
const mittelPfad = (rel) => join(HIER, rel);
const ICON = M.mittel?.icon ? b64(mittelPfad(M.mittel.icon)) : null;
const F_DISPLAY = M.mittel?.display ? b64(mittelPfad(M.mittel.display)) : null;
const F_BODY = M.mittel?.body ? b64(mittelPfad(M.mittel.body)) : null;

const [G1, G2, G3] = M.verlauf;
// Der Markenverlauf — exakt wie in landing/index.html: 105 Grad, drei Stopps.
const VERLAUF = `linear-gradient(105deg, ${G1} 0%, ${G2} 52%, ${G3} 100%)`;

function kopf(breite, hoehe) {
  return `<!doctype html><meta charset="utf-8"><style>
${F_DISPLAY ? `@font-face{font-family:'Display';src:url(data:font/woff2;base64,${F_DISPLAY}) format('woff2')}` : ''}
${F_BODY ? `@font-face{font-family:'Body';src:url(data:font/woff2;base64,${F_BODY}) format('woff2')}` : ''}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${breite}px;height:${hoehe}px;overflow:hidden}
/* ⚠ DUNKLER Grund, Verlauf nur als Akzent — so ist das Design gebaut.
   Umgekehrt (Verlauf als Flaeche) wirkt es blass und beliebig. */
body{font-family:${F_BODY ? "'Body'," : ''}system-ui,sans-serif;font-weight:600;
  color:${M.schrift};position:relative;background:${M.grund}}
/* Die weichen Farbschleier der Startseite: gruen und blau, sehr leise. */
body::before{content:'';position:absolute;inset:0;
  background:
    radial-gradient(58% 42% at 18% 8%, rgba(78,140,254,.20), transparent 68%),
    radial-gradient(62% 46% at 86% 92%, rgba(62,206,142,.18), transparent 70%),
    radial-gradient(40% 30% at 60% 50%, ${M.grundTief}, transparent 72%)}
.disp{font-family:${F_DISPLAY ? "'Display'," : ''}system-ui,sans-serif;font-weight:600;
  letter-spacing:-.015em}
.z{position:relative;z-index:3}
/* Das echte App-Icon, mit derselben Ecke und demselben Schatten wie auf der Seite. */
.icon{display:block;border-radius:26px;box-shadow:0 22px 45px -20px rgba(0,0,0,.7)}
.drei{display:flex;flex-wrap:wrap;gap:14px}
.drei span{border:1.5px solid ${M.linie};border-radius:999px;padding:12px 26px;
  font-size:26px;font-weight:700;color:${M.weich};white-space:nowrap}
.rahmen{position:absolute;z-index:9;border:3px dashed rgba(255,90,90,.9);
  display:flex;align-items:flex-start;justify-content:flex-end}
.rahmen b{background:rgba(255,90,90,.9);color:#fff;font-size:20px;padding:4px 10px}
</style>`;
}

const rahmen = (b, h, gB, gH, name) => (RASTER ? `
<div class="rahmen" style="width:${b}px;height:${h}px;left:${(gB - b) / 2}px;top:${(gH - h) / 2}px">
  <b>${name}</b></div>` : '');

const chips = (n, klasse = '') => `<div class="drei ${klasse}">`
  + M.dreiklang[LANG].slice(0, n).map((d) => `<span>${esc(d)}</span>`).join('') + '</div>';

const icon = (px, klasse = '') =>
  `<img class="icon ${klasse}" src="data:image/png;base64,${ICON}" width="${px}" height="${px}">`;

// --- Avatar 1080x1080 -------------------------------------------------------
// ⚠ Hier ist das Icon NICHT auf einen Grund gesetzt — es IST die Flaeche.
// Das App-Icon traegt seinen Verlauf schon; ein zweiter Grund darunter waere
// ein Rahmen um einen Rahmen. Alle drei Kanaele beschneiden ohnehin zum Kreis.
function avatar() {
  const B = 1080;
  return `${kopf(B, B)}
<body style="background:none">
<img src="data:image/png;base64,${ICON}" style="width:${B}px;height:${B}px;display:block">
<style>body::before{display:none}
${RASTER ? '.kreis{position:absolute;inset:0;border-radius:50%;border:3px dashed rgba(255,90,90,.9);z-index:9}' : ''}</style>
${RASTER ? '<div class="kreis"></div>' : ''}`;
}

// --- Facebook-Titelbild 1640x856 --------------------------------------------
// Facebook beschneidet zweimal verschieden: Desktop 820x312 (es bleiben 624 px
// Hoehe), Mobil 640x360 (es bleiben 1522 px Breite). Schnittmenge 1522x624 —
// alles Wesentliche liegt in einer mittigen Zone von 1440x560, mit Reserve.
function fbTitel() {
  const B = 1640, H = 856;
  return `${kopf(B, H)}
<body>
<div class="mitte z">
  <div class="links">
    ${icon(160)}
    <div>
      <div class="disp wort">${esc(M.wortmarke)}</div>
      <div class="spruch">${esc(M.spruch[LANG])}</div>
      <div class="zusatz">${esc(M.zusatz[LANG])}</div>
    </div>
  </div>
  ${chips(5)}
</div>
<style>
.mitte{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:1440px;display:flex;flex-direction:column;gap:48px}
.links{display:flex;align-items:center;gap:38px}
.wort{font-size:104px;line-height:.98}
/* Der Markenverlauf als Schrift-Fuellung: der Akzent sitzt auf dem Text,
   nicht unter allem. Genau so macht es die Startseite mit ihrer Ueberschrift. */
.spruch{font-size:36px;font-weight:800;margin-top:12px;
  background:${VERLAUF};-webkit-background-clip:text;background-clip:text;color:transparent}
.zusatz{font-size:26px;color:${M.gedaempft};margin-top:10px;font-weight:600}
</style>
${rahmen(1640, 624, B, H, 'Desktop 820×312')}
${rahmen(1522, 856, B, H, 'Mobil 640×360')}
${rahmen(1440, 560, B, H, 'Schutzzone')}`;
}

// --- Instagram: drei Kacheln, die EIN Banner ergeben ------------------------
// ⚠ RUECKWAERTS hochladen: 3, dann 2, dann 1. Das Raster sortiert
// neuestes-zuerst von links.
// ⚠ Kein Wort laeuft ueber die Fuge — durchlaufen darf nur die Linie.
function igKachel(n) {
  const B = 1080, H = 1350;
  const inhalt = [
    `${icon(260)}<div class="disp wort">${esc(M.wortmarke)}</div>`,
    `<div class="disp spruchGross">${M.spruchZeilen[LANG].map(esc).join('<br>')}</div>`,
    `${chips(6, 'senkrecht')}<div class="zusatz">${esc(M.zusatz[LANG])}</div>`,
  ][n - 1];

  return `${kopf(B, H)}
<body>
<div class="z augenbraue">${esc(M.leiste[LANG][n - 1])}</div>
<div class="linie"></div>
<div class="z inhalt">${inhalt}</div>
<style>
.augenbraue{position:absolute;left:80px;top:150px;font-size:34px;font-weight:800;
  letter-spacing:.2em;color:${M.mint}}
/* Die durchlaufende Linie traegt den Markenverlauf — sie ist der Faden, der
   die drei Kacheln im Raster zu einer Leiste macht. */
.linie{position:absolute;left:0;right:0;top:230px;height:6px;background:${VERLAUF};z-index:2}
.inhalt{position:absolute;left:0;right:0;top:236px;bottom:0;padding:0 80px 90px;
  display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:38px}
.wort{font-size:104px;line-height:.98}
.spruchGross{font-size:88px;line-height:1.08;
  background:${VERLAUF};-webkit-background-clip:text;background-clip:text;color:transparent}
.drei.senkrecht{flex-direction:column;gap:16px;align-items:flex-start}
.drei.senkrecht span{font-size:30px;padding:12px 26px}
.zusatz{font-size:26px;color:${M.gedaempft};line-height:1.4}
</style>`;
}

// --- TikTok-Cover 1080x1920 -------------------------------------------------
// ⚠ TikTok legt seine eigene Oberflaeche darueber: unten Name, Caption und Ton,
// rechts die Knopfleiste. Der Inhalt sitzt deshalb im oberen Drittel.
function tiktokCover() {
  const B = 1080, H = 1920;
  return `${kopf(B, H)}
<body>
<div class="z inhalt">
  ${icon(200)}
  <div class="disp wort">${esc(M.wortmarke)}</div>
  <div class="disp spruch">${M.spruchZeilen[LANG].map(esc).join('<br>')}</div>
  ${chips(4, 'senkrecht')}
  <div class="zusatz">${esc(M.zusatz[LANG])}</div>
</div>
<style>
.inhalt{position:absolute;left:0;top:230px;width:900px;padding:0 76px;
  display:flex;flex-direction:column;align-items:flex-start;gap:30px}
.wort{font-size:112px;line-height:.98}
.spruch{font-size:58px;line-height:1.1;
  background:${VERLAUF};-webkit-background-clip:text;background-clip:text;color:transparent}
.drei.senkrecht{flex-direction:column;gap:14px;margin-top:6px}
.drei.senkrecht span{font-size:29px;padding:12px 24px}
.zusatz{font-size:26px;color:${M.gedaempft};line-height:1.45;margin-top:4px}
</style>
${RASTER ? `
<div class="rahmen" style="left:0;top:1344px;width:${B}px;height:576px"><b>TikTok-Oberflaeche</b></div>
<div class="rahmen" style="right:0;top:0;width:170px;height:${H}px"><b>Knöpfe</b></div>` : ''}`;
}

// --- Lauf -------------------------------------------------------------------
const AUFTRAEGE = [
  { name: 'avatar-1080', html: avatar, b: 1080, h: 1080, sprachneutral: true },
  { name: 'fb-titelbild', html: fbTitel, b: 1640, h: 856 },
  ...[1, 2, 3].map((n) => ({ name: `ig-grid-${n}`, html: () => igKachel(n), b: 1080, h: 1350 })),
  { name: 'tiktok-cover', html: tiktokCover, b: 1080, h: 1920 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);

for (const a of AUFTRAEGE) {
  const datei = `${MARKE}-${a.name}${a.sprachneutral ? '' : `-${LANG}`}${RASTER ? '-raster' : ''}.png`;
  const seite = await browser.newPage({ viewport: { width: a.b, height: a.h }, deviceScaleFactor: 1 });
  await seite.setContent(a.html(), { waitUntil: 'load' });
  await seite.evaluate(() => document.fonts.ready);
  // PNG, nicht JPEG: Flaechen mit harten Kanten. JPEG setzt genau dort
  // Artefakte an die Buchstaben.
  await seite.screenshot({ path: join(OUT, datei), type: 'png' });
  await seite.close();
  console.log(`  ✓ ${datei.padEnd(34)} ${a.b}×${a.h}`);
}
await browser.close();

if (!RASTER) {
  const z = (k) => `${zeichen(M.bios[LANG][k])} von ${GRENZEN[k]} Zeichen`;
  writeFileSync(join(OUT, `bios-${LANG}.md`), `# ${M.name} — Profiltexte (${LANG.toUpperCase()})

Erzeugt von \`tools/social/kanal/assets.mjs\`. Zeichenzahlen maschinell geprueft;
ein zu langer Text laesst den Lauf abbrechen, statt auf der Plattform
abgeschnitten zu werden.

## TikTok

Bio (${z('tiktok')})

    ${M.bios[LANG].tiktok}

Profilbild: \`${MARKE}-avatar-1080.png\`
Titelbild: **gibt es bei TikTok nicht.** Stattdessen
\`${MARKE}-tiktok-cover-${LANG}.png\` als Cover fuer den angepinnten Trailer.

## Instagram

Bio (${z('instagram')})

${M.bios[LANG].instagram.split('\n').map((l) => `    ${l}`).join('\n')}

Profilbild: \`${MARKE}-avatar-1080.png\`
Titelbild: **gibt es bei Instagram nicht.** Stattdessen die drei Kacheln
\`${MARKE}-ig-grid-1..3-${LANG}.png\`.

⚠ **Reihenfolge beim Hochladen: 3, dann 2, dann 1.** Instagram sortiert das
Raster neuestes-zuerst von links.

## Facebook

Kurz-Bio (${z('facebook')})

    ${M.bios[LANG].facebook}

Profilbild: \`${MARKE}-avatar-1080.png\`
Titelbild: \`${MARKE}-fb-titelbild-${LANG}.png\` (1640×856)

⚠ Facebook beschneidet am Rechner anders als am Handy. Alles Wesentliche liegt
in einer mittigen Zone von 1440×560; mit \`--raster\` nachpruefbar.

## Was bewusst NICHT drinsteht

- **Keine Download-Badges.** ${M._stores_offen ?? ''}
- **Kein Preis**, solange „kostenlos" nicht gegen beide Stores geprueft ist.
- **Keine Funktionsliste** im Facebook-Infotext: Ich kenne die App nicht aus
  eigener Anschauung. Was hier steht, beschreibt die Idee — die Funktionen
  gehoeren von jemandem ergaenzt, der sie kennt.
`);
  console.log(`  ✓ bios-${LANG}.md`);
}

console.log(`\n${AUFTRAEGE.length} Datei(en) in ${OUT}`);
console.log(bioBericht.map((b) => `  ${b.ok ? '✓' : '✗'} Bio ${b.sprache}/${b.kanal}: ${b.n}/${b.grenze}`).join('\n'));
