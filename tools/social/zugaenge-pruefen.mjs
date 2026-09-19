// Prueft, welche Social-Zugaenge hinterlegt sind — und ob sie taugen.
//
//   node tools/social/zugaenge-pruefen.mjs        nur schauen, was da ist
//   LIVE=true node tools/social/zugaenge-pruefen.mjs   zusaetzlich bei Facebook nachfragen
//
// Gedacht fuer den Workflow „Social-Zugaenge pruefen". Lokal laeuft es auch,
// findet dann aber nichts — die Werte liegen in den GitHub-Secrets.
//
// --- ⚠ Warum das nicht `posten.mjs --trocken` erledigt ----------------------
//
// Der Trockenlauf dort prueft nur, ob eine Variable GESETZT ist, und er
// braucht fertige Beitraege des Tages, sonst sagt er „Nichts zu posten" und
// hoert auf. Beim Einrichten will man das Gegenteil: eine Antwort auch ohne
// Beitraege, und eine, die den Wert selbst anfasst. Ein Token, der zur
// falschen Seite gehoert oder beim Kopieren am Handy vorne abgeschnitten
// wurde, ist gesetzt und trotzdem wertlos.
//
// --- ⚠ Was hier NICHT ausgegeben wird ---------------------------------------
//
// Der Token. Nie, auch nicht teilweise als „Beweis". Ausgegeben werden nur
// Laenge und Praefix (`EAAZ` = Meta) — das reicht, um einen halb kopierten
// Wert zu erkennen, und ist selbst kein Geheimnis. Diese Protokolle liest
// jeder, der Zugriff aufs Repo hat.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bedarf, zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const APPS = JSON.parse(readFileSync(join(HIER, 'apps.json'), 'utf8'));
const LIVE = /^(1|true|ja)$/i.test(process.env.LIVE ?? '');
const GRAPH = 'https://graph.facebook.com/v21.0';

/** Ein Wert in einer Form, die man gefahrlos protokollieren kann. */
function umriss(wert) {
  if (!wert) return 'fehlt';
  return `${wert.length} Zeichen, beginnt mit ${wert.slice(0, 4)}…`;
}

/**
 * Fragt Facebook, wem dieser Token gehoert.
 *
 * ⚠ Der Token geht als Kopfzeile mit, NICHT als Abfrageparameter. Facebook
 * protokolliert URLs; ein Token in der URL landet dort und in jedem Proxy
 * dazwischen. Beide Wege sind erlaubt, nur einer ist sauber.
 */
async function wemGehoert(token) {
  const antwort = await fetch(`${GRAPH}/me?fields=id,name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await antwort.json();
  if (d.error) throw new Error(d.error.message);
  return d;
}

/**
 * Welches Instagram-Konto haengt wirklich an dieser Seite?
 *
 * ⚠ Das ist die Frage, die hier bis zum 19.09.2026 NIEMAND gestellt hat. Die
 * Instagram-ID stand in apps.json, wurde ausgedruckt — und nie gegen die
 * Wirklichkeit gehalten. Der Prueflauf meldete gruen, waehrend Instagram bei
 * Swaply seit Stunden mit „Object with ID '17841436704302336' does not exist,
 * cannot be loaded due to missing permissions" abbrach.
 *
 * Eine ID in einer Konfigurationsdatei ist eine Behauptung. Die Seite weiss
 * es besser, und sie sagt es auf Nachfrage.
 *
 * @returns {Promise<{id: string, name: string}|null>} null = keins verknuepft
 */
async function wessenInstagram(seitenId, token) {
  const url = `${GRAPH}/${seitenId}?fields=instagram_business_account{id,username}`;
  const antwort = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const d = await antwort.json();
  if (d.error) throw new Error(d.error.message);
  const k = d.instagram_business_account;
  return k?.id ? { id: k.id, name: k.username ?? '?' } : null;
}

/**
 * Wann laeuft dieser Token ab?
 *
 * ⚠ Das ist die Frage, an der es am 04.09.2026 gehangen hat. Ein Token, der
 * JETZT funktioniert, sagt nichts darueber, ob er morgen noch gilt: Alle fuenf
 * Seiten-Token waren um 12:58 UTC gueltig und um 12:25 UTC des naechsten
 * Aufrufs abgelaufen („Session has expired"). Ein blosses „gehoert zur
 * richtigen Seite" haette das nie gezeigt.
 *
 * Ein KORREKT abgeleiteter Seiten-Token laeuft NIE ab — Metas Doku:
 * „Long-lived Page access tokens do not have an expiration date." Steht hier
 * also irgendein Datum, stimmt etwas nicht, und zwar sofort und nicht erst,
 * wenn der Tageslauf stillschweigend nichts mehr postet.
 *
 * @returns {Promise<{ewig: boolean, bis: Date|null}>}
 */
async function laeuftAb(token) {
  // debug_token nimmt den zu pruefenden Token auch als eigene Vollmacht —
  // das spart den App-Token und damit ein weiteres Geheimnis.
  const url = `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}`;
  const antwort = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const d = await antwort.json();
  if (d.error) throw new Error(d.error.message);
  // `expires_at: 0` heisst „nie". Fehlt das Feld, sagt Facebook nichts zu —
  // dann behaupten wir hier auch nichts.
  const roh = d.data?.expires_at;
  if (roh === 0) return { ewig: true, bis: null };
  if (!roh) return { ewig: false, bis: null };
  return { ewig: false, bis: new Date(roh * 1000) };
}

let alleGut = true;
const zeilen = [];

for (const [schluessel, app] of Object.entries(APPS)) {
  if (schluessel.startsWith('_') || !app.kanaele?.length) continue;

  const z = zugaenge(schluessel);
  zeilen.push(`\n━━ ${app.name}`);
  zeilen.push(`   Seite      ${z.fbSeitenId ?? 'fehlt'}   (aus apps.json)`);
  zeilen.push(`   Instagram  ${z.igKontoId ?? 'fehlt'}   (aus apps.json)`);
  zeilen.push(`   Token      ${umriss(z.fbToken)}`);

  if (!z.fbToken) {
    alleGut = false;
  } else if (LIVE) {
    // Die eigentliche Probe: Gehoert der Token zu DIESER Seite? Ein
    // vertauschtes Paar ist der teuerste Fehler hier — es faellt erst auf,
    // wenn Mahjong-Werbung auf der WELLbooked-Seite steht.
    try {
      const wer = await wemGehoert(z.fbToken);
      if (wer.id === z.fbSeitenId) {
        zeilen.push(`   ✓ gehoert zu „${wer.name}" — passt`);
        // Gueltig ist nicht dasselbe wie haltbar — siehe laeuftAb().
        try {
          const f = await laeuftAb(z.fbToken);
          if (f.ewig) {
            zeilen.push('   ✓ laeuft nie ab — richtig abgeleitet');
          } else {
            alleGut = false;
            zeilen.push(f.bis
              ? `   ✗ laeuft ab am ${f.bis.toISOString().slice(0, 16).replace('T', ' ')} UTC`
              : '   ✗ kein Ablaufdatum gemeldet — nicht als dauerhaft belegt');
            zeilen.push('     Ein Seiten-Token aus einem LANGLEBIGEN Nutzer-Token laeuft nie');
            zeilen.push('     ab. Hier ist er aus einer befristeten Sitzung abgeleitet und');
            zeilen.push('     stirbt zum genannten Zeitpunkt. Neu ableiten, siehe README Teil A.');
          }
        } catch (e) {
          zeilen.push(`   ? Haltbarkeit nicht pruefbar: ${e.message}`);
        }

        // Und jetzt die Instagram-Frage — nur sinnvoll, wenn der Token zur
        // Seite gehoert, denn gefragt wird MIT diesem Token nach DIESER Seite.
        if (app.kanaele.includes('instagram')) {
          try {
            const ig = await wessenInstagram(z.fbSeitenId, z.fbToken);
            if (!ig) {
              alleGut = false;
              zeilen.push('   ✗ An dieser Seite haengt GAR KEIN Instagram-Konto.');
              zeilen.push(`     apps.json fuehrt ${z.igKontoId ?? '—'}. Instagram-Beitraege`);
              zeilen.push('     scheitern damit mit „Object with ID … does not exist".');
              zeilen.push('     Verbinden: Meta Business Suite → Einstellungen → Konten.');
            } else if (ig.id === z.igKontoId) {
              zeilen.push(`   ✓ Instagram „@${ig.name}" haengt an dieser Seite`);
            } else {
              alleGut = false;
              zeilen.push(`   ✗ Instagram passt NICHT: apps.json fuehrt ${z.igKontoId ?? '—'},`);
              zeilen.push(`     die Seite haengt an ${ig.id} (@${ig.name}).`);
              zeilen.push(`     Richtig ist ${ig.id} — in apps.json unter meta.igKontoId eintragen.`);
            }
          } catch (e) {
            alleGut = false;
            zeilen.push(`   ✗ Instagram nicht pruefbar: ${e.message}`);
            zeilen.push('     Meist fehlt dem Token instagram_basic oder');
            zeilen.push('     instagram_content_publish. Siehe README, Teil A.');
          }
        }
      } else {
        alleGut = false;
        zeilen.push(`   ✗ gehoert zu „${wer.name}" (${wer.id}) — VERTAUSCHT.`);
        zeilen.push('     Das Secret dieser App traegt den Token einer anderen Seite.');
      }
    } catch (e) {
      alleGut = false;
      zeilen.push(`   ✗ Facebook lehnt ihn ab: ${e.message}`);
      zeilen.push('     Meist unvollstaendig kopiert oder aus einem kurzlebigen');
      zeilen.push('     Nutzer-Token abgeleitet. Siehe veroeffentlichen/README.md, Teil A.');
    }
  }

  // Was fehlt sonst noch? Bewusst je Kanal, damit sichtbar wird, dass
  // Facebook fertig sein kann, waehrend TikTok noch gar nicht angefangen ist.
  for (const kanal of app.kanaele) {
    const offen = bedarf(kanal, schluessel)
      .filter((v) => !process.env[v.name] && !v.imRepo)
      .map((v) => v.name);
    if (offen.length) {
      alleGut = false;
      zeilen.push(`   – ${kanal.padEnd(9)} fehlt: ${offen.join(', ')}`);
    } else {
      zeilen.push(`   ✓ ${kanal.padEnd(9)} vollstaendig`);
    }
  }
}

console.log('Social-Zugaenge — es wird NICHTS gesendet.');
console.log(LIVE
  ? 'Mit Rueckfrage bei Facebook (nur lesend).'
  : 'Ohne Rueckfrage bei Facebook — mit live_pruefen=true wird auch geprueft, '
    + 'ob die Token wirklich zu ihren Seiten gehoeren.');
console.log(zeilen.join('\n'));

console.log(alleGut
  ? '\nAlles vollstaendig.'
  : '\nEs fehlt noch etwas (siehe oben). Woher die Werte kommen, steht in'
    + '\ntools/social/veroeffentlichen/README.md — Teil A bis D.');

// Kein Fehler-Exit: Ein unvollstaendiger Stand ist waehrend der Einrichtung
// der Normalfall und kein Grund fuer einen roten Lauf. Wer maschinell darauf
// reagieren will, liest die letzte Zeile.
