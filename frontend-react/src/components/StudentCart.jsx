import { useEffect, useRef, useState } from 'react';
import { cartTotal, money } from '../utils/cart.js';
import CheckoutReceipt from './CheckoutReceipt.jsx';

export default function StudentCart({ catalog, status, error, cart, message, dispatch, active }) {
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
  function add(itemCode) { if (ready) dispatch({ type: 'add', code: itemCode, catalog }); }
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
    dispatch({ type: 'cancel' }); setCode(''); setCategory(''); setQuery(''); codeInput.current?.focus();
  }
  return <>
    <h2 id="cart-heading">Student Cart</h2>
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
    <p id="cart-total">Cart total: {money(cartTotal(cart))}</p>
    <CheckoutReceipt />
    <button id="cancel-transaction" type="button" disabled={!cart.length} onClick={cancel}>Cancel Transaction</button>
  </>;
}
