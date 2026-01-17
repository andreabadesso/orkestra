/**
 * Support Conversation Workflow
 *
 * This workflow demonstrates the AI-first with human escalation pattern:
 * 1. Receives a customer message
 * 2. Tries to generate an AI response
 * 3. If AI confidence is low (< 0.8) or needs human review, creates a human task
 * 4. Waits for human response via signal
 * 5. Sends the response back to the customer
 */

import * as workflow from '@temporalio/workflow';
import {
  workflow as defineWorkflow,
  task,
  timeout,
  taskWithEscalation,
  escalationChain,
  type WorkflowContext,
} from '@orkestra/sdk';

// Import activity types
import type * as activities from '../activities/index.js';

// Proxy activities for use in workflows
const {
  generateAIResponse,
  sendMessage,
  lookupCustomer,
  getConversationContext,
  logConversationEvent,
} = workflow.proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2,
  },
});

// ============================================================================
// Types
// ============================================================================

/**
 * Input for the support conversation workflow
 */
export interface SupportConversationInput {
  /** The customer's message */
  message: string;
  /** Unique conversation identifier */
  conversationId: string;
  /** Customer identifier */
  customerId: string;
  /** Communication channel (e.g., 'chat', 'email', 'slack') */
  channel: 'chat' | 'email' | 'slack';
}

/**
 * Output from the support conversation workflow
 */
export interface SupportConversationOutput {
  /** The response sent to the customer */
  response: string;
  /** Who handled the request */
  resolvedBy: 'ai' | 'human';
  /** User ID if handled by human */
  handledBy?: string;
  /** Customer tier */
  customerTier?: string;
  /** AI confidence score (if AI attempted) */
  aiConfidence?: number;
}

/**
 * Customer information
 */
interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  tier: 'basic' | 'premium' | 'enterprise';
  preferredLanguage: string;
}

/**
 * AI response result
 */
interface AIResponseResult {
  response: string;
  confidence: number;
  needsHumanReview: boolean;
  suggestedCategory?: string;
}

// ============================================================================
// Workflow Definition
// ============================================================================

/** AI confidence threshold - below this, escalate to human */
const AI_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Support conversation workflow.
 *
 * This workflow implements the AI-first, human-fallback pattern:
 * - AI generates a response first
 * - If confidence is high, sends directly
 * - If confidence is low or human review needed, creates a task
 * - Human completes the task, workflow resumes and sends response
 */
export const supportConversation = defineWorkflow<
  SupportConversationInput,
  SupportConversationOutput
>('support-conversation', async (ctx: WorkflowContext, input: SupportConversationInput) => {
  const { message, conversationId, customerId, channel } = input;

  ctx.log.info('Support conversation started', {
    conversationId,
    customerId,
    channel,
    messageLength: message.length,
  });

  // Step 1: Look up customer information
  const customer = await lookupCustomer(customerId);
  ctx.log.info('Customer lookup complete', {
    customerId,
    tier: customer.tier,
    name: customer.name,
  });

  // Step 2: Get conversation context (history)
  const conversationHistory = await getConversationContext(conversationId);
  ctx.log.info('Conversation context loaded', {
    conversationId,
    historyLength: conversationHistory.messages.length,
  });

  // Step 3: Try AI response first
  ctx.log.info('Attempting AI response generation');
  const aiResult = await generateAIResponse({
    message,
    conversationHistory: conversationHistory.messages,
    customerTier: customer.tier,
    customerName: customer.name,
  });

  ctx.log.info('AI response generated', {
    confidence: aiResult.confidence,
    needsHumanReview: aiResult.needsHumanReview,
    suggestedCategory: aiResult.suggestedCategory,
  });

  // Step 4: Decide if human intervention is needed
  const needsHuman =
    aiResult.confidence < AI_CONFIDENCE_THRESHOLD || aiResult.needsHumanReview;

  let finalResponse: string;
  let resolvedBy: 'ai' | 'human';
  let handledBy: string | undefined;

  if (!needsHuman) {
    // AI handled it successfully
    ctx.log.info('AI response accepted', { confidence: aiResult.confidence });
    finalResponse = aiResult.response;
    resolvedBy = 'ai';

    await logConversationEvent({
      conversationId,
      event: 'ai_response',
      data: {
        confidence: aiResult.confidence,
        category: aiResult.suggestedCategory,
      },
    });
  } else {
    // Human intervention needed
    ctx.log.info('Escalating to human', {
      reason: aiResult.needsHumanReview ? 'human_review_flag' : 'low_confidence',
      confidence: aiResult.confidence,
    });

    await logConversationEvent({
      conversationId,
      event: 'escalated_to_human',
      data: {
        reason: aiResult.needsHumanReview ? 'human_review_flag' : 'low_confidence',
        confidence: aiResult.confidence,
        suggestedCategory: aiResult.suggestedCategory,
      },
    });

    // Create human task with tier-based SLA
    const slaMinutes = getSLAForTier(customer.tier);

    // Use taskWithEscalation for tiered support
    const taskResult = await taskWithEscalation(ctx, {
      title: `Customer Support: ${customer.name}`,
      description: buildTaskDescription(message, aiResult, customer),
      form: {
        response: {
          type: 'textarea',
          label: 'Your Response',
          required: true,
          placeholder: 'Enter your response to the customer...',
          helpText: 'This will be sent directly to the customer.',
        },
        sentiment: {
          type: 'select',
          label: 'Customer Sentiment',
          options: [
            { value: 'positive', label: 'Positive' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'frustrated', label: 'Frustrated' },
            { value: 'angry', label: 'Angry' },
          ],
        },
        category: {
          type: 'select',
          label: 'Issue Category',
          options: [
            { value: 'billing', label: 'Billing' },
            { value: 'technical', label: 'Technical Issue' },
            { value: 'feature_request', label: 'Feature Request' },
            { value: 'general', label: 'General Inquiry' },
            { value: 'complaint', label: 'Complaint' },
          ],
          default: aiResult.suggestedCategory || 'general',
        },
        useAISuggestion: {
          type: 'boolean',
          label: 'Use AI Suggested Response',
          default: false,
          helpText: 'Check to use the AI-suggested response as a starting point.',
        },
      },
      assignTo: { group: getSupportGroup(customer.tier) },
      context: {
        conversationId,
        customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerTier: customer.tier,
        channel,
        originalMessage: message,
        aiSuggestedResponse: aiResult.response,
        aiConfidence: aiResult.confidence,
        conversationHistory: conversationHistory.messages.slice(-5), // Last 5 messages
      },
      conversationId,
      priority: getPriorityForTier(customer.tier),
      type: 'support-response',
      escalation: escalationChain()
        .notifyAfter(`${Math.floor(slaMinutes * 0.5)}m`, 'Task approaching SLA deadline')
        .escalateAfter(`${slaMinutes}m`, { group: getEscalationGroup(customer.tier) })
        .build(),
    });

    ctx.log.info('Human task completed', {
      taskId: taskResult.taskId,
      completedBy: taskResult.completedBy,
    });

    // Extract the response
    const taskData = taskResult.data as {
      response: string;
      sentiment?: string;
      category?: string;
      useAISuggestion?: boolean;
    };

    finalResponse = taskData.useAISuggestion ? aiResult.response : taskData.response;
    resolvedBy = 'human';
    handledBy = taskResult.completedBy;

    await logConversationEvent({
      conversationId,
      event: 'human_response',
      data: {
        handledBy,
        sentiment: taskData.sentiment,
        category: taskData.category,
        usedAISuggestion: taskData.useAISuggestion,
      },
    });
  }

  // Step 5: Send the response
  ctx.log.info('Sending response to customer', {
    channel,
    resolvedBy,
    responseLength: finalResponse.length,
  });

  await sendMessage({
    conversationId,
    customerId,
    channel,
    message: finalResponse,
    metadata: {
      resolvedBy,
      handledBy,
      customerTier: customer.tier,
    },
  });

  ctx.log.info('Support conversation completed', {
    conversationId,
    resolvedBy,
    handledBy,
  });

  return {
    response: finalResponse,
    resolvedBy,
    handledBy,
    customerTier: customer.tier,
    aiConfidence: aiResult.confidence,
  };
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get SLA deadline in minutes based on customer tier
 */
function getSLAForTier(tier: CustomerInfo['tier']): number {
  const slaMap: Record<CustomerInfo['tier'], number> = {
    enterprise: 10,
    premium: 30,
    basic: 60,
  };
  return slaMap[tier];
}

/**
 * Get support group based on customer tier
 */
function getSupportGroup(tier: CustomerInfo['tier']): string {
  const groupMap: Record<CustomerInfo['tier'], string> = {
    enterprise: 'support-enterprise',
    premium: 'support-premium',
    basic: 'support-l1',
  };
  return groupMap[tier];
}

/**
 * Get escalation group based on customer tier
 */
function getEscalationGroup(tier: CustomerInfo['tier']): string {
  const groupMap: Record<CustomerInfo['tier'], string> = {
    enterprise: 'support-managers',
    premium: 'support-l2',
    basic: 'support-l2',
  };
  return groupMap[tier];
}

/**
 * Get task priority based on customer tier
 */
function getPriorityForTier(tier: CustomerInfo['tier']): 'low' | 'medium' | 'high' | 'urgent' {
  const priorityMap: Record<CustomerInfo['tier'], 'low' | 'medium' | 'high' | 'urgent'> = {
    enterprise: 'urgent',
    premium: 'high',
    basic: 'medium',
  };
  return priorityMap[tier];
}

/**
 * Build a descriptive task description for human agents
 */
function buildTaskDescription(
  message: string,
  aiResult: AIResponseResult,
  customer: CustomerInfo
): string {
  const lines = [
    `**Customer:** ${customer.name} (${customer.tier} tier)`,
    `**Email:** ${customer.email}`,
    '',
    '---',
    '',
    '**Customer Message:**',
    message,
    '',
    '---',
    '',
    `**AI Analysis:**`,
    `- Confidence: ${(aiResult.confidence * 100).toFixed(0)}%`,
    `- Suggested Category: ${aiResult.suggestedCategory || 'Not determined'}`,
    `- Needs Review: ${aiResult.needsHumanReview ? 'Yes' : 'No'}`,
    '',
    '**AI Suggested Response:**',
    aiResult.response,
  ];

  return lines.join('\n');
}

// Export the workflow execute function for Temporal registration
export default supportConversation.execute;
