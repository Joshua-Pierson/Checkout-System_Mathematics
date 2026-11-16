import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveCatalogItem } from '../src/utils/catalog.js';
const item = { name: 'Scantrons', category: 'exam supplies', unit_price: 3.5, stock_quantity: 100, tax_rate: 0 };
function fixture(rules = {}) {
  const calls = [];
  const api = { fetchBundles: async () => rules, fetchInventory: async () => [{ item_id: 1003, ...item, unit_price: '3.50' }] };
  for (const method of ['updateItem', 'updateBundle', 'deleteBundle', 'createItem', 'deleteItem']) api[method] = async (...args) => { calls.push([method, ...args]); return { item_id: 1009 }; };
  return { api, calls };
}
test('unchanged catalog and deal make no writes', async () => {
  const { api, calls } = fixture({ 1003: { trigger: 3, price: '9.00' } });
  assert.equal((await saveCatalogItem('edit', 1003, item, { quantity: 3, priceCents: 900 }, api)).message, 'No changes to save.');
  assert.deepEqual(calls, []);
});
test('deal-only save skips item update and clearing deletes existing rule', async () => {
  const { api, calls } = fixture();
  await saveCatalogItem('edit', 1003, item, { quantity: 3, priceCents: 900 }, api);
  assert.deepEqual(calls, [['updateBundle', 1003, { trigger_quantity: 3, bundle_price: 9 }]]);
  api.fetchBundles = async () => ({ 1003: { trigger: 3, price: 9 } });
  await saveCatalogItem('edit', 1003, item, null, api);
  assert.equal(calls[1][0], 'deleteBundle');
});
test('changed catalog fields save separately from deal', async () => {
  const { api, calls } = fixture();
  await saveCatalogItem('edit', 1003, { ...item, unit_price: 4 }, { quantity: 3, priceCents: 900 }, api);
  assert.deepEqual(calls, [['updateItem', 1003, { unit_price: 4 }], ['updateBundle', 1003, { trigger_quantity: 3, bundle_price: 9 }]]);
});
test('missing item and partial failure remain errors', async () => {
  const { api } = fixture();
  api.fetchInventory = async () => [];
  await assert.rejects(saveCatalogItem('edit', 1003, item, null, api), /not found/);
  api.updateBundle = async () => { throw new Error('Unavailable'); };
  await assert.rejects(saveCatalogItem('add', null, item, { quantity: 3, priceCents: 900 }, api), /Item 1009 saved, but the multi-buy deal was not saved/);
});
