import { useEffect, useRef, useState } from 'react';
import { money } from '../utils/cart.js';
import CheckoutReceipt from './CheckoutReceipt.jsx';
import { calculateCart } from '../api.js';

export default function StudentCart({ catalog, status, error, cart, message, dispatch, active }) {
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [totals, setTotals] = useState({ cart: null, status: 'idle' });
  useEffect(() => {
    if (!cart.length) { setTotals({ cart, status: 'ready', subtotal: 0, tax: 0, total: 0 }); return; }
    const controller = new AbortController();
    setTotals({ cart, status: 'loading' });
    calculateCart(cart, controller.signal).then((result) => {
      if (!controller.signal.aborted) setTotals({ ...result, cart, status: 'ready' });
    }).catch((error) => {
      if (!controller.signal.aborted) setTotals({ cart, status: 'error', error: error.message });
    });
    return () => controller.abort();
  }, [cart]);
  const totalsReady = totals.cart === cart && totals.status === 'ready';
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const codeInput = useRef(null);
  const ready = status === 'ready' && catalog.length > 0;
  useEffect(() => { if (active) codeInput.current?.focus(); }, [active]);
  const categories = [...new Set(catalog.map((item) => item.category))].sort((a,b) => a.localeCompare(b));
  const matches = catalog.filter((item) => (!category || category === item.category) && item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const catalogMessage = status === 'loading' ? 'Loading products...' : status === 'error' ? error
    : !catalog.length ? 'No products are available.' : !matches.length ? 'No items match your search or selected category.'
    : `${matches.length} product${matches.length === 1 ? '' : 's'} found.`;
  function add(itemCode) { if (ready && !busy) dispatch({ type: 'add', code: itemCode, catalog }); }
  function submit(event) {
    event.preventDefault();
    const itemCode = code.trim();
    const product = catalog.find((item) => item.code === itemCode);
    const quantity = cart.find((item) => item.code === itemCode)?.quantity || 0;
    add(itemCode);
    if (product && quantity < product.stock) setCode('');
    codeInput.current?.focus();
  }
  function cancel() {
    dispatch({ type: 'cancel' }); setCode(''); setCategory(''); setQuery(''); setStudentId(''); codeInput.current?.focus();
  }
  return <>
    <fieldset disabled={busy}>
    <h2 id="cart-heading">Student Cart</h2>
    <label htmlFor="student-id">Student ID (optional)</label>{' '}
    <input id="student-id" name="student_id" type="text" value={studentId}
      onChange={(event) => setStudentId(event.target.value)} autoComplete="off"
      placeholder="Enter your student ID" aria-describedby="student-id-status" />
    <p id="student-id-status" role="status" aria-live="polite">
      {studentId.trim() ? 'Student ID entered. Not verified against student records.' : 'No Student ID entered. Continue as a guest.'}
    </p>
    <h3>Available Products</h3>
    <label htmlFor="category-filter">Browse by category</label>{' '}
    <select id="category-filter" value={category} disabled={!ready} onChange={(event) => setCategory(event.target.value)}>
      <option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}
    </select>{' '}
    <label htmlFor="product-search">Search by item name</label>{' '}
    <input id="product-search" type="search" placeholder="Type part of a name" value={query} disabled={!ready} onChange={(event) => setQuery(event.target.value)} />
    <p id="catalog-message" role="status" aria-live="polite">{catalogMessage}</p>
    <table>
      <caption>Choose a category or search, then add an item</caption>
      <thead><tr>{['Item Code','Item Name','Item Cost','Category','Action'].map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
      <tbody id="product-list">{matches.map((product) => {
        const quantity = cart.find((item) => item.code === product.code)?.quantity || 0;
        return <tr key={product.code}><td>{product.code}</td><td>{product.name}</td><td>{money(product.priceCents)}</td><td>{product.category}</td>
          <td><button type="button" aria-label={`Add ${product.name} to cart`} disabled={quantity >= product.stock} onClick={() => add(product.code)}>{product.stock === 0 ? 'Out of stock' : 'Add'}</button></td></tr>;
      })}</tbody>
    </table>
    <h3>Add an Item by Code</h3>
    <form id="add-item-form" onSubmit={submit}>
      <label htmlFor="item-code">Item code</label>{' '}
      <input id="item-code" name="item-code" type="text" ref={codeInput} value={code} onChange={(event) => setCode(event.target.value)} maxLength={30} placeholder="Example: 1001" required autoComplete="off" />{' '}
      <button type="submit" disabled={!ready}>Add Item</button>
    </form>
    <p id="item-message" role="status" aria-live="polite">{message || (ready ? 'Products loaded. Enter a code or browse and add an item.' : catalogMessage)}</p>
    <h3>Your Cart</h3>
    <div id="added-items">
      {!cart.length && <p>Your cart is empty.</p>}
      {cart.map((item) => <div key={item.code}>
        <span>{item.name} | Code: {item.code} | {money(item.priceCents)} each | Quantity: {item.quantity} | Line total: {money(item.priceCents * item.quantity)} </span>
        <button type="button" aria-label={`Decrease ${item.name} quantity`} disabled={item.quantity <= 1} onClick={() => dispatch({ type: 'decrease', code: item.code })}>−</button>
        <button type="button" aria-label={`Increase ${item.name} quantity`} disabled={item.quantity >= item.stock} onClick={() => add(item.code)}>+</button>
        <button type="button" onClick={() => dispatch({ type: 'remove', code: item.code })} aria-label={`Remove ${item.name} from cart`}>Remove</button>
      </div>)}
    </div>
    <div id="cart-total" role="status" aria-live="polite">{totalsReady ? <>
      <p>Subtotal: ${Number(totals.subtotal).toFixed(2)}</p>
      <p>Tax: ${Number(totals.tax).toFixed(2)}</p>
      <p>Cart total: ${Number(totals.total).toFixed(2)}</p>
    </> : <p>{totals.cart === cart && totals.status === 'error' ? totals.error : 'Calculating total...'}</p>}</div>
    <CheckoutReceipt key={JSON.stringify([cart, studentId.trim()])} studentId={studentId.trim()} cart={cart} totalsReady={totalsReady} busy={busy} setBusy={setBusy} />
    <button id="cancel-transaction" type="button" disabled={!cart.length && !studentId} onClick={cancel}>Cancel Transaction</button>
    </fieldset>
  </>;
}
