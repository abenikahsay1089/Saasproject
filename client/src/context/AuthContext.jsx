import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  const invalidateWorkspaceData = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['pending-invites'] });
    qc.invalidateQueries({ queryKey: ['pending-ownership-transfers'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['boards'] });
  }, [qc]);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: u } = await authApi.me();
      setUser(u);
      invalidateWorkspaceData();
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token, invalidateWorkspaceData]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email, password) => {
      const { user: u, token: t } = await authApi.login(email, password);
      localStorage.setItem('token', t);
      setToken(t);
      setUser(u);
      invalidateWorkspaceData();
      return u;
    },
    [invalidateWorkspaceData]
  );

  const register = useCallback(
    async (name, username, email, password) => {
      const { user: u, token: t } = await authApi.register(name, username, email, password);
      localStorage.setItem('token', t);
      setToken(t);
      setUser(u);
      invalidateWorkspaceData();
      return u;
    },
    [invalidateWorkspaceData]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    invalidateWorkspaceData();
  }, [invalidateWorkspaceData]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
