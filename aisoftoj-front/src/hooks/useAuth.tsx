import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { User, LoginForm, RegisterForm } from '../types/user';
import { fetchCurrentUser, loginByEmail, logoutAuth, registerByEmail } from '../lib/api';

const AUTH_TOKEN_KEY = 'authToken';
const AUTH_USER_KEY = 'user';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (loginData: LoginForm) => Promise<boolean>;
  register: (registerData: RegisterForm) => Promise<boolean>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  checkAuthStatus: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredUser(): User | null {
  const userData = localStorage.getItem(AUTH_USER_KEY);
  if (!userData) {
    return null;
  }
  try {
    return JSON.parse(userData) as User;
  } catch (error) {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (loginData: LoginForm): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginByEmail(loginData);
      setUser(result.user);
      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
      return true;
    } catch (err) {
      setError((err as Error).message || '登录失败，请稍后重试');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (registerData: RegisterForm): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await registerByEmail(registerData);
      setUser(result.user);
      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
      return true;
    } catch (err) {
      setError((err as Error).message || '注册失败，请稍后重试');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      void logoutAuth(token).catch(() => undefined);
    }
    setUser(null);
    setError(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const updateUser = useCallback((updatedData: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) {
        return null;
      }
      const updatedUser = { ...prevUser, ...updatedData };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUser = getStoredUser();

    if (!token) {
      setUser(null);
      localStorage.removeItem(AUTH_USER_KEY);
      return;
    }

    if (storedUser) {
      setUser(storedUser);
    }

    try {
      const currentUser = await fetchCurrentUser(token);
      setUser(currentUser);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    } catch (error) {
      setUser(null);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    updateUser,
    checkAuthStatus,
    isAuthenticated: !!user,
  }), [user, isLoading, error, login, register, logout, updateUser, checkAuthStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
