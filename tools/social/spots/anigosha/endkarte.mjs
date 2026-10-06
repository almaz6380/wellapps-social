// Endkarte des Anigosha-Spots „Duell um Mitternacht“ → quellen/endkarte-{de,en}.png
import { chromium } from '/home/user/wellapps-social/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const b64 = p => readFileSync(p).toString('base64');
const A = process.env.ANIGOSHA_PFAD || '/home/user/anigosha';
const font = b64(`${A}/tools/reels/assets/outfit.woff2`);
const icon = b64(`${A}/public/icons/icon-512.png`);
const ios = b64(`${A}/tools/reels/spot/badges/appstore-en.png`);
const gp = b64(`${A}/tools/reels/spot/badges/googleplay-en.png`);
const bg = b64(new URL('quellen/startbild-3.png', import.meta.url).pathname);
// Store-Titel aus CLAUDE.md: „Anigosha: Anime Quiz & Duelle“ / „… & Duels“
const texte = { de: ['Anime Quiz & Duelle', 'Kostenlos im App Store<br>und bei Google Play'],
                en: ['Anime Quiz & Duels', 'Free on the App Store<br>and Google Play'] };
const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || '/opt/pw-browsers/chromium' });
const p = await br.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [lang, [satz, store]] of Object.entries(texte)) {
  await p.setContent(`<html><head><style>
  @font-face{font-family:O;src:url(data:font/woff2;base64,${font});font-weight:100 900}
  body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:O;color:#ede9fe}
  .bg{position:absolute;inset:-40px;background:url(data:image/png;base64,${bg}) center/cover;filter:blur(22px) brightness(.32) saturate(1.2)}
  .v{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(139,92,246,.22),rgba(15,10,30,.9) 75%)}
  .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:180px}
  img.i{width:300px;height:300px;border-radius:66px;box-shadow:0 0 0 4px rgba(244,114,182,.5),0 30px 90px rgba(0,0,0,.6),0 0 140px rgba(167,139,250,.45)}
  h1{font-size:118px;font-weight:800;margin:56px 0 0;letter-spacing:1px;background:linear-gradient(90deg,#c4b5fd,#f472b6);-webkit-background-clip:text;color:transparent}
  .s{font-size:52px;font-weight:600;margin-top:14px}
  .l{width:220px;height:3px;margin:48px 0;background:linear-gradient(90deg,transparent,#f472b6,transparent)}
  .st{font-size:48px;font-weight:500;text-align:center;line-height:1.3;opacity:.9}
  .b{display:flex;gap:28px;margin-top:52px}.b img{height:118px}
  </style></head><body><div class="bg"></div><div class="v"></div><div class="c">
  <img class="i" src="data:image/png;base64,${icon}"><h1>Anigosha</h1><div class="s">${satz}</div>
  <div class="l"></div><div class="st">${store}</div>
  <div class="b"><img src="data:image/png;base64,${ios}"><img src="data:image/png;base64,${gp}"></div></div></body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: new URL(`quellen/endkarte-${lang}.png`, import.meta.url).pathname });
}
await br.close();
