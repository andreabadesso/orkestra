/**
 * Task List Component
 *
 * Displays a list of tasks grouped by urgency based on SLA.
 * Supports filtering and sorting.
 */

'use client';

import { useState } from 'react';
import { Filter, SortAsc, SortDesc, RefreshCw } from 'lucide-react';
import { isPast, parseISO, isWithinInterval, addHours } from 'date-fns';
import { TaskCard } from './task-card';
import type { TaskStatus, TaskPriority } from '@/types/task';

/**
 * Task item for list
 */
interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedGroupId: string | null;
  claimedBy: string | null;
  dueAt: string | null;
  createdAt: string;
}

/**
 * Task list props
 */
interface TaskListProps {
  /** List of tasks to display */
  tasks: TaskItem[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error message if any */
  error?: string | null;
  /** Callback when claim button is clicked */
  onClaim?: (taskId: string) => void;
  /** Task ID being claimed */
  claimingTaskId?: string | null;
  /** Callback to refresh the list */
  onRefresh?: () => void;
  /** Whether the current user can claim tasks */
  canClaim?: boolean;
  /** Title for the list */
  title?: string;
  /** Whether to show urgency grouping */
  showUrgencyGroups?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Urgency group for tasks
 */
type UrgencyGroup = 'overdue' | 'due-soon' | 'normal';

/**
 * Get urgency group for a task based on due date
 */
function getUrgencyGroup(dueAt: string | null): UrgencyGroup {
  if (!dueAt) return 'normal';

  const dueDate = parseISO(dueAt);

  if (isPast(dueDate)) {
    return 'overdue';
  }

  // Due within next 24 hours
  if (isWithinInterval(dueDate, {
    start: new Date(),
    end: addHours(new Date(), 24),
  })) {
    return 'due-soon';
  }

  return 'normal';
}

/**
 * Group tasks by urgency
 */
function groupTasksByUrgency(tasks: TaskItem[]): Record<UrgencyGroup, TaskItem[]> {
  const groups: Record<UrgencyGroup, TaskItem[]> = {
    overdue: [],
    'due-soon': [],
    normal: [],
  };

  tasks.forEach((task) => {
    const group = getUrgencyGroup(task.dueAt);
    groups[group].push(task);
  });

  return groups;
}

/**
 * Urgency group labels and styles
 */
const urgencyConfig: Record<UrgencyGroup, {
  label: string;
  description: string;
  headerColor: string;
  headerBg: string;
}> = {
  overdue: {
    label: 'Overdue',
    description: 'These tasks are past their due date',
    headerColor: '#ef4444',
    headerBg: '#fee2e2',
  },
  'due-soon': {
    label: 'Due Soon',
    description: 'Due within the next 24 hours',
    headerColor: '#f97316',
    headerBg: '#ffedd5',
  },
  normal: {
    label: 'Upcoming',
    description: 'Tasks with more time',
    headerColor: '#6b7280',
    headerBg: '#f3f4f6',
  },
};

/**
 * Filter options
 */
type FilterOption = 'all' | 'unclaimed' | 'mine';
type SortOption = 'dueAt' | 'priority' | 'createdAt';
type SortDirection = 'asc' | 'desc';

/**
 * Priority sort values
 */
const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Task list component
 */
export function TaskList({
  tasks,
  isLoading = false,
  error = null,
  onClaim,
  claimingTaskId = null,
  onRefresh,
  canClaim = true,
  title = 'Tasks',
  showUrgencyGroups = true,
  emptyMessage = 'No tasks found',
}: TaskListProps) {
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [sortOption, setSortOption] = useState<SortOption>('dueAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // Filter tasks
  let filteredTasks = [...tasks];
  if (filterOption === 'unclaimed') {
    filteredTasks = filteredTasks.filter((task) => !task.claimedBy);
  } else if (filterOption === 'mine') {
    filteredTasks = filteredTasks.filter((task) => task.claimedBy);
  }

  // Sort tasks
  filteredTasks.sort((a, b) => {
    let comparison = 0;

    switch (sortOption) {
      case 'dueAt':
        if (!a.dueAt && !b.dueAt) comparison = 0;
        else if (!a.dueAt) comparison = 1;
        else if (!b.dueAt) comparison = -1;
        else comparison = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        break;
      case 'priority':
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  // Group by urgency if enabled
  const groupedTasks = showUrgencyGroups
    ? groupTasksByUrgency(filteredTasks)
    : null;

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <RefreshCw size={24} style={styles.loadingSpinner} />
          <span style={styles.loadingText}>Loading tasks...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
          {onRefresh && (
            <button onClick={onRefresh} style={styles.retryButton}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>{title}</h2>
          <span style={styles.count}>{filteredTasks.length} tasks</span>
        </div>

        <div style={styles.headerRight}>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              ...styles.iconButton,
              ...(showFilters ? styles.iconButtonActive : {}),
            }}
          >
            <Filter size={18} />
          </button>

          {/* Sort direction */}
          <button onClick={toggleSortDirection} style={styles.iconButton}>
            {sortDirection === 'asc' ? (
              <SortAsc size={18} />
            ) : (
              <SortDesc size={18} />
            )}
          </button>

          {/* Refresh */}
          {onRefresh && (
            <button onClick={onRefresh} style={styles.iconButton}>
              <RefreshCw size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Show:</span>
            <select
              value={filterOption}
              onChange={(e) => setFilterOption(e.target.value as FilterOption)}
              style={styles.select}
            >
              <option value="all">All tasks</option>
              <option value="unclaimed">Unclaimed only</option>
              <option value="mine">My claimed tasks</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Sort by:</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              style={styles.select}
            >
              <option value="dueAt">Due date</option>
              <option value="priority">Priority</option>
              <option value="createdAt">Created date</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredTasks.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>{emptyMessage}</p>
        </div>
      )}

      {/* Task list */}
      {showUrgencyGroups && groupedTasks ? (
        // Grouped view
        <div style={styles.groupedList}>
          {(['overdue', 'due-soon', 'normal'] as UrgencyGroup[]).map((group) => {
            const groupTasks = groupedTasks[group];
            if (groupTasks.length === 0) return null;

            const config = urgencyConfig[group];

            return (
              <div key={group} style={styles.group}>
                <div
                  style={{
                    ...styles.groupHeader,
                    color: config.headerColor,
                    backgroundColor: config.headerBg,
                  }}
                >
                  <span style={styles.groupLabel}>
                    {config.label} ({groupTasks.length})
                  </span>
                </div>

                <div style={styles.taskGrid}>
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      {...task}
                      canClaim={canClaim && !task.claimedBy}
                      onClaim={onClaim}
                      isClaimLoading={claimingTaskId === task.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Flat list view
        <div style={styles.taskGrid}>
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              {...task}
              canClaim={canClaim && !task.claimedBy}
              onClaim={onClaim}
              isClaimLoading={claimingTaskId === task.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Styles
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#111827',
    margin: 0,
  },
  count: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  headerRight: {
    display: 'flex',
    gap: '0.5rem',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    color: '#6b7280',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  iconButtonActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
    color: '#4f46e5',
  },
  filters: {
    display: 'flex',
    gap: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  select: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.875rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#111827',
    cursor: 'pointer',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '1rem',
  },
  loadingSpinner: {
    color: '#4f46e5',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '1rem',
    backgroundColor: '#fee2e2',
    borderRadius: '8px',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#ef4444',
    margin: 0,
  },
  retryButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#ef4444',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px dashed #e5e7eb',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: 0,
  },
  groupedList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  group: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  groupHeader: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  groupLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  taskGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1rem',
  },
};

export default TaskList;
