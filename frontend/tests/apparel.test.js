import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, prepareInventory } from '../src/utils/cart.js';
import { cartKey, aggregateCart, selectionLineTotal } from '../src/utils/apparel.js';
import { calculateCart, checkout, checkoutCard } from '../src/api.js';
const catalog = prepareInventory([{ item_id: 1006, name: 'Hoodie', unit_price: 45, category: 'apparel', stock_quantity: 3 }]);
const medium = { size: 'M', color: 'Black' };
const large = { size: 'L', color: 'Blue' };
test('apparel requires valid choices and combinations have separate cart identities', () => {
  assert.match(addToCart([], catalog, '1006').error, /Choose a size and color/);
  assert.match(addToCart([], catalog, '1006', {size:'XXXL', color:'Black'}).error, /Choose/);
  const first = addToCart([], catalog, '1006', medium).cart;
  const second = addToCart(first, catalog, '1006', large).cart;
  const third = addToCart(second, catalog, '1006', medium).cart;
  assert.equal(first[0].quantity, 1);
  assert.equal(third.length, 2);
  assert.equal(third[0].quantity, 2);
  assert.notEqual(cartKey(third[0]), cartKey(third[1]));
  assert.match(addToCart(third, catalog, '1006', large).error, /Only 3/);
  assert.equal(third.filter(item => cartKey(item) !== cartKey(third[0])).length, 1);
});
test('backend quantities aggregate by product and displayed totals do not double count', () => {
  const cart = [{...catalog[0], ...medium, quantity:1}, {...catalog[0], ...large, quantity:2}];
  assert.deepEqual(aggregateCart(cart), [{item_id:1006,quantity:3}]);
  assert.equal(cart.reduce((sum,item)=>sum+selectionLineTotal(cart,item,10001),0),10001);
});
test('calculation and both checkout methods send one combined product line', async () => {
  const original = globalThis.fetch;
  let calls=0;
  globalThis.fetch = async (url, options) => {
    const body=JSON.parse(options.body);
    assert.deepEqual(body.items || body.cart, [{item_id:1006,quantity:3}]);
    calls++;
    return {ok:true,json:async()=>({status:'success'})};
  };
  try {
    const cart = [{...catalog[0],...medium,quantity:1},{...catalog[0],...large,quantity:2}];
    await calculateCart(cart,'',undefined,'EMP123');
    await checkout(cart,200,'','EMP123');
    await checkoutCard(cart,'4242424242424242','','EMP123');
    assert.equal(calls,3);
  } finally {globalThis.fetch=original;}
});
