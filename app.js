'use strict';

const state = {
  page: 'home', q: '', heroes: [], items: [], patches: [], guides: [], stats: {},
  selectedHero: null, selectedGuide: null, itemCategory: 'Все', attribute: 'Все', role: 'Все', attackType: 'Все', selectedPatch: null,
  compareLeft: '', compareRight: ''
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const splitTags = value => String(value || '').split(';').map(x => x.trim()).filter(Boolean);
const number = value => Number(value || 0).toLocaleString('ru-RU');
const formatDate = value => { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}); };
const emblem = name => ({'Axe':'A','Crystal Maiden':'CM','Juggernaut':'J','Lina':'L','Drow Ranger':'DR','Pudge':'P'}[name] || String(name || 'D').slice(0,2).toUpperCase());

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type':'application/json', ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Ошибка API ${response.status}`);
  return body;
}
function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
}
function iconText(name) { return ({heroes:'◈',items:'◇',patches:'↟',guides:'▤',compare:'⇄'}[name] || '✦'); }
function heroArt(hero, large = false) {
  return `<div class="hero-art${large ? ' large-art' : ''}"><small>${escapeHtml(hero.primary_attribute)}</small><span class="hero-emblem">${escapeHtml(emblem(hero.name))}</span></div>`;
}
function heroCard(hero) {
  return `<article class="hero-card" tabindex="0" role="button" data-hero-id="${hero.id}" aria-label="Открыть героя ${escapeHtml(hero.name)}">
    ${heroArt(hero)}<h3>${escapeHtml(hero.name)}</h3><p class="subline">${escapeHtml(hero.attack_type)} · ${hero.ability_count || 0} способностей</p>
    <div class="tags">${splitTags(hero.roles).slice(0,3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="card-stats"><span>Здоровье ${number(hero.base_health)}</span><span>Броня ${Number(hero.armor).toFixed(1)}</span></div>
  </article>`;
}
function itemCard(item) {
  const marker = ({'Расходуемые':'✦','Атака':'⚔','Мобильность':'↗','Защита':'⬡','Поддержка':'✚','Улучшение':'✧','Атрибуты':'◇'}[item.category] || '✧');
  return `<article class="item-card"><div class="item-art">${marker}</div><div class="tags"><span class="tag">${escapeHtml(item.category)}</span></div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="card-stats"><span>Стоимость</span><span class="item-cost">${number(item.cost)} <small>g</small></span></div><div class="detail-section"><b class="small-label">ЭФФЕКТ</b><p>${escapeHtml(item.effect || item.bonuses || 'Нет описания')}</p></div></article>`;
}
function patchChip(patch, active) {
  return `<button class="patch-selector${active?' active':''}" data-patch-id="${patch.id}"><span>◷</span><span><strong>${escapeHtml(patch.version)}</strong><small>${escapeHtml(formatDate(patch.release_date))}</small></span></button>`;
}
function guideCard(guide) {
  return `<article class="guide-card"><div class="guide-top"><span class="tag">${escapeHtml(guide.hero_name)} · ${escapeHtml(guide.patch_version)}</span><span class="guide-rating">★ ${Number(guide.rating).toFixed(1)}</span></div><h3>${escapeHtml(guide.title)}</h3><p class="guide-desc">${escapeHtml(guide.description)}</p><div class="tags"><span class="tag">${escapeHtml(guide.role)}</span>${guide.is_outdated ? '<span class="tag">Возможно устарел</span>' : '<span class="tag">Актуален для версии</span>'}</div><div class="guide-bottom"><span>Автор: ${escapeHtml(guide.author)}</span><span>${number(guide.views)} просмотров</span></div><div class="card-actions"><button class="btn-secondary" data-guide-id="${guide.id}">Открыть гайд →</button></div></article>`;
}
function heading(kicker, title, subtitle, right = '') {
  return `<div class="page-heading"><div><div class="section-kicker">${escapeHtml(kicker)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>${right}</div>`;
}
function navigate(page, { query = '', reset = true } = {}) {
  state.page = page; state.q = query;
  if (reset) { state.selectedHero = null; state.selectedGuide = null; }
  $$('.main-nav [data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  if ($('#globalSearch').value !== query) $('#globalSearch').value = query;
  renderPage(); window.scrollTo({top:0,behavior:'smooth'});
}

function renderHome() {
  const featured = state.heroes.slice(0,3);
  const latestPatch = state.patches[0];
  return `<section class="home-hero"><div class="eyebrow">GAME KNOWLEDGE BASE</div><h1>Вся Dota 2 <span>в одной вики</span></h1><p>Герои, предметы, патчи и гайды на русском — с пометкой об актуальности.</p>
      <form id="homeSearchForm" class="hero-search"><input id="homeSearch" type="search" placeholder="Найти героя, предмет или гайд…" value="${escapeHtml(state.q)}" autocomplete="off"><button class="btn-primary" type="submit">Найти</button></form>
      <div class="quick-tags"><button data-quick-role="Керри">Керри</button><button data-quick-role="Поддержка">Поддержка</button><button data-quick-role="Нукер">Нукер</button><button data-quick-role="Новичкам">Новичкам</button></div></section>
    <section class="home-features"><article class="feature-card"><span class="feature-icon">◈</span><h2>Герои</h2><p>Способности, таланты и роли</p><button data-page="heroes">Открыть →</button></article><article class="feature-card"><span class="feature-icon">◇</span><h2>Предметы</h2><p>Рецепты, цены и эффекты</p><button data-page="items">Открыть →</button></article><article class="feature-card"><span class="feature-icon">▤</span><h2>Гайды</h2><p>Сборки от авторов, с модерацией</p><button data-page="guides">Открыть →</button></article></section>
    <section class="patch-callout"><span class="version-badge">${escapeHtml(latestPatch?.version || '7.xx')}</span><p><b>Последний патч:</b> ${escapeHtml(latestPatch?.summary || 'История изменений игрового баланса')}</p><button class="btn-primary" data-page="patches">Читать</button></section>
    <section class="content-wrap home-lower"><div class="page-heading"><div><div class="section-kicker">HERO SPOTLIGHT</div><h1>С чего начнём?</h1><p>Несколько героев из демонстрационного каталога.</p></div><button class="btn-secondary" data-page="heroes">Весь каталог →</button></div><div class="catalog-grid">${featured.map(heroCard).join('')}</div></section>`;
}
function renderHeroDetail(hero) {
  return `<section id="heroDetail" class="detail-panel"><div class="detail-top"><div>${heroArt(hero,true)}<button class="btn-ghost" data-close-detail="hero">← Назад к каталогу</button></div><div><div class="section-kicker">КАРТОЧКА ГЕРОЯ</div><h2>${escapeHtml(hero.name)}</h2><div class="subline">${escapeHtml(hero.primary_attribute)} · ${escapeHtml(hero.attack_type)}</div><div class="tags detail-tags">${splitTags(hero.roles).map(role => `<span class="tag">${escapeHtml(role)}</span>`).join('')}</div><p>${escapeHtml(hero.lore)}</p><div class="stat-tiles"><div class="stat-tile"><span>Здоровье</span><strong>${number(hero.base_health)}</strong></div><div class="stat-tile"><span>Мана</span><strong>${number(hero.base_mana)}</strong></div><div class="stat-tile"><span>Броня</span><strong>${Number(hero.armor).toFixed(1)}</strong></div><div class="stat-tile"><span>Способности</span><strong>${hero.abilities.length}</strong></div></div><div class="form-actions"><button class="btn-secondary" data-favorite-hero="${hero.id}">☆ В избранное</button><button class="btn-secondary" data-compare-hero="${hero.id}">Добавить к сравнению</button></div></div></div>
    <div class="detail-section"><h3>Способности</h3><div class="ability-list">${hero.abilities.map(a => `<article class="ability"><div class="tags"><span class="tag">${escapeHtml(a.ability_type)}</span></div><h4>${escapeHtml(a.name)}</h4><p>${escapeHtml(a.description)}</p><p class="subline">Мана: ${escapeHtml(a.mana_cost)} · Перезарядка: ${escapeHtml(a.cooldown)}</p></article>`).join('')}</div></div>
    <div class="detail-section"><h3>Таланты</h3><div class="talents">${hero.talents.map(t => `<div class="talent-row"><span class="talent-level">Ур. ${t.level}</span><span>${escapeHtml(t.left_talent)}</span><span>${escapeHtml(t.right_talent)}</span></div>`).join('') || '<div class="empty-state">Для этого героя ещё не внесены таланты.</div>'}</div></div>
    <div class="detail-section"><h3>Предметы из учебных гайдов</h3><div class="recommended">${hero.recommended_items.map(item => `<div class="recommended-item">${escapeHtml(item.name)} <strong>${number(item.cost)} g</strong></div>`).join('') || '<span class="subline">Рекомендации пока отсутствуют.</span>'}</div></div><p class="form-help">Данные карточки — демонстрационные примеры для проектирования интерфейса и БД.</p></section>`;
}
function renderHeroes() {
  const filtered = state.heroes.filter(h => (!state.q || `${h.name} ${h.roles} ${h.primary_attribute}`.toLowerCase().includes(state.q.toLowerCase())) && (state.attribute === 'Все' || h.primary_attribute === state.attribute) && (state.role === 'Все' || h.roles.includes(state.role)) && (state.attackType === 'Все' || h.attack_type === state.attackType));
  return `<div class="content-wrap">${heading('СПРАВОЧНИК · ГЕРОИ','Герои','Изучай характеристики, способности и игровые роли.',`<span class="count-pill">${filtered.length} героев</span>`)}
    <div class="filter-row"><span class="filter-label">Атрибут</span>${['Все','Сила','Ловкость','Интеллект','Универсальный'].map(x=>`<button class="chip${state.attribute===x?' active':''}" data-filter-attribute="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div>
    <div class="filter-row"><span class="filter-label">Роль</span>${['Все','Керри','Поддержка','Нукер','Инициатор','Танк'].map(x=>`<button class="chip${state.role===x?' active':''}" data-filter-role="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}<span class="filter-label ml-3">Атака</span>${['Все','Ближний бой','Дальний бой'].map(x=>`<button class="chip${state.attackType===x?' active':''}" data-filter-attack="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div>
    <div class="catalog-grid">${filtered.map(heroCard).join('') || '<div class="empty-state">Герои не найдены. Попробуй изменить фильтры.</div>'}</div>${state.selectedHero ? renderHeroDetail(state.selectedHero) : ''}</div>`;
}
function renderItems() {
  const filtered = state.items.filter(item => (!state.q || `${item.name} ${item.category} ${item.description} ${item.effect}`.toLowerCase().includes(state.q.toLowerCase())) && (state.itemCategory === 'Все' || item.category === state.itemCategory));
  const categories = ['Все', ...new Set(state.items.map(item => item.category))];
  return `<div class="content-wrap">${heading('СПРАВОЧНИК · СНАРЯЖЕНИЕ','Предметы','Стоимость, категории, эффекты и назначение предметов.',`<span class="count-pill">${filtered.length} предметов</span>`)}<div class="filter-row"><span class="filter-label">Категория</span>${categories.map(x=>`<button class="chip${state.itemCategory===x?' active':''}" data-filter-category="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div><div class="catalog-grid">${filtered.map(itemCard).join('') || '<div class="empty-state">Предметы не найдены.</div>'}</div></div>`;
}
function renderPatches() {
  const patches = state.patches.filter(p => !state.q || `${p.version} ${p.summary} ${p.changes.map(c=>c.description).join(' ')}`.toLowerCase().includes(state.q.toLowerCase()));
  const chosen = patches.find(p => p.id === state.selectedPatch) || patches[0];
  if (chosen) state.selectedPatch = chosen.id;
  return `<div class="content-wrap">${heading('ИСТОРИЯ ОБНОВЛЕНИЙ','Патчи','Изменения баланса с привязкой к героям и предметам.',`<span class="count-pill">${patches.length} версий</span>`)}<div class="patch-layout"><aside class="patch-side"><h3>Версии патчей</h3><div class="patch-timeline">${patches.map(p=>patchChip(p,chosen?.id===p.id)).join('') || '<p class="subline">Версий нет.</p>'}</div></aside><section class="patch-main">${chosen ? `<article class="patch-main-head"><div class="section-kicker">PATCH NOTES</div><div class="patch-ver">${escapeHtml(chosen.version)}</div><p>${escapeHtml(formatDate(chosen.release_date))}</p><p>${escapeHtml(chosen.summary)}</p></article>${chosen.changes.map(c=>`<article class="change-card"><span class="change-type ${escapeHtml(c.change_type)}">${escapeHtml(c.change_type)}</span><h3>${escapeHtml(c.hero_name || c.item_name || c.ability_name || 'Игровой объект')}</h3><p>${escapeHtml(c.description)}</p></article>`).join('') || '<div class="empty-state">Для этого патча пока нет записей об изменениях.</div>'}` : '<div class="empty-state">Подходящие патчи не найдены.</div>'}</section></div></div>`;
}
function renderGuides() {
  const filtered = state.guides.filter(g => !state.q || `${g.title} ${g.hero_name} ${g.author} ${g.role} ${g.description}`.toLowerCase().includes(state.q.toLowerCase()));
  if (state.selectedGuide) return `<div class="content-wrap">${heading('БАЗА ЗНАНИЙ · ГАЙДЫ','Гайды','Руководства сообщества и сборки героев.',`<button class="btn-secondary" data-back-guides>← Все гайды</button>`)}${renderGuideDetail(state.selectedGuide)}</div>`;
  return `<div class="content-wrap">${heading('БАЗА ЗНАНИЙ · СООБЩЕСТВО','Гайды','Сборки, прокачка и объяснение игровых решений.',`<button class="btn-primary" data-page="builder">+ Создать гайд</button>`)}<div class="guide-grid">${filtered.map(guideCard).join('') || '<div class="empty-state">Опубликованные гайды не найдены.</div>'}</div><p class="form-help mt-[15px]">Для учебного прототипа показываются только опубликованные гайды; созданные черновики сохраняются со статусом draft.</p></div>`;
}
function renderGuideDetail(guide) {
  const groups = ['Старт','Ранняя игра','Середина игры','Поздняя игра'];
  return `<section class="detail-panel"><div class="guide-top"><span class="tag">${escapeHtml(guide.hero_name)} · ${escapeHtml(guide.patch_version)}</span><span class="guide-rating">★ ${Number(guide.rating).toFixed(1)}</span></div><h2>${escapeHtml(guide.title)}</h2><div class="tags"><span class="tag">${escapeHtml(guide.role)}</span><span class="tag">Автор: ${escapeHtml(guide.author)}</span>${guide.is_outdated ? '<span class="tag">Возможно устарел</span>' : ''}</div><p>${escapeHtml(guide.description)}</p><div class="detail-section"><h3>Предметы по этапам</h3><div class="stage-fields">${groups.map(stage=>`<div class="ability"><b>${escapeHtml(stage)}</b><p>${guide.items.filter(i=>i.game_stage===stage).map(i=>escapeHtml(i.name)).join('<br>') || 'Не указаны'}</p></div>`).join('')}</div></div><div class="detail-section"><h3>Комментарии (${guide.comments.length})</h3>${guide.comments.map(c=>`<div class="change-card"><b>${escapeHtml(c.author)}</b><p>${escapeHtml(c.body)}</p></div>`).join('') || '<p>Комментариев пока нет.</p>'}</div></section>`;
}
function renderBuilder() {
  const patchOptions = state.patches.map(p=>`<option value="${p.id}">${escapeHtml(p.version)}</option>`).join('');
  const heroOptions = state.heroes.map(h=>`<option value="${h.id}">${escapeHtml(h.name)}</option>`).join('');
  const itemOptions = `<option value="">Не выбирать</option>${state.items.map(i=>`<option value="${i.id}">${escapeHtml(i.name)} — ${number(i.cost)} g</option>`).join('')}`;
  const stageFields = [['Старт','item-start'],['Ранняя игра','item-early'],['Середина игры','item-mid'],['Поздняя игра','item-late']];
  return `<div class="content-wrap">${heading('КАБИНЕТ АВТОРА','Конструктор гайда','Заполни основы сборки; запись сохранится в Supabase.',`<button class="btn-secondary" data-page="guides">← К гайдам</button>`)}<form id="guideForm" class="form-panel"><div class="form-grid"><div class="field full"><label for="guideTitle">Название гайда</label><input id="guideTitle" name="title" required minlength="4" maxlength="120" placeholder="Например: Axe — инициирование и контроль"></div><div class="field"><label for="guideHero">Герой</label><select id="guideHero" name="hero_id" required>${heroOptions}</select></div><div class="field"><label for="guidePatch">Версия патча</label><select id="guidePatch" name="patch_id" required>${patchOptions}</select></div><div class="field"><label for="guideRole">Роль</label><select id="guideRole" name="role" required><option>Керри</option><option>Мид</option><option>Оффлейн</option><option>Поддержка</option><option>Полная поддержка</option></select></div><div class="field full"><label for="guideDescription">Описание и тактика</label><textarea id="guideDescription" name="description" required maxlength="5000" placeholder="Опиши план на линии, важные решения и командные взаимодействия…"></textarea><p class="form-help">До 5000 символов. Это учебный конструктор, без авторизации.</p></div></div><div class="detail-section"><h3>Предметы по этапам</h3><div class="stage-fields">${stageFields.map(([label,id])=>`<div class="field"><label for="${id}">${label}</label><select id="${id}" name="${id}">${itemOptions}</select></div>`).join('')}</div></div><div class="form-actions"><button class="btn-secondary" type="submit" data-save-status="draft">Сохранить черновик</button><button class="btn-primary" type="submit" data-save-status="pending">Отправить на модерацию</button></div><div id="formMessage" class="form-message" role="status"></div></form></div>`;
}
function renderCompare() {
  const leftId = Number(state.compareLeft || state.heroes[0]?.id);
  const rightId = Number(state.compareRight || state.heroes[1]?.id || state.heroes[0]?.id);
  const left = state.heroes.find(h=>h.id===leftId) || state.heroes[0];
  const right = state.heroes.find(h=>h.id===rightId) || state.heroes[1] || state.heroes[0];
  const opts = selected => state.heroes.map(h=>`<option value="${h.id}" ${h.id===Number(selected)?'selected':''}>${escapeHtml(h.name)}</option>`).join('');
  const rows = [['Атрибут','primary_attribute'],['Тип атаки','attack_type'],['Здоровье','base_health'],['Мана','base_mana'],['Броня','armor'],['Количество способностей','ability_count'],['Количество талантов','talent_count']];
  return `<div class="content-wrap">${heading('ИНСТРУМЕНТЫ','Сравнение героев','Сопоставь базовые параметры героев из демонстрационной базы.') }<section class="compare-panel"><div class="compare-controls"><div class="field"><label for="compareLeft">Первый герой</label><select id="compareLeft">${opts(left?.id)}</select></div><div class="versus">VS</div><div class="field"><label for="compareRight">Второй герой</label><select id="compareRight">${opts(right?.id)}</select></div></div><table class="compare-table"><thead><tr><th>Параметр</th><th>${escapeHtml(left?.name || '—')}</th><th>${escapeHtml(right?.name || '—')}</th></tr></thead><tbody>${rows.map(([label,key])=>`<tr><td>${label}</td><td>${escapeHtml(key==='armor'?Number(left[key]).toFixed(1):left[key] ?? '—')}</td><td>${escapeHtml(key==='armor'?Number(right[key]).toFixed(1):right[key] ?? '—')}</td></tr>`).join('')}</tbody></table></section></div>`;
}
function renderPage() {
  const root = $('#pageContent');
  const renderers = { home:renderHome, heroes:renderHeroes, items:renderItems, patches:renderPatches, guides:renderGuides, builder:renderBuilder, compare:renderCompare };
  root.innerHTML = (renderers[state.page] || renderHome)();
  $$('.main-nav [data-page]').forEach(button => button.classList.toggle('active', button.dataset.page===state.page));
}
async function refreshData() {
  try {
    const [stats, heroes, items, patches, guides] = await Promise.all([api('/api/stats'),api('/api/heroes'),api('/api/items'),api('/api/patches'),api('/api/guides')]);
    state.stats=stats; state.heroes=heroes; state.items=items; state.patches=patches; state.guides=guides;
    $('#apiStatus').textContent = `Supabase · ${stats.heroes} героев · API OK`;
    const params = new URLSearchParams(location.search);
    const allowedViews = new Set(['home','heroes','items','patches','guides','builder','compare']);
    const initialView = params.get('view');
    if (allowedViews.has(initialView)) state.page = initialView;
    if (params.has('q')) state.q = params.get('q') || '';
    if (params.has('category')) state.itemCategory = params.get('category') || 'Все';
    if (params.has('patch')) state.selectedPatch = Number(params.get('patch')) || null;
    renderPage();
    if (params.has('hero')) await openHero(Number(params.get('hero')));
    if (params.has('guide')) await openGuide(Number(params.get('guide')));
  } catch (error) {
    $('#apiStatus').textContent = 'API не отвечает';
    $('#pageContent').innerHTML = `<div class="content-wrap"><div class="empty-state"><h2>Не удалось подключиться к API</h2><p>Запусти Node.js-сервер: <code>npm start</code></p><p>${escapeHtml(error.message)}</p></div></div>`;
  }
}
async function openHero(id) {
  try { state.selectedHero = await api(`/api/heroes/${id}`); state.page='heroes'; renderPage(); $('#heroDetail')?.scrollIntoView({behavior:'smooth',block:'start'}); }
  catch (error) { toast(error.message); }
}
async function openGuide(id) {
  try { state.selectedGuide = await api(`/api/guides/${id}`); state.page='guides'; renderPage(); window.scrollTo({top:0,behavior:'smooth'}); }
  catch (error) { toast(error.message); }
}
async function submitGuide(form, status) {
  const data = new FormData(form);
  const items = [['item-start','Старт'],['item-early','Ранняя игра'],['item-mid','Середина игры'],['item-late','Поздняя игра']]
    .map(([key,game_stage])=>({item_id:data.get(key),game_stage})).filter(entry=>entry.item_id);
  const payload = {title:data.get('title'),hero_id:Number(data.get('hero_id')),patch_id:Number(data.get('patch_id')),role:data.get('role'),description:data.get('description'),status,items};
  const submitButtons = $$('button[type="submit"]', form); submitButtons.forEach(button=>button.disabled=true);
  const message = $('#formMessage');
  try {
    const result = await api('/api/guides',{method:'POST',body:JSON.stringify(payload)});
    message.textContent = `${result.message}. ID записи: ${result.id}.`; message.classList.add('show');
    toast(result.message);
    await refreshData(); state.page='builder'; renderPage();
    $('#formMessage').textContent = `${result.message}. ID записи: ${result.id}. Статус: ${result.status}.`; $('#formMessage').classList.add('show');
  } catch(error) {
    message.textContent = error.message; message.style.background='#3c2423'; message.style.color='#f0a197'; message.classList.add('show');
    submitButtons.forEach(button=>button.disabled=false);
  }
}

document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-page]'); if (nav) { navigate(nav.dataset.page); return; }
  const quick = event.target.closest('[data-quick-role]'); if (quick) { state.role=quick.dataset.quickRole==='Новичкам'?'Все':quick.dataset.quickRole; navigate('heroes'); return; }
  const hero = event.target.closest('[data-hero-id]'); if (hero) { await openHero(Number(hero.dataset.heroId)); return; }
  const guide = event.target.closest('[data-guide-id]'); if (guide) { await openGuide(Number(guide.dataset.guideId)); return; }
  const attr = event.target.closest('[data-filter-attribute]'); if (attr) { state.attribute=attr.dataset.filterAttribute; renderPage(); return; }
  const role = event.target.closest('[data-filter-role]'); if (role) { state.role=role.dataset.filterRole; renderPage(); return; }
  const attack = event.target.closest('[data-filter-attack]'); if (attack) { state.attackType=attack.dataset.filterAttack; renderPage(); return; }
  const category = event.target.closest('[data-filter-category]'); if (category) { state.itemCategory=category.dataset.filterCategory; renderPage(); return; }
  const patch = event.target.closest('[data-patch-id]'); if (patch) { state.selectedPatch=Number(patch.dataset.patchId); renderPage(); return; }
  if (event.target.closest('[data-close-detail="hero"]')) { state.selectedHero=null; renderPage(); return; }
  if (event.target.closest('[data-back-guides]')) { state.selectedGuide=null; renderPage(); return; }
  const compareHero = event.target.closest('[data-compare-hero]'); if (compareHero) { state.compareLeft=compareHero.dataset.compareHero; state.compareRight=state.compareRight || String(state.heroes.find(h=>h.id!==Number(state.compareLeft))?.id || ''); navigate('compare'); return; }
  const favorite = event.target.closest('[data-favorite-hero]'); if (favorite) { toast('Избранное предусмотрено схемой БД; вход в MVP пока не реализован.'); return; }
  if (event.target.closest('#loginButton')) { toast('Авторизация запланирована следующим этапом проекта.'); return; }
});
document.addEventListener('keydown', event => { if ((event.key==='Enter'||event.key===' ') && event.target.matches('.hero-card[role="button"]')) { event.preventDefault(); openHero(Number(event.target.dataset.heroId)); } });
document.addEventListener('submit', async event => {
  if (event.target.id==='homeSearchForm') { event.preventDefault(); navigate('heroes',{query:$('#homeSearch').value.trim()}); }
  if (event.target.id==='guideForm') { event.preventDefault(); const button=event.submitter; await submitGuide(event.target,button?.dataset.saveStatus==='pending'?'pending':'draft'); }
});
$('#globalSearch').addEventListener('keydown', event => { if(event.key==='Enter'){const query=event.currentTarget.value.trim(); navigate(state.page==='home'?'heroes':state.page,{query});} });
$('#globalSearch').addEventListener('input', event => { state.q=event.currentTarget.value.trim(); if(state.page==='home'&&state.q)state.page='heroes'; renderPage(); });
document.addEventListener('change', event => {
  if(event.target.id==='compareLeft'){state.compareLeft=event.target.value;renderPage();}
  if(event.target.id==='compareRight'){state.compareRight=event.target.value;renderPage();}
});
refreshData();

