// TikTok-Zugang je Konto holen — der Anmelde-Ablauf in zwei Schritten.
//
//   SCHRITT=link  node tools/social/tiktok-zugang.mjs
//   SCHRITT=tausch CODE=… node tools/social/tiktok-zugang.mjs
//
// Gedacht fuer den Workflow „TikTok-Zugang holen". Beide Schritte brauchen
// TIKTOK_CLIENT_KEY, der zweite zusaetzlich TIKTOK_CLIENT_SECRET.
//
// --- ⚠ Warum das nicht im Browser geht ---------------------------------------
//
// Der erste Schritt schon: Man oeffnet eine TikTok-Seite, meldet sich an,
// bestaetigt — und wird auf unsere Domain zurueckgeleitet, mit einem `code`
// in der Adresszeile. Bis hierher braucht es kein Werkzeug.
//
// Der ZWEITE Schritt ist ein POST an TikTok mit dem App-Geheimnis im Rumpf.
// Eine Adresszeile kann kein POST, und das Geheimnis gehoert ohnehin nicht in
// eine URL — die landet in Verlauf, Protokollen und jedem Proxy dazwischen.
// Deshalb dieser Umweg ueber einen Workflow: Dort liegt das Geheimnis in den
// GitHub-Secrets und verlaesst sie nie.
//
// --- ⚠ Der Refresh-Token wird ausgegeben, und das ist Absicht ----------------
//
// Er muss ja in ein Secret, und niemand sonst kann ihn dort eintragen. Er
// steht damit im Protokoll dieses Laufs. Deshalb:
//
//   1. Wert sofort ins Secret TIKTOK_REFRESH_TOKEN_<APP> eintragen,
//   2. danach das Protokoll des Laufs loeschen (Actions → Lauf → „…" →
//      „Delete logs"). Claude kann das auch per API.
//
// Der ACCESS-Token wird bewusst NICHT ausgegeben: Er haelt nur 24 Stunden,
// posten.mjs holt sich vor jedem Lauf selbst einen frischen. Ihn zu zeigen
// waere ein Geheimnis mehr im Protokoll ohne jeden Nutzen.

const KEY = process.env.TIKTOK_CLIENT_KEY;
const SECRET = process.env.TIKTOK_CLIENT_SECRET;
const SCHRITT = (process.env.SCHRITT || 'link').trim();
const CODE = (process.env.CODE || '').trim();

// ⚠ Muss ZEICHENGENAU mit der Redirect-URI in der TikTok-App uebereinstimmen —
// inklusive Schraegstrich am Ende. Weicht sie ab, antwortet TikTok mit
// „redirect_uri mismatch", und die Meldung nennt nicht, welche der beiden
// gemeint ist.
const REDIRECT = 'https://anigosha.vercel.app/tiktok-fertig';

// video.upload laedt in den Entwurfs-Posteingang. NICHT video.publish — das
// waere Direktversand, und nichts soll ungelesen rausgehen.
const SCOPE = 'video.upload';

if (!KEY) {
  console.error('TIKTOK_CLIENT_KEY fehlt. Er steht in der TikTok-App unter');
  console.error('„App details" → Credentials → Client key.');
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

  console.log('\n1. Melde dich in einem PRIVATEN Fenster bei dem TikTok-Konto an,');
  console.log('   fuer das du den Zugang holen willst. ⚠ Ein normales Fenster');
  console.log('   nimmt das zuletzt angemeldete Konto — dann landet der Zugang');
  console.log('   bei der falschen App, und das faellt erst beim Posten auf.\n');
  console.log('2. Oeffne dort diese Adresse und bestaetige:\n');
  console.log(url);
  console.log('\n3. TikTok leitet dich danach auf eine Seite unserer Domain um.');
  console.log('   In der Adresszeile steht ?code=… — kopiere NUR den Wert hinter');
  console.log('   „code=" bis zum naechsten „&" (oder bis zum Ende).');
  console.log('   ⚠ Der Code ist wenige Minuten gueltig. Gleich weitermachen.\n');
  console.log('4. Starte denselben Workflow erneut, diesmal mit schritt=tausch');
  console.log('   und dem Code im Feld „code".\n');
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

console.log('\n✓ Zugang geholt.');
console.log(`   Konto (open_id): ${d.open_id ?? 'nicht gemeldet'}`);
console.log(`   Gueltig fuer: ${d.scope ?? SCOPE}`);
console.log('\nTrag diesen Wert in das Secret TIKTOK_REFRESH_TOKEN_<APP> ein:\n');
console.log(d.refresh_token);
console.log('\n⚠ Danach das Protokoll dieses Laufs loeschen — der Wert steht hier');
console.log('  im Klartext. Actions → dieser Lauf → „…" oben rechts → Delete logs.\n');
