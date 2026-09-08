> ⚠ **Das ist die Kopie aus `almaz6380/anigosha`** (Stand 08.09.2026, ohne
> `fertig/` und `spot/` — die fertigen Anigosha-Videos und der Werbespot sind
> dort geblieben). Anigoshas eigene Reels rendert der Tageslauf aus dem
> anigosha-Checkout, nicht von hier. Gebraucht wird diese Kopie von
> `tools/social/reels-fremd/` (Swaply, WELLbooked!) und `tools/social/tiktok-demo/`:
> `encode.mjs` und `assets/outfit.woff2`. Wer am Generator selbst arbeitet, tut
> das in anigosha und zieht die Aenderung hierher nach.

# Reel-Generator (Instagram / TikTok)

Baut aus den 804 Quizfragen des Repos fertige Hochkant-Videos: 1080×1920, H.264,
30 fps, 32 Sekunden, mit Ton — dazu je eine Textdatei mit Caption und Hashtags.

Es wird **nichts aus der Datenbank geholt**: Die Fragen werden aus den Migrationen
`0003`–`0015` geparst. Weder `.env` noch Supabase noch ein Build sind nötig.

## Einmalig einrichten

```bash
npm i --no-save playwright ffmpeg-static
npx playwright install chromium          # entfällt, wenn CHROMIUM_PFAD gesetzt ist
node tools/reels/parse-questions.mjs     # erzeugt data/fragen.json
```

## Benutzen

```bash
# Fandom-Reel: drei Fragen aus EINER Serie (leicht → mittel → schwer)
node tools/reels/make-reel.mjs --format fandom --category one_piece --lang de

# Ladder-Reel: drei Serien, ansteigende Schwierigkeit
node tools/reels/make-reel.mjs --format ladder --lang en --seed 7

# Nur ansehen: Kontaktbogen aller Szenen als PNG, dauert Sekunden statt Minuten
node tools/reels/make-reel.mjs --format fandom --category naruto --dry-run
```

| Option | |
|---|---|
| `--format` | `fandom` \| `ladder` (Pflicht) |
| `--category` | Kategorie-Slug, nur bei `fandom` (`one_piece`, `naruto`, `dragon_ball`, `pokemon`, `detektiv_conan`, `inuyasha`, `ranma`, `attack_on_titan`, `death_note`, `my_hero`, `demon_slayer`, `jujutsu_kaisen`) |
| `--lang` | `de` \| `en` (Standard `de`) |
| `--seed` | gleiche Zahl → gleiches Reel |
| `--out` | Zielverzeichnis (Standard `out/reels`, gitignored) |
| `--dry-run` | nur Kontaktbogen |
| `--kein-ton` | stummes Video, ruft fal.ai nicht auf |

Ein Reel braucht rund drei Minuten. Ergebnis liegt unter `out/reels/`:
`<name>.mp4` und `<name>.txt` (Caption, Hashtags, Frageliste zum Faktencheck).

## Vor dem Posten

Der Ton im Video ist **absichtlich leise**. In der TikTok-/Instagram-App noch einen
Trending-Sound drüberlegen — das ist der stärkere Reichweitenhebel als eigene Musik,
und rechtlich sauber, weil die Plattform die Lizenz stellt. Die Effekte stören dabei
nicht.

## Drei Fallen

1. **Im Template niemals CSS-Animationen oder `setTimeout` verwenden.** Alles hängt an
   `window.setFrame(n)` und muss eine reine Funktion des Frame-Index sein. Sonst
   verrutschen Frames und das Ergebnis ist nicht reproduzierbar.
2. **Der von Playwright mitgelieferte ffmpeg kann kein MP4** — er ist auf VP8/WebM
   abgespeckt. Deshalb `ffmpeg-static` (libx264 + AAC).
3. **Die Seite wird per `page.setContent()` geladen und hat keinen Origin.** Schrift
   und Logo müssen als `data:`-URI eingebettet sein; `file://` lädt dort nicht.

Passt die Playwright-Version nicht zum installierten Chromium (Meldung
„Executable doesn't exist"), hilft `CHROMIUM_PFAD` statt eines 150-MB-Downloads:

```bash
export CHROMIUM_PFAD=/opt/pw-browsers/chromium
```

## Der animierte Werbespot — `spot/`

Zweites Format neben den Quiz-Reels: ein ~23-Sekunden-Spot im Anime-Stil (zwei
Figuren treffen sich im Park, Herausforderung, beide spielen Anigosha).

```bash
node tools/reels/spot/make-spot.mjs                 # nur schneiden, was schon da ist
node tools/reels/spot/make-spot.mjs --erzeugen      # fehlende Einstellungen bei fal bestellen (KOSTET)
node tools/reels/spot/make-spot.mjs --stimme out/stimme.mp3
```

**Ohne `--erzeugen` wird nichts bestellt** — fehlende Einstellungen brechen sauber
ab, statt still eine Rechnung zu erzeugen. Einmal erzeugte Clips liegen in
`out/spot/clips/` und werden wiederverwendet; zum Neuerzeugen die Datei löschen.

Die Startbilder liegen in `spot/referenz/` (in Gemini erzeugt, auf 1080×1920
normalisiert). `spot/template-duell.mjs` baut die App-Einstellung nach
`src/pages/DuelPage.tsx` nach — ein Videomodell malt dort sonst eine unleserliche
Fantasie-App, und ein echter Duell-Screenshot ist ohne laufende Partie nicht zu
bekommen. **Ändert sich `DuelPage.tsx` spürbar, gehört der Nachbau nachgezogen.**

Ein Videomodell hält Figuren nur zusammen, wenn jede Einstellung aus einem
Startbild kommt. Reine Text-zu-Video-Prompts liefern in Einstellung 3 zwei andere
Leute — deshalb der Umweg über `referenz/`.

## Assets

- `assets/outfit.woff2` — Schrift **Outfit**, SIL Open Font License 1.1
  (Google Fonts). Darf eingebettet und kommerziell genutzt werden.
- `assets/sfx/*.aac` — sechs Klänge, einmalig über fal.ai
  (`sonilo/v1.1/text-to-sound-effects`, ~$0,08) erzeugt und hier abgelegt. Solange
  sie liegen, ruft der Generator fal.ai nicht mehr auf. Zum Neuerzeugen die
  betreffende Datei löschen.

## Rechtliches

Die Reels sind **reine Typografie auf dem Marken-Verlauf** — nie Bilder erkennbarer
geschützter Anime-Figuren, auch keine KI-generierten. Anime-*Titel* als Text sind
unproblematisch (Fakten und Titel sind nicht geschützt), Figurenbilder wären ein
Takedown-Risiko für das ganze Entwicklerkonto.
