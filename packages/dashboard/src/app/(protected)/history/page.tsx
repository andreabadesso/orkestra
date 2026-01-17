/**
 * Task History Page - Mission Control
 *
 * Shows completed task history with filters
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CheckCircle2, Search, Calendar, User, Clock } from 'lucide-react';

/**
 * Task History Page Component
 */
export default function HistoryPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="section-heading">Task History</h1>
        <p className="mono-data">COMPLETED OPERATIONS ARCHIVE</p>
      </div>

      {/* Filters */}
      <Card className="border-control-border-bright">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-mono font-semibold">FILTERS</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="mono-data text-muted-foreground block">SEARCH</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search history..." className="pl-10" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="mono-data text-muted-foreground block">TIME RANGE</label>
            <Select>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="all">All Time</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="mono-data text-muted-foreground block">TYPE</label>
            <Select>
              <option value="all">All Types</option>
              <option value="approval">Approval</option>
              <option value="review">Review</option>
              <option value="escalation">Escalation</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      <Card className="border-control-border-bright">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-control-emerald/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-control-emerald" />
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2">No History Yet</h3>
            <p className="mono-data text-muted-foreground mb-4">
              NO COMPLETED TASKS IN ARCHIVE
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              Completed tasks will appear here. Once you start processing tasks,
              you'll see a complete audit trail of all your actions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Example History Entry */}
      <Card className="border-control-border group hover:border-control-emerald/50 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="success" className="font-mono">
                  COMPLETED
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  APPROVAL
                </Badge>
              </div>
              <h3 className="font-serif text-lg font-semibold mb-1">
                Customer Refund Approval
              </h3>
              <p className="text-sm text-muted-foreground">
                Approved partial refund of $250.00
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <CheckCircle2 className="w-5 h-5 text-control-emerald" />
              <span className="mono-data text-control-emerald text-[10px]">
                APPROVED
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mono-data text-muted-foreground">
                <User className="w-3 h-3" />
                <span>COMPLETED BY</span>
              </div>
              <p className="font-mono font-medium">You</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mono-data text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>COMPLETED</span>
              </div>
              <p className="font-mono font-medium">2 hours ago</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mono-data text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>DURATION</span>
              </div>
              <p className="font-mono font-medium">12 minutes</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mono-data text-muted-foreground">
                <CheckCircle2 className="w-3 h-3" />
                <span>RESULT</span>
              </div>
              <p className="font-mono font-medium text-control-emerald">Success</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
