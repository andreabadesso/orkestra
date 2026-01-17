'use client';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function ToastTestPage() {
  const { toast, success, error, warning, info, dismissAll } = useToast();

  const handleSuccess = () => {
    success('Operation completed successfully!', {
      title: 'Success',
    });
  };

  const handleError = () => {
    error('Something went wrong. Please try again.', {
      title: 'Error',
      action: {
        label: 'Retry',
        onClick: () => {
          console.log('Retrying...');
        },
      },
    });
  };

  const handleWarning = () => {
    warning('Your session will expire soon.', {
      title: 'Warning',
    });
  };

  const handleInfo = () => {
    info('New feature available in the dashboard.', {
      title: 'Information',
      duration: 10000,
    });
  };

  const handleCustom = () => {
    toast('Custom toast message with long duration.', {
      title: 'Custom',
      duration: 15000,
    });
  };

  const handleMultiple = () => {
    for (let i = 1; i <= 6; i++) {
      setTimeout(() => {
        info(`Toast number ${String(i)}`, {
          title: `Toast ${String(i)}`,
        });
      }, i * 500);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Toast Notification Test</h1>

      <div className="space-y-4">
        <div className="space-x-2">
          <Button onClick={handleSuccess}>Success Toast</Button>
          <Button onClick={handleError} variant="destructive">
            Error Toast
          </Button>
          <Button onClick={handleWarning} variant="outline">
            Warning Toast
          </Button>
          <Button onClick={handleInfo} variant="secondary">
            Info Toast
          </Button>
        </div>

        <div className="space-x-2">
          <Button onClick={handleCustom}>Custom Toast</Button>
          <Button onClick={handleMultiple}>Test Toast Limit (6)</Button>
          <Button onClick={dismissAll} variant="outline">
            Dismiss All
          </Button>
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Instructions:</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Click each button to see different toast types</li>
          <li>Toast limit is 5 - the 6th toast will remove the oldest</li>
          <li>Auto-dismiss: 5s for most, 8s for errors</li>
          <li>Click the X button to dismiss individual toasts</li>
          <li>Click "Dismiss All" to clear all toasts</li>
        </ul>
      </div>
    </div>
  );
}
