// Prueft die freie Karte der vier Apps, die sie nicht im eigenen Repo haben.
//
//   CHROMIUM_PFAD=/opt/pw-browsers/chromium node tools/social/test-freie-karte.mjs
//
// Braucht playwright (steht in package.json dieses Repos). Es geht nichts ins
// Netz, nichts in einen Kanal und nichts in den Ledger: Gerendert wird in ein
// Verzeichnis unter /tmp, und aufgerufen wird der Generator direkt, nicht
// ueber lauf.mjs.
//
// --- Wonach gefragt wird ----------------------------------------------------
//
// 1. Entsteht ueberhaupt ein JPEG und ein Beiblatt — je Marke?
// 2. Ist der Text im Beiblatt eine CAPTION und nicht das halbe Beiblatt?
//    Das ist der Fehler, der Anigoshas freier Karte am 18.09.2026 passiert
//    ist: Ohne die Rubrik „ZUR KONTROLLE" lief die Caption bis ans Dateiende
//    und nahm „Store-Satz: …" mit, und posten.mjs brach ab.
// 3. Geht der Beitrag durch dieselbe Leitplanke wie im Tageslauf?
// 4. Ist der Haken LESBAR? Der Markenverlauf traegt ihn nicht bei jeder Marke
//    (WELLbooked!: Dunkelgruen auf Dunkelgruen, gemessen 1,55:1). Der
//    Generator misst und weicht aus; hier wird nachgemessen.
// 5. Schlaegt der Ueberlauf-Waechter an? Er hat beim Bauen EINMAL NICHT
//    angeschlagen (min-height:0 am Inhaltsblock, 444 Zeichen gingen als
//    „passt" durch, auf dem JPEG lag die Schlagzeile ueber der Wortmarke).
//    Eine Probe, die diesen Fall nicht stellt, haette ihn nicht gefunden.
// 6. Kennt die Freigabe-Seite dieselben Apps wie apps.json? Eine App, die
//    dazukommt und im Menue fehlt, faellt sonst nie auf.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { captionAus, riechtNachBeiblatt, pruefe as leitplanke, storeSatz } from './vorflug.mjs';
import { beschreibungBauen, hashtagsFuer, linkZeile, MAX_HASHTAGS } from './beschreibung.mjs';
import { ladeApps } from './waehlen.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const GENERATOR = join(HIER, 'karten-fremd', 'freie-karte.mjs');
const APPS = ladeApps();

let gut = 0;
const schlecht = [];
const probe = (name, bedingung, einzelheit = '') => {
  if (bedingung) { gut++; console.log(`  ✓ ${name}`); return true; }
  schlecht.push(`${name}${einzelheit ? ` — ${einzelheit}` : ''}`);
  console.log(`  ✗ ${name}${einzelheit ? ` — ${einzelheit}` : ''}`);
  return false;
};

const OUT = mkdtempSync(join(tmpdir(), 'freie-karte-probe-'));

/** Ruft den Generator auf. Gibt {code, ausgabe} zurueck, ohne je zu werfen. */
function zeichne(args) {
  try {
    const ausgabe = execFileSync('node', [GENERATOR, '--out', OUT, ...args], {
      cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    return { code: 0, ausgabe };
  } catch (e) {
    return { code: e.status ?? 1, ausgabe: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

// Die vier Apps mit dem gemeinsamen Generator. Anigosha fehlt mit Absicht:
// Seine Karte zeichnet sein eigener Repo-Generator, der hier gar nicht liegt.
const FAELLE = [
  { k: 'mahjong', lang: 'en', text: 'Every board is solvable. Every single one.',
    haken: 'Did you know?', cta: 'Play now' },
  { k: 'wellbooked', lang: 'de', text: 'Heute noch frei: ein Termin um 14:30 in deiner Naehe.',
    haken: 'Wusstest du?', cta: 'Jetzt ansehen' },
  { k: 'fullrep', lang: 'de', text: 'Drei Saetze reichen. Wenn der letzte wirklich schwer war.',
    haken: 'Wusstest du?', cta: 'Jetzt starten' },
  { k: 'swaply', lang: 'de', text: 'Drei Tage nicht dran? Fang einfach neu an.',
    haken: 'Wusstest du?', marke: 'Swaply 2.0', cta: 'Jetzt tauschen' },
];

console.log('Je Marke: zeichnen, Beiblatt lesen, Leitplanke, Kontrast\n');

for (const f of FAELLE) {
  const app = APPS[f.k];
  const name = `probe-${f.k}`;
  console.log(`${app.name}`);

  const lauf = zeichne([
    '--app', f.k, '--lang', f.lang, '--seed', '4711', '--name', name,
    '--store', storeSatz(app, f.lang),
    '--text', f.text,
    ...(f.haken ? ['--haken', f.haken] : []),
    ...(f.marke ? ['--marke', f.marke] : []),
    ...(f.cta ? ['--cta', f.cta] : []),
  ]);
  if (!probe('gezeichnet', lauf.code === 0, lauf.ausgabe.trim().split('\n').pop())) continue;

  const jpg = join(OUT, `${name}.jpg`);
  const txt = join(OUT, `${name}.txt`);
  probe('JPEG da', existsSync(jpg));
  // ⚠ Nicht nur „Datei da": Eine leere oder abgebrochene Datei waere auch da.
  // FF D8 ist der Anfang jedes JPEG.
  const kopf = existsSync(jpg) ? readFileSync(jpg).subarray(0, 2) : Buffer.alloc(0);
  probe('JPEG ist ein JPEG', kopf[0] === 0xff && kopf[1] === 0xd8);
  if (!probe('Beiblatt da', existsSync(txt))) continue;

  const beiblatt = readFileSync(txt, 'utf8');
  const caption = captionAus(beiblatt);

  probe('Caption gefunden', caption.length > 0);
  probe('Caption traegt Josefs Satz', caption.includes(f.text), caption.slice(0, 60));
  // Die Grenze, nicht der Text: Ohne „ZUR KONTROLLE" liefe die Caption bis
  // ans Dateiende.
  probe('Caption endet vor der Kontrollrubrik',
    !caption.includes('Store-Satz') && !caption.includes('Medienherkunft'),
    caption.slice(-60));
  probe('riecht nicht nach Beiblatt', riechtNachBeiblatt(caption) === null,
    String(riechtNachBeiblatt(caption)));

  const beschreibung = beschreibungBauen({ app, beiblatt, sprache: f.lang });
  const tags = hashtagsFuer(beiblatt);
  probe(`hoechstens ${MAX_HASHTAGS} Hashtags`, tags.length <= MAX_HASHTAGS, tags.join(' '));
  probe('Hashtags vorhanden', tags.length > 0);
  probe('App-Link in der Beschreibung', beschreibung.includes(app.linkInBio), app.linkInBio);

  // Dieselbe Pruefung, die lauf.mjs im Kartenlauf fuehrt.
  const ergebnis = leitplanke({
    appSchluessel: f.k, app,
    post: { medium: 'bild', format: 'freie-karte', winkel: 'freie-karte', sprache: f.lang },
    texte: {
      caption,
      hashtags: tags.map((t) => `#${t}`).join(' '),
      applink: linkZeile(app, f.lang, beiblatt),
      medienherkunft: 'typografie',
    },
  });
  probe('Leitplanke bestanden', ergebnis.bestanden,
    ergebnis.funde.filter((x) => x.hart).map((x) => x.regel).join(', '));

  // ⚠ Der Generator schreibt die gemessenen Kontraste ins Beiblatt, damit
  // genau das hier nachpruefbar ist, ohne das JPEG auszuwerten.
  const hakenZeile = beiblatt.split('\n').find((z) => z.startsWith('Haken:')) ?? '';
  const werte = [...hakenZeile.matchAll(/(\d+\.\d+)(?=\s*[/:])/g)].map((m) => Number(m[1]));
  probe('Haken erreicht 3:1 gegen den Grund',
    werte.length > 0 && Math.min(...werte) >= 3, hakenZeile.trim());

  console.log('');
}

// --- Die Leitplanke muss auch hier greifen ----------------------------------
//
// WELLbooked! ohne Ausrufezeichen ist der Fall, bei dem ein Mensch am Handy
// danebengreift. Er darf NICHT durchgehen, sonst steht die Marke falsch im
// Feed.
console.log('Leitplanke gegen einen falsch getippten Markennamen');
{
  const name = 'probe-marke';
  zeichne(['--app', 'wellbooked', '--lang', 'de', '--seed', '1', '--name', name,
    '--text', 'WELLbooked findet freie Termine in deiner Naehe.']);
  const txt = join(OUT, `${name}.txt`);
  const caption = existsSync(txt) ? captionAus(readFileSync(txt, 'utf8')) : '';
  const ergebnis = leitplanke({
    appSchluessel: 'wellbooked', app: APPS.wellbooked,
    post: { medium: 'bild', format: 'freie-karte', winkel: 'freie-karte', sprache: 'de' },
    texte: { caption, medienherkunft: 'typografie' },
  });
  probe('„WELLbooked" ohne ! wird verworfen', !ergebnis.bestanden,
    ergebnis.funde.map((x) => x.regel).join(', '));
}

// --- Der Ueberlauf-Waechter -------------------------------------------------
//
// ⚠ DIESE PROBE HAT EINEN ECHTEN FEHLER GEFUNDEN (04.10.2026). Mit
// min-height:0 am Inhaltsblock meldete der Body nie einen Ueberlauf: 444
// Zeichen galten als „passt", und auf dem JPEG lag die Schlagzeile ueber der
// Wortmarke. Ein Waechter, den niemand gegen einen zu langen Text stellt, ist
// keiner.
console.log('\nUeberlauf');
{
  const name = 'probe-ueberlauf';
  const lauf = zeichne(['--app', 'mahjong', '--lang', 'de', '--seed', '1', '--name', name,
    '--text', 'Viel zu lang. '.repeat(120), '--haken', 'Wusstest du?', '--cta', 'Jetzt spielen']);
  probe('zu langer Text wird abgewiesen', lauf.code === 1, `Rueckgabe ${lauf.code}`);
  probe('und hinterlaesst keine halbe Karte',
    !existsSync(join(OUT, `${name}.jpg`)) && !existsSync(join(OUT, `${name}.txt`)));
}

// --- Die Verwechslung, die der Dateikopf ausdruecklich nennt -----------------
//
// In reels-fremd/ ist `--app` der PFAD zum App-Repo, hier der
// Markenschluessel. Wer das verwechselt, soll es sofort lesen.
console.log('\nVerwechselte Argumente');
{
  const lauf = zeichne(['--app', '/home/user/swaply', '--text', 'Test.', '--name', 'probe-pfad']);
  probe('ein Pfad in --app wird abgewiesen', lauf.code === 1, `Rueckgabe ${lauf.code}`);
  probe('und sagt, was gemeint ist', /Markenschluessel/.test(lauf.ausgabe),
    lauf.ausgabe.trim().split('\n')[1] ?? '');
}

// --- Oberflaeche und Registratur muessen dieselben Apps kennen ---------------
console.log('\nFreigabe-Seite und Workflow');
{
  const schluessel = Object.keys(APPS).filter((k) => !k.startsWith('_'));

  const seite = readFileSync(join(WURZEL, 'freigabe-app', 'index.html'), 'utf8');
  const menue = seite.slice(seite.indexOf('<select id="k-app">'));
  const imMenue = [...menue.slice(0, menue.indexOf('</select>'))
    .matchAll(/value="([a-z]+)"/g)].map((m) => m[1]);
  probe('Freigabe-Seite kennt alle Apps',
    schluessel.every((k) => imMenue.includes(k)),
    `Menue: ${imMenue.join(', ')}`);

  const workflow = readFileSync(join(WURZEL, '.github', 'workflows', 'social-karte.yml'), 'utf8');
  const zeile = workflow.split('\n').find((z) => z.includes('options: [anigosha')) ?? '';
  probe('Workflow kennt alle Apps',
    schluessel.every((k) => zeile.includes(k)), zeile.trim());
}

rmSync(OUT, { recursive: true, force: true });

console.log(`\nFreie Karte: ${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Fehlgeschlagen:');
  for (const z of schlecht) console.error(`   • ${z}`);
  process.exit(1);
}
