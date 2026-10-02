// TikTok-Fotobeitrag EINMAL anstossen und TikToks Antwort samt Log-ID ausgeben —
// ohne Diashow-Rueckfall.
//
//   APP=anigosha BILD_URL=https://… TIKTOK_CLIENT_KEY=… TIKTOK_CLIENT_SECRET=… \
//   TIKTOK_REFRESH_TOKEN_ANIGOSHA=… node tools/social/tiktok-foto-diagnose.mjs
//
// --- Warum (02.10.2026) ------------------------------------------------------
//
// Seit dem Umzug auf freigabe.almaz6380.workers.dev antwortet TikTok auf jeden
// Fotobeitrag mit 403 url_ownership_unverified, obwohl der Prefix im Portal als
// verifiziert steht (am 02.10. frisch neu verifiziert). Der TikTok-Support will
// dafuer die Log-ID (`x-tt-logid` im Antwortkopf). Der Tageslauf gibt sie nicht
// aus und faellt auf eine Diashow zurueck — dieses Skript tut beides nicht:
// Lehnt TikTok ab, landet nichts im Posteingang.
//
// ⚠ Nimmt TikTok an, liegt der Beitrag als Foto-Entwurf im Posteingang.

import { frischerToken } from './veroeffentlichen/tiktok.mjs';

const APP = (process.env.APP || '').trim().toLowerCase();
const BILD_URL = (process.env.BILD_URL || '').trim();
if (!APP || !/^https:\/\//.test(BILD_URL)) {
  console.error('APP und BILD_URL (https://…) sind Pflicht.');
  process.exit(1);
}

const { token } = await frischerToken({
  clientKey: process.env.TIKTOK_CLIENT_KEY,
  clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  refreshToken: process.env[`TIKTOK_REFRESH_TOKEN_${APP.toUpperCase()}`],
});

// Erreichbarkeit aus Sicht eines fremden Rechners, wie TikTok sie sieht.
const kopf = await fetch(BILD_URL, { method: 'HEAD', redirect: 'manual' });
console.log(`Bild: HTTP ${kopf.status} · ${kopf.headers.get('content-type')} · ${kopf.headers.get('content-length')} Byte`);

const antwort = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
  body: JSON.stringify({
    media_type: 'PHOTO',
    post_mode: 'MEDIA_UPLOAD',
    post_info: { title: 'Test', description: 'Test' },
    source_info: { source: 'PULL_FROM_URL', photo_images: [BILD_URL], photo_cover_index: 0 },
  }),
});
const text = await antwort.text();
console.log(`\nTikTok: HTTP ${antwort.status}`);
console.log(`x-tt-logid: ${antwort.headers.get('x-tt-logid') ?? '(fehlt)'}`);
console.log(`Antwort: ${text.slice(0, 600)}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### TikTok-Foto-Diagnose (${APP})\n\n- HTTP ${antwort.status}\n- x-tt-logid: \`${antwort.headers.get('x-tt-logid') ?? '(fehlt)'}\`\n- Antwort: \`${text.slice(0, 300)}\`\n`);
}
