# Task 22: Admin Settings Page

## Overview

Implement admin settings page in Orkestra Dashboard for tenant-level configuration including branding, notifications, and system preferences.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟢 **Medium**

## Estimated Effort

3-5 hours

## Dependencies

- Task 09: REST API (need settings tRPC procedures)
- Task 10: Dashboard UI (existing layout structure)

## Requirements

### 1. Backend: Add Settings tRPC Procedures

Add to `packages/api/src/routers/settings.ts`:

```typescript
export const settingsRouter = router({
  // Get tenant settings
  get: protectedProcedure.query(async ({ ctx }) => {
    const settings = await prisma.tenantSettings.findFirst({
      where: {
        tenantId: ctx.tenantId,
      },
    });

    return (
      settings || {
        brandName: 'Orkestra',
        brandLogo: null,
        primaryColor: '#06b6d4',
        notificationEmail: null,
        taskAutoAssignment: false,
        defaultSLADuration: '24h',
      }
    );
  }),

  // Update tenant settings
  update: protectedProcedure
    .input(
      z.object({
        brandName: z.string().min(1).max(100).optional(),
        brandLogo: z.string().url().nullable().optional(),
        primaryColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        notificationEmail: z.string().email().nullable().optional(),
        taskAutoAssignment: z.boolean().optional(),
        defaultSLADuration: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.tenantSettings.findFirst({
        where: {
          tenantId: ctx.tenantId,
        },
      });

      if (existing) {
        return await prisma.tenantSettings.update({
          where: {
            tenantId: ctx.tenantId,
          },
          data: input,
        });
      } else {
        return await prisma.tenantSettings.create({
          data: {
            tenantId: ctx.tenantId,
            ...input,
          },
        });
      }
    }),

  // Test notification settings
  testNotification: protectedProcedure
    .input(
      z.object({
        type: z.enum(['email', 'slack']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get settings
      const settings = await prisma.tenantSettings.findFirst({
        where: {
          tenantId: ctx.tenantId,
        },
      });

      if (!settings) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Settings not configured',
        });
      }

      // Send test notification
      if (input.type === 'email' && settings.notificationEmail) {
        // Integrate with notification service
        // await sendTestEmail(settings.notificationEmail, ctx.tenantId);
      }

      return { success: true };
    }),
});
```

### 2. Frontend: Create Settings Page

Create `packages/dashboard/src/app/(protected)/admin/settings/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import {
  Settings as SettingsIcon,
  Bell,
  Palette,
  Zap,
  Mail,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('branding');

  const { data: settings, isLoading } = trpc.settings.get.useQuery();

  const [formData, setFormData] = useState({
    brandName: '',
    brandLogo: '',
    primaryColor: '#06b6d4',
    notificationEmail: '',
    taskAutoAssignment: false,
    defaultSLADuration: '24h',
  });

  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success('Settings saved successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const testNotification = trpc.settings.testNotification.useMutation({
    onSuccess: () => {
      toast.success('Test notification sent');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        brandName: settings.brandName || '',
        brandLogo: settings.brandLogo || '',
        primaryColor: settings.primaryColor || '#06b6d4',
        notificationEmail: settings.notificationEmail || '',
        taskAutoAssignment: settings.taskAutoAssignment || false,
        defaultSLADuration: settings.defaultSLADuration || '24h',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings.mutateAsync(formData);
  };

  const handleTestNotification = async (type: 'email' | 'slack') => {
    await testNotification.mutateAsync({ type });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="section-heading">Settings</h1>
        <p className="mono-data">SYSTEM CONFIGURATION</p>
      </div>

      {isLoading ? (
        <Card className="border-control-border-bright">
          <CardContent className="py-16">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-control-cyan animate-spin" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="branding">
              <Palette className="w-4 h-4 mr-2" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Zap className="w-4 h-4 mr-2" />
              Task Behavior
            </TabsTrigger>
            <TabsTrigger value="system">
              <SettingsIcon className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <Card className="border-control-border-bright">
              <CardHeader>
                <CardTitle className="font-serif">Brand Identity</CardTitle>
                <CardDescription className="mono-data">
                  CUSTOMIZE YOUR DASHBOARD APPEARANCE
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Brand Name */}
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand Name</Label>
                  <Input
                    id="brandName"
                    placeholder="Orkestra"
                    value={formData.brandName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, brandName: e.target.value }))
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Displayed in the header and login page
                  </p>
                </div>

                {/* Brand Logo */}
                <div className="space-y-2">
                  <Label htmlFor="brandLogo">Brand Logo URL</Label>
                  <Input
                    id="brandLogo"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={formData.brandLogo}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, brandLogo: e.target.value }))
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    URL to your company logo (PNG or SVG)
                  </p>
                  {formData.brandLogo && (
                    <div className="mt-2 p-4 border border-control-border rounded-lg bg-control-panel/50">
                      <img
                        src={formData.brandLogo}
                        alt="Brand Logo Preview"
                        className="h-16 w-auto"
                      />
                    </div>
                  )}
                </div>

                {/* Primary Color */}
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                      }
                      className="w-24 h-10 p-0 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                      }
                      placeholder="#06b6d4"
                      className="flex-1 font-mono"
                    />
                    <div
                      className="w-10 h-10 rounded border border-control-border"
                      style={{ backgroundColor: formData.primaryColor }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Used for buttons, links, and highlights
                  </p>
                </div>

                {/* Preview Card */}
                <div className="border-t border-control-border pt-6">
                  <p className="mono-data text-muted-foreground text-xs mb-3">PREVIEW</p>
                  <Card
                    className="border-control-border-bright"
                    style={{ borderColor: formData.primaryColor }}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-white"
                          style={{ backgroundColor: formData.primaryColor }}
                        >
                          {formData.brandName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-serif text-xl font-bold">
                            {formData.brandName || 'Orkestra'}
                          </h3>
                          <p className="mono-data text-xs text-muted-foreground">MISSION CONTROL</p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="border-control-border-bright">
              <CardHeader>
                <CardTitle className="font-serif">Notification Settings</CardTitle>
                <CardDescription className="mono-data">
                  CONFIGURE EMAIL ALERTS AND NOTIFICATIONS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Notification Email */}
                <div className="space-y-2">
                  <Label htmlFor="notificationEmail">Notification Email</Label>
                  <div className="flex gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground mt-2.5" />
                    <Input
                      id="notificationEmail"
                      type="email"
                      placeholder="notifications@example.com"
                      value={formData.notificationEmail}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, notificationEmail: e.target.value }))
                      }
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Email address for receiving system notifications
                  </p>
                </div>

                {/* Test Notification */}
                <div className="border-t border-control-border pt-6">
                  <p className="mono-data text-muted-foreground text-xs mb-3">TEST NOTIFICATIONS</p>
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => handleTestNotification('email')}
                      disabled={!formData.notificationEmail || testNotification.isPending}
                      className="gap-2"
                    >
                      {testNotification.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Send Test Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Task Behavior Tab */}
          <TabsContent value="tasks" className="space-y-6">
            <Card className="border-control-border-bright">
              <CardHeader>
                <CardTitle className="font-serif">Task Behavior</CardTitle>
                <CardDescription className="mono-data">
                  CONFIGURE DEFAULT TASK SETTINGS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Auto Assignment */}
                <div className="flex items-center justify-between p-4 border border-control-border rounded-lg bg-control-panel/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-5 h-5 text-control-cyan" />
                      <Label htmlFor="autoAssignment" className="text-base font-medium">
                        Auto-Assign Tasks
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automatically assign tasks to available team members when created
                    </p>
                  </div>
                  <Switch
                    id="autoAssignment"
                    checked={formData.taskAutoAssignment}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, taskAutoAssignment: checked }))
                    }
                  />
                </div>

                {/* Default SLA Duration */}
                <div className="space-y-2">
                  <Label htmlFor="defaultSLA">Default SLA Duration</Label>
                  <Select
                    id="defaultSLA"
                    value={formData.defaultSLADuration}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, defaultSLADuration: e.target.value }))
                    }
                  >
                    <option value="1h">1 Hour</option>
                    <option value="2h">2 Hours</option>
                    <option value="4h">4 Hours</option>
                    <option value="8h">8 Hours</option>
                    <option value="24h">24 Hours</option>
                    <option value="48h">48 Hours</option>
                    <option value="72h">3 Days</option>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Default SLA for tasks when not explicitly set
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card className="border-control-border-bright">
              <CardHeader>
                <CardTitle className="font-serif">System Information</CardTitle>
                <CardDescription className="mono-data">
                  VIEW SYSTEM STATUS AND VERSION
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="mono-data text-muted-foreground text-xs">VERSION</p>
                    <p className="font-mono">0.0.1</p>
                  </div>
                  <div className="space-y-1">
                    <p className="mono-data text-muted-foreground text-xs">DEPLOYMENT</p>
                    <p className="font-mono">Production</p>
                  </div>
                  <div className="space-y-1">
                    <p className="mono-data text-muted-foreground text-xs">DATABASE</p>
                    <p className="font-mono">PostgreSQL</p>
                  </div>
                  <div className="space-y-1">
                    <p className="mono-data text-muted-foreground text-xs">TEMPORAL</p>
                    <p className="font-mono">Connected</p>
                  </div>
                </div>

                <div className="border-t border-control-border pt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-control-emerald flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">All Systems Operational</p>
                      <p className="text-sm text-muted-foreground">
                        All services are running normally
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-control-emerald flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Database Connected</p>
                      <p className="text-sm text-muted-foreground">
                        Database connection is healthy
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-control-emerald flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Temporal Worker Active</p>
                      <p className="text-sm text-muted-foreground">
                        Workflow processing is running
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending || isLoading}
          size="lg"
          className="gap-2"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

### 3. Add Switch Component

Create `packages/dashboard/src/components/ui/switch.tsx`:

```tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        ref={ref}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-control-cyan' : 'bg-input',
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
```

### 4. Add Tabs Component

Create `packages/dashboard/src/components/ui/tabs.tsx`:

```tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
}>({
  value: '',
  onValueChange: () => {},
});

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
  }
>(({ className, defaultValue, value, onValueChange, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || value);

  const currentValue = value !== undefined ? value : internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    },
    [onValueChange]
  );

  return (
    <TabsContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleValueChange,
      }}
    >
      <div ref={ref} className={cn('', className)} {...props} />
    </TabsContext.Provider>
  );
});
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { value, onValueChange } = React.useContext(TabsContext);

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
          className
        )}
        role="tablist"
        {...props}
      >
        {React.Children.map(props.children, (child) => {
          if (React.isValidElement(child) && child.type === TabsTrigger) {
            return React.cloneElement(child, {
              selected: child.props.value === value,
              onClick: () => onValueChange(child.props.value as string),
            } as any);
          }
          return child;
        })}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string;
    selected?: boolean;
  }
>(({ className, children, ...props }, ref) => {
  return (
    <button
      type="button"
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        props.selected
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background/50',
        className
      )}
      role="tab"
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value: string;
  }
>(({ className, children, ...props }, ref) => {
  const { value } = React.useContext(TabsContext);

  if (value !== props.value) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      role="tabpanel"
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

## Acceptance Criteria

- [ ] `settings.get` tRPC procedure returns current tenant settings
- [ ] `settings.update` tRPC procedure creates/updates settings
- [ ] `settings.testNotification` tRPC procedure sends test notification
- [ ] Settings page loads with current settings
- [ ] Branding tab allows changing brand name
- [ ] Branding tab allows setting brand logo URL
- [ ] Branding tab shows logo preview
- [ ] Branding tab allows changing primary color
- [ ] Branding tab shows preview card with branding
- [ ] Notifications tab allows setting notification email
- [ ] Notifications tab sends test email notification
- [ ] Task Behavior tab allows toggling auto-assignment
- [ ] Task Behavior tab allows setting default SLA
- [ ] System tab shows version and deployment info
- [ ] System tab shows health status indicators
- [ ] Save button persists all changes
- [ ] Save button shows loading state
- [ ] Toast notifications for success/error
- [ ] Tabs navigation works correctly
- [ ] Switch component renders correctly
- [ ] Color picker supports hex and visual picker
- [ ] Form validation for required fields

## Dependencies

- Task 09: REST API (tRPC infrastructure)
- Task 10: Dashboard UI (existing layout structure)
- Task 23: Toast Notifications (for error handling)

## Technical Notes

### Settings Storage

Use `TenantSettings` model in Prisma schema to store tenant-specific settings.

### Color Picker

Use native HTML5 color input for simple hex selection.

### Settings Caching

Consider caching settings in React Query to reduce API calls.

## References

- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs)
- [HTML5 Color Input](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/color)

## Tags

#orkestra #task-22 #admin #settings #dashboard
