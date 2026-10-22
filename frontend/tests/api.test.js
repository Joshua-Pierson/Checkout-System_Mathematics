import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Replace Vite's build-time environment expression for Node's test runner.
const source = (await readFile(new URL('../src/api.js', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('requests match Flask routes, payloads, response envelope, and errors', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: [{ item_id: 1001 }], total: 5 }) };
  };
  try {
    assert.deepEqual(await api.fetchInventory(), [{ item_id: 1001 }]);
    await api.fetchCategories();
    await api.createItem({ name: 'Pens' });
    await api.updateItem(1001, { name: 'Pencils' });
    await api.deleteItem(1001);
    const cart = [{ code: '1001', quantity: 2 }];
    await api.calculateCart(cart);
    await api.checkout(cart);
    assert.deepEqual(calls.map(({ url, method }) => [new URL(url).pathname, method]), [
      ['/api/inventory', 'GET'], ['/api/categories', 'GET'], ['/api/items', 'POST'],
      ['/api/items/1001', 'PUT'], ['/api/items/1001', 'DELETE'],
      ['/api/cart/calculate', 'POST'], ['/api/checkout', 'POST'],
    ]);
    assert.deepEqual(JSON.parse(calls[5].body), { items: [{ item_id: 1001, quantity: 2 }] });
    assert.deepEqual(JSON.parse(calls[6].body), JSON.parse(calls[5].body));
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ status: 'error', message: 'Database unavailable' }) });
    await assert.rejects(api.fetchInventory(), /Database unavailable/);
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(); } });
    await assert.rejects(api.fetchInventory(), /invalid response/);
  } finally { globalThis.fetch = original; }
});
