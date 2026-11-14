'use strict';

function createDataLoader(state, fetchData) {
  const pending = new Map();
  const pages = {home:['heroes','patches'], heroes:['heroes'], items:['items'], patches:['patches'], guides:['guides'], builder:['heroes','items','patches'], compare:['heroes']};
  return async function loadPageData(page) {
    await Promise.all((pages[page] || []).map(key => {
      if (!pending.has(key)) {
        const request = fetchData(`/api/${key}${key === 'heroes' ? '?summary=1' : ''}`).then(value => { state[key] = value; }).catch(error => { pending.delete(key); throw error; });
        pending.set(key, request);
      }
      return pending.get(key);
    }));
  };
}

if (typeof module !== 'undefined') module.exports = { createDataLoader };
