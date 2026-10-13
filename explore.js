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
    const formatNumber = value => new Intl.NumberFormat(lang() === 'es' ? 'es-ES' : 'en-GB', { maximumFractionDigits: value > 0 && value < 0.01 ? 4 : value > 0 && value < 1 ? 2 : 1 }).format(value);
    const allergenNames = {
      milk: ['Leche', 'Milk'], eggs: ['Huevos', 'Eggs'], egg: ['Huevos', 'Eggs'], gluten: ['Gluten', 'Gluten'], wheat: ['Trigo', 'Wheat'],
      soybeans: ['Soja', 'Soy'], soy: ['Soja', 'Soy'], peanuts: ['Cacahuetes', 'Peanuts'], nuts: ['Frutos de cáscara', 'Tree nuts'],
      fish: ['Pescado', 'Fish'], crustaceans: ['Crustáceos', 'Crustaceans'], molluscs: ['Moluscos', 'Molluscs'], celery: ['Apio', 'Celery'],
      mustard: ['Mostaza', 'Mustard'], sesame: ['Sésamo', 'Sesame'], lupin: ['Altramuces', 'Lupin'], 'sulphur-dioxide-and-sulphites': ['Sulfitos', 'Sulphites']
    };
    const nutrientRows = [
      ['energyKcal', 'Energía', 'Energy', 'kcal'], ['fatG', 'Grasas', 'Fat', 'g'], ['saturatedFatG', 'Grasas saturadas', 'Saturated fat', 'g'],
      ['carbohydratesG', 'Hidratos de carbono', 'Carbohydrates', 'g'], ['sugarsG', 'Azúcares', 'Sugars', 'g'], ['fibreG', 'Fibra', 'Fibre', 'g'],
      ['proteinG', 'Proteínas', 'Protein', 'g'], ['saltG', 'Sal', 'Salt', 'g'], ['sodiumMg', 'Sodio', 'Sodium', 'mg']
    ];
    const microNames = window.beakiMicronutrientLabels || {};
    const reasonNames = window.beakiScoreReasonLabels || {};
    const label = pair => pair[lang() === 'es' ? 0 : 1];
    const ingredientLabel = value => {
      if (typeof value !== 'string' || !/[A-ZÁÉÍÓÚÜÑ]/.test(value) || value !== value.toLocaleUpperCase('es-ES')) return value;
      const lower = value.toLocaleLowerCase('es-ES').replace(/\b(uht|dop|igp|e\s*-?\s*\d{3,4}[a-z]{0,3})\b/gi, match => match.toLocaleUpperCase('es-ES')).replace(/\bph\b/gi, 'pH');
      return lower.replace(/[a-záéíóúüñ]/i, letter => letter.toLocaleUpperCase('es-ES'));
    };
    const ingredientTone = tone => ['NEGATIVE', 'POSITIVE', 'MIXED'].includes(tone) ? tone.toLowerCase() : 'neutral';
    const appendIngredientText = (parent, source, highlights, fallbackTone = 'NEUTRAL') => {
      const text = ingredientLabel(source);
      const ranges = text.length === source.length && Array.isArray(highlights)
        ? [...highlights].filter(span => Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end <= text.length && span.end > span.start).sort((a, b) => a.start - b.start)
        : [];
      if (!ranges.length) {
        parent.append(node('span', `ingredient-tone-${ingredientTone(fallbackTone)}`, text));
        return;
      }
      let cursor = 0;
      ranges.forEach(span => {
        if (span.start < cursor) return;
        if (span.start > cursor) parent.append(document.createTextNode(text.slice(cursor, span.start)));
        parent.append(node('span', `ingredient-tone-${ingredientTone(span.tone)}`, text.slice(span.start, span.end)));
        cursor = span.end;
      });
      if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
    };
    const allergenLabel = value => {
      const key = value.replace(/^[a-z]{2}:/i, '').toLowerCase();
      return allergenNames[key] ? label(allergenNames[key]) : key.replaceAll('-', ' ');
    };
    const section = (title, className) => {
      const container = node('section', `product-detail-section ${className}`);
      container.append(node('h3', '', title));
      return container;
    };
    const factGrid = (entries, estimatedKeys = []) => {
      const grid = node('div', 'product-detail-facts');
      entries.forEach(([key, title, unit, value]) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        const fact = node('div', 'product-detail-fact');
        const heading = node('span', 'product-detail-fact-heading');
        heading.append(node('span', '', title));
        if (estimatedKeys.includes(key)) heading.append(node('small', '', say('Estimado', 'Estimated')));
        fact.append(heading, node('strong', '', `${formatNumber(value)} ${unit}`));
        grid.append(fact);
      });
      return grid;
    };
    const microGroupLabels = {
      mineral: ['Minerales', 'Minerals'], vitamin: ['Vitaminas', 'Vitamins'], carotenoid: ['Carotenoides', 'Carotenoids'],
      lipid: ['Lípidos', 'Lipids'], carb: ['Carbohidratos', 'Carbohydrates'], aminoAcid: ['Aminoácidos', 'Amino acids'], other: ['Otros componentes', 'Other components']
    };
    const appendMicroGroups = (parent, entries, estimatedKeys) => {
      Object.entries(microGroupLabels).forEach(([group, names]) => {
        const groupEntries = entries.filter(([key]) => (microNames[key]?.group || 'other') === group);
        if (!groupEntries.length) return;
        parent.append(node('h4', 'product-detail-group', label(names)));
        parent.append(factGrid(groupEntries, estimatedKeys));
      });
    };
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
      const nutrients = product.nutrientsPer100 || {};
      const basis = product.nutritionBasis === 'PER_100_ML' ? '100 ml' : '100 g';
      const score = node('section', 'product-detail-score');
      const scoreHeader = node('div', 'product-detail-score-header');
      const scoreHeading = node('div');
      scoreHeading.append(node('p', 'card-eyebrow', say('NOTA GENERAL', 'GENERAL SCORE')));
      scoreHeading.append(node('strong', '', typeof product.generalGrade === 'number' ? `${formatNumber(product.generalGrade)}/10` : '—/10'));
      scoreHeader.append(scoreHeading);
      scoreHeader.append(node('p', '', say('Sin tu perfil · Tu nota personal está en la app', 'Without your profile · Your personal score is in the app')));
      score.append(scoreHeader);
      const scoreBreakdown = node('details', 'product-detail-disclosure product-detail-score-breakdown');
      scoreBreakdown.append(node('summary', '', say('Ver desglose de la nota', 'View score breakdown')));
      const scoreRows = node('div', 'product-detail-score-rows');
      const starting = node('div', 'product-detail-score-row');
      starting.append(node('span', '', say('Nota inicial', 'Starting score')), node('strong', '', `${formatNumber(typeof product.generalScoreStart === 'number' ? product.generalScoreStart : 9)}/10`));
      scoreRows.append(starting);
      (product.generalScoreFactors || []).forEach(factor => {
        if (!factor || typeof factor.effect !== 'number') return;
        const code = factor.effect <= -1 ? ({ MODERATE_SUGAR: 'HIGH_SUGAR', MODERATE_SALT: 'HIGH_SALT', MODERATE_SATURATED_FAT: 'HIGH_SATURATED_FAT', MODERATE_ENERGY_DENSITY: 'HIGH_ENERGY_DENSITY', MODERATE_FAT_DENSITY: 'HIGH_FAT_DENSITY', BEVERAGE_SUGAR_MODERATE: 'BEVERAGE_SUGAR_HIGH', LIQUID_FREE_SUGAR_MODERATE: 'LIQUID_FREE_SUGAR_HIGH', HIGH_SATURATED_FAT_SHARE: 'VERY_HIGH_SATURATED_FAT_SHARE' }[factor.code] || factor.code) : factor.code;
        const row = node('div', 'product-detail-score-row');
        row.append(node('span', '', reasonNames[code]?.[lang() === 'es' ? 0 : 1] || code.replaceAll('_', ' ').toLowerCase()), node('strong', factor.effect < 0 ? 'negative' : 'positive', `${factor.effect > 0 ? '+' : '−'}${formatNumber(Math.abs(factor.effect))}`));
        scoreRows.append(row);
      });
      const finalRow = node('div', 'product-detail-score-row product-detail-score-final');
      finalRow.append(node('span', '', say('Nota general', 'General score')), node('strong', '', typeof product.generalGrade === 'number' ? `${formatNumber(product.generalGrade)}/10` : '—/10'));
      scoreRows.append(finalRow);
      scoreRows.append(node('p', 'product-detail-score-note', say('La nota se mantiene entre 0 y 10; cada factor muestra su efecto por separado.', 'The score stays between 0 and 10; each factor shows its independent effect.')));
      scoreBreakdown.append(scoreRows); score.append(scoreBreakdown);
      detail.append(score);
      const nutrition = section(`${say('Información nutricional', 'Nutrition facts')} / ${basis}`, 'product-detail-nutrition');
      const macroParts = [
        ['proteinG', say('Proteínas', 'Protein'), 'protein'],
        ['carbohydratesG', say('Hidratos', 'Carbs'), 'carbs'],
        ['fatG', say('Grasas', 'Fat'), 'fat']
      ].map(([key, title, color]) => ({ title, color, grams: Number.isFinite(nutrients[key]) ? Math.max(0, nutrients[key]) : 0 }));
      const macroTotal = macroParts.reduce((sum, part) => sum + part.grams, 0);
      if (macroTotal > 0 && ['proteinG', 'carbohydratesG', 'fatG'].every(key => Number.isFinite(nutrients[key]))) {
        const macroChart = node('div', 'product-detail-macro-chart');
        const macroLine = node('div', 'product-detail-macro-line');
        macroLine.setAttribute('role', 'img');
        macroLine.setAttribute('aria-label', `${say('Proporción entre macronutrientes', 'Macronutrient proportions')}: ${macroParts.map(part => `${part.title} ${formatNumber(part.grams / macroTotal * 100)} %`).join(', ')}`);
        const macroLegend = node('div', 'product-detail-macro-legend');
        macroParts.forEach(part => {
          if (!part.grams) return;
          const segment = node('span', `product-detail-macro-${part.color}`);
          segment.style.flexGrow = String(part.grams);
          macroLine.append(segment);
          const item = node('span', `product-detail-macro-${part.color}`, `${part.title} ${formatNumber(part.grams / macroTotal * 100)} %`);
          macroLegend.append(item);
        });
        macroChart.append(macroLine, macroLegend, node('p', 'product-detail-macro-note', say('Porcentaje entre proteínas, hidratos y grasas indicados; no es el % de ingesta diaria.', 'Share of the listed protein, carbs and fat; not a daily intake percentage.')));
        nutrition.append(macroChart);
      }
      nutrition.append(factGrid(nutrientRows.map(([key, es, en, unit]) => [key, label([es, en]), unit, nutrients[key]])));
      if (nutrition.querySelector('.product-detail-fact')) detail.append(nutrition);
      const allergens = (product.allergens || []).filter(value => !/^(?:[a-z]{2}:)?(?:none|no|n\/a|ninguno)$/i.test(value));
      const traces = (product.traces || []).filter(value => !/^(?:[a-z]{2}:)?(?:none|no|n\/a|ninguno)$/i.test(value));
      const allergenSection = section(say('Alérgenos', 'Allergens'), 'product-detail-allergens');
      allergenSection.append(node('p', 'product-detail-copy', allergens.length ? `${say('Declarados', 'Declared')}: ${allergens.map(allergenLabel).join(', ')}` : say('No constan alérgenos declarados.', 'No declared allergens listed.')));
      if (traces.length) allergenSection.append(node('p', 'product-detail-copy', `${say('Posibles trazas', 'Possible traces')}: ${traces.map(allergenLabel).join(', ')}`));
      detail.append(allergenSection);
      const ingredients = section(say('Ingredientes', 'Ingredients'), 'product-detail-ingredients');
      if (product.ingredientItems?.length) {
        const list = node('ul', 'product-detail-ingredient-list');
        product.ingredientItems.forEach(item => {
          const entry = node('li', `ingredient-item-${ingredientTone(item.tone)}`);
          appendIngredientText(entry, item.text, item.highlights, item.tone);
          if (item.depth) entry.style.marginInlineStart = `${Math.min(item.depth, 3) * 16}px`;
          list.append(entry);
        });
        ingredients.append(list);
      } else {
        const copy = node('p', 'product-detail-copy');
        if (product.ingredientDisplayText || product.ingredientsText) appendIngredientText(copy, product.ingredientDisplayText || product.ingredientsText, product.ingredientTextHighlights);
        else copy.textContent = say('Ingredientes no disponibles.', 'Ingredients unavailable.');
        ingredients.append(copy);
      }
      detail.append(ingredients);
      const estimate = product.micronutrientEstimate;
      const micro = estimate?.per100 || {};
      const microEntries = Object.entries(micro).filter(([, value]) => typeof value === 'number' && value > 0).map(([key, value]) => {
        const unit = key.endsWith('Ug') ? 'µg' : key.endsWith('G') ? 'g' : 'mg';
        return [key, microNames[key]?.[lang()] || key.replace(/(Mg|Ug|G)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'), microNames[key]?.unit || unit, value];
      });
      const massEntries = Object.entries(estimate?.massEstimate?.per100 || {}).filter(([, value]) => typeof value === 'number' && value > 0).map(([key, value]) => {
        const unit = key.endsWith('Ug') ? 'µg' : key.endsWith('G') ? 'g' : 'mg';
        return [key, microNames[key]?.[lang()] || key.replace(/(Mg|Ug|G)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'), microNames[key]?.unit || unit, value];
      });
      const micronutrients = node('details', 'product-detail-micronutrients product-detail-disclosure');
      micronutrients.append(node('summary', '', `${say('Micronutrientes', 'Micronutrients')} · ${microEntries.length + massEntries.length}`));
      if (microEntries.length) {
        micronutrients.append(node('p', 'product-detail-hint', `${say('Por', 'Per')} ${estimate.nutritionBasis === 'PER_100_ML' ? '100 ml' : '100 g'}. ${estimate.estimatedKeys?.length ? say('Los valores marcados son estimaciones.', 'Marked values are estimates.') : say('Valores declarados en la etiqueta.', 'Values declared on the label.')}`));
        appendMicroGroups(micronutrients, microEntries, estimate.estimatedKeys || []);
      } else if (!massEntries.length) micronutrients.append(node('p', 'product-detail-copy', say('No hay datos de micronutrientes para este producto.', 'Micronutrient data is unavailable for this product.')));
      if (massEntries.length) {
        micronutrients.append(node('p', 'product-detail-hint', say('Estimación independiente por 100 g a partir de los ingredientes; no se suma a los valores de la etiqueta.', 'Independent estimate per 100 g from ingredients; do not add it to label values.')));
        appendMicroGroups(micronutrients, massEntries, massEntries.map(([key]) => key));
      }
      detail.append(micronutrients);
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
        selectedProduct = { ...data.product, generalGrade: data.generalGrade, generalScoreStart: data.generalScoreStart, generalScoreFactors: data.generalScoreFactors, ingredientItems: data.ingredientItems, ingredientDisplayText: data.ingredientDisplayText, ingredientTextHighlights: data.ingredientTextHighlights, micronutrientEstimate: data.micronutrientEstimate };
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
        if (response.status === 429) {
          status.textContent = say('Has hecho muchas búsquedas. Espera un minuto e inténtalo de nuevo.', 'Too many searches. Please wait a minute and try again.');
          return;
        }
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
