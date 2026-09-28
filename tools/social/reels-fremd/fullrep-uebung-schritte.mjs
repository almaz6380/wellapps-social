// FullRep: „So geht's richtig" als BILD — eine Übung, gezeigt an der
// lizenzierten 3D-Animation, dazu vier Ausführungsschritte. 1080×1350.
//
//   CHROMIUM_PFAD=… node tools/social/reels-fremd/fullrep-uebung-schritte.mjs \
//     --app ../mypeak --seed 3 --name probe --out /tmp/x [--uebung hip-thrust]
//
// --- Warum (28.09.2026) ------------------------------------------------------
//
// Josef: „deine fullrep posts sind größtenteils müll.. du schreibst da
// irgendwelche stichwörter hin und das sieht billig aus. mach lieber posts,
// wo übungen gezeigt werden." Das Reel (fullrep-uebung-bewegt.mjs) zeigt die
// Übung in Bewegung; diese Karte ist dieselbe Übung als Bildbeitrag, damit
// beide Tagesplätze Übungen zeigen. Zwei Standbilder aus der Animation —
// Start- und Endstellung — nebeneinander, darunter die Schritte.
//
// Texte: Name, Muskel, Gerät aus der App; Schritte aus uebung-technik.json.
// Keine KI, keine echte Person: Die Figur ist die gesichtslose 3D-Puppe aus
// dem Paket von Vital Animations (Lizenz erlaubt Social Media, Beleg in
// mypeak/store-assets/lizenzen/vital-animations/).

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { spawnSync } from 'node:child_process';
import { lauf, FFMPEG } from '../../reels/encode.mjs';
import { animierteUebungen, TECHNIK } from './fullrep-uebung-bewegt.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..');
const SCHRIFTEN = join(WURZEL, 'tools', 'reels', 'assets', 'schriften');
const B = 1080, H = 1350;

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

const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const app = resolve(arg('app', join(WURZEL, '..', 'mypeak')));
const seed = Number(arg('seed', 1));
const name = arg('name', `fullrep-uebung-schritte-de-s${seed}`);
const ordner = resolve(arg('out', '.'));
mkdirSync(ordner, { recursive: true });

// Nur Übungen MIT Schritten — ohne sie gäbe es nichts zu erklären.
const liste = (await animierteUebungen(app)).filter((x) => TECHNIK[x.id]);
if (!liste.length) throw new Error('Keine animierte Übung mit Ausführungsschritten gefunden.');
const wunsch = arg('uebung', null);
const u = wunsch ? liste.find((x) => x.id === wunsch) : liste[Math.floor(zufall(seed * 2654435761)() * liste.length)];
if (!u) throw new Error(`Übung ${wunsch} hat keine Animation oder keine Schritte.`);
const schritte = TECHNIK[u.id];

const tmp = join(tmpdir(), `fullrep-schritte-${process.pid}`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
try {
  // Start- und Umkehrpunkt der Bewegung. ⚠ Der Umkehrpunkt liegt nicht in
  // jedem Clip an derselben Stelle (Hip Thrust und Reverse Fly zeigten bei
  // fest 2,4 s zweimal fast dasselbe Bild). Deshalb gemessen: 24 Bilder in
  // 64×64 Graustufen, genommen wird das, das am staerksten vom ersten abweicht.
  const quelle = join(app, 'public', 'exercise-demos-anim', u.ordner, 'demo.mp4');
  const roh = spawnSync(FFMPEG, ['-v', 'error', '-i', quelle, '-vf', 'fps=24/5,scale=64:64,format=gray',
    '-frames:v', '24', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 }).stdout;
  const n = Math.floor(roh.length / 4096);
  let best = 0, bestT = 2.4;
  for (let k = 1; k < n; k++) {
    let d = 0;
    for (let i = 0; i < 4096; i++) d += Math.abs(roh[k * 4096 + i] - roh[i]);
    if (d > best) { best = d; bestT = (k + 0.5) * 5 / 24; }
  }
  for (const [datei, t] of [['a.jpg', '0.05'], ['b.jpg', bestT.toFixed(2)]]) {
    await lauf(['-y', '-ss', t, '-i', quelle, '-frames:v', '1', '-vf', 'scale=640:640:flags=lanczos', '-q:v', '2', join(tmp, datei)]);
  }
  const b64 = (d) => readFileSync(d).toString('base64');
  const bild = (d) => `data:image/jpeg;base64,${b64(d)}`;
  const font = (n, datei, g) => `@font-face{font-family:'${n}';src:url(data:font/woff2;base64,${b64(datei)}) format('woff2');font-weight:${g}}`;
  const logo = `data:image/png;base64,${b64(join(app, 'public', 'icon-512.png'))}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${font('Anton', join(app, 'scripts', 'schriften', 'anton.woff2'), 400)}
${font('Inter', join(SCHRIFTEN, 'inter-latin-400-normal.woff2'), 400)}
${font('Inter', join(SCHRIFTEN, 'inter-latin-600-normal.woff2'), 600)}
${font('Inter', join(SCHRIFTEN, 'inter-latin-900-normal.woff2'), 900)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden;background:#0a0a0a;color:#fff8e7;font-family:Inter,sans-serif}
.schein{position:absolute;left:50%;top:520px;width:1200px;height:1000px;margin-left:-600px;margin-top:-500px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(251,191,36,.18),rgba(251,191,36,0))}
.kopf{position:absolute;top:64px;left:72px;right:72px}
.etikett{display:flex;gap:14px;align-items:center;font-size:26px;font-weight:600;letter-spacing:.18em;color:#fbbf24}
.etikett img{width:46px;height:46px;border-radius:10px}
.name{margin-top:14px;font-family:Anton,sans-serif;font-size:96px;line-height:.95;text-transform:uppercase}
.chips{margin-top:18px;display:flex;gap:12px}
.chip{padding:10px 22px;border-radius:999px;background:#1a1a1a;border:2px solid #3f3f46;font-size:26px;font-weight:600;color:#e7e5e4}
.chip.g{background:#fbbf24;border-color:#fbbf24;color:#0a0a0a}
.bilder{position:absolute;left:72px;right:72px;top:400px;display:flex;gap:20px}
.bilder figure{flex:1;height:520px;border-radius:32px;overflow:hidden;background:#fff;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.bilder img{position:absolute;left:50%;top:50%;width:520px;height:520px;margin:-260px 0 0 -260px}
.bilder figcaption{position:absolute;left:14px;top:14px;padding:6px 14px;border-radius:999px;background:#0a0a0a;color:#fbbf24;font-size:20px;font-weight:600}
.schritte{position:absolute;left:72px;right:72px;bottom:120px;display:flex;flex-direction:column;gap:18px}
.s{display:flex;gap:20px;align-items:center;font-size:34px;font-weight:600;color:#e7e5e4;line-height:1.2}
.s b{flex:none;width:54px;height:54px;border-radius:50%;background:#fbbf24;color:#0a0a0a;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900}
.fuss{position:absolute;left:72px;right:72px;bottom:48px;font-size:24px;color:#a8a29e}
</style></head><body>
<div class="schein"></div>
<div class="kopf" id="kopf"><div class="etikett"><img src="${logo}">SO GEHT’S RICHTIG</div>
  <div class="name">${esc(u.name)}</div>
  <div class="chips"><span class="chip g">${esc(u.muskel)}</span><span class="chip">${esc(u.geraet)}</span></div></div>
<div class="bilder" id="bilder"><figure><img src="${bild(join(tmp, 'a.jpg'))}"><figcaption>Start</figcaption></figure>
  <figure><img src="${bild(join(tmp, 'b.jpg'))}"><figcaption>Endposition</figcaption></figure></div>
<div class="schritte">${schritte.map((s, i) => `<div class="s"><b>${i + 1}</b><span>${esc(s)}</span></div>`).join('')}</div>
<div class="fuss">Alle Übungen mit Animation und Anleitung in FullRep</div>
<script>
// Bilder direkt unter den Kopf setzen — ein zweizeiliger Name schiebt sie nach unten.
document.fonts.ready.then(() => {
  const k = document.getElementById('kopf').getBoundingClientRect();
  document.getElementById('bilder').style.top = (k.bottom + 30) + 'px';
  window.__bereit = true;
});
</script></body></html>`;
  writeFileSync(join(tmp, 'karte.html'), html);

  const browser = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
  try {
    const seite = await browser.newPage({ viewport: { width: B, height: H } });
    await seite.goto(pathToFileURL(join(tmp, 'karte.html')).href, { waitUntil: 'load' });
    await seite.waitForFunction('window.__bereit === true', null, { timeout: 20000 });
    // ⚠ Laufen Bilder und Schritte ineinander (langer Name), lieber abbrechen
    // als eine verklebte Karte posten.
    const ueberlapp = await seite.evaluate(() => {
      const b = document.getElementById('bilder').getBoundingClientRect();
      const s = document.querySelector('.schritte').getBoundingClientRect();
      return b.bottom > s.top - 10;
    });
    if (ueberlapp) throw new Error(`Karte für ${u.name}: Bilder und Schritte überlappen.`);
    writeFileSync(join(ordner, `${name}.jpg`), await seite.screenshot({ type: 'jpeg', quality: 92 }));
  } finally {
    await browser.close();
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

writeFileSync(join(ordner, `${name}.txt`), [
  name, '='.repeat(name.length), '',
  `Marke: FullRep   Format: uebung-schritte   Sprache: DE   Seed: ${seed}`,
  '',
  '── CAPTION ZUM KOPIEREN ──────────────────────────────',
  '',
  `${u.name} – so geht's richtig 🏋️`,
  '',
  ...schritte.map((x, i) => `${i + 1}. ${x}`),
  '',
  `Muskelgruppe: ${u.muskel} · Gerät: ${u.geraet}`,
  '',
  'Alle Übungen mit Animation und Anleitung in FullRep.',
  '',
  '#fullrep #krafttraining #muskelaufbau #training #fitness',
  '',
  '── VOR DEM POSTEN ────────────────────────────────────',
  '',
  '- Medienherkunft: lizenzierte-animation (Vital Animations, 3D-Figur; Beleg in mypeak/store-assets/lizenzen/vital-animations/)',
  '',
].join('\n'));
console.log(`✓ ${join(ordner, `${name}.jpg`)}  ${u.name} (${u.muskel} · ${u.geraet})`);
