// TikTok-Zugang je Konto holen — der Anmelde-Ablauf in zwei Schritten.
//
//   SCHRITT=link  CLIENT_KEY=… node tools/social/tiktok-zugang.mjs
//   SCHRITT=tausch CLIENT_KEY=… CODE=… ZIEL=… node tools/social/tiktok-zugang.mjs
//
// Gedacht fuer den Workflow „TikTok-Zugang holen".
//
// --- ⚠ Warum der Token hier NICHT mehr ausgegeben wird -----------------------
//
// Bis zum 16.09.2026 druckte dieses Skript den Refresh-Token im Klartext, mit
// dem Hinweis, danach die Protokolle zu loeschen. Das war schon im privaten
// Repo unschoen und in diesem hier — es ist oeffentlich — schlicht untragbar:
// Jeder haette mitlesen koennen, bis jemand die Logs entfernt.
//
// ⚠ GitHubs Secret-Maskierung haette daran NICHTS geaendert: Der Wert kommt
// frisch von TikTok und ist in dem Moment noch kein Secret.
//
// Deshalb schreibt das Skript den Token in eine DATEI (Pfad in `ZIEL`), und
// der Workflow schiebt sie mit `gh secret set … < datei` ins Secret. Der Wert
// beruehrt das Protokoll nie.
//
// --- ⚠ Der Client Key ist KEIN Geheimnis -------------------------------------
//
// Er steht in der Adresse, die der Nutzer im Browser oeffnet — TikTok zeigt
// ihn also ohnehin jedem. Er kommt deshalb als Workflow-Eingabe herein und
// nicht aus den Secrets. Das ist kein Schlamperei-Kompromiss, sondern der
// Grund, warum der `link`-Schritt ueberhaupt eine brauchbare Adresse ausgeben
// kann: Ein Secret waere im Protokoll zu `***` geschwaerzt, und genau das
// machte die Adresse am 16.09. unbrauchbar.
//
// Der Client SECRET bleibt ein Secret — er geht nur in den POST an TikTok.

import { writeFileSync } from 'node:fs';

const KEY = process.env.CLIENT_KEY;
const SECRET = process.env.TIKTOK_CLIENT_SECRET;
const SCHRITT = (process.env.SCHRITT || 'link').trim();
const CODE = (process.env.CODE || '').trim();
const ZIEL = (process.env.ZIEL || '').trim();

// ⚠ Muss ZEICHENGENAU mit der Redirect-URI in der TikTok-App uebereinstimmen —
// inklusive Schraegstrich am Ende. Weicht sie ab, antwortet TikTok mit
// „redirect_uri mismatch", und die Meldung nennt nicht, welche der beiden
// gemeint ist.
const REDIRECT = 'https://anigosha.vercel.app/tiktok-fertig';

// `video.publish` ist Direktversand, `video.upload` der Posteingang. Beide,
// weil die Freigabe-Seite den Direktweg braucht und der Posteingang der
// Rueckfall ist, solange TikToks App-Pruefung nicht durch ist.
// ⚠ `creator_info/query` antwortet OHNE `video.publish` nicht — ohne den Scope
// zeigt die Freigabe-Seite den TikTok-Block gar nicht erst an.
const SCOPE = 'user.info.basic,video.publish,video.upload';

if (!KEY) {
  console.error('CLIENT_KEY fehlt. Er steht in der TikTok-App unter');
  console.error('„App details" → Credentials → Client key und ist nicht geheim.');
  process.exit(1);
}

if (SCHRITT === 'link') {
  // `state` schuetzt gegen untergeschobene Antworten. Hier ist der Ablauf
  // haendisch und einmalig, trotzdem verlangt TikTok das Feld.
  const state = Math.random().toString(36).slice(2, 12);
  const url = 'https://www.tiktok.com/v2/auth/authorize/'
    + `?client_key=${encodeURIComponent(KEY)}`
    + `&scope=${encodeURIComponent(SCOPE)}`
    + '&response_type=code'
    + `&redirect_uri=${encodeURIComponent(REDIRECT)}`
    + `&state=${state}`;

  console.log('\n1. Melde dich in einem FRISCHEN PRIVATEN Fenster bei dem TikTok-Konto');
  console.log('   an, fuer das du den Zugang holen willst. ⚠ Ein normales Fenster');
  console.log('   nimmt das zuletzt angemeldete Konto — dann landet der Zugang');
  console.log('   beim falschen, und das faellt erst beim Posten auf.\n');
  console.log('2. Oeffne dort diese Adresse und bestaetige:\n');
  console.log(url);
  console.log('\n   ⚠ Im Zustimmungsdialog steht der Kontoname. Er ist die einzige');
  console.log('   Kontrolle, die VOR dem Bestaetigen greift — lies ihn.\n');
  console.log('3. TikTok leitet dich auf eine Seite unserer Domain um, die den');
  console.log('   Code mit einem Kopierknopf zeigt.');
  console.log('   ⚠ Der Code gilt ein bis zwei Minuten und genau einmal.\n');
  console.log('4. Denselben Workflow erneut starten, diesmal mit schritt=tausch,');
  console.log('   dem Code im Feld „code" und derselben App.\n');
  process.exit(0);
}

if (SCHRITT !== 'tausch') {
  console.error(`Unbekannter Schritt „${SCHRITT}" — erlaubt sind link und tausch.`);
  process.exit(1);
}

if (!SECRET) {
  console.error('TIKTOK_CLIENT_SECRET fehlt. Steht in der TikTok-App neben dem');
  console.error('Client key — und wird dort nur EINMAL im Klartext gezeigt.');
  process.exit(1);
}
if (!CODE) {
  console.error('CODE fehlt. Erst schritt=link laufen lassen.');
  process.exit(1);
}
if (!ZIEL) {
  console.error('ZIEL fehlt — der Pfad, unter dem der Token abgelegt wird.');
  console.error('Er wird vom Workflow gesetzt; von Hand aufgerufen z. B.');
  console.error('ZIEL=/tmp/token node tools/social/tiktok-zugang.mjs');
  process.exit(1);
}

// TikTok verlangt application/x-www-form-urlencoded, nicht JSON. Mit JSON
// antwortet es mit einem nichtssagenden „invalid_request".
const rumpf = new URLSearchParams({
  client_key: KEY,
  client_secret: SECRET,
  code: decodeURIComponent(CODE),
  grant_type: 'authorization_code',
  redirect_uri: REDIRECT,
});

const antwort = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: rumpf,
});
const d = await antwort.json();

if (d.error || !d.refresh_token) {
  console.error('\n✗ TikTok hat den Tausch abgelehnt.');
  console.error(`   ${d.error ?? 'unbekannt'}: ${d.error_description ?? ''}\n`);
  console.error('Die drei haeufigsten Ursachen:');
  console.error('  • Der Code ist aelter als ein paar Minuten — neu holen.');
  console.error('  • Der Code wurde schon einmal getauscht; er gilt genau einmal.');
  console.error(`  • Die Redirect-URI der App ist nicht exakt ${REDIRECT}`);
  process.exit(1);
}

// ⚠ Ohne abschliessenden Zeilenumbruch: `gh secret set … < datei` nimmt den
// Dateiinhalt buchstaeblich, ein „\n" landete mit im Token.
writeFileSync(ZIEL, d.refresh_token, 'utf8');

console.log('\n✓ Zugang geholt und in die Datei geschrieben.');
console.log(`   Konto (open_id): ${d.open_id ?? 'nicht gemeldet'}`);
console.log(`   Gueltig fuer: ${d.scope ?? SCOPE}`);
console.log(`   Laenge: ${d.refresh_token.length} Zeichen`);
console.log('\nDer Token selbst steht NICHT in diesem Protokoll — der naechste');
console.log('Schritt des Workflows schiebt ihn direkt ins Secret.\n');

// ⚠ Die Gegenprobe, die frueher fehlte: Wer den Scope nicht mitbekommt, merkt
// erst beim Posten, dass `video.publish` nicht dabei ist — und sucht dann in
// der Freigabe-Seite nach einem Fehler, den es dort nicht gibt.
if (d.scope && !String(d.scope).includes('video.publish')) {
  console.log('⚠ ACHTUNG: `video.publish` fehlt in den erteilten Rechten.');
  console.log('  Direct Post und die Kontoauskunft werden damit nicht gehen.');
  console.log('  Ursache ist fast immer, dass Direct Post in der TikTok-App');
  console.log('  (Production UND Sandbox) nicht eingeschaltet ist.\n');
}
