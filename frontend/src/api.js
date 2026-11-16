import { aggregateCart } from './utils/apparel.js';
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

const cartItems = aggregateCart;

export const calculateCart = (cart, studentId, signal, employeeId) => request('/api/cart/calculate', { 
  method: 'POST', body: { items: cartItems(cart), student_id: studentId, employee_id: employeeId }, signal 
});

export const checkout = (cart, cashTendered, studentId, employeeId) => request('/api/checkout/cash', {
  method: 'POST', 
  body: { 
    cart: cartItems(cart),
    cash_tendered: Number(cashTendered),
    student_id: studentId,
    employee_id: employeeId
  }
});

export const checkoutCard = (cart, cardNumber, studentId, employeeId) => request('/api/checkout/card', {
  method: 'POST', 
  body: { 
    cart: cartItems(cart),
    card_number: cardNumber,
    student_id: studentId,
    employee_id: employeeId
  }
});

// --- Discount & Bundle Management Endpoints ---

export const fetchDiscountEligibilities = (signal) => request('/api/discounts/categories', { signal }).then(r => r.data);
export const updateDiscountEligibility = (category, data) => request(`/api/discounts/categories/${category}`, { method: 'PUT', body: data });

export const fetchDiscountRules = (signal) => request('/api/discounts/rules', { signal }).then(r => r.data);
export const updateDiscountRule = (profile, data) => request(`/api/discounts/rules/${profile}`, { method: 'PUT', body: data });

export const fetchBundles = (signal) => request('/api/discounts/bundles', { signal }).then(r => r.data);
export const updateBundle = (itemId, data) => request(`/api/discounts/bundles/${itemId}`, { method: 'PUT', body: data });
export const deleteBundle = (itemId) => request(`/api/discounts/bundles/${itemId}`, { method: 'DELETE' });

export const createBundle = (bundle) => request('/api/bundles', { method: 'POST', body: bundle });

export async function fetchCourseSupplies(courseCode, signal) {
  const code = String(courseCode).trim().toUpperCase();
  if (!code) throw new Error('Enter a course number.');
  const result = await request(`/api/courses/${encodeURIComponent(code)}`, { signal });
  if (!Array.isArray(result.supplies)) throw new Error('The backend returned invalid course supplies.');
  return result;
}

export async function validateCourseBundle(courseCode, signal) {
  const result = await request('/api/cart/course', {
    method: 'POST', body: { course_code: String(courseCode).trim().toUpperCase() }, signal,
  });
  if (!Array.isArray(result.added) || !Array.isArray(result.out_of_stock)) {
    throw new Error('The backend returned an invalid course bundle.');
  }
  return result;
}
