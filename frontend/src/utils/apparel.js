// Legacy options are choices only; the current API has no size/color stock data.
export const APPAREL_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
export const APPAREL_COLORS = ['Black', 'Blue', 'Red', 'White'];
export const isApparel = (item) => item.category?.trim().toLowerCase() === 'apparel';
export const cartKey = (item) => item.size && item.color ? JSON.stringify([item.code, item.size, item.color]) : item.code;
export const productQuantity = (cart, code) => cart.filter((item) => item.code === code).reduce((sum, item) => sum + item.quantity, 0);
export function aggregateCart(cart) {
  const groups = new Map();
  for (const item of cart) {
    const id = Number(item.code);
    const group = groups.get(id);
    if (group) group.quantity += item.quantity;
    else groups.set(id, { item_id: id, quantity: item.quantity });
  }
  return [...groups.values()];
}
// Split the server's product total across selections without counting it twice.
export function selectionLineTotal(cart, item, totalCents) {
  const siblings = cart.filter((row) => row.code === item.code);
  const quantity = productQuantity(cart, item.code);
  const shares = siblings.map((row) => Math.floor(totalCents * row.quantity / quantity));
  shares[shares.length - 1] += totalCents - shares.reduce((sum, value) => sum + value, 0);
  return shares[siblings.findIndex((row) => cartKey(row) === cartKey(item))];
}
