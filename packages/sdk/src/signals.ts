/**
 * @module signals
 *
 * Signal definitions and utilities for workflow communication.
 * Signals are the primary mechanism for external systems to communicate
 * with running workflows.
 */

import * as workflow from '@temporalio/workflow';
import type { Duration } from './duration.js';
import { parseDuration } from './duration.js';
import type { TaskCompletedSignalData, TaskCancelledSignalData } from './types.js';

// =============================================================================
// Signal Definitions
// =============================================================================

/**
 * Signal sent when a human task is completed.
 *
 * @example
 * // In a workflow:
 * workflow.setHandler(signals.taskCompleted, (data) => {
 *   console.log('Task completed:', data.taskId);
 * });
 */
export const taskCompleted = workflow.defineSignal<[TaskCompletedSignalData]>('taskCompleted');

/**
 * Signal sent when a human task is cancelled.
 *
 * @example
 * // In a workflow:
 * workflow.setHandler(signals.taskCancelled, (data) => {
 *   console.log('Task cancelled:', data.taskId, data.reason);
 * });
 */
export const taskCancelled = workflow.defineSignal<[TaskCancelledSignalData]>('taskCancelled');

/**
 * Signal sent to request workflow cancellation.
 */
export const cancelRequested = workflow.defineSignal<[{ reason?: string }]>('cancelRequested');

/**
 * Signal sent to resume a paused workflow.
 */
export const resume = workflow.defineSignal<[{ data?: Record<string, unknown> }]>('resume');

/**
 * Generic signal for custom workflow communication.
 *
 * @example
 * const customSignal = workflow.defineSignal<[{ event: string; data: unknown }]>('custom');
 */
export const custom = workflow.defineSignal<[{ event: string; data: unknown }]>('custom');

// =============================================================================
// Signal Utilities
// =============================================================================

/**
 * Options for signal waiting operations
 */
export interface WaitOptions<T = unknown> {
  /** Optional timeout duration */
  timeout?: Duration;
  /** Optional filter to match specific signals */
  filter?: (data: T) => boolean;
}

/**
 * Result of a race between multiple signal waits
 */
export type SignalRaceResult<T> =
  | { type: 'signal'; data: T }
  | { type: 'timeout' };

/**
 * Create a condition that waits for a signal with optional timeout.
 * Uses Temporal's condition primitive for efficient waiting.
 *
 * @typeParam T - The type of signal data
 * @param signalReceived - Ref to track if signal was received
 * @param signalData - Ref to store received signal data
 * @param options - Wait options including timeout
 * @returns Promise resolving to the signal data or null on timeout
 *
 * @example
 * let received = false;
 * let data: MyData | null = null;
 *
 * workflow.setHandler(mySignal, (d) => {
 *   data = d;
 *   received = true;
 * });
 *
 * const result = await waitForCondition(
 *   () => received,
 *   () => data,
 *   { timeout: '5m' }
 * );
 */
export async function waitForCondition<T>(
  condition: () => boolean,
  getData: () => T | null,
  options?: WaitOptions<T>
): Promise<T | null> {
  const { timeout: timeoutDuration } = options ?? {};

  if (timeoutDuration) {
    const timeoutMs = parseDuration(timeoutDuration);
    const result = await workflow.condition(condition, timeoutMs);
    if (!result) {
      return null; // Timeout
    }
  } else {
    await workflow.condition(condition);
  }

  return getData();
}

/**
 * Wait for any of the specified signals, returning the first one received.
 *
 * @param signals - Array of signal names to wait for
 * @param timeout - Optional timeout duration
 * @returns The signal name and data of the first signal received
 *
 * @example
 * const result = await waitForAnySignal(['approved', 'rejected'], '1h');
 * if (result) {
 *   console.log(`Received ${result.signalName}:`, result.data);
 * }
 */
export async function waitForAnySignal<T = unknown>(
  signals: string[],
  timeout?: Duration
): Promise<{ signalName: string; data: T } | null> {
  let receivedSignal: string | null = null;
  let receivedData: T | null = null;

  // Set up handlers for each signal
  for (const signalName of signals) {
    const signal = workflow.defineSignal<[T]>(signalName);
    workflow.setHandler(signal, (data: T) => {
      if (receivedSignal === null) {
        receivedSignal = signalName;
        receivedData = data;
      }
    });
  }

  // Wait for any signal to be received
  const waitOptions: WaitOptions<T> = {};
  if (timeout !== undefined) {
    waitOptions.timeout = timeout;
  }
  const result = await waitForCondition(
    () => receivedSignal !== null,
    () => receivedData,
    waitOptions
  );

  if (receivedSignal === null) {
    return null;
  }

  return { signalName: receivedSignal, data: result as T };
}

/**
 * Create a signal handler that accumulates multiple signals into an array.
 *
 * @typeParam T - The type of signal data
 * @param signal - The signal to handle
 * @returns Object with the signals array and a getter function
 *
 * @example
 * const votes = createSignalAccumulator(voteSignal);
 *
 * // Wait for 3 votes or 5 minutes
 * await workflow.condition(() => votes.get().length >= 3, 5 * 60 * 1000);
 *
 * console.log('Received votes:', votes.get());
 */
export function createSignalAccumulator<T>(
  signal: workflow.SignalDefinition<[T]>
): {
  get: () => T[];
  clear: () => void;
} {
  const accumulated: T[] = [];

  workflow.setHandler(signal, (data: T) => {
    accumulated.push(data);
  });

  return {
    get: () => [...accumulated],
    clear: () => {
      accumulated.length = 0;
    },
  };
}

/**
 * Create a simple state machine driven by signals.
 *
 * @typeParam TState - Union type of possible states
 * @typeParam TSignal - Union type of signal data that can trigger transitions
 * @param initialState - The starting state
 * @param transitions - Map of state -> signal event -> next state
 * @param signal - The signal to listen for
 * @returns Object with current state getter and await methods
 *
 * @example
 * type State = 'pending' | 'approved' | 'rejected';
 * type Event = { event: 'approve' } | { event: 'reject' };
 *
 * const sm = createSignalStateMachine<State, Event>(
 *   'pending',
 *   {
 *     pending: {
 *       approve: 'approved',
 *       reject: 'rejected',
 *     },
 *   },
 *   approvalSignal
 * );
 *
 * // Wait for terminal state
 * await sm.waitFor(['approved', 'rejected']);
 * console.log('Final state:', sm.getState());
 */
export function createSignalStateMachine<
  TState extends string,
  TSignal extends { event: string }
>(
  initialState: TState,
  transitions: Partial<Record<TState, Partial<Record<string, TState>>>>,
  signal: workflow.SignalDefinition<[TSignal]>
): {
  getState: () => TState;
  waitFor: (states: TState[], timeout?: Duration) => Promise<TState | null>;
} {
  let currentState: TState = initialState;

  workflow.setHandler(signal, (data: TSignal) => {
    const stateTransitions = transitions[currentState];
    if (stateTransitions) {
      const nextState = stateTransitions[data.event];
      if (nextState !== undefined) {
        currentState = nextState;
      }
    }
  });

  return {
    getState: () => currentState,
    async waitFor(states: TState[], timeout?: Duration): Promise<TState | null> {
      const waitOptions: WaitOptions<TState> = {};
      if (timeout !== undefined) {
        waitOptions.timeout = timeout;
      }
      const result = await waitForCondition(
        () => states.includes(currentState),
        () => currentState,
        waitOptions
      );
      return result;
    },
  };
}

// =============================================================================
// Query Definitions
// =============================================================================

/**
 * Query to get the current workflow state.
 */
export const getState = workflow.defineQuery<Record<string, unknown>>('getState');

/**
 * Query to get the list of pending tasks in the workflow.
 */
export const getPendingTasks = workflow.defineQuery<string[]>('getPendingTasks');

/**
 * Query to check if the workflow is waiting for a specific signal.
 */
export const isWaitingFor = workflow.defineQuery<boolean, [string]>('isWaitingFor');
