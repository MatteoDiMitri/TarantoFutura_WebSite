/* ==========================================================================
   Taranto Futura — la fascia dei partner
   Il nastro deve girare all'infinito senza che si veda dove ricomincia. Il
   trucco: si ripete l'elenco e lo si fa scorrere esattamente della larghezza
   di un gruppo. Arrivato li', quello che si vede e' il gruppo successivo,
   identico, e la posizione torna a zero senza scatto.

   Quante ripetizioni: mentre il nastro e' scorso di un gruppo intero, alla
   destra dello schermo deve esserci ancora roba. Percio' non basta una copia
   — con uno schermo piu' largo di un gruppo si aprirebbe un vuoto in coda —
   ma ne servono tante da coprire lo schermo PIU' il gruppo che se n'e'
   andato. Il conto si rifa' quando la finestra cambia larghezza.

   Le ripetizioni sono cieche per chi legge con la voce (aria-hidden): i nomi
   veri si leggono una volta sola.

   Il nastro si ferma quando ci passi sopra, quando la fascia esce dallo
   schermo (girare per nessuno consuma e basta) e quando il sistema chiede
   meno animazioni: in quel caso resta una fila che si scorre col dito.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
const VELOCITA = 34;   // pixel al secondo: lento, si legge senza inseguire

export class Fascia {
  constructor(el) {
    this.el = el;
    this.pista = el.querySelector('.fascia__pista');
    this.nastro = el.querySelector('.fascia__nastro');
    this.io = null;
  }

  get ridotto() { return RIDOTTO.matches; }

  monta() {
    if (!this.nastro || !this.nastro.children.length) return;
    this.originali = Array.from(this.nastro.children);

    if (this.ridotto) { this.el.classList.add('e-ferma'); return; }

    this.misura();
    this.osserva();

    // se la finestra cambia larghezza cambia anche la durata giusta
    let attesa = null;
    window.addEventListener('resize', () => {
      clearTimeout(attesa);
      attesa = setTimeout(() => this.misura(), 200);
    });

    // i loghi arrivano dopo: finche' non ci sono, la misura sarebbe sbagliata
    const immagini = this.originali.length;
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => this.misura(), { once: true });
    }
    if (immagini) setTimeout(() => this.misura(), 600);
  }

  /* Le copie sono cieche per chi legge con la voce: sono gli stessi nomi
     ripetuti. Se ne aggiungono, mai togliere: al massimo ce n'e' una di
     troppo, e una di troppo non si vede. */
  ripeti(gruppi) {
    const n = this.originali.length;
    while (this.nastro.children.length < n * gruppi) {
      const voce = this.originali[this.nastro.children.length % n];
      const copia = voce.cloneNode(true);
      copia.setAttribute('aria-hidden', 'true');
      this.nastro.appendChild(copia);
    }
  }

  /* La corsa e' larga quanto un gruppo, margine finale compreso: e' quella
     misura che fa combaciare la ripetizione con l'originale. */
  misura() {
    const n = this.originali.length;
    if (!n) return;
    const voci = Array.from(this.nastro.children);
    let corsa = 0;
    for (let i = 0; i < n; i++) {
      const v = voci[i];
      const stile = window.getComputedStyle(v);
      corsa += v.getBoundingClientRect().width + parseFloat(stile.marginRight || 0);
    }
    if (corsa <= 0) return;

    // schermo + un gruppo: e' quello che deve restare coperto per tutto il giro
    const largo = this.pista.getBoundingClientRect().width;
    this.ripeti(Math.max(2, Math.ceil((largo + corsa) / corsa)));

    this.nastro.style.setProperty('--corsa', corsa.toFixed(2) + 'px');
    this.nastro.style.setProperty('--durata', (corsa / VELOCITA).toFixed(2) + 's');
    this.el.classList.add('e-viva');
  }

  osserva() {
    if (!('IntersectionObserver' in window)) return;
    this.io = new IntersectionObserver((righe) => {
      for (const r of righe) this.el.classList.toggle('e-fuori', !r.isIntersecting);
    }, { threshold: 0 });
    this.io.observe(this.el);
  }
}

export function mountFascia(el) {
  if (!el) return null;
  const f = new Fascia(el);
  f.monta();
  return f;
}
