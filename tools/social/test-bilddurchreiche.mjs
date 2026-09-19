// Die Bild-Durchreiche: Umrechnung der Adressen und die Route selbst.
//
//   node tools/social/test-bilddurchreiche.mjs
//
// Es geht kein Aufruf ins echte Netz: Die Route wird mit einem `fetch`-Ersatz
// gefahren, der den Blob-Speicher nachstellt.
//
// ⚠ Was dieser Test NICHT beweisen kann: dass TikTok die Adressen akzeptiert.
// Das haengt daran, ob `wellapps-freigabe.vercel.app` im Entwicklerportal als
// verifiziert gefuehrt wird — eine Einstellung ausserhalb dieses Repos. Der
// Beweis dafuer ist ein Beitrag im Konto, nichts anderes.

import { tiktokBildAdresse, BLOB_HOST, DURCHREICHE } from './veroeffentlichen/bildadresse.mjs';
import route from '../../freigabe-app/api/bild/[teil].js';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const DATEI = 'wellbooked-anruf-de-s3709-1-J33tZIBgj1YMHRXg0i8jRRSBHsS284.jpg';
const TAG = '2026-09-19';
const PFAD = `social/${TAG}/${DATEI}`;
const BLOB = `https://${BLOB_HOST}/${PFAD}`;
// ⚠ EIN Segment, Tilde als Trenner — Vercel reicht hier kein Catch-all durch.
const TEIL = `${TAG}~${DATEI}`;

// --- 1. Umrechnung ----------------------------------------------------------
{
  const u = tiktokBildAdresse(BLOB);
  pruefe('liegt unter der verifizierten Domain', u === `${DURCHREICHE}/${TEIL}`, u);
  pruefe('Dateiname bleibt unveraendert', u.endsWith(DATEI), u);
  // ⚠ Der Fall, der die erste Fassung unbrauchbar machte: Zwei Segmente
  // erreichen die Funktion gar nicht, Vercel antwortet mit seiner eigenen 404.
  pruefe('nur EIN Segment hinter /api/bild',
    u.slice(DURCHREICHE.length + 1).split('/').length === 1, u);
  pruefe('endet auf .jpg', u.endsWith('.jpg'), u);

  // ⚠ Kein stilles Durchreichen: Ein fremder Host heisst, die Ablage hat sich
  // geaendert. Gaebe die Funktion die Adresse unveraendert zurueck, kaeme der
  // Fehler erst von TikTok als „konnte nichts abholen".
  let f = null;
  try { tiktokBildAdresse('https://fremder.invalid/social/2026-09-19/x.jpg'); }
  catch (e) { f = e.message; }
  pruefe('fremder Host wird abgelehnt', Boolean(f) && /Host/.test(f ?? ''), f ?? 'kein Fehler');

  let f2 = null;
  try { tiktokBildAdresse('kein-url'); } catch (e) { f2 = e.message; }
  pruefe('Unsinn wird abgelehnt', Boolean(f2), f2 ?? 'kein Fehler');
}

// --- 2. Die Route -----------------------------------------------------------
const antwortAttrappe = () => {
  const a = { code: null, kopf: {}, rumpf: null, beendet: false };
  a.status = (c) => { a.code = c; return a; };
  a.setHeader = (k, v) => { a.kopf[k.toLowerCase()] = v; };
  a.json = (o) => { a.rumpf = o; return a; };
  a.send = (b) => { a.rumpf = b; return a; };
  a.end = () => { a.beendet = true; return a; };
  return a;
};

const BYTES = Buffer.from('nicht wirklich ein JPEG, aber Bytes sind Bytes');
const echtesFetch = globalThis.fetch;
let zuletztGeholt = null;

const rufe = async ({ pfad, methode = 'GET', oben }) => {
  globalThis.fetch = async (u, o) => {
    zuletztGeholt = String(u);
    if (oben === 'weg') return { ok: false, status: 404 };
    if (oben === 'kaputt') throw new Error('Verbindung abgerissen');
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => BYTES,
      _methode: o?.method,
    };
  };
  const res = antwortAttrappe();
  try {
    await route({ method: methode, query: { teil: pfad } }, res);
  } finally {
    globalThis.fetch = echtesFetch;
  }
  return res;
};

{
  zuletztGeholt = null;
  const r = await rufe({ pfad: TEIL });
  pruefe('Bild kommt mit 200 zurueck', r.code === 200, String(r.code));
  pruefe('Bytes unveraendert', Buffer.isBuffer(r.rumpf) && r.rumpf.equals(BYTES),
    String(r.rumpf?.length));
  pruefe('Content-Type ist ein Bild', r.kopf['content-type'] === 'image/jpeg',
    r.kopf['content-type']);
  pruefe('lange zwischenspeicherbar', /immutable/.test(r.kopf['cache-control'] ?? ''),
    r.kopf['cache-control']);
  pruefe('geholt wurde beim Blob-Host', zuletztGeholt === BLOB, zuletztGeholt);
}

// --- 3. Kein offener Weiterleitungsdienst -----------------------------------
//
// ⚠ Der teuerste Fehler, den diese Route machen koennte: eine fremde Adresse
// im Namen unserer Domain abrufen. Deshalb wird der Host nie aus der Anfrage
// genommen, und der Pfad streng geprueft.
{
  const boese = [
    ['absolute Adresse', 'https://fremder.invalid/a.jpg'],
    ['Pfad nach oben', '2026-09-19~../../geheim.jpg'],
    ['Schraegstrich im Namen', '2026-09-19~../a.jpg'],
    ['alter Pfad mit Ordner', 'social/2026-09-19/a.jpg'],
    ['kein Datum', 'irgendwas~a.jpg'],
    ['kein Trenner', '2026-09-19-a.jpg'],
    ['kein Bild', '2026-09-19~a.json'],
    ['Video', '2026-09-19~a.mp4'],
    ['leer', ''],
  ];
  for (const [name, pfad] of boese) {
    zuletztGeholt = null;
    const r = await rufe({ pfad });
    pruefe(`abgewiesen: ${name}`, r.code === 400 && zuletztGeholt === null,
      `${r.code}, geholt: ${zuletztGeholt ?? 'nichts'}`);
  }
}

// --- 4. Fehler von oben werden nicht beschoenigt ----------------------------
{
  const weg = await rufe({ pfad: TEIL, oben: 'weg' });
  pruefe('fehlendes Bild bleibt 404', weg.code === 404, String(weg.code));

  const kaputt = await rufe({ pfad: TEIL, oben: 'kaputt' });
  pruefe('Blob nicht erreichbar → 502', kaputt.code === 502, String(kaputt.code));
}

// --- 5. Methoden ------------------------------------------------------------
{
  const kopf = await rufe({ pfad: TEIL, methode: 'HEAD' });
  pruefe('HEAD geht, ohne Rumpf', kopf.code === 200 && kopf.beendet && kopf.rumpf === null,
    `${kopf.code}, Rumpf ${kopf.rumpf === null ? 'leer' : 'da'}`);

  const post = await rufe({ pfad: TEIL, methode: 'POST' });
  pruefe('POST wird abgelehnt', post.code === 405, String(post.code));
}

// --- Ergebnis ---------------------------------------------------------------
console.log(`\nBild-Durchreiche: ${gut} von ${gut + schlecht.length} Faellen gruen.`);
if (schlecht.length) {
  console.error('\n✗ Fehlgeschlagen:');
  for (const z of schlecht) console.error(`   • ${z}`);
  process.exit(1);
}
