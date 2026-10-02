# Herkunft: Szenen vor den Swaply-Reels (`--vorspann`)

**Auftrag Josef, 27.09.2026:** „nicht immer zigaretten. wir brauchen abwechslung"
→ drei Szenen (Handy, Zucker, Alkohol). Das Rezept stammt von Mahjongs bestem
Beitrag (18.08., 1103 Aufrufe): erst ein paar Sekunden Bild, dann der Inhalt.

## Heute: Stillleben OHNE Menschen, mit Kamerafahrt

| Datei | Motiv | Seed | Kategorie / Format |
|---|---|---|---|
| `swaply-handy-bild.jpg/.mp4` | Nachttisch bei Nacht: Handy liegt aus, daneben ein aufgeschlagenes Buch und eine Lampe | 9601 | `doomscrolling` / tausch-loop |
| `swaply-zucker-bild.jpg/.mp4` | Heller Küchentisch: roter Apfel vorn, Schokolade beiseite | 9602 | `sugar` / tausch-loop |
| `swaply-alkohol-bild.jpg/.mp4` | Abendlicht: leeres Weinglas neben einem Glas Wasser mit Zitrone und Eis | 9602 | `alcohol` / notfall-loop |

- **Modell:** `fal-ai/flux-pro/v1.1-ultra`, 9:16. Je 2 Kandidaten, 0,36 $.
  Verworfen wurde Zucker 9601: Der obere Apfel hatte einen weißen Fleck.
- **Bewegung:** kein KI-Video. `ffmpeg zoompan` fährt in 5 s von 100 auf 110 %.
  So kann nichts verzerren.
- **Negativprompt im Text:** No people, no hands, no fingers, no body parts, no
  text, no logos, no labels.
- **Kennzeichnung:** Das Beiblatt meldet `ki-bild (… ohne Menschen, kein
  Plättchen)` (Flag `--vorspann-ohne-menschen`, Winkelfeld
  `vorspann_menschen: false`).

## Verworfen (27.09.2026): KI-Video und Hände

Die erste Fassung bestand aus Kling-2.1-Clips mit einer fotorealistischen Hand
(1,20 $). Josef: „alle swaply clips sind so schlecht produziert mit ki fehler".
Danach kamen Standbilder derselben Szenen mit Hand. Josef: „hand am weinglas hat
einen ki fehler!!!!". Beim Nachsehen stimmte das: Der Stiel ging falsch durch die
Hand, und am Bildrand ragte eine zweite, halbe Hand ins Bild. Auch die Hand am
Handy war unsauber.

**Merksatz:** Keine Hände und keine Menschen in KI-Bildern für Swaply. Das Modell
verpfuscht sie verlässlich, und jeder Fehler landet öffentlich.

## Seit 02.10.2026: KI-Video wieder, aber OHNE Menschen

Josef: „swaply mit videos! gerne mit fal.ai!!!" — Freigabe für ≈ 0,70 $ („ja").

| Datei | Motiv | Startbild | Clip |
|---|---|---|---|
| `swaply-handy-ki.jpg/.mp4` | Nachttisch im Morgenlicht: Handy liegt still auf einem offenen Buch, daneben dampfender Tee, Vorhang | `flux-pro/v1.1-ultra`, Seed 9701 | `kling-video/v2.1/standard/image-to-video`, 5 s |
| `swaply-alkohol-ki.jpg/.mp4` | Bar-Theke am Abend: Glas Sprudelwasser mit Zitrone und Eis, Bläschen steigen | `flux-pro/v1.1-ultra`, Seed 9702 | `kling-video/v2.1/standard/image-to-video`, 5 s |

Kosten: 2 × 0,06 $ + 2 × 0,28 $ ≈ 0,68 $. Bewegung nur durch Dampf, Bläschen,
Licht und eine langsame Kamerafahrt; Negativprompt „people, hands, fingers, body
parts, text, logo, morphing". **Geprüft:** je 10 Bilder im Halbsekundenabstand —
nichts verzerrt, keine Hände, keine Schrift. Auf 1080×1920 gebracht (CRF 20, ohne Ton).
Winkel: `film-handy-ki` (tausch-loop/doomscrolling), `film-alkohol-ki` (notfall-loop/alcohol).
