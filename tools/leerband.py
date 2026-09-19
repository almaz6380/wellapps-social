#!/usr/bin/env python3
"""Groesste ZUSAMMENHAENGENDE Leerflaeche je Karte, gegen den Markengrund.

⚠ Nicht nur den Rand unten pruefen — genau daran ist die erste Messung an den
A-Entwuerfen vorbeigelaufen: sie meldete 5 %, waehrend zwischen Text und
Knoepfen 11–17 % leer standen.
"""
import sys
from PIL import Image

GRUND = (27, 67, 50)   # #1b4332


def band(pfad):
    bild = Image.open(pfad).convert('RGB')
    b, h = bild.size
    px = bild.load()
    leer = []
    for y in range(h):
        stark = 0
        for x in range(0, b, 4):
            r, g, bl = px[x, y]
            if abs(r - GRUND[0]) + abs(g - GRUND[1]) + abs(bl - GRUND[2]) > 42:
                stark += 1
        leer.append(stark < (b / 4) * 0.02)
    laengste = lauf = anfang = besterAnfang = 0
    for y, l in enumerate(leer):
        if l:
            if lauf == 0:
                anfang = y
            lauf += 1
            if lauf > laengste:
                laengste, besterAnfang = lauf, anfang
        else:
            lauf = 0
    return laengste / h, besterAnfang, laengste


for p in sys.argv[1:]:
    anteil, ab, hoch = band(p)
    marke = '  ⚠ ueber 10 %' if anteil > 0.10 else ''
    print(f'{p.split("/")[-1]}  {anteil*100:5.1f} %  (ab y={ab}, {hoch} px){marke}')
