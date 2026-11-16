import { useState } from 'react';
import { loginStaff } from '../api.js';

export default function StaffLogin({ onLogin, onStudent }) {
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    try {
      const result = await loginStaff(staffId.trim(), pin);
      if (!result.staff?.staff_id) throw new Error('The backend returned an invalid staff profile.');
      onLogin(result.staff);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <p className="eyebrow">STAFF ACCESS</p>
    <h1 id="manager-heading">Staff Login</h1>
    <p>Sign in with your staff ID and PIN to open the manager workspace.</p>
    <form className="staff-login-form" onSubmit={submit}>
      <div>
        <label htmlFor="staff-login-id">Staff ID</label>
        <input id="staff-login-id" name="staff_id" autoComplete="username" required
          value={staffId} onChange={(event) => setStaffId(event.target.value)} />
      </div>
      <div>
        <label htmlFor="staff-login-pin">PIN</label>
        <input id="staff-login-pin" name="pin" type="password" inputMode="numeric"
          autoComplete="current-password" required value={pin}
          onChange={(event) => setPin(event.target.value)} />
      </div>
      {error && <p className="staff-login-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <button className="manager-student-return" type="button" disabled={busy} onClick={onStudent}>
        Back to Student View
      </button>
    </form>
  </>;
}
