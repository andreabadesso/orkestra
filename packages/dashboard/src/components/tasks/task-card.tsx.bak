/**
 * Task Card Component
 *
 * Displays a single task in a card format for list views.
 * Shows title, status, priority, SLA deadline, and action buttons.
 */

'use client';

import Link from 'next/link';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Play,
  User,
  Users,
} from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import type { TaskStatus, TaskPriority } from '@/types/task';

/**
 * Task card props
 */
interface TaskCardProps {
  /** Task ID */
  id: string;
  /** Task title */
  title: string;
  /** Task description */
  description: string | null;
  /** Task type */
  type: string;
  /** Current status */
  status: TaskStatus;
  /** Priority level */
  priority: TaskPriority;
  /** Assigned group ID */
  assignedGroupId: string | null;
  /** User who claimed the task */
  claimedBy: string | null;
  /** Due date (ISO string) */
  dueAt: string | null;
  /** Created date (ISO string) */
  createdAt: string;
  /** Whether the current user can claim this task */
  canClaim?: boolean;
  /** Callback when claim button is clicked */
  onClaim?: (taskId: string) => void;
  /** Whether claim is loading */
  isClaimLoading?: boolean;
}

/**
 * Get status display configuration
 */
function getStatusConfig(status: TaskStatus) {
  const configs: Record<TaskStatus, {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ElementType;
  }> = {
    pending: {
      label: 'Pending',
      color: '#f59e0b',
      bgColor: '#fef3c7',
      icon: Clock,
    },
    assigned: {
      label: 'Assigned',
      color: '#3b82f6',
      bgColor: '#dbeafe',
      icon: User,
    },
    in_progress: {
      label: 'In Progress',
      color: '#8b5cf6',
      bgColor: '#ede9fe',
      icon: Play,
    },
    completed: {
      label: 'Completed',
      color: '#10b981',
      bgColor: '#d1fae5',
      icon: CheckCircle2,
    },
    cancelled: {
      label: 'Cancelled',
      color: '#6b7280',
      bgColor: '#f3f4f6',
      icon: XCircle,
    },
    expired: {
      label: 'Expired',
      color: '#ef4444',
      bgColor: '#fee2e2',
      icon: AlertTriangle,
    },
    escalated: {
      label: 'Escalated',
      color: '#f97316',
      bgColor: '#ffedd5',
      icon: ArrowUpCircle,
    },
  };
  return configs[status];
}

/**
 * Get priority display configuration
 */
function getPriorityConfig(priority: TaskPriority) {
  const configs: Record<TaskPriority, {
    label: string;
    color: string;
    bgColor: string;
  }> = {
    low: {
      label: 'Low',
      color: '#6b7280',
      bgColor: '#f3f4f6',
    },
    medium: {
      label: 'Medium',
      color: '#3b82f6',
      bgColor: '#dbeafe',
    },
    high: {
      label: 'High',
      color: '#f97316',
      bgColor: '#ffedd5',
    },
    urgent: {
      label: 'Urgent',
      color: '#ef4444',
      bgColor: '#fee2e2',
    },
  };
  return configs[priority];
}

/**
 * Format the due date for display
 */
function formatDueDate(dueAt: string | null): {
  text: string;
  isOverdue: boolean;
  isWarning: boolean;
} {
  if (!dueAt) {
    return { text: 'No due date', isOverdue: false, isWarning: false };
  }

  const dueDate = parseISO(dueAt);
  const isOverdue = isPast(dueDate);

  if (isOverdue) {
    return {
      text: `Overdue by ${formatDistanceToNow(dueDate)}`,
      isOverdue: true,
      isWarning: false,
    };
  }

  const hoursUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
  const isWarning = hoursUntilDue < 24;

  return {
    text: `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`,
    isOverdue: false,
    isWarning,
  };
}

/**
 * Task card component
 */
export function TaskCard({
  id,
  title,
  description,
  type,
  status,
  priority,
  assignedGroupId,
  claimedBy,
  dueAt,
  createdAt,
  canClaim = false,
  onClaim,
  isClaimLoading = false,
}: TaskCardProps) {
  const statusConfig = getStatusConfig(status);
  const priorityConfig = getPriorityConfig(priority);
  const dueInfo = formatDueDate(dueAt);
  const StatusIcon = statusConfig.icon;

  const handleClaim = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClaim && !isClaimLoading) {
      onClaim(id);
    }
  };

  return (
    <Link href={`/tasks/${id}`} style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.badges}>
          {/* Status badge */}
          <span
            style={{
              ...styles.badge,
              color: statusConfig.color,
              backgroundColor: statusConfig.bgColor,
            }}
          >
            <StatusIcon size={14} />
            {statusConfig.label}
          </span>

          {/* Priority badge */}
          <span
            style={{
              ...styles.badge,
              color: priorityConfig.color,
              backgroundColor: priorityConfig.bgColor,
            }}
          >
            {priorityConfig.label}
          </span>
        </div>

        {/* Type badge */}
        <span style={styles.typeBadge}>{type}</span>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <h3 style={styles.title}>{title}</h3>
        {description && (
          <p style={styles.description}>{description}</p>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        {/* Meta info */}
        <div style={styles.meta}>
          {/* Due date */}
          <span
            style={{
              ...styles.metaItem,
              color: dueInfo.isOverdue
                ? '#ef4444'
                : dueInfo.isWarning
                  ? '#f97316'
                  : '#6b7280',
            }}
          >
            <Clock size={14} />
            {dueInfo.text}
          </span>

          {/* Assignment info */}
          {assignedGroupId && (
            <span style={styles.metaItem}>
              <Users size={14} />
              {claimedBy ? 'Claimed' : 'Unassigned'}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          {canClaim && !claimedBy && (
            <button
              onClick={handleClaim}
              disabled={isClaimLoading}
              style={styles.claimButton}
            >
              {isClaimLoading ? 'Claiming...' : 'Claim'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Styles
 */
const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '1rem',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'box-shadow 0.15s, border-color 0.15s',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  badges: {
    display: 'flex',
    gap: '0.5rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  typeBadge: {
    fontSize: '0.75rem',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
  },
  content: {
    flex: 1,
    marginBottom: '0.75rem',
  },
  title: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 0.25rem 0',
    lineHeight: '1.4',
  },
  description: {
    fontSize: '0.8125rem',
    color: '#6b7280',
    margin: 0,
    lineHeight: '1.5',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '0.75rem',
    borderTop: '1px solid #f3f4f6',
  },
  meta: {
    display: 'flex',
    gap: '1rem',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
  },
  claimButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
};

export default TaskCard;
