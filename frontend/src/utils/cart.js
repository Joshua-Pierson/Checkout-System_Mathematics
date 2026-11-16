export const money = (cents) => `$${(cents / 100).toFixed(2)}`;

export function prepareProduct(product) {
  if (!product || typeof product !== 'object') throw new Error('The server returned an invalid product.');
  const code = String(product.item_id ?? '').trim();
  const { name, unit_price: rawPrice, stock_quantity: rawStock } = product;
  if (!code || typeof name !== 'string' || !name.trim() ||
      !['string', 'number'].includes(typeof rawPrice) || !['string', 'number'].includes(typeof rawStock) ||
      String(rawPrice).trim() === '' || String(rawStock).trim() === '') {
    throw new Error(`Product ${code || '(unknown)'} has invalid fields.`);
  }
  const price = Number(rawPrice);
  const priceCents = Math.round(price * 100);
  const stock = Number(rawStock);
  if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(priceCents) ||
      !Number.isSafeInteger(stock) || stock < 0) throw new Error(`Product ${code} has an invalid price or stock.`);
  const multiBuy = prepareMultiBuy(product.multi_buy_quantity, product.multi_buy_price, priceCents);
  return { code, name: name.trim(), priceCents, stock, multiBuy,
    category: String(product.category ?? '').trim() || 'Uncategorized' };
}

export function prepareInventory(products) {
  if (!Array.isArray(products)) throw new Error('Inventory data must be a JSON array.');
  const catalog = products.map(prepareProduct);
  if (new Set(catalog.map((item) => item.code)).size !== catalog.length) {
    throw new Error('The inventory contains duplicate item IDs.');
  }
  return catalog;
}

export function addToCart(cart, catalog, code) {
  const product = catalog.find((item) => item.code === code);
  if (!product) return { cart, error: `No product found for code "${code}".` };
  const quantity = cart.find((item) => item.code === code)?.quantity || 0;
  if (quantity >= product.stock) return { cart, error: product.stock === 0
    ? `${product.name} is out of stock.` : `Only ${product.stock} of ${product.name} are available.` };
  const next = quantity ? cart.map((item) => item.code === code ? { ...item, quantity: quantity + 1 } : item)
    : [...cart, { ...product, quantity: 1 }];
  return { cart: next, message: `${product.name} added to the cart.` };
}

export function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + linePricing(item).totalCents, 0);
}

export function calculateChange(totalCents, paidCents) {
  if (!Number.isSafeInteger(paidCents) || paidCents < totalCents) return null;
  return paidCents - totalCents;
}

// Deals apply to identical item IDs; incomplete bundles use the regular price.
export function prepareMultiBuy(quantity, price, unitPriceCents) {
  const blank = (value) => value == null || value === '';
  if (blank(quantity) && blank(price)) return null;
  const count = Number(quantity);
  const amount = Number(price);
  const cents = Math.round(amount * 100);
  if (blank(quantity) || blank(price) ||
      !['number', 'string'].includes(typeof quantity) ||
      !['number', 'string'].includes(typeof price) ||
      String(quantity).trim() === '' || String(price).trim() === '' ||
      !Number.isSafeInteger(count) || count < 2 || !Number.isFinite(amount) || amount < 0 ||
      !Number.isSafeInteger(cents) || cents >= count * unitPriceCents) {
    throw new Error('Multi-buy requires a whole-number quantity of at least 2 and a bundle price below the regular combined price.');
  }
  return { quantity: count, priceCents: cents };
}

export function linePricing(item) {
  const regularCents = item.priceCents * item.quantity;
  const bundles = item.multiBuy ? Math.floor(item.quantity / item.multiBuy.quantity) : 0;
  const totalCents = item.multiBuy
    ? bundles * item.multiBuy.priceCents + (item.quantity % item.multiBuy.quantity) * item.priceCents
    : regularCents;
  return { regularCents, totalCents, savingsCents: regularCents - totalCents, bundles };
}

export function multiBuySavings(cart) {
  return cart.reduce((sum, item) => sum + linePricing(item).savingsCents, 0);
}

export function confirmMultiBuy(cart, result) {
  const expected = multiBuySavings(cart);
  if (expected > 0 && (!['number', 'string'].includes(typeof result.multi_buy_discount) ||
      !Number.isFinite(Number(result.multi_buy_discount)) ||
      Math.round(Number(result.multi_buy_discount) * 100) !== expected)) {
    throw new Error('Multi-buy pricing is not confirmed by the backend. Checkout is paused until the server applies the advertised deal.');
  }
}
