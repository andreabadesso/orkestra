/**
 * AI Activities
 *
 * Mock AI response generation for the support bot example.
 * In a real implementation, this would call an LLM API like Claude or GPT.
 */

import { log } from '@temporalio/activity';

// ============================================================================
// Types
// ============================================================================

export interface GenerateAIResponseInput {
  /** The customer's message */
  message: string;
  /** Previous conversation messages */
  conversationHistory: Array<{
    role: 'customer' | 'agent' | 'ai';
    content: string;
    timestamp: string;
  }>;
  /** Customer tier for context */
  customerTier: 'basic' | 'premium' | 'enterprise';
  /** Customer name for personalization */
  customerName: string;
}

export interface AIResponse {
  /** The generated response */
  response: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether the AI thinks human review is needed */
  needsHumanReview: boolean;
  /** Suggested category for the issue */
  suggestedCategory?: string;
}

// ============================================================================
// Mock AI Knowledge Base
// ============================================================================

/**
 * Simple keyword-based response mapping for demo purposes.
 * In production, this would be replaced with actual LLM calls.
 */
const KNOWLEDGE_BASE: Record<
  string,
  { response: string; confidence: number; category: string }
> = {
  pricing: {
    response:
      'Our pricing plans start at $10/month for Basic, $25/month for Premium, and custom pricing for Enterprise. You can view full details at our pricing page.',
    confidence: 0.95,
    category: 'billing',
  },
  billing: {
    response:
      'I can help you with billing questions. For specific account issues, please provide your account email or ID so our team can assist you.',
    confidence: 0.85,
    category: 'billing',
  },
  password: {
    response:
      'To reset your password, click the "Forgot Password" link on the login page. You\'ll receive an email with instructions to create a new password.',
    confidence: 0.92,
    category: 'technical',
  },
  login: {
    response:
      'If you\'re having trouble logging in, please try: 1) Clearing your browser cache, 2) Using an incognito window, 3) Resetting your password. If the issue persists, please let us know.',
    confidence: 0.88,
    category: 'technical',
  },
  refund: {
    response:
      'I understand you\'re inquiring about a refund. Our refund policy allows full refunds within 30 days of purchase. A member of our billing team will review your request and get back to you shortly.',
    confidence: 0.75, // Lower confidence - sensitive topic
    category: 'billing',
  },
  cancel: {
    response:
      'I\'m sorry to hear you want to cancel. Before you go, would you like to speak with a team member about any issues you\'ve experienced? We may be able to help resolve them.',
    confidence: 0.7, // Lower confidence - retention opportunity
    category: 'billing',
  },
  bug: {
    response:
      'Thank you for reporting this issue. Could you please provide more details about: 1) What you were trying to do, 2) What happened instead, 3) Your browser/device. This will help our technical team investigate.',
    confidence: 0.82,
    category: 'technical',
  },
  feature: {
    response:
      'Thank you for your feature suggestion! We love hearing ideas from our users. I\'ve noted your request and it will be reviewed by our product team.',
    confidence: 0.9,
    category: 'feature_request',
  },
  hello: {
    response:
      'Hello! Welcome to our support. How can I help you today?',
    confidence: 0.98,
    category: 'general',
  },
  thanks: {
    response:
      'You\'re welcome! Is there anything else I can help you with?',
    confidence: 0.95,
    category: 'general',
  },
};

/**
 * Keywords that should trigger human review regardless of confidence
 */
const HUMAN_REVIEW_KEYWORDS = [
  'urgent',
  'emergency',
  'lawyer',
  'legal',
  'lawsuit',
  'sue',
  'media',
  'press',
  'complaint',
  'escalate',
  'manager',
  'supervisor',
  'unacceptable',
  'furious',
  'fraud',
  'scam',
];

// ============================================================================
// Activity Implementation
// ============================================================================

/**
 * Generate an AI response for a customer message.
 *
 * This is a mock implementation that uses keyword matching.
 * In production, this would call an actual LLM API.
 */
export async function generateAIResponse(
  input: GenerateAIResponseInput
): Promise<AIResponse> {
  const { message, conversationHistory, customerTier, customerName } = input;

  log.info('Generating AI response', {
    messageLength: message.length,
    historyLength: conversationHistory.length,
    customerTier,
  });

  // Simulate API latency
  await sleep(100 + Math.random() * 200);

  const lowerMessage = message.toLowerCase();

  // Check for human review keywords first
  const needsHumanReview = HUMAN_REVIEW_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  if (needsHumanReview) {
    log.info('Human review triggered by keyword');
    return {
      response: generateFallbackResponse(customerName, customerTier),
      confidence: 0.5, // Low confidence when human review is triggered
      needsHumanReview: true,
      suggestedCategory: detectCategory(lowerMessage),
    };
  }

  // Try to find a matching response from knowledge base
  for (const [keyword, data] of Object.entries(KNOWLEDGE_BASE)) {
    if (lowerMessage.includes(keyword)) {
      log.info('Found keyword match', { keyword, confidence: data.confidence });

      // Personalize the response
      const personalizedResponse = personalizeResponse(
        data.response,
        customerName,
        customerTier
      );

      return {
        response: personalizedResponse,
        confidence: data.confidence,
        needsHumanReview: false,
        suggestedCategory: data.category,
      };
    }
  }

  // No match found - return low confidence response
  log.info('No keyword match found, returning fallback');
  return {
    response: generateFallbackResponse(customerName, customerTier),
    confidence: 0.4, // Low confidence for unmatched messages
    needsHumanReview: false,
    suggestedCategory: 'general',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function personalizeResponse(
  response: string,
  customerName: string,
  customerTier: 'basic' | 'premium' | 'enterprise'
): string {
  // Add personalization based on tier
  const greeting =
    customerTier === 'enterprise'
      ? `Dear ${customerName}, thank you for being a valued Enterprise customer. `
      : customerTier === 'premium'
        ? `Hi ${customerName}, `
        : `Hi ${customerName}, `;

  return greeting + response;
}

function generateFallbackResponse(
  customerName: string,
  customerTier: 'basic' | 'premium' | 'enterprise'
): string {
  if (customerTier === 'enterprise') {
    return `Dear ${customerName}, thank you for reaching out. Your inquiry requires specialized attention from our dedicated enterprise support team. A team member will review your message and respond shortly.`;
  }

  return `Hi ${customerName}, thank you for your message. I want to make sure you get the best possible help, so I'm connecting you with one of our support specialists who can assist you further.`;
}

function detectCategory(message: string): string {
  const categoryKeywords: Record<string, string[]> = {
    billing: ['price', 'cost', 'charge', 'payment', 'invoice', 'refund', 'cancel'],
    technical: ['bug', 'error', 'broken', 'crash', 'slow', 'login', 'password'],
    feature_request: ['feature', 'wish', 'would be nice', 'suggest', 'add'],
    complaint: ['terrible', 'awful', 'worst', 'angry', 'disappointed', 'unacceptable'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => message.includes(keyword))) {
      return category;
    }
  }

  return 'general';
}
