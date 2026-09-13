/* ==========================================================================
   Taranto Futura — visore
   Una sola finestra a tutto schermo, usata sia dai book fotografici degli
   eventi sia dalle fanzine. Riceve un elenco di pagine e le sfoglia: non sa
   nulla di cosa stia mostrando, e per questo va bene per entrambi.

   Ogni pagina: { tipo: 'video' | 'foto', src, poster? }
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');

export class Visore {
  constructor(el) {
    this.el = el;
    this.pagine = [];     // tutte le pagine, in fila
    this.gruppi = [];     // come sono raccolte a schermo: una o due per volta
    this.p = 0;           // gruppo corrente
    this.doppia = false;
    this.inGirata = false;
    this.etichetta = '';
    this.tornaA = null;

    this.scena = el.querySelector('.visore__scena');
    this.video = el.querySelector('.visore__video');
    this.quando = el.querySelector('.visore__quando');
    this.prec = el.querySelector('.visore__nav--prec');
    this.succ = el.querySelector('.visore__nav--succ');

    this.lega();
  }

  get ridotto() { return RIDOTTO.matches; }
  get aperto() { return !this.el.hidden; }

  /* Due pagine per volta solo dove ci stanno davvero: su un telefono in
     verticale due pagine affiancate diventerebbero illeggibili. */
  get affiancabili() {
    return this.doppia && window.innerWidth >= 760 &&
           window.innerWidth / window.innerHeight > 0.9;
  }

  raggruppa() {
    const mantieni = this.gruppi.length ? this.gruppi[this.p][0] : 0;
    this.gruppi = [];
    if (this.affiancabili) {
      for (let i = 0; i < this.pagine.length; i += 2) {
        this.gruppi.push(this.pagine[i + 1] !== undefined ? [i, i + 1] : [i]);
      }
    } else {
      for (let i = 0; i < this.pagine.length; i++) this.gruppi.push([i]);
    }
    // resta sulla pagina che si stava guardando anche cambiando disposizione
    this.p = Math.max(0, this.gruppi.findIndex((g) => g.indexOf(mantieni) !== -1));
  }

  lega() {
    for (const sel of ['.visore__chiudi', '.visore__fondo']) {
      const b = this.el.querySelector(sel);
      if (b) b.addEventListener('click', () => this.chiudi());
    }
    if (this.prec) this.prec.addEventListener('click', () => this.sfoglia(-1));
    if (this.succ) this.succ.addEventListener('click', () => this.sfoglia(1));

    document.addEventListener('keydown', (e) => {
      if (!this.aperto) return;
      if (e.key === 'Escape') { e.preventDefault(); this.chiudi(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.sfoglia(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.sfoglia(1); }
      else if (e.key === 'Tab') this.trattieniFuoco(e);
    });

    // ruotando il telefono o ridimensionando la finestra la disposizione cambia
    window.addEventListener('resize', () => {
      if (!this.aperto || !this.doppia) return;
      clearTimeout(this._ridis);
      this._ridis = setTimeout(() => {
        this.raggruppa();
        this.mostra();
      }, 150);
    });

    let x0 = null;
    this.el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    this.el.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) this.sfoglia(dx < 0 ? 1 : -1);
    });
  }

  apri(pagine, etichetta, origine, opzioni) {
    if (!pagine || !pagine.length) return;
    this.pagine = pagine;
    this.etichetta = etichetta || '';
    this.doppia = !!(opzioni && opzioni.doppia);
    this.gruppi = [];
    this.p = 0;
    this.raggruppa();
    this.tornaA = origine || document.activeElement;

    this.el.hidden = false;
    this.bloccaFondo(true);
    this.mostra();
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.add('is-dentro')));
    setTimeout(() => this.el.classList.add('is-dentro'), 100);

    const chiudi = this.el.querySelector('.visore__chiudi');
    if (chiudi) chiudi.focus({ preventScroll: true });
  }

  /* Un foglio: il contenitore di una pagina. Serve perche' la girata deve
     poter sovrapporre un foglio a un altro e mostrarne il retro. */
  foglio(pag, classe) {
    const f = document.createElement('div');
    f.className = 'foglio' + (classe ? ' ' + classe : '');
    const img = document.createElement('img');
    img.className = 'visore__foto';
    img.src = pag.src;
    img.alt = pag.alt || '';
    img.decoding = 'async';
    f.appendChild(img);
    return f;
  }

  disegna(gruppo) {
    for (const f of this.scena.querySelectorAll('.foglio, .sfoglio')) f.remove();
    const doppio = gruppo.length > 1;
    this.scena.classList.toggle('e-doppia', doppio);
    this.scena.appendChild(this.foglio(this.pagine[gruppo[0]], 'foglio--sx'));
    if (doppio) this.scena.appendChild(this.foglio(this.pagine[gruppo[1]], 'foglio--dx'));
  }

  etichettaDi(gruppo) {
    const n = this.pagine.length;
    const doppio = gruppo.length > 1;
    const eti = doppio
      ? (gruppo[0] + 1) + '-' + (gruppo[1] + 1) + '/' + n
      : (gruppo[0] + 1) + '/' + n;
    return this.gruppi.length > 1 ? this.etichetta + ' · ' + eti : this.etichetta;
  }

  mostra() {
    const gruppo = this.gruppi[this.p];
    if (!gruppo) return;

    const primo = this.pagine[gruppo[0]];
    if (primo.tipo === 'video') {
      for (const f of this.scena.querySelectorAll('.foglio, .sfoglio')) f.remove();
      this.scena.classList.add('e-video');
      this.scena.classList.remove('e-immagine', 'e-doppia');
      this.video.hidden = false;
      if (primo.poster) this.video.poster = primo.poster;
      if (this.video.getAttribute('src') !== primo.src) this.video.src = primo.src;
      const pr = this.video.play();
      if (pr && pr.catch) pr.catch(() => {});
    } else {
      this.scena.classList.remove('e-video');
      this.scena.classList.add('e-immagine');
      this.video.pause();
      this.video.hidden = true;
      this.disegna(gruppo);
      this.precarica();
    }

    const molti = this.gruppi.length > 1;
    if (this.prec) this.prec.hidden = !molti;
    if (this.succ) this.succ.hidden = !molti;
    if (this.quando) this.quando.textContent = this.etichettaDi(gruppo);
  }

  /* La pagina dopo e quella prima vengono scaricate in anticipo: sfogliando
     una fanzine da cinquanta pagine, aspettare a ogni passo sarebbe fastidioso. */
  precarica() {
    const n = this.gruppi.length;
    for (const d of [1, -1]) {
      const g = this.gruppi[(this.p + d + n) % n];
      if (!g) continue;
      for (const i of g) {
        const q = this.pagine[i];
        if (q && q.tipo === 'foto') { const im = new Image(); im.src = q.src; }
      }
    }
  }

  sfoglia(verso) {
    const n = this.gruppi.length;
    if (n < 2 || this.inGirata) return;
    const prossima = (this.p + verso + n) % n;
    if (prossima === this.p) return;

    // La fanzine si gira come un giornale; le foto degli eventi scorrono.
    if (this.doppia && !this.ridotto) this.gira(prossima, verso);
    else this.scorri(prossima, verso);
  }

  /* ---------------------------------------------------------- la girata
     Il foglio si solleva e ruota sulla rilegatura: durante il mezzo giro si
     vede il fronte, dopo i 90 gradi compare il retro, che e' gia' la pagina
     successiva. Sotto, intanto, e' stata messa la pagina che restera'. */
  gira(prossima, verso) {
    const qui = this.gruppi[this.p];
    const la = this.gruppi[prossima];
    const doppio = qui.length > 1 && la.length > 1;
    this.inGirata = true;

    const sfoglio = document.createElement('div');
    sfoglio.className = 'sfoglio' + (doppio ? '' : ' sfoglio--intero') +
                        (verso > 0 ? ' sfoglio--avanti' : ' sfoglio--indietro');

    const faccia = (pag, classe) => {
      const d = document.createElement('div');
      d.className = 'sfoglio__faccia ' + classe;
      const img = document.createElement('img');
      img.src = pag.src;
      img.alt = '';
      d.appendChild(img);
      // il velo: la faccia si scurisce man mano che si gira di taglio alla luce
      const velo = document.createElement('span');
      velo.className = 'sfoglio__velo';
      d.appendChild(velo);
      return d;
    };

    if (verso > 0) {
      // in avanti: gira il foglio di destra, il retro e' la nuova pagina sinistra
      const fronte = this.pagine[qui[qui.length - 1]];
      const retro = this.pagine[la[0]];
      sfoglio.appendChild(faccia(fronte, 'sfoglio__faccia--fronte'));
      sfoglio.appendChild(faccia(retro, 'sfoglio__faccia--retro'));
      // la pagina che restera' a destra va messa subito sotto
      if (doppio) {
        const dx = this.scena.querySelector('.foglio--dx img');
        if (dx) dx.src = this.pagine[la[1]].src;
      }
    } else {
      // indietro: gira il foglio di sinistra, il retro e' la nuova destra
      const fronte = this.pagine[qui[0]];
      const retro = this.pagine[la[la.length - 1]];
      sfoglio.appendChild(faccia(fronte, 'sfoglio__faccia--fronte'));
      sfoglio.appendChild(faccia(retro, 'sfoglio__faccia--retro'));
      if (doppio) {
        const sx = this.scena.querySelector('.foglio--sx img');
        if (sx) sx.src = this.pagine[la[0]].src;
      }
    }
    this.scena.appendChild(sfoglio);

    const parti = () => sfoglio.classList.add('is-girata');
    requestAnimationFrame(() => requestAnimationFrame(parti));
    setTimeout(parti, 60);       // se i fotogrammi non arrivano, ci pensa il timer

    const finisci = () => {
      if (!this.inGirata) return;
      this.inGirata = false;
      this.p = prossima;
      this.disegna(la);          // rimuove anche il foglio girato
      this.precarica();
      if (this.quando) this.quando.textContent = this.etichettaDi(la);
    };
    sfoglio.addEventListener('animationend', finisci, { once: true });
    setTimeout(finisci, 850);    // rete di sicurezza
  }

  /* scorrimento semplice: per le foto degli eventi, che non sono un libro */
  scorri(prossima, verso) {
    if (this.ridotto) { this.p = prossima; this.mostra(); return; }
    const via = verso > 0 ? 'va-avanti' : 'va-indietro';
    const dentro = verso > 0 ? 'va-indietro' : 'va-avanti';
    this.el.classList.remove('is-dentro');
    this.el.classList.add(via);

    setTimeout(() => {
      this.p = prossima;
      this.mostra();
      this.el.classList.remove(via);
      this.el.classList.add(dentro);
      const arriva = () => {
        this.el.classList.remove(dentro);
        this.el.classList.add('is-dentro');
      };
      requestAnimationFrame(() => requestAnimationFrame(arriva));
      setTimeout(arriva, 80);
    }, 240);
  }

  chiudi() {
    if (!this.aperto) return;
    this.el.classList.remove('is-dentro', 'va-avanti', 'va-indietro');
    const fine = () => {
      this.el.hidden = true;
      if (this.video) {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      }
      for (const f of this.scena.querySelectorAll('.foglio, .sfoglio')) f.remove();
      this.inGirata = false;
    };
    if (this.ridotto) fine(); else setTimeout(fine, 320);
    this.bloccaFondo(false);
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

  /* il pannello sotto non deve scorrere mentre il visore e' aperto */
  bloccaFondo(blocca) {
    for (const c of document.querySelectorAll('.pannello__corpo')) {
      c.style.overflowY = blocca ? 'hidden' : '';
    }
  }
}
