#!/usr/bin/env python3
"""Uniforma il fondo delle foto dei prodotti.

Le foto arrivano da set diversi: chi su un fondo lilla, chi su un grigio,
ognuna con la sua ombra. Nel catalogo, una accanto all'altra, si vede. Qui il
fondo — ombre comprese — viene sostituito con un crema piatto, un filo piu'
scuro della pagina, cosi' ogni scheda e' una piastra pulita e il prodotto e'
l'unica cosa che si vede.

Come riconosce il fondo: non per quanto un pixel e' scuro — le ombre sono
scure e fanno parte del fondo — ma per la sua TINTA. Il fondo e le sue ombre
hanno la stessa tinta; il prodotto no. Nelle zone scure la tinta e' un dato
ballerino (dividere per una luce quasi nulla amplifica il rumore), percio'
li' il margine di tolleranza si allarga. Chi non e' piu' chiaro del fondo
stesso — cosi' i bianchi del prodotto restano bianchi — viene riempito.

    python tools/sfondo-prodotti.py            # prova, scrive in _prova/
    python tools/sfondo-prodotti.py --scrivi   # sostituisce le foto
"""

import sys
import os
import glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CARTELLA = 'assets/prodotti'
ORIGINALI = '_source/prodotti-originali'
COLORE = (0xe8, 0xe0, 0xcf)      # un filo piu' scuro della pagina dello shop

# quanto la tinta puo' discostarsi da quella del fondo prima di essere
# considerata prodotto, e quanto piu' chiaro puo' essere un pixel di fondo
SOGLIA_TINTA = 0.055
SOGLIA_BUIO = 0.20       # nelle ombre la tinta e sporca (la luce rimbalza dal
                         # prodotto): li si perdona molto di piu
MAX_CHIARO = 1.35        # tetto di sicurezza: oltre non e' piu' fondo
MIN_CHIUSO = 0.88        # una sacca chiusa e' fondo solo se ha la luce del fondo:
MAX_CHIUSO = 1.02        # il vuoto fra i manici di una borsa si', un grigio del disegno no
PASSO_SU = 4.0           # quanto puo' schiarirsi il cammino da un pixel al vicino
PASSO_GIU = 4.0          # e quanto puo' incupirsi, pixel per pixel
MIN_SCURO = 0.40         # sotto questa luce non e' piu' ombra, e' il prodotto
SFUMA = 1.1              # raggio in pixel con cui si ammorbidisce il bordo
ISOLE = 10               # raggio in cui si guarda quanto fondo c'e' intorno
ISOLE_QUOTA = 0.45       # oltre questa quota di fondo intorno, la chiazza cede


def luminosita(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def dal_bordo(candidato, lum, su=None, giu=None):
    """I candidati che si raggiungono partendo dal bordo della foto, potendo
    camminare solo fra pixel di luce simile.

    Il limite sul salto serve per i fondi neutri, dove la tinta non basta a
    distinguere il bianco del prodotto dal grigio del fondo: una sfumatura da
    studio cambia di meno di un livello per pixel e si attraversa, il bordo di
    una carta bianca e' un gradino e ferma il cammino.
    """
    su = PASSO_SU if su is None else su
    giu = PASSO_GIU if giu is None else giu
    h, w = candidato.shape
    n = h * w
    cand = candidato.ravel().tolist()
    luce = lum.ravel().tolist()
    visto = bytearray(n)
    coda = []

    for i in range(w):                      # riga in alto e in basso
        for j in (i, n - w + i):
            if cand[j] and not visto[j]:
                visto[j] = 1
                coda.append(j)
    for y in range(h):                      # colonna a sinistra e a destra
        for j in (y * w, y * w + w - 1):
            if cand[j] and not visto[j]:
                visto[j] = 1
                coda.append(j)

    testa = 0
    while testa < len(coda):
        i = coda[testa]
        testa += 1
        li = luce[i]
        x = i % w
        if i >= w:
            j = i - w
            if not visto[j] and cand[j] and -giu <= luce[j] - li <= su:
                visto[j] = 1; coda.append(j)
        j = i + w
        if j < n and not visto[j] and cand[j] and -giu <= luce[j] - li <= su:
            visto[j] = 1; coda.append(j)
        if x:
            j = i - 1
            if not visto[j] and cand[j] and -giu <= luce[j] - li <= su:
                visto[j] = 1; coda.append(j)
        if x < w - 1:
            j = i + 1
            if not visto[j] and cand[j] and -giu <= luce[j] - li <= su:
                visto[j] = 1; coda.append(j)

    return np.frombuffer(bytes(visto), dtype=np.uint8).reshape(h, w) > 0


def uniforma(percorso, colore=COLORE):
    im = Image.open(percorso).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    h, w, _ = a.shape

    # il colore del fondo: la mediana di una cornice sul bordo, dove il
    # prodotto non arriva mai
    b = max(4, min(h, w) // 90)
    cornice = np.concatenate([
        a[:b].reshape(-1, 3), a[-b:].reshape(-1, 3),
        a[:, :b].reshape(-1, 3), a[:, -b:].reshape(-1, 3)])
    fondo = np.median(cornice, axis=0)

    lum_a = np.maximum(luminosita(a), 1.0)
    lum_f = float(max(luminosita(fondo[None, None, :])[0, 0], 1.0))

    # tinta = colore diviso la propria luminosita': toglie di mezzo il fatto
    # che una zona sia in ombra o in luce, resta solo "di che colore e'"
    tinta_a = a / lum_a[..., None]
    tinta_f = fondo / lum_f
    scarto = np.linalg.norm(tinta_a - tinta_f, axis=2)

    # Piu' un pixel e' in ombra, piu' larga la tolleranza sulla tinta: al buio
    # il colore e' rumoroso, e senza questo le ombre piu' cupe resterebbero
    # attaccate al prodotto come aloni.
    buio = np.clip((1.0 - lum_a / lum_f) / 0.55, 0, 1)
    soglia = SOGLIA_TINTA + buio * SOGLIA_BUIO
    chiarezza = lum_a / lum_f

    # candidato: ha la tinta del fondo e non e' piu' chiaro del fondo stesso.
    # Il secondo test e' quello che salva i bianchi del prodotto — le carte da
    # gioco, i bordi degli adesivi — che di tinta sono neutri come il fondo.
    candidato = (scarto < soglia) & (chiarezza <= MAX_CHIARO) & (chiarezza >= MIN_SCURO)

    # Il fondo vero e' quello che si tocca partendo dal bordo della foto,
    # camminando a piccoli passi di luce. Una zona chiara chiusa dentro al
    # prodotto non e' fondo, anche se gli somiglia; una sacca scura chiusa —
    # il vuoto fra i manici di una borsa — invece si'.
    fuori = dal_bordo(candidato, lum_a)
    dentro = candidato & ~fuori & (chiarezza >= MIN_CHIUSO) & (chiarezza <= MAX_CHIUSO)
    maschera = fuori | dentro

    # Il cammino si ferma davanti alle ombre ripide — sotto una scatola la
    # luce crolla di colpo, come su un bordo — e lascia indietro delle chiazze
    # attaccate al prodotto. Si riprendono qui: hanno la tinta del fondo, sono
    # piu' scure di lui, e stanno in una zona dove intorno c'e' soprattutto
    # fondo. Dentro al prodotto, lontano dal bordo, questa regola non arriva.
    vicinato = Image.fromarray((maschera * 255).astype(np.uint8), 'L')
    vicinato = np.asarray(vicinato.filter(ImageFilter.BoxBlur(ISOLE))) / 255.0
    maschera = maschera | (candidato & (chiarezza < 0.98) & (vicinato > ISOLE_QUOTA))

    # bordo ammorbidito: un taglio netto sui pixel lascia una scaletta
    m = Image.fromarray((maschera * 255).astype(np.uint8), 'L')
    m = m.filter(ImageFilter.GaussianBlur(SFUMA))
    peso = np.asarray(m).astype(np.float32) / 255.0

    # tinta unita: niente ombre, niente vignettatura, niente sfumature
    nuovo = np.empty_like(a)
    nuovo[:] = np.array(colore, dtype=np.float32)

    out = a * (1 - peso[..., None]) + nuovo * peso[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), fondo, peso.mean()


def main():
    scrivi = '--scrivi' in sys.argv
    dest = CARTELLA if scrivi else '_prova'
    if not scrivi:
        os.makedirs(dest, exist_ok=True)
    elif not os.path.isdir(ORIGINALI):
        os.makedirs(ORIGINALI, exist_ok=True)

    for f in sorted(glob.glob(os.path.join(CARTELLA, '*.webp'))):
        nome = os.path.basename(f)
        copia = os.path.join(ORIGINALI, nome)
        if scrivi and not os.path.exists(copia):
            Image.open(f).save(copia, 'WEBP', quality=92, method=6)
        # l'originale e' la sorgente buona: rilavorare una foto gia' lavorata
        # accumulerebbe gli errori di ogni passaggio
        im, fondo, quota = uniforma(copia if os.path.exists(copia) else f)
        im.save(os.path.join(dest, nome), 'WEBP', quality=86, method=6)
        print('%-28s fondo #%02x%02x%02x  ricolorato %4.1f%%'
              % (nome, int(fondo[0]), int(fondo[1]), int(fondo[2]), quota * 100))


if __name__ == '__main__':
    main()
