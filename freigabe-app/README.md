# Freigabe-Seite

Eine kleine Seite fürs Handy, die die Social-Entwürfe eines Tages zeigt —
Video oder Bild, den Text zum Kopieren, und je Kanal, was schon passiert ist.
Instagram lässt sich von hier freigeben.

Gebaut, damit der Weg über GitHub Actions entfällt.

## Was sie kann — und was bewusst nicht

| Kanal | hier |
|---|---|
| **Instagram** | Knopf „Auf Instagram veröffentlichen". Der einzige Kanal, der wirklich auf eine Freigabe wartet — Instagram kennt keine Entwürfe. |
| **Facebook** | nur ansehen. Der Entwurf liegt schon auf der Seite; freigegeben wird er in der Meta Business Suite. |
| **TikTok** | nur ansehen, Text zum Kopieren. TikToks Posteingang nimmt keinen Text an, und veröffentlichen kann ihn nur ein Mensch in der App. |

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
Instagram die Bilder selbst dort abholt. Die Merklisten liegen darin und
enthalten Bildadresse und Bildtext, also genau das, was ohnehin gleich
veröffentlicht wird. Zugangsdaten stehen dort nicht und dürfen dort nie
landen. Das Passwort schützt also die Bedienung, nicht die Bilder.

## Einrichten (einmalig, ~5 Minuten)

**1. Neues Vercel-Projekt.** vercel.com → Add New → Project → Repository
`almaz6380/wellapps-social` importieren.

⚠ **Root Directory auf `freigabe-app` setzen** (unter „Build and Output
Settings" bzw. beim Import auf „Edit" neben Root Directory). Ohne das nimmt
Vercel die Wurzel des Repos, und dort liegt keine Seite — nur die Werkzeuge.

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

- Repository access: **Only select repositories** → `almaz6380/wellapps-social`
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
  eingeschränkt. ⚠ Seit dem Umzug (08.09.2026) ist das richtige Repository
  `almaz6380/wellapps-social`, nicht mehr `anigosha` — ein Token von vorher
  zeigt auf das falsche und muss neu erzeugt werden.
