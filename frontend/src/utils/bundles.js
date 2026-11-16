export function bundlePayload(name, rows, catalog) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error('Enter a bundle name of 1–100 characters.');
  if (!rows.length) throw new Error('Add at least one catalog item to the bundle.');
  const seen = new Set();
  const items = rows.map((row) => {
    const product = catalog.find((item) => item.code === row.code);
    if (!product) throw new Error('Choose an existing catalog item for every row.');
    if (seen.has(row.code)) throw new Error('Each item can appear once. Change its quantity instead.');
    seen.add(row.code);
    const quantity = Number(row.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Every quantity must be a positive whole number.');
    const item_id = Number(row.code);
    if (!Number.isSafeInteger(item_id) || item_id < 1) throw new Error('Catalog item IDs must be positive whole numbers.');
    return { item_id, quantity };
  });
  return { name: trimmed, items };
}
