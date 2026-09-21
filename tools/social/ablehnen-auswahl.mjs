// Wer wird abgelehnt, und was passiert dabei mit der Merkliste.
//
// ⚠ WARUM DAS EINE EIGENE DATEI IST. `ablehnen.mjs` laeuft beim Import sofort
// los — es liest die Umgebung, holt die Merklisten und schreibt zurueck. Ein
// Test kann es deshalb nicht importieren, und bis zum 21.09.2026 gab es fuer
// diesen Pfad KEINE einzige Probe. Das ist der Pfad, der Dateien loescht.
//
// Dieselbe Trennung wie bei `tiktok-deutung.mjs`: Die Entscheidung steht hier
// und wird vom Test mit den ECHTEN Funktionen geprueft, nicht mit einer
// abgeschriebenen Zweitfassung, die auseinanderlaufen kann.

/** Ein Beitrag ist „draussen", wenn irgendein Kanal ihn veroeffentlicht hat. */
export function schonDraussen({ liste, post }) {
  const kanaele = Object.entries(post.kanaele ?? {})
    .filter(([, e]) => e.stand === 'veroeffentlicht')
    .map(([kanal]) => kanal);
  const ig = (liste.eintraege ?? []).some((e) => e.datei === post.datei && e.veroeffentlicht);
  return [...new Set([...kanaele, ...(ig ? ['instagram'] : [])])];
}

/**
 * Was an diesem Tag fuer diese App abgelehnt werden soll.
 *
 * `datei` gesetzt  → genau dieser eine Beitrag (der Knopf auf der Freigabe-Seite).
 * `datei` leer     → alle offenen Beitraege (der Aufraeumlauf).
 *
 * ⚠ Der Unterschied zwischen den beiden Faellen liegt NICHT hier, sondern im
 * Umgang mit dem Ergebnis: Im Einzelfall bricht `ablehnen.mjs` ab, wenn der
 * Beitrag schon draussen ist — die Freigabe-Seite verlaesst sich darauf. Im
 * Mengenlauf wird derselbe Beitrag uebersprungen und genannt, denn ein
 * einzelner veroeffentlichter Beitrag darf nicht 115 andere aufhalten.
 */
export function auswaehlen({ liste, datei = null }) {
  const alle = liste.uebersicht ?? [];
  const betrachtet = datei ? alle.filter((p) => p.datei === datei) : alle;

  const nehmen = [];
  const uebersprungen = [];
  for (const post of betrachtet) {
    if (post.abgelehnt) {
      uebersprungen.push({ datei: post.datei, grund: `schon abgelehnt am ${post.abgelehnt}` });
      continue;
    }
    const wo = schonDraussen({ liste, post });
    if (wo.length) {
      uebersprungen.push({ datei: post.datei, grund: `veroeffentlicht (${wo.join(', ')})` });
      continue;
    }
    nehmen.push(post);
  }
  return { nehmen, uebersprungen, gefunden: betrachtet.length };
}

/**
 * Stempelt die gewaehlten Beitraege und raeumt `eintraege` auf.
 *
 * Gibt zurueck, was danach aus dem Blob-Speicher geloescht werden darf —
 * ⚠ inklusive `urls`: Ohne sie bleiben beim Karussell alle Folien ausser der
 * ersten fuer immer liegen.
 *
 * ⚠ Die Liste wird VERAENDERT, nicht kopiert. Der Aufrufer legt sie danach
 * mit `merklisteAblegen` in einem Stueck ab — einmal je App und Tag, nicht
 * einmal je Beitrag. Ein Schreibvorgang je Beitrag waere bei 116 Beitraegen
 * 116 Vollersetzungen derselben Datei.
 */
export function anwenden({ liste, posts, jetzt = new Date().toISOString() }) {
  const namen = new Set(posts.map((p) => p.datei));
  for (const post of posts) post.abgelehnt = jetzt;

  const vorher = (liste.eintraege ?? []).length;
  liste.eintraege = (liste.eintraege ?? []).filter((e) => !namen.has(e.datei));
  const entfernteEintraege = vorher - liste.eintraege.length;

  const wegraeumen = posts
    .filter((p) => p.url)
    .map((p) => ({
      datei: p.datei,
      url: p.url,
      urls: Array.isArray(p.urls) ? p.urls.filter(Boolean) : [],
    }));

  // Der TikTok-Entwurf liegt eventuell schon im Posteingang der App. Loeschen
  // kann ihn keine API — er muss in der App selbst verworfen werden.
  const tiktokEntwuerfe = posts
    .filter((p) => p.kanaele?.tiktok?.stand === 'posteingang')
    .map((p) => p.datei);

  return { entfernteEintraege, wegraeumen, tiktokEntwuerfe };
}

/** Die Tage von `datum` rueckwaerts, neuester zuerst. */
export function tageRueckwaerts(datum, tage) {
  const n = Math.min(Math.max(Number(tage) || 1, 1), 90);
  const raus = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(`${datum}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    raus.push(d.toISOString().slice(0, 10));
  }
  return raus;
}
