// Was passiert, wenn ein BESTELLTER Winkel nicht verfuegbar ist.
//
//   node tools/social/test-waehlen-bestellt.mjs
//
// --- Wofuer ----------------------------------------------------------------
//
// Am 21.09.2026 wollte Josef die neue Steckbrief-Karte sehen. Bestellt waren
// zwei Winkel, `serien-steckbrief` und `wusstest-du-karte`. Im Protokoll des
// echten Laufs stand:
//
//     ▣ wusstest-du-karte · de · Seed 37867
//     1 von 1 Posts fertig
//
// Der Steckbrief fehlte. Kein Fehler, keine Warnung, der Lauf gruen.
//
// --- Der Grund war in Ordnung, das Schweigen nicht ---------------------------
//
// `serien-steckbrief` trug `status: "neu"`, und `lauf.mjs` setzt bei jedem
// echten Lauf `nurVorhanden: true`. Die Sperre ist genau so gebaut: Ein neuer
// Winkel geht nicht live, bevor ihn jemand freischaltet. Richtig.
//
// Falsch war nur, dass es nirgends stand. `waehlePosts` warf bis dahin bloss,
// wenn KEIN EINZIGER bestellter Winkel uebrig blieb; von zwei bestellten
// einer uebrig hiess: still weitermachen.
//
// ⚠ Einen Winkel ueber die Workflow-Eingabe zu bestellen ist die HANDLUNG
// EINES MENSCHEN. Sie halb auszufuehren, ohne es zu sagen, ist dieselbe
// Klasse stiller Fehlschlag wie der geloeschte Merkliste-Eintrag (27.→28.) und
// das nie verdrahtete Reel (Lauf 37).
//
// ⚠ Hier wird die ECHTE `waehlePosts` importiert, nicht eine abgeschriebene.
// `waehlen.mjs` laeuft beim Import nicht los — anders als `posten.mjs` und
// `tiktok-stand.mjs`, wo die Logik deshalb zweimal steht.

import { waehlePosts } from './waehlen.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

// ⚠ Die Winkel kommen aus der ECHTEN ideen/anigosha.json, nicht aus einer
// Attrappe. Damit faellt dieser Test auch dann um, wenn jemand dort einen
// Status verstellt — und genau das war der Befund vom 21.09.
const LEER = { zeilen: [] };
const HEUTE = '2026-09-21';
const basis = { app: 'anigosha', heute: HEUTE, ledger: LEER, sprachen: ['de'], anzahl: 2 };

// --- 1. Der Fall, der den Fehler ausgeloest hat -----------------------------
//
// Ein bestellter Winkel ist `neu`, der andere `vorhanden`. Fuer diese Probe
// braucht es einen, der wirklich auf `neu` steht — `nur-fuer-profis` tut das,
// und solange sein Format nicht gebaut ist, soll er das auch.
{
  const r = waehlePosts({
    ...basis, nurVorhanden: true,
    nurWinkel: ['nur-fuer-profis', 'wusstest-du-karte'],
  });
  pruefe('Ein Winkel bleibt uebrig — der Lauf geht weiter, kein Abbruch',
    r.length === 1 && r[0].winkel === 'wusstest-du-karte',
    `${r.length}: ${r.map((p) => p.winkel).join(', ')}`);

  pruefe('⚠ Der weggefallene Winkel wird GEMELDET',
    r.weggefallen?.length === 1 && r.weggefallen[0].id === 'nur-fuer-profis',
    JSON.stringify(r.weggefallen));

  pruefe('… und zwar mit dem Grund aus den Daten, nicht mit einer Vermutung',
    /status: neu/.test(r.weggefallen?.[0]?.grund ?? ''), r.weggefallen?.[0]?.grund);
}

// --- 2. Die Gegenprobe: nichts faellt weg, nichts wird gemeldet -------------
//
// Ohne sie waere Probe 1 auch dann gruen, wenn IMMER etwas gemeldet wuerde —
// und eine Warnung, die bei jedem Lauf steht, liest nach drei Tagen niemand.
{
  const r = waehlePosts({
    ...basis, nurVorhanden: true,
    nurWinkel: ['serien-steckbrief', 'wusstest-du-karte'],
  });
  pruefe('Beide vorhanden: beide kommen',
    r.length === 2, `${r.length}: ${r.map((p) => p.winkel).join(', ')}`);
  pruefe('Beide vorhanden: nichts wird gemeldet',
    (r.weggefallen ?? []).length === 0, JSON.stringify(r.weggefallen));
}

// --- 3. Genau der Lauf vom 21.09., nur mit dem freigeschalteten Status ------
//
// ⚠ DIE WICHTIGSTE PROBE DER DATEI. Sie faellt um, sobald jemand
// `serien-steckbrief` wieder auf `neu` setzt — und damit genau in dem Moment,
// in dem der Winkel erneut still aus echten Laeufen verschwinden wuerde.
{
  const r = waehlePosts({ ...basis, nurVorhanden: true, nurWinkel: ['serien-steckbrief'] });
  pruefe('serien-steckbrief ist freigeschaltet und kommt in einem ECHTEN Lauf durch',
    r.length === 1 && r[0].winkel === 'serien-steckbrief' && r[0].format === 'steckbrief-karte',
    `${r.length}: ${r.map((p) => `${p.winkel}/${p.format}`).join(', ')}`);
}

// --- 4. Alles bestellte faellt weg → Abbruch wie bisher ---------------------
{
  let warf = null;
  try {
    waehlePosts({ ...basis, nurVorhanden: true, nurWinkel: ['nur-fuer-profis', 'jahrestag'] });
  } catch (e) { warf = e.message; }
  pruefe('Kein einziger bestellter Winkel uebrig: Abbruch',
    Boolean(warf), warf ?? '(nichts geworfen)');
  pruefe('… und die Meldung nennt die moeglichen Winkel',
    /Moeglich:/.test(warf ?? ''), warf);
}

// --- 5. Ein Winkel, den es gar nicht gibt -----------------------------------
{
  let warf = null;
  try {
    waehlePosts({ ...basis, nurVorhanden: true, nurWinkel: ['gibtsnicht'] });
  } catch (e) { warf = e.message; }
  pruefe('Ein erfundener Winkel bricht ab statt still zu verschwinden',
    Boolean(warf), warf ?? '(nichts geworfen)');
}

// --- 6. Im Trockenlauf darf `neu` mitspielen --------------------------------
//
// Das ist der Sinn von `status: neu`: ansehen ja, senden nein. `lauf.mjs`
// setzt `nurVorhanden` nur bei `--echt`.
{
  const r = waehlePosts({ ...basis, nurVorhanden: false, nurWinkel: ['nur-fuer-profis'] });
  pruefe('Trockenlauf: ein neuer Winkel kommt durch',
    r.length === 1 && r[0].winkel === 'nur-fuer-profis',
    `${r.length}: ${r.map((p) => p.winkel).join(', ')}`);
  pruefe('Trockenlauf: dann gibt es auch nichts zu melden',
    (r.weggefallen ?? []).length === 0, JSON.stringify(r.weggefallen));
}

// --- 7. Ohne Bestellung bleibt alles, wie es war ----------------------------
//
// Die Rotation darf sich durch diese Aenderung nicht bewegen.
{
  const r = waehlePosts({ ...basis, nurVorhanden: true });
  pruefe('Ohne Bestellung liefert die Rotation das Tagespaket',
    r.length === 2, `${r.length}`);
  pruefe('Ohne Bestellung wird nichts gemeldet',
    (r.weggefallen ?? []).length === 0, JSON.stringify(r.weggefallen));
}

// --- 8. `weggefallen` darf das Feld nicht veraendern ------------------------
//
// Es haengt als NICHT aufzaehlbare Eigenschaft am Feld. Wer die Liste
// weiterreicht, serialisiert oder zaehlt, darf davon nichts merken.
{
  const r = waehlePosts({
    ...basis, nurVorhanden: true, nurWinkel: ['nur-fuer-profis', 'wusstest-du-karte'],
  });
  pruefe('weggefallen taucht nicht in Object.keys auf',
    !Object.keys(r).includes('weggefallen'), Object.keys(r).join(','));
  pruefe('weggefallen veraendert JSON.stringify nicht',
    JSON.parse(JSON.stringify(r)).length === r.length
      && !JSON.stringify(r).includes('weggefallen'),
    JSON.stringify(r).slice(0, 80));
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Ein bestellter Winkel faellt nie mehr still weg — und `neu` bleibt `neu`.');
