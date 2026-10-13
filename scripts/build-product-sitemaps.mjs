#!/usr/bin/env node
// Build URL-only sitemaps from a temporary export of public Beaki products.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/build-product-sitemaps.mjs <seo-products.json.gz>');
const root = resolve(import.meta.dirname, '..');
const { generatedAt, products } = JSON.parse(gunzipSync(readFileSync(sourcePath)));
if (products.length !== 10000 || new Set(products.map(p => p.productRef)).size !== products.length) throw new Error('Expected 10,000 unique product references');
const origin = 'https://www.beaki.app';
const date = generatedAt.slice(0, 10);
const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const productUrl = product => {
  const url = new URL('/products.html', origin);
  url.searchParams.set('product_name', product.name);
  url.searchParams.set('product_ref', product.productRef);
  url.searchParams.set('lang', 'es');
  return url.href;
};
const sitemap = entries => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ url, lastmod }) => `<url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
const pages = ['/', '/legal.html', '/products.html', '/profiles.html'];
writeFileSync(resolve(root, 'sitemap-pages.xml'), sitemap(pages.map(path => ({ url: origin + path, lastmod: date }))));
const files = ['sitemap-pages.xml'];
for (let start = 0; start < products.length; start += 2000) {
  const file = `sitemap-products-${String(start / 2000 + 1).padStart(3, '0')}.xml`;
  const entries = products.slice(start, start + 2000).map(product => ({ url: productUrl(product), lastmod: product.lastmod }));
  writeFileSync(resolve(root, file), sitemap(entries));
  files.push(file);
}
writeFileSync(resolve(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map(file => `<sitemap><loc>${origin}/${file}</loc><lastmod>${date}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
console.log(`Generated ${products.length} query URLs in ${files.length} sitemaps; no product pages or data snapshot written`);
