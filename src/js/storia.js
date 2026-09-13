/* ==========================================================================
   Taranto Futura — racconto a scorrimento
   L'immagine resta ferma mentre il testo le scorre accanto, e cambia quando
   il racconto arriva al blocco successivo. E' la forma classica dello
   scrollytelling, ed e' quella giusta per un prodotto: l'oggetto deve restare
   sotto gli occhi mentre gli si racconta la storia.

   Una storia sta nel manifesto del progetto, come elenco di blocchi:
     "storia": [
       { "foto": "01.webp", "testo": "Come e' nata l'idea." },
       { "video": "02.mp4", "poster": "02.webp", "titolo": "Il disegno", "testo": "..." }
     ]
   Un blocco puo' portare una foto o un video: il video parte solo quando il
   racconto arriva al suo capitolo, e si ferma appena lo si supera.
   I file stanno nella cartella del progetto, come le altre immagini.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');

/* Un percorso che parte da assets/ e' gia' completo: si puo' riusare
   un'immagine che sta altrove nel sito senza doverne fare una copia. */
function risolvi(foto, cartella) {
  return foto.indexOf('assets/') === 0 ? foto : cartella + foto;
}

export class Storia {
  constructor(el) {
    this.el = el;
    this.occhiello = el.querySelector('.storia__occhiello');
    this.media = el.querySelector('.storia__media');
    this.testo = el.querySelector('.storia__testo');
    this.corpo = el.querySelector('.storia__corpo');
    this.avanzamento = el.querySelector('.storia__avanzamento i');
    this.tornaA = null;
    this.io = null;

    const chiudi = el.querySelector('.storia__chiudi');
    if (chiudi) chiudi.addEventListener('click', () => this.chiudi());
    document.addEventListener('keydown', (e) => {
      if (this.el.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); this.chiudi(); }
      else if (e.key === 'Tab') this.trattieniFuoco(e);
    });
    this.corpo.addEventListener('scroll', () => this.aggiornaAvanzamento(), { passive: true });
  }

  get ridotto() { return RIDOTTO.matches; }
  get aperto() { return !this.el.hidden; }

  fermaMedia() {
    for (const v of this.media.querySelectorAll('video')) if (!v.paused) v.pause();
  }

  apri(progetto, cartella, origine) {
    const blocchi = progetto.storia || [];
    if (!blocchi.length) return false;

    this.tornaA = origine || document.activeElement;
    this.occhiello.textContent = progetto.titolo || '';
    this.media.textContent = '';
    this.testo.textContent = '';

    // i media stanno tutti sovrapposti: cambia solo quale e' visibile
    blocchi.forEach((b, i) => {
      let el;
      if (b.video) {
        el = document.createElement('video');
        el.src = risolvi(b.video, cartella);
        if (b.poster) el.poster = risolvi(b.poster, cartella);
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        el.preload = i === 0 ? 'auto' : 'none';
      } else if (b.foto) {
        el = document.createElement('img');
        el.src = risolvi(b.foto, cartella);
        el.alt = '';
        el.loading = i === 0 ? 'eager' : 'lazy';
      } else return;
      el.className = 'storia__media-el' + (i === 0 ? ' is-viva' : '');
      el.dataset.blocco = String(i);
      this.media.appendChild(el);
    });

    blocchi.forEach((b, i) => {
      const sez = document.createElement('section');
      sez.className = 'blocco';
      sez.dataset.blocco = String(i);
      if (b.titolo) {
        const h = document.createElement('h3');
        h.className = 'blocco__titolo';
        h.textContent = b.titolo;
        sez.appendChild(h);
      }
      const p = document.createElement('p');
      p.className = 'blocco__testo';
      p.textContent = b.testo || '';
      sez.appendChild(p);
      this.testo.appendChild(sez);
    });

    this.el.hidden = false;
    document.documentElement.classList.add('is-storia-aperta');
    this.corpo.scrollTop = 0;
    this.osserva();
    this.attiva('0');
    this.aggiornaAvanzamento();

    const chiudi = this.el.querySelector('.storia__chiudi');
    if (chiudi) chiudi.focus({ preventScroll: true });
    return true;
  }

  /* Il blocco attivo e' quello che sta attraversando la fascia centrale dello
     schermo: cambiare immagine appena il testo entra da sotto sarebbe troppo
     presto, e si vedrebbe l'immagine cambiare mentre stai ancora leggendo. */
  osserva() {
    if (this.io) this.io.disconnect();
    if (!('IntersectionObserver' in window)) { return; }
    this.io = new IntersectionObserver((righe) => {
      for (const r of righe) {
        if (r.isIntersecting) this.attiva(r.target.dataset.blocco);
      }
    }, { root: this.corpo, rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    for (const b of this.testo.querySelectorAll('.blocco')) this.io.observe(b);
  }

  attiva(i) {
    for (const el of this.media.querySelectorAll('.storia__media-el')) {
      const viva = el.dataset.blocco === i;
      el.classList.toggle('is-viva', viva);
      // un video fuori dal suo capitolo non deve continuare a girare
      if (el.tagName === 'VIDEO') {
        if (viva) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
        else if (!el.paused) el.pause();
      }
    }
    for (const b of this.testo.querySelectorAll('.blocco')) {
      b.classList.toggle('is-viva', b.dataset.blocco === i);
    }
  }

  aggiornaAvanzamento() {
    if (!this.avanzamento) return;
    const c = this.corpo;
    const max = c.scrollHeight - c.clientHeight;
    const q = max > 0 ? Math.min(1, Math.max(0, c.scrollTop / max)) : 0;
    this.avanzamento.style.transform = 'scaleX(' + q.toFixed(4) + ')';
  }

  chiudi() {
    if (!this.aperto) return;
    this.fermaMedia();
    this.el.hidden = true;
    document.documentElement.classList.remove('is-storia-aperta');
    if (this.io) { this.io.disconnect(); this.io = null; }
    this.media.textContent = '';
    this.testo.textContent = '';
    if (this.tornaA && document.contains(this.tornaA)) {
      this.tornaA.focus({ preventScroll: true });
    }
    this.tornaA = null;
  }

  trattieniFuoco(e) {
    const f = Array.from(this.el.querySelectorAll('button'))
      .filter((b) => !b.hidden && b.offsetParent !== null);
    if (!f.length) return;
    const primo = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  }
}
