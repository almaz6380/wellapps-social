// Bilder aus dem Blob-Speicher unter DIESER Domain ausliefern.
//
// --- Wofuer das da ist -------------------------------------------------------
//
// TikTok-Fotobeitraege kennen keinen Dateiupload. `photo_images` nimmt nur
// Adressen, und TikTok holt die Bilder selbst ab (`PULL_FROM_URL`). Dazu sagt
// die Doku einen Nebensatz, an dem alles haengt:
//
//     „The URLs must be publicly accessible and VERIFIED BY YOUR APP."
//
// Unsere Bilder liegen im Vercel-Blob-Speicher, und dessen Host ist im
// TikTok-Entwicklerportal nicht eingetragen. `wellapps-freigabe.vercel.app`
// dagegen schon — die Signaturdatei dafuer liegt seit jeher im Wurzel-
// verzeichnis dieses Projekts (`tiktok7dD2Rlg….txt`). Diese Route reicht die
// Bytes durch, damit TikTok eine Adresse bekommt, die es akzeptiert.
//
// Der andere Weg waere, das Blob-Praefix im Portal nachzutragen. Der ist
// einmalig und guenstiger — aber er geht nur am Rechner, und Josef arbeitet
// vom Handy. Deshalb dieser hier.
//
// --- Was hier bewusst NICHT passiert ----------------------------------------
//
// ⚠ KEIN offener Weiterleitungsdienst. Die Adresse wird nicht durchgereicht,
// sondern aus einem festen Host und einem streng geprueften Pfad ZUSAMMEN-
// GESETZT. Wer hier eine fremde Adresse unterschieben koennte, haette einen
// Dienst, der beliebige Ziele im Namen unserer Domain abruft — der klassische
// SSRF. Deshalb steht der Host als Konstante hier und kommt nie aus der
// Anfrage.
//
// ⚠ KEIN Passwort. TikTok bringt keines mit. Das ist unbedenklich: Dieselben
// Bytes liegen ohnehin oeffentlich im Blob-Speicher, diese Route macht sie
// nicht zugaenglicher, nur anders adressiert.
//
// ⚠ KEINE Zugangsdaten. Wie `freigabe.js` kennt diese Datei weder den
// Blob-Token noch die Netzwerke.

// Der Blob-Speicher der Social-Automatik. Fest, s. o.
const BLOB_HOST = 'nz4nl23onpx9rppi.public.blob.vercel-storage.com';

// ⚠ Nur unsere eigenen Tagesordner, nur Bilder. Der Zufallsanhang, den der
// Blob-Speicher an jeden Dateinamen haengt, ist Teil des Namens — deshalb
// sind Buchstaben und Ziffern darin erlaubt, aber kein Schraegstrich und
// kein Punkt-Punkt.
const PFAD = /^social\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]{1,200}\.(jpg|jpeg)$/;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ fehler: 'Nur GET.' });
    return;
  }

  // Bei einer Catch-all-Route liefert Vercel die Segmente als Feld.
  const teile = req.query?.pfad;
  const pfad = (Array.isArray(teile) ? teile.join('/') : String(teile ?? '')).trim();

  if (!PFAD.test(pfad)) {
    // Absichtlich ohne Einzelheiten: Was nicht passt, muss nicht erfahren,
    // woran es lag.
    res.status(400).json({ fehler: 'Unerwarteter Pfad.' });
    return;
  }

  let oben;
  try {
    oben = await fetch(`https://${BLOB_HOST}/${pfad}`, { method: req.method });
  } catch (e) {
    res.status(502).json({ fehler: `Blob-Speicher nicht erreichbar: ${e.message}` });
    return;
  }

  if (!oben.ok) {
    // Den Status durchreichen, nicht uebersetzen: Ein 404 hier heisst, dass
    // das Bild wirklich nicht liegt, und genau das soll TikTok sehen.
    res.status(oben.status === 404 ? 404 : 502)
      .json({ fehler: `Blob-Speicher antwortete ${oben.status}.` });
    return;
  }

  const typ = oben.headers.get('content-type') || 'image/jpeg';
  res.setHeader('Content-Type', typ.startsWith('image/') ? typ : 'image/jpeg');
  // Die Dateien aendern sich nie — der Name traegt einen Zufallsanhang.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  const bytes = Buffer.from(await oben.arrayBuffer());
  res.setHeader('Content-Length', String(bytes.length));
  res.status(200).send(bytes);
}
