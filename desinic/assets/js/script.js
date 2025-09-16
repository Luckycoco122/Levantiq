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
    const payload = {
      name:    (data.get('name')    || '').toString().trim(),
      email:   (data.get('email')   || '').toString().trim(),
      phone:   (data.get('phone')   || '').toString().trim(),
      company: (data.get('company') || '').toString().trim(),
      message: (data.get('message') || '').toString().trim(),
      source:  'levantiq-web'
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

      // Evento opcional a GA4 si existe gtag()
      if (typeof gtag === 'function') {
        gtag('event', 'lead_submit', { form: form.id || 'contacto' });
      }
    } catch {
      if (fb) {
        fb.textContent = 'Hubo un problema al enviar. Inténtalo de nuevo.';
        fb.classList.add('error'); fb.style.display = 'block';
      }
    }
  });

})();
