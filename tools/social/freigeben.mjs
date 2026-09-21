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

import { merklistenLesen, merklisteAblegen, aufraeumen, nochGebraucht } from './veroeffentlichen/blob.mjs';
import {
  containerAnlegen, karussellAnlegen, aufBereitWarten, veroeffentlichen, KARUSSELL_MIN,
} from './veroeffentlichen/instagram.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';
import { instagramKanal } from './instagram-stand.mjs';

const MODUS = (process.env.MODUS || 'zeigen').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const APPS = (process.env.APPS || '').split(',').map((s) => s.trim()).filter(Boolean);
// ⚠ Seit dem 09.09.2026 gibt die Freigabe-Seite Instagram BEITRAGSWEISE frei,
// so wie Facebook. Vorher war Instagram der einzige Kanal mit einem Sammelknopf
// je App — zwei Beitraege auf einmal, ohne dass man vorher sagen konnte
// „diesen ja, jenen nicht". Bleibt DATEI leer, gilt weiterhin die ganze App;
// so laesst sich der Lauf auch von Hand als Sammelfreigabe benutzen.
const NUR_DATEI = (process.env.DATEI || '').trim();

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

let veroeffentlicht = 0, uebersprungen = 0, fehler = 0, getroffen = 0;

for (const liste of listen) {
  console.log(`━━ ${liste.app}`);
  const z = zugaenge(liste.app);
  let geaendert = false;

  for (const [i, e] of liste.eintraege.entries()) {
    const nummer = `${i + 1}/${liste.eintraege.length}`;

    // Beitragsweise Freigabe: alles andere still ueberspringen.
    if (NUR_DATEI && e.datei !== NUR_DATEI) continue;
    getroffen += 1;

    // ⚠ Die einzige Sperre gegen einen doppelten Beitrag. Instagram selbst hat
    // keine: Zweimal veroeffentlichen ergibt zwei Beitraege, und geloescht
    // werden koennen sie nur von Hand.
    if (e.veroeffentlicht) {
      console.log(`   ${nummer} ${e.datei}`);
      console.log(`        schon veroeffentlicht am ${e.veroeffentlicht} (${e.beitragId})`);
      uebersprungen += 1;
      continue;
    }

    // ⚠ Ein Karussell erkennt man an `urls`, NICHT daran, dass `url` fehlt.
    // `url` bleibt gesetzt (die erste Folie) — die Vorschau, das Aufraeumen
    // und jeder aeltere Eintrag haengen daran. Wer hier auf `!e.url` prueft,
    // haelt jedes Karussell fuer kaputt.
    const folien = Array.isArray(e.urls) ? e.urls.filter(Boolean) : [];
    const istKarussell = folien.length >= KARUSSELL_MIN;

    if (MODUS === 'zeigen') {
      const art = e.istVideo ? '  (Reel)' : istKarussell ? `  (Karussell, ${folien.length} Folien)` : '';
      console.log(`   ${nummer} ${e.datei}${art}`);
      if (istKarussell) folien.forEach((u, k) => console.log(`        ${k + 1}. ${u}`));
      else console.log(`        ${e.url}`);
      // Der Text vollstaendig, nicht gekuerzt: Er ist das, was mit
      // veroeffentlicht wird, und genau darum geht es beim Ansehen.
      console.log(e.text.split('\n').map((z2) => `        │ ${z2}`).join('\n'));
      console.log();
      continue;
    }

    try {
      console.log(`   ${nummer} ${e.datei}${istKarussell ? ` (${folien.length} Folien)` : ''} …`);
      const c = istKarussell
        ? await karussellAnlegen({
          kontoId: z.igKontoId, token: z.fbToken, bildUrls: folien, text: e.text,
        })
        : await containerAnlegen({
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

      // ⚠ AUCH IN DIE UEBERSICHT SCHREIBEN (21.09.2026). Bis hierher stand
      // das Ergebnis nur in `eintraege`; die Uebersicht kannte weiter
      // `instagram: wartet`.
      //
      // Gemessen am 21.09. an zwei Anigosha-Beitraegen, die um 14:33 und
      // 16:20 auf Instagram veroeffentlicht wurden: `eintraege` sagte
      // veroeffentlicht, `kanaele.instagram.stand` sagte wartet. Zwei
      // sichtbare Folgen, beide still:
      //
      //   · Die Freigabe-Seite liest `kanaele` (`erledigt()` in index.html).
      //     Der Beitrag blieb deshalb in der offenen Liste stehen, MIT
      //     Instagram-Knopf — ein zweiter Druck haette ihn ein zweites Mal
      //     gepostet.
      //   · Das Archiv (`zaehltHier` in freigabe-app/api/freigabe.js) liest
      //     ebenfalls `kanaele`. Veroeffentlichte Instagram-Beitraege
      //     fehlten dort also vollstaendig.
      //
      // Der Aufraeumpfad war NIE betroffen: `nochGebraucht` sieht
      // `e.veroeffentlicht`. Genau deshalb ist es so lange niemandem
      // aufgefallen — die Dateien verschwanden richtig, nur die Anzeige log.
      const spur = (liste.uebersicht ?? []).find((p) => p.datei === e.datei);
      if (spur) {
        spur.kanaele = {
          ...(spur.kanaele ?? {}),
          instagram: instagramKanal({ wann: e.veroeffentlicht, beitragId: r.id }),
        };
      }

      geaendert = true;
      veroeffentlicht += 1;
      console.log(`        ✓ veroeffentlicht — Beitrag ${r.id}`);

      // ⚠ Erst JETZT wegraeumen. Instagram holt das Bild beim Anlegen des
      // Containers; wer vorher loescht, bekommt einen Container, der ins Leere
      // greift. Und misslingt das Aufraeumen, bleibt der Beitrag trotzdem
      // gueltig — es kostet nur ein paar Kilobyte.
      //
      // ⚠ Und nur, wenn kein anderer Kanal die Datei noch braucht. Seit dem
      // 09.09.2026 entsteht auch der Facebook-Beitrag erst bei der Freigabe,
      // und TikTok postet von hier aus direkt — beide lesen aus demselben
      // Speicher. Wer hier blind loescht, laesst den naechsten Knopfdruck ins
      // Leere greifen.
      if (nochGebraucht({ liste, datei: e.datei })) {
        console.log('        (Datei bleibt liegen — ein anderer Kanal ist noch offen)');
      } else {
        // Beim Karussell alle Folien, nicht nur die erste.
        await aufraeumen({ url: e.url, urls: folien, token: z.blobToken });
      }
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
      eintraege: liste.eintraege, uebersicht: liste.uebersicht,
      tiktok: liste.tiktok, token: z.blobToken,
    });
  }
  console.log();
}

if (MODUS === 'zeigen') {
  console.log('Zum Veroeffentlichen denselben Workflow mit modus: veroeffentlichen starten.');
} else {
  console.log(`${veroeffentlicht} veroeffentlicht, ${uebersprungen} schon vorher, ${fehler} fehlgeschlagen.`);
  // ⚠ Ein Lauf, der nichts gefunden hat, darf nicht gruen sein. Sonst sieht
  // ein Tippfehler im Dateinamen wie eine gelungene Freigabe aus.
  if (NUR_DATEI && !getroffen) {
    console.error(`„${NUR_DATEI}" steht in keiner Merkliste vom ${DATUM} — nichts getan.`);
    process.exit(1);
  }
  // Ein Fehlschlag muss den Lauf roetlich faerben — sonst faellt er niemandem
  // auf, und der Beitrag fehlt still.
  if (fehler) process.exit(1);
}
