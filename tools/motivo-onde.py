#!/usr/bin/env python3
"""Genera il motivo della colonna Events: due sorgenti d'onda che interferiscono.

Due punti che emettono cerchi concentrici, come due sassi buttati nell'acqua.
Dove le due famiglie di cerchi si incrociano nasce da sola una terza figura —
le frange d'interferenza, che sono iperboli — che nessuno ha disegnato: viene
fuori dalla matematica. E' la stessa cosa che si vede in una vasca a onde, e
la stessa che fanno due casse in una stanza.

Perche' proprio questo su Events: Taranto e' la citta' dei due mari, e due
sorgenti che si incontrano sono esattamente quello. Sotto, sono onde sonore.

    python tools/motivo-onde.py          # stampa l'SVG
    python tools/motivo-onde.py --file   # lo scrive in assets/data/
"""

import sys
import os
import math

L = 300.0           # larghezza del disegno
H = 640.0           # altezza
LAMBDA = 15.5       # distanza fra una cresta e l'altra
SORGENTI = [(72.0, 612.0), (228.0, 612.0)]


def cerchi(cx, cy):
    """Le creste di una sorgente: cerchi concentrici fino a coprire il campo."""
    lontano = max(math.hypot(cx - x, cy - y)
                  for x in (0, L) for y in (0, H))
    fuori = []
    r = LAMBDA
    while r < lontano + LAMBDA:
        # le onde lontane si smorzano: l'opacita' cala con la distanza
        f = max(0.18, 1.0 - (r / lontano) * 0.78)
        fuori.append((r, f))
        r += LAMBDA
    return fuori


def svg():
    parti = ['<svg viewBox="0 0 %d %d" fill="none" aria-hidden="true"'
             ' focusable="false" preserveAspectRatio="xMidYMid slice">' % (L, H)]
    parti.append('<g stroke="currentColor" fill="none" stroke-width="1">')
    for cx, cy in SORGENTI:
        for r, f in cerchi(cx, cy):
            parti.append('<circle cx="%g" cy="%g" r="%.1f" opacity="%.2f"'
                         ' vector-effect="non-scaling-stroke"/>' % (cx, cy, r, f))
    # i due punti da cui parte tutto: piccoli, pieni, si notano appena
    for cx, cy in SORGENTI:
        parti.append('<circle cx="%g" cy="%g" r="2.6" fill="currentColor"'
                     ' stroke="none" opacity="0.55"/>' % (cx, cy))
    parti.append('</g></svg>')
    return ''.join(parti)


if __name__ == '__main__':
    testo = svg()
    if '--file' in sys.argv:
        d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         'assets', 'data')
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, 'motivo-onde.svg')
        open(p, 'w', encoding='utf-8').write(testo)
        print('scritto %s (%.1f kB)' % (p, len(testo) / 1024))
    else:
        print(testo)
