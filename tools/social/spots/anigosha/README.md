# Anigosha — Werbespot „Duell um Mitternacht“ (06.10.2026)

15,4 s, 1080×1920, DE und EN. Fertig in `fertig/anigosha-spot-de.mp4` und `fertig/anigosha-spot-en.mp4`.
**Abgenommen: noch nicht. Gepostet: nein.**

| Zeit | Bild | Herkunft |
|---|---|---|
| 0–3,7 s | Der Junge auf dem Hochhausdach, Regen, das Handy leuchtet | `quellen/clip-1.mp4` |
| 3,4–7 s | Rin, Wind, Zoom aufs Gesicht | `quellen/clip-2.mp4` (Ausschnitt 2,0–5,6 s) |
| 6,7–10,1 s | Tipp aufs Handy, Lichtexplosion | `quellen/clip-3.mp4` |
| 9,8–12,6 s | echter Duell-Bildschirm, Nachthimmel, Frage zu One Piece, richtige Antwort | `quellen/app-{de,en}-{a,b,c}.png` |
| 12,3–15,4 s | Endkarte | `endkarte.mjs` → `quellen/endkarte-{de,en}.png` |

Sprecher: ElevenLabs Turbo v2.5 „George“ über fal. Jeder Satz wurde einzeln erzeugt und nicht innerhalb geschnitten.
DE „Du glaubst, du kennst Anime? … Beweis es. … Anigosha. Das Anime-Quiz mit Duellen. Kostenlos.“
EN „Think you know anime? … Prove it. … Anigosha. The anime quiz with duels. Free.“

## Erzeugt mit fal.ai

- Startbilder: `fal-ai/nano-banana/edit`, 9:16, Referenzen `anigosha/store-assets/social/figuren/junge.png`
  und `anigosha/tools/reels/spot/referenz/0-charakterblatt.jpg` (0,039 $ je Bild).
- Clips: `xai/grok-imagine-video/image-to-video`, 6 s, 480p (0,30 $ je Clip, kommt als 416×720).
- Musik und Klänge: vorhanden aus `anigosha/tools/reels/assets/sfx/` (`anisong` ab 26 s, whoosh, hook-hit, correct).
- Gesamtkosten gemessen: 1,04 $ (fal-Guthaben vorher 4,41 $, nachher 3,37 $).

## App-Bildschirm

Aufgenommen im Prüfstand von Anigosha (`npx vite --config vite.pruefstand.config.ts --port 4501`).
Die Uhrzeit ist auf 23 Uhr festgelegt, damit der Nachthimmel erscheint. Die Attrappe
`.pruefstand/stubs/duel.ts` liefert eine echte Frage, wenn `localStorage['spot.frage']` gesetzt ist.
Das alte `template-duell.mjs` wurde nicht benutzt, weil es noch das Dunkelviolett von vor
„Himmel überall“ zeigt.

## Regeln

- Nur eigene Figuren (Anigosha-Junge, Rin). Keine fremden Anime-Figuren, keine Serientitel im Bild.
  Dass die Quizfrage eine Serie als Text nennt, ist erlaubt.
- Anime-Stil, keine realistischen Menschen → **kein KI-Label**.

## Neu schneiden

```bash
node tools/social/spots/anigosha/endkarte.mjs   # nur nötig, wenn sich die Endkarte ändert
bash tools/social/spots/anigosha/schnitt.sh     # schreibt fertig/, zwei Lautheits-Durchgänge auf −14 LUFS
```
