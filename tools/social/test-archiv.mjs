// Das Archiv der Freigabe-Seite — was zaehlt als „gepostet".
//
//   node tools/social/test-archiv.mjs
//
// --- Wofuer ----------------------------------------------------------------
//
// Josef am 20.09.2026: „Und wo sehe ich die geposteten?" Die Tagesansicht
// beantwortet „was ist heute noch zu tun", nicht „was ist diese Woche
// rausgegangen" — dafuer muesste man jeden Tag einzeln aufrufen.
//
// --- Die zwei Entscheidungen, die man falsch treffen kann -------------------
//
// ⚠ 1. NUR `veroeffentlicht` zaehlt. Ein Beitrag, der auf einen Knopf wartet
// oder mit einem Fehler liegen blieb, ist nicht gepostet. Ihn mitzuzaehlen
// waere eine Zahl ueber etwas, das nie stattgefunden hat.
//
// ⚠ 2. TikTok zaehlt NICHT. Was dort im Posteingang liegt, gibt ein Mensch in
// der TikTok-App frei, und niemand meldet es zurueck. Die Seite weiss es
// schlicht nicht — sie darf es also auch nicht behaupten. Genau daran haengt
// der Wert des Archivs: Es soll sagen, was WIRKLICH draussen ist.
//
// ⚠ Die Logik steht hier ein zweites Mal statt als Import: Sie sitzt in einer
// Vercel-Funktion mit `export default async function handler(req, res)`, die
// sich ohne Request nicht aufrufen laesst. Faellt dieser Test um, waehrend die
// Funktion laeuft, sind die beiden auseinandergelaufen — auch das ist ein
// Befund.

/** Die Fassung aus freigabe-app/api/freigabe.js, Stand 20.09.2026. */
function archivAus(listen) {
  const raus = [];
  for (const l of listen) {
    for (const p of l.uebersicht ?? []) {
      const kanaele = Object.entries(p.kanaele ?? {})
        .filter(([k, e]) => ['facebook', 'instagram'].includes(k)
          && e?.stand === 'veroeffentlicht')
        .map(([k, e]) => ({ kanal: k, ...e }));
      if (!kanaele.length) continue;
      raus.push({ datum: l.datum, app: l.app, datei: p.datei, kanaele });
    }
  }
  raus.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
  return raus;
}

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const V = { stand: 'veroeffentlicht' };
const W = { stand: 'wartet' };
const F = { stand: 'fehler' };
const P = { stand: 'posteingang' };

const listen = [
  {
    datum: '2026-09-19', app: 'fullrep', uebersicht: [
      { datei: 'a.jpg', kanaele: { facebook: V, instagram: V, tiktok: P } },
      { datei: 'b.jpg', kanaele: { facebook: W, instagram: W, tiktok: P } },
    ],
  },
  {
    datum: '2026-09-20', app: 'anigosha', uebersicht: [
      { datei: 'c.jpg', kanaele: { facebook: V, instagram: W } },
      { datei: 'd.mp4', kanaele: { tiktok: V } },
      { datei: 'e.jpg', kanaele: { facebook: F, instagram: F } },
    ],
  },
];

const r = archivAus(listen);

pruefe('Nur Veroeffentlichtes steht drin — drei von fuenf fallen weg',
  r.length === 2, `${r.length}: ${r.map((x) => x.datei).join(', ')}`);

pruefe('Ein Beitrag, der nur wartet, steht NICHT drin',
  !r.some((x) => x.datei === 'b.jpg'), r.map((x) => x.datei).join(', '));

pruefe('Ein Beitrag mit Fehler steht NICHT drin',
  !r.some((x) => x.datei === 'e.jpg'), r.map((x) => x.datei).join(', '));

// ⚠ Die wichtigste Probe der Datei.
pruefe('Ein TikTok-Beitrag steht NICHT drin, auch wenn TikTok „veroeffentlicht" meldet',
  !r.some((x) => x.datei === 'd.mp4'), r.map((x) => x.datei).join(', '));

pruefe('Teilweise gepostet zaehlt — Facebook draussen reicht fuer den Eintrag',
  r.some((x) => x.datei === 'c.jpg' && x.kanaele.length === 1
    && x.kanaele[0].kanal === 'facebook'),
  JSON.stringify(r.find((x) => x.datei === 'c.jpg')?.kanaele));

pruefe('Beide Kanaele draussen ergeben ZWEI Marken an einem Eintrag',
  r.find((x) => x.datei === 'a.jpg')?.kanaele.length === 2,
  JSON.stringify(r.find((x) => x.datei === 'a.jpg')?.kanaele));

pruefe('Neueste zuerst',
  r[0].datum === '2026-09-20' && r[1].datum === '2026-09-19',
  r.map((x) => x.datum).join(' → '));

// Leere Eingabe darf nicht krachen — an Tagen ohne Lauf gibt es keine Liste.
pruefe('Keine Listen ergibt eine leere Ausgabe, keinen Fehler',
  archivAus([]).length === 0, String(archivAus([]).length));
pruefe('Eine Liste ohne uebersicht kracht nicht',
  archivAus([{ datum: '2026-09-18', app: 'swaply' }]).length === 0, 'ok');

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Das Archiv zeigt nur, was wirklich raus ist — und TikTok behauptet es nicht mit.');
