import { useEffect, useRef, useState } from 'react';
import { money } from '../utils/cart.js';
import CheckoutReceipt from './CheckoutReceipt.jsx';
import { calculateCart } from '../api.js';

export default function StudentCart({ catalog, status, error, cart, message, dispatch, active }) {
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [totals, setTotals] = useState({ cart: null, status: 'idle' });

  useEffect(() => {
    if (!cart.length) { setTotals({ cart, status: 'ready', subtotal: 0, discount: 0, tax: 0, total: 0 }); return; }
    const controller = new AbortController();
    setTotals({ cart, status: 'loading' });
    
    // Automatically recalculates whenever cart OR studentId changes
    calculateCart(cart, studentId.trim(), controller.signal).then((result) => {
      if (!controller.signal.aborted) setTotals({ ...result, cart, status: 'ready' });
    }).catch((error) => {
      if (!controller.signal.aborted) setTotals({ cart, status: 'error', error: error.message });
    });
    
    return () => controller.abort();
  }, [cart, studentId]);

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

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">YOUR CAMPUS ESSENTIALS</p><h1 id="cart-heading">Student Cart<span>.</span></h1>
        <p>Everything you need, all in one place.</p></div>
      <span className="page-tag">STUDENT CHECKOUT</span>
    </div>
    <fieldset className="student-workspace" disabled={busy}>
      <div className="catalog-column">
        <section className="student-id-card" aria-labelledby="student-details-heading">
          <div><span className="small-kicker">LET S START HERE</span><h2 id="student-details-heading">Your student details</h2>
            <p>Have a Student ID? Add it here, or continue as a guest.</p></div>
          <div className="id-field"><label htmlFor="student-id">Student ID <span className="optional">Optional</span></label>
            <input id="student-id" name="student_id" type="text" value={studentId}
              onChange={(event) => setStudentId(event.target.value)} autoComplete="off"
              placeholder="Enter your student ID" aria-describedby="student-id-status" />
            <p id="student-id-status" role="status" aria-live="polite">
              {studentId.trim() ? 'ID entered. Discount applies to eligible items.' : 'Guest checkout available'}
            </p>
          </div>
        </section>

        <section className="panel products-panel" aria-labelledby="products-heading">
          <div className="panel-heading"><div><p className="small-kicker">BROWSE THE CATALOG</p><h2 id="products-heading">Available products</h2></div>
            <span className="count-badge">{catalog.length} products</span></div>
          <div className="catalog-filters">
            <div><label htmlFor="product-search">Search products</label>
              <input id="product-search" type="search" placeholder="Search by item name " value={query} disabled={!ready} onChange={(event) => setQuery(event.target.value)} /></div>
            <div><label htmlFor="category-filter">Category</label>
              <select id="category-filter" value={category} disabled={!ready} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}
              </select></div>
          </div>
          <p id="catalog-message" className={status === 'error' ? 'notice error-notice' : 'catalog-status'} role="status" aria-live="polite">{catalogMessage}</p>
          
          <div className="table-scroll" tabIndex="0" role="region" aria-label="Available products table">
            <table><caption className="sr-only">Choose a category or search, then add an item</caption>
              <thead><tr>{['Code','Product','Price','Category',''].map((heading, index) => <th scope="col" key={index}>{heading || <span className="sr-only">Action</span>}</th>)}</tr></thead>
              <tbody id="product-list">{matches.map((product) => {
                const quantity = cart.find((item) => item.code === product.code)?.quantity || 0;
                return <tr key={product.code}><td><span className="item-code">{product.code}</span></td><td className="product-name">{product.name}</td>
                  <td className="price-cell">{money(product.priceCents)}</td><td><span className="category-pill">{product.category}</span></td>
                  <td><button className="add-product" type="button" aria-label={`Add ${product.name} to cart`} disabled={quantity >= product.stock} onClick={() => add(product.code)}>
                    {product.stock === 0 ? 'Sold out' : <><span aria-hidden="true">+</span> Add</>}</button></td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="quick-add"><h3>Add by item code</h3><p>Already know what you need? Enter its code.</p>
            <form id="add-item-form" onSubmit={submit}>
              <label className="sr-only" htmlFor="item-code">Item code</label>
              <input id="item-code" name="item-code" type="text" ref={codeInput} value={code} onChange={(event) => setCode(event.target.value)} maxLength={30} placeholder="e.g. 1001" required autoComplete="off" />
              <button type="submit" disabled={!ready}>Add item <span aria-hidden="true"> </span></button>
            </form>
            <p id="item-message" className="helper-text" role="status" aria-live="polite">{message || (ready ? 'Enter a code or browse the catalog above.' : 'Add items once the catalog loads.')}</p>
          </div>
        </section>
      </div>

      <aside className="panel order-panel" aria-labelledby="order-heading">
        <div className="panel-heading"><div><p className="small-kicker">YOUR SELECTION</p><h2 id="order-heading">Order summary</h2></div><span className="count-badge">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span></div>
        <div id="added-items">
          {!cart.length && <div className="empty-cart"><span className="empty-cart-icon" aria-hidden="true"> </span><h3>A fresh start</h3><p>Your cart is empty.<br />Add something from the catalog to begin.</p></div>}
          {cart.map((item) => <div className="cart-item" key={item.code}>
            <div className="cart-item-top"><div><h3>{item.name}</h3><p>#{item.code} <span> </span> {money(item.priceCents)} each</p></div><strong>{money(item.priceCents * item.quantity)}</strong></div>
            <div className="cart-item-actions"><div className="quantity-control">
              <button type="button" aria-label={`Decrease ${item.name} quantity`} disabled={item.quantity <= 1} onClick={() => dispatch({ type: 'decrease', code: item.code })}> </button>
              <span aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
              <button type="button" aria-label={`Increase ${item.name} quantity`} disabled={item.quantity >= item.stock} onClick={() => add(item.code)}>+</button>
            </div><button className="remove-item" type="button" onClick={() => dispatch({ type: 'remove', code: item.code })} aria-label={`Remove ${item.name} from cart`}>Remove</button></div>
          </div>)}
        </div>
        
        <div id="cart-total" className="totals" role="status" aria-live="polite">{totalsReady ? <>
          <p><span>Subtotal</span><span>${Number(totals.subtotal).toFixed(2)}</span></p>
          {totals.discount > 0 && <p><span style={{color: '#245337'}}>Student Discount</span><span style={{color: '#245337'}}>-${Number(totals.discount).toFixed(2)}</span></p>}
          <p><span>Tax</span><span>${Number(totals.tax).toFixed(2)}</span></p>
          <p className="grand-total"><span>Total</span><strong>${Number(totals.total).toFixed(2)}</strong></p>
        </> : <p className="helper-text">{totals.cart === cart && totals.status === 'error' ? totals.error : 'Calculating total...'}</p>}</div>
        
        <CheckoutReceipt key={JSON.stringify([cart, studentId.trim()])} studentId={studentId.trim()} cart={cart} totalsReady={totalsReady} busy={busy} setBusy={setBusy} />
        <button id="cancel-transaction" className="cancel-transaction" type="button" disabled={!cart.length && !studentId} onClick={cancel}>Cancel transaction</button>
      </aside>
    </fieldset>
  </>;
}