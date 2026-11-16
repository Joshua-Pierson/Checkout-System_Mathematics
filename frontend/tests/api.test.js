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
    await api.calculateCart(cart, 'S123', 'E123');
    await api.checkout(cart, 10, 'S123', 'E123');
    await api.checkoutCard(cart, '4242424242424242', 'S123', 'E123');
    assert.deepEqual(calls.map(({ url, method }) => [new URL(url).pathname, method]), [
      ['/api/inventory', 'GET'], ['/api/categories', 'GET'], ['/api/items', 'POST'],
      ['/api/items/1001', 'PUT'], ['/api/items/1001', 'DELETE'],
      ['/api/cart/calculate', 'POST'], ['/api/checkout/cash', 'POST'], ['/api/checkout/card', 'POST'],
    ]);
    assert.deepEqual(JSON.parse(calls[5].body), {
      items: [{ item_id: 1001, quantity: 2 }],
      student_id: 'S123',
      employee_id: 'E123',
    });
    assert.deepEqual(JSON.parse(calls[6].body), {
      cart: [{ item_id: 1001, quantity: 2 }],
      cash_tendered: 10,
      student_id: 'S123',
      employee_id: 'E123',
    });
    assert.deepEqual(JSON.parse(calls[7].body), {
      cart: [{ item_id: 1001, quantity: 2 }],
      card_number: '4242424242424242',
      student_id: 'S123',
      employee_id: 'E123',
    });
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ status: 'error', message: 'Database unavailable' }) });
    await assert.rejects(api.fetchInventory(), /Database unavailable/);
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(); } });
    await assert.rejects(api.fetchInventory(), /invalid response/);
  } finally { globalThis.fetch = original; }
});

test('authorized cart changes are sent with calculations and checkout', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return { ok: true, status: 200, json: async () => ({ status: 'success', new_price: 8.5, grant_token: 'grant-1' }) };
  };
  try {
    const item = {
      code: '1001',
      quantity: 2,
      priceOverride: { newPrice: 8.5, grantToken: 'grant-1' },
    };
    const cart = [item];
    await api.calculateCart(cart, '', '');
    await api.checkout(cart, 20, '', '');
    await api.checkoutCard(cart, '4242424242424242', '', '');
    await api.authorizeItemRemoval('STAFF-1', '1234', '1001');
    await api.authorizePriceOverride({
      staff_id: 'STAFF-1',
      pin: '1234',
      item_id: 1001,
      original_price: 10,
      new_price: 8.5,
      reason: 'Damaged packaging',
    });

    const expectedOverride = { price_override: { new_price: 8.5, grant_token: 'grant-1' } };
    for (const index of [0, 1, 2]) {
      const payload = JSON.parse(calls[index].body);
      const items = payload.items || payload.cart;
      assert.deepEqual(items[0], { item_id: 1001, quantity: 2, ...expectedOverride });
    }
    assert.deepEqual(calls.slice(3).map(({ url, method }) => [new URL(url).pathname, method]), [
      ['/api/cart/override/item', 'DELETE'],
      ['/api/cart/override/price', 'PUT'],
    ]);
  } finally { globalThis.fetch = original; }
});
