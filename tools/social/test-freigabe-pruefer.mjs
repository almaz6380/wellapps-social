// Der Pruefzugang der Freigabe-Seite darf NIE einen Lauf starten.
//
//   node tools/social/test-freigabe-pruefer.mjs
//
// --- Wofuer (23.09.2026) -----------------------------------------------------
//
// TikTok hat die App-Pruefung abgelehnt, auch weil die Website nur ein
// Passwortfeld zeigt; verlangt wird ein Testzugang. Das echte Passwort kann
// es nicht sein — mit ihm stellt man Beitraege auf Josefs Konten oeffentlich.
// Also ein zweites (`FREIGABE_PRUEFER_PASSWORT`), mit dem alles geht ausser
// dem letzten Schritt.
//
// ⚠ Das hier ist die Probe, auf die es ankommt: Ein Pruefmodus, der bei EINER
// Aktion doch startet, ist schlimmer als keiner — man glaubt sich sicher.
// Deshalb wird JEDE Aktion durchgespielt und JEDER Aufruf an GitHub gezaehlt,
// nicht nur die TikTok-Aktion.
//
// ⚠ Und die Gegenprobe: Mit dem echten Passwort startet dieselbe Aktion
// wirklich. Ohne sie waere eine Null auch dann gruen, wenn die Attrappe gar
// nicht angeschlossen waere.
//
// Geprueft wird die ECHTE Funktion aus freigabe-app/api/freigabe.js; nur
// `fetch` ist ersetzt. Es geht nichts ins Netz.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const APP = join(HIER, '..', '..', 'freigabe-app');
const { default: handler } = await import(join(APP, 'api', 'freigabe.js'));

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

process.env.FREIGABE_PASSWORT = 'echt-passwort-123';
process.env.FREIGABE_PRUEFER_PASSWORT = 'pruef-passwort-456';
process.env.GITHUB_TOKEN = 'attrappe';
process.env.BLOB_BASIS = 'https://blob.example';

const githubAufrufe = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith('https://api.github.com/')) {
    githubAufrufe.push(u);
    return new Response(null, { status: 204 });
  }
  return new Response('nicht da', { status: 404 });   // Merklisten: an dem Tag nichts
};

async function rufe(body) {
  let status = 0; let daten = null;
  const res = {
    status(s) { status = s; return this; },
    json(d) { daten = d; return this; },
  };
  await handler({ method: 'POST', body }, res);
  return { status, daten };
}

// Jede Aktion, die einen Lauf startet — mit gueltigen Werten, sodass sie mit
// dem echten Passwort wirklich bis zum Start durchlaeuft.
const AKTIONEN = [
  { aktion: 'veroeffentlichen', app: 'swaply', datei: 'a.jpg' },
  { aktion: 'ablehnen', app: 'swaply', datei: 'a.jpg' },
  { aktion: 'neu', app: 'swaply', variante: 1 },
  { aktion: 'karte', app: 'anigosha', text: 'Hallo' },
  { aktion: 'facebook', app: 'swaply', datei: 'a.jpg' },
  { aktion: 'tiktok', app: 'swaply', datei: 'a.mp4', privacy: 'SELF_ONLY', erlaubt: [], werbung: [] },
];

// --- 1. Pruefpasswort: KEIN einziger Aufruf an GitHub ------------------------
for (const a of AKTIONEN) {
  githubAufrufe.length = 0;
  const { status, daten } = await rufe({ passwort: 'pruef-passwort-456', datum: '2026-09-23', ...a });
  pruefe(`Pruefer · ${a.aktion}: kein Lauf gestartet`, githubAufrufe.length === 0, githubAufrufe.join(', '));
  pruefe(`Pruefer · ${a.aktion}: Antwort sagt pruefmodus`,
    status === 200 && daten?.pruefmodus === true && daten?.gestartet === false, `${status} ${JSON.stringify(daten)}`);
}

// --- 2. Gegenprobe: echtes Passwort startet wirklich ------------------------
for (const a of AKTIONEN) {
  githubAufrufe.length = 0;
  const { status, daten } = await rufe({ passwort: 'echt-passwort-123', datum: '2026-09-23', ...a });
  pruefe(`echt · ${a.aktion}: Lauf gestartet`, githubAufrufe.length === 1, `${githubAufrufe.length} Aufruf(e)`);
  pruefe(`echt · ${a.aktion}: kein Pruefmodus`,
    status === 200 && daten?.gestartet === true && !daten?.pruefmodus, `${status} ${JSON.stringify(daten)}`);
}

// --- 3. Die Pruefungen laufen im Pruefmodus genauso -------------------------
//
// Ohne Sichtbarkeit weist der Server ab — auch den Pruefer. Sonst saehe der
// Pruefer einen laxeren Server, als Josef ihn hat.
{
  const { status } = await rufe({ passwort: 'pruef-passwort-456', aktion: 'tiktok', app: 'swaply', datei: 'a.mp4' });
  pruefe('Pruefer ohne Sichtbarkeit → abgewiesen', status === 400, String(status));
}

// --- 4. Anmelden und Liste ---------------------------------------------------
{
  const pr = await rufe({ passwort: 'pruef-passwort-456', aktion: 'liste', datum: '2026-09-23' });
  pruefe('Pruefer darf die Liste sehen', pr.status === 200 && pr.daten?.pruefmodus === true, JSON.stringify(pr.daten));
  const echt = await rufe({ passwort: 'echt-passwort-123', aktion: 'liste', datum: '2026-09-23' });
  pruefe('echte Liste ohne Pruefmodus', echt.status === 200 && echt.daten?.pruefmodus === false, JSON.stringify(echt.daten));
  const falsch = await rufe({ passwort: 'falsch', aktion: 'liste' });
  pruefe('falsches Passwort → 401', falsch.status === 401, String(falsch.status));
}

// --- 5. Ohne gesetztes Pruefpasswort gibt es keinen Pruefzugang --------------
//
// ⚠ Sonst oeffnete ein LEERES Passwort die Seite, sobald die Variable fehlt.
{
  delete process.env.FREIGABE_PRUEFER_PASSWORT;
  const leer = await rufe({ passwort: '', aktion: 'liste' });
  pruefe('ohne Variable: leeres Passwort → 401', leer.status === 401, String(leer.status));
  const undef = await rufe({ aktion: 'liste' });
  pruefe('ohne Variable: gar kein Passwort → 401', undef.status === 401, String(undef.status));
  process.env.FREIGABE_PRUEFER_PASSWORT = 'pruef-passwort-456';
}

// --- 6. Gleicher Wert in beiden Variablen: das volle Passwort gewinnt -------
{
  process.env.FREIGABE_PRUEFER_PASSWORT = 'echt-passwort-123';
  githubAufrufe.length = 0;
  await rufe({ passwort: 'echt-passwort-123', aktion: 'facebook', app: 'swaply', datei: 'a.jpg' });
  pruefe('gleicher Wert: Josef bleibt voll', githubAufrufe.length === 1, `${githubAufrufe.length} Aufruf(e)`);
  process.env.FREIGABE_PRUEFER_PASSWORT = 'pruef-passwort-456';
}

// --- 7. Die Icon-Dateien, auf die die Seite zeigt, liegen wirklich da --------
//
// Der Browsertest liefert auf jeden Pfad die Seite aus und merkt eine
// fehlende Datei deshalb nicht.
for (const f of ['favicon.ico', 'icon-32.png', 'icon-192.png', 'apple-touch-icon.png']) {
  pruefe(`${f} liegt in freigabe-app/`, existsSync(join(APP, f)), 'fehlt');
}

console.log(`${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.log('\n✗ Nicht bestanden:');
  for (const s of schlecht) console.log(`   ${s}`);
  process.exit(1);
}
