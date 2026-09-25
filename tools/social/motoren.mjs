// Verdrahtung: uebersetzt einen gewaehlten Winkel in den Aufruf des Motors,
// der im jeweiligen Repo liegt.
//
// Hier steht bewusst NUR die Uebersetzung. Was ein Reel schoen macht, weiss
// der Motor des Repos; was heute laufen soll, weiss waehlen.mjs. Diese Datei
// ist das Kabel dazwischen und darf nie anfangen, Inhalte zu bestimmen.
//
// Jede Zeile in AUFRUFE beantwortet dieselbe Frage: Welcher Befehl, mit
// welchen Argumenten, in welchem Verzeichnis — und welche Dateien fallen
// hinten heraus.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Wurzel von anigosha — von hier laufen die Werkzeuge, die nicht im Repo der
// jeweiligen App liegen (siehe der Zweig fuer swaply/wellbooked weiter unten).
const ANIGOSHA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ⚠ Die vier Repos behandeln --out NICHT gleich.
//
// mahjong, wellbooked und mypeak schreiben `join(WURZEL, arg('out'))` — sie
// haengen den Wert an ihr EIGENES Wurzelverzeichnis. Ein absoluter Pfad wird
// dort zu /home/user/mahjong-app/home/user/anigosha/out/… und die Dateien
// sind verschwunden. Anigoshas Werkzeuge nehmen den Wert dagegen direkt.
//
// Deshalb rendert jede App in ihr eigenes out/social/<datum>: relativ
// uebergeben, wo angehaengt wird, absolut wo nicht. Eingesammelt wird
// anschliessend am absoluten Ort.
const HAENGT_AN_WURZEL = new Set(['mahjong', 'wellbooked', 'fullrep', 'swaply']);

export function ausgabeOrt(appSchluessel, app, datum) {
  const rel = join('out', 'social', datum);
  return {
    rel,
    abs: join(app.pfad, rel),
    fuerMotor: HAENGT_AN_WURZEL.has(appSchluessel) ? rel : join(app.pfad, rel),
  };
}

/** Kategorien fuer Anigosha — aus derselben Datei, die auch die Reels lesen. */
export function anigoshaKategorien(pfad) {
  const d = JSON.parse(
    execFileSync('node', ['-e',
      `process.stdout.write(JSON.stringify([...new Set(require('${pfad}/tools/reels/data/fragen.json').fragen.map(f=>f.slug))]))`,
    ]).toString(),
  );
  return d;
}

// Mahjongs Bretter: `paar` braucht kleine (Frage in zwei Sekunden
// beantwortbar), `clear` darf gross, `blumen-falle` mindestens 40 Steine —
// erst dort mischt deckForCount Blumen und Jahreszeiten ein.
const mahjongLevel = (winkel, wuerfel) => {
  const [von, bis] = {
    paar: [6, 52], 'paar-standbild': [6, 52],
    clear: [40, 300], 'figur-des-tages': [40, 300],
    'blumen-falle': [40, 120], fakt: [10, 180],
  }[winkel] ?? [20, 120];
  return von + Math.floor(wuerfel() * (bis - von));
};

/**
 * Baut die Schritte fuer einen Post.
 * Gibt {schritte:[{cmd,args}], dateien:(out)=>[…]} zurueck — ausgefuehrt wird
 * in lauf.mjs, damit ein Trockenlauf dieselbe Tabelle lesen kann, ohne etwas
 * zu starten.
 */
// --- Die Randfigur (Josef, 21.09.2026) --------------------------------------
//
// „Ich will einen Prompt fuer eine Figur … Diese sollen immer so am Rand des
// Bildes sein." Drei Apps, drei freigestellte Figuren, die seitlich an der
// Karte stehen.
//
// ⚠ DIE QUELLE IST apps.json, KEINE TABELLE HIER. Solange dort kein `figur`
// steht, wird die Option NICHT angehaengt — und der Tageslauf laeuft
// unveraendert weiter. Das ist Absicht: Die Bilder erzeugt Josef, und ein
// Generator, der auf eine noch nicht vorhandene Datei zeigt, bricht bei
// jedem Lauf ab. Wenn die Datei da ist, ist die Freischaltung EINE Zeile in
// apps.json — kein Codeeingriff.
//
// ⚠ NUR BEI BILDERN, und nie bei der App-Schau: Die zeigt die App selbst,
// dort steht keine Figur daneben. Beide Generatoren brechen sonst ab — die
// Sperre steht dort, damit sie auch beim Aufruf von Hand greift.
/**
 * Formate, die KEINE Randfigur tragen — und je einen Grund dafuer.
 *
 * ⚠ Eine ausdrueckliche Liste, keine Ableitung aus „alles ausser app-schau".
 * Bis zum 22.09.2026 stand die Regel nur implizit da, und dadurch bekam auch
 * die Rezeptkarte eine Figur, ohne dass das je jemand entschieden haette.
 *
 *   app-schau    Dort zeigt die Karte die APP selbst — drei Bildschirme
 *                tragen sie. Beide Generatoren brechen ab, wenn daneben eine
 *                Figur steht; die Sperre liegt dort, damit sie auch beim
 *                Aufruf von Hand greift.
 *
 *   rezept-karte Dort ist das GERICHT das Motiv. Seit dem 22.09. liegt hinter
 *                jeder Rezeptkarte ein Foto des fertigen Essens, und die Figur
 *                stand mitten darin — zwei Motive, die um dieselbe Flaeche
 *                streiten. Josef am selben Abend: „Essensposts ohne die figur.
 *                Die figur bei wissensposts einfügen."
 *
 * ⚠ Das Umgekehrte braucht KEINEN Eintrag: Wissens-, Studien-, Peptid- und
 * Naehrstoffkarten tragen die Figur, weil sie nicht in dieser Liste stehen.
 * Genau so ist die Regel gemeint — die Figur ist der Normalfall, die Ausnahme
 * begruendet sich.
 */
export const OHNE_FIGUR = new Set(['app-schau', 'rezept-karte']);

export function figurArgs(app, post) {
  if (!app.figur || post.medium !== 'bild' || OHNE_FIGUR.has(post.format)) return [];
  return ['--figur', app.figur];
}

/**
 * Formate, deren Generator in reels-fremd/ liegt (24.09.2026), Schlüssel
 * `<app>:<format>`. Die Endung ist die Hauptdatei; beim Karussell die erste
 * Folie (`-1.jpg`), die übrigen findet folien.mjs über die Nummern.
 */
export const NEUE_FORMATE = {
  'anigosha:richtig-falsch': { skript: 'anigosha-richtig-falsch.mjs', endung: '.mp4' },
  'fullrep:uebung-bewegt': { skript: 'fullrep-uebung-bewegt.mjs', endung: '.mp4' },
  'swaply:kein-drama': { skript: 'swaply-rueckfall-karussell.mjs', endung: '-1.jpg' },
};

export function aufruf({ appSchluessel, app, post, wuerfel, out }) {
  const p = app.pfad;
  const n = (...a) => ({ cmd: 'node', args: a, cwd: p });

  // ⚠ VOR allen App-Weichen: Die App-Schau als REEL ist fuer alle drei Marken
  // DERSELBE Generator (Josef, 20.09.2026: „jeden Post einmal als Bild und
  // einmal als Reel"). Er liegt in diesem Repo, weil swaply fuer den
  // Tageslauf nur lesbar ist und weil das Layout in allen drei Repos gleich
  // ist — die Begruendung steht ausfuehrlich in seinem Dateikopf.
  //
  // Er schreibt keinen Text ab: Die Aufzugdaten holt er sich mit
  // `--schau-json` vom BILDgenerator der jeweiligen App. Bild und Reel
  // zeigen deshalb zwingend denselben Aufzug, wenn sie denselben Seed haben.
  if (post.format === 'app-schau' && post.medium === 'reel') {
    return {
      schritte: [{
        cmd: 'node',
        args: ['tools/social/reels-fremd/app-schau-reel.mjs',
          '--marke', appSchluessel, '--lang', post.sprache,
          // ⚠ Das App-Repo MITGEBEN. Der Generator laeuft in wellapps-social
          // und kann nicht wissen, wo die App liegt: Auf dem Runner ist das
          // `$SOCIAL_WURZEL/<name>`, lokal /home/user/<name>. `app.pfad` ist
          // schon umgebogen (ladeApps), also ist es hier richtig — eine
          // eigene Tabelle im Generator war es NICHT, und jedes Reel im
          // Tageslauf scheiterte daran.
          '--repo', p,
          '--seed', String(post.seed), '--name', post.dateiname,
          // ⚠ ABSOLUT. Dieses Skript laeuft in wellapps-social, `out` kommt
          // aber je App relativ herein — relativ uebergeben landete das Reel
          // hier statt im App-Ordner und waere fuer posten.mjs unauffindbar.
          // Dieselbe Falle wie bei reels-fremd/make-reel.mjs nebenan.
          '--out', isAbsolute(out) ? out : join(app.pfad, out)],
        cwd: ANIGOSHA,
      }],
      endung: '.mp4',
    };
  }

  // Neue Formate vom 24.09.2026 (Josef: „neuen post für alle plattformen mit
  // neuen ideen/styles" → „Ja"). Alle drei Generatoren liegen in diesem Repo
  // (reels-fremd/) und lesen ihre Inhalte nur aus dem App-Repo — gleiche
  // Begruendung wie bei der App-Schau oben. Aufruf und Ausgabe sind gleich:
  // `--app --seed --name --out`, heraus kommen <name>.mp4 bzw. <name>-N.jpg
  // (Karussell) und <name>.txt.
  const neu = NEUE_FORMATE[`${appSchluessel}:${post.format}`];
  if (neu) {
    return {
      schritte: [{
        cmd: 'node',
        args: [`tools/social/reels-fremd/${neu.skript}`, '--app', p,
          '--seed', String(post.seed), '--name', post.dateiname,
          // Kein --store: apps.json kennt keinen Store-Satz, und ein leerer
          // Wert ueberschriebe den Vorgabesatz der Generatoren mit nichts.
          // ⚠ ABSOLUT — dieselbe Falle wie bei der App-Schau oben.
          '--out', isAbsolute(out) ? out : join(app.pfad, out)],
        cwd: ANIGOSHA,
      }],
      endung: neu.endung,
    };
  }

  if (appSchluessel === 'anigosha') {
    if (post.medium === 'reel') {
      const kat = anigoshaKategorien(p);
      const args = ['tools/reels/make-reel.mjs', '--format', post.format,
        '--lang', post.sprache, '--seed', String(post.seed), '--out', out];
      if (post.format === 'fandom') {
        args.push('--category', kat[Math.floor(wuerfel() * kat.length)]);
      }
      // Das freie Reel — dasselbe wie die freie Karte, nur als Video. Es kennt
      // nur Text und Schlusszeile: Haken und Marke gibt es in der Reel-Vorlage
      // nicht, und sie stillschweigend zu schlucken waere schlimmer, als sie
      // gar nicht anzubieten (siehe die Oberflaeche der Freigabe-Seite).
      if (post.format === 'ansage') {
        for (const feld of ['text', 'cta']) {
          const v = post.frei?.[feld];
          if (v) args.push(`--${feld}`, String(v));
        }
      }
      return { schritte: [n(...args)], endung: '.mp4' };
    }
    const bild = ['tools/post-bild.mjs', '--format', post.format,
      '--lang', post.sprache, '--seed', String(post.seed), '--out', out,
      '--store', app.storeSatz];

    // ⚠ Das Wasserzeichen mit den beiden Figuren (Josef, 21.09.2026):
    // „bei den anigoshaposts gerne im hintergrund als wasserzeichen ein bild
    // von den beiden figuren".
    //
    // Es faehrt bei JEDER Anigosha-Bildkarte mit, nicht nach Wuerfel. Anders
    // als bei FullReps acht Trainingsbildern gibt es hier genau EINES, und ein
    // Wuerfel ueber eine einelementige Menge waere kein Wuerfel, sondern ein
    // gelegentliches Weglassen — also das Gegenteil eines Wiedererkennungs-
    // zeichens.
    //
    // ⚠ NICHT bei app-schau. Dort traegt dasselbe Einzelbild bereits die ganze
    // Flaeche als Milieu; beides zugleich waere das Motiv zweimal, einmal hell
    // und einmal dunkel. Der Generator bricht in dem Fall ausdruecklich ab —
    // diese Zeile haelt den Abbruch nur von vornherein fern.
    //
    // ⚠ Der Dateiname ist Pflicht, kein blosses `--wz`. Die Kommandozeile des
    // Generators liest jedes `--x` als „naechstes Argument ist der Wert"; ein
    // nacktes `--wz` verschluckte `--seed`, und der Beitrag saehe morgen
    // anders aus als heute, ohne dass irgendwo ein Fehler stuende.
    //
    // ⚠ UND ES WEICHT DER RANDFIGUR (21.09.2026). Steht in apps.json eine
    // `figur`, geht sie vor: Beides zugleich waere dieselbe Figur zweimal auf
    // einer Karte — einmal blass im Hintergrund, einmal scharf am Rand. Der
    // Generator bricht in dem Fall ab; diese Zeile haelt den Abbruch fern.
    const figur = figurArgs(app, post);
    if (figur.length) bild.push(...figur);
    else if (post.format !== 'app-schau') bild.push('--wz', 'spot-start.jpg');

    // Die freie Karte ist der einzige Beitrag, dessen Inhalt nicht aus den
    // 804 Fragen kommt, sondern von aussen. Er haengt als `post.frei` am
    // Beitrag — gesetzt vom Kartenlauf in lauf.mjs, nie von der Rotation.
    //
    // ⚠ Leere Werte NICHT durchreichen. `--haken` ohne Wert wuerde das
    // naechste Argument als seinen Wert schlucken, und der Generator saehe
    // `--haken --marke` — mit „--marke" als Hakentext im fertigen Bild.
    if (post.format === 'freie-karte') {
      for (const feld of ['text', 'haken', 'marke', 'cta']) {
        const v = post.frei?.[feld];
        if (v) bild.push(`--${feld}`, String(v));
      }
    }

    return { schritte: [n(...bild)], endung: '.jpg' };
  }

  if (appSchluessel === 'mahjong') {
    const level = mahjongLevel(post.winkel, wuerfel);
    if (post.medium === 'reel') {
      // Zwei Schritte: erst spielen und aufnehmen, dann daraus das Reel bauen.
      // Der Aufnahmeschritt braucht den laufenden `vite preview`.
      const clip = `out/reels/mahjong-solitaire-lvl${level}-en.mp4`;
      const bau = ['scripts/reel/make-reel.mjs', '--clip', clip, '--format', post.format,
        '--name', post.dateiname, '--out', out];
      if (post.format === 'fakt') bau.push('--fakt', String(post.seed % 34));
      if (post.winkel === 'figur-des-tages') bau.push('--figur', post.figur ?? 'dragon');
      return {
        schritte: [
          n('scripts/reel/record-solitaire.mjs', '--level', String(level), '--paare', '16'),
          n(...bau),
        ],
        endung: '.mp4',
      };
    }
    const level4 = post.winkel === 'figur-galerie'
      ? [12, 88, 150, 260].join(',')
      : String(level);
    return {
      schritte: [n('scripts/post-bild.mjs', '--format', post.format, '--level', level4,
        '--seed', String(post.seed), '--name', post.dateiname, '--out', out)],
      endung: '.jpg',
    };
  }

  // ⚠ Swaply und WELLbooked! haben KEINEN eigenen Reel-Generator in ihrem
  // Repo — anders als die drei anderen. Der Grund ist ein Zugangsrecht, kein
  // technischer: Dieser Arbeitsplatz darf dort nur lesen, ein Generator waere
  // nicht einzuchecken. Er liegt deshalb hier und wird von hier aufgerufen;
  // seine INHALTE liest er trotzdem aus dem jeweiligen Repo.
  //
  // Wer dort Schreibzugriff hat, verschiebt ihn — dann faellt dieser Zweig weg.
  if ((appSchluessel === 'swaply' || appSchluessel === 'wellbooked') && post.medium === 'reel') {
    return {
      schritte: [{
        cmd: 'node',
        args: ['tools/social/reels-fremd/make-reel.mjs', '--marke', appSchluessel,
          '--format', post.format ?? post.winkel, '--lang', post.sprache,
          '--seed', String(post.seed), '--name', post.dateiname,
          // ⚠ ABSOLUTER Zielpfad. `out` kommt fuer diese beiden Apps relativ
          // herein (sie haengen ihn sonst an ihre eigene Wurzel, siehe
          // ausgabeOrt). Dieses Skript laeuft aber in anigosha — relativ
          // uebergeben landete das Reel in anigosha/out/ und waere fuer
          // posten.mjs unauffindbar.
          '--out', isAbsolute(out) ? out : join(app.pfad, out)],
        cwd: ANIGOSHA,
      }],
      endung: '.mp4',
    };
  }

  if (appSchluessel === 'wellbooked') {
    // ⚠ --experimental-strip-types ist Pflicht: Der Generator importiert
    // src/lib/constants.ts direkt, damit Preise gelesen und nicht getippt
    // werden.
    return {
      schritte: [{
        cmd: 'node',
        args: ['--experimental-strip-types', 'docs/social/post-bild.mjs',
          '--format', post.winkel, '--seed', String(post.seed),
          '--name', post.dateiname, '--out', out],
        cwd: p,
      }],
      endung: '-feed.jpg',
    };
  }

  if (appSchluessel === 'fullrep') {
    const skript = post.medium === 'reel' ? 'scripts/post-reel.mjs' : 'scripts/post-bild.mjs';
    // ⚠ `--stil` NUR beim Bild. post-reel.mjs kennt die Option nicht; ein
    // unbekanntes Argument stuende dort still im argv herum, statt zu
    // scheitern — die Wirkung waere null und die Ursache unauffindbar.
    //
    // Ohne diese Zeile lief bis 18.09.2026 JEDER FullRep-Bildpost im
    // Vorgabestil `mix`; die drei anderen Stile des Generators hat nie
    // jemand im Feed gesehen. Welcher Stil je Winkel erlaubt ist, steht in
    // ideen/fullrep.json unter `stile`; gewaehlt wird in waehlen.mjs.
    const stil = post.medium === 'bild' && post.stil ? ['--stil', post.stil] : [];
    // Das Trainingsbild hinter der Karte. Gleiche Regel wie bei `--stil`:
    // NUR beim Bild, post-reel.mjs kennt die Option nicht.
    //
    // ⚠ Der Beschnitt faehrt mit. Ohne ihn liefe `bankdruecken.jpg` im
    // Vorgabewert `cover` und zeigte von der Uebung nur eine Hantel und einen
    // Arm — ein Fehler, der im Protokoll gruen aussieht und nur am fertigen
    // Bild auffaellt. Warum welche Datei welchen Beschnitt braucht, steht in
    // store-assets/social/fotos/wasserzeichen/HERKUNFT.md im App-Repo.
    //
    // ⚠ `--wz` schaltet im Generator die KI-Kennzeichnung automatisch mit.
    // Hier steht deshalb bewusst KEIN `--ki` daneben: Zwei Wege zur selben
    // Pflicht sind einer zu viel, und der zweite wird eines Tages vergessen.
    const wz = post.medium === 'bild' && post.wasserzeichen
      ? ['--wz', `store-assets/social/fotos/wasserzeichen/${post.wasserzeichen.datei}`,
         '--wz-fit', post.wasserzeichen.fit ?? 'cover']
      : [];
    return {
      schritte: [n(skript, '--format', post.format, '--lang', post.sprache,
        ...stil, ...wz, ...figurArgs(app, post),
        '--seed', String(post.seed), '--name', post.dateiname, '--out', out)],
      endung: post.medium === 'reel' ? '.mp4' : '.jpg',
    };
  }

  if (appSchluessel === 'swaply') {
    // ⚠ Nur Bildposts. Einen Reel-Generator gibt es in /home/user/swaply
    // (noch) nicht; ideen/swaply.json fuehrt deshalb ausschliesslich
    // medium: 'bild'. Kaeme spaeter einer dazu, gehoert hier dieselbe
    // Weiche hin wie bei fullrep — und nicht vorher.
    return {
      schritte: [n('scripts/post-bild.mjs', '--format', post.format,
        '--lang', post.sprache, ...figurArgs(app, post),
        '--seed', String(post.seed),
        '--name', post.dateiname, '--out', out)],
      endung: '.jpg',
    };
  }

  throw new Error(`keine Verdrahtung fuer ${appSchluessel}`);
}

/**
 * Sucht nach dem Lauf, was tatsaechlich entstanden ist.
 *
 * ⚠ Der Dateiname laesst sich nicht vorhersagen. Anigoshas Werkzeuge benennen
 * nach Format UND Kategorie (`anigosha-fandom-one_piece-de-s42`), kennen aber
 * kein --name; der Orchestrator kennt nur den Winkel. Gemeinsam ist beiden
 * allein der Seed — danach wird gesucht, mit dem Praefix als erster Wahl.
 */
export function ergebnisse(out, basis, seed) {
  if (!existsSync(out)) return [];
  const alle = readdirSync(out);
  const treffer = alle.filter((f) => f.startsWith(basis));
  if (treffer.length) return treffer.map((f) => join(out, f));
  return alle.filter((f) => f.includes(`-s${seed}.`) || f.includes(`-s${seed}-`))
    .map((f) => join(out, f));
}
