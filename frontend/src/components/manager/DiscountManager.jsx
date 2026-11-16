import { useEffect, useState } from 'react';
import {
  fetchDiscountEligibilities,
  fetchDiscountRules,
  updateDiscountEligibility,
  updateDiscountRule,
} from '../../api.js';

export default function DiscountManager() {
  const [eligibilities, setEligibilities] = useState([]);
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchDiscountEligibilities(controller.signal), fetchDiscountRules(controller.signal)])
      .then(([categories, discountRules]) => {
        setEligibilities(categories);
        setRules(discountRules);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function toggleEligibility(category, field) {
    if (busy) return;
    const updated = eligibilities.map((item) => item.category === category
      ? { ...item, [`${field}_eligible`]: !item[`${field}_eligible`] }
      : item);
    const next = updated.find((item) => item.category === category);
    setBusy(true);
    setMessage('');
    try {
      await updateDiscountEligibility(category, {
        student_eligible: next.student_eligible,
        employee_eligible: next.employee_eligible,
      });
      setEligibilities(updated);
      setMessage(`Eligibility updated for ${category}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRule(profile) {
    if (busy) return;
    const rule = rules[profile];
    const value = Number(rule?.value);
    if (!Number.isFinite(value) || value < 0 || (rule.type === 'percent' && value > 100)) {
      setMessage('Enter a valid discount value; percentage discounts must be 0–100.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await updateDiscountRule(profile, { discount_type: rule.type, discount_value: value });
      setMessage(`${profile} discount rule saved.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading discount configuration...</p>;
  if (loadError) return <p role="alert">Could not load discount configuration: {loadError}</p>;
  return <>
    <h2>Discount Configuration</h2>
    {message && <p role="status" aria-live="polite">{message}</p>}
    <h3>Profile discount rules</h3>
    {['student', 'employee'].map((profile) => <div className="discount-rule" key={profile}>
      <strong>{profile[0].toUpperCase() + profile.slice(1)}</strong>
      <label htmlFor={`discount-type-${profile}`}>Type</label>
      <select id={`discount-type-${profile}`} value={rules[profile]?.type || 'percent'} disabled={busy}
        onChange={(event) => setRules((previous) => ({
          ...previous, [profile]: { ...previous[profile], type: event.target.value },
        }))}>
        <option value="percent">Percent off (%)</option>
        <option value="dollar">Flat dollar off ($)</option>
      </select>
      <label htmlFor={`discount-value-${profile}`}>Value</label>
      <input id={`discount-value-${profile}`} type="number" min="0"
        max={rules[profile]?.type === 'percent' ? '100' : undefined} step="0.01"
        value={rules[profile]?.value ?? 0} disabled={busy}
        onChange={(event) => setRules((previous) => ({
          ...previous, [profile]: { ...previous[profile], value: event.target.value },
        }))} />
      <button type="button" disabled={busy} onClick={() => saveRule(profile)}>Save rule</button>
    </div>)}
    <h3>Category eligibility</h3>
    {eligibilities.length ? <div className="table-scroll">
      <table>
        <thead><tr><th scope="col">Category</th><th scope="col">Student eligible</th><th scope="col">Employee eligible</th></tr></thead>
        <tbody>{eligibilities.map((category) => <tr key={category.category}>
          <td>{category.category}</td>
          {['student', 'employee'].map((profile) => <td key={profile}>
            <input type="checkbox" checked={category[`${profile}_eligible`]} disabled={busy}
              aria-label={`${profile} eligible for ${category.category}`}
              onChange={() => toggleEligibility(category.category, profile)} />
          </td>)}
        </tr>)}</tbody>
      </table>
    </div> : <p>No product categories are available.</p>}
  </>;
}
