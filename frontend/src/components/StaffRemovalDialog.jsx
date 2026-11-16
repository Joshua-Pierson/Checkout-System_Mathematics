import { useEffect, useRef, useState } from 'react';
import { useStaffAuth } from '../StaffAuth.jsx';
import StaffLogin from './StaffLogin.jsx';
export default function StaffRemovalDialog({ item, onCancel, onApproved }) {
  const { staff, authorizeRemoval } = useStaffAuth();
  const dialog = useRef(null);
  const pending = useRef(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  async function approve() {
    if (pending.current || !staff) return;
    pending.current = true; setBusy(true); setMessage('Authorizing and recording removal...');
    try { await authorizeRemoval(item.code); onApproved(); }
    catch (error) { setMessage(error.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="staff-removal-dialog" aria-labelledby="staff-remove-title" onCancel={(event) => {
    event.preventDefault(); if (!pending.current && !loginBusy) onCancel();
  }}>
    <h2 id="staff-remove-title">Remove cart item</h2>
    <p>{item.name}{item.size ? ` (${item.size}, ${item.color})` : ''} — quantity {item.quantity}. This removes the entire selected cart entry.</p>
    {staff ? <><p>Signed in as {staff.name || staff.staff_id}.</p>
      <button type="button" disabled={busy} onClick={approve}>{busy ? 'Authorizing...' : 'Authorize removal'}</button></> : <StaffLogin onBusyChange={setLoginBusy} />}
    <button type="button" disabled={busy || loginBusy} onClick={onCancel}>Cancel removal</button>
    <p role="status" aria-live="polite">{message}</p>
  </dialog>;
}
