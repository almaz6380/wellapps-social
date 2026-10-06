#!/usr/bin/env node
// Fertige Videos (Spots, „Studie erklärt“) in die Freigabe-App und ins TikTok-Postfach.
//
//   node tools/social/spot-einreichen.mjs                 # Trockenlauf: Texte bauen, Regeln prüfen
//   node tools/social/spot-einreichen.mjs --echt          # hochladen, Merkliste ergänzen
//   node tools/social/spot-einreichen.mjs --echt --tiktok # zusätzlich ins TikTok-Postfach
//
// Liste: tools/social/spots/einreichen.json → [{ app, video, sprache }], Pfade relativ zum Repo.
// Neben jedem Video liegt <video>.txt (Beiblatt): „── CAPTION ZUM KOPIEREN ──“, Hashtag-Zeile,
// „── VOR DEM POSTEN ──“ mit „- Medienherkunft:“ und „- Tonquelle:“.
//
// ⚠ Warum nicht posten.mjs: Das kennt nur Videos, die der Tageslauf selbst rendert
// (out/social/<datum>/, Ledger-Zeile, Seed). Ein fertiger Spot hat nichts davon.
// Die Bausteine sind aber dieselben — Text, Leitplanken, Speicher, TikTok —, nur
// die Quelle ist eine andere.
//
// ⚠ Nur auf Josefs ausdrücklichen Wunsch auslösen (CLAUDE.md, seit 28.09.2026).
// TikTok bekommt das Video nur in den POSTEINGANG, nie direkt veröffentlicht: Den
// Text, die Privatsphäre und das KI-Label setzt Josef dort von Hand.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beschreibungBauen, hashtagsFuer, linkZeile } from './beschreibung.mjs';
import { pruefe, berichte, captionAus, riechtNachBeiblatt } from './vorflug.mjs';
import { hochladen, merklistenLesen, merklisteAblegen } from './veroeffentlichen/blob.mjs';
import { frischerToken, inPosteingang, kontoAuskunft } from './veroeffentlichen/tiktok.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const APPS = JSON.parse(readFileSync(join(HIER, 'apps.json'), 'utf8'));
const ECHT = process.argv.includes('--echt');
const TIKTOK = process.argv.includes('--tiktok');
const DATUM = process.env.DATUM || new Date().toISOString().slice(0, 10);
const LISTE = JSON.parse(readFileSync(join(HIER, 'spots', 'einreichen.json'), 'utf8'));

const zeile = (beiblatt, schluessel) =>
  beiblatt.match(new RegExp(`^- ${schluessel}: (.+)$`, 'm'))?.[1]?.trim() ?? null;

// --- 1. Texte bauen und prüfen (läuft auch ohne Zugänge) ---------------------
const posten = [];
let durchgefallen = 0;
for (const e of LISTE) {
  const app = APPS[e.app];
  const video = join(WURZEL, e.video);
  const blattPfad = video.replace(/\.mp4$/, '.txt');
  if (!app) throw new Error(`Unbekannte App ${e.app}`);
  if (!existsSync(video) || !existsSync(blattPfad)) throw new Error(`Fehlt: ${e.video} oder sein Beiblatt`);
  const beiblatt = readFileSync(blattPfad, 'utf8');
  const text = beschreibungBauen({ app, beiblatt, sprache: e.sprache });
  const pruefung = pruefe({
    appSchluessel: e.app, app,
    post: { sprache: e.sprache, medium: 'reel', format: 'spot' },
    texte: {
      caption: captionAus(beiblatt),
      hashtags: hashtagsFuer(beiblatt).map((t) => `#${t}`).join(' '),
      applink: linkZeile(app, e.sprache, beiblatt),
      medienherkunft: zeile(beiblatt, 'Medienherkunft'),
      tonquelle: zeile(beiblatt, 'Tonquelle'),
      wasserzeichen: /Wasserzeichen gesetzt/.test(beiblatt),
    },
  });
  const datei = basename(video);
  if (!text || riechtNachBeiblatt(text) || !pruefung.bestanden) {
    durchgefallen++;
    console.log(`✗ ${e.app} · ${datei}`);
    console.log(berichte(pruefung, datei));
    if (!text) console.log('   leerer Text — fehlt „── CAPTION ZUM KOPIEREN ──“?');
    continue;
  }
  console.log(`✓ ${e.app} · ${datei}\n${text.replace(/^/gm, '   │ ')}\n`);
  posten.push({ ...e, app: e.app, video, datei, text });
}
if (durchgefallen) {
  console.error(`✗ ${durchgefallen} Beitrag/Beiträge verletzen eine Leitplanke — nichts wird hochgeladen.`);
  process.exit(1);
}
if (!ECHT) {
  console.log(`Trockenlauf: ${posten.length} Beiträge geprüft. Mit --echt wird hochgeladen.`);
  process.exit(0);
}

// --- 2. Hochladen, TikTok-Postfach, Merkliste je App ergänzen ----------------
let tiktokGesperrt = false;
const zusammenfassung = [];
for (const appSchluessel of [...new Set(posten.map((p) => p.app))]) {
  const z = zugaenge(appSchluessel);
  if (!z.blobToken) throw new Error('BLOB_TOKEN fehlt.');
  const meine = posten.filter((p) => p.app === appSchluessel);
  let token = null;
  let kopf = null;
  if (TIKTOK) {
    try {
      const t = await frischerToken({ clientKey: z.tiktokKey, clientSecret: z.tiktokSecret, refreshToken: z.tiktokRefresh });
      token = t.token;
      // Wert bewusst nicht ausgeben — wie in posten.mjs.
      if (t.neuerRefresh) console.log(`   ⚠ TikTok hat den Refresh-Token fuer ${appSchluessel} AUSGETAUSCHT — Secret TIKTOK_REFRESH_TOKEN_${appSchluessel.toUpperCase()} nachtragen.`);
    } catch (err) { console.log(`   ⚠ TikTok-Token ${appSchluessel}: ${err.message}`); }
  }
  if (token) {
    try {
      const a = await kontoAuskunft({ token });
      kopf = { nickname: a.creator_nickname, username: a.creator_username, avatar: a.creator_avatar_url,
        privacyOptionen: a.privacy_level_options ?? [], maxSekunden: a.max_video_post_duration_sec,
        stand: new Date().toISOString() };
    } catch (err) { console.log(`   ⚠ TikTok-Kontoauskunft ${appSchluessel}: ${err.message}`); }
  }

  const neu = [];
  for (const p of meine) {
    const { url, pfad } = await hochladen({ datei: p.video, token: z.blobToken, praefix: `social/${DATUM}` });
    const spur = { datei: p.datei, text: p.text, istVideo: true, url, blobPfad: pfad, kanaele: {} };
    if (TIKTOK && token && !tiktokGesperrt) {
      try {
        const r = await inPosteingang({ token, datei: p.video });
        spur.kanaele.tiktok = { stand: 'posteingang', publishId: r.publishId, wann: new Date().toISOString() };
        console.log(`   ✓ ${appSchluessel} · ${p.datei} → Freigabe-App + TikTok-Postfach (${r.mb} MB)`);
      } catch (err) {
        spur.kanaele.tiktok = { stand: 'fehler', meldung: err.message };
        console.log(`   ✗ ${appSchluessel} · ${p.datei} → TikTok: ${err.message}`);
        // ⚠ Kein weiterer Versuch: Das Limit zählt vermutlich über alle fünf Konten.
        if (/spam_risk|too many|pending/i.test(err.message)) tiktokGesperrt = true;
      }
    } else {
      if (TIKTOK) spur.kanaele.tiktok = { stand: 'wartet' };
      console.log(`   ✓ ${appSchluessel} · ${p.datei} → Freigabe-App${TIKTOK ? ' (TikTok übersprungen)' : ''}`);
    }
    neu.push(spur);
    zusammenfassung.push({ app: appSchluessel, datei: p.datei, text: p.text, tiktok: spur.kanaele.tiktok?.stand ?? '—' });
  }

  // ⚠ ERGÄNZEN, nicht ersetzen — dieselbe Lehre wie in posten.mjs (09.09./20.09.2026).
  let alt = null;
  try { alt = (await merklistenLesen({ datum: DATUM, token: z.blobToken })).find((l) => l.app === appSchluessel) ?? null; }
  catch (err) { console.log(`   ⚠ Alte Merkliste nicht lesbar (${err.message}) — wird neu angelegt.`); }
  const neueNamen = new Set(neu.map((s) => s.datei));
  const r = await merklisteAblegen({
    datum: DATUM, appSchluessel, name: APPS[appSchluessel].name,
    eintraege: alt?.eintraege ?? [],
    uebersicht: [...(alt?.uebersicht ?? []).filter((s) => !neueNamen.has(s.datei)), ...neu],
    tiktok: kopf ?? alt?.tiktok ?? null,
    token: z.blobToken,
  });
  console.log(`   Merkliste ${appSchluessel}: +${neu.length} → ${r.pfad}`);
}

// Die Texte zum Kopieren in die Zusammenfassung des Laufs — der TikTok-Posteingang nimmt keinen Text an.
if (process.env.GITHUB_STEP_SUMMARY) {
  let md = `## Spots eingereicht (${DATUM})\n\n`;
  for (const s of zusammenfassung) md += `### ${s.app} · ${s.datei} · TikTok: ${s.tiktok}\n\n\`\`\`\n${s.text}\n\`\`\`\n\n`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
console.log(`\n✓ ${zusammenfassung.length} Beiträge abgelegt${tiktokGesperrt ? ' — TikTok hat ab einem Punkt gesperrt (Limit offener Entwürfe)' : ''}.`);
