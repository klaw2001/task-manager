import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      setUser((await api.get('/api/auth/me')).user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const out = (e) => {
      setUser(null);
      if (e.detail?.code === 'ACCOUNT_DEACTIVATED') setNotice(e.detail.message);
      else if (e.detail?.code === 'SESSION_EXPIRED') setNotice('Your session expired. Please sign in again.');
    };
    window.addEventListener('lms:signed-out', out);
    window.addEventListener('lms:refresh-me', refresh);
    return () => { window.removeEventListener('lms:signed-out', out); window.removeEventListener('lms:refresh-me', refresh); };
  }, [refresh]);

  // keep the shift state (and a removed account) up to date while the app is open
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return undefined;
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [signedIn, refresh]);

  const value = {
    user,
    notice,
    refresh,
    async login(employeeId, password) {
      const { user: u } = await api.post('/api/auth/login', { employeeId, password });
      setNotice('');
      setUser(u);
      return u;
    },
    async logout() {
      await api.post('/api/auth/logout').catch(() => {});
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
