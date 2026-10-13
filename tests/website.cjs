'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
const widths = [320, 360, 390, 540, 768, 820, 960, 1024, 1440];
const errors = [];

async function startServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const contents = await fs.readFile(filename);
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' }).end(contents);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function checkLayout(page, locale) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate((lang) => {
    const out = { language: document.documentElement.lang, overflow: [], clippedPreviewText: [], incorrectTranslations: [], brokenImages: [], missingAnchors: [] };
    for (const element of document.querySelectorAll('body *')) {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height && (rect.right > innerWidth + 1 || rect.left < -1)) out.overflow.push(element.className);
    }
    for (const element of document.querySelectorAll('[data-es][data-en]')) {
      if (element.textContent !== element.dataset[lang]) out.incorrectTranslations.push(element.dataset[lang]);
    }
    for (const image of document.images) {
      if (!image.complete || !image.naturalWidth) out.brokenImages.push(image.src);
    }
    for (const link of document.querySelectorAll('a[href^="#"]')) {
      const id = link.getAttribute('href').slice(1);
      if (!document.getElementById(id)) out.missingAnchors.push(id);
    }
    for (const phone of document.querySelectorAll('.phone')) {
      const screen = phone.firstElementChild;
      const bounds = screen.getBoundingClientRect();
      const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode;
        if (!text.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        const rect = range.getBoundingClientRect();
        if (rect.bottom > bounds.bottom + 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.left < bounds.left - 1) {
          out.clippedPreviewText.push(text.textContent.trim());
        }
      }
    }
    return out;
  }, locale);
  assert.equal(result.language, locale);
  for (const [kind, problems] of Object.entries(result)) {
    if (kind !== 'language') assert.deepEqual(problems, [], `${kind} at ${page.viewportSize().width}px: ${JSON.stringify(problems)}`);
  }
}

async function checkAccessibility(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })));
  assert.deepEqual(violations, [], `Accessibility violations: ${JSON.stringify(violations)}`);
}

async function run() {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
  let browser;
  try {
    browser = await engine.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const context = await browser.newContext();
    await context.route('https://api.beaki.app/public/catalogues/profiles', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 'test', items: [
        { id: 'diet.coeliac', kind: 'diet', name: { es: 'Dieta para celiaquía', en: 'Coeliac diet' }, description: { es: 'Alimentación para la celiaquía', en: 'Eating with coeliac disease' } },
        ...Array.from({ length: 20 }, (_, index) => ({ id: `diet.test_${index}`, kind: 'diet', name: { es: `Dieta ${index}`, en: `Diet ${index}` }, description: { es: '', en: '' } })),
        { id: 'allergy.test', kind: 'allergy', name: { es: 'Alergia nueva', en: 'New allergy' }, description: { es: 'Alergia del catálogo activo', en: 'Allergy from the live catalogue' } }
      ] }) });
    });
    context.on('page', (page) => {
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    });
    for (const route of ['/', '/legal.html', '/products.html', '/profiles.html']) {
      for (const lang of ['es', 'en']) {
        const page = await context.newPage();
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${base}${route}?lang=${lang}`, { waitUntil: 'networkidle' });
          await checkLayout(page, lang);
          if (width === 390 || width === 1440) await checkAccessibility(page);
        }
        console.log(`✓ ${route} ${lang}: nine widths, translations, images, anchors, preview text and accessibility`);
        await page.close();
      }
    }

    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/?lang=es`);
    await page.locator('[data-profile="ana"]').click();
    assert.equal(await page.locator('[data-profile-value="kcal"]').textContent(), '2.100–2.300');
    assert.equal(await page.locator('[data-profile-value="protein"]').textContent(), '80–100 g');
    assert.equal(await page.locator('[data-profile-value="carbs"]').textContent(), '260–300 g');
    assert.equal(await page.locator('[data-profile-value="fat"]').textContent(), '65–80 g');
    assert.match(await page.locator('[data-profile-tags]').textContent(), /Vegetariana.*Hierro bajo.*Gluten · celiaquía/);
    await page.locator('[data-locale="en"]').click();
    assert.equal(await page.locator('[data-profile-value="kcal"]').textContent(), '2,100–2,300');
    assert.match(await page.locator('[data-profile-tags]').textContent(), /Vegetarian.*Low iron.*coeliac disease/);
    assert.match(await page.locator('h1').innerText(), /Understand what you eat/);
    await page.locator('[data-profile="ana"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('[data-profile="yo"]').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[data-profile-value="kcal"]').textContent(), '1,700–1,850');
    console.log('✓ Profile switch updates every range and tag, follows language changes and supports keyboard navigation');

    const menu = page.locator('[data-menu-button]');
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await page.locator('[data-nav] a[href="#plus"]').click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(new URL(page.url()).hash, '#plus');
    await page.evaluate(() => window.scrollTo(0, 0));
    await menu.click();
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate((el) => el === document.activeElement), true);
    console.log('✓ Mobile menu opens, closes after navigation and restores focus on Escape');

    await page.goto(`${base}/legal.html#privacy`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.match(await page.locator('h1').innerText(), /Legal centre/);
    for (const id of ['privacy', 'terms', 'purchases', 'cookies', 'account-deletion']) assert.equal(await page.locator('#' + id).count(), 1);
    assert.match(await page.locator('.brand').getAttribute('href'), /lang=en/);
    await page.goto(`${base}/?lang=es`);
    assert.equal(await page.locator('html').getAttribute('lang'), 'es');
    console.log('✓ Language persists across pages; explicit language URLs take priority; all legal destinations exist');

    const noStorage = await browser.newContext({ locale: 'en-GB', reducedMotion: 'reduce' });
    await noStorage.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    });
    const blockedPage = await noStorage.newPage();
    await blockedPage.goto(base + '/');
    assert.equal(await blockedPage.locator('html').getAttribute('lang'), 'en');
    await blockedPage.locator('[data-locale="es"]').click();
    assert.equal(await blockedPage.locator('html').getAttribute('lang'), 'es');
    assert.equal(await blockedPage.locator('.kiwi-spinner').evaluate((el) => getComputedStyle(el).animationName), 'none');
    await noStorage.close();
    console.log('✓ Browser-language default, blocked storage and reduced-motion preference');

    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJS.newPage();
    await staticPage.goto(base + '/');
    assert.match(await staticPage.locator('h1').innerText(), /Entiende lo que comes/);
    assert.equal(await staticPage.locator('main section').count(), 10);
    await noJS.close();
    console.log('✓ All ten sections render without JavaScript');

    const catalogue = await context.newPage();
    await catalogue.goto(`${base}/profiles.html?lang=es`);
    await catalogue.locator('.profile-card').first().waitFor();
    assert.equal(await catalogue.locator('.profile-card').count(), 18);
    await catalogue.locator('#profile-query').fill('celiaquia');
    assert.match(await catalogue.locator('.profile-card').first().innerText(), /celiaquía/i);
    await catalogue.locator('[data-kind="diet"]').click();
    assert.equal(await catalogue.locator('.profile-card .card-eyebrow').evaluateAll((all) => all.every((el) => el.textContent === 'DIETA')), true);
    await catalogue.locator('#profile-query').fill('');
    assert.equal(await catalogue.locator('.profile-card').count(), 18);
    await catalogue.locator('[data-kind="other"]').click();
    assert.match(await catalogue.locator('.profile-card').first().innerText(), /Alergia nueva/);
    assert.equal(await catalogue.locator('.profile-card .card-eyebrow').first().innerText(), 'ALERGIA');
    await catalogue.locator('[data-kind="diet"]').click();
    await catalogue.locator('[data-locale="en"]').click();
    assert.match(await catalogue.locator('.profile-card').first().innerText(), /diet/i);
    await catalogue.close();

    const productPage = await context.newPage();
    const productRef = `p1_${'A'.repeat(56)}`;
    let productSearchCalls = 0;
    await productPage.route('https://api.beaki.app/public/products/search?*', async (route) => {
      productSearchCalls++;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ products: [{ productRef, name: 'Yogur natural Beaki', brand: 'Beaki', quantity: '500 g', market: 'ES', categories: ['food.dairy'], completeness: 1, insight: { generalGrade: 8.2 } }] }) });
    });
    await productPage.route(`https://api.beaki.app/public/products/${productRef}`, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ product: { productRef, name: 'Yogur natural Beaki', brand: 'Beaki', quantity: '500 g', market: 'ES', ingredientsText: 'LECHE UHT Y FERMENTOS', allergens: ['en:milk'], traces: ['en:nuts'], nutrientsPer100: { energyKcal: 62, proteinG: 3.7, carbohydratesG: 4.8, fatG: 3.2, saturatedFatG: 2, sugarsG: 4.8, saltG: 0.12 } }, generalGrade: 8.2, generalScoreFactors: [{ code: 'CLEAN_INGREDIENTS', effect: 0.2 }, { code: 'MODERATE_SUGAR', effect: -1 }], ingredientItems: [{ text: 'LECHE UHT', depth: 0, tone: 'NEUTRAL', highlights: [] }, { text: 'FERMENTOS', depth: 0, tone: 'NEUTRAL', highlights: [] }, { text: 'ASPARTAMO', depth: 0, tone: 'NEGATIVE', highlights: [{ start: 0, end: 9, tone: 'NEGATIVE' }] }], micronutrientEstimate: { per100: { calciumMg: 120 }, estimatedKeys: ['calciumMg'], nutritionBasis: 'PER_100_G' } }) });
    });
    await productPage.goto(`${base}/products.html?lang=en`);
    await productPage.locator('#product-query').fill('Yogur natural');
    await productPage.locator('[data-product-form] button').click();
    await productPage.locator('.product-card').waitFor();
    assert.match(await productPage.locator('.product-card').innerText(), /Yogur natural Beaki/);
    assert.equal(await productPage.locator('.product-card .product-score').getAttribute('aria-label'), 'General score: 8.2 out of 10');
    assert.equal(await productPage.locator('.product-card .product-nutrition').count(), 0);
    assert.match(await productPage.locator('.product-card a').getAttribute('href'), /product_name=Yogur\+natural\+Beaki/);
    await productPage.locator('.product-card a').click();
    await productPage.locator('[data-product-detail] h2').waitFor();
    assert.match(await productPage.locator('[data-product-detail]').innerText(), /62 kcal/);
    assert.match(await productPage.locator('[data-product-detail]').innerText(), /8.2\/10/);
    assert.match(await productPage.locator('[data-product-detail]').innerText(), /Milk/);
    assert.equal(await productPage.locator('.product-detail-macro-line span').count(), 3);
    assert.match(await productPage.locator('.product-detail-macro-line').getAttribute('aria-label'), /Protein 31.6 %/);
    assert.equal(await productPage.locator('.product-detail-ingredient-list li').count(), 3);
    assert.equal(await productPage.locator('.product-detail-ingredient-list .ingredient-tone-negative').innerText(), 'Aspartamo');
    assert.match(await productPage.locator('.product-detail-ingredient-list .ingredient-tone-negative').evaluate(el => getComputedStyle(el).color), /rgb\(166, 53, 61\)/);
    assert.equal(await productPage.locator('.product-detail-micronutrients').evaluate(el => el.open), false);
    await productPage.locator('.product-detail-score-breakdown summary').click();
    assert.match(await productPage.locator('.product-detail-score-breakdown').innerText(), /No added sugar or additives/);
    await productPage.locator('.product-detail-micronutrients summary').click();
    assert.match(await productPage.locator('[data-product-detail]').innerText(), /120 mg/);
    await productPage.setViewportSize({ width: 1200, height: 900 });
    assert.equal((await productPage.locator('.product-detail-micronutrients .product-detail-facts').first().evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ').length, 4);
    assert.equal((await productPage.locator('.product-detail-ingredient-list').evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ').length, 3);
    assert.match(productPage.url(), /product_name=Yogur\+natural\+Beaki/);
    assert.match(await productPage.title(), /Yogur natural Beaki/);
    await productPage.goto(`${base}/products.html?product_name=Yogur+natural+Beaki&lang=es`);
    await productPage.locator('[data-product-detail] h2').waitFor();
    assert.deepEqual(await productPage.locator('.product-detail-ingredient-list li').allInnerTexts(), ['Leche UHT', 'Fermentos', 'Aspartamo']);
    const previousSearchCalls = productSearchCalls;
    await productPage.goto(`${base}/products.html?product_name=Yogur+natural+Beaki&product_ref=${productRef}&lang=es`);
    await productPage.locator('[data-product-detail] h2').waitFor();
    assert.equal(productSearchCalls, previousSearchCalls, 'An exact product URL must load by reference without a search');
    assert.match(await productPage.locator('link[rel="canonical"]').getAttribute('href'), /product_ref=p1_/);
    await productPage.close();
    console.log('✓ Public product search and the complete profile catalogue are interactive');

    const links = await page.locator('a[href*="play.google.com"]').evaluateAll((all) => all.map((a) => a.href));
    assert(links.length >= 5 && links.every((href) => href === 'https://play.google.com/store/apps/details?id=com.hacktricks.beaki'));
    assert.deepEqual(errors, []);
    console.log('✓ Store links and no JavaScript, network or HTTP errors');
    await context.close();
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
