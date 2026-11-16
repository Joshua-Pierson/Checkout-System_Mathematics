// Compare against current server values so an unchanged SQL UPDATE is unnecessary.
export async function saveCatalogItem(action, id, item, deal, api) {
  if (action === 'remove') return api.deleteItem(id);
  let itemChanged = false;
  let assignedId = id;
  const rules = await api.fetchBundles();
  if (action === 'add') {
    const result = await api.createItem(item);
    assignedId = result.item_id;
    itemChanged = true;
  } else {
    const inventory = await api.fetchInventory();
    const original = inventory.find((row) => Number(row.item_id) === Number(id));
    if (!original) throw new Error(`Item ${id} not found. Refresh the catalog and check the ID.`);
    const changes = Object.fromEntries(Object.entries(item).filter(([key, value]) =>
      typeof value === 'number' ? Number(original[key]) !== value : original[key] !== value));
    if (Object.keys(changes).length) {
      await api.updateItem(id, changes);
      itemChanged = true;
    }
  }
  const existing = rules[assignedId];
  const dealChanged = deal
    ? !existing || Number(existing.trigger) !== deal.quantity || Math.round(Number(existing.price) * 100) !== deal.priceCents
    : Boolean(existing);
  try {
    if (dealChanged) {
      if (deal) await api.updateBundle(assignedId, {
        trigger_quantity: deal.quantity, bundle_price: deal.priceCents / 100,
      });
      else await api.deleteBundle(assignedId);
    }
  } catch (error) {
    throw new Error(`${itemChanged ? `Item ${assignedId} saved` : 'Catalog values unchanged'}, but the multi-buy deal was not saved: ${error.message}`);
  }
  return { message: action === 'add'
    ? `Item created. Assigned ID: ${assignedId}.`
    : itemChanged || dealChanged ? `Item ${id} saved.` : 'No changes to save.' };
}
