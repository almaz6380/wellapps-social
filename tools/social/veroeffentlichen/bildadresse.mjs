// Aus einer Blob-Adresse die Adresse machen, die TikTok akzeptiert.
//
// TikTok holt die Bilder eines Fotobeitrags selbst ab und verlangt dafuer,
// dass ihre Adresse „verified by your app" ist — das Praefix muss also im
// Entwicklerportal eingetragen sein. Der Blob-Host ist es nicht;
// `wellapps-freigabe.vercel.app` ist es seit jeher (Signaturdatei im
// Wurzelverzeichnis jenes Projekts). Also laufen die Bilder ueber eine
// Durchreich-Route dort — `freigabe-app/api/bild/[...pfad].js`.
//
// ⚠ Das gilt NUR fuer TikTok. Instagram und Facebook holen sich dieselben
// Bilder weiter direkt aus dem Blob-Speicher; ihnen ist der Host gleich, und
// ein Umweg waere eine Fehlerquelle ohne Gegenwert.

//
// ⚠ Seit 30.09.2026 liegt der Speicher im Freigabe-Worker auf Cloudflare
// (freigabe-app/worker/index.js), und die Durchreiche ist dort eine eigene Route.
// Bild und Durchreiche teilen sich damit die Domain; im TikTok-Entwicklerportal
// muss `freigabe.almaz6380.workers.dev` als verifizierte Domain eingetragen sein
// (Signaturdateien liegen weiter im Wurzelverzeichnis von freigabe-app/).
export const BLOB_HOST = 'freigabe.almaz6380.workers.dev';
export const DURCHREICHE = 'https://freigabe.almaz6380.workers.dev/api/bild';

/**
 * @param {string} url  die oeffentliche Blob-Adresse eines Bildes
 * @returns {string}    dieselbe Datei unter der verifizierten Domain
 */
export function tiktokBildAdresse(url) {
  let zerlegt;
  try {
    zerlegt = new URL(String(url));
  } catch {
    throw new Error(`Keine Adresse: ${String(url).slice(0, 80)}`);
  }

  // ⚠ Hier NICHT stillschweigend die Originaladresse zurueckgeben. Ein
  // unbekannter Host hiesse, dass sich die Ablage geaendert hat — und der
  // Fehler kaeme sonst erst von TikTok zurueck, als „konnte nichts abholen",
  // also an der Stelle, an der man ihn am schwersten deutet.
  if (zerlegt.host !== BLOB_HOST) {
    throw new Error(`Unerwarteter Bild-Host „${zerlegt.host}" — erwartet ${BLOB_HOST}. `
      + 'Liegt die Ablage woanders, muss auch die Durchreiche in '
      + 'freigabe-app/api/bild/ nachgezogen werden.');
  }

  // ⚠ Datum und Dateiname kommen in EIN Segment, getrennt durch eine Tilde.
  // Vercels Zero-Config-API reicht hier nur ein Segment durch — am 19.09.2026
  // an der deployten Seite gemessen: `/api/bild/x` erreicht die Funktion,
  // `/api/bild/a/b` bekommt Vercels eigene 404. Die Begruendung steht
  // ausfuehrlich in `freigabe-app/api/bild/[teil].js`.
  const teile = zerlegt.pathname.replace(/^\/+/, '').split('/');
  const [ordner, tag, datei] = teile;
  if (teile.length !== 3 || ordner !== 'social' || !/^\d{4}-\d{2}-\d{2}$/.test(tag ?? '')) {
    throw new Error(`Unerwarteter Bildpfad „${zerlegt.pathname}" — erwartet `
      + 'social/<JJJJ-MM-TT>/<datei>. Aendert sich die Ablage, muss die '
      + 'Durchreiche in freigabe-app/api/bild/ mit.');
  }

  return `${DURCHREICHE}/${tag}~${datei}`;
}
