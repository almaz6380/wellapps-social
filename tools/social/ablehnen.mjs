// Beitraege ablehnen — einzeln auf Knopfdruck, oder als Aufraeumlauf.
//
//   APP=anigosha DATUM=2026-09-10 DATEI=anigosha-…-s1.jpg \
//   node tools/social/ablehnen.mjs
//
//   APPS=alle TAGE=8 node tools/social/ablehnen.mjs      alles Offene der 8 Tage
//   APPS=fullrep,swaply node tools/social/ablehnen.mjs   nur heute, zwei Apps
//   TROCKEN=1 APPS=alle TAGE=8 node tools/social/ablehnen.mjs    nur zeigen
//
// ⚠ TROCKEN=1 schreibt nichts und loescht nichts. Bei einem Lauf, der 116
// Dateien unwiederbringlich entfernt, ist die Liste vorher anzusehen keine
// Kuer — sie ist die einzige Gelegenheit, einen Fehler in der Auswahl zu
// bemerken.
//
// --- Was Ablehnen heisst und was nicht ---------------------------------------
//
// Es heisst: Dieser Beitrag geht nicht raus. Er wird in der Merkliste als
// `abgelehnt` vermerkt, sein Instagram-Eintrag verschwindet aus `eintraege`
// (damit ihn auch ein Freigabe-Lauf nicht mehr anfassen kann), und die
// Freigabe-Seite zeigt ihn danach nur noch durchgestrichen — ohne Knoepfe, in
// der Klappe „N erledigt".
//
// Es heisst NICHT: Der Beitrag verschwindet. Er bleibt in der Uebersicht
// stehen — sonst waere hinterher nicht mehr nachvollziehbar, was an dem Tag
// verworfen wurde und warum ein Nachlauf existiert.
//
// ⚠ Was schon oeffentlich ist, laesst sich hier nicht zurueckholen. Im
// EINZELFALL bricht das Skript dann ab: Ein „abgelehnt" ueber einem laufenden
// Beitrag waere eine Luege in der Anzeige, und die Freigabe-Seite verlaesst
// sich auf diesen Abbruch. Im MENGENLAUF wird derselbe Beitrag uebersprungen
// und genannt — ein einzelner veroeffentlichter darf nicht 115 andere
// aufhalten.
//
// --- Warum es den Mengenlauf gibt (21.09.2026) -------------------------------
//
// Josef: „Die alten Posts, die ich noch nicht gepostet habe, in der
// Freigabe-App loeschen, weil die nicht gut aussehen." Gemessen waren das 116
// offene Beitraege ueber acht Tage. Ein Beitrag je Workflow-Lauf sind 116
// Laeufe — das ist keine Loesung, sondern eine Zumutung.
//
// ⚠ Geschrieben wird EINMAL JE APP UND TAG, nicht einmal je Beitrag.
// `merklisteAblegen` ist ein Vollersatz der Datei; 116-mal aufgerufen waere es
// 116 Vollersetzungen und 116 Gelegenheiten, mittendrin abzubrechen.
//
// --- Und der Ersatz? ---------------------------------------------------------
//
// Den erzeugt dieses Skript NICHT. Ein neuer Beitrag braucht die fuenf Repos
// und einen Browser zum Rendern; das ist der Tageslauf, und der laeuft mit
// `variante: N`. Die Freigabe-Seite loest beides nacheinander aus. Getrennt,
// weil Ablehnen in zwei Sekunden fertig ist und Rendern zehn Minuten dauert —
// wer beides in einen Lauf packt, laesst den Menschen zehn Minuten im Unklaren
// darueber, ob wenigstens das Ablehnen geklappt hat.
//
// ⚠ Und deshalb loest der MENGENLAUF erst recht keinen Ersatz aus: Fuenf Apps
// mal acht Tage waeren vierzig Tageslaeufe.

import { merklistenLesen, merklisteAblegen, aufraeumen } from './veroeffentlichen/blob.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';
import { auswaehlen, anwenden, tageRueckwaerts } from './ablehnen-auswahl.mjs';

const APP = (process.env.APP || '').trim();
const APPS = (process.env.APPS || '').trim();
const DATUM = (process.env.DATUM || new Date().toISOString().slice(0, 10)).trim();
const DATEI = (process.env.DATEI || '').trim();
const TAGE = (process.env.TAGE || '1').trim();
const TROCKEN = ['1', 'true', 'ja'].includes((process.env.TROCKEN || '').trim().toLowerCase());

// ⚠ `alle` bleibt bewusst unaufgeloest: Welche Apps es gibt, entscheidet die
// Merkliste des Tages, nicht eine zweite Liste hier, die veralten kann.
const gewaehlteApps = (APPS || APP)
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!gewaehlteApps.length) {
  console.error('APP oder APPS muss gesetzt sein (eine App, eine Komma-Liste oder `alle`).');
  process.exit(1);
}
if (DATEI && (gewaehlteApps.length > 1 || gewaehlteApps[0] === 'alle')) {
  console.error('DATEI gilt immer genau einer App. Mit mehreren Apps waere nicht');
  console.error('entscheidbar, welche gemeint ist.');
  process.exit(1);
}
if (DATEI && Number(TAGE) > 1) {
  console.error('DATEI und TAGE>1 zusammen ergeben keinen Sinn: Ein Dateiname gehoert');
  console.error('zu genau einem Tag.');
  process.exit(1);
}

const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt — ohne ihn ist die Merkliste nicht zu finden.');
  process.exit(1);
}

const alleApps = gewaehlteApps.length === 1 && gewaehlteApps[0] === 'alle';
const tage = tageRueckwaerts(DATUM, DATEI ? 1 : TAGE);

let abgelehnt = 0;
let uebersprungenGesamt = 0;
let geraeumt = 0;
const nochInTikTok = [];

for (const tag of tage) {
  const listen = await merklistenLesen({ datum: tag, token: blobToken });
  const dran = listen.filter((l) => alleApps || gewaehlteApps.includes(l.app));

  if (DATEI && !dran.length) {
    console.error(`Keine Merkliste fuer ${gewaehlteApps[0]} am ${tag}.`);
    process.exit(1);
  }

  for (const liste of dran) {
    const { nehmen, uebersprungen, gefunden } = auswaehlen({ liste, datei: DATEI || null });

    // --- Der Einzelfall: laut scheitern, damit die Freigabe-Seite es merkt ---
    if (DATEI) {
      if (!gefunden) {
        console.error(`„${DATEI}" steht nicht in der Merkliste vom ${tag}.`);
        process.exit(1);
      }
      if (!nehmen.length) {
        const grund = uebersprungen[0]?.grund ?? '';
        if (grund.startsWith('schon abgelehnt')) {
          console.log(`„${DATEI}" ist ${grund}. Nichts getan.`);
          process.exit(0);
        }
        console.error(`„${DATEI}" ist bereits ${grund}.`);
        console.error('Ablehnen waere hier nur ein falscher Vermerk — der Beitrag ist');
        console.error('draussen. Loeschen geht nur im jeweiligen Netzwerk.');
        process.exit(1);
      }
    }

    if (!nehmen.length) {
      uebersprungenGesamt += uebersprungen.length;
      continue;
    }

    const z = zugaenge(liste.app);
    const { entfernteEintraege, wegraeumen, tiktokEntwuerfe } = anwenden({ liste, posts: nehmen });

    if (TROCKEN) {
      console.log(`○ ${tag} · ${liste.app}: ${nehmen.length} wuerden abgelehnt`
        + (entfernteEintraege ? `, ${entfernteEintraege} Instagram-Eintrag/Eintraege entfernt` : '')
        + `, ${wegraeumen.length} Datei(en) geloescht`);
      for (const p of nehmen) console.log(`   · ${p.datei}`);
      for (const u of uebersprungen) console.log(`   · uebersprungen: ${u.datei} — ${u.grund}`);
      abgelehnt += nehmen.length;
      uebersprungenGesamt += uebersprungen.length;
      nochInTikTok.push(...tiktokEntwuerfe);
      continue;
    }

    // ⚠ ERST schreiben, DANN loeschen. Andersherum waeren bei einem Abbruch
    // dazwischen die Dateien weg und die Merkliste zeigte sie weiter als offen
    // an — ein Zustand, aus dem niemand mehr herausfindet.
    await merklisteAblegen({
      datum: tag, appSchluessel: liste.app, name: liste.name,
      eintraege: liste.eintraege, uebersicht: liste.uebersicht,
      tiktok: liste.tiktok, token: z.blobToken,
    });

    console.log(`✓ ${tag} · ${liste.app}: ${nehmen.length} abgelehnt`
      + (entfernteEintraege ? `, ${entfernteEintraege} Instagram-Eintrag/Eintraege entfernt` : ''));
    for (const u of uebersprungen) console.log(`   · uebersprungen: ${u.datei} — ${u.grund}`);

    abgelehnt += nehmen.length;
    uebersprungenGesamt += uebersprungen.length;
    nochInTikTok.push(...tiktokEntwuerfe);

    // ⚠ Je App zaehlen, nicht den Gesamtzaehler abfragen. Der Vergleich
    // „alle weggeraeumt?" waere sonst ab der zweiten App immer falsch — genau
    // die Art Zaehlfehler, die einen Lauf gruen aussehen laesst.
    let hier = 0;
    for (const w of wegraeumen) {
      const ok = await aufraeumen({ url: w.url, urls: w.urls, token: z.blobToken });
      if (ok) hier += 1;
    }
    geraeumt += hier;
    if (wegraeumen.length) {
      console.log(`   ${hier === wegraeumen.length ? `${hier}` : `${hier} von ${wegraeumen.length}`} Datei(en) weggeraeumt.`);
    }
  }
}

console.log(TROCKEN
  ? `\nTROCKEN — nichts veraendert. ${abgelehnt} waeren abgelehnt, ${uebersprungenGesamt} uebersprungen.`
  : `\n${abgelehnt} abgelehnt · ${uebersprungenGesamt} uebersprungen · ${geraeumt} Datei(en) geloescht.`);

if (nochInTikTok.length) {
  console.log(`\n⚠ ${nochInTikTok.length} dieser Beitraege liegen als ENTWURF im TikTok-Posteingang.`);
  console.log('  Die kann keine API loeschen — sie muessen in der TikTok-App selbst');
  console.log('  verworfen werden. Der Vermerk hier aendert daran nichts.');
}
