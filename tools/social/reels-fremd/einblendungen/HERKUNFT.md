# Herkunft: Einblendungen in den Typografie-Reels (make-reel.mjs)

## `swaply-nicotine.jpg`: echtes Foto eines Rauchers (seit 26.09.2026 abends)

**Josef, 26.09.2026:** „ich wollte eine echte person sehen und keine comicfigur“. Der erste
Raucher war aus der Comic-Vorlage abgeleitet; das Foto ersetzt ihn. Die Comic-Fassungen liegen
als `swaply-nicotine-comic.jpg` und `swaply-nicotine-ende-comic.jpg` daneben und werden nicht
mehr eingeblendet (`make-reel.mjs` sucht nur `swaply-<kategorie>.jpg` und `…-ende.jpg`).

- **Modell:** `fal-ai/flux-pro/v1.1-ultra`, `raw: true`, 9:16, ~0,06 $ je Bild.
- **Genommen:** Seed 9303. Filter im Mund, Glut außen, Rauch steigt von der Glut, fünf Finger.
- **Verworfen:**
  - 9301: Zeigefinger drückt gegen die Zigarette.
  - 9302: Filter zeigt nach außen.
  - 9304: in Ordnung, aber schwächer.
- **Prompt:** `swaply-raucher-foto-erzeugen.mjs raucher`.
- **Zuschnitt:** 1536×2752 mittig auf 9:16, dann 1080×1920.

⚠ **Fotorealistischer KI-Mensch → MIT AI-Plättchen.** `EINBLENDUNG_REALISTISCH` in
`make-reel.mjs` enthält `nicotine`; das Beiblatt meldet `ki-menschen (… Wasserzeichen gesetzt)`.

**Endbild (zerbrochene Zigarette) als Foto: gescheitert, vorerst ohne.** Mit
`fal-ai/flux-pro/kontext` auf Seed 9303 zwei Versuche (9401, 9402, je 0,04 $): Beide Male
steckte die Zigarette weiter im Mund, zerbrochen wurde nichts. Das Comic-Endbild neben das
Foto zu stellen, wäre ein Stilbruch; die Szene entfällt, bis ein brauchbares Foto da ist.
Das Reel läuft ohne sie: Impuls, Raucher, Schritte, Schluss.

**Kosten 26.09. abends:** 4 × ultra + 2 × kontext ≈ 0,32 $.

---

*Ab hier die Comic-Fassungen vom 26.09. nachmittags. Sie liegen weiter im Ordner, werden aber
nicht mehr eingeblendet. Die Dateinamen darunter sind die alten; heute heißen die Bilder
`…-comic.jpg`.*

## `swaply-nicotine-ende.jpg`: der Begleiter zerbricht eine Zigarette (vor dem Schluss)

*Bis 26.09. nachmittags hieß die Datei `swaply-nicotine.jpg` und war die einzige Einblendung.*

**Auftrag Josef, 26.09.2026:** „swaply bild von rauchendem mann einblenden“.
Auf Nachfrage gewählt: **„Mann mit Zigarette, die er weglegt/zerbricht“**. Kein Rauch und
kein Rauchen, weil TikTok Videos mit Tabakkonsum aus dem Für-dich-Feed nimmt und Instagram
sie drosselt.

- **Modell:** `fal-ai/flux-pro/kontext`, 9:16, je 0,04 $. Zwei Varianten, zusammen 0,08 $.
- **Vorlage:** `swaply/marketing/social/figuren/roh-begleiter.jpg`, derselbe Begleiter wie auf
  den Bildkarten, damit Figur und Stil gleich bleiben.
- **Genommen:** Seed 9102.
  **Verworfen:** Seed 9101, die KI hatte Flecken auf die Hände gemalt.
- **Prompt:** `swaply-zigarette-erzeugen.mjs` hier daneben.
- **Zuschnitt:** auf 1080×1920.

⚠ Comic-Figur: nach der Regel vom 26.09. abends **kein** AI-Plättchen (`ki-figur`).

⚠ **Nur für die Kategorie `nicotine`:** `make-reel.mjs` sucht `swaply-<kategorie>.jpg`. Eine
Zigarette über einem Alkohol- oder Zucker-Reel wäre falsch.

## `swaply-nicotine.jpg`: der Begleiter raucht (direkt nach „Wenn der Impuls kommt“)

**Josef, 26.09.2026:** „Nein du darfst mit fal.ai ein bild von einem raucher erstellen“.
Das Reichweiten-Risiko hat er gehört und nimmt es bewusst in Kauf: TikTok nimmt Videos mit
Tabakkonsum aus dem Für-dich-Feed, Instagram drosselt sie. Deshalb läuft das Bild nur in
der Nikotin-Kategorie.

- **Modell:** `fal-ai/flux-pro/kontext`, Vorlage `roh-begleiter.jpg`, 9:16. Zwei Varianten,
  zusammen 0,08 $.
- **Genommen:** Seed 9201.
  **Verworfen:** Seed 9202, außen fehlte die Glut, das Mundende sah aus, als brenne es im
  Mund.
- **Prompt:** `swaply-raucher-erzeugen.mjs`.

**Dramaturgie im Reel:** Impuls, dann Raucher, dann die Schritte aus der App, dann die
zerbrochene Zigarette, dann der Schluss.
