'use client';

import { useState, useEffect } from 'react';
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

  const { data: settings, isLoading } = trpc.tenantSettingsRouter.get.useQuery();

  const [formData, setFormData] = useState({
    brandName: '',
    brandLogo: '',
    primaryColor: '#06b6d4',
    notificationEmail: '',
    taskAutoAssignment: false,
    defaultSLADuration: '24h',
  });

  const toast = useToast();

  const updateSettings = trpc.tenantSettingsRouter.update.useMutation({
    onSuccess: () => {
      toast.success('Settings saved successfully', { title: 'Success' });
    },
    onError: (error: any) => {
      toast.error(error.message, { title: 'Error' });
    },
  });

  const testNotification = trpc.tenantSettingsRouter.testNotification.useMutation({
    onSuccess: () => {
      toast.success('Test notification sent', { title: 'Success' });
    },
    onError: (error: any) => {
      toast.error(error.message, { title: 'Error' });
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
