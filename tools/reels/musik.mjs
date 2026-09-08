#!/usr/bin/env node
// Eigener Anisong für Anigosha — japanisches Anime-Opening im Shonen-Stil.
//
// Warum überhaupt: Der Musikteppich der Reels läuft bewusst leise, damit in der
// App noch ein Trending-Sound darüberpasst. Ein EIGENER Song ist der
// Gegenentwurf — er macht den Kanal wiedererkennbar, statt austauschbar zu sein.
//
// Läuft über die Suno-API von kie.ai (12 Credits ≈ 0,06 $ je Anfrage, eine
// Anfrage liefert zwei Fassungen). Der frühere fal-Weg (ace-step) scheiterte
// am fal-Guthaben; das kie-Konto hat reichlich.
//
// ⚠ Der Liedtext ist selbst geschrieben und das Genre allgemein beschrieben.
// Kein Modellaufruf nennt einen bestimmten Song oder Interpreten: Ein Modell
// auf ein konkretes Werk anzusetzen ist rechtlich heikel und liefert obendrein
// nur Halbgares. „90er-Shonen-Opening" als Genre trägt dieselbe Energie.
//
// Aufruf:  KIE_API_KEY=… node tools/reels/musik.mjs [--anfragen 2] [--modell V5]
// Ergebnis: out/musik/anisong-<taskId-kurz>-<n>.mp3 (+ Cover als .jpeg)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const AUS = join(HIER, '..', '..', 'out', 'musik');
const BASIS = 'https://api.kie.ai/api/v1';

const arg = (name, standard) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? standard : process.argv[i + 1];
};
const ANFRAGEN = Number(arg('anfragen', 2)); // je Anfrage kommen 2 Fassungen
const MODELL = String(arg('modell', 'V5'));

// Genre statt Vorbild. Die Reihenfolge ist nicht beliebig: Die ersten Tags
// wiegen am schwersten, deshalb steht vorn, was die Richtung bestimmt.
const STIL = [
  'japanese anime opening', 'j-rock', 'shonen anthem', 'fast tempo',
  'driving drums', 'brass section', 'distorted electric guitar',
  'male vocal', 'energetic', 'major key', 'triumphant',
].join(', ');

// Eigener Text auf Anigosha gemünzt. Der Name sitzt auf vier Schlägen
// (A-NI-GO-SHA) — deshalb steht er im Refrain zweimal vorn.
const LYRICS = `[verse]
夜明けのテレビ 胸が高鳴った
あの日の主人公 今も生きてる

[pre-chorus]
思い出せ その名前を
指先が 震えている

[chorus]
アニゴーシャ! 挑め 全力で
知識は武器だ 迷わず進め
アニゴーシャ! 叫べ 高らかに
君と俺との 真剣勝負`;

if (!process.env.KIE_API_KEY) {
  console.error('KIE_API_KEY fehlt — er gehört in die Umgebungsvariablen, nicht ins Repo.');
  process.exit(1);
}
const KOPF = {
  Authorization: `Bearer ${process.env.KIE_API_KEY}`,
  'Content-Type': 'application/json',
};

const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

async function anfrageStarten() {
  const res = await fetch(`${BASIS}/generate`, {
    method: 'POST',
    headers: KOPF,
    body: JSON.stringify({
      customMode: true,
      instrumental: false,
      model: MODELL,
      prompt: LYRICS,
      style: STIL,
      title: 'Anigosha!',
      vocalGender: 'm',
      // Die API verlangt das Feld; abgeholt wird trotzdem per Abfrage unten.
      callBackUrl: 'https://anigosha.vercel.app/',
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.code !== 200 || !d?.data?.taskId) {
    throw new Error(`Start fehlgeschlagen (${res.status}): ${JSON.stringify(d).slice(0, 300)}`);
  }
  return d.data.taskId;
}

async function aufErgebnisWarten(taskId) {
  // Ein Song dauert typischerweise 1–3 Minuten; großzügige Obergrenze.
  for (let versuch = 0; versuch < 60; versuch++) {
    await schlafen(10_000);
    const res = await fetch(`${BASIS}/generate/record-info?taskId=${taskId}`, { headers: KOPF });
    const d = await res.json().catch(() => ({}));
    const status = d?.data?.status ?? '';
    if (/FAILED|ERROR|SENSITIVE/i.test(status)) {
      throw new Error(`Task ${taskId}: ${status} — ${JSON.stringify(d?.data?.errorMessage ?? d).slice(0, 300)}`);
    }
    const stuecke = d?.data?.response?.sunoData ?? d?.data?.response?.data ?? [];
    const fertig = stuecke.filter((s) => s?.audioUrl || s?.audio_url);
    if (status === 'SUCCESS' && fertig.length) return fertig;
    process.stdout.write(`\r  ${taskId.slice(0, 8)}… ${status || 'PENDING'} (${(versuch + 1) * 10} s)   `);
  }
  throw new Error(`Task ${taskId}: kein Ergebnis nach 10 Minuten.`);
}

mkdirSync(AUS, { recursive: true });
console.log(`${ANFRAGEN} Anfrage(n) über kie.ai/Suno ${MODELL} — je 2 Fassungen, 12 Credits/Anfrage\n`);

// Erst alle starten, dann gemeinsam warten — die Läufe sind unabhängig.
const tasks = [];
for (let i = 0; i < ANFRAGEN; i++) {
  const id = await anfrageStarten();
  console.log(`  Anfrage ${i + 1}: Task ${id}`);
  tasks.push(id);
}

let zaehler = 0;
for (const taskId of tasks) {
  const stuecke = await aufErgebnisWarten(taskId);
  console.log('');
  for (const s of stuecke) {
    zaehler++;
    const audioUrl = s.audioUrl ?? s.audio_url;
    const ziel = join(AUS, `anisong-${taskId.slice(0, 8)}-${zaehler}.mp3`);
    writeFileSync(ziel, Buffer.from(await (await fetch(audioUrl)).arrayBuffer()));
    console.log(`  ${ziel}  (${Math.round(s.duration ?? 0)} s)`);
    const coverUrl = s.imageUrl ?? s.image_url;
    if (coverUrl) {
      writeFileSync(ziel.replace(/\.mp3$/, '.jpeg'), Buffer.from(await (await fetch(coverUrl)).arrayBuffer()));
    }
  }
}
console.log(`\nFertig — ${zaehler} Fassungen. ⚠ Die kie-URLs verfallen nach 14 Tagen; was gefällt, gehört ins Repo.`);
