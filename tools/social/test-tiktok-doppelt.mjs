// Die Sperre gegen Doppel-Entwuerfe im TikTok-Posteingang.
//
//   node tools/social/test-tiktok-doppelt.mjs
//
// --- Wofuer (22.09.2026) -----------------------------------------------------
//
// Josef: „Wieso liegt immer jeder post mehrmals im tiktok postfach und wieso
// kommt er wieder wenn ich ihn vom postfach lösche?"
//
// Gemessen am selben Abend, an EINER Karte: 19:09 ein Lauf mit
// `--kanal tiktok` → Posteingang. 19:16 ein Lauf ueber alle Kanaele →
// derselbe Beitrag NOCH EINMAL in den Posteingang, obwohl in der Merkliste
// `tiktok: posteingang` stand.
//
// ⚠ Die drei Faelle, auf die es hier ankommt, sind alle still:
//
//   1. Sperrt nicht → jeder Lauf verdoppelt den Posteingang, und jeder
//      Upload zaehlt auf `spam_risk_too_many_pending_share` (die Sperre, die
//      am 22.09. einen halben Tag gekostet hat).
//   2. Sperrt zu viel → ein Beitrag, der nur einen FEHLER hatte, wird nie
//      nachgeschickt. Im Protokoll steht dann „uebersprungen", und es sieht
//      aus wie Erfolg.
//   3. Sperrt am falschen Feld → `eintraege` ist die Instagram-Arbeitsliste
//      und steht bei einem reinen TikTok-Lauf still. Wer dort nachsieht,
//      misst einen veralteten Stand.
//
// ⚠ Geprueft wird die ECHTE `schonImPosteingang` aus tiktok-schon-drin.mjs,
// nicht eine abgeschriebene Zweitfassung.

import { schonImPosteingang, meldung, LIEGT_DRIN } from './tiktok-schon-drin.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const DATEI = 'fullrep-rezept-karte-de-s60327-1.jpg';
const liste = (tiktok, datei = DATEI) => ({
  uebersicht: [{ datei, kanaele: tiktok ? { tiktok } : {} }],
  eintraege: [],
});

// --- 1. Posteingang sperrt ---------------------------------------------------
//
// DER FALL VOM 22.09. Ohne diese Probe kommt er zurueck.
{
  const f = schonImPosteingang({
    liste: liste({ stand: 'posteingang', wann: '2026-09-22T19:09:36.888Z',
      publishId: 'p_inbox_url~v2.7688438634269493270' }),
    datei: DATEI,
  });
  pruefe('⚠ Was im Posteingang liegt, geht NICHT noch einmal raus',
    f !== null && f.stand === 'posteingang', JSON.stringify(f));
  pruefe('… und die publishId wird mitgenommen',
    f?.publishId === 'p_inbox_url~v2.7688438634269493270', String(f?.publishId));
}

// --- 2. Veroeffentlicht sperrt auch -----------------------------------------
{
  const f = schonImPosteingang({
    liste: liste({ stand: 'veroeffentlicht' }), datei: DATEI,
  });
  pruefe('Was schon veroeffentlicht ist, erst recht nicht',
    f !== null && f.stand === 'veroeffentlicht', JSON.stringify(f));
}

// --- 3. Ein Fehler sperrt NICHT ---------------------------------------------
//
// ⚠ DIE WICHTIGSTE GEGENPROBE. Am 22.09. sind drei Versuche an
// `spam_risk_too_many_pending_share` gescheitert — bei TikTok ist NICHTS
// angekommen. Wuerde der Fehlerstand sperren, liesse sich so ein Beitrag nie
// mehr nachschicken, und das Protokoll meldete „uebersprungen" statt zu
// melden, dass er fehlt.
{
  const f = schonImPosteingang({
    liste: liste({ stand: 'fehler', meldung: 'TikTok 403: spam_risk_too_many_pending_share' }),
    datei: DATEI,
  });
  pruefe('⚠ Nach einem FEHLER wird sehr wohl noch einmal gesendet',
    f === null, JSON.stringify(f));
}

// --- 4. Trockenlauf sperrt NICHT --------------------------------------------
{
  pruefe('Ein Trockenlauf-Vermerk sperrt nicht',
    schonImPosteingang({ liste: liste({ stand: 'trocken' }), datei: DATEI }) === null,
    JSON.stringify(schonImPosteingang({ liste: liste({ stand: 'trocken' }), datei: DATEI })));

  pruefe('Die Menge der sperrenden Staende ist genau {posteingang, veroeffentlicht}',
    [...LIEGT_DRIN].sort().join() === 'posteingang,veroeffentlicht',
    [...LIEGT_DRIN].join());
}

// --- 5. Anderer Beitrag, andere Entscheidung --------------------------------
{
  pruefe('Ein anderer Dateiname wird nicht mitgesperrt',
    schonImPosteingang({
      liste: liste({ stand: 'posteingang' }, 'fullrep-mythos-check-de-s18113.mp4'),
      datei: DATEI,
    }) === null, 'gesperrt, obwohl andere Datei');
}

// --- 6. Fehlende Merkliste laesst durch -------------------------------------
//
// ⚠ Ist der Blob nicht erreichbar, wissen wir nur NICHT, was drinliegt. Das
// ist der Zustand von vor dem 22.09. und war monatelang der Normalfall. Ein
// Doppel-Entwurf ist billiger als ein Tageslauf, der an einer
// Vorsichtsmassnahme scheitert.
{
  pruefe('Keine Merkliste → der Weg ist frei',
    schonImPosteingang({ liste: null, datei: DATEI }) === null, 'gesperrt ohne Liste');
  pruefe('Leere Merkliste → der Weg ist frei',
    schonImPosteingang({ liste: { uebersicht: [] }, datei: DATEI }) === null, 'gesperrt');
  pruefe('Eintrag ohne TikTok-Stand → der Weg ist frei',
    schonImPosteingang({ liste: liste(null), datei: DATEI }) === null, 'gesperrt');
}

// --- 7. NICHT in `eintraege` nachsehen --------------------------------------
//
// ⚠ Am 22.09. haette diese Verwechslung beinahe dazu gefuehrt, die falschen
// Bilder als „gesendet" zu melden: `eintraege` ist die Instagram-Arbeitsliste
// und bleibt bei `--kanal tiktok` unberuehrt. Ein TikTok-Stand, der dort
// steht, ist veraltet.
{
  const irrefuehrend = {
    uebersicht: [],
    eintraege: [{ datei: DATEI, kanaele: { tiktok: { stand: 'posteingang' } } }],
  };
  pruefe('⚠ Ein TikTok-Stand in `eintraege` sperrt NICHT — dort gehoert er nicht hin',
    schonImPosteingang({ liste: irrefuehrend, datei: DATEI }) === null,
    'aus eintraege gelesen');
}

// --- 8. Die Meldung nennt den Ausweg ----------------------------------------
//
// Eine Sperre ohne Ausweg ist eine, die jemand im Ernstfall umgeht, indem er
// den Code aendert — und sie danach drin laesst.
{
  const t = meldung({ stand: 'posteingang', wann: '2026-09-22T19:09:36.888Z', publishId: null });
  pruefe('Die Meldung nennt ERZWINGEN', t.includes('ERZWINGEN=ja'), t);
  pruefe('… und die Uhrzeit, damit man den Entwurf wiederfindet',
    t.includes('19:09'), t);
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Kein zweiter Entwurf fuer denselben Beitrag — aber nach einem Fehler sehr wohl.');
