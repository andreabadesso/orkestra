import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date relative to now
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diff = target.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return target.toLocaleDateString();
  }

  if (days > 0) {
    return `${days}d ${diff < 0 ? 'ago' : 'from now'}`;
  }

  if (hours > 0) {
    return `${hours}h ${diff < 0 ? 'ago' : 'from now'}`;
  }

  if (minutes > 0) {
    return `${minutes}m ${diff < 0 ? 'ago' : 'from now'}`;
  }

  return diff < 0 ? 'just now' : 'soon';
}

/**
 * Get urgency level based on due date
 */
export function getUrgencyLevel(dueAt: Date | string | null): 'overdue' | 'urgent' | 'soon' | 'normal' {
  if (!dueAt) return 'normal';

  const target = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (diff < 0) return 'overdue';
  if (hours < 4) return 'urgent';
  if (hours < 24) return 'soon';
  return 'normal';
}
