// Die erzeugten Beitraege in die Kanaele bringen — als ENTWURF, nie direkt.
//
//   node tools/social/posten.mjs --trocken           was passieren wuerde
//   node tools/social/posten.mjs --trocken --app fullrep
//   node tools/social/posten.mjs --echt              wirklich hochladen
//
// ⚠ Ohne --echt wird nichts gesendet. Und --echt bricht ab, wenn ein
// Zugangsdatum fehlt, statt die Haelfte hochzuladen: Ein halb gepostetes
// Tagespaket ist schlimmer als ein gar nicht gepostetes, weil niemand mehr
// weiss, was schon draussen ist.
//
// --- Warum ueberall Entwurf und nirgends Direktversand ----------------------
//
// Josefs Entscheidung vom 30.08.2026. Sie passt zur Sache: Die Beitraege
// tragen Saetze wie „Laut Studien". Solche Inhalte ungelesen oeffentlich zu
// stellen waere die eine Automatisierung, die man hier nicht will.
//
// --- Die drei Kanaele koennen NICHT dasselbe --------------------------------
//
//   Facebook   echter Entwurf (`published=false`), nimmt die Datei direkt.
//              Josef gibt in der Meta Business Suite frei.
//   TikTok     Entwurf im Posteingang der App, nimmt die Datei direkt.
//              Josef gibt in der TikTok-App frei.
//              (Automatisch oeffentlich geht ohnehin nicht — TikTok sperrt
//              unauditierte Apps auf privat.)
//   Instagram  KEIN Entwurf, und es nimmt KEINE Dateien, nur oeffentliche
//              Links. Deshalb faellt es hier heraus: Der Container entsteht
//              erst beim Freigeben, weil er nach 24 Stunden verfaellt.
//
// Diese Ungleichheit ist keine Nachlaessigkeit, sondern das, was die drei
// Schnittstellen hergeben. Sie zu verstecken haette bedeutet, fuer Instagram
// etwas zu versprechen, das es nicht gibt.

import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ladeApps } from './waehlen.mjs';
import { bericht as geheimBericht, zugaenge } from './veroeffentlichen/geheimnisse.mjs';
import { entwurfAnlegen } from './veroeffentlichen/facebook.mjs';
import { inPosteingang, frischerToken } from './veroeffentlichen/tiktok.mjs';
import { hochladen, merklisteAblegen } from './veroeffentlichen/blob.mjs';
import { captionAus, riechtNachBeiblatt } from './vorflug.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const wert = (n, s) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? s : process.argv[i + 1]; };
const hat = (n) => process.argv.includes(`--${n}`);

const ECHT = hat('echt');
const DATUM = wert('datum', new Date().toISOString().slice(0, 10));
const NUR_APP = wert('app', null);

// ⚠ --kanal ist fuer den Fall gebaut, der am 05.09. eingetreten ist: Zwei von
// drei Kanaelen liefen durch, der dritte scheiterte. Ein einfacher zweiter
// Lauf haette die geglueckten Beitraege ein zweites Mal angelegt — zwei
// gleiche Entwuerfe auf der Seite, und niemand weiss mehr, welcher der neue
// ist. Mit `--kanal instagram` wird nur der offene nachgeholt.
const NUR_KANAELE = (wert('kanal', '') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

// ⚠ Ueber ladeApps(), NICHT direkt aus der Datei: Nur so greift die
// SOCIAL_WURZEL-Weiche (siehe waehlen.mjs). Wer hier wieder selbst liest,
// baut auf einem Runner Pfade zusammen, die es nicht gibt — und posten.mjs
// meldet dann seelenruhig „Nichts zu posten", statt zu scheitern.
const APPS = ladeApps();

// --- Was liegt fuer diesen Tag bereit? --------------------------------------
//
// Die Dateien auf der Platte allein reichen NICHT als Antwort, und daran haette
// man sich beim ersten echten Lauf boese verbrannt: Wer den Tageslauf zweimal
// startet, hat zwei Saetze Dateien im selben Ordner — beim Entwickeln waren es
// fuenf statt zwei. Alle zu posten hiesse, denselben Tag mehrfach zu
// veroeffentlichen.
//
// Deshalb entscheidet der LEDGER, was zaehlt: Er haelt je Tag genau eine Zeile
// pro Beitrag, mit dem Seed als Kennung („seed84273"). Der Seed steht auch im
// Dateinamen („…-s84273.jpg"). Die Schnittmenge aus beidem ist das Tagespaket.
//
// Der Ledger allein reicht umgekehrt auch nicht — er kennt keine Dateinamen.
// Beides zusammen ist die Antwort.
function tagesSeeds() {
  const pfad = join(HIER, 'ledger.json');
  if (!existsSync(pfad)) return null;
  const ledger = JSON.parse(readFileSync(pfad, 'utf8'));
  const raus = new Map();
  for (const z of ledger.zeilen ?? []) {
    if (z.datum !== DATUM) continue;
    if (!raus.has(z.app)) raus.set(z.app, new Set());
    // „seed84273" → „84273"
    raus.get(z.app).add(String(z.inhalt ?? '').replace(/^seed/, ''));
  }
  return raus;
}

function tagesposten() {
  const seeds = tagesSeeds();
  const raus = [];
  for (const [k, app] of Object.entries(APPS.apps ?? APPS)) {
    if (NUR_APP && k !== NUR_APP) continue;
    if (!app.kanaele?.length) continue;

    const ordner = join(app.pfad, 'out', 'social', DATUM);
    if (!existsSync(ordner)) continue;

    for (const f of readdirSync(ordner).filter((x) => x.endsWith('.txt'))) {
      const beiblatt = readFileSync(join(ordner, f), 'utf8');
      const stamm = f.replace(/\.txt$/, '');

      // Steht der Seed dieser Datei nicht im Ledger, ist sie ein Rest aus
      // einem frueheren Lauf desselben Tages. Ueberspringen, nicht posten.
      const seed = stamm.match(/-s(\d+)(?:-[a-z]+)?$/)?.[1];
      if (seeds && !(seed && seeds.get(k)?.has(seed))) continue;
      // Das Feed-Bild ist das zu postende; das Story-Bild ist eine Beigabe.
      const medium = ['.mp4', '-feed.jpg', '.jpg'].map((e) => join(ordner, stamm + e))
        .find(existsSync);
      if (!medium) continue;
      const kanaele = NUR_KANAELE.length
        ? app.kanaele.filter((x) => NUR_KANAELE.includes(x))
        : app.kanaele;
      if (!kanaele.length) continue;
      raus.push({ app: k, name: app.name, kanaele, medium,
        text: captionAus(beiblatt).trim() });
    }
  }
  return raus;
}

// --- Lauf -------------------------------------------------------------------
const posten = tagesposten();

console.log(`${ECHT ? 'Hochladen' : 'Trockenlauf (ohne --echt wird nichts gesendet)'} `
  + `fuer ${DATUM}\n`);

if (!posten.length) {
  console.log('Nichts zu posten.');
  console.log('  Entweder gibt es fuer diesen Tag keine Beitraege — dann erst');
  console.log('    node tools/social/lauf.mjs --echt');
  console.log('  oder in apps.json steht bei "kanaele" noch nichts. Solange die');
  console.log('  Profile nicht angelegt sind, ist das richtig so.');
  process.exit(0);
}

// ⚠ Je APP und Kanal, nicht je Kanal: Jede App hat eigene Konten. Eine
// gemeinsame Garnitur haette Mahjong-Werbung auf der WELLbooked!-Seite
// gepostet, und das faellt erst auf, wenn es draussen ist.
const gebraucht = [...new Map(
  posten.map((p) => [p.app, { app: p.app, kanaele: p.kanaele }]),
).values()];
// ⚠ Das Rettungsnetz unter captionAus(). Am 05.09. trug ein Facebook-Entwurf
// das ganze Beiblatt — mit den richtigen Antworten des Quiz. Aufgefallen ist
// das nur, weil jemand hingesehen hat. Ab jetzt faellt es hier auf, VOR dem
// Hochladen, und der Lauf bricht ab, statt die Haelfte zu posten.
const verdaechtig = posten
  .map((p) => ({ p, grund: p.text.trim() ? riechtNachBeiblatt(p.text) : 'leerer Text' }))
  .filter((x) => x.grund);

if (verdaechtig.length) {
  console.error('✗ Abbruch: Bei diesen Beitraegen ist der Text kein Caption-Text:\n');
  for (const { p, grund } of verdaechtig) {
    console.error(`  ${p.name} · ${basename(p.medium)}`);
    console.error(`    Verraeter: ${grund}`);
    console.error(`    Anfang:    ${p.text.slice(0, 90).replace(/\n/g, ' ⏎ ')}\n`);
  }
  console.error('  Wahrscheinlich hat sich das Beiblatt-Format eines Repos geaendert');
  console.error('  und captionAus() findet die Ueberschrift nicht mehr.');
  process.exit(1);
}

const g = geheimBericht(gebraucht);
console.log('Zugangsdaten');
console.log(g.text || '  (keine noetig)');
console.log();

if (ECHT && !g.vollstaendig) {
  console.error('✗ Abbruch: Es fehlen Zugangsdaten (siehe oben).\n');
  console.error('  Sie gehoeren nach GitHub → Settings → Secrets and variables →');
  console.error('  Actions — dorthin, wo auch die Signierschluessel liegen.');
  console.error('  NICHT ins Repo und NICHT in den Chat.\n');
  console.error('  Absichtlich wird gar nichts hochgeladen statt nur die Haelfte:');
  console.error('  Ein halb gepostetes Tagespaket ist schlimmer als ein gar nicht');
  console.error('  gepostetes, weil niemand mehr weiss, was schon draussen ist.');
  process.exit(1);
}

// Den TikTok-Zugang EINMAL je Lauf erneuern, nicht je Beitrag: Jede
// Erneuerung kann den Refresh-Token austauschen, und mehrere Erneuerungen
// hintereinander wuerden die Rotation nur unnoetig oft ausloesen.
// Den TikTok-Zugang EINMAL JE APP erneuern, nicht je Beitrag: Jede
// Erneuerung kann den Refresh-Token austauschen, und mehrere Erneuerungen
// hintereinander wuerden die Rotation nur unnoetig oft ausloesen.
// ⚠ Je App ein eigener Speicher — es sind verschiedene TikTok-Konten.
const ttSpeicher = new Map();
async function tiktokToken(appSchluessel) {
  if (!ECHT) return null;
  if (ttSpeicher.has(appSchluessel)) return ttSpeicher.get(appSchluessel);
  const z = zugaenge(appSchluessel);
  const r = await frischerToken({
    clientKey: z.tiktokKey, clientSecret: z.tiktokSecret, refreshToken: z.tiktokRefresh,
  });
  if (r.neuerRefresh) {
    // ⚠ Laut TikToks Doku: „You must use the newly-returned token if the value
    // is different than the previous one." Wer das ueberliest, bei dem laeuft
    // es genau einmal — der naechste Lauf scheitert mit einer Meldung, die
    // nach einem widerrufenen Zugang aussieht.
    //
    // Der neue Wert wird hier ABSICHTLICH NICHT ausgegeben: Er ist ein
    // Geheimnis, und diese Ausgabe landet in GitHub-Protokollen.
    const name = `TIKTOK_REFRESH_TOKEN_${appSchluessel.toUpperCase()}`;
    console.log(`\n   ⚠ TikTok hat den Refresh-Token fuer ${appSchluessel} AUSGETAUSCHT.`);
    console.log(`     Der neue Wert muss ins Secret ${name},`);
    console.log('     sonst schlaegt der naechste Lauf fehl. Er steht hier');
    console.log('     bewusst nicht — Protokolle sind kein Ort fuer Geheimnisse.');
    console.log('     (Der Zeitplan-Workflow schreibt ihn spaeter selbst zurueck.)\n');
  }
  ttSpeicher.set(appSchluessel, r.token);
  return r.token;
}

// Was Instagram spaeter freigeben soll, je App. Wird am Ende als Merkliste
// abgelegt — siehe merklisteAblegen() fuer den Grund.
const merkliste = new Map();

// ⚠ Was bei TikTok landet, landet OHNE Text.
//
// Der Aufruf, mit dem wir hochladen (`inbox/video/init`), hat schlicht kein
// Feld dafuer — Titel, Beschreibung und Hashtags gibt es dort nicht. Ein
// Textfeld kennt nur der Direktversand, und den duerfen ungepruefte Apps
// nicht benutzen (ihre Beitraege blieben privat, siehe tiktok.mjs).
//
// Der Text ist also da, er kommt nur nicht durch die Leitung. Damit er
// trotzdem am Handy zum Kopieren bereitsteht, sammeln wir ihn hier und
// schreiben ihn am Ende in die Zusammenfassung des Workflow-Laufs.
const nachzutragen = [];

// Was die Freigabe-Seite spaeter anzeigt: je App alle Beitraege des Tages mit
// dem Ergebnis JEDES Kanals — nicht nur der Instagram-Teil.
//
// ⚠ Getrennt von `merkliste`. Die entscheidet, was Instagram noch zu tun hat;
// diese hier ist reine Ansicht. Sie darf nie zur Grundlage einer
// Veroeffentlichung werden.
const uebersicht = new Map();

let fertig = 0, offen = 0;
for (const p of posten) {
  console.log(`━━ ${p.name} · ${basename(p.medium)}`);
  const istVideo = /\.(mp4|mov)$/i.test(p.medium);
  const z = zugaenge(p.app);
  let inTiktok = false;
  const spur = { datei: basename(p.medium), text: p.text, istVideo, kanaele: {} };

  for (const kanal of p.kanaele) {
    try {
      if (kanal === 'facebook') {
        const r = await entwurfAnlegen({
          seitenId: z.fbSeitenId, token: z.fbToken,
          datei: p.medium, text: p.text, trocken: !ECHT,
        });
        console.log(r.trocken
          ? `   ▸ facebook   wuerde ${r.art}-Entwurf anlegen (${r.zeichen} Zeichen Text)`
          : `   ✓ facebook   Entwurf ${r.id} — freigeben in der Meta Business Suite`);
        fertig += r.trocken ? 0 : 1;
        spur.kanaele.facebook = { stand: r.trocken ? 'trocken' : 'entwurf', id: r.id ?? null };

      } else if (kanal === 'tiktok') {
        if (!istVideo) {
          console.log('   – tiktok     uebersprungen (kein Video)');
          spur.kanaele.tiktok = { stand: 'uebersprungen', grund: 'kein Video' };
          continue;
        }
        const r = await inPosteingang({
          token: await tiktokToken(p.app), datei: p.medium, trocken: !ECHT,
        });
        console.log(r.trocken
          ? `   ▸ tiktok     wuerde ${r.mb} MB in den Posteingang laden`
          : `   ✓ tiktok     im Posteingang (${r.mb} MB) — freigeben in der TikTok-App`);
        fertig += r.trocken ? 0 : 1;
        // Auch im Trockenlauf: Dann ist die Zusammenfassung die Vorschau auf
        // den Text, der sonst nirgends zu sehen waere.
        inTiktok = true;
        spur.kanaele.tiktok = { stand: r.trocken ? 'trocken' : 'posteingang' };

      } else if (kanal === 'instagram') {
        // Instagram bekommt hier NUR das Bild an eine oeffentliche Adresse
        // gelegt — den Container gibt es erst beim Freigeben.
        //
        // ⚠ Beides zugleich waere ein Fehler: Der Container verfaellt nach 24
        // Stunden. Einer, der morgens entsteht und abends freigegeben wird,
        // kann tot sein, und die Meldung saehe aus wie ein kaputter Zugang.
        const r = await hochladen({
          datei: p.medium, token: z.blobToken,
          praefix: `social/${DATUM}`, trocken: !ECHT,
        });
        console.log(r.trocken
          ? `   ▸ instagram  wuerde das Bild ablegen unter ${r.pfad}`
          : `   ✓ instagram  Bild liegt bereit — Container entsteht beim Freigeben`);
        if (!r.trocken) {
          console.log(`     ${r.url}`);
          if (!merkliste.has(p.app)) merkliste.set(p.app, []);
          merkliste.get(p.app).push({
            datei: basename(p.medium), url: r.url, blobPfad: r.pfad,
            text: p.text, istVideo,
          });
          spur.url = r.url;
        }
        spur.kanaele.instagram = { stand: r.trocken ? 'trocken' : 'wartet' };
        offen += 1;
      }
    } catch (e) {
      console.log(`   ✗ ${kanal.padEnd(10)} ${e.message}`);
      spur.kanaele[kanal] = { stand: 'fehler', meldung: e.message };
    }
  }
  if (!uebersicht.has(p.app)) uebersicht.set(p.app, { name: p.name, posten: [] });
  uebersicht.get(p.app).posten.push(spur);
  if (inTiktok) nachzutragen.push({ name: p.name, datei: basename(p.medium), text: p.text });
  console.log();
}

// ⚠ Erst NACH allen Beitraegen, und nur bei einem echten Lauf: Die Liste ist
// die Verabredung mit dem Freigabelauf. Waere sie schon nach dem ersten
// Beitrag geschrieben, stuende beim Abbruch mittendrin eine unvollstaendige
// da, die vollstaendig aussieht.
// ⚠ Ueber die UEBERSICHT laufen, nicht ueber die Merkliste: Eine App, die
// heute nur ein TikTok-Video hat, steht in `merkliste` gar nicht — sie
// waere auf der Freigabe-Seite unsichtbar, und zwar so, dass es aussieht,
// als haette es fuer sie keinen Lauf gegeben.
// ⚠ Nur bei einem echten Lauf. Bisher ergab sich das von selbst, weil die
// Merkliste im Trockenlauf leer blieb; die Uebersicht fuellt sich dagegen
// IMMER. Ohne diese Zeile wuerde ein Trockenlauf in den Blob-Speicher
// schreiben — und „trocken" heisst: es geht nichts raus, auch nicht dorthin.
for (const [appSchluessel, u] of ECHT ? uebersicht : []) {
  const eintraege = merkliste.get(appSchluessel) ?? [];
  const r = await merklisteAblegen({
    datum: DATUM, appSchluessel, name: u.name, eintraege, uebersicht: u.posten,
    token: zugaenge(appSchluessel).blobToken,
  });
  console.log(`Merkliste: ${u.posten.length} Beitrag(e), davon ${eintraege.length} fuer Instagram offen → ${r.pfad}`);
}

// Die Texte zu den TikTok-Entwuerfen in die Zusammenfassung des Laufs.
//
// ⚠ Warum dorthin und nicht ins Protokoll: Josef arbeitet vom Handy. Die
// Zusammenfassung ist die erste Seite eines Laufs, das Protokoll liegt
// darunter und laesst sich dort kaum markieren. Ein Codeblock bekommt in
// GitHub ausserdem einen Kopierknopf — genau das, was hier gebraucht wird.
//
// ⚠ Nur bei einem echten Lauf und nur fuer TikTok. Facebook und Instagram
// tragen ihren Text selbst; sie hier mit aufzuzaehlen hiesse, zum Kopieren
// einzuladen, was schon drin steht.
if (nachzutragen.length && process.env.GITHUB_STEP_SUMMARY) {
  // ⚠ Der Workflow ruft dieses Skript je App EINMAL auf, alle schreiben in
  // dieselbe Datei. Die Ueberschrift darf deshalb nur beim ersten Mal
  // dazukommen — sonst steht sie fuenfmal da.
  const ueberschrift = `## Text fuer die TikTok-Entwuerfe (${DATUM})`;
  const schonDa = existsSync(process.env.GITHUB_STEP_SUMMARY)
    && readFileSync(process.env.GITHUB_STEP_SUMMARY, 'utf8').includes(ueberschrift);

  const zeilen = schonDa ? [] : [
    ueberschrift,
    '',
    ECHT
      ? 'TikToks Posteingang nimmt keinen Text an — hier zum Kopieren, bevor du in der App auf Posten tippst.'
      : 'Trockenlauf: So wuerde der Text lauten. Hochgeladen wurde nichts.',
    '',
  ];
  for (const e of nachzutragen) {
    // Ein Caption-Text mit ``` darin wuerde den Block sprengen; laenger
    // eingezaeunt bleibt er heil.
    const zaun = e.text.includes('```') ? '````' : '```';
    zeilen.push(`### ${e.name}`, `<sub>${e.datei}</sub>`, '',
      zaun, e.text || '(kein Text erzeugt)', zaun, '');
  }
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${zeilen.join('\n')}\n`);
    console.log(`Texte fuer ${nachzutragen.length} TikTok-Entwurf/-Entwuerfe stehen in der Zusammenfassung.`);
  } catch (e) {
    // Ein misslungener Merkzettel darf keinen geglueckten Versand rot faerben.
    console.log(`⚠ Zusammenfassung nicht geschrieben: ${e.message}`);
  }
}

console.log(ECHT
  ? `${fertig} Entwuerfe angelegt, ${offen} warten auf die Freigabe.`
  : `Trockenlauf beendet — nichts gesendet. Mit --echt wirklich hochladen.`);
