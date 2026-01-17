/**
 * Task Detail Page - Mission Control
 *
 * Shows detailed task information and completion form
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  User,
  Calendar,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Zap,
  Loader2,
  XCircle,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

/**
 * Task Detail Page Component
 */
export default function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: task, isLoading, error } = trpc.task.get.useQuery({
    id: params.id,
    includeHistory: true,
  });

  const claimMutation = trpc.task.claim.useMutation({
    onSuccess: () => {
      // Invalidate and refetch task data
      window.location.reload();
    },
  });

  const completeMutation = trpc.task.complete.useMutation({
    onSuccess: () => {
      router.push('/tasks');
    },
  });

  const handleClaim = async () => {
    try {
      await claimMutation.mutateAsync({ id: params.id });
    } catch (error) {
      console.error('Failed to claim task:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await completeMutation.mutateAsync({
        id: params.id,
        result: formData,
      });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-control-cyan animate-spin" />
          <p className="mono-data text-control-cyan">LOADING TASK DATA...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Link href="/tasks">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono">Back to Inbox</span>
          </Button>
        </Link>
        <Card className="border-control-red/50">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-control-red/10 flex items-center justify-center mb-4">
                <XCircle className="w-8 h-8 text-control-red" />
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">Task Not Found</h3>
              <p className="mono-data text-muted-foreground mb-4">
                ERROR: TASK NOT ACCESSIBLE
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                The task you're looking for doesn't exist or you don't have permission to access it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isClaimed = !!task.claimedBy;
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();
  const priorityVariant = {
    urgent: 'destructive' as const,
    high: 'warning' as const,
    medium: 'default' as const,
    low: 'outline' as const,
  }[task.priority];

  const formSchema = task.formSchema as any;
  const fieldOrder = formSchema?.fieldOrder || Object.keys(formSchema?.fields || {});

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <Link href="/tasks">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono">Back to Inbox</span>
        </Button>
      </Link>

      {/* Task Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={priorityVariant} className="font-mono uppercase">
                {task.priority}
              </Badge>
              {isClaimed && (
                <Badge variant="success" className="font-mono">
                  CLAIMED
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="font-mono">
                  OVERDUE
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {task.type}
              </Badge>
            </div>
            <h1 className="section-heading">{task.title}</h1>
            {task.description && (
              <p className="text-muted-foreground">{task.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`status-led ${isOverdue ? 'status-urgent' : isClaimed ? 'status-active' : 'status-pending'}`}></span>
            {task.dueAt && (
              <span className={`mono-data ${isOverdue ? 'text-control-red' : 'text-control-amber'}`}>
                DUE {formatRelativeTime(new Date(task.dueAt))}
              </span>
            )}
          </div>
        </div>

        {/* Task Metadata */}
        <Card className="border-control-border-bright">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mono-data text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>ASSIGNED TO</span>
                </div>
                <p className="font-mono text-sm">
                  {task.assignedGroupId || task.assignedUserId || 'Unassigned'}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mono-data text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>CREATED</span>
                </div>
                <p className="font-mono text-sm">{formatRelativeTime(new Date(task.createdAt))}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mono-data text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>STATUS</span>
                </div>
                <p className="font-mono text-sm uppercase">{task.status}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mono-data text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  <span>PRIORITY</span>
                </div>
                <p className="font-mono text-sm uppercase">{task.priority}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Form */}
        <div className="lg:col-span-2 space-y-6">
          {!isClaimed && (
            <Card className="border-control-cyan/50">
              <CardHeader>
                <CardTitle className="font-serif">Claim Task</CardTitle>
                <CardDescription className="mono-data">
                  CLAIM THIS TASK TO START WORKING ON IT
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleClaim}
                  disabled={claimMutation.isPending}
                  className="w-full gap-2"
                >
                  {claimMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>CLAIMING...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>CLAIM TASK</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {isClaimed && (
            <Card className="border-control-cyan/50">
              <CardHeader>
                <CardTitle className="font-serif">Complete Task</CardTitle>
                <CardDescription className="mono-data">
                  PROVIDE THE REQUIRED INFORMATION TO COMPLETE THIS OPERATION
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {fieldOrder.map((fieldName: string) => {
                    const field = formSchema.fields[fieldName];
                    if (!field || field.hidden) return null;

                    return (
                      <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName} className="mono-data">
                          {field.label}
                          {field.validation?.required && (
                            <span className="text-control-red ml-1">*</span>
                          )}
                        </Label>
                        {field.helpText && (
                          <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}

                        {field.type === 'textarea' ? (
                          <Textarea
                            id={fieldName}
                            placeholder={field.placeholder}
                            required={field.validation?.required}
                            disabled={field.disabled}
                            value={formData[fieldName] || ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                            className="min-h-[120px]"
                          />
                        ) : field.type === 'select' ? (
                          <Select
                            id={fieldName}
                            required={field.validation?.required}
                            disabled={field.disabled}
                            value={formData[fieldName] || ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                          >
                            <option value="">Select an option...</option>
                            {field.options?.map((option: any) => (
                              <option
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                              >
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            id={fieldName}
                            type={field.type}
                            placeholder={field.placeholder}
                            required={field.validation?.required}
                            disabled={field.disabled}
                            value={formData[fieldName] || ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-3 pt-4 border-t border-control-border">
                    <Button
                      type="submit"
                      disabled={completeMutation.isPending}
                      className="flex-1 gap-2"
                    >
                      {completeMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>SUBMITTING...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>COMPLETE TASK</span>
                        </>
                      )}
                    </Button>
                    <Link href="/tasks">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={completeMutation.isPending}
                      >
                        CANCEL
                      </Button>
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Context Information */}
          {task.context && (
            <Card className="border-control-border-bright">
              <CardHeader>
                <CardTitle className="text-lg font-mono">CONTEXT</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(task.context as Record<string, any>).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="mono-data text-muted-foreground text-xs uppercase">{key}</p>
                    <p className="font-mono text-sm break-all">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Task Timeline */}
          {task.history && task.history.length > 0 && (
            <Card className="border-control-border-bright">
              <CardHeader>
                <CardTitle className="text-lg font-mono">TIMELINE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.history.map((event: any, index: number) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-control-cyan"></div>
                      {index < task.history.length - 1 && (
                        <div className="w-[2px] flex-1 bg-control-border mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-mono text-sm mb-1">{event.action || event.type}</p>
                      <p className="mono-data text-muted-foreground text-xs">
                        {formatRelativeTime(new Date(event.createdAt))}
                      </p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-2">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
