import { useState } from 'react';
import { checkout, checkoutCard } from '../api.js';
import { money } from '../utils/cart.js';

export default function CheckoutReceipt({ cart, totalsReady, busy, setBusy, studentId }) {
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState('cash');
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');

  async function submit() {
    if (!cart.length || !totalsReady || busy) return;
    if (method === 'cash' && !cash) return;
    if (method === 'card' && !card) return;
    
    setBusy(true); 
    setMessage('Verifying payment and depleting stock...'); 
    setResult(null);
    
    try {
      const response = method === 'cash' 
        ? await checkout(cart, cash, studentId)
        : await checkoutCard(cart, card, studentId);
        
      setResult({ ...response, items: cart.map((item) => ({ ...item })) });
      setMessage('Transaction complete. Inventory updated.');
      setCash('');
      setCard('');
    } catch (error) { 
      setMessage(error.message); 
    } finally { 
      setBusy(false); 
    }
  }

  function cancel() { 
    setResult(null); 
    setMessage('Transaction canceled. Your cart is unchanged.'); 
    setCash(''); 
    setCard('');
  }

  return <>
    <h3 className="sr-only">Checkout</h3>
    
    <div style={{ margin: '20px 24px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <label>
          <input type="radio" value="cash" checked={method === 'cash'} onChange={() => setMethod('cash')} disabled={busy} /> Cash
        </label>
        <label>
          <input type="radio" value="card" checked={method === 'card'} onChange={() => setMethod('card')} disabled={busy} /> Card
        </label>
      </div>

      {method === 'cash' ? (
        <div>
          <label htmlFor="cash-tendered" style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: '#3d5547' }}>
            Cash Tendered ($)
          </label>
          <input id="cash-tendered" type="number" min="0" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} disabled={busy || !cart.length || !totalsReady} placeholder="0.00" />
        </div>
      ) : (
        <div>
          <label htmlFor="card-number" style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: '#3d5547' }}>
            Card Number (Test: 4242 4242 4242 4242)
          </label>
          <input id="card-number" type="text" value={card} onChange={(e) => setCard(e.target.value)} disabled={busy || !cart.length || !totalsReady} placeholder="0000 0000 0000 0000" />
        </div>
      )}
    </div>

    <button className="checkout-button" type="button" disabled={busy || !cart.length || !totalsReady || (method === 'cash' && !cash) || (method === 'card' && !card)} onClick={submit}>
      Process {method === 'cash' ? 'Cash' : 'Card'} Payment <span aria-hidden="true">→</span>
    </button>
    <button className="cancel-checkout" type="button" disabled={busy || (!result && !cash && !card)} onClick={cancel}>
      Cancel Checkout
    </button>
    
    <p id="checkout-message" role="status" aria-live="polite">{message}</p>
    
    <h3 className="receipt-heading">Receipt</h3>
    <div id="receipt-output">{result ? <>
      {result.receipt ? (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', background: '#f4f8f0', padding: '15px', borderRadius: '6px' }}>
          {result.receipt.receipt_text}
        </pre>
      ) : (
        <>
          <p><strong>Status:</strong> {result.status.toUpperCase()}</p>
          <ul>{result.items.map((item) => <li key={item.code}>{item.name} × {item.quantity}: {money(item.priceCents * item.quantity)}</li>)}</ul>
          <p>Subtotal: ${Number(result.subtotal || 0).toFixed(2)}</p>
          {result.discount > 0 && <p>Student Discount: -${Number(result.discount).toFixed(2)}</p>}
          <p>Total Due: ${Number(result.total_due).toFixed(2)}</p>
        </>
      )}
    </> : 'No receipt generated yet.'}</div>
  </>;
}