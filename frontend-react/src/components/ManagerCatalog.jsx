import { useState } from 'react';
import CatalogForm from './manager/CatalogForm.jsx';

export default function ManagerCatalog({ onStudent, onPage }) {
  const [page, setPage] = useState('');
  function navigate(event, destination) { event.preventDefault(); setPage(destination); onPage(Boolean(destination)); }
  if (!page) return <>
    <h2 id="manager-heading">Manager View</h2>
    <p><a href="#manager-menu" onClick={(event) => navigate(event, 'menu')}>Go to Manager Menu</a></p>
  </>;
  if (page !== 'menu') return <CatalogForm key={page} action={page} onBack={(event) => navigate(event, 'menu')} />;
  return <>
    <h1 style={{ color: 'rgb(255, 255, 255)' }}>Catalog Management</h1>
    <header><nav><ul>
      <li><a href="#manager-add" onClick={(event) => navigate(event, 'add')}>Add to Catalog</a></li>
      <li><a href="#manager-edit" onClick={(event) => navigate(event, 'edit')}>Edit Catalog</a></li>
      <li><a href="#manager-remove" onClick={(event) => navigate(event, 'remove')}>Remove From Catalog</a></li>
      <li><a href="#student" onClick={(event) => { event.preventDefault(); setPage(''); onStudent(); }}>Go Back to Student View</a></li>
    </ul></nav></header>
  </>;
}
