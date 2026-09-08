// Baut das Geruest des Demo-Videos fuer TikToks App Review.
//
//   node tools/social/tiktok-demo/bauen.mjs
//   node tools/social/tiktok-demo/bauen.mjs --clip1 anmeldung.mov --clip2 entwurf.mov
//
// --- Was dieses Skript kann und was nicht -----------------------------------
//
// TikTok verlangt fuer die Pruefung eine Aufnahme der ECHTEN Integration.
// Zwei der sechs Szenen zeigen TikToks eigene Oberflaeche — den
// Zustimmungsdialog und den Entwurfs-Posteingang. Beide entstehen in einem
// angemeldeten TikTok-Konto auf einem echten Geraet und lassen sich hier
// nicht erzeugen: Der Container hat kein TikTok, keinen Simulator (TikTok
// gibt es dort ohnehin nicht, der iOS-Simulator hat keinen App Store) und
// aus Chromium keinen Netzzugang.
//
// Alles UEBRIGE entsteht hier: Titel, Ablauf, die echten Protokollzeilen des
// Laufs, Format und Laenge. Ohne Clips rendert das Skript an den beiden
// Stellen eine deutlich gekennzeichnete Platzhalterkarte — das Video ist
// damit vollstaendig ansehbar, aber NICHT einreichbar.
//
// Mit `--clip1` und `--clip2` werden die Aufnahmen eingesetzt und das Ganze
// zu einer Datei zusammengefuegt. Erst diese Fassung geht an TikTok.
//
// ⚠ Die Platzhalterkarten sagen im Bild selbst, dass sie Platzhalter sind.
// Ein Video, in dem eine nachgebaute TikTok-Oberflaeche als echt ausgegeben
// wird, waere in einer Pruefung eine Taeuschung — und das Risiko traegt das
// Entwicklerkonto.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { videoSenke, lauf, FFMPEG } from '../../reels/encode.mjs';

/** Laenge und Format einer fertigen Datei — aus ffmpegs eigenem Kopf gelesen. */
function gemessen(datei) {
  const roh = spawnSync(FFMPEG, ['-i', datei], { encoding: 'utf8' }).stderr ?? '';
  const dauer = roh.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const bild = roh.match(/Video: .*?, (\d+x\d+)[^,]*, .*?([\d.]+) fps/);
  const sek = dauer ? (+dauer[1] * 3600 + +dauer[2] * 60 + +dauer[3]).toFixed(1) : '?';
  return `${sek} s · ${bild?.[1] ?? '?'} · ${bild?.[2] ?? '?'} fps`;
}

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..');

const wert = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };

const FPS = 30;
const BREITE = 1080;
const HOEHE = 1920;
const ZIEL_ORDNER = join(WURZEL, 'out', 'tiktok-demo');
const CLIP1 = wert('clip1', null);
const CLIP2 = wert('clip2', null);

// ⚠ Zuschnitt der beiden Aufnahmen — gemessen an den Aufnahmen vom
// 05./07.09.2026, nicht geschaetzt. Wer neue macht, prueft die Werte nach
// (Einzelbilder ziehen und ansehen) oder setzt sie ueber die Schalter.
//
// Warum ueberhaupt zugeschnitten wird, Punkt fuer Punkt:
//
// clip1 (Mac, quer 1280×800): Ohne `crop` faellt eine Querformat-Aufnahme in
//   einem 9:16-Rahmen auf einen schmalen Streifen zusammen — der
//   Zustimmungsdialog waere zwar da, aber kaum zu lesen. Der Ausschnitt
//   behaelt bewusst die Adresszeile („tiktok.com"): Sie ist der Beleg, dass
//   der Dialog von TikTok kommt und nicht nachgebaut ist.
//   ⚠ `bis` schneidet VOR der Landeseite mit dem OAuth-Code ab. Der Code ist
//   laengst verbraucht und einmalig, aber ein Zugangscode gehoert in kein
//   Video, das aus dem Haus geht.
//
// clip2 (iPhone, hochkant): Die ersten Sekunden sind der Startbildschirm der
//   TikTok-App und die ladende Liste — nichts, was etwas beweist. Kein
//   `crop`, das Bild ist ohnehin hochkant.
const ZUSCHNITT = {
  clip1: { von: wert('von1', 5.5), bis: wert('bis1', 12.3), crop: wert('crop1', '520:700:380:0') },
  clip2: { von: wert('von2', 6.0), bis: wert('bis2', null), crop: wert('crop2', null) },
};

// Die Schrift wird eingebettet, weil `setContent`-Seiten keinen Origin haben
// und `file://` dort nicht laedt — dieselbe Regel wie bei den Reels.
const SCHRIFT = readFileSync(join(WURZEL, 'tools', 'reels', 'assets', 'outfit.woff2')).toString('base64');

// ⚠ Echte Zeilen aus dem Lauf vom 05.09.2026, nicht erfunden. Sie sind der
// Beleg, dass die Integration laeuft — deshalb stehen sie woertlich hier und
// werden nicht „schoener" gemacht.
const PROTOKOLL = [
  '$ node tools/social/posten.mjs --echt --app anigosha',
  '',
  'Zugangsdaten',
  '  ✓ anigosha/tiktok vollstaendig',
  '',
  '━━ Anigosha · anigosha-fandom-attack_on_titan-de.mp4',
  '   ✓ tiktok  im Posteingang (4.1 MB)',
  '           — freigeben in der TikTok-App',
];

// Szenen. `art` entscheidet, was gezeichnet wird; `sek` ist die Dauer.
const SZENEN = [
  { art: 'titel', sek: 3.5,
    oben: 'WELLapps Social',
    gross: 'Content Posting API',
    unten: 'Integration demo · one app, five own accounts' },

  { art: 'liste', sek: 5,
    gross: 'How it works',
    punkte: [
      '1 · The account owner authorizes once (Login Kit)',
      '2 · A scheduled job uploads a video as a DRAFT',
      '3 · A human opens TikTok and decides to publish',
    ] },

  { art: 'schritt', sek: 3, nummer: '1', gross: 'Login Kit',
    unten: 'The owner of the account grants access. We read only open_id,\nto map the token to the right account.',
    clip: CLIP1, clipHinweis: 'Screen recording: TikTok consent dialog' },

  { art: 'protokoll', sek: 8, nummer: '2', gross: 'video.upload',
    unten: 'Direct Post is switched off. The upload goes to the creator inbox.' },

  { art: 'schritt', sek: 3, nummer: '3', gross: 'Creator inbox',
    unten: 'The draft appears in the TikTok app. Nothing is public yet.',
    clip: CLIP2, clipHinweis: 'Screen recording: draft in the TikTok app' },

  { art: 'titel', sek: 4,
    oben: 'Nothing is posted automatically',
    gross: 'A human publishes',
    unten: 'Own apps · own accounts · no third-party content' },
];

function html() {
  const daten = JSON.stringify({ szenen: SZENEN, protokoll: PROTOKOLL, fps: FPS });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${SCHRIFT}) format('woff2');
  font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${BREITE}px;height:${HOEHE}px;overflow:hidden}
body{font-family:Outfit,sans-serif;background:#0a0714;color:#f4eeff;
  display:flex;align-items:center;justify-content:center}
.buehne{position:relative;width:100%;height:100%}
/* Ein ruhiger Verlauf statt einer Animation: Das Video soll den Ablauf
   zeigen, nicht sich selbst. */
.buehne::before{content:'';position:absolute;inset:0;
  background:radial-gradient(120% 80% at 50% 0%,#3b1d6e 0%,#150c28 55%,#0a0714 100%)}
.karte{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:110px 90px;text-align:center;
  opacity:0}
.oben{font-size:44px;font-weight:500;color:#c9b6ff;letter-spacing:.02em;margin-bottom:26px}
.gross{font-size:104px;font-weight:700;line-height:1.05;
  background:linear-gradient(100deg,#ffffff,#e9d5ff 60%,#ff9ad5);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.unten{font-size:38px;font-weight:400;color:#b7a9d6;margin-top:38px;line-height:1.45;
  white-space:pre-line}
.nummer{position:absolute;top:150px;left:50%;transform:translateX(-50%);
  width:104px;height:104px;border-radius:50%;border:3px solid #7b5cff;
  display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:600}
.log{width:100%;background:#080512;border:2px solid #2a1f47;border-radius:26px;
  padding:44px 40px;text-align:left;font-family:ui-monospace,Menlo,monospace;
  font-size:31px;line-height:1.62;color:#cdbdf5;min-height:520px;white-space:pre-wrap}
.log .ok{color:#7ef0b2}
.platzhalter{width:100%;border:4px dashed #ff7ab8;border-radius:26px;
  padding:70px 44px;color:#ff9ad5;font-size:40px;font-weight:600;line-height:1.4}
.platzhalter small{display:block;margin-top:20px;font-size:29px;font-weight:400;color:#b7a9d6}
</style></head><body><div class="buehne" id="b"></div><script>
const D = ${daten};
const b = document.getElementById('b');

// Jede Szene wird EINMAL gebaut und dann nur ein- und ausgeblendet.
// Alles haengt allein am Frame-Index — kein setTimeout, keine CSS-Animation,
// sonst verrutschen die Frames und nichts ist reproduzierbar.
const karten = D.szenen.map((s) => {
  const d = document.createElement('div');
  d.className = 'karte';
  let innen = '';
  if (s.nummer) innen += '<div class="nummer">' + s.nummer + '</div>';
  if (s.oben) innen += '<div class="oben">' + s.oben + '</div>';
  innen += '<div class="gross">' + s.gross + '</div>';
  if (s.art === 'liste') {
    innen += '<div class="unten">' + s.punkte.join('\\n') + '</div>';
  } else if (s.art === 'protokoll') {
    innen += '<div class="log" data-log="1"></div>';
    innen += '<div class="unten">' + s.unten + '</div>';
  } else if (s.art === 'schritt') {
    innen += '<div class="unten">' + s.unten + '</div>';
    if (!s.clip) {
      innen += '<div class="platzhalter">' + s.clipHinweis
        + '<small>Diese Karte ist ein Platzhalter. Vor dem Einreichen durch die'
        + ' echte Aufnahme ersetzen.</small></div>';
    }
  } else if (s.unten) {
    innen += '<div class="unten">' + s.unten + '</div>';
  }
  d.innerHTML = innen;
  b.appendChild(d);
  return d;
});

const grenzen = [];
let summe = 0;
for (const s of D.szenen) { const von = summe; summe += Math.round(s.sek * D.fps); grenzen.push([von, summe]); }
window.__gesamt = summe;

window.setFrame = (n) => {
  karten.forEach((k, i) => {
    const [von, bis] = grenzen[i];
    const drin = n >= von && n < bis;
    // Weiche Blende an den Raendern, damit die Schnitte nicht hart wirken.
    let o = 0;
    if (drin) {
      const rel = n - von, laenge = bis - von, rand = Math.round(0.35 * D.fps);
      o = Math.min(1, rel / rand, (laenge - rel) / rand);
    }
    k.style.opacity = String(Math.max(0, o));

    const log = k.querySelector('[data-log]');
    if (log && drin) {
      // Zeilenweise aufbauen, damit man beim Zusehen mitliest.
      const rel = n - von, laenge = bis - von;
      const anteil = Math.min(1, rel / (laenge * 0.72));
      const zeilen = Math.ceil(anteil * D.protokoll.length);
      log.innerHTML = D.protokoll.slice(0, zeilen)
        .map((z) => z.includes('✓') ? '<span class="ok">' + z + '</span>' : z)
        .join('\\n');
    }
  });
};

document.fonts.ready.then(() => { window.setFrame(0); window.__bereit = true; });
</script></body></html>`;
}

// --- Lauf -------------------------------------------------------------------

mkdirSync(ZIEL_ORDNER, { recursive: true });
const geruest = join(ZIEL_ORDNER, 'tiktok-demo-geruest.mp4');

console.log(`Baue das Geruest (${SZENEN.reduce((s, x) => s + x.sek, 0)} s, ${BREITE}×${HOEHE}, ${FPS} fps) …`);

const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const ctx = await browser.newContext({ viewport: { width: BREITE, height: HOEHE }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(html(), { waitUntil: 'load' });
await page.waitForFunction('window.__bereit === true', null, { timeout: 20000 });

const gesamt = await page.evaluate('window.__gesamt');
const senke = videoSenke({ fps: FPS, ziel: geruest });

for (let n = 0; n < gesamt; n++) {
  await page.evaluate((i) => window.setFrame(i), n);
  const bild = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!senke.stdin.write(bild)) await new Promise((r) => senke.stdin.once('drain', r));
  if (n % 60 === 0) process.stdout.write(`\r   Frame ${n}/${gesamt}`);
}
senke.stdin.end();
await senke.fertig;
await browser.close();
console.log(`\r   ${gesamt} Frames · ${geruest}`);

if (CLIP1 && CLIP2) {
  // Die Clips liegen als Aufnahme vor; sie werden auf dasselbe Format
  // gebracht und dazwischengeschnitten. Ohne Angleichen weigert sich der
  // concat-Filter bei abweichender Groesse oder Bildrate.
  console.log('Setze die Aufnahmen ein …');
  for (const t of [geruest, resolve(CLIP1), resolve(CLIP2)]) {
    if (!existsSync(t)) { console.error(`✗ fehlt: ${t}`); process.exit(1); }
  }

  // Jede Aufnahme folgt auf IHRE Erklaerkarte, nicht davor und nicht
  // irgendwo: Erst sagt das Video, was gleich zu sehen ist, dann zeigt es
  // das Echte. Die Schnittpunkte sind deshalb das Ende der Karten 3 und 5
  // und ergeben sich aus SZENEN — nicht aus abgetippten Sekunden, die beim
  // naechsten Umbau still falsch waeren.
  const endeNach = (i) => SZENEN.slice(0, i + 1).reduce((s, x) => s + x.sek, 0);
  const nachKarte3 = endeNach(2);
  const nachKarte5 = endeNach(4);
  const gesamtSek = endeNach(SZENEN.length - 1);

  // ⚠ Die Aufnahmen kommen von zwei verschiedenen Geraeten und haben weder
  // das Format noch die Bildrate des Geruests (Mac quer, iPhone hochkant
  // und hoeher als 9:16). Passend gerechnet statt gestreckt: einpassen und
  // schwarz auffuellen. Ein verzerrtes TikTok-Fenster saehe in einer
  // Pruefung nach Bastelei aus.
  const anpassen = `scale=${BREITE}:${HOEHE}:force_original_aspect_ratio=decrease,`
    + `pad=${BREITE}:${HOEHE}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${FPS},format=yuv420p`;
  const kodieren = ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium',
    '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart'];

  const teilPfad = (n) => join(ZIEL_ORDNER, `teil-${n}.mp4`);

  // Fuenf Stuecke: Karten 1–3, Aufnahme 1, Karten 4–5, Aufnahme 2, Karte 6.
  const stuecke = [
    { name: 'a', quelle: geruest, von: 0, bis: nachKarte3 },
    { name: 'b', quelle: resolve(CLIP1), ...ZUSCHNITT.clip1 },
    { name: 'c', quelle: geruest, von: nachKarte3, bis: nachKarte5 },
    { name: 'd', quelle: resolve(CLIP2), ...ZUSCHNITT.clip2 },
    { name: 'e', quelle: geruest, von: nachKarte5, bis: gesamtSek },
  ];

  for (const s of stuecke) {
    const args = ['-y'];
    // ⚠ `-ss` VOR `-i`: Danach spult ffmpeg Bild fuer Bild und braucht bei
    // einer 60-fps-Aufnahme spuerbar laenger.
    if (s.von != null) args.push('-ss', String(s.von));
    // ⚠ Dauer (`-t`), nicht Endzeitpunkt (`-to`). Zusammen mit einem `-ss`
    // davor ist bei `-to` nicht eindeutig, worauf sich der Wert bezieht —
    // auf den Dateianfang oder auf die Sprungmarke. `-t` ist es immer.
    if (s.bis != null) args.push('-t', String(Number(s.bis) - Number(s.von ?? 0)));
    args.push('-i', s.quelle, '-an',
      '-vf', s.crop ? `crop=${s.crop},${anpassen}` : anpassen,
      ...kodieren, teilPfad(s.name));
    await lauf(args);
    console.log(`   ${s.name}: ${gemessen(teilPfad(s.name))}`);
  }

  // ⚠ Der concat-DEMUXER (nicht der Filter): Alle fuenf Stuecke sind eben
  // mit denselben Werten kodiert worden, also laesst sich ohne zweites
  // Umkodieren aneinanderhaengen — das spart einen Qualitaetsverlust.
  const liste = join(ZIEL_ORDNER, 'teile.txt');
  writeFileSync(liste, stuecke.map((s) => `file '${teilPfad(s.name)}'`).join('\n'));

  const ziel = join(ZIEL_ORDNER, 'tiktok-demo.mp4');
  await lauf(['-y', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy',
    '-movflags', '+faststart', ziel]);

  for (const s of stuecke) rmSync(teilPfad(s.name), { force: true });
  rmSync(liste, { force: true });

  // ⚠ Nachmessen statt melden. Ein „fertig" ohne Probe ist eine Behauptung.
  // ffmpeg-static bringt kein ffprobe mit, also wird die Laenge aus dem
  // Kopf der ffmpeg-Ausgabe gelesen — sie steht dort woertlich.
  console.log(`\n✓ ${ziel}`);
  console.log(`   ${gemessen(ziel)} · Geruest ${gesamtSek} s + zwei Aufnahmen, stumm`);
} else {
  console.log('\nOhne --clip1/--clip2: Die zwei TikTok-Szenen sind Platzhalter.');
  console.log('So ist das Video ansehbar, aber NICHT einreichbar.');
}
