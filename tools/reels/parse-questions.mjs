#!/usr/bin/env node
// Liest die 804 Quizfragen aus den Migrationen 0003–0015 und schreibt sie als
// data/fragen.json. Damit braucht der Reel-Generator weder Supabase noch .env —
// die Fragen liegen im Repo, inklusive richtiger Antwort und Erklärung.
//
// Aufruf:  node tools/reels/parse-questions.mjs
//
// Kein Regex über den ganzen Aufruf: SQL-Strings dürfen Kommas, Klammern und
// verdoppelte Apostrophe ('') enthalten. Deshalb wird zeichenweise geparst.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const MIGRATIONEN = join(HIER, '..', '..', 'supabase', 'migrations');
const ZIEL = join(HIER, 'data', 'fragen.json');

// Aus 0002_questions_solo.sql — bewusst hier gespiegelt, damit der Parser
// ohne zweiten Durchlauf auskommt. Ändert sich die Liste dort, hier nachziehen.
export const KATEGORIEN = {
  one_piece:       { de: 'One Piece',        en: 'One Piece' },
  naruto:          { de: 'Naruto',           en: 'Naruto' },
  dragon_ball:     { de: 'Dragon Ball',      en: 'Dragon Ball' },
  pokemon:         { de: 'Pokémon',          en: 'Pokémon' },
  detektiv_conan:  { de: 'Detektiv Conan',   en: 'Detective Conan' },
  inuyasha:        { de: 'InuYasha',         en: 'InuYasha' },
  ranma:           { de: 'Ranma ½',          en: 'Ranma ½' },
  attack_on_titan: { de: 'Attack on Titan',  en: 'Attack on Titan' },
  death_note:      { de: 'Death Note',       en: 'Death Note' },
  my_hero:         { de: 'My Hero Academia', en: 'My Hero Academia' },
  demon_slayer:    { de: 'Demon Slayer',     en: 'Demon Slayer' },
  jujutsu_kaisen:  { de: 'Jujutsu Kaisen',   en: 'Jujutsu Kaisen' },
};

const AUFRUF = 'seed_question';

// Zerlegt die Argumentliste ab der öffnenden Klammer in Roh-Argumente.
// Gibt { args, ende } zurück; ende zeigt hinter die schließende Klammer.
function argumenteLesen(text, klammerAuf) {
  const args = [];
  let akt = '';
  let tiefe = 0;
  let imString = false;

  for (let i = klammerAuf + 1; i < text.length; i++) {
    const c = text[i];

    if (imString) {
      if (c === "'") {
        // '' ist ein escapter Apostroph, kein Stringende
        if (text[i + 1] === "'") { akt += "''"; i++; continue; }
        imString = false;
        akt += c;
        continue;
      }
      akt += c;
      continue;
    }

    if (c === "'") { imString = true; akt += c; continue; }
    if (c === '(') { tiefe++; akt += c; continue; }
    if (c === ')') {
      if (tiefe === 0) { args.push(akt.trim()); return { args, ende: i + 1 }; }
      tiefe--; akt += c; continue;
    }
    if (c === ',' && tiefe === 0) { args.push(akt.trim()); akt = ''; continue; }
    akt += c;
  }
  throw new Error('Unbeendeter seed_question-Aufruf — Klammer nie geschlossen.');
}

// SQL-Literal → JS-Wert
function literal(roh) {
  if (roh.startsWith("'")) {
    if (!roh.endsWith("'")) throw new Error(`Kaputtes String-Literal: ${roh.slice(0, 40)}…`);
    return roh.slice(1, -1).replace(/''/g, "'");
  }
  const n = Number(roh);
  if (Number.isNaN(n)) throw new Error(`Weder String noch Zahl: ${roh.slice(0, 40)}…`);
  return n;
}

export function parseMigrationen(verzeichnis = MIGRATIONEN) {
  const dateien = readdirSync(verzeichnis)
    .filter((f) => /^00(0[3-9]|1[0-5])_.*\.sql$/.test(f))
    .sort();

  const fragen = [];
  const gesehen = new Set(); // Dedupe über den deutschen Fragetext

  for (const datei of dateien) {
    const text = readFileSync(join(verzeichnis, datei), 'utf8');
    let pos = 0;

    while (true) {
      const treffer = text.indexOf(AUFRUF, pos);
      if (treffer === -1) break;

      pos = treffer + AUFRUF.length;

      // Nur echte Aufrufe zählen. Das schließt zweierlei aus: die
      // Funktionsdefinition am Kopf von 0003 ("create or replace function
      // public.seed_question") und die Erwähnungen in den SQL-Kommentaren.
      const davor = text.slice(Math.max(0, treffer - 40), treffer);
      if (!/\bselect\s+(public\.)?$/i.test(davor)) continue;

      const klammerAuf = text.indexOf('(', treffer + AUFRUF.length);
      if (klammerAuf === -1) break;

      const { args, ende } = argumenteLesen(text, klammerAuf);
      pos = ende;

      if (args.length < 9) {
        throw new Error(`${datei}: Aufruf mit nur ${args.length} Argumenten bei Zeichen ${treffer}.`);
      }

      const [slug, diff, correct, pDe, oDe, eDe, pEn, oEn, eEn] = args.map(literal);

      const frage = {
        slug,
        kategorie: KATEGORIEN[slug],
        difficulty: diff,
        correctIndex: correct,
        de: { prompt: pDe, options: JSON.parse(oDe), explanation: eDe },
        en: { prompt: pEn, options: JSON.parse(oEn), explanation: eEn },
        quelle: datei,
      };

      if (gesehen.has(frage.de.prompt)) continue;
      gesehen.add(frage.de.prompt);
      fragen.push(frage);
    }
  }

  return fragen;
}

// Selbstprüfung — lieber hart abbrechen als ein Reel mit falscher Antwort bauen.
export function pruefen(fragen) {
  const fehler = [];

  for (const f of fragen) {
    const wo = `${f.quelle} · "${f.de.prompt.slice(0, 40)}…"`;
    if (!f.kategorie) fehler.push(`${wo}: unbekannte Kategorie "${f.slug}"`);
    if (![1, 2, 3].includes(f.difficulty)) fehler.push(`${wo}: Schwierigkeit ${f.difficulty}`);
    if (!Number.isInteger(f.correctIndex) || f.correctIndex < 0 || f.correctIndex > 3) {
      fehler.push(`${wo}: correctIndex ${f.correctIndex}`);
    }
    for (const lang of ['de', 'en']) {
      const t = f[lang];
      if (!t.prompt?.trim()) fehler.push(`${wo}: ${lang}-Frage leer`);
      if (!Array.isArray(t.options) || t.options.length !== 4) {
        fehler.push(`${wo}: ${lang} hat ${t.options?.length} Antworten statt 4`);
      }
      if (t.options?.some((o) => !String(o).trim())) fehler.push(`${wo}: ${lang} hat eine leere Antwort`);
      if (!t.explanation?.trim()) fehler.push(`${wo}: ${lang}-Erklärung leer`);
    }
  }

  const kategorien = new Set(fragen.map((f) => f.slug));
  if (kategorien.size !== 12) fehler.push(`${kategorien.size} Kategorien statt 12`);
  if (fragen.length !== 804) fehler.push(`${fragen.length} Fragen statt 804`);

  return fehler;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fragen = parseMigrationen();
  const fehler = pruefen(fragen);

  const proKategorie = {};
  for (const f of fragen) {
    proKategorie[f.slug] ??= { 1: 0, 2: 0, 3: 0, gesamt: 0 };
    proKategorie[f.slug][f.difficulty]++;
    proKategorie[f.slug].gesamt++;
  }

  console.log(`Gelesen: ${fragen.length} Fragen aus ${new Set(fragen.map((f) => f.quelle)).size} Dateien\n`);
  for (const [slug, z] of Object.entries(proKategorie)) {
    console.log(`  ${slug.padEnd(16)} ${String(z.gesamt).padStart(3)}  (leicht ${z[1]}, mittel ${z[2]}, schwer ${z[3]})`);
  }

  if (fehler.length) {
    console.error(`\n✗ ${fehler.length} Problem(e):`);
    for (const f of fehler.slice(0, 20)) console.error('  ' + f);
    process.exit(1);
  }

  mkdirSync(dirname(ZIEL), { recursive: true });
  writeFileSync(ZIEL, JSON.stringify({ erzeugt: 'tools/reels/parse-questions.mjs', anzahl: fragen.length, fragen }, null, 1));
  console.log(`\n✓ Selbstprüfung bestanden → ${ZIEL}`);
}
