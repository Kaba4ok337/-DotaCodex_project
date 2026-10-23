'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
require('dotenv').config();
const { Pool } = require('pg');

const ROOT = __dirname;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add your Supabase PostgreSQL connection string to .env.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });

const mimeTypes = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon' };
async function all(sql,...params) { let i=0; const statement=sql.replace(/\?/g,()=>`$${++i}`); return (await pool.query(statement,params)).rows; }
async function one(sql,...params) { return (await all(sql,...params))[0] || null; }
async function count(table,where='') { return (await one(`SELECT COUNT(*)::int AS n FROM ${table} ${where}`)).n; }
function sendJson(res,status,data) { const body=Buffer.from(JSON.stringify(data)); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'}); res.end(body); }
function sendError(res,status,message) { sendJson(res,status,{error:message}); }
function readJson(req) { return new Promise((resolve,reject)=>{ let text=''; req.on('data',chunk=>{text+=chunk;if(text.length>1_000_000)reject(new Error('Слишком большой запрос'));}); req.on('end',()=>{try{resolve(JSON.parse(text||'{}'));}catch{reject(new Error('Некорректный JSON'));}}); req.on('error',reject); }); }

async function getHeroes(searchParams) {
  const filters=[],values=[];
  const add=(sql,value)=>{values.push(value);filters.push(sql.replace('?',`$${values.length}`));};
  const q=(searchParams.get('q')||'').trim();
  if(q){values.push(`%${q}%`);const n=values.length;filters.push(`(h.name ILIKE $${n} OR h.roles ILIKE $${n} OR h.primary_attribute ILIKE $${n})`);}
  const attr=searchParams.get('attribute'); if(attr)add('h.primary_attribute = ?',attr);
  const role=searchParams.get('role'); if(role)add('h.roles ILIKE ?',`%${role}%`);
  const attack=searchParams.get('attackType'); if(attack)add('h.attack_type = ?',attack);
  return all(`SELECT h.*, (SELECT COUNT(*)::int FROM abilities a WHERE a.hero_id=h.id) AS ability_count,
    (SELECT COUNT(*)::int FROM talents t WHERE t.hero_id=h.id) AS talent_count
    FROM heroes h ${filters.length?`WHERE ${filters.join(' AND ')}`:''} ORDER BY h.name`,...values);
}
async function getHeroDetails(id) {
  const hero=await one('SELECT * FROM heroes WHERE id=?',id); if(!hero)return null;
  const [abilities,talents,recommended_items]=await Promise.all([
    all('SELECT id,name,ability_type,description,mana_cost,cooldown,levels_json,position FROM abilities WHERE hero_id=? ORDER BY position',id),
    all('SELECT level,left_talent,right_talent FROM talents WHERE hero_id=? ORDER BY level',id),
    all(`SELECT DISTINCT i.id,i.name,i.cost,i.category FROM guides g JOIN guide_items gi ON gi.guide_id=g.id JOIN items i ON i.id=gi.item_id WHERE g.hero_id=? AND g.status='published' ORDER BY i.name LIMIT 6`,id)
  ]); return {...hero,abilities,talents,recommended_items};
}
async function getPatches() {
  const patches=await all('SELECT * FROM patches ORDER BY release_date DESC,id DESC');
  return Promise.all(patches.map(async p=>({...p,changes:await all(`SELECT pc.id,pc.change_type,pc.description,h.name AS hero_name,i.name AS item_name,a.name AS ability_name FROM patch_changes pc LEFT JOIN heroes h ON h.id=pc.hero_id LEFT JOIN items i ON i.id=pc.item_id LEFT JOIN abilities a ON a.id=pc.ability_id WHERE pc.patch_id=? ORDER BY pc.id`,p.id)})));
}
async function getGuides() { return all(`SELECT g.id,g.title,g.role,g.description,g.rating,g.status,g.views,g.is_outdated,g.created_at,h.id AS hero_id,h.name AS hero_name,p.id AS patch_id,p.version AS patch_version,u.nickname AS author FROM guides g JOIN heroes h ON h.id=g.hero_id JOIN patches p ON p.id=g.patch_id JOIN users u ON u.id=g.author_id WHERE g.status='published' ORDER BY g.rating DESC,g.views DESC`); }
async function getGuideDetails(id) {
  const guide=await one(`SELECT g.id,g.title,g.role,g.description,g.rating,g.status,g.views,g.is_outdated,g.created_at,h.id AS hero_id,h.name AS hero_name,p.id AS patch_id,p.version AS patch_version,u.nickname AS author FROM guides g JOIN heroes h ON h.id=g.hero_id JOIN patches p ON p.id=g.patch_id JOIN users u ON u.id=g.author_id WHERE g.id=? AND g.status='published'`,id);
  if(!guide)return null;
  const [items,comments]=await Promise.all([
    all(`SELECT i.id,i.name,i.cost,gi.game_stage,gi.position FROM guide_items gi JOIN items i ON i.id=gi.item_id WHERE gi.guide_id=? ORDER BY CASE gi.game_stage WHEN 'Старт' THEN 1 WHEN 'Ранняя игра' THEN 2 WHEN 'Середина игры' THEN 3 ELSE 4 END,gi.position`,id),
    all('SELECT c.id,c.body,c.created_at,u.nickname AS author FROM comments c JOIN users u ON u.id=c.user_id WHERE c.guide_id=? AND c.is_hidden=0 ORDER BY c.id',id)
  ]); return {...guide,items,comments};
}
const parseId=raw=>/^\d+$/.test(raw||'')?Number(raw):null;

async function handleApi(req,res,url) {
  const {pathname,searchParams}=url;
  if(req.method==='GET'&&pathname==='/api/health'){await pool.query('SELECT 1');return sendJson(res,200,{status:'ok',database:'Supabase PostgreSQL',runtime:`Node.js ${process.versions.node}`});}
  if(req.method==='GET'&&pathname==='/api/stats')return sendJson(res,200,{heroes:await count('heroes'),abilities:await count('abilities'),items:await count('items'),patches:await count('patches'),guides:await count('guides',"WHERE status='published'"),comments:await count('comments','WHERE is_hidden=0')});
  if(req.method==='GET'&&pathname==='/api/heroes')return sendJson(res,200,await getHeroes(searchParams));
  if(req.method==='GET'&&pathname.startsWith('/api/heroes/')){const id=parseId(pathname.split('/').at(-1));if(!id)return sendError(res,400,'Некорректный идентификатор героя');const hero=await getHeroDetails(id);return hero?sendJson(res,200,hero):sendError(res,404,'Герой не найден');}
  if(req.method==='GET'&&pathname==='/api/items'){
    const q=(searchParams.get('q')||'').trim(),category=(searchParams.get('category')||'').trim(),clauses=[],params=[];
    if(q){params.push(`%${q}%`);const n=params.length;clauses.push(`(name ILIKE $${n} OR category ILIKE $${n} OR description ILIKE $${n})`);}
    if(category){params.push(category);clauses.push(`category=$${params.length}`);}
    return sendJson(res,200,await all(`SELECT * FROM items ${clauses.length?`WHERE ${clauses.join(' AND ')}`:''} ORDER BY cost,name`,...params));
  }
  if(req.method==='GET'&&pathname==='/api/patches')return sendJson(res,200,await getPatches());
  if(req.method==='GET'&&pathname==='/api/guides')return sendJson(res,200,await getGuides());
  if(req.method==='GET'&&pathname.startsWith('/api/guides/')){const id=parseId(pathname.split('/').at(-1));if(!id)return sendError(res,400,'Некорректный идентификатор гайда');const guide=await getGuideDetails(id);return guide?sendJson(res,200,guide):sendError(res,404,'Опубликованный гайд не найден');}
  if(req.method==='POST'&&pathname==='/api/guides'){
    let payload;try{payload=await readJson(req);}catch(error){return sendError(res,400,error.message);}
    const title=String(payload.title||'').trim(),description=String(payload.description||'').trim(),role=String(payload.role||'').trim(),heroId=Number(payload.hero_id),patchId=Number(payload.patch_id),status=payload.status==='pending'?'pending':'draft';
    if(title.length<4||title.length>120)return sendError(res,400,'Название должно содержать от 4 до 120 символов');
    if(!description||description.length>5000)return sendError(res,400,'Добавьте описание до 5000 символов');
    if(!role||role.length>50)return sendError(res,400,'Укажите роль героя');
    if(!await one('SELECT id FROM heroes WHERE id=?',heroId))return sendError(res,400,'Выберите существующего героя');
    if(!await one('SELECT id FROM patches WHERE id=?',patchId))return sendError(res,400,'Выберите версию патча');
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const saved=await client.query(`INSERT INTO guides(author_id,hero_id,patch_id,title,role,description,skill_build_json,talent_build_json,status) VALUES(2,$1,$2,$3,$4,$5,'[]','{}',$6) RETURNING id`,[heroId,patchId,title,role,description,status]);
      const guideId=saved.rows[0].id,stages=new Set(['Старт','Ранняя игра','Середина игры','Поздняя игра']);
      for(const [index,entry] of (Array.isArray(payload.items)?payload.items:[]).slice(0,20).entries()){
        const itemId=Number(entry.item_id),stage=String(entry.game_stage||'Старт');
        if(stages.has(stage)&&(await client.query('SELECT id FROM items WHERE id=$1',[itemId])).rows.length)await client.query('INSERT INTO guide_items(guide_id,item_id,game_stage,position) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[guideId,itemId,stage,index+1]);
      }
      await client.query('COMMIT');return sendJson(res,201,{id:guideId,status,message:status==='pending'?'Гайд отправлен на модерацию':'Черновик сохранён'});
    }catch(error){await client.query('ROLLBACK');console.error('Supabase guide insert failed:',error.message);return sendError(res,500,'Не удалось сохранить гайд');}finally{client.release();}
  }
  return sendError(res,404,'API-маршрут не найден');
}
function createServer(){return http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  try{
    if(url.pathname.startsWith('/api/'))return await handleApi(req,res,url);
    if(req.method!=='GET'&&req.method!=='HEAD')return sendError(res,405,'Метод не поддерживается');
    const requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const relative=requested==='/tailwind.css'?'/public/tailwind.css':requested;
    const target=path.resolve(ROOT,`.${relative}`);
    if(target!==ROOT&&!target.startsWith(ROOT+path.sep))return sendError(res,403,'Доступ запрещён');
    if(!fs.existsSync(target)||!fs.statSync(target).isFile())return sendError(res,404,'Файл не найден');
    const content=fs.readFileSync(target);res.writeHead(200,{'Content-Type':mimeTypes[path.extname(target).toLowerCase()]||'application/octet-stream','Content-Length':content.length,'X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){console.error(error);if(!res.headersSent)sendError(res,500,'Внутренняя ошибка сервера');else res.end();}
});}
if(require.main===module){const port=Number(process.env.PORT||8000),host=process.env.HOST||'127.0.0.1',server=createServer();server.listen(port,host,()=>console.log(`DotaCodex запущен: http://${host}:${port} | БД: Supabase PostgreSQL`));const shutdown=()=>server.close(()=>pool.end().finally(()=>process.exit(0)));process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);}
module.exports={pool,createServer,getHeroes,getHeroDetails,getPatches,getGuides,getGuideDetails};
