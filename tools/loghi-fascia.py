#!/usr/bin/env python3
"""Porta i loghi dei partner a un inchiostro solo, per la fascia.

I loghi arrivano come screenshot dai profili Instagram: cerchi colorati, fondi
neri, tre varianti nella stessa immagine. Messi in fila cosi' come sono
sembrerebbero un collage di banner. Qui ognuno viene ridotto alla sua forma —
una sagoma con la sola trasparenza, senza colore — e il colore glielo da' il
CSS: un inchiostro unico per tutti, che si cambia in un posto solo.

Ogni logo ha la sua ricetta perche' ogni screenshot e' fatto in modo diverso:
   luminanza  il marchio e' chiaro su fondo scuro: la sagoma e' la luce
   cerchio    il marchio sta dentro a un disco colorato: la sagoma e' tutto
              quello che, dentro al disco, non e' il colore del disco
   cerchio-scuro  come sopra, ma si tiene solo la parte scura del marchio:
              serve quando il marchio e' fatto di lettere nere bordate di
              bianco, che prese insieme diventerebbero una macchia sola

Alla fine ognuno viene ritagliato al vivo e ridimensionato non alla stessa
altezza — un marchio lungo e uno tozzo alla stessa altezza non pesano uguale —
ma alla stessa AREA d'inchiostro, cosi' in fila hanno tutti lo stesso peso.

    python tools/loghi-fascia.py
"""

import os
import numpy as np
from PIL import Image

SORGENTE = 'assets/loghi'
USCITA = 'assets/loghi/fascia'
AREA = 9000.0        # pixel d'inchiostro che ogni logo deve avere, piu' o meno
ALTEZZA_MAX = 150    # nessuno puo' superare questa altezza
LARGHEZZA_MAX = 420  # ne' questa larghezza

# ritaglio: (sinistra, alto, destra, basso) in quota, prima di tutto il resto
# lo/hi: sotto lo e' fondo, sopra hi e' marchio pieno (solo per 'luminanza')
# peso: correzione a occhio, per chi risulta troppo grande o troppo piccolo
RICETTE = {
    'spazioporto':     dict(metodo='luminanza', lo=120, hi=200, peso=1.7),
    'nino':            dict(metodo='luminanza', lo=90, hi=160, peso=1.0),
    'festival':        dict(metodo='luminanza', lo=20, hi=60,  peso=1.3),
    'caffeletterario': dict(metodo='luminanza', lo=25, hi=70,  peso=2.4,
                            ritaglio=(0.375, 0.04, 0.63, 0.96)),
    'kat':             dict(metodo='cerchio', solo_scuro=48, peso=1.0),
    'casaviola':       dict(metodo='cerchio', peso=1.0),
    'villanova':       dict(metodo='cerchio', peso=1.25),
}


def luminanza(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def sagoma_luminanza(a, lo, hi):
    return np.clip((luminanza(a) - lo) / float(hi - lo), 0, 1)


def sagoma_cerchio(a, solo_scuro=None):
    """Il marchio e' quello che, dentro al disco, non ha il colore del disco.

    Il disco non si cerca guardando i bordi dell'immagine — gli sfondi degli
    screenshot sono sfumati e ingannano: si cerca per quello che e', un
    cerchio centrato. Si prende il colore su un anello abbastanza dentro da
    non toccare ne' il marchio al centro ne' il bordo, poi si cammina verso
    l'esterno lungo tante direzioni finche' il colore cambia: dove cambia,
    finisce il disco. E' una misura che non dipende da cosa c'e' fuori.
    """
    h, w, _ = a.shape
    cy, cx = h / 2.0, w / 2.0
    corto = min(h, w)
    yy, xx = np.ogrid[:h, :w]
    dist = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)

    # il colore del disco: un anello dentro al disco ma fuori dal marchio
    anello = (dist > corto * 0.32) & (dist < corto * 0.36)
    disco = np.median(a[anello], axis=0)

    # fin dove arriva: lungo 72 direzioni, l'ultimo raggio ancora del colore
    # del disco. La mediana butta via le direzioni sbagliate (un marchio che
    # tocca il bordo, il bordo stesso sfumato).
    raggi = []
    for k in range(72):
        ang = k * (2 * np.pi / 72)
        sx, sy = np.cos(ang), np.sin(ang)
        ultimo = corto * 0.30
        r = corto * 0.30
        while r < corto * 0.52:
            x, y = int(cx + sx * r), int(cy + sy * r)
            if not (0 <= x < w and 0 <= y < h):
                break
            if np.linalg.norm(a[y, x] - disco) > 60:
                break
            ultimo = r
            r += 1.5
        raggi.append(ultimo)
    raggio = float(np.median(raggi))

    # un filo dentro al raggio trovato: il bordo del disco e' sfumato, e
    # prendendolo si porterebbe dietro un archetto che nel marchio non c'e'
    disco_pieno = dist <= raggio * 0.95
    if solo_scuro:
        # il nero delle lettere, non il bianco che le contorna
        return np.clip((solo_scuro - luminanza(a)) / 25.0, 0, 1) * disco_pieno
    scarto = np.linalg.norm(a - disco, axis=2)
    return np.clip((scarto - 45) / 35.0, 0, 1) * disco_pieno


def ritaglia_al_vivo(alpha, margine=0.06):
    righe = np.where(alpha.max(axis=1) > 0.15)[0]
    colonne = np.where(alpha.max(axis=0) > 0.15)[0]
    if not len(righe) or not len(colonne):
        return alpha
    m = int(max(alpha.shape) * margine * 0.1)
    y0, y1 = max(0, righe[0] - m), min(alpha.shape[0], righe[-1] + 1 + m)
    x0, x1 = max(0, colonne[0] - m), min(alpha.shape[1], colonne[-1] + 1 + m)
    return alpha[y0:y1, x0:x1]


def lavora(nome, ricetta):
    percorso = os.path.join(SORGENTE, nome + '.jpeg')
    im = Image.open(percorso).convert('RGB')

    tagl = ricetta.get('ritaglio')
    if tagl:
        w, h = im.size
        im = im.crop((int(w * tagl[0]), int(h * tagl[1]),
                      int(w * tagl[2]), int(h * tagl[3])))

    a = np.asarray(im).astype(np.float32)
    if ricetta['metodo'] == 'luminanza':
        alpha = sagoma_luminanza(a, ricetta['lo'], ricetta['hi'])
    else:
        alpha = sagoma_cerchio(a, ricetta.get('solo_scuro'))

    alpha = ritaglia_al_vivo(alpha)

    # stessa area d'inchiostro per tutti, non stessa altezza
    area = alpha.sum()
    k = (AREA * ricetta.get('peso', 1.0) / max(area, 1)) ** 0.5
    h, w = alpha.shape
    nh, nw = max(1, round(h * k)), max(1, round(w * k))
    if nh > ALTEZZA_MAX:
        nw, nh = round(nw * ALTEZZA_MAX / nh), ALTEZZA_MAX
    if nw > LARGHEZZA_MAX:
        nh, nw = round(nh * LARGHEZZA_MAX / nw), LARGHEZZA_MAX

    m = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), 'L')
    m = m.resize((nw, nh), Image.LANCZOS)

    # PNG di sola trasparenza: il colore lo mette il CSS con la maschera
    fuori = Image.new('LA', m.size, (0, 0))
    fuori.putalpha(m)
    os.makedirs(USCITA, exist_ok=True)
    dove = os.path.join(USCITA, nome + '.png')
    fuori.save(dove, optimize=True)
    print('%-18s %4dx%-4d  inchiostro %5d px  %3d kB'
          % (nome, nw, nh, int(np.asarray(m).sum() / 255), os.path.getsize(dove) // 1024))


def main():
    for nome, ricetta in RICETTE.items():
        lavora(nome, ricetta)


if __name__ == '__main__':
    main()
