import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  fetchCurrentUser,
  loginByEmail,
  logoutAuth,
  registerByEmail,
} from '../lib/api';
import { LoginForm, RegisterForm, User } from '../types/user';

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (form: LoginForm) => Promise<boolean>;
  register: (form: RegisterForm) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setUser(null);
      return;
    }

    try {
      setIsLoading(true);
      const currentUser = await fetchCurrentUser(token);
      setUser(currentUser);
      setError(null);
    } catch {
      localStorage.removeItem('authToken');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (form: LoginForm) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await loginByEmail(form);
      localStorage.setItem('authToken', response.token);
      setUser(response.user);
      return true;
    } catch (loginError) {
      setError((loginError as Error).message || '登录失败');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (form: RegisterForm) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await registerByEmail(form);
      localStorage.setItem('authToken', response.token);
      setUser(response.user);
      return true;
    } catch (registerError) {
      setError((registerError as Error).message || '注册失败');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    try {
      if (token) {
        await logoutAuth(token);
      }
    } catch {
      // JWT logout is client-side; always clear local state.
    } finally {
      localStorage.removeItem('authToken');
      setUser(null);
      setError(null);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(current => current ? { ...current, ...updates } : null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    register,
    logout,
    checkAuthStatus,
    updateUser,
  }), [
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    checkAuthStatus,
    updateUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
