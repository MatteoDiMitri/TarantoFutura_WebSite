/* ==========================================================================
   Taranto Futura — avvio
   ========================================================================== */

import { mountIntro } from './intro.js';
import { mountPannelli } from './pannelli.js';
import { Visore } from './visore.js';
import { mountLocandine } from './locandine.js';
import { mountFanzine } from './fanzine.js';
import { mountStudio } from './studio.js';
import { Storia } from './storia.js';
import { mountNegozio } from './negozio.js';
import { mountFascia } from './fascia.js';
import { mountContatori } from './contatore.js';
import { mountSorpresa } from './sorpresa.js';
import { mountComparse } from './comparse.js';
import { mountTrio } from './trio.js';

const html = document.documentElement;
const introRoot = document.querySelector('.intro');

if (introRoot) {
  // Chi arriva da un link diretto a una sezione (es. /#chi-siamo) vuole quella
  // sezione, non l'apertura: in quel caso non si blocca niente e lo si porta li'.
  const deepLink = location.hash && document.querySelector(location.hash);

  // Altrimenti lo scorrimento resta fermo durante l'apertura. La classe la
  // mettiamo da qui e non nel CSS: se questo script non parte, la pagina scorre.
  if (!deepLink) html.classList.add('is-intro-playing');

  const unlock = () => {
    html.classList.remove('is-intro-playing');
    html.classList.add('is-intro-done');
  };

  if (deepLink) {
    unlock();
    // Il salto del browser puo' essere stato annullato dal blocco: lo rifacciamo.
    // Niente requestAnimationFrame: in una scheda aperta in secondo piano non
    // scatta, e l'utente troverebbe la pagina in cima invece che sulla sezione.
    // il browser ripristina da solo la posizione precedente e annullerebbe
    // il nostro salto: qui la posizione la decidiamo noi
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const goThere = () => deepLink.scrollIntoView({ behavior: 'auto' });
    goThere();
    window.addEventListener('load', goThere, { once: true });
  }

  // Un collegamento interno cliccato mentre l'apertura e' ancora in corso
  // troverebbe lo scorrimento bloccato: lo sblocchiamo prima di seguirlo.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && !a.dataset.pannello) unlock();
  }, true);

  introRoot.addEventListener('intro:state', (e) => {
    if (e.detail === 'ready' || e.detail === 'fallback') unlock();
  });

  // rete di sicurezza: qualunque cosa vada storta, dopo 8s si scorre
  setTimeout(unlock, 8000);

  window.tfIntro = mountIntro(introRoot);
}

window.tfPannelli = mountPannelli();

const elVisore = document.getElementById('visore');
const visore = elVisore ? new Visore(elVisore) : null;
window.tfVisore = visore;

const locandine = document.querySelector('.locandine');
if (locandine) window.tfLocandine = mountLocandine(locandine, visore);

const numeri = document.querySelector('.numeri');
if (numeri) window.tfFanzine = mountFanzine(numeri, visore);

const elStoria = document.getElementById('storia');
const storia = elStoria ? new Storia(elStoria) : null;
window.tfStoria = storia;

const studio = document.querySelector('[data-studio]');
if (studio) window.tfStudio = mountStudio(studio, visore, storia);

const negozio = document.querySelector('[data-negozio]');
if (negozio) window.tfNegozio = mountNegozio(negozio);

window.tfFascia = mountFascia(document.querySelector('.fascia'));

window.tfContatori = mountContatori();

window.tfSorpresa = mountSorpresa();

/* Le due cose che riguardano il percorso principale e non una sua sezione:
   le voci che entrano scorrendo e la mano sulle colonne. Vanno per ultime:
   nessuna delle due serve a far funzionare qualcosa, e se una fallisse il
   resto della pagina e' gia' in piedi. */
window.tfComparse = mountComparse();

window.tfTrio = mountTrio(document.querySelector('.trio'));
