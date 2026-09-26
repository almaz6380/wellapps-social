// Was auf der Freigabe-Seite OFFEN bleibt und was nach unten wandert.
//
//   node tools/social/test-freigabe-erledigt.mjs
//
// --- Wofuer ----------------------------------------------------------------
//
// Josef am 20.09.2026: „Wenn Posts in der Freigabe-App gepostet wurden,
// sollten sie nicht mehr auf der Freigabeseite sein oder in einem
// Gepostet-Ordner." Bis dahin stand alles in EINER Liste — auch das, wofuer
// es dort nichts mehr zu tun gab. Nach einem Tag mit acht Beitraegen je App
// muss man jede Karte einzeln lesen, um die zwei zu finden, die noch einen
// Knopf haben.
//
// --- Die eine Entscheidung, die man falsch treffen kann ---------------------
//
// ⚠ Nur was UEBER DIESE SEITE laeuft, darf zaehlen: Facebook und Instagram.
// TikTok wird in der TikTok-App freigegeben; dort haengt der Entwurf im
// Posteingang, und ob er rausging, weiss die Seite gar nicht. Wuerde TikTok
// mitzaehlen, verschwaenden Beitraege nach unten, die hier noch offen sind —
// und die Seite verlore genau den Zweck, fuer den sie gebaut wurde.
//
// ⚠ Die Logik steht hier ABSICHTLICH ein zweites Mal statt als Import: Die
// Seite ist eine einzelne index.html ohne Modulgrenzen. Faellt dieser Test
// um, waehrend die Seite laeuft, sind die beiden auseinandergelaufen — auch
// das ist ein Befund.

/** Die Fassung aus freigabe-app/index.html, Stand 26.09.2026 (`geloescht` zaehlt als erledigt). */
function erledigt(p) {
  if (p.abgelehnt) return true;
  const wege = ['facebook', 'instagram'].map((k) => p.kanaele?.[k]).filter(Boolean);
  return wege.length > 0 && wege.every((e) => e.stand === 'veroeffentlicht' || e.stand === 'geloescht');
}

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};

const V = { stand: 'veroeffentlicht' };

// 26.09.2026: Facebook nach dem Posten wieder geloescht (falscher Clip),
// Instagram draussen — nichts mehr freizugeben, also erledigt.
pruefe('Facebook geloescht + Instagram draussen → erledigt',
  erledigt({ kanaele: { facebook: { stand: 'geloescht' }, instagram: V } }), 'offen');
const W = { stand: 'wartet' };
const F = { stand: 'fehler' };
const P = { stand: 'posteingang' };

const faelle = [
  ['frisch, alles offen',
    { kanaele: { facebook: W, instagram: W, tiktok: P } }, false],
  ['nur Facebook gepostet — Instagram fehlt noch',
    { kanaele: { facebook: V, instagram: W, tiktok: P } }, false],
  ['nur Instagram gepostet — Facebook fehlt noch',
    { kanaele: { facebook: W, instagram: V, tiktok: P } }, false],
  ['beide gepostet — erledigt',
    { kanaele: { facebook: V, instagram: V, tiktok: P } }, true],
  ['beide gepostet, TikTok noch im Posteingang — trotzdem erledigt',
    { kanaele: { facebook: V, instagram: V, tiktok: P } }, true],
  ['abgelehnt — erledigt, egal was die Kanaele sagen',
    { abgelehnt: true, kanaele: { facebook: W, instagram: W } }, true],
  ['Facebook mit Fehler — bleibt offen, da ist noch etwas zu tun',
    { kanaele: { facebook: F, instagram: V } }, false],
];

for (const [name, post, erwartet] of faelle) {
  pruefe(name, erledigt(post) === erwartet,
    `erledigt=${erledigt(post)}, erwartet=${erwartet}`);
}

// --- Die Gegenprobe, die den gefaehrlichsten Fehler faengt -------------------
//
// Zaehlte TikTok mit, waere ein Beitrag „erledigt", sobald er im
// TikTok-Posteingang haengt — obwohl Facebook und Instagram noch auf einen
// Knopf warten. Er verschwaende dann in die Klappe, und niemand gaebe ihn je
// frei.
{
  const nurTiktokDraussen = { kanaele: { facebook: W, instagram: W, tiktok: V } };
  pruefe('TikTok allein macht NICHTS erledigt',
    erledigt(nurTiktokDraussen) === false, `erledigt=${erledigt(nurTiktokDraussen)}`);
}

// Ein Beitrag, der gar keinen der beiden Kanaele hat (etwa ein reiner
// TikTok-Beitrag), darf ebenfalls nicht verschwinden — sonst waere er
// unsichtbar, ohne je irgendwo gestanden zu haben.
{
  const nurTiktok = { kanaele: { tiktok: P } };
  pruefe('Ein Beitrag ohne Facebook und Instagram bleibt sichtbar',
    erledigt(nurTiktok) === false, `erledigt=${erledigt(nurTiktok)}`);
}

// Und die Aufteilung als Ganzes: aus sieben Beitraegen muessen vier offen
// bleiben und drei nach unten.
{
  const alle = faelle.map(([, p]) => p);
  const offen = alle.filter((p) => !erledigt(p)).length;
  pruefe('Aufteilung: 4 offen, 3 erledigt',
    offen === 4 && alle.length - offen === 3, `${offen} offen, ${alle.length - offen} erledigt`);
}

console.log(`\n${gut} von ${gut + schlecht.length} Proben gruen.`);
if (schlecht.length) {
  console.error('\n✗ Nicht bestanden:');
  for (const z of schlecht) console.error(`   ${z}`);
  process.exit(1);
}
console.log('✓ Erledigtes wandert nach unten, Offenes bleibt oben — und TikTok entscheidet das nicht.');
