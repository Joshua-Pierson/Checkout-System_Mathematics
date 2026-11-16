import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCart, checkout, checkoutCard } from '../src/api.js';
import { discountLabel } from '../src/utils/discounts.js';
test('employee ID is sent unchanged to calculation, cash, and card endpoints', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ path: new URL(url).pathname, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ status: 'success', discount_type: 'Employee', discount: 20 }) };
  };
  try {
    const cart = [{ code: '1006', quantity: 1 }];
    await calculateCart(cart, 'STUD1234', undefined, 'EMP0012');
    await checkout(cart, 100, 'STUD1234', 'EMP0012');
    await checkoutCard(cart, '4242424242424242', 'STUD1234', 'EMP0012');
    assert.deepEqual(calls.map(c => c.path), ['/api/cart/calculate', '/api/checkout/cash', '/api/checkout/card']);
    for (const { body } of calls) {
      assert.equal(body.employee_id, 'EMP0012');
      assert.equal(body.student_id, 'STUD1234');
    }
  } finally { globalThis.fetch = original; }
});
test('totals and receipt labels follow the selected backend discount, not entered IDs', () => {
  assert.equal(discountLabel('Employee'), 'Employee Discount');
  assert.equal(discountLabel('Student'), 'Student Discount');
  assert.equal(discountLabel(null), 'Discount');
});
