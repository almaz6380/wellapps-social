// Swaply-Einblendung (Josef, 26.09.2026: „swaply bild von rauchendem mann einblenden",
// Variante „Mann mit Zigarette, die er zerbricht"). flux-pro/kontext, 0,04 $ je Bild.
// Vorlage ist der Begleiter der Bildkarten (swaply/marketing/social/figuren/begleiter.png).
import { readFileSync, writeFileSync } from 'node:fs';
const H = { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' };
const vorlage = `data:image/jpeg;base64,${readFileSync(process.argv[2]).toString('base64')}`;
const PROMPT = 'Keep exactly the same man, face, hair, clothes and the same flat cartoon illustration style with clean outlines. '
  + 'Show him from the waist up, holding one unlit cigarette in both hands in front of his chest and snapping it in half, '
  + 'the two halves clearly breaking apart, a relieved, confident smile. '
  + 'Replace the background with a smooth vertical gradient from soft blue at the top to fresh teal-green at the bottom. '
  + 'No smoke, no lighter, no fire, no ashtray, he is not smoking. No text, no letters, no logos.';
async function fal(eingabe) {
  const j = await (await fetch('https://queue.fal.run/fal-ai/flux-pro/kontext', { method: 'POST', headers: H, body: JSON.stringify(eingabe) })).json();
  if (!j.status_url) throw new Error(JSON.stringify(j).slice(0, 300));
  for (;;) {
    await new Promise((x) => setTimeout(x, 2000));
    const s = await (await fetch(j.status_url, { headers: H })).json();
    if (s.status === 'COMPLETED') break;
    if (!['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error(JSON.stringify(s));
  }
  return (await fetch(j.response_url, { headers: H })).json();
}
for (const seed of [9101, 9102]) {
  const o = await fal({ prompt: PROMPT, image_url: vorlage, aspect_ratio: '9:16', seed, output_format: 'jpeg', safety_tolerance: '2', guidance_scale: 3.5 });
  const url = o.images?.[0]?.url; if (!url) { console.log('✗', seed, JSON.stringify(o).slice(0, 300)); continue; }
  writeFileSync(`zigarette-${seed}.jpg`, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`✓ zigarette-${seed}.jpg`);
}
