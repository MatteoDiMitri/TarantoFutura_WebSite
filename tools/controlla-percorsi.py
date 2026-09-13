#!/usr/bin/env python3
"""Controlla i percorsi del sito come li vedrebbe un server vero.

Su Windows "Src/Css" e "src/css" sono lo stesso file; su Linux — cioe' su
qualunque hosting — no. Un percorso scritto con la maiuscola sbagliata
funziona in locale e da 404 appena il sito va online: e' il modo piu' comune
di ritrovarsi la pagina senza CSS. Qui ogni percorso citato viene confrontato
lettera per lettera col nome vero sul disco.

    python tools/controlla-percorsi.py [cartella]
"""

import os
import re
import io
import sys

TESTI = ('.html', '.css', '.js')


def mappa(radice):
    reali = {}
    for cartella, _, file in os.walk(radice):
        for f in file:
            p = os.path.relpath(os.path.join(cartella, f), radice)
            p = p.replace(os.sep, '/')
            reali[p.lower()] = p
    return reali


def controlla(radice):
    reali = mappa(radice)
    problemi = []

    def guarda(citato, dentro):
        p = citato.split('?')[0].split('#')[0]
        # %23 e' un cancelletto codificato: quei riferimenti puntano dentro a un
        # SVG scritto nell'indirizzo stesso, non a file da cercare sul disco
        if not p or p.startswith(('http', 'mailto:', 'data:', '//', '#', '%23')):
            return

        # Un indirizzo scritto dentro a un .js finisce nella pagina, quindi si
        # conta dalla radice del sito; ma lo stesso .js importa anche i moduli
        # accanto a se'. Si accettano tutte e due le letture, e si protesta
        # solo se non esiste ne' l'una ne' l'altra.
        candidati = []
        if p.startswith('/'):
            candidati.append(p.lstrip('/'))
        else:
            candidati.append(os.path.join(os.path.dirname(dentro), p))
            if dentro.endswith('.js'):
                candidati.append(p)

        trovati = []
        for c in candidati:
            q = os.path.normpath(c).replace(os.sep, '/')
            vero = reali.get(q.lower())
            if vero is not None:
                trovati.append((q, vero))

        if not trovati:
            q = os.path.normpath(candidati[0]).replace(os.sep, '/')
            problemi.append('NON ESISTE  %s   (citato in %s)' % (q, dentro))
            return
        for q, vero in trovati:
            if vero != q:
                problemi.append('MAIUSCOLE   citato %s   ma sul disco e\' %s   (in %s)'
                                % (q, vero, dentro))

    for rel in sorted(reali.values()):
        if not rel.endswith(TESTI):
            continue
        testo = io.open(os.path.join(radice, rel), encoding='utf-8',
                        errors='ignore').read()
        for m in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', testo):
            guarda(m, rel)
        for m in re.findall(r'url\(["\']?([^)"\']+)', testo):
            guarda(m, rel)
        for m in re.findall(r'from\s+["\']([^"\']+)["\']', testo):
            guarda(m, rel)

    print('file totali: %d' % len(reali))
    print('problemi: %d' % len(problemi))
    for x in problemi[:20]:
        print('  ' + x)
    return len(problemi)


if __name__ == '__main__':
    radice = sys.argv[1] if len(sys.argv) > 1 else '.'
    sys.exit(1 if controlla(radice) else 0)
