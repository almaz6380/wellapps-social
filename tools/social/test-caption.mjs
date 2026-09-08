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

console.log(`\n${fehler === 0 ? '✓ Alle Faelle bestanden.' : `✗ ${fehler} Fehler.`}`);
process.exit(fehler === 0 ? 0 : 1);
