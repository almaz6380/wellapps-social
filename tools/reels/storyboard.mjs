// Storyboard: wählt die Fragen aus und legt die Zeitachse fest.
// Rein datengetrieben — ein weiteres Reel-Format ist hier ein Eintrag, kein Umbau.

export const FPS = 30;
const s = (sek) => Math.round(sek * FPS);

// Zeitraster eines Fragenblocks (Summe: 9,0 s)
export const PHASEN = {
  frageEin:    s(1.2),  // Frage erscheint
  antworten:   s(0.8),  // die vier Antworten kommen versetzt dazu
  countdown:   s(4.0),  // Ring läuft, Zuschauer rät mit
  reveal:      s(1.5),  // richtige Antwort leuchtet auf
  erklaerung:  s(1.5),  // „Wusstest du?" — der Grund, bis zum Ende zu schauen
};
export const FRAGE_DAUER = Object.values(PHASEN).reduce((a, b) => a + b, 0);
export const HOOK_DAUER = s(2.0);
export const OUTRO_DAUER = s(3.0);

// Reproduzierbarer Zufall (mulberry32) — gleicher --seed, gleiches Reel.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const zieh = (liste, r) => liste[Math.floor(r() * liste.length)];

const TEXTE = {
  de: {
    hookFandom: (kat) => `Nur echte\n${kat}-Fans\nschaffen 3/3`,
    hookLadder: 'Wie weit\nkommst du?',
    hookSubFandom: 'Antworte mit, bevor die Zeit abläuft',
    hookSubLadder: 'Leicht → Mittel → Schwer',
    stufe: { 1: 'Leicht', 2: 'Mittel', 3: 'Schwer' },
    frageVon: (i, n) => `Frage ${i} von ${n}`,
    wusstest: 'Wusstest du?',
    outroTitel: 'Schaffst du\nden Rest?',
    outroSub: '804 Fragen · 12 Serien · Duelle gegen echte Gegner',
    outroCta: 'Anigosha — gratis im Store',
    kommentar: 'Wie viele hattest du? 👇',
    fuss: 'Anigosha · Anime Quiz & Duelle',
  },
  en: {
    hookFandom: (kat) => `Only real\n${kat} fans\nget 3/3`,
    hookLadder: 'How far\ndo you get?',
    hookSubFandom: 'Answer along before the timer runs out',
    hookSubLadder: 'Easy → Medium → Hard',
    stufe: { 1: 'Easy', 2: 'Medium', 3: 'Hard' },
    frageVon: (i, n) => `Question ${i} of ${n}`,
    wusstest: 'Did you know?',
    outroTitel: 'Can you\nhandle the rest?',
    outroSub: '804 questions · 12 series · duel real opponents',
    outroCta: 'Anigosha — free on the store',
    kommentar: 'How many did you get? 👇',
    fuss: 'Anigosha · Anime Quiz & Duels',
  },
};

// Wählt drei Fragen. Beide Formate steigen in der Schwierigkeit an — das hält
// die Leute im Video: die erste Frage muss jeder schaffen, die letzte fast keiner.
function fragenWaehlen({ format, kategorie, fragen, r }) {
  const auswahl = [];

  if (format === 'fandom') {
    if (!kategorie) throw new Error('Format "fandom" braucht --category');
    const pool = fragen.filter((f) => f.slug === kategorie);
    if (!pool.length) throw new Error(`Keine Fragen für Kategorie "${kategorie}"`);
    for (const diff of [1, 2, 3]) auswahl.push(zieh(pool.filter((f) => f.difficulty === diff), r));
  } else if (format === 'ladder') {
    // Drei verschiedene Serien, damit das Reel nicht nur ein Fandom anspricht.
    const slugs = [...new Set(fragen.map((f) => f.slug))].sort();
    const genommen = new Set();
    for (const diff of [1, 2, 3]) {
      const pool = fragen.filter((f) => f.difficulty === diff && !genommen.has(f.slug));
      const gewaehlt = zieh(pool.length ? pool : fragen.filter((f) => f.difficulty === diff), r);
      genommen.add(gewaehlt.slug);
      auswahl.push(gewaehlt);
    }
    void slugs;
  } else {
    throw new Error(`Unbekanntes Format "${format}" (fandom | ladder)`);
  }

  return auswahl;
}

export function baueStoryboard({ format, lang = 'de', kategorie = null, fragen, seed = 1 }) {
  const r = rng(seed);
  const t = TEXTE[lang];
  if (!t) throw new Error(`Sprache "${lang}" nicht vorgesehen (de | en)`);

  const auswahl = fragenWaehlen({ format, kategorie, fragen, r });
  const katName = kategorie ? auswahl[0].kategorie[lang] : null;

  const bloecke = [];
  let start = 0;
  const schieben = (block, dauer) => {
    bloecke.push({ ...block, start, dauer, ende: start + dauer });
    start += dauer;
  };

  schieben(
    {
      typ: 'hook',
      titel: format === 'fandom' ? t.hookFandom(katName) : t.hookLadder,
      sub: format === 'fandom' ? t.hookSubFandom : t.hookSubLadder,
    },
    HOOK_DAUER,
  );

  auswahl.forEach((f, i) => {
    schieben(
      {
        typ: 'frage',
        nummer: i + 1,
        gesamt: auswahl.length,
        label: t.frageVon(i + 1, auswahl.length),
        stufe: t.stufe[f.difficulty],
        difficulty: f.difficulty,
        serie: f.kategorie[lang],
        prompt: f[lang].prompt,
        optionen: f[lang].options,
        correctIndex: f.correctIndex,
        erklaerung: f[lang].explanation,
        wusstest: t.wusstest,
      },
      FRAGE_DAUER,
    );
  });

  schieben(
    { typ: 'outro', titel: t.outroTitel, sub: t.outroSub, cta: t.outroCta, kommentar: t.kommentar },
    OUTRO_DAUER,
  );

  return {
    format,
    lang,
    kategorie,
    katName,
    seed,
    fps: FPS,
    phasen: PHASEN,
    fussFrage: t.fuss,
    bloecke,
    gesamtFrames: start,
    dauerSek: start / FPS,
    fragen: auswahl,
  };
}
