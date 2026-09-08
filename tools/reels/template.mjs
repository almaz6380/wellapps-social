// Baut die HTML-Seite, die abfotografiert wird — 1080×1920.
//
// WICHTIG: Es gibt keine CSS-Animation und kein setTimeout. Alles hängt an
// window.setFrame(n). Nur so ist jeder Frame reproduzierbar und es fällt keiner
// aus. Wer hier eine CSS-Animation einbaut, macht den Renderer kaputt.
//
// Die Seite wird per page.setContent() geladen und hat deshalb keinen Origin:
// Schrift und Logo MÜSSEN als data:-URI eingebettet sein (file:// lädt nicht).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));

export const BREITE = 1080;
export const HOEHE = 1920;

function assets() {
  const font = readFileSync(join(HIER, 'assets', 'outfit.woff2')).toString('base64');
  const logo = readFileSync(join(HIER, '..', '..', 'public', 'favicon.svg')).toString('base64');
  return { font, logo: `data:image/svg+xml;base64,${logo}` };
}

// JSON sicher in ein <script> einbetten
const einbetten = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

export function baueHtml(storyboard) {
  const { font, logo } = assets();

  return `<!doctype html>
<meta charset="utf-8">
<style>
@font-face {
  font-family: 'Outfit';
  src: url(data:font/woff2;base64,${font}) format('woff2');
  font-weight: 100 900;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: ${BREITE}px; height: ${HOEHE}px; overflow: hidden;
  font-family: 'Outfit', system-ui, sans-serif;
  color: #ede9fe; background: #0f0a1e;
  -webkit-font-smoothing: antialiased;
}
#buehne { position: relative; width: ${BREITE}px; height: ${HOEHE}px; }

/* --- Hintergrund: Marken-Verlauf aus tools/feature-graphic.mjs --- */
#grund {
  position: absolute; inset: 0;
  background: linear-gradient(115deg, #0f0a1e 0%, #17102c 38%, #3b1d6b 72%, #7c3aed 100%);
}
.glow { position: absolute; border-radius: 50%; filter: blur(90px); }
#glow1 { width: 900px; height: 900px; background: rgba(236,72,153,.42); left: -180px; top: 980px; }
#glow2 { width: 820px; height: 820px; background: rgba(139,92,246,.38); right: -220px; top: -120px; }
#vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,.55) 100%);
}

/* --- Fortschrittsbalken ganz oben: zeigt, dass es gleich vorbei ist --- */
#fortschritt { position: absolute; top: 0; left: 0; height: 9px; width: 0;
  background: linear-gradient(90deg, #a78bfa, #f472b6); }

/* --- Markenzeile oben --- */
#marke { position: absolute; top: 54px; left: 0; width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 18px; opacity: .92; }
#marke img { width: 54px; height: 54px; }
#marke span { font-size: 30px; font-weight: 700; letter-spacing: .32em; color: #d8ccff; }

/* --- Fußzeile --- */
#fuss { position: absolute; top: 1560px; left: 0; width: 100%; text-align: center;
  font-size: 30px; font-weight: 500; color: rgba(237,233,254,.62); letter-spacing: .04em; }

/* --- Ebenen --- */
.ebene { position: absolute; inset: 0; display: none; }
.ebene.an { display: block; }

/* --- Hook / Outro --- */
.mitte { position: absolute; left: 90px; width: 900px; text-align: center; }
#hookTitel { top: 560px; font-size: 104px; font-weight: 800; line-height: 1.08; letter-spacing: -.02em;
  background: linear-gradient(100deg, #a78bfa, #f472b6); -webkit-background-clip: text;
  background-clip: text; color: transparent; }
#hookSub { top: 1060px; font-size: 40px; font-weight: 500; color: rgba(237,233,254,.78); }
#hookLogo { position: absolute; left: 420px; top: 300px; width: 240px; height: 240px; }

#outroTitel { top: 520px; font-size: 96px; font-weight: 800; line-height: 1.1; letter-spacing: -.02em;
  background: linear-gradient(100deg, #a78bfa, #f472b6); -webkit-background-clip: text;
  background-clip: text; color: transparent; }
#outroSub { top: 900px; font-size: 38px; font-weight: 500; color: rgba(237,233,254,.8); line-height: 1.5; }
#outroCta { position: absolute; left: 140px; top: 1080px; width: 800px; padding: 34px 0;
  border-radius: 999px; text-align: center; font-size: 44px; font-weight: 700; color: #17102c;
  background: linear-gradient(100deg, #a78bfa, #f472b6); }
/* Store-Badges statt der Textpille. Sie stehen UNTEREINANDER (Josefs Wunsch,
   18.08.) und mittig; die Höhe ist fest, die Breite ergibt sich aus dem Bild —
   so bleibt jedes Badge in seinem eigenen Seitenverhältnis. Apple und Google
   verbieten in ihren Richtlinien beides: verzerren und nachzeichnen. */
#outroBadges { position: absolute; left: 0; top: 1060px; width: 1080px;
  display: none; flex-direction: column; align-items: center; gap: 26px; }
#outroBadges img { height: 128px; width: auto; display: block; }
#outroBadges.an { display: flex; }
#outroCta.aus { display: none; }
#outroKommentar { top: 1260px; font-size: 38px; font-weight: 600; color: #f9a8d4; }
/* Mit Badges rutscht die Sprachzeile unter den zweiten Knopf. */
#outroKommentar.tiefer { top: 1400px; }
#outroLogo { position: absolute; left: 430px; top: 270px; width: 220px; height: 220px; }

/* --- Fragenebene --- */
#kopf { position: absolute; top: 196px; left: 80px; display: flex; gap: 18px; align-items: center; }
.chip { padding: 16px 32px; border-radius: 999px; font-size: 32px; font-weight: 600;
  background: rgba(255,255,255,.12); border: 2px solid rgba(255,255,255,.16); color: #ede9fe; }
.chip.stufe { background: rgba(236,72,153,.22); border-color: rgba(244,114,182,.45); color: #f9a8d4; }
#zaehler { position: absolute; top: 300px; left: 80px; font-size: 30px; font-weight: 600;
  letter-spacing: .16em; color: rgba(237,233,254,.55); text-transform: uppercase; }

#frage { position: absolute; top: 372px; left: 80px; width: 780px;
  font-size: 62px; font-weight: 700; line-height: 1.2; letter-spacing: -.01em; }

/* Countdown-Ring oben rechts — dort liegt keine Bedienoberfläche der Apps */
#ring { position: absolute; top: 186px; left: 872px; width: 136px; height: 136px; }
#ringZahl { position: absolute; top: 186px; left: 872px; width: 136px; height: 136px;
  display: flex; align-items: center; justify-content: center;
  font-size: 58px; font-weight: 800; color: #fff; }

#antworten { position: absolute; top: 720px; left: 80px; width: 920px; }
.antwort { position: relative; height: 150px; margin-bottom: 22px; border-radius: 28px;
  display: flex; align-items: center; padding: 0 34px; gap: 28px;
  background: rgba(255,255,255,.09); border: 3px solid rgba(255,255,255,.14); }
.antwort .buchstabe { width: 74px; height: 74px; flex: none; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  font-size: 36px; font-weight: 800; background: rgba(255,255,255,.14); color: #ede9fe; }
.antwort .text { font-size: 42px; font-weight: 600; line-height: 1.15; }
.antwort.richtig { background: rgba(52,211,153,.22); border-color: #34d399; }
.antwort.richtig .buchstabe { background: #34d399; color: #06281c; }

#erklaerung { position: absolute; top: 940px; left: 80px; width: 920px;
  border-radius: 32px; padding: 40px 44px;
  background: rgba(15,10,30,.72); border: 3px solid rgba(167,139,250,.42); }
#erklaerungTitel { font-size: 34px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
  color: #f9a8d4; margin-bottom: 18px; }
#erklaerungText { font-size: 40px; font-weight: 500; line-height: 1.35; color: #ede9fe; }
</style>

<div id="buehne">
  <div id="grund"></div>
  <div class="glow" id="glow1"></div>
  <div class="glow" id="glow2"></div>
  <div id="vignette"></div>

  <div class="ebene" id="ebeneHook">
    <img id="hookLogo" src="${logo}">
    <div class="mitte" id="hookTitel"></div>
    <div class="mitte" id="hookSub"></div>
  </div>

  <div class="ebene" id="ebeneFrage">
    <div id="kopf">
      <div class="chip" id="chipSerie"></div>
      <div class="chip stufe" id="chipStufe"></div>
    </div>
    <div id="zaehler"></div>
    <div id="frage"></div>
    <svg id="ring" viewBox="0 0 136 136">
      <circle cx="68" cy="68" r="60" fill="rgba(15,10,30,.55)" stroke="rgba(255,255,255,.16)" stroke-width="10"/>
      <circle id="ringBogen" cx="68" cy="68" r="60" fill="none" stroke="#f472b6" stroke-width="10"
              stroke-linecap="round" transform="rotate(-90 68 68)"/>
    </svg>
    <div id="ringZahl"></div>
    <div id="antworten"></div>
    <div id="erklaerung">
      <div id="erklaerungTitel"></div>
      <div id="erklaerungText"></div>
    </div>
  </div>

  <div class="ebene" id="ebeneOutro">
    <img id="outroLogo" src="${logo}">
    <div class="mitte" id="outroTitel"></div>
    <div class="mitte" id="outroSub"></div>
    <div id="outroCta"></div>
    <div id="outroBadges"><img id="badgeApple"><img id="badgePlay"></div>
    <div class="mitte" id="outroKommentar"></div>
  </div>

  <div id="fortschritt"></div>
  <div id="marke"><img src="${logo}"><span>ANIGOSHA</span></div>
  <div id="fuss"></div>
</div>

<script>
const SB = ${einbetten(storyboard)};
const BUCHSTABEN = ['A', 'B', 'C', 'D'];
const UMFANG = 2 * Math.PI * 60;

const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const zeilen = (s) => String(s).split('\\n').join('<br>');

let aktBlock = -1;

// Baut die Antwortzeilen neu — nur beim Blockwechsel, nicht je Frame.
function antwortenAufbauen(block) {
  $('antworten').innerHTML = block.optionen.map((o, i) =>
    '<div class="antwort" data-i="' + i + '">' +
      '<div class="buchstabe">' + BUCHSTABEN[i] + '</div>' +
      '<div class="text">' + o.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>' +
    '</div>').join('');
}

function blockSetzen(idx) {
  const b = SB.bloecke[idx];
  aktBlock = idx;
  $('ebeneHook').classList.toggle('an', b.typ === 'hook');
  $('ebeneFrage').classList.toggle('an', b.typ === 'frage');
  $('ebeneOutro').classList.toggle('an', b.typ === 'outro');

  if (b.typ === 'hook') {
    $('hookTitel').innerHTML = zeilen(b.titel);
    $('hookSub').innerHTML = zeilen(b.sub);
  } else if (b.typ === 'outro') {
    $('outroTitel').innerHTML = zeilen(b.titel);
    $('outroSub').innerHTML = zeilen(b.sub);
    $('outroCta').textContent = b.cta;
    // Liegen Badges an, ersetzen sie die Textpille — sonst bleibt alles wie
    // bisher. Deshalb funktionieren die Quiz-Reels unveraendert weiter, die
    // dieses Outro mitbenutzen und keine Badges mitgeben.
    if (b.badges && b.badges.apple && b.badges.play) {
      $('badgeApple').src = b.badges.apple;
      $('badgePlay').src = b.badges.play;
      $('outroBadges').classList.add('an');
      $('outroCta').classList.add('aus');
      $('outroKommentar').classList.add('tiefer');
    }
    $('outroKommentar').textContent = b.kommentar;
  } else {
    $('chipSerie').textContent = b.serie;
    $('chipStufe').textContent = b.stufe;
    $('zaehler').textContent = b.label;
    $('frage').textContent = b.prompt;
    $('erklaerungTitel').textContent = b.wusstest;
    $('erklaerungText').textContent = b.erklaerung;
    antwortenAufbauen(b);
  }
}

window.setFrame = function (n) {
  n = Math.max(0, Math.min(SB.gesamtFrames - 1, n));

  // Fortschrittsbalken + leichte Bewegung im Hintergrund (sonst wirkt es wie ein Standbild)
  $('fortschritt').style.width = (n / SB.gesamtFrames * ${BREITE}) + 'px';
  $('glow1').style.transform = 'translate(' + Math.sin(n / 95) * 46 + 'px,' + Math.cos(n / 130) * 34 + 'px)';
  $('glow2').style.transform = 'translate(' + Math.cos(n / 110) * 40 + 'px,' + Math.sin(n / 88) * 30 + 'px)';

  const idx = SB.bloecke.findIndex((b) => n >= b.start && n < b.ende);
  const b = SB.bloecke[idx];
  if (idx !== aktBlock) blockSetzen(idx);
  const f = n - b.start;

  $('fuss').textContent = b.typ === 'frage' ? SB.fussFrage : '';

  if (b.typ === 'hook') {
    const e = easeOut(f / 14);
    $('hookLogo').style.opacity = e;
    $('hookLogo').style.transform = 'scale(' + (.72 + .28 * e) + ')';
    const e2 = easeOut((f - 5) / 16);
    $('hookTitel').style.opacity = e2;
    $('hookTitel').style.transform = 'translateY(' + (44 * (1 - e2)) + 'px)';
    const e3 = easeOut((f - 14) / 16);
    $('hookSub').style.opacity = e3 * .95;
    return;
  }

  if (b.typ === 'outro') {
    const e = easeOut(f / 16);
    $('outroLogo').style.opacity = e;
    $('outroLogo').style.transform = 'scale(' + (.78 + .22 * e) + ')';
    $('outroTitel').style.opacity = easeOut((f - 4) / 16);
    $('outroSub').style.opacity = easeOut((f - 12) / 16) * .9;
    const e4 = easeOut((f - 18) / 16);
    $('outroCta').style.opacity = e4;
    $('outroCta').style.transform = 'scale(' + (.9 + .1 * e4) + ')';
    // sanftes Pochen auf dem Knopf, damit das Auge dort landet
    const puls = 1 + .022 * Math.sin((f - 18) / 4.5);
    if (f > 34) $('outroCta').style.transform = 'scale(' + puls + ')';
    // Die Badges blenden gleich ein, pochen aber NICHT: Apple und Google
    // untersagen jede Veraenderung ihrer Badges, und eine laufende Skalierung
    // ist genau das. Das zweite kommt vier Bilder spaeter, damit sie nacheinander
    // stehen statt als ein Block aufzuploppen.
    $('badgeApple').style.opacity = e4;
    $('badgePlay').style.opacity = easeOut((f - 22) / 16);
    $('outroKommentar').style.opacity = easeOut((f - 30) / 16) * .95;
    return;
  }

  // ---- Fragenblock ----
  const P = SB.phasen;
  const tFrage = 0;
  const tAntw = tFrage + P.frageEin;
  const tCount = tAntw + P.antworten;
  const tReveal = tCount + P.countdown;
  const tErkl = tReveal + P.reveal;

  // Kopf + Frage
  const eKopf = easeOut(f / 12);
  $('kopf').style.opacity = eKopf;
  $('zaehler').style.opacity = eKopf * .9;
  const eF = easeOut(f / 16);
  $('frage').style.opacity = eF;
  $('frage').style.transform = 'translateY(' + (36 * (1 - eF)) + 'px)';

  const inErkl = f >= tErkl;
  const eErkl = easeOut((f - tErkl) / 12);

  // Antworten: versetzt herein, bei der Auflösung einfärben, danach ausblenden
  const reihen = document.querySelectorAll('#antworten .antwort');
  reihen.forEach((el, i) => {
    const eIn = easeOut((f - tAntw - i * 4) / 12);
    let op = eIn;
    let dx = 60 * (1 - eIn);
    let dy = 0;
    let sc = 1;

    const richtig = i === b.correctIndex;
    el.classList.toggle('richtig', f >= tReveal && richtig);

    if (f >= tReveal && !richtig) op = Math.max(.18, 1 - easeOut((f - tReveal) / 10) * .82);
    if (f >= tReveal && richtig) sc = 1 + .045 * easeOut((f - tReveal) / 8) * (1 - easeOut((f - tReveal - 10) / 14));

    if (inErkl) {
      if (!richtig) { op *= 1 - eErkl; dy = -30 * eErkl; }
      else { dy = -(i * 172) * eErkl; }  // richtige Zeile rutscht nach ganz oben
    }

    el.style.opacity = op;
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')';
  });

  // Countdown-Ring
  const zeigen = f >= tCount && f < tReveal;
  const rest = zeigen ? 1 - (f - tCount) / P.countdown : (f < tCount ? 1 : 0);
  $('ring').style.opacity = zeigen ? 1 : 0;
  $('ringZahl').style.opacity = zeigen ? 1 : 0;
  $('ringBogen').setAttribute('stroke-dasharray', UMFANG);
  $('ringBogen').setAttribute('stroke-dashoffset', UMFANG * (1 - rest));
  $('ringBogen').setAttribute('stroke', rest < .3 ? '#fb7185' : '#f472b6');
  $('ringZahl').textContent = zeigen ? Math.max(1, Math.ceil(rest * P.countdown / SB.fps)) : '';
  const pulse = zeigen && rest < .35 ? 1 + .07 * Math.abs(Math.sin((f - tCount) / 3.2)) : 1;
  $('ring').style.transform = 'scale(' + pulse + ')';
  $('ringZahl').style.transform = 'scale(' + pulse + ')';

  // Erklärungskarte
  $('erklaerung').style.opacity = inErkl ? eErkl : 0;
  $('erklaerung').style.transform = 'translateY(' + (inErkl ? 54 * (1 - easeInOut(clamp((f - tErkl) / 14))) : 54) + 'px)';
};

window.setFrame(0);
document.fonts.ready.then(() => { window.__bereit = true; });
</script>
`;
}
