'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDataLoader } = require('../data-loader');

test('loads only data needed by each page and reuses it across navigation', async () => {
  const calls = [];
  const state = {};
  const load = createDataLoader(state, async url => { calls.push(url); return []; });
  await load('items');
  assert.deepEqual(calls, ['/api/items']);
  await load('builder');
  assert.deepEqual(calls.sort(), ['/api/heroes?summary=1', '/api/items', '/api/patches']);
  await load('items');
  assert.equal(calls.length, 3);
});

test('deduplicates concurrent requests and retries failures', async () => {
  let calls = 0;
  const load = createDataLoader({}, async () => { calls++; if (calls === 1) throw new Error('offline'); return []; });
  await assert.rejects(Promise.all([load('items'), load('items')]), /offline/);
  assert.equal(calls, 1);
  await load('items');
  assert.equal(calls, 2);
});
