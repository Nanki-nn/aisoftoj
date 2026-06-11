import React, { createContext, useContext, useEffect, useMemo } from 'react';

type Theme = 'light';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = 'aisoftoj-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    // 清掉历史持久化，避免下次进来又被读成 dark
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: 'light',
    toggleTheme: () => {
      /* 暂只支持 light 主题 */
    },
  }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
