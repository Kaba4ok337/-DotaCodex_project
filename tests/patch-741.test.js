'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const prefix = source.slice(0, source.indexOf('function renderGuides()'));
const render = vm.runInNewContext(`${prefix}\nstate.patches=[{id:4,version:'7.41',release_date:'2026-03-24',summary:'Обновление',changes:[]}]; renderPatches`, {createDataLoader:()=>()=>{}});

test('patch 7.41 displays verified highlights and the official source', () => {
  const html = render();
  assert.match(html, /Аспекты удалены/);
  assert.match(html, /https:\/\/www\.dota2\.com\/patches\/7\.41/);
  assert.match(html, /неполный обзор/i);
});
