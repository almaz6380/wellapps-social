// Prueft captionAus() gegen die Beiblatt-Stile aller fuenf Repos.
//
//   node tools/social/test-caption.mjs
//
// ⚠ Warum es diesen Test gibt: Am 05.09.2026 trug ein Facebook-Entwurf das
// GANZE Beiblatt — samt „ENTHALTENE FRAGEN (Faktencheck)" mit den richtigen
// Antworten. Ein Quiz, das die Loesungen mitliefert. Aufgefallen ist das nur,
// weil zufaellig jemand in die Merkliste geschaut hat.
//
// Der Fehler war nicht exotisch: Die Reel-Beiblaetter schreiben ihre
// Ueberschrift mit Zierrand („── CAPTION ZUM KOPIEREN ──"), die Suche
// verlangte sie am Zeilenanfang. Solche Formate aendern sich in fuenf Repos
// unabhaengig voneinander — deshalb Faelle statt Vertrauen.

import { captionAus, riechtNachBeiblatt } from './vorflug.mjs';
import { beschreibungBauen, hashtagsFuer, linkZeile } from './beschreibung.mjs';

const faelle = [
  {
    name: 'Anigosha-Reel: Ueberschrift mit Zierrand',
    ein: [
      'anigosha-fandom-attack_on_titan-de-s93318',
      '=========================================',
      '',
      'Format: fandom   Sprache: DE   Laenge: 32.0 s   Seed: 93318',
      '',
      '── CAPTION ZUM KOPIEREN ──────────────────────────────',
      '',
      'Nur echte Fans schaffen alle drei.',
      '',
      '#anime #animequiz',
      '',
      '── VOR DEM POSTEN ────────────────────────────────────',
      '',
      '• Trending-Sound drueberlegen.',
      '',
      '── ENTHALTENE FRAGEN (Faktencheck) ───────────────────',
      '',
      '  1. Wer hat Attack on Titan erschaffen?',
      '     → richtig: Hajime Isayama',
    ].join('\n'),
    soll: 'Nur echte Fans schaffen alle drei.\n\n#anime #animequiz',
  },
  {
    name: 'Anigosha-Bild: Ueberschrift unterstrichen, Kontrollteil dahinter',
    ein: [
      'anigosha-frage-karte-mix-de-s23535',
      '',
      'CAPTION ZUM KOPIEREN',
      '--------------------',
      'Wie heisst Ashs treuer Partner?',
      '',
      '#anigosha #quiz',
      '',
      'ZUR KONTROLLE (nicht posten)',
      '----------------------------',
      'Wie heisst Ashs treuer Partner?',
      '   → Pikachu',
    ].join('\n'),
    soll: 'Wie heisst Ashs treuer Partner?\n\n#anigosha #quiz',
  },
  {
    name: 'Markdown-Stil der uebrigen Repos',
    ein: [
      '# mahjong-clear-en-s38085',
      '',
      '## Caption (kopieren)',
      '',
      'Can you clear this board?',
      '',
      '## Beim Hochladen',
      '',
      'iOS ist noch nicht freigegeben: nirgends den App Store nennen.',
    ].join('\n'),
    soll: 'Can you clear this board?',
  },
  {
    // ⚠ Der wichtigste Fall. Frueher stand hier `return beiblatt` — im Zweifel
    // ALLES. Genau daran ist es gescheitert.
    name: 'Keine Ueberschrift: lieber nichts als alles',
    ein: 'Irgendein Text ohne die uebliche Ueberschrift.\nZweite Zeile.',
    soll: '',
  },
  {
    name: 'Leere Eingabe',
    ein: '',
    soll: '',
  },
];

let fehler = 0;

for (const f of faelle) {
  const ist = captionAus(f.ein);
  if (ist !== f.soll) {
    fehler += 1;
    console.log(`✗ ${f.name}`);
    console.log(`   erwartet: ${JSON.stringify(f.soll)}`);
    console.log(`   bekommen: ${JSON.stringify(ist)}`);
  } else {
    console.log(`✓ ${f.name}`);
  }
}

// Das Rettungsnetz muss anschlagen, wo captionAus versagen KOENNTE.
const netzFaelle = [
  ['ganzes Beiblatt', 'Format: fandom\n\n→ richtig: Hajime Isayama', true],
  ['Kontrollteil', 'Frage?\n\nZUR KONTROLLE (nicht posten)\nAntwort', true],
  ['saubere Caption', 'Nur echte Fans schaffen alle drei.\n\n#anime', false],
];

for (const [name, text, sollAnschlagen] of netzFaelle) {
  const traf = riechtNachBeiblatt(text) !== null;
  if (traf !== sollAnschlagen) {
    fehler += 1;
    console.log(`✗ Netz: ${name} — ${traf ? 'schlug an' : 'schlug NICHT an'}, erwartet war das Gegenteil`);
  } else {
    console.log(`✓ Netz: ${name}`);
  }
}

// --------------------------------------------------------------------------
// Beschreibung: hoechstens fuenf Hashtags, App-Link immer dabei
// (Josefs Regeln vom 18.09.2026)
//
// ⚠ Der zweite Fall ist der wichtige. Anigoshas Reel-Beiblatt schreibt die
// Hashtags MITTEN in die Caption, ohne eigenen Abschnitt — gemessen am
// 18.09.2026: elf bei `fandom`, vierzehn bei `ladder`. Ein Test, der nur den
// Markdown-Stil der anderen vier Repos prueft, haette die Fuenfer-Grenze fuer
// jeden Anigosha-Reel stillschweigend verfehlt.
console.log('\nBeschreibung — Link und Hashtag-Grenze:\n');

const testApp = { name: 'Testapp', linkInBio: 'beispiel.app/get', stores: { ios: true, android: true } };

const bFaelle = [
  {
    name: 'Sieben Hashtags im eigenen Abschnitt → fuenf',
    ein: ['## Caption (kopieren)', '', 'Kraft folgt der Wiederholung.', '',
      '## Hashtags', '', '#fullrep #fitness #gym #training #uebung #muskelaufbau #workout'].join('\n'),
    sollTags: ['fullrep', 'fitness', 'gym', 'training', 'uebung'],
    sollLink: true,
  },
  {
    name: 'Acht Hashtags INNERHALB der Caption (Anigosha-Reel) → fuenf',
    ein: ['── CAPTION ZUM KOPIEREN ──────', '', 'Nur echte Fans schaffen alle drei.', '',
      '#onepiece #onepiecefan #anigosha #animequiz #anime #quiz #otaku #luffy', '',
      '── VOR DEM POSTEN ────────────', '', '• Trending-Sound drueberlegen.'].join('\n'),
    sollTags: ['onepiece', 'onepiecefan', 'anigosha', 'animequiz', 'anime'],
    sollLink: true,
  },
  {
    name: 'Gar keine Hashtags (Swaply) — Link trotzdem dran',
    ein: ['## Caption (kopieren)', '', 'Der Ausloeser bleibt, die Routine wird getauscht.', '',
      '## Beim Hochladen', '', '- Nichts dazuerfinden.'].join('\n'),
    sollTags: [],
    sollLink: true,
  },
  {
    name: 'Doppelte Tags zaehlen einmal',
    ein: ['## Caption (kopieren)', '', 'Text.', '',
      '## Hashtags', '', '#a #A #b #c #d #e #f'].join('\n'),
    sollTags: ['a', 'b', 'c', 'd', 'e'],
    sollLink: true,
  },
  {
    name: 'Keine Caption → keine Beschreibung (kein Link-und-Tag-Spam)',
    ein: 'Text ohne Ueberschrift.',
    sollTags: [],
    sollLink: false,
    sollLeer: true,
  },
];

for (const f of bFaelle) {
  const tags = hashtagsFuer(f.ein);
  const text = beschreibungBauen({ app: testApp, beiblatt: f.ein, sprache: 'de' });
  const probleme = [];

  if (JSON.stringify(tags) !== JSON.stringify(f.sollTags)) {
    probleme.push(`Tags ${JSON.stringify(tags)} statt ${JSON.stringify(f.sollTags)}`);
  }
  if (f.sollLeer && text !== '') probleme.push(`Text sollte leer sein, ist ${JSON.stringify(text)}`);
  if (!f.sollLeer) {
    if (text.includes(testApp.linkInBio) !== f.sollLink) {
      probleme.push(f.sollLink ? 'App-Link fehlt' : 'App-Link steht drin, sollte aber nicht');
    }
    // ⚠ Die Tags duerfen im fertigen Text kein ZWEITES Mal auftauchen. Genau
    // das passiert, wenn inlineHashtags() sie zwar findet, aber nicht aus der
    // Caption entfernt: einmal im Text, einmal im angehaengten Block.
    const imText = (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
    if (imText !== f.sollTags.length) {
      probleme.push(`${imText} Hashtags im Text, erwartet ${f.sollTags.length}`);
    }
  }

  if (probleme.length) {
    fehler += 1;
    console.log(`✗ ${f.name}`);
    for (const p of probleme) console.log(`   ${p}`);
  } else {
    console.log(`✓ ${f.name}`);
  }
}

// --- Eigene Linkzeile aus dem Beiblatt (23.09.2026) --------------------------
//
// WELLbooked!s Anbieter-Posts ersetzen „Hier buchen: wellbooked.at" durch die
// Gründungspartner-Seite. Erlaubt nur auf der EIGENEN Domain — jede
// Gegenprobe unten ist ein Link, der unter der Marke nichts zu suchen hat.
{
  const wb = { linkInBio: 'wellbooked.at', linkWort: { de: 'Hier buchen' } };
  const vorgabe = 'Hier buchen: wellbooked.at';
  const linkFaelle = [
    ['ohne Abschnitt → Vorgabe', '## Caption\n\nText\n', vorgabe],
    ['## Link auf eigener Domain', '## Caption\n\nText\n\n## Hashtags\n\n#a\n\n## Link\n\nGründungspartner:in werden: wellbooked.at/gruendungspartner\n',
      'Gründungspartner:in werden: wellbooked.at/gruendungspartner'],
    ['── LINK ── mit https und www', '── LINK ──\n\nMehr: https://www.wellbooked.at/gruendungspartner',
      'Mehr: https://www.wellbooked.at/gruendungspartner'],
    ['Gegenprobe: fremde Domain, eigene im Pfad', '## Link\n\nKlick: evil.com/wellbooked.at', vorgabe],
    ['Gegenprobe: eigene Domain als Subdomain', '## Link\n\nKlick: wellbooked.at.evil.com', vorgabe],
    ['Gegenprobe: ähnliche Domain', '## Link\n\nKlick: notwellbooked.at', vorgabe],
    ['Gegenprobe: eigene UND fremde Adresse', '## Link\n\nwellbooked.at oder evil.com', vorgabe],
    ['Gegenprobe: gar keine Adresse', '## Link\n\nnur Text', vorgabe],
  ];
  for (const [name, beiblatt, soll] of linkFaelle) {
    const ist = linkZeile(wb, 'de', beiblatt);
    if (ist === soll) console.log(`✓ Link: ${name}`);
    else { fehler += 1; console.log(`✗ Link: ${name}\n   ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`); }
  }
  // Und im fertigen Text: die eigene Zeile, nicht zusätzlich die Vorgabe.
  const text = beschreibungBauen({ app: wb, beiblatt: linkFaelle[1][1] });
  const ok = text.includes('wellbooked.at/gruendungspartner') && !text.includes(vorgabe);
  if (ok) console.log('✓ Link: beschreibungBauen nimmt die eigene Zeile statt der Vorgabe');
  else { fehler += 1; console.log(`✗ Link: beschreibungBauen\n   ${JSON.stringify(text)}`); }
}

console.log(`\n${fehler === 0 ? '✓ Alle Faelle bestanden.' : `✗ ${fehler} Fehler.`}`);
process.exit(fehler === 0 ? 0 : 1);
