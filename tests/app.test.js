'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, createServer } = require('../server');
let server;
let baseUrl;
let createdGuideId;

test.before(async () => {
  await pool.query('SELECT 1');
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (createdGuideId) await pool.query('DELETE FROM guides WHERE id=$1', [createdGuideId]);
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
});

test('health endpoint reports Node.js and Supabase PostgreSQL', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.match(body.runtime, /^Node\.js /);
  assert.equal(body.database, 'Supabase PostgreSQL');
});

test('Supabase schema contains all relational tables', async () => {
  const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  const names = new Set(rows.map(row => row.table_name));
  for (const name of ['users','patches','heroes','abilities','talents','items','item_recipes','patch_changes','guides','guide_items','comments','favorites']) assert.ok(names.has(name), `missing ${name}`);
});

test('demo catalogs are populated and relationships are valid', async () => {
  const response = await fetch(`${baseUrl}/api/stats`);
  const stats = await response.json();
  assert.equal(response.status, 200);
  assert.ok(stats.heroes >= 6);
  assert.ok(stats.items >= 8);
  assert.ok(stats.patches >= 3);
  assert.ok(stats.guides >= 2);
  const invalid = await pool.query('SELECT COUNT(*)::int AS n FROM guides g LEFT JOIN heroes h ON h.id=g.hero_id WHERE h.id IS NULL');
  assert.equal(invalid.rows[0].n, 0);
});

test('hero search supports query and filters', async () => {
  const response = await fetch(`${baseUrl}/api/heroes?q=Axe&attribute=${encodeURIComponent('Сила')}`);
  const heroes = await response.json();
  assert.equal(response.status, 200);
  assert.equal(heroes.length, 1);
  assert.equal(heroes[0].name, 'Axe');
});

test('hero detail returns abilities, talents and guide item recommendations', async () => {
  const response = await fetch(`${baseUrl}/api/heroes/1`);
  const hero = await response.json();
  assert.equal(response.status, 200);
  assert.equal(hero.name, 'Axe');
  assert.ok(hero.abilities.length >= 3);
  assert.ok(hero.talents.length >= 2);
  assert.ok(Array.isArray(hero.recommended_items));
});

test('patches include changes and guides include only published entries', async () => {
  const [patchResponse, guideResponse] = await Promise.all([fetch(`${baseUrl}/api/patches`),fetch(`${baseUrl}/api/guides`)]);
  const patches = await patchResponse.json();
  const guides = await guideResponse.json();
  assert.ok(patches.some(p => p.changes.length > 0));
  assert.ok(guides.length > 0);
  assert.ok(guides.every(g => g.status === 'published'));
});

test('guide builder saves a draft to Supabase', async () => {
  const response = await fetch(`${baseUrl}/api/guides`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({title:'Тестовый гайд Node.js',hero_id:1,patch_id:3,role:'Оффлейн',description:'Тестовая запись для проверки сохранения гайда.',status:'draft',items:[{item_id:1,game_stage:'Старт'}]})
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.status, 'draft');
  createdGuideId = result.id;
  const { rows } = await pool.query('SELECT title,status FROM guides WHERE id=$1',[createdGuideId]);
  assert.equal(rows[0].title, 'Тестовый гайд Node.js');
  assert.equal(rows[0].status, 'draft');
  const items = await pool.query('SELECT COUNT(*)::int AS n FROM guide_items WHERE guide_id=$1',[createdGuideId]);
  assert.equal(items.rows[0].n, 1);
});

test('guide builder rejects incomplete input', async () => {
  const response = await fetch(`${baseUrl}/api/guides`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({title:'x',hero_id:1,patch_id:3,role:'Оффлейн',description:'Тест'})
  });
  assert.equal(response.status, 400);
});
