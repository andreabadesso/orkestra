/**
 * Date utilities for Orkestra
 *
 * Provides utilities for working with dates, timestamps, and durations.
 */

import type { ISODateString } from '../types/common.js';

/**
 * Get the current timestamp as an ISO date string
 *
 * @returns Current ISO 8601 timestamp
 */
export function now(): ISODateString {
  return new Date().toISOString() as ISODateString;
}

/**
 * Convert a Date to an ISO date string
 *
 * @param date - Date to convert
 * @returns ISO 8601 timestamp
 */
export function toISOString(date: Date): ISODateString {
  return date.toISOString() as ISODateString;
}

/**
 * Parse an ISO date string to a Date
 *
 * @param dateString - ISO 8601 timestamp
 * @returns Parsed Date object
 */
export function parseISOString(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Check if a date string is a valid ISO 8601 format
 *
 * @param dateString - String to validate
 * @returns Whether the string is a valid ISO date
 */
export function isValidISOString(dateString: string): dateString is ISODateString {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString();
}

/**
 * Duration units for time calculations
 */
export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w';

/**
 * Milliseconds per unit
 */
const MS_PER_UNIT: Record<DurationUnit, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parse a duration string to milliseconds
 *
 * @param duration - Duration string (e.g., '30m', '24h', '7d')
 * @returns Duration in milliseconds
 *
 * @example
 * ```typescript
 * parseDuration('30m'); // 1800000
 * parseDuration('24h'); // 86400000
 * parseDuration('7d');  // 604800000
 * ```
 */
export function parseDuration(duration: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/.exec(duration);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2] as DurationUnit;
  const multiplier = MS_PER_UNIT[unit];

  if (multiplier === undefined) {
    throw new Error(`Invalid duration unit: ${unit}`);
  }

  return Math.round(value * multiplier);
}

/**
 * Format milliseconds as a human-readable duration
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration string
 *
 * @example
 * ```typescript
 * formatDuration(1800000);  // '30m'
 * formatDuration(86400000); // '24h'
 * formatDuration(90000);    // '1m 30s'
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 0) {
    return `-${formatDuration(-ms)}`;
  }

  if (ms < 1000) {
    return `${ms}ms`;
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
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Add duration to a date
 *
 * @param date - Base date
 * @param duration - Duration string or milliseconds
 * @returns New date with duration added
 *
 * @example
 * ```typescript
 * addDuration(new Date(), '30m');   // 30 minutes from now
 * addDuration(new Date(), 3600000); // 1 hour from now
 * ```
 */
export function addDuration(date: Date, duration: string | number): Date {
  const ms = typeof duration === 'string' ? parseDuration(duration) : duration;
  return new Date(date.getTime() + ms);
}

/**
 * Subtract duration from a date
 *
 * @param date - Base date
 * @param duration - Duration string or milliseconds
 * @returns New date with duration subtracted
 */
export function subtractDuration(date: Date, duration: string | number): Date {
  const ms = typeof duration === 'string' ? parseDuration(duration) : duration;
  return new Date(date.getTime() - ms);
}

/**
 * Calculate the difference between two dates in milliseconds
 *
 * @param dateA - First date
 * @param dateB - Second date
 * @returns Difference in milliseconds (positive if dateA > dateB)
 */
export function dateDiff(dateA: Date, dateB: Date): number {
  return dateA.getTime() - dateB.getTime();
}

/**
 * Check if a date is in the past
 *
 * @param date - Date to check
 * @returns Whether the date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 *
 * @param date - Date to check
 * @returns Whether the date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Check if a date is within a duration from now
 *
 * @param date - Date to check
 * @param duration - Duration string or milliseconds
 * @returns Whether the date is within the duration
 *
 * @example
 * ```typescript
 * isWithin(someDate, '30m'); // true if within 30 minutes
 * ```
 */
export function isWithin(date: Date, duration: string | number): boolean {
  const ms = typeof duration === 'string' ? parseDuration(duration) : duration;
  const diff = Math.abs(date.getTime() - Date.now());
  return diff <= ms;
}

/**
 * Get the start of day for a date
 *
 * @param date - Date to process
 * @param timezone - IANA timezone (default: UTC)
 * @returns Start of day as ISO string
 */
export function startOfDay(date: Date, timezone: string = 'UTC'): ISODateString {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date);
  return toISOString(new Date(`${dateStr}T00:00:00.000Z`));
}

/**
 * Get the end of day for a date
 *
 * @param date - Date to process
 * @param timezone - IANA timezone (default: UTC)
 * @returns End of day as ISO string
 */
export function endOfDay(date: Date, timezone: string = 'UTC'): ISODateString {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date);
  return toISOString(new Date(`${dateStr}T23:59:59.999Z`));
}

/**
 * Calculate a due date from now
 *
 * @param duration - Duration string (e.g., '30m', '24h', '7d')
 * @returns Due date as ISO string
 *
 * @example
 * ```typescript
 * timeout('30m'); // ISO string 30 minutes from now
 * ```
 */
export function timeout(duration: string): ISODateString {
  return toISOString(addDuration(new Date(), duration));
}

/**
 * Calculate time remaining until a date
 *
 * @param date - Target date
 * @returns Milliseconds remaining (negative if past)
 */
export function timeRemaining(date: Date | string): number {
  const target = typeof date === 'string' ? new Date(date) : date;
  return target.getTime() - Date.now();
}

/**
 * Format a date relative to now
 *
 * @param date - Date to format
 * @returns Relative time string (e.g., '5 minutes ago', 'in 2 hours')
 */
export function formatRelative(date: Date | string): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const diff = target.getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const isPastDate = diff < 0;

  const formatted = formatDuration(absDiff);
  return isPastDate ? `${formatted} ago` : `in ${formatted}`;
}
