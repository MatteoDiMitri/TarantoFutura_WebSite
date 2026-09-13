/* ==========================================================================
   Taranto Futura — Shop
   Un catalogo, un carrello e un ordine. Qui non si paga: si sceglie la roba,
   si dice come la si vuole avere (a mano o spedita con Vinted) e si lasciano
   i propri contatti. L'ordine arriva nella nostra mail e ci si mette
   d'accordo da li'.

   I prodotti stanno in assets/prodotti/catalogo.json: quello e' l'unico file
   da toccare per cambiare prezzi, descrizioni o disponibilita'.

   COME ARRIVA L'ORDINE
   Il sito e' fatto di file statici: non ha un server che possa spedire mail.
   Ci sono due strade, e il codice le regge entrambe:
     1. ENDPOINT — un servizio che gira il modulo in una mail (Formspree,
        Web3Forms, Formsubmit...). Si crea un account, si incolla qui sotto
        l'indirizzo che danno, e l'ordine arriva da solo. E' la strada buona.
     2. Senza endpoint si apre la mail dell'utente gia' scritta, con tutto
        dentro: deve solo premere invia. Funziona sempre ma dipende da lui,
        percio' gli diamo anche il tasto per copiare il testo.
   ========================================================================== */

const MANIFESTO = 'assets/prodotti/catalogo.json';
const BASE = 'assets/prodotti/';
const CHIAVE = 'tf-carrello-1';

/* Incollare qui l'indirizzo del servizio modulo->mail quando c'e'.
   Finche' resta vuoto si usa la mail dell'utente. */
const ENDPOINT = '';
const MAIL = 'tarantofutura3@gmail.com';

const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
const euro = new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const CONSEGNE = {
  ritiro: {
    titolo: 'Ritiro a mano',
    dove: 'A Taranto',
    spiega: 'Ci si vede e te la diamo. Nessun costo in piu’: il posto e il ' +
            'momento li concordiamo insieme dopo l’ordine.'
  },
  vinted: {
    titolo: 'Spedizione con Vinted',
    dove: 'Ovunque',
    spiega: 'Ti prepariamo l’inserzione su Vinted e te la mandiamo: paghi ' +
            'li’, con la spedizione tracciata e la protezione acquisti.'
  }
};

const el = (tag, classe, testo) => {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (testo !== undefined) n.textContent = testo;
  return n;
};

/* --------------------------------------------------------------- carrello */
/* Il carrello resta nel browser: se chiudi il pannello, o la pagina, quello
   che avevi scelto e' ancora li'. */
function leggiCarrello() {
  try {
    const g = JSON.parse(localStorage.getItem(CHIAVE) || '[]');
    return Array.isArray(g) ? g.filter((r) => r && r.slug && r.qta > 0) : [];
  } catch (e) { return []; }
}

function scriviCarrello(righe) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(righe)); } catch (e) { /* modalita' privata */ }
}

export class Negozio {
  constructor(radice) {
    this.radice = radice;
    this.pannello = radice.closest('.pannello') || document.body;
    this.prodotti = [];
    this.righe = leggiCarrello();
    this.consegna = null;
    this.inCorso = false;
  }

  get ridotto() { return RIDOTTO.matches; }
  get pezzi() { return this.righe.reduce((s, r) => s + r.qta, 0); }
  get totale() {
    return this.righe.reduce((s, r) => {
      const p = this.prodotto(r.slug);
      return s + (p ? p.prezzo * r.qta : 0);
    }, 0);
  }

  prodotto(slug) { return this.prodotti.find((p) => p.slug === slug) || null; }

  async monta() {
    let dati = null;
    try {
      const r = await fetch(MANIFESTO, { cache: 'no-cache' });
      dati = r.ok ? await r.json() : null;
    } catch (e) { dati = null; }

    this.prodotti = (dati && dati.prodotti) || [];
    if (!this.prodotti.length) {
      this.radice.textContent = '';
      this.radice.appendChild(el('p', 'negozio__vuoto',
        'Il catalogo non si e’ caricato. Riprova fra poco.'));
      return;
    }

    // righe rimaste da una visita precedente su prodotti che non esistono piu'
    this.righe = this.righe.filter((r) => this.prodotto(r.slug));

    this.disegnaCatalogo();
    this.costruisciVista();
    this.costruisciOrdine();
    this.costruisciTastoCarrello();
    this.aggiornaCarrello();
    this.scorciatoie();
    this.comparsa();
  }

  /* ==================================================================
     CATALOGO
     ================================================================== */
  disegnaCatalogo() {
    this.radice.textContent = '';

    const griglia = el('div', 'catalogo');
    for (const p of this.prodotti) griglia.appendChild(this.scheda(p));
    this.radice.appendChild(griglia);
    this.griglia = griglia;
  }

  scheda(p) {
    const art = el('article', 'prodotto e-' + (p.formato || 'normale'));
    art.dataset.slug = p.slug;
    art.dataset.tipo = p.tipo || '';
    if (p.esaurito) art.classList.add('e-esaurito');

    const apri = el('button', 'prodotto__apri');
    apri.type = 'button';
    apri.setAttribute('aria-label', 'Guarda ' + p.nome);
    const telaio = el('span', 'prodotto__telaio');
    // Nel catalogo i riquadri hanno tutti la stessa forma: e' la griglia a
    // dover essere regolare. La foto ci sta dentro intera (contain) e il
    // riquadro prende il colore del suo fondo, cosi' il pezzo piu' alto o piu'
    // stretto non si vede che e' diverso: non c'e' ne' taglio ne' bordo.
    if (p.fondo) telaio.style.background = p.fondo;
    const img = el('img', 'prodotto__foto');
    img.src = BASE + p.immagine;
    img.alt = p.nome;
    img.loading = 'lazy';
    img.decoding = 'async';
    telaio.appendChild(img);
    telaio.appendChild(el('span', 'prodotto__luce'));
    apri.appendChild(telaio);
    if (p.esaurito) apri.appendChild(el('span', 'prodotto__bollo', 'Esaurito'));
    apri.addEventListener('click', () => this.apriVista(p, apri));
    art.appendChild(apri);

    const riga = el('div', 'prodotto__riga');
    riga.appendChild(el('h3', 'prodotto__nome', p.nome));
    riga.appendChild(el('p', 'prodotto__prezzo', euro.format(p.prezzo)));
    art.appendChild(riga);

    const piede = el('div', 'prodotto__piede');
    piede.appendChild(el('p', 'prodotto__tipo', p.tipo || ''));
    if (!p.esaurito) {
      const agg = el('button', 'prodotto__aggiungi', 'Aggiungi');
      agg.type = 'button';
      agg.setAttribute('aria-label', 'Aggiungi ' + p.nome + ' al carrello');
      agg.addEventListener('click', () => this.aggiungi(p, 1));
      piede.appendChild(agg);
    }
    art.appendChild(piede);

    if (!this.ridotto) this.inclina(art, telaio, img);
    return art;
  }

  /* La scheda si inclina seguendo il dito o il puntatore, e la foto dentro si
     muove un po' meno: e' quello che da' la profondita'. Piu' trattenuta che
     sulle locandine — qui si guarda la merce, non il manifesto. */
  inclina(art, telaio, img) {
    const muovi = (e) => {
      const r = telaio.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      art.classList.add('is-mossa');
      telaio.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg');
      telaio.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
      telaio.style.setProperty('--mx', (px * -14).toFixed(1) + 'px');
      telaio.style.setProperty('--my', (py * -14).toFixed(1) + 'px');
      telaio.style.setProperty('--lx', ((px + 0.5) * 100).toFixed(1) + '%');
      telaio.style.setProperty('--ly', ((py + 0.5) * 100).toFixed(1) + '%');
    };
    const molla = () => {
      art.classList.remove('is-mossa');
      for (const v of ['--rx', '--ry', '--mx', '--my']) telaio.style.removeProperty(v);
    };
    art.addEventListener('pointermove', muovi);
    art.addEventListener('pointerleave', molla);
    art.addEventListener('pointercancel', molla);
    art.addEventListener('pointerup', molla);
  }

  comparsa() {
    const schede = Array.from(this.griglia.querySelectorAll('.prodotto'));
    if (this.ridotto || !('IntersectionObserver' in window)) {
      schede.forEach((s) => s.classList.add('is-dentro'));
      return;
    }
    const io = new IntersectionObserver((righe) => {
      for (const r of righe) {
        if (!r.isIntersecting) continue;
        r.target.style.transitionDelay =
          Math.min(schede.indexOf(r.target), 5) * 60 + 'ms';
        r.target.classList.add('is-dentro');
        io.unobserve(r.target);
      }
    }, { threshold: 0.15 });
    schede.forEach((s) => io.observe(s));

    // rete di sicurezza: se l'osservatore non scatta restano visibili lo stesso
    setTimeout(() => {
      for (const s of schede) {
        if (s.classList.contains('is-dentro')) continue;
        s.style.transition = 'none';
        s.classList.add('is-dentro');
      }
    }, 4000);
  }

  /* ==================================================================
     VISTA DEL PRODOTTO
     ================================================================== */
  costruisciVista() {
    const v = el('div', 'vista');
    v.hidden = true;
    v.innerHTML =
      '<div class="vista__fondo" data-chiudi></div>' +
      '<div class="vista__foglio" role="dialog" aria-modal="true" aria-label="Prodotto">' +
        '<button class="vista__chiudi" type="button" aria-label="Chiudi">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
          ' stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
        '</button>' +
        '<div class="vista__foto"><img alt=""></div>' +
        '<div class="vista__info">' +
          '<p class="vista__tipo"></p>' +
          '<h3 class="vista__nome"></h3>' +
          '<p class="vista__prezzo"></p>' +
          '<p class="vista__desc"></p>' +
          '<p class="vista__misura"></p>' +
          '<div class="quantita" role="group" aria-label="Quantita">' +
            '<button type="button" class="quantita__meno" aria-label="Uno in meno">−</button>' +
            '<output class="quantita__n">1</output>' +
            '<button type="button" class="quantita__piu" aria-label="Uno in piu">+</button>' +
          '</div>' +
          '<button class="vista__aggiungi" type="button">Aggiungi al carrello</button>' +
          '<p class="vista__nota">Qui non si paga. Metti nel carrello, poi scegli ' +
          'se ritirarla a mano o farti spedire con Vinted.</p>' +
        '</div>' +
      '</div>';
    this.pannello.appendChild(v);
    this.vista = v;

    this.qta = 1;
    const n = v.querySelector('.quantita__n');
    const mostra = () => { n.textContent = String(this.qta); };
    v.querySelector('.quantita__meno').addEventListener('click', () => {
      this.qta = Math.max(1, this.qta - 1); mostra();
    });
    v.querySelector('.quantita__piu').addEventListener('click', () => {
      this.qta = Math.min(20, this.qta + 1); mostra();
    });
    v.querySelector('.vista__aggiungi').addEventListener('click', () => {
      if (this.vistaSu) this.aggiungi(this.vistaSu, this.qta);
      this.chiudiVista();
    });
    v.querySelector('.vista__chiudi').addEventListener('click', () => this.chiudiVista());
    v.querySelector('[data-chiudi]').addEventListener('click', () => this.chiudiVista());
  }

  apriVista(p, origine) {
    const v = this.vista;
    this.vistaSu = p;
    this.qta = 1;
    this.tornaA = origine || null;

    const img = v.querySelector('.vista__foto img');
    img.src = BASE + p.immagine;
    img.alt = p.nome;
    const cornice = v.querySelector('.vista__foto');
    cornice.style.setProperty('--ratio', p.ratio || '1 / 1');
    cornice.style.background = p.fondo || '#fffdf7';
    v.querySelector('.vista__tipo').textContent = p.tipo || '';
    v.querySelector('.vista__nome').textContent = p.nome;
    v.querySelector('.vista__prezzo').textContent = euro.format(p.prezzo);
    v.querySelector('.vista__desc').textContent = p.descrizione || '';
    const mis = v.querySelector('.vista__misura');
    mis.textContent = p.misura || '';
    mis.hidden = !p.misura;
    v.querySelector('.quantita__n').textContent = '1';

    const agg = v.querySelector('.vista__aggiungi');
    agg.disabled = !!p.esaurito;
    agg.textContent = p.esaurito ? 'Esaurito' : 'Aggiungi al carrello';
    v.querySelector('.quantita').hidden = !!p.esaurito;

    v.hidden = false;
    this.pannello.classList.add('e-finestra');
    requestAnimationFrame(() => v.classList.add('is-dentro'));
    setTimeout(() => v.classList.add('is-dentro'), 100);
    v.querySelector('.vista__chiudi').focus({ preventScroll: true });
  }

  chiudiVista() {
    const v = this.vista;
    if (v.hidden) return;
    v.classList.remove('is-dentro');
    v.hidden = true;
    this.vistaSu = null;
    if (this.ordine.hidden) this.pannello.classList.remove('e-finestra');
    if (this.tornaA && document.contains(this.tornaA)) {
      this.tornaA.focus({ preventScroll: true });
    }
    this.tornaA = null;
  }

  /* ==================================================================
     CARRELLO
     ================================================================== */
  costruisciTastoCarrello() {
    const barra = this.pannello.querySelector('.pannello__barra');
    if (!barra) return;
    const b = el('button', 'carrello-apri');
    b.type = 'button';
    b.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 6h2.2l1.6 9.4a1.6 1.6 0 0 0 1.6 1.3h7.4a1.6 1.6 0 0 0 1.6-1.3L20 9H7"/>' +
      '<circle cx="10" cy="20" r="1.1"/><circle cx="17.5" cy="20" r="1.1"/></svg>' +
      '<span class="carrello-apri__n" aria-hidden="true">0</span>';
    b.addEventListener('click', () => this.apriOrdine('carrello'));
    barra.insertBefore(b, barra.querySelector('.pannello__chiudi'));
    this.tastoCarrello = b;
  }

  aggiungi(p, quante) {
    if (p.esaurito) return;
    const r = this.righe.find((x) => x.slug === p.slug);
    if (r) r.qta = Math.min(20, r.qta + quante);
    else this.righe.push({ slug: p.slug, qta: quante });
    scriviCarrello(this.righe);
    this.aggiornaCarrello();
    this.avviso(p.nome + (quante > 1 ? ' × ' + quante : '') + ' nel carrello');
  }

  cambiaQta(slug, qta) {
    const r = this.righe.find((x) => x.slug === slug);
    if (!r) return;
    r.qta = qta;
    this.righe = this.righe.filter((x) => x.qta > 0);
    scriviCarrello(this.righe);
    this.aggiornaCarrello();
    this.disegnaRighe();
  }

  aggiornaCarrello() {
    const n = this.pezzi;
    if (this.tastoCarrello) {
      this.tastoCarrello.querySelector('.carrello-apri__n').textContent = String(n);
      this.tastoCarrello.classList.toggle('e-pieno', n > 0);
      this.tastoCarrello.setAttribute('aria-label',
        n ? 'Apri il carrello, ' + n + (n === 1 ? ' pezzo' : ' pezzi') : 'Il carrello e’ vuoto');
      if (n > 0) {
        this.tastoCarrello.classList.remove('e-battito');
        void this.tastoCarrello.offsetWidth;   // riavvia l'animazione
        this.tastoCarrello.classList.add('e-battito');
      }
    }
  }

  /* un avviso breve: dice che e' andata, senza rubare il posto a niente */
  avviso(testo) {
    if (!this.toast) {
      this.toast = el('p', 'negozio__avviso');
      this.toast.setAttribute('role', 'status');
      this.pannello.appendChild(this.toast);
    }
    this.toast.textContent = testo;
    this.toast.classList.add('is-su');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.toast.classList.remove('is-su'), 2200);
  }

  /* ==================================================================
     ORDINE — carrello, consegna, dati, fatto
     ================================================================== */
  costruisciOrdine() {
    const o = el('div', 'ordine');
    o.hidden = true;
    o.innerHTML =
      '<div class="ordine__fondo" data-chiudi></div>' +
      '<div class="ordine__foglio" role="dialog" aria-modal="true" aria-label="Il tuo ordine">' +
        '<div class="ordine__barra">' +
          '<ol class="ordine__passi">' +
            '<li data-p="carrello">Carrello</li>' +
            '<li data-p="consegna">Consegna</li>' +
            '<li data-p="dati">Dati</li>' +
          '</ol>' +
          '<button class="ordine__chiudi" type="button" aria-label="Chiudi">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="ordine__corpo">' +

          '<section class="passo" data-passo="carrello">' +
            '<h3 class="passo__titolo">Il carrello</h3>' +
            '<div class="carrello__righe"></div>' +
            '<p class="carrello__vuoto" hidden>Non c’e’ ancora niente. ' +
              'Scegli qualcosa dal catalogo.</p>' +
            '<div class="carrello__totale"><span>Totale</span><b></b></div>' +
            '<button class="bottone e-pieno carrello__avanti" type="button">Come la vuoi avere</button>' +
          '</section>' +

          '<section class="passo" data-passo="consegna" hidden>' +
            '<h3 class="passo__titolo">Come la vuoi avere</h3>' +
            '<div class="consegne"></div>' +
            '<button class="bottone e-vuoto" type="button" data-indietro="carrello">Torna al carrello</button>' +
          '</section>' +

          '<section class="passo" data-passo="dati" hidden>' +
            '<h3 class="passo__titolo">I tuoi dati</h3>' +
            '<p class="passo__nota"></p>' +
            '<form class="modulo" novalidate>' +
              '<label class="campo"><span>Nome e cognome *</span>' +
                '<input name="nome" type="text" autocomplete="name" required></label>' +
              '<label class="campo"><span>Email *</span>' +
                '<input name="email" type="email" autocomplete="email" required></label>' +
              '<label class="campo"><span>Instagram *</span>' +
                '<input name="instagram" type="text" placeholder="@iltuonome" required></label>' +
              '<label class="campo"><span>Telefono</span>' +
                '<input name="telefono" type="tel" autocomplete="tel"></label>' +
              '<label class="campo campo--largo"><span data-citta>Citta’</span>' +
                '<input name="citta" type="text" autocomplete="address-level2"></label>' +
              '<label class="campo campo--largo"><span>Note</span>' +
                '<textarea name="note" rows="2" placeholder="Qualcosa che dobbiamo sapere"></textarea>' +
              '</label>' +
              '<label class="consenso campo--largo">' +
                '<input name="consenso" type="checkbox" required>' +
                '<span>Va bene che usiate questi contatti per rispondermi su questo ordine. ' +
                'Niente newsletter, niente giri strani.</span></label>' +
              // la spunta da sola non basta: chi la mette deve poter leggere a
              // cosa sta dicendo di si'
              '<p class="modulo__legale campo--largo">Cosa facciamo dei tuoi dati sta ' +
              'scritto nell’<a href="privacy.html" target="_blank" rel="noopener">informativa ' +
              'privacy</a>.</p>' +
              '<p class="modulo__errore" role="alert" hidden></p>' +
              '<div class="modulo__azioni">' +
                '<button class="bottone e-vuoto" type="button" data-indietro="consegna">Indietro</button>' +
                '<button class="bottone e-pieno" type="submit">Manda l’ordine</button>' +
              '</div>' +
            '</form>' +
          '</section>' +

          '<section class="passo" data-passo="fatto" hidden>' +
            '<h3 class="passo__titolo">Ordine mandato</h3>' +
            '<p class="fatto__testo"></p>' +
            '<pre class="fatto__copia"></pre>' +
            '<div class="modulo__azioni">' +
              '<button class="bottone e-vuoto" type="button" data-copia>Copia il testo</button>' +
              '<button class="bottone e-pieno" type="button" data-fine>Chiudi</button>' +
            '</div>' +
          '</section>' +

        '</div>' +
      '</div>';
    this.pannello.appendChild(o);
    this.ordine = o;

    o.querySelector('.ordine__chiudi').addEventListener('click', () => this.chiudiOrdine());
    o.querySelector('[data-chiudi]').addEventListener('click', () => this.chiudiOrdine());
    o.querySelector('.carrello__avanti').addEventListener('click', () => {
      if (!this.righe.length) return;
      this.vaiA('consegna');
    });
    for (const b of o.querySelectorAll('[data-indietro]')) {
      b.addEventListener('click', () => this.vaiA(b.dataset.indietro));
    }
    o.querySelector('[data-fine]').addEventListener('click', () => this.chiudiOrdine());
    o.querySelector('[data-copia]').addEventListener('click', () => this.copiaTesto());
    o.querySelector('.modulo').addEventListener('submit', (e) => {
      e.preventDefault();
      this.manda();
    });

    // le due strade per averla
    const c = o.querySelector('.consegne');
    for (const id of Object.keys(CONSEGNE)) {
      const d = CONSEGNE[id];
      const b = el('button', 'consegna');
      b.type = 'button';
      b.dataset.consegna = id;
      b.innerHTML =
        '<span class="consegna__dove">' + d.dove + '</span>' +
        '<span class="consegna__titolo">' + d.titolo + '</span>' +
        '<span class="consegna__spiega">' + d.spiega + '</span>' +
        '<span class="consegna__vai" aria-hidden="true">Scegli →</span>';
      b.addEventListener('click', () => {
        this.consegna = id;
        for (const x of c.querySelectorAll('.consegna')) {
          x.classList.toggle('is-scelta', x === b);
        }
        const nota = o.querySelector('.passo[data-passo="dati"] .passo__nota');
        nota.textContent = d.titolo + ' — ' + d.spiega;
        const et = o.querySelector('[data-citta]');
        et.textContent = id === 'vinted' ? 'Citta’ (per la spedizione)' : 'Citta’';
        this.vaiA('dati');
      });
      c.appendChild(b);
    }
  }

  apriOrdine(passo) {
    this.disegnaRighe();
    this.ordine.hidden = false;
    this.pannello.classList.add('e-finestra');
    requestAnimationFrame(() => this.ordine.classList.add('is-dentro'));
    setTimeout(() => this.ordine.classList.add('is-dentro'), 100);
    this.vaiA(passo || 'carrello');
    this.ordine.querySelector('.ordine__chiudi').focus({ preventScroll: true });
  }

  chiudiOrdine() {
    if (this.ordine.hidden) return;
    this.ordine.classList.remove('is-dentro');
    this.ordine.hidden = true;
    if (this.vista.hidden) this.pannello.classList.remove('e-finestra');
    if (this.tastoCarrello) this.tastoCarrello.focus({ preventScroll: true });
  }

  vaiA(passo) {
    for (const s of this.ordine.querySelectorAll('.passo')) {
      s.hidden = s.dataset.passo !== passo;
    }
    for (const li of this.ordine.querySelectorAll('.ordine__passi li')) {
      li.classList.toggle('is-qui', li.dataset.p === passo);
    }
    this.ordine.querySelector('.ordine__corpo').scrollTop = 0;
    this.passo = passo;
  }

  disegnaRighe() {
    const cassa = this.ordine.querySelector('.carrello__righe');
    cassa.textContent = '';
    for (const r of this.righe) {
      const p = this.prodotto(r.slug);
      if (!p) continue;
      const riga = el('div', 'riga');

      const fig = el('div', 'riga__foto');
      const img = el('img');
      img.src = BASE + p.immagine;
      img.alt = '';
      img.loading = 'lazy';
      fig.appendChild(img);
      riga.appendChild(fig);

      const testa = el('div', 'riga__testa');
      testa.appendChild(el('p', 'riga__nome', p.nome));
      testa.appendChild(el('p', 'riga__unita', euro.format(p.prezzo) + ' l’uno'));
      riga.appendChild(testa);

      const q = el('div', 'quantita e-piccola');
      const meno = el('button', 'quantita__meno', '−');
      meno.type = 'button';
      meno.setAttribute('aria-label', 'Uno in meno di ' + p.nome);
      meno.addEventListener('click', () => this.cambiaQta(r.slug, r.qta - 1));
      const n = el('output', 'quantita__n', String(r.qta));
      const piu = el('button', 'quantita__piu', '+');
      piu.type = 'button';
      piu.setAttribute('aria-label', 'Uno in piu di ' + p.nome);
      piu.addEventListener('click', () => this.cambiaQta(r.slug, Math.min(20, r.qta + 1)));
      q.appendChild(meno); q.appendChild(n); q.appendChild(piu);
      riga.appendChild(q);

      riga.appendChild(el('p', 'riga__prezzo', euro.format(p.prezzo * r.qta)));

      const via = el('button', 'riga__via', '×');
      via.type = 'button';
      via.setAttribute('aria-label', 'Togli ' + p.nome);
      via.addEventListener('click', () => this.cambiaQta(r.slug, 0));
      riga.appendChild(via);

      cassa.appendChild(riga);
    }

    const vuoto = !this.righe.length;
    this.ordine.querySelector('.carrello__vuoto').hidden = !vuoto;
    this.ordine.querySelector('.carrello__totale').hidden = vuoto;
    this.ordine.querySelector('.carrello__avanti').disabled = vuoto;
    this.ordine.querySelector('.carrello__totale b').textContent = euro.format(this.totale);
  }

  /* ------------------------------------------------------------- invio */
  raccogli() {
    const f = this.ordine.querySelector('.modulo');
    const d = new FormData(f);
    const pulisci = (v) => String(v || '').trim();
    let ig = pulisci(d.get('instagram'));
    ig = ig.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '');
    if (ig && ig[0] !== '@') ig = '@' + ig;

    return {
      nome: pulisci(d.get('nome')),
      email: pulisci(d.get('email')),
      instagram: ig,
      telefono: pulisci(d.get('telefono')),
      citta: pulisci(d.get('citta')),
      note: pulisci(d.get('note')),
      consenso: d.get('consenso') === 'on'
    };
  }

  controlla(c) {
    if (!c.nome) return 'Manca il nome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return 'L’email non sembra giusta.';
    if (!c.instagram || c.instagram === '@') return 'Manca il contatto Instagram.';
    if (!c.consenso) return 'Serve la spunta per poterti rispondere.';
    if (!this.righe.length) return 'Il carrello e’ vuoto.';
    if (!this.consegna) return 'Scegli come vuoi averla.';
    return '';
  }

  testoOrdine(c) {
    const d = CONSEGNE[this.consegna];
    const r = ['NUOVO ORDINE — TARANTO FUTURA', ''];
    r.push('Consegna: ' + d.titolo);
    r.push('Quando: ' + new Date().toLocaleString('it-IT'));
    r.push('');
    r.push('PERSONA');
    r.push('Nome: ' + c.nome);
    r.push('Email: ' + c.email);
    r.push('Instagram: ' + c.instagram);
    if (c.telefono) r.push('Telefono: ' + c.telefono);
    if (c.citta) r.push('Citta: ' + c.citta);
    if (c.note) r.push('Note: ' + c.note);
    r.push('');
    r.push('ROBA');
    for (const x of this.righe) {
      const p = this.prodotto(x.slug);
      if (!p) continue;
      r.push('- ' + x.qta + ' × ' + p.nome + '  ' + euro.format(p.prezzo * x.qta));
    }
    r.push('');
    r.push('TOTALE: ' + euro.format(this.totale));
    return r.join('\n');
  }

  async manda() {
    if (this.inCorso) return;
    const err = this.ordine.querySelector('.modulo__errore');
    const c = this.raccogli();
    const male = this.controlla(c);
    if (male) {
      err.textContent = male;
      err.hidden = false;
      return;
    }
    err.hidden = true;

    const bottone = this.ordine.querySelector('.modulo [type="submit"]');
    this.inCorso = true;
    bottone.disabled = true;
    bottone.textContent = 'Mando…';

    const testo = this.testoOrdine(c);
    this.ultimoTesto = testo;
    let viaMail = true;

    if (ENDPOINT) {
      try {
        const r = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            _subject: 'Ordine dal sito — ' + c.nome,
            nome: c.nome, email: c.email, instagram: c.instagram,
            telefono: c.telefono, citta: c.citta, note: c.note,
            consegna: CONSEGNE[this.consegna].titolo,
            totale: this.totale,
            roba: this.righe.map((x) => {
              const p = this.prodotto(x.slug);
              return { nome: p ? p.nome : x.slug, qta: x.qta, prezzo: p ? p.prezzo : 0 };
            }),
            messaggio: testo
          })
        });
        if (r.ok) viaMail = false;
      } catch (e) { viaMail = true; }
    }

    this.inCorso = false;
    bottone.disabled = false;
    bottone.textContent = 'Manda l’ordine';
    this.concludi(viaMail, testo, c);
  }

  concludi(viaMail, testo, c) {
    const p = this.ordine.querySelector('.passo[data-passo="fatto"]');
    const dove = p.querySelector('.fatto__testo');
    const pre = p.querySelector('.fatto__copia');
    const copia = p.querySelector('[data-copia]');

    if (viaMail) {
      // si apre la mail dell'utente gia' scritta: deve solo premere invia
      const oggetto = encodeURIComponent('Ordine dal sito — ' + c.nome);
      const corpo = encodeURIComponent(testo);
      dove.textContent = 'Si sta aprendo la tua posta con l’ordine gia’ ' +
        'scritto: devi solo premere invia. Se non si apre, copia il testo qui ' +
        'sotto e mandacelo a ' + MAIL + ' o in DM su Instagram.';
      pre.textContent = testo;
      pre.hidden = false;
      copia.hidden = false;
      setTimeout(() => {
        window.location.href = 'mailto:' + MAIL + '?subject=' + oggetto + '&body=' + corpo;
      }, 400);
    } else {
      dove.textContent = 'Ci e’ arrivato tutto: la roba che hai scelto e i tuoi ' +
        'contatti. Ti scriviamo noi, su ' + (c.instagram || 'Instagram') +
        ' o via mail, per metterci d’accordo.';
      pre.hidden = true;
      copia.hidden = true;
      // andata: il carrello si svuota
      this.righe = [];
      scriviCarrello(this.righe);
      this.aggiornaCarrello();
      this.disegnaRighe();
    }
    this.vaiA('fatto');
    for (const li of this.ordine.querySelectorAll('.ordine__passi li')) {
      li.classList.remove('is-qui');
    }
  }

  async copiaTesto() {
    const t = this.ultimoTesto || '';
    try {
      await navigator.clipboard.writeText(t);
      this.avviso('Testo copiato');
    } catch (e) {
      // senza permesso per gli appunti: si seleziona, cosi' si copia a mano
      const pre = this.ordine.querySelector('.fatto__copia');
      const r = document.createRange();
      r.selectNodeContents(pre);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      this.avviso('Selezionato: premi copia');
    }
  }

  /* ==================================================================
     TASTIERA
     Esc chiude prima la finestra aperta qui dentro, e solo dopo il pannello:
     il listener del pannello sta sul bubble, questo in cattura.
     ================================================================== */
  scorciatoie() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.ordine.hidden) { e.stopPropagation(); e.preventDefault(); this.chiudiOrdine(); }
      else if (!this.vista.hidden) { e.stopPropagation(); e.preventDefault(); this.chiudiVista(); }
    }, true);
  }
}

export function mountNegozio(radice) {
  if (!radice) return null;
  const n = new Negozio(radice);
  n.monta();
  return n;
}
