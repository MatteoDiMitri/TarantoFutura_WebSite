/* ==========================================================================
   Taranto Futura — i contatori a rullo
   Due numeri che si muovono quando si apre Events: uno sale, l'altro scende.
   Non sono decorazione: dicono una cosa, e la seconda e' la risposta alla
   frase che sta in About us — "quelli che dicono che qui non c'e' niente".

   Come gira il rullo: ogni cifra e' una colonna con 0-9 incolonnati, che
   scorre in verticale. La posizione non e' un numero intero ma la cifra
   CONTINUA (12.7 -> la colonna delle unita' sta fra il 2 e il 3): e' quello
   che fa sembrare un contachilometri invece di numeri che cambiano a scatti.

   Si dichiara nell'HTML, cosi' i numeri restano leggibili anche senza JS:
     <p class="conta__voce" data-da="500" data-a="3000">
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
const DURATA = 2400;                       // millisecondi del giro completo
const CIFRE = '0123456789';

const fuori = (t) => 1 - Math.pow(1 - t, 3);   // parte svelto, si posa piano

/* 3000 -> "3.000": il punto ogni tre cifre.
   Non si usa toLocaleString: in italiano i numeri di quattro cifre per
   convenzione non si raggruppano (3000, ma 10.000), e due contatori
   affiancati verrebbero uno col punto e uno senza. Qui il punto c'e' sempre. */
function cifreDi(n) {
  return String(Math.round(Math.abs(n))).length;
}

function conPunti(n) {
  const t = String(Math.round(Math.abs(n)));
  return t.replace(/\B(?=(\d{3})+$)/g, '.');
}

export class Contatore {
  /* "slot" e' quante cifre tiene il rullo. Non e' una scelta del singolo
     contatore ma di tutti quelli che stanno insieme: se uno arriva a 10.000
     e l'altro a 3.000, con rulli di larghezza diversa le frecce e i numeri
     finirebbero sfalsati fra una riga e l'altra. */
  constructor(el, slot) {
    this.el = el;
    this.da = parseFloat(el.dataset.da || '0');
    this.a = parseFloat(el.dataset.a || '0');
    this.slot = slot || cifreDi(Math.max(this.da, this.a));
    this.cassa = el.querySelector('.conta__n');
    this.anim = null;
    this.prepara();
  }

  get ridotto() { return RIDOTTO.matches; }

  /* Le colonne sono tante quante le cifre del numero piu' lungo fra i due:
     cosi' il rullo non cambia larghezza mentre gira. */
  prepara() {
    if (!this.cassa) return;
    this.freccia();
    // il modello da' il numero di colonne e dove cadono i punti
    const largo = conPunti(Number('1'.repeat(this.slot)));
    this.cassa.textContent = '';
    this.colonne = [];
    for (const c of largo) {
      if (c === '.') {
        const p = document.createElement('span');
        p.className = 'conta__punto';
        p.textContent = '.';
        this.cassa.appendChild(p);
        this.colonne.push(null);
        continue;
      }
      const col = document.createElement('span');
      col.className = 'conta__colonna';
      const nastro = document.createElement('span');
      nastro.className = 'conta__rullo';
      // 0-9 piu' un altro 0 in fondo: serve a chiudere il giro senza salto
      nastro.textContent = (CIFRE + '0').split('').join('\n');
      col.appendChild(nastro);
      this.cassa.appendChild(col);
      nastro.dataset.colonna = '1';
      this.colonne.push(nastro);
      this.scatole = this.scatole || [];
      this.scatole.push(col);
    }
    this.mostra(this.ridotto ? this.a : this.da);
  }

  /* Una freccia accanto al numero: il rullo gira troppo in fretta perche' si
     capisca da solo se sale o scende, e il verso e' il senso di tutti e due.
     Mentre corre la freccia si muove piano nella sua direzione. */
  freccia() {
    if (this.el.querySelector('.conta__verso')) return;
    const su = this.a >= this.da;
    const f = document.createElement('span');
    f.className = 'conta__verso ' + (su ? 'e-su' : 'e-giu');
    f.setAttribute('aria-hidden', 'true');
    f.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"' +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      (su ? '<path d="M12 20V5M5 12l7-7 7 7"/>' : '<path d="M12 4v15M5 12l7 7 7-7"/>') +
      '</svg>';

    /* Freccia e numero in una riga loro, separata dall'etichetta. Se stessero
       tutti nella stessa griglia, l'etichetta lunga del secondo contatore
       allargherebbe le colonne di quella riga e i due numeri finirebbero
       disallineati fra loro: e' quello che succedeva. */
    const riga = document.createElement('span');
    riga.className = 'conta__riga';
    this.cassa.parentNode.insertBefore(riga, this.cassa);
    riga.appendChild(f);
    riga.appendChild(this.cassa);
  }

  /* Ogni colonna si mette sulla propria cifra, con la virgola: la colonna
     delle unita' e' sempre in movimento, quelle alte si muovono solo quando
     c'e' il riporto — esattamente come un contatore meccanico. */
  mostra(valore) {
    const quante = this.colonne.filter(Boolean).length;
    const v = Math.max(0, valore);
    const posizioni = [];
    for (let k = 0; k < quante; k++) {
      const peso = Math.pow(10, quante - 1 - k);
      const x = v / peso;
      if (peso === 1) {
        // la ruota delle unita' e' quella che gira davvero: segue il valore
        posizioni.push(x % 10);
      } else {
        // le ruote alte stanno ferme sulla loro cifra e scattano solo
        // nell'ultimo decimo del giro di quella sotto: e' il riporto, ed e'
        // quello che distingue un contatore meccanico da cifre che cambiano
        const d = Math.floor(x) % 10;
        const f = x - Math.floor(x);
        posizioni.push(d + Math.max(0, (f - 0.9) * 10));
      }
    }
    let j = 0;
    for (const c of this.colonne) {
      if (c === null) continue;
      const p = posizioni[j++];
      // le cifre sono alte esattamente 1em (interlinea 1): lo scorrimento
      // si conta in em, non in percentuale, perche' il rullo ha 11 righe
      c.style.transform = 'translateY(' + (-p).toFixed(3) + 'em)';
    }

    /* Gli zeri davanti si spengono invece di sparire: il posto resta
       occupato, cosi' il numero non salta di lato mentre gira, ma si legge
       "5.000" e non "05.000". */
    let ancoraZero = true;
    let k = 0;
    for (let i = 0; i < this.colonne.length; i++) {
      const c = this.colonne[i];
      const scatola = this.cassa.children[i];
      if (c === null) {                       // il punto delle migliaia
        scatola.style.opacity = ancoraZero ? '0' : '1';
        continue;
      }
      const cifra = Math.floor(posizioni[k++]);
      if (ancoraZero && cifra === 0 && i < this.colonne.length - 1) {
        scatola.style.opacity = '0';
      } else {
        scatola.style.opacity = '1';
        ancoraZero = false;
      }
    }
  }

  parti() {
    if (!this.cassa || this.anim) return;
    if (this.ridotto) { this.mostra(this.a); return; }
    const t0 = performance.now();
    this.el.classList.add('is-corre');
    const passo = (ora) => {
      const t = Math.min(1, (ora - t0) / DURATA);
      this.mostra(this.da + (this.a - this.da) * fuori(t));
      if (t < 1) { this.anim = requestAnimationFrame(passo); }
      else { this.anim = null; this.el.classList.remove('is-corre'); }
    };
    this.anim = requestAnimationFrame(passo);
    // se i fotogrammi non arrivano (scheda in secondo piano) almeno il
    // numero finale si vede
    clearTimeout(this.rete);
    this.rete = setTimeout(() => {
      if (this.anim) { cancelAnimationFrame(this.anim); this.anim = null; }
      this.el.classList.remove('is-corre');
      this.mostra(this.a);
    }, DURATA + 600);
  }

  azzera() {
    if (this.anim) { cancelAnimationFrame(this.anim); this.anim = null; }
    this.el.classList.remove('is-corre');
    clearTimeout(this.rete);
    this.mostra(this.ridotto ? this.a : this.da);
  }
}

/* I contatori vivono dentro a un pannello: partono quando quel pannello si
   apre, e si riavvolgono quando si chiude, cosi' la volta dopo si rivede il
   numero muoversi invece di trovarlo gia' arrivato. */
export function mountContatori(radice) {
  const voci = Array.from(document.querySelectorAll('.conta__voce'));
  if (!voci.length) return null;
  // tutti i rulli larghi uguale: e' quello che tiene le frecce incolonnate
  let slot = 1;
  for (const v of voci) {
    slot = Math.max(slot, cifreDi(parseFloat(v.dataset.da || '0')),
                    cifreDi(parseFloat(v.dataset.a || '0')));
  }
  const tutti = voci.map((v) => new Contatore(v, slot));
  const pannello = voci[0].closest('.pannello');
  const id = pannello ? pannello.id : null;

  const html = document.documentElement;
  html.addEventListener('pannello:apri', (e) => {
    if (id && e.detail !== id) return;
    for (const c of tutti) c.parti();
  });
  html.addEventListener('pannello:chiudi', () => {
    for (const c of tutti) c.azzera();
  });

  // senza pannello (o arrivando da un link diretto) partono appena si vedono
  if (!id && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((righe) => {
      for (const r of righe) if (r.isIntersecting) {
        tutti.forEach((c) => c.parti());
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(voci[0]);
  } else if (id && location.hash.slice(1) === id) {
    setTimeout(() => tutti.forEach((c) => c.parti()), 400);
  }

  return tutti;
}
