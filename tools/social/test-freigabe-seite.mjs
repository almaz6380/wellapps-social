// Prueft die Freigabe-Seite im echten Browser, gegen eine nachgebildete API.
//
// Die Frage, um die es geht: Sagt die Seite nach einem erfolglosen Versuch,
// dass er erfolglos war? Am 19.09. tat sie es nicht — der Knopf blieb auf
// „Läuft" stehen, und vier Beitraege waren draussen, ohne dass es jemand sah.
//
//   CHROMIUM_PFAD=/opt/pw-browsers/chromium node tools/social/test-freigabe-seite.mjs
//
// Braucht playwright (npm i --no-save playwright). Startet den Server selbst
// und beantwortet /api/freigabe aus einer Attrappe — es geht nichts ins Netz
// und nichts in einen Kanal.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HIER = dirname(fileURLToPath(import.meta.url));
const SEITE = join(HIER, '..', '..', 'freigabe-app', 'index.html');

// Ein Server nur fuer diesen Lauf. file:// ginge nicht: Dort verweigert
// Chromium sessionStorage, und genau darauf beruht die Warnung.
const server = createServer((_, antwort) => {
  antwort.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  antwort.end(readFileSync(SEITE));
}).listen(0, '127.0.0.1');
await new Promise((f) => server.once('listening', f));
const ORT = `http://127.0.0.1:${server.address().port}`;
const DATUM = '2026-09-19';

const LISTE = {
  app: 'swaply',
  name: 'Swaply',
  datum: DATUM,
  eintraege: [{ datei: 'a.jpg', url: 'x', text: 'Text A' }],   // Instagram offen
  uebersicht: [
    {
      datei: 'a.jpg', url: 'x', text: 'Text A', istVideo: false,
      kanaele: { facebook: { stand: 'wartet' }, instagram: { stand: 'wartet' } },
    },
    {
      datei: 'b.jpg', url: 'x', text: 'Text B', istVideo: false,
      kanaele: { facebook: { stand: 'veroeffentlicht', id: '1' } },
    },
  ],
};

let gut = 0; const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const seite = await browser.newPage();

// Die Serverfunktion nachbilden — es geht nichts ins Netz.
await seite.route('**/api/freigabe', async (route) => {
  const körper = JSON.parse(route.request().postData() ?? '{}');
  if (körper.aktion === 'liste') {
    return route.fulfill({ json: { listen: [LISTE], datum: DATUM } });
  }
  // facebook / veroeffentlichen: so tun, als sei der Lauf gestartet
  return route.fulfill({ json: { ok: true } });
});

await seite.goto(ORT, { waitUntil: 'load' });
await seite.evaluate((d) => {
  localStorage.setItem('wellapps.freigabe.pw', 'x');
  const feld = document.querySelector('#datum');
  if (feld) feld.value = d;
}, DATUM);
await seite.reload({ waitUntil: 'load' });
await seite.waitForTimeout(600);

// --- 1. Ohne Vermerk: keine Warnung -----------------------------------------
let text = await seite.locator('body').innerText();
pruefe('ohne Vermerk keine Warnung', !text.includes('hat nichts geändert'),
  text.split('\n').filter((z) => z.includes('geändert')).join(' | ') || '(nichts)');
pruefe('beide Knöpfe da',
  text.includes('Auf Facebook veröffentlichen') && text.includes('Auf Instagram veröffentlichen'),
  text.slice(0, 300).replace(/\n/g, ' · '));

// --- 2. Alter Vermerk → Warnung ---------------------------------------------
await seite.evaluate((d) => {
  const alt = Date.now() - 5 * 60000;   // fuenf Minuten her
  sessionStorage.setItem(`freigabe.versuch.facebook.${d}.a.jpg`, String(alt));
  sessionStorage.setItem(`freigabe.versuch.instagram.${d}.a.jpg`, String(alt));
}, DATUM);
await seite.reload({ waitUntil: 'load' });
await seite.waitForTimeout(600);
text = await seite.locator('body').innerText();
const warnungen = text.split('\n').filter((z) => z.includes('hat nichts geändert'));
pruefe('alter Vermerk → zwei Warnungen', warnungen.length === 2,
  `${warnungen.length}: ${warnungen.join(' | ')}`);
pruefe('Warnung nennt den Kanal',
  warnungen.some((z) => z.includes('Facebook')) && warnungen.some((z) => z.includes('Instagram')),
  warnungen.join(' | '));

// --- 3. Frischer Vermerk → KEINE Warnung ------------------------------------
//
// Wer zwei Sekunden nach dem Tippen neu laedt, hat keinen Fehler gesehen,
// sondern einen laufenden Lauf.
await seite.evaluate((d) => {
  sessionStorage.clear();
  sessionStorage.setItem(`freigabe.versuch.facebook.${d}.a.jpg`, String(Date.now()));
}, DATUM);
await seite.reload({ waitUntil: 'load' });
await seite.waitForTimeout(600);
text = await seite.locator('body').innerText();
pruefe('frischer Vermerk → keine Warnung', !text.includes('hat nichts geändert'),
  text.split('\n').filter((z) => z.includes('geändert')).join(' | ') || '(nichts)');

// --- 4. Veroeffentlichter Beitrag: Vermerk wird geloescht -------------------
await seite.evaluate((d) => {
  sessionStorage.clear();
  sessionStorage.setItem(`freigabe.versuch.facebook.${d}.b.jpg`, String(Date.now() - 5 * 60000));
}, DATUM);
await seite.reload({ waitUntil: 'load' });
await seite.waitForTimeout(600);
const nochDa = await seite.evaluate((d) => sessionStorage.getItem(`freigabe.versuch.facebook.${d}.b.jpg`), DATUM);
pruefe('Vermerk eines geglückten Beitrags wird vergessen', nochDa === null, String(nochDa));
text = await seite.locator('body').innerText();
pruefe('und keine Warnung dazu', !text.includes('hat nichts geändert'),
  text.split('\n').filter((z) => z.includes('geändert')).join(' | ') || '(nichts)');

// --- 5. Der Knopf löst aus und plant das Nachladen --------------------------
await seite.evaluate(() => sessionStorage.clear());
await seite.reload({ waitUntil: 'load' });
await seite.waitForTimeout(600);
// ⚠ Das eigentlich Neue ist das Nachladen — und das laesst sich nicht
// abwarten (eine Minute). Also mitschreiben, welche Fristen gesetzt werden.
// Ohne diesen Fall pruefte der Test nur die Beschriftung, und genau die war
// vorher ja auch da: „Läuft — dauert etwa eine Minute", und dann nichts.
await seite.evaluate(() => {
  window.__fristen = [];
  const echt = window.setTimeout;
  window.setTimeout = (fn, ms, ...rest) => { window.__fristen.push(ms); return echt(fn, ms, ...rest); };
});
const fb = seite.getByRole('button', { name: 'Auf Facebook veröffentlichen' });
await fb.waitFor({ state: 'visible' });
await fb.click();                                   // erster Tipper: „Wirklich?"
await seite.waitForTimeout(200);
// ⚠ Nach dem Tippen aendert sich die Beschriftung, also traegt der alte
// Locator nicht mehr. Der Knopf bleibt derselbe — nur sein Name nicht.
const fb2 = seite.getByRole('button', { name: /Wirklich/ });
pruefe('erster Tipper fragt nach', await fb2.isVisible(),
  (await seite.locator('.reihe').first().innerText()).replace(/\n/g, ' · '));
await fb2.click();                                  // zweiter Tipper: los
await seite.waitForTimeout(400);
const beschriftung = (await seite.locator('body').innerText())
  .split('\n').find((z) => /Ergebnis in etwa|Läuft|Fehler:/.test(z)) ?? '(keine solche Zeile)';
pruefe('zweiter Tipper löst aus', beschriftung.includes('Ergebnis in etwa einer Minute'), beschriftung);
const vermerkt = await seite.evaluate((d) => sessionStorage.getItem(`freigabe.versuch.facebook.${d}.a.jpg`), DATUM);
pruefe('Versuch ist vermerkt', vermerkt !== null, String(vermerkt));

const fristen = await seite.evaluate(() => window.__fristen);
pruefe('das Nachladen ist geplant', fristen.includes(60000), `Fristen: ${fristen.join(', ') || '(keine)'}`);

await browser.close();
server.close();

console.log(`\nFreigabe-Seite: ${gut} von ${gut + schlecht.length} Faellen gruen.`);
if (schlecht.length) {
  console.error('\n✗ Fehlgeschlagen:');
  for (const z of schlecht) console.error(`   • ${z}`);
  process.exit(1);
}
