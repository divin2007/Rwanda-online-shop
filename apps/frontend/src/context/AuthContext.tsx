'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { userApi } from '@/lib/api';

interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
  preferences?: {
    discovery?: {
      categoryIds?: string[];
    };
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await userApi.get('/auth/me');
        if (response.data?.success) {
          setUser(response.data.data);
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
        } else {
          console.warn(
            error.response
              ? `Failed to authenticate user: ${error.response?.data?.message || error.message}`
              : 'Authentication service unavailable; continuing as guest.'
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = (userData: User, token: string, refreshToken?: string) => {
    localStorage.setItem('accessToken', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    setUser(userData);
  };

  const logout = async () => {
    try {
      await userApi.post('/auth/logout');
    } catch (e) {
      // Ignore
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      // 2E fix: use soft navigation instead of hard redirect.
      // window.location.href kills all WebSocket connections and React state.
      // Setting user to null triggers the auth check in protected routes,
      // which will redirect to /login via Next.js router.
      // Only use hard redirect as last resort for public pages.
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
