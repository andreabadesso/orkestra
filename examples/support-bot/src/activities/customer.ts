/**
 * Customer Activities
 *
 * Mock customer data lookup for the support bot example.
 * In a real implementation, this would query your CRM or customer database.
 */

import { log } from '@temporalio/activity';

// ============================================================================
// Types
// ============================================================================

export interface CustomerInfo {
  /** Customer identifier */
  id: string;
  /** Customer name */
  name: string;
  /** Customer email */
  email: string;
  /** Customer tier */
  tier: 'basic' | 'premium' | 'enterprise';
  /** Preferred language */
  preferredLanguage: string;
  /** Account creation date */
  createdAt: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  /** Conversation identifier */
  conversationId: string;
  /** Customer identifier */
  customerId?: string;
  /** Start time of the conversation */
  startedAt: string;
  /** Conversation status */
  status: 'active' | 'waiting' | 'resolved' | 'closed';
  /** Previous messages in the conversation */
  messages: Array<{
    role: 'customer' | 'agent' | 'ai';
    content: string;
    timestamp: string;
  }>;
  /** Tags associated with the conversation */
  tags?: string[];
}

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock customer database for demo purposes.
 */
const MOCK_CUSTOMERS: Record<string, CustomerInfo> = {
  cust_001: {
    id: 'cust_001',
    name: 'Alice Johnson',
    email: 'alice@enterprise.com',
    tier: 'enterprise',
    preferredLanguage: 'en',
    createdAt: '2023-01-15T10:00:00Z',
    metadata: {
      company: 'TechCorp Inc.',
      accountManager: 'John Smith',
      annualContractValue: 50000,
    },
  },
  cust_002: {
    id: 'cust_002',
    name: 'Bob Smith',
    email: 'bob@premium.com',
    tier: 'premium',
    preferredLanguage: 'en',
    createdAt: '2023-03-20T14:30:00Z',
  },
  cust_003: {
    id: 'cust_003',
    name: 'Carol Davis',
    email: 'carol@basic.com',
    tier: 'basic',
    preferredLanguage: 'en',
    createdAt: '2023-06-10T09:15:00Z',
  },
  cust_004: {
    id: 'cust_004',
    name: 'David Lee',
    email: 'david@enterprise.com',
    tier: 'enterprise',
    preferredLanguage: 'en',
    createdAt: '2022-11-05T11:45:00Z',
    metadata: {
      company: 'Global Solutions Ltd.',
      accountManager: 'Sarah Brown',
      annualContractValue: 120000,
    },
  },
  cust_005: {
    id: 'cust_005',
    name: 'Eva Martinez',
    email: 'eva@premium.com',
    tier: 'premium',
    preferredLanguage: 'es',
    createdAt: '2023-08-22T16:00:00Z',
  },
};

/**
 * Mock conversation history database for demo purposes.
 */
const MOCK_CONVERSATIONS: Record<string, ConversationContext> = {
  conv_001: {
    conversationId: 'conv_001',
    customerId: 'cust_001',
    startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    status: 'active',
    messages: [
      {
        role: 'customer',
        content: 'Hi, I have a question about my enterprise account.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        role: 'ai',
        content: 'Hello! I\'d be happy to help with your enterprise account. What would you like to know?',
        timestamp: new Date(Date.now() - 3590000).toISOString(),
      },
      {
        role: 'customer',
        content: 'We need to add more team members. What\'s the process?',
        timestamp: new Date(Date.now() - 3580000).toISOString(),
      },
      {
        role: 'agent',
        content: 'Great question! For enterprise accounts, you can add team members through your admin dashboard. Go to Settings > Team > Invite Members.',
        timestamp: new Date(Date.now() - 3570000).toISOString(),
      },
    ],
    tags: ['enterprise', 'team-management'],
  },
  conv_002: {
    conversationId: 'conv_002',
    customerId: 'cust_002',
    startedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    status: 'waiting',
    messages: [
      {
        role: 'customer',
        content: 'I can\'t log into my account.',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        role: 'ai',
        content: 'I\'m sorry to hear you\'re having trouble logging in. Have you tried resetting your password?',
        timestamp: new Date(Date.now() - 7190000).toISOString(),
      },
    ],
    tags: ['login-issue', 'premium'],
  },
};

// ============================================================================
// Activity Implementations
// ============================================================================

/**
 * Look up customer information by ID.
 *
 * This is a mock implementation that returns data from an in-memory store.
 * In production, this would query your CRM, database, or customer service platform.
 */
export async function lookupCustomer(customerId: string): Promise<CustomerInfo> {
  log.info('Looking up customer', { customerId });

  // Simulate database latency
  await sleep(30 + Math.random() * 50);

  // Check mock database
  const customer = MOCK_CUSTOMERS[customerId];

  if (customer) {
    log.info('Customer found', {
      customerId,
      tier: customer.tier,
      name: customer.name,
    });
    return customer;
  }

  // Return a default customer for unknown IDs (for demo purposes)
  log.info('Customer not found, returning default', { customerId });
  return {
    id: customerId,
    name: `Customer ${customerId.slice(-3)}`,
    email: `${customerId}@example.com`,
    tier: 'basic',
    preferredLanguage: 'en',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get conversation context including history.
 *
 * This is a mock implementation that returns data from an in-memory store.
 * In production, this would query your conversation/ticket database.
 */
export async function getConversationContext(
  conversationId: string
): Promise<ConversationContext> {
  log.info('Getting conversation context', { conversationId });

  // Simulate database latency
  await sleep(30 + Math.random() * 50);

  // Check mock database
  const conversation = MOCK_CONVERSATIONS[conversationId];

  if (conversation) {
    log.info('Conversation found', {
      conversationId,
      messageCount: conversation.messages.length,
      status: conversation.status,
    });
    return conversation;
  }

  // Return an empty conversation for unknown IDs (for demo purposes)
  log.info('Conversation not found, returning new context', { conversationId });
  return {
    conversationId,
    startedAt: new Date().toISOString(),
    status: 'active',
    messages: [],
    tags: [],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
