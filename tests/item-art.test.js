'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const prefix = source.slice(0, source.indexOf('function patchChip('));
const images = fs.readFileSync(require.resolve('../item-images.js'), 'utf8');
const itemCard = vm.runInNewContext(`${images}\n${prefix}\nitemCard`, { createDataLoader: () => () => {} });

test('item card shows the correct lazy-loaded image and reserves a fallback', () => {
  const html = itemCard({name:'Blink Dagger',category:'Мобильность',cost:2250});
  assert.match(html, /items\/blink\.png/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /item-art-fallback/);
});

test('an unknown item keeps a fallback without guessing an image', () => {
  const html = itemCard({name:'Unknown item',category:'',cost:0});
  assert.match(html, /item-art-fallback/);
  assert.doesNotMatch(html, /<img/);
});
