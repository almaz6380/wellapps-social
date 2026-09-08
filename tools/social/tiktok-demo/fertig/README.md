# Demo-Video für TikToks App Review

`tiktok-demo.mp4` — 45,5 s · 1080×1920 · 30 fps · stumm.

Das ist die Fassung, die bei TikTok eingereicht wird. Sie zeigt, was die
Prüfung sehen will: dass die Erlaubnis sauber eingeholt wird und dass die
Automatik **nur einen Entwurf** anlegt, den ein Mensch veröffentlicht.

## Was drin ist

| Abschnitt | Herkunft |
|---|---|
| Titel, Ablauf, Erklärkarten, Schlusskarte | hier gerendert (`bauen.mjs`) |
| Protokollzeilen | wörtlich aus dem echten Lauf vom 05.09.2026 |
| Zustimmungsdialog (Mac, Safari privat) | Bildschirmaufnahme, 05.09.2026 |
| Entwurf im Posteingang (iPhone) | Bildschirmaufnahme, 07.09.2026 |

## Warum die Datei im Repo liegt

Dieselbe Begründung wie bei `tools/reels/fertig/`: `out/` ist gitignored, und
der Container einer Cloud-Sitzung ist flüchtig. Am 10.08. fiel der Dateibaum
zurück und nahm alles unter `out/` mit.

## Neu bauen

```bash
node tools/social/tiktok-demo/bauen.mjs --clip1 <anmeldung> --clip2 <entwurf>
```

⚠ **Die beiden Rohaufnahmen liegen NICHT im Repo.** Sie sind zusammen 25 MB
und zeigen einen privaten Bildschirm mitsamt Kontonamen. Ohne sie rendert
`bauen.mjs` an den zwei Stellen eine Platzhalterkarte, die sich im Bild
selbst als Platzhalter bezeichnet — ansehbar, aber nicht einreichbar.

⚠ **Der Zuschnitt ist auf genau diese zwei Aufnahmen gemessen** (`ZUSCHNITT`
in `bauen.mjs`). Bei neuen Aufnahmen die Werte nachmessen — Einzelbilder
ziehen und ansehen —, statt sie zu übernehmen. Zwei Dinge hängen daran:

1. Der Ausschnitt von clip1 behält die Adresszeile („tiktok.com"). Sie ist
   der Beleg, dass der Dialog von TikTok stammt und nicht nachgebaut ist.
2. `bis1` schneidet **vor** der Landeseite ab, auf der der OAuth-Code steht.
   Der Code ist verbraucht und einmalig — ein Zugangscode gehört trotzdem in
   kein Video, das aus dem Haus geht.
