/**
 * SLA Management Module
 *
 * Provides utilities for calculating deadlines, checking breaches,
 * and managing SLA configurations.
 */

import { addMinutes, addHours, addDays, addWeeks, differenceInMilliseconds, isPast } from 'date-fns';
import type { SLAConfig, ComputedSLA, EscalationStep } from './types.js';

/**
 * Duration unit mapping for parsing duration strings
 */
const DURATION_REGEX = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/;

/**
 * Parse a duration string to milliseconds
 *
 * Supports formats like:
 * - "10m" - 10 minutes
 * - "1h" - 1 hour
 * - "2d" - 2 days
 * - "1w" - 1 week
 * - "30s" - 30 seconds
 * - "500ms" - 500 milliseconds
 *
 * @param duration - Duration string
 * @returns Duration in milliseconds
 */
export function parseDurationToMs(duration: string): number {
  const match = DURATION_REGEX.exec(duration);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}. Expected format like "10m", "1h", "2d"`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return Math.round(value);
    case 's':
      return Math.round(value * 1000);
    case 'm':
      return Math.round(value * 60 * 1000);
    case 'h':
      return Math.round(value * 60 * 60 * 1000);
    case 'd':
      return Math.round(value * 24 * 60 * 60 * 1000);
    case 'w':
      return Math.round(value * 7 * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Calculate a deadline from a duration string or Date
 *
 * @param deadline - Date object or duration string (e.g., "30m", "1h", "2d")
 * @param from - Base date to calculate from (defaults to now)
 * @returns Calculated deadline Date
 */
export function calculateDeadline(deadline: Date | string, from: Date = new Date()): Date {
  if (deadline instanceof Date) {
    return deadline;
  }

  const ms = parseDurationToMs(deadline);
  return new Date(from.getTime() + ms);
}

/**
 * Add duration to a date using date-fns for accuracy
 *
 * @param date - Base date
 * @param duration - Duration string
 * @returns New date with duration added
 */
export function addDuration(date: Date, duration: string): Date {
  const match = DURATION_REGEX.exec(duration);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return new Date(date.getTime() + value);
    case 's':
      return new Date(date.getTime() + value * 1000);
    case 'm':
      return addMinutes(date, value);
    case 'h':
      return addHours(date, value);
    case 'd':
      return addDays(date, value);
    case 'w':
      return addWeeks(date, value);
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Check if a deadline has been breached
 *
 * @param deadline - Deadline date
 * @returns True if the deadline is in the past
 */
export function isBreached(deadline: Date): boolean {
  return isPast(deadline);
}

/**
 * Get the time remaining until a deadline
 *
 * @param deadline - Deadline date
 * @returns Milliseconds remaining (negative if past)
 */
export function getTimeRemaining(deadline: Date): number {
  return differenceInMilliseconds(deadline, new Date());
}

/**
 * Check if the SLA warning threshold has been reached
 *
 * @param deadline - Deadline date
 * @param warnBefore - Warning threshold duration (e.g., "15m")
 * @returns True if within warning threshold
 */
export function isInWarningPeriod(deadline: Date, warnBefore: string): boolean {
  const warningMs = parseDurationToMs(warnBefore);
  const remaining = getTimeRemaining(deadline);
  return remaining > 0 && remaining <= warningMs;
}

/**
 * Calculate warning date from deadline and warn duration
 *
 * @param deadline - Deadline date
 * @param warnBefore - Warning threshold duration (e.g., "15m")
 * @returns Warning date (when warning should trigger)
 */
export function calculateWarningDate(deadline: Date, warnBefore: string): Date {
  const warningMs = parseDurationToMs(warnBefore);
  return new Date(deadline.getTime() - warningMs);
}

/**
 * Compute full SLA configuration from input
 *
 * @param config - SLA configuration input
 * @param createdAt - Task creation date (defaults to now)
 * @returns Computed SLA with resolved dates
 */
export function computeSLA(config: SLAConfig, createdAt: Date = new Date()): ComputedSLA {
  const dueAt = calculateDeadline(config.deadline, createdAt);

  let warnAt: Date | null = null;
  if (config.warnBefore) {
    warnAt = calculateWarningDate(dueAt, config.warnBefore);
  }

  return {
    dueAt,
    warnAt,
    escalationConfig: config.escalationChain ?? null,
    onBreach: config.onBreach ?? 'notify',
  };
}

/**
 * Get the next escalation step based on time elapsed
 *
 * @param escalationChain - Chain of escalation steps
 * @param taskCreatedAt - Task creation timestamp
 * @param now - Current time (defaults to now)
 * @returns Next escalation step or null if none applicable
 */
export function getNextEscalationStep(
  escalationChain: EscalationStep[],
  taskCreatedAt: Date,
  now: Date = new Date()
): EscalationStep | null {
  const elapsed = differenceInMilliseconds(now, taskCreatedAt);

  // Find the first escalation step that should trigger
  for (const step of escalationChain) {
    const stepMs = parseDurationToMs(step.after);
    if (elapsed >= stepMs) {
      return step;
    }
  }

  return null;
}

/**
 * Calculate the next escalation time
 *
 * @param escalationChain - Chain of escalation steps
 * @param taskCreatedAt - Task creation timestamp
 * @param currentStepIndex - Index of current (executed) escalation step
 * @returns Next escalation date or null if no more steps
 */
export function getNextEscalationTime(
  escalationChain: EscalationStep[],
  taskCreatedAt: Date,
  currentStepIndex: number = -1
): Date | null {
  const nextStepIndex = currentStepIndex + 1;

  if (nextStepIndex >= escalationChain.length) {
    return null;
  }

  const nextStep = escalationChain[nextStepIndex];
  if (!nextStep) {
    return null;
  }

  const stepMs = parseDurationToMs(nextStep.after);
  return new Date(taskCreatedAt.getTime() + stepMs);
}

/**
 * Format time remaining as human-readable string
 *
 * @param ms - Milliseconds remaining
 * @returns Human-readable duration string
 */
export function formatTimeRemaining(ms: number): string {
  if (ms < 0) {
    return `${formatTimeRemaining(-ms)} overdue`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * SLA status information
 */
export interface SLAStatus {
  /** Whether the SLA is breached */
  breached: boolean;
  /** Whether the SLA is in warning period */
  warning: boolean;
  /** Time remaining in milliseconds (negative if breached) */
  timeRemaining: number;
  /** Human-readable time remaining */
  timeRemainingFormatted: string;
  /** Deadline date */
  deadline: Date;
}

/**
 * Get comprehensive SLA status
 *
 * @param deadline - Deadline date
 * @param warnBefore - Optional warning threshold
 * @returns SLA status information
 */
export function getSLAStatus(deadline: Date, warnBefore?: string): SLAStatus {
  const timeRemaining = getTimeRemaining(deadline);
  const breached = isBreached(deadline);
  const warning = !breached && warnBefore ? isInWarningPeriod(deadline, warnBefore) : false;

  return {
    breached,
    warning,
    timeRemaining,
    timeRemainingFormatted: formatTimeRemaining(timeRemaining),
    deadline,
  };
}
