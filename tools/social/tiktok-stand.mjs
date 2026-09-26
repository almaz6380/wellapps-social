// Bei TikTok nachfragen, was aus den hochgeladenen Beitraegen geworden ist.
//
//   TAGE=7 node tools/social/tiktok-stand.mjs
//   DATUM=2026-09-20 APP=fullrep SCHREIBEN=nein node tools/social/tiktok-stand.mjs
//
// --- Wofuer -----------------------------------------------------------------
//
// Josef am 20.09.2026: „Kannst du es nicht so machen, dass TikTok eine
// Rueckmeldung gibt?"
//
// Bis dahin endete unsere Kenntnis beim Hochladen. Ein Beitrag ging in den
// Posteingang, ein Mensch gab ihn irgendwann in der TikTok-App frei — oder
// vergass es —, und niemand erfuhr davon. Auf der Freigabe-Seite stand
// dauerhaft „im Posteingang", im Archiv gar nichts: Es zaehlt TikTok
// ausdruecklich NICHT mit, weil es nichts wusste. Ein vergessener Entwurf sah
// genauso aus wie ein geposteter.
//
// Dieses Werkzeug schliesst die Luecke. Es fragt fuer jede gemerkte
// `publish_id` bei TikTok nach und schreibt die Antwort in die Merkliste
// zurueck.
//
// --- ⚠ Was hier gemessen und was geglaubt wird ------------------------------
//
// Die Statuswerte unten stehen in TikToks Doku. Was aber NICHT dokumentiert
// ist — und genau darauf kommt es uns an: Was antwortet TikTok fuer einen
// Entwurf, den ein MENSCH spaeter in der App veroeffentlicht hat? Und wie
// lange beantwortet TikTok eine publish_id ueberhaupt?
//
// Deshalb zwei Vorkehrungen, die bleiben muessen:
//
//   1. Die ROHE Antwort steht im Protokoll, je Beitrag eine Zeile. Damit ist
//      der erste Lauf eine Messung und kein Beleg fuer eine Annahme.
//   2. Ein Status, den `deutung()` nicht kennt, aendert NICHTS. Er wird
//      mitgeschrieben, aber der `stand` bleibt, wie er war. Lieber eine Luecke
//      als eine erfundene Zahl — dieselbe Regel wie ueberall hier.
//
// ⚠ Und in EINE Richtung wird nie zurueckgestuft: Was einmal
// `veroeffentlicht` war, bleibt es. Sonst machte eine Antwort, die wir falsch
// deuten, aus einem geposteten Beitrag wieder einen offenen — und jemand
// postete ihn ein zweites Mal.

import { merklistenLesen, merklisteAendern } from './veroeffentlichen/blob.mjs';
import { frischerToken, standHolen } from './veroeffentlichen/tiktok.mjs';
import { deutung, darfErsetzen } from './veroeffentlichen/tiktok-deutung.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const TAGE = Math.max(1, Math.min(90, Number(process.env.TAGE || 7)));
const DATUM = (process.env.DATUM || '').trim();
const NUR_APP = (process.env.APP || '').trim();
// ⚠ Voreinstellung ist SCHREIBEN. Ein Werkzeug, das die Antwort holt und
// wegwirft, ist keine Rueckmeldung. `SCHREIBEN=nein` ist der Messlauf.
const SCHREIBEN = (process.env.SCHREIBEN || 'ja').trim().toLowerCase() !== 'nein';

const blobToken = process.env.BLOB_TOKEN;
if (!blobToken) {
  console.error('BLOB_TOKEN fehlt — ohne ihn gibt es keine Merklisten.');
  process.exit(1);
}

/**
 * Welche Tage angesehen werden. Rueckwaerts ab heute, damit der neueste
 * zuerst im Protokoll steht.
 */
function tage() {
  if (DATUM) return [DATUM];
  const raus = [];
  const heute = new Date();
  for (let i = 0; i < TAGE; i += 1) {
    const d = new Date(heute);
    d.setUTCDate(d.getUTCDate() - i);
    raus.push(d.toISOString().slice(0, 10));
  }
  return raus;
}

const tokenSpeicher = new Map();
async function tokenFuer(app) {
  if (tokenSpeicher.has(app)) return tokenSpeicher.get(app);
  const z = zugaenge(app);
  if (!z.tiktokRefresh || !z.tiktokKey || !z.tiktokSecret) {
    throw new Error(`Keine TikTok-Zugangsdaten fuer ${app} `
      + `(TIKTOK_REFRESH_TOKEN_${app.toUpperCase()} / TIKTOK_CLIENT_KEY / _SECRET).`);
  }
  const r = await frischerToken({
    clientKey: z.tiktokKey, clientSecret: z.tiktokSecret, refreshToken: z.tiktokRefresh,
  });
  if (r.neuerRefresh) {
    // ⚠ Der neue Wert steht hier ABSICHTLICH NICHT — diese Ausgabe landet in
    // GitHub-Protokollen, und die sind kein Ort fuer Geheimnisse.
    console.log(`   ⚠ TikTok hat den Refresh-Token fuer ${app} ausgetauscht. `
      + `Er muss ins Secret TIKTOK_REFRESH_TOKEN_${app.toUpperCase()}.`);
  }
  tokenSpeicher.set(app, r.token);
  return r.token;
}

let gefragt = 0;
let geaendert = 0;
let ohneId = 0;
const fehler = [];

console.log(`TikTok-Stand · ${DATUM ? DATUM : `letzte ${TAGE} Tage`}`
  + `${NUR_APP ? ` · nur ${NUR_APP}` : ''}${SCHREIBEN ? '' : ' · MESSLAUF, es wird nichts geschrieben'}`);

for (const datum of tage()) {
  let listen = [];
  try {
    listen = await merklistenLesen({ datum, token: blobToken });
  } catch (e) {
    fehler.push(`${datum}: Merklisten nicht lesbar — ${e.message}`);
    continue;
  }
  if (NUR_APP) listen = listen.filter((l) => l.app === NUR_APP);
  if (!listen.length) continue;

  for (const liste of listen) {
    const posten = (liste.uebersicht ?? []).filter((p) => p.kanaele?.tiktok);
    if (!posten.length) continue;

    let dieseListeGeaendert = false;
    for (const p of posten) {
      const k = p.kanaele.tiktok;
      if (k.stand === 'trocken') continue;
      if (!k.publishId) {
        // ⚠ Kein Vorwurf, sondern eine Zahl: Beitraege von vor dem 20.09.2026
        // haben keine publish_id, weil der Tageslauf sie damals wegwarf. Sie
        // bleiben fuer immer unbekannt — das ist das Ausmass des alten
        // Fehlers, und es soll sichtbar sein statt verschwiegen.
        ohneId += 1;
        continue;
      }

      let daten;
      try {
        daten = await standHolen({ token: await tokenFuer(liste.app), publishId: k.publishId });
        gefragt += 1;
      } catch (e) {
        fehler.push(`${datum} · ${liste.app} · ${p.datei}: ${e.message}`);
        // ⚠ ERGAENZEN, nicht ersetzen. Eine frueher erfolgreiche Antwort ist
        // der Beleg, mit dem das Archiv diesen Beitrag zaehlt (`zaehltHier`
        // in freigabe.js verlangt `abfrage.status`). Wuerde eine
        // voruebergehend gescheiterte Abfrage sie ueberschreiben, verschwaende
        // ein bereits belegter Beitrag wieder aus dem Archiv — und zwar
        // wegen eines Netzfehlers, nicht wegen einer Aenderung bei TikTok.
        k.abfrage = {
          ...(k.abfrage ?? {}),
          fehler: String(e.message).slice(0, 300),
          fehlerWann: new Date().toISOString(),
        };
        dieseListeGeaendert = true;
        continue;
      }

      const d = deutung(daten);
      // ⚠ DIE MESSUNG. Die rohe Antwort gehoert ins Protokoll, nicht nur
      // unsere Deutung davon — sonst belegt der Lauf nur, dass wir uns einig
      // mit uns selbst sind. Sie enthaelt Status und Beitrags-IDs, keine
      // Geheimnisse.
      console.log(`   ${datum} · ${liste.app} · ${p.datei}`);
      console.log(`      war: ${k.stand}  ·  TikTok: ${JSON.stringify(daten)}`);

      k.abfrage = {
        status: d.status || null,
        ...(d.postIds.length ? { postIds: d.postIds } : {}),
        roh: daten,
        wann: new Date().toISOString(),
      };
      dieseListeGeaendert = true;

      if (darfErsetzen(k.stand, d.stand)) {
        console.log(`      → ${k.stand} wird ${d.stand}`);
        k.stand = d.stand;
        if (d.stand === 'veroeffentlicht') k.wann = k.wann ?? new Date().toISOString();
        geaendert += 1;
      } else if (d.stand === null) {
        console.log(`      → unbekannter Status, es bleibt bei ${k.stand}`);
      } else {
        console.log(`      → unveraendert (${k.stand})`);
      }
    }

    if (dieseListeGeaendert && SCHREIBEN) {
      // ⚠ Nur die TikTok-Vermerke uebertragen, auf die FRISCH gelesene Liste
      // (26.09.2026, siehe merklisteAendern in blob.mjs) — nicht die ganze,
      // Minuten alte Liste zurueckschreiben: Eine Facebook- oder
      // Instagram-Freigabe dazwischen ginge sonst verloren. Und nur dort, wo
      // noch derselbe Upload (publishId) steht; hat jemand inzwischen neu
      // gepostet, gilt dessen Vermerk.
      const neu = new Map(posten.filter((p) => p.kanaele.tiktok.publishId)
        .map((p) => [p.datei, JSON.parse(JSON.stringify(p.kanaele.tiktok))]));
      const passend = (l) => (l.uebersicht ?? [])
        .filter((p) => neu.has(p.datei) && p.kanaele?.tiktok?.publishId === neu.get(p.datei).publishId);
      try {
        await merklisteAendern({
          datum, appSchluessel: liste.app, token: blobToken,
          aendern: (l) => {
            for (const p of passend(l)) p.kanaele = { ...p.kanaele, tiktok: neu.get(p.datei) };
          },
          drin: (l) => passend(l).every((p) => JSON.stringify(p.kanaele.tiktok) === JSON.stringify(neu.get(p.datei))),
        });
      } catch (e) {
        fehler.push(`${datum} · ${liste.app}: Merkliste nicht schreibbar — ${e.message}`);
      }
    }
  }
}

console.log(`\n${gefragt} Beitraege bei TikTok nachgefragt, ${geaendert} Stand geaendert.`);
if (ohneId) {
  console.log(`${ohneId} ohne publish_id — die sind vor dem 20.09.2026 hochgeladen worden`);
  console.log('und bleiben unbekannt. Kein Fehler, aber auch keine Auskunft.');
}
if (!SCHREIBEN) console.log('Messlauf: nichts in die Merklisten geschrieben.');

if (fehler.length) {
  // ⚠ Der Lauf wird ROT. Eine Abfrage, die scheitert, sieht sonst aus wie eine,
  // die „nichts Neues" ergeben hat — genau die Sorte stiller Fehlschlag, die
  // in diesem Repo schon mehrfach Tage gekostet hat.
  console.error(`\n✗ ${fehler.length} Abfragen nicht beantwortet:`);
  for (const z of fehler) console.error(`   ${z}`);
  process.exit(1);
}
