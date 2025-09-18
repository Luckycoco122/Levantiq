'use strict';

(function () {
  const qs  = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // ===== Navbar & overlay
  const header   = qs('[data-header]');
  const navbar   = qs('[data-navbar]');
  const overlay  = qs('[data-overlay]');
  const openBtn  = qs('[data-nav-open-btn]');
  const closeBtn = qs('[data-nav-close-btn]');
  const goTopBtn = qs('[data-go-top]');

  const openNavbar  = () => { if (!navbar || !overlay) return; navbar.classList.add('active'); overlay.classList.add('active'); };
  const closeNavbar = () => { if (!navbar || !overlay) return; navbar.classList.remove('active'); overlay.classList.remove('active'); };

  openBtn?.addEventListener('click', openNavbar);
  closeBtn?.addEventListener('click', closeNavbar);
  overlay?.addEventListener('click', closeNavbar);
  qsa('[data-navbar-link]').forEach(a => a.addEventListener('click', closeNavbar));

  // ===== Header sticky + botón "go top"
  window.addEventListener('scroll', () => {
    const active = window.scrollY >= 400;
    header?.classList.toggle('active', active);
    goTopBtn?.classList.toggle('active', active);
  });

  // ===== Cerrar navbar con ESC
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNavbar(); });

  // ===== Scroll suave con compensación del header fijo (para enlaces a #ancla)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (!hash || hash === '#') return;

    const target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();
    const headerH = header ? header.offsetHeight : 0;
    const extra = 16; // margen visual
    const y = target.getBoundingClientRect().top + window.pageYOffset - headerH - extra;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });

  // ===== CONTACTO: validación y envío AJAX (se ejecuta solo si hay formulario)
  const form    = qs('#contact-form');
  const rgpd    = qs('#rgpd');
  const sendBtn = qs('#sendBtn');
  const fb      = qs('#contact-feedback');

  // --- NUEVO: detectar ?service= de la URL y pre-rellenar campos ---
  const serviceFromQuery = new URLSearchParams(location.search).get('service') || '';
  const serviceField = qs('#serviceField'); // hidden opcional
  const messageEl = qs('#message');

  if (serviceField && !serviceField.value) serviceField.value = serviceFromQuery;

  // Prefijo suave en el mensaje si hay service en la URL y el textarea está vacío
  if (serviceFromQuery && messageEl && !messageEl.value.trim()) {
    messageEl.value = `[Interés: ${serviceFromQuery}] `;
  }

  // habilitar/deshabilitar botón por RGPD
  const toggleBtn = () => { if (sendBtn && rgpd) sendBtn.disabled = !rgpd.checked; };
  rgpd?.addEventListener('change', toggleBtn); toggleBtn();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // mostrar ayudas solo tras intentar enviar
    form.classList.add('was-validated');

    if (fb) { fb.style.display = 'none'; fb.className = ''; }

    // validación nativa HTML5
    if (!form.checkValidity()) {
      if (fb) {
        fb.textContent = 'Revisa los campos marcados en rojo.';
        fb.classList.add('error'); fb.style.display = 'block';
      }
      return;
    }

    const data = new FormData(form);
    if (data.get('_hp')) return; // honeypot

    const endpoint = data.get('_endpoint');

    // servicio: prioriza el hidden 'service' si existe; si no, usa la query
    const serviceValue =
      (data.get('service') && data.get('service').toString().trim()) ||
      serviceFromQuery;

    const payload = {
      name:    (data.get('name')    || '').toString().trim(),
      email:   (data.get('email')   || '').toString().trim(),
      phone:   (data.get('phone')   || '').toString().trim(),
      company: (data.get('company') || '').toString().trim(),
      message: (data.get('message') || '').toString().trim(),
      service: serviceValue || '',  // <-- NUEVO en payload
      source:  'levantiq-contacto'  // etiqueta fuente de este formulario
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw 0;

      if (fb) {
        fb.textContent = '¡Gracias! Hemos recibido tu mensaje.';
        fb.classList.add('success'); fb.style.display = 'block';
      }
      form.reset(); toggleBtn();

      // si añadiste autofill del mensaje, vuelve a dejar el prefijo si hay ?service
      if (serviceFromQuery && messageEl) {
        messageEl.value = `[Interés: ${serviceFromQuery}] `;
      }
      if (serviceField) serviceField.value = serviceFromQuery;

      // Evento opcional a GA4 si existe gtag()
      if (typeof gtag === 'function') {
        gtag('event', 'lead_submit', { form: form.id || 'contacto', service: serviceValue || '(none)' });
      }
    } catch {
      if (fb) {
        fb.textContent = 'Hubo un problema al enviar. Inténtalo de nuevo.';
        fb.classList.add('error'); fb.style.display = 'block';
      }
    }
  });

})();

/* --- Dropdown Servicios --- */
(function () {
  const toggles = document.querySelectorAll('.navbar .dropdown-toggle');

  function closeAll() {
    document.querySelectorAll('.navbar .has-dropdown.open')
      .forEach(li => li.classList.remove('open'));
  }

  toggles.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const li = btn.closest('.has-dropdown');
      const isOpen = li.classList.contains('open');
      closeAll();
      if (!isOpen) li.classList.add('open');
    });
  });

  // Cierra al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar .has-dropdown')) closeAll();
  });

  // Cierra al navegar a un enlace del dropdown
  document.querySelectorAll('.navbar .dropdown .dropdown-link')
    .forEach(a => a.addEventListener('click', () => closeAll()));
})();

/* ===== Carrusel IA: auto-scroll infinito (solo pausa con flechas) ===== */
(function () {
  const root = document.querySelector('#ia-carousel');
  if (!root) return;

  const track   = root.querySelector('.carousel-track');
  const originals = [...root.querySelectorAll('.carousel-slide')]; // set original
  const prevBtn = root.querySelector('.carousel-btn.prev');
  const nextBtn = root.querySelector('.carousel-btn.next');

  // Asegura que el scroll programático no sea "suave"
  track.style.scrollBehavior = 'auto';
  track.style.webkitOverflowScrolling = 'auto';
  track.style.overflowX = 'scroll';

  // --- Clonado para bucle infinito ---
  function cloneUntilWideEnough() {
    if (track.dataset.cloned === '1') return;
    const visible = track.clientWidth || root.clientWidth || 0;

    let currentWidth = track.scrollWidth;
    // Clona el set original hasta tener ~2x el ancho visible
    while (currentWidth < visible * 2 + 200) {
      originals.forEach(s => {
        const c = s.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        track.appendChild(c);
      });
      currentWidth = track.scrollWidth;
    }
    track.dataset.cloned = '1';
  }

  // --- Motor de scroll continuo ---
  let speed = 1.0;    // px/frame  (sube temporalmente si quieres ver el movimiento más claro)
  let rafId = null;
  let paused = false;
  let loopWidth = 0;

  function computeLoopWidth() {
    // ancho del set ORIGINAL (sin clones) + gaps
    let w = 0;
    originals.forEach(sl => { w += sl.getBoundingClientRect().width; });
    const GAP = 24; // tu gap del CSS
    w += GAP * Math.max(0, originals.length - 1);
    loopWidth = Math.max(0, Math.round(w));
  }

  function tick() {
    if (!paused && loopWidth > 0) {
      track.scrollLeft += speed;
      // envolver cuando pasamos del set original
      if (track.scrollLeft >= loopWidth) {
        track.scrollLeft -= loopWidth;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() { if (!rafId) rafId = requestAnimationFrame(tick); }
  function stop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  // --- Solo pausa con flechas (reanuda a los 4s) ---
  const RESUME_DELAY = 4000;
  let resumeTimer = null;
  function pause() {
    paused = true;
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  }
  function resumeAfter(delay = RESUME_DELAY) {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { paused = false; resumeTimer = null; }, delay);
  }
  function pauseFor(delay = RESUME_DELAY) { pause(); resumeAfter(delay); }

  function jump(delta) {
    pauseFor(); // se detiene y reanudará a los 4s
    track.scrollLeft += delta;
    if (track.scrollLeft >= loopWidth) track.scrollLeft -= loopWidth;
    if (track.scrollLeft < 0)         track.scrollLeft += loopWidth;
  }

  prevBtn?.addEventListener('click', () => jump(-track.clientWidth * 0.9));
  nextBtn?.addEventListener('click', () => jump( track.clientWidth * 0.9));

  // Nada de pausas por hover/scroll/focus: se queda moviéndose siempre.

  // Recalcular en resize
  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      stop();
      track.scrollLeft = 0;
      computeLoopWidth();
      start();
    }, 150);
  }, { passive: true });

  // Init robusto: espera a layout completo
  function init() {
    cloneUntilWideEnough();
    computeLoopWidth();
    if (!loopWidth || loopWidth < 10) {
      // reintenta por si imágenes/fonts aún no midieron
      requestAnimationFrame(() => {
        computeLoopWidth();
        start();
      });
    } else {
      start();
    }
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();





/* ===== Contadores "Qué cambia con IA" ===== */
(function () {
  const counters = document.querySelectorAll('.counter');
  if (!counters.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateCounter(el, to, { prefix = '', suffix = '', duration = 1200 } = {}) {
    if (reduceMotion) {
      el.textContent = `${prefix}${to}${suffix}`;
      return;
    }

    const start = 0;
    const startTime = performance.now();

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const current = Math.round(start + (to - start) * eased);
      el.textContent = `${prefix}${current}${suffix}`;
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Observa cuando la sección entra en viewport
  const section = document.querySelector('#about-ia') || document;
  const once = { triggered: false };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !once.triggered) {
        once.triggered = true;
        counters.forEach(el => {
          const to = parseInt(el.getAttribute('data-target'), 10) || 0;
          const prefix = el.getAttribute('data-prefix') || '';
          const suffix = el.getAttribute('data-suffix') || '';
          animateCounter(el, to, { prefix, suffix, duration: 1300 });
        });
        io.disconnect();
      }
    });
  }, { root: null, threshold: 0.35 });

  io.observe(section);
})();
