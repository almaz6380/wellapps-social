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
export function aufruf({ appSchluessel, app, post, wuerfel, out }) {
  const p = app.pfad;
  const n = (...a) => ({ cmd: 'node', args: a, cwd: p });

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
    return {
      schritte: [n(skript, '--format', post.format, '--lang', post.sprache,
        ...stil, '--seed', String(post.seed), '--name', post.dateiname, '--out', out)],
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
        '--lang', post.sprache, '--seed', String(post.seed),
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
