import { useState } from 'react';
import { checkout } from '../api.js';
import { money } from '../utils/cart.js';

export default function CheckoutReceipt({ cart, totalsReady, busy, setBusy }) {
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  async function submit() {
    if (!cart.length || !totalsReady || busy) return;
    setBusy(true); setMessage('Requesting checkout summary...'); setResult(null);
    try {
      const response = await checkout(cart);
      setResult({ ...response, items: cart.map((item) => ({ ...item })) });
      setMessage('Pending summary received. Payment was not processed and no sale was saved.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function cancel() { setResult(null); setMessage('Checkout summary canceled. Your cart is unchanged.'); }
  return <>
    <h3>Checkout</h3>
    <p>The current backend calculates a pending summary only. Payment processing, sale recording, and stock updates are not connected.</p>
    <button type="button" disabled={busy || !cart.length || !totalsReady} onClick={submit}>Get Checkout Summary</button>{' '}
    <button type="button" disabled={busy} onClick={cancel}>Cancel Checkout</button>
    <p id="checkout-message" role="status" aria-live="polite">{message}</p>
    <h3>Receipt</h3>
    <div id="receipt-output">{result ? <>
      <p>Pending checkout summary — not a payment receipt</p>
      <p>Transaction: {result.transaction_id}</p>
      <ul>{result.items.map((item) => <li key={item.code}>{item.name} × {item.quantity}: {money(item.priceCents * item.quantity)}</li>)}</ul>
      <p>Subtotal: ${Number(result.subtotal).toFixed(2)}</p>
      <p>Tax: ${Number(result.tax).toFixed(2)}</p>
      <p>Total: ${Number(result.total).toFixed(2)}</p>
    </> : 'No receipt generated yet.'}</div>
  </>;
}
