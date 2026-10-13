#!/usr/bin/env node
// Run only after the pages and the root key file are live.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { key, file } = JSON.parse(readFileSync(resolve(root, 'indexnow-key.json'), 'utf8'));
const host = 'www.beaki.app';
const keyLocation = `https://${host}/${file}`;
const keyResponse = await fetch(keyLocation);
if (!keyResponse.ok || (await keyResponse.text()).trim() !== key) throw new Error('IndexNow key is not live at the site root');

const urls = [];
for (const sitemap of ['sitemap-pages.xml', ...Array.from({ length: 5 }, (_, i) => `sitemap-products-${String(i + 1).padStart(3, '0')}.xml`)]) {
  const xml = readFileSync(resolve(root, sitemap), 'utf8');
  for (const match of xml.matchAll(/<loc>(https:\/\/www\.beaki\.app\/[^<]*)<\/loc>/g)) urls.push(match[1].replaceAll('&amp;', '&'));
}
if (urls.length !== 10054 || new Set(urls).size !== urls.length) throw new Error(`Expected 10,054 unique sitemap URLs, got ${urls.length}`);

for (let offset = 0; offset < urls.length; offset += 2000) {
  const urlList = urls.slice(offset, offset + 2000);
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation, urlList })
  });
  console.log(`${offset + 1}-${offset + urlList.length}: HTTP ${response.status}`);
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow rejected batch: ${response.status} ${(await response.text()).slice(0, 300)}`);
}
