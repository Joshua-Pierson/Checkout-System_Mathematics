import { useRef, useState } from 'react';
import { createBundle } from '../../api.js';
import { bundlePayload } from '../../utils/bundles.js';

export default function BundleForm({ catalog, status, error, onBusyChange }) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const nextId = useRef(0);
  const saving = useRef(false);
  const ready = status === 'ready' && catalog.length > 0;
  function change(id, patch) {
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...patch } : row));
    setMessage('');
  }
  async function submit(event) {
    event.preventDefault();
    if (saving.current || !ready) return;
    let payload;
    try { payload = bundlePayload(name, rows, catalog); }
    catch (error) { setMessage(error.message); return; }
    saving.current = true;
    setBusy(true); onBusyChange(true); setMessage('Saving bundle...');
    try {
      const response = await createBundle(payload);
      setMessage(`Bundle “${payload.name}” saved.${response.bundle_id != null ? ` ID: ${response.bundle_id}.` : ''}`);
      setName(''); setRows([]);
    } catch (error) { setMessage(error.message); }
    finally { saving.current = false; setBusy(false); onBusyChange(false); }
  }
  return <>
    <h2>Create a Course Supply Bundle</h2>
    <p>Give the kit a name, then choose its catalog items and quantities. A bundle groups supplies; it does not set a special price or reserve stock.</p>
    {status === 'loading' && <p role="status">Loading catalog...</p>}
    {status === 'error' && <p role="alert">{error}</p>}
    {status === 'ready' && !catalog.length && <p>Add catalog items before creating a bundle.</p>}
    <form className="bundle-form" onSubmit={submit}>
      <fieldset disabled={busy || !ready}>
        <div className="bundle-name"><label htmlFor="bundle-name">Bundle name</label>
          <input id="bundle-name" value={name} onChange={(event) => { setName(event.target.value); setMessage(''); }} maxLength={100} placeholder="e.g. ARTS 1311 Kit" required /></div>
        {rows.map((row, index) => <div className="bundle-row" key={row.id}>
          <div><label htmlFor={`bundle-item-${row.id}`}>Catalog item {index + 1}</label>
            <select id={`bundle-item-${row.id}`} value={row.code} required onChange={(event) => change(row.id, { code: event.target.value })}>
              <option value="">Choose an item</option>
              {catalog.map((item) => <option key={item.code} value={item.code} disabled={rows.some((other) => other.id !== row.id && other.code === item.code)}>{item.name} (#{item.code})</option>)}
            </select></div>
          <div><label htmlFor={`bundle-qty-${row.id}`}>Quantity</label>
            <input id={`bundle-qty-${row.id}`} type="number" min="1" step="1" required value={row.quantity} onChange={(event) => change(row.id, { quantity: event.target.value })} /></div>
          <button type="button" aria-label={`Remove bundle item ${index + 1}`} onClick={() => { setRows((previous) => previous.filter((other) => other.id !== row.id)); setMessage(''); }}>Remove</button>
        </div>)}
        <div className="bundle-buttons">
          <button type="button" disabled={rows.length >= catalog.length} onClick={() => { const id = nextId.current++; setRows((previous) => [...previous, { id, code: '', quantity: '1' }]); setMessage(''); }}>Add catalog item</button>
          <button type="submit" disabled={!rows.length}>{busy ? 'Saving...' : 'Save bundle'}</button>
        </div>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{message}</p>
  </>;
}
