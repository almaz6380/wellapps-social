// Erzeugt die Story-Einblendung „Gratis laden · Link in Bio ↑" je Sprache.
//
//   CHROMIUM_PFAD=… node tools/social/story/pillen-erzeugen.mjs
//
// Ergebnis: tools/social/story/pille-<sprache>.png, 1080×1920, transparent,
// nur die Pille unten. story.mjs legt sie im Freigabe-Lauf per ffmpeg ueber
// Bild oder Video — dort gibt es weder Playwright noch Schriften, deshalb
// liegen die fertigen PNGs im Repo.
//
// ⚠ Warum kein echter Link (Josef, 27.09.2026): Link-Sticker lassen sich
// ueber die Instagram- und Facebook-Schnittstelle nicht setzen. Josef hat
// entschieden: automatisch posten, dafuer der sichtbare Hinweis auf die Bio.
//
// ⚠ Lage: Instagram legt unten die Antwortleiste (~170 px) und oben Fortschritt
// und Profilname (~220 px) ueber die Story. Die Pille sitzt deshalb bei
// y ≈ 1560–1680 — ueber der Leiste, aber unter dem Inhalt der Reels.

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HIER = dirname(fileURLToPath(import.meta.url));
const SCHRIFTEN = join(HIER, '..', '..', 'reels', 'assets', 'schriften');
export const TEXTE = {
  de: 'Gratis laden · Link in Bio',
  en: 'Free download · link in bio',
  es: 'Descarga gratis · enlace en la bio',
};

const b64 = (d) => readFileSync(d).toString('base64');
const browser = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
const seite = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [sprache, text] of Object.entries(TEXTE)) {
  await seite.setContent(`<!doctype html><html><head><style>
@font-face{font-family:'Inter';src:url(data:font/woff2;base64,${b64(join(SCHRIFTEN, 'inter-latin-600-normal.woff2'))}) format('woff2');font-weight:600}
html,body{margin:0;width:1080px;height:1920px;background:transparent}
.p{position:absolute;left:50%;top:1560px;transform:translateX(-50%);white-space:nowrap;
  display:flex;align-items:center;gap:18px;padding:26px 46px;border-radius:999px;
  background:rgba(10,10,12,.72);border:2px solid rgba(255,255,255,.55);
  color:#fff;font:600 44px/1 Inter,sans-serif;letter-spacing:.01em;
  box-shadow:0 10px 40px rgba(0,0,0,.35)}
.p b{font-size:46px}
</style></head><body><div class="p">${text}<b>↑</b></div></body></html>`);
  await seite.evaluate(() => document.fonts.ready);
  writeFileSync(join(HIER, `pille-${sprache}.png`), await seite.screenshot({ type: 'png', omitBackground: true }));
  console.log(`✓ pille-${sprache}.png`);
}
await browser.close();
