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

2. **Gruenstich (Spill).** Der Saum traegt noch Gruen vom Hintergrund. Ohne
   Abzug hat die Figur auf einer dunklen Karte einen leuchtenden Rand, und der
   faellt erst am fertigen Post auf. Entscheidend ist, WO abgezogen wird —
   siehe `entgruenen()`; zwei falsche Fassungen stehen dort mit ihrem Befund.

⚠ DIE TOLERANZ IST NICHT BELIEBIG NACH OBEN OFFEN. Am 22.09.2026 gemessen:
Swaplys Wasserflasche liegt 81 vom Schluessel entfernt. Bei `--toleranz 40`
(weiche Kante bis 80) bleibt sie voll deckend; bei 50 (Kante bis 100) waere
sie halb durchsichtig geworden. Vor einer hoeheren Toleranz also nachsehen,
ob die Figur etwas in der Naehe der Schluesselfarbe traegt.

⚠ KEINE Bibliothek fuer Hintergrundentfernung (rembg o. ae.) — die ist in
diesem Container nicht da, und sie ist hier auch nicht noetig: Der Hintergrund
ist per Prompt einfarbig. Wer ein Bild mit echtem Hintergrund hat, stellt es
anderswo frei; dieses Werkzeug rechnet nicht, es keyt.
"""

import sys
from pathlib import Path

from PIL import Image, ImageFilter


def wert(name, standard):
    if f"--{name}" in sys.argv:
        return sys.argv[sys.argv.index(f"--{name}") + 1]
    return standard


def randfarbe(bild, rahmen=3):
    """Die Hintergrundfarbe aus dem Bildrand ablesen.

    Gibt den Median des Rahmens zurueck und, als zweiten Wert, wie weit der
    Rand davon abweicht (groesster Abstand). Aus dem zweiten Wert ergibt sich
    die Toleranz: Sie muss die Streuung des Hintergrunds abdecken und darf
    trotzdem nicht in die Figur reichen.

    ⚠ Der Rahmen ist der Hintergrund. Das gilt, weil die Prompts „the whole
    figure inside the frame" verlangen — steht die Figur am Rand an, misst
    dieses Werkzeug ihre Farbe und keyt sie aus. Deshalb sagt es unten, was es
    gemessen hat: Eine Schluesselfarbe, die nicht nach Hintergrund aussieht,
    faellt so vor dem Rendern auf.
    """
    px = bild.convert("RGB").load()
    w, h = bild.size
    rand = [px[x, y] for x in range(w) for y in range(rahmen)]
    rand += [px[x, h - 1 - y] for x in range(w) for y in range(rahmen)]
    rand += [px[x, y] for y in range(h) for x in range(rahmen)]
    rand += [px[w - 1 - x, y] for y in range(h) for x in range(rahmen)]
    mitte = tuple(sorted(k[i] for k in rand)[len(rand) // 2] for i in range(3))
    streuung = max(abs(k[0] - mitte[0]) + abs(k[1] - mitte[1]) + abs(k[2] - mitte[2])
                   for k in rand)
    return mitte, streuung


def luecke(bild, schluessel, streuung, schwelle=0.005):
    """Ab welchem Abstand die FIGUR anfaengt.

    ⚠ DAS IST DIE WICHTIGSTE MESSUNG DIESES WERKZEUGS, und sie ist am
    22.09.2026 aus zwei Fehlschlaegen entstanden:

    · Zu KNAPPE Toleranz: In der engen Luecke zwischen Arm und Rumpf liegt
      der Hintergrund im Schatten und damit weiter weg vom Schluessel als die
      freie Flaeche. Er blieb stehen — als leuchtend gruene Linie mitten in
      FullReps Figur, auf Schwarz nicht zu uebersehen (gemessen: Abstand 55
      bei einer Kante, die bei 60 endete).
    · Zu WEITE Toleranz: Swaplys tuerkise Wasserflasche liegt nur 81 vom
      Schluessel entfernt. Eine Kante bis 100 haette sie halb weggefressen.

    Zwischen Hintergrund und Figur liegt eine LUECKE im Abstands-Histogramm —
    bei diesen drei Bildern rund 80 Prozent der Pixel unter 30 und der naechste
    nennenswerte Anteil erst bei 100 bis 180. Diese Funktion sucht das obere
    Ende der Luecke: den ersten Abstand oberhalb der Randstreuung, ab dem
    wieder nennenswert viele Pixel liegen. Danach richten sich Toleranz und
    weiche Kante — statt nach einem geratenen Wert.
    """
    px = bild.convert("RGB").load()
    w, h = bild.size
    grenze = max(1, int(w * h * schwelle))
    eimer = [0] * 26                      # je 20 Einheiten Abstand, bis 500
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = abs(r - schluessel[0]) + abs(g - schluessel[1]) + abs(b - schluessel[2])
            eimer[min(d // 20, 25)] += 1

    # ⚠ ERST DAS TAL FINDEN, DANN DEN ANSTIEG. Wer direkt oberhalb der
    # Randstreuung nach dem ersten nennenswerten Eimer sucht, bleibt am
    # Kantenrauschen haengen: Bei FullReps Bild traegt schon der Eimer bei 20
    # gute 0,65 % — das sind die weichen Kantenpixel, nicht die Figur. Das
    # Ergebnis war eine Kante bis 40, und die gruene Linie zwischen Arm und
    # Rumpf (Abstand 55) blieb stehen.
    start = max(1, (streuung // 20) + 1)
    tal = min(range(start, 11), key=lambda i: eimer[i])
    for i in range(tal, 26):
        if eimer[i] >= grenze:
            return i * 20
    # Nichts gefunden: Das Bild ist fast nur Hintergrund. Dann lieber eng
    # bleiben, als etwas wegzuschneiden, das noch da ist.
    return max(streuung * 2, 60)


def entgruenen(bild, breite=2):
    """Den Gruenstich am Saum abziehen — und NUR dort.

    ⚠ ZWEI FASSUNGEN WAREN VORHER FALSCH, beide am 22.09.2026 am fertigen
    Bild gesehen:

    1. Bei JEDEM gruendominanten Pixel. Das faerbte Swaplys tuerkise
       Wasserflasche blau: Sie liegt bei (25,142,124), nur 81 vom Schluessel
       entfernt, und „Gruen deutlich ueber Rot und Blau" trifft auf sie
       genauso zu wie auf einen Hintergrundsaum.
    2. Nur bei halbdurchsichtigen Pixeln. Damit blieb ein gruener Rand um
       FullReps und Swaplys Silhouette stehen — auf Schwarz deutlich
       sichtbar, auf Weiss gar nicht. Der Saum ist naemlich oft VOLL DECKEND
       und trotzdem gruenlich.

    Richtig ist die Lage, nicht die Farbe und nicht die Deckkraft: Streulicht
    gibt es nur DORT, WO DER HINTERGRUND WAR. Also wird der durchsichtige
    Bereich um ein paar Pixel aufgeweitet, und nur in diesem Band wird
    entgruent. Die Flasche liegt mitten in der Figur und bleibt unberuehrt.
    """
    alpha = bild.getchannel("A")
    # ⚠ Nur VOLL durchsichtige Pixel keimen das Band, nicht `a < 255`.
    # Sonst genuegt ein einzelnes verrauschtes Pixel MITTEN in der Figur, um
    # dort ein Saumband zu eroeffnen. Genau das ist am 22.09.2026 passiert:
    # Swaplys Flasche liegt nah an der Schluesselfarbe, einzelne Pixel rutschten
    # in die weiche Kante, und das Entgruenen fraes sich fleckig durch die
    # Flasche — gesehen erst im vierfach vergroesserten Ausschnitt.
    loch = alpha.point(lambda a: 255 if a == 0 else 0)
    band = loch.filter(ImageFilter.MaxFilter(breite * 2 + 1))

    px = bild.load()
    bp = band.load()
    w, h = bild.size
    stark = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            # ⚠ ZWEITE REGEL, UNABHAENGIG VOM BAND: Was KRAEFTIG gruen ist,
            # ist Hintergrund — ueberall im Bild.
            #
            # In der engen Luecke zwischen Arm und Rumpf liegt der Hintergrund
            # im Schatten und damit weiter weg vom Schluessel als die freie
            # Flaeche; ein Rest davon ueberlebt jede vertretbare Toleranz. Am
            # 22.09.2026 blieb genau dort eine leuchtend gruene Linie in
            # FullReps Figur stehen.
            #
            # Die Schwelle ist gemessen, nicht gegriffen: Der Rest lag bei
            # (22,136,49), also Gruen 114 ueber Rot und 87 ueber Blau.
            # Swaplys tuerkise Flasche liegt bei (26,145,125) — Gruen nur 20
            # ueber Blau. Mit „40 ueber BEIDEN" trennt die Regel die zwei
            # Faelle sauber. Wie viele Pixel sie trifft, steht unten; eine
            # dreistellige Zahl ist Saum, eine fuenfstellige waere ein gruenes
            # Kleidungsstueck und ein Grund, hier nachzusehen.
            if g > r + 40 and g > b + 40:
                px[x, y] = (r, (r + b) // 2, b, a)
                stark += 1
                continue
            if not bp[x, y]:
                continue
            if g > r and g > b:
                mittel = (r + b) // 2
                if g - mittel > 12:
                    px[x, y] = (r, mittel, b, a)
    return stark


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

    # ⚠ SCHLUESSELFARBE UND TOLERANZ WERDEN GEMESSEN, NICHT GERATEN.
    #
    # Der Prompt verlangt `#00B140`. Was am 22.09.2026 wirklich zurueckkam,
    # lag bei (11,160,75) — dunkler und matter, mit leichter Vignette. Ein
    # fester Vorgabewert traegt so etwas nur zufaellig mit, und wenn er
    # danebenliegt, sieht man es nicht am Protokoll, sondern erst als Kasten
    # auf der Karte.
    schluessel, streuung = randfarbe(bild)
    roh = wert("farbe", None)
    if roh:
        roh = roh.lstrip("#")
        schluessel = tuple(int(roh[i:i + 2], 16) for i in (0, 2, 4))

    # ⚠ Die Kante endet bei 60 % des Weges zur Figur, nicht direkt davor.
    # Dazwischen liegt bei jedem Bild ein flaches Tal (0,1 bis 0,4 % der
    # Pixel) — Kantenpixel und, bei Swaply, die tuerkise Flasche bei Abstand
    # 81. Wer die Kante bis kurz vor die Figurmasse zieht, frisst sie an.
    figurAb = luecke(bild, schluessel, streuung)
    weich = int(wert("weich", max(40, int(figurAb * 0.6))))
    toleranz = int(wert("toleranz", weich // 2))
    print(f"   Schluessel #{schluessel[0]:02x}{schluessel[1]:02x}{schluessel[2]:02x}"
          f" · Rand streut bis {streuung} · Figur beginnt bei {figurAb}"
          f" · Toleranz {toleranz}, weiche Kante bis {weich}")
    if weich <= toleranz:
        weich = toleranz + 10

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


    if not getroffen:
        print(f"⚠ Kein einziges Pixel der Farbe #{roh} getroffen.")
        print("  Entweder ist der Hintergrund eine andere Farbe, oder das Bild")
        print("  ist gar nicht einfarbig hinterlegt. Nichts geschrieben.")
        sys.exit(1)

    stark = entgruenen(bild)
    if stark:
        print(f"   {stark} kraeftig gruene Pixel neutralisiert (Saum in engen Luecken)")
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
