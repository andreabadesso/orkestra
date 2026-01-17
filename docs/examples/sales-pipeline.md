# Sales Pipeline Example

Automate lead qualification and deal progression with AI-powered scoring and human review.

## Use Case

Orkestra can orchestrate complex sales processes:

- AI scores and qualifies leads
- Sales reps review and accept/reject qualified leads
- Automated follow-ups and deal progression
- Approval for large deals
- Integration with CRM systems

## Workflow Definition

```typescript
import { workflow, task, timeout, taskWithEscalation, escalationChain } from '@orkestra/sdk';

export const salesPipeline = workflow('sales-pipeline', async (ctx, input) => {
  const { leadId, company, contact, source, dealValue } = input;

  // Step 1: AI Lead Scoring
  ctx.log.info('Scoring lead', { leadId, company, dealValue });

  const score = await scoreLead(ctx, {
    leadId,
    company,
    contact,
    source,
    dealValue,
  });

  ctx.log.info('Lead scored', { leadId, score: score.score, tier: score.tier });

  // Step 2: Determine if human review needed
  if (score.score < 50) {
    // Low quality - auto-discard
    await updateCRM(ctx, {
      leadId,
      status: 'disqualified',
      reason: 'Low score',
      score: score.score,
    });
    return { status: 'disqualified', score: score.score };
  }

  if (score.score >= 90) {
    // High quality - fast track
    return await handleHotLead(ctx, { input, score });
  }

  // Step 3: Sales rep review
  const reviewResult = await task(ctx, {
    title: `Lead Review: ${company}`,
    description: `Review and qualify lead from ${source}`,
    form: {
      decision: {
        type: 'select',
        label: 'Decision',
        options: [
          { value: 'accept', label: 'Accept & Contact' },
          { value: 'reject', label: 'Reject' },
          { value: 'nurture', label: 'Add to Nurturing' },
          { value: 'escalate', label: 'Escalate to Manager' },
        ],
        required: true,
      },
      nextAction: {
        type: 'select',
        label: 'Next Action',
        options: [
          { value: 'call', label: 'Schedule Call' },
          { value: 'email', label: 'Send Email' },
          { value: 'demo', label: 'Schedule Demo' },
          { value: 'meeting', label: 'In-Person Meeting' },
        ],
      },
      priority: {
        type: 'select',
        label: 'Priority',
        options: [
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ],
        default: score.tier === 'high' ? 'high' : 'medium',
      },
      notes: {
        type: 'textarea',
        label: 'Notes',
      },
    },
    assignTo: { group: 'sales-reps' },
    context: {
      leadId,
      company,
      contact,
      source,
      dealValue,
      aiScore: score.score,
      scoreBreakdown: score.breakdown,
      tier: score.tier,
    },
    conversationId: leadId,
    sla: timeout('24h'),
    priority: score.tier === 'high' ? 'high' : 'medium',
  });

  // Step 4: Handle decision
  if (reviewResult.data.decision === 'reject') {
    await updateCRM(ctx, {
      leadId,
      status: 'rejected',
      reason: reviewResult.data.notes,
      score: score.score,
    });
    return { status: 'rejected', stage: 'sales-review' };
  }

  if (reviewResult.data.decision === 'nurture') {
    await updateCRM(ctx, {
      leadId,
      status: 'nurturing',
      score: score.score,
    });

    await scheduleNurturingCampaign(ctx, {
      leadId,
      tier: score.tier,
    });

    return { status: 'nurturing' };
  }

  if (reviewResult.data.decision === 'escalate') {
    return await escalateLead(ctx, { input, score, notes: reviewResult.data.notes });
  }

  // Step 5: Accept and engage
  await updateCRM(ctx, {
    leadId,
    status: 'contacting',
    score: score.score,
    priority: reviewResult.data.priority,
    nextAction: reviewResult.data.nextAction,
  });

  // Step 6: Schedule next action
  if (reviewResult.data.nextAction === 'demo') {
    const demoResult = await task(ctx, {
      title: 'Schedule Demo',
      form: {
        dateTime: {
          type: 'date',
          label: 'Demo Date & Time',
          required: true,
        },
        attendees: {
          type: 'text',
          label: 'Additional Attendees',
          helpText: 'Email addresses, comma separated',
        },
        agenda: {
          type: 'textarea',
          label: 'Demo Agenda',
        },
      },
      assignTo: { userId: reviewResult.completedBy },
      context: { leadId, company, contact },
      conversationId: leadId,
      sla: timeout('48h'),
    });

    await sendCalendarInvite(ctx, {
      leadId,
      dateTime: demoResult.data.dateTime,
      attendees: demoResult.data.attendees,
      agenda: demoResult.data.agenda,
    });
  }

  if (reviewResult.data.nextAction === 'meeting') {
    await scheduleMeeting(ctx, {
      leadId,
      contact,
      company,
    });
  }

  // Step 7: Large deal approval
  if (dealValue > 100000) {
    return await handleLargeDeal(ctx, {
      leadId,
      dealValue,
      company,
      score,
      reviewResult,
    });
  }

  return {
    status: 'accepted',
    stage: 'sales-review',
    nextAction: reviewResult.data.nextAction,
    priority: reviewResult.data.priority,
  };
});

// ============================================================================
// Helper Workflows
// ============================================================================

async function handleHotLead(ctx, input) {
  const { input: leadInput, score } = input;

  // Create urgent task for senior sales rep
  const result = await task(ctx, {
    title: `🔥 HOT LEAD: ${leadInput.company}`,
    description: 'High-scoring lead requires immediate attention',
    form: {
      decision: {
        type: 'select',
        label: 'Action',
        options: [
          { value: 'call-now', label: 'Call Now' },
          { value: 'schedule-demo', label: 'Schedule Demo' },
          { value: 'escalate', label: 'Escalate to VP Sales' },
        ],
      },
      notes: { type: 'textarea', label: 'Notes' },
    },
    assignTo: { group: 'senior-sales' },
    context: {
      leadId: leadInput.leadId,
      company: leadInput.company,
      contact: leadInput.contact,
      dealValue: leadInput.dealValue,
      aiScore: score.score,
      tier: score.tier,
    },
    conversationId: leadInput.leadId,
    sla: timeout('1h'),
    priority: 'urgent',
  });

  if (result.data.decision === 'escalate') {
    return await escalateLead(ctx, { input: leadInput, score, notes: result.data.notes });
  }

  await updateCRM(ctx, {
    leadId: leadInput.leadId,
    status: 'hot-lead',
    score: score.score,
  });

  return { status: 'hot-lead', action: result.data.decision };
}

async function handleLargeDeal(ctx, input) {
  const { leadId, dealValue, company, score, reviewResult } = input;

  const approvalResult = await taskWithEscalation(ctx, {
    title: `Large Deal Approval: ${company} ($${dealValue.toLocaleString()})`,
    form: {
      decision: {
        type: 'select',
        label: 'Decision',
        options: [
          { value: 'approve', label: 'Approve' },
          { value: 'request-info', label: 'Request More Information' },
          { value: 'reject', label: 'Reject' },
        ],
        required: true,
      },
      discountLimit: {
        type: 'number',
        label: 'Maximum Discount (%)',
        default: 10,
        helpText: 'Maximum discount sales rep can offer',
      },
      terms: {
        type: 'select',
        label: 'Payment Terms',
        options: [
          { value: 'net30', label: 'Net 30' },
          { value: 'net60', label: 'Net 60' },
          { value: 'net90', label: 'Net 90' },
          { value: 'upfront', label: 'Upfront' },
        ],
      },
      notes: { type: 'textarea', label: 'Notes' },
    },
    assignTo: { group: 'sales-managers' },
    context: {
      leadId,
      company,
      dealValue,
      aiScore: score.score,
      salesRepNotes: reviewResult.data.notes,
    },
    conversationId: leadId,
    escalation: escalationChain()
      .notifyAfter('2h', 'Large deal awaiting approval')
      .escalateAfter('4h', { group: 'vp-sales' })
      .build(),
  });

  if (approvalResult.data.decision === 'reject') {
    await updateCRM(ctx, {
      leadId,
      status: 'rejected',
      reason: 'Large deal rejected by management',
    });
    return { status: 'rejected', stage: 'large-deal-approval' };
  }

  if (approvalResult.data.decision === 'request-info') {
    // Loop back to sales rep
    return await requestMoreInfo(ctx, { leadId, message: approvalResult.data.notes });
  }

  await updateCRM(ctx, {
    leadId,
    status: 'approved',
    dealValue,
    discountLimit: approvalResult.data.discountLimit,
    terms: approvalResult.data.terms,
  });

  return {
    status: 'approved',
    stage: 'large-deal',
    discountLimit: approvalResult.data.discountLimit,
    terms: approvalResult.data.terms,
  };
}

async function escalateLead(ctx, input) {
  const { input: leadInput, score, notes } = input;

  const result = await task(ctx, {
    title: `Escalated Lead: ${leadInput.company}`,
    description: notes || 'Lead requires management review',
    form: {
      decision: {
        type: 'select',
        label: 'Decision',
        options: [
          { value: 'assign-senior', label: 'Assign to Senior Rep' },
          { value: 'reassign', label: 'Reassign to Different Rep' },
          { value: 'reject', label: 'Reject Lead' },
        ],
        required: true,
      },
      assignTo: {
        type: 'select',
        label: 'Assign To',
        options: getAvailableReps(ctx),
      },
      notes: { type: 'textarea', label: 'Notes' },
    },
    assignTo: { group: 'sales-managers' },
    context: {
      leadId: leadInput.leadId,
      company: leadInput.company,
      aiScore: score.score,
      escalationReason: notes,
    },
    conversationId: leadInput.leadId,
    sla: timeout('8h'),
  });

  if (result.data.decision === 'reject') {
    await updateCRM(ctx, {
      leadId: leadInput.leadId,
      status: 'rejected',
      reason: 'Management decision',
    });
    return { status: 'rejected', stage: 'management-review' };
  }

  // Reassign lead
  await assignLead(ctx, {
    leadId: leadInput.leadId,
    assignTo: result.data.assignTo,
  });

  return { status: 'reassigned', stage: 'management-review' };
}
```

## Features Demonstrated

### AI-Powered Scoring

```typescript
const score = await scoreLead(ctx, {
  leadId,
  company,
  contact,
  source,
  dealValue,
});
```

Scoring factors include:

- Company size and revenue
- Industry fit
- Contact seniority
- Deal value
- Source quality
- Engagement signals

### Tiered Processing

```typescript
if (score.score < 50) {
  // Auto-discard
}

if (score.score >= 90) {
  // Hot lead - fast track
}

// Standard review for mid-tier leads
```

### Task Priority

```typescript
priority: score.tier === 'high' ? 'high' : 'medium',
```

Higher-scoring leads get higher priority and shorter SLAs.

### Escalation Chains

```typescript
escalation: escalationChain()
  .notifyAfter('2h', 'Large deal awaiting approval')
  .escalateAfter('4h', { group: 'vp-sales' })
  .build(),
```

### CRM Integration

```typescript
await updateCRM(ctx, {
  leadId,
  status: 'contacting',
  score: score.score,
});
```

## Task Forms

### Lead Review Form

Comprehensive form for sales rep evaluation:

```typescript
form: {
  decision: {
    type: 'select',
    options: ['accept', 'reject', 'nurture', 'escalate'],
  },
  nextAction: {
    type: 'select',
    options: ['call', 'email', 'demo', 'meeting'],
  },
  priority: {
    type: 'select',
    options: ['high', 'medium', 'low'],
  },
  notes: {
    type: 'textarea',
  },
}
```

### Large Deal Approval

Additional fields for high-value deals:

```typescript
form: {
  decision: { /* ... */ },
  discountLimit: {
    type: 'number',
    label: 'Maximum Discount (%)',
    default: 10,
  },
  terms: {
    type: 'select',
    label: 'Payment Terms',
    options: ['net30', 'net60', 'net90', 'upfront'],
  },
  notes: { type: 'textarea' },
}
```

## Key Workflows

### Hot Lead Handling

Fast-tracked for immediate attention:

- Urgent SLA (1 hour)
- Assigned to senior sales reps
- VP escalation if not handled

### Large Deal Approval

Management approval for deals > $100K:

- Sales manager review first
- VP escalation after 4 hours
- Discount and term controls

### Lead Escalation

When reps escalate to management:

- Manager reviews and decides
- Can reassign to different rep
- Can reject lead

## Best Practices

1. **AI scoring first**: Let AI filter out low-quality leads automatically
2. **Tiered processing**: Different paths for different lead scores
3. **Rich context**: Include all scoring details in tasks
4. **Fast hot leads**: Minimize friction for high-value opportunities
5. **Control large deals**: Management approval for significant deals
6. **CRM integration**: Keep everything in sync with your CRM
7. **Clear next actions**: Always define what happens after each step

## Extensions

### Add Opportunity Stage Workflow

```typescript
export const opportunityStage = workflow('opportunity-stage', async (ctx, input) => {
  const stages = ['discovery', 'demo', 'proposal', 'negotiation', 'closing'];

  for (const stage of stages) {
    const stageResult = await task(ctx, {
      title: `${stage} Stage`,
      form: getStageForm(stage),
      assignTo: { group: 'sales-reps' },
      context: { ...input, stage },
    });

    if (stageResult.data.decision === 'closed-won') {
      return { status: 'closed-won', stage };
    }

    if (stageResult.data.decision === 'closed-lost') {
      return { status: 'closed-lost', stage, reason: stageResult.data.reason };
    }
  }
});
```

### Add Competitive Intelligence

```typescript
const competitorAnalysis = await task(ctx, {
  title: 'Competitive Analysis',
  form: {
    competitor: {
      type: 'select',
      label: 'Competitor',
      options: ['Competitor A', 'Competitor B', 'Other'],
    },
    competitorOffer: {
      type: 'textarea',
      label: "Competitor's Offer",
    },
    ourAdvantage: {
      type: 'textarea',
      label: 'Our Competitive Advantage',
    },
  },
});
```

### Add Quote Generation

```typescript
const quote = await task(ctx, {
  title: 'Generate Quote',
  form: {
    lineItems: {
      type: 'complex',
      label: 'Line Items',
      schema: {
        product: { type: 'select', options: getProductList() },
        quantity: { type: 'number' },
        price: { type: 'number' },
      },
    },
    discount: { type: 'number', label: 'Discount (%)' },
    validUntil: { type: 'date', label: 'Valid Until' },
  },
});

await generatePDF(ctx, { quoteId: leadId, data: quote.data });
```

## Integration Points

- **CRM**: Salesforce, HubSpot, Pipedrive
- **Email**: Outreach, Salesloft, Reply.io
- **Calendar**: Google Calendar, Outlook
- **Video**: Zoom, Teams, Meet
- **E-signature**: DocuSign, PandaDoc
