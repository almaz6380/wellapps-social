// Unveroeffentlichte Facebook-Beitraege einer Seite auflisten und loeschen.
//
//   MODUS=zeigen   APPS=anigosha node tools/social/fb-entwuerfe.mjs
//   MODUS=loeschen IDS=123,456   node tools/social/fb-entwuerfe.mjs
//
// --- ⚠ Warum es dieses Werkzeug gibt ----------------------------------------
//
// Am 05.09.2026 trugen zwei Entwuerfe den falschen Text und mussten weg. In
// der Meta Business Suite waren sie nicht zu finden: Der Reiter „Entwuerfe"
// zeigt nur, was IM Composer der Business Suite angefangen wurde. Was ueber
// die API mit `published=false` entsteht, ist fuer Meta ein
// „unveroeffentlichter Seitenbeitrag" und taucht anderswo auf — je nach
// Ansicht unter „Anzeigenbeitraege" oder gar nicht.
//
// Eine halbe Stunde Suchen in einer Oberflaeche, die etwas anderes meint als
// man selbst, ist teurer als dieses Skript. Es fragt die Seite direkt und
// findet damit genau das, was unsere Automatik angelegt hat.
//
// ⚠ LOESCHEN IST ENDGUELTIG und geht nur ueber ausdrueckliche IDs — nie „alle
// auf einmal". Wer sich vertippt, loescht sonst einen Beitrag, den jemand
// bewusst vorbereitet hat.

import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const GRAPH = 'https://graph.facebook.com/v21.0';

const MODUS = (process.env.MODUS || 'zeigen').trim();
const APPS = (process.env.APPS || 'anigosha').split(',').map((s) => s.trim()).filter(Boolean);
const IDS = (process.env.IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!['zeigen', 'loeschen'].includes(MODUS)) {
  console.error(`Unbekannter Modus „${MODUS}" — erlaubt sind zeigen und loeschen.`);
  process.exit(1);
}

if (MODUS === 'loeschen' && !IDS.length) {
  console.error('Zum Loeschen fehlen die IDS (kommagetrennt).');
  console.error('Erst MODUS=zeigen laufen lassen, dann die gewuenschten IDs uebernehmen.');
  process.exit(1);
}

async function holen(url) {
  const antwort = await fetch(url);
  const daten = await antwort.json();
  if (!antwort.ok) {
    throw new Error(`${antwort.status}: ${daten.error?.message ?? JSON.stringify(daten)}`);
  }
  return daten;
}

if (MODUS === 'zeigen') {
  for (const app of APPS) {
    const z = zugaenge(app);
    console.log(`━━ ${app} · Seite ${z.fbSeitenId}`);

    // ⚠ Zwei Wege, weil Meta sie verschieden beantwortet:
    //   promotable_posts  enthaelt auch unveroeffentlichte Beitraege
    //   feed              nur veroeffentlichte
    // Der erste ist der richtige; der zweite steht daneben, um den
    // Unterschied sichtbar zu machen statt ihn zu vermuten.
    for (const [name, pfad] of [
      ['unveroeffentlicht (promotable_posts)',
        `promotable_posts?is_published=false&fields=id,message,created_time,is_published&limit=25`],
      ['veroeffentlicht (feed)',
        `feed?fields=id,message,created_time&limit=5`],
    ]) {
      try {
        const d = await holen(
          `${GRAPH}/${z.fbSeitenId}/${pfad}&access_token=${encodeURIComponent(z.fbToken)}`,
        );
        const posten = d.data ?? [];
        console.log(`   ${name}: ${posten.length}`);
        for (const p of posten) {
          const kurz = (p.message ?? '(ohne Text)').replace(/\s+/g, ' ').slice(0, 70);
          console.log(`     ${p.id}  ${p.created_time ?? ''}`);
          console.log(`       ${kurz}${(p.message ?? '').length > 70 ? '…' : ''}`);
        }
      } catch (e) {
        console.log(`   ${name}: ✗ ${e.message}`);
      }
    }
    console.log();
  }
  console.log('Zum Loeschen: MODUS=loeschen und IDS=<id>,<id> setzen.');
} else {
  // Zum Loeschen genuegt EIN Token, aber es muss zur Seite des Beitrags
  // gehoeren — deshalb je App durchprobieren und beim ersten Erfolg aufhoeren.
  let weg = 0, fehler = 0;
  for (const id of IDS) {
    let geschafft = false;
    for (const app of APPS) {
      const z = zugaenge(app);
      try {
        const antwort = await fetch(
          `${GRAPH}/${id}?access_token=${encodeURIComponent(z.fbToken)}`, { method: 'DELETE' },
        );
        const daten = await antwort.json();
        if (antwort.ok && daten.success !== false) {
          console.log(`✓ ${id} geloescht (${app})`);
          geschafft = true;
          weg += 1;
          break;
        }
        console.log(`   ${id} über ${app}: ${daten.error?.message ?? antwort.status}`);
      } catch (e) {
        console.log(`   ${id} über ${app}: ${e.message}`);
      }
    }
    if (!geschafft) fehler += 1;
  }
  console.log(`\n${weg} geloescht, ${fehler} nicht.`);
  if (fehler) process.exit(1);
}
