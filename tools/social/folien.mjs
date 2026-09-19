// Die Folien eines Karussells finden und in die richtige Reihenfolge bringen.
//
// ⚠ Eigene Datei, nicht in posten.mjs. Dort laeuft der Versand auf oberster
// Ebene ab — ein `import` aus einem Test heraus wuerde ihn ausfuehren. Und
// ohne Test bliebe genau die Stelle ungeprueft, an der ein Fehler nach dem
// Veroeffentlichen nicht mehr zu beheben ist.

/**
 * @param {string[]} dateien  Namen im Ordner (keine Pfade)
 * @param {string} stamm      Dateiname ohne Endung, z. B. wellbooked-anruf-de-s1
 * @returns {string[]} Namen der Folien, numerisch aufsteigend
 */
export function folienFinden(dateien, stamm) {
  // ⚠ Der Stamm wird maskiert: Er kommt aus einem Dateinamen und enthaelt
  // Bindestriche und Punkte, die sonst als Regex-Zeichen wirkten.
  //
  // ⚠ Das Muster ist mit `^…$` verankert und nimmt nur `.jpg`. Damit faellt
  // `<stamm>-1-feed.jpg` heraus (ein Zusatz hinter der Zahl) und `.jpeg`
  // ebenso — beides Absicht: Instagram nimmt fuer Karussells ausschliesslich
  // JPEG, und eine nicht gefundene Folie faellt nicht auf, sie macht den
  // Beitrag stillschweigend zum Einzelbild.
  const muster = new RegExp(`^${stamm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.jpg$`);
  return dateien
    .map((x) => ({ x, n: x.match(muster)?.[1] }))
    .filter((e) => e.n)
    // ⚠ NUMERISCH sortieren. `sort()` allein stellt „-10.jpg" vor „-2.jpg",
    // und die Folien stuenden in der falschen Reihenfolge im Beitrag —
    // sichtbar erst nach dem Veroeffentlichen, korrigierbar gar nicht mehr.
    .sort((a, b) => Number(a.n) - Number(b.n))
    .map((e) => e.x);
}
