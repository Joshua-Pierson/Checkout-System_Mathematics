import { useState } from 'react';
import { checkout } from '../api.js';
import { money } from '../utils/cart.js';

export default function CheckoutReceipt({ cart, totalsReady, busy, setBusy, studentId }) {
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  async function submit() {
    if (!cart.length || !totalsReady || busy) return;
    setBusy(true); setMessage('Requesting checkout summary...'); setResult(null);
    try {
      const response = await checkout(cart, studentId);
      setResult({ ...response, enteredStudentId: studentId, items: cart.map((item) => ({ ...item })) });
      setMessage('Pending summary received. Payment was not processed and no sale was saved.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function cancel() { setResult(null); setMessage('Checkout summary canceled. Your cart is unchanged.'); }
  return <>
    <h3 className="sr-only">Checkout</h3>
    <p className="checkout-note">Summary preview only. Payments and completed sales are not enabled.</p>
    <button className="checkout-button" type="button" disabled={busy || !cart.length || !totalsReady} onClick={submit}>Get checkout summary <span aria-hidden="true">→</span></button>{' '}
    <button className="cancel-checkout" type="button" disabled={busy || !result} onClick={cancel}>Cancel Checkout</button>
    <p id="checkout-message" role="status" aria-live="polite">{message}</p>
    <h3 className="receipt-heading">Receipt</h3>
    <div id="receipt-output">{result ? <>
      <p>Pending checkout summary — not a payment receipt</p>
      <p>Transaction: {result.transaction_id}</p>
      <p>Student ID entered: {result.enteredStudentId || 'None (guest)'}</p>
      <ul>{result.items.map((item) => <li key={item.code}>{item.name} × {item.quantity}: {money(item.priceCents * item.quantity)}</li>)}</ul>
      <p>Subtotal: ${Number(result.subtotal).toFixed(2)}</p>
      <p>Tax: ${Number(result.tax).toFixed(2)}</p>
      <p>Total: ${Number(result.total).toFixed(2)}</p>
    </> : 'No receipt generated yet.'}</div>
  </>;
}
