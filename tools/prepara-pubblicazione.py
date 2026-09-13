#!/usr/bin/env python3
"""Rifa' il pacchetto da caricare online.

Il sito che si pubblica non e' la cartella di lavoro: dentro ci sono le foto
originali da decine di MB, gli script, le prove. Questo comando ricostruisce
_pubblica/ con dentro solo quello che va online, controlla che ogni percorso
citato esista davvero (con le maiuscole giuste, come le vede un server) e
rifa' lo zip da trascinare su Netlify.

Da rilanciare dopo ogni modifica: e' l'unico modo perche' quello che si vede
online sia davvero quello che c'e' qui.

    python tools/prepara-pubblicazione.py
"""

import os
import sys
import shutil
import zipfile

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(RADICE, '_pubblica')
ZIP = os.path.join(RADICE, 'taranto-futura-sito.zip')

# quello che resta a casa: sorgenti pesanti, attrezzi, cartelle di servizio
ESCLUSE = {'_source', '_pubblica', '_prova', '.claude', '.git', 'tools',
           '__pycache__', 'node_modules'}
ESTENSIONI_ESCLUSE = ('.py', '.pyc', '.psd', '.ai', '.zip')


def copia():
    # OneDrive ogni tanto tiene occupata una cartella mentre sincronizza:
    # non e' un motivo per fermarsi, i file vengono comunque riscritti sopra
    if os.path.isdir(DEST):
        shutil.rmtree(DEST, ignore_errors=True)
    quanti = peso = 0
    for cartella, sotto, file in os.walk(RADICE):
        sotto[:] = [c for c in sotto if c not in ESCLUSE and not c.startswith('.')]
        rel = os.path.relpath(cartella, RADICE)
        if rel != '.' and rel.split(os.sep)[0] in ESCLUSE:
            continue
        for f in file:
            if f.endswith(ESTENSIONI_ESCLUSE) or f.startswith('_prova'):
                continue
            src = os.path.join(cartella, f)
            dst = os.path.join(DEST, os.path.relpath(src, RADICE))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            quanti += 1
            peso += os.path.getsize(src)
    return quanti, peso


def impacchetta():
    if os.path.exists(ZIP):
        os.remove(ZIP)
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for cartella, _, file in os.walk(DEST):
            for f in file:
                p = os.path.join(cartella, f)
                # sempre con la barra in avanti: e' quello che si aspetta
                # chi scompatta dall'altra parte
                z.write(p, os.path.relpath(p, DEST).replace(os.sep, '/'))
    return os.path.getsize(ZIP)


def main():
    quanti, peso = copia()
    print('copiati %d file, %.1f MB' % (quanti, peso / 1e6))

    # il modulo di controllo ha il trattino nel nome: si carica a mano
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        'controlla', os.path.join(RADICE, 'tools', 'controlla-percorsi.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    guai = mod.controlla(DEST)

    dim = impacchetta()
    print('zip pronto: %s (%.1f MB)' % (os.path.basename(ZIP), dim / 1e6))
    if guai:
        print('\nATTENZIONE: sopra ci sono percorsi che online darebbero 404.')
        return 1
    print('\nTrascina lo zip su app.netlify.com, sezione Deploys del sito.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
