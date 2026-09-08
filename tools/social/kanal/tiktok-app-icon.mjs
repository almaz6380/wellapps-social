// Icon fuer die TikTok-Entwickler-App „WELLapps Social".
//
// TikTok verlangt 1024x1024, JPEG/PNG, oeffentlich sichtbar fuer Nutzer im
// Anmeldedialog. Es steht dort neben dem Kontonamen — also ist es das erste,
// was jemand von uns sieht, wenn er die Verbindung bestaetigt.
//
// ⚠ Bewusst typografisch und markenneutral: Die App bedient FUENF Marken
// (Anigosha, Mahjong Royale, WELLbooked!, FullRep, Swaply). Ein Icon einer
// einzelnen App waere im Dialog der vier anderen schlicht falsch.
//
// ⚠ Schrift als data:-URI. page.setContent() hat keinen Origin, `file://`
// laedt dort nicht — dieselbe Falle wie in tools/reels und make-icon.mjs.
//
//   node tools/social/kanal/tiktok-app-icon.mjs

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { browserStarten } from '../../pruefbrowser.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..', '..');

const schrift = `data:font/woff2;base64,${
  readFileSync(join(WURZEL, 'public', 'fonts', 'outfit.woff2')).toString('base64')}`;

const ZIEL = join(WURZEL, 'tools', 'social', 'kanal', 'fertig', 'tiktok');
mkdirSync(ZIEL, { recursive: true });

// Der Verlauf ist derselbe wie in Swaplys Marke — er stammt aus dem
// gemeinsamen WELL-Blaugruen und traegt als Dach ueber alle fuenf.
const html = `
<style>
  @font-face {
    font-family: 'Outfit';
    src: url('${schrift}') format('woff2');
    /* ⚠ Outfit ist variabel mit Vorgabe 100 (Thin). Ohne diese Zeile faellt
       alles auf Thin zurueck und sieht ausgeblichen aus. */
    font-weight: 100 900;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1024px; height: 1024px; }
  .grund {
    width: 1024px; height: 1024px;
    background: #06171c;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  /* Akzent als Bogen, nicht als Flaeche — ein flaechiger Verlauf sieht
     beliebig aus (die Lehre aus Swaplys erstem Entwurf).
     ⚠ Er liegt tief genug, dass KEIN Text auf ihm steht: Im ersten Entwurf
     sass „SOCIAL" auf dem Blau und war praktisch unlesbar. Ein Icon wird im
     Anmeldedialog auf ~48 px verkleinert — was dort nicht traegt, ist weg. */
  .bogen {
    position: absolute; width: 1600px; height: 1600px; border-radius: 50%;
    background: linear-gradient(105deg, #4e8cfe 0%, #409fb6 52%, #32a572 100%);
    left: -600px; top: 815px;
  }
  .marke {
    position: relative; text-align: center; margin-top: -60px;
    font-family: 'Outfit', system-ui, sans-serif; color: #eefaf7;
  }
  .w { font-size: 460px; font-weight: 700; line-height: .82; letter-spacing: -18px; }
  .w em { font-style: normal; color: #ffb02e; }
  .unter {
    font-size: 92px; font-weight: 600; letter-spacing: 14px;
    text-transform: uppercase; color: #cfe6e2; margin-top: 26px;
    padding-left: 14px; /* gleicht das Sperren am rechten Rand aus */
  }
</style>
<div class="grund">
  <div class="bogen"></div>
  <div class="marke">
    <div class="w">W<em>!</em></div>
    <div class="unter">Social</div>
  </div>
</div>`;

const browser = await browserStarten();
const seite = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await seite.setContent(html);
await seite.waitForFunction(() => document.fonts.ready.then(() => true));
const datei = join(ZIEL, 'wellapps-social-1024.png');
await seite.screenshot({ path: datei });
await browser.close();

console.log(`fertig: ${datei}`);
