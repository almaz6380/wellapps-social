import { chromium } from '/home/user/wellapps-social/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const b64 = p => readFileSync(p).toString('base64');
const font = b64('/home/user/mahjong-app/scripts/reel/assets/outfit.woff2');
const icon = b64('/home/user/mahjong-app/public/pwa-512.png');
const ios = b64('/home/user/anigosha/tools/reels/spot/badges/appstore-en.png');
const gp = b64('/home/user/anigosha/tools/reels/spot/badges/googleplay-en.png');
const bg = b64(new URL('quellen/schweben.jpg', import.meta.url).pathname);
const texte = { de: ['Manche Spiele vergisst man nie.', 'Kostenlos im App Store<br>und bei Google Play'],
                en: ['Some games you never forget.', 'Free on the App Store<br>and Google Play'] };
const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || '/opt/pw-browsers/chromium' });
const p = await br.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [lang, [satz, store]] of Object.entries(texte)) {
  await p.setContent(`<html><head><style>
  @font-face{font-family:O;src:url(data:font/woff2;base64,${font});font-weight:100 900}
  body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:O;color:#f6e7c1}
  .bg{position:absolute;inset:-40px;background:url(data:image/jpeg;base64,${bg}) center/cover;filter:blur(18px) brightness(.38) saturate(1.1)}
  .v{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(20,60,45,.15),rgba(5,18,14,.85) 75%)}
  .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding-bottom:180px}
  img.i{width:300px;height:300px;border-radius:66px;box-shadow:0 0 0 4px rgba(232,196,120,.55),0 30px 90px rgba(0,0,0,.6),0 0 120px rgba(232,180,90,.35)}
  h1{font-size:104px;font-weight:700;margin:56px 0 0;letter-spacing:1px;background:linear-gradient(180deg,#fff3cf,#e2b25e);-webkit-background-clip:text;color:transparent}
  .s{font-size:44px;font-weight:400;margin-top:22px;opacity:.85;font-style:italic}
  .l{width:220px;height:2px;margin:48px 0;background:linear-gradient(90deg,transparent,#e2b25e,transparent)}
  .st{font-size:50px;font-weight:600;text-align:center;line-height:1.3}
  .b{display:flex;gap:28px;margin-top:52px}.b img{height:118px}
  </style></head><body><div class="bg"></div><div class="v"></div><div class="c">
  <img class="i" src="data:image/png;base64,${icon}"><h1>Mahjong Royale</h1><div class="s">${satz}</div>
  <div class="l"></div><div class="st">${store}</div>
  <div class="b"><img src="data:image/png;base64,${ios}"><img src="data:image/png;base64,${gp}"></div></div></body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: new URL(`quellen/endkarte-${lang}.png`, import.meta.url).pathname });
}
await br.close();
