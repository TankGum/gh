'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getMe, logout as apiLogout, refreshToken } from '@/services/auth.api';
import type { Me } from '@/types/account.type';
import { hasPermission, type PermAction } from '@/lib/permissions';

interface AuthContextValue {
  account: Me | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  can: (module: string, action: PermAction) => boolean;
  canView: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  account: null,
  loading: true,
  logout: async () => {},
  refetch: async () => {},
  can: () => false,
  canView: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await getMe();
      setAccount(me);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        try {
          await refreshToken();
          const me = await getMe();
          setAccount(me);
        } catch {
          setAccount(null);
        }
      } else {
        setAccount(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAccount(null);
  }, []);

  const can = useCallback(
    (module: string, action: PermAction) => hasPermission(account?.permissions, module, action),
    [account],
  );
  const canView = useCallback((module: string) => can(module, 'view'), [can]);

  return (
    <AuthContext.Provider
      value={{ account, loading, logout, refetch: fetchMe, can, canView }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
