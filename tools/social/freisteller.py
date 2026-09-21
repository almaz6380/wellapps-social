#!/usr/bin/env python3
"""Eine Figur vor einfarbigem Grund freistellen.

    python3 tools/social/freisteller.py roh.png figur.png
    python3 tools/social/freisteller.py roh.png figur.png --farbe 00B140 --toleranz 60

--- Wofuer (21.09.2026) -------------------------------------------------------

Josef erzeugt je App eine Figur, die am Kartenrand stehen soll. Dafuer braucht
sie einen durchsichtigen Hintergrund — sonst klebt ein weisser Kasten auf der
Karte. Nicht jedes Bildwerkzeug kann Alpha ausgeben; die Prompts verlangen
deshalb einen einfarbigen Chroma-Gruen-Grund, und der wird hier ausgekeyt.

⚠ Traegt das Bild schon Alpha, geht es UNVERAENDERT durch. Ein zweites Keying
ueber ein bereits freigestelltes Bild frisst nur Kanten weg.

--- Zwei Dinge, die ein naives Keying falsch macht ----------------------------

1. **Harte Kante.** Wer nur „Pixel gleich Gruen -> durchsichtig" macht, laesst
   einen Treppenrand und einen gruenen Saum stehen. Hier faellt die Deckkraft
   ueber eine Spanne ab (`toleranz` bis `toleranz * 2`), das ergibt eine weiche
   Kante.

2. **Gruenstich (Spill).** Halbdurchsichtige Randpixel tragen noch Grun in
   sich. Deshalb wird dort, wo Gruen deutlich ueber Rot und Blau liegt, der
   Gruenkanal auf das Mittel der beiden anderen gezogen. Ohne das hat die Figur
   auf einer dunklen Karte einen leuchtenden Rand, und der faellt erst am
   fertigen Post auf.

⚠ KEINE Bibliothek fuer Hintergrundentfernung (rembg o. ae.) — die ist in
diesem Container nicht da, und sie ist hier auch nicht noetig: Der Hintergrund
ist per Prompt einfarbig. Wer ein Bild mit echtem Hintergrund hat, stellt es
anderswo frei; dieses Werkzeug rechnet nicht, es keyt.
"""

import sys
from pathlib import Path

from PIL import Image


def wert(name, standard):
    if f"--{name}" in sys.argv:
        return sys.argv[sys.argv.index(f"--{name}") + 1]
    return standard


def beschneiden(bild):
    """Die durchsichtigen Raender wegschneiden.

    ⚠ DAS IST NICHT KOSMETIK, ES ENTSCHEIDET DIE GROESSE AUF DER KARTE.
    Ein stehender Mensch in einem 3:4-Bild hat links und rechts viel Luft.
    Die Karte gibt der Figur einen Kasten von rund 300 px Breite; mit den
    Raendern passt die Figur per `contain` nach BREITE hinein und wird
    dadurch nur etwa 400 px hoch — eine kleine Gestalt in der unteren Ecke
    statt einer Figur am Rand. Gemessen am ersten Versuch vom 21.09.2026.

    Ohne Raender ist das Verhaeltnis der Figur selbst schmal und hoch, und
    dieselben 300 px Breite ergeben rund 800 px Hoehe. Erst damit steht sie
    wirklich neben dem Text.
    """
    kasten = bild.getbbox()
    return bild.crop(kasten) if kasten else bild


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    # Die Werte der Optionen stehen hinter ihnen und sind keine Dateinamen.
    for name in ("farbe", "toleranz"):
        if f"--{name}" in sys.argv:
            v = sys.argv[sys.argv.index(f"--{name}") + 1]
            if v in args:
                args.remove(v)

    if len(args) != 2:
        print(__doc__)
        sys.exit(1)

    quelle, ziel = Path(args[0]), Path(args[1])
    if not quelle.exists():
        print(f"✗ Nicht gefunden: {quelle}")
        sys.exit(1)

    bild = Image.open(quelle)

    # ⚠ Schon freigestellt? Dann nichts anfassen. Ein Alphakanal, der nicht
    # ueberall voll deckend ist, heisst: Da hat schon jemand gearbeitet.
    if bild.mode in ("RGBA", "LA"):
        alpha = bild.getchannel("A")
        if alpha.getextrema()[0] < 255:
            # ⚠ Auch hier beschneiden: Ein fertig freigestelltes Bild kann
            # genauso durchsichtige Raender haben, und die kosten auf der
            # Karte dieselbe Hoehe.
            vorher = bild.size
            bild = beschneiden(bild)
            bild.save(ziel)
            print(f"✓ {ziel.name} — trug bereits Alpha, beschnitten auf "
                  f"{bild.size[0]}×{bild.size[1]} (aus {vorher[0]}×{vorher[1]}).")
            return

    bild = bild.convert("RGBA")
    breite, hoehe = bild.size

    roh = wert("farbe", "00B140").lstrip("#")
    schluessel = tuple(int(roh[i:i + 2], 16) for i in (0, 2, 4))
    toleranz = int(wert("toleranz", "60"))
    weich = toleranz * 2

    px = bild.load()
    getroffen = 0
    for y in range(hoehe):
        for x in range(breite):
            r, g, b, a = px[x, y]
            abstand = abs(r - schluessel[0]) + abs(g - schluessel[1]) + abs(b - schluessel[2])

            if abstand <= toleranz:
                px[x, y] = (r, g, b, 0)
                getroffen += 1
                continue

            if abstand < weich:
                # Weiche Kante: von 0 bei `toleranz` auf voll bei `weich`.
                neu = int(a * (abstand - toleranz) / (weich - toleranz))
                px[x, y] = (r, g, b, neu)

            # Gruenstich abziehen — auch bei voll deckenden Pixeln, denn der
            # Saum um Haare herum ist oft deckend und trotzdem gruenlich.
            if g > r and g > b:
                mittel = (r + b) // 2
                if g - mittel > 12:
                    px[x, y] = (r, mittel, b, px[x, y][3])

    if not getroffen:
        print(f"⚠ Kein einziges Pixel der Farbe #{roh} getroffen.")
        print("  Entweder ist der Hintergrund eine andere Farbe, oder das Bild")
        print("  ist gar nicht einfarbig hinterlegt. Nichts geschrieben.")
        sys.exit(1)

    bild = beschneiden(bild)
    ziel.parent.mkdir(parents=True, exist_ok=True)
    bild.save(ziel)
    anteil = getroffen * 100 // (breite * hoehe)
    print(f"✓ {ziel.name} — {bild.size[0]}×{bild.size[1]} (aus {breite}×{hoehe}), "
          f"{anteil} % des Originals durchsichtig.")
    if anteil > 92:
        print("⚠ Ueber 92 % weg. Sieh nach, ob die Figur noch da ist.")


if __name__ == "__main__":
    main()
