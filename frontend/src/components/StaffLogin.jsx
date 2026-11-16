import { useRef, useState } from 'react';
import { useStaffAuth } from '../StaffAuth.jsx';
export default function StaffLogin({ onBusyChange } = {}) {
  const { login } = useStaffAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const id = String(data.get('staff_id') || '').trim();
    const pin = String(data.get('pin') || '');
    if (!id || !pin.trim()) { setMessage('Enter your staff ID and PIN.'); return; }
    pending.current = true; setBusy(true); onBusyChange?.(true); setMessage('Checking staff credentials...');
    try { await login(id, pin); }
    catch (error) { setMessage(error.message); }
    finally {
      form.elements.namedItem('pin').value = '';
      pending.current = false; setBusy(false); onBusyChange?.(false);
    }
  }
  return <section className="staff-login-panel" aria-label="Staff login">
    <h2>Staff login</h2>
    <p>Sign in before using Manager tools or performing overrides. You’ll be signed out when this page is refreshed.</p>
    <form onSubmit={submit} autoComplete="off">
      <fieldset disabled={busy}>
        <label>Staff ID<input name="staff_id" type="text" autoComplete="off" required /></label>
        <label>Staff PIN<input name="pin" type="password" autoComplete="off" required /></label>
        <button type="submit">{busy ? 'Signing in...' : 'Sign in'}</button>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
