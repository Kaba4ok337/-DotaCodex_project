'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const prefix = source.slice(0, source.indexOf('function heroCard('));
const heroArt = vm.runInNewContext(`${prefix}\nheroArt`, { createDataLoader: () => () => {} });

test('hero art uses the catalog image and retains an emblem as a fallback', () => {
  const html = heroArt({name:'Axe',primary_attribute:'Сила',image_url:'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png'});
  assert.match(html, /<img /);
  assert.match(html, /heroes\/axe\.png/);
  assert.match(html, /hero-emblem/);
});

test('demo heroes with no image have a portrait without changing the database', () => {
  assert.match(heroArt({name:'Crystal Maiden',primary_attribute:'Интеллект'}), /heroes\/crystal_maiden\.png/);
});
