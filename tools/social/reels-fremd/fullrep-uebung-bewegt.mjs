// FullRep: „Übung in Bewegung" — Reel 1080×1920 mit lizenzierter Übungsanimation.
//
//   CHROMIUM_PFAD=… node tools/social/reels-fremd/fullrep-uebung-bewegt.mjs \
//     --app ../mypeak --seed 3 --out /tmp/uebung.mp4 [--uebung goblet-squat]
//
// --- Warum (24.09.2026) ------------------------------------------------------
//
// Josef: „neuen post für alle plattformen mit neuen ideen/styles". FullRep-
// Reels sind bisher reine Schrift, weil die Demofotos keine belegte
// Rechtekette haben (FOTO_BEREICHE leer). Die 42 Animationen in
// public/exercise-demos-anim/ sind dagegen belegt: Gratis-Paket von Vital
// Animations, gleiche Lizenz wie die Kaufpakete, ausdrücklich auch Social
// Media (store-assets/lizenzen/vital-animations/BEFUND.md). Kein Post nutzt
// sie bisher. Die Figur ist eine gesichtslose 3D-Puppe — weder KI noch echte
// Person, also kein AI-Plättchen und kein Model Release nötig.
//
// ⚠ EULA § 5: die Rohdateien nie einzeln zum Download anbieten oder
// verlinken. Ein fertiges Video mit eingebauter Animation ist Nutzung, keine
// Weitergabe.
//
// ⚠ Texte nur aus der App (src/i18n über scripts/social-daten.mjs): Name,
// Muskelgruppe, Gerät, Beschreibung. Keine Dosierung, keine Diagnose,
// kein Heilversprechen (apps.json → regeln).

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { lauf, videoSenke } from '../../reels/encode.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..');
const SCHRIFTEN = join(WURZEL, 'tools', 'reels', 'assets', 'schriften');

export const B = 1080;
export const H = 1920;
export const FPS = 30;
const SZENE = 10.2;   // zwei Durchläufe der 5-s-Animation
const OUTRO = 3.0;
export const DAUER = SZENE + OUTRO;

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

/** Übungen, die eine Animation UND einen deutschen Namen samt Beschreibung haben. */
export async function animierteUebungen(appPfad, sprache = 'de') {
  const daten = await import(join(appPfad, 'scripts', 'social-daten.mjs'));
  const anim = (await import(join(appPfad, 'src', 'data', 'exerciseAnimations.js'))).default;
  return daten.exercises
    .filter((u) => anim[u.id] && existsSync(join(appPfad, 'public', 'exercise-demos-anim', anim[u.id], 'demo.mp4')))
    .map((u) => ({ id: u.id, ordner: anim[u.id], ...daten.uebungTexte(u, sprache) }))
    // Ohne Muskelgruppe und Gerät stünde auf den Chips „undefined" — das
    // betrifft die Ausdauer- und Ganzkörperübungen (Laufband, Rudern, Seile …).
    .filter((u) => u.muskel && u.geraet)
    .filter((u) => u.name && u.name !== u.id && u.beschreibung.length >= 30 && u.beschreibung.length <= 220);
}

function seiteHtml({ u, bilder, storeSatz, logo, gesamtUebungen }) {
  const b64 = (d) => readFileSync(d).toString('base64');
  const font = (name, datei, gewicht) => `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${b64(datei)}) format('woff2');font-weight:${gewicht}}`;
  // Beschreibung in Sätze: jeder Satz gleitet einzeln ein.
  const saetze = u.beschreibung.match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) ?? [u.beschreibung];
  const daten = JSON.stringify({ bilder, fps: FPS, SZENE, OUTRO, saetze });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${font('Anton', u.anton, 400)}
${font('Inter', join(SCHRIFTEN, 'inter-latin-400-normal.woff2'), 400)}
${font('Inter', join(SCHRIFTEN, 'inter-latin-600-normal.woff2'), 600)}
${font('Inter', join(SCHRIFTEN, 'inter-latin-900-normal.woff2'), 900)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden;background:#0a0a0a;color:#fff8e7;font-family:Inter,sans-serif}
.schein{position:absolute;left:50%;top:760px;width:1300px;height:1300px;margin-left:-650px;margin-top:-650px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(251,191,36,.22),rgba(251,191,36,0))}
.kopf{position:absolute;top:130px;left:100px;right:100px}
.etikett{display:inline-flex;gap:14px;align-items:center;font-size:30px;font-weight:600;letter-spacing:.18em;color:#fbbf24}
.etikett img{width:54px;height:54px;border-radius:12px}
.name{margin-top:22px;font-family:Anton,sans-serif;font-size:128px;line-height:.95;text-transform:uppercase;letter-spacing:.01em}
.karte{position:absolute;left:140px;right:140px;top:470px;height:800px;border-radius:48px;overflow:hidden;background:#fff;
  box-shadow:0 30px 90px rgba(0,0,0,.55),0 0 0 3px rgba(251,191,36,.35)}
.karte img{position:absolute;left:50%;top:50%;width:800px;height:800px;margin:-400px 0 0 -400px}
/* ⚠ Sichere Zone: ab ~1650 px liegen bei TikTok/Instagram Beschreibung und Knöpfe. */
.chips{position:absolute;left:100px;right:100px;top:1310px;display:flex;gap:16px}
.chip{padding:14px 26px;border-radius:999px;background:#1a1a1a;border:2px solid #3f3f46;font-size:32px;font-weight:600;color:#e7e5e4}
.chip.g{background:#fbbf24;border-color:#fbbf24;color:#0a0a0a}
.satz{position:absolute;left:100px;right:100px;font-size:38px;line-height:1.3;color:#e7e5e4}
.outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:34px;padding:0 100px;background:#0a0a0a}
.outro img{width:150px;height:150px;border-radius:34px}
.outro .t{font-family:Anton,sans-serif;font-size:96px;line-height:1;text-transform:uppercase}
.outro .t em{font-style:normal;color:#fbbf24}
.outro .u{font-size:40px;color:#e7e5e4;line-height:1.35}
.outro .s{font-size:36px;font-weight:600;padding:22px 40px;border-radius:999px;background:#fbbf24;color:#0a0a0a}
</style></head><body>
<div class="schein" id="schein"></div>
<div class="kopf" id="kopf"><div class="etikett"><img src="${logo}">ÜBUNG IN BEWEGUNG</div><div class="name" id="name"></div></div>
<div class="karte" id="karte"><img id="bild"></div>
<div class="chips" id="chips"><span class="chip g" id="c1"></span><span class="chip" id="c2"></span></div>
<div id="saetze"></div>
<div class="outro" id="outro"><img src="${logo}"><div class="t">${gesamtUebungen} Übungen.<br><em>Mit Anleitung.</em></div>
  <div class="u">Plane dein Training in FullRep.</div><div class="s" id="store"></div></div>
<script>
const D = ${daten};
const $ = (id) => document.getElementById(id);
const k = (x) => Math.max(0, Math.min(1, x));
const aus = (x) => 1 - Math.pow(1 - k(x), 3);
$('name').textContent = ${JSON.stringify(u.name)};
$('c1').textContent = ${JSON.stringify(u.muskel)};
$('c2').textContent = ${JSON.stringify(u.geraet)};
$('store').textContent = ${JSON.stringify(storeSatz)};
let y = 1410;
D.saetze.slice(0, 3).forEach((s, i) => {
  const d = document.createElement('div'); d.className = 'satz'; d.id = 's' + i; d.textContent = s;
  d.style.top = y + 'px'; y += 20 + Math.ceil(s.length / 42) * 50; $('saetze').appendChild(d);
});
window.setFrame = async (n) => {
  const t = n / D.fps;
  const i = Math.floor(t * D.fps) % D.bilder.length;
  const img = $('bild');
  if (img.getAttribute('src') !== D.bilder[i]) { img.src = D.bilder[i]; await img.decode().catch(() => {}); }
  $('schein').style.opacity = String(0.7 + 0.3 * Math.sin(t * 1.3));
  const kp = aus(t / .5);
  $('kopf').style.opacity = String(kp);
  $('kopf').style.transform = 'translateY(' + ((1 - kp) * -40) + 'px)';
  const cp = aus((t - .25) / .6);
  $('karte').style.opacity = String(cp);
  $('karte').style.transform = 'scale(' + (0.92 + 0.08 * cp) + ')';
  const ch = aus((t - .8) / .4);
  $('chips').style.opacity = String(ch);
  $('chips').style.transform = 'translateX(' + ((1 - ch) * -60) + 'px)';
  D.saetze.slice(0, 3).forEach((_, j) => {
    const p = aus((t - 1.6 - j * 1.4) / .5);
    const el = $('s' + j); el.style.opacity = String(p); el.style.transform = 'translateY(' + ((1 - p) * 30) + 'px)';
  });
  const op = aus((t - D.SZENE) / .5);
  $('outro').style.opacity = String(op);
  $('outro').style.transform = 'scale(' + (1.04 - 0.04 * op) + ')';
};
document.fonts.ready.then(() => { window.__bereit = true; });
</script></body></html>`;
}

export async function uebungReel({ appPfad, seed, datei, uebungId = null, storeSatz = 'Gratis im App Store und bei Google Play' }) {
  const liste = await animierteUebungen(appPfad);
  if (!liste.length) throw new Error('Keine animierte Übung mit Text gefunden.');
  const u = uebungId ? liste.find((x) => x.id === uebungId) : liste[Math.floor(zufall(seed * 2654435761)() * liste.length)];
  if (!u) throw new Error(`Übung ${uebungId} hat keine Animation oder keinen Text.`);
  u.anton = join(appPfad, 'scripts', 'schriften', 'anton.woff2');
  const quelle = join(appPfad, 'public', 'exercise-demos-anim', u.ordner, 'demo.mp4');
  const logo = `data:image/png;base64,${readFileSync(join(appPfad, 'public', 'icon-512.png')).toString('base64')}`;

  const tmp = join(tmpdir(), `fullrep-uebung-${process.pid}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, 'f'), { recursive: true });
  try {
    // Animation auf 30 fps und 860 px bringen (Lanczos, die Vorlage hat 480 px).
    await lauf(['-y', '-i', quelle, '-vf', 'fps=30,scale=800:800:flags=lanczos', '-q:v', '2', join(tmp, 'f', '%04d.jpg')]);
    const bilder = readdirSync(join(tmp, 'f')).filter((x) => x.endsWith('.jpg')).sort().map((x) => `f/${x}`);
    // Die Zahl im Abspann kommt aus den App-Daten, nicht aus dem Kopf.
    const gesamtUebungen = (await import(join(appPfad, 'scripts', 'social-daten.mjs'))).exercises.length;
    writeFileSync(join(tmp, 'seite.html'), seiteHtml({ u, bilder, storeSatz, logo, gesamtUebungen }));

    // Ton: der eigene FullRep-Musikteppich, leise, weich aus.
    const gesamt = Math.round(DAUER * FPS);
    const ton = join(tmp, 'ton.m4a');
    await lauf(['-y', '-i', join(WURZEL, 'tools', 'social', 'musik', 'fullrep-bett.mp3'), '-af',
      `atrim=0:${DAUER},asetpts=N/SR/TB,volume=0.5,afade=t=in:d=0.4,afade=t=out:st=${(DAUER - 1.2).toFixed(2)}:d=1.2,apad=whole_dur=${DAUER}`,
      '-t', String(DAUER), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', ton]);

    const browser = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
    try {
      const seite = await browser.newPage({ viewport: { width: B, height: H } });
      await seite.goto(pathToFileURL(join(tmp, 'seite.html')).href, { waitUntil: 'load' });
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
  return { uebung: u, sekunden: DAUER, anzahl: liste.length };
}

// --- Aufruf (Tageslauf: motoren.mjs) -----------------------------------------
//
//   --app <repo> --seed N --name <dateiname> --out <ordner> [--store <satz>]
//
// Schreibt <ordner>/<dateiname>.mp4 und <ordner>/<dateiname>.txt (Beiblatt).
// ⚠ --out ist ein ORDNER und muss absolut sein — motoren.mjs übergibt ihn so.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
  const app = resolve(arg('app', join(WURZEL, '..', 'mypeak')));
  const seed = Number(arg('seed', 1));
  const name = arg('name', `fullrep-uebung-bewegt-de-s${seed}`);
  const ordner = resolve(arg('out', '.'));
  mkdirSync(ordner, { recursive: true });
  const datei = join(ordner, `${name}.mp4`);
  const storeSatz = arg('store', 'Gratis im App Store und bei Google Play');
  const r = await uebungReel({ appPfad: app, seed, datei, uebungId: arg('uebung', null), storeSatz });
  const u = r.uebung;
  writeFileSync(join(ordner, `${name}.txt`), [
    name, '='.repeat(name.length), '',
    `Marke: FullRep   Format: uebung-bewegt   Sprache: DE   Laenge: ${r.sekunden.toFixed(1)} s   Seed: ${seed}`,
    '',
    '── CAPTION ZUM KOPIEREN ──────────────────────────────',
    '',
    `${u.name} – so sieht die Bewegung aus 🏋️`,
    '',
    u.beschreibung,
    '',
    `Muskelgruppe: ${u.muskel} · Gerät: ${u.geraet}`,
    '',
    'Alle Übungen mit Anleitung und Animation in FullRep.',
    '',
    '#fullrep #krafttraining #muskelaufbau #training #fitness',
    '',
    '── VOR DEM POSTEN ────────────────────────────────────',
    '',
    '- Tonquelle: eigen (FullRep-Musikteppich, tools/social/musik/fullrep-bett.mp3)',
    // Kein „ki-menschen": Die Figur ist eine gesichtslose 3D-Puppe aus dem
    // lizenzierten Paket von Vital Animations — weder KI noch echte Person.
    '- Medienherkunft: lizenzierte-animation (Vital Animations, 3D-Figur; Beleg in mypeak/store-assets/lizenzen/vital-animations/)',
    '',
  ].join('\n'));
  console.log(`✓ ${datei}  ${r.sekunden.toFixed(1)} s  ${u.name} (${u.muskel} · ${u.geraet})  — ${r.anzahl} animierte Übungen im Topf`);
}
