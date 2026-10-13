import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareInventory, addToCart, cartTotal, calculateChange } from '../src/utils/cart.js';

const row = { item_id: 1001, name: 'Textbook', unit_price: '85.00', category: 'Books', stock_quantity: '2' };
test('CSV strings normalize and duplicate or invalid inventory is rejected', () => {
  const [item] = prepareInventory([row]);
  assert.equal(item.code, '1001');
  assert.equal(item.priceCents, 8500);
  assert.equal(item.stock, 2);
  assert.throws(() => prepareInventory([row, row]), /duplicate/);
  assert.throws(() => prepareInventory([{ ...row, unit_price: '' }]), /invalid fields/);
  assert.throws(() => prepareInventory([{ ...row, stock_quantity: 1.5 }]), /invalid price or stock/);
  assert.throws(() => prepareInventory({ items: [row] }), /JSON array/);
});
test('cart uses cents, respects stock, and does not mutate previous state', () => {
  const catalog = prepareInventory([{ ...row, unit_price: '2.99' }]);
  const empty = [];
  const first = addToCart(empty, catalog, '1001');
  const second = addToCart(first.cart, catalog, '1001');
  assert.equal(empty.length, 0);
  assert.equal(first.cart[0].quantity, 1);
  assert.equal(second.cart[0].quantity, 2);
  assert.equal(cartTotal(second.cart), 598);
  assert.match(addToCart(second.cart, catalog, '1001').error, /Only 2/);
  assert.match(addToCart([], catalog, 'missing').error, /No product/);
  assert.match(addToCart([], prepareInventory([{ ...row, stock_quantity: 0 }]), '1001').error, /out of stock/);
});
test('cash change handles insufficient and invalid payment', () => {
  assert.equal(calculateChange(598, 1000), 402);
  assert.equal(calculateChange(598, 598), 0);
  assert.equal(calculateChange(598, 500), null);
  assert.equal(calculateChange(598, NaN), null);
});
