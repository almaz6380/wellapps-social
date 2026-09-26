// Zwei Laeufe schreiben dieselbe Merkliste — keiner darf den anderen loeschen.
//
//   node tools/social/test-merkliste-parallel.mjs
//
// --- Wofuer (26.09.2026) -----------------------------------------------------
//
// Josef hat fuer denselben Beitrag Instagram und Facebook kurz nacheinander
// freigegeben. Beide Werkzeuge lasen die Merkliste am Anfang und schrieben sie
// am Ende GANZ zurueck. Instagram brauchte laenger (Reel-Verarbeitung), schrieb
// zuletzt — und der Facebook-Vermerk war weg. Die Freigabe-Seite zeigte
// „wartet", obwohl der Beitrag draussen war; der naechste Tipper haette ihn ein
// zweites Mal gepostet. Dreimal an einem Abend, dazu eine verlorene Ablehnung.
//
// Geprueft wird die ECHTE `merklisteAendern` aus blob.mjs gegen einen Speicher
// im Arbeitsspeicher, der Lesen und Schreiben absichtlich verschraenkt.

import { merklisteAendern, istVorbedingungsFehler } from './veroeffentlichen/blob.mjs';
import { BlobPreconditionFailedError } from '@vercel/blob';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) { gut += 1; console.log(`  ✓ ${name}`); } else { schlecht.push(`${name} — ${gemessen}`); console.log(`  ✗ ${name}\n      ${gemessen}`); }
};

const kopie = (x) => JSON.parse(JSON.stringify(x));

/** Eine Merkliste wie am 26.09.: ein Reel, Instagram und Facebook offen. */
function startListe() {
  return {
    app: 'mahjong', name: 'Mahjong Royale',
    eintraege: [{ datei: 'r.mp4', url: 'u', text: 't' }, { datei: 'k.jpg', url: 'u2', text: 't2' }],
    uebersicht: [
      { datei: 'r.mp4', url: 'u', kanaele: { instagram: { stand: 'wartet' }, facebook: { stand: 'wartet' } } },
      { datei: 'k.jpg', url: 'u2', kanaele: { instagram: { stand: 'wartet' }, facebook: { stand: 'wartet' } } },
    ],
  };
}

/** Ein Speicher, der wie der Blob nur ganze Dateien kennt. */
function speicher(anfang) {
  let inhalt = kopie(anfang);
  return {
    lesen: async () => kopie(inhalt),
    ablegen: async (l) => { inhalt = kopie(l); },
    get: () => inhalt,
    set: (l) => { inhalt = kopie(l); },
  };
}

const fbAendern = (l) => {
  const p = l.uebersicht.find((x) => x.datei === 'r.mp4');
  p.kanaele = { ...p.kanaele, facebook: { stand: 'veroeffentlicht', id: 'FB1' } };
};
const fbDrin = (l) => l.uebersicht.find((x) => x.datei === 'r.mp4').kanaele.facebook.id === 'FB1';
const igAendern = (l) => {
  const e = l.eintraege.find((x) => x.datei === 'r.mp4');
  e.veroeffentlicht = 'T'; e.beitragId = 'IG1';
  const p = l.uebersicht.find((x) => x.datei === 'r.mp4');
  p.kanaele = { ...p.kanaele, instagram: { stand: 'veroeffentlicht', beitragId: 'IG1' } };
};
const igDrin = (l) => l.uebersicht.find((x) => x.datei === 'r.mp4').kanaele.instagram.stand === 'veroeffentlicht';

// --- 1. Gegenprobe: der ALTE Weg verliert ------------------------------------
//
// Beide lesen am Anfang, beide schreiben die ganze alte Fassung zurueck.
// Faellt diese Probe, stimmt der Aufbau des Tests nicht mehr — dann beweist
// auch Probe 2 nichts.
console.log('\n1. Gegenprobe — der alte Weg (ganze Datei aus altem Stand)');
{
  const s = speicher(startListe());
  const ig = await s.lesen();          // Instagram liest (18:48:13)
  const fb = await s.lesen();          // Facebook liest
  fbAendern(fb); await s.ablegen(fb);  // Facebook schreibt (18:48:16)
  igAendern(ig); await s.ablegen(ig);  // Instagram schreibt 33 s spaeter
  pruefe('⚠ alter Weg: der Facebook-Vermerk geht verloren (so war es am 26.09.)',
    !fbDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
}

// --- 2. Neuer Weg, dieselbe Reihenfolge --------------------------------------
console.log('\n2. merklisteAendern — Facebook und Instagram nacheinander, lange Laufzeit dazwischen');
{
  const s = speicher(startListe());
  // Beide „arbeiten" (posten) zuerst — erst DANN wird geschrieben, jeweils frisch.
  await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: fbAendern, drin: fbDrin, lesen: s.lesen, ablegen: s.ablegen, pauseMs: 0 });
  await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: igAendern, drin: igDrin, lesen: s.lesen, ablegen: s.ablegen, pauseMs: 0 });
  pruefe('Facebook-Vermerk bleibt stehen', fbDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
  pruefe('Instagram-Vermerk steht', igDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
  pruefe('Instagram-Eintrag traegt die Beitragsnummer', s.get().eintraege[0].beitragId === 'IG1', JSON.stringify(s.get().eintraege[0]));
  pruefe('der andere Beitrag ist unberuehrt', s.get().uebersicht[1].kanaele.facebook.stand === 'wartet', JSON.stringify(s.get().uebersicht[1]));
}

// --- 3. Einer schreibt GENAU zwischen Lesen und Schreiben dazwischen ----------
//
// Das Restfenster von ~1 s: Facebook liest frisch, Instagram schreibt seine
// (alte) Fassung, Facebook schreibt. Das Nachlesen muss den Verlust bemerken
// und wiederholen — und am Ende muessen BEIDE Vermerke stehen, sofern auch
// Instagram ueber merklisteAendern schreibt.
console.log('\n3. Fremdschreibung im Restfenster — Nachlesen und Wiederholen');
{
  const s = speicher(startListe());
  let zugeschlagen = false;
  let schreibVersuche = 0;
  const ablegenMitStoerung = async (l) => {
    schreibVersuche += 1;
    await s.ablegen(l);
    if (!zugeschlagen) {
      // Direkt nach Facebooks Schreiben kommt ein fremder Stand herein, der
      // Facebooks Eintrag nicht kennt (eine alte Fassung mit Instagram).
      zugeschlagen = true;
      const alt = startListe(); igAendern(alt); s.set(alt);
    }
  };
  const r = await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: fbAendern, drin: fbDrin, lesen: s.lesen, ablegen: ablegenMitStoerung, pauseMs: 0 });
  pruefe('der Verlust wird bemerkt und wiederholt', r.versuche === 2 && schreibVersuche === 2, `versuche=${r.versuche}, geschrieben=${schreibVersuche}`);
  pruefe('danach steht der Facebook-Vermerk', fbDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
  pruefe('und der fremde Instagram-Vermerk ist nicht verloren', igDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
}

// --- 4. Dauerstoerung: laut scheitern, nicht still gruen ----------------------
console.log('\n4. Jemand schreibt JEDES Mal dazwischen');
{
  const s = speicher(startListe());
  const immerStoeren = async (l) => { await s.ablegen(l); s.set(startListe()); };
  let fehler = null;
  try {
    await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: fbAendern, drin: fbDrin, lesen: s.lesen, ablegen: immerStoeren, versuche: 3, pauseMs: 0 });
  } catch (e) { fehler = e; }
  pruefe('nach drei Versuchen ein Fehler — kein stilles „erledigt"', fehler && /3 Versuchen/.test(fehler.message), String(fehler?.message));
}

// --- 5. Ablehnen und Facebook ------------------------------------------------
console.log('\n5. Ablehnen der anderen Karte, waehrend Facebook das Reel vermerkt');
{
  const s = speicher(startListe());
  const ablehnenAendern = (l) => {
    const p = l.uebersicht.find((x) => x.datei === 'k.jpg');
    if (!p.abgelehnt) p.abgelehnt = 'A';
    l.eintraege = l.eintraege.filter((e) => e.datei !== 'k.jpg');
  };
  const ablehnenDrin = (l) => Boolean(l.uebersicht.find((x) => x.datei === 'k.jpg').abgelehnt);
  await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: ablehnenAendern, drin: ablehnenDrin, lesen: s.lesen, ablegen: s.ablegen, pauseMs: 0 });
  await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: fbAendern, drin: fbDrin, lesen: s.lesen, ablegen: s.ablegen, pauseMs: 0 });
  pruefe('die Ablehnung bleibt stehen', ablehnenDrin(s.get()), JSON.stringify(s.get().uebersicht[1]));
  pruefe('der Instagram-Eintrag der abgelehnten Karte bleibt weg', !s.get().eintraege.some((e) => e.datei === 'k.jpg'), JSON.stringify(s.get().eintraege));
  pruefe('und Facebook ist vermerkt', fbDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
}

// --- 6. Der Speicher lehnt ab (ifMatch) — neu lesen statt ueberschreiben ------
//
// Seit dem 26.09. schreibt merklisteAblegen mit `ifMatch`: Hat jemand die Datei
// seit dem Lesen geaendert, wirft `put` BlobPreconditionFailedError. Das ist
// kein Fehler des Laufs, sondern das Signal, frisch zu lesen.
console.log('\n6. Vorbedingung verletzt — frisch lesen, erneut schreiben');
{
  const s = speicher(startListe());
  let abgelehnt = 0;
  const ablegenMitSperre = async (l) => {
    if (abgelehnt === 0) {
      abgelehnt += 1;
      // Instagram hat inzwischen geschrieben; unser Stand ist alt.
      const ig = s.get(); igAendern(ig); s.set(ig);
      throw new BlobPreconditionFailedError();
    }
    await s.ablegen(l);
  };
  const r = await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: fbAendern, drin: fbDrin, lesen: s.lesen, ablegen: ablegenMitSperre, pauseMs: 0 });
  pruefe('die Ablehnung fuehrt zu einem zweiten Versuch', r.versuche === 2 && abgelehnt === 1, `versuche=${r.versuche}`);
  pruefe('Facebook steht danach', fbDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
  pruefe('Instagram, das dazwischen schrieb, auch', igDrin(s.get()), JSON.stringify(s.get().uebersicht[0].kanaele));
  pruefe('der Fehler wird als Vorbedingung erkannt', istVorbedingungsFehler(new BlobPreconditionFailedError()) && !istVorbedingungsFehler(new Error('Netz weg')), 'istVorbedingungsFehler');

  let anderer = null;
  try {
    await merklisteAendern({ datum: 'd', appSchluessel: 'mahjong', aendern: fbAendern, drin: fbDrin, lesen: s.lesen,
      ablegen: async () => { throw new Error('Netz weg'); }, pauseMs: 0 });
  } catch (e) { anderer = e; }
  pruefe('andere Fehler werden NICHT verschluckt', anderer?.message === 'Netz weg', String(anderer?.message));
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Parallele Freigaben loeschen einander nichts mehr — und ein Dauerkonflikt faellt laut auf.');
