// Die Serverseite der Freigabe-Seite.
//
// Sie tut genau zwei Dinge, und beide braucht sie, weil der Browser sie nicht
// tun darf:
//
//   1. Das Passwort pruefen. Im Browser waere jede Pruefung sinnlos — man
//      liest den Vergleich im Quelltext.
//   2. Den Freigabe-Workflow starten. Das braucht einen GitHub-Token, und ein
//      Token im Browser ist ein veroeffentlichter Token.
//
// ⚠ WAS HIER BEWUSST NICHT PASSIERT: Diese Funktion spricht NIE selbst mit
// Instagram, Facebook oder TikTok. Sie kennt weder deren Zugangsdaten noch den
// Blob-Token. Alles, was wirklich etwas veroeffentlicht, laeuft in GitHub
// Actions, wo die Geheimnisse ohnehin liegen. Damit gibt es sie nur an EINER
// Stelle — und ein Fehler in dieser Datei kann hoechstens einen Lauf
// ausloesen, den man ohnehin von Hand ausloesen koennte.
//
// ⚠ Der Blob-Speicher ist oeffentlich lesbar (Instagram holt die Bilder dort
// selbst ab, mit „privat" ginge das nicht). Die Merklisten liegen darin und
// enthalten Bildadresse und Bildtext — also genau das, was ohnehin gleich
// veroeffentlicht wird. Zugangsdaten stehen dort nicht und duerfen dort nie
// landen. Das Passwort schuetzt hier die Bequemlichkeit, nicht ein Geheimnis:
// Es verhindert, dass Fremde die Seite bedienen, nicht dass sie ein Bild
// sehen, dessen Adresse sie ohnehin nicht kennen.

import { createHash, timingSafeEqual } from 'node:crypto';

// Die fuenf App-Schluessel. Absichtlich hier fest und nicht aus apps.json
// gelesen: Diese Funktion liegt in einem eigenen Vercel-Projekt und hat den
// Rest des Repos nicht zur Hand.
const APPS = ['anigosha', 'mahjong', 'wellbooked', 'fullrep', 'swaply'];

// ⚠ Seit 17.09.2026 dieses Repo, nicht mehr `almaz6380/anigosha`. Es ist
// oeffentlich, und damit kosten seine Actions-Laeufe keine Minuten — genau
// deshalb liegt die Automatik hier. Der GitHub-Token in den Vercel-Variablen
// muss `Actions: Read and write` auf GENAU dieses Repo haben; zeigt er noch
// aufs alte, antwortet der Knopf mit „GitHub 404".
const REPO = 'almaz6380/wellapps-social';
const WORKFLOW = 'social-freigabe.yml';
const WORKFLOW_TIKTOK = 'social-tiktok-posten.yml';
const WORKFLOW_FACEBOOK = 'social-facebook-posten.yml';
const WORKFLOW_ABLEHNEN = 'social-ablehnen.yml';
const WORKFLOW_TAGESLAUF = 'social-tageslauf.yml';
const WORKFLOW_KARTE = 'social-karte.yml';

// ⚠ Der Dateiname geht als Workflow-Eingabe weiter und landet dort in einer
// Shell-Umgebung. Nur zulassen, was unsere Werkzeuge auch erzeugen.
const DATEINAME = /^[A-Za-z0-9._-]{1,120}\.(mp4|mov|jpg|jpeg|png)$/;

// ⚠ Fest, nicht durchgereicht. Diese Werte landen als Workflow-Eingabe in
// einer Shell-Zeile; alles, was nicht aus dieser Liste stammt, hat dort nichts
// verloren. TikTok nimmt ohnehin nur diese vier.
const PRIVACY = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
const ERLAUBT = ['kommentare', 'duett', 'stitch'];
const WERBUNG = ['eigene', 'fremde'];

/** Startet einen Workflow. Gibt nur zurueck, ob es geklappt hat. */
async function laufStarten(token, workflow, inputs) {
  const antwort = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    },
  );
  if (antwort.status !== 204) {
    throw new Error(`GitHub ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`);
  }
}

/** Vergleich ohne Zeitverrat — sonst liesse sich das Passwort erraten. */
function passtDasPasswort(eingabe, erwartet) {
  if (!erwartet) return false;
  const a = createHash('sha256').update(String(eingabe ?? '')).digest();
  const b = createHash('sha256').update(erwartet).digest();
  return timingSafeEqual(a, b);
}

async function merklisteHolen(basis, datum, app) {
  // ⚠ Cache umgehen. Ohne das liefert das CDN die Fassung von vor dem letzten
  // Schreiben — ein eben veroeffentlichter Beitrag saehe wieder offen aus,
  // und der naechste Klick machte einen zweiten daraus.
  const url = `${basis}/social/${datum}/freigabe-${app}.json?frisch=${Date.now()}`;
  const antwort = await fetch(url, { cache: 'no-store' });
  if (!antwort.ok) return null;   // 404 heisst schlicht: an dem Tag nichts
  try {
    return await antwort.json();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ fehler: 'Nur POST.' });
    return;
  }

  const { passwort, aktion, datum, app, datei, privacy, erlaubt, werbung, variante } = req.body ?? {};

  if (!passtDasPasswort(passwort, process.env.FREIGABE_PASSWORT)) {
    // Kurz bremsen: Ohne das liesse sich ein kurzes Passwort in Minuten
    // durchprobieren. Mit einer halben Sekunde je Versuch dauert dasselbe
    // Jahre, und ein Mensch, der sich vertippt, merkt nichts davon.
    await new Promise((r) => setTimeout(r, 500));
    res.status(401).json({ fehler: 'Falsches Passwort.' });
    return;
  }

  const tag = /^\d{4}-\d{2}-\d{2}$/.test(datum ?? '')
    ? datum
    : new Date().toISOString().slice(0, 10);

  try {
    if (aktion === 'liste') {
      const basis = process.env.BLOB_BASIS;
      if (!basis) {
        res.status(500).json({ fehler: 'BLOB_BASIS ist in Vercel nicht gesetzt.' });
        return;
      }
      const listen = (await Promise.all(
        APPS.map((a) => merklisteHolen(basis.replace(/\/$/, ''), tag, a)),
      )).filter(Boolean);
      res.status(200).json({ datum: tag, listen });
      return;
    }

    const token = process.env.GITHUB_TOKEN;

    if (aktion === 'veroeffentlichen') {
      if (!token) {
        res.status(500).json({ fehler: 'GITHUB_TOKEN ist in Vercel nicht gesetzt.' });
        return;
      }
      // ⚠ Nur bekannte App-Schluessel weiterreichen (siehe oben).
      const nurApp = APPS.includes(app) ? app : '';
      // `datei` ist optional: Mit ihr wird genau EIN Beitrag freigegeben (so
      // arbeitet die Seite), ohne sie alles Offene der App (so laesst sich der
      // Lauf von Hand als Sammelfreigabe benutzen).
      const nurDatei = DATEINAME.test(String(datei ?? '')) ? String(datei) : '';
      if (datei && !nurDatei) {
        res.status(400).json({ fehler: 'Unerwarteter Dateiname.' });
        return;
      }
      await laufStarten(token, WORKFLOW,
        { modus: 'veroeffentlichen', datum: tag, apps: nurApp, datei: nurDatei });
      res.status(200).json({ gestartet: true, datum: tag, app: nurApp || 'alle', datei: nurDatei });
      return;
    }

    // Ablehnen: EIN Beitrag wird als verworfen vermerkt. Das veroeffentlicht
    // nichts und nimmt nichts zurueck — es verhindert nur, dass der Beitrag
    // noch irgendwo hingeht.
    if (aktion === 'ablehnen') {
      if (!token) {
        res.status(500).json({ fehler: 'GITHUB_TOKEN ist in Vercel nicht gesetzt.' });
        return;
      }
      if (!APPS.includes(app)) {
        res.status(400).json({ fehler: 'Unbekannte App.' });
        return;
      }
      if (!DATEINAME.test(String(datei ?? ''))) {
        res.status(400).json({ fehler: 'Unerwarteter Dateiname.' });
        return;
      }
      await laufStarten(token, WORKFLOW_ABLEHNEN, { app, datei, datum: tag });
      res.status(200).json({ gestartet: true, datum: tag, app, datei });
      return;
    }

    // Ersatz erzeugen: der Tageslauf noch einmal, mit anderer Saat.
    //
    // ⚠ `modus: echt` heisst hier NICHT „oeffentlich" — der Lauf legt Dateien
    // ab, laedt TikTok in den Posteingang und merkt Facebook und Instagram
    // vor. Veroeffentlicht wird weiterhin nur auf Knopfdruck.
    if (aktion === 'neu') {
      if (!token) {
        res.status(500).json({ fehler: 'GITHUB_TOKEN ist in Vercel nicht gesetzt.' });
        return;
      }
      if (!APPS.includes(app)) {
        res.status(400).json({ fehler: 'Unbekannte App.' });
        return;
      }
      // ⚠ Die Variante geht als Workflow-Eingabe in eine Shell-Zeile. Nur eine
      // kleine ganze Zahl zulassen — und nach oben deckeln, damit niemand
      // versehentlich eine Kette von Nachlaeufen ausloest.
      const n = Number(variante);
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        res.status(400).json({ fehler: 'Variante muss zwischen 1 und 20 liegen.' });
        return;
      }
      // ⚠ Swaplys Motor liegt noch nicht auf seinem Standardzweig; ohne diese
      // Angabe bricht der Lauf mit „Cannot find module" ab. Die Zeile gehoert
      // weg, sobald der Zweig zusammengefuehrt ist — dieselbe Stelle steht
      // auch im Tageslauf-Workflow.
      const zweige = app === 'swaply' ? 'swaply=claude/swaply-icon-farben' : '';
      await laufStarten(token, WORKFLOW_TAGESLAUF, {
        apps: app, modus: 'echt', datum: tag, variante: String(n), zweige,
      });
      res.status(200).json({ gestartet: true, datum: tag, app, variante: n });
      return;
    }

    // Freie Karte: ein Beitrag mit einem Text, den du hier tippst — statt aus
    // den Daten der App gezogen. Er wird gezeichnet und in die Merkliste von
    // heute gehaengt; oeffentlich wird er erst mit dem gewoehnlichen Knopf.
    if (aktion === 'karte') {
      if (!token) {
        res.status(500).json({ fehler: 'GITHUB_TOKEN ist in Vercel nicht gesetzt.' });
        return;
      }
      // ⚠ Nur Anigosha. Das Format steckt in anigosha/tools/post-bild.mjs; die
      // vier anderen Apps haben es noch nicht. Hier abfangen statt den Lauf
      // zehn Minuten spaeter scheitern zu lassen.
      if (app !== 'anigosha') {
        res.status(400).json({ fehler: 'Freie Karten gibt es bisher nur fuer Anigosha.' });
        return;
      }

      // ⚠ Fest, nicht durchgereicht — wie PRIVACY weiter oben. Der Wert landet
      // als Workflow-Eingabe in einer Shell-Umgebung.
      const medium = req.body?.medium === 'reel' ? 'reel' : 'bild';

      const txt = String(req.body?.text ?? '').trim();
      if (!txt) {
        res.status(400).json({ fehler: 'Ohne Text gibt es nichts zu zeichnen.' });
        return;
      }
      // ⚠ Die Obergrenze ist gemessen, nicht geraten: Der Generator bricht ab,
      // wenn der Text nicht auf die Karte passt — bei ~240 Zeichen faellt er auf
      // die kleinste Schrift, darueber laeuft er ueber. Hier schon zu bremsen
      // spart zehn Minuten Lauf fuer einen Abbruch.
      if (txt.length > 240) {
        res.status(400).json({
          fehler: `Zu lang: ${txt.length} Zeichen. Auf die Karte passen hoechstens 240.`,
        });
        return;
      }
      // Die drei Beiwerke sind kurz oder gar nicht da. Ein langer „Haken"
      // druckt den eigentlichen Satz von der Karte.
      const kurz = (v, feld) => {
        const s = String(v ?? '').trim();
        if (s.length > 60) throw new Error(`„${feld}" ist zu lang (hoechstens 60 Zeichen).`);
        return s;
      };
      let haken, marke, cta;
      try {
        haken = kurz(req.body?.haken, 'Haken');
        marke = kurz(req.body?.marke, 'Marke');
        cta = kurz(req.body?.cta, 'Schlusszeile');
      } catch (e) {
        res.status(400).json({ fehler: e.message });
        return;
      }

      // ⚠ Haken und Marke gehen beim Reel NICHT mit. Die Reel-Vorlage kennt
      // sie nicht; mitzuschicken hiesse, sie stillschweigend zu verlieren —
      // und der Mensch sucht sie dann im fertigen Video.
      await laufStarten(token, WORKFLOW_KARTE, {
        app, medium, text: txt, cta,
        haken: medium === 'reel' ? '' : haken,
        marke: medium === 'reel' ? '' : marke,
      });
      res.status(200).json({ gestartet: true, app, medium, zeichen: txt.length });
      return;
    }

    // Facebook: EIN Beitrag. Anders als bei Instagram und TikTok gibt es hier
    // nichts zu waehlen — der Beitrag entsteht aus Datei und Text, so wie er
    // auf der Seite steht.
    if (aktion === 'facebook') {
      if (!token) {
        res.status(500).json({ fehler: 'GITHUB_TOKEN ist in Vercel nicht gesetzt.' });
        return;
      }
      if (!APPS.includes(app)) {
        res.status(400).json({ fehler: 'Unbekannte App.' });
        return;
      }
      if (!DATEINAME.test(String(datei ?? ''))) {
        res.status(400).json({ fehler: 'Unerwarteter Dateiname.' });
        return;
      }
      await laufStarten(token, WORKFLOW_FACEBOOK, { app, datei, datum: tag });
      res.status(200).json({ gestartet: true, datum: tag, app, datei });
      return;
    }

    // TikTok: EIN Beitrag, mit der Auswahl, die der Mensch gerade getroffen
    // hat. ⚠ Ohne `privacy` wird nichts gestartet — TikTok verlangt eine
    // bewusste Wahl, und eine Voreinstellung hier waere genau der Verstoss.
    if (aktion === 'tiktok') {
      if (!token) {
        res.status(500).json({ fehler: 'GITHUB_TOKEN ist in Vercel nicht gesetzt.' });
        return;
      }
      if (!APPS.includes(app)) {
        res.status(400).json({ fehler: 'Unbekannte App.' });
        return;
      }
      if (!PRIVACY.includes(privacy)) {
        res.status(400).json({ fehler: 'Bitte zuerst die Sichtbarkeit waehlen.' });
        return;
      }
      // ⚠ Der Dateiname geht als Workflow-Eingabe weiter. Nur das erlauben,
      // was unsere Werkzeuge auch erzeugen.
      //
      // ⚠ jpg/jpeg gehoeren dazu, seit TikTok auch Fotobeitraege bekommt
      // (19.09.2026). Der Knopf auf der Seite war da schon frei, diese
      // Pruefung nicht — ein Karussell antippen ergab „Unerwarteter
      // Dateiname", und die Meldung sah nach einem kaputten Beitrag aus statt
      // nach einer vergessenen Zeile. Eine Sperre an zwei Stellen muss an
      // beiden fallen.
      if (!/^[A-Za-z0-9._-]{1,120}\.(mp4|mov|jpg|jpeg)$/.test(String(datei ?? ''))) {
        res.status(400).json({ fehler: 'Unerwarteter Dateiname.' });
        return;
      }
      const nurBekannt = (liste, erlaubteWerte) => (Array.isArray(liste) ? liste : [])
        .filter((x) => erlaubteWerte.includes(x)).join(',');

      await laufStarten(token, WORKFLOW_TIKTOK, {
        app, datei, privacy, datum: tag,
        erlaubt: nurBekannt(erlaubt, ERLAUBT),
        werbung: nurBekannt(werbung, WERBUNG),
      });
      res.status(200).json({ gestartet: true, datum: tag, app, datei });
      return;
    }

    res.status(400).json({ fehler: `Unbekannte Aktion „${aktion}".` });
  } catch (e) {
    res.status(500).json({ fehler: e.message });
  }
}
