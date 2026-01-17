# Task 24: Dark Mode Toggle

## Overview

Implement dark mode toggle for the Orkestra Dashboard to allow users to switch between light and dark themes. Dark mode is currently enabled by default but needs a toggle mechanism.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟢 **Medium**

## Estimated Effort

1-2 hours

## Dependencies

- Task 10: Dashboard UI (existing dark mode in layout.tsx)

## Requirements

### 1. Create Dark Mode Hook

Create `packages/dashboard/src/hooks/use-theme.ts`:

```typescript
'use client';

import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'orkestra-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
      if (stored) return stored;
    }

    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }

    // Default to dark
    return 'dark';
  });

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }

    // Update document class
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Apply theme on mount
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  // Listen for system theme changes
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Only update if user hasn't manually set a theme
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        const newTheme = e.matches ? 'dark' : 'light';
        setThemeState(newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [setThemeState]);

  const value: ThemeContextType = React.useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
```

### 2. Create Theme Toggle Component

Create `packages/dashboard/src/components/theme/theme-toggle.tsx`:

```tsx
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
        onClick={() => setTheme('light')}
        className={`h-8 w-8 ${theme === 'light' ? 'bg-background shadow' : ''}`}
        title="Light mode"
      >
        <Sun className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="h-8 w-8"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme('system')}
        className={`h-8 w-8 ${theme === 'system' ? 'bg-background shadow' : ''}`}
        title="Use system theme"
      >
        <Monitor className="w-4 h-4" />
      </Button>
    </div>
  );
}
```

### 3. Update Root Layout

Update `packages/dashboard/src/app/layout.tsx`:

```tsx
'use client';

import { ThemeProvider } from '@/hooks/use-theme';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### 4. Add Theme Toggle to Header

Update `packages/dashboard/src/components/layout/header.tsx`:

```tsx
'use client';

import { ThemeToggle } from '@/components/theme/theme-toggle';

export function Header() {
  return (
    <header className="h-14 bg-control-panel border-b border-control-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="status-led status-active"></span>
          <span className="mono-data text-control-emerald">SYSTEM OPERATIONAL</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="mono-data">
          {new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </header>
  );
}
```

### 5. Update Protected Layout

Update `packages/dashboard/src/app/(protected)/layout.tsx`:

Find the header section and add ThemeToggle:

```tsx
// In the header div, add ThemeToggle before the tenant info
<div className="flex items-center gap-4">
  <ThemeToggle />
  <div className="mono-data">
    TENANT: <span className="text-control-cyan">{user.tenantId}</span>
  </div>
  <div className="mono-data">
    {new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })}
  </div>
</div>
```

## Acceptance Criteria

- [ ] `useTheme()` hook provides current theme
- [ ] `setTheme()` method updates theme state
- [ ] `toggleTheme()` method switches between light/dark
- [ ] Theme persists to localStorage
- [ ] Theme loads from localStorage on mount
- [ ] System theme preference respected on initial load
- [ ] System theme changes listener works
- [ ] `dark` class added to html element for dark mode
- [ ] `light` class added to html element for light mode
- [ ] Theme toggle component renders 3 buttons (light, dark, system)
- [ ] Toggle buttons show active state visually
- [ ] Theme toggle accessible via title attributes
- [ ] Theme toggle added to header/protected layout
- [ ] Theme switching smooth without page reload
- [ ] All existing Tailwind dark mode classes work correctly
- [ ] Mission Control aesthetic maintained in both themes

## Dependencies

- Task 10: Dashboard UI (existing dark mode setup)

## Technical Notes

### Tailwind Dark Mode

The project uses Tailwind's `darkMode: 'class'` strategy. Toggle the `dark` class on the `html` element.

### LocalStorage Key

Use `orkestra-theme` as the storage key to avoid conflicts with other apps.

### Theme Values

- `light`: Force light mode
- `dark`: Force dark mode
- `system`: Use system preference (auto)

### System Preference

Use `window.matchMedia('(prefers-color-scheme: dark)')` to detect system preference.

### Avoiding Flash

- Initialize theme from localStorage before rendering
- Add `suppressHydrationWarning` to html element
- Apply theme class synchronously on mount

## Usage Example

```tsx
'use client';

import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function ExampleComponent() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="p-4">
      <p>Current theme: {theme}</p>
      <Button onClick={toggleTheme}>
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4 mr-2" />
            Switch to Light
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 mr-2" />
            Switch to Dark
          </>
        )}
      </Button>
    </div>
  );
}
```

## References

- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Next.js Dark Mode](https://nextjs.org/docs/app/building-your-application/styling/dark-mode)
- [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)

## Tags

#orkestra #task-24 #dark-mode #theme #ux #dashboard
