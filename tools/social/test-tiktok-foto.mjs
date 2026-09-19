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

import {
  fotoPosten, ueberschrift, FOTO_MAX, TITEL_MAX_FOTO, TEXT_MAX_FOTO,
} from './veroeffentlichen/tiktok.mjs';

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
    token: 'x', bildUrls: sechs, text: 'Der Anruf', trocken: true,
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
    await fotoPosten({ token: 'x', bildUrls: sechs, text: 'T', direkt: true, trocken: true });
  } catch (e) { fehler = e.message; }
  pruefe('Direct Post ohne Privatsphaere-Wahl wird abgelehnt',
    Boolean(fehler) && /Privatsphaere/.test(fehler ?? ''), fehler ?? 'kein Fehler');

  const r = await fotoPosten({
    token: 'x', bildUrls: sechs, text: 'T', direkt: true, trocken: true,
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
        token: 'x', text: 'T', trocken: true,
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
      token: 'x', text: 'T', trocken: true,
      bildUrls: ['/home/user/wellbooked/out/social/2026-09-19/wellbooked-anruf-de-s1-1.jpg'],
    });
  } catch (e) { fehler = e.message; }
  pruefe('lokaler Pfad wird abgelehnt', Boolean(fehler) && /https/.test(fehler ?? ''),
    fehler ?? 'kein Fehler');

  let f2 = null;
  try {
    await fotoPosten({ token: 'x', text: 'T', trocken: true, bildUrls: ['http://unsicher.invalid/a.jpg'] });
  } catch (e) { f2 = e.message; }
  pruefe('http (ohne s) wird abgelehnt', Boolean(f2), f2 ?? 'kein Fehler');
}

// --- 5. Zwei Felder, zwei Grenzen -------------------------------------------
//
// ⚠ Hier stand bis zum 19.09.2026 „Titel auf 2200 Zeichen gekuerzt" — der
// Test hat den Fehler nicht gefunden, er hat ihn FESTGEHALTEN. 2200 ist die
// Grenze des VIDEOS; bei Fotos ist `title` eine Ueberschrift von 90 Zeichen,
// und TikTok antwortete auf die volle Bildunterschrift mit
// `invalid_params`. Ein Test, der die Annahme des Codes wiederholt, statt
// die Gegenseite zu befragen, ist keine Pruefung.
{
  // Genau die Bildunterschrift, an der es gescheitert ist.
  const echt = 'Anrufen. Warten. „Moment, ich schau nach …" Und am Ende hast du keinen '
    + 'Termin, sondern einen Rückruf-Auftrag.\n\nWELLbooked! zeigt dir freie Termine '
    + 'direkt — ohne Anruf, ohne Rückruf.\n\nwellbooked.at\n\n#Wellness #Massage';
  const r = await fotoPosten({ token: 'x', bildUrls: sechs, text: echt, trocken: true });
  const p = r.rumpf.post_info;

  pruefe(`Ueberschrift haelt ${TITEL_MAX_FOTO} Zeichen ein`,
    p.title.length > 0 && p.title.length <= TITEL_MAX_FOTO, `${p.title.length}: ${p.title}`);
  // Der eigentliche Punkt: Es geht nichts verloren, es steht nur woanders.
  pruefe('ganze Bildunterschrift steht in description', p.description === echt,
    `${p.description?.length} von ${echt.length} Zeichen`);
  pruefe('Hashtags sind mitgekommen', /#Wellness/.test(p.description ?? ''),
    (p.description ?? '').slice(-40));
  pruefe('nicht mitten im Wort abgeschnitten', !/\S…$/.test(p.title) || / /.test(p.title),
    p.title);

  // Eine eigene Ueberschrift sticht die abgeleitete.
  const e = await fotoPosten({
    token: 'x', bildUrls: sechs, text: echt, titel: 'Der Anruf, den niemand führen will.',
    trocken: true,
  });
  pruefe('eigene Ueberschrift wird genommen',
    e.rumpf.post_info.title === 'Der Anruf, den niemand führen will.', e.rumpf.post_info.title);

  // Und die 4000 gelten trotzdem.
  const lang = await fotoPosten({
    token: 'x', bildUrls: [url(1)], text: 'x'.repeat(5000), trocken: true,
  });
  pruefe(`description auf ${TEXT_MAX_FOTO} gedeckelt`,
    lang.rumpf.post_info.description.length === TEXT_MAX_FOTO,
    String(lang.rumpf.post_info.description.length));
}

// --- 6. Die Ueberschrift fuer sich ------------------------------------------
{
  pruefe('kurzer Text bleibt unveraendert', ueberschrift('Kurz und gut.') === 'Kurz und gut.',
    ueberschrift('Kurz und gut.'));
  // ⚠ Der erste ABSATZ, nicht der erste Satz: „Anrufen." waere ein Satz.
  pruefe('erster Absatz, nicht erster Satz',
    ueberschrift('Anrufen. Warten. Nichts.\n\nZweiter Absatz.') === 'Anrufen. Warten. Nichts.',
    ueberschrift('Anrufen. Warten. Nichts.\n\nZweiter Absatz.'));
  // ⚠ Der Fall, der den Wortschnitt verworfen hat: Er endete auf „…sondern…".
  // Ganze Saetze hoeren dort auf, wo der Gedanke aufhoert — und das
  // schliessende Anfuehrungszeichen muss mitkommen, sonst steht ein „ ohne
  // Gegenstueck da.
  const hook = ueberschrift('Anrufen. Warten. „Moment, ich schau nach …" Und am Ende '
    + 'hast du keinen Termin, sondern einen Rückruf-Auftrag.');
  pruefe('kuerzt in ganzen Saetzen, ohne Auslassungszeichen',
    hook === 'Anrufen. Warten. „Moment, ich schau nach …"', hook);
  pruefe('Anfuehrungszeichen bleiben paarig',
    (hook.match(/„/g) ?? []).length === (hook.match(/"/g) ?? []).length, hook);

  const w = ueberschrift(`${'wort '.repeat(40)}`);
  pruefe('langer Absatz wird gekuerzt', w.length <= TITEL_MAX_FOTO && w.endsWith('…'), w);
  // Ein einziges Riesenwort hat keine Wortgrenze — dann wird hart geschnitten.
  const eins = ueberschrift('x'.repeat(300));
  pruefe('Wort ohne Luecke wird hart geschnitten', eins.length === TITEL_MAX_FOTO,
    String(eins.length));
  pruefe('leerer Text ergibt leere Ueberschrift', ueberschrift('') === '', `„${ueberschrift('')}"`);
}

// --- Ergebnis ---------------------------------------------------------------
console.log(`\nTikTok-Foto: ${gut} von ${gut + schlecht.length} Faellen gruen.`);
if (schlecht.length) {
  console.error('\n✗ Fehlgeschlagen:');
  for (const z of schlecht) console.error(`   • ${z}`);
  process.exit(1);
}
