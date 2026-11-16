export function addCourseToCart(cart, catalog, result) {
  const next = cart.map((item) => ({ ...item }));
  const added = [];
  const rejected = (result.out_of_stock || []).map((item) => `${item.name}: needs ${item.requested_quantity}, available ${item.available_stock}`);
  for (const item of result.added) {
    const product = catalog.find((product) => product.code === String(item.item_id));
    const existing = next.find((row) => row.code === String(item.item_id));
    if (!product) { rejected.push(`${item.name}: no longer in the catalog`); continue; }
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('The backend returned an invalid course quantity.');
    if ((existing?.quantity || 0) + quantity > product.stock) {
      rejected.push(`${item.name}: not enough stock for the course quantity plus items already in your cart`);
      continue;
    }
    if (existing) { Object.assign(existing, product, { quantity: existing.quantity + quantity }); }
    else next.push({ ...product, quantity });
    added.push(`${quantity} × ${product.name}`);
  }
  return { cart: next, message: [
    added.length ? `Added for ${result.course_code}: ${added.join(', ')}.` : 'No course supplies were added.',
    rejected.length ? `Not added: ${rejected.join('; ')}.` : '',
  ].filter(Boolean).join(' ') };
}
