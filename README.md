# Beaki website

Public landing page for [Beaki](https://www.beaki.app), hosted with GitHub Pages. The Liquid Glass design follows the October 2026 design handoff, including all ten sections, illustrative app previews and the interactive Lucía / Ana profile switch.

The production site uses semantic HTML, responsive CSS and vanilla JavaScript. Fonts, logos, the kiwi spinner and MIT-licensed Ionicons are served locally. There are no production dependencies or scroll-driven animations. Legal content is preserved in English and Spanish.

The public [product search](/products.html) uses the Beaki search index through `GET https://api.beaki.app/public/products/search` and reads product details through `GET /public/products/{productRef}`. Product links include `?product_name=...&product_ref=...` so a URL opens the matching product and updates its page metadata. It does not show signed-in, profile-specific scores. The [diet and condition catalogue](/profiles.html) is a static bilingual snapshot of `../Beaki/apps/mobile/data/catalogues/profile_concepts.json` (version recorded in `assets/profile-catalog.json`). Entries without a concept description use the definition in `../Beaki/docs/profiles/`, with a concise English translation. Refresh the snapshot when the app catalogue changes.

## Product SEO catalogue

`/catalogo/` links to 10,000 pre-rendered Spanish product pages with public Beaki data, unique canonical URLs and Product/Breadcrumb structured data. Product search links to these pages when a product is in the snapshot; existing `?product_name=...&product_ref=...` links still work. `sitemap.xml` indexes the page and product sitemaps, and `robots.txt` advertises the index.

The selection samples evaluation-ready Spanish food products across common grocery search terms. It is a varied catalogue selection, not a ranking based on sales or search volume. Product `lastmod` comes from the source observation date. Refresh it after a material catalogue update:

```sh
cd ../Beaki
AWS_PROFILE=naxusai-admin node --import tsx scripts/export-seo-products.mjs ../beaki-website/data/seo-products.json.gz
cd ../beaki-website
npm run build:seo
npm test
```

The exporter reads the Beaki search and core DynamoDB tables, emits only public product fields and opaque product references, and never writes the reference secret to the website. Once a new snapshot is live, `npm run submit:indexnow` submits the published URLs to IndexNow. Submission is a discovery hint and does not guarantee indexing. Google discovers the sitemap through `robots.txt`; submitting it directly in Search Console requires access to the verified property.

## Local preview

From this directory, run `python3 -m http.server 8080` and open `http://localhost:8080/`. Absolute asset paths require the repository to be the server root.

## Languages and accessibility

Use the ES / EN buttons in the header, or open `/?lang=es` and `/?lang=en`. Legal pages accept the same parameter. Explicit language URLs override saved preferences; otherwise the site uses the saved choice or browser language. Links carry the language between pages, including when local storage is unavailable.

The mobile navigation closes after selecting a section and on Escape. Profile tabs support arrow keys, Home and End. The site honours reduced-motion preferences, and the Spanish content remains available without JavaScript.

## Browser checks

```sh
npm ci
npx playwright install chromium webkit
npm test
PLAYWRIGHT_ENGINE=webkit npm test
```

To use an installed Google Chrome browser, run `PLAYWRIGHT_CHANNEL=chrome npm test`.

The checks cover English and Spanish on all four pages at widths from 320px to 1440px; horizontal overflow; clipped preview text; translations; images and anchors; WCAG accessibility scans; product and catalogue search; profile and language switching; mobile navigation; saved and explicit language preferences; blocked storage; reduced motion; and rendering without JavaScript. Test dependencies are only needed for development.

## Deployment

GitHub Pages publishes the repository root of the `main` branch. Push verified changes to `origin/main` to publish. The `CNAME` file binds the site to `www.beaki.app`; DNS for the apex and `www` is managed in the private Beaki infrastructure repository.
