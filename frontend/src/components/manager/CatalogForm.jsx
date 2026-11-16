import { useStaffAuth } from '../../StaffAuth.jsx';
import { useEffect, useRef, useState } from 'react';
import * as api from '../../api.js';
import { saveCatalogItem } from '../../utils/catalog.js';

import { prepareMultiBuy } from '../../utils/cart.js';

const fields = [
  { name: 'item_id', label: 'Item ID:', type: 'number', min: '1', step: '1' },
  { name: 'name', label: 'Item Name:', type: 'text' },
  { name: 'unit_price', label: 'Item Price:', type: 'number', min: '0', step: '.01' },
  { name: 'category', label: 'Item Category:', type: 'text' },
  { name: 'stock_quantity', label: 'Stock Quantity:', type: 'number', min: '0', step: '1' },
  { name: 'tax_rate', label: 'Tax Rate:', type: 'number', min: '0', max: '1', step: '0.0001' },
];
fields.push(
  { name: 'multi_buy_quantity', label: 'Multi-buy quantity (optional):', type: 'number', min: '2', step: '1', optional: true },
  { name: 'multi_buy_price', label: 'Bundle price (optional):', type: 'number', min: '0', step: '0.01', optional: true },
);
const titles = { add: 'Add to Catalog', edit: 'Edit Catalog', remove: 'Remove From Catalog' };

export default function CatalogForm({ action, onBack, onSaved, embedded = false, onBusyChange }) {
  const { authorizeCatalogPriceChange } = useStaffAuth();
  const formRef = useRef(null);
  const working = useRef(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    api.fetchCategories(controller.signal).then(setCategories).catch(() => {});
    return () => controller.abort();
  }, []);
  async function loadItem() {
    if (working.current) return;
    const form = formRef.current;
    const id = Number(form.elements.namedItem('item_id').value);
    if (!Number.isSafeInteger(id) || id < 1) { setMessage('Enter a positive whole-number item ID, then click Load item.'); return; }
    working.current = true; setBusy(true); onBusyChange?.(true); setMessage('Loading item...');
    try {
      const inventory = await api.fetchInventory();
      const rules = await api.fetchBundles();
      const item = inventory.find((entry) => Number(entry.item_id) === id);
      if (!item) throw new Error(`Item ${id} not found.`);
      for (const name of ['name', 'unit_price', 'category', 'stock_quantity', 'tax_rate']) {
        form.elements.namedItem(name).value = item[name] ?? '';
      }
      form.elements.namedItem('multi_buy_quantity').value = rules[id]?.trigger ?? '';
      form.elements.namedItem('multi_buy_price').value = rules[id]?.price ?? '';
      form.elements.namedItem('price_reason').value = '';
      setMessage(`Loaded ${item.name}. Edit the fields below and save.`);
    } catch (error) { setMessage(error.message); }
    finally { working.current = false; setBusy(false); onBusyChange?.(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (working.current) return;
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
    let deal = null;
    if (item) {
      try {
        deal = prepareMultiBuy(values.multi_buy_quantity, values.multi_buy_price, Math.round(item.unit_price * 100));
      } catch (error) { setMessage(error.message); return; }
    }
    working.current = true; setBusy(true); onBusyChange?.(true); setMessage('Saving...');
    try {
      const result = await saveCatalogItem(action, id, item, deal, api, { reason: values.price_reason || '', authorize: authorizeCatalogPriceChange });
      setMessage(result.message);
      form.reset(); onSaved();
    } catch (error) { setMessage(error.message); }
    finally { working.current = false; setBusy(false); onBusyChange?.(false); }
  }
  const visible = action === 'remove' ? fields.slice(0, 1) : action === 'add' ? fields.slice(1) : fields;
  return <>
    <h2 id="catalog-form-heading">{titles[action]}</h2>
    {!embedded && <nav><ul><li><a href="#manager-menu" onClick={(event) => { if (busy) event.preventDefault(); else onBack(event); }}>Go Back</a></li></ul></nav>}
    {action === 'add' && <p>The database assigns the item ID.</p>}
    {action !== 'remove' && <p>You can change the price here. A price change requires a reason and approval using your signed-in staff account. Use an existing category. Tax rate example: 0.0825 for 8.25%, or 0 for exempt.</p>}
    {action !== 'remove' && <p>Example deal: quantity 3, bundle price 15.00. Leave both deal fields blank for regular pricing (this clears an existing deal when editing).</p>}
    <form ref={formRef} id={`${action}Form`} onSubmit={submit}>
      <fieldset disabled={busy}>
        {visible.map((field) => <span key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>{' '}
          <input id={field.name} name={field.name} type={field.type} min={field.min} max={field.max} step={field.step}
            list={field.name === 'category' ? 'catalog-categories' : undefined} required={!field.optional} />
          {action === 'edit' && field.name === 'item_id' && <button type="button" onClick={loadItem}>Load item</button>}<br /><br />
        </span>)}
        {action === 'edit' && <span>
          <label htmlFor="price_reason">Reason for price change (required only when the price changes):</label>
          <textarea id="price_reason" name="price_reason" rows="3" /><br /><br />
        </span>}
        <datalist id="catalog-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
        <input type="submit" value={busy ? 'Saving...' : titles[action]} />
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{message}</p>
  </>;
}
