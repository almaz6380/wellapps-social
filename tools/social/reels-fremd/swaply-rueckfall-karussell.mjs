// Swaply: „Kein Drama." — Karussell, 8 Folien à 1080×1350, Notizen-App-Look.
//
//   CHROMIUM_PFAD=… node tools/social/reels-fremd/swaply-rueckfall-karussell.mjs \
//     --app ../swaply --out /tmp/swaply-karussell/
//
// --- Warum (24.09.2026) ------------------------------------------------------
//
// Josef: „neuen post für alle plattformen mit neuen ideen/styles". Alle
// Swaply-Posts erklären den Tausch VOR dem Rückfall. Was die App NACH einem
// Rückfall sagt — sechs ruhige Tipps, je nach Auslöser
// (intervention.slipReasons + afterByReason in src/i18n/de.ts) — zeigt kein
// Post. Das ist der Moment, in dem sich Leute am ehesten wiedererkennen und
// ein Karussell speichern.
//
// Neuer Stil: heller Notizen-Look statt dunkler Markenfläche — jede Folie eine
// Notiz, wie man sie sich selbst schreiben würde.
//
// ⚠ Wortlaut 1:1 aus der App (src/i18n/de.ts), nichts dazugedichtet. Regeln
// (apps.json + ideen/swaply.json): keine Diagnose, keine Therapie-Versprechen,
// kein „endlich", kein „Schluss mit", kein Ausrufezeichen im Haupttext, kein
// Store-Link im Bild, ruhiger Ton ohne Schuld.

import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, '..', '..', '..');

export const B = 1080;
export const H = 1350;
// Die zwei einzigen Zeilen, die nicht aus der App kommen. Bewusst ohne
// „Rückfall" — das klingt nach Suchtbehandlung, die Swaply ausdrücklich nicht ist.
export const UNTER_TITEL = 'Was dir fürs nächste Mal hilft – je nach Auslöser.';
export const UNTER_SCHLUSS = 'Swaply tauscht die Routine – Auslöser und Belohnung bleiben.';
const REIHENFOLGE = ['stress', 'boredom', 'habit', 'tired', 'social', 'frustration'];
const EMOJI = { stress: '🌀', boredom: '🫠', habit: '🔁', tired: '🌙', social: '👥', frustration: '🌋' };

/**
 * Liest die Texte aus src/i18n/de.ts. Die Datei ist TypeScript mit
 * Funktionswerten, also kein JSON — geschnitten wird deshalb gezielt:
 * einfache '…'-Zeichenketten unter den bekannten Schlüsseln.
 */
export function texteAusApp(appPfad) {
  const ts = readFileSync(join(appPfad, 'src', 'i18n', 'de.ts'), 'utf8');
  const block = (name) => {
    const i = ts.indexOf(`${name}: {`);
    if (i === -1) throw new Error(`Block ${name} fehlt in de.ts`);
    let tiefe = 0;
    for (let j = ts.indexOf('{', i); j < ts.length; j++) {
      if (ts[j] === '{') tiefe++;
      if (ts[j] === '}' && --tiefe === 0) return ts.slice(i, j + 1);
    }
    throw new Error(`Block ${name} nicht geschlossen`);
  };
  const wert = (quelle, schluessel) => {
    const m = quelle.match(new RegExp(`\\b${schluessel}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
    if (!m) throw new Error(`Text ${schluessel} fehlt`);
    return m[1].replace(/\\'/g, "'");
  };
  const intervention = block('intervention');
  const gruende = block('slipReasons');
  const tipps = block('afterByReason');
  const erklaerer = block('explainer');
  return {
    frage: wert(intervention, 'reasonQuestion'),
    afterTitle: wert(intervention, 'afterTitle'),
    gruende: REIHENFOLGE.map((k) => ({ k, name: wert(gruende, k), tipp: wert(tipps, k), emoji: EMOJI[k] })),
    schluss1: wert(erklaerer, 'titleLine1'),
    schluss2: wert(erklaerer, 'titleLine2'),
  };
}

/** Prüft die Swaply-Textregeln — ein Treffer bricht ab, statt den Post zu bauen. */
export function regelnPruefen(t) {
  const alle = [t.frage, t.afterTitle, t.schluss1, t.schluss2, UNTER_TITEL, UNTER_SCHLUSS,
    ...t.gruende.flatMap((g) => [g.name, g.tipp])];
  const verboten = [/\bendlich\b/i, /schluss mit/i, /!/, /rückfall/i, /sucht/i, /therapie/i];
  const treffer = alle.filter((x) => verboten.some((r) => r.test(x)));
  if (treffer.length) throw new Error(`Swaply-Textregel verletzt: ${treffer.join(' | ')}`);
}

function seite({ inhalt, nr, gesamt, schriften, logo }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fredoka;src:url(data:font/woff2;base64,${schriften.fredoka}) format('woff2');font-weight:300 700}
@font-face{font-family:Nunito;src:url(data:font/woff2;base64,${schriften.nunito}) format('woff2');font-weight:200 1000}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden}
body{background:linear-gradient(135deg,#4f8cfe 0%,#46adc6 52%,#40c79c 100%);font-family:Nunito,sans-serif;color:#1f2a2e}
.notiz{position:absolute;left:70px;right:70px;top:80px;bottom:120px;border-radius:40px;background:#fffdf7;
  box-shadow:0 30px 80px rgba(6,23,28,.28);overflow:hidden}
.linien{position:absolute;inset:210px 0 0 0;background:repeating-linear-gradient(#fffdf7 0 67px,#e8eef0 67px 69px)}
.leiste{position:absolute;left:0;right:0;top:0;height:120px;display:flex;align-items:center;justify-content:space-between;
  padding:0 56px;border-bottom:2px solid #eef2f3}
.leiste .l{display:flex;gap:16px;align-items:center;font-family:Fredoka;font-weight:600;font-size:34px;color:#06171c}
.leiste img{width:56px;height:56px;border-radius:14px}
.leiste .r{font-size:28px;color:#8aa3a8;font-weight:700}
.inhalt{position:absolute;left:70px;right:70px;top:170px;bottom:60px;display:flex;flex-direction:column}
.chip{align-self:flex-start;display:inline-flex;gap:12px;align-items:center;padding:12px 28px;border-radius:999px;
  background:#e6f6f2;color:#0f5c4a;font-family:Fredoka;font-weight:600;font-size:38px}
.klein{margin-top:44px;font-size:34px;font-weight:800;color:#46adc6;letter-spacing:.02em}
.tipp{margin-top:18px;font-family:Fredoka;font-weight:500;font-size:60px;line-height:1.28;color:#06171c}
.titel{margin-top:60px;font-family:Fredoka;font-weight:600;font-size:118px;line-height:1.02;color:#06171c}
.titel em{font-style:normal;background:linear-gradient(135deg,#4f8cfe,#40c79c);-webkit-background-clip:text;color:transparent}
.unter{margin-top:48px;font-size:44px;font-weight:700;color:#4b6166;line-height:1.35}
.liste{margin-top:54px;display:flex;flex-wrap:wrap;gap:16px}
.liste span{padding:10px 24px;border-radius:999px;background:#f0f5f6;font-size:34px;font-weight:800;color:#35505a}
.pfeil{position:absolute;right:56px;bottom:40px;font-family:Fredoka;font-weight:600;font-size:36px;color:#46adc6}
.fuss{position:absolute;left:0;right:0;bottom:36px;text-align:center;font-family:Fredoka;font-weight:600;font-size:34px;color:#06171c}
</style></head><body>
<div class="notiz"><div class="linien"></div>
<div class="leiste"><span class="l"><img src="${logo}">Swaply · Notiz</span><span class="r">${nr} / ${gesamt}</span></div>
<div class="inhalt">${inhalt}</div></div>
</body></html>`;
}

export async function karussell({ appPfad, ordner, storeSatz = 'Gratis im App Store und bei Google Play' }) {
  const t = texteAusApp(appPfad);
  regelnPruefen(t);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const schriften = {
    fredoka: readFileSync(join(appPfad, 'src', 'fonts', 'fredoka-latin.woff2')).toString('base64'),
    nunito: readFileSync(join(appPfad, 'src', 'fonts', 'nunito-latin.woff2')).toString('base64'),
  };
  const logo = `data:image/png;base64,${readFileSync(join(appPfad, 'landing', 'icon.png')).toString('base64')}`;
  // Titelfolie: „Kein Drama. Was war der Auslöser?" — der Satz der App.
  const [kurz, rest] = t.frage.split(/(?<=\.)\s+/);
  const folien = [
    `<div class="titel">${esc(kurz)}<br><em>${esc(rest ?? '')}</em></div>
     <div class="unter">${esc(UNTER_TITEL)}</div>
     <div class="liste">${t.gruende.map((g) => `<span>${g.emoji} ${esc(g.name)}</span>`).join('')}</div>
     <div class="pfeil">wischen →</div>`,
    ...t.gruende.map((g) => `<span class="chip">${g.emoji} ${esc(g.name)}</span>
     <div class="klein">${esc(t.afterTitle)}</div>
     <div class="tipp">${esc(g.tipp)}</div>`),
    `<div class="titel">${esc(t.schluss1)}<br><em>${esc(t.schluss2)}</em></div>
     <div class="unter">${esc(UNTER_SCHLUSS)}</div>
     <div class="fuss">${esc(storeSatz)}</div>`,
  ];
  mkdirSync(ordner, { recursive: true });
  const dateien = [];
  const browser = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
  try {
    const p = await browser.newPage({ viewport: { width: B, height: H } });
    for (const [i, inhalt] of folien.entries()) {
      await p.setContent(seite({ inhalt, nr: i + 1, gesamt: folien.length, schriften, logo }), { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      // Nichts darf aus der Notiz laufen — sonst ist ein Tipp zu lang.
      const zuLang = await p.evaluate(() => {
        const n = document.querySelector('.inhalt');
        return n.scrollHeight > n.clientHeight + 2;
      });
      if (zuLang) throw new Error(`Folie ${i + 1}: Text läuft über die Notiz.`);
      const datei = join(ordner, `${String(i + 1).padStart(2, '0')}.jpg`);
      await p.screenshot({ path: datei, type: 'jpeg', quality: 93 });
      dateien.push(datei);
    }
  } finally {
    await browser.close();
  }
  return { dateien, texte: t };
}

// --- Aufruf (Tageslauf: motoren.mjs) -----------------------------------------
//
//   --app <repo> --seed N --name <dateiname> --out <ordner> [--store <satz>]
//
// Schreibt <ordner>/<dateiname>-1.jpg … -8.jpg (Karussell) und <ordner>/<dateiname>.txt (Beiblatt).
// ⚠ --out ist ein ORDNER und muss absolut sein — motoren.mjs übergibt ihn so.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { writeFileSync, renameSync } = await import('node:fs');
  const arg = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
  const app = resolve(arg('app', join(WURZEL, '..', 'swaply')));
  if (!existsSync(app)) throw new Error(`Swaply-Repo fehlt: ${app}`);
  const seed = Number(arg('seed', 1));
  const name = arg('name', `swaply-kein-drama-de-s${seed}`);
  const ordner = resolve(arg('out', '.'));
  const r = await karussell({ appPfad: app, ordner: join(ordner, `.${name}`), storeSatz: arg('store', 'Gratis im App Store und bei Google Play') });
  // ⚠ Karussell-Konvention des Tageslaufs (folien.mjs): <stamm>-1.jpg … -N.jpg,
  // KEIN <stamm>.jpg. posten.mjs erkennt das Karussell genau daran.
  r.dateien.forEach((d, i) => renameSync(d, join(ordner, `${name}-${i + 1}.jpg`)));
  rmSync(join(ordner, `.${name}`), { recursive: true, force: true });
  writeFileSync(join(ordner, `${name}.txt`), [
    name, '='.repeat(name.length), '',
    `Marke: Swaply   Format: kein-drama   Sprache: DE   Folien: ${r.dateien.length}   Seed: ${seed}`,
    '',
    '── CAPTION ZUM KOPIEREN ──────────────────────────────',
    '',
    `${r.texte.frage} 🌀`,
    '',
    'Stress, Langeweile, Gewohnheit, müde, sozialer Druck oder Frust – je nach Auslöser hilft etwas anderes. Wisch dich durch und speicher dir deinen.',
    '',
    'Welcher Auslöser erwischt dich am häufigsten? 👇',
    '',
    '#swaply #gewohnheiten #routine #selfcare #tauschstattverzicht',
    '',
    '── VOR DEM POSTEN ────────────────────────────────────',
    '',
    '- Karussell, 8 Folien. Wortlaut der Tipps 1:1 aus src/i18n/de.ts.',
    '- Medienherkunft: typografie',
    '',
  ].join('\n'));
  console.log(`✓ ${r.dateien.length} Folien: ${name}-1.jpg … -${r.dateien.length}.jpg in ${ordner}`);
}
