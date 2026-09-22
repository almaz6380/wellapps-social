// Liegt dieser Beitrag heute schon im TikTok-Posteingang?
//
// --- Wofuer (22.09.2026) -----------------------------------------------------
//
// Josef: „Wieso liegt immer jeder post mehrmals im tiktok postfach und wieso
// kommt er wieder wenn ich ihn vom postfach lösche?"
//
// Beides dieselbe Ursache, und sie lag bei uns: `posten.mjs` hat vor dem
// Senden NICHT nachgesehen, was schon draussen ist. Die alte Merkliste wird
// erst NACH dem Versand gelesen, und nur zum Zusammenfuehren der Anzeige.
// Jeder Lauf baute sich eine frische Spur (`spur.kanaele = {}`) und schickte
// alles noch einmal.
//
// Am 22.09. nachgemessen, an EINER Karte:
//
//   19:09  Lauf mit --kanal tiktok   → ✓ Posteingang, p_inbox_url~v2.76884…
//   19:16  Lauf ueber alle Kanaele   → ✓ Posteingang — DIESELBE Karte nochmal
//
// Der zweite Lauf hat `tiktok: posteingang` in der Merkliste gesehen und
// trotzdem hochgeladen.
//
// ⚠ Und das erklaert auch das „es kommt wieder": TikTok stellt nichts wieder
// her. Ein spaeterer Lauf legt einen NEUEN Entwurf daneben, der genauso
// aussieht. Wer seinen Posteingang leert und danach einen Lauf startet, hat
// ihn wieder voll — und jeder dieser Uploads zaehlt auf
// `spam_risk_too_many_pending_share`, die Sperre, die uns den halben 22.09.
// gekostet hat.
//
// --- Warum eine eigene Datei -------------------------------------------------
//
// Dieselbe Trennung wie bei `ablehnen-auswahl.mjs`: `posten.mjs` verschickt
// auf oberster Ebene, ein `import` aus einem Test heraus wuerde den Versand
// ausfuehren. Die Entscheidung steht deshalb hier und wird dort nur benutzt.

/**
 * Staende, die „liegt schon bei TikTok" bedeuten.
 *
 * ⚠ `posteingang` GEHOERT DAZU, und das ist der ganze Punkt. Bisher galt nur
 * `veroeffentlicht` als erledigt — aber ein Entwurf im Posteingang ist beim
 * naechsten Lauf genauso vorhanden, er wartet nur noch auf einen Menschen.
 *
 * `fehler` gehoert NICHT dazu: Da ist nichts angekommen, ein neuer Versuch ist
 * richtig. `trocken` auch nicht — im Trockenlauf ging nie etwas raus.
 */
export const LIEGT_DRIN = new Set(['posteingang', 'veroeffentlicht']);

/**
 * @param {object} o
 * @param {?object} o.liste   Merkliste dieser App fuer diesen Tag (oder null)
 * @param {string} o.datei    Dateiname des Beitrags, wie er in der Merkliste steht
 * @returns {?{stand: string, wann: ?string, publishId: ?string}}
 *   Der Fund, oder null — dann ist der Weg frei.
 */
export function schonImPosteingang({ liste, datei }) {
  // ⚠ Gesucht wird in `uebersicht`, NICHT in `eintraege`. `eintraege` ist die
  // Instagram-Arbeitsliste; sie bleibt unberuehrt, wenn ein Lauf nur TikTok
  // bedient, und stuende dort der TikTok-Stand, waere er veraltet. Genau
  // diese Verwechslung hat am 22.09. beinahe dazu gefuehrt, dass die falschen
  // Bilder als „gesendet" gemeldet wurden.
  const treffer = (liste?.uebersicht ?? []).find((u) => u.datei === datei);
  const t = treffer?.kanaele?.tiktok;
  if (!t || !LIEGT_DRIN.has(t.stand)) return null;
  return { stand: t.stand, wann: t.wann ?? null, publishId: t.publishId ?? null };
}

/**
 * Die Meldung dazu — als eigene Funktion, damit der Test sie festnageln kann.
 *
 * ⚠ Sie nennt den Weg nach draussen. Eine Sperre ohne Ausweg ist eine, die
 * jemand im Ernstfall umgeht, indem er den Code aendert.
 */
export function meldung(fund) {
  const wann = fund.wann ? new Date(fund.wann).toISOString().slice(11, 16) : null;
  return `liegt seit${wann ? ` ${wann}` : ''} im Posteingang — uebersprungen`
    + `${fund.stand === 'veroeffentlicht' ? ' (schon veroeffentlicht)' : ''}`
    + '. ERZWINGEN=ja schickt ihn trotzdem.';
}
