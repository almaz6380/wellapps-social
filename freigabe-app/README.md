# Freigabe-Seite

⚠ **Das Vercel-Projekt `wellapps-freigabe` hängt seit 17.09.2026 an DIESEM Repo**
(vorher `almaz6380/anigosha`). Root Directory bleibt `freigabe-app`.

⚠ **„Redeploy" reicht beim Umhängen NICHT.** Er baut immer dieselbe Quelle neu —
nach dem Umhängen also weiter den alten Stand aus dem alten Repo, erkennbar am
Commit-Titel von dort. Erst ein **Push** in dieses Repo löst den ersten Build aus
der neuen Quelle aus. Genau darüber ist die Umstellung am 17.09. zuerst
gestolpert.

Eine kleine Seite fürs Handy, die die Social-Entwürfe eines Tages zeigt —
Video oder Bild, den Text zum Kopieren, und je Kanal, was schon passiert ist.
Instagram lässt sich von hier freigeben.

Gebaut, damit der Weg über GitHub Actions entfällt.

## Was sie kann — und was bewusst nicht

| Kanal | hier |
|---|---|
| **Instagram** | ✅ Knopf „Auf Instagram veröffentlichen". |
| **Facebook** | ✅ Knopf „Auf Facebook veröffentlichen" (zwei Tipper). |
| **TikTok** | Knopf ist gebaut, wirkt aber erst nach TikToks App-Prüfung — bis dahin liegt der Beitrag im Posteingang der App und wird dort fertiggestellt. |

Dazu hat jeder Beitrag einen **`Ablehnen`**-Knopf (ebenfalls zwei Tipper). Er
verwirft ihn und fordert gleich einen Ersatz an — der Tageslauf läuft mit einer
anderen Saat noch einmal für diese App und braucht dafür etwa zehn Minuten. Der
abgelehnte Beitrag bleibt durchgestrichen stehen, damit am Abend nachvollziehbar
ist, was verworfen wurde.

⚠ **Was schon öffentlich ist, lässt sich nicht ablehnen** — dort erscheint der
Knopf nicht. Zurückholen geht nur durch Löschen im jeweiligen Netzwerk. Ein
TikTok-Entwurf, der schon im Posteingang der App liegt, muss ebenfalls dort
verworfen werden.

⚠ **Facebook legt seit dem 09.09.2026 keinen Entwurf mehr an.** Der Tageslauf
legt nur die gerenderte Datei öffentlich ab; der Beitrag entsteht erst, wenn du
hier drückst. Grund: Ein vorhandener Entwurf lässt sich per API nicht
zuverlässig nachträglich veröffentlichen (ein unveröffentlichtes Foto geht
einen anderen Weg als ein Feed-Beitrag), und wer beides baut, bekommt am Ende
zwei Sachen auf der Seite. In der Meta Business Suite steht deshalb nichts mehr
— die Vorschau ist diese Seite.

## Wie sie gebaut ist

```
Browser  ──POST /api/freigabe──►  Vercel-Funktion  ──►  GitHub Actions  ──►  Instagram
                                        │
                                        └──► liest die Merklisten aus dem Blob-Speicher
```

⚠ **Die Funktion kennt KEINE Zugangsdaten der Netzwerke.** Weder Instagram
noch Facebook noch TikTok, auch nicht den Blob-Token. Sie prüft das Passwort
und startet einen Workflow — alles Weitere passiert in GitHub Actions, wo die
Geheimnisse ohnehin liegen. So gibt es sie nur an einer Stelle, und ein Fehler
in dieser Seite kann höchstens einen Lauf auslösen, den man auch von Hand
auslösen könnte.

⚠ **Der Blob-Speicher ist öffentlich lesbar** — er muss es sein, weil
Instagram die Bilder selbst dort abholt („We will cURL your image using the
passed in URL so it must be on a public server"). Ein Passwort auf den Bildern
träfe deshalb zuerst Instagram, nicht Fremde. Zugangsdaten stehen dort nicht
und dürfen dort nie landen. Das Passwort schützt also die Bedienung, nicht die
Bilder.

Seit 10.09.2026 tragen die **Bilddateien einen Zufallsanhang** im Pfad — ihre
Adressen lassen sich nicht mehr erraten. Die **Merklisten** bleiben dagegen
vorhersagbar (`social/<datum>/freigabe-<app>.json`): Diese Seite findet sie nur
so, weil ihre Funktion bewusst keinen Blob-Token hat. Sie enthalten Bildadresse
und Bildtext — also das, was ohnehin gleich veröffentlicht wird.

✅ **Eingerichtet am 09.09.2026: https://wellapps-freigabe.vercel.app**

## Einrichten (einmalig, ~5 Minuten)

**1. Neues Vercel-Projekt.** vercel.com → Add New → Project → Repository
`almaz6380/anigosha` importieren.

⚠ **Root Directory auf `freigabe-app` setzen** (unter „Build and Output
Settings" bzw. beim Import auf „Edit" neben Root Directory). Ohne das baut
Vercel die Anigosha-Spiel-App noch einmal.

Framework Preset: **Other**. Build Command und Output Directory leer lassen.

Projektname z. B. `wellapps-freigabe` → die Adresse ist dann
`wellapps-freigabe.vercel.app`.

**2. Drei Umgebungsvariablen** (Project Settings → Environment Variables,
alle drei für Production):

| Name | Wert |
|---|---|
| `FREIGABE_PASSWORT` | frei wählbar, mindestens 12 Zeichen |
| `GITHUB_TOKEN` | siehe unten |
| `BLOB_BASIS` | die Adresse des Blob-Speichers, ohne Schrägstrich am Ende |

`BLOB_BASIS` findest du so: Vercel → Storage → **social-bilder** → irgendeine
Datei öffnen → aus der Adresse alles bis `.com` nehmen, also
`https://<kennung>.public.blob.vercel-storage.com`.

**Der `GITHUB_TOKEN`:** github.com → Settings → Developer settings →
Personal access tokens → **Fine-grained tokens** → Generate new token.

- Repository access: **Only select repositories** → `almaz6380/anigosha`
- Permissions → Repository permissions → **Actions: Read and write**
- sonst nichts

⚠ Mehr Rechte braucht er nicht, und mehr sollte er nicht haben: Er liegt bei
einem Drittanbieter. Mit diesem Zuschnitt kann jemand, der ihn stiehlt,
Workflows starten — mehr nicht.

**3. Deploy.** Vercel baut beim Anlegen automatisch. Danach die Adresse am
Handy öffnen und zum Startbildschirm hinzufügen.

## Wenn nichts angezeigt wird

- **„Für … liegt nichts vor."** — An dem Tag lief kein *echter* Lauf.
  Probeläufe (`modus: trocken`) legen bewusst nichts ab.
- **Alles leer, obwohl ein Lauf lief** — dann stimmt `BLOB_BASIS` nicht.
  Die Funktion kann eine falsche Adresse nicht von „an dem Tag nichts"
  unterscheiden; beides sieht wie 404 aus.
- **„GitHub 404"** beim Veröffentlichen — der Token hat kein
  `Actions: Read and write`, oder er ist auf das falsche Repository
  eingeschränkt.
