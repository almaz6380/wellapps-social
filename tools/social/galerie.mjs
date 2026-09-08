// Baut die Galerie-Seite eines Tageslaufs.
//
// Sie wird als Artifact veroeffentlicht und auf dem Handy geoeffnet: Vorschau
// ansehen, Caption kopieren, Datei aus dem Chat holen, posten.
//
// ⚠ VIDEOS KOMMEN NICHT IN DIE SEITE. Die Asset-Faehigkeit ist fuer dieses
// Konto nicht freigeschaltet, und acht Reels als Base64 sprengen das
// 16-MB-Limit der Seite. Stattdessen steht hier ein Standbild aus dem Video
// (mit ffmpeg gezogen); die MP4s gehen als Chat-Dateien raus. Der Dateiname
// steht auf jeder Karte, damit sich beides zuordnen laesst.

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';

const require = createRequire(import.meta.url);

const AKZENTE = {
  anigosha: '#8b5cf6',
  mahjong: '#35a06d',
  wellbooked: '#D4A373',
  fullrep: '#fbbf24',
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Standbild aus einem Video ziehen — bei einem Drittel der Laufzeit. */
function standbild(video, tmp) {
  const ffmpeg = require('ffmpeg-static');
  mkdirSync(tmp, { recursive: true });
  const ziel = join(tmp, `${basename(video, '.mp4')}.jpg`);
  try {
    execFileSync(ffmpeg, ['-y', '-ss', '3', '-i', video, '-frames:v', '1',
      '-vf', 'scale=540:-2', '-q:v', '4', ziel], { stdio: 'ignore' });
    return ziel;
  } catch {
    return null;
  }
}

function bildDaten(pfad) {
  const b = readFileSync(pfad).toString('base64');
  const typ = pfad.endsWith('.png') ? 'png' : 'jpeg';
  return `data:image/${typ};base64,${b}`;
}

/** Caption und Hashtags aus dem Beiblatt trennen. */
function zerlege(beiblatt) {
  if (!beiblatt) return { caption: '', hashtags: '', kontrolle: '' };
  const teil = (von, bis) => {
    const a = beiblatt.search(von);
    if (a === -1) return '';
    const rest = beiblatt.slice(a).replace(/^.*\n(-{3,}\n)?/, '');
    const b = rest.search(bis);
    return (b === -1 ? rest : rest.slice(0, b)).trim();
  };
  return {
    caption: teil(/^(##\s*Caption|CAPTION ZUM KOPIEREN)/im, /^(##\s|[A-ZÄÖÜ ]{6,}\n-{3,})/m),
    hashtags: teil(/^(##\s*Hashtags|#\w)/im, /^(##\s|[A-ZÄÖÜ ]{6,}\n-{3,})/m).split('\n')[0],
    kontrolle: teil(/^(##\s*Inhalt|ZUR KONTROLLE)/im, /^##\s/m),
  };
}

export function baueGalerie({ datum, apps, bericht, tmp }) {
  const karten = [];

  for (const b of bericht) {
    if (!b.dateien?.length || b.verworfen || b.fehler) continue;
    const app = apps[b.app];
    const video = b.dateien.find((f) => f.endsWith('.mp4'));
    const bilder = b.dateien.filter((f) => /\.(jpg|png)$/.test(f));
    const beiblattPfad = b.dateien.find((f) => f.endsWith('.txt'));
    const { caption, hashtags, kontrolle } = zerlege(
      beiblattPfad ? readFileSync(beiblattPfad, 'utf8') : '',
    );

    // Vorschau: bei einem Video das Standbild, sonst das erste Bild
    // (Feed-Format bevorzugt, falls es mehrere gibt).
    let vorschau = null;
    if (video) {
      const s = standbild(video, tmp);
      if (s) vorschau = bildDaten(s);
    } else if (bilder.length) {
      vorschau = bildDaten(bilder.find((f) => f.includes('-feed')) ?? bilder[0]);
    }

    karten.push({
      app: b.app, appName: app.name, akzent: AKZENTE[b.app] ?? '#8b8b8b',
      winkel: b.post.winkel, medium: b.post.medium, sprache: b.post.sprache,
      haken: b.post.haken,
      dateien: b.dateien.filter((f) => !f.endsWith('.txt')).map((f) => basename(f)),
      vorschau, caption, hashtags, kontrolle,
    });
  }

  const nachApp = [...new Set(karten.map((k) => k.app))];
  const reels = karten.filter((k) => k.medium === 'reel').length;

  const kartenHtml = nachApp.map((a) => {
    const gruppe = karten.filter((k) => k.app === a);
    const akzent = gruppe[0].akzent;
    return `
<section class="app" style="--akzent:${akzent}">
  <h2>${esc(gruppe[0].appName)}<span>${gruppe.length} Posts</span></h2>
  ${gruppe.map((k, i) => `
  <article class="karte">
    <div class="kopf">
      <span class="art art-${k.medium}">${k.medium === 'reel' ? 'Reel' : 'Bild'}</span>
      <span class="winkel">${esc(k.winkel)}</span>
      <span class="sprache">${esc(k.sprache.toUpperCase())}</span>
    </div>
    ${k.vorschau
      ? `<img class="vorschau" src="${k.vorschau}" alt="Vorschau: ${esc(k.winkel)}">`
      : '<div class="vorschau leer">keine Vorschau</div>'}
    ${k.medium === 'reel'
      ? '<p class="notiz">Standbild aus dem Video. Die MP4-Datei liegt im Chat.</p>' : ''}
    <p class="haken">${esc(k.haken)}</p>

    <div class="block">
      <div class="blockKopf"><span>Caption</span>
        <button class="kopieren" data-ziel="c-${a}-${i}">Kopieren</button></div>
      <pre id="c-${a}-${i}">${esc(k.caption)}</pre>
    </div>

    ${k.hashtags ? `
    <div class="block">
      <div class="blockKopf"><span>Hashtags</span>
        <button class="kopieren" data-ziel="h-${a}-${i}">Kopieren</button></div>
      <pre id="h-${a}-${i}">${esc(k.hashtags)}</pre>
    </div>` : ''}

    <details>
      <summary>Dateien und Kontrolle</summary>
      <ul class="dateien">${k.dateien.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
      ${k.kontrolle ? `<pre class="kontrolle">${esc(k.kontrolle)}</pre>` : ''}
    </details>
  </article>`).join('')}
</section>`;
  }).join('');

  return `<title>Social-Studio ${datum}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap">
<style>
:root{
  --grund:#faf9f7; --flaeche:#ffffff; --rand:#e4e1dc;
  --text:#1c1a17; --gedaempft:#6d675f; --leise:#948f86;
  --block:#f4f2ef;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){ --grund:#141311; --flaeche:#1c1a18; --rand:#2e2b27;
    --text:#f2efea; --gedaempft:#a8a29a; --leise:#7d766d; --block:#232120; }
}
:root[data-theme="dark"]{ --grund:#141311; --flaeche:#1c1a18; --rand:#2e2b27;
  --text:#f2efea; --gedaempft:#a8a29a; --leise:#7d766d; --block:#232120; }

*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--text);
  font-family:'Public Sans',system-ui,sans-serif;font-size:15px;line-height:1.55}
.huelle{max-width:640px;margin:0 auto;padding:28px 18px 72px;
  display:flex;flex-direction:column;gap:34px}

header h1{font-family:'Archivo',system-ui,sans-serif;font-weight:700;
  font-size:clamp(28px,7vw,38px);line-height:1.05;margin:0 0 8px;
  letter-spacing:-.02em;text-wrap:balance}
header p{margin:0;color:var(--gedaempft)}
.zahlen{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.zahl{background:var(--flaeche);border:1px solid var(--rand);border-radius:999px;
  padding:6px 14px;font-size:13px;font-weight:500;
  font-variant-numeric:tabular-nums}
.hinweis{margin-top:18px;padding:12px 14px;border-radius:10px;
  background:var(--block);border:1px solid var(--rand);
  font-size:13.5px;color:var(--gedaempft)}

.app{display:flex;flex-direction:column;gap:14px}
.app h2{font-family:'Archivo',system-ui,sans-serif;font-weight:600;font-size:19px;
  margin:0;padding-left:12px;border-left:4px solid var(--akzent);
  display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.app h2 span{font-family:'Public Sans',sans-serif;font-weight:400;
  font-size:13px;color:var(--leise);font-variant-numeric:tabular-nums}

.karte{background:var(--flaeche);border:1px solid var(--rand);border-radius:14px;
  padding:16px;display:flex;flex-direction:column;gap:12px}
.kopf{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.art{font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  padding:3px 9px;border-radius:5px;color:var(--akzent);
  background:color-mix(in srgb,var(--akzent) 14%,transparent);
  border:1px solid color-mix(in srgb,var(--akzent) 34%,transparent)}
.winkel{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--gedaempft)}
.sprache{margin-left:auto;font-size:11.5px;color:var(--leise);letter-spacing:.08em}

.vorschau{width:100%;max-height:460px;object-fit:contain;border-radius:10px;
  background:var(--block);display:block}
.vorschau.leer{display:grid;place-items:center;height:200px;color:var(--leise);font-size:13px}
.notiz{margin:-4px 0 0;font-size:12.5px;color:var(--leise)}
.haken{margin:0;color:var(--gedaempft);font-size:14px}

.block{border:1px solid var(--rand);border-radius:10px;overflow:hidden}
.blockKopf{display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px;background:var(--block);border-bottom:1px solid var(--rand);
  font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--gedaempft)}
.kopieren{font:inherit;font-size:12px;text-transform:none;letter-spacing:0;
  border:1px solid color-mix(in srgb,var(--akzent) 40%,transparent);
  background:color-mix(in srgb,var(--akzent) 12%,transparent);
  color:var(--akzent);border-radius:6px;padding:4px 12px;cursor:pointer}
.kopieren:hover{background:color-mix(in srgb,var(--akzent) 22%,transparent)}
.kopieren:focus-visible{outline:2px solid var(--akzent);outline-offset:2px}
.kopieren.fertig{background:color-mix(in srgb,var(--akzent) 26%,transparent)}
pre{margin:0;padding:12px;font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;
  overflow-x:auto}

details{font-size:13px;color:var(--gedaempft)}
summary{cursor:pointer;padding:4px 0;color:var(--leise)}
summary:focus-visible{outline:2px solid var(--akzent);outline-offset:2px}
.dateien{margin:8px 0;padding-left:18px;font-family:'JetBrains Mono',monospace;font-size:12px}
.kontrolle{background:var(--block);border-radius:8px;font-size:12px;color:var(--gedaempft)}

footer{color:var(--leise);font-size:12.5px;text-align:center}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="huelle">
  <header>
    <h1>Social-Studio</h1>
    <p>Lauf vom ${esc(datum)}</p>
    <div class="zahlen">
      <span class="zahl">${karten.length} Posts</span>
      <span class="zahl">${reels} Reels · ${karten.length - reels} Bilder</span>
      <span class="zahl">${nachApp.length} Apps</span>
    </div>
    <p class="hinweis">Caption kopieren, Datei aus dem Chat holen, posten.
      Bei Reels steht hier nur ein Standbild — die MP4-Dateien liegen als Anhang
      im Chat, der Dateiname steht unter „Dateien und Kontrolle“.</p>
  </header>
  ${kartenHtml}
  <footer>Erzeugt aus den Repos — kein Post wurde veröffentlicht.</footer>
</div>

<script>
document.querySelectorAll('.kopieren').forEach((b) => {
  b.addEventListener('click', async () => {
    const el = document.getElementById(b.dataset.ziel);
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.textContent);
      const alt = b.textContent;
      b.textContent = 'Kopiert';
      b.classList.add('fertig');
      setTimeout(() => { b.textContent = alt; b.classList.remove('fertig'); }, 1600);
    } catch {
      // Zwischenablage gesperrt (manche In-App-Browser): Text markieren,
      // damit von Hand kopiert werden kann.
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      b.textContent = 'Markiert';
    }
  });
});
</script>`;
}
