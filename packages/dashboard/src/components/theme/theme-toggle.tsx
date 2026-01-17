'use client';

import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-control-panel/50 border border-control-border p-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setTheme('light');
        }}
        className={`h-8 w-8 ${theme === 'light' ? 'bg-background shadow' : ''}`}
        title="Light mode"
      >
        <Sun className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          toggleTheme();
        }}
        className="h-8 w-8"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setTheme('system');
        }}
        className={`h-8 w-8 ${theme === 'system' ? 'bg-background shadow' : ''}`}
        title="Use system theme"
      >
        <Monitor className="w-4 h-4" />
      </Button>
    </div>
  );
}
