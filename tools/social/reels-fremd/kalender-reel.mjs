// WELLbooked!: der echte Anbieter-Kalender als Reel — 1080×1920, stumm.
//
// Aufgerufen von make-reel.mjs bei `--marke wellbooked --format kalender-demo`.
//
// --- Warum (23.09.2026) ------------------------------------------------------
//
// Der Winkel `kalender-clip` versprach seit August „echte Kalenderaufnahme aus
// /kalender-demo — kein Mockup". Geliefert hat er nie eine: make-reel.mjs
// kannte das Format nicht und baute für `kategorie-loop` dasselbe
// Kategorien-Reel wie `last-minute`. Die Aufnahmen lagen die ganze Zeit
// fertig in wellbooked/docs/reels/kalender-demo/ausgabe/.
//
// --- Wie es aussieht ---------------------------------------------------------
//
// Die Aufnahme (Handy, 1170×2532) steht mittig auf Markengrün, auf 1480 px
// Höhe. Darüber eine Kopfzeile mit Wortmarke, darunter eine Bauchbinde mit
// EINEM Satz — beide in eigenen Streifen, nie über dem Kalender: Wer den
// Kalender verdeckt, zeigt ihn nicht.
// Am Ende 2,5 s Schlusskarte mit der Gründungspartner-Seite.
//
// ⚠ Stumm. `-an` am Ausgang, und die Aufnahmen haben ohnehin keine Tonspur.
// WELLbooked! verlangt Stille (Anordnung der Inhaberin), und die Leitplanke
// `tonspur-leer` in vorflug.mjs verwirft sonst den ganzen Beitrag.
//
// ⚠ Kein AI-Plättchen. Die Aufnahme ist ein Bildschirmmitschnitt der echten
// Kalender-Komponenten mit Demo-Daten, kein KI-Bild — ein Plättchen wäre hier
// eine Falschaussage.

import { readFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

import { lauf } from '../../reels/encode.mjs';

const B = 1080;
const H = 1920;
const FPS = 30;
const KALENDER_HOEHE = 1480;
const KALENDER_OBEN = 210;
const CLIP_SEK = 16;
const SCHLUSS_SEK = 2.5;

/**
 * @param {object} o
 * @param {string} o.appPfad   Wurzel des wellbooked-Repos
 * @param {object} o.marke     Eintrag `wellbooked` aus marken.json
 * @param {() => number} o.wuerfel
 * @param {string} o.ziel      .mp4-Pfad
 * @param {string} o.wurzel    Wurzel von wellapps-social (für die Schrift)
 */
export async function kalenderReel({ appPfad, marke: M, wuerfel, ziel, wurzel }) {
  // Texte und Gratiszeit aus dem wellbooked-Repo, nicht abgeschrieben.
  const { TEXTE, GRATIS_MONATE, ZIEL } = await import(join(appPfad, 'docs', 'social', 'anbieter.mjs'));
  const ordner = join(appPfad, 'docs', 'reels', 'kalender-demo', 'ausgabe');

  // ⚠ Nur freigegebene Sätze — dieselbe Regel wie für die Anbieter-Karussells.
  const frei = TEXTE.kalender.filter((k) => k.geprueft === true && existsSync(join(ordner, k.datei)));
  if (!frei.length) {
    throw new Error('Keine freigegebenen Kalender-Sätze in wellbooked/docs/social/anbieter.json '
      + '(kalender[].geprueft) — oder die Aufnahmen fehlen.');
  }
  const wahl = frei[Math.floor(wuerfel() * frei.length)];

  const tmp = join(tmpdir(), `kalender-reel-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  try {
    const schrift = readFileSync(join(wurzel, 'tools', 'reels', 'assets', 'outfit.woff2')).toString('base64');
    const kopf = `<style>
@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${schrift}) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden;background:transparent}
body{font-family:Outfit,sans-serif;color:${M.schrift}}
.oben{position:absolute;top:0;left:0;right:0;height:${KALENDER_OBEN}px;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:14px}
.marke{font-size:34px;font-weight:700;letter-spacing:.18em}
.augenbraue{font-size:26px;font-weight:700;letter-spacing:.2em;color:${M.mint}}
.unten{position:absolute;left:60px;right:60px;top:${KALENDER_OBEN + KALENDER_HOEHE}px;bottom:0;
  display:flex;align-items:center;justify-content:center;text-align:center;
  font-size:50px;font-weight:700;line-height:1.15}
.schluss{position:absolute;inset:0;background:${M.grund};display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;padding:0 90px;gap:36px}
.schluss .titel{font-size:84px;font-weight:700;line-height:1.08}
.schluss .zusatz{font-size:40px;color:${M.gedaempft};line-height:1.35}
.schluss .ziel{margin-top:10px;padding:22px 38px;border-radius:999px;background:${M.mint};
  color:${M.grund};font-size:40px;font-weight:700}
</style>`;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

    const browser = await chromium.launch(
      process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
    );
    try {
      const seite = await browser.newPage({ viewport: { width: B, height: H } });
      const bild = async (html, datei, transparent) => {
        await seite.setContent(`<!doctype html><meta charset="utf-8">${kopf}${html}`, { waitUntil: 'load' });
        await seite.evaluate(() => document.fonts.ready);
        // Die Bauchbinde darf nicht über ihren Streifen hinauslaufen.
        const zuHoch = await seite.evaluate(() => {
          const u = document.querySelector('.unten');
          return u ? u.scrollHeight > u.clientHeight : false;
        });
        if (zuHoch) throw new Error(`Bauchbinde zu lang: „${wahl.text}"`);
        await seite.screenshot({ path: join(tmp, datei), omitBackground: transparent });
      };
      await bild(`<div class="oben"><div class="marke">${esc(M.wortmarke.toUpperCase())}</div>
        <div class="augenbraue">FÜR ANBIETER:INNEN</div></div>
        <div class="unten">${esc(wahl.text)}</div>`, 'ueber.png', true);
      await bild(`<div class="schluss"><div class="titel">Gründungspartner:in werden.</div>
        <div class="zusatz">${GRATIS_MONATE} Monate ohne Abo und ohne Provision –<br>für alle, die vor dem Start dabei sind.</div>
        <div class="ziel">${esc(ZIEL)}</div></div>`, 'schluss.png', false);
    } finally {
      await browser.close();
    }

    const grund = M.grund.replace('#', '0x');
    await lauf([
      '-y',
      '-t', String(CLIP_SEK), '-i', join(ordner, wahl.datei),
      '-loop', '1', '-t', String(CLIP_SEK), '-i', join(tmp, 'ueber.png'),
      '-loop', '1', '-t', String(SCHLUSS_SEK), '-i', join(tmp, 'schluss.png'),
      '-filter_complex',
      `[0:v]fps=${FPS},scale=-2:${KALENDER_HOEHE},`
        + `pad=${B}:${H}:(ow-iw)/2:${KALENDER_OBEN}:color=${grund},setsar=1[k];`
        + `[k][1:v]overlay=0:0:shortest=1,format=yuv420p[a];`
        + `[2:v]fps=${FPS},scale=${B}:${H},setsar=1,format=yuv420p[s];`
        + '[a][s]concat=n=2:v=1:a=0[aus]',
      '-map', '[aus]',
      '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
      '-an',
      ziel,
    ]);

    // ⚠ ffmpeg kann mit 0 enden und trotzdem nur einen leeren Container
    // schreiben. Beim ersten Probelauf am 23.09. lag danach eine MP4 mit 261
    // Byte da, und der Lauf meldete „✓ 18.5 s". Achtzehn Sekunden Video in
    // diesem Format sind nie unter 100 KB — lieber hier abbrechen, als einen
    // leeren Beitrag in den Posteingang zu legen.
    const groesse = statSync(ziel).size;
    if (groesse < 100_000) {
      throw new Error(`Kalender-Reel ist nur ${groesse} Byte groß — ffmpeg hat kein Video geschrieben.`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  return {
    datei: wahl.datei,
    text: wahl.text,
    sekunden: CLIP_SEK + SCHLUSS_SEK,
    gratisMonate: GRATIS_MONATE,
    ziel: ZIEL,
  };
}
