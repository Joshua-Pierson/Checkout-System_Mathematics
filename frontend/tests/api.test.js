import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';

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
    await api.checkout(cart, 10);
    assert.deepEqual(calls.map(({ url, method }) => [new URL(url).pathname, method]), [
      ['/api/inventory', 'GET'], ['/api/categories', 'GET'], ['/api/items', 'POST'],
      ['/api/items/1001', 'PUT'], ['/api/items/1001', 'DELETE'],
      ['/api/cart/calculate', 'POST'], ['/api/checkout/cash', 'POST'],
    ]);
    assert.deepEqual(JSON.parse(calls[5].body), { items: [{ item_id: 1001, quantity: 2 }] });
    assert.deepEqual(JSON.parse(calls[6].body), {
      cart: [{ item_id: 1001, quantity: 2 }],
      cash_tendered: 10,
    });
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ status: 'error', message: 'Database unavailable' }) });
    await assert.rejects(api.fetchInventory(), /Database unavailable/);
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(); } });
    await assert.rejects(api.fetchInventory(), /invalid response/);
  } finally { globalThis.fetch = original; }
});

test('staff login sends credentials to Flask and returns the authenticated staff profile', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', staff: { staff_id: 'ADMIN', name: 'System Admin', role: 'manager' } }),
    };
  };
  try {
    const result = await api.staffLogin('ADMIN', '1234');
    assert.deepEqual(result.staff, { staff_id: 'ADMIN', name: 'System Admin', role: 'manager' });
    assert.equal(new URL(calls[0].url).pathname, '/api/auth/login');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].body), { staff_id: 'ADMIN', pin: '1234' });
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ status: 'error', message: 'Authentication failed: Invalid Staff ID or PIN.' }),
    });
    await assert.rejects(api.staffLogin('ADMIN', 'wrong'), /Authentication failed: Invalid Staff ID or PIN/);
  } finally { globalThis.fetch = original; }
});

test('staff item removal sends credentials and item ID to the backend override route', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', authorized_by: 'System Admin' }),
    };
  };
  try {
    const result = await api.authorizeItemRemoval(1003, 'ADMIN', '1234');
    assert.equal(result.authorized_by, 'System Admin');
    assert.equal(new URL(calls[0].url).pathname, '/api/cart/override/item');
    assert.equal(calls[0].method, 'DELETE');
    assert.deepEqual(JSON.parse(calls[0].body), { staff_id: 'ADMIN', pin: '1234', item_id: 1003 });
  } finally { globalThis.fetch = original; }
});
