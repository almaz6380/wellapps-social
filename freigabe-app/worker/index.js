// Freigabe als Cloudflare Worker (seit 30.09.2026, vorher Vercel).
//
// Warum: Vercel hat am 28.09. den ganzen Hobby-Account pausiert, weil der
// Blob-Speicher dieser App sein Kontingent an Advanced Operations gesprengt hatte.
// Workers Free kostet nichts, braucht keine Kreditkarte und sperrt bei
// Ueberschreitung nur den einzelnen Aufruf - nie das Konto.
//
// Was hier zusammenkommt, lag vorher an drei Stellen:
//
//   /api/freigabe          derselbe Handler wie auf Vercel (api/freigabe.js)
//   /api/bild/<tag>~<datei> die TikTok-Durchreiche - jetzt ohne Umweg, die Datei
//                          liegt ja im eigenen Speicher
//   /social/...            der oeffentliche Speicher, der den Vercel-Blob ersetzt
//
// Speicher, zweigeteilt:
//   - Bilder und Videos in Workers KV. Sie werden einmal geschrieben (Dateiname
//     mit Zufallsanhang) und nie geaendert - dafuer ist KV gemacht.
//   - Merklisten und Sperren (*.json) in D1. KV ist nur "irgendwann konsistent"
//     (bis zu 60 s) und kennt kein "nur anlegen, wenn neu". Genau daran hing auf
//     Vercel die Sperre gegen doppelte Beitraege; D1 ist SQLite und kann beides.
//
// Schreiben duerfen nur die Werkzeuge in GitHub Actions: PUT/DELETE auf /social/...
// mit `Authorization: Bearer <BLOB_TOKEN>`. Lesen ist oeffentlich - Instagram und
// Meta holen die Dateien als anonyme Besucher ab.
import freigabe from '../api/freigabe.js';

const JSON_TYP = 'application/json; charset=utf-8';
// Pfade wie auf Vercel: social/<JJJJ-MM-TT>/<datei>, bei Stories eine Ebene tiefer.
const PFAD = /^social\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._~/-]{1,200}$/;
const INTERN = 'https://speicher.intern';

let tabelleDa = false;
async function db(env) {
  if (!tabelleDa) {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS dateien (pfad TEXT PRIMARY KEY, inhalt TEXT NOT NULL, geaendert TEXT NOT NULL)',
    ).run();
    tabelleDa = true;
  }
  return env.DB;
}

const istJson = (pfad) => pfad.endsWith('.json');

function berechtigt(request, env) {
  const soll = env.BLOB_TOKEN;
  const ist = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!soll || soll.length < 16 || ist.length !== soll.length) return false;
  let diff = 0;
  for (let i = 0; i < ist.length; i++) diff |= ist.charCodeAt(i) ^ soll.charCodeAt(i);
  return diff === 0;
}

async function md5(text) {
  const h = await crypto.subtle.digest('MD5', new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function lesen(env, pfad) {
  if (istJson(pfad)) {
    const zeile = await (await db(env)).prepare('SELECT inhalt FROM dateien WHERE pfad = ?').bind(pfad).first();
    if (!zeile) return null;
    return new Response(zeile.inhalt, {
      headers: { 'content-type': JSON_TYP, 'cache-control': 'no-store', etag: `"${await md5(zeile.inhalt)}"` },
    });
  }
  // ⚠ Als ArrayBuffer, nicht als Strom (01.10.2026): Ein Strom geht ohne
  // Content-Length hinaus, und HEAD kennt die Groesse dann gar nicht. Vercel Blob
  // lieferte sie, und Instagram/Facebook holen Bilder und Videos als anonymer
  // Besucher ab. Ein Reel sind rund vier Megabyte - passt bequem in den Speicher
  // des Workers.
  const { value, metadata } = await env.MEDIEN.getWithMetadata(pfad, { type: 'arrayBuffer' });
  if (!value) return null;
  return new Response(value, {
    headers: {
      'content-type': metadata?.typ ?? 'application/octet-stream',
      'content-length': String(value.byteLength),
      // Der Dateiname hat einen Zufallsanhang und wird nie ueberschrieben.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

async function schreiben(request, env, pfad) {
  const url = new URL(request.url);
  if (istJson(pfad)) {
    const text = await request.text();
    try { JSON.parse(text); } catch { return Response.json({ fehler: 'Kein gueltiges JSON.' }, { status: 400 }); }
    const d = await db(env);
    const jetzt = new Date().toISOString();
    // ?nurNeu=1: die Sperre gegen doppelte Beitraege. Genau ein Lauf gewinnt.
    if (url.searchParams.get('nurNeu') === '1') {
      const r = await d.prepare('INSERT INTO dateien (pfad, inhalt, geaendert) VALUES (?, ?, ?) ON CONFLICT(pfad) DO NOTHING')
        .bind(pfad, text, jetzt).run();
      return r.meta.changes === 1 ? new Response(null, { status: 201 }) : Response.json({ fehler: 'Gibt es schon.' }, { status: 409 });
    }
    // If-Match: nur schreiben, wenn seit dem Lesen niemand geschrieben hat.
    const vorbedingung = (request.headers.get('if-match') ?? '').replace(/"/g, '');
    if (vorbedingung) {
      const alt = await d.prepare('SELECT inhalt FROM dateien WHERE pfad = ?').bind(pfad).first();
      if (!alt || (await md5(alt.inhalt)) !== vorbedingung) {
        return Response.json({ fehler: 'Vorbedingung verletzt (precondition failed).' }, { status: 412 });
      }
    }
    await d.prepare('INSERT INTO dateien (pfad, inhalt, geaendert) VALUES (?, ?, ?) ON CONFLICT(pfad) DO UPDATE SET inhalt = excluded.inhalt, geaendert = excluded.geaendert')
      .bind(pfad, text, jetzt).run();
    return Response.json({ pfad, url: `${url.origin}/${pfad}`, md5: await md5(text) }, { status: 200 });
  }
  const typ = request.headers.get('content-type') ?? 'application/octet-stream';
  // Rohdaten direkt in KV durchreichen - nichts davon landet im Speicher des Workers.
  await env.MEDIEN.put(pfad, request.body, { metadata: { typ } });
  return Response.json({ pfad, url: `${url.origin}/${pfad}` }, { status: 200 });
}

async function loeschen(env, pfad) {
  if (istJson(pfad)) await (await db(env)).prepare('DELETE FROM dateien WHERE pfad = ?').bind(pfad).run();
  else await env.MEDIEN.delete(pfad);
  return new Response(null, { status: 204 });
}

// Merklisten eines Tages auflisten (fuer merklistenLesen in blob.mjs).
async function auflisten(request, env) {
  const praefix = new URL(request.url).searchParams.get('praefix') ?? '';
  if (!/^social\/\d{4}-\d{2}-\d{2}\//.test(praefix)) return Response.json({ fehler: 'praefix fehlt.' }, { status: 400 });
  const { results } = await (await db(env)).prepare('SELECT pfad FROM dateien WHERE pfad LIKE ? ORDER BY pfad')
    .bind(`${praefix.replace(/[%_]/g, '')}%`).all();
  const origin = new URL(request.url).origin;
  return Response.json({ dateien: results.map((r) => ({ pfad: r.pfad, url: `${origin}/${r.pfad}` })) });
}

// api/freigabe.js liest Merklisten per fetch(`${BLOB_BASIS}/social/...`). Statt den
// Handler umzuschreiben, zeigt BLOB_BASIS auf eine interne Adresse, und fetch
// beantwortet die direkt aus D1. Ein fetch des Workers an sich selbst ueber
// workers.dev waere ein Umweg und auf Cloudflare nicht verlaesslich.
const ECHTES_FETCH = globalThis.fetch;
function internesFetch(env) {
  const echt = ECHTES_FETCH;
  return async (eingabe, init) => {
    const adresse = typeof eingabe === 'string' ? eingabe : eingabe?.url;
    if (adresse?.startsWith(`${INTERN}/`)) {
      const pfad = new URL(adresse).pathname.slice(1);
      if (!PFAD.test(pfad)) return new Response(null, { status: 404 });
      return (await lesen(env, pfad)) ?? new Response(null, { status: 404 });
    }
    return echt(eingabe, init);
  };
}

// Der Handler ist fuer Vercel geschrieben (req/res im Express-Stil).
async function freigabeAufrufen(request, env) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const antwort = { code: 200, daten: null };
  const res = {
    status(c) { antwort.code = c; return res; },
    json(d) { antwort.daten = d; return res; },
  };
  await freigabe({ method: request.method, body, headers: Object.fromEntries(request.headers) }, res);
  return Response.json(antwort.daten ?? {}, { status: antwort.code, headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    // Der Handler liest process.env - Werte und Secrets dorthin durchreichen.
    for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v;
    process.env.BLOB_BASIS = INTERN;
    globalThis.fetch = internesFetch(env);

    const url = new URL(request.url);
    const pfad = decodeURIComponent(url.pathname.slice(1));

    if (url.pathname === '/api/freigabe') return freigabeAufrufen(request, env);

    if (url.pathname === '/api/speicher') {
      if (!berechtigt(request, env)) return Response.json({ fehler: 'Nicht berechtigt.' }, { status: 401 });
      return auflisten(request, env);
    }

    // TikTok-Durchreiche, gleiche Adressform wie auf Vercel: /api/bild/<tag>~<datei>.jpg
    // Dasselbe Muster wie api/bild/[teil].js: nur Tagesordner, nur Bilder, kein Schraegstrich.
    const bild = /^\/api\/bild\/(\d{4}-\d{2}-\d{2})~([A-Za-z0-9._-]{1,200}\.(?:jpg|jpeg))$/.exec(url.pathname);
    if (bild) {
      const antwort = await lesen(env, `social/${bild[1]}/${bild[2]}`);
      if (!antwort) return new Response('Nicht gefunden.', { status: 404 });
      return request.method === 'HEAD' ? new Response(null, { headers: antwort.headers }) : antwort;
    }

    if (PFAD.test(pfad)) {
      if (request.method === 'GET' || request.method === 'HEAD') {
        const antwort = await lesen(env, pfad);
        if (!antwort) return new Response('Nicht gefunden.', { status: 404 });
        return request.method === 'HEAD' ? new Response(null, { headers: antwort.headers }) : antwort;
      }
      if (!berechtigt(request, env)) return Response.json({ fehler: 'Nicht berechtigt.' }, { status: 401 });
      if (request.method === 'PUT') return schreiben(request, env, pfad);
      if (request.method === 'DELETE') return loeschen(env, pfad);
      return new Response(null, { status: 405 });
    }

    // Alles andere: index.html, Icons, TikTok-Signaturdateien.
    return env.ASSETS.fetch(request);
  },
};
