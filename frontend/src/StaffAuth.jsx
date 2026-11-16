import { createContext, useContext, useRef, useState } from 'react';
import * as api from './api.js';
import { saveStaffPriceChange } from './utils/priceChange.js';
const StaffContext = createContext(null);
export const useStaffAuth = () => useContext(StaffContext);

export function StaffAuthProvider({ children }) {
  const credentials = useRef(null);
  const generation = useRef(0);
  const [staff, setStaff] = useState(null);
  function logout() { generation.current++; credentials.current = null; setStaff(null); }
  async function login(staffId, pin) {
    const version = generation.current;
    const result = await api.staffLogin(staffId, pin);
    if (version !== generation.current) throw new Error('Login canceled. Please sign in again.');
    if (!result.staff?.staff_id) throw new Error('The backend returned an invalid staff profile.');
    credentials.current = { staffId: staffId.trim(), pin };
    setStaff(result.staff);
  }
  function currentCredentials() {
    if (!credentials.current) throw new Error('Staff login is required before this action.');
    return credentials.current;
  }
  async function protectedRequest(action) {
    try { return await action(currentCredentials()); }
    catch (error) { if (error.status === 401) logout(); throw error; }
  }
  const authorizeRemoval = (id) => protectedRequest(({ staffId, pin }) => api.authorizeItemRemoval(id, staffId, pin));
  const authorizeCatalogPriceChange = (values) => protectedRequest(({ staffId, pin }) => api.authorizePriceChange({
    ...values, staff_id: staffId, pin,
  }));
  const savePriceChange = (values) => protectedRequest((auth) => saveStaffPriceChange({ ...values, ...auth }, api));
  return <StaffContext.Provider value={{ staff, login, logout, authorizeRemoval, savePriceChange, authorizeCatalogPriceChange }}>{children}</StaffContext.Provider>;
}
