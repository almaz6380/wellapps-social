// Einen instrumentalen Musikteppich fuer eine App erzeugen.
//
//   KIE_API_KEY=… node tools/social/musik-erzeugen.mjs --app fullrep
//   … --app swaply --trocken      nur zeigen, was angefragt wuerde
//
// --- Wofuer -------------------------------------------------------------------
//
// Die TikTok-Diashows brauchen eine Tonspur, sonst schlaegt TikTok im Editor
// selbst einen Sound vor. WELLbooked, Anigosha und Mahjong haben eine;
// FullRep und Swaply nicht.
//
// ⚠ VOR JEDEM ERZEUGEN ERST SUCHEN. Am 19.09.2026 war ich dabei, fuer
// WELLbooked eine Melodie erzeugen zu lassen, die im Nachbarordner lag —
// `wellbooked/docs/reels/musik/indie-verwendet.mp3`, der Dateiname sagte es
// sogar. Eine Suche ueber Audiodateien haette sie in zwei Sekunden gefunden:
//
//     find . -name '*.mp3' -o -name '*.aac' -o -name '*.m4a'
//
// --- Zwei Regeln aus frueheren Laeufen ----------------------------------------
//
// ⚠ KEINE GENRE- ODER KUENSTLERNAMEN. „indie pop" hat bei fal.ai eine
// `content_policy_violation` ausgeloest (steht so in
// `wellbooked/docs/reels/musik/LIESMICH.md`). Nur Instrumente und Stimmung
// beschreiben — das traegt dieselbe Richtung und laeuft durch.
//
// ⚠ NICHT REPRODUZIERBAR. Jeder Lauf klingt anders. Was gefaellt, wird
// eingecheckt; den Prompt aufzuheben genuegt nicht.
//
// Eine Anfrage kostet ~0,06 $ und liefert ZWEI Fassungen zur Auswahl.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const AUS = join(HIER, '..', '..', 'out', 'musik');
const BASIS = 'https://api.kie.ai/api/v1';

const wert = (n, s) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? s : process.argv[i + 1];
};
const APP = String(wert('app', '') || '').trim();
const TROCKEN = process.argv.includes('--trocken');
const MODELL = String(wert('modell', 'V5'));

// Je App eine Richtung. Instrumente und Stimmung, keine Genrenamen (s. o.).
const STILE = {
  fullrep: {
    titel: 'FullRep Bed',
    stil: ['steady driving drums', 'punchy bass', 'bright synth stabs', 'motivating',
      'forward momentum', 'clean production', 'instrumental'].join(', '),
  },
  swaply: {
    // ⚠ Swaply begleitet Menschen beim Ablegen einer Gewohnheit. Ein
    // antreibender Teppich waere hier falsch: Der Ton soll tragen, nicht
    // anfeuern.
    titel: 'Swaply Bed',
    stil: ['warm piano', 'soft pads', 'gentle pulse', 'hopeful', 'calm',
      'unhurried', 'spacious', 'instrumental'].join(', '),
  },
};

const w = STILE[APP];
if (!w) {
  console.error(`--app fehlt oder ist unbekannt. Moeglich: ${Object.keys(STILE).join(', ')}`);
  process.exit(1);
}

console.log(`Musikteppich fuer ${APP}`);
console.log(`   Modell ${MODELL}, instrumental, eine Anfrage → zwei Fassungen (~0,06 $)`);
console.log(`   Stil: ${w.stil}`);

if (TROCKEN) {
  console.log('\nTrockenlauf — es wird nichts angefragt.');
  process.exit(0);
}

if (!process.env.KIE_API_KEY) {
  console.error('KIE_API_KEY fehlt — er gehoert in die Umgebungsvariablen, nicht ins Repo.');
  process.exit(1);
}
const KOPF = {
  Authorization: `Bearer ${process.env.KIE_API_KEY}`,
  'Content-Type': 'application/json',
};
const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${BASIS}/generate`, {
  method: 'POST',
  headers: KOPF,
  body: JSON.stringify({
    customMode: true,
    // ⚠ Ohne Gesang. Ein Teppich mit Stimme kaempft mit dem Text auf den
    // Folien um dieselbe Aufmerksamkeit.
    instrumental: true,
    model: MODELL,
    style: w.stil,
    title: w.titel,
    callBackUrl: 'https://wellapps-freigabe.vercel.app/',
  }),
});
const d = await res.json().catch(() => ({}));
if (!res.ok || d.code !== 200 || !d?.data?.taskId) {
  throw new Error(`Start fehlgeschlagen (${res.status}): ${JSON.stringify(d).slice(0, 300)}`);
}
const taskId = d.data.taskId;
console.log(`\n   Aufgabe ${taskId}`);

let stuecke = [];
for (let versuch = 0; versuch < 60; versuch += 1) {
  await schlafen(10_000);
  const a = await fetch(`${BASIS}/generate/record-info?taskId=${taskId}`, { headers: KOPF });
  const j = await a.json().catch(() => ({}));
  const status = j?.data?.status ?? '';
  if (/FAILED|ERROR|SENSITIVE/i.test(status)) {
    throw new Error(`${taskId}: ${status} — ${JSON.stringify(j?.data?.errorMessage ?? j).slice(0, 300)}`);
  }
  const fertig = (j?.data?.response?.sunoData ?? j?.data?.response?.data ?? [])
    .filter((s) => s?.audioUrl || s?.audio_url);
  if (status === 'SUCCESS' && fertig.length) { stuecke = fertig; break; }
  process.stdout.write(`\r   ${status || 'PENDING'} (${(versuch + 1) * 10} s)   `);
}
if (!stuecke.length) throw new Error(`${taskId}: kein Ergebnis nach 10 Minuten.`);

mkdirSync(AUS, { recursive: true });
console.log(`\n`);
for (const [i, s] of stuecke.entries()) {
  const url = s.audioUrl ?? s.audio_url;
  const ziel = join(AUS, `${APP}-bett-${i + 1}.mp3`);
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(ziel, bytes);
  console.log(`✓ ${ziel}  (${(bytes.length / 1024 / 1024).toFixed(1)} MB, ${s.duration ?? '?'} s)`);
}
console.log('\nAnhoeren, eine auswaehlen, dann nach tools/social/musik/ legen');
console.log('und in MUSIK (folien-video.mjs) eintragen.');
