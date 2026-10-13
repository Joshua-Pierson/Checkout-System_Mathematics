const fields = [
  { name: 'item_id', label: 'Item ID:', type: 'text' },
  { name: 'name', label: 'Item Name:', type: 'text' },
  { name: 'unit_price', label: 'Item Price:', type: 'number', step: '.01' },
  { name: 'category', label: 'Item Category:', type: 'text' },
  { name: 'stock_quantity', label: 'Stock Quantity:', type: 'number' },
  { name: 'tax_rate', label: 'Tax Rate:', type: 'number', min: '0', max: '1', step: '0.0001' },
];
const titles = { add: 'Add to Catalog', edit: 'Edit Catalog', remove: 'Remove From Catalog' };
export default function CatalogForm({ action, onBack }) {
  function submit(event) {
    event.preventDefault();
    console.log(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
    if (action === 'edit') console.log('This is meant to send out an PUT/PATCH request.');
    if (action === 'remove') console.log('This is meant to send out a DELETE request.');
  }
  return <>
    <h1 style={{ color: 'rgb(255, 255, 255)' }}>{titles[action]}</h1>
    <nav><ul><li><a href="#manager-menu" onClick={onBack}>Go Back</a></li></ul></nav>
    <form id={`${action}Form`} onSubmit={submit}>
      {(action === 'remove' ? fields.slice(0,1) : fields).map((field) => <span key={field.name}>
        <label htmlFor={field.name}>{field.label}</label>{' '}
        <input id={field.name} name={field.name} type={field.type} min={field.min} max={field.max} step={field.step} required /><br /><br />
      </span>)}
      <input type="submit" value={titles[action]} />
    </form>
  </>;
}
