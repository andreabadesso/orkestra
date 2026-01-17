'use client';

import * as React from 'react';

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

  const dismiss = React.useCallback((toastId: string) => {
    setToasts((current) => current.filter((t) => t.id !== toastId));

    const timeout = toastTimeouts.current.get(toastId);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeouts.current.delete(toastId);
    }
  }, []);

  const addToast = React.useCallback(
    (toast: Toast) => {
      setToasts((current) => {
        const newToasts = current.length >= TOAST_LIMIT ? current.slice(1) : current;

        return [...newToasts, toast];
      });

      const duration = toast.duration ?? DEFAULT_DURATION;
      const timeout = setTimeout(() => {
        dismiss(toast.id);
      }, duration);

      toastTimeouts.current.set(toast.id, timeout);
    },
    [dismiss]
  );

  const dismissAll = React.useCallback(() => {
    setToasts([]);

    toastTimeouts.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    toastTimeouts.current.clear();
  }, []);

  const toast = React.useCallback(
    (message: string, options?: Partial<Toast>) => {
      const newToast: Toast = {
        id: `toast-${String(Date.now())}-${String(Math.random())}`,
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
        id: `toast-${String(Date.now())}-${String(Math.random())}`,
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
        id: `toast-${String(Date.now())}-${String(Math.random())}`,
        type: 'error',
        message,
        duration: options?.duration ?? 8000,
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
        id: `toast-${String(Date.now())}-${String(Math.random())}`,
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
        id: `toast-${String(Date.now())}-${String(Math.random())}`,
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

  React.useEffect(() => {
    return () => {
      toastTimeouts.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
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
      dismissAll,
    }),
    [toasts, toast, success, error, warning, info, dismiss, dismissAll]
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
