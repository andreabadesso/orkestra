# Task 23: Toast Notifications

## Overview

Implement toast notification system for the Orkestra Dashboard to provide user feedback for actions, errors, and success messages.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟡 **High**

## Estimated Effort

2-3 hours

## Dependencies

- Task 10: Dashboard UI (existing React components)

## Requirements

### 1. Create Toast Context and Provider

Create `packages/dashboard/src/components/toast/toast-provider.tsx`:

```tsx
'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  toast: (message: string, options?: Partial<Toast>) => void;
  success: (message: string, options?: Partial<Omit<Toast, 'type'>>) => void;
  error: (message: string, options?: Partial<Omit<Toast, 'type'>>) => void;
  warning: (message: string, options?: Partial<Omit<Toast, 'type'>>) => void;
  info: (message: string, options?: Partial<Omit<Toast, 'type'>>) => void;
  dismiss: (toastId: string) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

const TOAST_LIMIT = 5;
const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toastTimeouts = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = React.useCallback((toast: Toast) => {
    setToasts((current) => {
      // Limit to 5 toasts
      const newToasts = current.length >= TOAST_LIMIT ? current.slice(1) : current;

      return [...newToasts, toast];
    });

    // Auto-dismiss after duration
    const duration = toast.duration || DEFAULT_DURATION;
    const timeout = setTimeout(() => {
      dismissToast(toast.id);
    }, duration);

    toastTimeouts.current.set(toast.id, timeout);
  }, []);

  const dismissToast = React.useCallback((toastId: string) => {
    setToasts((current) => current.filter((t) => t.id !== toastId));

    // Clear timeout if exists
    const timeout = toastTimeouts.current.get(toastId);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeouts.current.delete(toastId);
    }
  }, []);

  const dismissAll = React.useCallback(() => {
    setToasts([]);

    // Clear all timeouts
    toastTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    toastTimeouts.current.clear();
  }, []);

  const toast = React.useCallback(
    (message: string, options?: Partial<Toast>) => {
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'info',
        message,
        duration: options?.duration,
        title: options?.title,
        action: options?.action,
      };

      addToast(newToast);
    },
    [addToast]
  );

  const success = React.useCallback(
    (message: string, options?: Partial<Omit<Toast, 'type'>>) => {
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'success',
        message,
        duration: options?.duration,
        title: options?.title,
        action: options?.action,
      };

      addToast(newToast);
    },
    [addToast]
  );

  const error = React.useCallback(
    (message: string, options?: Partial<Omit<Toast, 'type'>>) => {
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'error',
        message,
        duration: options?.duration || 8000, // Errors stay longer
        title: options?.title,
        action: options?.action,
      };

      addToast(newToast);
    },
    [addToast]
  );

  const warning = React.useCallback(
    (message: string, options?: Partial<Omit<Toast, 'type'>>) => {
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'warning',
        message,
        duration: options?.duration,
        title: options?.title,
        action: options?.action,
      };

      addToast(newToast);
    },
    [addToast]
  );

  const info = React.useCallback(
    (message: string, options?: Partial<Omit<Toast, 'type'>>) => {
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'info',
        message,
        duration: options?.duration,
        title: options?.title,
        action: options?.action,
      };

      addToast(newToast);
    },
    [addToast]
  );

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      toastTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      toastTimeouts.current.clear();
    };
  }, []);

  const value: ToastContextType = React.useMemo(
    () => ({
      toasts,
      toast,
      success,
      error,
      warning,
      info,
      dismiss,
      dismissToast,
      dismissAll,
    }),
    [toasts, toast, success, error, warning, info, dismissToast, dismissAll]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
```

### 2. Create Toast Component

Create `packages/dashboard/src/components/toast/toast.tsx`:

```tsx
'use client';

import * as React from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Toast } from './toast-provider';

interface ToastProps {
  toast: Toast;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300); // Wait for exit animation
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-white" />,
    error: <XCircle className="w-5 h-5 text-white" />,
    warning: <AlertTriangle className="w-5 h-5 text-white" />,
    info: <Info className="w-5 h-5 text-white" />,
  };

  const icon = icons[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-96 p-4 rounded-lg shadow-lg border-2 transition-all duration-300',
        'hover:shadow-xl',
        toast.type === 'success' && 'bg-control-emerald border-control-emerald/20',
        toast.type === 'error' && 'bg-control-red border-control-red/20',
        toast.type === 'warning' && 'bg-control-amber border-control-amber/20',
        toast.type === 'info' && 'bg-control-cyan border-control-cyan/20',
        isExiting && 'translate-x-full opacity-0'
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">{icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {toast.title && <p className="font-semibold text-sm text-white">{toast.title}</p>}
        <p className="text-sm text-white/90">{toast.message}</p>

        {/* Action */}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium text-white underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-white/80" />
      </button>
    </div>
  );
}
```

### 3. Create Toaster Component

Create `packages/dashboard/src/components/toast/toaster.tsx`:

```tsx
'use client';

import * as React from 'react';
import { Toast } from './toast';
import { useToast } from './toast-provider';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-6 pointer-events-none">
      <div className="flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </div>
  );
}
```

### 4. Export from Index

Update `packages/dashboard/src/components/ui/index.ts`:

```typescript
export * from './toast-provider';
export * from './toaster';
```

### 5. Update Root Layout

Update `packages/dashboard/src/app/providers.tsx`:

```tsx
'use client';

import { ToastProvider, Toaster } from '@/components/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <Toaster />
    </ToastProvider>
  );
}
```

Or update `packages/dashboard/src/app/layout.tsx`:

```tsx
'use client';

import { ToastProvider, Toaster } from '@/components/ui';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
```

### 6. Create Hook

Create `packages/dashboard/src/hooks/use-toast.ts`:

```typescript
'use client';

import { useToast as useToastContext } from '@/components/ui';

export { useToast as useToastContext };
```

## Acceptance Criteria

- [ ] ToastProvider context manages toast state
- [ ] `toast()` method creates info toast
- [ ] `success()` method creates success toast
- [ ] `error()` method creates error toast with longer duration
- [ ] `warning()` method creates warning toast
- [ ] `info()` method creates info toast
- [ ] `dismiss()` method removes specific toast
- [ ] `dismissAll()` method removes all toasts
- [ ] Toaster component renders toasts in top-right corner
- [ ] Toasts automatically dismiss after duration
- [ ] Toast limit enforced (max 5 visible)
- [ ] Success toasts show green background with check icon
- [ ] Error toasts show red background with X icon
- [ ] Warning toasts show amber background with alert icon
- [ ] Info toasts show cyan background with info icon
- [ ] Toast dismiss button works
- [ ] Toast action button renders when provided
- [ ] Enter animation for new toasts
- [ ] Exit animation when dismissing
- [ ] toasts properly stack and don't overlap
- [ ] Pointer events don't block underlying content
- [ ] z-index ensures toasts appear above all content
- [ ] Toasts accessible via ARIA live regions
- [ ] Export from components/ui/index.ts works

## Dependencies

- Task 10: Dashboard UI (React components)

## Technical Notes

### Positioning

Use fixed positioning with `top-0 right-0` to place toasts in top-right corner.

### Animation

Use CSS transitions for smooth enter/exit animations:

- Enter: Slide in from right, fade in
- Exit: Slide out to right, fade out

### Toast Limit

Limit to 5 visible toasts to prevent overwhelming the user. Remove oldest when adding new toast at limit.

### Auto-dismiss

Default to 5 seconds for regular toasts, 8 seconds for error toasts.

### Accessibility

- Use `role="alert"` and `aria-live="polite"` for screen readers
- Include dismiss button with `aria-label="Dismiss"`

## Usage Example

```tsx
'use client';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export function ExampleComponent() {
  const { success, error, info } = useToast();

  const handleSuccess = () => {
    success('Operation completed successfully!');
  };

  const handleError = () => {
    error('Something went wrong', {
      action: {
        label: 'Retry',
        onClick: () => console.log('Retrying...'),
      },
    });
  };

  const handleInfo = () => {
    info('New feature available', {
      title: 'Information',
      duration: 10000,
    });
  };

  return (
    <div className="space-x-2">
      <Button onClick={handleSuccess}>Success</Button>
      <Button onClick={handleError}>Error</Button>
      <Button onClick={handleInfo}>Info</Button>
    </div>
  );
}
```

## References

- [Radix UI Toast](https://www.radix-ui.com/primitives/docs/components/toast)
- [WAI-ARIA Alert Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)

## Tags

#orkestra #task-23 #notifications #toast #ux #dashboard
