# Mahjong Royale — Werbespot „Neonstreit“ (06.10.2026)

15 s, 1080×1920, DE und EN. Fertig in `fertig/mahjong-neon-de.mp4` und `fertig/mahjong-neon-en.mp4`.
**Abgenommen: noch nicht. Gepostet: nein.**

Zwei Nachbarn streiten sich im Neonflur eines Wohnhauses. Sie hält ihm das Handy hin, er stutzt,
am Ende sitzen beide lachend auf der Treppe über einer Runde Mahjong.

| Zeit | Bild | Herkunft |
|---|---|---|
| 0–3,5 s | Streit im Flur | `quellen/clip-1.mp4` (0–3,5 s) |
| 3,2–6,7 s | Sie hält ihm das Handy hin | `quellen/clip-2.mp4` (0,4–3,9 s; danach driftet sein Gesicht) |
| 6,4–9,8 s | Beide lachend auf der Treppe | `quellen/clip-3.mp4` (1,0–4,4 s) |
| 9,5–11,9 s | echtes Spiel, die letzten Paare | `../mahjong/quellen/spiel-lvl18.mp4` |
| 11,6–15 s | Endkarte | `endkarte.mjs` → `quellen/endkarte-{de,en}.png` |

Sprecher: ElevenLabs Turbo v2.5 „George“ über fal, jeder Satz einzeln.
DE „Manche Streits löst man nicht mit Worten, sondern mit einer Runde Mahjong. … Mahjong Royale – jetzt kostenlos spielen.“
EN „Some arguments aren't settled with words, but with one round of Mahjong. … Mahjong Royale, now free to play.“
⚠ Seit 08.10. ist der erste Satz EINE Aufnahme (`vo-*-0.wav`). Vorher waren es zwei Stücke, und der Satz
endete bei „Runde“ / „one round“ — das Wort „Mahjong“ fehlte (Josef). Das erste whoosh entfällt dabei,
weil es sonst mitten im Satz läge.
Musik: `../mahjong/quellen/musik.mp3` ab 5 s.

## Erzeugt mit fal.ai

- Figurenblatt: `fal-ai/nano-banana`, 16:9 → `quellen/figurenblatt.png`. Die beiden Figuren sind erfunden.
- Startbilder: `fal-ai/nano-banana/edit`, 9:16, mit dem Figurenblatt als Referenz. Bild 2 musste einmal neu:
  `startbild-2-verworfen.png` hatte Neonschrift, die Handyrückseite zeigte zur Kamera, beide posierten frontal.
- Clips: `xai/grok-imagine-video/image-to-video`, 6 s, 480p.
- Gesamtkosten gemessen: 1,11 $ (fal-Guthaben vorher 3,37 $, nachher 2,26 $).

## Regeln

- **Fotorealistische KI-Menschen → `ki-menschen`.** Es gibt kein Wasserzeichen im Video. Das KI-Label
  setzt Josef beim Posten in TikTok und Instagram selbst (seine Regel vom 27.09.2026).
- Mahjong Royale hat kein Online-Duell. Der Spot zeigt deshalb beide gemeinsam an einem Handy und
  behauptet kein Spiel gegeneinander.
- Neon nur abstrakt, ohne Schrift. Hände möglichst nicht im Vordergrund.

## Neu schneiden

```bash
node tools/social/spots/mahjong-neon/endkarte.mjs   # nur nötig, wenn sich die Endkarte ändert
bash tools/social/spots/mahjong-neon/schnitt.sh     # schreibt fertig/, zwei Lautheits-Durchgänge auf −14 LUFS
```
