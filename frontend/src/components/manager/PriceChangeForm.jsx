import { useRef, useState } from 'react';
import { useStaffAuth } from '../../StaffAuth.jsx';

export default function PriceChangeForm({ catalog, status, onSaved, onBusyChange }) {
  const { staff, savePriceChange } = useStaffAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const saving = useRef(false);
  const item = catalog.find((entry) => entry.code === code);
  async function submit(event) {
    event.preventDefault();
    if (saving.current || !item) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    saving.current = true; setBusy(true); onBusyChange(true); setMessage('Verifying staff approval and saving price...');
    try {
      const result = await savePriceChange({
        itemId: code, expectedPrice: item.priceCents / 100,
        newPrice: values.get('new_price'), reason: String(values.get('reason') || ''),
      });
      setHistory((previous) => [...previous, result]);
      setMessage(`Price saved for ${result.name}: $${result.original_price.toFixed(2)} → $${result.new_price.toFixed(2)}. Staff approval and reason recorded.`);
      form.reset(); setCode(''); onSaved();
    } catch (error) { setMessage(error.message); }
    finally {
      saving.current = false; setBusy(false); onBusyChange(false);
    }
  }
  return <>
    <h2>Change an item’s price</h2>
    <p>Signed in as {staff?.name || staff?.staff_id}. Enter a reason. Successful changes update the catalog price for future purchases.</p>
    <form className="staff-price-form" onSubmit={submit} autoComplete="off">
      <fieldset disabled={busy || status !== 'ready'}>
        <label htmlFor="price-item">Catalog item</label>
        <select id="price-item" value={code} required onChange={(event) => { setCode(event.target.value); setMessage(''); }}>
          <option value="">Choose an item</option>
          {catalog.map((entry) => <option key={entry.code} value={entry.code}>#{entry.code} — {entry.name}</option>)}
        </select>
        <p>Current price: <strong>{item ? `$${(item.priceCents / 100).toFixed(2)}` : 'Choose an item'}</strong></p>
        <label htmlFor="new-item-price">New price ($)</label>
        <input id="new-item-price" name="new_price" type="number" min="0" step="0.01" required />
        <label htmlFor="price-change-reason">Reason for change</label>
        <textarea id="price-change-reason" name="reason" rows="3" required />
        <button type="submit" disabled={!item}>{busy ? 'Saving...' : 'Authorize and save price'}</button>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {history.length > 0 && <section aria-label="Price changes this session">
      <h3>Price changes this session</h3>
      <ul>{history.map((change, index) => <li key={index}>
        {change.name} (#{change.item_id}): ${change.original_price.toFixed(2)} → ${change.new_price.toFixed(2)}. Reason: {change.reason}{change.authorized_by ? ` — ${change.authorized_by}` : ''}
      </li>)}</ul>
    </section>}
  </>;
}
