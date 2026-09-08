// Ton: Effekte einmalig über fal.ai erzeugen, dann im Repo cachen.
//
// Kostenpunkt beim allerersten Lauf rund 8 Cent (sonilo, $0.0018/Sek). Danach
// liegen die Dateien unter assets/sfx/ und jeder weitere Reel ist gratis.
//
// Der Musikteppich läuft bewusst sehr leise. Grund: Josef legt in der TikTok-/
// Instagram-App noch einen Trending-Sound drüber — der ist der stärkere
// Reichweitenhebel. Eigene Musik laut zu mischen würde ihn nur überdecken.

import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
export const SFX_DIR = join(HIER, 'assets', 'sfx');
const MODELL = 'sonilo/v1.1/text-to-sound-effects';

export const KLAENGE = {
  'hook-hit':  { sek: 2,  prompt: 'short punchy cinematic impact with deep bass hit and quick air whoosh, clean, no music, no voice' },
  'whoosh':    { sek: 2,  prompt: 'quick crisp swoosh transition sound, short, clean, no music, no voice' },
  'tick':      { sek: 4,  prompt: 'steady crisp clock ticking countdown, quiz show timer, four even ticks, no music, no voice' },
  'correct':   { sek: 2,  prompt: 'bright positive chime, correct answer ding with light sparkle, short and clean, no voice' },
  'outro':     { sek: 3,  prompt: 'uplifting short modern synth logo sting, positive resolve, no voice' },
  'bett':      { sek: 32, prompt: 'minimal chill electronic background loop, soft pulsing synth, calm and unobtrusive, no drums fills, no voice' },
};

const pfad = (id) => join(SFX_DIR, `${id}.aac`);

export function fehlendeKlaenge() {
  return Object.keys(KLAENGE).filter((id) => !existsSync(pfad(id)) || statSync(pfad(id)).size < 1000);
}

export function kostenSchaetzung(ids = fehlendeKlaenge()) {
  const sek = ids.reduce((a, id) => a + KLAENGE[id].sek, 0);
  return { sek, usd: sek * 0.0018 };
}

async function einenHolen(id) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY ist in der Umgebung nicht gesetzt — ohne den Schlüssel geht der Weg nicht.');

  const { sek, prompt } = KLAENGE[id];
  const res = await fetch(`https://fal.run/${MODELL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, duration: sek, audio_format: 'aac' }),
  });

  if (!res.ok) throw new Error(`fal ${res.status} für "${id}": ${(await res.text()).slice(0, 400)}`);

  const daten = await res.json();
  const url = daten?.audio?.url ?? daten?.audio_file?.url ?? daten?.url;
  if (!url) throw new Error(`fal-Antwort für "${id}" ohne Audio-URL: ${JSON.stringify(daten).slice(0, 400)}`);

  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  mkdirSync(SFX_DIR, { recursive: true });
  writeFileSync(pfad(id), bytes);
  return { id, bytes: bytes.length };
}

export async function klaengeSicherstellen({ log = console.log } = {}) {
  const fehlt = fehlendeKlaenge();
  if (!fehlt.length) return [];
  const ergebnis = [];
  for (const id of fehlt) {
    log(`  … erzeuge "${id}" (${KLAENGE[id].sek} s)`);
    ergebnis.push(await einenHolen(id));
  }
  return ergebnis;
}

// Legt die Klänge auf die Zeitachse des Storyboards.
export function ereignisse(storyboard, { bett = true } = {}) {
  const P = storyboard.phasen;
  const ev = [];
  const dazu = (id, frameStart, lautstaerke) => {
    if (existsSync(pfad(id))) ev.push({ id, datei: pfad(id), frameStart: Math.max(0, frameStart), lautstaerke });
  };

  if (bett) dazu('bett', 0, 0.1); // ~ -20 dB, hörbar aber nie im Weg

  for (const b of storyboard.bloecke) {
    if (b.typ === 'hook') dazu('hook-hit', b.start, 0.85);
    if (b.typ === 'outro') dazu('outro', b.start, 0.7);
    if (b.typ === 'frage') {
      dazu('whoosh', b.start, 0.5);
      dazu('tick', b.start + P.frageEin + P.antworten, 0.42);
      dazu('correct', b.start + P.frageEin + P.antworten + P.countdown, 0.75);
    }
  }
  return ev;
}
