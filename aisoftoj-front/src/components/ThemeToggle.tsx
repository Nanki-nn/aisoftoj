import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid="theme-toggle"
          aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
          onClick={toggleTheme}
          className="theme-toggle-button"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>{isDark ? '浅色' : '深色'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {isDark ? '切换到浅色模式' : '切换到深色模式'}
      </TooltipContent>
    </Tooltip>
  );
}
