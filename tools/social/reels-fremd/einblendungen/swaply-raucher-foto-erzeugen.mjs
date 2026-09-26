// Swaply-Nikotin-Einblendungen als FOTO statt Comic (Josef, 26.09.2026 abends:
// „ich wollte eine echte person sehen und keine comicfigur").
//
//   FAL_KEY=… node swaply-raucher-foto-erzeugen.mjs raucher          → foto-raucher-<seed>.jpg
//   FAL_KEY=… node swaply-raucher-foto-erzeugen.mjs ende <foto.jpg>  → foto-ende-<seed>.jpg
//
// Schritt 1: flux-pro/v1.1-ultra, `raw: true` (weniger Hochglanz, eher
// Handyfoto), ~0,06 $ je Bild. Schritt 2: flux-pro/kontext auf das gewaehlte
// Foto — derselbe Mann, dieselbe Kleidung —, 0,04 $ je Bild.
//
// ⚠ Fotorealistischer KI-Mensch → im Reel MIT AI-Plaettchen
// (EINBLENDUNG_REALISTISCH in make-reel.mjs).
import { readFileSync, writeFileSync } from 'node:fs';

const H = { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' };
const [was, vorlagePfad] = process.argv.slice(2);

// ⚠ Erste Runde (Seeds 9301/9302) verworfen: Zigarette steckte im Mund, ein
// Finger drueckte dagegen, bei 9302 zeigte der Filter nach aussen. Deshalb
// jetzt ausdruecklich: zwischen den Fingern, vom Mund WEG, Rauch ausatmend.
const RAUCHER = 'Candid smartphone photo, vertical. A man around 30 with short dark brown tousled hair and light stubble, '
  + 'wearing a plain dark navy crewneck sweater, stands on a city balcony in soft overcast daylight, seen slightly from the side. '
  + 'His right hand is raised beside his face, holding a lit cigarette loosely between index and middle finger, '
  + 'the cigarette pointing away from his face, the glowing ember at the far end, the filter towards his fingers. '
  + 'He has just taken a drag and exhales a soft cloud of smoke to the side, eyes lowered, a tense, craving expression. '
  + 'Natural skin texture, anatomically correct relaxed hand with five fingers. '
  + 'Shallow depth of field, muted blue-green tones in the blurred background. Waist-up framing. '
  + 'No text, no logos, no cigarette pack.';

const ENDE = 'Keep exactly the same man, face, hair, stubble, navy sweater, balcony and the same natural photographic look. '
  + 'Now he holds an unlit cigarette in both hands in front of his chest and snaps it in half, tobacco crumbs falling. '
  + 'His expression is calm and determined, a slight relieved smile. No smoke anywhere. '
  + 'Realistic hands with five fingers each. No text, no logos.';

async function fal(modell, eingabe) {
  const j = await (await fetch(`https://queue.fal.run/${modell}`, { method: 'POST', headers: H, body: JSON.stringify(eingabe) })).json();
  if (!j.status_url) throw new Error(JSON.stringify(j).slice(0, 300));
  for (;;) {
    await new Promise((x) => setTimeout(x, 2000));
    const s = await (await fetch(j.status_url, { headers: H })).json();
    if (s.status === 'COMPLETED') break;
    if (!['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error(JSON.stringify(s));
  }
  return (await fetch(j.response_url, { headers: H })).json();
}

async function sichern(o, name) {
  const url = o.images?.[0]?.url;
  if (!url) { console.log('✗', name, JSON.stringify(o).slice(0, 300)); return; }
  writeFileSync(name, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`✓ ${name}`);
}

if (was === 'raucher') {
  for (const seed of [9303, 9304]) {
    const o = await fal('fal-ai/flux-pro/v1.1-ultra', {
      prompt: RAUCHER, aspect_ratio: '9:16', raw: true, seed, output_format: 'jpeg', safety_tolerance: '2',
    });
    await sichern(o, `foto-raucher-${seed}.jpg`);
  }
} else if (was === 'ende' && vorlagePfad) {
  const vorlage = `data:image/jpeg;base64,${readFileSync(vorlagePfad).toString('base64')}`;
  for (const seed of [9401, 9402]) {
    const o = await fal('fal-ai/flux-pro/kontext', {
      prompt: ENDE, image_url: vorlage, aspect_ratio: '9:16', seed, output_format: 'jpeg',
      safety_tolerance: '2', guidance_scale: 3.5,
    });
    await sichern(o, `foto-ende-${seed}.jpg`);
  }
} else {
  console.error('Aufruf: raucher | ende <foto.jpg>');
  process.exit(1);
}
