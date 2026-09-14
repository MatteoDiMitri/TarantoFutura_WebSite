/* ==========================================================================
   Taranto Futura — le quattro colonne
   Il colore, il titolo e l'invito li mette il CSS: qui c'e' solo la mano.
   Sotto il puntatore la colonna si accende nel punto che stai toccando e il
   titolo si sposta di poco verso di te, su un piano diverso dal motivo che
   gli sta dietro. Serve a far sentire che e' una superficie e non un
   rettangolo colorato: e' il motivo per cui una colonna piena di tinta
   piatta sembrava, ferma, meno di quello che e'.

   Stesse convenzioni delle schede del negozio: is-mossa mentre la tocchi,
   --lx/--ly per la luce, --mx/--my per lo spostamento. Al rilascio le
   variabili si tolgono e il CSS riporta tutto a posto con la sua molla.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');

/* Di quanto si sposta il titolo, in pixel, agli estremi della colonna.
   Poco: e' un accenno, non un trascinamento. */
const TIRO = 13;

export class Trio {
  constructor(sezione) {
    this.sezione = sezione;
    this.voci = sezione ? Array.from(sezione.querySelectorAll('.trio__voce')) : [];
  }

  get ridotto() { return RIDOTTO.matches; }

  monta() {
    if (!this.voci.length) return;
    this.calamita();
  }

  calamita() {
    if (this.ridotto) return;

    for (const voce of this.voci) {
      const muovi = (e) => {
        /* Col dito non c'e' un "sopra": il tocco accenderebbe la colonna
           nell'istante prima di aprirla, che e' rumore. */
        if (e.pointerType === 'touch') return;

        const r = voce.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;

        voce.classList.add('is-mossa');
        voce.style.setProperty('--lx', ((px + 0.5) * 100).toFixed(1) + '%');
        voce.style.setProperty('--ly', ((py + 0.5) * 100).toFixed(1) + '%');
        voce.style.setProperty('--mx', (px * TIRO).toFixed(1) + 'px');
        /* in verticale meno: la colonna e' alta e stretta, e un titolo che
           insegue il puntatore per tutta l'altezza sembra scollato */
        voce.style.setProperty('--my', (py * TIRO * 0.45).toFixed(1) + 'px');
      };

      const molla = () => {
        voce.classList.remove('is-mossa');
        for (const v of ['--mx', '--my']) voce.style.removeProperty(v);
        /* --lx e --ly restano dove sono: la luce si spegne in dissolvenza,
           e riportarla al centro mentre svanisce la farebbe scivolare via. */
      };

      voce.addEventListener('pointermove', muovi);
      voce.addEventListener('pointerleave', molla);
      voce.addEventListener('pointercancel', molla);
      voce.addEventListener('pointerup', molla);
    }
  }
}

export function mountTrio(sezione) {
  const t = new Trio(sezione);
  t.monta();
  return t;
}
