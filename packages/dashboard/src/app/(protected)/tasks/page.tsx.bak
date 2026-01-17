/**
 * Task Inbox Page - Mission Control
 *
 * Displays all pending tasks with filtering and claiming capabilities
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import Link from 'next/link';
import {
  Activity,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  Zap,
  User,
  Loader2,
} from 'lucide-react';
import { formatRelativeTime, getUrgencyLevel } from '@/lib/utils';

/**
 * Task Inbox Page Component
 */
export default function TasksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const { data, isLoading, refetch } = trpc.task.pending.useQuery({
    includeGroupTasks: true,
  });

  const tasks = data?.items || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="section-heading">Task Inbox</h1>
          <p className="mono-data">ACTIVE OPERATIONS REQUIRING HUMAN INPUT</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-control-border-bright">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono font-semibold">FILTERS</CardTitle>
            <Filter className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="mono-data text-muted-foreground block">SEARCH</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="mono-data text-muted-foreground block">STATUS</label>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Tasks</option>
              <option value="unclaimed">Unclaimed</option>
              <option value="claimed">Claimed</option>
              <option value="overdue">Overdue</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="mono-data text-muted-foreground block">PRIORITY</label>
            <Select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="border-control-border-bright">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-control-cyan animate-spin mb-4" />
              <p className="mono-data text-control-cyan">LOADING TASKS...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && tasks.length === 0 && (
        <Card className="border-control-border-bright">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-control-emerald/10 flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-control-emerald" />
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">All Clear</h3>
              <p className="mono-data text-muted-foreground mb-4">
                NO TASKS IN QUEUE
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                You've completed all assigned tasks. New tasks will appear here when
                AI agents require human intervention or approval.
              </p>
              <div className="flex items-center gap-2 mt-6 mono-data text-control-emerald">
                <span className="status-led status-active"></span>
                <span>SYSTEM READY</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task List */}
      {!isLoading && tasks.length > 0 && (
        <div className="space-y-4">
          {tasks.map((task) => {
            const isClaimed = !!task.claimedBy;
            const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();
            const priorityVariant = {
              urgent: 'destructive' as const,
              high: 'warning' as const,
              medium: 'default' as const,
              low: 'outline' as const,
            }[task.priority];

            const priorityColor = {
              urgent: 'text-control-red',
              high: 'text-control-amber',
              medium: 'text-control-cyan',
              low: 'text-muted-foreground',
            }[task.priority];

            return (
              <Card
                key={task.id}
                className={`card-interactive group ${
                  isOverdue
                    ? 'border-control-red/50 hover:border-control-red'
                    : isClaimed
                      ? 'border-control-emerald/50 hover:border-control-emerald'
                      : 'border-control-cyan/50 hover:border-control-cyan'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={priorityVariant} className="font-mono shrink-0 uppercase">
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0 uppercase">
                          {task.type}
                        </Badge>
                        {isClaimed && (
                          <Badge variant="success" className="font-mono text-[10px] shrink-0">
                            CLAIMED
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive" className="font-mono text-[10px] shrink-0">
                            OVERDUE
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg font-serif mb-1">
                        {task.title}
                      </CardTitle>
                      {task.description && (
                        <CardDescription className="text-sm">
                          {task.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`status-led ${isOverdue ? 'status-urgent' : isClaimed ? 'status-active' : 'status-pending'}`}></span>
                      {task.dueAt && (
                        <span className={`mono-data text-[10px] ${isOverdue ? 'text-control-red' : 'text-control-amber'}`}>
                          DUE {formatRelativeTime(new Date(task.dueAt))}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="mono-data text-muted-foreground">TYPE</p>
                      <p className="font-mono">{task.type}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="mono-data text-muted-foreground">PRIORITY</p>
                      <p className={`font-mono ${priorityColor}`}>{task.priority}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="mono-data text-muted-foreground">ASSIGNED</p>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <p className="font-mono text-xs">
                          {task.assignedGroupId || task.assignedUserId || 'unassigned'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="mono-data text-muted-foreground">CREATED</p>
                      <p className="font-mono text-xs">{formatRelativeTime(new Date(task.createdAt))}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-control-border">
                    <div className={`flex items-center gap-2 mono-data ${isClaimed ? 'text-control-emerald' : 'text-control-amber'}`}>
                      {isClaimed ? (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>IN PROGRESS</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 animate-pulse-slow" />
                          <span>AWAITING CLAIM</span>
                        </>
                      )}
                    </div>
                    <Link href={`/tasks/${task.id}`}>
                      <Button
                        variant={isClaimed ? 'outline' : 'default'}
                        size="sm"
                        className="gap-2 group-hover:gap-3 transition-all"
                      >
                        <span>{isClaimed ? 'Continue' : 'Claim Task'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
