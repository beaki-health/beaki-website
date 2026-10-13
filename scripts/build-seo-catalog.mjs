#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = JSON.parse(gunzipSync(readFileSync(join(root, 'data/seo-products.json.gz'))));
const products = source.products;
if (products.length !== 10000 || new Set(products.map(p => p.productRef)).size !== products.length) throw new Error('Expected 10,000 unique public products');
const origin = 'https://www.beaki.app';
const date = source.generatedAt.slice(0, 10);
const output = join(root, 'catalogo');
mkdirSync(output, { recursive: true });
for (const file of readdirSync(output)) if (file.endsWith('.html')) unlinkSync(join(output, file));
const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const xml = value => esc(value);
const slug = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55).replace(/-$/,'') || 'producto';
const pathFor = product => `/catalogo/${slug(product.name)}--${product.productRef}.html`;
const fileFor = path => join(root, path === '/catalogo/' ? 'catalogo/index.html' : path.slice(1));
const format = number => new Intl.NumberFormat('es-ES',{maximumFractionDigits:number>0&&number<0.01?4:number>0&&number<1?2:1}).format(number);
const pageShell = (title, description, canonical, body, structured = []) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#EEF1E8"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${origin}/assets/beaki-icon.png"><meta name="twitter:card" content="summary"><link rel="icon" href="/assets/favicon.png" type="image/png"><link rel="stylesheet" href="/styles.css?v=20261013"><link rel="stylesheet" href="/seo-product.css?v=20261013"></head><body><a class="skip-link" href="#main">Saltar al contenido</a><header class="seo-header"><div class="seo-shell seo-header-inner"><a href="/" aria-label="Beaki, inicio"><img src="/assets/beaki-logo.png" alt="Beaki" width="130" height="51"></a><nav aria-label="Navegación principal"><a href="/catalogo/">Catálogo</a><a href="/products.html">Buscar</a><a href="/profiles.html">Dietas y condiciones</a><a href="/#plus">Plus</a></nav></div></header>${body}<footer class="seo-footer seo-shell"><a href="/">Beaki</a><a href="/legal.html#privacy">Privacidad</a><a href="/legal.html#terms">Condiciones</a><p>Información orientativa. Comprueba siempre la etiqueta, especialmente si tienes alergias.</p></footer>${structured.map(data=>`<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`).join('')}</body></html>`;
const splitIngredients = value => {
  if (!value) return [];
  const items=[];let depth=0,start=0;
  for(let i=0;i<value.length;i++){const ch=value[i];if('([{'.includes(ch))depth++;else if(')]}'.includes(ch))depth=Math.max(0,depth-1);else if(depth===0&&(ch===','||ch===';')){items.push(value.slice(start,i));start=i+1}}
  items.push(value.slice(start));
  return items.map(s=>s.trim().replace(/\.$/,'').trim()).filter(Boolean);
};
const labelCase = text => text===text.toLocaleUpperCase('es-ES') ? text.toLocaleLowerCase('es-ES').replace(/\b(uht|dop|igp|e\s*-?\s*\d{3,4}[a-z]{0,3})\b/gi,s=>s.toUpperCase()).replace(/\bph\b/gi,'pH').replace(/[a-záéíóúüñ]/i,s=>s.toUpperCase()) : text;
const itemHtml = item => {
  const tone = ['NEGATIVE','POSITIVE','MIXED'].includes(item.tone) ? item.tone.toLowerCase() : 'neutral';
  const value = labelCase(item.text);
  const highlights = value.length === item.text.length && Array.isArray(item.highlights) ? [...item.highlights].sort((a,b)=>a.start-b.start) : [];
  let contents = '', cursor = 0;
  for (const span of highlights) {
    if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < cursor || span.end > value.length || span.end <= span.start) continue;
    contents += esc(value.slice(cursor,span.start));
    const color = ['NEGATIVE','POSITIVE','MIXED'].includes(span.tone) ? span.tone.toLowerCase() : 'neutral';
    contents += `<span class="seo-ingredient-${color}">${esc(value.slice(span.start,span.end))}</span>`;
    cursor = span.end;
  }
  contents += esc(value.slice(cursor));
  return `<li class="seo-ingredient-${tone}">${contents}</li>`;
};
const facts = [ ['energyKcal','Energía','kcal'],['fatG','Grasas','g'],['saturatedFatG','Grasas saturadas','g'],['carbohydratesG','Hidratos de carbono','g'],['sugarsG','Azúcares','g'],['fibreG','Fibra','g'],['proteinG','Proteínas','g'],['saltG','Sal','g'],['sodiumMg','Sodio','mg'] ];
const allergenNames = {milk:'Leche',eggs:'Huevos',egg:'Huevos',gluten:'Gluten',wheat:'Trigo',soybeans:'Soja',soy:'Soja',peanuts:'Cacahuetes',nuts:'Frutos de cáscara',fish:'Pescado',crustaceans:'Crustáceos',molluscs:'Moluscos',celery:'Apio',mustard:'Mostaza',sesame:'Sésamo',lupin:'Altramuces','sulphur-dioxide-and-sulphites':'Sulfitos'};
const allergen = value => allergenNames[value.replace(/^[a-z]{2}:/,'')] || value.replace(/^[a-z]{2}:/,'').replaceAll('-',' ');
const links = [];
for(const product of products){
  const path=pathFor(product),url=origin+path;
  const display=[product.name,product.brand].filter(Boolean).join(' · ');
  const basis=product.nutritionBasis==='PER_100_ML'?'100 ml':'100 g';
  const nutrition=product.nutrientsPer100||{};
  const description=`Ingredientes, alérgenos, nota general e información nutricional por ${basis} de ${display} en el catálogo Beaki.`;
  const title=`${display} | Ingredientes y nutrición | Beaki`;
  const allergens=[...new Set((product.allergens||[]).filter(x=>!/^(?:[a-z]{2}:)?(?:none|no|n\/a|ninguno)$/i.test(x)).map(allergen))];
  const ingredients=product.ingredientItems?.length ? product.ingredientItems : splitIngredients(product.ingredientsText).map(text=>({text,tone:'NEUTRAL'}));
  const detailUrl=`/products.html?product_name=${encodeURIComponent(product.name)}&product_ref=${encodeURIComponent(product.productRef)}&lang=es`;
  const grade=Number.isFinite(product.generalGrade)?`${format(product.generalGrade)}/10`:'—/10';
  const rows=facts.filter(([key])=>Number.isFinite(nutrition[key])).map(([key,name,unit])=>`<div class="seo-fact"><dt>${name}</dt><dd>${format(nutrition[key])} ${unit}</dd></div>`).join('');
  const body=`<main class="seo-shell seo-product" id="main"><nav class="seo-breadcrumb" aria-label="Ruta"><a href="/">Inicio</a><span>›</span><a href="/catalogo/">Catálogo de productos</a><span>›</span><span>${esc(product.name)}</span></nav><article class="seo-glass"><div class="seo-hero"><div><p class="seo-eyebrow">${esc(product.brand||'Producto Beaki')}</p><h1>${esc(product.name)}</h1><p class="seo-meta">${esc([product.quantity,product.market].filter(Boolean).join(' · '))}</p></div><div class="seo-grade"><span>Nota general</span><strong>${grade}</strong><small>Sin aplicar tu perfil personal</small></div></div><div class="seo-intro"><p>Consulta los datos de la etiqueta y la nota general de este producto en Beaki. La nota personalizada y las recomendaciones están disponibles en la app.</p><a class="seo-button" href="${esc(detailUrl)}">Ver ficha completa y micronutrientes ↗</a></div><section><h2>Información nutricional <small>/ ${basis}</small></h2><dl class="seo-facts">${rows}</dl></section><section><h2>Alérgenos</h2><p>${allergens.length?`Declarados: ${esc(allergens.join(', '))}`:'No constan alérgenos declarados en los datos disponibles.'}</p></section><section><h2>Ingredientes</h2>${ingredients.length>1?`<ul class="seo-ingredients">${ingredients.map(itemHtml).join('')}</ul>`:`<p>${esc(labelCase(product.ingredientsText||'Ingredientes no disponibles.'))}</p>`}</section><p class="seo-caution">Los datos del catálogo pueden estar incompletos o desactualizados. Comprueba siempre la etiqueta del envase.</p><a class="seo-app" href="https://api.beaki.app/product/${encodeURIComponent(product.productRef)}">Ver en la app Beaki ↗</a></article></main>`;
  const structured=[{'@context':'https://schema.org','@type':'Product',name:product.name,...(product.brand?{brand:{'@type':'Brand',name:product.brand}}:{}),description,url,category:'Alimentos',additionalProperty:facts.filter(([key])=>Number.isFinite(nutrition[key])).map(([key,name,unit])=>({'@type':'PropertyValue',name:`${name} por ${basis}`,value:`${format(nutrition[key])} ${unit}`}))},{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:origin+'/'},{'@type':'ListItem',position:2,name:'Catálogo',item:origin+'/catalogo/'},{'@type':'ListItem',position:3,name:product.name,item:url}]}];
  writeFileSync(fileFor(path),pageShell(title,description,url,body,structured));
  links.push({product,path});
}
const pageSize=200,totalPages=Math.ceil(links.length/pageSize);
for(let page=0;page<totalPages;page++){
  const path=page===0?'/catalogo/':'/catalogo/page-'+String(page+1).padStart(3,'0')+'.html';
  const url=origin+path;
  const subset=links.slice(page*pageSize,(page+1)*pageSize);
  const title=`Catálogo de productos Beaki · Página ${page+1} | Beaki`;
  const description=`Explora productos del catálogo Beaki: ingredientes, alérgenos y nutrición. Página ${page+1} de ${totalPages}.`;
  const pagination=`<nav class="seo-pagination" aria-label="Páginas del catálogo">${page?`<a rel="prev" href="${page===1?'/catalogo/':'/catalogo/page-'+String(page).padStart(3,'0')+'.html'}">← Anterior</a>`:''}<span>Página ${page+1} de ${totalPages}</span>${page<totalPages-1?`<a rel="next" href="/catalogo/page-${String(page+2).padStart(3,'0')}.html">Siguiente →</a>`:''}</nav>`;
  const body=`<main class="seo-shell seo-list" id="main"><p class="seo-eyebrow">CATÁLOGO DE PRODUCTOS</p><h1>Explora alimentos en Beaki</h1><p>Ingredientes, alérgenos, información nutricional y nota general de productos reales del catálogo. Busca uno concreto o recorre esta selección de alimentos habituales.</p><a class="seo-button" href="/products.html">Buscar en todo el catálogo →</a>${pagination}<div class="seo-list-grid">${subset.map(({product,path})=>`<a class="seo-list-card" href="${esc(path)}"><span>${esc(product.brand||'Producto Beaki')}</span><strong>${esc(product.name)}</strong><small>${esc(product.quantity||'')} · ${format(product.generalGrade)}/10</small></a>`).join('')}</div>${pagination}</main>`;
  writeFileSync(fileFor(path),pageShell(title,description,url,body));
}
const sitemap = urls => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({loc,lastmod})=>`<url><loc>${xml(loc)}</loc>${lastmod?`<lastmod>${lastmod}</lastmod>`:''}</url>`).join('\n')}\n</urlset>\n`;
const mainPages=['/','/legal.html','/products.html','/profiles.html',...Array.from({length:totalPages},(_,i)=>i?`/catalogo/page-${String(i+1).padStart(3,'0')}.html`:'/catalogo/')];
writeFileSync(join(root,'sitemap-pages.xml'),sitemap(mainPages.map(path=>({loc:origin+path,lastmod:date}))));
const chunks=[];
for(let start=0;start<links.length;start+=2000){const file=`sitemap-products-${String(chunks.length+1).padStart(3,'0')}.xml`;writeFileSync(join(root,file),sitemap(links.slice(start,start+2000).map(({product,path})=>({loc:origin+path,lastmod:product.lastmod}))));chunks.push(file)}
writeFileSync(join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['sitemap-pages.xml',...chunks].map(file=>`<sitemap><loc>${origin}/${file}</loc><lastmod>${date}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
writeFileSync(join(root,'seo-refs.json'),JSON.stringify(products.map(p=>p.productRef)));
console.log(`Generated ${links.length} product pages, ${totalPages} catalogue pages and ${chunks.length} product sitemaps`);
