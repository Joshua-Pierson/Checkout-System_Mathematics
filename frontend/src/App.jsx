import { useEffect, useReducer, useState } from 'react';
import { fetchInventory } from './api.js';
import { addToCart, prepareInventory } from './utils/cart.js';
import StudentCart from './components/StudentCart.jsx';
import ManagerCatalog from './components/ManagerCatalog.jsx';
import './manager.css';

function transactionReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const result = addToCart(state.cart, action.catalog, action.code);
      return { cart: result.cart, message: result.error || result.message };
    }
    case 'decrease': return { cart: state.cart.map((item) => item.code === action.code
      ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item), message: 'Quantity updated.' };
    case 'remove': return { cart: state.cart.filter((item) => item.code !== action.code), message: 'Item removed from the cart.' };
    case 'cancel': return { cart: [], message: 'Transaction canceled. Ready for the next customer.' };
    default: return state;
  }
}

export default function App() {
  const [view, setView] = useState('student');
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [inventory, setInventory] = useState({ catalog: [], status: 'loading', error: '' });
  const [transaction, dispatch] = useReducer(transactionReducer, { cart: [], message: '' });

  useEffect(() => {
    setInventory((previous) => ({ ...previous, status: 'loading', error: '' }));
    const controller = new AbortController();
    fetchInventory(controller.signal).then(prepareInventory).then((catalog) => {
      if (!controller.signal.aborted) setInventory({ catalog, status: 'ready', error: '' });
    }).catch((error) => {
      if (!controller.signal.aborted) setInventory({ catalog: [], status: 'error', error: error.message });
    });
    return () => controller.abort();
  }, [inventoryVersion]);

  return <div className="app-shell">
    <header className="app-header">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setView('student'); }} aria-label="Checkout System home">
        <span className="brand-mark" aria-hidden="true">C<span>✓</span></span>
        <span>Campus<span className="brand-subtitle">CHECKOUT SYSTEM</span></span>
      </a>
      <nav className="view-switch" aria-label="Choose view">
        <button type="button" aria-pressed={view === 'student'} onClick={() => setView('student')}>Student</button>
        <button type="button" aria-pressed={view !== 'student'} onClick={() => setView('manager')}>Manager</button>
      </nav>
    </header>
    <main>
      <section hidden={view !== 'student'} aria-labelledby="cart-heading">
        <StudentCart {...inventory} cart={transaction.cart} message={transaction.message}
          dispatch={dispatch} active={view === 'student'} />
      </section>
      <section hidden={view !== 'manager' && view !== 'manager-page'} aria-labelledby="manager-heading">
        {view !== 'student' && <ManagerCatalog onSaved={() => { dispatch({ type: 'cancel' }); setInventoryVersion((version) => version + 1); }} onStudent={() => setView('student')} onPage={(isPage) => setView(isPage ? 'manager-page' : 'manager')} />}
      </section>
    </main>
    <footer className="app-footer">Campus Checkout <span>Find your essentials. Make them yours.</span></footer>
  </div>;
}
