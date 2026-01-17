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
    setTimeout(onDismiss, 300);
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
      <div className="shrink-0 mt-0.5">{icon}</div>

      <div className="flex-1 min-w-0 space-y-1">
        {toast.title && <p className="font-semibold text-sm text-white">{toast.title}</p>}
        <p className="text-sm text-white/90">{toast.message}</p>

        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium text-white underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

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
