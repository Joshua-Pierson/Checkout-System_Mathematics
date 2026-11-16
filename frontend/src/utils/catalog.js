// Compare against current server values so an unchanged SQL UPDATE is unnecessary.
export async function saveCatalogItem(action, id, item, deal, api, priceApproval = {}) {
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
    const changingPrice = 'unit_price' in changes;
    if (changingPrice) {
      if (!priceApproval.authorize) throw new Error('Staff login is required to change a price.');
      if (!priceApproval.reason?.trim()) throw new Error('Enter a reason for the price change.');
      const cents = item.unit_price * 100;
      if (!Number.isFinite(cents) || item.unit_price < 0 || !Number.isSafeInteger(Math.round(cents)) || Math.abs(cents - Math.round(cents)) > 0.000001) {
        throw new Error('Enter a nonnegative price with no more than two decimal places.');
      }
      await priceApproval.authorize({ item_id: Number(id), original_price: Number(original.unit_price),
        new_price: item.unit_price, reason: priceApproval.reason.trim() });
    }
    if (Object.keys(changes).length) {
      try { await api.updateItem(id, changes); }
      catch (error) {
        if (changingPrice) throw new Error(`Price approval was recorded, but the catalog update did not complete: ${error.message} Refresh the catalog before retrying.`);
        throw error;
      }
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
