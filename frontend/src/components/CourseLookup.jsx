import { useEffect, useRef, useState } from 'react';
import { prepareInventory } from '../utils/cart.js';
import { fetchCourseSupplies, fetchInventory, validateCourseBundle } from '../api.js';

export default function CourseLookup({ onAdd }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [rejected, setRejected] = useState([]);
  const [loading, setLoading] = useState(false);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);

  function change(value) {
    pending.current?.abort();
    setCode(value); setResult(null); setRejected([]); setMessage(''); setLoading(false); setAdding(false);
  }
  async function lookup(event) {
    event.preventDefault();
    pending.current?.abort();
    if (!code.trim()) { setMessage('Enter a course number.'); return; }
    const controller = new AbortController();
    pending.current = controller;
    setRejected([]); setLoading(true); setResult(null); setMessage('Looking up course supplies...');
    try {
      const response = await fetchCourseSupplies(code, controller.signal);
      if (controller.signal.aborted) return;
      setResult(response);
      setMessage(response.supplies.length ? `Supplies found for ${response.course_code}.` : 'No supplies are listed for this course.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  async function addBundle() {
    if (adding || !result) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setAdding(true); setRejected([]); setMessage('Checking current stock...');
    try {
      const bundle = await validateCourseBundle(result.course_code, controller.signal);
      const inventory = prepareInventory(await fetchInventory(controller.signal));
      if (controller.signal.aborted) return;
      onAdd(bundle, inventory);
      setRejected(bundle.out_of_stock);
      setMessage('Course stock check completed. See the cart message for items added or rejected.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.message);
    } finally {
      if (!controller.signal.aborted) setAdding(false);
    }
  }
  return <section className="panel products-panel" aria-labelledby="course-lookup-heading">
    <div className="panel-heading"><div><p className="small-kicker">PLAN YOUR SUPPLIES</p>
      <h2 id="course-lookup-heading">Look up supplies by course</h2></div></div>
    <div className="quick-add">
      <p>Enter the course code as listed in your catalog, such as CS101.</p>
      <form onSubmit={lookup}>
        <label htmlFor="course-number">Course number</label>
        <input id="course-number" value={code} onChange={(event) => change(event.target.value)} maxLength={50} required placeholder="e.g. CS101" autoComplete="off" />
        <button type="submit" disabled={loading || adding || !code.trim()}>{loading ? 'Looking up...' : 'Look up supplies'}</button>
      </form>
      <p role="status" aria-live="polite">{message}</p>
    </div>
    {result && result.supplies.length > 0 && <>
      <div className="table-scroll" tabIndex="0" role="region" aria-label="Course supplies results">
        <table><caption>Supplies for {result.course_code}</caption>
          <thead><tr><th scope="col">Code</th><th scope="col">Supply</th><th scope="col">Unit price</th><th scope="col">Required</th><th scope="col">Available</th><th scope="col">Availability</th></tr></thead>
          <tbody>{result.supplies.map((item) => <tr key={item.item_id}>
            <td>{item.item_id}</td><td>{item.name}</td><td>${Number(item.price).toFixed(2)}</td>
            <td>{item.required_quantity}</td><td>{item.available_stock}</td>
            <td>{item.in_stock ? 'In stock' : Number(item.available_stock) > 0 ? 'Insufficient stock' : 'Out of stock'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="quick-add"><button type="button" disabled={adding || loading} onClick={addBundle}>{adding ? 'Checking stock...' : 'Add course supplies to cart'}</button>
        {rejected.length > 0 && <><h3>Supplies not added</h3><ul>{rejected.map((item) => <li key={item.item_id}>{item.name}: needs {item.requested_quantity}, available {item.available_stock}.</li>)}</ul></>}
      </div>
      <p className="catalog-status">Availability is checked when you search. Look up again for updated stock. Adding course supplies checks stock again and adds the required quantities. Each click adds another set if stock permits.</p>
    </>}
  </section>;
}
