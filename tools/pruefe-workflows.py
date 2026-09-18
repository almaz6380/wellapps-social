#!/usr/bin/env python3
"""Jagt jeden `run:`-Block der Workflows durch `bash -n`.

    python3 tools/pruefe-workflows.py

⚠ WARUM ES DIESES SKRIPT GIBT — die Falle hat ZWEIMAL zugeschnappt, und beim
zweiten Mal acht Tage lang:

    echo "… steht nicht auf „an". Nichts getan."
                                ^^^^^^^
    /home/runner/work/_temp/….sh: line 5: unexpected EOF while looking for
    matching `"'
    ##[error]Process completed with exit code 2.

Das Paar „…" besteht aus U+201E (deutsches Anfuehrungszeichen unten) und einem
GEWOEHNLICHEN ASCII-Anfuehrungszeichen. Das zweite schliesst den String, und
der Rest der Zeile zerfaellt.

Zwei Dinge machen den Fehler so teuer:

1. **Bash liest das ganze Skript, bevor es die erste Zeile ausfuehrt.** Die
   kaputte Zeile stand im `then`-Zweig einer Abfrage, die gar nicht zutraf —
   der Schritt starb trotzdem. „Der Zweig wird doch nie genommen" ist keine
   Verteidigung.
2. **Es sieht nach einem Konfigurationsproblem aus.** Am 18.09.2026 stand
   `SOCIAL_ZEITPLAN` korrekt auf `an`, der Zeitplan war scharf, und der Lauf
   starb nach acht Sekunden. Wer den Fehler nicht liest, sucht in der
   Variablen.

⚠ Es geht NICHT um deutsche Anfuehrungszeichen an sich. In einem Kommentar
(`# … „so" …`) sind sie harmlos, und `\\"` als Abschluss ist gueltig. Deshalb
prueft dieses Skript mit `bash -n` statt mit einer Zeichensuche: Es fragt
bash, nicht eine Vermutung ueber bash.

Beendet sich mit 1, wenn ein Block nicht parst — so kann es in einen Workflow.
"""

import pathlib
import subprocess
import sys

import yaml


def schritte(doc):
    """(Jobname, Schrittname, Shell, Skript) fuer jeden run-Block."""
    vorgabe = ((doc.get('defaults') or {}).get('run') or {}).get('shell')
    for jobname, job in (doc.get('jobs') or {}).items():
        job_vorgabe = ((job.get('defaults') or {}).get('run') or {}).get('shell')
        for i, step in enumerate(job.get('steps') or []):
            skript = step.get('run')
            if not skript:
                continue
            shell = step.get('shell') or job_vorgabe or vorgabe or 'bash'
            yield jobname, step.get('name') or f'Schritt {i}', shell, skript


def main():
    wurzel = pathlib.Path(__file__).resolve().parent.parent / '.github' / 'workflows'
    fehler = 0
    geprueft = 0

    for pfad in sorted(wurzel.glob('*.y*ml')):
        doc = yaml.safe_load(pfad.read_text(encoding='utf8'))
        for jobname, name, shell, skript in schritte(doc):
            # Nur was bash wirklich liest. `shell: python` oder `pwsh` haette
            # eigene Regeln, und `bash -n` daraufzuwerfen brächte Fehlalarme.
            if 'bash' not in shell and shell != 'sh':
                print(f'– {pfad.name} · {jobname} · {name} (shell: {shell})')
                continue
            geprueft += 1
            lauf = subprocess.run(['bash', '-n'], input=skript,
                                  text=True, capture_output=True)
            if lauf.returncode == 0:
                print(f'✓ {pfad.name} · {jobname} · {name}')
                continue
            fehler += 1
            print(f'✗ {pfad.name} · {jobname} · {name}')
            for zeile in lauf.stderr.strip().split('\n'):
                print(f'    {zeile}')

    print()
    if fehler:
        print(f'✗ {fehler} von {geprueft} run-Bloecken parsen nicht.')
        return 1
    print(f'✓ Alle {geprueft} run-Bloecke parsen.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
