# Mahjong Royale — Werbespot „Steinregen“ (06.10.2026)

14,8 s, 1080×1920, DE und EN. Fertig in `fertig/mahjong-steinregen-de.mp4` und `fertig/mahjong-steinregen-en.mp4`.
**Abgenommen: noch nicht. Gepostet: nein.** Die Beiblätter für `spot-einreichen.mjs` liegen daneben.

Dieselben zwei Figuren wie im „Neonstreit“ (`../mahjong-neon/quellen/figurenblatt.png`) fliehen durch
eine Neongasse vor riesigen fallenden Mahjong-Steinen. Am Ende lösen sich die Steine in goldenes Licht auf.

| Zeit | Bild | Herkunft |
|---|---|---|
| 0–3,8 s | Flucht auf die Kamera zu, Steine stürzen | `quellen/clip-1.mp4` (0–3,8 s) |
| 3,5–6,1 s | Stein zerplatzt hinter ihnen in Goldstaub | `quellen/clip-2.mp4` (1,0–3,6 s; davor dreht die Perspektive) |
| 5,8–9 s | Steine lösen sich auf, beide lachen | `quellen/clip-3.mp4` (1,0–4,2 s; danach driftet sein Gesicht) |
| 8,7–11,1 s | echtes Spiel | `../mahjong/quellen/spiel-lvl18.mp4` |
| 10,8–14,8 s | Endkarte „Jedes Paar zählt.“ | `endkarte.mjs` |

Sprecher George (turbo): DE „Wenn die Steine fallen … musst du schnell sein. … Mahjong Royale – jetzt kostenlos spielen.“,
EN „When the tiles start falling … you had better be quick. … Mahjong Royale, now free to play.“
Der Schlusssatz ist derselbe wie im „Neonstreit“ (`vo-*-2.wav` von dort übernommen). Musik `../mahjong/quellen/musik.mp3` ab 20 s.

## Erzeugt mit fal.ai

- Startbilder: `fal-ai/nano-banana/edit` mit dem Figurenblatt. Bild 2 und 3 wurden je einmal neu erzeugt
  (`startbild-*-verworfen.png`: Neonschrift, aufrechter Stein, verdrehtes Bein).
- ⚠ **Nano Banana malt Mahjong-Steine immer mit Schriftzeichen**, auch bei der Vorgabe „Rückseite nach oben“.
  Josef hat sie am 06.10. akzeptiert: Echte Steine tragen Zeichen, im Actionclip fällt das kaum auf.
  Auch in Clip 2 tauchen im Hintergrund Schilder mit erfundenen Zeichen auf.
- Clips: `xai/grok-imagine-video/image-to-video`, 6 s, 480p.
- Gesamtkosten gemessen: 1,11 $ (fal-Guthaben vorher 2,26 $, nachher 1,15 $).

## Regeln

- **Fotorealistische KI-Menschen → `ki-menschen`.** Es gibt kein Wasserzeichen im Video. Das KI-Label setzt Josef beim Posten.
- Mahjong Royale hat kein Fallende-Steine-Spiel. Die Szene ist ein Bild für „schnell Paare finden“ und behauptet keinen Spielmodus.

## Neu schneiden

```bash
node tools/social/spots/mahjong-steinregen/endkarte.mjs
bash tools/social/spots/mahjong-steinregen/schnitt.sh
```
