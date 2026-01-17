'use client';

import * as React from 'react';
import * as Sonner from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner.Toaster>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner.Toaster
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-control-panel group-[.toaster]:text-foreground group-[.toaster]:border-control-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-control-cyan group-[.toast]:text-background',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
