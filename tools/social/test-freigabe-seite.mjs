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
// ⚠ Der Server muss mehr als die Seite ausliefern, seit das Archiv
// Vorschaubilder zeigt. Gaebe er auf JEDEN Pfad HTML zurueck, schluege auch
// das GUELTIGE Bild fehl — der Browser kann HTML nicht als Bild dekodieren,
// `onerror` feuerte, und die Probe „zeigt es das Bild" waere gruen, ohne je
// etwas gemessen zu haben. Genau die Sorte Probe, die nichts wert ist.
//
// Deshalb: /bild.jpg liefert ein echtes (1×1) PNG, alles andere mit
// Bild-Endung eine 404 — das stellt ein aufgeraeumtes Blob nach.
const EIN_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const server = createServer((anfrage, antwort) => {
  const pfad = (anfrage.url ?? '/').split('?')[0];
  if (pfad === '/bild.jpg') {
    antwort.writeHead(200, { 'Content-Type': 'image/png' });
    return antwort.end(EIN_PIXEL);
  }
  if (/\.(jpg|jpeg|png|mp4)$/.test(pfad)) {
    antwort.writeHead(404);
    return antwort.end();
  }
  antwort.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return antwort.end(readFileSync(SEITE));
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
      // Sprechtext (23.09.2026): nur zum Einsprechen, eigener Kasten. Am
      // OFFENEN Beitrag — b ist erledigt und steht eingeklappt.
      sprechtext: 'Satz eins. | Satz zwei.',
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
  // ⚠ Das Archiv („Gepostet") — mit und OHNE Bild.
  //
  // Josef am 21.09.2026: „Wieso wird das nur so angezeigt?" Die Ansicht zeigte
  // bis dahin reinen Text; die Bildadresse wurde nie durchgereicht.
  //
  // Der Haken dabei: Sie ist nicht verlaesslich. `freigeben.mjs` raeumt die
  // Datei nach dem Veroeffentlichen aus dem Blob — aber nur, wenn kein Kanal
  // sie mehr braucht. Deshalb hat ein Beitrag mal ein Bild und mal keines,
  // und BEIDES ist richtig. Die Attrappe deckt daher drei Faelle ab:
  // gueltige Adresse, tote Adresse (aufgeraeumt), gar keine Adresse.
  if (körper.aktion === 'archiv') {
    return route.fulfill({ json: {
      von: '2026-09-01', bis: DATUM,
      beitraege: [
        { datum: DATUM, app: 'swaply', name: 'Swaply', datei: 'mit-bild.jpg',
          text: 'Beitrag mit Bild', istVideo: false,
          url: `${ORT}/bild.jpg`,
          kanaele: [{ kanal: 'facebook', stand: 'veroeffentlicht' }] },
        { datum: DATUM, app: 'swaply', name: 'Swaply', datei: 'aufgeraeumt.jpg',
          text: 'Bild ist schon weg', istVideo: false,
          url: `${ORT}/gibtsnicht.jpg`,
          kanaele: [{ kanal: 'instagram', stand: 'veroeffentlicht' }] },
        { datum: DATUM, app: 'swaply', name: 'Swaply', datei: 'clip.mp4',
          text: 'Ein Reel', istVideo: true, url: null,
          kanaele: [{ kanal: 'facebook', stand: 'veroeffentlicht' }] },
      ],
    } });
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

// --- 2b. Sprechtext: eigener Kasten, nur wo einer da ist --------------------
//
// ⚠ Er darf nicht im Text-Kasten stehen und nicht mit „Text kopieren"
// mitkommen — sonst landet ein Vorlesetext in der Beschreibung.
await seite.evaluate(() => sessionStorage.clear());
await seite.reload({ waitUntil: 'load' });
await seite.waitForTimeout(600);
const sprechKaesten = await seite.locator('.sprech').count();
pruefe('Sprechtext-Kasten genau einmal (nur Beitrag a)', sprechKaesten === 1, String(sprechKaesten));
const sprechKnoepfe = await seite.getByRole('button', { name: 'Sprechtext kopieren' }).count();
pruefe('„Sprechtext kopieren" genau einmal', sprechKnoepfe === 1, String(sprechKnoepfe));
const textKaesten = await seite.locator('.text').allInnerTexts();
pruefe('⚠ Sprechtext steht in keinem Text-Kasten', !textKaesten.some((t) => t.includes('Satz eins')),
  textKaesten.join(' | '));

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

// --- Das Archiv: zeigt es die Bilder, und vertraegt es die fehlenden? -------
await seite.click('#archiv-an');
await seite.waitForFunction(() => document.body.innerText.includes('Gepostet'));
// Dem Browser Zeit geben, die tote Adresse abzulehnen — `onerror` kommt
// asynchron, und ohne diese Pause misst die Probe den Zustand davor.
await seite.waitForTimeout(600);

const bilder = await seite.$$eval('#liste img', (xs) => xs.map((x) => x.getAttribute('src')));
pruefe('Archiv zeigt das Bild, wo es noch eines gibt',
  bilder.some((s) => (s ?? '').endsWith('/bild.jpg')), bilder.join(', ') || '(keine)');

// ⚠ DIE WICHTIGSTE PROBE. Ein aufgeraeumtes Bild ist kein Fehler, sondern der
// Normalfall fuer einen fertig veroeffentlichten Beitrag. Es darf kein
// kaputtes Bildsymbol stehenbleiben.
pruefe('eine tote Adresse hinterlaesst KEIN kaputtes Bildsymbol',
  !bilder.some((s) => (s ?? '').includes('gibtsnicht')), bilder.join(', ') || '(keine)');

pruefe('ein Reel bekommt gar kein Vorschaubild',
  bilder.length === 1, `${bilder.length} Bild(er): ${bilder.join(', ')}`);

const archivText = await seite.innerText('#liste');
pruefe('alle drei Beitraege stehen trotzdem in der Liste',
  ['Beitrag mit Bild', 'Bild ist schon weg', 'Ein Reel'].every((s) => archivText.includes(s)),
  archivText.slice(0, 120));

// --- Der Pruefmodus (23.09.2026) ---------------------------------------------
//
// TikToks Pruefer bekommt ein eigenes Passwort. Der Server startet damit
// keinen Lauf und sagt `pruefmodus: true`. Die Seite muss das SAGEN — nicht
// „Läuft" anzeigen und eine Minute spaeter „hat nichts geändert".
{
  const pruef = await browser.newPage();
  await pruef.route('**/api/freigabe', async (route) => {
    const körper = JSON.parse(route.request().postData() ?? '{}');
    if (körper.aktion === 'liste') {
      return route.fulfill({ json: { listen: [LISTE], datum: DATUM, pruefmodus: true } });
    }
    return route.fulfill({ json: { gestartet: false, pruefmodus: true } });
  });
  await pruef.goto(ORT, { waitUntil: 'load' });

  // Vor der Anmeldung: Logo, Favicon und der englische Absatz fuer den Pruefer.
  const kopf = await pruef.evaluate(() => ({
    icons: [...document.querySelectorAll('link[rel~=icon]')].map((l) => l.getAttribute('href')),
    logo: document.querySelector('.seitenkopf img')?.getAttribute('src'),
    titel: document.title,
    worum: !document.querySelector('#worum').hidden,
    band: !document.querySelector('#pruefband').hidden,
  }));
  pruefe('Favicon ist eingetragen', kopf.icons.includes('/favicon.ico'), kopf.icons.join(', '));
  pruefe('Logo steht im Kopf', kopf.logo === '/icon-192.png', String(kopf.logo));
  pruefe('Titel nennt WELLapps Social', kopf.titel.includes('WELLapps Social'), kopf.titel);
  pruefe('Erklaerung vor der Anmeldung sichtbar', kopf.worum, String(kopf.worum));
  pruefe('kein Pruefband vor der Anmeldung', !kopf.band, String(kopf.band));

  await pruef.fill('#pw', 'pruef');
  await pruef.click('#rein');
  await pruef.waitForTimeout(600);
  pruefe('Pruefband nach der Anmeldung sichtbar',
    await pruef.locator('#pruefband').isVisible(), 'unsichtbar');

  const knopf = pruef.getByRole('button', { name: 'Auf Facebook veröffentlichen' });
  await knopf.click();
  await pruef.getByRole('button', { name: /Wirklich/ }).click();
  await pruef.waitForTimeout(400);
  const zeile = (await pruef.locator('body').innerText())
    .split('\n').find((z) => /Review mode|Läuft|Fehler:/.test(z) && !z.includes('Review mode.')) ?? '(keine)';
  pruefe('Knopf sagt „nichts gesendet" statt „Läuft"',
    zeile.includes('nothing was sent') && !zeile.includes('Läuft'), zeile);
  const vermerk = await pruef.evaluate((d) => sessionStorage.getItem(`freigabe.versuch.facebook.${d}.a.jpg`), DATUM);
  pruefe('im Pruefmodus kein Versuchsvermerk', vermerk === null, String(vermerk));
  await pruef.close();
}

await browser.close();
server.close();

console.log(`\nFreigabe-Seite: ${gut} von ${gut + schlecht.length} Faellen gruen.`);
if (schlecht.length) {
  console.error('\n✗ Fehlgeschlagen:');
  for (const z of schlecht) console.error(`   • ${z}`);
  process.exit(1);
}
