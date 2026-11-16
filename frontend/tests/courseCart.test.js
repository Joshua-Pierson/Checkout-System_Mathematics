import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCourseToCart } from '../src/utils/courseCart.js';
import { validateCourseBundle } from '../src/api.js';
const catalog = [{ code: '1001', name: 'Book', stock: 3, priceCents: 8500 }];
const result = { course_code: 'CS101', added: [{ item_id: 1001, name: 'Book', quantity: 2 }], out_of_stock: [{ item_id: 1002, name: 'Calculator', requested_quantity: 1, available_stock: 0 }] };
test('course adds required quantity, preserves cart and reports rejected stock', () => {
  const original = [{ ...catalog[0], quantity: 1 }];
  const output = addCourseToCart(original, catalog, result);
  assert.equal(output.cart[0].quantity, 3);
  assert.equal(original[0].quantity, 1);
  assert.match(output.message, /2 × Book/);
  assert.match(output.message, /Calculator: needs 1, available 0/);
});
test('course does not exceed stock including existing cart quantities', () => {
  const original = [{ ...catalog[0], quantity: 2 }];
  const output = addCourseToCart(original, catalog, result);
  assert.equal(output.cart[0].quantity, 2);
  assert.match(output.message, /No course supplies were added/);
  assert.match(output.message, /already in your cart/);
});
test('new cart lines use catalog data and sold out bundles add nothing', () => {
  assert.equal(addCourseToCart([], catalog, result).cart[0].quantity, 2);
  assert.deepEqual(addCourseToCart([], catalog, { ...result, added: [] }).cart, []);
  assert.match(addCourseToCart([], [], result).message, /no longer in the catalog/);
});
test('bundle request matches actual Flask route and response', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:5001/api/cart/course');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { course_code: 'CS101' });
    return { ok: true, json: async () => ({ status: 'success', ...result }) };
  };
  try { assert.deepEqual((await validateCourseBundle(' cs101 ')).added, result.added); }
  finally { globalThis.fetch = original; }
});
