// Probelauf gegen den Cloudflare-Speicher — prueft die ganze Kette, die
// posten.mjs, freigeben.mjs und story.mjs benutzen, ohne dass irgendetwas in
// der Freigabe-Seite oder einem Kanal auftaucht.
//
//   BLOB_TOKEN=… node tools/social/speicher-probe.mjs
//
// --- Warum (01.10.2026) -----------------------------------------------------
//
// Seit dem 30.09. liegt der Speicher nicht mehr bei Vercel Blob, sondern im
// Freigabe-Worker (KV + D1). Josef: „Bitte prüf vor dem ersten echten Lauf
// kurz mit einem Probelauf, ob die Kette mit dem neuen Speicher durchläuft."
// Ein Tageslauf mit `modus: trocken` prueft das NICHT — trocken ruft den
// Speicher gar nicht auf. Ein echter Lauf schriebe ins TikTok-Postfach.
//
// ⚠ Alles liegt unter dem Tag 2000-01-01. Die Freigabe-Seite zeigt hoechstens
// 90 Tage zurueck, die Probe-Merkliste ist dort also nie zu sehen. Am Ende wird
// alles wieder geloescht.

import { join, dirname } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SPEICHER, hochladen, merklisteAblegen, merklistenLesen, merklisteAendern,
  sperreSetzen, sperreLoesen, aufraeumen, operationenVerbraucht,
} from './veroeffentlichen/blob.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const token = process.env.BLOB_TOKEN;
if (!token) { console.error('BLOB_TOKEN fehlt.'); process.exit(1); }

const DATUM = '2000-01-01';
const APP = 'probe';
const BILD = join(HIER, 'reels-fremd', 'vorspann', 'swaply-handy-bild.jpg');
const VIDEO = join(HIER, 'reels-fremd', 'vorspann', 'swaply-handy-bild.mp4');

let fehler = 0;
const pruefen = (ok, text) => { console.log(`${ok ? '✓' : '✗'} ${text}`); if (!ok) fehler += 1; };
const aufraeumListe = [];

try {
  // --- 1. Bild und Video hochladen, oeffentlich zurueckholen ---------------
  for (const [datei, typ] of [[BILD, 'image/jpeg'], [VIDEO, 'video/mp4']]) {
    const { url } = await hochladen({ datei, token, praefix: `social/${DATUM}` });
    aufraeumListe.push(url);
    const a = await fetch(url);
    const bytes = Buffer.from(await a.arrayBuffer());
    pruefen(a.ok && bytes.equals(readFileSync(datei)),
      `${typ}: hochgeladen und ohne Anmeldung byte-gleich zurueck (${bytes.length} B)`);
    pruefen(a.headers.get('content-type')?.startsWith(typ), `${typ}: Content-Type ${a.headers.get('content-type')}`);
    // Instagram und Facebook holen Videos ab und wollen die Laenge vorher wissen.
    const h = await fetch(url, { method: 'HEAD' });
    // ⚠ Nur Hinweis, kein Fehler: Der Worker reicht KV als Strom durch, ohne
    // Laengenangabe. Vercel Blob lieferte sie. Ob Instagram sie bei Videos
    // verlangt, zeigt erst eine echte Freigabe.
    const laenge = Number(h.headers.get('content-length'));
    pruefen(h.ok, `${typ}: HEAD ${h.status}`);
    console.log(`  ${laenge === statSync(datei).size ? '✓' : '⚠ Hinweis:'} Content-Length ${h.headers.get('content-length') ?? 'fehlt'}`);
    // TikTok-Fotos laufen ueber die Durchreiche mit verifiziertem Prefix.
    if (typ === 'image/jpeg') {
      const name = new URL(url).pathname.split('/').pop();
      const t = await fetch(`${SPEICHER}/api/bild/${DATUM}~${name}`);
      const tb = Buffer.from(await t.arrayBuffer());
      pruefen(t.ok && tb.equals(readFileSync(datei)), `TikTok-Durchreiche /api/bild/${DATUM}~… liefert das Bild`);
    }
  }

  // --- 2. Ohne Token darf niemand schreiben ---------------------------------
  const fremd = await fetch(`${SPEICHER}/social/${DATUM}/fremd.json`, { method: 'PUT', body: '{}' });
  pruefen(fremd.status === 401, `Schreiben ohne Token abgewiesen (${fremd.status})`);

  // --- 3. Merkliste: ablegen, auflisten, aendern ----------------------------
  const abgelegt = await merklisteAblegen({
    datum: DATUM, appSchluessel: APP, token,
    eintraege: [{ datei: 'probe.jpg', url: aufraeumListe[0], veroeffentlicht: false }],
    uebersicht: [{ datei: 'probe.jpg', kanaele: {} }],
  });
  aufraeumListe.push(abgelegt.url);
  const listen = await merklistenLesen({ datum: DATUM, token });
  const meine = listen.find((l) => l.app === APP);
  pruefen(meine?._md5 === abgelegt.md5, 'Merkliste abgelegt und ueber die Auflistung gelesen (gleicher Inhalt)');

  const wann = new Date().toISOString();
  const { versuche } = await merklisteAendern({
    datum: DATUM, appSchluessel: APP, token,
    aendern: (l) => { l.uebersicht[0].probe = wann; },
    drin: (l) => l.uebersicht?.[0]?.probe === wann,
    nachlesen: 3, nachlesenTakt: 1000,
  });
  pruefen(versuche === 1, `merklisteAendern beim ersten Versuch durch (${versuche})`);

  // Veralteter Stand muss abgewiesen werden — sonst gewinnt, wer zuletzt schreibt.
  let abgewiesen = false;
  try {
    await merklisteAblegen({ datum: DATUM, appSchluessel: APP, token, eintraege: [], ifMatch: abgelegt.md5 });
  } catch (e) { abgewiesen = e.name === 'BlobPreconditionFailedError'; }
  pruefen(abgewiesen, 'Schreiben mit veraltetem Stand (ifMatch) abgewiesen');

  // --- 4. Sperre: genau einmal ----------------------------------------------
  const s = { datum: DATUM, kanal: 'probe', datei: 'probe.jpg', token };
  const erste = await sperreSetzen(s);
  const zweite = await sperreSetzen(s);
  pruefen(erste === true && zweite === false, `Sperre greift genau einmal (${erste}/${zweite})`);
  await sperreLoesen(s);
  const dritte = await sperreSetzen(s);
  pruefen(dritte === true, 'Sperre nach dem Loesen wieder setzbar');
  await sperreLoesen(s);
} catch (e) {
  pruefen(false, `Abbruch: ${e.message}`);
} finally {
  // --- 5. Aufraeumen --------------------------------------------------------
  const weg = await aufraeumen({ urls: aufraeumListe, token });
  // KV haelt Gelesenes bis zu 60 s im Randcache — ein Geloeschtes kann so
  // lange noch antworten. Deshalb bis zu 90 s nachsehen.
  let reste = [];
  for (let i = 0; i < 10; i++) {
    reste = await Promise.all(aufraeumListe.map((u) => fetch(`${u}?frisch=${Date.now()}`, { method: 'HEAD' }).then((r) => r.status)));
    if (reste.every((c) => c === 404)) break;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  pruefen(weg && reste.every((c) => c === 404), `Aufgeraeumt (${reste.join(', ')})`);
}

console.log(`\nSchreibvorgaenge: ${operationenVerbraucht()} · ${fehler ? `${fehler} FEHLER` : 'alles gruen'}`);
process.exit(fehler ? 1 : 0);
