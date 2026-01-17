/**
 * Activities Index
 *
 * Export all activities for registration with the Temporal worker.
 */

// AI activities
export { generateAIResponse, type GenerateAIResponseInput, type AIResponse } from './ai.js';

// Messaging activities
export {
  sendMessage,
  logConversationEvent,
  type SendMessageInput,
  type SendMessageResult,
  type LogConversationEventInput,
} from './messaging.js';

// Customer activities
export {
  lookupCustomer,
  getConversationContext,
  type CustomerInfo,
  type ConversationContext,
} from './customer.js';
