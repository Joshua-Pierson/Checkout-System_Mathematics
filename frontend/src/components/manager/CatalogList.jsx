import { useState } from 'react';
import { money } from '../../utils/cart.js';

export default function CatalogList({ catalog = [], status, error }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const categories = [...new Set(catalog.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
  const search = query.trim().toLowerCase();
  const matches = catalog.filter((item) => (!category || category === item.category) &&
    (!search || item.name.toLowerCase().includes(search) || item.code.toLowerCase().includes(search)));
  const ready = status === 'ready';
  const message = status === 'loading' ? 'Loading products...' : status === 'error' ? error :
    !catalog.length ? 'No products are available.' : !matches.length ? 'No products match your search or category.' :
    `${matches.length} of ${catalog.length} products`;
  return <section className="manager-catalog-list" aria-labelledby="manager-products-heading">
    <div className="panel-heading"><h2 id="manager-products-heading">Catalog products</h2>
      {ready && <span className="count-badge">{catalog.length} products</span>}</div>
    <div className="catalog-filters">
      <div><label htmlFor="manager-product-search">Search products</label>
        <input id="manager-product-search" type="search" value={query} disabled={!ready} placeholder="Search by product name or code" onChange={(event) => setQuery(event.target.value)} /></div>
      <div><label htmlFor="manager-category-filter">Category</label>
        <select id="manager-category-filter" value={category} disabled={!ready} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>{categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select></div>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    {ready && <div className="table-scroll" tabIndex="0" role="region" aria-label="Manager catalog products">
      <table><caption className="sr-only">Current catalog with product codes, prices, categories, and stock quantities</caption>
        <thead><tr>{['Code', 'Product', 'Price', 'Category', 'Stock'].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
        <tbody>{matches.map((product) => <tr key={product.code}>
          <td><span className="item-code">{product.code}</span></td>
          <td className="product-name">{product.name}</td>
          <td className="price-cell">{money(product.priceCents)}{product.multiBuy && <small className="deal-label">{product.multiBuy.quantity} for {money(product.multiBuy.priceCents)}</small>}</td>
          <td><span className="category-pill">{product.category}</span></td>
          <td>{product.stock === 0 ? 'Out of stock' : product.stock}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
