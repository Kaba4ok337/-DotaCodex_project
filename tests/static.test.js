'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
process.env.DATABASE_URL ||= 'postgresql://localhost/test';
const { createServer, pool } = require('../server');

function request(path) {
  return new Promise(resolve => {
    const req = new EventEmitter();
    Object.assign(req, { url: path, method: 'GET', headers: { host: 'localhost' } });
    const res = { writeHead(status) { this.status = status; }, end() { resolve(this.status); } };
    createServer().emit('request', req, res);
  });
}

test('only intended website assets are served', async () => {
  assert.equal(await request('/server.js'), 403);
  assert.equal(await request('/package.json'), 403);
  assert.equal(await request('/app.js'), 200);
  assert.equal(await request('/data-loader.js'), 200);
  assert.equal(await request('/tailwind.css'), 200);
});

test.after(() => pool.end());
