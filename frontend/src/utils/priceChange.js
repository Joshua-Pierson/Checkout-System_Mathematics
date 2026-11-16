export async function saveStaffPriceChange({ itemId, expectedPrice, newPrice, reason, staffId, pin }, api) {
  const id = Number(itemId);
  const price = Number(newPrice);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Choose an existing item.');
  if (String(newPrice).trim() === '' || !Number.isFinite(price) || price < 0 ||
      !Number.isSafeInteger(Math.round(price * 100)) || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
    throw new Error('Enter a nonnegative price with no more than two decimal places.');
  }
  if (!reason.trim()) throw new Error('Enter a reason for the price change.');
  if (!staffId.trim() || !pin.trim()) throw new Error('Enter your staff ID and PIN.');
  const inventory = await api.fetchInventory();
  const item = inventory.find((row) => Number(row.item_id) === id);
  if (!item) throw new Error('This item is no longer in the catalog. Refresh and choose another item.');
  const originalPrice = Number(item.unit_price);
  if (originalPrice !== Number(expectedPrice)) throw new Error('The item price has changed. Refresh the catalog and review the current price before trying again.');
  if (Math.round(originalPrice * 100) === Math.round(price * 100)) throw new Error('The new price matches the current price. No change was saved.');
  const authorization = await api.authorizePriceChange({
    item_id: id, staff_id: staffId.trim(), pin,
    original_price: originalPrice, new_price: price, reason: reason.trim(),
  });
  try {
    await api.updateItem(id, { unit_price: price });
  } catch (error) {
    throw new Error(`Staff approval was recorded, but the catalog price update did not complete: ${error.message} Refresh the catalog to check the current price before retrying.`);
  }
  return { item_id: id, name: item.name, original_price: originalPrice, new_price: price,
    reason: reason.trim(), authorized_by: authorization.authorized_by };
}
