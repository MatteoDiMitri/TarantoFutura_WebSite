/* ==========================================================================
   Taranto Futura — NZACC, la fanzine
   Le copertine dei numeri; toccandone una si sfoglia il numero intero nel
   visore. L'elenco delle pagine sta in assets/fanzine/numeri.json, generato
   dalla cartella: aggiungere un numero significa creare assets/fanzine/NN/
   con le pagine numerate e rigenerare il manifesto.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
const MANIFESTO = 'assets/fanzine/numeri.json';

export class Fanzine {
  constructor(griglia, visore) {
    this.griglia = griglia;
    this.visore = visore;
    this.voci = Array.from(griglia.querySelectorAll('.numero'));
    this.numeri = null;
  }

  get ridotto() { return RIDOTTO.matches; }

  monta() {
    if (!this.voci.length) return;
    this.comparsa();
    this.inclinazione();
    for (const voce of this.voci) {
      voce.addEventListener('click', () => this.apri(voce));
    }
  }

  comparsa() {
    if (this.ridotto || !('IntersectionObserver' in window)) {
      this.voci.forEach((v) => v.classList.add('is-dentro'));
      return;
    }
    const io = new IntersectionObserver((righe) => {
      for (const r of righe) {
        if (!r.isIntersecting) continue;
        r.target.querySelector('.numero__scena').style.transitionDelay =
          this.voci.indexOf(r.target) * 90 + 'ms';
        r.target.classList.add('is-dentro');
        io.unobserve(r.target);
      }
    }, { threshold: 0.25 });
    this.voci.forEach((v) => io.observe(v));

    setTimeout(() => {
      for (const v of this.voci) {
        if (v.classList.contains('is-dentro')) continue;
        const sc = v.querySelector('.numero__scena');
        if (sc) { sc.style.transition = 'none'; sc.style.opacity = '1'; sc.style.transform = 'none'; }
        v.classList.add('is-dentro');
      }
    }, 4000);
  }

  inclinazione() {
    if (this.ridotto) return;
    for (const voce of this.voci) {
      const scena = voce.querySelector('.numero__scena');
      const lucido = voce.querySelector('.numero__lucido');
      const muovi = (e) => {
        const r = scena.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        voce.classList.add('is-mossa');
        scena.style.setProperty('--ry', (px * 14).toFixed(2) + 'deg');
        scena.style.setProperty('--rx', (-py * 16).toFixed(2) + 'deg');
        if (lucido) {
          lucido.style.setProperty('--lucido-ang',
            (90 + Math.atan2(py, px) * 180 / Math.PI).toFixed(0) + 'deg');
        }
      };
      const molla = () => {
        voce.classList.remove('is-mossa');
        scena.style.removeProperty('--rx');
        scena.style.removeProperty('--ry');
      };
      voce.addEventListener('pointermove', muovi);
      voce.addEventListener('pointerleave', molla);
      voce.addEventListener('pointercancel', molla);
      voce.addEventListener('pointerup', molla);
    }
  }

  async caricaManifesto() {
    if (this.numeri) return this.numeri;
    try {
      const r = await fetch(MANIFESTO, { cache: 'no-cache' });
      this.numeri = r.ok ? await r.json() : [];
    } catch (e) { this.numeri = []; }
    return this.numeri;
  }

  async apri(voce) {
    if (!this.visore) return;
    await this.caricaManifesto();
    const n = this.numeri.find((x) => x.numero === voce.dataset.numero);
    if (!n) return;

    // Via la copertina: e' l'immagine che hai appena toccato per entrare.
    // Si apre dall'interno, come quando apri davvero una rivista.
    const pagine = n.pagine.slice(1).map((f, i) => ({
      tipo: 'foto',
      src: n.cartella + f,
      alt: n.titolo + ', pagina ' + (i + 2)
    }));
    if (!pagine.length) return;
    this.visore.apri(pagine, n.titolo, voce, { doppia: true });
  }
}

export function mountFanzine(griglia, visore) {
  const f = new Fanzine(griglia, visore);
  f.monta();
  return f;
}
