# WELLapps Social

Die Social-Automatik für die fünf Apps Anigosha, Mahjong Royale, WELLbooked!,
FullRep und Swaply. Jeden Morgen entstehen je App ein Video und ein Bild; sie
landen als **Entwurf** bei TikTok und Facebook und liegen für Instagram bereit.
**Öffentlich wird nichts ohne einen Menschen.**

Bis zum 08.09.2026 lag das alles im Repo `almaz6380/anigosha`. Der Umzug hierher
und die Schritte, die dafür noch von Hand zu tun sind, stehen in `CLAUDE.md`.

| Ordner | Rolle |
|---|---|
| `tools/social/` | Orchestrator: Auswahl, Leitplanken, Rendern über die Motoren der App-Repos, Versand |
| `tools/social/veroeffentlichen/` | Die drei Kanäle (Facebook, TikTok, Instagram) und der Blob-Speicher — mit der Einrichtungsanleitung |
| `tools/reels/` | Der Reel-Generator, den `tools/social/reels-fremd/` für Swaply und WELLbooked! mitbenutzt |
| `freigabe-app/` | Die Freigabe-Seite fürs Handy (eigenes Vercel-Projekt) |
| `.github/workflows/` | Tageslauf, Instagram-Freigabe, Facebook-Entwürfe, Zugangs-Prüfung, TikTok-Zugang |

```bash
npm install
node tools/social/lauf.mjs --pruefung          # Leitplanken gegen Gegenbeispiele
node tools/social/lauf.mjs --trocken --tage 14 # Redaktionsplan, ohne zu rendern
node tools/social/posten.mjs --trocken         # was ein Versand tun wuerde
```
