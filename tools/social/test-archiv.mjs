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
// ⚠ 2. Bei TikTok zaehlt NUR, was TikTok SELBST gesagt hat. Was dort im
// Posteingang liegt, gibt ein Mensch in der TikTok-App frei — unser eigener
// Vermerk heisst nur „hochgeladen". Bis zum 20.09.2026 blieb TikTok deshalb
// ganz draussen. Seitdem fragt `tiktok-stand.mjs` nach und legt die Antwort
// unter `abfrage` ab; erst mit ihr zaehlt ein Eintrag.
//
// Das ist keine Lockerung, sondern dieselbe Regel mit einer Quelle: Genau
// daran haengt der Wert des Archivs — es soll sagen, was WIRKLICH draussen
// ist, und nicht, was wir hochgeschickt haben.
//
// ⚠ Die Logik steht hier ein zweites Mal statt als Import: Sie sitzt in einer
// Vercel-Funktion mit `export default async function handler(req, res)`, die
// sich ohne Request nicht aufrufen laesst. Faellt dieser Test um, waehrend die
// Funktion laeuft, sind die beiden auseinandergelaufen — auch das ist ein
// Befund.

/** Die Fassung aus freigabe-app/api/freigabe.js, Stand 20.09.2026. */
function zaehltHier(kanal, e) {
  if (e?.stand !== 'veroeffentlicht') return false;
  if (kanal === 'facebook' || kanal === 'instagram') return true;
  if (kanal === 'tiktok') return Boolean(e.abfrage?.status);
  return false;
}

function archivAus(listen) {
  const raus = [];
  for (const l of listen) {
    for (const p of l.uebersicht ?? []) {
      const kanaele = Object.entries(p.kanaele ?? {})
        .filter(([k, e]) => zaehltHier(k, e))
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
pruefe('Ein TikTok-Beitrag steht NICHT drin, solange nur WIR ihn veroeffentlicht nennen',
  !r.some((x) => x.datei === 'd.mp4'), r.map((x) => x.datei).join(', '));

// --- Und die Gegenprobe dazu: TikToks eigene Antwort zaehlt sehr wohl -------
//
// Ohne sie waere die Probe oben auch dann gruen, wenn TikTok fuer immer
// ausgesperrt bliebe — und die ganze Rueckmeldung liefe ins Leere.
{
  const mitAntwort = archivAus([{
    datum: '2026-09-20', app: 'fullrep', uebersicht: [
      {
        datei: 'f.mp4',
        kanaele: {
          tiktok: {
            stand: 'veroeffentlicht',
            abfrage: { status: 'PUBLISH_COMPLETE', postIds: ['7351'], wann: '2026-09-20T18:00:00Z' },
          },
        },
      },
      // Derselbe Stand, aber ohne Antwort von TikTok — der bleibt draussen.
      { datei: 'g.mp4', kanaele: { tiktok: { stand: 'veroeffentlicht' } } },
      // Gefragt, aber TikTok sagt: liegt noch im Posteingang.
      {
        datei: 'h.mp4',
        kanaele: {
          tiktok: { stand: 'posteingang', abfrage: { status: 'SEND_TO_USER_INBOX' } },
        },
      },
    ],
  }]);
  pruefe('Mit TikToks eigener Antwort zaehlt der Beitrag',
    mitAntwort.some((x) => x.datei === 'f.mp4'), mitAntwort.map((x) => x.datei).join(', ') || '(leer)');
  pruefe('Ohne Antwort zaehlt derselbe Stand NICHT',
    !mitAntwort.some((x) => x.datei === 'g.mp4'), mitAntwort.map((x) => x.datei).join(', '));
  pruefe('Gefragt und „liegt noch im Posteingang" zaehlt auch nicht',
    !mitAntwort.some((x) => x.datei === 'h.mp4'), mitAntwort.map((x) => x.datei).join(', '));
  pruefe('Von drei TikTok-Beitraegen zaehlt genau einer',
    mitAntwort.length === 1, String(mitAntwort.length));
}

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
console.log('✓ Das Archiv zeigt nur, was wirklich raus ist — bei TikTok nur, was TikTok selbst sagt.');
