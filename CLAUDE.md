# CLAUDE.md — WELLapps Social (Social-Automatik für fünf Apps)

## In einem Satz

Die Automatik erzeugt jeden Morgen für alle fünf Apps (Anigosha, Mahjong Royale,
WELLbooked!, FullRep, Swaply) Videos und Bilder, lädt sie als **Entwurf** zu TikTok
und Facebook, legt sie für Instagram bereit — und **öffentlich wird nichts ohne
einen Menschen.**

**Repository:** https://github.com/almaz6380/wellapps-social (**öffentlich seit 17.09.2026** —
nur so laufen die Actions ohne Minutenkontingent; die drei Regeln dazu stehen unten)
**Herkunft:** bis 08.09.2026 in `almaz6380/anigosha` (dort `tools/social/`,
`freigabe-app/`, `.github/workflows/social-*.yml`; Stand beim Umzug: Commit `aa5a6eb`,
Ledger bis einschließlich Tageslauf vom 08.09.). Die Geschichte davor steht in
anigoshas `CLAUDE.md`, Abschnitt „Social-Automatik".
**Bedienung:** Josef arbeitet meist vom Handy. Jeder echte Lauf (`modus: echt`,
Instagram-Freigabe, Löschen von Entwürfen) braucht vorher ein ausdrückliches „ja" im
Chat. Ergebnisse mit `SendUserFile` direkt im Chat zeigen.

**Die Wahrheit über die Einrichtung** steht in `tools/social/veroeffentlichen/README.md`
(Meta, TikTok, Blob, Secrets — Schritt für Schritt, mit jeder Falle). Diese Datei ist
der Überbau: Stand, Umzug, Ablauf, Fallen.

---

## Warum dieses Repo öffentlich wird — und die drei Regeln dazu (16.09.2026)

GitHub Actions ist auf **öffentlichen** Repos unbegrenzt und kostenlos, auf privaten
nur 2000 Minuten im Monat. Am 16.09.2026 waren sie aufgebraucht: Der geplante
Tageslauf starb nach zwei Sekunden, ohne Läufer und ohne Protokoll — und mit ihm
jeder Build und jede Freigabe bis zum Monatswechsel. Genau dafür ist dieses Repo da.

⚠ **Ein zweites kostenloses GitHub-Konto wäre der naheliegende, falsche Weg** — er
verstößt gegen die Nutzungsbedingungen (eine Person, ein kostenloses Konto), und
GitHub sperrt im Zweifel alle Konten desselben Menschen. Daran hingen die Repos aller
fünf Apps. Der Gedanke wurde geprüft und verworfen; er soll nicht wiederkommen.

**Die drei Regeln, ohne die „öffentlich" unsicher wäre:**

1. **Kein Geheimnis darf je ins Protokoll.** `tiktok-zugang.mjs` druckte den
   Refresh-Token bis zum 16.09. im Klartext, mit der Auflage, danach die Logs zu
   löschen — in einem öffentlichen Repo eine offene Tür. Seit 17.09. schreibt es ihn
   in eine Datei, und der Workflow schiebt sie mit `gh secret set … < datei` ins
   Secret. Der Wert berührt das Protokoll nie.
   ⚠ **Auf GitHubs Secret-Maskierung ist hier kein Verlass:** Der Wert kommt frisch
   von TikTok und ist in dem Moment noch kein Secret.
   ⚠ Umgekehrt gilt: Der **Client Key** ist KEIN Geheimnis (er steht in der Adresse,
   die der Nutzer im Browser öffnet) und kommt deshalb als Workflow-**Eingabe** herein.
   Als Secret wäre er zu `***` geschwärzt — genau daran war die vom `link`-Schritt
   ausgegebene Anmeldeadresse am 16.09. unbrauchbar.
2. **Niemals `pull_request_target` oder `issue_comment` als Auslöser.** Beide laufen
   MIT Secrets gegen fremden Code. Alle Workflows hier haben nur `workflow_dispatch`
   und `schedule` — das ist der sichere Zuschnitt: Fremde können nichts auslösen, und
   Läufe aus Forks bekommen grundsätzlich keine Secrets.
3. **Keine Self-hosted Runner auf diesem Repo.** Dort liefe fremder Code auf eigener
   Hardware.

**Was öffentlich sichtbar wird** (am 16.09. gegen die üblichen Schlüsselmuster
geprüft, null Treffer): der Generator-Code, die Winkel-Logik, die Workflows, die
Facebook-Seiten- und Instagram-IDs in `apps.json` (ohnehin öffentlich), der Ledger,
die Bio-Texte und Kanalbilder (stehen so auf den Profilen) und die **Namen** der
Secrets — nicht deren Werte.

---

## ⚠ Umzug — Stand 08.09.2026, und was noch von Hand zu tun ist

Der Code ist vollständig hier. **Was NICHT mitkommen konnte, sind die Zugangsdaten:
GitHub-Secrets lassen sich nicht auslesen.** Sie sind einbahnig. Jedes einzelne muss
neu beschafft und hier eingetragen werden. Bis dahin läuft die Automatik weiter in
`anigosha` — und **genau deshalb ist der Zeitplan hier noch nicht scharf** (siehe
Schritt 4). Zwei scharfe Zeitpläne hießen doppelte Entwürfe in allen Kanälen und zwei
Ledger, die auseinanderlaufen.

| | Stand |
|---|---|
| `tools/social/` (Orchestrator, Kanäle, Ideen, Ledger, reels-fremd, tiktok-demo, kanal) | ✅ hier, unverändert |
| `tools/reels/` (Reel-Generator, den reels-fremd mitbenutzt) | ✅ hier, **ohne** `fertig/` und `spot/` — die sind Anigoshas Videos und bleiben dort |
| `tools/pruefbrowser.mjs` (Browser-Unterbau für `kanal/tiktok-app-icon.mjs`) | ✅ hier |
| `freigabe-app/` | ✅ hier; `api/freigabe.js` startet den Workflow jetzt in **diesem** Repo |
| sieben Workflows (`social-*.yml`) | ✅ hier; der Tageslauf checkt anigosha jetzt als sechstes Repo mit aus |
| `tiktok-zugang.yml` + `tiktok-zugang.mjs` | ✅ hier, seit 17.09. **umgebaut**: schreibt den Token direkt ins Secret statt ins Protokoll |
| `package.json` mit `@vercel/blob`, `playwright`, `ffmpeg-static` | ✅ neu — die `--no-save`-Falle gibt es in diesem Repo nicht mehr |
| 15 Secrets + `REPOS_TOKEN` | ❌ **neu zu beschaffen** (Schritt 2 und 3) |
| Repository-Variable `SOCIAL_ZEITPLAN` | ❌ erst beim Umschalten setzen (Schritt 4) |
| Standardzweig `main` | ✅ seit 08.09.2026 gesetzt (Schritt 1) |
| Vercel-Projekt für die Freigabe-Seite | ❌ war auch vorher noch nicht angelegt (Schritt 5) |

**Der günstigste Zeitpunkt für die Secrets ist nach TikToks Freigabe** (App Review
eingereicht am 07.09.2026, 18:46): Dann müssen die fünf TikTok-Refresh-Token ohnehin
neu geholt werden, weil Sandbox-Token in der Produktion nicht gelten. Facebook und
Blob kann man davor schon eintragen; sie hängen nicht an TikTok.

### Die Reihenfolge

**1. Standardzweig — ✅ erledigt am 08.09.2026.** `main` trägt den ganzen Inhalt
(PR #1) und ist der Standardzweig. Der Zweig `claude/new-session-cigpk4` ist damit
entbehrlich und kann gelöscht werden.

⚠ Warum das ein eigener Schritt war: GitHub macht den zuerst gepushten Zweig zum
Standard, und das ist eine Einstellung, keine Datei — kein Commit kann sie ändern.
Solange sie falsch stand, hätten zwei Dinge ins Leere gegriffen, ohne einen Fehler
zu zeigen: `freigabe-app/api/freigabe.js` startet den Freigabe-Workflow mit
`ref: 'main'`, und ein Zeitplan läuft **ausschließlich** auf dem Standardzweig.
⚠ Und der Knopf daneben ist eine Falle: Der Bleistift *benennt den Zweig um*,
umgestellt wird mit dem Symbol aus zwei Pfeilen (⇄) daneben.

**2. Die 15 Secrets** (Settings → Secrets and variables → Actions). Namen und
Herkunft, ausführlich in `tools/social/veroeffentlichen/README.md`, Teil D:

| Secret | Anzahl | woher |
|---|---|---|
| `FB_SEITEN_TOKEN_<APP>` | 5 | Graph API Explorer → Token → **verlängern** → `GET /<Seiten-ID>?fields=access_token`. ⚠ Die Prozedur ist schon zweimal gestorben — immer verlängern, auch wenn „in zwei Monaten" dasteht. Ein neuer Nutzer-Token tötet die vorherigen Seiten-Token: **erst alle fünf hier eintragen, dann die alten in anigosha nicht mehr anfassen.** Solange beide Repos laufen sollen, brauchen beide dieselben Werte — oder man trägt sie hier ein und schaltet gleich um |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | 2 | TikTok-App WELLapps Social → nach der Freigabe die **Produktions**-Werte (Sandbox-Key hat Präfix `sbaw…`) |
| `TIKTOK_REFRESH_TOKEN_<APP>` | 5 | Workflow „TikTok-Zugang holen" **in diesem Repo**, je Konto einmal, je Konto ein frisches privates Browserfenster. ⚠ Die Redirect-URI ist weiter `https://anigosha.vercel.app/tiktok-fertig` — die Landeseite liegt in anigosha und ist bei TikTok so eingetragen; das bleibt so |
| `BLOB_TOKEN` | 1 | Vercel → Storage → `social-bilder` → `.env.local`. Derselbe Store wie bisher, derselbe Wert — nur neu eintragen |
| `REPOS_TOKEN` | 1 | siehe Schritt 3 |

`<APP>` ist `ANIGOSHA`, `MAHJONG`, `WELLBOOKED`, `FULLREP` oder `SWAPLY`.
**Nachmessen:** Workflow „Social-Zugaenge pruefen" mit `live_pruefen: true` — bei jedem
Facebook-Token muss „läuft nie ab" stehen.

**3. `REPOS_TOKEN`** — fein granularer Personal Access Token, Repository access „Only
select repositories" mit **allen fünf App-Repos**: `anigosha`, `mahjong-app`,
`wellbooked`, `MyPeak`, `swaply`; Permission nur **Contents: Read**. ⚠ Der alte
`REPOS_TOKEN` in anigosha kannte nur vier Repos — anigosha selbst kam dort über den
eingebauten `GITHUB_TOKEN`. Hier ist anigosha ein fremdes, privates Repo wie die anderen.

**4. Umschalten — an EINEM Tag, in dieser Reihenfolge:**
1. Warten, bis der Tageslauf in anigosha für den Tag durch ist (05:00 UTC).
2. `tools/social/ledger.json` aus anigosha (`main`) hierher kopieren und committen —
   der Ledger dort ist bis zu diesem Morgen weitergewachsen, und ohne ihn wiederholt
   der erste Lauf hier Winkel, die gerade erst liefen.
3. Hier die Repository-Variable **`SOCIAL_ZEITPLAN` = `an`** anlegen (Settings →
   Secrets and variables → Actions → Reiter Variables). Ohne sie tut ein geplanter
   Lauf hier nichts (Job „schalter" überspringt ihn, grün, ohne Meldung).
4. In anigosha: Actions → Social-Tageslauf → „…" → **Disable workflow**. Kein Commit
   nötig, jederzeit umkehrbar.
5. Am nächsten Morgen die Lauf-Liste beider Repos ansehen: hier einer, dort keiner.

Vorher ein Probelauf von Hand: „Social-Tageslauf" mit `apps: anigosha`,
`modus: trocken`. Er rendert wirklich (braucht `REPOS_TOKEN`) und sendet nichts.
Erst dann `modus: echt` — nach Josefs „ja".

**5. Freigabe-Seite in Vercel** — neues Projekt aus **diesem** Repo, Root Directory
`freigabe-app`, drei Umgebungsvariablen; Anleitung `freigabe-app/README.md`. Der
`GITHUB_TOKEN` dort braucht `Actions: Read and write` auf `almaz6380/wellapps-social`.

**6. Aufräumen in anigosha (erst NACH dem Umschalten, eigener Commit dort):**
`tools/social/`, `freigabe-app/`, die fünf Social-Workflows und die 16 Social-Secrets
können dort weg. **Bleiben müssen:** `tools/reels/` samt `fertig/` und `spot/`,
`tools/post-bild.mjs`, `tools/pruefbrowser.mjs` (Anigoshas eigener Motor — der
Tageslauf ruft ihn aus dem anigosha-Checkout auf), `public/tiktok-fertig.html` und
`public/tiktok<token>.txt` (TikTok-Redirect und Domain-Signatur), und der Abschnitt
„Social-Automatik" in dessen `CLAUDE.md` als Geschichte. Anigoshas 21 Release-Secrets
haben mit Social nichts zu tun.

---

## Wie die Kette läuft

```
Zeitplan (05:00 UTC, nur mit SOCIAL_ZEITPLAN=an)
  → Workflow checkt dieses Repo + fünf App-Repos nebeneinander aus (SOCIAL_WURZEL)
  → lauf.mjs wählt je App die Winkel (waehlen.mjs), prüft die Leitplanken (vorflug.mjs)
    und ruft den Motor des jeweiligen App-Repos auf (motoren.mjs) → out/social/<datum>/
  → posten.mjs lädt hoch: Facebook Entwurf, TikTok Posteingang, Instagram nur Datei in den Blob
  → Merkliste + Übersicht in den Blob-Speicher, Ledger zurück ins Repo
  → Freigabe-Seite zeigt sie → du entscheidest.
```

| Kanal | Was die Automatik tut | Was du tust |
|---|---|---|
| TikTok | Video in den Entwurfs-Posteingang der App — und später **nachfragen, was daraus wurde** (siehe unten) | In der TikTok-App auf Veröffentlichen tippen. **Text vorher kopieren** — TikToks Posteingang nimmt keinen an; er steht in der Zusammenfassung jedes Laufs und auf der Freigabe-Seite |
| Facebook | unveröffentlichter Beitrag (`published=false`) | In der Meta Business Suite freigeben |
| Instagram | Datei öffentlich ablegen, mehr nicht | Auf der Freigabe-Seite auf Veröffentlichen tippen. Instagram kennt keine Entwürfe |

Warum die drei ungleich sind: Das ist, was die drei Schnittstellen hergeben.
Instagrams API ist zweistufig und ihr Container verfällt nach 24 Stunden — er darf
deshalb erst im Moment der Freigabe entstehen (`social-freigabe.yml`, `freigeben.mjs`).

**Die Motoren liegen in den App-Repos, nicht hier.** `apps.json` führt sie mit
absoluten Pfaden (`/home/user/<repo>`), so wie sie in einer Cloud-Sitzung und auf
Josefs Rechner nebeneinander liegen; auf dem Runner ersetzt `SOCIAL_WURZEL` nur den
vorderen Teil. Zwei Ausnahmen laufen aus DIESEM Repo: `tools/social/reels-fremd/`
(Reels für Swaply und WELLbooked!, weil dort nur Lesezugriff besteht) und
`tools/social/tiktok-demo/` — beide brauchen `tools/reels/encode.mjs` und die Schrift
`tools/reels/assets/outfit.woff2`, sonst nichts aus dem Generator.

| App | Repo | Ordnername unter SOCIAL_WURZEL | Motor |
|---|---|---|---|
| Anigosha | `almaz6380/anigosha` | `anigosha` | `tools/reels/make-reel.mjs`, `tools/post-bild.mjs` |
| Mahjong Royale | `almaz6380/mahjong-app` | `mahjong-app` | `scripts/reel/` (abgefilmt, braucht `vite preview` auf 5199), `scripts/post-bild.mjs` |
| WELLbooked! | `almaz6380/wellbooked` | `wellbooked` | `docs/social/post-bild.mjs`; Reel von hier (`reels-fremd`) |
| FullRep | `almaz6380/MyPeak` | `mypeak` ⚠ | `scripts/post-reel.mjs`, `scripts/post-bild.mjs` |
| Swaply | `almaz6380/swaply` | `swaply` | `scripts/post-bild.mjs` — ⚠ nur auf `claude/swaply-icon-farben`, siehe unten; Reel von hier |

## Die Werkzeuge (GitHub Actions)

| Workflow | wofür |
|---|---|
| **Social-Tageslauf** | erzeugt und lädt hoch. Täglich (wenn scharf); von Hand mit `apps`, `modus`, `datum`, `kanaele`, `zweige` |
| **Instagram-Freigabe** | `zeigen` listet auf, `veroeffentlichen` stellt öffentlich — endgültig |
| **Facebook-Entwuerfe** | unveröffentlichte Beiträge auflisten und (nur mit ausdrücklichen IDs) löschen |
| **Social-Zugaenge pruefen** | sagt je App, ob der Token zur richtigen Seite gehört und ob er abläuft. Sendet nichts |
| **TikTok-Zugang holen** | tauscht einen OAuth-Code gegen einen Refresh-Token. Protokoll danach löschen |
| **Freie Karte** | eine Bildkarte mit eigenem Text, auf Zuruf. Ausgelöst von der Freigabe-Seite |
| **TikTok-Stand abfragen** | fragt bei TikTok nach, was aus den Entwürfen wurde, und schreibt es in die Merklisten. Liest nur ab, veröffentlicht nichts |

### TikTok gibt jetzt Rückmeldung (20.09.2026)

Josef: *„Kannst du es nicht so machen, dass TikTok eine Rückmeldung gibt?"*

Bis dahin endete unsere Kenntnis beim Hochladen. Der Entwurf lag im Posteingang, Josef
gab ihn in der App frei — oder vergaß es —, und **niemand erfuhr davon**. Auf der
Freigabe-Seite stand dauerhaft „im Posteingang", im Archiv gar nichts. Ein vergessener
Entwurf sah genauso aus wie ein geposteter.

`tools/social/tiktok-stand.mjs` fragt für jede gemerkte `publish_id` bei TikTok nach
(`/v2/post/publish/status/fetch/`) und schreibt die Antwort in die Merkliste. Steht der
Beitrag öffentlich, verschwindet der TikTok-Block auf der Freigabe-Seite von selbst,
und das Archiv zählt ihn.

⚠ **Der alte Fehler, den das erst möglich gemacht hat:** `posten.mjs` warf die
`publish_id` weg, während `tiktok-posten.mjs` (der Knopf auf der Freigabe-Seite) sie
sich längst merkte. Ausgerechnet bei den Beiträgen, die niemand von Hand angestoßen
hat, war hinterher nichts mehr feststellbar. **Alles vor dem 20.09.2026 bleibt für
immer unbekannt** — das Werkzeug zählt diese Beiträge getrennt, statt sie als „nichts
Neues" durchgehen zu lassen.

⚠ **Im Archiv zählt bei TikTok nur, was TikTok SELBST gesagt hat.** Unser eigenes
`veroeffentlicht` heißt dort lediglich „hochgeladen". Die Regel ist selbstbegrenzend:
Ohne Abfragelauf ändert sich im Archiv gar nichts.

✅ **Der offene Punkt ist gemessen (erster Lauf, 20.09.2026).** Die Frage war: Was
antwortet TikTok für einen Entwurf, den ein **Mensch** in der App freigegeben hat? Die
Doku sagt es nicht. Der Lauf schon — Beitrag `wellbooked-anruf-de-s3709-1.jpg`, bei uns
auf `posteingang`:

```
{"publicaly_available_post_id":[…],"status":"PUBLISH_COMPLETE"}
```

Der Stand wechselt also wirklich, und TikTok schickt tatsächlich die **falsch
geschriebene** Feldvariante (`publicaly`, ohne das zweite „l"). Beide Schreibweisen
bleiben im Code — wer nur auf die richtige prüft, misst nichts.

⚠ **Und derselbe Lauf hat einen Fehler aufgedeckt: `JSON.parse` rundet die
Beitrags-ID.** Sie ist 19-stellig, also größer als 2^53; aus ihr wurde
`7687305154307182000`, und die drei Nullen am Ende sind der Rundungsfehler.
Gespeichert hätten wir eine Nummer, die auf **keinen** Beitrag zeigt — und niemandem
wäre es aufgefallen, weil sie wie eine plausible ID aussieht. `standHolen` liest die
Antwort deshalb erst als **Text**, und `genaueIds()` holt die Ziffernfolge unverändert
als Zeichenkette zurück. Passt die Anzahl nicht, wird nichts ersetzt: eine halb
ersetzte Liste wäre schlimmer als die gerundete.

**Merksatz:** Eine ID ist keine Zahl, auch wenn sie aus Ziffern besteht. Facebook und
TikTok führen ihre IDs überall als Strings — das ist kein Stil, sondern der Grund.

⚠ Ungemessen bleibt, **wie lange** TikTok eine `publish_id` überhaupt beantwortet.
Deshalb gilt weiter: Die rohe Antwort geht je Beitrag ins Protokoll, ein unbekannter
Status ändert nichts, und `veroeffentlicht` wird nie zurückgestuft (sonst stünde ein
geposteter Beitrag wieder offen, und TikTok hat gegen Doppelposts keine Sperre).

**Das Ausmaß des alten Fehlers, gezählt statt geschätzt:** Im ersten Lauf hatten
**3 Beiträge eine `publish_id` und 82 keine.** Die 82 stammen von vor dem 20.09.2026
und bleiben für immer unbekannt.

### ⚠ Der Zeitplan war acht Tage tot — an EINEM Anführungszeichen (18.09.2026)

Josef sah in der Freigabe-App nichts und fragte nach. Gemessen statt vermutet:
Die Läufe 3 bis 10 (11.–18.09.) sind **alle** rot, jeder nach drei bis acht
Sekunden. In der Meldung des Schalter-Schritts stand:

```
… steht nicht auf „an". Nichts getan.
```

Öffnend `„` (U+201E, für bash harmlos), **schließend ein gewöhnliches `"`** —
das beendet die Zeichenkette mitten im Satz. bash bricht beim **Parsen** ab,
also unabhängig davon, welcher Zweig genommen würde:

```
line 5: unexpected EOF while looking for matching `"'
```

Ein Schritt, der einen Lauf nur überspringen sollte, hat ihn getötet.
`SOCIAL_ZEITPLAN` stand die ganze Zeit richtig auf `an`.

**Zwei Lehren:**

1. **Keine deutschen Anführungszeichen in `run:`-Blöcken.** In YAML-Kommentaren
   und in Markdown gern, in bash nie — das schließende Zeichen ist dort ein
   gewöhnliches `"`. Einfache Anführungszeichen sind in einer
   doppelt-gequoteten bash-Zeichenkette gewöhnliche Zeichen und deshalb sicher.
2. **Ein roter Lauf, den niemand ansieht, ist ein stummer Lauf.** Acht Tage
   ohne einen einzigen Beitrag, und gemerkt hat es niemand, weil die leere
   Freigabe-Seite wie „heute nichts dabei" aussah. Bei leerer Seite **zuerst
   die Lauf-Liste ansehen**, nicht den Blob-Speicher.

Gegenprobe ist ein Skript, das jeden `run:`-Block beider Repos durch `bash -n`
jagt (`${{ … }}` vorher durch einen Platzhalter ersetzt, sonst meldet bash
Fehler, die keine sind): 48 Blöcke, 0 Syntaxfehler. Es wurde **zuerst an einer
Kopie der kaputten Zeile geprüft** — eine Null von einem Prüfer, der nichts
findet, ist nichts wert.

### ⚠ Swaplys Bildbeiträge sind drei Wochen lang verschwunden (18.09.2026)

Aufgefallen bei Josefs Frage „und fullrep?" — beim Nachzählen stimmte etwas
anderes nicht. Gemessen an vier Stichtagen:

| Tag | Ledger sagt | in der Freigabe-Seite |
|---|---|---|
| 05.09. | Reel + Karte | nichts |
| 08.09. | Reel + Karte | nur das Reel |
| 09.09. | Reel + Karte | nur das Reel |
| 18.09. | Reel + Karte | nur das Reel |

**Ursache:** `swaply/scripts/post-bild.mjs` schrieb kein Beiblatt (`.txt`), und
`tagesposten()` in `posten.mjs` findet Beiträge **ausschließlich über deren
.txt-Datei** — der Caption-Text kommt von dort. Ein Bild ohne Beiblatt
existiert für den Versand nicht.

**Das Teuerste war die Stille.** Der Lauf meldete „1 Beitrag" statt „einer
fehlt", und weil in der Liste etwas stand, hat es niemand gemerkt. Ein grüner
Haken, hinter dem die Hälfte fehlt.

Behoben an zwei Stellen, und beide braucht es:

1. **Swaplys Generator schreibt jetzt ein Beiblatt** (Commit `91b203d` auf
   `claude/swaply-icon-farben` — main hat den Generator gar nicht, deshalb
   dort). Die Caption besteht aus dem Aufhänger und genau den Texten, die auf
   der Karte stehen; kein Satz wird frei formuliert.
   ⚠ Die gewürfelten Texte werden dafür **vor** dem HTML gezogen — in genau
   derselben Reihenfolge je Winkel. `waehle` dreht den Würfel weiter; alle
   Werte unbedingt zu ziehen verschöbe die Folge, und jeder alte Seed zeigte
   ein anderes Bild. Gegenprobe: 36 Bilder vorher/nachher, identische
   Prüfsumme.
2. **`posten.mjs` meldet den Verlust laut.** Was der Ledger für heute
   verspricht und nicht ankommt, wird benannt, und der Lauf endet mit 1.
   ⚠ Zwei Fälle, die nicht verwechselt werden dürfen: Datei da ohne Beiblatt =
   echter Verlust (rot); Ordner existiert gar nicht = das Rendern lief auf
   einer anderen Maschine (Hinweis, grün). Sonst stumpft der Alarm ab.

**Alle neun Generatoren am 18.09. nachgeprüft** — Swaply war der einzige ohne
Beiblatt.

**Merksatz:** Der Ledger ist die Wahrheit darüber, was entstanden ist. Was dort
steht und im Versand fehlt, ist unterwegs verloren gegangen — und das darf nie
still passieren.

### Freie Karte — ein Beitrag auf Zuruf (18.09.2026)

Alle Formate zeichnen aus den Daten der jeweiligen App. Für eine Ansage, die
kein Generator kennen kann (neue Version, Hinweis, ein Satz, der unterwegs
einfällt), gab es nichts. Jetzt: `--format freie-karte` in
`anigosha/tools/post-bild.mjs`, bestellt über `lauf.mjs --karte` oder den
Block „Neuen Beitrag bauen" auf der Freigabe-Seite.

**Sie ist bewusst KEIN Winkel der Rotation.** Ein Winkel wird gewürfelt, diese
Karte wird bestellt. Stünde sie in `ideen/anigosha.json`, zöge der Tageslauf
sie irgendwann von selbst — und dann ohne Text, weil der nur von außen kommt.

⚠ **`posten.mjs --seed` ist die ganze Sicherung gegen Doppelte.** Der
Kartenlauf *ergänzt* den Tag, statt ihn zu ersetzen. Ein gewöhnlicher
Versandlauf würde deshalb das Tagespaket von heute Morgen ein zweites Mal in
den Blob schieben und ein zweites Mal vormerken — in der Freigabe-Seite stünde
dann jeder Beitrag doppelt, und beim Instagram-Knopf wüsste niemand mehr,
welcher der echte ist. Dieselbe Sorte Schutz wie `--kanal`, nur auf der
anderen Achse.

⚠ **Die Rubrik „ZUR KONTROLLE" im Beiblatt ist eine GRENZE, kein Text.**
`captionAus()` schneidet die Caption an der nächsten unterstrichenen
Überschrift ab. Sie war bei der freien Karte zuerst weggelassen — es gibt dort
ja weder Lösung noch Erklärung zu kontrollieren. Inhaltlich richtig, technisch
falsch: Die Caption lief bis ans Dateiende und nahm „Store-Satz im Bild: …"
mit. Der Versand brach ab (*„Verräter: Store-Satz im Bild"*) — die Leitplanke
hat genau das getan, wofür sie da ist.

⚠ **Nur Anigosha.** Die Auswahl auf der Freigabe-Seite zeigt deshalb eine
einzige Zeile, und `lauf.mjs --karte` bricht bei den anderen vier mit einer
klaren Meldung ab, statt bis zum Motor durchzulaufen und dort mit „unbekanntes
Format" zu scheitern.

⚠ **Beide Formate liegen seit 18.09. auf Anigoshas `main`.** Vorher checkte der
Workflow einen Feature-Zweig aus — nötig, aber falsch: Der Motor eines Repos
muss auf dessen **Standardzweig** liegen, sonst sieht der Workflow ihn nicht.
Genau daran hing am 05.09. schon Swaply. Lokal ist immer alles da; deshalb
fällt es erst im Lauf auf, nie davor.

### Karte oder Video — und warum das über die Kanäle entscheidet

`--medium bild` (Vorgabe) zeichnet die Karte, `--medium reel` das Video
(`--format ansage` im Reel-Generator). Der Unterschied ist nicht das Aussehen,
sondern die **Reichweite**:

| | Facebook | Instagram | TikTok |
|---|---|---|---|
| Karte (Bild) | ✅ | ✅ | ❌ |
| Reel (Video) | ✅ | ✅ | ✅ |

`posten.mjs:371` überspringt bei jedem Bild TikTok mit „kein Video". Das ist
keine Lücke, sondern die Schnittstelle — TikToks Content-Posting-API kennt auf
unserem Weg keinen Bildbeitrag.

⚠ **Haken und Marke gibt es nur auf der Karte.** Die Reel-Vorlage kennt beide
nicht. Sie werden deshalb an drei Stellen unterdrückt statt stillschweigend
geschluckt: Die Seite blendet die Felder aus, die Vercel-Funktion sendet sie
leer, und `motoren.mjs` reicht beim `ansage`-Format nur Text und Schlusszeile
durch. Ein Feld, das man ausfüllen kann und das dann nichts tut, ist schlimmer
als keines — man sucht den Fehler später im fertigen Video.

Lokal, ohne Zugangsdaten:

```bash
npm install                                   # playwright + ffmpeg-static + @vercel/blob
node tools/social/lauf.mjs --pruefung         # Leitplanken gegen Gegenbeispiele
node tools/social/lauf.mjs --trocken --tage 14 # Redaktionsplan, rendert nichts
node tools/social/posten.mjs --trocken        # was ein Versand tun wuerde, nennt fehlende Werte
node tools/social/test-caption.mjs            # Caption-Regeln
```

**Immer erst `--trocken`.** Ein Trockenlauf legt keine Merkliste ab und verbraucht
keinen Winkel; der Ledger wird nur nach einem echten Lauf zurückgeschrieben.

---

## Was offen ist (Stand 08.09.2026)

- **Umzug abschließen** — Schritte 2 bis 6 oben (Schritt 1 ist erledigt).
- **TikToks Antwort abwarten.** Kommt die Freigabe: Client Key und Secret der
  Produktion in die Secrets, alle fünf Refresh-Token neu holen (Sandbox-Token gelten
  dort nicht). Details: `veroeffentlichen/README.md`, Teil B.
- **Swaply läuft auf einem Notbehelf-Zweig.** Sein Motor (`scripts/social-daten.mjs`,
  `scripts/post-bild.mjs`) liegt nur auf `claude/swaply-icon-farben`, nicht auf dessen
  `main`. Der Zeitplan gibt den Zweig deshalb ausdrücklich an
  (`zweige: swaply=claude/swaply-icon-farben`, fest im Schritt „Lauf planen") und
  schreibt das jeden Morgen in seine Zusammenfassung. Der Zweig bringt auch eine
  Farbumstellung der App mit — zusammenführen ist keine reine Aufräumarbeit.
- **Der erste Tag mit Inhalt für die Freigabe-Seite ist der 8. September.** Sie liest
  die Merklisten, die ein echter Lauf ablegt. Bis dahin ist sie leer — richtig so.

---

## Fallen, die schon zugeschnappt sind

Jede davon hat mindestens eine halbe Stunde gekostet. Sie stehen hier, damit sie es
nicht noch einmal tun.

1. **Ein grüner Lauf ohne Inhalt.** Ein Lauf, der nichts erzeugt hat, sah wie Erfolg
   aus. Seitdem endet `lauf.mjs --echt` mit 1, wenn kein einziger Beitrag entstand — und
   der Schritt „Gescheitertes melden" färbt den Lauf rot, wenn irgendeine App ausfiel.
   Ein grüner Haken heißt: alles Angeforderte ist passiert.
2. **Der Motor eines Repos muss auf dessen Standardzweig liegen.** Lokal war alles da,
   im Lauf fehlte es („Cannot find module"). Ein `ls` im Arbeitsverzeichnis beweist
   nichts über den Zustand des Repos.

   ⚠ **Diese Falle hat am 05.09. einen Notbehelf bekommen statt einer Behebung
   — und der Notbehelf hat sie dann zwei Wochen lang versteckt.** Am 19.09.
   kam heraus: **drei von fünf Repos** führten ihren Bildgenerator nur auf
   einem `claude/…`-Zweig. Swaply hatte den Notbehelf (`zweige: swaply=…` fest
   im Zeitplan), WELLbooked und Mahjong hatten nichts. Beide lieferten jeden
   Morgen **1 von 2 Beiträgen**, mit einer Zeile unter zehn als einziger Spur:

   ```
   ▣ regulierte-bereiche · de · Seed 3471
     ✗ Error: Cannot find module '…/wellbooked/docs/social/post-bild.mjs'
   ```

   Der Lauf wurde trotzdem grün — nach der damaligen Regel zu Recht: Eine
   gescheiterte App darf die anderen nicht mitreißen, und „8 von 10 Posts
   fertig" ist ja ein Ergebnis. Nur liest das niemand.

   **Behoben, nicht umgangen:** Alle drei Motoren liegen auf ihrem
   Standardzweig, die `zweige`-Zeile ist aus dem Zeitplan raus, und
   `lauf.mjs` färbt den Lauf **rot**, wenn ein Generator fehlt (gemessen:
   Rückgabe 1 mit verbogenem Pfad, 0 im Normalfall). Ein von der Leitplanke
   verworfener Beitrag bleibt grün — das ist Qualitätskontrolle, kein Defekt.

   **Merksatz: Ein Motor auf einem Feature-Zweig ist kein Motor.** Und: Ein
   Notbehelf ohne Datum daran wird zur Einrichtung.

   ⚠ Beim Prüfen eines Zweigs vor dem Merge **drei Punkte nehmen**:
   `git diff main...zweig` sagt, was der Zweig getan hat. `main..zweig` (zwei
   Punkte) mischt hinein, wie weit main davongelaufen ist — bei Swaply sah
   der Zweig damit nach 201 Dateien und −20.107 Zeilen aus und war in
   Wahrheit 15 Dateien groß. Derselbe Zweig hätte beim vollen Merge das
   App-Redesign vom 01.09. um drei Wochen zurückgedreht; übernommen sind
   deshalb nur seine Werkzeuge.

   **2a. Fehlend ist nicht dasselbe wie falsch.** `zugaenge-pruefen.mjs`
   endete bei unvollständigen Zugängen mit 0 — richtig, während der
   Einrichtung ist das der Normalfall. Es tat es aber auch bei einem
   FALSCHEN Wert. Swaplys `igKontoId` war um eine Ziffer verschrieben
   (`…7043·0·2336` statt `…7043·3·2336`), Instagram brach seit Stunden mit
   „Object with ID … does not exist" ab — einer Meldung, die nach einem
   Rechteproblem aussieht und keines war —, und der Prüflauf meldete grün.
   Seit 19.09. sind beide Fälle getrennt: fehlend grün, falsch rot. Und die
   ID wird gegen die Seite selbst geprüft (`instagram_business_account`)
   statt nur ausgedruckt. **Eine ID in einer Konfigurationsdatei ist eine
   Behauptung; die Seite weiß es besser.**
   **2b. „Nicht nachweisbar" und „nicht nachgesehen" sehen im Protokoll
   gleich aus.** Seit dem 05.09. stand hier, TikTok-Fotobeiträge seien
   ungeprüft — mit der Begründung, die Doku rendere im Browser nach und
   Chromium komme aus einer Cloud-Sitzung nicht ins Netz. Am 19.09. probiert:
   `curl -sSL` mit einem Browser-User-Agent holt
   `content-posting-api-reference-photo-post` anstandslos. Ohne `-L` kommt
   eine 302 und damit eine leere Datei — das war die ganze „Sperre". Es gibt
   sie, sie nimmt bis zu 35 Bilder, und sie ist jetzt gebaut.

3. **Sandbox und Produktion sind bei TikTok zwei Datensätze.** Der Reiter sieht aus wie
   eine Ansicht, ist aber eine eigene Konfiguration. Die Produktionsseite war leer und
   musste komplett neu ausgefüllt werden. Das sieht wie Datenverlust aus und ist keiner.
4. **Zwei `npm i --no-save` heben sich auf.** npm räumt bei jeder Installation weg, was
   nicht in `package.json` steht. Beide Pakete gehören in EINEN Aufruf. Gilt in den
   App-Repos weiter; in diesem Repo stehen beide in `package.json`.
5. **Eine gescheiterte App riss früher die anderen mit.** `set -e` beendete die Schleife
   beim ersten Fehlschlag; die übrigen sahen aus, als wären sie ebenfalls kaputt. Jetzt
   läuft jede App für sich, der Versand überspringt die nicht gerenderten.
6. **Facebook-Token sterben still.** Ein Token, der jetzt funktioniert, ist kein
   haltbarer. Im Access Token Debugger den Knopf „Zugriffsschlüssel verlängern"
   drücken — immer, auch wenn dort „in zwei Monaten" steht. Alle fünf Seiten-Token
   starben am 04.09. zweimal zur vollen Stunde, weil der Schritt fehlte.
7. **Ein 502 vom API-Aufruf heißt nicht, dass der Lauf nicht startete.** Vor jedem
   Wiederholen erst die Lauf-Liste ansehen — sonst doppelte Entwürfe.
8. **`--kanal` holt einen einzelnen Kanal nach**, ohne die geglückten zu verdoppeln.
   Ohne den Filter legt ein Nachlauf weitere Facebook-Entwürfe an, und niemand weiß
   mehr, welcher der neue ist.
9. **Die Merkliste im Blob trägt zwei Dinge:** `eintraege` (was Instagram noch offen
   hat — der Vertrag mit `freigeben.mjs`) und `uebersicht` (Anzeige). Wer die Anzeige
   zur Grundlage einer Veröffentlichung macht, riskiert einen doppelten
   Instagram-Beitrag. `freigeben.mjs` muss `uebersicht` beim Zurückschreiben mitreichen.
10. **Der Ledger entscheidet, was zählt, nicht die Dateien auf der Platte.** Wer den
    Tageslauf zweimal startet, hat zwei Sätze im selben Ordner; `posten.mjs` nimmt nur,
    was zu einer Ledger-Zeile von heute passt. `lauf.mjs` ERSETZT die Zeilen des Tages.
11. **Mahjongs Reel wird abgefilmt**, nicht gezeichnet, und braucht die gebaute App
    unter `localhost:5199`. Der Schritt „Mahjong-Vorschau starten" hat
    `continue-on-error`, damit ein misslungener Bau die anderen vier nicht aufhält.
12. **Playwright-Fassung und Chromium-Bauart müssen zusammenpassen.** Die App-Repos
    holen playwright per `--no-save` (neueste), dieses Repo hat seine festgeschrieben.
    Der Workflow ruft deshalb `playwright install chromium` je Repo — bei gleicher
    Fassung ein Leerlauf, bei abweichender kommt die fehlende Bauart dazu. In der
    Cloud-Sitzung liegt ein Chromium unter `/opt/pw-browsers/chromium`
    (`CHROMIUM_PFAD`), 150 MB nachzuladen ist dort unnötig.

## Der Stand der Kanäle, gemessen (05.–07.09.2026)

- **Facebook und Instagram** für alle fünf Apps fertig (Meta-App **WELLapps**,
  `1808340180592380`). Seiten- und Instagram-IDs sind öffentlich und stehen in
  `apps.json` unter `meta`. Es gibt zwei FullRep-Seiten; bespielt wird „FullRep –
  Fitness, Supplemente und Nutrition" (`1245653821967923`).
- **TikTok** für alle fünf Konten am echten Konto gemessen (Läufe #11 und #13 in
  anigosha), je ein Entwurf im Posteingang — in der **Sandbox** der App **WELLapps
  Social** (Sandbox-Client-Key `sbawfim8jjhnn7axno`). App Review eingereicht
  07.09.2026, 18:46; Demo-Video `tools/social/tiktok-demo/fertig/tiktok-demo.mp4`.
  Alle Feldwerte der Produktionsseite: `veroeffentlichen/README.md`, Teil B.
- **Reel-Generatoren für Swaply und WELLbooked!** (`tools/social/reels-fremd/`) fertig,
  am echten Konto gemessen.
- **Freigabe-Seite** gebaut und geprüft; Vercel-Projekt noch nicht angelegt.

## Konventionen

- Dokumentation und Kommentare auf Deutsch, Fallen mit ⚠ markiert und mit Datum —
  ein Kommentar sagt, *warum* etwas so ist, nicht was der Code tut.
- **Nichts geht ungelesen raus.** Kein Weg in diesem Repo darf etwas ohne
  menschliche Freigabe öffentlich machen. Wer einen Kanal ergänzt, hält das ein.
- **Kein Schlüsselwert im Repo, im Chat oder in einem Protokoll.** Ein Schlüssel im
  Sitzungsprotokoll gilt als verbrannt. `zugaenge-pruefen.mjs` gibt nur Länge und
  die ersten vier Zeichen aus. Fehlt einer: sagen **welcher** und **wo er hin muss**.
- Der Store-Satz wird aus `apps.json` gebaut, nie getippt; Store-Links gehören in die
  Bio, nicht in die Caption (`vorflug.mjs`).
- Anigosha: nur Typografie, nie Bilder erkennbarer Anime-Figuren. Mahjong: nur
  eigener Ton. WELLbooked!: Marke mit `!`, Tonspur leer. FullRep und Swaply: keine
  Diagnosen, keine Therapieversprechen.
- Videos wandern nicht ins Repo (`out/` ist gitignored); eingecheckt werden Ledger,
  Ideen und Kanal-Assets. Die Motoren sind deterministisch — der Ledger ist ein Bauplan.
- KEIN echter Lauf, kein Deploy, kein Löschen ohne ausdrückliches „ja" von Josef.
