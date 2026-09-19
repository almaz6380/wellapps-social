# Musikteppiche für die TikTok-Diashows

Liegt hier, weil `social-tiktok-posten.yml` **nur dieses Repo** auscheckt —
eine einzige `actions/checkout@v4`, kein App-Repo daneben. Ein Verweis nach
`wellbooked/` liefe im Lauf ins Leere.

| Datei | App | Herkunft |
|---|---|---|
| `wellbooked-indie.mp3` | WELLbooked! | Kopie von `wellbooked/docs/reels/musik/indie-verwendet.mp3` (25 s · 117 BPM) |

## ⚠ Das Original steht woanders

Die führende Fassung liegt in **`wellbooked/docs/reels/musik/`**, samt dem
LIESMICH, das die verworfenen Alternativen begründet (`lyria.mp3` „zu brav",
`werb.mp3` Werbespot-Charakter). Wer die Melodie wechselt, wechselt sie dort
und kopiert hierher — nicht umgekehrt.

Prüfen, ob beide noch gleich sind:

```
md5sum tools/social/musik/wellbooked-indie.mp3 \
       ../wellbooked/docs/reels/musik/indie-verwendet.mp3
```

## ⚠ Nicht neu erzeugen

Die Datei stammt von fal.ai `lyria2` und ist **nicht reproduzierbar** — jeder
Lauf klingt anders. Deshalb liegt sie im Repo und nicht nur ihr Prompt.

Am 19.09.2026 wollte Claude dafür eine neue Melodie erzeugen lassen, obwohl
diese hier längst existierte. Josef hat es bemerkt. **Vor jedem Erzeugen erst
suchen** — eine Suche über Audiodateien hätte sie in zwei Sekunden gefunden.

## Wie sie verwendet wird

`tools/social/folien-video.mjs` schneidet den Teppich über `tonBett()` auf die
Videolänge zu, mit Ein- und Ausblende und auf halber Lautstärke. Länger als
das Video ist also richtig; hart abgeschnittene Musik klingt nach Aussetzer.

Für die anderen vier Apps gibt es noch keinen Eintrag. Ohne Eintrag bleibt die
Diashow stumm — das ist der bisherige Zustand, kein Fehler.
