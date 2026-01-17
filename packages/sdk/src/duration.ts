/**
 * @module duration
 *
 * Duration parsing utilities for converting human-readable duration strings
 * (e.g., "10m", "1h", "2d") to milliseconds.
 */

/**
 * Duration type - either a human-readable string or milliseconds
 *
 * @example
 * // String formats:
 * '10ms'  // 10 milliseconds
 * '10s'   // 10 seconds
 * '10m'   // 10 minutes
 * '10h'   // 10 hours
 * '10d'   // 10 days
 * '10w'   // 10 weeks
 *
 * // Numeric format (milliseconds):
 * 60000   // 1 minute
 */
export type Duration = string | number;

/**
 * Time unit multipliers in milliseconds
 */
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

const TIME_UNITS = new Map<string, number>([
  ['ms', 1],
  ['s', MS_PER_SECOND],
  ['sec', MS_PER_SECOND],
  ['second', MS_PER_SECOND],
  ['seconds', MS_PER_SECOND],
  ['m', MS_PER_MINUTE],
  ['min', MS_PER_MINUTE],
  ['minute', MS_PER_MINUTE],
  ['minutes', MS_PER_MINUTE],
  ['h', MS_PER_HOUR],
  ['hr', MS_PER_HOUR],
  ['hour', MS_PER_HOUR],
  ['hours', MS_PER_HOUR],
  ['d', MS_PER_DAY],
  ['day', MS_PER_DAY],
  ['days', MS_PER_DAY],
  ['w', MS_PER_WEEK],
  ['week', MS_PER_WEEK],
  ['weeks', MS_PER_WEEK],
]);

/**
 * Regular expression for parsing duration strings.
 * Matches patterns like "10m", "1.5h", "2d", etc.
 */
const DURATION_REGEX = /^(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds?|m|min|minutes?|h|hr|hours?|d|days?|w|weeks?)$/i;

/**
 * Error thrown when duration parsing fails
 */
export class DurationParseError extends Error {
  /**
   * The invalid duration value that caused the error
   */
  public readonly value: unknown;

  constructor(value: unknown, message?: string) {
    const msg = message ?? `Invalid duration: ${JSON.stringify(value)}. Expected a number (milliseconds) or string like "10m", "1h", "2d"`;
    super(msg);
    this.name = 'DurationParseError';
    this.value = value;
  }
}

/**
 * Parse a duration value into milliseconds.
 *
 * @param duration - The duration to parse. Can be a number (milliseconds) or a string like "10m", "1h", "2d"
 * @returns The duration in milliseconds
 * @throws {DurationParseError} If the duration format is invalid
 *
 * @example
 * parseDuration(5000)      // 5000 (already in ms)
 * parseDuration('10s')     // 10000
 * parseDuration('5m')      // 300000
 * parseDuration('1h')      // 3600000
 * parseDuration('1d')      // 86400000
 * parseDuration('1w')      // 604800000
 * parseDuration('1.5h')    // 5400000
 */
export function parseDuration(duration: Duration): number {
  // If already a number, return as-is (assumed to be milliseconds)
  if (typeof duration === 'number') {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new DurationParseError(duration, 'Duration must be a positive finite number');
    }
    return Math.floor(duration);
  }

  // Parse string format
  if (typeof duration === 'string') {
    const trimmed = duration.trim();

    // Handle pure numeric strings
    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue)) {
      if (numericValue < 0) {
        throw new DurationParseError(duration, 'Duration must be positive');
      }
      return Math.floor(numericValue);
    }

    // Parse duration format (e.g., "10m", "1h")
    const match = DURATION_REGEX.exec(trimmed);
    if (!match) {
      throw new DurationParseError(duration);
    }

    const valueStr = match[1];
    const unitStr = match[2];
    if (!valueStr || !unitStr) {
      throw new DurationParseError(duration);
    }
    const value = parseFloat(valueStr);
    const unit = unitStr.toLowerCase();
    const multiplier = TIME_UNITS.get(unit);

    if (multiplier === undefined) {
      throw new DurationParseError(duration, `Unknown time unit: ${unit}`);
    }

    return Math.floor(value * multiplier);
  }

  throw new DurationParseError(duration);
}

/**
 * Format milliseconds as a human-readable duration string.
 *
 * @param ms - The duration in milliseconds
 * @param options - Formatting options
 * @returns A human-readable duration string
 *
 * @example
 * formatDuration(5000)                    // "5s"
 * formatDuration(300000)                  // "5m"
 * formatDuration(3600000)                 // "1h"
 * formatDuration(90000)                   // "1m 30s"
 * formatDuration(90000, { short: true })  // "1m"
 */
export function formatDuration(
  ms: number,
  options: { short?: boolean } = {}
): string {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new DurationParseError(ms, 'Duration must be a positive finite number');
  }

  const { short = false } = options;

  // Handle zero
  if (ms === 0) {
    return '0s';
  }

  const weeks = Math.floor(ms / MS_PER_WEEK);
  const days = Math.floor((ms % MS_PER_WEEK) / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);
  const milliseconds = ms % MS_PER_SECOND;

  const parts: string[] = [];

  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  if (milliseconds > 0 && !short) parts.push(`${milliseconds}ms`);

  // In short mode, only return the largest unit
  if (short && parts.length > 0) {
    const first = parts[0];
    return first ?? '0s';
  }

  return parts.join(' ') || '0s';
}

/**
 * Check if a value is a valid duration.
 *
 * @param value - The value to check
 * @returns True if the value is a valid duration, false otherwise
 *
 * @example
 * isDuration(5000)     // true
 * isDuration('10m')    // true
 * isDuration('1h')     // true
 * isDuration('invalid')// false
 * isDuration(-1)       // false
 */
export function isDuration(value: unknown): value is Duration {
  try {
    parseDuration(value as Duration);
    return true;
  } catch {
    return false;
  }
}

/**
 * Add two durations together.
 *
 * @param a - First duration
 * @param b - Second duration
 * @returns The sum in milliseconds
 *
 * @example
 * addDurations('1h', '30m')  // 5400000 (1.5 hours)
 * addDurations(1000, '1s')   // 2000
 */
export function addDurations(a: Duration, b: Duration): number {
  return parseDuration(a) + parseDuration(b);
}

/**
 * Convert a duration to seconds.
 *
 * @param duration - The duration to convert
 * @returns The duration in seconds
 *
 * @example
 * toSeconds('1m')   // 60
 * toSeconds('1h')   // 3600
 * toSeconds(5000)   // 5
 */
export function toSeconds(duration: Duration): number {
  return Math.floor(parseDuration(duration) / 1000);
}

/**
 * Convert a duration to minutes.
 *
 * @param duration - The duration to convert
 * @returns The duration in minutes
 *
 * @example
 * toMinutes('1h')   // 60
 * toMinutes('90s')  // 1.5
 * toMinutes(300000) // 5
 */
export function toMinutes(duration: Duration): number {
  return parseDuration(duration) / (60 * 1000);
}

/**
 * Convert a duration to hours.
 *
 * @param duration - The duration to convert
 * @returns The duration in hours
 *
 * @example
 * toHours('90m')    // 1.5
 * toHours('1d')     // 24
 */
export function toHours(duration: Duration): number {
  return parseDuration(duration) / (60 * 60 * 1000);
}
