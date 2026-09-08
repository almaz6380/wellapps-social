#!/usr/bin/env node
// Reel-Generator für Instagram / TikTok — 1080×1920, H.264, mit Ton.
//
//   node tools/reels/make-reel.mjs --format fandom --category one_piece --lang de
//   node tools/reels/make-reel.mjs --format ladder --lang en --seed 7
//   node tools/reels/make-reel.mjs --format fandom --category naruto --dry-run
//
// Optionen:
//   --format   fandom | ladder            (Pflicht)
//   --category <slug>                     (nur fandom)
//   --lang     de | en                    (Standard de)
//   --seed     <zahl>                     gleiche Zahl = gleiches Reel
//   --out      <verzeichnis>              Standard out/reels
//   --dry-run  nur Kontaktbogen als PNG, kein Video (Sekunden statt Minuten)
//   --kein-ton stummes Video, ruft fal.ai nicht auf
//
// Voraussetzung einmalig:  npm i --no-save playwright ffmpeg-static

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { baueStoryboard, FPS } from './storyboard.mjs';
import { frames, kontaktbogen } from './render.mjs';
import { videoSenke, tonspurBauen, lauf } from './encode.mjs';
import { baueDatei } from './captions.mjs';
import { ereignisse, klaengeSicherstellen, fehlendeKlaenge, kostenSchaetzung } from './audio.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');

function argumente(argv) {
  const a = { lang: 'de', seed: 1, out: join(WURZEL, 'out', 'reels') };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--kein-ton') a.keinTon = true;
    else if (k.startsWith('--')) a[k.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  a.seed = Number(a.seed);
  return a;
}

const bytesLesbar = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const a = argumente(process.argv.slice(2));
  if (!a.format) {
    console.error('Fehlt: --format fandom|ladder   (siehe Kopf der Datei)');
    process.exit(1);
  }

  const bank = JSON.parse(readFileSync(join(HIER, 'data', 'fragen.json'), 'utf8'));
  const sb = baueStoryboard({
    format: a.format,
    lang: a.lang,
    kategorie: a.category ?? null,
    fragen: bank.fragen,
    seed: a.seed,
  });

  const name = [
    'anigosha',
    a.format,
    a.category ?? 'mix',
    a.lang,
    `s${a.seed}`,
  ].join('-');

  mkdirSync(a.out, { recursive: true });

  console.log(`Reel: ${name}`);
  console.log(`  ${sb.bloecke.length} Blöcke · ${sb.gesamtFrames} Frames · ${sb.dauerSek.toFixed(1)} s bei ${FPS} fps`);
  for (const f of sb.fragen) {
    console.log(`  · [${f.kategorie[a.lang]} ${f.difficulty}] ${f[a.lang].prompt.slice(0, 58)}…  → ${f[a.lang].options[f.correctIndex]}`);
  }

  // ---------- Kontaktbogen ----------
  if (a.dryRun) {
    console.log('\nKontaktbogen wird gerendert …');
    const bilder = await kontaktbogen(sb);
    const tmp = join(a.out, `.bogen-${name}`);
    mkdirSync(tmp, { recursive: true });
    bilder.forEach((b, i) => writeFileSync(join(tmp, `${String(i).padStart(2, '0')}.png`), b.png));

    const ziel = join(a.out, `${name}-kontaktbogen.png`);
    const spalten = 6;
    const zeilen = Math.ceil(bilder.length / spalten);
    await lauf([
      '-y', '-framerate', '1', '-i', join(tmp, '%02d.png'),
      '-frames:v', '1',
      '-vf', `scale=300:-1,tile=${spalten}x${zeilen}:margin=12:padding=12:color=#0b0716`,
      ziel,
    ]);
    rmSync(tmp, { recursive: true, force: true });
    console.log(`✓ ${ziel}  (${bilder.map((b) => b.name).join(', ')})`);
    return;
  }

  // ---------- Ton ----------
  let tonDatei = null;
  if (!a.keinTon) {
    const fehlt = fehlendeKlaenge();
    if (fehlt.length) {
      const k = kostenSchaetzung(fehlt);
      console.log(`\nEs fehlen ${fehlt.length} Klänge (${k.sek} s, ~$${k.usd.toFixed(3)}) — werden einmalig erzeugt.`);
      await klaengeSicherstellen();
    }
    const ev = ereignisse(sb);
    if (ev.length) {
      tonDatei = join(a.out, `.ton-${name}.m4a`);
      await tonspurBauen({ ereignisse: ev, fps: FPS, dauerFrames: sb.gesamtFrames, ziel: tonDatei });
      console.log(`  Tonspur: ${ev.length} Ereignisse`);
    }
  }

  // ---------- Video ----------
  const ziel = join(a.out, `${name}.mp4`);
  console.log('\nRendere Frames …');
  const t0 = Date.now();
  const senke = videoSenke({ fps: FPS, ziel, tonDatei });

  await frames(sb, senke.stdin, {
    onFortschritt: (n, g) => process.stdout.write(`\r  ${n}/${g} (${((n / g) * 100).toFixed(0)} %)   `),
  });
  senke.stdin.end();
  await senke.fertig;
  process.stdout.write('\n');

  if (tonDatei && existsSync(tonDatei)) rmSync(tonDatei, { force: true });

  // ---------- Caption ----------
  const capDatei = join(a.out, `${name}.txt`);
  writeFileSync(capDatei, baueDatei(sb, name));

  const groesse = statSync(ziel).size;
  console.log(`✓ ${ziel}  (${bytesLesbar(groesse)}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(`✓ ${capDatei}`);
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1); });
