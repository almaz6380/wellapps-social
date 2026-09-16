# Beitraege in die Kanaele bringen

```bash
node tools/social/posten.mjs --trocken     # was passieren wuerde
node tools/social/posten.mjs --echt        # wirklich hochladen
```

Der Trockenlauf **braucht keinen einzigen Zugang** und sagt genau, welcher Wert
fehlt und wo er herkommt. Er ist der richtige erste Schritt.

## Die Grundregel — seit 07.09.2026 eine andere

**Volle Automatik: Facebook und Instagram posten oeffentlich, ohne dass jemand
mitliest.** Josefs Entscheidung vom 07.09.2026.

⚠ Sie **ersetzt** die Regel vom 30.08. („Nichts geht ungelesen raus, alles
landet als Entwurf"). Deren Begruendung war gut — die Beitraege tragen Saetze
wie „Laut Studien" — und ist nicht falsch geworden, sondern ueberstimmt. Wer
das je zurueckdreht, dreht eine Entscheidung zurueck, kein Versehen.

**Der Schalter steht an genau einer Stelle:** `AUTOMATIK` oben in
`posten.mjs`. Wer wissen will, was heute wirklich passiert, liest dort.

| | Wie es rausgeht | Stand |
|---|---|---|
| **Facebook** | `published=true` — sofort oeffentlich | aktiv |
| **Instagram** | Blob → Container → veroeffentlichen, alles im selben Lauf | aktiv |
| **TikTok** | Direktversand (`video.publish`) | **wartet auf die Pruefung** |

### ⚠ TikTok: zwei Wege, und nur einer geht ohne Menschen

| | Scope | Was passiert | Braucht Pruefung? |
|---|---|---|---|
| Posteingang | `video.upload` | Entwurf in der App, ein Mensch postet | nein |
| Direktversand | `video.publish` | die Automatik postet selbst | **ja** |

Aus TikToks Doku zum **Direktversand**, woertlich:

> All content posted by unaudited clients will be restricted to private
> viewing mode.

Dort gilt der Satz wirklich, und bei einem oeffentlichen Konto kommt nicht
einmal ein privater Beitrag heraus, sondern der Fehler
`unaudited_client_can_only_post_to_private_accounts`.

⚠ **Fuer den Posteingang gilt er NICHT** — das stand hier bis zum 07.09.
falsch. Die Doku zu `/v2/post/publish/inbox/video/init/` sagt dazu nichts.

Der Posteingang-Weg bleibt im Code und ist mit einer Zeile in `AUTOMATIK`
wieder aktiv. Er ist der Rueckfallweg, falls die Pruefung den Direktversand
nicht durchlaesst.

## Die drei Kanaele koennen nicht dasselbe

| | Datei direkt? | Besonderheit |
|---|---|---|
| **Facebook** | ✅ ja | ein Feld entscheidet ueber Entwurf oder oeffentlich |
| **TikTok** | ✅ ja | zwei getrennte Endpunkte, siehe oben |
| **Instagram** | ❌ **nein** | nur oeffentliche Links, und der Container verfaellt |

Diese Ungleichheit ist keine Nachlaessigkeit, sondern das, was die
Schnittstellen hergeben.

### ⚠ Instagram: kein Entwurf, und keine Dateien

Zwei Eigenheiten, beide aus der Doku:

> We will cURL your image using the passed in URL so it must be on a public
> server.

> The container was not published within 24 hours and has expired.

Also: Das Bild muss **oeffentlich erreichbar** sein, bevor der Container
entsteht — Instagram nimmt keine hochgeladene Datei. Und der Container
**verfaellt nach 24 Stunden**.

⚠ **Seit dem 07.09.2026 legt `posten.mjs` den Container SOFORT an und
veroeffentlicht gleich.** Das war vorher verboten, und die Begruendung war
richtig: Zwischen dem naechtlichen Lauf und der Freigabe lagen Stunden, und ein
am Morgen erzeugter Container waere am Abend tot gewesen. Genau dieser Abstand
faellt mit der vollen Automatik weg — hier vergehen Sekunden.

Der Weg ueber die Merkliste bleibt im Code (`AUTOMATIK.instagram = false`) und
ist der Rueckfall, falls wieder jemand mitlesen soll.

**Geloest ueber Vercel Blob** (Entscheidung vom 30.08.2026). `posten.mjs` legt
das Bild oeffentlich ab und merkt sich die Adresse; der Container entsteht
beim Freigeben, danach wird das Bild wieder geloescht.

Warum Blob und nicht ein oeffentliches Repo: Auf dem Hobby-Tarif ist es im
Freibetrag kostenlos, und Vercel rechnet Mehrverbrauch **nicht ab, sondern
schaltet ab** — „You will not pay for any additional usage. However, you will
not be able to access Vercel Blob if limits are exceeded." Es kann also keine
Rechnung entstehen. Verbrauch hier: acht Bilder taeglich zu je rund 150 kB,
also etwa 36 MB im Monat gegen 5 GB Freibetrag.

⚠ Angesprochen wird Blob ueber `npx vercel blob put`, **nicht** ueber das
npm-Paket `@vercel/blob`. Grund: Playwright und ffmpeg-static sind in diesem
Repo per `--no-save` installiert und stehen nicht in der `package.json` — jedes
`npm install` raeumt sie weg und legt den Tageslauf lahm. Ein dokumentiertes
REST-API gibt es nicht, eine nachgebaute Route waere eine Wette.

## Einrichtung — Schritt fuer Schritt

Drei Dinge vorweg, alle nachgeschlagen und nicht angenommen:

**✅ Creator-Konten reichen.** *„allows users of your app to access data in
their Instagram Business and Instagram **Creator** accounts."*

**✅ Keine App-Pruefung noetig.** *„If your app will only be used by people who
have a role on it, the permissions and features your app requires will only
need Standard Access."* Und: *„Business, Consumer, and Gaming apps are
automatically approved for Standard Access."* Wer nur seine eigene Seite und
sein eigenes Konto bespielt, braucht weder App Review noch
Business-Verifizierung.

**⚠ Der Facebook-Seiten-Token laeuft NICHT ab** — anders als frueher hier
behauptet. Die 60 Tage gelten fuer den NUTZER-Token: *„Long-lived Page access
token do not have an expiration date."* Kein Kalendereintrag noetig.

### ⚠ Vorab: Instagram-Konto und Facebook-Seite sind NICHT dasselbe

Diese Unterscheidung hat beim Einrichten am 30.08.2026 die meiste Zeit
gekostet, weil Meta sie nirgends erklaert.

| | Eigenes Login? | Wird als Zugang eingetragen? |
|---|---|---|
| **Instagram-Konto** | ja — eigene E-Mail, eigenes Passwort | **nein** |
| **Facebook-Seite** | **nein** — haengt an einem persoenlichen Profil | ja, darueber laeuft alles |

Wer drei Apps hat, hat typischerweise **drei Instagram-Konten mit drei
E-Mails** — und die verwirren, weil man sie irgendwo einzutragen erwartet. Man
traegt sie nirgends ein. Eine Facebook-**Seite** hat dagegen weder E-Mail noch
Passwort; sie ist ein Aufsatz auf dem persoenlichen Profil. Man meldet sich
immer als PERSON an und verwaltet von dort alle Seiten.

Fuer die Automatik zaehlt daher nur zweierlei:
1. Ein Profil ist Administrator **aller** Seiten, die bespielt werden sollen.
2. Jedes Instagram-Konto ist mit „seiner" Seite **verbunden**.

**Der 30-Sekunden-Test, VOR jeder Token-Arbeit:** facebook.com → Menue →
„Seiten". Stehen alle Seiten da, ist Punkt 1 erfuellt. Fehlt eine, haengt sie
an einem anderen Profil: dort anmelden → Seite → Einstellungen →
„Seiten-Zugriff" → das Haupt-Profil mit **vollem Zugriff** hinzufuegen.

⚠ Ohne Punkt 2 gibt `GET /<Seiten-ID>?fields=instagram_business_account`
nichts zurueck — und der Fehler sieht nach einem Rechteproblem aus, obwohl nur
die Verknuepfung fehlt. (Seite → Einstellungen → „Verknuepfte Konten".)

⚠ Wer den Test ueberspringt, merkt eine fehlende Seite erst nach der GANZEN
Token-Prozedur: `GET /me/accounts` liefert dann stillschweigend nur die Seiten
des angemeldeten Profils.

### A · Meta (Facebook und Instagram in einem Zug)

Beide laufen ueber EINE App und EINEN Seiten-Token.

**Stand 03.09.2026: erledigt bis auf die fuenf Token.** Die Meta-App heisst
**WELLapps** (App-ID `1808340180592380`, Typ Business), alle fuenf
Berechtigungen stehen in beiden Anwendungsfaellen auf „Bereit zum Testen",
und alle fuenf Seiten sind samt Instagram-Konto verknuepft. Seiten- und
Instagram-IDs stehen in `apps.json` unter `meta` — sie sind oeffentlich.
Offen ist je App nur `FB_SEITEN_TOKEN_<APP>`.

**Der Weg, wie er wirklich funktioniert hat** (die Doku-Version oben aus dem
August hatte drei Stellen, die anders laufen):

1. developers.facebook.com → App → **Anwendungsfaelle** (nicht „Produkte" —
   die gibt es bei neuen Apps nicht mehr). Zwei Anwendungsfaelle: „Instagram
   API" und „Seiten verwalten". Je Anwendungsfall → **Berechtigungen und
   Features** → bei jeder Zeile „Hinzufuegen":
   `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
   (Instagram API) und `pages_manage_posts` (Seiten verwalten).
   ⚠ **Nicht** `instagram_business_basic` / `…_business_content_publish` —
   das sind die Varianten fuer Instagram-Login, wir gehen ueber den
   Seiten-Token. ⚠ Solange eine Berechtigung hier nicht hinzugefuegt ist,
   **fehlt sie im Graph API Explorer einfach** — die Auswahlliste dort zeigt
   nur, was die App darf. Genau das hat am 03.09. eine halbe Stunde gekostet.
2. Graph API Explorer → Meta-App **WELLapps** → Berechtigungen anhaken →
   „Generate Access Token" → im Facebook-Dialog **alle Seiten** freigeben.
3. ⚠⚠ **VERLAENGERN — der eine Schritt, an dem alles haengt.** Access Token
   Debugger → Token einfuegen → „Fehlerbehebung" → ganz unten den Knopf
   **„Zugriffsschluessel verlaengern"** DRUECKEN. Er gibt darunter einen neuen,
   laengeren Token aus; dieser kommt zurueck in das Feld „Zugriffstoken" des
   Explorers. Das App-Geheimnis wird dabei nicht gebraucht.

   ⚠ **Nicht darauf verlassen, was im Debugger als „Ablaufdatum" steht.** Hier
   stand am 04.09. „in ungefaehr 2 Monaten", und diese Datei behauptete
   daraufhin, der Verlaengerungsschritt entfalle. Das war falsch und hat einen
   ganzen Tag gekostet: Die daraus abgeleiteten Seiten-Token starben nach
   wenigen Stunden, ZWEIMAL, jeweils zur vollen Stunde (12:00 und 16:00 UTC).
   Der Nutzer-Token des Explorers haengt an einer Sitzung, die frueher endet
   als sein eigenes Ablaufdatum — und die Seiten-Token erben die Sitzung, nicht
   das Datum. Also: immer druecken, auch wenn zwei Monate dastehen.

   Waehrend du hier bist, unter „Granulare Bereiche" pruefen, dass bei
   `pages_show_list` **alle fuenf Seiten-IDs** stehen. Fehlen welche, hat der
   Dialog sie nicht freigegeben: facebook.com → Einstellungen →
   Business-Integrationen → WELLapps → Entfernen, dann Schritt 2 wiederholen.
4. ⚠ **`GET /me/accounts` kommt LEER zurueck** (`"data": []`), obwohl der
   Debugger alle Seiten zeigt — bei Seiten, die ueber ein Business-Portfolio
   laufen. Nicht daran verzweifeln, die Seite **direkt per ID** ansprechen:
   `GET /<Seiten-ID>?fields=name,instagram_business_account,access_token`
   → `access_token` ist der Seiten-Token (= `FB_SEITEN_TOKEN_<APP>`),
   `instagram_business_account.id` die Instagram-ID. (`?ids=a,b,c` fuer alle
   auf einmal gibt es in v26 nicht mehr — Fehler 100 „deprecated".)

   ⚠ Zwischen Schritt 3 und dem letzten Secret **NICHT** erneut auf „Generate
   Access Token" druecken — auch nicht in einem anderen Browser oder auf einem
   anderen Geraet. Jede neue Erzeugung beendet die alte Sitzung und toetet
   damit alle bereits eingetragenen Seiten-Token.
5. **Nachmessen, nicht hoffen.** Workflow „Social-Zugaenge pruefen" mit
   `live_pruefen: true` starten. Bei jedem der fuenf muss stehen: **„laeuft nie
   ab — richtig abgeleitet"**. Steht dort ein Datum, war Schritt 3 nicht
   wirksam — dann ab Schritt 2 wiederholen. Ein Token, der JETZT funktioniert,
   ist kein haltbarer Token; genau dieser Trugschluss hat am 04.09. zwei
   komplette Durchgaenge gekostet.

**Zwei Fallen ohne Fehlermeldung:**

- **Der Explorer merkt sich den Token je Geraet.** Ein am Handy erzeugter
  Token steht nicht im Explorer am Mac; der fragt weiter mit dem alten. Erst
  die Token-Anfaenge vergleichen, dann suchen.
- **Facebook merkt sich die Seitenauswahl.** Beim zweiten „Generate Access
  Token" fragt der Dialog nicht mehr nach Seiten. Wer nachbessern will, muss
  die Business-Integration entfernen (facebook.com → Einstellungen →
  „Business-Integrationen", NICHT „Apps und Websites" — dort steht eine
  Business-App nicht) und den Dialog neu durchlaufen.

**Es gibt zwei FullRep-Seiten.** Bespielt wird „FullRep – Fitness, Supplemente
und Nutrition" (`1245653821967923`); die aeltere „FullRepapp"
(`1336912066163023`) ist nicht freigegeben und bleibt liegen.

### B · TikTok

**Stand 04.09.2026: App angelegt, Domain verifiziert — und dann gegen die
App-Pruefung gelaufen. Bewusst geparkt, siehe unten.**

Angelegt ist: App **WELLapps Social** (Individual, Entwicklerkonto ueber ein
TikTok-Konto), Produkte **Login Kit** + **Content Posting API** (Direct Post
AUS), Redirect URI `https://anigosha.vercel.app/tiktok-fertig`, Domain
`https://anigosha.vercel.app/` verifiziert.

**⚠ Die Wand: TikTok laesst die App nicht einmal SPEICHERN, solange kein
Demo-Video hochgeladen ist**, das den fertigen Ablauf zeigt. Und aus ihrem
eigenen Text: *„If your app has not been approved before, you are required to
use a sandbox environment … to demonstrate the integration."* Also erst
Sandbox zum Laufen bringen, daraus das Video, dann Pruefung, dann Produktion.
Das sind mehrere Stunden plus Wartezeit — kein Nebenbei-Schritt.

Facebook und Instagram tragen den Kanal derweil; deshalb ist TikTok geparkt
und nicht halbfertig eingereicht.

**Vier Dinge, die beim Einrichten Zeit gekostet haben:**

1. **„Account doesn't exist" beim Login** heisst nicht, dass das TikTok-Konto
   fehlt: Das ENTWICKLERKONTO ist ein eigenes und muss ueber „Sign up" erst
   angelegt werden.
2. **Berechtigungen stehen NICHT unter „Add scopes".** Dort liegen nur
   Zusatzrechte (user.info.profile, video.list). `video.upload` und
   `user.info.basic` kommen automatisch MIT den Produkten. Wer sie in der
   Scope-Liste sucht, sucht vergebens.
3. **Die Domain-Pruefung geht nur ueber „URL prefix" (Signaturdatei)**, nicht
   ueber „Domain" (DNS): `vercel.app` gehoert Vercel, nicht uns. Die Datei
   liegt als `public/tiktok<token>.txt` im Repo. ⚠ Nicht loeschen.
4. **Der verifizierte Prefix traegt einen Schraegstrich am Ende.** Steht im
   Feld „Web/Desktop URL" die Adresse OHNE, bleibt sie rot — dasselbe
   Zeichen, dieselbe halbe Stunde.

**✅ Stand 07.09.2026, 18:46: Die App ist zur Pruefung eingereicht.** Alle
fuenf Schritte sind durch; das Demo-Video liegt im Repo
(`tools/social/tiktok-demo/fertig/tiktok-demo.mp4`, 45,5 s).

⚠ **Schritt 5 ging nur von Hand.** `developers.tiktok.com/apps/` antwortet
ohne angemeldete Sitzung mit 401 (gemessen); eine API dafuer gibt es nicht.
Vorbereitet war deshalb alles, was den Schritt auf Klicken reduziert.

**⚠ Die groesste Falle beim Einreichen: Sandbox und Produktion sind zwei
getrennte Konfigurationen.** Der Reiter oben („Production | Sandbox") sieht
aus wie eine Ansicht, ist aber ein eigener Datensatz. Alles, was seit dem
04.09. eingerichtet wurde, stand in der Sandbox — die Produktionsseite war
LEER und musste komplett neu ausgefuellt werden. Das sieht beim ersten
Blick wie Datenverlust aus und ist keiner.

Was die Produktionsseite braucht (Sandbox-Werte gelten dort NICHT):

| Feld | Wert |
|---|---|
| App icon | `tools/social/kanal/fertig/tiktok/wellapps-social-1024.png` |
| Category | Productivity |
| Description | „Publishes short marketing videos for our own five mobile apps to our own five TikTok accounts as drafts." |
| Terms of Service URL | https://anigosha.vercel.app/legal/agb |
| Privacy Policy URL | https://anigosha.vercel.app/legal/datenschutz |
| Platforms | nur **Web**, Web/Desktop-URL `https://anigosha.vercel.app/` ⚠ mit Schraegstrich |
| Login Kit → Redirect URI | `https://anigosha.vercel.app/tiktok-fertig` |
| Content Posting API | Direct Post **aus** |
| Scopes | nur `user.info.basic` und `video.upload` |

⚠ **„Verify domains" bei der Content Posting API ist NICHT noetig.** Das
gilt nur fuer `pull_by_url`. Wir schicken die Datei direkt
(`push_by_file` / FILE_UPLOAD).

Beim Absenden fragt ein Fenster nach einem Grund (120 Zeichen). Eingetragen:
*„First submission. We publish marketing videos for our own five apps to our
own five TikTok accounts as drafts."*

**Wenn die Freigabe da ist:** Client Key und Secret der PRODUKTION in die
Secrets, dann je Konto den Workflow „TikTok-Zugang holen" erneut laufen
lassen. Die fuenf Sandbox-Refresh-Token gelten in der Produktion NICHT.

**Wenn es weitergeht — die Reihenfolge:**

1. Reiter **Sandbox** (oben neben „Production"), Sandbox anlegen und die
   eigenen TikTok-Konten als Zielnutzer eintragen.
2. Client Key und Secret der Sandbox als `TIKTOK_CLIENT_KEY` /
   `TIKTOK_CLIENT_SECRET` hinterlegen.
3. Workflow **„TikTok-Zugang holen"**, Schritt `link` → anmelden → Schritt
   `tausch` → Refresh-Token. Je Konto einmal.
4. Einen Beitrag hochladen, den Ablauf dabei als Video aufnehmen.
5. Video und Erklaertext in „App review" hochladen, einreichen.
6. Nach der Freigabe dieselben drei Schritte gegen die Produktions-App
   wiederholen — die Sandbox-Token gelten dort NICHT.

**Text fuer das Feld „Explain how each product and scope works"** (1000
Zeichen; liegt hier, damit er beim Einreichen nicht neu erfunden wird):

> The app publishes marketing content for our own five mobile apps to our own
> five TikTok accounts. No third-party accounts are involved and the app is
> not offered to other users.
>
> Login Kit (user.info.basic): used once per account, by the account owner, to
> authorize the app and obtain a refresh token. We only read the open_id to
> map each token to the correct account.
>
> Content Posting API (video.publish): a scheduled job renders short videos
> from our own app content and prepares them. It never posts on its own.
> The account owner opens our web page, which shows for every post: the
> TikTok account nickname, the privacy level options returned by
> /v2/post/publish/creator_info/query/ with no preselected value, separate
> unchecked toggles for Comment, Duet and Stitch, an unchecked commercial
> content disclosure, and the Music Usage Confirmation notice. Only after the
> owner picks a privacy level and confirms do we call the publish endpoint,
> with exactly the values chosen. All media and text are our own.

⚠ **Dieser Text ist der Stand vom 07.09.2026 abends, NACH der Entscheidung
fuer den Direktversand.** Die Einreichung von 18:46 desselben Tages trug den
Vorgaengertext („Direct Post is deliberately disabled") und beschreibt damit
das Gegenteil. Sie gehoert ersetzt.

**Warum der Text so lang von der Oberflaeche redet:** Weil genau daran die
Pruefung haengt. TikToks Richtlinie sagt woertlich:

> API Clients must only start sending content materials to TikTok after the
> user has expressly consented to the upload.

Vollautomatisches Posten ist bei TikTok also nicht schwierig, sondern
**untersagt**. Was TikTok vor jedem Beitrag angezeigt haben will, steht in der
Freigabe-Seite (`freigabe-app/`), und jedes Element davon ist eine Auflage:

| Element | Auflage |
|---|---|
| Kontoname | „so users are aware of which TikTok account the content will be uploaded to" |
| Sichtbarkeit | aus `creator_info`, **ohne Voreinstellung** |
| Kommentare / Duett / Stitch | einzeln, **alle zuerst aus** |
| Werbekennzeichnung | Schalter, **aus** |
| Music Usage Confirmation | Satz vor dem Knopf |

⚠ **Wer dort etwas vorbelegt oder weglaesst, macht aus einer erlaubten
Integration eine unerlaubte.** Deshalb bricht auch `tiktok-posten.mjs` ab,
wenn keine Sichtbarkeit mitkommt — eine Voreinstellung im Code waere genau der
Verstoss.

**Der Rueckfallweg bleibt:** `AUTOMATIK.tiktok = false` in `posten.mjs` legt
das Video wieder in den Posteingang. Der braucht nur `video.upload` und keine
Pruefung.

**Die urspruengliche Kurzfassung:**

1. developers.tiktok.com → Manage apps → App erstellen.
2. Produkt „Content Posting API". Direct Post NICHT aktivieren — wir laden in
   den Entwurfs-Posteingang.
3. Scope `video.upload` (kommt mit dem Produkt, s. o.).
4. Client Key und Client Secret notieren (das Secret wird nur einmal gezeigt).
5. Einmalig OAuth durchlaufen → **Refresh-Token**. Dafuer gibt es den Workflow
   „TikTok-Zugang holen"; der Tausch Code → Token braucht einen POST mit dem
   App-Geheimnis und geht deshalb nicht im Browser.

⚠ **Nicht den Access-Token hinterlegen.** Er haelt laut Doku „24 hours after
initial issuance" und waere am naechsten Tag tot. Der Code holt sich vor jedem
Lauf selbst einen frischen aus dem Refresh-Token (der haelt 365 Tage).

⚠ **Der Refresh-Token kann dabei rotieren:** *„The returned `refresh_token` may
be different than the one passed in the payload. You must use the
newly-returned token."* `posten.mjs` meldet eine Rotation ausdruecklich — den
neuen Wert gibt es bewusst NICHT aus, denn diese Ausgabe landet in
GitHub-Protokollen. Der Zeitplan-Workflow wird ihn spaeter selbst
zurueckschreiben.

### C · Vercel Blob

vercel.com → Storage → Create Database → **Blob** → Reiter `.env.local` → Wert
von `BLOB_READ_WRITE_TOKEN`.

### D · Die Werte hinterlegen — je App eigene

⚠ **Es sind drei Facebook-Seiten, drei Instagram-Konten und drei
TikTok-Konten**, nicht je eines. Der erste Entwurf las EIN `FB_SEITEN_ID` fuer
alles; damit waeren Mahjong-Beitraege auf der WELLbooked!-Seite gelandet — und
das faellt erst auf, wenn es draussen ist. Deshalb tragen die Namen das
App-Kuerzel.

GitHub → Repo → Settings → Secrets and variables → **Actions**:

**Fuer alle Apps gemeinsam (3):**

| Secret | woher |
|---|---|
| `TIKTOK_CLIENT_KEY` | TikTok-App → Basic information |
| `TIKTOK_CLIENT_SECRET` | ebenda, wird nur einmal gezeigt |
| `BLOB_TOKEN` | Vercel → Storage → Blob → `.env.local` |

**Je App zwei, also zehn** — `<APP>` ist `ANIGOSHA`, `MAHJONG`, `WELLBOOKED`,
`FULLREP` oder `SWAPLY`:

| Secret | woher |
|---|---|
| `FB_SEITEN_TOKEN_<APP>` | `GET /<Seiten-ID>?fields=access_token` mit dem langlebigen Nutzer-Token (Teil A, Schritt 4) |
| `TIKTOK_REFRESH_TOKEN_<APP>` | OAuth je TikTok-Konto einmal |

**Nicht mehr als Secret** (seit 03.09.2026): `FB_SEITEN_ID_<APP>` und
`IG_KONTO_ID_<APP>`. Beides sind oeffentliche Werte und stehen in `apps.json`
unter `meta`. Eine gesetzte Umgebungsvariable gleichen Namens gewinnt weiter —
fuer einen Testlauf gegen eine andere Seite, ohne das Repo anzufassen.

| App | Facebook-Seite | Instagram-Konto |
|---|---|---|
| Anigosha | `1251429691393243` | `17841433440494367` |
| Mahjong Royale | `1269567446240752` | `17841440307927621` |
| WELLbooked | `1195032197021198` | `17841428289091448` |
| FullRep – Fitness, Supplemente und Nutrition | `1245653821967923` | `17841435733289216` |
| Swaply | `1353158524539334` | `17841436704302336` |

**Einen Wert gibt es NICHT:** ein eigenes `IG_TOKEN`. Instagram wird ueber den
Weg „Facebook Login for Business" mit demselben SEITEN-Token angesprochen wie
die Seite. Zwei Felder mit demselben Wert sind kein Komfort, sondern eine
Gelegenheit, sie auseinanderlaufen zu lassen.

⚠ **Das angemeldete Facebook-PROFIL muss Administrator jeder Seite sein.**
Seiten haengen an Profilen, nicht an E-Mail-Adressen. Ist ein Profil Admin
aller drei Seiten, deckt EINE Meta-App alles ab: `GET /me/accounts` liefert
dann alle Seiten samt eigenem Token je Seite.

⚠ **Kein Wert davon in einen Chat.** Ein Schluessel im Sitzungsprotokoll gilt
als verbrannt und muss ersetzt werden.

## Zwei Sicherungen im Code

- **Ohne `--echt` wird nichts gesendet.**
- **`--echt` bricht ab, wenn ein Zugang fehlt**, statt die Haelfte
  hochzuladen. Ein halb gepostetes Tagespaket ist schlimmer als ein gar nicht
  gepostetes, weil niemand mehr weiss, was schon draussen ist.

## Der Ledger entscheidet, was zaehlt

Nicht die Dateien auf der Platte. Wer den Tageslauf zweimal startet, hat zwei
Saetze im selben Ordner; alle zu posten hiesse, den Tag doppelt zu
veroeffentlichen. `posten.mjs` nimmt nur, was mit einer Ledger-Zeile von heute
zusammenpasst (ueber den Seed im Dateinamen).

`lauf.mjs` ERSETZT seit dem 30.08.2026 die Zeilen des Tages, statt anzuhaengen.
Vorher standen nach drei Testlaeufen 6 statt 2 Zeilen je App — was nicht nur
das Posten verdreifacht haette, sondern auch die Winkel-Rotation in
`waehlen.mjs` still verschoben haette.
