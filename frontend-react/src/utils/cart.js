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
  return { code, name: name.trim(), priceCents, stock,
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
  return cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function calculateChange(totalCents, paidCents) {
  if (!Number.isSafeInteger(paidCents) || paidCents < totalCents) return null;
  return paidCents - totalCents;
}
