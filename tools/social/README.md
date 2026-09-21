# Social-Studio — täglich Posts für vier Apps

Erzeugt für Anigosha, Mahjong Royale, WELLbooked! und FullRep je zwei Posts am Tag
(Reel oder Bild), passend zur Nische, ohne Wiederholung, mit fertiger Caption.

**Warum das hier liegt und nicht in einem eigenen Repo:** Anigosha hat die reifste
Generator-Architektur der vier, und `scripts/asc.py` wird ohnehin zwischen allen vier
Repos kopiert. Ein fünftes Repo wäre für Handy-Betrieb Verwaltungslast ohne Gegenwert.

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
| `tiktok-stand.mjs` | Fragt bei TikTok nach, was aus den hochgeladenen Beiträgen geworden ist |

## `tiktok-stand.mjs` — die Rückmeldung von TikTok

```bash
TAGE=7 node tools/social/tiktok-stand.mjs                            # schreibt zurück
DATUM=2026-09-20 SCHREIBEN=nein node tools/social/tiktok-stand.mjs   # nur messen
```

Bis zum 20.09.2026 endete unsere Kenntnis beim Hochladen: Ein Entwurf lag in TikToks
Posteingang, ein Mensch gab ihn in der App frei — oder vergaß es —, und niemand erfuhr
davon. Auf der Freigabe-Seite stand dauerhaft „im Posteingang", und das Archiv ließ
TikTok ganz weg.

Jetzt fragt dieses Werkzeug für jede gemerkte `publish_id` bei TikTok nach
(`/v2/post/publish/status/fetch/`) und schreibt die Antwort in die Merkliste. Der
Workflow dazu heißt **„TikTok-Stand abfragen"**; er läuft auch abends um 18:00 UTC,
sobald `SOCIAL_ZEITPLAN` auf `an` steht.

**Gemessen im ersten Lauf (20.09.2026):** Ein Entwurf, den ein Mensch in der TikTok-App
freigegeben hat, wechselt wirklich auf `PUBLISH_COMPLETE` und trägt dann eine
Beitrags-ID. TikTok schickt dabei die **falsch geschriebene** Feldvariante
(`publicaly`, ohne zweites „l"). 3 Beiträge hatten eine `publish_id`, **82 nicht** —
das ist das Ausmaß des alten Fehlers.

⚠ **Die Beitrags-ID darf nicht durch `JSON.parse` laufen.** Sie ist 19-stellig, also
größer als 2^53; im ersten Lauf wurde aus ihr `7687305154307182000` — die drei Nullen
am Ende sind der Rundungsfehler. `standHolen` liest die Antwort deshalb erst als Text,
`genaueIds()` holt die Ziffernfolge unverändert als Zeichenkette zurück. *Eine ID ist
keine Zahl, auch wenn sie aus Ziffern besteht.*

**Drei Regeln, die im Code stehen und bleiben müssen:**

1. **Die rohe Antwort steht im Protokoll**, je Beitrag eine Zeile. Damit ist ein Lauf
   eine Messung und nicht der Beleg für eine Annahme.
2. **Ein unbekannter Status ändert nichts.** Die Doku nennt vier Werte; was TikTok für
   einen vom Menschen freigegebenen Entwurf antwortet, ist **nicht** dokumentiert.
3. ⚠ **`veroeffentlicht` ist eine Einbahnstraße.** Würde eine falsch gedeutete Antwort
   einen geposteten Beitrag zurück auf „im Posteingang" stufen, stünde er wieder offen
   auf der Freigabe-Seite — und TikTok hat gegen Doppelposts keine Sperre.

Die Deutung sitzt in `veroeffentlichen/tiktok-deutung.mjs`, **getrennt** vom Skript:
`tiktok-stand.mjs` läuft beim Import los, also könnte `test-tiktok-stand.mjs` die Logik
sonst nur abschreiben — und abgeschriebene Logik läuft auseinander.

⚠ **Beiträge von vor dem 20.09.2026 haben keine `publish_id`** — `posten.mjs` warf sie
weg, während `tiktok-posten.mjs` sie sich längst merkte. Sie bleiben für immer
unbekannt; das Werkzeug zählt sie getrennt, statt sie als „nichts Neues" durchgehen zu
lassen.

Im Archiv der Freigabe-Seite zählt ein TikTok-Beitrag **nur mit dieser Antwort**. Ohne
sie heißt unser `veroeffentlicht` lediglich „hochgeladen", und das ist keine Zahl,
sondern eine Behauptung.

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
