/* ==========================================================================
   Taranto Futura — il cursore
   Un anello che insegue il puntatore con un filo di ritardo e si allarga su
   cio' che si puo' toccare. Non sostituisce la freccia del sistema: le sta
   intorno. Nascondere la freccia vera farebbe scena per due secondi e poi
   darebbe fastidio per tutto il resto della visita.

   Il colore non c'e': l'anello e' bianco in "difference", cosi' si legge
   uguale sul grigio dell'apertura, sul blu di About us, sul crema della
   fascia, sul rosso della fanzine e sul panna dello shop, senza doverlo
   ricalibrare sezione per sezione.

   Nasce al primo movimento di un mouse vero: chi arriva col dito non se lo
   ritrova nemmeno nel documento.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');

/* Quanto del divario l'anello recupera a ogni fotogramma. Sotto 0.1 sembra
   in ritardo, sopra 0.3 sembra incollato e tanto valeva non farlo. */
const RINCORSA = 0.19;

/* Sotto questa distanza (px) l'inseguimento e' finito: il ciclo si ferma
   invece di girare a vuoto finche' la pagina e' aperta. */
const FERMO = 0.4;

const TOCCABILE = [
  'a[href]', 'button:not([disabled])', '[data-pannello]', '[role="button"]',
  'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])',
  'summary', '[data-sorpresa]'
].join(',');

export class Cursore {
  constructor() {
    this.el = null;
    this.x = 0;  this.y = 0;    // dove sta l'anello adesso
    this.mx = 0; this.my = 0;   // dove sta il puntatore
    this.giro = 0;
    this.acceso = false;
  }

  get ridotto() { return RIDOTTO.matches; }

  monta() {
    /* Chi ha chiesto meno movimento non vuole una cosa che insegue il mouse:
       qui non si monta niente del tutto. */
    if (this.ridotto) return;

    /* Il primo movimento di mouse decide se questo modulo serve. Su un
       portatile con touch screen la domanda non si puo' fare al caricamento:
       si aspetta di vedere che cosa usa davvero chi e' arrivato. */
    this.primo = (e) => {
      if (e.pointerType !== 'mouse') return;
      window.removeEventListener('pointermove', this.primo);
      this.nasci(e);
    };
    window.addEventListener('pointermove', this.primo, { passive: true });
  }

  nasci(e) {
    const el = document.createElement('div');
    el.className = 'cursore';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="cursore__anello"></span><span class="cursore__punto"></span>';
    document.body.appendChild(el);
    this.el = el;

    this.x = this.mx = e.clientX;
    this.y = this.my = e.clientY;
    this.posa();

    window.addEventListener('pointermove', (ev) => this.segui(ev), { passive: true });
    window.addEventListener('pointerdown', () => el.classList.add('is-premuto'), { passive: true });
    window.addEventListener('pointerup',   () => el.classList.remove('is-premuto'), { passive: true });

    /* Fuori dalla finestra l'anello resterebbe appeso all'ultimo bordo
       toccato: sparisce, e torna quando il mouse rientra. */
    const radice = document.documentElement;
    radice.addEventListener('pointerleave', () => el.classList.remove('is-acceso'));
    radice.addEventListener('pointerenter', () => el.classList.add('is-acceso'));

    /* Un solo ascoltatore per tutta la pagina invece di uno per bersaglio:
       il catalogo del negozio e le schede dello studio nascono dopo, e cosi'
       funzionano senza doverli riagganciare. */
    document.addEventListener('pointerover', (ev) => {
      const t = ev.target;
      const sopra = t && t.closest && t.closest(TOCCABILE);
      el.classList.toggle('is-sopra', !!sopra);
    }, { passive: true });

    /* L'anello puo' nascere gia' sopra qualcosa di toccabile: l'ascoltatore
       qui sopra arriva un istante dopo il movimento che l'ha creato, e senza
       questo controllo resterebbe piccolo finche' il mouse non si sposta. */
    const sotto = document.elementFromPoint(e.clientX, e.clientY);
    if (sotto && sotto.closest(TOCCABILE)) el.classList.add('is-sopra');

    requestAnimationFrame(() => el.classList.add('is-acceso'));
  }

  segui(e) {
    if (e.pointerType === 'touch') return;
    this.mx = e.clientX;
    this.my = e.clientY;
    if (!this.giro) this.giro = requestAnimationFrame(() => this.passo());
  }

  passo() {
    this.giro = 0;
    this.x += (this.mx - this.x) * RINCORSA;
    this.y += (this.my - this.y) * RINCORSA;
    this.posa();

    /* Finche' non ha raggiunto il puntatore si continua; quando lo raggiunge
       il ciclo muore e riparte al prossimo movimento. */
    if (Math.abs(this.mx - this.x) > FERMO || Math.abs(this.my - this.y) > FERMO) {
      this.giro = requestAnimationFrame(() => this.passo());
    }
  }

  posa() {
    this.el.style.transform =
      'translate3d(' + this.x.toFixed(1) + 'px,' + this.y.toFixed(1) + 'px,0)';
  }
}

export function mountCursore() {
  const c = new Cursore();
  c.monta();
  return c;
}
