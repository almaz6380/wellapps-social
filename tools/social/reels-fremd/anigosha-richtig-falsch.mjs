// Anigosha: „Richtig oder falsch?" — Reel 1080×1920, rein typografisch.
//
//   CHROMIUM_PFAD=… node tools/social/reels-fremd/anigosha-richtig-falsch.mjs \
//     --app ../anigosha --seed 3 --out /tmp/rof.mp4
//
// --- Warum (24.09.2026) ------------------------------------------------------
//
// Josef: „neuen post für alle plattformen mit neuen ideen/styles" — für die
// anderen Apps. Alle bisherigen Anigosha-Posts zeigen eine Frage mit vier
// Antworten. Die drei FALSCHEN Antworten jeder Frage nutzt kein einziger Post.
// Hier wird aus Frage + einer Antwort eine Behauptung: stimmt sie oder nicht?
// Das ist schneller zu erfassen als vier Optionen und lädt zum Kommentieren
// ein („ich hatte 2/3").
//
// Neuer Stil: Swipe-Duell — großes ✗ FALSCH links, ✓ RICHTIG rechts, ein
// Countdown-Balken, dann die Auflösung mit „Wusstest du?".
//
// ⚠ NUR TYPOGRAFIE (apps.json → regeln.nur_typografie): keine Bilder von
// Anime-Figuren, auch keine KI-erzeugten. Serientitel als Text sind erlaubt.
// EINZIGE Ausnahme: der eigene Junge aus dem Anigosha-Werbespot (--figur,
// Josef 25.09.2026: „immer mit dem Jungen") — mit AI-Plaettchen, siehe
// vorflug.mjs bei `nur_typografie`.
//
// Jedes Bild ist eine reine Funktion des Frame-Index (window.setFrame(n)),
// dieselbe Regel wie in allen Reel-Generatoren: kein setTimeout, keine
// CSS-Animation.

import { readFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { videoSenke, tonspurBauen } from '../../reels/encode.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..');
const SFX = join(WURZEL, 'tools', 'reels', 'assets', 'sfx');

export const B = 1080;
export const H = 1920;
export const FPS = 30;

// Zeitleiste in Sekunden.
const HOOK = 2.2;
const RUNDE = 6.6;          // je Behauptung
const CD_START = 1.2;       // Countdown beginnt (relativ zur Runde)
const CD_DAUER = 2.6;       // Countdown-Länge
const OUTRO = 3.2;
export const RUNDEN = 3;
export const DAUER = HOOK + RUNDEN * RUNDE + OUTRO;

/** Kleiner, reproduzierbarer Zufall (mulberry32). */
function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Drei Behauptungen aus drei verschiedenen Serien, Schwierigkeit 1 → 2 → 3.
 * Mindestens eine stimmt und mindestens eine nicht — sonst wäre es raten.
 * Zu lange Fragen oder Antworten fliegen raus, sie passen nicht aufs Bild.
 */
export function waehleRunden(fragen, seed, sprache = 'de') {
  const w = zufall(seed * 2654435761);
  const passt = (f) => f[sprache].prompt.length <= 95
    && f[sprache].options.every((o) => o.length <= 38)
    && f[sprache].explanation.length <= 150;
  const serien = new Set();
  const runden = [];
  for (const stufe of [1, 2, 3]) {
    const pool = fragen.filter((f) => f.difficulty === stufe && passt(f) && !serien.has(f.slug));
    const f = pool[Math.floor(w() * pool.length)];
    serien.add(f.slug);
    runden.push({ f, stimmt: w() < 0.5 });
  }
  if (runden.every((r) => r.stimmt)) runden[1 + Math.floor(w() * 2)].stimmt = false;
  if (runden.every((r) => !r.stimmt)) runden[Math.floor(w() * 3)].stimmt = true;
  return runden.map(({ f, stimmt }) => {
    const t = f[sprache];
    const falsche = t.options.filter((_, i) => i !== f.correctIndex);
    const behauptet = stimmt ? t.options[f.correctIndex] : falsche[Math.floor(w() * falsche.length)];
    return {
      serie: f.kategorie[sprache], stufe: f.difficulty, frage: t.prompt, behauptet, stimmt,
      richtig: t.options[f.correctIndex], erklaerung: t.explanation,
    };
  });
}

function seiteHtml({ runden, storeSatz, logo, schrift, figur = null }) {
  const daten = JSON.stringify({ runden, storeSatz, fps: FPS, HOOK, RUNDE, CD_START, CD_DAUER, OUTRO });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${schrift}) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden;font-family:Outfit,sans-serif;color:#ede9fe;
  background:linear-gradient(115deg,#0f0a1e,#17102c 38%,#3b1d6b 72%,#7c3aed)}
.ebene{position:absolute;inset:0}
.glow{position:absolute;width:900px;height:900px;border-radius:50%;filter:blur(120px);opacity:.35}
.kopf{position:absolute;top:120px;left:0;right:0;display:flex;justify-content:center;gap:18px;align-items:center}
.logo{width:64px;height:62px}
.marke{font-size:40px;font-weight:800;letter-spacing:.06em}
.hook{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:34px}
.hook .t{font-size:124px;font-weight:900;line-height:.98;letter-spacing:-.01em}
.hook .t .r{color:#34d399}.hook .t .f{color:#fb7185}
.hook .u{font-size:44px;font-weight:600;opacity:.85}
.pille{display:inline-block;padding:14px 30px;border-radius:999px;background:rgba(255,255,255,.1);
  border:2px solid rgba(255,255,255,.18);font-size:36px;font-weight:700}
.runde{position:absolute;left:100px;right:100px;top:270px}
.zeile{display:flex;justify-content:space-between;align-items:center}
.nr{font-size:34px;font-weight:700;opacity:.7;letter-spacing:.08em}
.frage{margin-top:60px;font-size:58px;font-weight:700;line-height:1.18}
.behauptung{margin-top:54px;padding:40px 44px;border-radius:36px;background:rgba(255,255,255,.08);
  border:3px solid rgba(255,255,255,.2);font-size:72px;font-weight:900;line-height:1.08;text-align:center}
.behauptung small{display:block;font-size:30px;font-weight:600;opacity:.65;letter-spacing:.12em;margin-bottom:14px}
/* ⚠ Sichere Zone: Unten (ab ~1600 px) liegen bei TikTok/Instagram Beschreibung
   und Knöpfe der App, rechts die Symbolleiste — dort nichts Wichtiges. */
.knoepfe{position:absolute;left:110px;right:110px;top:1120px;display:flex;gap:36px}
.knopf{flex:1;height:180px;border-radius:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-size:54px;font-weight:900;letter-spacing:.04em;border:4px solid}
.knopf .z{font-size:84px;line-height:1}
.k-f{color:#fecdd3;border-color:#fb7185;background:rgba(251,113,133,.14)}
.k-r{color:#bbf7d0;border-color:#34d399;background:rgba(52,211,153,.14)}
.balken{position:absolute;left:110px;right:110px;top:1340px;height:18px;border-radius:9px;background:rgba(255,255,255,.12);overflow:hidden}
.balken i{position:absolute;left:0;top:0;bottom:0;border-radius:9px;background:linear-gradient(90deg,#f472b6,#a78bfa)}
.stempel{position:absolute;left:0;right:0;top:895px;text-align:center;font-size:132px;font-weight:900;letter-spacing:.02em}
.wissen{position:absolute;left:110px;right:110px;top:1390px;font-size:36px;line-height:1.3;font-weight:500;opacity:.92}
.wissen b{color:#f9a8d4;font-weight:800}
.outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:40px;padding:0 90px}
.outro .t{font-size:96px;font-weight:900;line-height:1.02}
.outro .u{font-size:44px;font-weight:600;opacity:.88;line-height:1.3}
.outro .s{font-size:38px;font-weight:700;padding:22px 40px;border-radius:999px;background:#ede9fe;color:#2e1065}
/* --- Der Junge (Josef, 25.09.2026: „anigosha posts mit dem jungen charakter") ---
   Dieselbe freigestellte Figur wie auf den Bildkarten (anigosha/store-assets/
   social/figuren/junge.png), eigene Figur aus dem Werbespot, keine bestehende
   Anime-Figur. Nur im Einstieg und im Abspann: In den Runden stuende er im
   Text oder unter TikToks Beschreibung. Unten angeschnitten, damit er gross
   genug ist; Hook und Abspann ruecken dafuer nach oben. */
.figur{position:absolute;left:50%;bottom:-200px;width:420px;height:1060px;margin-left:-210px;z-index:3;
  background-size:contain;background-repeat:no-repeat;background-position:bottom center;opacity:0}
body.mitFigur .hook{padding-bottom:760px}
body.mitFigur .outro{justify-content:flex-start;padding-top:300px}
/* AI-Plaettchen: Er ist ein KI-erzeugter Mensch. Sichtbar, solange er es ist. */
.ki{position:absolute;right:48px;bottom:60px;width:56px;height:56px;border-radius:50%;z-index:4;opacity:0;
  display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;letter-spacing:.04em;
  background:rgba(10,6,22,.62);border:2px solid rgba(237,233,254,.45);color:#ede9fe}
</style></head><body class="${figur ? 'mitFigur' : ''}">
<div class="glow" id="g1" style="left:-300px;top:-200px;background:#7c3aed"></div>
<div class="glow" id="g2" style="right:-350px;bottom:-250px;background:#f472b6"></div>
<div class="kopf" id="kopf"><img class="logo" src="${logo}"><span class="marke">ANIGOSHA</span></div>
<div class="hook ebene" id="hook"><div class="t" id="hookT">RICHTIG<br>ODER<br><span class="f">FALSCH?</span></div>
  <div class="u">3 Behauptungen. Wie viele schaffst du?</div></div>
<div class="ebene" id="spiel">
  <div class="runde"><div class="zeile"><span class="pille" id="serie"></span><span class="nr" id="nr"></span></div>
    <div class="frage" id="frage"></div>
    <div class="behauptung" id="beh"><small>DIE ANTWORT IST …</small><span id="behT"></span></div></div>
  <div class="stempel" id="stempel"></div>
  <div class="knoepfe"><div class="knopf k-f" id="kf"><span class="z">✗</span>FALSCH</div><div class="knopf k-r" id="kr"><span class="z">✓</span>RICHTIG</div></div>
  <div class="balken" id="balken"><i id="bi"></i></div>
  <div class="wissen" id="wissen"></div>
</div>
<div class="outro ebene" id="outro"><div class="t">Wie viele hattest du?</div>
  <div class="u">Schreib's in die Kommentare 👇<br>804 Fragen · 12 Serien · Duelle</div>
  <div class="s" id="store"></div></div>
${figur ? `<div class="figur" id="figur" style="background-image:url(data:image/png;base64,${figur})"></div><div class="ki" id="ki">AI</div>` : ''}
<script>
const D = ${daten};
const $ = (id) => document.getElementById(id);
const k = (x) => Math.max(0, Math.min(1, x));
const aus = (x) => 1 - Math.pow(1 - k(x), 3);
const feder = (x) => { x = k(x); return 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2); };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
$('store').textContent = D.storeSatz;
let aktRunde = -1;
window.setFrame = (n) => {
  const t = n / D.fps;
  const ende = D.HOOK + D.runden.length * D.RUNDE;
  $('g1').style.transform = 'translate(' + (Math.sin(t * .5) * 80) + 'px,' + (Math.cos(t * .4) * 60) + 'px)';
  $('g2').style.transform = 'translate(' + (Math.cos(t * .45) * 90) + 'px,' + (Math.sin(t * .35) * 70) + 'px)';
  // Hook
  const hp = aus(t / .5), hraus = aus((t - D.HOOK + .35) / .35);
  $('hook').style.opacity = String(hp * (1 - hraus));
  $('hookT').style.transform = 'scale(' + (0.7 + 0.3 * feder(t / .6)) + ')';
  // Outro
  const op = aus((t - ende) / .5);
  $('outro').style.opacity = String(op);
  $('outro').style.transform = 'translateY(' + ((1 - op) * 40) + 'px)';
  // Der Junge: springt im Einstieg von unten herein und im Abspann noch einmal.
  if ($('figur')) {
    const rein = t < D.HOOK ? feder((t - .15) / .6) : feder((t - ende - .1) / .6);
    const da = t < D.HOOK ? aus((t - .15) / .3) * (1 - hraus) : aus((t - ende - .1) / .3);
    $('figur').style.opacity = String(da);
    $('figur').style.transform = 'translateY(' + ((1 - rein) * 360 + Math.sin(t * 2.2) * 8) + 'px)';
    $('ki').style.opacity = String(da);
  }
  // Runde
  const r = Math.floor((t - D.HOOK) / D.RUNDE);
  const im = t >= D.HOOK && r < D.runden.length;
  $('spiel').style.opacity = im ? '1' : '0';
  if (!im) return;
  const R = D.runden[r], rt = t - D.HOOK - r * D.RUNDE;
  if (r !== aktRunde) {
    aktRunde = r;
    $('serie').textContent = R.serie;
    $('nr').textContent = (r + 1) + ' / ' + D.runden.length;
    $('frage').textContent = R.frage;
    $('behT').textContent = R.behauptet;
    $('stempel').textContent = R.stimmt ? '✓ RICHTIG' : '✗ FALSCH';
    $('stempel').style.color = R.stimmt ? '#34d399' : '#fb7185';
    $('wissen').innerHTML = (R.stimmt ? '' : '<b>Richtig wäre: ' + esc(R.richtig) + '</b><br>')
      + '<b>Wusstest du?</b> ' + esc(R.erklaerung);
  }
  const rein = aus(rt / .45), raus = aus((rt - D.RUNDE + .3) / .3);
  const runde = document.querySelector('.runde');
  runde.style.opacity = String(rein * (1 - raus));
  runde.style.transform = 'translateX(' + ((1 - rein) * 120 - raus * 120) + 'px)';
  $('beh').style.transform = 'scale(' + (0.85 + 0.15 * feder((rt - .35) / .5)) + ')';
  $('beh').style.opacity = String(aus((rt - .35) / .3));
  // Countdown
  const cd = k((rt - D.CD_START) / D.CD_DAUER);
  $('bi').style.width = ((1 - cd) * 100) + '%';
  $('balken').style.opacity = String(aus((rt - D.CD_START + .2) / .2) * (1 - aus((rt - D.CD_START - D.CD_DAUER) / .2)));
  // Auflösung
  const aufl = D.CD_START + D.CD_DAUER;
  const ap = aus((rt - aufl) / .25);
  const gut = R.stimmt ? $('kr') : $('kf'), schlecht = R.stimmt ? $('kf') : $('kr');
  const puls = rt < aufl ? 1 + 0.03 * Math.sin(rt * 9) : 1;
  gut.style.transform = 'scale(' + (puls + 0.08 * ap) + ')';
  schlecht.style.transform = 'scale(' + (puls - 0.04 * ap) + ')';
  schlecht.style.opacity = String(1 - 0.7 * ap);
  gut.style.boxShadow = '0 0 ' + (80 * ap) + 'px ' + (R.stimmt ? 'rgba(52,211,153,.8)' : 'rgba(251,113,133,.8)');
  const sp = feder((rt - aufl) / .35);
  $('stempel').style.opacity = String(k(sp * 1.6) * (1 - raus));
  $('stempel').style.transform = 'scale(' + (1.8 - 0.8 * sp) + ') rotate(-6deg)';
  $('beh').style.filter = 'blur(' + (ap * 6) + 'px)';
  $('frage').style.opacity = String(1 - 0.55 * ap);
  $('wissen').style.opacity = String(aus((rt - aufl - .35) / .4) * (1 - raus));
};
document.fonts.ready.then(() => { window.__bereit = true; });
</script></body></html>`;
}

/** Klang-Ereignisse: Musikbett leise, Tick im Countdown, Treffer bei der Auflösung. */
function klaenge(runden) {
  const f = (s) => Math.round(s * FPS);
  const e = [
    { datei: join(SFX, 'bett.aac'), frameStart: 0, lautstaerke: 0.14 },
    { datei: join(SFX, 'hook-hit.aac'), frameStart: f(0.05), lautstaerke: 0.7 },
  ];
  runden.forEach((_, r) => {
    const s = HOOK + r * RUNDE;
    e.push({ datei: join(SFX, 'whoosh.aac'), frameStart: f(s), lautstaerke: 0.5 });
    for (let i = 0; i < 3; i++) e.push({ datei: join(SFX, 'tick.aac'), frameStart: f(s + CD_START + i * 0.85), lautstaerke: 0.55 });
    e.push({ datei: join(SFX, 'correct.aac'), frameStart: f(s + CD_START + CD_DAUER), lautstaerke: 0.75 });
  });
  e.push({ datei: join(SFX, 'outro.aac'), frameStart: f(HOOK + runden.length * RUNDE), lautstaerke: 0.7 });
  return e;
}

export async function richtigFalschReel({ appPfad, seed, datei, storeSatz = 'Gratis im App Store und bei Google Play', figur = null }) {
  // fragen.json = { erzeugt, anzahl, fragen: [...] } (parse-questions.mjs im Anigosha-Repo)
  const { fragen } = JSON.parse(readFileSync(join(appPfad, 'tools', 'reels', 'data', 'fragen.json'), 'utf8'));
  const runden = waehleRunden(fragen, seed);
  const schrift = readFileSync(join(WURZEL, 'tools', 'reels', 'assets', 'outfit.woff2')).toString('base64');
  const logo = `data:image/svg+xml;base64,${readFileSync(join(appPfad, 'public', 'favicon.svg')).toString('base64')}`;
  // Die Figur liegt im App-Repo, genau wie bei den Bildkarten (post-bild.mjs).
  let figurB64 = null;
  if (figur) {
    const pfad = join(appPfad, 'store-assets', 'social', 'figuren', figur);
    if (!existsSync(pfad)) throw new Error(`Figur nicht gefunden: ${pfad}`);
    figurB64 = readFileSync(pfad).toString('base64');
  }

  const tmp = join(tmpdir(), `anigosha-rof-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  try {
    const gesamt = Math.round(DAUER * FPS);
    const ton = await tonspurBauen({ ereignisse: klaenge(runden), fps: FPS, dauerFrames: gesamt, ziel: join(tmp, 'ton.m4a') });
    const browser = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
    try {
      const seite = await browser.newPage({ viewport: { width: B, height: H } });
      await seite.setContent(seiteHtml({ runden, storeSatz, logo, schrift, figur: figurB64 }), { waitUntil: 'load' });
      await seite.waitForFunction('window.__bereit === true', null, { timeout: 20000 });
      const senke = videoSenke({ fps: FPS, ziel: datei, tonDatei: ton });
      for (let n = 0; n < gesamt; n++) {
        await seite.evaluate((i) => window.setFrame(i), n);
        const bild = await seite.screenshot({ type: 'jpeg', quality: 92 });
        if (!senke.stdin.write(bild)) {
          await Promise.race([new Promise((r) => senke.stdin.once('drain', r)), senke.fertig]);
        }
      }
      senke.stdin.end();
      await senke.fertig;
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (statSync(datei).size < 100_000) throw new Error(`Reel ${datei} ist zu klein — ffmpeg hat kein Video geschrieben.`);
  return { runden, sekunden: DAUER, figur: !!figurB64 };
}

// --- Aufruf (Tageslauf: motoren.mjs) -----------------------------------------
//
//   --app <repo> --seed N --name <dateiname> --out <ordner> [--store <satz>] [--figur junge.png]
//
// Schreibt <ordner>/<dateiname>.mp4 und <ordner>/<dateiname>.txt (Beiblatt).
// ⚠ --out ist ein ORDNER und muss absolut sein — motoren.mjs übergibt ihn so.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { writeFileSync } = await import('node:fs');
  const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
  const app = resolve(arg('app', join(WURZEL, '..', 'anigosha')));
  if (!existsSync(app)) throw new Error(`Anigosha-Repo fehlt: ${app}`);
  const seed = Number(arg('seed', 1));
  const name = arg('name', `anigosha-richtig-falsch-de-s${seed}`);
  const ordner = resolve(arg('out', '.'));
  mkdirSync(ordner, { recursive: true });
  const datei = join(ordner, `${name}.mp4`);
  const storeSatz = arg('store', 'Gratis im App Store und bei Google Play');
  const r = await richtigFalschReel({ appPfad: app, seed, datei, storeSatz, figur: arg('figur', null) });
  const serien = [...new Set(r.runden.map((x) => x.serie))];
  const tag = (s) => '#' + s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  writeFileSync(join(ordner, `${name}.txt`), [
    name, '='.repeat(name.length), '',
    `Marke: Anigosha   Format: richtig-falsch   Sprache: DE   Laenge: ${r.sekunden.toFixed(1)} s   Seed: ${seed}`,
    '',
    '── CAPTION ZUM KOPIEREN ──────────────────────────────',
    '',
    `Richtig oder falsch? 3 Anime-Behauptungen aus ${serien.join(', ')} – wie viele schaffst du? 👀`,
    '',
    'Schreib deine Punktzahl in die Kommentare 👇',
    '',
    ['#anigosha', '#animequiz', '#anime', '#richtigoderfalsch', tag(serien[0])].join(' '),
    '',
    '── ZUR KONTROLLE (nicht posten) ──────────────────────',
    '',
    ...r.runden.map((x, i) => `${i + 1}. [${x.serie}, Stufe ${x.stufe}] ${x.frage} → „${x.behauptet}" = ${x.stimmt ? 'RICHTIG' : `FALSCH (richtig: ${x.richtig})`}`),
    '',
    '── VOR DEM POSTEN ────────────────────────────────────',
    '',
    '- Tonquelle: eigen (Musikbett und Klänge aus dem Anigosha-Reel-Baukasten)',
    // ⚠ Ohne Figur genau „typografie" — Anigosha hat `nur_typografie`. Mit dem
    // Jungen ist es ein KI-erzeugter Mensch: Dann steht das hier, und
    // „Wasserzeichen gesetzt" laesst lauf.mjs das AI-Plaettchen bestaetigen.
    r.figur
      ? '- Medienherkunft: ki-menschen (eigene Figur „Junge" aus dem Anigosha-Werbespot, Wasserzeichen gesetzt)'
      : '- Medienherkunft: typografie',
    '',
  ].join('\n'));
  console.log(`✓ ${datei}  ${r.sekunden.toFixed(1)} s`);
  r.runden.forEach((x, i) => console.log(`  ${i + 1}. [${x.serie}, Stufe ${x.stufe}] ${x.frage} → „${x.behauptet}" = ${x.stimmt ? 'RICHTIG' : 'FALSCH'}`));
}
