/* ==========================================================================
   Taranto Futura — Creative Studio
   I lavori sono divisi in due famiglie: quelli fatti per noi e quelli fatti
   con qualcun altro. La divisione sta nei dati, non nella pagina: ogni voce
   di assets/studio/progetti.json ha un campo "tipo" e finisce nel gruppo
   giusto da sola.

   Una voce:
   {
     "slug": "nome-cartella",
     "titolo": "Come si chiama",
     "tipo": "nostro" | "collab",
     "con": "Chi (solo per le collab)",
     "ruolo": "Cosa abbiamo fatto",
     "cartella": "assets/studio/COLLAB/<nome>/",
     "copertina": "assets/studio/COLLAB/<nome>/01.webp",
     "foto": ["01.webp", "02.webp"]
   }
   Senza "cartella" le foto si cercano in assets/studio/<slug>/. Se l'elenco
   e' vuoto il progetto si mostra ma non si apre.
   ========================================================================== */

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
const MANIFESTO = 'assets/studio/progetti.json';
const BASE = 'assets/studio/';

/* Le due sottosezioni ci sono sempre, anche vuote: dicono cosa fa lo studio
   prima ancora di avere qualcosa da mostrare. */
const GRUPPI = [
  { tipo: 'nostro', titolo: 'I nostri prodotti', nota: 'Quello che facciamo per Taranto Futura.',
    vuoto: 'I primi lavori arrivano presto.' },
  { tipo: 'collab', titolo: 'Collab',            nota: 'Quello che facciamo con gli altri.',
    vuoto: 'Spazio per chi vuole lavorare con noi.' }
];

/* Dove stanno le immagini di un progetto: quello che dice il manifesto,
   altrimenti la cartella col suo nome. */
function cartellaDi(v) {
  const c = v.cartella || (BASE + v.slug + '/');
  return c.slice(-1) === '/' ? c : c + '/';
}

export class Studio {
  constructor(radice, visore, storia) {
    this.radice = radice;
    this.visore = visore;
    this.storia = storia;
    this.progetti = [];
  }

  get ridotto() { return RIDOTTO.matches; }

  async monta() {
    try {
      const r = await fetch(MANIFESTO, { cache: 'no-cache' });
      this.progetti = r.ok ? await r.json() : [];
    } catch (e) { this.progetti = []; }

    this.radice.textContent = '';
    for (const g of GRUPPI) {
      const voci = this.progetti.filter((p) => p.tipo === g.tipo);
      this.radice.appendChild(this.gruppo(g, voci));
    }
    this.comparsa();
  }

  gruppo(g, voci) {
    const sez = document.createElement('section');
    sez.className = 'lavori';

    const testa = document.createElement('div');
    testa.className = 'lavori__testa';
    const h = document.createElement('h3');
    h.className = 'lavori__titolo';
    h.textContent = g.titolo;
    const nota = document.createElement('p');
    nota.className = 'lavori__nota';
    nota.textContent = g.nota;
    testa.appendChild(h);
    testa.appendChild(nota);

    sez.appendChild(testa);

    if (voci.length) {
      const griglia = document.createElement('div');
      griglia.className = 'lavori__griglia';
      for (const v of voci) griglia.appendChild(this.scheda(v));
      sez.appendChild(griglia);
    } else {
      // sottosezione ancora vuota: si dice, invece di lasciare il buco
      const p = document.createElement('p');
      p.className = 'lavori__vuoto';
      p.textContent = g.vuoto;
      sez.appendChild(p);
    }
    return sez;
  }

  /* Un prodotto si apre se ha una storia da raccontare o almeno delle foto. */
  apribileIl(v) {
    return ((v.storia || []).length > 0) || ((v.foto || []).length > 0);
  }

  scheda(v) {
    const apribile = this.apribileIl(v);
    const el = document.createElement(apribile ? 'button' : 'div');
    el.className = 'lavoro' + (apribile ? '' : ' e-fermo');
    if (apribile) {
      el.type = 'button';
      el.setAttribute('aria-label',
        ((v.storia || []).length ? 'Leggi la storia di ' : 'Apri ') + v.titolo);
      el.addEventListener('click', () => this.apri(v, el));
    }

    const scena = document.createElement('span');
    scena.className = 'lavoro__scena';
    const img = document.createElement('img');
    img.className = 'lavoro__copertina';
    img.src = v.copertina || '';
    img.alt = '';
    img.loading = 'lazy';
    scena.appendChild(img);
    el.appendChild(scena);

    const riga = document.createElement('span');
    riga.className = 'lavoro__riga';
    const t = document.createElement('span');
    t.className = 'lavoro__titolo';
    t.textContent = v.titolo;
    riga.appendChild(t);
    // sulle collab il nome di chi c'era conta quanto il titolo
    if (v.con) {
      const con = document.createElement('span');
      con.className = 'lavoro__con';
      con.textContent = 'con ' + v.con;
      riga.appendChild(con);
    }
    if (v.ruolo) {
      const r = document.createElement('span');
      r.className = 'lavoro__ruolo';
      r.textContent = v.ruolo;
      riga.appendChild(r);
    }
    // chi ha una storia lo dice: e' un invito diverso da "guarda le foto"
    if ((v.storia || []).length) {
      const s = document.createElement('span');
      s.className = 'lavoro__storia';
      s.textContent = 'La storia';
      riga.appendChild(s);
    }
    el.appendChild(riga);
    return el;
  }

  apri(v, origine) {
    // la storia ha la precedenza: e' il modo in cui vogliamo che il prodotto
    // venga incontrato la prima volta
    if (this.storia && (v.storia || []).length) {
      if (this.storia.apri(v, cartellaDi(v), origine)) return;
    }
    if (!this.visore) return;
    const cartella = cartellaDi(v);
    const pagine = (v.foto || []).map((f, i) => ({
      tipo: 'foto',
      src: f.indexOf('assets/') === 0 ? f : cartella + f,
      alt: v.titolo + ', immagine ' + (i + 1)
    }));
    if (!pagine.length) return;
    this.visore.apri(pagine, v.titolo, origine);
  }

  comparsa() {
    const schede = Array.from(this.radice.querySelectorAll('.lavoro'));
    if (this.ridotto || !('IntersectionObserver' in window)) {
      schede.forEach((s) => s.classList.add('is-dentro'));
      return;
    }
    const io = new IntersectionObserver((righe) => {
      for (const r of righe) {
        if (!r.isIntersecting) continue;
        r.target.querySelector('.lavoro__scena').style.transitionDelay =
          Math.min(schede.indexOf(r.target), 5) * 70 + 'ms';
        r.target.classList.add('is-dentro');
        io.unobserve(r.target);
      }
    }, { threshold: 0.2 });
    schede.forEach((s) => io.observe(s));

    setTimeout(() => {
      for (const s of schede) {
        if (s.classList.contains('is-dentro')) continue;
        const sc = s.querySelector('.lavoro__scena');
        if (sc) { sc.style.transition = 'none'; sc.style.opacity = '1'; sc.style.transform = 'none'; }
        s.classList.add('is-dentro');
      }
    }, 4000);
  }
}

export function mountStudio(radice, visore, storia) {
  const s = new Studio(radice, visore, storia);
  s.monta();
  return s;
}
