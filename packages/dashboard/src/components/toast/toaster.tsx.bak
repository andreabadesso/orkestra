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
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={() => {
              dismiss(toast.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
