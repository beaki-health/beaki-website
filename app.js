(() => {
  'use strict';

  const root = document.documentElement;
  const localeKey = 'beaki.web.locale';
  const nav = document.querySelector('[data-nav]');
  const menuButton = document.querySelector('[data-menu-button]');
  const localeButtons = document.querySelectorAll('[data-locale]');
  const profileButtons = [...document.querySelectorAll('[data-profile]')];
  let activeProfile = 'yo';

  const copy = {
    es: {
      title: 'Beaki — Comida que encaja contigo',
      description: 'Beaki convierte productos, comidas y menús en decisiones nutricionales personalizadas según tu perfil, objetivos y necesidades.',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      profile: 'Perfil de ejemplo de'
    },
    en: {
      title: 'Beaki — Food that fits you',
      description: 'Beaki turns products, meals and menus into nutrition decisions personalised to your profile, goals and needs.',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      profile: 'Example profile for'
    }
  };

  const profiles = {
    yo: {
      name: 'Lucía', initial: 'l', kcal: [1700, 1850], protein: '95–115', carbs: '190–230', fat: '55–70',
      sub: { es: 'Perder peso · actividad moderada', en: 'Lose weight · moderately active' },
      tags: [
        { es: 'Colesterol LDL alto', en: 'High LDL cholesterol' },
        { es: 'Patrón mediterráneo', en: 'Mediterranean diet' },
        { es: 'Lactosa · intolerancia', en: 'Lactose · intolerance', tone: 'amber' },
        { es: 'Cacahuete · alergia', en: 'Peanut · allergy', tone: 'danger' }
      ]
    },
    ana: {
      name: 'Ana', initial: 'a', kcal: [2100, 2300], protein: '80–100', carbs: '260–300', fat: '65–80',
      sub: { es: 'Mantener peso · muy activa', en: 'Maintain weight · very active' },
      tags: [
        { es: 'Vegetariana', en: 'Vegetarian' },
        { es: 'Hierro bajo', en: 'Low iron' },
        { es: 'Gluten · celiaquía', en: 'Gluten · coeliac disease', tone: 'danger' }
      ]
    }
  };

  const getStoredLocale = () => {
    try {
      const saved = localStorage.getItem(localeKey);
      return saved === 'es' || saved === 'en' ? saved : null;
    } catch {
      return null;
    }
  };
  const requestedLocale = new URLSearchParams(location.search).get('lang');
  let locale = (requestedLocale === 'es' || requestedLocale === 'en' ? requestedLocale : null)
    || getStoredLocale()
    || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');

  const setMenu = (open) => {
    if (!nav || !menuButton) return;
    nav.classList.toggle('is-open', open);
    menuButton.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    const label = menuButton.querySelector('.sr-only');
    if (label) label.textContent = copy[locale][open ? 'closeMenu' : 'openMenu'];
  };

  const renderProfile = () => {
    if (!profileButtons.length) return;
    const person = profiles[activeProfile];
    const formatter = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-GB', { useGrouping: 'always' });
    document.querySelectorAll('[data-profile-value]').forEach((element) => {
      const field = element.dataset.profileValue;
      if (field === 'sub') element.textContent = person.sub[locale];
      else if (field === 'kcal') element.textContent = person.kcal.map((n) => formatter.format(n)).join('–');
      else element.textContent = person[field] + (['protein', 'carbs', 'fat'].includes(field) ? ' g' : '');
    });
    profileButtons.forEach((button) => {
      const selected = button.dataset.profile === activeProfile;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const preview = document.getElementById('profile-preview');
    preview?.setAttribute('aria-labelledby', 'profile-tab-' + activeProfile);
    preview?.setAttribute('aria-label', `${copy[locale].profile} ${person.name}`);
    const tags = document.querySelector('[data-profile-tags]');
    if (tags) {
      tags.replaceChildren(...person.tags.map((tag) => {
        const chip = document.createElement('span');
        chip.className = 'profile-tag' + (tag.tone ? ` profile-tag-${tag.tone}` : '');
        chip.textContent = tag[locale];
        return chip;
      }));
    }
  };

  const setLocale = (nextLocale, persist = true) => {
    locale = nextLocale === 'en' ? 'en' : 'es';
    root.lang = locale;
    const title = document.body.dataset[locale === 'es' ? 'titleEs' : 'titleEn'] || copy[locale].title;
    document.title = title;
    document.querySelectorAll('[data-es][data-en]').forEach((element) => {
      element.textContent = element.dataset[locale];
    });
    document.querySelectorAll('[data-aria-es][data-aria-en]').forEach((element) => {
      element.setAttribute('aria-label', element.dataset[locale === 'es' ? 'ariaEs' : 'ariaEn']);
    });
    document.querySelectorAll('meta[name="description"], meta[property="og:description"]').forEach((meta) => {
      meta.content = meta.dataset[locale] || copy[locale].description;
    });
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = title;
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.content = locale === 'es' ? 'es_ES' : 'en_GB';
    localeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.locale === locale)));
    // Carry the language to other pages even when browser storage is unavailable.
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      const url = new URL(link.getAttribute('href'), location.origin);
      if (url.pathname !== location.pathname) {
        url.searchParams.set('lang', locale);
        link.setAttribute('href', url.pathname + url.search + url.hash);
      }
    });
    renderProfile();
    setMenu(nav?.classList.contains('is-open') || false);
    if (persist) {
      try { localStorage.setItem(localeKey, locale); } catch { /* Language selection also works without storage. */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', locale);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  };

  setLocale(locale, false);
  localeButtons.forEach((button) => button.addEventListener('click', () => setLocale(button.dataset.locale)));
  menuButton?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.classList.contains('is-open')) {
      setMenu(false);
      menuButton?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.header-pill')) setMenu(false);
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', () => setMenu(false));

  profileButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      activeProfile = button.dataset.profile;
      renderProfile();
    });
    button.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = profileButtons[(index + 1) % profileButtons.length];
      else if (event.key === 'Home') next = profileButtons[0];
      else if (event.key === 'End') next = profileButtons[profileButtons.length - 1];
      if (next) {
        event.preventDefault();
        next.click();
        next.focus();
      }
    });
  });
})();
