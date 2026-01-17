/**
 * @module timeout
 *
 * Timeout and deadline utilities for SLA configuration.
 * These helpers make it easy to define time-based constraints for tasks.
 */

import type { Duration } from './duration.js';
import { parseDuration } from './duration.js';
import type { SLAOptions, SLABreachAction, AssignmentTarget } from './types.js';

/**
 * Create an SLA configuration with a timeout duration.
 *
 * @param duration - How long until the SLA is breached (e.g., "30m", "1h", "2d")
 * @param onBreach - Action to take when breached (default: 'escalate')
 * @returns SLA configuration object
 *
 * @example
 * // 30 minute timeout with escalation
 * const sla = timeout('30m');
 *
 * // 1 hour timeout with notification
 * const sla = timeout('1h', 'notify');
 *
 * // 2 hours with cancellation
 * const sla = timeout('2h', 'cancel');
 *
 * // Use in task options
 * await task(ctx, {
 *   title: 'Urgent review',
 *   form: { ... },
 *   assignTo: { group: 'reviewers' },
 *   sla: timeout('30m'),
 * });
 */
export function timeout(
  duration: Duration,
  onBreach: SLABreachAction = 'escalate'
): SLAOptions {
  return {
    deadline: duration,
    onBreach,
  };
}

/**
 * Create an SLA configuration with escalation to a specific target.
 *
 * @param duration - How long until the SLA is breached
 * @param escalateTo - Target to escalate to (user or group)
 * @returns SLA configuration object
 *
 * @example
 * // Escalate to L2 support after 30 minutes
 * const sla = timeoutWithEscalation('30m', { group: 'support-l2' });
 *
 * // Escalate to manager after 1 hour
 * const sla = timeoutWithEscalation('1h', { user: 'usr_manager123' });
 */
export function timeoutWithEscalation(
  duration: Duration,
  escalateTo: AssignmentTarget
): SLAOptions {
  return {
    deadline: duration,
    onBreach: 'escalate',
    escalateTo,
  };
}

/**
 * Create an SLA configuration from an absolute deadline.
 *
 * @param date - The deadline date/time
 * @param onBreach - Action to take when breached (default: 'notify')
 * @returns SLA configuration object
 * @throws {Error} If the deadline is in the past
 *
 * @example
 * // End of business day deadline
 * const endOfDay = new Date();
 * endOfDay.setHours(17, 0, 0, 0);
 * const sla = deadline(endOfDay);
 *
 * // Specific date deadline
 * const sla = deadline(new Date('2024-12-31T23:59:59'));
 *
 * // With custom breach action
 * const sla = deadline(dueDate, 'cancel');
 */
export function deadline(
  date: Date,
  onBreach: SLABreachAction = 'notify'
): SLAOptions {
  const now = new Date();
  const ms = date.getTime() - now.getTime();

  if (ms <= 0) {
    throw new Error('Deadline must be in the future');
  }

  return {
    deadline: ms,
    onBreach,
  };
}

/**
 * Create an SLA configuration with an absolute deadline and escalation.
 *
 * @param date - The deadline date/time
 * @param escalateTo - Target to escalate to
 * @returns SLA configuration object
 * @throws {Error} If the deadline is in the past
 *
 * @example
 * const sla = deadlineWithEscalation(dueDate, { group: 'managers' });
 */
export function deadlineWithEscalation(
  date: Date,
  escalateTo: AssignmentTarget
): SLAOptions {
  const now = new Date();
  const ms = date.getTime() - now.getTime();

  if (ms <= 0) {
    throw new Error('Deadline must be in the future');
  }

  return {
    deadline: ms,
    onBreach: 'escalate',
    escalateTo,
  };
}

/**
 * Create an SLA configuration with a warning notification before the deadline.
 *
 * @param duration - How long until the SLA is breached
 * @param warnBefore - How long before deadline to send warning
 * @param onBreach - Action to take when breached (default: 'escalate')
 * @returns SLA configuration object
 *
 * @example
 * // 1 hour deadline with 15 minute warning
 * const sla = timeoutWithWarning('1h', '15m');
 *
 * // 30 minute deadline with 5 minute warning
 * const sla = timeoutWithWarning('30m', '5m', 'notify');
 */
export function timeoutWithWarning(
  duration: Duration,
  warnBefore: Duration,
  onBreach: SLABreachAction = 'escalate'
): SLAOptions {
  return {
    deadline: duration,
    onBreach,
    warnBefore,
  };
}

/**
 * Calculate the deadline timestamp from SLA options.
 *
 * @param sla - SLA configuration
 * @param fromTime - Reference time (default: now)
 * @returns The deadline as a Date
 *
 * @example
 * const sla = timeout('30m');
 * const dueAt = calculateDeadline(sla);
 * console.log('Due at:', dueAt.toISOString());
 */
export function calculateDeadline(sla: SLAOptions, fromTime: Date = new Date()): Date {
  const ms = parseDuration(sla.deadline);
  return new Date(fromTime.getTime() + ms);
}

/**
 * Check if an SLA deadline has passed.
 *
 * @param sla - SLA configuration
 * @param createdAt - When the task was created
 * @param now - Current time (default: new Date())
 * @returns True if the deadline has passed
 *
 * @example
 * const sla = timeout('30m');
 * const createdAt = new Date('2024-01-01T10:00:00');
 * const now = new Date('2024-01-01T10:45:00');
 * if (isBreached(sla, createdAt, now)) {
 *   console.log('SLA breached!');
 * }
 */
export function isBreached(
  sla: SLAOptions,
  createdAt: Date,
  now: Date = new Date()
): boolean {
  const deadlineTime = calculateDeadline(sla, createdAt);
  return now.getTime() >= deadlineTime.getTime();
}

/**
 * Check if the warning threshold has been reached.
 *
 * @param sla - SLA configuration (must have warnBefore set)
 * @param createdAt - When the task was created
 * @param now - Current time (default: new Date())
 * @returns True if within warning period, false otherwise
 *
 * @example
 * const sla = timeoutWithWarning('1h', '15m');
 * if (isInWarningPeriod(sla, createdAt)) {
 *   // Send warning notification
 * }
 */
export function isInWarningPeriod(
  sla: SLAOptions,
  createdAt: Date,
  now: Date = new Date()
): boolean {
  if (!sla.warnBefore) {
    return false;
  }

  const deadlineTime = calculateDeadline(sla, createdAt);
  const warnMs = parseDuration(sla.warnBefore);
  const warnTime = new Date(deadlineTime.getTime() - warnMs);

  return now.getTime() >= warnTime.getTime() && now.getTime() < deadlineTime.getTime();
}

/**
 * Get the remaining time until the SLA deadline.
 *
 * @param sla - SLA configuration
 * @param createdAt - When the task was created
 * @param now - Current time (default: new Date())
 * @returns Remaining time in milliseconds (negative if breached)
 *
 * @example
 * const remaining = getTimeRemaining(sla, createdAt);
 * if (remaining > 0) {
 *   console.log(`${remaining}ms remaining`);
 * } else {
 *   console.log(`Overdue by ${Math.abs(remaining)}ms`);
 * }
 */
export function getTimeRemaining(
  sla: SLAOptions,
  createdAt: Date,
  now: Date = new Date()
): number {
  const deadlineTime = calculateDeadline(sla, createdAt);
  return deadlineTime.getTime() - now.getTime();
}

// =============================================================================
// Tier-based SLA Helpers
// =============================================================================

/**
 * SLA configuration based on customer/priority tiers.
 */
export interface TierSLAConfig {
  [tier: string]: Duration;
}

/**
 * Create a tier-based SLA selector.
 *
 * @param config - Map of tier names to timeout durations
 * @param defaultTier - Default tier if not found
 * @returns Function to get SLA for a tier
 *
 * @example
 * const getSLA = tierBasedTimeout({
 *   enterprise: '10m',
 *   premium: '30m',
 *   basic: '2h',
 * }, 'basic');
 *
 * const sla = getSLA(customer.tier);
 * // Returns timeout('10m') for enterprise customers
 */
export function tierBasedTimeout(
  config: TierSLAConfig,
  defaultTier: string
): (tier: string) => SLAOptions {
  return (tier: string): SLAOptions => {
    const duration = config[tier] ?? config[defaultTier];
    if (!duration) {
      throw new Error(`No SLA configured for tier: ${tier}`);
    }
    return timeout(duration);
  };
}

/**
 * Create a tier-based SLA selector with escalation targets.
 *
 * @param config - Map of tier names to { timeout, escalateTo }
 * @param defaultTier - Default tier if not found
 * @returns Function to get SLA for a tier
 *
 * @example
 * const getSLA = tierBasedEscalation({
 *   enterprise: { timeout: '10m', escalateTo: { group: 'enterprise-support' } },
 *   premium: { timeout: '30m', escalateTo: { group: 'premium-support' } },
 *   basic: { timeout: '2h', escalateTo: { group: 'support-l2' } },
 * }, 'basic');
 *
 * const sla = getSLA(customer.tier);
 */
export function tierBasedEscalation(
  config: Record<string, { timeout: Duration; escalateTo: AssignmentTarget }>,
  defaultTier: string
): (tier: string) => SLAOptions {
  return (tier: string): SLAOptions => {
    const tierConfig = config[tier] ?? config[defaultTier];
    if (!tierConfig) {
      throw new Error(`No SLA configured for tier: ${tier}`);
    }
    return timeoutWithEscalation(tierConfig.timeout, tierConfig.escalateTo);
  };
}
