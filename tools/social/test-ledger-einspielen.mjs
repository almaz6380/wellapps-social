// Parallele Tageslaeufe duerfen einander den Ledger nicht wegnehmen.
//
//   node tools/social/test-ledger-einspielen.mjs
//
// Der Fall vom 22.09.2026: Mehrere Laeufe starteten binnen Sekunden, nur der
// erste bekam seinen Ledger auf main, die anderen wurden beim Push
// abgewiesen und verloren ihre Zeilen. Die Beitraege waren trotzdem
// versendet. Siehe ledger-einspielen.mjs.
//
// ⚠ Geprueft wird die ECHTE `einspielen`, nicht eine abgeschriebene Fassung.

import { einspielen } from './ledger-einspielen.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const z = (app, winkel, seed, datum = '2026-09-22', extra = {}) => ({
  app, datum, winkel, medium: 'bild', schluessel: 'x', inhalt: `seed${seed}`, sprache: 'de', ...extra,
});
const L = (...zeilen) => ({ zeilen });
const namen = (l) => l.zeilen.map((r) => `${r.app}/${r.winkel}`).join(',');

const ALT = z('anigosha', 'alt', 1, '2026-09-21');

// --- 1. Der Fall vom 22.09.: zwei Apps parallel -----------------------------
//
// Lauf A (wellbooked) war zuerst auf main. Lauf B (swaply) kommt danach und
// muss seine Zeilen NEBEN die von A legen, nicht darueber.
{
  const basis = L(ALT);
  const nachA = L(ALT, z('wellbooked', 'anruf', 2));
  const unsereB = L(ALT, z('swaply', 'tausch', 3));
  const { ledger } = einspielen(basis, unsereB, nachA);
  pruefe('zwei Apps parallel: beide bleiben', namen(ledger) === 'anigosha/alt,wellbooked/anruf,swaply/tausch', namen(ledger));
}

// --- 2. Ersetzen bleibt Ersetzen --------------------------------------------
//
// Ein zweiter Lauf fuer dieselbe App ersetzt die Zeilen von heute. Das muss
// auch gelten, wenn inzwischen eine andere App geschrieben hat.
{
  const heuteAlt = z('fullrep', 'mythos-check', 4);
  const basis = L(ALT, heuteAlt);
  const ziel = L(ALT, heuteAlt, z('mahjong', 'paar', 5));
  const unsere = L(ALT, z('fullrep', 'rezept-karte', 6));
  const { ledger } = einspielen(basis, unsere, ziel);
  pruefe('ersetzen: alte Zeile weg, fremde bleibt', namen(ledger) === 'anigosha/alt,mahjong/paar,fullrep/rezept-karte', namen(ledger));
}

// --- 3. Nichts geaendert → nichts geaendert ---------------------------------
{
  const ziel = L(ALT, z('mahjong', 'paar', 5));
  const { ledger, dazu } = einspielen(L(ALT), L(ALT), ziel);
  pruefe('leerer Lauf aendert nichts', JSON.stringify(ledger) === JSON.stringify(ziel) && dazu === 0, namen(ledger));
}

// --- 4. Vielfachheit ---------------------------------------------------------
//
// Dieselbe Zeile zweimal im Ziel, unser Lauf entfernt EINE → eine bleibt.
// Eine einfache Menge wuerde beide treffen.
{
  const d = z('mahjong', 'paar', 7);
  const { ledger } = einspielen(L(d), L(), L(d, d));
  pruefe('Vielfachheit: nur eine entfernt', ledger.zeilen.length === 1, ledger.zeilen.length);
}

// --- 5. Feldreihenfolge ist egal ---------------------------------------------
{
  const a = z('swaply', 'tausch', 8);
  const umgedreht = Object.fromEntries(Object.entries(a).reverse());
  const { ledger } = einspielen(L(a), L(), L(umgedreht));
  pruefe('Feldreihenfolge: trotzdem erkannt', ledger.zeilen.length === 0, ledger.zeilen.length);
}

// --- 6. Gegenprobe: der naive Weg verliert ----------------------------------
//
// Ohne Einspielen gewinnt der eine Stand den anderen. Diese Probe belegt, dass
// der Fehler existiert, den der Rest verhindert.
{
  const nachA = L(ALT, z('wellbooked', 'anruf', 2));
  const unsereB = L(ALT, z('swaply', 'tausch', 3));
  pruefe('Gegenprobe: ueberschreiben verliert A', !namen(unsereB).includes('wellbooked'), namen(unsereB));
  pruefe('Gegenprobe: einspielen behaelt A', namen(einspielen(L(ALT), unsereB, nachA).ledger).includes('wellbooked'), '');
}

// --- 7. Andere Felder des Ledgers bleiben erhalten ---------------------------
{
  const { ledger } = einspielen(L(), L(ALT), { zeilen: [], hinweis: 'x' });
  pruefe('Zusatzfelder bleiben', ledger.hinweis === 'x' && ledger.zeilen.length === 1, JSON.stringify(ledger));
}

console.log(`${gut} Probe(n) bestanden`);
if (schlecht.length) {
  console.log(`✗ ${schlecht.length} gescheitert:`);
  for (const s of schlecht) console.log(`   ${s}`);
  process.exit(1);
}
