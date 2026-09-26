// FullRep „Übung in Bewegung": Der Clip muss die Übung so zeigen, wie sie heißt.
//
//   node tools/social/test-uebung-haltung.mjs
//
// --- Wofuer (26.09.2026) -----------------------------------------------------
//
// „Schulterdrücken sitzend (KH)" lief auf Instagram und Facebook mit einer
// STEHENDEN Puppe. Die Zuordnung kam aus der App (mypeak/src/data/
// exerciseAnimations.js), wo sich die sitzende Übung den Fotoordner mit der
// stehenden teilte. Dort ist sie korrigiert; `ausfuehrungPasst` ist die
// zweite Linie im Reel-Generator.
//
// Geprueft wird die ECHTE Funktion, dazu — wenn das FullRep-Repo daneben liegt
// — die echte Zuordnung der App.

import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ausfuehrungPasst, animierteUebungen } from './reels-fremd/fullrep-uebung-bewegt.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) { gut += 1; console.log(`  ✓ ${name}`); } else { schlecht.push(`${name} — ${gemessen}`); console.log(`  ✗ ${name}\n      ${gemessen}`); }
};

console.log('\n1. Die Regel');
pruefe('⚠ sitzende Übung + stehender Clip → abgewiesen (der Fall vom 26.09.)',
  !ausfuehrungPasst({ id: 'dumbbell-shoulder-press-seated', name: 'Schulterdrücken sitzend (KH)', ordner: 'Dumbbell_Shoulder_Press' }),
  'ging durch');
pruefe('nur der deutsche Name sagt „sitzend" → abgewiesen',
  !ausfuehrungPasst({ id: 'shoulder-press-x', name: 'Schulterdrücken sitzend', ordner: 'Dumbbell_Shoulder_Press' }),
  'ging durch');
pruefe('sitzend + Seated-Clip → erlaubt',
  ausfuehrungPasst({ id: 'seated-leg-curl', name: 'Beinbeuger sitzend', ordner: 'Seated_Leg_Curl' }), 'abgewiesen');
pruefe('liegend + Lying-Clip → erlaubt',
  ausfuehrungPasst({ id: 'lying-leg-curl', name: 'Beinbeuger liegend', ordner: 'Lying_Leg_Curls' }), 'abgewiesen');
pruefe('liegend + Seated-Clip → abgewiesen',
  !ausfuehrungPasst({ id: 'lying-leg-curl', name: 'Beinbeuger liegend', ordner: 'Seated_Leg_Curl' }), 'ging durch');
pruefe('ohne Haltungsangabe → erlaubt',
  ausfuehrungPasst({ id: 'goblet-squat', name: 'Goblet Squat', ordner: 'Goblet_Squat' }), 'abgewiesen');

// --- 2. Die echte Zuordnung der App -----------------------------------------
const HIER = dirname(fileURLToPath(import.meta.url));
const APP = resolve(process.env.FULLREP_PFAD || join(HIER, '..', '..', '..', 'mypeak'));
if (existsSync(join(APP, 'src', 'data', 'exerciseAnimations.js'))) {
  console.log(`\n2. Die Zuordnung in ${APP}`);
  const liste = await animierteUebungen(APP, 'de');
  const ids = new Set(liste.map((u) => u.id));
  const falsch = ['dumbbell-shoulder-press-seated', 'reverse-flyes', 'reverse-lunges', 'jump-squats',
    'chest-squeeze-press', 'stiff-leg-deadlift', 'step-ups'];
  pruefe('keine der sieben am 26.09. als falsch befundenen Übungen im Topf',
    falsch.every((id) => !ids.has(id)), falsch.filter((id) => ids.has(id)).join(', '));
  pruefe('jede Übung im Topf besteht die Haltungsprobe',
    liste.every((u) => ausfuehrungPasst(u)), liste.filter((u) => !ausfuehrungPasst(u)).map((u) => u.id).join(', '));
  pruefe('der Topf ist nicht leer', liste.length >= 10, String(liste.length));
} else {
  console.log(`\n2. (übersprungen — FullRep-Repo nicht unter ${APP})`);
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Kein Übungsreel zeigt eine andere Haltung, als die Übung heißt.');
