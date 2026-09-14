/* ==========================================================================
   Taranto Futura — pannelli (Creative Studio / Events / Shop)
   Si aprono sopra la pagina ma hanno un indirizzo proprio: si possono
   condividere, il tasto "indietro" li chiude e senza JavaScript restano
   normali sezioni leggibili scorrendo.
   ========================================================================== */

const SELETTORE_FUOCO = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export class Pannelli {
  constructor() {
    this.voci = Array.from(document.querySelectorAll('[data-pannello]'));
    this.aperto = null;      // id del pannello aperto
    this.tornaA = null;      // elemento a cui restituire il fuoco
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.uscita = null;      // pannello che si sta ancora richiudendo
    this.arrivo = null;      // ascoltatore di fine ritiro
    this.attesa = 0;         // tempo di sicurezza del ritiro

    this.ids = new Set(this.voci.map((v) => v.dataset.pannello));
  }

  pannello(id) {
    const el = document.getElementById(id);
    return el && el.classList.contains('pannello') ? el : null;
  }

  monta() {
    if (!this.voci.length) return;

    for (const voce of this.voci) {
      voce.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // apri in nuova scheda
        e.preventDefault();
        this.apri(voce.dataset.pannello, voce, true);
      });
    }

    for (const btn of document.querySelectorAll('.pannello__chiudi')) {
      btn.addEventListener('click', () => this.chiudi(true));
    }

    document.addEventListener('keydown', (e) => {
      if (!this.aperto) return;
      if (e.key === 'Escape') { e.preventDefault(); this.chiudi(true); }
      else if (e.key === 'Tab') this.trattieniFuoco(e);
    });

    // il tasto "indietro" chiude, l'avanti riapre
    window.addEventListener('popstate', () => this.daIndirizzo(false));

    // arrivo diretto da un link condiviso
    this.daIndirizzo(true);
  }

  daIndirizzo(subito) {
    const id = location.hash.slice(1);
    if (this.ids.has(id)) {
      if (this.aperto !== id) this.apri(id, null, false, subito);
    } else if (this.aperto) {
      this.chiudi(false);
    }
  }

  /* ------------------------------------------------------------- apertura */
  apri(id, origine, spingi, subito) {
    const el = this.pannello(id);
    if (!el || this.aperto === id) return;
    if (this.aperto) this.chiudi(false);

    this.tornaA = origine || document.activeElement;
    this.aperto = id;

    /* Se e' proprio questo che si stava richiudendo, la ritirata si taglia
       qui: chi ci ripensa a meta' strada non deve aspettare la fine. Un
       pannello diverso invece continua a uscire per conto suo, sotto. */
    if (this.uscita === el) this.fineRitiro();

    this.bloccaScorrimento(true);
    el.removeAttribute('aria-hidden');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    this.ritaglioDa(el, origine, subito);
    el.classList.add('is-aperto');

    // due fotogrammi: il primo applica il ritaglio iniziale, il secondo lo apre
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-dentro')));
    // se i fotogrammi non arrivano (scheda in secondo piano) apre comunque
    setTimeout(() => el.classList.add('is-dentro'), 120);

    const primo = el.querySelector('.pannello__chiudi') || el;
    primo.focus({ preventScroll: true });

    if (spingi) {
      history.pushState({ pannello: id }, '', '#' + id);
    }
    document.documentElement.dispatchEvent(
      new CustomEvent('pannello:apri', { detail: id }));
  }

  /* Imposta il ritaglio iniziale sui bordi della voce toccata, cosi' il
     pannello sembra crescere da li'. Senza origine parte da tutto schermo. */
  ritaglioDa(el, origine, subito) {
    const s = el.style;
    if (!origine || subito || this.reduced) {
      s.removeProperty('--ct'); s.removeProperty('--cr');
      s.removeProperty('--cb'); s.removeProperty('--cl');
      return;
    }
    const r = origine.getBoundingClientRect();
    const w = window.innerWidth, h = window.innerHeight;
    // Se la voce e' fuori schermo (aperta da tastiera o da codice) i valori
    // sfonderebbero il 100% e il ritaglio partirebbe dal nulla: li limitiamo.
    const q = (v) => Math.max(0, Math.min(96, v)).toFixed(2) + '%';
    s.setProperty('--ct', q(r.top / h * 100));
    s.setProperty('--cr', q((w - r.right) / w * 100));
    s.setProperty('--cb', q((h - r.bottom) / h * 100));
    s.setProperty('--cl', q(r.left / w * 100));
  }

  /* ------------------------------------------------------------- chiusura */
  chiudi(indietro) {
    const id = this.aperto;
    if (!id) return;
    const el = this.pannello(id);
    this.aperto = null;

    this.bloccaScorrimento(false);

    if (indietro && location.hash.slice(1) === id) {
      // toglie l'ancora dall'indirizzo senza ricaricare ne' saltare in cima
      history.pushState({}, '', location.pathname + location.search);
    }

    /* Il fuoco esce prima che il pannello diventi aria-hidden: nasconderlo
       a un lettore di schermo mentre contiene il punto attivo e' un errore. */
    if (this.tornaA && document.contains(this.tornaA)) {
      this.tornaA.focus({ preventScroll: true });
    }
    this.tornaA = null;

    if (el) this.ritiro(el);
    document.documentElement.dispatchEvent(new CustomEvent('pannello:chiudi'));
  }

  /* Il pannello non sparisce di colpo: torna dentro la colonna da cui era
     nato. Il ritaglio di partenza e' ancora sull'elemento, quindi basta
     togliere is-dentro e aspettare che la transizione arrivi in fondo.
     Nel frattempo non intercetta piu' il puntatore e sta sotto a un
     eventuale pannello che si stia aprendo al suo posto. */
  ritiro(el) {
    el.removeAttribute('role');
    el.removeAttribute('aria-modal');
    el.setAttribute('aria-hidden', 'true');
    el.classList.remove('is-dentro');

    // senza ritaglio da cui ripartire non c'e' niente da guardare
    const fermo = this.reduced || !el.style.getPropertyValue('--ct');
    if (fermo) { this.spegni(el); return; }

    el.classList.add('is-uscita');
    this.uscita = el;

    const arrivo = (e) => {
      if (e.target !== el || e.propertyName !== 'clip-path') return;
      this.fineRitiro();
    };
    el.addEventListener('transitionend', arrivo);
    this.arrivo = arrivo;

    /* Se la transizione non arriva mai (scheda in secondo piano, pannello
       gia' a schermo pieno) il pannello resterebbe li' sopra a tutto. */
    this.attesa = setTimeout(() => this.fineRitiro(), 700);
  }

  fineRitiro() {
    const el = this.uscita;
    if (this.attesa) { clearTimeout(this.attesa); this.attesa = 0; }
    if (!el) return;
    if (this.arrivo) { el.removeEventListener('transitionend', this.arrivo); this.arrivo = null; }
    this.uscita = null;
    el.classList.remove('is-uscita');
    this.spegni(el);
  }

  spegni(el) {
    el.classList.remove('is-aperto', 'is-dentro', 'is-uscita');
  }

  /* --------------------------------------------------------------- fuoco */
  trattieniFuoco(e) {
    const el = this.pannello(this.aperto);
    if (!el) return;
    const f = Array.from(el.querySelectorAll(SELETTORE_FUOCO))
      .filter((x) => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) { e.preventDefault(); el.focus(); return; }
    const primo = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primo) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primo.focus();
    }
  }

  /* --------------------------------------------------------- scorrimento */
  bloccaScorrimento(blocca) {
    const h = document.documentElement;
    if (blocca) {
      // compensa la barra di scorrimento, altrimenti la pagina salta di lato
      const barra = window.innerWidth - h.clientWidth;
      if (barra > 0) h.style.setProperty('padding-right', barra + 'px');
      h.classList.add('is-pannello-aperto');
    } else {
      h.classList.remove('is-pannello-aperto');
      h.style.removeProperty('padding-right');
    }
  }
}

export function mountPannelli() {
  const p = new Pannelli();
  p.monta();
  return p;
}
