# FullRep — „Studie erklärt“ (Format vom 05./06.10.2026)

Wissensreel nach dem Vorbild der heft.workout-Videos, aber eigenes Design (FullRep-Farben):
Mythos-Hook mit Stempel → Die Studie → Das Ergebnis → Der Haken / Der Grund →
Für dein Training (3 Schritte) → Endkarte mit einem Programm oder einer Übung, die es in FullRep wirklich gibt.
Wort-für-Wort-Untertitel, Fortschrittsbalken, FullRep-Musik leise und unter der Stimme abgesenkt, −14 LUFS.

```bash
node tools/social/studie-erklaert/engine.mjs trizeps --stand   # nur Standbogen zum Prüfen
node tools/social/studie-erklaert/engine.mjs trizeps           # → fertig/fullrep-studie-trizeps.mp4
```
Braucht `FAL_KEY` (Stimme) und das FullRep-Repo unter `/home/user/mypeak` (Schriften, Icon, Badges;
anders über `FULLREP_PFAD`). Zwischenstände liegen in `out/` (nicht im Repo).

| Reel | Studie | Stand |
|---|---|---|
| `gibala` | Gibala 2006, Sprint-Intervalle (aus `mypeak` STUDY-Bibliothek) | fertig, 34 s, nicht gepostet |
| `trizeps` | Maeo et al. 2023, Eur J Sport Sci, PMID 35819335 | fertig, 35 s, nicht gepostet |

## Regeln

- **Keine Zahl erfinden.** Zahlen kommen aus `mypeak/src/data/peakPrograms.js` oder aus dem
  Original-Abstract bei PubMed; die Quelle steht im Drehbuch als Kommentar.
- Muskel-Animationen sind stilisierte Anatomie (Halbton-Punkte, bernsteinfarben), kein echter Mensch → kein KI-Label.
  Beschriftungen setzt der Renderer als echte Schrift, nie die KI.
- Länge 35–42 s. Verworfen am 06.10.: Tabata, 80/20 und 1×/2× pro Woche (Josef: „schlecht“).
  Neue Reels sollen sich auf **einen Muskel** stützen.

## Stimme: ElevenLabs Turbo v2.5 „George“ über fal

0,05 $ je 1000 Zeichen, ein Reel ≈ 2,5 Cent. Josef hat sie am 06.10. aus 26 Proben gewählt.
Durchgefallen: Gemini über kie (Charon, Puck, Kore, Fenrir, Orus, Enceladus, Algenib, Sadaltager u. a.,
auch tiefer gepitcht), MiniMax (deutsche und „Deep Voice“-Stimmen), ElevenLabs Brian, Daniel, Liam,
Roger, Adam, Bill. Gemini kommt nur in 24 kHz und klang zusätzlich beschleunigt dumpf — deshalb
wird **nicht mehr beschleunigt**, nur lange Pausen auf 0,25 s gekürzt, Hochpass 70 Hz, Präsenz +3 dB.

## Muskel-Animation (kie.ai)

- Bild `nano-banana-2`, 1K, 9:16 (8 Credits) → `quellen/trizeps-seite.jpg`.
  ⚠ Ganzkörper-Posen gehen schief (erster Versuch: drei Arme). Nur ein Körperteil, nüchtern beschrieben.
- Bewegung `grok-imagine/image-to-video`, 6 s, 480p = **14,4 Credits** (gemessen) → `quellen/trizeps-seite-480p.mp4`.
  480p reicht laut Josef. `bytedance/v1-lite` brach mit 500 ab.
- Der Renderer zerlegt den Clip in Einzelbilder und blendet sie zeitgenau ein (kein `<video>`), Szenentyp `clip`.

Nächster Kandidat: Beinbeuger sitzend vs. liegend (Maeo et al. 2021, Med Sci Sports Exerc, PMID 33009197:
+14 % vs. +9 %, 20 Personen, 12 Wochen, 2×/Woche, 5 × 10). Übungen `seated-leg-curl`/`lying-leg-curl` gibt es in FullRep.
