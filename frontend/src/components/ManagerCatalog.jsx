import { useState } from 'react';
import CatalogForm from './manager/CatalogForm.jsx';

const actions = [
  { value: 'add', label: 'Add to Catalog' },
  { value: 'edit', label: 'Edit Catalog' },
  { value: 'remove', label: 'Remove From Catalog' },
];

export default function ManagerCatalog({ onStudent, onSaved }) {
  const [action, setAction] = useState('add');
  const [saving, setSaving] = useState(false);
  return <>
    <p className="eyebrow">MANAGER WORKSPACE</p>
    <h1 id="manager-heading">Catalog Management</h1>
    <p>Add products, update catalog details, or remove an item.</p>
    <div className="manager-actions" role="group" aria-label="Catalog action">
      {actions.map((entry) => <button key={entry.value} type="button"
        aria-pressed={action === entry.value} disabled={saving}
        onClick={() => setAction(entry.value)}>{entry.label}</button>)}
    </div>
    <div className="manager-form-panel">
      <CatalogForm key={action} action={action} onSaved={onSaved} embedded onBusyChange={setSaving} />
    </div>
    <button className="manager-student-return" type="button" disabled={saving} onClick={onStudent}>Back to Student View</button>
  </>;
}
