// TikTok-Fotobeitraege: der Rumpf, die Grenzen, und was NICHT passieren darf.
//
//   node tools/social/test-tiktok-foto.mjs
//
// Geprueft wird im TROCKENLAUF — es geht kein einziger Aufruf ins Netz und
// nichts in ein Konto. `fotoPosten` gibt dort den fertigen Rumpf zurueck,
// genau den, der sonst gesendet wuerde.
//
// ⚠ Was dieser Test NICHT beweisen kann: dass TikTok die Bildadressen
// abholt. Das haengt daran, ob ihr Praefix im Entwicklerportal verifiziert
// ist — eine Einstellung ausserhalb dieses Repos. Der Beweis dafuer ist ein
// Entwurf im Posteingang, nichts anderes.

import { fotoPosten, FOTO_MAX } from './veroeffentlichen/tiktok.mjs';

let gut = 0;
const schlecht = [];
const pruefe = (name, ok, gemessen) => {
  if (ok) gut += 1; else schlecht.push(`${name}\n      gemessen: ${gemessen}`);
};
const url = (n) => `https://beispiel.invalid/folie-${n}.jpg`;
const sechs = Array.from({ length: 6 }, (_, i) => url(i + 1));

// --- 1. Der Rumpf im Posteingang-Modus --------------------------------------
{
  const r = await fotoPosten({
    token: 'x', bildUrls: sechs, titel: 'Der Anruf', trocken: true,
  });
  const b = r.rumpf;
  pruefe('media_type ist PHOTO', b.media_type === 'PHOTO', b.media_type);
  pruefe('Posteingang → MEDIA_UPLOAD', b.post_mode === 'MEDIA_UPLOAD', b.post_mode);
  pruefe('Quelle ist PULL_FROM_URL', b.source_info.source === 'PULL_FROM_URL',
    b.source_info.source);
  pruefe('alle sechs Folien, in Reihenfolge',
    b.source_info.photo_images.join() === sechs.join(),
    b.source_info.photo_images.join(' '));
  pruefe('Titelbild ist Folie 1', b.source_info.photo_cover_index === 0,
    String(b.source_info.photo_cover_index));
  // ⚠ Im Posteingang gibt es keine Privatsphaere-Wahl — die trifft der Mensch
  // in der App. Ein hier gesetzter Wert waere eine Voreinstellung, und genau
  // die verbietet TikToks Richtlinie.
  pruefe('keine Privatsphaere-Stufe im Posteingang',
    b.post_info.privacy_level === undefined, String(b.post_info.privacy_level));
  pruefe('kein auto_add_music im Posteingang',
    b.post_info.auto_add_music === undefined, String(b.post_info.auto_add_music));
}

// --- 2. Direct Post: Wahl ist Pflicht, Musik bleibt aus ---------------------
{
  let fehler = null;
  try {
    await fotoPosten({ token: 'x', bildUrls: sechs, titel: 'T', direkt: true, trocken: true });
  } catch (e) { fehler = e.message; }
  pruefe('Direct Post ohne Privatsphaere-Wahl wird abgelehnt',
    Boolean(fehler) && /Privatsphaere/.test(fehler ?? ''), fehler ?? 'kein Fehler');

  const r = await fotoPosten({
    token: 'x', bildUrls: sechs, titel: 'T', direkt: true, trocken: true,
    wahl: { privacy: 'SELF_ONLY', kommentare: true },
  });
  const p = r.rumpf.post_info;
  pruefe('Direct Post → DIRECT_POST', r.rumpf.post_mode === 'DIRECT_POST', r.rumpf.post_mode);
  pruefe('Privatsphaere wird durchgereicht', p.privacy_level === 'SELF_ONLY', p.privacy_level);
  // Die Oberflaeche fragt „Kommentare erlauben", die API kennt das Gegenteil.
  pruefe('Kommentare erlaubt → disable_comment false',
    p.disable_comment === false, String(p.disable_comment));
  // ⚠ Der Fall, der eine Regel verletzen wuerde: TikTok legt sonst von sich
  // aus Musik unter die Fotos. WELLbookeds `tonspur_muss_leer_sein`.
  pruefe('auto_add_music ausdruecklich false', p.auto_add_music === false,
    String(p.auto_add_music));
}

// --- 3. Grenzen -------------------------------------------------------------
{
  const versuch = async (n) => {
    try {
      await fotoPosten({
        token: 'x', titel: 'T', trocken: true,
        bildUrls: Array.from({ length: n }, (_, i) => url(i + 1)),
      });
      return 'angenommen';
    } catch (e) { return `abgelehnt: ${e.message.slice(0, 60)}`; }
  };
  pruefe('kein Bild wird abgelehnt', (await versuch(0)).startsWith('abgelehnt'), await versuch(0));
  pruefe('ein Bild geht', (await versuch(1)) === 'angenommen', await versuch(1));
  pruefe(`${FOTO_MAX} Bilder gehen`, (await versuch(FOTO_MAX)) === 'angenommen',
    await versuch(FOTO_MAX));
  pruefe(`${FOTO_MAX + 1} Bilder werden abgelehnt`,
    (await versuch(FOTO_MAX + 1)).startsWith('abgelehnt'), await versuch(FOTO_MAX + 1));
}

// --- 4. Ein lokaler Pfad ist keine Bildadresse ------------------------------
//
// Der naheliegende Fehler beim Verdrahten: `p.medium` statt `spur.urls`
// durchreichen. TikTok meldete darauf nur, es habe nichts abholen koennen.
{
  let fehler = null;
  try {
    await fotoPosten({
      token: 'x', titel: 'T', trocken: true,
      bildUrls: ['/home/user/wellbooked/out/social/2026-09-19/wellbooked-anruf-de-s1-1.jpg'],
    });
  } catch (e) { fehler = e.message; }
  pruefe('lokaler Pfad wird abgelehnt', Boolean(fehler) && /https/.test(fehler ?? ''),
    fehler ?? 'kein Fehler');

  let f2 = null;
  try {
    await fotoPosten({ token: 'x', titel: 'T', trocken: true, bildUrls: ['http://unsicher.invalid/a.jpg'] });
  } catch (e) { f2 = e.message; }
  pruefe('http (ohne s) wird abgelehnt', Boolean(f2), f2 ?? 'kein Fehler');
}

// --- 5. Der Text wird gedeckelt, nicht von TikTok abgeschnitten -------------
{
  const r = await fotoPosten({
    token: 'x', bildUrls: [url(1)], titel: 'x'.repeat(3000), trocken: true,
  });
  pruefe('Titel auf 2200 Zeichen gekuerzt', r.rumpf.post_info.title.length === 2200,
    String(r.rumpf.post_info.title.length));
}

// --- Ergebnis ---------------------------------------------------------------
console.log(`\nTikTok-Foto: ${gut} von ${gut + schlecht.length} Faellen gruen.`);
if (schlecht.length) {
  console.error('\n✗ Fehlgeschlagen:');
  for (const z of schlecht) console.error(`   • ${z}`);
  process.exit(1);
}
