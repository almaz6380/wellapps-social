#!/usr/bin/env node
// App-Schau als REEL — 1080×1920, mit Musikbett. FullRep, Anigosha, Swaply.
//
//   node tools/social/reels-fremd/app-schau-reel.mjs --marke anigosha \
//        --lang de --seed 48282 --out <ordner> [--name <datei>]
//   … --standbilder   nur je ein JPG pro Phase, in Sekunden statt Minuten
//
// --- Warum EIN Generator fuer drei Marken -----------------------------------
//
// Der Grundsatz in motoren.mjs stimmt: „Was ein Reel schoen macht, weiss der
// Motor des Repos." Hier ist es trotzdem einer, aus zwei Gruenden:
//
// 1. `swaply` ist fuer den Tageslauf nur LESBAR (REPOS_TOKEN, Contents:Read).
//    Ein Generator dort liesse sich von hier nicht einchecken — derselbe
//    Grund, aus dem make-reel.mjs nebenan liegt.
// 2. Die App-Schau ist in allen drei Repos DASSELBE Layout: Schlagzeile, ein
//    Satz, drei Bildschirme, drei Stichworte. Drei Kopien derselben Animation
//    waeren drei Stellen, an denen eine Korrektur vergessen wird.
//
// --- Und warum er die Texte NICHT kennt -------------------------------------
//
// ⚠ Er schreibt nichts ab. Jeder Bildgenerator gibt seine Aufzugdaten mit
// `--schau-json` heraus — Schlagzeile, Satz, Stichworte, Bildschirmpfade,
// Markenfarben, Schriftdateien. Dieses Skript ruft ihn als Kindprozess auf.
//
// Damit ist der BILDGENERATOR die einzige Quelle, und Bild und Reel koennen
// nicht auseinanderlaufen. Wuerde hier abgeschrieben, aenderte eine neue
// Schlagzeile nur das Bild — und es fiele erst auf, wenn beide nebeneinander
// im Feed stehen.
//
// --- Der Ton ----------------------------------------------------------------
//
// `bett.aac` aus anigosha/tools/reels/assets/sfx/ (fal.ai, einmalig erzeugt).
// Es ist BEWUSST markenneutral — der Prompt lautet „minimal chill electronic
// background loop, soft pulsing synth, calm and unobtrusive". Kein Anisong,
// also fuer alle drei Marken brauchbar, und kein weiterer fal.ai-Lauf noetig.
//
// Es laeuft leise (~-20 dB), damit in der TikTok-App noch ein Trending-Sound
// darueberpasst — derselbe Grund wie bei den Quiz-Reels.
//
// ⚠ WELLbooked! ist hier NICHT dabei und darf es nicht sein: Dessen Videos
// gehen stumm raus (vorflug.mjs verwirft jedes mit Ton, Befund
// `tonspur-leer`). Fuer Swaply war die Stille dagegen nur eine Entscheidung,
// und Josef hat sie am 20.09.2026 umgedreht.
//
// --- Die eine Regel, die man nicht sieht ------------------------------------
//
// ⚠ Kein `setTimeout`, keine CSS-Animation. Alles haengt an
// `window.setFrame(n)` und muss reine Funktion des Frame-Index sein — sonst
// verrutschen Frames und nichts ist reproduzierbar. Gleiche Regel wie in
// allen anderen Reel-Generatoren dieses Verbunds.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import { videoSenke, tonspurBauen } from '../../reels/encode.mjs';
import { frames, seiteOeffnen } from '../../reels/render.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..');

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };

const MARKE = arg('marke', null);
const LANG = arg('lang', 'de');
const SEED = Number(arg('seed', 1));
const NAME = arg('name', null);
const OUT = arg('out', join(WURZEL, 'out', 'reels'));
const NUR_STANDBILDER = process.argv.includes('--standbilder');

const B = 1080, H = 1920, FPS = 30;

// Wo der Bildgenerator je Marke liegt. Dieselben Pfade wie in motoren.mjs —
// sie stehen dort in der Weiche je App und hier in einer Tabelle, weil dieses
// Skript keinen App-Eintrag durchgereicht bekommt.
const MOTOREN = {
  fullrep: { repo: '/home/user/mypeak', skript: 'scripts/post-bild.mjs' },
  anigosha: { repo: '/home/user/anigosha', skript: 'tools/post-bild.mjs' },
  swaply: { repo: '/home/user/swaply', skript: 'scripts/post-bild.mjs' },
};

if (!MARKE || !MOTOREN[MARKE]) {
  console.error(`✗ --marke fehlt oder ist unbekannt: ${MARKE}`);
  console.error(`  Bekannt: ${Object.keys(MOTOREN).join(', ')}`);
  process.exit(1);
}

// Das Musikbett liegt in anigosha — dort steht der ganze Klang-Apparat.
const BETT = join(WURZEL, 'anigosha', 'tools', 'reels', 'assets', 'sfx', 'bett.aac');
const BETT_ALT = '/home/user/anigosha/tools/reels/assets/sfx/bett.aac';
const bettDatei = existsSync(BETT) ? BETT : (existsSync(BETT_ALT) ? BETT_ALT : null);

// --- Daten vom Bildgenerator holen ------------------------------------------
const { repo, skript } = MOTOREN[MARKE];
let daten;
try {
  const roh = execFileSync('node', [skript, '--format', 'app-schau',
    '--lang', LANG, '--seed', String(SEED), '--schau-json'],
  { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  daten = JSON.parse(roh);
} catch (e) {
  console.error(`✗ ${MARKE}: der Bildgenerator gab keine Aufzugdaten heraus.`);
  console.error(`  ${skript} --format app-schau --lang ${LANG} --seed ${SEED} --schau-json`);
  console.error(`  ${String(e.stderr ?? e.message).split('\n').slice(0, 3).join('\n  ')}`);
  process.exit(1);
}

// ⚠ Kein stiller Rueckfall auf ein halbes Reel. Zwei von drei Bildschirmen
// ergeben eine Animation, die FERTIG aussieht und in der Mitte ins Leere
// faehrt — das faellt erst in der Freigabe auf, wenn ueberhaupt.
if (!daten.schirme?.length || daten.schirme.length < 3) {
  console.error(`✗ ${MARKE}: ${daten.schirme?.length ?? 0} von 3 Bildschirmen.`);
  process.exit(1);
}

const b64 = (p) => readFileSync(p).toString('base64');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// --- Das Storyboard ---------------------------------------------------------
//
// ⚠ Jede Phase in FRAMES, nicht in Sekunden. Sekunden muessten beim Rendern
// zurueckgerechnet werden, und ein Rundungsfehler verschoebe alles Folgende.
const PHASEN = [
  { id: 'zeile1', frames: 30 },
  { id: 'zeile2', frames: 28 },
  { id: 'text', frames: 34 },
  { id: 'schirm1', frames: 40 },
  { id: 'schirm2', frames: 34 },
  { id: 'schirm3', frames: 34 },
  { id: 'punkte', frames: 40 },
  { id: 'halten', frames: 120 },
];
const GESAMT = PHASEN.reduce((n, p) => n + p.frames, 0);
const START = {};
{
  let n = 0;
  for (const p of PHASEN) { START[p.id] = n; n += p.frames; }
}

function baueHtml() {
  const o = daten.optik;
  const sch = daten.schriften;
  const logo = daten.logo && existsSync(daten.logo)
    ? `data:image/svg+xml;base64,${b64(daten.logo)}` : null;
  const hg = daten.hintergrund && existsSync(daten.hintergrund)
    ? `data:image/jpeg;base64,${b64(daten.hintergrund)}` : null;

  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Schlag';src:url(data:font/woff2;base64,${b64(sch.schlagzeile)}) format('woff2');font-weight:100 900}
@font-face{font-family:'Lauf';src:url(data:font/woff2;base64,${b64(sch.text)}) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden}
body{background:${o.grund};font-family:'Lauf',system-ui,sans-serif;color:${o.tinte};
  position:relative}
.grund{position:absolute;inset:0;background:${o.verlauf}}
${hg ? `.hgBild{position:absolute;inset:0;background-image:url(${hg});
  background-size:cover;background-position:center 34%}
.hgSchleier{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(15,10,30,.92) 0%,rgba(15,10,30,.86) 24%,rgba(15,10,30,.55) 46%,
  rgba(15,10,30,.62) 70%,rgba(15,10,30,.94) 88%,rgba(15,10,30,.97) 100%)}` : ''}
.buehne{position:absolute;inset:0;display:flex;flex-direction:column;
  padding:96px 72px 104px;z-index:2}
.kopf{display:flex;align-items:center;gap:20px;flex:0 0 auto}
.kopf img{width:76px;height:76px;border-radius:18px}
.kopf span{font-family:'Lauf';font-weight:700;letter-spacing:.3em;font-size:30px;
  color:${o.akzent};text-transform:uppercase}
h1{font-family:'Schlag',sans-serif;font-size:104px;line-height:1.0;font-weight:700;
  margin-top:34px;flex:0 0 auto}
/* ⚠ display:block ist hier PFLICHT, nicht Geschmack. Mit einem
   Markenverlauf greift background-clip:text — und ein INLINE-Element hat
   keine eigene Hintergrundflaeche, wenn ein Block darin steht. Der Verlauf
   bekommt dann null Hoehe, und der Text wird transparent auf nichts gemalt:
   Die zweite Schlagzeilenzeile fehlte in allen acht Standbildern, ohne dass
   irgendetwas fehlschlug. Am Bild gefunden, nicht im CSS. */
h1 i{display:block;font-style:normal;${o.akzentVerlauf
  ? `background:${o.akzentVerlauf};-webkit-background-clip:text;background-clip:text;color:transparent`
  : `color:${o.akzent}`}}
h1 span{display:block}
p.text{font-size:40px;line-height:1.34;color:${o.tinteLeise};margin-top:26px;
  max-width:95%;flex:0 0 auto}
.schirme{flex:1 1 0;min-height:0;position:relative;margin-top:34px;
  -webkit-mask-image:linear-gradient(180deg,#000 82%,transparent 99%);
  mask-image:linear-gradient(180deg,#000 82%,transparent 99%)}
.schirm{position:absolute;width:404px;border-radius:34px;
  border:1px solid rgba(255,255,255,.16);
  box-shadow:0 44px 90px rgba(0,0,0,.55),0 6px 18px rgba(0,0,0,.42);
  object-fit:cover;object-position:top;height:880px}
.schirm.s0{left:0;top:62px}
.schirm.s1{left:50%;margin-left:-202px;top:0;z-index:3}
.schirm.s2{right:0;top:62px}
.punkte{flex:0 0 auto;display:flex;gap:16px;margin-top:30px}
.punkte span{flex:1 1 0;text-align:center;background:${o.flaeche};
  border:1px solid ${o.flaecheRand};border-radius:22px;padding:22px 10px;
  font-size:34px;font-weight:700;color:${o.akzent}}
.fuss{flex:0 0 auto;margin-top:26px;font-size:30px;color:${o.tinteLeise};
  display:flex;justify-content:space-between;align-items:center}
${hg ? `.kiMarke{position:absolute;right:40px;bottom:36px;z-index:5;
  background:rgba(10,6,22,.62);border:1px solid rgba(237,233,254,.3);
  border-radius:11px;padding:8px 14px;font-size:24px;font-weight:700;
  letter-spacing:.1em;color:rgba(237,233,254,.85)}` : ''}
</style>
<div class="grund"></div>
${hg ? '<div class="hgBild"></div><div class="hgSchleier"></div>' : ''}
<div class="buehne">
  <div class="kopf" id="kopf">${logo ? `<img src="${logo}">` : ''}<span>${esc(daten.marke)}</span></div>
  <h1><span id="z1">${esc(daten.kurz[0])}</span><i id="z2">${esc(daten.kurz[1] ?? '')}</i></h1>
  <p class="text" id="txt">${esc(daten.text)}</p>
  <div class="schirme">
    ${daten.schirme.map((p, i) => `<img class="schirm s${i}" id="s${i}"
      src="data:image/png;base64,${b64(p)}">`).join('')}
  </div>
  <div class="punkte" id="pk">${daten.punkte.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
  <div class="fuss" id="fuss"><span>${esc(daten.fuss)}</span></div>
</div>
${hg ? '<div class="kiMarke" id="ki"><b>AI</b></div>' : ''}
<script>
const START = ${JSON.stringify(START)};
const GESAMT = ${GESAMT};

// Weiches Ein: 0 → 1 ueber dauer Frames ab ab. Reine Funktion von n.
function ein(n, ab, dauer) {
  const t = (n - ab) / dauer;
  return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
}
function setze(el, p, hoch) {
  el.style.opacity = p;
  el.style.transform = 'translateY(' + ((1 - p) * hoch) + 'px)';
}

window.setFrame = function (n) {
  setze(document.getElementById('kopf'), ein(n, 0, 18), 16);
  setze(document.getElementById('z1'), ein(n, START.zeile1, 22), 46);
  setze(document.getElementById('z2'), ein(n, START.zeile2, 22), 46);
  setze(document.getElementById('txt'), ein(n, START.text, 26), 34);
  // ⚠ Reihenfolge: MITTE zuerst. Sie traegt das Bild; kaemen die aeusseren
  // vorher, faehrt das Hauptmotiv in eine schon volle Flaeche.
  const s = [
    [document.getElementById('s1'), START.schirm1],
    [document.getElementById('s0'), START.schirm2],
    [document.getElementById('s2'), START.schirm3],
  ];
  for (const [el, ab] of s) setze(el, ein(n, ab, 30), 120);
  setze(document.getElementById('pk'), ein(n, START.punkte, 26), 30);
  setze(document.getElementById('fuss'), ein(n, START.punkte + 14, 24), 20);
  const ki = document.getElementById('ki');
  if (ki) ki.style.opacity = ein(n, START.schirm1, 24);
};
window.setFrame(0);
document.fonts.ready.then(() => { window.__bereit = true; });
</script>`;
}

// --- Lauf -------------------------------------------------------------------
const zielOrdner = isAbsolute(OUT) ? OUT : join(WURZEL, OUT);
mkdirSync(zielOrdner, { recursive: true });
const basis = NAME ?? `${MARKE}-app-schau-${LANG}-s${SEED}`;

const storyboard = { gesamtFrames: GESAMT, phasen: PHASEN };
const opt = { baueHtml: () => baueHtml(), breite: B, hoehe: H, dsf: 1, quality: 95 };

if (NUR_STANDBILDER) {
  // ⚠ EIGENER Standbild-Weg, nicht kontaktbogen() aus render.mjs. Jenes ist
  // auf das QUIZ-Storyboard zugeschnitten (`storyboard.bloecke` mit Typen
  // 'frage'/'hook'/'outro') und bricht hier mit „bloecke is not iterable" ab.
  // Ein Reel mit acht Phasen braucht acht Aufnahmen, keine Frage-Logik.
  //
  // Er beantwortet die einzige wirklich offene Frage — sieht es gut aus? — in
  // Sekunden statt in den zwei Minuten, die 360 Frames kosten.
  const { page, schliessen } = await seiteOeffnen(storyboard, opt);
  try {
    for (const [i, ph] of PHASEN.entries()) {
      // Das ENDE der Phase, nicht ihren Anfang: Am Anfang ist die Bewegung
      // noch bei null, und alle acht Bilder saehen gleich aus.
      const n = Math.min(GESAMT - 1, START[ph.id] + ph.frames - 2);
      await page.evaluate((k) => window.setFrame(k), n);
      const f = join(zielOrdner, `${basis}-${i}-${ph.id}.jpg`);
      writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 92 }));
      console.log(`✓ ${ph.id.padEnd(8)} Frame ${n}  →  ${f}`);
    }
  } finally {
    await schliessen();
  }
  process.exit(0);
}

// ⚠ Die Tonspur entsteht VOR dem Video: videoSenke bindet die fertige Datei
// als zweite Eingabe ein. Umgekehrt muesste das Video ein zweites Mal durch
// ffmpeg, und 360 Frames noch einmal zu kodieren kostet Qualitaet.
let ton = null;
if (bettDatei) {
  ton = join(zielOrdner, `${basis}-ton.m4a`);
  await tonspurBauen({
    // 0,1 entspricht rund -20 dB: hoerbar, aber nie im Weg, damit in der App
    // noch ein Trending-Sound darueberpasst.
    ereignisse: [{ datei: bettDatei, frameStart: 0, lautstaerke: 0.1, ausblenden: 1.2 }],
    fps: FPS, dauerFrames: GESAMT, ziel: ton,
  });
} else {
  console.error('⚠ bett.aac nicht gefunden — das Reel geht STUMM raus.');
  console.error(`  Erwartet: ${BETT_ALT}`);
}

const ziel = join(zielOrdner, `${basis}.mp4`);
const senke = videoSenke({ fps: FPS, ziel, tonDatei: ton });
await frames(storyboard, senke.stdin, {
  ...opt,
  onFortschritt: (n, g) => process.stdout.write(`\r  ${n}/${g} Frames`),
});
senke.stdin.end();
await senke.fertig;

console.log(`\n✓ ${ziel}`);
console.log(`  ${B}×${H} · ${(GESAMT / FPS).toFixed(1)} s · ${FPS} fps · `
  + `${ton ? 'mit Musikbett' : 'STUMM'} · ${MARKE} · ${LANG} · Seed ${SEED}`);
