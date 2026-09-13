/* ==========================================================================
   Taranto Futura — apertura 3D
   Ricostruisce il logo (sole + lettere) dai contorni vettoriali e lo monta
   in scena con una sequenza cinematica. Nessuna dipendenza esterna a runtime.
   ========================================================================== */

import * as THREE from '../../vendor/three.module.min.js';

/* Alza ASSET_VERSION ogni volta che cambiano i contorni del logo:
   evita che i browser continuino a servire la versione vecchia dalla cache. */
const ASSET_VERSION = '2';
const DATA_URL = new URL(
  '../../assets/data/logo-contours.json?v=' + ASSET_VERSION, import.meta.url);

/* Tempi della sequenza (secondi) ---------------------------------------- */
const T = {
  sunScale:      1.25,   // il sole si apre
  sunUnwind:     1.50,   // fine della rotazione d'ingresso
  letterStart:   0.50,   // prima lettera
  letterStagger: 0.055,  // ritardo tra una lettera e l'altra
  letterDur:     0.95,   // durata del volo di ogni lettera
  settle:        3.45    // la scena è a regime: stato "ready"
};

/* Inquadratura ----------------------------------------------------------- */
const FOV = 34;
const LOGO_RADIUS = 0.86;          // raggio del logo in unità mondo
const FIT = {
  portrait:  { x: 0.80, y: 0.46 }, // quota di semilarghezza / semialtezza
  landscape: { x: 0.44, y: 0.58 }
};

/* --------------------------------------------------------------------------
   Normali raccordate: via le scanalature.
   ExtrudeGeometry costruisce i fianchi e le smussature come facce piatte
   staccate l'una dall'altra: ogni faccia ha la sua normale, e la luce ci
   disegna sopra una striatura per ogni segmento del contorno. Qui le normali
   dei vertici che stanno nello stesso punto vengono mediate, ma solo fra
   facce che formano un angolo dolce: una curva diventa liscia, uno spigolo
   vero (il bordo fra faccia e fianco, l'incavo fra due raggi del sole)
   resta netto.
   -------------------------------------------------------------------------- */
function lisciaNormali(geo, gradiSpigolo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const n = pos.count;
  const soglia = Math.cos((gradiSpigolo === undefined ? 38 : gradiSpigolo) * Math.PI / 180);

  // normale della faccia a cui appartiene ogni vertice
  const facce = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), cb = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    cb.subVectors(c, b); ab.subVectors(a, b);
    cb.cross(ab).normalize();
    for (let k = 0; k < 3; k++) {
      facce[(i + k) * 3]     = cb.x;
      facce[(i + k) * 3 + 1] = cb.y;
      facce[(i + k) * 3 + 2] = cb.z;
    }
  }

  // i vertici sovrapposti, raggruppati per posizione arrotondata
  const gruppi = new Map();
  const q = 1e4;
  for (let i = 0; i < n; i++) {
    const chiave = Math.round(pos.getX(i) * q) + '|' +
                   Math.round(pos.getY(i) * q) + '|' +
                   Math.round(pos.getZ(i) * q);
    let g2 = gruppi.get(chiave);
    if (!g2) { g2 = []; gruppi.set(chiave, g2); }
    g2.push(i);
  }

  /* Le due facce piatte (davanti e dietro) restano piatte: se entrassero
     nella media si gonfierebbero come un cuscino, e il bordo netto fra faccia
     e smussatura — che e' quello che da' la forma alla lettera — sparirebbe.
     Si raccordano solo fianchi e smussature, che insieme formano una fascia
     continua tutt'intorno al contorno. */
  const piatta = (i) => Math.abs(facce[i * 3 + 2]) > 0.999;

  const out = new Float32Array(n * 3);
  for (const indici of gruppi.values()) {
    for (const i of indici) {
      if (piatta(i)) {
        out[i * 3] = facce[i * 3]; out[i * 3 + 1] = facce[i * 3 + 1];
        out[i * 3 + 2] = facce[i * 3 + 2];
        continue;
      }
      const nx = facce[i * 3], ny = facce[i * 3 + 1], nz = facce[i * 3 + 2];
      let sx = 0, sy = 0, sz = 0;
      for (const j of indici) {
        if (piatta(j)) continue;
        const mx = facce[j * 3], my = facce[j * 3 + 1], mz = facce[j * 3 + 2];
        // solo le facce quasi complanari: oltre la soglia c'e' uno spigolo vero
        if (nx * mx + ny * my + nz * mz >= soglia) { sx += mx; sy += my; sz += mz; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
    }
  }

  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeBack = (p) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

/* ==========================================================================
   Classe principale
   ========================================================================== */
export class Intro {
  constructor(root) {
    this.root = root;
    this.stage = root.querySelector('.intro__stage');
    this.state = 'loading';
    // ?still=1 apre direttamente a scena montata (anteprime, screenshot, test)
    const still = new URLSearchParams(location.search).has('still');
    this.reduced = still ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.dead = false;
    this.dirty = true;
    this.listeners = [];
  }

  setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.root.setAttribute('data-state', next);
    this.root.dispatchEvent(new CustomEvent('intro:state', { detail: next }));
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.listeners.push([target, type, fn, opts]);
  }

  /* ---------------------------------------------------------------- avvio */
  async start() {
    let data;
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (err) {
      console.error('[intro] contorni del logo non caricati', err);
      this.setState('fallback');
      return;
    }
    if (this.dead) return;
    this.data = data;

    if (!supportsWebGL()) {
      this.drawFlat();
      this.setState('fallback');
      return;
    }

    try {
      this.build();
    } catch (err) {
      console.error('[intro] WebGL non disponibile', err);
      this.teardownGL();
      this.drawFlat();
      this.setState('fallback');
      return;
    }

    this.bindInput();

    // primo fotogramma prima di rivelare la scena: niente sfarfallii
    this.clock = 0;
    this.renderer.render(this.scene, this.camera);

    if (this.reduced) {
      this.clock = T.settle;
      this.frame(T.settle, 0);
      this.renderer.render(this.scene, this.camera);
      this.setState('ready');
    } else {
      this.setState('playing');
    }

    this.last = performance.now() / 1000;
    this.renderer.setAnimationLoop(() => this.tick());
    this.watchVisibility();
  }

  /* Scorrendo oltre l'apertura il 3D non serve piu': fermarlo risparmia
     batteria sul telefono invece di far girare la scheda video a vuoto. */
  watchVisibility() {
    if (!('IntersectionObserver' in window)) return;
    this.vis = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (this.dead || !this.renderer) return;
        if (e.isIntersecting) {
          this.last = performance.now() / 1000;   // niente salto temporale
          this.dirty = true;
          this.renderer.setAnimationLoop(() => this.tick());
        } else {
          this.renderer.setAnimationLoop(null);
        }
      }
    }, { threshold: 0 });
    this.vis.observe(this.root);
  }

  /* ------------------------------------------------------------- costruzione */
  build() {
    const host = this.stage;
    const small = Math.min(window.innerWidth, window.innerHeight) < 820;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new THREE.WebGLRenderer({
      antialias: dpr < 2,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.environment = this.envTexture();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    this.camera = camera;

    scene.add(new THREE.AmbientLight(0xc3c5d0, 0.22));

    /* Luce principale radente, non frontale: con la luce davanti il riflesso
       cade proprio sulle facce piatte e le sbianca. Cosi' resta sulle smussature. */
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(3.2, 2.8, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    key.shadow.camera.left = -2.6; key.shadow.camera.right = 2.6;
    key.shadow.camera.top = 2.6;   key.shadow.camera.bottom = -2.6;
    key.shadow.camera.near = 0.5;  key.shadow.camera.far = 14;
    key.shadow.bias = -0.0012;
    key.shadow.radius = 3;

    const fill = new THREE.DirectionalLight(0xe4e6ee, 0.55);
    fill.position.set(-3.2, -1.4, 2.2);

    // controluce: stacca le lettere bianche dal grigio del fondo
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(-1.2, 1.8, -3.4);

    scene.add(key, fill, rim);

    /* Satinato, ma senza velo.
       envMapIntensity alto spalma sul blu un riflesso bianco UNIFORME che lo
       schiarisce (0.55 bastava a portare #232e66 a #333b6c). Tenuto basso, la
       lucentezza resta solo dove serve: i riflessi localizzati delle luci sulle
       smussature. metalness 0 perche' il metallo riflette l'ambiente ovunque. */
    /* Taratura del blu, misurata sul pixel renderizzato.
       I riflessi che si vedono vengono dalle luci direzionali; clearcoat ed
       envMapIntensity invece spalmano un bianco UNIFORME su tutta la faccia che
       desatura il blu (a 0.12/0.12 portava #232e66 a #363c66). Tenuti bassi si
       ha la lucentezza senza perdere il colore del marchio.
       Per piu' lucido alzare specularIntensity, NON clearcoat/envMapIntensity. */
    this.matSun = new THREE.MeshPhysicalMaterial({
      color: 0x232e6c, metalness: 0, roughness: 0.18,
      specularIntensity: 0.2, clearcoat: 0.05, clearcoatRoughness: 0.22,
      envMapIntensity: 0.05, side: THREE.FrontSide
    });
    this.matTxt = new THREE.MeshPhysicalMaterial({
      color: 0xf4f5f8, metalness: 0, roughness: 0.24,
      specularIntensity: 0.45, clearcoat: 0.1, clearcoatRoughness: 0.26,
      envMapIntensity: 0.12
    });

    const root3 = new THREE.Group();
    const logo = new THREE.Group();
    root3.add(logo);
    scene.add(root3);
    this.root3 = root3;
    this.logo = logo;

    /* il sole */
    const sunGroup = new THREE.Group();
    for (const sh of this.data.sun) {
      const geo = lisciaNormali(new THREE.ExtrudeGeometry(this.shapeOf(sh), {
        depth: 0.26, bevelEnabled: true, bevelThickness: 0.055,
        bevelSize: 0.03, bevelSegments: small ? 5 : 7, curveSegments: 1
      }), 62);
      geo.translate(0, 0, -0.13);
      const mesh = new THREE.Mesh(geo, this.matSun);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sunGroup.add(mesh);
    }
    logo.add(sunGroup);
    this.sunGroup = sunGroup;

    /* le lettere */
    const letters = [];
    for (const sh of this.data.text) {
      const geo = lisciaNormali(new THREE.ExtrudeGeometry(this.shapeOf(sh), {
        depth: 0.15, bevelEnabled: true, bevelThickness: 0.026,
        bevelSize: 0.015, bevelSegments: small ? 4 : 6, curveSegments: 1
      }), 62);
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const cx = (bb.min.x + bb.max.x) / 2;
      const cy = (bb.min.y + bb.max.y) / 2;
      geo.translate(-cx, -cy, 0);   // pivot al centro della lettera
      const mesh = new THREE.Mesh(geo, this.matTxt);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.base = new THREE.Vector3(cx, cy, 0.3);
      mesh.position.copy(mesh.userData.base);
      letters.push(mesh);
      logo.add(mesh);
    }
    // ordine di lettura: riga alta da sinistra, poi riga bassa
    letters.sort((a, b) =>
      (b.userData.base.y - a.userData.base.y) ||
      (a.userData.base.x - b.userData.base.x));
    letters.forEach((m, i) => {
      m.userData.i = i;
      m.userData.seed = Math.random() * Math.PI * 2;
      m.userData.off = new THREE.Vector3();
      m.userData.vel = new THREE.Vector3();
      m.userData.rot = new THREE.Vector3();
      m.userData.rotVel = new THREE.Vector3();
    });
    this.letters = letters;

    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this.drag = { on: false, moved: 0, x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0 };
    this.spinKick = 0;
    this.sunSpin = 0;

    this.resize = () => this.layout();
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.layout();
  }

  shapeOf(sh) {
    const ring = (pts, target) => {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (i) target.lineTo(p[0], p[1]);
        else target.moveTo(p[0], p[1]);
      }
      target.closePath();
    };
    const s = new THREE.Shape();
    ring(sh.outer, s);
    s.holes = (sh.holes || []).map((h) => {
      const p = new THREE.Path();
      ring(h, p);
      return p;
    });
    return s;
  }

  /* ambiente riflesso: studio chiaro, coerente con il fondo grigio */
  envTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#f4f5f8');   // soffitto illuminato
    g.addColorStop(0.34, '#cdced4');
    g.addColorStop(0.47, '#ffffff'); // striscia luce
    g.addColorStop(0.58, '#8c8d93');
    g.addColorStop(1, '#3c3d47');    // pavimento
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);
    const blob = (cx, cy, r, col) => {
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    };
    blob(230, 110, 160, 'rgba(255,255,255,0.95)');
    blob(720, 80, 120, 'rgba(255,255,255,0.8)');
    blob(520, 400, 210, 'rgba(30,32,60,0.55)');   // massa scura sotto: dà stacco
    blob(60, 320, 150, 'rgba(255,255,255,0.4)');
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ----------------------------------------------------------- inquadratura */
  layout() {
    const host = this.stage;
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    if (!w || !h) return;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);

    const aspect = w / h;
    const k = clamp((aspect - 0.55) / (1.45 - 0.55), 0, 1);
    const fillX = lerp(FIT.portrait.x, FIT.landscape.x, k);
    const fillY = lerp(FIT.portrait.y, FIT.landscape.y, k);

    const cam = this.camera;
    cam.aspect = aspect;
    const tanY = Math.tan((FOV * Math.PI) / 360);
    const tanX = tanY * aspect;
    cam.position.set(0, 0, Math.max(
      LOGO_RADIUS / (fillX * tanX),
      LOGO_RADIUS / (fillY * tanY)
    ));
    cam.updateProjectionMatrix();
    this.dirty = true;
  }

  /* ------------------------------------------------------------- interazione */
  bindInput() {
    const root = this.root;

    this.on(root, 'pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      // sui link, sui bottoni e sulla scritta della sorpresa non si trascina e
      // non si fa scattare il rimbalzo delle lettere: la cattura del puntatore
      // ruberebbe loro il clic, che e' proprio quello che serve a loro
      if (e.target.closest && e.target.closest('a, button, [data-sorpresa]')) return;
      this.drag.on = true;
      this.drag.moved = 0;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      root.setAttribute('data-grab', '1');
      if (root.setPointerCapture && e.pointerId !== undefined) {
        try { root.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    this.on(window, 'pointermove', (e) => this.pointerMove(e), { passive: true });

    this.on(window, 'pointerup', () => {
      if (!this.drag.on) return;
      const tap = this.drag.moved < 8;
      this.drag.on = false;
      root.removeAttribute('data-grab');
      if (!tap) return;
      if (this.state === 'playing') this.skip();
      else this.burst();
    });

    // scorrendo col dito il browser si prende il gesto: il trascinamento va chiuso
    this.on(window, 'pointercancel', () => {
      this.drag.on = false;
      root.removeAttribute('data-grab');
    });

    this.on(window, 'keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        if (this.state === 'playing') { e.preventDefault(); this.skip(); }
      }
    });

    this.on(window, 'resize', () => this.layout());
    this.on(window, 'orientationchange', () => setTimeout(() => this.layout(), 120));
  }

  pointerMove(e) {
    const host = this.stage;
    if (!host) return;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.tilt.tx = ((e.clientY - r.top) / r.height - 0.5) * -0.42;
    this.tilt.ty = ((e.clientX - r.left) / r.width - 0.5) * 0.78;
    if (this.drag.on) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.drag.vy += dx * 0.006;
      this.drag.vx += dy * 0.005;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    }
    this.dirty = true;
  }

  /* salta all'inquadratura finale */
  skip() {
    if (this.state !== 'playing') return;
    this.clock = T.settle;
    this.setState('ready');
    this.dirty = true;
  }

  /* piccolo scatto delle lettere al tocco */
  burst() {
    if (!this.letters || this.reduced) return;
    for (const m of this.letters) {
      const b = m.userData.base;
      const dir = new THREE.Vector3(b.x, b.y, 0.6).normalize();
      const k = 1.4 + Math.random() * 1.2;
      m.userData.vel.addScaledVector(dir, k);
      m.userData.rotVel.set(
        (Math.random() - 0.5) * 6.5,
        (Math.random() - 0.5) * 6.5,
        (Math.random() - 0.5) * 4.5
      );
    }
    this.spinKick += 4.6;
    this.dirty = true;
  }

  /* ------------------------------------------------------------------ loop */
  tick() {
    if (this.dead) return;
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0, now - this.last));
    this.last = now;

    if (this.reduced) {
      // movimento ridotto: si ridisegna solo quando serve
      if (!this.dirty) return;
      this.dirty = false;
      this.frame(T.settle, dt, true);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.clock += dt;
    if (this.state === 'playing' && this.clock >= T.settle) this.setState('ready');
    this.frame(this.clock, dt, false);
    this.renderer.render(this.scene, this.camera);
  }

  frame(t, dt, still) {
    const intro = easeOut(clamp(t / T.sunUnwind, 0, 1));

    /* --- scala d'ingresso del logo --- */
    const sp = clamp(t / T.sunScale, 0, 1);
    this.logo.scale.setScalar(0.18 + 0.82 * easeBack(sp));

    /* --- il sole --- */
    this.spinKick *= Math.pow(0.12, dt);
    const idle = still ? 0 : 0.1;
    this.sunSpin += (idle + this.spinKick) * dt;
    this.sunGroup.rotation.z = this.sunSpin - Math.PI * 2.6 * (1 - intro);
    this.sunGroup.rotation.x = still ? 0 : Math.sin(t * 0.31) * 0.07 * intro;
    this.sunGroup.rotation.y = still ? 0 : Math.cos(t * 0.24) * 0.09 * intro;
    this.sunGroup.position.z = still ? -0.12 : -0.12 + Math.sin(t * 0.5) * 0.03;

    /* --- le lettere --- */
    for (const m of this.letters) {
      const u = m.userData;
      const lp = clamp((t - T.letterStart - u.i * T.letterStagger) / T.letterDur, 0, 1);
      const e = easeBack(lp);
      const float = still ? 0 : Math.sin(t * 0.9 + u.seed) * 0.035;

      // molla per il rimbalzo al tocco
      u.vel.addScaledVector(u.off, -42 * dt);
      u.vel.multiplyScalar(Math.max(0, 1 - 7.4 * dt));
      u.off.addScaledVector(u.vel, dt);
      u.rotVel.addScaledVector(u.rot, -30 * dt);
      u.rotVel.multiplyScalar(Math.max(0, 1 - 6 * dt));
      u.rot.addScaledVector(u.rotVel, dt);

      const bx = u.base.x, by = u.base.y, bz = u.base.z + float;
      m.position.set(
        bx * e + bx * 1.25 * (1 - e) + u.off.x,
        by * e + (by - 1.6) * (1 - e) + u.off.y,
        bz * e + 2.4 * (1 - e) + u.off.z
      );
      m.rotation.set(
        u.rot.x + (1 - e) * 0.9,
        u.rot.y + (1 - e) * -1.2,
        u.rot.z + (1 - e) * 0.5 + (still ? 0 : Math.sin(t * 0.7 + u.seed) * 0.012)
      );
      m.scale.setScalar(0.55 + 0.45 * e);
    }

    /* --- parallasse e inerzia --- */
    this.drag.ry += this.drag.vy;
    this.drag.rx += this.drag.vx;
    this.drag.vy *= Math.pow(0.06, dt);
    this.drag.vx *= Math.pow(0.06, dt);
    this.drag.ry *= Math.pow(0.82, dt);
    this.drag.rx *= Math.pow(0.82, dt);
    this.drag.rx = clamp(this.drag.rx, -0.9, 0.9);

    this.tilt.x += (this.tilt.tx - this.tilt.x) * Math.min(1, dt * 3.2);
    this.tilt.y += (this.tilt.ty - this.tilt.y) * Math.min(1, dt * 3.2);

    const wobbleX = still ? 0 : Math.sin(t * 0.37) * 0.03;
    const wobbleY = still ? 0 : Math.sin(t * 0.29) * 0.05;
    this.root3.rotation.x = this.tilt.x + this.drag.rx + (1 - intro) * 0.18 + wobbleX;
    this.root3.rotation.y = this.tilt.y + this.drag.ry + wobbleY;
    this.root3.position.y = still ? 0 : Math.sin(t * 0.6) * 0.05;

    this.renderer.toneMappingExposure = 1 + (1 - intro) * 0.2;

    // finché lettere o inerzia si muovono, continua a disegnare
    if (still) {
      const moving = Math.abs(this.drag.vx) + Math.abs(this.drag.vy) +
        Math.abs(this.tilt.tx - this.tilt.x) + Math.abs(this.tilt.ty - this.tilt.y);
      if (moving > 0.0004) this.dirty = true;
    }
  }

  /* ------------------------------------------------- ripiego senza WebGL */
  drawFlat() {
    const host = this.stage;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    host.appendChild(canvas);
    this.flatCanvas = canvas;

    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const x = canvas.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);

      const side = Math.min(w * 0.8, h * 0.52);
      const s = side / (LOGO_RADIUS * 2);
      x.translate(w / 2, h * 0.47);
      x.scale(s, -s);   // asse y verso l'alto, come nei dati

      const trace = (sh) => {
        x.beginPath();
        const ring = (pts) => {
          pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
          x.closePath();
        };
        ring(sh.outer);
        (sh.holes || []).forEach(ring);
      };

      x.fillStyle = this.data.colors ? this.data.colors.sun : '#232e66';
      this.data.sun.forEach((sh) => { trace(sh); x.fill('evenodd'); });

      x.fillStyle = this.data.colors ? this.data.colors.text : '#ffffff';
      this.data.text.forEach((sh) => { trace(sh); x.fill('evenodd'); });
    };

    paint();
    this.flatRO = new ResizeObserver(paint);
    this.flatRO.observe(host);
  }

  /* ------------------------------------------------------------- pulizia */
  teardownGL() {
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  destroy() {
    this.dead = true;
    if (this.ro) this.ro.disconnect();
    if (this.vis) this.vis.disconnect();
    if (this.flatRO) this.flatRO.disconnect();
    this.listeners.forEach(([t, ty, fn, o]) => t.removeEventListener(ty, fn, o));
    this.listeners = [];
    if (this.scene) {
      this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      if (this.matSun) this.matSun.dispose();
      if (this.matTxt) this.matTxt.dispose();
      if (this.scene.environment) this.scene.environment.dispose();
    }
    this.teardownGL();
  }
}

export function mountIntro(root) {
  const intro = new Intro(root);
  intro.start();
  return intro;
}
