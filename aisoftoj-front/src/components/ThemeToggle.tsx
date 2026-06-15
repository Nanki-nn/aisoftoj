import React, { useEffect, useState } from 'react';
import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from './ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="app-secondary-button header-utility-button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
      title={isDark ? '切换到浅色主题' : '切换到深色主题'}
      disabled={!mounted}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? '浅色' : '深色'}</span>
    </Button>
  );
}
