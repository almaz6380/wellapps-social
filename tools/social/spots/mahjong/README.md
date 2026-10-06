# Mahjong Royale — Werbespot „Das Erbe“ (05.10.2026)

15 s, 1080×1920, DE und EN. Fertig in `fertig/mahjong-spot-de.mp4` und `fertig/mahjong-spot-en.mp4`.
Von Josef abgenommen am 05.10.2026. **Gepostet: nein.**

| Zeit | Bild | Herkunft |
|---|---|---|
| 0–4 s | Opa zeigt dem Jungen den Drachenstein | `quellen/clip-1-opa-zeigt.mp4` |
| 4–7 s | Steine schweben in goldenem Licht | `quellen/clip-2-schweben.mp4` |
| 7–10 s | Junge spielt am Handy, Opa trinkt Tee | `quellen/clip-3-handy.mp4` |
| 10–12,5 s | echtes Spiel, letzte Paare | `quellen/spiel-lvl18.mp4` (Ausschnitt aus `mahjong-app` `record-solitaire`, Level 18) |
| 12,5–15 s | Endkarte | `endkarte.mjs` → `quellen/endkarte-{de,en}.png` |

Sprecher: DE „Manche Spiele vergisst man nie. … Mahjong Royale – jetzt kostenlos spielen.“,
EN „Some games you never forget. … Mahjong Royale, now free to play.“

## Erzeugt mit kie.ai

- Startbilder: `nano-banana-2`, 1K, 9:16, Referenzen `mahjong-app/scripts/reel/assets/einblendungen/{opa,junge}.jpg` (8 Credits je Bild).
- Clips: `wan/3-0-video`, 720P, 4 s, ohne Ton (64 Credits je Clip).
- Musik: Suno V5 über kie (Guzheng, Bambusflöte, Taiko), Ausschnitt 21–36 s aus `quellen/musik.mp3`.
- Sprecher: Gemini 3.1 Flash TTS über kie, Stimme Charon, `pace: Natural`. EN mit Vorgabe
  „mah-JONG“ (dsch wie in jungle, nicht das weiche zh).
- Gesamtkosten etwa 1,70 $ inklusive verworfener Versuche.

## Lehren

- **Sequenz 1, erster Versuch verworfen:** Der Stein stand im Startbild hochkant, Wan musste ihn
  ablegen und zeigte dabei zweimal die Vorderseite. Nano Banana malt den Stein nicht flach liegend.
  Lösung: Der Opa *zeigt* den Stein nur, er legt ihn nicht ab.
- Nicht innerhalb eines Satzes schneiden, sonst kippt die Betonung. Abschlusssatz als ein Satz sprechen lassen.
- Gemalter Stil, keine realistischen Menschen → **kein KI-Label**.

## Neu schneiden

```bash
node tools/social/spots/mahjong/endkarte.mjs   # nur nötig, wenn sich die Endkarte ändert
bash tools/social/spots/mahjong/schnitt.sh     # schreibt fertig/, zwei Lautheits-Durchgänge auf −14 LUFS
```
`endkarte.mjs` liest Schrift und Icon aus `/home/user/mahjong-app` und die Store-Knöpfe aus
`/home/user/anigosha/tools/reels/spot/badges/`.
