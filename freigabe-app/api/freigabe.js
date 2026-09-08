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

const REPO = 'almaz6380/wellapps-social';
const WORKFLOW = 'social-freigabe.yml';

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

  const { passwort, aktion, datum, app } = req.body ?? {};

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

    if (aktion === 'veroeffentlichen') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        res.status(500).json({ fehler: 'GITHUB_TOKEN ist in Vercel nicht gesetzt.' });
        return;
      }
      // ⚠ Nur bekannte App-Schluessel weiterreichen. Der Wert landet als
      // Workflow-Eingabe in einer Shell-Zeile; alles andere waere eine
      // offene Tuer.
      const nurApp = APPS.includes(app) ? app : '';

      const antwort = await fetch(
        `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: { modus: 'veroeffentlichen', datum: tag, apps: nurApp },
          }),
        },
      );

      if (antwort.status !== 204) {
        const text = (await antwort.text()).slice(0, 300);
        res.status(502).json({ fehler: `GitHub ${antwort.status}: ${text}` });
        return;
      }
      res.status(200).json({ gestartet: true, datum: tag, app: nurApp || 'alle' });
      return;
    }

    res.status(400).json({ fehler: `Unbekannte Aktion „${aktion}".` });
  } catch (e) {
    res.status(500).json({ fehler: e.message });
  }
}
