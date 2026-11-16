import { useStaffAuth } from '../StaffAuth.jsx';
import StaffRemovalDialog from './StaffRemovalDialog.jsx';
import { APPAREL_SIZES, APPAREL_COLORS, isApparel, cartKey, productQuantity, selectionLineTotal } from '../utils/apparel.js';
import { useEffect, useRef, useState } from 'react';
import { money, linePricing, multiBuySavings, confirmMultiBuy } from '../utils/cart.js';
import { discountLabel } from '../utils/discounts.js';
import CheckoutReceipt from './CheckoutReceipt.jsx';
import CourseLookup from './CourseLookup.jsx';
import { calculateCart } from '../api.js';

export default function StudentCart({ catalog, status, error, cart, message, dispatch, active, pricingVersion = 0 }) {
  const { staff } = useStaffAuth();
  function removeItem(item) {
    if (busy) return;
    if (staff) { setRemovalItem(item); setBusy(true); }
    else dispatch({ type: 'remove', key: cartKey(item) });
  }
  const [selections, setSelections] = useState({});
  const [busy, setBusy] = useState(false);
  const [removalItem, setRemovalItem] = useState(null);
  function closeRemoval() { setRemovalItem(null); setBusy(false); }
  const [studentId, setStudentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [totals, setTotals] = useState({ cart: null, status: 'idle' });

  useEffect(() => {
    if (!cart.length) { setTotals({ cart, status: 'ready', subtotal: 0, discount: 0, tax: 0, total: 0 }); return; }
    const controller = new AbortController();
    setTotals({ cart, status: 'loading' });
    
    // Recalculate for either discount ID; the backend selects one discount.
    calculateCart(cart, studentId.trim(), controller.signal, employeeId.trim()).then((result) => {
      if (!controller.signal.aborted) {
        confirmMultiBuy(cart, result);
        setTotals({ ...result, cart, studentId: studentId.trim(), employeeId: employeeId.trim(), pricingVersion, status: 'ready' });
      }
    }).catch((error) => {
      if (!controller.signal.aborted) setTotals({ cart, status: 'error', error: error.message });
    });
    
    return () => controller.abort();
  }, [cart, studentId, employeeId, pricingVersion]);

  const totalsReady = totals.cart === cart && totals.status === 'ready' && (!cart.length || (totals.studentId === studentId.trim() && totals.employeeId === employeeId.trim() && totals.pricingVersion === pricingVersion));

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

  function add(itemCode, selection = selections[itemCode] || {}) { if (ready && !busy) dispatch({ type: 'add', code: itemCode, catalog, selection }); }

  function submit(event) {
    event.preventDefault();
    const itemCode = code.trim();
    const product = catalog.find((item) => item.code === itemCode);
    const quantity = productQuantity(cart, itemCode);
    add(itemCode);
    if (product && quantity < product.stock && (!isApparel(product) || (selections[itemCode]?.size && selections[itemCode]?.color))) setCode('');
    codeInput.current?.focus();
  }

  function cancel() {
    dispatch({ type: 'cancel' }); setCode(''); setCategory(''); setQuery(''); setStudentId(''); setEmployeeId(''); setSelections({}); codeInput.current?.focus();
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
          <div><span className="small-kicker">LET S START HERE</span><h2 id="student-details-heading">Your discount details</h2>
            <p>Enter a student or employee ID, or continue as a guest. If both IDs qualify, the backend applies the larger discount; they never stack.</p></div>
          <div className="discount-id-fields">
          <div className="id-field"><label htmlFor="student-id">Student ID <span className="optional">Optional</span></label>
            <input id="student-id" name="student_id" type="text" value={studentId}
              onChange={(event) => setStudentId(event.target.value)} autoComplete="off"
              placeholder="Enter your student ID" aria-describedby="student-id-status" />
            <p id="student-id-status" role="status" aria-live="polite">
              {studentId.trim() ? 'Student ID entered. Eligibility is checked by the backend.' : 'Guest checkout available'}
            </p>
          </div>
          <div className="id-field"><label htmlFor="employee-id">Employee ID <span className="optional">Optional</span></label>
            <input id="employee-id" name="employee_id" type="text" value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)} autoComplete="off"
              placeholder="Enter your employee ID" aria-describedby="employee-id-status" />
            <p id="employee-id-status" role="status" aria-live="polite">
              {employeeId.trim() ? 'Employee ID entered. Eligibility is checked by the backend.' : 'Employee ID is optional'}
            </p>
          </div>
          </div>
        </section>

        <CourseLookup onAdd={(result, freshCatalog) => dispatch({ type: 'add-course', result, catalog: freshCatalog })} />

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
                const quantity = productQuantity(cart, product.code);
                return <tr key={product.code}><td><span className="item-code">{product.code}</span></td><td className="product-name">{product.name}</td>
                  <td className="price-cell">{money(product.priceCents)}{product.multiBuy && <small className="deal-label">{product.multiBuy.quantity} for {money(product.multiBuy.priceCents)}</small>}</td><td><span className="category-pill">{product.category}</span></td>
                  <td>{isApparel(product) && <div className="apparel-picker">
                    <label htmlFor={`size-${product.code}`}>Size</label>
                    <select id={`size-${product.code}`} value={selections[product.code]?.size || ''} disabled={product.stock === 0}
                      onChange={(event) => setSelections((previous) => ({ ...previous, [product.code]: { ...previous[product.code], size: event.target.value } }))}>
                      <option value="">Choose size</option>{APPAREL_SIZES.map((size) => <option key={size}>{size}</option>)}
                    </select>
                    <label htmlFor={`color-${product.code}`}>Color</label>
                    <select id={`color-${product.code}`} value={selections[product.code]?.color || ''} disabled={product.stock === 0}
                      onChange={(event) => setSelections((previous) => ({ ...previous, [product.code]: { ...previous[product.code], color: event.target.value } }))}>
                      <option value="">Choose color</option>{APPAREL_COLORS.map((color) => <option key={color}>{color}</option>)}
                    </select>
                    <small>Size/color availability is not verified. Stock shown is for the whole product.</small>
                  </div>}<button className="add-product" type="button" aria-label={`Add ${product.name} to cart`} disabled={quantity >= product.stock} onClick={() => add(product.code)}>
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
          {cart.map((item) => {
            const backendData = totalsReady && totals.items
              ? totals.items.find((i) => String(i.item_id) === String(item.code))
              : null;
            const displayTotal = backendData ? selectionLineTotal(cart, item, Math.round(backendData.line_total * 100)) : item.priceCents * item.quantity;
            const bundleApplied = backendData?.bundle_applied;

            return <div className="cart-item" key={cartKey(item)}>
              <div className="cart-item-top">
                <div>
                  <h3>{item.name}</h3>
                  <p>#{item.code} <span>•</span> {money(item.priceCents)} each</p>
                  {item.size && <p>Size: {item.size} · Color: {item.color}</p>}
                  {bundleApplied && (
                    <p style={{ color: '#245337', fontWeight: '700', marginTop: '4px' }}>
                      * Bundle Deal: {backendData.bundle_trigger} for ${Number(backendData.bundle_price).toFixed(2)}
                    </p>
                  )}
                </div>
                <strong>{money(displayTotal)}</strong>
              </div>
              <div className="cart-item-actions">
                <div className="quantity-control">
                  <button type="button" aria-label={`Decrease ${item.name} quantity`} disabled={item.quantity <= 1} onClick={() => dispatch({ type: 'decrease', key: cartKey(item) })}>-</button>
                  <span aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                  <button type="button" aria-label={`Increase ${item.name} quantity`} disabled={productQuantity(cart, item.code) >= item.stock} onClick={() => add(item.code, item)}>+</button>
                </div>
                <button className="remove-item" type="button" onClick={() => removeItem(item)} aria-label={`Remove ${item.name} from cart`}>Remove</button>
              </div>
            </div>;
          })}
        </div>
        
        {!totalsReady && multiBuySavings(cart) > 0 && <p className="deal-label">Multi-buy savings: {money(multiBuySavings(cart))} (pending server confirmation)</p>}
        <div id="cart-total" className="totals" role="status" aria-live="polite">{totalsReady ? <>
          <p><span>Subtotal</span><span>${Number(totals.subtotal).toFixed(2)}</span></p>
          {totals.multi_buy_discount > 0 && <p><span>Multi-buy Discount</span><span>-${Number(totals.multi_buy_discount).toFixed(2)}</span></p>}
          {totals.discount > 0 && <p><span style={{color: '#245337'}}>{discountLabel(totals.discount_type)}</span><span style={{color: '#245337'}}>-${Number(totals.discount).toFixed(2)}</span></p>}
          <p><span>Tax</span><span>${Number(totals.tax).toFixed(2)}</span></p>
          <p className="grand-total"><span>Total</span><strong>${Number(totals.total).toFixed(2)}</strong></p>
        </> : <p className="helper-text">{totals.cart === cart && totals.status === 'error' ? totals.error : 'Calculating total...'}</p>}</div>
        
        <CheckoutReceipt key={JSON.stringify([cart, studentId.trim(), employeeId.trim(), pricingVersion])} studentId={studentId.trim()} employeeId={employeeId.trim()} cart={cart} totalsReady={totalsReady} busy={busy} setBusy={setBusy} />
        <button id="cancel-transaction" className="cancel-transaction" type="button" disabled={!cart.length && !studentId && !employeeId} onClick={cancel}>Cancel transaction</button>
      </aside>
    </fieldset>
    {removalItem && <StaffRemovalDialog item={removalItem} onCancel={closeRemoval} onApproved={() => {
      dispatch({ type: 'remove', key: cartKey(removalItem) }); closeRemoval();
    }} />}
  </>;
}