/* ==========================================================================
   Taranto Futura — locandine degli eventi
   Griglia con comparsa e inclinazione in 3D. Aprendo una locandina si sfoglia
   il book fotografico di QUELL'evento: le frecce restano dentro l'evento.

   Le foto si dichiarano in assets/eventi/book.json e stanno in
   assets/eventi/<slug>/.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
const BASE = 'assets/eventi/';

export class Locandine {
  constructor(griglia, visore) {
    this.griglia = griglia;
    this.visore = visore;
    this.voci = Array.from(griglia.querySelectorAll('.locandina'));
    this.video = Array.from(griglia.querySelectorAll('.locandina__video'));
    this.book = null;
  }

  get ridotto() { return RIDOTTO.matches; }

  monta() {
    if (!this.voci.length) return;
    this.comparsa();
    this.inclinazione();
    for (const voce of this.voci) {
      voce.addEventListener('click', () => this.apri(voce));
    }
    this.riproduzione();
  }

  /* --------------------------------------------- comparsa a scorrimento */
  comparsa() {
    if (this.ridotto || !('IntersectionObserver' in window)) {
      this.voci.forEach((v) => v.classList.add('is-dentro'));
      return;
    }
    const io = new IntersectionObserver((righe) => {
      for (const r of righe) {
        if (!r.isIntersecting) continue;
        const i = this.voci.indexOf(r.target);
        r.target.querySelector('.locandina__scena').style.transitionDelay =
          Math.min(i, 5) * 70 + 'ms';
        r.target.classList.add('is-dentro');
        io.unobserve(r.target);
      }
    }, { threshold: 0.25 });
    this.voci.forEach((v) => io.observe(v));

    // Rete di sicurezza: se l'osservatore non scatta le locandine resterebbero
    // invisibili. Qui si forzano senza passare dalla transizione, che a sua
    // volta potrebbe non avanzare.
    setTimeout(() => {
      for (const v of this.voci) {
        if (v.classList.contains('is-dentro')) continue;
        const sc = v.querySelector('.locandina__scena');
        if (sc) { sc.style.transition = 'none'; sc.style.opacity = '1'; sc.style.transform = 'none'; }
        v.classList.add('is-dentro');
      }
    }, 4000);
  }

  /* ------------------------------------------ inclinazione col puntatore */
  inclinazione() {
    if (this.ridotto) return;
    for (const voce of this.voci) {
      const scena = voce.querySelector('.locandina__scena');
      const lucido = voce.querySelector('.locandina__lucido');

      const muovi = (e) => {
        const r = voce.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        voce.classList.add('is-mossa');
        scena.style.setProperty('--ry', (px * 16).toFixed(2) + 'deg');
        scena.style.setProperty('--rx', (-py * 18).toFixed(2) + 'deg');
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

  /* --------------------------------------------------------- apertura */
  async caricaBook() {
    if (this.book) return this.book;
    try {
      const r = await fetch(BASE + 'book.json', { cache: 'no-cache' });
      this.book = r.ok ? await r.json() : {};
    } catch (e) { this.book = {}; }
    return this.book;
  }

  async apri(voce) {
    if (!this.visore) return;
    await this.caricaBook();
    const slug = voce.dataset.slug;
    const dati = this.book[slug] || {};
    const quando = dati.quando || voce.dataset.quando || '';

    // Solo le foto: la locandina l'hai appena toccata per entrare, rivederla
    // come prima pagina sarebbe una ripetizione.
    const pagine = (dati.foto || []).map((f, i) => ({
      tipo: 'foto',
      src: BASE + slug + '/' + f,
      alt: 'Foto della serata del ' + quando + ', ' + (i + 1)
    }));
    if (!pagine.length) return;
    this.fermaTutti();
    this.visore.apri(pagine, quando, voce);
  }

  /* -------------------------------------- riproduzione solo se in vista */
  riproduzione() {
    if (this.ridotto || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((righe) => {
      for (const r of righe) {
        if (r.isIntersecting) {
          const p = r.target.play();
          if (p && p.catch) p.catch(() => {});
        } else if (!r.target.paused) r.target.pause();
      }
    }, { threshold: 0.4 });
    for (const v of this.video) io.observe(v);

    document.documentElement.addEventListener('pannello:chiudi', () => this.fermaTutti());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.fermaTutti(); });
  }

  fermaTutti() {
    for (const v of this.video) if (!v.paused) v.pause();
  }
}

export function mountLocandine(griglia, visore) {
  const l = new Locandine(griglia, visore);
  l.monta();
  return l;
}
