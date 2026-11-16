import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCourseSupplies } from '../src/api.js';
test('course lookup uses existing backend route and actual response stock', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  const payload = { status: 'success', course_code: 'CS101', supplies: [
    { item_id: 1001, name: 'Textbook', price: 85, required_quantity: 2, available_stock: 1, in_stock: false },
  ] };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:5001/api/courses/CS101');
    assert.equal(options.method, 'GET');
    assert.equal(options.signal, controller.signal);
    return { ok: true, json: async () => payload };
  };
  try { assert.deepEqual(await fetchCourseSupplies(' cs101 ', controller.signal), payload); }
  finally { globalThis.fetch = original; }
});
test('lookup surfaces missing course and database errors, rejects malformed supplies', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, message] of [[404, 'No supplies cataloged for course BAD'], [500, 'Database unavailable']]) {
      globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ status: 'error', message }) });
      await assert.rejects(fetchCourseSupplies('BAD'), { message });
    }
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'success' }) });
    await assert.rejects(fetchCourseSupplies('CS101'), /invalid course supplies/);
    await assert.rejects(fetchCourseSupplies('  '), /Enter a course number/);
  } finally { globalThis.fetch = original; }
});
