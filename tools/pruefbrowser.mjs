// Gemeinsamer Unterbau der Playwright-Werkzeuge (shot-home, shot-levelup,
// store-shots, check-theme-color).
//
// Er loest die zwei Dinge, an denen sie in einer Cloud-Sitzung scheiterten:
// den Browser und den Vorschau-Server.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

/**
 * Startet Chromium.
 *
 * `chromium.launch()` ohne Angabe sucht die Bauart, die zur installierten
 * Playwright-Version gehoert — hier 1234, waehrend das Abbild der Cloud-Sitzung
 * 1194 mitbringt. Die Meldung lautet dann „Executable doesn't exist" und rät zu
 * `npx playwright install`; das laedt 150 MB nach, obwohl daneben ein
 * einwandfrei brauchbarer Chromium liegt.
 *
 * Reihenfolge: CHROMIUM_PFAD (dieselbe Variable, die tools/reels/render.mjs
 * schon kennt), dann der bekannte Pfad im Abbild, sonst Playwrights eigener —
 * auf einem Rechner mit `npx playwright install` bleibt also alles beim Alten.
 */
export async function browserStarten(optionen = {}) {
  const { chromium } = await import('playwright');
  const pfad =
    process.env.CHROMIUM_PFAD ||
    (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  // Den Agent-Proxy mitgeben, falls einer gesetzt ist. Stand 01.09.2026 hilft
  // das in der Cloud-Sitzung NICHT — der Relay bricht jeden Tunnel aus Chromium
  // ab (ERR_CONNECTION_RESET, siehe netzPruefen). Es kostet aber nichts und
  // greift, sobald die Umgebung das kann. localhost muss vorbei, sonst findet
  // der Browser den eigenen Vorschau-Server nicht.
  const proxy = process.env.HTTPS_PROXY
    ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } }
    : {};
  return chromium.launch({ ...(pfad ? { executablePath: pfad } : {}), ...proxy, ...optionen });
}

/**
 * Erreicht der BROWSER die Aussenwelt?
 *
 * Node und Chromium sind hier nicht gleich gestellt: Node folgt HTTPS_PROXY,
 * Chromium kommt in einer Cloud-Sitzung gar nicht hinaus. Werkzeuge, die echte
 * Daten brauchen (Anmeldung, Profil, Fragen), rendern dann eine leere Seite —
 * und fotografieren sie klaglos. Genau das soll dieser Aufruf verhindern:
 * lieber ein klarer Abbruch als ein Screenshot, der etwas Falsches zeigt.
 */
export async function netzPruefen(browser, url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const ok = await page
    .goto(url, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  await ctx.close();
  return ok;
}

/** Bricht mit einer verstaendlichen Meldung ab, statt Leeres aufzunehmen. */
export async function netzVerlangen(browser, url, stoppen) {
  if (await netzPruefen(browser, url)) return;
  console.error(
    'Der Browser erreicht ' + new URL(url).host + ' nicht.\n' +
      'In einer Cloud-Sitzung kommt Chromium nicht ins Netz (der Agent-Proxy bricht\n' +
      'jeden Tunnel ab) — dieses Werkzeug braucht aber echte Daten und wuerde sonst\n' +
      'einen leeren Bildschirm aufnehmen. Auf einem normalen Rechner laeuft es.\n' +
      'Ohne Netz pruefbar ist tools/check-theme-color.mjs.'
  );
  await browser.close();
  if (stoppen) await stoppen();
  process.exit(1);
}

const erreichbar = async (url) => {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
};

/**
 * Sorgt dafuer, dass unter `url` wirklich etwas antwortet.
 *
 * Zeigt die URL nach draussen (Vercel), wird nichts getan. Zeigt sie auf
 * localhost und dort laeuft schon ein Server, ebenfalls nicht — wer parallel
 * `npm run preview` offen hat, soll ihn behalten. Nur wenn niemand antwortet,
 * wird gebaut und ein eigener Vorschau-Server gestartet und am Ende wieder
 * beendet. Ohne das lief man in einen nichtssagenden Playwright-Zeitablauf.
 *
 * Rueckgabe: { url, stoppen } — `stoppen` am Ende des Skripts aufrufen.
 */
export async function vorschauSichern(url) {
  const nichts = { url, stoppen: async () => {} };
  const ziel = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(ziel.hostname)) return nichts;
  if (await erreichbar(url)) return nichts;

  if (!existsSync('dist/index.html')) {
    console.log('Vorschau: dist/ fehlt — baue …');
    await new Promise((fertig, fehler) => {
      const b = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
      b.on('exit', (c) => (c === 0 ? fertig() : fehler(new Error('npm run build fehlgeschlagen'))));
    });
  }

  const port = ziel.port || '4173';
  console.log(`Vorschau: starte vite preview auf Port ${port} …`);
  const server = spawn(
    'node',
    ['node_modules/vite/bin/vite.js', 'preview', '--port', port, '--strictPort'],
    { stdio: 'ignore', detached: true }
  );

  const stoppen = async () => {
    try {
      process.kill(-server.pid);
    } catch {
      /* schon beendet */
    }
  };
  // Auch bei Abbruch aufraeumen, sonst bleibt der Port belegt und der
  // naechste Lauf scheitert an --strictPort.
  process.once('exit', () => {
    try {
      process.kill(-server.pid);
    } catch { /* egal */ }
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await erreichbar(url)) return { url, stoppen };
  }
  await stoppen();
  throw new Error(`Vorschau-Server auf ${url} kam nicht hoch.`);
}
