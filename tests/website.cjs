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
    context.on('page', (page) => {
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    });
    for (const route of ['/', '/legal.html']) {
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
    await page.locator('[data-nav] a[href="#privacidad"]').click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(new URL(page.url()).hash, '#privacidad');
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
