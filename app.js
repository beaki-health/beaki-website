(() => {
  'use strict';

  const root = document.documentElement;
  const header = document.querySelector('[data-header]');
  const nav = document.querySelector('[data-nav]');
  const menuButton = document.querySelector('[data-menu-button]');
  const languageButton = document.querySelector('[data-language]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const localeKey = 'beaki.web.locale';

  const translations = {
    es: {
      title: 'Beaki — Comida que encaja contigo',
      description: 'Beaki convierte productos, comidas y menús en decisiones nutricionales personalizadas según tu perfil, objetivos y necesidades.',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      switchLanguage: 'Cambiar a inglés'
    },
    en: {
      title: 'Beaki — Food that fits you',
      description: 'Beaki turns products, meals and menus into nutrition decisions personalised to your profile, goals and needs.',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      switchLanguage: 'Switch to Spanish'
    }
  };

  const getStoredLocale = () => {
    try {
      const stored = window.localStorage.getItem(localeKey);
      return stored === 'es' || stored === 'en' ? stored : null;
    } catch {
      return null;
    }
  };

  let locale = getStoredLocale() || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');

  const setMenu = (open) => {
    if (!nav || !menuButton) return;
    nav.classList.toggle('is-open', open);
    menuButton.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    const label = menuButton.querySelector('.sr-only');
    if (label) label.textContent = open ? translations[locale].closeMenu : translations[locale].openMenu;
  };

  const setLocale = (nextLocale, persist = true) => {
    locale = nextLocale === 'en' ? 'en' : 'es';
    root.lang = locale;
    const pageTitle = locale === 'es' ? document.body.dataset.titleEs : document.body.dataset.titleEn;
    document.title = pageTitle || translations[locale].title;

    document.querySelectorAll('[data-es][data-en]').forEach((element) => {
      element.textContent = element.dataset[locale];
    });

    document.querySelectorAll('meta[name="description"], meta[property="og:description"]').forEach((meta) => {
      const localized = locale === 'es' ? meta.dataset.es : meta.dataset.en;
      meta.content = localized || translations[locale].description;
    });
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = pageTitle || translations[locale].title;

    const current = document.querySelector('[data-language-current]');
    const next = document.querySelector('[data-language-next]');
    if (current) current.textContent = locale.toUpperCase();
    if (next) next.textContent = locale === 'es' ? 'EN' : 'ES';
    if (languageButton) languageButton.setAttribute('aria-label', translations[locale].switchLanguage);

    const menuLabel = menuButton?.querySelector('.sr-only');
    if (menuLabel) menuLabel.textContent = translations[locale].openMenu;

    if (persist) {
      try {
        window.localStorage.setItem(localeKey, locale);
      } catch {
        // The page remains fully usable when storage is blocked.
      }
    }
  };

  setLocale(locale, false);

  languageButton?.addEventListener('click', () => {
    setLocale(locale === 'es' ? 'en' : 'es');
  });

  menuButton?.addEventListener('click', () => {
    setMenu(!nav.classList.contains('is-open'));
  });

  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 18);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const revealElements = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  }

  const screens = [...document.querySelectorAll('[data-demo-screen]')];
  const demoButtons = [...document.querySelectorAll('[data-demo-button]')];
  const demoStage = document.querySelector('[data-demo-stage]');
  let activeDemo = 0;
  let demoTimer;

  const showDemo = (index) => {
    activeDemo = (index + screens.length) % screens.length;
    screens.forEach((screen, screenIndex) => {
      const active = screenIndex === activeDemo;
      screen.classList.toggle('is-active', active);
      screen.setAttribute('aria-hidden', String(!active));
    });
    demoButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === activeDemo;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const stopDemo = () => window.clearInterval(demoTimer);
  const startDemo = () => {
    stopDemo();
    if (!reduceMotion.matches && screens.length > 1) {
      demoTimer = window.setInterval(() => showDemo(activeDemo + 1), 5200);
    }
  };

  demoButtons.forEach((button, index) => button.addEventListener('click', () => {
    showDemo(index);
    startDemo();
  }));
  demoStage?.addEventListener('pointerenter', stopDemo);
  demoStage?.addEventListener('pointerleave', startDemo);
  demoStage?.addEventListener('focusin', stopDemo);
  demoStage?.addEventListener('focusout', startDemo);
  reduceMotion.addEventListener?.('change', startDemo);
  showDemo(0);
  startDemo();

  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion.matches) {
    document.querySelectorAll('[data-parallax]').forEach((element) => {
      element.addEventListener('pointermove', (event) => {
        const bounds = element.getBoundingClientRect();
        element.style.setProperty('--mx', ((event.clientX - bounds.left) / bounds.width - 0.5).toFixed(3));
        element.style.setProperty('--my', ((event.clientY - bounds.top) / bounds.height - 0.5).toFixed(3));
      });
      element.addEventListener('pointerleave', () => {
        element.style.setProperty('--mx', '0');
        element.style.setProperty('--my', '0');
      });
    });
  }

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
})();
