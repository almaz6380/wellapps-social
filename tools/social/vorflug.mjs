// Vorflug-Pruefung: verwirft einen Post, statt vor ihm zu warnen.
//
// Jede Regel hier steht fuer einen Fehler, der in einem der vier Repos schon
// einmal Geld oder Zeit gekostet hat. Sie im Kopf zu behalten hat nicht
// funktioniert — deshalb bricht der Lauf ab, wenn eine verletzt ist.
//
//   Anigosha   Bilder erkennbarer Anime-Figuren = Takedown-Risiko fuer das
//              ganze Entwicklerkonto, an dem auch die anderen Apps haengen.
//   Mahjong    Chart-Sounds sind fuer private Posts lizenziert. Kommerzielle
//              Nutzung wird stummgeschaltet, und ein stummer Reel ist tot.
//   WELLbooked Die Marke traegt ein Ausrufezeichen. Und Claude fuegt keinen
//              Ton hinzu — das ist eine ausdrueckliche Anweisung vom 01.08.
//   FullRep    Haftungshinweis und Quellenangabe gelten fuer den
//              STORE-EINTRAG, nicht fuer Social-Media-Beitraege — siehe unten.
//
// Und ueberall: Der Store-Satz wird aus der Konfiguration gebaut, nie getippt.
// Anigosha hatte ihn schon einmal falsch im Video stehen.

/**
 * Holt aus der Beiblatt-Datei NUR den Text, der wirklich gepostet wird.
 *
 * ⚠ Ohne das prueft die Leitplanke die ganze Datei — und faellt auf den
 * eigenen Anleitungstext herein. Beim ersten echten Lauf verwarf sie jeden
 * FullRep-Post, weil im Abschnitt „Beim Hochladen" die Zeile steht
 * „iOS ist noch nicht freigegeben: nirgends den App Store nennen".
 * Die Warnung selbst nannte den Store.
 *
 * Die vier Repos schreiben zwei Stile: „CAPTION ZUM KOPIEREN" mit
 * Unterstrichen (Anigosha) und „## Caption (kopieren)" (die uebrigen).
 *
 * --- ⚠ Am 05.09.2026 zweimal danebengegriffen, beide Male teuer ------------
 *
 * 1. **Der Zierrand.** Die Reel-Beiblaetter schreiben die Ueberschrift als
 *    „── CAPTION ZUM KOPIEREN ──────". Die Suche verlangte sie am
 *    ZEILENANFANG, fand also nichts — und dann griff `return beiblatt`: im
 *    Zweifel ALLES. Der Facebook-Entwurf trug daraufhin das komplette
 *    Beiblatt, samt Abschnitt „ENTHALTENE FRAGEN (Faktencheck)" mit den
 *    richtigen Antworten. Ein Quiz, das die Loesungen mitliefert.
 * 2. **Das Ende.** Beim Bild wurde der Anfang gefunden, das Ende nicht:
 *    „ZUR KONTROLLE (nicht posten)" enthaelt Kleinbuchstaben, gesucht wurde
 *    aber eine Ueberschrift NUR aus Grossbuchstaben.
 *
 * Daraus zwei Regeln, die hier bleiben:
 *
 * **Im Zweifel NICHTS zurueckgeben, nicht alles.** Ein leerer Text faellt
 * sofort auf und wird von posten.mjs abgelehnt; ein zu langer sieht aus wie
 * ein Text und geht raus.
 *
 * **Das Ende ist jede Abschnittsgrenze**, nicht eine bestimmte Schreibweise:
 * eine Zierlinie, eine unterstrichene Ueberschrift, ein `##`.
 */
export function captionAus(beiblatt) {
  if (!beiblatt) return '';

  // Ueberschrift, auch mit Zierrand davor.
  //
  // ⚠ `[ \t…]`, NICHT `[\s…]`: `\s` schluckt auch den Zeilenumbruch, der
  // Treffer begaenne dann eine Zeile zu frueh — und die Ueberschrift bliebe
  // im Ergebnis stehen, statt entfernt zu werden.
  const start = beiblatt.search(/^[ \t─═—=-]*(?:##\s*Caption|CAPTION ZUM KOPIEREN)/im);
  if (start === -1) return '';

  // Die Ueberschriftszeile selbst weg, und eine etwaige Unterstreichung.
  const rest = beiblatt.slice(start).replace(/^.*\n(?:[-=─═]{3,}\n)?/, '');

  // Ende: die naechste Abschnittsgrenze, in welcher Schreibweise auch immer.
  const ende = rest.search(/^(?:##\s|[─═—]{2,}|[^\n]{3,}\n[-=]{3,}\s*$)/m);
  return (ende === -1 ? rest : rest.slice(0, ende)).trim();
}

/**
 * Sieht dieser Text nach einem Beiblatt statt nach einer Caption aus?
 *
 * ⚠ Das Rettungsnetz unter captionAus(). Beide Fehler oben waeren hier
 * haengengeblieben, bevor irgendetwas hochgeladen wurde. Ein Netz ist kein
 * Ersatz fuer die Reparatur — aber die naechste Beiblatt-Aenderung in einem
 * der fuenf Repos kommt bestimmt, und sie wird niemandem auffallen.
 */
export function riechtNachBeiblatt(text) {
  const verraeter = [
    /ZUR KONTROLLE/i, /nicht posten/i, /VOR DEM POSTEN/i,
    /Faktencheck/i, /→\s*richtig:/, /CAPTION ZUM KOPIEREN/i, /^Format:\s/m,
    /Store-Satz im Bild/i,
  ];
  return verraeter.find((r) => r.test(text))?.source ?? null;
}

/**
 * Hoechstens so viele Hashtags gehen an ein Netzwerk (Josef, 18.09.2026).
 *
 * ⚠ Die Zahl steht HIER, bei den Regeln, und wird von beschreibung.mjs
 * importiert — nicht umgekehrt. vorflug.mjs ist die Datei, in der jemand
 * nachsieht, was erlaubt ist; und so zeigt die Abhaengigkeit in eine
 * Richtung (beschreibung → vorflug), statt einen Ring zu bilden.
 */
export const MAX_HASHTAGS = 5;

/** Ein Befund. `hart: true` verwirft den Post. */
const befund = (hart, regel, text) => ({ hart, regel, text });

/** Baut den Verfuegbarkeitssatz aus der Konfiguration statt ihn zu tippen. */
export function storeSatz(app, sprache = 'de') {
  const { ios, android } = app.stores;
  if (sprache === 'de') {
    if (ios && android) return 'Gratis im App Store und bei Google Play';
    if (android) return 'Gratis bei Google Play';
    if (ios) return 'Gratis im App Store';
    return 'Im Browser spielen';
  }
  if (ios && android) return 'Free on the App Store and Google Play';
  if (android) return 'Free on Google Play';
  if (ios) return 'Free on the App Store';
  return 'Play in your browser';
}

/** Store-Namen, die in einem Text nichts zu suchen haben, wenn der Store fehlt. */
const STORE_WOERTER = {
  ios: [/app\s*store/i, /iphone/i, /\bios\b/i],
  android: [/google\s*play/i, /play\s*store/i, /\bandroid\b/i],
};

export function pruefe({ appSchluessel, app, post, texte }) {
  const funde = [];
  const alles = Object.values(texte).filter(Boolean).join('\n');
  const r = app.regeln ?? {};

  // --- Regel fuer alle: kein Store nennen, den es nicht gibt ---------------
  for (const [plattform, muster] of Object.entries(STORE_WOERTER)) {
    if (app.stores[plattform]) continue;
    for (const m of muster) {
      if (m.test(alles)) {
        funde.push(befund(true, 'store-verfuegbarkeit',
          `Text nennt ${plattform}, aber ${app.name} ist dort nicht veroeffentlicht. ` +
          `Richtig waere: "${storeSatz(app, post.sprache)}".`));
        break;
      }
    }
  }

  // --- Regel fuer alle: keine ROHE Store-Adresse in der Caption ------------
  //
  // ⚠ Seit 18.09.2026 steht sehr wohl ein Link im Post — aber die eigene
  // Landeseite (`linkInBio` in apps.json), nicht apps.apple.com oder
  // play.google.com. Warum, steht ausfuehrlich in beschreibung.mjs bei
  // linkZeile(). Kurz: eine rohe Store-Adresse trifft die falsche Haelfte
  // der Leser, ist unmerkbar lang und veraltet mit jedem Store-Umbau.
  //
  // Der Schluessel heisst weiterhin `store_link_in_caption` — er meint jetzt
  // genau das: die rohe Store-Adresse, nicht den App-Link.
  if (r.store_link_in_caption === false && /https?:\/\/\S*(apps\.apple|play\.google)/i.test(alles)) {
    funde.push(befund(true, 'store-link',
      'Rohe Store-Adresse in der Caption. Richtig ist die eigene Landeseite '
      + '(linkInBio in apps.json) — sie erkennt die Plattform und leitet weiter.'));
  }

  // --- Regel fuer alle: hoechstens fuenf Hashtags --------------------------
  //
  // ⚠ Josefs Regel vom 18.09.2026. Geprueft wird das Feld `hashtags`, das
  // lauf.mjs mit dem fuellt, was beschreibung.mjs tatsaechlich anhaengt —
  // NICHT die Liste im Beiblatt. Die darf laenger sein: sie ist zugleich die
  // Vorlage zum Kopieren fuer einen Beitrag von Hand, und dort schneidet
  // niemand automatisch ab.
  if (texte.hashtags) {
    const anzahl = (String(texte.hashtags).match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
    if (anzahl > MAX_HASHTAGS) {
      funde.push(befund(true, 'hashtag-anzahl',
        `${anzahl} Hashtags im Beitrag, erlaubt sind ${MAX_HASHTAGS}. `
        + 'Gekuerzt wird in beschreibung.mjs — schlaegt diese Regel an, '
        + 'ist der Text an der Kuerzung vorbeigelaufen.'));
    }
  }

  // --- Regel fuer alle: KI-erzeugte Menschen muessen gekennzeichnet sein ----
  // Josefs Regel vom 29.08.2026. Sie deckt sich mit dem, was Meta und TikTok
  // fuer realistische KI-Inhalte ohnehin verlangen, und mit Art. 50 des
  // EU AI Act. Wer selbst kennzeichnet, bestimmt, wie das Label aussieht.
  //
  // ⚠ Gilt fuer KI-erzeugte MENSCHEN. Ein echtes Foto zu kennzeichnen waere
  // genauso falsch wie ein KI-Bild nicht zu kennzeichnen.
  //
  // ⚠ NUR FOTOREALISTISCHE Menschen (Josef, 26.09.2026: „ki wasserzeichen nur
  // wenn realistische personen sichtbar sind!!! Nicht bei anigosha wenn nur der
  // animejunge zu sehen ist"). Anime, Comic, gemalte Figuren und 3D-Puppen
  // tragen KEIN Plaettchen. Die Herkunftsklassen im Beiblatt:
  //   ki-menschen (…)  fotorealistischer KI-Mensch → Plaettchen PFLICHT
  //   ki-figur (…)     Anime/Comic/gemalt/Puppe     → Plaettchen VERBOTEN
  //   ki-bild (…)      KI-Bild ohne Menschen        → kein Plaettchen
  // Die Regel prueft beide Richtungen: Ein Plaettchen zu viel ist genauso ein
  // Fehler wie eines zu wenig — es behauptet etwas, das nicht stimmt.
  if (texte.medienherkunft?.startsWith('ki-menschen') && texte.wasserzeichen !== true) {
    funde.push(befund(true, 'ki-wasserzeichen',
      'Fotorealistische KI-Menschen im Bild, aber kein AI-Wasserzeichen. Es gehoert '
      + 'unten rechts in die Ecke — sonst setzt die Plattform ihr eigenes Label darueber.'));
  }
  if (/^ki-(figur|bild)\b/.test(texte.medienherkunft ?? '') && texte.wasserzeichen === true) {
    funde.push(befund(true, 'ki-wasserzeichen-zuviel',
      'AI-Plaettchen auf einer nicht-realistischen Figur (Anime, Comic, gemalt) oder einem '
      + 'Bild ohne Menschen. Josefs Regel vom 26.09.2026: nur bei realistischen Personen.'));
  }

  // --- Anigosha ------------------------------------------------------------
  // Ausnahme (Josef, 25.09.2026: „immer mit dem Jungen"): die EIGENE Figur
  // aus dem Anigosha-Werbespot. Das Verbot gilt Bildern ERKENNBARER
  // Anime-Figuren; der Junge ist keine (anigosha/store-assets/social/figuren/
  // HERKUNFT.md). Er ist eine Anime-Figur, KEIN realistischer Mensch — also
  // `ki-figur` und ohne AI-Plaettchen (Josef, 26.09.2026).
  const eigeneFigur = /^ki-figur\b/.test(texte.medienherkunft ?? '')
    && /eigene (Anime-)?Figur/.test(texte.medienherkunft);
  if (r.nur_typografie && post.medium && texte.medienherkunft &&
      texte.medienherkunft !== 'typografie' && !eigeneFigur) {
    funde.push(befund(true, 'nur-typografie',
      `Medienherkunft "${texte.medienherkunft}" — erlaubt ist Typografie auf dem ` +
      'Markenverlauf, dazu nur die eigene Figur (den Jungen). Bilder erkennbarer ' +
      'Anime-Figuren gefaehrden das ganze Entwicklerkonto.'));
  }

  // --- Mahjong -------------------------------------------------------------
  if (r.nur_eigener_ton && texte.tonquelle &&
      !['synth', 'stille', 'eigen'].includes(texte.tonquelle)) {
    funde.push(befund(true, 'nur-eigener-ton',
      `Tonquelle "${texte.tonquelle}" ist keine eigene. Chart- und Trending-Sounds ` +
      'sind nur fuer private Posts lizenziert; kommerziell wird das Video stummgeschaltet.'));
  }

  // --- WELLbooked! ---------------------------------------------------------
  if (r.marke_mit_ausrufezeichen) {
    for (const [feld, text] of Object.entries(texte)) {
      if (!text || feld === 'hashtags' || feld.startsWith('_')) continue;
      // „WELLbooked" ohne „!" direkt dahinter. Das vorangestellte (?<!#)
      // nimmt Hashtags aus: in #WELLbooked ist das Ausrufezeichen nicht
      // moeglich, und die Regel sagt das ausdruecklich.
      if (/(?<!#)WELLbooked(?!!)/.test(text)) {
        funde.push(befund(true, 'marke-ausrufezeichen',
          `Feld "${feld}" schreibt "WELLbooked" ohne Ausrufezeichen. ` +
          'Die Marke ist "WELLbooked!" — Ausnahme sind nur Hashtags.'));
      }
    }
  }
  // Einzige Ausnahme: eigener Ton (KI-Stimme + KI-Musik aus dem App-Repo) in
  // den Formaten aus `ton_erlaubt_formate` — bei WELLbooked! nur `clip-reel`.
  // Die Inhaberin hat dem zugestimmt, uebermittelt von Josef am 23.09.2026.
  // Fremder Ton (Musikbett, Trending-Sound) bleibt ueberall verboten.
  const tonErlaubt = texte.tonquelle === 'eigen'
    && (r.ton_erlaubt_formate ?? []).includes(post.format ?? post.winkel);
  if (r.tonspur_muss_leer_sein && texte.tonquelle && texte.tonquelle !== 'stille' && !tonErlaubt) {
    funde.push(befund(true, 'tonspur-leer',
      'WELLbooked!-Videos gehen stumm raus (Anweisung vom 01.08.2026). Ausnahme ' +
      'nur eigener Ton in: ' + ((r.ton_erlaubt_formate ?? []).join(', ') || '—') + '.'));
  }

  // --- FullRep -------------------------------------------------------------
  // Hier standen zwei Pruefungen: aerztlicher Haftungshinweis und sichtbare
  // Quellenangabe. BEIDE sind entfallen (Josefs Entscheidungen vom
  // 29.08.2026), und das ist kein Versehen.
  //
  // Beide sind Auflagen fuer den STORE-EINTRAG: Google hat am 30.07.2026 die
  // Play-Beschreibung wegen des fehlenden Hinweises abgelehnt, Apple am
  // 29.07.2026 unter 1.4.1 wegen unbelegter medizinischer Inhalte in der App.
  //
  // ⚠ In der App (MedicalDisclaimer.jsx, References.jsx), im Play-Text
  // (store-assets/play-listing.de-DE.json) und unter /legal/health bleiben
  // beide UNVERAENDERT. Wer sie DORT entfernt, holt beide Ablehnungen zurueck.
  // Ein Instagram-Beitrag ist kein Store-Listing — nur darauf bezieht sich
  // dieser Verzicht.

  return {
    bestanden: !funde.some((f) => f.hart),
    funde,
  };
}

/** Hilfsausgabe fuer die Kommandozeile. */
export function berichte(ergebnis, kennung) {
  if (ergebnis.bestanden && !ergebnis.funde.length) return `  ✓ ${kennung}`;
  const zeilen = ergebnis.funde.map((f) => `      ${f.hart ? '✗' : '!'} [${f.regel}] ${f.text}`);
  return `  ${ergebnis.bestanden ? '✓' : '✗'} ${kennung}\n${zeilen.join('\n')}`;
}
