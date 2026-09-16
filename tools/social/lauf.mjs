#!/usr/bin/env node
// Tageslauf: waehlt die Posts aus, ruft die Motoren der vier Repos auf,
// prueft, bucht und liefert aus.
//
//   node tools/social/lauf.mjs --trocken            was liefe die naechsten 14 Tage
//   node tools/social/lauf.mjs --trocken --tage 30  laengerer Blick
//   node tools/social/lauf.mjs --pruefung           Vorflug gegen Gegenbeispiele
//   node tools/social/lauf.mjs --app anigosha       nur eine App
//   node tools/social/lauf.mjs --datum 2026-09-01   anderer Tag als heute
//
// Der Trockenlauf rendert nichts. Er beantwortet die einzige Frage, die vor
// dem ersten echten Lauf zaehlt: Wiederholt sich das System? Wer erst nach
// dem Rendern nachsieht, hat 20 Minuten pro Antwort bezahlt.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ladeApps, ladeLedger, waehlePosts, vorschau, aktivesFestival, mulberry32, saat,
} from './waehlen.mjs';
import { pruefe, berichte, storeSatz, captionAus } from './vorflug.mjs';
import { aufruf, ergebnisse, ausgabeOrt } from './motoren.mjs';
import { baueGalerie } from './galerie.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const hat = (n) => argv.includes(`--${n}`);
const wert = (n, s) => { const i = argv.indexOf(`--${n}`); return i === -1 ? s : argv[i + 1]; };

const APPS = ladeApps();
const NUR_APP = wert('app', null);
const HEUTE = wert('datum', new Date().toISOString().slice(0, 10));
const TAGE = Number(wert('tage', 14));
const NUR_VORHANDEN = hat('nur-vorhanden');

const appSchluessel = Object.keys(APPS).filter((k) => !k.startsWith('_'))
  .filter((k) => !NUR_APP || k === NUR_APP);

// ---------------------------------------------------------------- Trockenlauf
function trockenlauf() {
  console.log(`Trockenlauf ab ${HEUTE}, ${TAGE} Tage${NUR_VORHANDEN ? ' (nur gebaute Formate)' : ''}\n`);
  const fest = aktivesFestival(HEUTE);
  if (fest) console.log(`Aktives Mahjong-Festival: ${fest.id}\n`);

  for (const k of appSchluessel) {
    const app = APPS[k];
    const tage = vorschau({ app: k, start: HEUTE, tage: TAGE, anzahl: app.posts_pro_tag, nurVorhanden: NUR_VORHANDEN, sprachen: app.sprachen });
    const gesamt = tage.flatMap((t) => t.posts);

    console.log(`━━ ${app.name}  (${app.nische})`);
    if (!gesamt.length) { console.log('   keine Winkel verfuegbar\n'); continue; }

    for (const t of tage.slice(0, 7)) {
      const zeile = t.posts.map((p) => `${p.medium === 'reel' ? '▶' : '▣'} ${p.winkel} [${p.sprache}]`).join('   ');
      console.log(`   ${t.datum}  ${zeile || '—'}`);
    }
    if (TAGE > 7) console.log(`   … (${TAGE - 7} weitere Tage)`);

    // Die eigentliche Kennzahl: wie oft wiederholt sich ein Winkel?
    const zaehl = {};
    for (const p of gesamt) zaehl[p.winkel] = (zaehl[p.winkel] ?? 0) + 1;
    const verteilung = Object.entries(zaehl).sort((a, b) => b[1] - a[1]);
    const maxWdh = verteilung[0]?.[1] ?? 0;
    const reels = gesamt.filter((p) => p.medium === 'reel').length;
    const gelockert = gesamt.some((p) => p.gelockert);

    console.log(`   ${gesamt.length} Posts · ${verteilung.length} verschiedene Winkel · ` +
      `${reels} Reels / ${gesamt.length - reels} Bilder · haeufigster Winkel ${maxWdh}×` +
      (gelockert ? '  ⚠ Sperre gelockert, Vorrat zu klein' : ''));
    console.log(`   Store-Satz: „${storeSatz(app, app.sprachen[0])}"\n`);
  }
}

// ------------------------------------------------------------- Vorflug-Probe
// Absichtlich falsche Posts. Jeder MUSS abgelehnt werden — sonst ist die
// Leitplanke Dekoration.
function vorflugProbe() {
  const faelle = [
    { name: 'WELLbooked ohne Ausrufezeichen',
      app: 'wellbooked', post: { sprache: 'de' },
      texte: { caption: 'Mit WELLbooked findest du freie Termine.', tonquelle: 'stille' } },

    { name: 'WELLbooked-Video mit Tonspur',
      app: 'wellbooked', post: { sprache: 'de' },
      texte: { caption: 'WELLbooked! findet freie Termine.', tonquelle: 'musikbett' } },

    { name: 'Mahjong mit Trending-Sound',
      app: 'mahjong', post: { sprache: 'en' },
      texte: { caption: 'Can you spot the pair?', tonquelle: 'tiktok-trending' } },

    { name: 'Anigosha mit KI-Figurenbild',
      app: 'anigosha', post: { sprache: 'de', medium: 'bild' },
      texte: { caption: 'Nur echte Fans schaffen 3/3', medienherkunft: 'ki-bild' } },

    { name: 'WELLbooked!-Kategoriebild ohne Wasserzeichen',
      // ⚠ Dieser Fall fehlte — und genau deshalb ist der Fehler durchgerutscht.
      // Die Probe deckte nur FullRep ab, waehrend WELLbookeds Kategoriebilder
      // seit jeher KI-erzeugt sind und Personen zeigen.
      app: 'wellbooked', post: { sprache: 'de' },
      texte: { caption: 'WELLbooked! zeigt freie Termine in deiner Naehe.',
        tonquelle: 'stille', medienherkunft: 'ki-menschen (kein Wasserzeichen)' } },

    { name: 'KI-erzeugte Menschen ohne Wasserzeichen',
      app: 'fullrep', post: { sprache: 'de' },
      texte: { caption: 'Kraft folgt der Wiederholung.',
        medienherkunft: 'ki-menschen (kein Wasserzeichen)' } },

    { name: 'Store-Link in der Caption',
      app: 'anigosha', post: { sprache: 'de' },
      texte: { caption: 'Hol es dir: https://apps.apple.com/app/id6797757350' } },
  ];

  const gut = [
    { name: 'FullRep korrekt: ohne Quelle, beide Stores erlaubt',
      app: 'fullrep', post: { sprache: 'de' },
      texte: { caption: 'Kreatin gehoert zu den am besten untersuchten Supplementen. '
        + 'Im App Store und bei Google Play.' } },

    { name: 'WELLbooked! korrekt: Marke mit !, stumm',
      app: 'wellbooked', post: { sprache: 'de' },
      texte: { caption: 'WELLbooked! zeigt freie Termine in deiner Naehe.', tonquelle: 'stille' } },

    { name: 'FullRep-Uebungskarte, reine Technik',
      app: 'fullrep', post: { sprache: 'de' },
      texte: { caption: 'Bankdruecken. Flachbank mit der Langhantel.' } },

    { name: 'KI-Bild MIT Wasserzeichen geht durch',
      app: 'fullrep', post: { sprache: 'de' },
      texte: { caption: 'Kraft folgt der Wiederholung.',
        medienherkunft: 'ki-menschen (Wasserzeichen gesetzt)', wasserzeichen: true } },

    { name: 'WELLbooked!-Kategoriebild MIT Wasserzeichen geht durch',
      app: 'wellbooked', post: { sprache: 'de' },
      texte: { caption: 'WELLbooked! zeigt freie Termine in deiner Naehe.',
        tonquelle: 'stille', medienherkunft: 'ki-menschen (Wasserzeichen gesetzt)',
        wasserzeichen: true } },

    { name: 'Echtes Foto braucht KEIN Wasserzeichen',
      app: 'fullrep', post: { sprache: 'de' },
      texte: { caption: 'Bankdruecken mit der Langhantel.', medienherkunft: 'echtes Foto' } },

    { name: 'Anigosha korrekt: Typografie, beide Stores',
      app: 'anigosha', post: { sprache: 'de', medium: 'reel' },
      texte: { caption: 'Nur echte One-Piece-Fans schaffen 3/3. Gratis im App Store und bei Google Play.',
        medienherkunft: 'typografie' } },
  ];

  let fehler = 0;
  console.log('Gegenbeispiele — jedes MUSS abgelehnt werden:\n');
  for (const f of faelle) {
    const e = pruefe({ appSchluessel: f.app, app: APPS[f.app], post: f.post, texte: f.texte });
    const ok = !e.bestanden;
    if (!ok) fehler++;
    console.log(`  ${ok ? '✓ abgelehnt ' : '✗ DURCHGELASSEN'}  ${f.name}`);
    if (ok) console.log(`               → ${e.funde.filter((x) => x.hart).map((x) => x.regel).join(', ')}`);
  }

  console.log('\nGute Faelle — jeder MUSS durchgehen:\n');
  for (const f of gut) {
    const e = pruefe({ appSchluessel: f.app, app: APPS[f.app], post: f.post, texte: f.texte });
    if (!e.bestanden) fehler++;
    console.log(berichte(e, f.name));
  }

  console.log(`\n${fehler === 0 ? '✓ Alle Leitplanken greifen.' : `✗ ${fehler} Fehler.`}`);
  return fehler;
}

// ------------------------------------------------------------------- Einstieg
if (hat('pruefung')) {
  process.exit(vorflugProbe() === 0 ? 0 : 1);
} else if (hat('trocken')) {
  trockenlauf();
} else {
  const bericht = await tageslauf();

  // ⚠ Ein echter Lauf, bei dem KEIN Beitrag entstanden ist, ist ein
  // Fehlschlag und muss sich auch so verhalten. Vorher endete er mit 0 —
  // der erste Lauf im Workflow meldete deshalb „erfolgreich", obwohl beide
  // Renderaufrufe an einem fehlenden Paket gescheitert waren. Ein gruener
  // Haken, hinter dem nichts steht, ist schlimmer als ein roter.
  if (hat('echt') && bericht.length
      && !bericht.some((b) => b.dateien?.length && !b.verworfen && !b.fehler)) {
    console.error('\n✗ Kein einziger Beitrag ist entstanden.');
    process.exit(1);
  }
}

// --------------------------------------------------- Vorschau-Server (Mahjong)
// ⚠ Mahjongs Reels und Bildposts fotografieren die LAUFENDE App ab; ohne
// `vite preview` bricht jeder Aufruf mit ERR_CONNECTION_REFUSED ab. Beim ersten
// unbeaufsichtigten Lauf war genau das der Grund fuer zwei fehlende Posts.
// Einen laufenden Server vorauszusetzen ist im Zeitplanbetrieb keine Annahme,
// die man treffen darf — also startet der Lauf ihn selbst und raeumt ihn weg.
async function erreichbar(url) {
  try {
    const a = new AbortController();
    const t = setTimeout(() => a.abort(), 1500);
    const r = await fetch(url, { signal: a.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

async function starteVorschau(app) {
  const url = 'http://127.0.0.1:5199/';
  if (await erreichbar(url)) return null;   // laeuft schon, nichts zu tun

  console.log('   Vorschau-Server wird gestartet …');
  // Der Bau muss vorher durch sein, sonst liefert preview einen leeren dist-Ordner.
  execFileSync('npm', ['run', 'build'], { cwd: app.pfad, stdio: 'ignore' });
  const kind = spawn('npx', ['vite', 'preview', '--port', '5199', '--host', '127.0.0.1'],
    { cwd: app.pfad, stdio: 'ignore', detached: false });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await erreichbar(url)) return kind;
  }
  kind.kill();
  throw new Error('Vorschau-Server kam nicht hoch (20 s gewartet)');
}

// ⚠ CHROMIUM_PFAD nur setzen, wenn dort auch wirklich ein Browser liegt.
//
// Vorher stand hier ein festes `?? '/opt/pw-browsers/chromium'`. Das ist der
// Pfad im Abbild der Cloud-Sitzung und dort goldrichtig — auf einem
// GitHub-Runner gibt es ihn nicht. Ein gesetzter, aber falscher Pfad ist
// schlimmer als gar keiner: Playwright nimmt ihn als `executablePath` und
// scheitert, statt seinen eigenen, frisch installierten Browser zu finden.
function browserUmgebung() {
  const gesetzt = process.env.CHROMIUM_PFAD;
  if (gesetzt) return { CHROMIUM_PFAD: gesetzt };
  const imAbbild = '/opt/pw-browsers/chromium';
  return existsSync(imAbbild) ? { CHROMIUM_PFAD: imAbbild } : {};
}

// ------------------------------------------------------------------ Tageslauf
async function tageslauf() {
  const ledger = ladeLedger();
  const echt = hat('echt');

  // ⚠ Einen Tag, der schon im Ledger steht, ZUERST rauswerfen — sonst haengt
  // ein zweiter Lauf desselben Tages seine Zeilen einfach an.
  //
  // Das ist beim Entwickeln am 30.08.2026 passiert: drei Laeufe, 6 statt 2
  // Zeilen je App. Zwei Folgen, beide unangenehm:
  //   1. posten.mjs haette den Tag dreifach in die Kanaele geladen.
  //   2. waehlen.mjs zaehlt die letzten Verwendungen je Winkel. Ein
  //      dreifach gezaehlter Winkel gilt als frischer benutzt, als er ist —
  //      die Rotation verrutscht still und faellt niemandem auf.
  //
  // Ein Tageslauf ist ein ERSETZEN, kein Anhaengen: Was heute gilt, ist das,
  // was der letzte Lauf von heute erzeugt hat.
  //
  // ⚠ AUSSER bei einem Nachlauf (`--variante N`). Der entsteht, wenn Josef
  // einen Beitrag abgelehnt hat und einen anderen will — dann sollen die
  // Winkel von heute GESPERRT bleiben, sonst zieht der Nachlauf als Erstes
  // wieder den, der eben abgelehnt wurde. Ein Nachlauf ergaenzt, er ersetzt
  // nicht.
  const VARIANTE = Number(wert('variante', 0)) || 0;
  if (echt && !VARIANTE) {
    const vorher = ledger.zeilen.length;
    ledger.zeilen = ledger.zeilen.filter(
      (z) => !(z.datum === HEUTE && appSchluessel.includes(z.app)),
    );
    const weg = vorher - ledger.zeilen.length;
    if (weg) console.log(`(${weg} Ledger-Zeile(n) von heute ersetzt — es gab schon einen Lauf)\n`);
  }
  if (VARIANTE) console.log(`Nachlauf, Variante ${VARIANTE} — die Winkel von heute bleiben gesperrt.\n`);
  // Jede App rendert in ihr eigenes out/social/<datum> — siehe die Erklaerung
  // zu ausgabeOrt() in motoren.mjs.
  const bericht = [];

  console.log(`${echt ? 'Tageslauf' : 'Vorschau (ohne --echt wird nichts gerendert)'} fuer ${HEUTE}\n`);

  let vorschau = null;
  for (const k of appSchluessel) {
    const app = APPS[k];
    if (echt && k === 'mahjong') {
      try { vorschau = await starteVorschau(app); }
      catch (e) { console.log(`   ✗ ${e.message}`); }
    }
    const posts = waehlePosts({
      app: k, heute: HEUTE, ledger, variante: VARIANTE,
      // ⚠ Die Sprache kommt aus apps.json, nicht mehr aus dem Winkel.
      sprachen: app.sprachen,
      anzahl: Number(wert('anzahl', app.posts_pro_tag)),
      nurVorhanden: NUR_VORHANDEN || echt,
    });
    console.log(`━━ ${app.name}`);
    if (!posts.length) { console.log('   nichts verfuegbar\n'); continue; }

    for (const post of posts) {
      post.dateiname = `${k}-${post.winkel}-${post.sprache}-s${post.seed}`;
      app.storeSatz = storeSatz(app, post.sprache);
      const wuerfel = mulberry32(saat(HEUTE, k, post.winkel, 'motor'));
      const ort = ausgabeOrt(k, app, HEUTE);
      const plan = aufruf({ appSchluessel: k, app, post, wuerfel, out: ort.fuerMotor });

      console.log(`   ${post.medium === 'reel' ? '▶' : '▣'} ${post.winkel} · ${post.sprache} · Seed ${post.seed}`);
      for (const s of plan.schritte) {
        console.log(`     $ ${s.args.filter((a) => !a.startsWith('/')).join(' ')}`);
      }

      if (!echt) { bericht.push({ app: k, post, dateien: [] }); continue; }

      try {
        for (const s of plan.schritte) {
          execFileSync(s.cmd, s.args, {
            cwd: s.cwd, stdio: 'pipe',
            env: { ...process.env, ...browserUmgebung() },
          });
        }
      } catch (e) {
        // ⚠ Die LETZTEN Zeilen eines Node-Stacks sind „Node.js v22" und
        // Klammern. Beim ersten Serverausfall stand als ganze Fehlermeldung
        // „✗ }" da — der eigentliche Grund (ERR_CONNECTION_REFUSED) lag
        // mittendrin. Deshalb die erste Zeile suchen, die wie ein Grund
        // aussieht.
        //
        // ⚠ Und die erste Zeile, die „Error" ENTHAELT, ist auch nicht der
        // Grund: Node druckt vor der Meldung die schuldige QUELLZEILE. Im
        // Workflow stand deshalb als ganze Diagnose „const err = new
        // Error(message);" — richtig zitiert, vollkommen nutzlos. Zuerst
        // also die Kopfzeile einer Ausnahme suchen („TypeError: …",
        // „Error [ERR_MODULE_NOT_FOUND]: …"), die steht am Zeilenanfang.
        const roh = (e.stderr?.toString() || e.message).trim().split('\n');
        const kopfzeile = /^(?:[A-Z][\w$]*Error|Error)(?: \[[^\]]+\])?: /;
        const grund = roh.find((z) => kopfzeile.test(z.trim()))
          ?? roh.find((z) => /error:|✗|refused|ENOENT|not found|Cannot find/i.test(z))
          ?? roh.find((z) => z.trim() && !/^\s*[{}^)]/.test(z))
          ?? roh[0];
        console.log(`     ✗ ${grund.slice(0, 220)}`);
        bericht.push({ app: k, post, fehler: grund, dateien: [] });
        continue;
      }

      const dateien = ergebnisse(ort.abs, post.dateiname, post.seed);
      const captionDatei = dateien.find((f) => f.endsWith('.txt'));
      const beiblatt = captionDatei ? readFileSync(captionDatei, 'utf8') : '';
      // Geprueft wird, was gepostet wird — nicht die Anleitung drumherum.
      const caption = captionAus(beiblatt);

      // Leitplanke auf dem FERTIGEN Text, nicht auf der Absicht. Ein Post,
      // der hier durchfaellt, wird nicht ausgeliefert.
      const pruefung = pruefe({
        appSchluessel: k, app, post,
        texte: {
          caption,
          tonquelle: post.medium === 'reel'
            ? (k === 'mahjong' ? 'synth' : k === 'wellbooked' ? 'stille' : 'eigen')
            : undefined,
          // Die Herkunft steht im Beiblatt („Medienherkunft: …"). Sie dort
          // zu lesen ist verlaesslicher, als sie hier zu erraten.
          medienherkunft: (beiblatt.match(/^- Medienherkunft:\s*(.+)$/m)?.[1]
            ?? (k === 'anigosha' ? 'typografie' : undefined)),
          wasserzeichen: /Wasserzeichen gesetzt/.test(beiblatt) || undefined,
        },
      });

      if (!pruefung.bestanden) {
        console.log(berichte(pruefung, post.winkel).split('\n').slice(1).join('\n'));
        bericht.push({ app: k, post, dateien, verworfen: pruefung.funde });
        continue;
      }

      console.log(`     ✓ ${dateien.map((f) => f.split('/').pop()).join(', ')}`);
      bericht.push({ app: k, post, dateien });
      ledger.zeilen.push({
        app: k, datum: HEUTE, winkel: post.winkel, medium: post.medium,
        schluessel: post.schluessel, inhalt: `seed${post.seed}`, sprache: post.sprache,
      });
    }
    console.log();
  }

  // Der selbst gestartete Server wird auch selbst beendet — ein Zeitplan, der
  // Prozesse hinterlaesst, sammelt sie ueber Wochen an.
  if (vorschau) vorschau.kill();

  if (echt) {
    writeFileSync(join(HIER, 'ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
    const gut = bericht.filter((b) => b.dateien.length && !b.verworfen && !b.fehler);
    console.log(`${gut.length} von ${bericht.length} Posts fertig`);
    for (const b of gut) console.log(`   ${b.dateien.find((f) => !f.endsWith('.txt')) ?? b.dateien[0]}`);
    const schlecht = bericht.filter((b) => b.verworfen || b.fehler);
    if (schlecht.length) {
      console.log(`⚠ ${schlecht.length} verworfen oder fehlgeschlagen — siehe oben.`);
    }

    const galerie = join(HIER, '..', '..', 'out', 'social', `galerie-${HEUTE}.html`);
    mkdirSync(dirname(galerie), { recursive: true });
    writeFileSync(galerie, baueGalerie({
      datum: HEUTE, apps: APPS, bericht,
      tmp: join(HIER, '..', '..', 'out', 'social', '.standbilder'),
    }));
    console.log(`\nGalerie: ${galerie}`);
  }
  return bericht;
}
