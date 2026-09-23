// WELLbooked!: Anbieter-Reel aus einem KI-Clip — 1080×1920, stumm.
//
// Aufgerufen von make-reel.mjs bei `--marke wellbooked --format clip-reel`.
//
// --- Warum (23.09.2026) ------------------------------------------------------
//
// Josef zu den Typografie-Reels: „die reel sehen billig aus.. einfach eine
// schrift auf einem grünen hintergrund geklatscht". Stattdessen: ein echter
// Bewegtbild-Clip (fal.ai, einmalig erzeugt, liegt im wellbooked-Repo unter
// docs/social/clips/), darüber zwei Sätze nacheinander, am Ende eine
// Schlusskarte mit der Gründungspartner-Seite.
//
// Die Botschaft ist immer dieselbe, auf Josefs Wunsch: WELLbooked! nimmt
// Anbieter:innen die Organisation ab — kein Telefonieren, kein Hin und Her,
// kein Papierkram. Keine Gebiete (weder Bereiche noch Regionen).
//
// ⚠ Die Clips sind KI-erzeugt und zeigen Menschen. Deshalb trägt JEDER Frame
// mit Clip das AI-Plättchen, und das Beiblatt nennt
// „Medienherkunft: ki-menschen (Wasserzeichen gesetzt)" — lauf.mjs liest
// genau diesen Wortlaut, sonst verwirft vorflug.mjs den Beitrag.
//
// ⚠ Stumm. `-an` am Ausgang; die Clips haben ohnehin keine Tonspur.

import { readFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

import { lauf, FFMPEG } from '../../reels/encode.mjs';
import { execFileSync } from 'node:child_process';

const B = 1080;
const H = 1920;
const FPS = 30;
const WECHSEL_SEK = 2.5;
const SCHLUSS_SEK = 3;

/** Länge eines Clips in Sekunden, aus ffmpegs Kopfzeile gelesen. */
function laenge(datei) {
  let aus = '';
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', datei], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { aus = String(e.stderr ?? ''); }
  const m = aus.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`Länge von ${datei} nicht lesbar.`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * @param {object} o
 * @param {string} o.appPfad   Wurzel des wellbooked-Repos
 * @param {object} o.marke     Eintrag `wellbooked` aus marken.json
 * @param {() => number} o.wuerfel
 * @param {string} o.ziel      .mp4-Pfad
 * @param {string} o.wurzel    Wurzel von wellapps-social (für die Schrift)
 */
export async function clipReel({ appPfad, marke: M, wuerfel, ziel, wurzel }) {
  const { TEXTE, GRATIS_MONATE, ZIEL } = await import(join(appPfad, 'docs', 'social', 'anbieter.mjs'));
  const ordner = join(appPfad, 'docs', 'social', 'clips');

  // ⚠ Nur freigegebene Clips, und nur solche, deren Datei wirklich da ist.
  const frei = TEXTE.clips.filter((c) => c.geprueft === true && existsSync(join(ordner, c.datei)));
  if (!frei.length) {
    throw new Error('Keine freigegebenen Clips in wellbooked/docs/social/anbieter.json (clips[].geprueft) '
      + '— oder die Dateien in docs/social/clips/ fehlen.');
  }
  const wahl = frei[Math.floor(wuerfel() * frei.length)];
  const quelle = join(ordner, wahl.datei);
  const dauer = laenge(quelle);
  const zusatz = TEXTE.clipSchluss.zusatz.replace('{gratis_monate}', String(GRATIS_MONATE));

  const tmp = join(tmpdir(), `clip-reel-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  try {
    const schrift = readFileSync(join(wurzel, 'tools', 'reels', 'assets', 'outfit.woff2')).toString('base64');
    const kopf = `<style>
@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${schrift}) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden;background:transparent;font-family:Outfit,sans-serif}
.verlauf{position:absolute;left:0;right:0;top:0;height:900px;
  background:linear-gradient(180deg,rgba(20,53,42,.74) 0%,rgba(20,53,42,.46) 45%,rgba(20,53,42,0) 100%)}
.marke{position:absolute;top:120px;left:0;right:0;text-align:center;color:${M.schrift};
  font-size:34px;font-weight:700;letter-spacing:.18em}
.satz{position:absolute;top:300px;left:90px;right:90px;text-align:center;color:${M.schrift};
  font-size:80px;font-weight:700;line-height:1.1;text-shadow:0 4px 30px rgba(0,0,0,.35)}
.ki{position:absolute;right:48px;bottom:60px;width:56px;height:56px;border-radius:50%;
  background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.34);color:#fff;font-size:24px;
  font-weight:700;display:flex;align-items:center;justify-content:center}
.ende{position:absolute;inset:0;background:${M.grund};display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;padding:0 90px;gap:36px;color:${M.schrift}}
.ende .t{font-size:84px;font-weight:700;line-height:1.08}
.ende .z{font-size:40px;color:${M.gedaempft};line-height:1.35}
.ende .p{padding:22px 38px;border-radius:999px;background:${M.mint};color:${M.grund};font-size:40px;font-weight:700}
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
        // Der Satz muss im abgedunkelten oberen Teil bleiben — darunter liegt
        // das Motiv, und dort wäre er nicht mehr lesbar.
        const zuHoch = await seite.evaluate(() => {
          const s = document.querySelector('.satz');
          return s ? s.getBoundingClientRect().bottom > 760 : false;
        });
        if (zuHoch) throw new Error(`Satz zu lang für den Clip: ${datei}`);
        await seite.screenshot({ path: join(tmp, datei), omitBackground: transparent });
      };
      const ueber = (satz) => `<div class="verlauf"></div><div class="marke">${esc(M.wortmarke.toUpperCase())}</div>`
        + `<div class="satz">${esc(satz)}</div><div class="ki">AI</div>`;
      await bild(ueber(wahl.saetze[0]), 'o1.png', true);
      await bild(ueber(wahl.saetze[1]), 'o2.png', true);
      await bild(`<div class="ende"><div class="t">${esc(TEXTE.clipSchluss.titel)}</div>
        <div class="z">${esc(zusatz)}</div><div class="p">${esc(ZIEL)}</div></div>`, 'ende.png', false);
    } finally {
      await browser.close();
    }

    await lauf([
      '-y',
      '-i', quelle,
      '-loop', '1', '-t', String(dauer), '-i', join(tmp, 'o1.png'),
      '-loop', '1', '-t', String(dauer), '-i', join(tmp, 'o2.png'),
      '-loop', '1', '-t', String(SCHLUSS_SEK), '-i', join(tmp, 'ende.png'),
      '-filter_complex',
      `[0:v]scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},fps=${FPS},setsar=1[v];`
        + `[v][1:v]overlay=0:0:enable='lt(t,${WECHSEL_SEK})'[a];`
        + `[a][2:v]overlay=0:0:enable='gte(t,${WECHSEL_SEK})',format=yuv420p[b];`
        + `[3:v]fps=${FPS},scale=${B}:${H},setsar=1,format=yuv420p[e];`
        + '[b][e]concat=n=2:v=1:a=0[aus]',
      '-map', '[aus]',
      '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
      '-an',
      ziel,
    ]);

    // Dieselbe Sicherung wie im Kalender-Reel: ffmpeg kann mit 0 enden und
    // trotzdem nur einen leeren Container schreiben.
    const groesse = statSync(ziel).size;
    if (groesse < 100_000) {
      throw new Error(`Clip-Reel ist nur ${groesse} Byte groß — ffmpeg hat kein Video geschrieben.`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  return {
    datei: wahl.datei,
    saetze: wahl.saetze,
    sprechtext: wahl.sprechtext ?? null,
    titel: TEXTE.clipSchluss.titel,
    zusatz,
    sekunden: dauer + SCHLUSS_SEK,
    gratisMonate: GRATIS_MONATE,
    ziel: ZIEL,
  };
}
