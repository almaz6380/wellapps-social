// Instagram freigeben — der zweite Halbschritt, den der Tageslauf offen laesst.
//
//   MODUS=zeigen           node tools/social/freigeben.mjs
//   MODUS=veroeffentlichen node tools/social/freigeben.mjs
//   DATUM=2026-09-05 APPS=anigosha,mahjong …
//
// --- Warum Instagram ueberhaupt zweimal angefasst wird ----------------------
//
// Facebook und TikTok kennen einen Entwurf: Der Tageslauf legt ihn an, ein
// Mensch gibt ihn spaeter in der jeweiligen App frei. Instagram kennt keinen.
// Seine API ist zweistufig — Container anlegen, dann veroeffentlichen —, und
// ein nicht veroeffentlichter Container ist in der App NIRGENDS zu sehen. Er
// ist also kein Entwurf, sondern ein Zwischenzustand mit Verfallsdatum: 24
// Stunden.
//
// Deshalb macht der Tageslauf nur den Teil, der haltbar ist (Bild oeffentlich
// ablegen), und dieses Werkzeug den Rest. Beides zugleich hiesse, morgens
// einen Container zu bauen, der abends tot ist — mit einer Fehlermeldung, die
// nach einem kaputten Zugang aussieht.
//
// --- Warum es NICHTS neu rendert --------------------------------------------
//
// Die Bildtexte stehen in den .txt-Dateien neben den Bildern, und die liegen
// auf der Maschine, die gerendert hat — bei einem Workflow ist die laengst
// weg. Statt vier Minuten neu zu rendern, liest dieses Werkzeug die Merkliste,
// die posten.mjs im selben Speicher abgelegt hat.

import { merklistenLesen, merklisteAblegen, aufraeumen } from './veroeffentlichen/blob.mjs';
import { containerAnlegen, aufBereitWarten, veroeffentlichen } from './veroeffentlichen/instagram.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const MODUS = (process.env.MODUS || 'zeigen').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const APPS = (process.env.APPS || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!['zeigen', 'veroeffentlichen'].includes(MODUS)) {
  console.error(`Unbekannter Modus „${MODUS}" — erlaubt sind zeigen und veroeffentlichen.`);
  process.exit(1);
}

// Der Blob-Speicher ist fuer alle Apps derselbe; irgendein Token genuegt zum
// Lesen der Merklisten. Zum Veroeffentlichen wird je App der eigene genommen.
const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt — ohne ihn ist die Merkliste nicht zu finden.');
  process.exit(1);
}

const listen = (await merklistenLesen({ datum: DATUM, token: blobToken }))
  .filter((l) => !APPS.length || APPS.includes(l.app));

if (!listen.length) {
  console.log(`Keine Merkliste fuer ${DATUM}${APPS.length ? ` (${APPS.join(', ')})` : ''}.`);
  console.log('Entweder lief an dem Tag kein echter Tageslauf, oder Instagram war');
  console.log('nicht unter den Kanaelen.');
  process.exit(0);
}

console.log(MODUS === 'zeigen'
  ? `Offene Instagram-Beitraege fuer ${DATUM} — es wird NICHTS veroeffentlicht.\n`
  : `Instagram veroeffentlichen fuer ${DATUM}. Das ist OEFFENTLICH.\n`);

let veroeffentlicht = 0, uebersprungen = 0, fehler = 0;

for (const liste of listen) {
  console.log(`━━ ${liste.app}`);
  const z = zugaenge(liste.app);
  let geaendert = false;

  for (const [i, e] of liste.eintraege.entries()) {
    const nummer = `${i + 1}/${liste.eintraege.length}`;

    // ⚠ Die einzige Sperre gegen einen doppelten Beitrag. Instagram selbst hat
    // keine: Zweimal veroeffentlichen ergibt zwei Beitraege, und geloescht
    // werden koennen sie nur von Hand.
    if (e.veroeffentlicht) {
      console.log(`   ${nummer} ${e.datei}`);
      console.log(`        schon veroeffentlicht am ${e.veroeffentlicht} (${e.beitragId})`);
      uebersprungen += 1;
      continue;
    }

    if (MODUS === 'zeigen') {
      console.log(`   ${nummer} ${e.datei}${e.istVideo ? '  (Reel)' : ''}`);
      console.log(`        ${e.url}`);
      // Der Text vollstaendig, nicht gekuerzt: Er ist das, was mit
      // veroeffentlicht wird, und genau darum geht es beim Ansehen.
      console.log(e.text.split('\n').map((z2) => `        │ ${z2}`).join('\n'));
      console.log();
      continue;
    }

    try {
      console.log(`   ${nummer} ${e.datei} …`);
      const c = await containerAnlegen({
        kontoId: z.igKontoId, token: z.fbToken,
        bildUrl: e.url, text: e.text, istReel: e.istVideo,
      });
      // Bei einem Reel laedt Instagram das Video erst herunter und kodiert es.
      await aufBereitWarten({ containerId: c.containerId, token: z.fbToken });
      const r = await veroeffentlichen({
        kontoId: z.igKontoId, token: z.fbToken, containerId: c.containerId,
      });

      e.veroeffentlicht = new Date().toISOString();
      e.beitragId = r.id;
      geaendert = true;
      veroeffentlicht += 1;
      console.log(`        ✓ veroeffentlicht — Beitrag ${r.id}`);

      // ⚠ Erst JETZT wegraeumen. Instagram holt das Bild beim Anlegen des
      // Containers; wer vorher loescht, bekommt einen Container, der ins Leere
      // greift. Und misslingt das Aufraeumen, bleibt der Beitrag trotzdem
      // gueltig — es kostet nur ein paar Kilobyte.
      await aufraeumen({ url: e.url, token: z.blobToken });
    } catch (err) {
      fehler += 1;
      console.log(`        ✗ ${err.message}`);
    }
  }

  // Die Merkliste sofort nach JEDER App zurueckschreiben, nicht erst ganz am
  // Ende: Bricht der Lauf bei der naechsten App ab, ist die Sperre gegen den
  // doppelten Beitrag fuer diese hier trotzdem gesetzt.
  //
  // ⚠ `uebersicht` und `name` MUESSEN mitgereicht werden. Sie stehen in
  // derselben Datei, gehoeren aber nicht diesem Werkzeug — sie sind die
  // Anzeige der Freigabe-Seite. Wer sie hier weglaesst, loescht sie beim
  // ersten Veroeffentlichen: Die Seite waere danach leer, und zwar genau fuer
  // die Tage, an denen etwas passiert ist.
  if (geaendert) {
    await merklisteAblegen({
      datum: DATUM, appSchluessel: liste.app, name: liste.name,
      eintraege: liste.eintraege, uebersicht: liste.uebersicht, token: z.blobToken,
    });
  }
  console.log();
}

if (MODUS === 'zeigen') {
  console.log('Zum Veroeffentlichen denselben Workflow mit modus: veroeffentlichen starten.');
} else {
  console.log(`${veroeffentlicht} veroeffentlicht, ${uebersprungen} schon vorher, ${fehler} fehlgeschlagen.`);
  // Ein Fehlschlag muss den Lauf roetlich faerben — sonst faellt er niemandem
  // auf, und der Beitrag fehlt still.
  if (fehler) process.exit(1);
}
