// WELLbooked!: Clip-Reel Frame für Frame — drei Looks zur Auswahl.
//
//   CHROMIUM_PFAD=… node tools/social/reels-fremd/clip-reel-looks.mjs \
//     --app ../wellbooked --clip von-selbst --look A --out /tmp/x.mp4
//
// --- Warum (23.09.2026) ------------------------------------------------------
//
// Josef zum ersten Clip-Reel: „mir gefällt die schrift und der grüne
// hintergrund nicht. Mach es mit mehr effekte und gerne auch mit anderem
// hintergrund" — „Zeig mir verschiedenes. Und gerne mit effekten wie
// einspielungen etc". Gewünscht: Text-Animation, Kamera-Zoom, Übergänge &
// Lichteffekte, Logo-Animation am Ende.
//
// Statt zwei fester PNGs über dem Clip entsteht hier JEDES Bild einzeln in
// Chromium — so lassen sich Wörter einzeln einblenden, Benachrichtigungen
// hereingleiten und der Clip zoomen. Jedes Bild ist eine reine Funktion des
// Frame-Index (window.setFrame(n)), dieselbe Regel wie in make-reel.mjs:
// kein setTimeout, keine CSS-Animation — sonst verrutschen Frames.
//
// ⚠ Die Seite wird per file:// GELADEN (page.goto), nicht per setContent():
// Nur so darf sie die Clip-Frames von der Platte lesen.
//
// ⚠ AI-Plättchen nur, wenn KI-MENSCHEN im Clip sichtbar sind (Josef,
// 23.09.2026: „ai wasserzeichen weg wenn keine person sichtbar"). Dann aber in
// JEDEM Bild, auch auf der Schlusskarte — dort liegt der Clip weichgezeichnet
// darunter. `menschen` ist Pflicht und muss ein Boolean sein: Ein vergessener
// Wert darf nie stillschweigend „keine Menschen" bedeuten.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
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
export const SCHLUSS_SEK = 3.5;

const b64 = (p) => readFileSync(p).toString('base64');
const font = (name, datei, gewicht, stil = 'normal') => `@font-face{font-family:'${name}';`
  + `src:url(data:font/woff2;base64,${b64(join(SCHRIFTEN, datei))}) format('woff2');`
  + `font-weight:${gewicht};font-style:${stil};font-display:block}`;

// --- Die drei Looks ----------------------------------------------------------
//
// Alles, was sich zwischen den Looks unterscheidet, steht HIER — die
// Zeitleiste unten ist für alle gleich. Wer einen vierten Look will, fügt
// einen Eintrag hinzu.
export const LOOKS = {
  // A · Hell & elegant: Serif-Titel auf Milchglas, cremige Schlusskarte.
  A: {
    name: 'Hell & elegant',
    fonts: () => font('Playfair', 'playfair-display-latin-600-normal.woff2', 600)
      + font('Playfair', 'playfair-display-latin-600-italic.woff2', 600, 'italic')
      + font('Inter', 'inter-latin-400-normal.woff2', 400)
      + font('Inter', 'inter-latin-600-normal.woff2', 600),
    css: `
.textbox{position:absolute;left:70px;right:70px;bottom:330px;padding:46px 50px 50px;
  border-radius:40px;background:rgba(255,252,246,.62);backdrop-filter:blur(22px) saturate(1.2);
  -webkit-backdrop-filter:blur(22px);box-shadow:0 20px 60px rgba(20,40,30,.18);
  border:1px solid rgba(255,255,255,.6)}
.satz{font-family:Playfair;font-weight:600;font-size:74px;line-height:1.1;color:#1b3a2d;letter-spacing:-.01em}
.satz .w.akzent{font-style:italic;color:#9a6b3f}
.meldung{background:rgba(255,255,255,.82);color:#1b3a2d}
.ende-schleier{background:linear-gradient(180deg,rgba(247,240,228,.80),rgba(240,230,214,.92))}
.logo{font-family:Playfair;font-weight:600;font-size:118px;color:#1b3a2d;letter-spacing:-.01em}
.logo .ruf{color:#b07a45}
.unterzeile{font-family:Inter;font-weight:400;font-size:38px;color:#3d5a4c;line-height:1.4}
.pille{background:#1b3a2d;color:#f7f0e4;font-family:Inter;font-weight:600}
.leitzeile{font-family:Inter;font-weight:600;color:#9a6b3f}`,
    lichtFarbe: 'rgba(255,214,160,.55)',
  },
  // B · Modern & kräftig: große fette Grotesk ohne Kasten, dunkle Schlusskarte.
  B: {
    name: 'Modern & kräftig',
    fonts: () => font('Inter', 'inter-latin-900-normal.woff2', 900)
      + font('Inter', 'inter-latin-600-normal.woff2', 600)
      + font('Inter', 'inter-latin-400-normal.woff2', 400),
    css: `
.textbox{position:absolute;left:70px;right:70px;bottom:360px}
.textbox::before{content:'';position:absolute;left:-70px;right:-70px;top:-260px;bottom:-360px;
  background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.55) 45%,rgba(0,0,0,.72));z-index:-1}
.satz{font-family:Inter;font-weight:900;font-size:98px;line-height:1.0;color:#fff;letter-spacing:-.035em;
  text-transform:none;text-shadow:0 6px 40px rgba(0,0,0,.35)}
.satz .w.akzent{color:#e3b27c}
.meldung{background:rgba(22,24,23,.78);color:#fff}
.ende-schleier{background:linear-gradient(180deg,rgba(8,14,12,.72),rgba(8,14,12,.88))}
.logo{font-family:Inter;font-weight:900;font-size:128px;color:#fff;letter-spacing:-.045em}
.logo .ruf{color:#e3b27c}
.unterzeile{font-family:Inter;font-weight:400;font-size:38px;color:rgba(255,255,255,.82);line-height:1.4}
.pille{background:#e3b27c;color:#111;font-family:Inter;font-weight:600}
.leitzeile{font-family:Inter;font-weight:600;color:#e3b27c}`,
    lichtFarbe: 'rgba(255,190,120,.45)',
  },
  // C · Warm & weich: runde Schrift auf pastellfarbenen Bändern.
  C: {
    name: 'Warm & weich',
    fonts: () => font('Nunito', 'nunito-latin-800-normal.woff2', 800)
      + font('Nunito', 'nunito-latin-700-normal.woff2', 700),
    css: `
.textbox{position:absolute;left:60px;right:60px;bottom:340px;display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.satz{font-family:Nunito;font-weight:800;font-size:76px;line-height:1.12;color:#1f3b30;display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.band{display:inline-block;padding:12px 30px 16px;border-radius:26px;background:#dfeadf;box-shadow:0 12px 30px rgba(30,50,40,.18)}
.band:nth-child(2n){background:#f3e6d3}
.satz .w.akzent{color:#b0703c}
.meldung{background:rgba(255,253,248,.9);color:#1f3b30}
.ende-schleier{background:linear-gradient(170deg,rgba(243,230,211,.86),rgba(223,234,223,.9))}
.logo{font-family:Nunito;font-weight:800;font-size:124px;color:#1f3b30;letter-spacing:-.01em}
.logo .ruf{color:#c47d45}
.unterzeile{font-family:Nunito;font-weight:700;font-size:40px;color:#3b5a4c;line-height:1.4}
.pille{background:#1f3b30;color:#fff;font-family:Nunito;font-weight:800}
.leitzeile{font-family:Nunito;font-weight:800;color:#b0703c}`,
    lichtFarbe: 'rgba(255,225,180,.5)',
  },
};

// --- Seite -------------------------------------------------------------------
//
// ⚠ Keine Backticks in den Kommentaren innerhalb des Templates.
function seiteHtml({ look, bilder, dauerClip, satz1, satz2, einspielungen, zusatz, ziel, menschen, etikett }) {
  const L = LOOKS[look];
  const daten = JSON.stringify({
    bilder, fps: FPS, dauerClip, schluss: SCHLUSS_SEK, satz1, satz2, einspielungen, zusatz, ziel,
    licht: L.lichtFarbe, baender: look === 'C',
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${L.fonts()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden;background:#000}
.clip{position:absolute;inset:0;overflow:hidden}
.clip img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 45%}
.licht{position:absolute;inset:-20%;pointer-events:none;mix-blend-mode:screen}
.w{display:inline-block;white-space:pre}
.meldung{position:absolute;left:50px;right:50px;top:140px;border-radius:34px;padding:26px 30px;
  display:flex;gap:24px;align-items:center;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  box-shadow:0 18px 50px rgba(0,0,0,.22);font-family:Inter,Nunito,sans-serif}
.meldung .icon{flex:none;width:86px;height:86px;border-radius:22px;background:#1b4332;color:#f5e6d3;
  display:flex;align-items:center;justify-content:center;font:900 30px Inter,Nunito,sans-serif;letter-spacing:-.02em}
.meldung .kopf{display:flex;justify-content:space-between;font-size:26px;font-weight:600;opacity:.65;margin-bottom:6px}
.meldung .inhalt{font-size:36px;font-weight:600;line-height:1.25}
.ende{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:0 90px;gap:34px}
.ende-schleier{position:absolute;inset:0}
.logo span{display:inline-block}
.pille{margin-top:14px;padding:24px 42px;border-radius:999px;font-size:40px}
.leitzeile{font-size:28px;letter-spacing:.2em}
.ki{position:absolute;right:48px;bottom:60px;width:56px;height:56px;border-radius:50%;
  background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.34);color:#fff;font:700 24px Inter,Nunito,sans-serif;
  display:flex;align-items:center;justify-content:center;z-index:50}
.etikett{position:absolute;left:48px;bottom:56px;padding:12px 26px;border-radius:999px;z-index:60;
  background:rgba(0,0,0,.62);color:#fff;font:700 34px Inter,Nunito,sans-serif;letter-spacing:.02em}
${L.css}
</style></head><body>
<div class="clip"><img id="bild"></div>
<div class="licht" id="licht"></div>
<div class="textbox" id="box"><div class="satz" id="satz"></div></div>
<div class="meldung" id="meldung"><div class="icon">W!</div><div style="flex:1">
  <div class="kopf"><span>WELLbooked!</span><span>jetzt</span></div><div class="inhalt" id="meldungText"></div></div></div>
<div class="ende" id="ende"><div class="ende-schleier"></div>
  <div class="leitzeile" id="leit" style="position:relative">DU ARBEITEST.</div>
  <div class="logo" id="logo" style="position:relative"></div>
  <div class="unterzeile" id="unter" style="position:relative"></div>
  <div class="pille" id="pille" style="position:relative"></div></div>
${menschen ? '<div class="ki">AI</div>' : ''}
${etikett ? '<div class="etikett">' + etikett.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>' : ''}
<script>
const D = ${daten};
const $ = (id) => document.getElementById(id);
const klemme = (x) => Math.max(0, Math.min(1, x));
const sanft = (x) => { x = klemme(x); return 1 - Math.pow(1 - x, 3); };          // ease-out
const feder = (x) => { x = klemme(x); return 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2); }; // leichtes Überschwingen

// Sätze in Wörter zerlegen; das letzte Wort bekommt den Akzent.
// Ein alleinstehender Gedankenstrich hängt am vorigen Wort — sonst beginnt
// eine Zeile oder ein Band (Look C) mit „– rund um".
function woerter(satz) {
  const teile = [];
  satz.split(' ').forEach((w) => {
    if (/^[–—-]$/.test(w) && teile.length) teile[teile.length - 1] += ' ' + w;
    else teile.push(w);
  });
  return teile.map((w, i) => ({ w, akzent: i === teile.length - 1 }));
}
function satzBauen(satz) {
  const s = $('satz'); s.innerHTML = '';
  const liste = woerter(satz);
  if (D.baender) {
    // C: je ~2–3 Wörter ein Band
    let band = null, n = 0;
    liste.forEach((x, i) => {
      if (!band || n >= 3) { band = document.createElement('div'); band.className = 'band'; s.appendChild(band); n = 0; }
      const sp = document.createElement('span'); sp.className = 'w' + (x.akzent ? ' akzent' : '');
      sp.textContent = x.w + (i < liste.length - 1 ? ' ' : ''); band.appendChild(sp); n++;
    });
  } else {
    liste.forEach((x, i) => {
      const sp = document.createElement('span'); sp.className = 'w' + (x.akzent ? ' akzent' : '');
      sp.textContent = x.w + (i < liste.length - 1 ? ' ' : ''); s.appendChild(sp);
    });
  }
}
let aktSatz = null;
const logoText = 'WELLbooked!';
$('logo').innerHTML = [...logoText].map((c, i) => '<span class="' + (i === logoText.length - 1 ? 'ruf' : '') + '">' + c + '</span>').join('');
$('unter').textContent = D.zusatz;
$('pille').textContent = D.ziel;

window.setFrame = async (n) => {
  const t = n / D.fps;
  const gesamt = D.dauerClip + D.schluss;
  // 1) Clip-Bild + Ken Burns. Nach Clip-Ende bleibt das letzte Bild stehen.
  const idx = Math.min(D.bilder.length - 1, Math.floor(t * D.fps));
  const img = $('bild');
  const ziel = D.bilder[idx];
  if (img.getAttribute('src') !== ziel) {
    img.src = ziel;
    await img.decode().catch(() => {});
  }
  const endeP = sanft((t - (D.dauerClip - 0.45)) / 0.8);
  // Beim Weichzeichnen etwas nachzoomen: Blur zieht sonst den Bildrand
  // (schwarz) sichtbar ins Bild.
  const zoom = 1.03 + 0.12 * (t / gesamt) + 0.06 * endeP;
  // ⚠ Der Schwenk darf nie weiter reichen als der Überstand durch den Zoom.
  // translate() in % wirkt NACH scale() und bezieht sich auf die unskalierte
  // Breite — der Überstand je Seite ist (zoom−1)/2, auf die Breite bezogen
  // also (zoom−1)/(2·zoom). Die erste Fassung schob fest bis −14 % und zeigte
  // bei 4 s rechts einen schwarzen Streifen.
  const schwenk = -((zoom - 1) / (2 * zoom)) * 100 * 0.6;
  img.style.transform = 'scale(' + zoom + ') translate(' + schwenk + '%,0)';
  img.style.filter = 'blur(' + (endeP * 14) + 'px) saturate(' + (1 + endeP * 0.1) + ')';

  // 2) Licht-Schimmer: wandert diagonal, stärker im Übergang.
  const lx = -30 + 160 * (t / gesamt), ly = 10 + 30 * Math.sin(t * 0.9);
  const lstark = 0.35 + 0.65 * Math.exp(-Math.pow((t - D.dauerClip + 0.2) / 0.45, 2));
  $('licht').style.background = 'radial-gradient(45% 35% at ' + lx + '% ' + ly + '%, ' + D.licht + ', rgba(0,0,0,0) 70%)';
  $('licht').style.opacity = String(lstark);

  // 3) Sätze: Satz 1 bis 2,55 s, Satz 2 ab 2,75 s bis zum Übergang.
  const halb = 2.55;
  const satz = t < halb + 0.1 ? D.satz1 : D.satz2;
  if (satz !== aktSatz) { satzBauen(satz); aktSatz = satz; }
  const start = satz === D.satz1 ? 0.35 : halb + 0.2;
  const aus = satz === D.satz1 ? halb : D.dauerClip - 0.4;
  const raus = sanft((t - aus) / 0.3);
  const box = $('box');
  box.style.opacity = String(klemme((t - start + 0.05) / 0.25) * (1 - raus));
  box.style.transform = 'translateY(' + (raus * -30) + 'px)';
  [...document.querySelectorAll('#satz .w')].forEach((sp, i) => {
    const p = sanft((t - start - i * 0.11) / 0.42);
    sp.style.opacity = String(p);
    sp.style.transform = D.baender ? 'translateX(' + ((1 - p) * -60) + 'px)'
      : 'translateY(' + ((1 - p) * 46) + 'px) scale(' + (0.94 + 0.06 * p) + ')';
    sp.style.filter = 'blur(' + ((1 - p) * 12) + 'px)';
  });
  if (D.baender) {
    [...document.querySelectorAll('.band')].forEach((b, i) => {
      const p = feder((t - start - i * 0.18) / 0.5);
      b.style.transform = 'translateX(' + ((1 - p) * -700) + 'px) skewX(' + ((1 - klemme(p)) * -8) + 'deg)';
    });
  }

  // 4) Einspielungen: Benachrichtigung gleitet von oben herein.
  const slots = [[1.1, 2.45], [3.3, D.dauerClip - 0.55]];
  let meldung = null, mp = 0;
  slots.forEach(([a, e], i) => {
    if (t >= a - 0.05 && t <= e + 0.35 && D.einspielungen[i]) {
      meldung = D.einspielungen[i];
      mp = Math.min(feder((t - a) / 0.5), 1 - sanft((t - e) / 0.3));
    }
  });
  const m = $('meldung');
  if (meldung) { $('meldungText').textContent = meldung; }
  m.style.opacity = meldung ? String(klemme(mp * 1.4)) : '0';
  m.style.transform = 'translateY(' + ((1 - mp) * -260) + 'px) scale(' + (0.96 + 0.04 * klemme(mp)) + ')';

  // 5) Schluss: Schleier, Logo Buchstabe für Buchstabe, dann Zeile + Pille.
  const e0 = D.dauerClip - 0.1;
  const ende = $('ende');
  ende.style.opacity = String(sanft((t - e0) / 0.5));
  $('leit').style.opacity = String(sanft((t - e0 - 0.25) / 0.4));
  $('leit').style.transform = 'translateY(' + ((1 - sanft((t - e0 - 0.25) / 0.4)) * 20) + 'px)';
  [...document.querySelectorAll('#logo span')].forEach((sp, i) => {
    const p = feder((t - e0 - 0.45 - i * 0.055) / 0.45);
    sp.style.opacity = String(klemme(p * 1.5));
    sp.style.transform = 'translateY(' + ((1 - p) * 60) + 'px) scale(' + (0.8 + 0.2 * p) + ')';
  });
  const pu = sanft((t - e0 - 1.25) / 0.45);
  $('unter').style.opacity = String(pu);
  $('unter').style.transform = 'translateY(' + ((1 - pu) * 24) + 'px)';
  const pp = feder((t - e0 - 1.6) / 0.5);
  $('pille').style.opacity = String(klemme(pp * 1.5));
  $('pille').style.transform = 'scale(' + (0.85 + 0.15 * pp) + ')';
  // Die Textebenen des Clips treten zurück, sobald die Schlusskarte kommt.
  box.style.visibility = t > e0 + 0.3 ? 'hidden' : 'visible';
};
document.fonts.ready.then(() => { window.__bereit = true; });
</script></body></html>`;
}

/**
 * Rendert ein Clip-Reel im gewünschten Look. Gibt die Dauer in Sekunden zurück.
 * `tonDatei` optional — ohne sie wird stumm kodiert.
 */
export async function lookRendern({
  quelle, look, satz1, satz2, einspielungen, zusatz, ziel, datei, menschen, tonDatei = null, etikett = null,
}) {
  if (typeof menschen !== 'boolean') {
    throw new Error(`lookRendern: \`menschen\` muss true oder false sein (war ${menschen}) — `
      + 'davon hängt das AI-Plättchen ab.');
  }
  const tmp = join(tmpdir(), `clip-look-${process.pid}-${look}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, 'f'), { recursive: true });
  try {
    await lauf(['-y', '-i', quelle, '-vf',
      `fps=${FPS},scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H}`,
      '-q:v', '3', join(tmp, 'f', '%04d.jpg')]);
    const bilder = readdirSync(join(tmp, 'f')).filter((x) => x.endsWith('.jpg')).sort().map((x) => `f/${x}`);
    const dauerClip = bilder.length / FPS;
    writeFileSync(join(tmp, 'seite.html'), seiteHtml({ look, bilder, dauerClip, satz1, satz2, einspielungen, zusatz, ziel, menschen, etikett }));

    const browser = await chromium.launch(
      process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
    );
    try {
      const seite = await browser.newPage({ viewport: { width: B, height: H } });
      await seite.goto(pathToFileURL(join(tmp, 'seite.html')).href, { waitUntil: 'load' });
      await seite.waitForFunction('window.__bereit === true', null, { timeout: 20000 });
      const gesamt = Math.round((dauerClip + SCHLUSS_SEK) * FPS);
      const senke = videoSenke({ fps: FPS, ziel: datei, tonDatei });
      for (let n = 0; n < gesamt; n++) {
        await seite.evaluate((i) => window.setFrame(i), n);
        const bild = await seite.screenshot({ type: 'jpeg', quality: 92 });
        if (!senke.stdin.write(bild)) await new Promise((r) => senke.stdin.once('drain', r));
      }
      senke.stdin.end();
      await senke.fertig;
      return gesamt / FPS;
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- Aufruf von der Kommandozeile (Vorschau) --------------------------------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
  const app = resolve(arg('app', join(WURZEL, '..', 'wellbooked')));
  const { TEXTE, GRATIS_MONATE, ZIEL } = await import(join(app, 'docs', 'social', 'anbieter.mjs'));
  const id = arg('clip', 'von-selbst');
  const c = TEXTE.clips.find((x) => x.datei === `${id}.mp4`);
  if (!c) throw new Error(`Clip ${id} nicht in anbieter.json`);
  const quelle = join(app, 'docs', 'social', 'clips', c.datei);
  if (!existsSync(quelle)) throw new Error(`fehlt: ${quelle}`);
  const look = arg('look', 'A');
  const datei = resolve(arg('out', `clip-${id}-${look}.mp4`));
  const s = await lookRendern({
    quelle, look, satz1: c.saetze[0], satz2: c.saetze[1],
    einspielungen: c.einspielungen ?? ['Neue Buchung · bezahlt ✓', 'Erinnerung verschickt ✓'],
    zusatz: TEXTE.clipSchluss.zusatz.replace('{gratis_monate}', String(GRATIS_MONATE)),
    ziel: ZIEL, datei, menschen: c.menschen,
    // --etikett: nur für die Vorschau — schreibt „A · Hell & elegant" ins Bild.
    etikett: process.argv.includes('--etikett') ? `${look} · ${LOOKS[look].name}` : null,
  });
  console.log(`✓ ${datei}  Look ${look} (${LOOKS[look].name})  ${s.toFixed(1)} s  `
    + (c.menschen ? 'mit AI-Plättchen' : 'ohne AI-Plättchen (keine Menschen)'));
}
