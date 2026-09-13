#!/usr/bin/env python3
"""Genera il motivo della colonna Fanzine: il moire' di righe e cerchi.

Due famiglie di linee sottili, una dritta e una concentrica, sovrapposte.
Dove si incrociano nasce una terza figura che nessuno ha disegnato — le
frange d'interferenza — e la colonna si accende di onde larghe che nel
disegno non ci sono. E' lo stesso fenomeno che rovina le fotocopie delle
fotocopie: in tipografia lo si combatte, qui lo si cerca.

Cosa dice: le righe orizzontali sono la rigatura di una pagina, i cerchi
sono il sole del marchio. Messi insieme sono il sole stampato male, che e'
poi quello che una fanzine e'.

Il moire' non si puo' disegnare a mano e non esiste un file da cui copiarlo:
dipende dal passo delle due famiglie, e cambiando PASSO di un pixel cambia
tutta la figura.

    python tools/motivo-retino.py           # stampa l'SVG
    python tools/motivo-retino.py --prova   # scrive un provino da guardare
"""

import math
import sys

L = 300.0            # larghezza del disegno
H = 900.0            # altezza: la colonna e' molto alta
PASSO_RIGHE = 11.5   # distanza fra una riga e l'altra
PASSO_CERCHI = 11.0  # distanza fra un cerchio e l'altro: se fosse uguale al
                     # passo delle righe le frange sparirebbero
CENTRO = (0.5, 0.80)  # dove sta il centro dei cerchi, in quota sul riquadro


def svg():
    p = ['<svg viewBox="0 0 %d %d" fill="none" aria-hidden="true"'
         ' focusable="false" preserveAspectRatio="xMidYMid slice">' % (L, H)]

    # la rigatura della pagina
    p.append('<g stroke="currentColor" stroke-width="1" opacity="0.85">')
    n = int(H / PASSO_RIGHE) + 2
    for i in range(-1, n + 2):
        y = i * PASSO_RIGHE
        p.append('<path d="M0 %.1f L%.0f %.1f" vector-effect="non-scaling-stroke"/>'
                 % (y, L, y))
    p.append('</g>')

    # il sole: cerchi concentrici fino a uscire dal riquadro
    cx, cy = L * CENTRO[0], H * CENTRO[1]
    lontano = max(math.hypot(cx - x, cy - y) for x in (0, L) for y in (0, H))
    p.append('<g stroke="currentColor" stroke-width="1" opacity="0.85">')
    r = PASSO_CERCHI
    while r < lontano + PASSO_CERCHI:
        p.append('<circle cx="%.1f" cy="%.1f" r="%.1f"'
                 ' vector-effect="non-scaling-stroke"/>' % (cx, cy, r))
        r += PASSO_CERCHI
    p.append('</g></svg>')
    return ''.join(p)


if __name__ == '__main__':
    testo = svg()
    if '--prova' in sys.argv:
        col = ('<div class="col"><span class="mot">%s</span>'
               '<span class="t">FANZINE</span></div>')
        open('_prova-motivo.html', 'w', encoding='utf-8').write(
            '<!doctype html><meta charset="utf-8"><title>retino</title>'
            '<style>body{margin:0;background:#5a5a5d;display:flex;gap:20px;padding:20px}'
            '.col{position:relative;width:330px;height:860px;overflow:hidden;color:#fff;'
            'background:radial-gradient(44% 52% at 88% 4%, rgba(255,196,158,.3) 0%, transparent 72%),'
            'linear-gradient(142deg,#cc4103 0%,#a83505 56%)}'
            '.mot{position:absolute;inset:0;opacity:.5}'
            '.col:nth-child(2) .mot{opacity:.78}'
            '.mot svg{width:100%;height:100%;display:block}'
            '.t{position:absolute;left:22px;bottom:26px;font:700 40px monospace;letter-spacing:-.02em}'
            '</style>' + (col % testo) + (col % testo))
        print('provino in _prova-motivo.html')
    else:
        print(testo)
