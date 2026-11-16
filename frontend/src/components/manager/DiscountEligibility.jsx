import { useEffect, useRef, useState } from 'react';
import { fetchDiscountEligibilities, updateDiscountEligibility } from '../../api.js';
import { eligibilityChanged, saveEligibilityChanges } from '../../utils/eligibility.js';

export default function DiscountEligibility({ onBusyChange, onSaved, renderCatalog }) {
  const [original, setOriginal] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState('');
  const [failures, setFailures] = useState([]);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading'); setMessage('Loading category discount settings...'); setFailures([]);
    fetchDiscountEligibilities(controller.signal).then((rows) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(rows) || rows.some((row) => typeof row.category !== 'string' || typeof row.student_eligible !== 'boolean' || typeof row.employee_eligible !== 'boolean')) {
        throw new Error('The backend returned invalid discount settings.');
      }
      const sorted = [...rows].sort((a, b) => a.category.localeCompare(b.category));
      setOriginal(sorted); setDrafts(sorted.map((row) => ({ ...row }))); setStatus('ready'); setMessage('');
    }).catch((error) => {
      if (!controller.signal.aborted) { setStatus('error'); setMessage(error.message); }
    });
    return () => controller.abort();
  }, [reload]);
  const dirty = drafts.some((row) => {
    const before = original.find((entry) => entry.category === row.category);
    return before && eligibilityChanged(row, before);
  });
  function change(category, field, checked) {
    setDrafts((rows) => rows.map((row) => row.category === category ? { ...row, [field]: checked } : row));
    setMessage('Unsaved changes. Click Save discount eligibility to apply them.'); setFailures([]);
  }
  async function save(event) {
    event.preventDefault();
    if (!dirty || saving.current) return;
    saving.current = true; setBusy(true); onBusyChange?.(true); setMessage('Saving discount eligibility...'); setFailures([]);
    try {
      const result = await saveEligibilityChanges(original, drafts, updateDiscountEligibility);
      setOriginal((rows) => rows.map((row) => result.saved.find((entry) => entry.category === row.category) || row));
      setFailures(result.failed);
      setMessage(result.failed.length
        ? `${result.saved.length} categories saved. ${result.failed.length} could not be saved; their edits remain available to retry.`
        : `Discount eligibility saved for ${result.saved.length} ${result.saved.length === 1 ? 'category' : 'categories'}.`);
      if (result.saved.length) onSaved?.();
    } finally { saving.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <section aria-label="Catalog discount settings">
    <p>Use the Student Discount and Employee Discount checkboxes in the catalog below. Eligibility applies to the whole category: changing one product updates every product in the same category. Click Save discount eligibility to apply changes.</p>
    <div>
      <fieldset className="eligibility-fieldset" disabled={busy}>
        {renderCatalog({ rows: drafts, disabled: busy || status !== 'ready', onChange: change })}
        <p role="status" aria-live="polite">{message}</p>
        {status === 'error' && <button type="button" onClick={() => setReload((value) => value + 1)}>Retry loading discount settings</button>}
        {status === 'ready' && <div className="eligibility-actions">
          <button type="button" onClick={save} disabled={!dirty}>{busy ? 'Saving...' : 'Save discount eligibility'}</button>
          <button type="button" disabled={!dirty} onClick={() => { setDrafts(original.map((row) => ({ ...row }))); setFailures([]); setMessage('Unsaved changes discarded.'); }}>Discard unsaved changes</button>
        </div>}
      </fieldset>
    </div>
    {failures.length > 0 && <ul role="alert">{failures.map((failure) => <li key={failure.category}>{failure.category}: {failure.message}</li>)}</ul>}
  </section>;
}
