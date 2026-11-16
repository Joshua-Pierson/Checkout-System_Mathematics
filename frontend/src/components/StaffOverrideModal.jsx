import { useState } from 'react';
import { authorizeItemRemoval, authorizePriceOverride } from '../api.js';

export default function StaffOverrideModal({ actionType, item, onConfirm, onCancel }) {
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [newPrice, setNewPrice] = useState((item.priceCents / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      if (actionType === 'REMOVE') {
        await authorizeItemRemoval(staffId.trim(), pin, item.code);
        onConfirm();
      } else {
        const price = Number(newPrice);
        if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid non-negative price.');
        if (!reason.trim()) throw new Error('A justification reason is required.');
        const response = await authorizePriceOverride({
          staff_id: staffId.trim(),
          pin,
          item_id: Number(item.code),
          original_price: (item.catalogPriceCents ?? item.priceCents) / 100,
          new_price: price,
          reason: reason.trim(),
        });
        onConfirm(response);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return <div className="override-modal-overlay" role="presentation">
    <section className="override-modal" role="dialog" aria-modal="true" aria-labelledby="override-heading">
      <h2 id="override-heading">Staff authorization required</h2>
      <p>{actionType === 'REMOVE' ? `Authorize removal of ${item.name}.` : `Authorize a price change for ${item.name}.`}</p>
      <form onSubmit={submit}>
        <label htmlFor="override-staff-id">Staff ID</label>
        <input id="override-staff-id" value={staffId} onChange={(event) => setStaffId(event.target.value)} required autoComplete="username" />
        <label htmlFor="override-pin">PIN</label>
        <input id="override-pin" type="password" value={pin} onChange={(event) => setPin(event.target.value)} required autoComplete="current-password" />
        {actionType === 'PRICE' && <>
          <label htmlFor="override-new-price">New price ($)</label>
          <input id="override-new-price" type="number" min="0" step="0.01" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} required />
          <label htmlFor="override-reason">Reason</label>
          <input id="override-reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={200} />
        </>}
        {error && <p className="override-error" role="alert">{error}</p>}
        <div className="override-modal-actions">
          <button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Authorize'}</button>
          <button type="button" onClick={onCancel} disabled={loading}>Cancel</button>
        </div>
      </form>
    </section>
  </div>;
}
