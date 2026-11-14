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
    .replace(/<main id="pageContent"[\s\S]*?<\/main>/,()=>`<main id="pageContent" class="page-content min-h-[calc(100vh-126px)] min-h-[calc(100vh-126px)]" aria-live="polite">${content}</main>`);
  if(origin) result=result.replace('</head>',`  <link rel="canonical" href="${esc(origin+pathname)}">\n</head>`);
  return result;
}
function page({title, intro, content, description, pathname}) {
  return documentPage({title,description,pathname,content:`<div class="content-wrap mx-auto max-w-[1320px] px-[clamp(18px,4vw,56px)] pb-[50px] pt-[35px] max-[760px]:px-[15px] max-[760px]:pt-[27px] max-[760px]:pb-9"><div class="page-heading mb-6 flex items-end justify-between gap-[18px] max-[760px]:flex-col max-[760px]:items-start [&_h1]:m-0 [&_h1]:text-[30px] [&_h1]:font-extrabold [&_h1]:tracking-[-.8px] [&_p]:mt-[5px] [&_p]:mb-0 [&_p]:text-xs [&_p]:text-atlas-muted max-[760px]:[&_h1]:text-[26px]"><div><h1>${esc(intro)}</h1></div></div>${content}</div>`});
}
async function renderSeo(pathname, pool, getHeroDetails) {
  if(pathname==='/heroes') {
    const {rows}=await pool.query('SELECT name,slug FROM heroes ORDER BY name');
    return page({title:'Герои Dota 2 — Dota Atlas',description:'Каталог героев Dota 2: характеристики, роли и способности.',intro:'Герои Dota 2',pathname,content:`<p>Выберите героя, чтобы посмотреть характеристики и способности.</p><div class="catalog-grid grid grid-cols-[repeat(4,minmax(0,1fr))] gap-[15px] max-[1050px]:grid-cols-[repeat(3,minmax(0,1fr))] max-[760px]:grid-cols-2 max-[760px]:gap-[10px] max-[420px]:grid-cols-1">${rows.map(h=>`<a class="hero-card no-underline text-inherit min-w-0 rounded-[11px] border border-[#292e38] bg-atlas-panel p-4 transition hover:-translate-y-0.5 hover:border-[#6b3b35] cursor-pointer [&_h3]:mb-[5px] [&_h3]:mt-0 [&_h3]:text-[15px] [&_h3]:[overflow-wrap:anywhere] max-[760px]:p-[11px] max-[760px]:[&_h3]:text-[13px] max-[420px]:grid max-[420px]:grid-cols-[95px_1fr] max-[420px]:gap-x-3 max-[420px]:[&_.hero-art]:row-span-4 max-[420px]:[&_.hero-art]:h-[94px] max-[420px]:[&_.hero-art]:m-0 max-[420px]:[&_.card-stats]:col-start-2 max-[420px]:[&_.tags]:col-start-2 max-[420px]:[&_.card-actions]:col-span-full max-[420px]:[&_.hero-emblem]:h-10 max-[420px]:[&_.hero-emblem]:w-10 max-[420px]:[&_.hero-emblem]:text-[19px]" href="/heroes/${encodeURIComponent(h.slug)}">${esc(h.name)}</a>`).join('')}</div>`});
  }
  if(pathname==='/items') {
    const {rows}=await pool.query('SELECT name,cost,description FROM items ORDER BY name');
    return page({title:'Предметы Dota 2 — Dota Atlas',description:'Предметы Dota 2: стоимость и описание эффектов.',intro:'Предметы Dota 2',pathname,content:`<div class="catalog-grid grid grid-cols-[repeat(4,minmax(0,1fr))] gap-[15px] max-[1050px]:grid-cols-[repeat(3,minmax(0,1fr))] max-[760px]:grid-cols-2 max-[760px]:gap-[10px] max-[420px]:grid-cols-1">${rows.map(i=>`<article class="item-card no-underline text-inherit min-w-0 rounded-[11px] border border-[#292e38] bg-atlas-panel p-4 transition hover:-translate-y-0.5 hover:border-[#6b3b35] [&_h3]:mb-[5px] [&_h3]:mt-0 [&_h3]:text-[15px] [&_h3]:[overflow-wrap:anywhere] [&_p]:min-h-12 [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:text-atlas-muted max-[760px]:p-[11px] max-[760px]:[&_h3]:text-[13px]"><h2>${esc(i.name)}</h2><p>${esc(i.description)}</p><p>Стоимость: ${esc(i.cost)} золота</p></article>`).join('')}</div>`});
  }
  const match=pathname.match(/^\/heroes\/([a-z0-9-]+)$/);
  if(match){
    const {rows}=await pool.query('SELECT id FROM heroes WHERE slug=$1',[match[1]]); if(!rows.length)return false;
    const h=await getHeroDetails(rows[0].id); if(!h)return false;
    const title=`${h.name} — характеристики и способности | Dota Atlas`;
    const description=`${h.name} в Dota 2: ${h.primary_attribute}, ${h.attack_type.toLowerCase()}, характеристики и способности.`;
    const abilities=h.abilities.map(a=>`<article class="ability rounded-lg border border-[#2c303a] bg-[#14171d] p-[14px] [&_h3]:mb-1 [&_h3]:mt-0 [&_h3]:text-xs [&_h4]:mb-1 [&_h4]:mt-0 [&_h4]:text-xs [&_p]:m-0 [&_p]:text-[11px]"><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></article>`).join('');
    return page({title,description,intro:h.name,pathname,content:`<p>${esc(h.lore)}</p><h2>Характеристики</h2><p>${esc(h.primary_attribute)} · ${esc(h.attack_type)} · здоровье ${esc(h.base_health)} · мана ${esc(h.base_mana)} · броня ${esc(h.armor)}</p><h2>Способности</h2><div class="ability-list max-[760px]:grid-cols-1 grid grid-cols-2 gap-[10px] max-[760px]:grid-cols-1">${abilities}</div><p><a href="/heroes">Все герои</a></p>`});
  }
  if(pathname==='/') return documentPage({title:'Dota Atlas — вся Dota 2 в одной вики',description:'Dota Atlas — русскоязычная вики по Dota 2: герои, предметы, патчи и гайды.',pathname,content:'<section class="home-hero bg-[radial-gradient(ellipse_at_50%_18%,#25212a_0%,#151821_44%,#151922_75%)] px-6 pb-[54px] pt-[66px] text-center max-[760px]:px-[17px] max-[760px]:pt-12 max-[760px]:pb-9 [&_h1]:mx-auto [&_h1]:mb-3 [&_h1]:text-[clamp(34px,4.1vw,56px)] [&_h1]:font-extrabold [&_h1]:leading-[1.1] [&_h1]:tracking-[-1.8px] [&_h1_span]:text-[#f0f0f2] [&_p]:m-0 [&_p]:text-sm [&_p]:text-atlas-muted max-[760px]:[&_h1]:text-[37px] max-[760px]:[&_p]:mx-auto max-[760px]:[&_p]:max-w-[410px] max-[760px]:[&_p]:text-xs"><h1>Вся Dota 2 в одной вики</h1><p>Герои, предметы, патчи и гайды на русском.</p><p><a href="/heroes">Герои</a> · <a href="/items">Предметы</a></p></section>'});
  return null;
}
async function sitemap(pool) {
  const origin=siteUrl(); if(!origin)return null;
  const {rows}=await pool.query('SELECT slug FROM heroes ORDER BY slug');
  const urls=['/','/heroes','/items',...rows.map(h=>'/heroes/'+encodeURIComponent(h.slug))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${esc(origin+u)}</loc></url>`).join('')}</urlset>`;
}
module.exports={renderSeo,sitemap,siteUrl};
