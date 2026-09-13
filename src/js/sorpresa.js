/* ==========================================================================
   Taranto Futura — la sorpresa
   Sette click di fila sulla scritta in alto a sinistra e parte una foto a
   tutto schermo. Non c'e' nessun segnale che inviti a farlo: e' il punto.

   Perche' "di fila": i click vanno contati solo se ravvicinati, altrimenti
   uno che nell'arco di una visita tocca quella scritta sette volte per caso
   si ritroverebbe una foto in faccia senza capire perche'. Con una finestra
   di un secndo e mezzo fra un click e l'altro, sette volte di fila le fai
   solo se le stai facendo apposta.

   La foto sta in assets/easter/sorpresa.webp: per cambiarla basta
   sostituire quel file, non si tocca niente qui.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
const QUANTI = 7;
const FINESTRA = 1500;                       // ms massimi fra un click e l'altro
const FOTO = 'assets/easter/sorpresa.webp';

export class Sorpresa {
  constructor(bersaglio, foto) {
    this.bersaglio = bersaglio;
    this.foto = foto || FOTO;
    this.conto = 0;
    this.ultimo = 0;
    this.velo = null;
    this.tornaA = null;
  }

  get ridotto() { return RIDOTTO.matches; }

  monta() {
    if (!this.bersaglio) return;
    this.bersaglio.addEventListener('click', () => this.tocco());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.velo && !this.velo.hidden) {
        e.stopPropagation();
        e.preventDefault();
        this.chiudi();
      }
    }, true);
  }

  tocco() {
    const ora = Date.now();
    this.conto = (ora - this.ultimo < FINESTRA) ? this.conto + 1 : 1;
    this.ultimo = ora;

    // a meta' strada la foto si scarica in silenzio: quando arriva il settimo
    // click e' gia' pronta e compare senza il lampo del caricamento
    if (this.conto === 4) { const i = new Image(); i.src = this.foto; }

    if (this.conto >= QUANTI) {
      this.conto = 0;
      this.apri();
    }
  }

  costruisci() {
    const v = document.createElement('div');
    v.className = 'sorpresa';
    v.hidden = true;
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-modal', 'true');
    v.setAttribute('aria-label', 'Una foto');
    v.innerHTML =
      '<img class="sorpresa__foto" alt="">' +
      '<p class="sorpresa__riga">L’hai trovata.</p>' +
      '<button class="sorpresa__chiudi" type="button" aria-label="Chiudi">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
        ' stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
      '</button>';
    v.querySelector('.sorpresa__chiudi').addEventListener('click', () => this.chiudi());
    // un click qualsiasi la manda via: e' una sorpresa, non una finestra
    v.addEventListener('click', (e) => {
      if (e.target.closest('.sorpresa__chiudi')) return;
      this.chiudi();
    });
    document.body.appendChild(v);
    return v;
  }

  apri() {
    if (!this.velo) this.velo = this.costruisci();
    if (!this.velo.hidden) return;
    this.tornaA = document.activeElement;
    this.velo.querySelector('.sorpresa__foto').src = this.foto;
    this.velo.hidden = false;
    document.documentElement.classList.add('is-sorpresa');
    if (!this.ridotto) {
      requestAnimationFrame(() => this.velo.classList.add('is-dentro'));
      setTimeout(() => this.velo.classList.add('is-dentro'), 80);
    } else {
      this.velo.classList.add('is-dentro');
    }
    this.velo.querySelector('.sorpresa__chiudi').focus({ preventScroll: true });
  }

  chiudi() {
    if (!this.velo || this.velo.hidden) return;
    this.velo.classList.remove('is-dentro');
    this.velo.hidden = true;
    document.documentElement.classList.remove('is-sorpresa');
    if (this.tornaA && document.contains(this.tornaA)) {
      this.tornaA.focus({ preventScroll: true });
    }
    this.tornaA = null;
  }
}

export function mountSorpresa() {
  const b = document.querySelector('[data-sorpresa]');
  if (!b) return null;
  const s = new Sorpresa(b, b.dataset.sorpresa || FOTO);
  s.monta();
  return s;
}
