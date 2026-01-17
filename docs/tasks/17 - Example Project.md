# Task 17: Example Project - Support Bot

## Overview

Build a complete example project demonstrating Orkestra's capabilities: a WhatsApp-style support bot with human escalation.

## Phase

🟣 **Phase 6: Examples**

## Priority

🟡 **High** - Critical for demonstrating value

## Estimated Effort

8-10 hours

## Description

Create a fully functional example that shows how to build an AI support bot that can escalate to humans when needed. This serves as both documentation and a starting template.

## Requirements

### Project Structure

```
examples/support-bot/
├── src/
│   ├── server.ts              # Main entry point
│   ├── worker.ts              # Temporal worker
│   ├── workflows/
│   │   ├── support-conversation.ts
│   │   └── customer-escalation.ts
│   ├── activities/
│   │   ├── ai.ts              # AI response generation
│   │   ├── messaging.ts       # Message sending
│   │   └── customer.ts        # Customer lookup
│   ├── routes/
│   │   ├── webhook.ts         # Incoming message webhook
│   │   └── health.ts
│   └── lib/
│       ├── ai-client.ts
│       └── message-client.ts
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Support Conversation Workflow

```typescript
// workflows/support-conversation.ts
import { workflow, task, timeout } from '@orkestra/sdk';
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  generateAIResponse,
  sendMessage,
  lookupCustomer,
  getConversationContext,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
});

interface ConversationInput {
  conversationId: string;
  customerId: string;
  message: string;
  channel: 'whatsapp' | 'web';
}

interface ConversationOutput {
  response: string;
  handledBy: 'ai' | 'human';
  escalated: boolean;
}

export const supportConversation = workflow<ConversationInput, ConversationOutput>(
  'support-conversation',
  async (ctx, input) => {
    const { conversationId, customerId, message, channel } = input;

    ctx.log.info('Processing support message', { conversationId, customerId });

    // 1. Get customer info and conversation history
    const [customer, history] = await Promise.all([
      lookupCustomer(customerId),
      getConversationContext(conversationId),
    ]);

    // 2. Try AI response first
    const aiResult = await generateAIResponse({
      message,
      history,
      customer,
    });

    // 3. Check if AI can handle it
    if (aiResult.confidence >= 0.8 && !aiResult.needsHuman) {
      // AI can handle - send response
      await sendMessage({
        conversationId,
        channel,
        content: aiResult.response,
        sender: 'assistant',
      });

      return {
        response: aiResult.response,
        handledBy: 'ai',
        escalated: false,
      };
    }

    // 4. AI can't handle - escalate to human
    ctx.log.info('Escalating to human', {
      confidence: aiResult.confidence,
      reason: aiResult.escalationReason,
    });

    // Determine priority based on customer tier
    const slaMinutes = customer.tier === 'enterprise' ? 10 :
                       customer.tier === 'premium' ? 30 : 60;

    // Create task for human agent
    const humanResult = await task<{
      response: string;
      category: string;
      sentiment: string;
    }>(ctx, {
      title: `Support: ${aiResult.escalationReason ?? 'Customer needs help'}`,
      description: `Customer message: "${message}"`,
      form: {
        response: {
          type: 'textarea',
          label: 'Your response to the customer',
          required: true,
        },
        category: {
          type: 'select',
          label: 'Issue category',
          options: [
            { value: 'billing', label: 'Billing' },
            { value: 'technical', label: 'Technical' },
            { value: 'account', label: 'Account' },
            { value: 'other', label: 'Other' },
          ],
          required: true,
        },
        sentiment: {
          type: 'select',
          label: 'Customer sentiment',
          options: [
            { value: 'positive', label: 'Positive' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'frustrated', label: 'Frustrated' },
            { value: 'angry', label: 'Angry' },
          ],
          required: true,
        },
      },
      assignTo: { group: `support-${customer.tier}` },
      context: {
        customerId,
        customerName: customer.name,
        customerTier: customer.tier,
        lastMessages: history.slice(-5),
        aiSuggestion: aiResult.response,
      },
      conversationId,
      sla: timeout(`${slaMinutes}m`),
    });

    // 5. Send human's response
    await sendMessage({
      conversationId,
      channel,
      content: humanResult.data.response,
      sender: 'human',
      metadata: {
        agentId: humanResult.completedBy,
        category: humanResult.data.category,
      },
    });

    return {
      response: humanResult.data.response,
      handledBy: 'human',
      escalated: true,
    };
  }
);
```

### AI Activities

```typescript
// activities/ai.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface GenerateResponseInput {
  message: string;
  history: Message[];
  customer: Customer;
}

interface GenerateResponseOutput {
  response: string;
  confidence: number;
  needsHuman: boolean;
  escalationReason?: string;
}

export async function generateAIResponse(
  input: GenerateResponseInput
): Promise<GenerateResponseOutput> {
  const { message, history, customer } = input;

  const systemPrompt = `You are a helpful customer support assistant for [Company Name].

Customer Info:
- Name: ${customer.name}
- Account Tier: ${customer.tier}
- Account Since: ${customer.createdAt}

Guidelines:
1. Be friendly and professional
2. If you're not sure about something, say so
3. For billing, refunds, or account changes, always escalate to a human
4. For technical issues you can't diagnose, escalate to a human

After your response, rate your confidence (0-1) and whether a human should review.`;

  const messages = [
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  // Parse response and confidence
  const content = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // Simple heuristics for escalation
  const needsHuman =
    content.toLowerCase().includes("i'm not sure") ||
    content.toLowerCase().includes("let me connect you") ||
    content.toLowerCase().includes("billing") ||
    content.toLowerCase().includes("refund");

  const confidence = needsHuman ? 0.5 : 0.9;

  return {
    response: content,
    confidence,
    needsHuman,
    escalationReason: needsHuman ? 'Requires human judgment' : undefined,
  };
}
```

### Webhook Handler

```typescript
// routes/webhook.ts
import { Router } from 'express';
import { Client } from '@temporalio/client';

const router = Router();

export function createWebhookRouter(temporalClient: Client) {
  // Handle incoming messages (from WhatsApp, web chat, etc.)
  router.post('/message', async (req, res) => {
    const { conversationId, customerId, message, channel } = req.body;

    try {
      // Start or signal the conversation workflow
      const workflowId = `support-${conversationId}`;

      const handle = await temporalClient.workflow.start('support-conversation', {
        taskQueue: 'support-bot',
        workflowId,
        args: [{ conversationId, customerId, message, channel }],
      });

      res.json({
        success: true,
        workflowId: handle.workflowId,
      });
    } catch (error) {
      console.error('Failed to process message:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  return router;
}
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  support-bot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://orkestra:orkestra@postgres:5432/support_bot
      - TEMPORAL_ADDRESS=temporal:7233
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - postgres
      - temporal

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: orkestra
      POSTGRES_PASSWORD: orkestra
      POSTGRES_DB: support_bot
    volumes:
      - postgres_data:/var/lib/postgresql/data

  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"

  temporal-ui:
    image: temporalio/ui:latest
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233

  dashboard:
    image: orkestra/dashboard:latest
    ports:
      - "3001:3000"
    environment:
      - ORKESTRA_API_URL=http://support-bot:3000

volumes:
  postgres_data:
```

### README

```markdown
# Support Bot Example

A complete example of an AI-powered support bot built with Orkestra.

## Features

- AI-first response generation using Claude
- Automatic escalation when AI confidence is low
- Human-in-the-loop for complex issues
- SLA-based escalation chains
- Multi-tier customer support (basic, premium, enterprise)
- Full conversation context for human agents

## Architecture

\`\`\`
Customer Message
       │
       ▼
┌─────────────────┐
│  Webhook API    │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│   Temporal      │
│   Workflow      │
└─────────────────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  AI Response    │  │  Human Task     │
│  (Claude)       │  │  (Dashboard)    │
└─────────────────┘  └─────────────────┘
       │                  │
       └──────────────────┘
                │
                ▼
┌─────────────────┐
│  Send Response  │
└─────────────────┘
\`\`\`

## Quick Start

1. Clone and install:
   \`\`\`bash
   git clone https://github.com/orkestra/examples
   cd examples/support-bot
   pnpm install
   \`\`\`

2. Set up environment:
   \`\`\`bash
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY
   \`\`\`

3. Start services:
   \`\`\`bash
   docker-compose up -d
   \`\`\`

4. Test it:
   \`\`\`bash
   curl -X POST http://localhost:3000/webhook/message \
     -H "Content-Type: application/json" \
     -d '{
       "conversationId": "test-123",
       "customerId": "cust-abc",
       "message": "I need help with my order",
       "channel": "web"
     }'
   \`\`\`

5. Open Dashboard at http://localhost:3001 to see human tasks

## Customization

### Adjusting AI Behavior

Edit \`src/activities/ai.ts\` to customize:
- System prompt
- Confidence thresholds
- Escalation triggers

### Changing SLA Times

Edit \`src/workflows/support-conversation.ts\`:
\`\`\`typescript
const slaMinutes = customer.tier === 'enterprise' ? 10 :
                   customer.tier === 'premium' ? 30 : 60;
\`\`\`

### Adding Channels

The bot supports multiple channels. Add new channel handlers in \`src/activities/messaging.ts\`.
\`\`\`
```

## Acceptance Criteria

- [ ] Project scaffolded and builds
- [ ] Workflow handles AI-first response
- [ ] Escalation to human works
- [ ] Task creation with context works
- [ ] Task completion resumes workflow
- [ ] Response sent back to customer
- [ ] Docker Compose starts all services
- [ ] README documents setup and usage
- [ ] Environment variables documented
- [ ] Works end-to-end

## Dependencies

- [[07 - SDK Workflow Helpers]]
- [[08 - MCP Server]]
- [[13 - CLI Tool]]
- [[16 - Release Preparation]]

## Blocked By

- [[07 - SDK Workflow Helpers]]

## Blocks

None - this is an example

## Technical Notes

### Message Simulator

Include a simple script to simulate incoming messages:

```typescript
// scripts/simulate.ts
const messages = [
  "Hi, I need help with my order",
  "It hasn't arrived yet",
  "I want a refund", // Should escalate
  "Thanks for your help!",
];

for (const message of messages) {
  await fetch('http://localhost:3000/webhook/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: 'test-123',
      customerId: 'cust-abc',
      message,
      channel: 'web',
    }),
  });
  await sleep(2000);
}
```

## References

- [Claude API](https://docs.anthropic.com/)
- [[Architecture]]
- [[07 - SDK Workflow Helpers]]

## Tags

#orkestra #task #example #support-bot #ai
