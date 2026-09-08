// Frame-für-Frame-Aufnahme mit Playwright.
//
// Die Frames gehen per Pipe direkt an ffmpeg und landen NIE auf der Platte:
// 960 PNG à 1080×1920 wären über ein Gigabyte.

import { chromium } from 'playwright';
import { baueHtml, BREITE, HOEHE } from './template.mjs';

// Voreinstellung = Quiz-Reel. Der Werbespot reicht über `opt` sein eigenes
// Template und seine eigenen Maße herein (siehe tools/reels/spot/).
const STANDARD = { baueHtml, breite: BREITE, hoehe: HOEHE, dsf: 1, format: 'jpeg', quality: 96 };

// Öffnet die Seite und gibt page + Aufräumfunktion zurück.
export async function seiteOeffnen(storyboard, opt = {}) {
  const o = { ...STANDARD, ...opt };
  // CHROMIUM_PFAD erlaubt einen bereits vorhandenen Chromium (z. B. in der
  // Cloud-Sitzung: /opt/pw-browsers/chromium). Ohne die Variable nimmt
  // Playwright seinen eigenen — so läuft es auf Josefs Mac unverändert weiter.
  const browser = await chromium.launch(
    process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
  );
  const ctx = await browser.newContext({
    viewport: { width: o.breite, height: o.hoehe },
    deviceScaleFactor: o.dsf,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  await page.setContent(o.baueHtml(storyboard), { waitUntil: 'load' });
  // Auf die eingebettete Schrift warten — sonst rendern die ersten Frames in DejaVu.
  await page.waitForFunction('window.__bereit === true', null, { timeout: 15000 });
  return { page, schliessen: () => browser.close() };
}

// Rendert alle Frames und schiebt sie in den übergebenen Stream.
export async function frames(storyboard, senke, { onFortschritt, ...opt } = {}) {
  const { page, schliessen } = await seiteOeffnen(storyboard, opt);
  const gesamt = storyboard.gesamtFrames;
  const bildOpt = opt.format === 'png'
    ? { type: 'png' }
    : { type: 'jpeg', quality: opt.quality ?? 96 };

  try {
    for (let n = 0; n < gesamt; n++) {
      await page.evaluate((i) => window.setFrame(i), n);
      const bild = await page.screenshot(bildOpt);

      if (!senke.write(bild)) {
        await new Promise((res) => senke.once('drain', res));
      }
      if (onFortschritt && (n % 60 === 0 || n === gesamt - 1)) onFortschritt(n + 1, gesamt);
    }
  } finally {
    await schliessen();
  }
}

// Kontaktbogen: je ein Standbild pro Phase, als PNG-Reihe. Dauert Sekunden
// statt Minuten und beantwortet die einzige wirklich offene Frage — sieht es gut aus?
export async function kontaktbogen(storyboard, opt = {}) {
  const { page, schliessen } = await seiteOeffnen(storyboard, opt);
  const P = storyboard.phasen;
  const bilder = [];

  try {
    for (const b of storyboard.bloecke) {
      let punkte;
      if (b.typ === 'frage') {
        const tAntw = P.frageEin;
        const tCount = tAntw + P.antworten;
        const tReveal = tCount + P.countdown;
        const tErkl = tReveal + P.reveal;
        punkte = [
          ['Frage', b.start + P.frageEin - 2],
          ['Antworten', b.start + tCount - 2],
          ['Countdown', b.start + tCount + Math.round(P.countdown * 0.72)],
          ['Auflösung', b.start + tReveal + P.reveal - 4],
          ['Erklärung', b.start + tErkl + P.erklaerung - 4],
        ];
      } else {
        punkte = [[b.typ === 'hook' ? 'Hook' : 'Outro', b.start + b.dauer - 6]];
      }

      for (const [name, n] of punkte) {
        await page.evaluate((i) => window.setFrame(i), n);
        bilder.push({
          name: `${b.typ === 'frage' ? `F${b.nummer} ` : ''}${name}`,
          frame: n,
          png: await page.screenshot({ type: 'png' }),
        });
      }
    }
  } finally {
    await schliessen();
  }

  return bilder;
}

export { BREITE, HOEHE };
