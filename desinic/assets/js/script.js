'use strict';

/* =========================
   Utilidades y navegación
   ========================= */
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

  // ===== CONTACTO: validación y envío AJAX (si hay formulario)
  const form    = qs('#contact-form');
  const rgpd    = qs('#rgpd');
  const sendBtn = qs('#sendBtn');
  const fb      = qs('#contact-feedback');

  // --- Detectar ?service= de la URL y pre-rellenar campos ---
  const serviceFromQuery = new URLSearchParams(location.search).get('service') || '';
  const serviceField = qs('#serviceField'); // hidden opcional
  const messageEl = qs('#message');

  if (serviceField && !serviceField.value) serviceField.value = serviceFromQuery;

  // Prefijo en el mensaje si hay service en la URL y el textarea está vacío
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
      service: serviceValue || '',
      source:  'levantiq-contacto'
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

      // repón prefijo si hay ?service
      if (serviceFromQuery && messageEl) {
        messageEl.value = `[Interés: ${serviceFromQuery}] `;
      }
      if (serviceField) serviceField.value = serviceFromQuery;

      // Evento opcional a GA4
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

/* =========================
   Dropdown Servicios
   ========================= */
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

/* ===== Carruseles: auto-scroll infinito + flechas + centrado + Vista GRID ===== */
(function () {
  const roots = document.querySelectorAll('.carousel');
  if (!roots.length) return;

  roots.forEach((root) => {
    const track     = root.querySelector('.carousel-track');
    const originals = Array.from(root.querySelectorAll('.carousel-slide'));
    const prevBtn   = root.querySelector('.carousel-btn.prev');
    const nextBtn   = root.querySelector('.carousel-btn.next');
    if (!track || originals.length === 0) return;

    // ====== Botón toggle (si existe en la sección) ======
    // Busca el botón más cercano dentro del mismo container
    const container = root.closest('.container');
    const toggleBtn = container ? container.querySelector('[data-view-toggle]') : null;

    // Ajustes base
    track.style.scrollBehavior = 'auto';
    track.style.webkitOverflowScrolling = 'auto';
    track.style.overflowX = 'scroll';

    const GAP = parseFloat(getComputedStyle(track).gap || '24') || 24;

    // ---------- Clonado (cinta) ----------
    function cloneUntilWideEnough() {
      if (track.dataset.cloned === '1') return;
      const visible = track.clientWidth || root.clientWidth || 0;
      let currentWidth = track.scrollWidth;
      while (currentWidth < visible * 3 + 400) {
        originals.forEach(slide => {
          const c = slide.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          track.appendChild(c);
        });
        currentWidth = track.scrollWidth;
      }
      track.dataset.cloned = '1';
    }

    // ---------- Periodo real ----------
    let period = 0;
    function measurePeriod() {
      const first = originals[0];
      const slides = Array.from(track.querySelectorAll('.carousel-slide'));
      let firstClone = null;
      for (let i = 1; i < slides.length; i++) {
        if (slides[i].getAttribute('aria-hidden') === 'true') { firstClone = slides[i]; break; }
      }
      if (first && firstClone) period = Math.max(0, firstClone.offsetLeft - first.offsetLeft);

      if (!period) {
        period = originals.reduce((acc, sl, i) => {
          const w = sl.getBoundingClientRect().width;
          return acc + w + (i < originals.length - 1 ? GAP : 0);
        }, 0);
      }
    }

    // ---------- Utilidades ----------
    const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const clampToMax = x => Math.min(Math.max(0, x), maxScroll());
    function wrapByPeriod(x) {
      const stride = Math.max(1, Math.min(period || 1, Math.max(1, maxScroll())));
      let v = ((x % stride) + stride) % stride;
      return clampToMax(v);
    }

    // ---------- Auto-scroll ----------
    let speed  = 1.0;
    let rafId  = null;
    let paused = false;

    function tick() {
      // En modo GRID, no autodesplazamos
      if (!paused && period > 0 && !root.classList.contains('is-grid')) {
        const next = track.scrollLeft + speed;
        track.scrollLeft = wrapByPeriod(next);
      }
      rafId = requestAnimationFrame(tick);
    }
    function start() { if (!rafId) rafId = requestAnimationFrame(tick); }
    function stop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

    // ---------- Centrado por flechas ----------
    const RESUME_DELAY = 4000;
    let resumeTimer = null;
    function pause() { paused = true; if (resumeTimer) clearTimeout(resumeTimer); }
    function resumeAfter(d = RESUME_DELAY) {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { paused = false; resumeTimer = null; }, d);
    }

    function centerTo(targetCenter) {
      const slides = track.querySelectorAll('.carousel-slide');
      let bestCenter = 0, bestDist = Infinity;
      slides.forEach(sl => {
        const c = sl.offsetLeft + sl.offsetWidth / 2;
        const d = Math.abs(c - targetCenter);
        if (d < bestDist) { bestDist = d; bestCenter = c; }
      });
      const left = bestCenter - track.clientWidth / 2;
      return wrapByPeriod(left);
    }

    function jumpBy(direction) {
      if (!period || root.classList.contains('is-grid')) return; // sin saltos en grid
      pause();
      const cardW = originals[0].getBoundingClientRect().width || (track.clientWidth * 0.9);
      const approxStep = cardW + GAP;
      const currentCenter = track.scrollLeft + track.clientWidth / 2;
      const targetCenter  = currentCenter + direction * approxStep;
      const left = centerTo(targetCenter);
      // Si prefieres animación: track.scrollTo({ left, behavior: 'smooth' });
      track.scrollLeft = left;
      resumeAfter();
    }

    prevBtn?.addEventListener('click', () => jumpBy(-1));
    nextBtn?.addEventListener('click', () => jumpBy(+1));

    // ---------- Toggle GRID / CARRUSEL ----------
    function setGridMode(on) {
      root.classList.add('switching');         // animación (fade/zoom)
      // En modo grid, pausamos
      if (on) paused = true;

      // Cambia clase
      root.classList.toggle('is-grid', on);

      // Si volvemos al carrusel, recalcula y reanuda
      if (!on) {
        // Recalcula porque el layout cambió
        track.scrollLeft = 0;
        measurePeriod();
        paused = false;
      }

      // Cambia icono / aria-pressed
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', String(on));
        const icon = toggleBtn.querySelector('ion-icon');
        if (icon) icon.setAttribute('name', on ? 'albums-outline' : 'grid-outline');
        toggleBtn.title = on ? 'Volver al carrusel' : 'Ver todos';
      }

      // Quita clase de transición tras el frame
      setTimeout(() => root.classList.remove('switching'), 300);
    }

    toggleBtn?.addEventListener('click', () => {
      const toGrid = !root.classList.contains('is-grid');
      setGridMode(toGrid);
    });

    // ---------- Resize ----------
    let rT;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => {
        stop();
        track.scrollLeft = 0;
        measurePeriod();
        start();
      }, 150);
    }, { passive: true });

    // ---------- Init ----------
    function init() {
      cloneUntilWideEnough();
      measurePeriod();
      start();
    }
    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);
  });
})();


/* =========================
   Contadores ("Qué cambia con IA")
   ========================= */
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
