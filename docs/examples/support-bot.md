# Support Bot Example

A complete example demonstrating the AI-first with human escalation pattern using Orkestra.

## Overview

This example implements a customer support bot that:

1. **Receives customer messages** via a webhook endpoint
2. **Attempts AI response first** using a mock AI service
3. **Escalates to humans** when:
   - AI confidence is below 80%
   - The AI flags the message for human review
   - Keywords indicating urgency or sensitivity are detected
4. **Waits for human response** via Orkestra's task system
5. **Sends the response** back to the customer

## Architecture

```
                    ┌─────────────────┐
                    │   Customer      │
                    │   (Chat/Email)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Webhook Server │
                    │  (Express.js)   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Temporal Server │
                    └────────┬────────┘
                             │
                             ▼
          ┌──────────────────────────────────┐
          │     Support Conversation         │
          │          Workflow                │
          │                                  │
          │  ┌──────────────────────────┐   │
          │  │ 1. Lookup Customer       │   │
          │  └───────────┬──────────────┘   │
          │              ▼                   │
          │  ┌──────────────────────────┐   │
          │  │ 2. Get Conversation      │   │
          │  │    Context               │   │
          │  └───────────┬──────────────┘   │
          │              ▼                   │
          │  ┌──────────────────────────┐   │
          │  │ 3. Generate AI Response  │   │
          │  └───────────┬──────────────┘   │
          │              ▼                   │
          │     ┌────────────────┐          │
          │     │ AI Confident?  │          │
          │     └───────┬────────┘          │
          │        Yes  │  No               │
          │     ┌───────┴───────┐           │
          │     ▼               ▼           │
          │  ┌──────┐    ┌──────────────┐  │
          │  │ Send │    │ Create Human │  │
          │  │  AI  │    │    Task      │  │
          │  │Reply │    └──────┬───────┘  │
          │  └──────┘           ▼          │
          │                ┌──────────┐    │
          │                │  Wait    │    │
          │                │  for     │    │
          │                │ Signal   │    │
          │                └────┬─────┘    │
          │                     ▼          │
          │              ┌──────────────┐  │
          │              │ Send Human   │  │
          │              │   Reply      │  │
          │              └──────────────┘  │
          └──────────────────────────────────┘
```

## Project Structure

```
support-bot/
├── src/
│   ├── index.ts              # HTTP server entry point
│   ├── worker.ts             # Temporal worker
│   ├── workflows/
│   │   └── support-conversation.ts   # Main workflow
│   ├── activities/
│   │   ├── index.ts          # Activity exports
│   │   ├── ai.ts             # Mock AI response generation
│   │   ├── messaging.ts      # Mock message sending
│   │   └── customer.ts       # Mock customer lookup
│   └── routes/
│       └── webhook.ts        # Webhook HTTP routes
├── temporal-config/          # Temporal dynamic config
├── docker-compose.yml        # Local dev infrastructure
├── package.json
├── tsconfig.json
└── README.md
```

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- pnpm (or npm/yarn)

## Quick Start

### 1. Start Infrastructure

```bash
# From the support-bot directory
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Verify Temporal is running
curl http://localhost:7233/health
```

### 2. Install Dependencies

```bash
# From the monorepo root
pnpm install
```

### 3. Build the Project

```bash
# Build all packages including support-bot
pnpm build

# Or build just the example
pnpm build --filter support-bot-example
```

### 4. Start the Application

In one terminal, start the HTTP server:

```bash
pnpm dev
# or: pnpm --filter support-bot-example dev
```

In another terminal, start the Temporal worker:

```bash
pnpm worker
# or: pnpm --filter support-bot-example worker
```

### 5. Test It

Send a test message:

```bash
# Simple greeting (AI will handle)
curl -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, I need help with pricing",
    "conversationId": "conv_001",
    "customerId": "cust_001"
  }'

# Message requiring human escalation
curl -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "This is urgent, I need to speak to a manager about a billing error",
    "conversationId": "conv_002",
    "customerId": "cust_002"
  }'
```

### 6. View Workflows in Temporal UI

Open http://localhost:8080 in your browser to see:

- Running workflows
- Workflow history
- Pending tasks
- Signal events

## Key Features

### AI-First Pattern

The workflow always tries AI first:

```typescript
const aiResult = await generateAIResponse({
  message,
  conversationHistory: conversationHistory.messages,
  customerTier: customer.tier,
  customerName: customer.name,
});

const needsHuman = aiResult.confidence < AI_CONFIDENCE_THRESHOLD || aiResult.needsHumanReview;
```

### Tier-Based SLAs

Different customer tiers get different service levels:

| Tier       | SLA        | Initial Assignment | Escalation Target |
| ---------- | ---------- | ------------------ | ----------------- |
| Enterprise | 10 minutes | support-enterprise | support-managers  |
| Premium    | 30 minutes | support-premium    | support-l2        |
| Basic      | 60 minutes | support-l1         | support-l2        |

### Escalation Chain

Automatic escalation based on SLAs:

```typescript
const taskResult = await taskWithEscalation(ctx, {
  // ... task options
  escalation: escalationChain()
    .notifyAfter(`${Math.floor(slaMinutes * 0.5)}m`, 'Task approaching SLA deadline')
    .escalateAfter(`${slaMinutes}m`, { group: getEscalationGroup(customer.tier) })
    .build(),
});
```

### Rich Task Form

Human agents get a structured form with context:

```typescript
form: {
  response: {
    type: 'textarea',
    label: 'Your Response',
    required: true,
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
  useAISuggestion: {
    type: 'boolean',
    label: 'Use AI Suggested Response',
    default: false,
  },
},
```

## Mock Data

### Customers

| ID       | Name          | Tier       |
| -------- | ------------- | ---------- |
| cust_001 | Alice Johnson | Enterprise |
| cust_002 | Bob Smith     | Premium    |
| cust_003 | Carol Davis   | Basic      |
| cust_004 | David Lee     | Enterprise |
| cust_005 | Eva Martinez  | Premium    |

### AI Knowledge Base

The mock AI responds to these keywords:

- `pricing` - Returns pricing information (95% confidence)
- `billing` - Offers billing help (85% confidence)
- `password` / `login` - Account recovery help (88-92% confidence)
- `refund` - Refund policy (75% confidence - often escalates)
- `cancel` - Retention opportunity (70% confidence - often escalates)
- `bug` - Bug report template (82% confidence)
- `feature` - Feature request acknowledgment (90% confidence)
- `hello` / `thanks` - Greetings (95-98% confidence)

### Trigger Keywords

These keywords trigger automatic human review:

- urgent, emergency
- lawyer, legal, lawsuit, sue
- media, press
- complaint, escalate
- manager, supervisor
- unacceptable, furious
- fraud, scam

## Configuration

### Environment Variables

| Variable              | Default          | Description             |
| --------------------- | ---------------- | ----------------------- |
| `PORT`                | `3000`           | HTTP server port        |
| `HOST`                | `0.0.0.0`        | HTTP server host        |
| `TEMPORAL_ADDRESS`    | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE`  | `default`        | Temporal namespace      |
| `TEMPORAL_TASK_QUEUE` | `support-bot`    | Task queue name         |

## Extending the Example

### Adding Real AI

Replace the mock AI in `src/activities/ai.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function generateAIResponse(input: GenerateAIResponseInput): Promise<AIResponse> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: input.message }],
    system: `You are a helpful customer support agent...`,
  });

  // Parse and return the response with confidence scoring
  // ...
}
```

### Adding Real Messaging

Replace the mock messaging in `src/activities/messaging.ts` with actual integrations:

- **Email**: SendGrid, Mailgun, AWS SES
- **Chat**: Intercom, Zendesk, Freshdesk
- **Slack**: Slack API webhooks

### Connecting to Real Customer Data

Replace the mock data in `src/activities/customer.ts` with:

- Database queries (PostgreSQL, MySQL)
- CRM integrations (Salesforce, HubSpot)
- Customer service platforms (Zendesk, Freshdesk)

## Troubleshooting

### Temporal Connection Failed

```
Error: Failed to connect to Temporal server
```

Make sure Temporal is running:

```bash
docker-compose ps
docker-compose logs temporal
```

### Workflow Not Found

```
Error: Workflow not found
```

Make sure the worker is running and registered with the correct task queue.

### Build Errors

```
Error: Cannot find module '@orkestra/sdk'
```

Build the workspace packages first:

```bash
pnpm build
```

## License

MIT
