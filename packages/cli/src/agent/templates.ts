/**
 * Workflow Templates for Agent
 *
 * Pre-built templates that the agent can use as starting points for workflows.
 */

import { toPascalCase, toCamelCase } from '../utils/fs.js';

/**
 * Simple workflow template - basic workflow without human tasks
 */
export function simpleWorkflowTemplate(name: string, description?: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const desc = description || `${name.replace(/-/g, ' ')} workflow`;

  return `/**
 * ${pascalName} Workflow
 *
 * ${desc}
 */

import { workflow, type WorkflowContext } from '@orkestra/sdk';

// Input type for this workflow
export interface ${pascalName}Input {
  // Define your input parameters here
}

// Output type for this workflow
export interface ${pascalName}Output {
  success: boolean;
  message: string;
}

/**
 * ${pascalName} workflow implementation
 */
export const ${camelName}Workflow = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx: WorkflowContext, input: ${pascalName}Input) => {
    ctx.log.info('Starting ${name} workflow');

    // TODO: Implement your workflow logic here

    ctx.log.info('Completed ${name} workflow');
    return {
      success: true,
      message: 'Workflow completed successfully',
    };
  }
);
`;
}

/**
 * Task workflow template - workflow with a single human task
 */
export function taskWorkflowTemplate(
  name: string,
  options: {
    description?: string;
    taskTitle?: string;
    formFields?: Array<{ name: string; type: string; required?: boolean }>;
    assignTo?: { group?: string; user?: string };
    sla?: string;
  } = {}
): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const desc = options.description || `${name.replace(/-/g, ' ')} workflow with human task`;
  const taskTitle = options.taskTitle || `${pascalName} Review`;

  // Generate form fields
  const formFields = options.formFields || [
    { name: 'approved', type: 'boolean', required: true },
    { name: 'comments', type: 'textarea', required: false },
  ];

  const formSchemaLines = formFields.map((field) => {
    const opts: string[] = [`type: '${field.type}'`];
    if (field.required !== undefined) {
      opts.push(`required: ${field.required}`);
    }
    return `      ${field.name}: { ${opts.join(', ')} },`;
  });

  // Generate assignment
  const assignTo = options.assignTo || { group: 'reviewers' };
  const assignToStr = assignTo.user
    ? `{ user: '${assignTo.user}' }`
    : `{ group: '${assignTo.group}' }`;

  // Generate SLA
  const slaLine = options.sla
    ? `\n      sla: timeout('${options.sla}'),`
    : '';
  const slaImport = options.sla ? ', timeout' : '';

  // Generate form data type
  const formDataType = formFields
    .map((f) => {
      const tsType = getTypeScriptType(f.type);
      const optional = f.required ? '' : '?';
      return `  ${f.name}${optional}: ${tsType};`;
    })
    .join('\n');

  return `/**
 * ${pascalName} Workflow
 *
 * ${desc}
 */

import { workflow, task${slaImport}, type WorkflowContext } from '@orkestra/sdk';

// Input type for this workflow
export interface ${pascalName}Input {
  // Define your input parameters here
  requestId: string;
  context?: Record<string, unknown>;
}

// Output type for this workflow
export interface ${pascalName}Output {
  success: boolean;
  result: ${pascalName}FormData;
  completedBy: string;
}

// Form data type
export interface ${pascalName}FormData {
${formDataType}
}

/**
 * ${pascalName} workflow implementation
 */
export const ${camelName}Workflow = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx: WorkflowContext, input: ${pascalName}Input) => {
    ctx.log.info('Starting ${name} workflow', { requestId: input.requestId });

    // Create human task and wait for completion
    const taskResult = await task<${pascalName}FormData>(ctx, {
      title: '${taskTitle}',
      description: 'Please review and complete this task.',
      form: {
${formSchemaLines.join('\n')}
      },
      assignTo: ${assignToStr},
      context: input.context,${slaLine}
    });

    ctx.log.info('Task completed', {
      taskId: taskResult.taskId,
      completedBy: taskResult.completedBy,
    });

    return {
      success: true,
      result: taskResult.data,
      completedBy: taskResult.completedBy,
    };
  }
);
`;
}

/**
 * Escalation workflow template - workflow with escalation chain
 */
export function escalationWorkflowTemplate(
  name: string,
  options: {
    description?: string;
    taskTitle?: string;
    tiers?: string[];
    escalationInterval?: string;
  } = {}
): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const desc = options.description || `${name.replace(/-/g, ' ')} workflow with escalation`;
  const taskTitle = options.taskTitle || `${pascalName} - Urgent Review`;
  const tiers = options.tiers || ['support-l1', 'support-l2', 'managers'];
  const interval = options.escalationInterval || '30m';

  // Generate escalation chain
  const escalationSteps = tiers.slice(1).map((tier, idx) => {
    const time = calculateEscalationTime(interval, idx + 1);
    return `      { after: '${time}', action: 'escalate' as const, target: { group: '${tier}' } },`;
  });

  return `/**
 * ${pascalName} Workflow with Escalation
 *
 * ${desc}
 */

import {
  workflow,
  taskWithEscalation,
  type WorkflowContext,
} from '@orkestra/sdk';

// Input type for this workflow
export interface ${pascalName}Input {
  requestId: string;
  urgency: 'low' | 'medium' | 'high';
  context?: Record<string, unknown>;
}

// Output type for this workflow
export interface ${pascalName}Output {
  success: boolean;
  resolution: string;
  completedBy: string;
  escalationLevel: number;
}

// Form data type
export interface ${pascalName}FormData {
  resolution: string;
  additionalNotes?: string;
}

/**
 * ${pascalName} workflow with escalation chain
 */
export const ${camelName}Workflow = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx: WorkflowContext, input: ${pascalName}Input) => {
    ctx.log.info('Starting ${name} workflow with escalation', {
      requestId: input.requestId,
      urgency: input.urgency,
    });

    // Create task with escalation chain
    const taskResult = await taskWithEscalation<${pascalName}FormData>(ctx, {
      title: '${taskTitle}',
      description: 'This request requires review. Will escalate if not handled.',
      form: {
        resolution: { type: 'textarea', required: true },
        additionalNotes: { type: 'textarea', required: false },
      },
      assignTo: { group: '${tiers[0]}' },
      priority: input.urgency === 'high' ? 'urgent' : input.urgency,
      context: input.context,
      escalation: {
        steps: [
          { after: '15m', action: 'notify' as const, message: 'Task pending review' },
${escalationSteps.join('\n')}
        ],
      },
    });

    ctx.log.info('Escalation workflow completed', {
      taskId: taskResult.taskId,
      completedBy: taskResult.completedBy,
    });

    return {
      success: true,
      resolution: taskResult.data.resolution,
      completedBy: taskResult.completedBy,
      escalationLevel: 0, // Could track actual escalation level
    };
  }
);
`;
}

/**
 * Multi-task workflow template - workflow with multiple parallel or sequential tasks
 */
export function multiTaskWorkflowTemplate(
  name: string,
  options: {
    description?: string;
    tasks?: Array<{ title: string; group: string }>;
    parallel?: boolean;
  } = {}
): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const desc = options.description || `${name.replace(/-/g, ' ')} workflow with multiple tasks`;
  const tasks = options.tasks || [
    { title: 'Legal Review', group: 'legal' },
    { title: 'Finance Review', group: 'finance' },
  ];
  const parallel = options.parallel ?? true;

  // taskImport is used in the template string generation
  const taskImport = parallel ? 'allTasks' : 'task';

  if (parallel) {
    const taskConfigs = tasks
      .map(
        (t) => `        {
          title: '${t.title}',
          form: {
            approved: { type: 'boolean', required: true },
            notes: { type: 'textarea' },
          },
          assignTo: { group: '${t.group}' },
        },`
      )
      .join('\n');

    return `/**
 * ${pascalName} Workflow - Multi-Task
 *
 * ${desc}
 */

import { workflow, ${taskImport}, timeout, type WorkflowContext } from '@orkestra/sdk';

// Input type for this workflow
export interface ${pascalName}Input {
  requestId: string;
  context?: Record<string, unknown>;
}

// Output type for this workflow
export interface ${pascalName}Output {
  success: boolean;
  allApproved: boolean;
  results: Array<{ approved: boolean; notes?: string }>;
}

// Form data type
export interface ReviewFormData {
  approved: boolean;
  notes?: string;
}

/**
 * ${pascalName} workflow with parallel tasks
 */
export const ${camelName}Workflow = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx: WorkflowContext, input: ${pascalName}Input) => {
    ctx.log.info('Starting ${name} multi-task workflow', {
      requestId: input.requestId,
    });

    // Create all tasks in parallel and wait for all to complete
    const results = await allTasks<ReviewFormData>(ctx, {
      tasks: [
${taskConfigs}
      ],
      sla: { deadline: '2h', onBreach: 'notify' },
    });

    const allApproved = results.every((r) => r.data.approved);

    ctx.log.info('All tasks completed', {
      taskCount: results.length,
      allApproved,
    });

    return {
      success: true,
      allApproved,
      results: results.map((r) => ({
        approved: r.data.approved,
        notes: r.data.notes,
      })),
    };
  }
);
`;
  } else {
    // Sequential tasks
    const taskBlocks = tasks
      .map(
        (t, idx) => `
    // Task ${idx + 1}: ${t.title}
    ctx.log.info('Creating task: ${t.title}');
    const result${idx + 1} = await task<ReviewFormData>(ctx, {
      title: '${t.title}',
      form: {
        approved: { type: 'boolean', required: true },
        notes: { type: 'textarea' },
      },
      assignTo: { group: '${t.group}' },
      context: input.context,
    });

    if (!result${idx + 1}.data.approved) {
      ctx.log.warn('Task ${idx + 1} rejected', { task: '${t.title}' });
      return {
        success: false,
        allApproved: false,
        results: [{ approved: false, notes: result${idx + 1}.data.notes }],
      };
    }
`
      )
      .join('\n');

    return `/**
 * ${pascalName} Workflow - Sequential Tasks
 *
 * ${desc}
 */

import { workflow, task, type WorkflowContext } from '@orkestra/sdk';

// Input type for this workflow
export interface ${pascalName}Input {
  requestId: string;
  context?: Record<string, unknown>;
}

// Output type for this workflow
export interface ${pascalName}Output {
  success: boolean;
  allApproved: boolean;
  results: Array<{ approved: boolean; notes?: string }>;
}

// Form data type
export interface ReviewFormData {
  approved: boolean;
  notes?: string;
}

/**
 * ${pascalName} workflow with sequential tasks
 */
export const ${camelName}Workflow = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx: WorkflowContext, input: ${pascalName}Input) => {
    ctx.log.info('Starting ${name} sequential workflow', {
      requestId: input.requestId,
    });
${taskBlocks}
    ctx.log.info('All sequential tasks approved');

    return {
      success: true,
      allApproved: true,
      results: [${tasks.map((_, i) => `{ approved: result${i + 1}.data.approved, notes: result${i + 1}.data.notes }`).join(', ')}],
    };
  }
);
`;
  }
}

/**
 * Customer support workflow template - common pattern for AI agent + human escalation
 */
export function customerSupportTemplate(
  name: string,
  options: {
    description?: string;
    supportTiers?: string[];
    slaByTier?: Record<string, string>;
  } = {}
): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const desc = options.description || 'Customer support workflow with tier-based SLA';
  const tiers = options.supportTiers || ['support-l1', 'support-l2', 'support-l3'];
  const slaByTier = options.slaByTier || {
    basic: '2h',
    premium: '1h',
    enterprise: '30m',
  };

  const slaEntries = Object.entries(slaByTier)
    .map(([tier, sla]) => `    ${tier}: '${sla}',`)
    .join('\n');

  return `/**
 * ${pascalName} Workflow
 *
 * ${desc}
 * Supports tier-based SLAs and automatic escalation.
 */

import {
  workflow,
  taskWithEscalation,
  escalationChain,
  type WorkflowContext,
} from '@orkestra/sdk';

// Customer tiers
export type CustomerTier = ${Object.keys(slaByTier).map((t) => `'${t}'`).join(' | ')};

// SLA configuration by tier
const SLA_BY_TIER: Record<CustomerTier, string> = {
${slaEntries}
};

// Input type for this workflow
export interface ${pascalName}Input {
  ticketId: string;
  customerId: string;
  customerTier: CustomerTier;
  subject: string;
  description: string;
  conversationId?: string;
}

// Output type for this workflow
export interface ${pascalName}Output {
  ticketId: string;
  resolution: string;
  resolvedBy: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  followUpRequired: boolean;
}

// Form data type
export interface SupportFormData {
  resolution: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  followUpRequired: boolean;
  internalNotes?: string;
}

/**
 * ${pascalName} workflow
 */
export const ${camelName}Workflow = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx: WorkflowContext, input: ${pascalName}Input) => {
    const { ticketId, customerId, customerTier, subject, description } = input;

    ctx.log.info('Starting support workflow', {
      ticketId,
      customerId,
      customerTier,
    });

    // Get SLA based on customer tier
    const slaDeadline = SLA_BY_TIER[customerTier] || SLA_BY_TIER.basic;

    // Build escalation chain based on tier urgency
    const chain = escalationChain()
      .notifyAfter('15m', 'Support ticket awaiting response')
      .escalateAfter('${tiers[1] ? `30m', { group: '${tiers[1]}' }` : `30m', { group: 'managers' }`})
      .escalateAfter(slaDeadline, { group: '${tiers[2] || 'managers'}' })
      .build();

    // Create support task with escalation
    const result = await taskWithEscalation<SupportFormData>(ctx, {
      title: \`Support: \${subject}\`,
      description: \`Customer: \${customerId}\\nTier: \${customerTier}\\n\\n\${description}\`,
      form: {
        resolution: {
          type: 'textarea',
          label: 'Resolution',
          placeholder: 'Describe how you resolved this ticket...',
          required: true,
        },
        sentiment: {
          type: 'select',
          label: 'Customer Sentiment',
          required: true,
          options: [
            { value: 'positive', label: 'Positive' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'negative', label: 'Negative' },
          ],
        },
        followUpRequired: {
          type: 'boolean',
          label: 'Follow-up Required?',
          default: false,
        },
        internalNotes: {
          type: 'textarea',
          label: 'Internal Notes',
          placeholder: 'Any internal notes for the team...',
        },
      },
      assignTo: { group: '${tiers[0]}' },
      priority: customerTier === 'enterprise' ? 'urgent' : 'medium',
      context: {
        ticketId,
        customerId,
        customerTier,
      },
      conversationId: input.conversationId,
      escalation: chain,
    });

    ctx.log.info('Support ticket resolved', {
      ticketId,
      resolvedBy: result.completedBy,
      sentiment: result.data.sentiment,
    });

    return {
      ticketId,
      resolution: result.data.resolution,
      resolvedBy: result.completedBy,
      sentiment: result.data.sentiment,
      followUpRequired: result.data.followUpRequired,
    };
  }
);
`;
}

// Helper functions

function getTypeScriptType(formFieldType: string): string {
  switch (formFieldType) {
    case 'boolean':
    case 'checkbox':
      return 'boolean';
    case 'number':
      return 'number';
    case 'multiselect':
      return 'string[]';
    case 'date':
    case 'datetime':
      return 'string'; // ISO date string
    case 'json':
      return 'Record<string, unknown>';
    case 'file':
      return '{ name: string; url: string }';
    default:
      return 'string';
  }
}

function calculateEscalationTime(interval: string, multiplier: number): string {
  // Parse interval like '30m', '1h', etc.
  const match = interval.match(/^(\d+)([mhd])$/);
  if (!match || !match[1] || !match[2]) return `${multiplier * 30}m`;

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const newValue = value * multiplier;

  // Convert to larger units if appropriate
  if (unit === 'm' && newValue >= 60) {
    return `${Math.floor(newValue / 60)}h`;
  }
  if (unit === 'h' && newValue >= 24) {
    return `${Math.floor(newValue / 24)}d`;
  }

  return `${newValue}${unit}`;
}

/**
 * Get template information for the agent
 */
export const TEMPLATE_INFO = {
  simple: {
    name: 'Simple Workflow',
    description: 'Basic workflow without human tasks - good for automated processes',
    function: 'simpleWorkflowTemplate',
  },
  task: {
    name: 'Task Workflow',
    description: 'Workflow with a single human task - good for approvals and reviews',
    function: 'taskWorkflowTemplate',
  },
  escalation: {
    name: 'Escalation Workflow',
    description: 'Workflow with automatic escalation chain - good for urgent requests',
    function: 'escalationWorkflowTemplate',
  },
  multiTask: {
    name: 'Multi-Task Workflow',
    description: 'Workflow with multiple parallel or sequential tasks - good for multi-party approvals',
    function: 'multiTaskWorkflowTemplate',
  },
  customerSupport: {
    name: 'Customer Support Workflow',
    description: 'Full customer support workflow with tier-based SLAs - common AI agent pattern',
    function: 'customerSupportTemplate',
  },
};
