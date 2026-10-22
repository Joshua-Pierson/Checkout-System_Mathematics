import { useEffect, useState } from 'react';
import { createItem, updateItem, deleteItem, fetchCategories } from '../../api.js';

const fields = [
  { name: 'item_id', label: 'Item ID:', type: 'number', min: '1', step: '1' },
  { name: 'name', label: 'Item Name:', type: 'text' },
  { name: 'unit_price', label: 'Item Price:', type: 'number', min: '0', step: '.01' },
  { name: 'category', label: 'Item Category:', type: 'text' },
  { name: 'stock_quantity', label: 'Stock Quantity:', type: 'number', min: '0', step: '1' },
  { name: 'tax_rate', label: 'Tax Rate:', type: 'number', min: '0', max: '1', step: '0.0001' },
];
const titles = { add: 'Add to Catalog', edit: 'Edit Catalog', remove: 'Remove From Catalog' };

export default function CatalogForm({ action, onBack, onSaved }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal).then(setCategories).catch(() => {});
    return () => controller.abort();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const id = Number(values.item_id);
    if (action !== 'add' && (!Number.isSafeInteger(id) || id < 1)) {
      setMessage('Enter a positive whole-number item ID.'); return;
    }
    const item = action === 'remove' ? null : {
      name: values.name.trim(), category: values.category.trim(),
      unit_price: Number(values.unit_price), stock_quantity: Number(values.stock_quantity), tax_rate: Number(values.tax_rate),
    };
    if (item && (!item.name || !item.category || !Number.isFinite(item.unit_price) || item.unit_price < 0 ||
      !Number.isSafeInteger(item.stock_quantity) || item.stock_quantity < 0 || !Number.isFinite(item.tax_rate) || item.tax_rate < 0 || item.tax_rate > 1)) {
      setMessage('Enter a name, category, valid price, whole-number stock, and tax rate between 0 and 1.'); return;
    }
    setBusy(true); setMessage('Saving...');
    try {
      const result = action === 'add' ? await createItem(item) : action === 'edit' ? await updateItem(id, item) : await deleteItem(id);
      setMessage(action === 'add' ? `Item created. Assigned ID: ${result.item_id}.` : result.message);
      form.reset(); onSaved();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const visible = action === 'remove' ? fields.slice(0, 1) : action === 'add' ? fields.slice(1) : fields;
  return <>
    <h1 style={{ color: 'rgb(255, 255, 255)' }}>{titles[action]}</h1>
    <nav><ul><li><a href="#manager-menu" onClick={(event) => { if (busy) event.preventDefault(); else onBack(event); }}>Go Back</a></li></ul></nav>
    {action === 'add' && <p>The database assigns the item ID.</p>}
    {action !== 'remove' && <p>Use an existing category. Tax rate example: 0.0825 for 8.25%, or 0 for exempt.</p>}
    <form id={`${action}Form`} onSubmit={submit}>
      <fieldset disabled={busy}>
        {visible.map((field) => <span key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>{' '}
          <input id={field.name} name={field.name} type={field.type} min={field.min} max={field.max} step={field.step}
            list={field.name === 'category' ? 'catalog-categories' : undefined} required /><br /><br />
        </span>)}
        <datalist id="catalog-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
        <input type="submit" value={busy ? 'Saving...' : titles[action]} />
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{message}</p>
  </>;
}
