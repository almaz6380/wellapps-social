# Herkunft: Einblendungen in den Typografie-Reels (make-reel.mjs)

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

⚠ **KI-Mensch:** Im Reel sitzt das AI-Plättchen, und das Beiblatt meldet
`ki-menschen (… Wasserzeichen gesetzt)`.

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
