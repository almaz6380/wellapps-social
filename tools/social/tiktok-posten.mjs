// Einen einzelnen TikTok-Beitrag posten — mit den Optionen, die ein Mensch
// auf der Freigabe-Seite gewaehlt hat.
//
//   APP=anigosha DATUM=2026-09-08 DATEI=anigosha-…-s1.mp4 \
//   PRIVACY=PUBLIC_TO_EVERYONE ERLAUBT=kommentare,duett WERBUNG=eigene \
//   node tools/social/tiktok-posten.mjs
//
// --- Warum es dieses Werkzeug getrennt vom Tageslauf gibt --------------------
//
// TikToks Richtlinie zum Direktversand verlangt woertlich:
//
//     „API Clients must only start sending content materials to TikTok after
//      the user has expressly consented to the upload."
//
// Vollautomatisches Posten ist damit nicht schwierig, sondern untersagt. Der
// Tageslauf darf das Video also NICHT selbst posten; er bereitet es vor, und
// erst ein Mensch loest hier aus.
//
// Was TikTok vor jedem Beitrag angezeigt haben will, steht deshalb in der
// Freigabe-Seite: Kontoname, Privatsphaere-Stufe OHNE Voreinstellung, die drei
// Haekchen fuer Kommentare/Duett/Stitch (alle aus), der Schalter fuer
// Werbekennzeichnung (aus) und der Satz zur Music Usage Confirmation. Die
// Auswahl kommt von dort hierher.
//
// ⚠ Dieses Skript darf nie eine Voreinstellung erfinden. Fehlt PRIVACY,
// bricht es ab — genau das ist der Sinn.
//
// --- Warum das Video aus dem Blob-Speicher kommt -----------------------------
//
// Der Tageslauf lief auf einem anderen Rechner, der laengst weg ist. Das
// Video liegt aber ohnehin oeffentlich im Blob (Instagram braucht das), und
// die Merkliste kennt seine Adresse. Also von dort holen statt neu rendern.

import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { merklistenLesen, merklisteAblegen } from './veroeffentlichen/blob.mjs';
import { direktPosten, fotoPosten, inPosteingang, frischerToken }
  from './veroeffentlichen/tiktok.mjs';
import { tiktokBildAdresse } from './veroeffentlichen/bildadresse.mjs';
import { folienVideo, musikFuer } from './folien-video.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const APP = (process.env.APP || '').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const DATEI = (process.env.DATEI || '').trim();
const PRIVACY = (process.env.PRIVACY || '').trim();
// Kommagetrennt, weil ein Workflow hoechstens zehn Eingaben hat und drei
// einzelne Haekchen davon drei verbrauchen wuerden.
const ERLAUBT = (process.env.ERLAUBT || '').split(',').map((s) => s.trim()).filter(Boolean);
const WERBUNG = (process.env.WERBUNG || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!APP || !DATEI) {
  console.error('APP und DATEI muessen gesetzt sein.');
  process.exit(1);
}
if (!PRIVACY) {
  console.error('PRIVACY fehlt. Das ist Absicht: TikTok verlangt, dass der Mensch');
  console.error('die Privatsphaere-Stufe waehlt — eine Voreinstellung waere ein');
  console.error('Verstoss gegen die Richtlinie, kein Komfort.');
  process.exit(1);
}

const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt — ohne ihn ist das Video nicht zu finden.');
  process.exit(1);
}

const listen = await merklistenLesen({ datum: DATUM, token: blobToken });
const liste = listen.find((l) => l.app === APP);
if (!liste) {
  console.error(`Keine Merkliste fuer ${APP} am ${DATUM}.`);
  process.exit(1);
}

const post = (liste.uebersicht ?? []).find((p) => p.datei === DATEI);
if (!post) {
  console.error(`„${DATEI}" steht nicht in der Merkliste vom ${DATUM}.`);
  process.exit(1);
}
if (!post.url) {
  console.error(`Fuer „${DATEI}" ist keine Adresse hinterlegt — an dem Tag lief`);
  console.error('Instagram nicht mit, und nur dort wird die Datei abgelegt.');
  process.exit(1);
}

// ⚠ Die einzige Sperre gegen einen doppelten Beitrag. TikTok selbst hat keine:
// Zweimal posten ergibt zwei Beitraege.
if (post.kanaele?.tiktok?.stand === 'veroeffentlicht') {
  console.log(`„${DATEI}" ist am ${post.kanaele.tiktok.wann} schon gepostet worden.`);
  console.log('Nichts getan.');
  process.exit(0);
}

console.log(`TikTok · ${liste.name} · ${DATEI}`);
console.log(`   Privatsphaere: ${PRIVACY}`);
console.log(`   erlaubt: ${ERLAUBT.join(', ') || 'nichts'}`);
console.log(`   Werbekennzeichnung: ${WERBUNG.join(', ') || 'keine'}`);

// ⚠ Fotos gehen einen anderen Weg als Videos, und zwar von Grund auf: Fuer
// Fotos gibt es bei TikTok KEINEN Dateiupload. `photo_images` nimmt Adressen,
// TikTok holt die Bilder selbst ab (`PULL_FROM_URL`). Also wird hier nichts
// heruntergeladen — es gehen Adressen mit.
//
// ⚠ Aber NICHT die Blob-Adressen: TikTok holt nur von einem Praefix ab, das
// im Entwicklerportal verifiziert ist. Der Blob-Host ist das nicht,
// `wellapps-freigabe.vercel.app` schon — `tiktokBildAdresse` rechnet um.
//
// ⚠ Beim Karussell ALLE Folien, nicht nur die erste. `urls` ist gesetzt, `url`
// bleibt daneben die erste Folie; wer auf `!post.url` prueft, haelt jedes
// Karussell fuer kaputt.
//
// ⚠ Nur fuer Fotos umrechnen. Bei einem Video steht in `post.url` die
// mp4-Datei; die durch die Bild-Durchreiche zu schicken ergaebe eine Adresse,
// die niemand abruft und die jene Route ohnehin ablehnt.
const folien = Array.isArray(post.urls) ? post.urls.filter(Boolean) : [];
const bildUrls = post.istVideo ? []
  : (folien.length >= 2 ? folien : [post.url].filter(Boolean)).map(tiktokBildAdresse);

let tmp = null;
if (post.istVideo) {
  const antwort = await fetch(post.url);
  if (!antwort.ok) throw new Error(`Video nicht erreichbar: HTTP ${antwort.status}`);
  tmp = join(tmpdir(), DATEI);
  writeFileSync(tmp, Buffer.from(await antwort.arrayBuffer()));
} else {
  console.log(`   ${bildUrls.length} Bild${bildUrls.length > 1 ? 'er' : ''} — TikTok holt sie selbst ab`);
}

try {
  const z = zugaenge(APP);
  const { token } = await frischerToken({
    clientKey: z.tiktokKey, clientSecret: z.tiktokSecret, refreshToken: z.tiktokRefresh,
  });

  const wahl = {
    privacy: PRIVACY,
    kommentare: ERLAUBT.includes('kommentare'),
    duett: ERLAUBT.includes('duett'),
    stitch: ERLAUBT.includes('stitch'),
    eigeneMarke: WERBUNG.includes('eigene'),
    fremdeMarke: WERBUNG.includes('fremde'),
  };

  // ⚠ SOLANGE TIKTOK DIE APP NICHT GEPRUEFT HAT, GEHT NUR PRIVAT.
  //
  // Am 19.09.2026 der erste echte Versuch, „Oeffentlich" gewaehlt:
  //
  //     403: Please review our integration guidelines
  //          [unaudited_client_can_only_post_to_private_accounts]
  //
  // Das liegt weder am Beitrag noch an den Bildadressen, sondern am
  // Pruefstatus der App (eingereicht am 07.09.). Bis zur Freigabe nimmt TikTok
  // von uns nur `SELF_ONLY` an — und ein privater Beitrag ist nicht das, was
  // jemand wollte, der „Oeffentlich" getippt hat.
  //
  // Der Posteingang kennt diese Schranke NICHT: Dort landet ein Entwurf, den
  // ein Mensch in der App fertigstellt und dabei selbst oeffentlich stellt.
  // Also weichen wir dorthin aus, statt still etwas Privates zu posten oder
  // mit einer Fehlermeldung stehen zu bleiben.
  //
  // ⚠ Das ist KEIN stiller Ersatz: Der Stand heisst danach „im Posteingang",
  // nicht „veroeffentlicht", und der Grund steht daneben. Wer die Seite
  // ansieht, weiss, dass noch ein Handgriff fehlt.
  const direktVersuch = () => (post.istVideo
    ? direktPosten({ token, datei: tmp, titel: post.text, wahl })
    // ⚠ `text`, nicht `titel`: Bei Fotos ist `title` eine Ueberschrift von
    // 90 Zeichen, die Bildunterschrift gehoert nach `description`.
    // `fotoPosten` teilt das selbst auf. Beim Video daneben ist `titel`
    // richtig — dort gibt es nur das eine Feld, mit 2200 Zeichen.
    : fotoPosten({ token, bildUrls, text: post.text, wahl, direkt: true }));

  // ⚠ UND WENN TIKTOK DIE BILDER NICHT ABHOLEN DARF: ALS DIASHOW-VIDEO.
  //
  // Fotos kennen nur `PULL_FROM_URL` — TikTok holt sie selbst, und das
  // Praefix ihrer Adresse muss im Entwicklerportal verifiziert sein. Ist es
  // das nicht, kommt `url_ownership_unverified`, und daran aendert kein
  // Umbau der Adresse etwas; es ist eine Einstellung ausserhalb des Repos.
  //
  // Videos gehen dagegen als Datei hoch. Genau deshalb landet das taegliche
  // Reel seit Wochen im Posteingang, waehrend das Karussell scheiterte — der
  // Posteingang war nie das Problem, die Bilder kamen nur nicht dort an.
  // Also werden die Folien zu einem Video und gehen denselben Weg wie das
  // Reel.
  //
  // ⚠ Gebaut wird aus den BLOB-Adressen, nicht aus der Durchreiche: Wir holen
  // die Bilder selbst, da braucht es keinen Umweg ueber die verifizierte
  // Domain.
  //
  // ⚠ Dieselbe Regel wie oben bei `bildUrls`: `urls` ODER `url`, nie beides.
  // Angehaengt statt gewaehlt stuende Folie 1 am Ende ein zweites Mal — in
  // einem Video faellt das erst beim Ansehen auf, also nach dem Hochladen.
  const rohUrls = folien.length >= 2 ? folien : [post.url].filter(Boolean);

  let diashow = false;
  const inDenPosteingang = async () => {
    if (post.istVideo) return inPosteingang({ token, datei: tmp });
    try {
      return await fotoPosten({ token, bildUrls, text: post.text, direkt: false });
    } catch (e) {
      if (!/url_ownership_unverified/.test(e.message)) throw e;
      console.log('   ⚠ TikTok darf die Bildadressen nicht abholen '
        + '(URL-Praefix im Portal nicht verifiziert). Die Folien gehen als Diashow-Video.');
      tmp = join(tmpdir(), `${DATEI.replace(/\.[^.]+$/, '')}.mp4`);
      const v = await folienVideo({ bildUrls: rohUrls, ziel: tmp, tonDatei: musikFuer(APP) });
      console.log(`   Diashow gebaut: ${v.folien} Folien, ${v.sekunden} s, 1080×1920`
        + `${v.ton ? ', mit Musikteppich' : ', stumm'}.`);
      diashow = true;
      return inPosteingang({ token, datei: tmp });
    }
  };

  let r;
  let entwurf = false;
  try {
    r = await direktVersuch();
  } catch (e) {
    const pruefung = /unaudited_client_can_only_post_to_private_accounts/.test(e.message);
    const adresse = /url_ownership_unverified/.test(e.message);
    if (!pruefung && !adresse) throw e;
    console.log(pruefung
      ? '   ⚠ TikTok laesst diese App noch nicht oeffentlich posten '
        + '(App-Pruefung steht aus). Der Beitrag geht stattdessen in den Posteingang.'
      : '   ⚠ TikTok darf die Bildadressen nicht abholen. Ab in den Posteingang.');
    r = await inDenPosteingang();
    entwurf = true;
  }

  // Nach der Diashow ist es ein Video — die Ausgabe darf nicht mehr von
  // `post.istVideo` ausgehen, sonst meldet sie Bilder, die keiner hochgeladen hat.
  const wasHochging = diashow || post.istVideo
    ? `${r.mb} MB`
    : `${r.anzahl} Bild${r.anzahl > 1 ? 'er' : ''}`;
  console.log(`${entwurf ? '✓ im Posteingang' : '✓ gepostet'} — publish_id ${r.publishId} `
    + `(${wasHochging}${diashow ? ' Diashow' : ''}${r.zeichen ? `, ${r.zeichen} Zeichen` : ''})`);
  if (entwurf) {
    console.log('   In der TikTok-App den Entwurf oeffnen, Text einfuegen und posten.');
  }

  // ⚠ Sofort vermerken. Ohne den Vermerk sieht der Beitrag auf der
  // Freigabe-Seite weiter offen aus, und der naechste Tipper macht einen
  // zweiten daraus — TikTok hat dagegen keine Sperre.
  //
  // Zurueckgeschrieben wird die GANZE Merkliste dieser App, nicht nur der eine
  // Eintrag: Sie liegt als eine Datei im Blob. `liste` ist eben frisch gelesen
  // worden, `post` ist ein Verweis hinein — die Aenderung ist also schon drin.
  post.kanaele = post.kanaele ?? {};
  post.kanaele.tiktok = {
    stand: entwurf ? 'posteingang' : 'veroeffentlicht',
    publishId: r.publishId,
    // Beim Entwurf waehlt der Mensch die Sichtbarkeit in der App — hier eine
    // hinzuschreiben waere eine Behauptung.
    ...(entwurf
      ? {
        meldung: diashow
          ? 'Als Diashow-Video im Posteingang (TikTok darf die Bildadressen nicht '
            + 'abholen) — in der TikTok-App fertigstellen.'
          : 'App-Pruefung steht aus — in der TikTok-App fertigstellen.',
        ...(diashow ? { diashow: true } : {}),
      }
      : { privacy: PRIVACY }),
    wann: new Date().toISOString(),
  };
  await merklisteAblegen({
    datum: DATUM, appSchluessel: APP, name: liste.name,
    eintraege: liste.eintraege, uebersicht: liste.uebersicht,
    tiktok: liste.tiktok, token: zugaenge(APP).blobToken,
  });
  console.log('   Merkliste aktualisiert.');
} catch (e) {
  // ⚠ AUCH DEN FEHLSCHLAG VERMERKEN. Bis zum 19.09.2026 warf dieses Skript
  // nur, und die Merkliste blieb, wie sie war. Auf der Freigabe-Seite stand
  // danach derselbe Text wie davor — es sah aus, als sei gar nichts passiert,
  // obwohl TikTok geantwortet hatte. Der Grund lag allein im Laufprotokoll,
  // und daran kommt vom Handy niemand heran.
  //
  // Geschrieben wird, bevor weitergeworfen wird: Der Lauf soll rot bleiben.
  try {
    post.kanaele = post.kanaele ?? {};
    post.kanaele.tiktok = {
      stand: 'fehler',
      meldung: String(e.message).slice(0, 300),
      wann: new Date().toISOString(),
    };
    await merklisteAblegen({
      datum: DATUM, appSchluessel: APP, name: liste.name,
      eintraege: liste.eintraege, uebersicht: liste.uebersicht,
      tiktok: liste.tiktok, token: zugaenge(APP).blobToken,
    });
    console.error('   Fehler in der Merkliste vermerkt.');
  } catch (e2) {
    // Der urspruengliche Fehler ist der wichtigere — diesen nur danebenlegen.
    console.error(`   ⚠ Vermerk misslungen: ${e2.message}`);
  }
  throw e;
} finally {
  // Ohne Video gibt es keine Temp-Datei — Fotos holt TikTok selbst ab.
  if (tmp) { try { unlinkSync(tmp); } catch { /* der Ordner raeumt sich selbst */ } }
}
