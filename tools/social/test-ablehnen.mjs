// Was beim Ablehnen ausgewaehlt wird — und was dabei NICHT passieren darf.
//
//   node tools/social/test-ablehnen.mjs
//
// --- Wofuer ------------------------------------------------------------------
//
// Am 21.09.2026 bekam `ablehnen.mjs` einen Mengenlauf: 116 offene Beitraege
// ueber acht Tage auf einen Schlag. Beim Nachsehen fiel auf, dass fuer diesen
// Pfad **kein einziger Test existierte** — fuer den Pfad, der Dateien aus dem
// Blob-Speicher LOESCHT und den Instagram-Vertrag umschreibt.
//
// Drei Dinge duerfen hier nie passieren, und jedes davon ist unbemerkbar,
// wenn es schiefgeht:
//
//   1. Ein veroeffentlichter Beitrag wird abgelehnt. Dann steht „abgelehnt"
//      ueber einem Beitrag, der draussen laeuft — eine Luege in der Anzeige,
//      und seine Datei waere geloescht, waehrend Instagram sie noch braucht.
//   2. Ein abgelehnter Beitrag bleibt in `eintraege` stehen. Dann geht er beim
//      naechsten Sammel-Freigabelauf trotzdem raus.
//   3. Beim Aufraeumen fehlen die Karussell-Folien. Dann bleiben alle Folien
//      ausser der ersten fuer immer im Speicher liegen.
//
// ⚠ Geprueft werden die ECHTEN Funktionen aus `ablehnen-auswahl.mjs`, nicht
// abgeschriebene Zweitfassungen. Genau dafuer wurde die Datei abgetrennt.

import { auswaehlen, anwenden, schonDraussen, tageRueckwaerts } from './ablehnen-auswahl.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const W = { stand: 'wartet' };
const V = { stand: 'veroeffentlicht' };
const P = { stand: 'posteingang' };

/** Eine Merkliste, wie sie wirklich im Blob liegt. */
const liste = () => ({
  datum: '2026-09-21',
  app: 'fullrep',
  name: 'FullRep',
  tiktok: { konto: 'fullrep.app' },
  eintraege: [
    { datei: 'offen-1.jpg', url: 'https://blob/offen-1.jpg' },
    { datei: 'offen-2.jpg', url: 'https://blob/offen-2.jpg' },
    { datei: 'raus.jpg', url: 'https://blob/raus.jpg', veroeffentlicht: '2026-09-21T08:00:00Z' },
    { datei: 'karussell.jpg', url: 'https://blob/k-1.jpg' },
  ],
  uebersicht: [
    { datei: 'offen-1.jpg', url: 'https://blob/offen-1.jpg', kanaele: { facebook: W, tiktok: P } },
    { datei: 'offen-2.jpg', url: 'https://blob/offen-2.jpg', kanaele: { facebook: W } },
    { datei: 'raus.jpg', url: 'https://blob/raus.jpg', kanaele: { facebook: V, instagram: W } },
    { datei: 'alt.jpg', url: 'https://blob/alt.jpg', abgelehnt: '2026-09-20T10:00:00Z', kanaele: { facebook: W } },
    {
      datei: 'karussell.jpg',
      url: 'https://blob/k-1.jpg',
      urls: ['https://blob/k-1.jpg', 'https://blob/k-2.jpg', 'https://blob/k-3.jpg'],
      kanaele: { instagram: W },
    },
  ],
});

// --- 1. Der Mengenlauf nimmt nur, was offen ist -----------------------------
{
  const l = liste();
  const r = auswaehlen({ liste: l });
  pruefe('Mengenlauf: genau die drei offenen',
    r.nehmen.length === 3
      && r.nehmen.map((p) => p.datei).join(',') === 'offen-1.jpg,offen-2.jpg,karussell.jpg',
    r.nehmen.map((p) => p.datei).join(','));

  pruefe('⚠ Der veroeffentlichte ist NICHT dabei',
    !r.nehmen.some((p) => p.datei === 'raus.jpg'),
    r.nehmen.map((p) => p.datei).join(','));

  // Er traegt facebook=veroeffentlicht UND einen veroeffentlichten
  // Instagram-Eintrag; der Grund nennt beide Quellen. Genau das soll er.
  pruefe('… und er wird mit Grund genannt, nicht verschwiegen',
    r.uebersprungen.some((u) => u.datei === 'raus.jpg'
      && /veroeffentlicht \(/.test(u.grund)
      && u.grund.includes('facebook') && u.grund.includes('instagram')),
    JSON.stringify(r.uebersprungen));

  pruefe('Der schon abgelehnte wird ebenfalls uebersprungen',
    r.uebersprungen.some((u) => u.datei === 'alt.jpg' && /schon abgelehnt/.test(u.grund)),
    JSON.stringify(r.uebersprungen));
}

// --- 2. Instagram entscheidet mit, auch ohne Kanal-Eintrag ------------------
//
// `raus.jpg` traegt facebook=veroeffentlicht. Es gibt aber den umgekehrten
// Fall: Der Kanal steht auf `wartet`, der Instagram-Eintrag ist trotzdem
// schon draussen (freigeben.mjs setzt `veroeffentlicht` DORT). Wer nur die
// Kanaele ansieht, loescht das Bild eines laufenden Instagram-Beitrags.
{
  const l = liste();
  l.uebersicht[0].kanaele = { facebook: W };
  l.eintraege[0].veroeffentlicht = '2026-09-21T09:00:00Z';
  const wo = schonDraussen({ liste: l, post: l.uebersicht[0] });
  pruefe('⚠ Ein veroeffentlichter Instagram-Eintrag zaehlt, auch wenn der Kanal wartet',
    wo.includes('instagram'), JSON.stringify(wo));

  const r = auswaehlen({ liste: l });
  pruefe('… und der Beitrag faellt damit aus der Auswahl',
    !r.nehmen.some((p) => p.datei === 'offen-1.jpg'),
    r.nehmen.map((p) => p.datei).join(','));
}

// --- 3. Der Einzelfall trifft genau einen -----------------------------------
{
  const r = auswaehlen({ liste: liste(), datei: 'offen-2.jpg' });
  pruefe('Einzelfall: genau dieser eine',
    r.nehmen.length === 1 && r.nehmen[0].datei === 'offen-2.jpg' && r.gefunden === 1,
    `${r.gefunden} betrachtet, ${r.nehmen.length} genommen`);

  const fehlt = auswaehlen({ liste: liste(), datei: 'gibtsnicht.jpg' });
  pruefe('Ein unbekannter Dateiname ist NICHT still erfolgreich',
    fehlt.gefunden === 0 && fehlt.nehmen.length === 0,
    `${fehlt.gefunden} betrachtet`);

  const drausn = auswaehlen({ liste: liste(), datei: 'raus.jpg' });
  pruefe('Einzelfall auf einen veroeffentlichten: nichts zu nehmen, Grund vorhanden',
    drausn.nehmen.length === 0 && /veroeffentlicht/.test(drausn.uebersprungen[0]?.grund ?? ''),
    JSON.stringify(drausn.uebersprungen));
}

// --- 4. Was `anwenden` mit der Liste macht ----------------------------------
{
  const l = liste();
  const { nehmen } = auswaehlen({ liste: l });
  const r = anwenden({ liste: l, posts: nehmen, jetzt: '2026-09-21T18:00:00Z' });

  pruefe('Alle gewaehlten tragen den Stempel',
    nehmen.every((p) => p.abgelehnt === '2026-09-21T18:00:00Z'),
    nehmen.map((p) => p.abgelehnt).join(','));

  pruefe('⚠ Sie stehen weiter in der Uebersicht — Ablehnen ist kein Loeschen',
    l.uebersicht.length === 5, String(l.uebersicht.length));

  pruefe('⚠ Aus eintraege sind sie RAUS (sonst postet freigeben.mjs sie trotzdem)',
    l.eintraege.length === 1 && l.eintraege[0].datei === 'raus.jpg',
    l.eintraege.map((e) => e.datei).join(','));

  pruefe('… und die Zahl wird gemeldet',
    r.entfernteEintraege === 3, String(r.entfernteEintraege));

  pruefe('Der veroeffentlichte Eintrag bleibt unangetastet',
    l.eintraege.some((e) => e.datei === 'raus.jpg' && e.veroeffentlicht),
    JSON.stringify(l.eintraege));
}

// --- 5. Das Aufraeumen nimmt die Karussell-Folien mit -----------------------
{
  const l = liste();
  const { nehmen } = auswaehlen({ liste: l });
  const r = anwenden({ liste: l, posts: nehmen });

  const k = r.wegraeumen.find((w) => w.datei === 'karussell.jpg');
  pruefe('⚠ Beim Karussell gehen ALLE drei Folien mit, nicht nur die erste',
    k?.urls.length === 3, JSON.stringify(k));

  pruefe('Die Datei des veroeffentlichten Beitrags wird nie zum Loeschen gemeldet',
    !r.wegraeumen.some((w) => w.datei === 'raus.jpg'),
    r.wegraeumen.map((w) => w.datei).join(','));

  pruefe('Ein Beitrag ohne url taucht im Aufraeumen nicht auf',
    (() => {
      const l2 = liste();
      l2.uebersicht = [{ datei: 'ohne.jpg', kanaele: { facebook: W } }];
      l2.eintraege = [];
      const a = anwenden({ liste: l2, posts: auswaehlen({ liste: l2 }).nehmen });
      return a.wegraeumen.length === 0;
    })(), 'siehe Probe');
}

// --- 6. Die TikTok-Entwuerfe werden benannt ---------------------------------
//
// Sie sind der einzige Rest, den kein Lauf erledigen kann. Wer das verschweigt,
// laesst Josef glauben, das Postfach sei mit aufgeraeumt.
{
  const l = liste();
  const r = anwenden({ liste: l, posts: auswaehlen({ liste: l }).nehmen });
  pruefe('⚠ Der TikTok-Entwurf wird gemeldet — die API kann ihn nicht loeschen',
    r.tiktokEntwuerfe.length === 1 && r.tiktokEntwuerfe[0] === 'offen-1.jpg',
    JSON.stringify(r.tiktokEntwuerfe));
}

// --- 7. Ein zweiter Lauf ist ein No-op --------------------------------------
{
  const l = liste();
  anwenden({ liste: l, posts: auswaehlen({ liste: l }).nehmen });
  const zweiter = auswaehlen({ liste: l });
  pruefe('Zweiter Lauf: nichts mehr zu tun, nichts wird doppelt geloescht',
    zweiter.nehmen.length === 0, zweiter.nehmen.map((p) => p.datei).join(','));
}

// --- 8. Die Tage rueckwaerts ------------------------------------------------
{
  pruefe('TAGE=1 ist genau der eine Tag',
    tageRueckwaerts('2026-09-21', 1).join(',') === '2026-09-21',
    tageRueckwaerts('2026-09-21', 1).join(','));

  pruefe('TAGE=3 geht rueckwaerts, neuester zuerst',
    tageRueckwaerts('2026-09-21', 3).join(',') === '2026-09-21,2026-09-20,2026-09-19',
    tageRueckwaerts('2026-09-21', 3).join(','));

  pruefe('Ueber den Monatsanfang hinweg stimmt es auch',
    tageRueckwaerts('2026-09-02', 3).join(',') === '2026-09-02,2026-09-01,2026-08-31',
    tageRueckwaerts('2026-09-02', 3).join(','));

  pruefe('Unsinn wird gedeckelt statt uebernommen',
    tageRueckwaerts('2026-09-21', 0).length === 1
      && tageRueckwaerts('2026-09-21', 999).length === 90,
    `${tageRueckwaerts('2026-09-21', 0).length} / ${tageRueckwaerts('2026-09-21', 999).length}`);
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Ablehnen trifft nie einen veroeffentlichten Beitrag — und vergisst keine Folie.');
