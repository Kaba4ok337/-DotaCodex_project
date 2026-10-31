'use strict';
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function siteUrl() {
  if (!process.env.SITE_URL) return null;
  try { const u = new URL(process.env.SITE_URL); if (!['http:','https:'].includes(u.protocol) || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw Error(); return u.origin; }
  catch { throw new Error('SITE_URL должен содержать только адрес сайта, например https://example.com'); }
}
function documentPage({title,description,content,pathname}) {
  const origin=siteUrl();
  let result=html.replace(/<title>[^<]*<\/title>/,`<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(description)}">`)
    .replace(/<main id="pageContent"[\s\S]*?<\/main>/,()=>`<main id="pageContent" class="page-content min-h-[calc(100vh-126px)]" aria-live="polite">${content}</main>`);
  if(origin) result=result.replace('</head>',`  <link rel="canonical" href="${esc(origin+pathname)}">\n</head>`);
  return result;
}
function page({title, intro, content, description, pathname}) {
  return documentPage({title,description,pathname,content:`<div class="content-wrap"><div class="page-heading"><div><h1>${esc(intro)}</h1></div></div>${content}</div>`});
}
async function renderSeo(pathname, pool, getHeroDetails) {
  if(pathname==='/heroes') {
    const {rows}=await pool.query('SELECT name,slug FROM heroes ORDER BY name');
    return page({title:'Герои Dota 2 — Dota Atlas',description:'Каталог героев Dota 2: характеристики, роли и способности.',intro:'Герои Dota 2',pathname,content:`<p>Выберите героя, чтобы посмотреть характеристики и способности.</p><div class="catalog-grid">${rows.map(h=>`<a class="hero-card" href="/heroes/${encodeURIComponent(h.slug)}">${esc(h.name)}</a>`).join('')}</div>`});
  }
  if(pathname==='/items') {
    const {rows}=await pool.query('SELECT name,cost,description FROM items ORDER BY name');
    return page({title:'Предметы Dota 2 — Dota Atlas',description:'Предметы Dota 2: стоимость и описание эффектов.',intro:'Предметы Dota 2',pathname,content:`<div class="catalog-grid">${rows.map(i=>`<article class="item-card"><h2>${esc(i.name)}</h2><p>${esc(i.description)}</p><p>Стоимость: ${esc(i.cost)} золота</p></article>`).join('')}</div>`});
  }
  const match=pathname.match(/^\/heroes\/([a-z0-9-]+)$/);
  if(match){
    const {rows}=await pool.query('SELECT id FROM heroes WHERE slug=$1',[match[1]]); if(!rows.length)return false;
    const h=await getHeroDetails(rows[0].id); if(!h)return false;
    const title=`${h.name} — характеристики и способности | Dota Atlas`;
    const description=`${h.name} в Dota 2: ${h.primary_attribute}, ${h.attack_type.toLowerCase()}, характеристики и способности.`;
    const abilities=h.abilities.map(a=>`<article class="ability"><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></article>`).join('');
    return page({title,description,intro:h.name,pathname,content:`<p>${esc(h.lore)}</p><h2>Характеристики</h2><p>${esc(h.primary_attribute)} · ${esc(h.attack_type)} · здоровье ${esc(h.base_health)} · мана ${esc(h.base_mana)} · броня ${esc(h.armor)}</p><h2>Способности</h2><div class="ability-list">${abilities}</div><p><a href="/heroes">Все герои</a></p>`});
  }
  if(pathname==='/') return documentPage({title:'Dota Atlas — вся Dota 2 в одной вики',description:'Dota Atlas — русскоязычная вики по Dota 2: герои, предметы, патчи и гайды.',pathname,content:'<section class="home-hero"><h1>Вся Dota 2 в одной вики</h1><p>Герои, предметы, патчи и гайды на русском.</p><p><a href="/heroes">Герои</a> · <a href="/items">Предметы</a></p></section>'});
  return null;
}
async function sitemap(pool) {
  const origin=siteUrl(); if(!origin)return null;
  const {rows}=await pool.query('SELECT slug FROM heroes ORDER BY slug');
  const urls=['/','/heroes','/items',...rows.map(h=>'/heroes/'+encodeURIComponent(h.slug))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${esc(origin+u)}</loc></url>`).join('')}</urlset>`;
}
module.exports={renderSeo,sitemap,siteUrl};
