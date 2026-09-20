# Musikteppiche für die TikTok-Diashows

Liegt hier, weil `social-tiktok-posten.yml` **nur dieses Repo** auscheckt —
eine einzige `actions/checkout@v4`, kein App-Repo daneben. Ein Verweis nach
`wellbooked/` liefe im Lauf ins Leere.

| App | Datei | Herkunft |
|---|---|---|
| WELLbooked! | `musik/wellbooked-indie.mp3` | Kopie von `wellbooked/docs/reels/musik/indie-verwendet.mp3` (25 s · 117 BPM) |
| Anigosha | `../reels/assets/sfx/anisong.aac` | eigens erzeugter Anisong (54 s), liegt schon hier |
| Mahjong Royale | `../reels/assets/sfx/bett.aac` | der allgemeine Teppich (32 s) — s. Warnung unten |
| FullRep | `musik/fullrep-bett.mp3` | erzeugt 20.09.2026, kie.ai/Suno V5, instrumental (2:12) |
| Swaply | `musik/swaply-bett.mp3` | erzeugt 20.09.2026, kie.ai/Suno V5, instrumental (3:25) |

Die zwei neuen sind mit `tools/social/musik-erzeugen.mjs` entstanden; je eine
Anfrage (~0,06 $) liefert zwei Fassungen, Josef hat gewählt. Auch sie sind
**nicht reproduzierbar** — deshalb liegen die Dateien hier und nicht nur der
Prompt.

⚠ **Swaply klingt bewusst nicht antreibend.** Die App begleitet Menschen beim
Ablegen einer Gewohnheit; ein anfeuernder Teppich wäre dort der falsche Ton.
Der Stil ist auf „tragend" beschrieben, nicht auf „motivierend".

Die Zuordnung steht in `MUSIK` in `tools/social/folien-video.mjs`. Ohne
Eintrag bleibt die Diashow stumm; das ist kein Fehler.

## ⚠ `bett.aac` ist KEINE App-Melodie

Am 19.09.2026 nachgemessen: Die Datei liegt in `anigosha`, in `mahjong-app`
und hier — **dreimal mit derselben Prüfsumme** (`6d087418…`). Sie ist ein
allgemeiner Teppich, der herumkopiert wurde, kein Kanalklang.

Ich hatte sie vorher als „Anigoshas und Mahjongs eigene" bezeichnet. Das war
falsch und ist hier richtiggestellt: Anigoshas eigene ist `anisong.aac`,
Mahjong hat nur den allgemeinen — und benutzt ihn bereits in seinen Reels,
der Kanal klingt also ohnehin so.

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
