#!/usr/bin/env node
// Fertige Videos (Spots, „Studie erklärt“) in die Freigabe-App und ins TikTok-Postfach.
//
//   node tools/social/spot-einreichen.mjs                 # Trockenlauf: Texte bauen, Regeln prüfen
//   node tools/social/spot-einreichen.mjs --echt          # hochladen, Merkliste ergänzen
//   node tools/social/spot-einreichen.mjs --echt --tiktok # zusätzlich ins TikTok-Postfach
//   node tools/social/spot-einreichen.mjs --echt --meta   # Instagram + Facebook vormerken (Knopf in der Freigabe-App)
//   NUR=a.mp4,b.mp4 node tools/social/spot-einreichen.mjs …  # nur diese Videos
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
import { hochladen, merklistenLesen, merklisteAblegen, sperreLoesen } from './veroeffentlichen/blob.mjs';
import { frischerToken, inPosteingang, kontoAuskunft } from './veroeffentlichen/tiktok.mjs';
import { zugaenge } from './veroeffentlichen/geheimnisse.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..', '..');
const APPS = JSON.parse(readFileSync(join(HIER, 'apps.json'), 'utf8'));
const ECHT = process.argv.includes('--echt');
const TIKTOK = process.argv.includes('--tiktok');
const META = process.argv.includes('--meta');   // Instagram + Facebook in der Freigabe-App vormerken
// --zuruecksetzen (nur mit --meta): Instagram/Facebook wieder auf „wartet“, AUCH wenn sie schon
// veroeffentlicht waren, und die harten Sperren loesen. Nur fuer den Fall, dass Josef die alten
// Beitraege von Hand geloescht hat (07.10.2026, Steinregen DE mit unverstaendlichem Ton).
const ZURUECK = process.argv.includes('--zuruecksetzen');
const NEU = process.argv.includes('--neu');     // Video neu hochladen, auch wenn es heute schon im Speicher liegt (geänderte Fassung)
const DATUM = process.env.DATUM || new Date().toISOString().slice(0, 10);
// NUR=<datei,datei>: nur diese Videos (Dateinamen) — sonst ginge bei jedem Lauf die ganze Liste
// noch einmal in die TikTok-Postfaecher, als doppelte Entwuerfe.
const NUR = (process.env.NUR ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const LISTE = JSON.parse(readFileSync(join(HIER, 'spots', 'einreichen.json'), 'utf8'))
  .filter((e) => !NUR.length || NUR.includes(basename(e.video)));
if (!LISTE.length) throw new Error(`Nichts zu tun — NUR=${NUR.join(',')} passt auf keinen Eintrag.`);

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
let tiktokGesperrt = false;   // ob irgendein Konto gesperrt hat (nur fuer die Schlussmeldung)
const zusammenfassung = [];
for (const appSchluessel of [...new Set(posten.map((p) => p.app))]) {
  const z = zugaenge(appSchluessel);
  if (!z.blobToken) throw new Error('BLOB_TOKEN fehlt.');
  const meine = posten.filter((p) => p.app === appSchluessel);
  // ⚠ Das Limit offener Entwuerfe gilt JE KONTO (07.10.2026 gemessen: Mahjong meldete
  // spam_risk_too_many_pending_share, Anigosha nahm Minuten spaeter an). Also nur
  // dieses Konto anhalten, nicht alle.
  let kontoGesperrt = false;
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

  // ⚠ ERGÄNZEN, nicht ersetzen — dieselbe Lehre wie in posten.mjs (09.09./20.09.2026).
  // Zuerst lesen: Liegt ein Video heute schon im Speicher, wird es nicht noch
  // einmal hochgeladen, und sein TikTok-Stand bleibt erhalten.
  let alt = null;
  try { alt = (await merklistenLesen({ datum: DATUM, token: z.blobToken })).find((l) => l.app === appSchluessel) ?? null; }
  catch (err) { console.log(`   ⚠ Alte Merkliste nicht lesbar (${err.message}) — wird neu angelegt.`); }

  const neu = [];
  const ig = [];
  for (const p of meine) {
    const vorher = (alt?.uebersicht ?? []).find((s) => s.datei === p.datei) ?? null;
    const { url, pfad } = vorher?.url && !NEU
      ? { url: vorher.url, pfad: vorher.blobPfad ?? null }
      : await hochladen({ datei: p.video, token: z.blobToken, praefix: `social/${DATUM}` });
    const spur = { datei: p.datei, text: p.text, istVideo: true, url, blobPfad: pfad,
      kanaele: { ...(vorher?.kanaele ?? {}) } };
    const wege = [];
    if (TIKTOK && token && !kontoGesperrt) {
      try {
        const r = await inPosteingang({ token, datei: p.video });
        spur.kanaele.tiktok = { stand: 'posteingang', publishId: r.publishId, wann: new Date().toISOString() };
        wege.push(`TikTok-Postfach (${r.mb} MB)`);
      } catch (err) {
        spur.kanaele.tiktok = { stand: 'fehler', meldung: err.message };
        wege.push(`TikTok ✗ ${err.message}`);
        // ⚠ Kein weiterer Versuch fuer DIESES Konto — erst muss Josef dort Entwuerfe abarbeiten.
        if (/spam_risk|too many|pending/i.test(err.message)) { kontoGesperrt = true; tiktokGesperrt = true; }
      }
    } else if (TIKTOK && !spur.kanaele.tiktok) {
      spur.kanaele.tiktok = { stand: 'wartet' };
    }
    // Instagram und Facebook: nur VORMERKEN. Veröffentlicht wird erst über den
    // Knopf auf der Freigabe-Seite — derselbe Weg wie in posten.mjs.
    if (META) {
      for (const k of ['instagram', 'facebook']) {
        if (ZURUECK) await sperreLoesen({ datum: DATUM, kanal: k, datei: p.datei, token: z.blobToken });
        if (ZURUECK || spur.kanaele[k]?.stand !== 'veroeffentlicht') spur.kanaele[k] = { stand: 'wartet' };
      }
      if (spur.kanaele.instagram.stand === 'wartet') ig.push({ datei: p.datei, url, blobPfad: pfad, text: p.text, istVideo: true });
      wege.push('Instagram + Facebook vorgemerkt');
    }
    console.log(`   ✓ ${appSchluessel} · ${p.datei} → Freigabe-App${wege.length ? ' · ' + wege.join(' · ') : ''}`);
    neu.push(spur);
    zusammenfassung.push({ app: appSchluessel, datei: p.datei, text: p.text, tiktok: spur.kanaele.tiktok?.stand ?? '—' });
  }

  const neueNamen = new Set(neu.map((s) => s.datei));
  const igNamen = new Set(ig.map((e) => e.datei));
  const r = await merklisteAblegen({
    datum: DATUM, appSchluessel, name: APPS[appSchluessel].name,
    eintraege: [...(alt?.eintraege ?? []).filter((e) => !igNamen.has(e.datei)), ...ig],
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
