import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api, ApiError } from '../lib/api';
import { tokenStore } from '../lib/tokenStore';
import { Role, User } from '../types';

type RegisterPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: Exclude<Role, 'ADMIN'>;
  referredBy?: string;
  preferredCategoryIds?: string[];
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<void>;
  refreshMe: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Returns true when the error is a network/connectivity failure (service unreachable). */
const isNetworkError = (err: unknown): boolean => {
  if (err instanceof ApiError && err.status) return err.status >= 500;
  // fetch throws TypeError on DNS / connection-refused / timeout
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|ECONNREFUSED|timeout|aborted/i.test(err.message)) return true;
  return false;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshMe = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    if (!token) {
      setUser(null);
      return null;
    }
    const me = await api.get<User>('user', '/auth/me');
    setUser(me);
    return me;
  }, []);

  // ── Initial session restore with smart retry ───────────────────────────────
  useEffect(() => {
    let mounted = true;
    let attempt = 0;
    const maxAttempts = 5;

    const tryRestore = () => {
      refreshMe()
        .catch(async (err) => {
          if (!mounted) return;

          if (isNetworkError(err)) {
            // Service unreachable — keep tokens, schedule retry with backoff
            attempt += 1;
            if (attempt < maxAttempts) {
              const delay = Math.min(2000 * Math.pow(1.5, attempt), 15000);
              retryTimer.current = setTimeout(tryRestore, delay);
            }
            // Don't clear tokens — the session is still valid once the service is back
            return;
          }

          // Auth error (401, 403, etc.) — token is truly invalid
          await tokenStore.clear();
          if (mounted) setUser(null);
        })
        .finally(() => {
          if (mounted) setIsLoading(false);
        });
    };

    tryRestore();

    return () => {
      mounted = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [refreshMe]);

  // ── Auto-refresh when app comes back to foreground ─────────────────────────
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshMe().catch(() => undefined);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await api.post<{ accessToken: string; refreshToken?: string; user: User }>(
      'user',
      '/auth/login',
      { email, password },
      { auth: false },
    );
    await tokenStore.setTokens(result);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    await api.post('user', '/users/register', payload, { auth: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('user', '/auth/logout');
    } catch {
      // The local token state is still cleared even if the server is unreachable.
    } finally {
      await tokenStore.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    register,
    refreshMe,
    logout,
  }), [error, isLoading, login, logout, refreshMe, register, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
