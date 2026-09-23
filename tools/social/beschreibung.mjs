// Die Beschreibung, die WIRKLICH rausgeht — Caption + App-Link + Hashtags.
//
// ⚠ WARUM DAS HIER STEHT UND NICHT IN DEN FUENF GENERATOREN: Jede App
// schreibt ihr Beiblatt selbst, in ihrem eigenen Repo, in ihrem eigenen
// Stil. Josefs Regeln vom 18.09.2026 gelten aber fuer ALLE Beitraege:
// hoechstens fuenf Hashtags, und immer der App-Link in der Beschreibung.
// Eine Regel, die an fuenf Stellen gepflegt werden muss, ist nach dem
// zweiten Repo keine Regel mehr. Hier ist sie EINE Funktion, durch die
// jeder Beitrag laeuft, bevor er ein Netzwerk sieht.
//
// ⚠ WAS BIS ZUM 18.09.2026 PASSIERTE, UND WARUM ES NIEMANDEM AUFFIEL:
// posten.mjs schickte `captionAus(beiblatt)` — und captionAus schneidet an
// der naechsten Abschnittsgrenze ab. Der Abschnitt „## Hashtags" steht
// DAHINTER. Es ging also ueberhaupt kein Hashtag raus, auf keinem Kanal,
// seit dem ersten Beitrag. Die Beiblaetter fuehrten sechs bis acht Stueck,
// die Freigabe-Seite zeigte sie brav zum Kopieren an, und wer von Hand
// postete, benutzte sie. Nur die Automatik nicht. „Steht im Beiblatt"
// heisst nicht „geht raus".

import { captionAus, MAX_HASHTAGS } from './vorflug.mjs';

/**
 * Die Hashtags aus dem Beiblatt.
 *
 * Gesucht wird die Ueberschrift in denselben Schreibweisen, die captionAus()
 * kennt — die fuenf Repos schreiben sie unterschiedlich: „## Hashtags",
 * „HASHTAGS" mit Unterstrich, mit Zierrand. Danach die erste Zeile, die
 * wirklich Hashtags enthaelt.
 */
export function hashtagsAus(beiblatt) {
  if (!beiblatt) return [];
  const start = beiblatt.search(/^[ \t─═—=-]*(?:##\s*Hashtags|HASHTAGS)/im);
  if (start === -1) return [];
  const rest = beiblatt.slice(start).replace(/^.*\n(?:[-=─═]{3,}\n)?/, '');
  const zeile = rest.split('\n').find((z) => /#\w/.test(z));
  if (!zeile) return [];
  return [...zeile.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
}

/**
 * Hashtags, die MITTEN IN DER CAPTION stehen — ohne eigene Ueberschrift.
 *
 * ⚠ Ohne das greift die Fuenfer-Grenze bei Anigosha-Reels nicht. Deren
 * Beiblatt schreibt die Tags als letzte Zeile INNERHALB von
 * „── CAPTION ZUM KOPIEREN ──"; einen Abschnitt „## Hashtags" gibt es dort
 * gar nicht. hashtagsAus() faende also nichts, waehrend captionAus() die
 * elf bis vierzehn Tags brav mit ausliefert — gemessen am 18.09.2026:
 * fandom 11, ladder 14, ansage 6.
 *
 * Erkannt wird nur eine Zeile, die AUSSCHLIESSLICH aus Hashtags besteht.
 * Ein „#1" mitten im Satz bleibt damit Text, und das ist richtig so.
 *
 * Gibt {text, tags} zurueck: den Rest der Caption ohne diese Zeilen, und
 * die gefundenen Tags. Sie muessen raus, sonst stehen sie am Ende doppelt.
 */
export function inlineHashtags(caption) {
  const zeilen = String(caption ?? '').split('\n');
  const istTagZeile = (z) => /\S/.test(z) && /^[\s#]*(?:#[\p{L}\p{N}_]+[\s]*)+$/u.test(z);
  const tags = [];
  const rest = [];
  for (const z of zeilen) {
    if (istTagZeile(z)) tags.push(...[...z.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]));
    else rest.push(z);
  }
  return { text: rest.join('\n').trim(), tags };
}

/**
 * Hoechstens fuenf — und zwar die ERSTEN fuenf.
 *
 * ⚠ Nicht die kuerzesten, nicht die „besten", nicht gewuerfelt. Alle fuenf
 * Repos schreiben ihre Listen von spezifisch nach allgemein: der Markenname
 * zuerst, dann die Nische, dann die breiten Begriffe. Die ersten fuenf sind
 * damit genau die, die den Beitrag am ehesten den richtigen Leuten zeigen.
 * Wer hier sortiert oder wuerfelt, wirft die Ordnung weg, die im Repo
 * bewusst gesetzt wurde.
 */
export function hashtagsKuerzen(tags, max = MAX_HASHTAGS) {
  const gesehen = new Set();
  const raus = [];
  for (const t of tags) {
    const schluessel = t.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    raus.push(t);
    if (raus.length >= max) break;
  }
  return raus;
}

/**
 * Die Hashtags, die an diesem Beitrag WIRKLICH haengen — fertig gekuerzt.
 *
 * ⚠ Eine Quelle fuer beide Verwendungen: den Text, der rausgeht, und das
 * Feld, das die Leitplanke prueft. Standen sie getrennt da, prueft die
 * Leitplanke irgendwann etwas anderes, als gepostet wird — und genau das
 * ist der Fehler, den sie verhindern soll.
 */
export function hashtagsFuer(beiblatt, max = MAX_HASHTAGS) {
  const { tags: drin } = inlineHashtags(captionAus(beiblatt));
  return hashtagsKuerzen([...drin, ...hashtagsAus(beiblatt)], max);
}

/**
 * Die Zeile mit dem App-Link.
 *
 * ⚠ Gesetzt wird `linkInBio` aus apps.json — eine EIGENE Landeseite, die
 * die Plattform erkennt und zum richtigen Store weiterleitet (bei Anigosha
 * `anigosha.vercel.app/get`, siehe public/get.html). NICHT die rohen
 * Adressen von apps.apple.com und play.google.com. Drei Gruende:
 *
 * 1. In eine Instagram- oder TikTok-Beschreibung passt kein klickbarer
 *    Link. Zwei lange Store-Adressen sind dort zwei Zeilen Zeichensalat,
 *    eine kurze Domain kann man sich merken und tippen.
 * 2. Die Landeseite trifft die Plattform des Lesers. Ein iPhone-Nutzer, der
 *    auf eine Play-Adresse tippt, landet in einer Sackgasse.
 * 3. Aendert sich eine Store-Adresse oder kommt eine Plattform dazu, wird
 *    EINE Seite angepasst und kein einziger alter Beitrag ist falsch.
 *
 * Wer trotzdem die beiden Store-Adressen will: hier eintragen und die
 * Leitplanke `store-link` in vorflug.mjs entsprechend lockern. Beides
 * gehoert zusammen, sonst verwirft die Pruefung jeden Beitrag.
 */
export function linkZeile(app, sprache = 'de', beiblatt = null) {
  const ziel = app.linkInBio;
  if (!ziel) return '';
  // ⚠ Ein Beiblatt darf die Zeile ersetzen — aber NUR mit einem Ziel auf der
  // eigenen Domain (23.09.2026). Anlass: WELLbooked!s Posts an Anbieter:innen.
  // „Hier buchen: wellbooked.at" schickt Studiobetreiber auf die Kundenseite;
  // richtig ist die Gründungspartner-Seite. Eine fremde Domain würde hier
  // stillschweigend ignoriert statt übernommen — ein Beiblatt ist Text aus
  // einem Generator, kein Freibrief für beliebige Links unter der Marke.
  const eigen = linkAus(beiblatt, ziel);
  if (eigen) return eigen;
  // ⚠ „Hier laden" passt nicht ueberall. WELLbooked! ist eine
  // Buchungsplattform — dort laedt man nichts, dort bucht man. Deshalb darf
  // jede App in apps.json ihr eigenes Wort fuehren (`linkWort`), und nur
  // wer keines hat, bekommt den Vorgabewert.
  const vorgabe = sprache === 'de' ? 'Hier laden' : 'Get it here';
  const wort = app.linkWort?.[sprache] ?? app.linkWort?.de ?? vorgabe;
  return `${wort}: ${ziel}`;
}

/**
 * Die Linkzeile aus dem Beiblatt, falls es eine eigene führt.
 *
 * Gesucht wird „## Link" (Markdown-Beiblätter) oder „── LINK ──" (die
 * Beiblätter der Reel-Generatoren), danach die erste nicht leere Zeile.
 * Zurück kommt sie nur, wenn sie die Domain von `linkInBio` enthält —
 * sonst null, und es bleibt beim Vorgabelink.
 */
export function linkAus(beiblatt, linkInBio) {
  if (!beiblatt || !linkInBio) return null;
  const start = beiblatt.search(/^[ \t─═—=-]*(?:##\s*Link\s*$|LINK\b)/im);
  if (start === -1) return null;
  const rest = beiblatt.slice(start).replace(/^.*\n(?:[-=─═]{3,}\n)?/, '');
  const zeile = rest.split('\n').map((z) => z.trim()).find(Boolean);
  if (!zeile) return null;
  const domain = String(linkInBio).replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
    .replace(/^www\./, '');
  // JEDE Adresse in der Zeile muss auf die eigene Domain zeigen — nicht nur
  // irgendeine. Sonst ginge „evil.com/wellbooked.at" durch, weil die eigene
  // Domain darin vorkommt.
  const hosts = [...zeile.matchAll(/(?:https?:\/\/)?((?:[\p{L}\p{N}-]+\.)+[a-z]{2,})(?=[/\s]|$)/giu)]
    .map((m) => m[1].toLowerCase().replace(/^www\./, ''));
  return hosts.length && hosts.every((h) => h === domain) ? zeile : null;
}

/**
 * Der Sprechtext aus dem Beiblatt, falls es einen führt — sonst null.
 *
 * ⚠ Er ist zum Einsprechen oder Vorlesenlassen in der TikTok-App gedacht
 * (23.09.2026) und geht NIE mit raus: beschreibungBauen() fasst ihn nicht
 * an, die Caption endet am nächsten „──"-Abschnitt. Claude unterlegt bei
 * WELLbooked! keinen Ton (Anordnung der Inhaberin) — Josef spricht selbst.
 *
 * Gesucht wird „## Sprechtext" oder „── SPRECHTEXT", danach alles bis zur
 * nächsten Abschnittsgrenze.
 */
export function sprechtextAus(beiblatt) {
  if (!beiblatt) return null;
  const start = beiblatt.search(/^[ \t─═—=-]*(?:##\s*Sprechtext|SPRECHTEXT\b)/im);
  if (start === -1) return null;
  const rest = beiblatt.slice(start).replace(/^.*\n(?:[-=─═]{3,}\n)?/, '');
  const ende = rest.search(/^(?:##\s|[─═—]{2,})/m);
  const text = (ende === -1 ? rest : rest.slice(0, ende)).trim();
  return text || null;
}

/**
 * Caption + Link + Hashtags, in dieser Reihenfolge.
 *
 * ⚠ Der Link steht VOR den Hashtags. Netzwerke kuerzen lange Beschreibungen
 * hinter den ersten Zeilen mit „mehr" ab, und was hinter einem Block aus
 * Hashtags steht, liest niemand mehr. Wer die App laden soll, muss den Link
 * sehen, bevor die Schlagwortwolke anfaengt.
 *
 * Gibt es keine Caption, kommt ein leerer String zurueck — posten.mjs lehnt
 * den Beitrag dann ab. Ein Beitrag, der nur aus Link und Hashtags besteht,
 * ist Spam und soll gar nicht erst rausgehen.
 */
export function beschreibungBauen({ app, beiblatt, sprache = 'de', maxHashtags = MAX_HASHTAGS }) {
  // ⚠ Die Caption kommt aus captionAus(), die Hashtags aus dem GANZEN
  // Beiblatt. captionAus schneidet naemlich genau vor dem Hashtag-Abschnitt
  // ab — wer hier beides aus derselben Zeichenkette zieht, bekommt entweder
  // keine Hashtags oder das halbe Beiblatt als Caption. Beides ist schon
  // passiert (siehe den Kopf dieser Datei und den von vorflug.mjs).
  const roh = captionAus(beiblatt).trim();
  if (!roh) return '';

  // Erst die Tags aus der Caption herausloesen, dann die aus dem eigenen
  // Abschnitt. Die inline stehenden zuerst: wo ein Repo sie mitten in den
  // Text schreibt, sind sie auf diesen einen Beitrag gemuenzt.
  const { text: caption } = inlineHashtags(roh);
  if (!caption) return '';

  const teile = [caption];

  const link = linkZeile(app, sprache, beiblatt);
  if (link) teile.push(link);

  // ⚠ Ueber hashtagsFuer(), nicht noch einmal selbst zusammengesucht: Es ist
  // dieselbe Funktion, die die Leitplanke prueft. Zwei Rechenwege waeren zwei
  // Ergebnisse, sobald einer von beiden angefasst wird.
  const tags = hashtagsFuer(beiblatt, maxHashtags);
  if (tags.length) teile.push(tags.map((t) => `#${t}`).join(' '));

  return teile.join('\n\n');
}

export { MAX_HASHTAGS };
