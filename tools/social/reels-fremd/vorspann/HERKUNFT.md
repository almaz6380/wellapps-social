# Herkunft: Filmszenen vor den Swaply-Reels (`--vorspann`)

**Auftrag Josef, 27.09.2026:** „nicht immer zigaretten. wir brauchen abwechslung"
→ drei Vorschläge (Handy, Zucker, Alkohol) → „ja mach swaply alle drei". Das
Rezept stammt von Mahjongs bestem Beitrag (18.08., 1103 Aufrufe): zuerst ein paar
Sekunden Film, dann der Inhalt.

| Datei | Szene | Startbild | Kategorie / Format |
|---|---|---|---|
| `swaply-handy.mp4` | Nachts legt eine Hand das leuchtende Handy auf den Nachttisch und greift zum Buch | flux-pro 1.1 ultra, Seed 9502 | `doomscrolling` / tausch-loop |
| `swaply-zucker.mp4` | Eine Hand tippt die Schokolade an und greift zum Apfel | Seed 9501 | `sugar` / tausch-loop |
| `swaply-alkohol.mp4` | Eine Hand dreht das leere Weinglas um und greift zum Wasser mit Zitrone | Seed 9501 | `alcohol` / notfall-loop |

- **Modelle:** `fal-ai/flux-pro/v1.1-ultra` (9:16, 6 Bilder à 0,06 $, das jeweils
  bessere genommen) und `fal-ai/kling-video/v2.1/standard/image-to-video` (5 s,
  3 × 0,28 $). Zusammen **1,20 $**.
- **Negativprompt (Clip):** extra fingers, deformed hand, morphing, melting objects,
  text, letters, logos, watermark, blur, face.
- **Geprüft** im Halbsekundenabstand. Bekannte Schwächen, von Josef so abgenommen:
  Das Handy landet mit dem Bildschirm nach oben und leuchtet weiter. Das Weinglas
  verzieht sich beim Drehen für einen Augenblick.
- Auf 1080×1920 gebracht (CRF 20), ohne Ton. Die Swaply-Reels sind stumm, den Sound
  legt Josef in der App darüber.

⚠ **Kein AI-Plättchen im Bild** (Josef, 27.09.2026: „das ki wasserzeichen ist aber
nicht notwendig"). Das KI-Label setzt er beim Posten in TikTok und Instagram. Das
Beiblatt erinnert daran („KI-LABEL SETZEN“) und meldet `ki-menschen (… KI-Label
beim Posten setzen)`. `vorflug.mjs` lässt genau diese Form ohne Plättchen durch.
