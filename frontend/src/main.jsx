import { StaffAuthProvider } from './StaffAuth.jsx';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';

createRoot(document.getElementById('root')).render(<StrictMode><StaffAuthProvider><App /></StaffAuthProvider></StrictMode>);
