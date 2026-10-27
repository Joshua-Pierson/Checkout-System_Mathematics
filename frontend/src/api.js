const baseUrl = 'http://localhost:5001';

async function request(path, { signal, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      signal, method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not connect to Python. Check that the backend is running.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`Backend returned an invalid response (${response.status}).`); }
  if (!response.ok || result.status !== 'success') {
    throw new Error(result.message || `Request failed (${response.status}).`);
  }
  return result;
}

export async function fetchInventory(signal) {
  return (await request('/api/inventory', { signal })).data;
}

export async function fetchCategories(signal) {
  return (await request('/api/categories', { signal })).data;
}

export const createItem = (item) => request('/api/items', { method: 'POST', body: item });
export const updateItem = (id, item) => request(`/api/items/${id}`, { method: 'PUT', body: item });
export const deleteItem = (id) => request(`/api/items/${id}`, { method: 'DELETE' });

const cartPayload = (cart) => ({ items: cart.map((item) => ({ item_id: Number(item.code), quantity: item.quantity })) });

export const calculateCart = (cart, studentId, signal) => request('/api/cart/calculate', { 
  method: 'POST', body: { ...cartPayload(cart), student_id: studentId }, signal 
});

export const checkout = (cart, cashTendered, studentId) => request('/api/checkout/cash', {
  method: 'POST', 
  body: { 
    ...cartPayload(cart),
    cash_tendered: Number(cashTendered),
    student_id: studentId
  }
});

export const checkoutCard = (cart, cardNumber, studentId) => request('/api/checkout/card', {
  method: 'POST', 
  body: { 
    ...cartPayload(cart),
    card_number: cardNumber,
    student_id: studentId
  }
});