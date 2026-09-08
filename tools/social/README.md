# Social-Studio — täglich Posts für vier Apps

Erzeugt für Anigosha, Mahjong Royale, WELLbooked! und FullRep je zwei Posts am Tag
(Reel oder Bild), passend zur Nische, ohne Wiederholung, mit fertiger Caption.

**Wo das liegt:** seit dem 08.09.2026 im eigenen Repo `almaz6380/wellapps-social`.
Bis dahin lag es in `anigosha`, weil das die reifste Generator-Architektur hatte —
mit fünf Apps war ein Repo, das einer davon gehört, aber der falsche Ort für die
Zugangsdaten aller fünf. Anigosha ist seither ein App-Repo wie die anderen: Sein
Motor (`tools/reels/`, `tools/post-bild.mjs`) bleibt dort und läuft aus dessen
Checkout. Was hier unter `tools/reels/` liegt, ist die Kopie, die
`reels-fremd/` für Swaply und WELLbooked! braucht.

## Der Grundsatz: nichts neu bauen, was schon läuft

Drei der vier Repos haben bereits einen funktionierenden Generator, jeder mit teuer
erkauftem Wissen darin:

| Repo | Motor | Wissen, das nicht verlorengehen darf |
|---|---|---|
| `anigosha` | `tools/reels/` | Kein CSS-`animation` im Template — sonst verrutschen Frames |
| `mahjong-app` | `scripts/reel/` | Aufnahme-Browser darf kein Touch-Gerät sein, sonst stirbt der Kachel-Ausblendeffekt |
| `wellbooked` | `docs/reels/` | Logo wird aus dem PNG extrahiert, nie nachgezeichnet |
| `mypeak` (FullRep) | — | (wird gebaut) |

Dieses Verzeichnis ist **Redaktion, Takt und Auslieferung** — kein Renderer. Es ruft
die vorhandenen Motoren auf und lässt sie in Ruhe.

## Dateien

| Datei | Rolle |
|---|---|
| `apps.json` | Registratur: Pfade, Store-Verfügbarkeit, Kanäle, Markenregeln je App |
| `ideen/<app>.json` | Der Ideenvorrat — je 10 Winkel, geerdet in echten Datenquellen |
| `ledger.json` | Buchführung: was wann mit welchem Inhalt lief |
| `waehlen.mjs` | Die Auswahl. Sperrfristen, Saison, deterministischer Seed |
| `vorflug.mjs` | Leitplanken. Verwirft Posts, statt vor ihnen zu warnen |
| `lauf.mjs` | Kommandozeile: Trockenlauf, Leitplanken-Probe, Tageslauf |

## Benutzung

```bash
node tools/social/lauf.mjs --pruefung              # Leitplanken gegen Gegenbeispiele
node tools/social/lauf.mjs --trocken --tage 30     # Redaktionsplan ohne zu rendern
node tools/social/lauf.mjs --app anigosha          # Auswahl für heute, eine App
node tools/social/lauf.mjs --datum 2026-09-15      # anderer Tag
```

**Immer erst `--trocken`.** Der Trockenlauf beantwortet die einzige Frage, die vor dem
ersten echten Lauf zählt — wiederholt sich das System? — und kostet keine Sekunde
Rendern. Wer erst nach dem Rendern nachsieht, zahlt 20 Minuten pro Antwort.

## Zwei Sperrfristen, und die wichtigere ist nicht die offensichtliche

**Winkel-Sperre — abgeleitet, nicht gewählt.** Bei 10 Winkeln und 2 Posts am Tag ist
der Vorrat nach fünf Tagen einmal durch. Eine Sperre von 14 Tagen wäre mathematisch
unerfüllbar und würde sich bei jedem Lauf selbst aushebeln — genau das hat der erste
Trockenlauf aufgedeckt. `winkelSperre()` rechnet sie deshalb aus dem Vorrat aus
(derzeit 4 Tage). Wer längere Pausen will, legt Winkel nach; das ist die ehrliche
Stellschraube, nicht eine größere Zahl.

Ein wiederkehrendes **Format** ist ohnehin nicht das Problem. Jeder laufende Kanal hat
drei bis fünf Rubriken; Mahjongs eigener `charge.mjs` wechselt bewusst zwischen genau
drei Formaten.

**Inhalts-Sperre — 90 Tage.** Das ist die Sperre, an der Zuschauer eine Wiederholung
tatsächlich merken: dieselbe Frage, dieselbe Figur, dieselbe Übung. Sie ist die
eigentliche Zusage hinter „immer wieder neue Ideen". Der Vorrat trägt sie mühelos —
804 Fragen, 1392 Bretter, 162 Übungen.

## Leitplanken

Jede Regel in `vorflug.mjs` steht für einen Fehler, der schon einmal Geld oder Zeit
gekostet hat. Sie im Kopf zu behalten hat nicht funktioniert, deshalb bricht der Lauf ab:

| App | Geprüft | Woher die Regel kommt |
|---|---|---|
| alle | Kein Store genannt, den es nicht gibt | Anigosha hatte den Satz schon einmal falsch im Video |
| alle | Kein Store-Link in der Caption | Drosselt die Reichweite; gehört in die Bio |
| Anigosha | Nur Typografie | Figurenbilder gefährden das ganze Entwicklerkonto |
| Mahjong | Nur eigener Ton | Chart-Sounds sind nur privat lizenziert, kommerziell wird stummgeschaltet |
| WELLbooked! | Marke trägt `!`, Tonspur leer | Markenregel; Ton-Anweisung vom 01.08.2026 |
| FullRep | Hinweis nennt *Rat*, *Diagnose*, *Behandlung*; Quelle sichtbar | Google-Ablehnung 30.07., Apple 1.4.1 am 29.07. |

Der Store-Satz wird von `storeSatz()` aus `apps.json` **gebaut, nie getippt**.
FullRep ist derzeit nur bei Google Play — jede Erwähnung des App Store fliegt raus.

## Was das Repo speichert: das Rezept, nicht das Rendering

Videos wandern **nicht** täglich ins Repo. `wellbooked/.git` ist heute schon 173 MB;
zwei Videos am Tag wären rund 4,4 GB pro Jahr und Repo, und Git-Historie schrumpft nie
wieder. Eingecheckt werden Ledger-Zeile, Caption und ein Vorschaubild.

Das geht, weil alle Motoren **deterministisch** sind: Aus Datum, Winkel und Seed
entsteht exakt dasselbe Video wieder. Der Ledger ist damit kein Protokoll, sondern
ein Bauplan.

## Was noch fehlt

- Bildgeneratoren je App (`status: "neu"` in den Ideenvorräten)
- FullRep-Motor von Grund auf — Muster: `mypeak/scripts/store-screenshots.mjs`
- Galerie-Seite und Chat-Auslieferung
- Der tägliche Zeitplan
- TikTok-Entwurfs-Upload
