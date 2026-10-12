(() => {
  'use strict';
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'es';
  const say = (es, en) => lang() === 'es' ? es : en;
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = value;
    return element;
  };
  const placeholders = () => document.querySelectorAll('[data-placeholder-es][data-placeholder-en]').forEach(input => {
    input.placeholder = input.dataset[lang() === 'es' ? 'placeholderEs' : 'placeholderEn'];
  });
  placeholders();
  document.addEventListener('beaki:locale', placeholders);

  const productForm = document.querySelector('[data-product-form]');
  if (productForm) {
    const input = productForm.querySelector('input');
    const results = document.querySelector('[data-product-results]');
    const status = document.querySelector('[data-product-status]');
    const detail = document.querySelector('[data-product-detail]');
    let controller, requestId = 0, products = [];
    let selectedProduct;
    const productUrl = product => {
      const url = new URL('/products.html', location.origin);
      url.searchParams.set('product_name', product.name);
      url.searchParams.set('product_ref', product.productRef);
      url.searchParams.set('lang', lang());
      return url.pathname + url.search;
    };
    const renderDetail = () => {
      if (!selectedProduct) { detail.hidden = true; detail.replaceChildren(); return; }
      const product = selectedProduct;
      detail.hidden = false;
      const top = node('div', 'product-detail-top');
      const heading = node('div');
      heading.append(node('p', 'card-eyebrow', product.brand || say('PRODUCTO BEAKI', 'BEAKI PRODUCT')));
      heading.append(node('h2', '', product.name));
      heading.append(node('p', 'product-detail-summary', [product.quantity, product.market].filter(Boolean).join(' · ')));
      top.append(heading);
      const close = node('button', 'product-detail-close', say('Cerrar', 'Close'));
      close.type = 'button';
      close.addEventListener('click', () => {
        selectedProduct = undefined; renderDetail();
        document.title = say('Beaki — Buscar productos', 'Beaki — Search products');
        document.querySelector('link[rel="canonical"]').href = 'https://www.beaki.app/products.html';
        document.querySelector('meta[property="og:url"]').content = 'https://www.beaki.app/products.html';
        document.querySelector('#product-structured-data')?.remove();
        history.replaceState(null, '', `/products.html?lang=${lang()}`);
      });
      top.append(close); detail.replaceChildren(top);
      const facts = node('div', 'product-detail-facts');
      const nutrients = product.nutrientsPer100 || {};
      const format = new Intl.NumberFormat(lang() === 'es' ? 'es-ES' : 'en-GB', { maximumFractionDigits: 1 });
      [[say('Energía', 'Energy'), nutrients.energyKcal, 'kcal'], [say('Proteínas', 'Protein'), nutrients.proteinG, 'g'], [say('Hidratos', 'Carbohydrates'), nutrients.carbohydratesG, 'g'], [say('Grasas', 'Fat'), nutrients.fatG, 'g']].forEach(([label, value, unit]) => {
        if (typeof value !== 'number') return;
        const fact = node('div', 'product-detail-fact');
        fact.append(node('strong', '', `${format.format(value)} ${unit}`));
        fact.append(node('span', '', `${label} / 100 g`)); facts.append(fact);
      });
      if (facts.childElementCount) detail.append(facts);
      if (product.ingredientsText) detail.append(node('p', 'product-detail-copy', `${say('Ingredientes', 'Ingredients')}: ${product.ingredientsText}`));
      const app = node('a', 'product-detail-app', say('Ver en la app Beaki ↗', 'View in the Beaki app ↗'));
      app.href = `https://api.beaki.app/product/${encodeURIComponent(product.productRef)}`;
      detail.append(app);
      document.title = `${product.name} — Beaki`;
      const description = say(`Consulta ${product.name} en el catálogo de productos de Beaki.`, `Explore ${product.name} in Beaki's product catalogue.`);
      document.querySelector('meta[name="description"]').content = description;
      document.querySelector('meta[property="og:title"]').content = document.title;
      document.querySelector('meta[property="og:description"]').content = description;
      const canonical = new URL(productUrl(product), location.origin).href;
      document.querySelector('link[rel="canonical"]').href = canonical;
      document.querySelector('meta[property="og:url"]').content = canonical;
      document.querySelector('#product-structured-data')?.remove();
      const structuredData = node('script');
      structuredData.id = 'product-structured-data';
      structuredData.type = 'application/ld+json';
      structuredData.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}), description, url: canonical });
      document.head.append(structuredData);
    };
    const loadDetail = async product => {
      const response = await fetch(`https://api.beaki.app/public/products/${encodeURIComponent(product.productRef)}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.product && data.product.productRef === product.productRef) {
        selectedProduct = data.product;
        renderDetail();
      }
    };
    const render = () => {
      results.replaceChildren(...products.map(product => {
        const card = node('article', 'product-card');
        const head = node('div', 'product-card-head');
        const icon = node('span', 'product-image product-image-empty', '✳');
        icon.setAttribute('aria-hidden', 'true');
        head.append(icon);
        const identity = node('div');
        identity.append(node('p', 'product-brand', product.brand || say('Marca no indicada', 'Brand not listed')));
        identity.append(node('h3', '', product.name));
        head.append(identity); card.append(head);
        if (product.quantity) card.append(node('span', 'product-code', product.quantity));
        const tags = node('div', 'product-nutrition');
        if (product.foodGroup) tags.append(node('span', '', product.foodGroup.replaceAll('_', ' ').toLowerCase()));
        (product.foodSubcategories || []).slice(0, 2).forEach(category => tags.append(node('span', '', category.replaceAll('_', ' ').toLowerCase())));
        if (tags.childElementCount) card.append(tags);
        const link = node('a', 'product-source', say('Ver datos del producto →', 'View product details →'));
        link.href = productUrl(product);
        card.append(link);
        return card;
      }));
      status.textContent = products.length ? say(`${products.length} productos encontrados`, `${products.length} products found`) : say('No encontramos productos. Prueba otra búsqueda.', 'No products found. Try another search.');
    };
    const search = async () => {
      const query = input.value.trim();
      if (query.length < 2) { status.textContent = say('Escribe al menos 2 caracteres.', 'Enter at least 2 characters.'); return; }
      controller?.abort(); controller = new AbortController(); const id = ++requestId;
      products = []; results.replaceChildren();
      status.textContent = say('Buscando en Beaki…', 'Searching Beaki…');
      try {
        const response = await fetch(`https://api.beaki.app/public/products/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (id !== requestId) return;
        products = Array.isArray(data.products) ? data.products.filter(product => product && typeof product.name === 'string' && typeof product.productRef === 'string') : [];
        render();
        const params = new URLSearchParams(location.search);
        const requestedName = params.get('product_name');
        if (requestedName && products.length) {
          const requestedRef = params.get('product_ref');
          const chosen = products.find(product => product.productRef === requestedRef) || products.find(product => product.name.toLocaleLowerCase() === requestedName.toLocaleLowerCase()) || products[0];
          await loadDetail(chosen);
        }
      } catch (error) {
        if (error.name === 'AbortError' || id !== requestId) return;
        status.textContent = say('No se pudo cargar la búsqueda de Beaki. Inténtalo de nuevo.', 'Beaki search could not load. Please try again.');
      }
    };
    productForm.addEventListener('submit', event => {
      event.preventDefault();
      selectedProduct = undefined; renderDetail();
      document.title = say('Beaki — Buscar productos', 'Beaki — Search products');
      document.querySelector('link[rel="canonical"]').href = 'https://www.beaki.app/products.html';
      document.querySelector('meta[property="og:url"]').content = 'https://www.beaki.app/products.html';
      document.querySelector('#product-structured-data')?.remove();
      const url = new URL(location.href);
      url.searchParams.delete('product_name');
      url.searchParams.delete('product_ref');
      url.searchParams.set('q', input.value.trim());
      history.replaceState(null, '', url.pathname + url.search);
      search();
    });
    document.addEventListener('beaki:locale', () => { if (products.length) render(); if (selectedProduct) renderDetail(); });
    const urlParams = new URLSearchParams(location.search);
    const urlQuery = urlParams.get('product_name') || urlParams.get('q');
    if (urlQuery) { input.value = urlQuery.slice(0, 80); search(); }
  }

  const profileResults = document.querySelector('[data-profile-results]');
  if (profileResults) {
    const input = document.querySelector('#profile-query');
    const count = document.querySelector('[data-profile-count]');
    const more = document.querySelector('[data-profile-more]');
    const buttons = [...document.querySelectorAll('[data-kind]')];
    let items = [], kind = 'all', visible = 18;
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const render = () => {
      const query = normalize(input.value.trim());
      const matches = items.filter(item => (kind === 'all' || item.kind === kind) && normalize([item.name.es, item.name.en, item.description.es, item.description.en].filter(Boolean).join(' ')).includes(query));
      count.textContent = say(`${matches.length} temas`, `${matches.length} topics`);
      profileResults.replaceChildren(...matches.slice(0, visible).map(item => {
        const card = node('article', 'profile-card');
        card.append(node('div', 'card-eyebrow', item.kind === 'diet' ? say('DIETA', 'DIET') : say('CONDICIÓN', 'CONDITION')));
        card.append(node('h3', '', item.name[lang()]));
        const description = item.description[lang()] || say('Este tema forma parte del catálogo de perfiles de Beaki.', 'This topic is part of Beaki’s profile catalogue.');
        card.append(node('p', '', description));
        card.append(node('span', 'kind-badge', item.kind === 'diet' ? say('Alimentación', 'Eating pattern') : say('Salud', 'Health')));
        return card;
      }));
      if (!matches.length) profileResults.append(node('p', 'empty-state', say('No hay resultados. Prueba con otro término.', 'No results. Try another term.')));
      more.hidden = visible >= matches.length;
    };
    input.addEventListener('input', () => { visible = 18; render(); });
    buttons.forEach(button => button.addEventListener('click', () => {
      kind = button.dataset.kind; visible = 18;
      buttons.forEach(option => { const active = option === button; option.classList.toggle('is-active', active); option.setAttribute('aria-pressed', String(active)); });
      render();
    }));
    document.querySelector('[data-profile-more-button]').addEventListener('click', () => { visible += 18; render(); });
    document.addEventListener('beaki:locale', render);
    fetch('/assets/profile-catalog.json').then(response => { if (!response.ok) throw new Error('Catalogue unavailable'); return response.json(); }).then(data => { items = data.items; render(); }).catch(() => { profileResults.append(node('p', 'empty-state', say('No se pudo cargar el catálogo.', 'Catalogue could not load.'))); });
  }
})();
