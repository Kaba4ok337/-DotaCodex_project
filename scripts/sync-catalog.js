'use strict';
// Import official hero and item details, preserving database IDs referenced by guides.
require('dotenv').config({quiet:true});
const {Pool}=require('pg');
const base='https://www.dota2.com/datafeed/';
async function get(endpoint, params={}) {
  const url=new URL(base+endpoint); url.searchParams.set('language','russian');
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  for(let attempt=0;attempt<3;attempt++) {
    try { const r=await fetch(url,{signal:AbortSignal.timeout(20000)}); if(!r.ok) throw Error(`HTTP ${r.status}`); const j=await r.json(); if(!j.result?.data || (j.result.status !== undefined && j.result.status !== 1)) throw Error('Некорректный ответ Valve'); return j.result.data; }
    catch(e) { if(attempt===2) throw e; await new Promise(r=>setTimeout(r,1000*(attempt+1))); }
  }
}
async function mapLimit(input, fn, limit=5) { let n=0; const out=new Array(input.length); await Promise.all(Array.from({length:limit},async()=>{while(n<input.length){const i=n++;out[i]=await fn(input[i]); if((i+1)%50===0) console.log(`Загружено ${i+1} из ${input.length}`);}}));return out; }
const clean = s => String(s||'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function description(a) { let s=clean(a.desc_loc); for(const v of a.special_values||[]) {const vals=(v.values_float||[]).join('/'); if(vals) s=s.replaceAll(`%${v.name}%`,vals); } return s.replace(/%[\w]+%/g,'—'); }
const slug = s=>s.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function main(){
 if(!process.env.DATABASE_URL) throw Error('Не задан DATABASE_URL');
 const [hl,il]=await Promise.all([get('herolist'),get('itemlist')]);
 const heroes=hl.heroes, items=il.itemabilities.filter(x=>!x.name.startsWith('item_recipe_') && x.neutral_item_tier===-1);
 if(heroes.length<100||items.length<100) throw Error('Получен неполный каталог');
 console.log(`Загрузка: ${heroes.length} героев, ${items.length} предметов`);
 const details=await mapLimit([...heroes.map(x=>({kind:'hero',id:x.id})),...items.map(x=>({kind:'item',id:x.id}))],async x=>{const data=await get(x.kind==='hero'?'herodata':'itemdata',x.kind==='hero'?{hero_id:x.id}:{item_id:x.id});const value=(x.kind==='hero'?data.heroes:data.items)?.[0]; if(!value||value.id!==x.id) throw Error(`Нет данных ${x.kind} ${x.id}`);return value;});
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1}); const c=await pool.connect();
 try {
 await c.query('BEGIN');
 // Existing schema prohibited valid negative armor values.
 await c.query('ALTER TABLE heroes DROP CONSTRAINT IF EXISTS heroes_armor_check');
 await c.query("SELECT setval(pg_get_serial_sequence('heroes','id'), COALESCE((SELECT MAX(id) FROM heroes),1), true)");
 await c.query("SELECT setval(pg_get_serial_sequence('items','id'), COALESCE((SELECT MAX(id) FROM items),1), true)");
 await c.query("SELECT setval(pg_get_serial_sequence('abilities','id'), COALESCE((SELECT MAX(id) FROM abilities),1), true)");
 const roles=['Керри','Поддержка','Нукер','Дизейблер','Лесник','Танк','Эскейп','Пушер','Инициатор'];
 for(const h of details.slice(0,heroes.length)){
  const name=h.name_loc; const attrs=['Сила','Ловкость','Интеллект','Универсальный']; if(!name||!attrs[h.primary_attr]||![1,2].includes(h.attack_capability)) throw Error(`Неверные данные героя ${h.id}`);
  const old=await c.query('SELECT id FROM heroes WHERE lower(name)=lower($1)',[name]);
  const vals=[name,slug(name),attrs[h.primary_attr],h.attack_capability===1?'Ближний бой':'Дальний бой',(h.role_levels||[]).map((x,i)=>x>0?roles[i]:null).filter(Boolean).join(';'),h.max_health,h.max_mana,h.armor,clean(h.bio_loc),`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${h.name.replace('npc_dota_hero_','')}.png`];
  let id;
  if(old.rows.length){id=old.rows[0].id;await c.query('UPDATE heroes SET name=$1, slug=$2, primary_attribute=$3,attack_type=$4,roles=$5,base_health=$6,base_mana=$7,armor=$8,lore=$9,image_url=$10 WHERE id=$11',[...vals,id]);}
  else {id=(await c.query('INSERT INTO heroes(name,slug,primary_attribute,attack_type,roles,base_health,base_mana,armor,lore,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',vals)).rows[0].id;}
  for(const [i,a] of (h.abilities||[]).entries()) { if(!a.name_loc) continue; const type=a.type===1?'Ультимативная':(BigInt(a.behavior || '0') & 2n) !== 0n?'Пассивная':'Активная'; await c.query(`INSERT INTO abilities(hero_id,name,ability_type,description,mana_cost,cooldown,position) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(hero_id,name) DO UPDATE SET ability_type=EXCLUDED.ability_type,description=EXCLUDED.description,mana_cost=EXCLUDED.mana_cost,cooldown=EXCLUDED.cooldown,position=EXCLUDED.position`,[id,a.name_loc,type,description(a),a.mana_costs?.join('/')||'—',a.cooldowns?.join('/')||'—',i+1]); }
 }
 const knownItems = await c.query('SELECT id,name,slug FROM items');
 const names = new Map(knownItems.rows.map(x=>[x.name.toLowerCase(),x.id]));
 const slugs = new Map(knownItems.rows.map(x=>[x.slug,x.id]));
 const seenNames = new Set(), seenSlugs = new Set();
 for(const a of details.slice(heroes.length)) {
  const name=a.name_loc;if(!name||!Number.isFinite(a.item_cost)||a.item_cost<=0)continue;
  const key=slug(name), lower=name.toLowerCase(); if(!key || seenNames.has(lower)||seenSlugs.has(key)) continue;
  const id=names.get(lower); if(slugs.has(key) && slugs.get(key)!==id) continue;
  seenNames.add(lower); seenSlugs.add(key);
  const vals=[name,key,a.item_cost,'Предметы',description(a)||'Описание отсутствует', '', ''];
  if(id) await c.query('UPDATE items SET name=$1,slug=$2,cost=$3,category=$4,description=$5,bonuses=$6,effect=$7 WHERE id=$8',[...vals,id]);
  else await c.query('INSERT INTO items(name,slug,cost,category,description,bonuses,effect) VALUES($1,$2,$3,$4,$5,$6,$7)',vals);
 }
 await c.query('COMMIT'); console.log('Каталог обновлён; существующие гайды сохранены.');
 }catch(e){await c.query('ROLLBACK'); throw e;}finally{c.release();await pool.end();}
}
main().catch(e=>{console.error('Импорт не выполнен:',e.message);process.exitCode=1});
