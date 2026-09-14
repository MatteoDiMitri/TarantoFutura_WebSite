/* ==========================================================================
   Taranto Futura — comparse
   Le parti della pagina non ci sono gia' tutte: entrano quando le raggiungi.
   Dentro i pannelli questo succedeva gia' (locandine, numeri, prodotti); qui
   lo stesso gesto viene portato sul percorso principale, che fin qui restava
   fermo dall'apertura in poi.

   Chi entra lo dice l'HTML con data-entra, non un elenco di selettori qui
   dentro: cosi' il CSS puo' nascondere le voci fin dal primo fotogramma
   (regola sotto html.js) e non si vede il lampo di una voce gia' disegnata
   che sparisce quando il modulo si sveglia. Il valore di data-entra sceglie
   il modo: vuoto = sale, "colonna" = si srotola dall'alto.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');

/* Ritardo fra una voce e la successiva dello stesso gruppo. Oltre i ~120ms
   l'onda si sfilaccia e la pagina sembra lenta invece che viva. */
const PASSO = 85;
/* Dalla settima in poi il ritardo non cresce piu': in un gruppo lungo
   l'ultima voce arriverebbe con mezzo secondo di ritardo sul resto. */
const PASSO_MAX = 6;

/* Due soglie, perche' le due entrate hanno bisogni opposti.
   Il testo deve comparire davanti agli occhi: parte quando si affaccia.
   Le colonne aspettano di piu'. Sono alte una schermata e si srotolano
   dall'alto: se partissero mentre sono ancora sotto la piega - come facevano
   in un primo momento, per non far trovare a chi scorre veloce una schermata
   di solo fondo - finirebbero fuori campo, e chi arriva le troverebbe gia'
   aperte senza aver visto niente. Meglio farle partire quando sono gia' in
   vista per un buon terzo: l'onda avviene sotto gli occhi, ed e' il punto. */
const SOGLIE = {
  testo:   '0px 0px -10% 0px',
  colonna: '0px 0px -35% 0px'
};

export class Comparse {
  constructor(radice) {
    this.radice = radice || document;

    /* Un gruppo per sezione: le voci della stessa sezione entrano in onda,
       quelle di sezioni diverse aspettano il proprio turno di scorrimento. */
    this.gruppi = new Map();
    for (const el of this.radice.querySelectorAll('[data-entra]')) {
      const sez = el.closest('section') || el.parentElement;
      if (!sez) continue;
      if (!this.gruppi.has(sez)) this.gruppi.set(sez, []);
      this.gruppi.get(sez).push(el);
    }

    /* Quello che fa scattare l'onda e' il contenitore della prima voce, non
       la sezione e non la voce stessa.
       Non la sezione: About e' alta due schermate, e guardarne il bordo
       superiore vorrebbe dire accendere il testo molto prima di arrivarci;
       il contenitore invece sta stretto attorno a quello che deve entrare.
       Non la voce: una colonna parte ritagliata a niente, e un elemento di
       area nulla non interseca mai nulla. Osservarla vorrebbe dire aspettare
       per sempre che si accenda da sola. */
    this.sentinelle = new Map();   // contenitore -> { sez, io }
    this.osservatori = new Map();  // soglia -> osservatore
  }

  get ridotto() { return RIDOTTO.matches; }

  monta() {
    if (!this.gruppi.size) return;

    /* Senza osservatore, o per chi ha chiesto meno movimento, le voci ci sono
       e basta: nascondere qualcosa che poi non si puo' rivelare sarebbe il
       peggiore dei difetti, e vale piu' della resa. */
    if (this.ridotto || !('IntersectionObserver' in window)) { this.tutte(); return; }

    for (const [sez, voci] of this.gruppi) {
      const modo = voci[0].dataset.entra === 'colonna' ? 'colonna' : 'testo';
      const io = this.osservatore(SOGLIE[modo]);
      const sentinella = voci[0].parentElement || sez;
      this.sentinelle.set(sentinella, { sez, io });
      io.observe(sentinella);
    }

    /* Chi riprende la pagina a meta' (ricarica, link diretto, ritorno dalla
       cache) ha gia' sotto gli occhi, o gia' alle spalle, qualche sezione. */
    requestAnimationFrame(() => this.giaViste());

    /* Ma la posizione vera il browser la rimette a modo suo, e lo fa dopo di
       noi: al primo fotogramma, e anche a pagina caricata, lo scorrimento e'
       ancora a zero, e la sezione che in realta' e' gia' alle spalle
       resterebbe indietro per sempre - da sopra la piega non intersechera'
       mai piu' niente. Il ripristino pero' uno scorrimento lo produce, ed e'
       quello il momento in cui la posizione e' finalmente quella buona.
       Se invece il primo scorrimento e' quello di chi legge, non cambia
       niente: a quel punto sopra la piega non c'e' ancora nulla da rivelare.
       Ripetere il controllo non fa danno: l'onda passa una volta per gruppo. */
    window.addEventListener('scroll', () => this.giaViste(), { once: true, passive: true });
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => this.giaViste(), { once: true });
    }
  }

  osservatore(margine) {
    let io = this.osservatori.get(margine);
    if (io) return io;
    io = new IntersectionObserver((righe) => {
      for (const r of righe) {
        if (!r.isIntersecting) continue;
        const s = this.sentinelle.get(r.target);
        io.unobserve(r.target);
        if (s) this.onda(s.sez);
      }
    }, { rootMargin: margine, threshold: 0 });
    this.osservatori.set(margine, io);
    return io;
  }

  /* Rivela tutto senza onda: e' il ripiego, non l'effetto. */
  tutte() {
    for (const voci of this.gruppi.values()) {
      for (const el of voci) el.classList.add('is-dentro');
    }
    this.gruppi.clear();
  }

  /* Quello che e' gia' passato non aspetta: chi ricarica a meta' pagina si
     troverebbe davanti al vuoto, e risalendo vedrebbe entrare cose che per
     lui c'erano gia'.
     Il confine e' la meta' dello schermo, non il bordo basso. Col bordo
     basso bastava un primo scatto deciso verso il basso - e questo controllo
     gira anche al primo scorrimento - perche' una sezione appena affacciata
     venisse dichiarata "gia' vista" e comparisse senza la sua onda. Sopra la
     meta' sei arrivato davvero; sotto, stai ancora scendendo. */
  giaViste() {
    const h = window.innerHeight || document.documentElement.clientHeight;
    for (const [voce, s] of Array.from(this.sentinelle)) {
      if (voce.getBoundingClientRect().top >= h * 0.5) continue;
      s.io.unobserve(voce);
      this.onda(s.sez);
    }
  }

  onda(sez) {
    const voci = this.gruppi.get(sez);
    if (!voci) return;          // gruppo gia' entrato
    this.gruppi.delete(sez);
    voci.forEach((el, i) => {
      /* Il ritardo passa da una variabile e non da transitionDelay: cosi'
         vale solo per questa transizione e non zavorra quelle che l'elemento
         si porta gia' dietro (il titolo delle colonne ne ha una sua). */
      el.style.setProperty('--entra-passo', Math.min(i, PASSO_MAX) * PASSO + 'ms');
      el.classList.add('is-dentro');
    });
  }
}

export function mountComparse(radice) {
  const c = new Comparse(radice);
  c.monta();
  return c;
}
