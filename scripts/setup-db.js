'use strict';

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Добавь DATABASE_URL в .env (Supabase → Project Settings → Database → Connection string).');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
async function setup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(root, 'db', 'schema.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(root, 'db', 'seed.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Схема и демонстрационные данные загружены в Supabase PostgreSQL.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
setup().catch(error => { console.error('Не удалось настроить Supabase:', error.message); process.exitCode = 1; });
