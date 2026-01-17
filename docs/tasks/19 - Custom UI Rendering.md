# Task 19 - Custom UI Rendering

## Overview

Integrate [Vercel's json-render](https://github.com/vercel-labs/json-render) to enable AI agents to generate rich, dynamic interfaces for human-in-the-loop tasks in Orkestra.

**Key Concepts:**

- **Use @json-render/core and @json-render/react** directly
- **Define Orkestra-specific catalogs** for different workflow types
- **Data binding**: Components bind to task context and form data
- **Actions**: UI triggers workflow callbacks via json-render actions
- **Visibility**: Show/hide components based on data/auth/logic

---

## Why This Feature

The current `form` schema in Orkestra is limited to simple form fields (text, textarea, number, boolean, select). For complex human-in-the-loop scenarios, agents need to:

1. Generate rich visualizations (charts, tables, document comparisons)
2. Create multi-step wizards with conditional logic
3. Display context data alongside input fields
4. Provide interactive data selection tools

**Example Use Cases:**

- **Document Review**: Display document diff with approval controls
- **Data Selection**: Filterable table with row selection
- **Visual Approval**: Chart/graph visualization for human review
- **Complex Workflows**: Multi-step wizard with dynamic fields

---

## Requirements

### 1. Add json-render Dependencies

Add to `packages/sdk/package.json`:

```json
{
  "dependencies": {
    "@json-render/core": "^0.1.0",
    "@json-render/react": "^0.1.0",
    "zod": "^3.x"
  }
}
```

Add to `packages/dashboard/package.json`:

```json
{
  "dependencies": {
    "@json-render/react": "^0.1.0",
    "zod": "^3.x"
  }
}
```

### 2. Create Orkestra-Specific Catalogs

Create `packages/sdk/src/ui-catalogs.ts`:

```typescript
import { createCatalog } from '@json-render/core';
import { z } from 'zod';
import type { Catalog } from '@json-render/core';

// =============================================================================
// Simple Form Catalog
// =============================================================================
export const SimpleFormCatalog: Catalog = createCatalog({
  components: {
    Card: {
      props: z.object({
        title: z.string(),
        variant: z.enum(['default', 'outline', 'filled']).optional(),
      }),
      hasChildren: true,
    },
    TextField: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(),
        placeholder: z.string().optional(),
        required: z.boolean().optional(),
      }),
    },
    TextArea: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(),
        placeholder: z.string().optional(),
        rows: z.number().optional(),
      }),
    },
    Select: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(),
        options: z.array(
          z.object({
            value: z.string(),
            label: z.string(),
          })
        ),
      }),
    },
    Checkbox: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(),
      }),
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'secondary', 'danger']).optional(),
        action: z.any(), // ActionSchema
      }),
    },
  },
  actions: {
    complete: {
      description: 'Complete and submit the task',
      params: z.object({}),
    },
    cancel: {
      description: 'Cancel the task',
      params: z.object({
        reason: z.string(),
      }),
    },
  },
});

// =============================================================================
// Approval Workflow Catalog
// =============================================================================
export const ApprovalCatalog: Catalog = createCatalog({
  components: {
    // Basic components
    Card: {
      props: z.object({
        title: z.string(),
      }),
      hasChildren: true,
    },
    TextField: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(),
      }),
    },
    // Approval-specific components
    ApprovalStatus: {
      props: z.object({
        status: z.enum(['pending', 'approved', 'rejected', 'changes_requested']),
        message: z.string().optional(),
      }),
    },
    CommentThread: {
      props: z.object({
        conversationId: z.string(),
        readonly: z.boolean().optional(),
      }),
    },
    ApprovalButtons: {
      props: z.object({
        valuePath: z.string(), // Bind to /form/decision
      }),
    },
  },
  actions: {
    approve: {
      description: 'Approve the request',
      params: z.object({
        notes: z.string().optional(),
      }),
    },
    reject: {
      description: 'Reject the request',
      params: z.object({
        reason: z.string(),
      }),
    },
    request_changes: {
      description: 'Request changes from the requester',
      params: z.object({
        message: z.string(),
      }),
    },
  },
});

// =============================================================================
// Data Selection Catalog
// =============================================================================
export const DataSelectionCatalog: Catalog = createCatalog({
  components: {
    Card: {
      props: z.object({ title: z.string() }),
      hasChildren: true,
    },
    DataTable: {
      props: z.object({
        columns: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            sortable: z.boolean().optional(),
          })
        ),
        dataPath: z.string(),
        selectable: z.boolean().optional(),
        multiSelect: z.boolean().optional(),
      }),
    },
    FilterPanel: {
      props: z.object({
        filters: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            type: z.enum(['text', 'select', 'date', 'number']),
            options: z
              .array(
                z.object({
                  value: z.string(),
                  label: z.string(),
                })
              )
              .optional(),
          })
        ),
        valuePath: z.string(), // Bind to /form/filters
      }),
    },
    SelectionSummary: {
      props: z.object({
        selectedPath: z.string(), // Bind to /form/selected
        countLabel: z.string().optional(),
      }),
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'secondary']).optional(),
        action: z.any(),
      }),
    },
  },
  actions: {
    apply_filters: {
      description: 'Apply filters to the data',
      params: z.object({
        filters: z.any(),
      }),
    },
    clear_filters: {
      description: 'Clear all applied filters',
      params: z.object({}),
    },
    confirm_selection: {
      description: 'Confirm the current selection',
      params: z.object({
        selected: z.array(z.any()),
      }),
    },
  },
});

// =============================================================================
// Catalog Registry
// =============================================================================
export const OrkestraCatalogs: Record<string, Catalog> = {
  'simple-form': SimpleFormCatalog,
  approval: ApprovalCatalog,
  'data-selection': DataSelectionCatalog,
};

export function getCatalog(name: string): Catalog {
  const catalog = OrkestraCatalogs[name];
  if (!catalog) {
    throw new Error(
      `Catalog "${name}" not found. Available: ${Object.keys(OrkestraCatalogs).join(', ')}`
    );
  }
  return catalog;
}
```

### 3. Extend Task Types

Update `packages/sdk/src/types.ts` to support json-render UI:

```typescript
// Add imports
import type { UITree } from '@json-render/core';

// Extend TaskOptions
export interface TaskOptions {
  /** Task title */
  title: string;
  /** Task description */
  description?: string;
  /** Form schema (simple form mode) */
  form?: FormSchema;
  /** UI tree (json-render mode) */
  ui?: UITree;
  /** UI catalog name (required if ui is provided) */
  uiCatalog?: string;
  /** Assignment target */
  assignTo: AssignmentTarget;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Related conversation ID */
  conversationId?: string;
  /** SLA configuration */
  sla?: SLAOptions;
  /** Task priority */
  priority?: TaskPriority;
  /** Task type */
  type?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// Update TaskResult to include UI actions
export interface TaskResult<T = Record<string, unknown>> {
  taskId: string;
  data: T;
  completedBy: string;
  completedAt: Date;
  /** UI actions performed (if UI was used) */
  uiActions?: Array<{
    name: string;
    params?: Record<string, unknown>;
    timestamp: string;
  }>;
}
```

### 4. Create Dashboard Integration

Update `packages/dashboard/` to render json-render UI:

#### Create `packages/dashboard/app/tasks/[id]/components/UITaskView.tsx`:

```typescript
'use client';

import { Renderer, DataProvider, ActionProvider } from '@json-render/react';
import { useTask } from '@/hooks/use-task';
import { api } from '@/trpc/react';
import { getCatalog } from '@orkestra/sdk/ui-catalogs';
import * as builtInComponents from '@json-render/react/components';

interface UITaskViewProps {
  taskId: string;
}

export function UITaskView({ taskId }: UITaskViewProps) {
  const { task } = useTask(taskId);
  const { completeTask } = api.task.complete.useMutation();
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});

  if (!task.ui || !task.uiCatalog) {
    throw new Error('Task requires UI catalog');
  }

  const catalog = getCatalog(task.uiCatalog);

  const handleComplete = async () => {
    await completeTask.mutateAsync({
      taskId: task.id,
      data: formData,
    });
  };

  // Create action handlers from catalog
  const actions: Record<string, (params?: Record<string, unknown>) => Promise<void>> = {
    complete: async () => await handleComplete(),
    ...Object.fromEntries(
      Object.entries(catalog.actions).map(([name, def]) => [
        name,
        async (params?: Record<string, unknown>) => {
          // Execute action via API
          await api.task.executeAction.mutateAsync({
            taskId: task.id,
            action: { name, params },
          });
        },
      ])
    ),
  };

  return (
    <DataProvider
      initialData={{
        context: task.context,
        form: formData,
      }}
    >
      <ActionProvider actions={actions}>
        <Renderer
          tree={task.ui}
          components={builtInComponents}
        />
      </ActionProvider>
    </DataProvider>
  );
}
```

#### Update `packages/dashboard/app/tasks/[id]/page.tsx`:

```typescript
'use client';

import { useTask } from '@/hooks/use-task';
import { SimpleFormView } from './components/SimpleFormView';
import { UITaskView } from './components/UITaskView';

export default function TaskPage({ params }: { params: { id: string } }) {
  const { task } = useTask(params.id);

  if (task.ui) {
    // Use json-render UI
    return <UITaskView taskId={params.id} />;
  }

  // Fall back to simple form
  return <SimpleFormView task={task} />;
}
```

### 5. API Extensions

Add tRPC router for UI actions in `packages/api/src/routers/task.ts`:

```typescript
// Add to TaskRouter
executeTaskAction: protectedProcedure
  .input(
    z.object({
      taskId: z.string(),
      action: z.object({
        name: z.string(),
        params: z.record(z.any()).optional(),
      }),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { taskId, action } = input;

    // Validate action against task's catalog
    const task = await taskManager.getTask(taskId);
    if (!task) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
    }

    const catalog = getCatalog(task.uiCatalog!);

    if (!catalog.actions[action.name]) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Action "${action.name}" not found in catalog`,
      });
    }

    // Record action execution
    await taskManager.recordAction(taskId, {
      name: action.name,
      params: action.params,
      userId: ctx.user.id,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  });
```

### 6. SDK Helper: Generate UI from Description

Create `packages/sdk/src/ui-generator.ts`:

```typescript
import { getCatalog } from './ui-catalogs';
import type { UITree } from '@json-render/core';

export interface GenerateUIOptions {
  description: string;
  catalogName: string;
  context?: Record<string, unknown>;
  formSchema?: Record<string, unknown>;
}

export async function generateUI(options: GenerateUIOptions): Promise<UITree> {
  const { description, catalogName, context, formSchema } = options;

  const catalog = getCatalog(catalogName);

  // Generate prompt for AI
  const prompt = `
You are generating a UI using the json-render library for a human task.

Task Description: ${description}

Available Components:
${Object.entries(catalog.components)
  .map(
    ([name, def]) => `
- ${name}: ${def.description || 'No description'}
  ${def.hasChildren ? 'Has children: yes' : 'Has children: no'}
`
  )
  .join('')}

Available Actions:
${Object.entries(catalog.actions)
  .map(
    ([name, def]) => `
- ${name}: ${def.description}
`
  )
  .join('')}

Context Data (read-only):
${JSON.stringify(context, null, 2)}

Form Data (user input):
${JSON.stringify(formSchema, null, 2)}

Generate a JSON UI tree that meets the task description. Follow these rules:
1. Only use components and actions from the catalog
2. Bind form fields to /form/fieldName
3. Bind context data to /context/path
4. Use actions for user interactions
5. Return valid JSON only, no markdown

Output format:
{
  "elements": [
    {
      "type": "ComponentName",
      "props": { ... },
      "children": [ ... ]
    }
  ]
}
`;

  // Call LLM to generate UI
  // This would use an LLM client like Anthropic, OpenAI, etc.
  // For now, return a placeholder
  const uiTree: UITree = {
    elements: [
      {
        type: 'Card',
        props: { title: 'Task' },
        children: [
          // AI-generated content would go here
        ],
      },
    ],
  };

  // Validate against catalog
  const validationResult = catalog.validate(uiTree);
  if (!validationResult.valid) {
    throw new Error(`Generated UI is invalid: ${JSON.stringify(validationResult.errors)}`);
  }

  return uiTree;
}
```

### 7. Example Workflow

Create `examples/ui-workflow/workflow.ts`:

```typescript
import { workflow, task } from '@orkestra/sdk';

export const documentApproval = workflow(
  'document-approval',
  async (ctx, input: { documentId: string; documentTitle: string }) => {
    // Task with custom UI
    const result = await task(ctx, {
      title: `Review: ${input.documentTitle}`,
      uiCatalog: 'approval',
      ui: {
        elements: [
          {
            type: 'Card',
            props: { title: 'Document Details' },
            children: [
              {
                type: 'ApprovalStatus',
                props: {
                  status: 'pending',
                  message: 'Waiting for your approval',
                },
              },
            ],
          },
          {
            type: 'Card',
            props: { title: 'Your Decision' },
            children: [
              {
                type: 'TextField',
                props: {
                  label: 'Comments',
                  valuePath: '/form/comments',
                  placeholder: 'Add your feedback...',
                },
              },
              {
                type: 'ApprovalButtons',
                props: {
                  valuePath: '/form/decision',
                },
              },
            ],
          },
          {
            type: 'Button',
            props: {
              label: 'Approve',
              variant: 'primary',
              action: {
                name: 'approve',
                params: { notes: { path: '/form/comments' } },
              },
            },
          },
        ],
      },
      form: {
        comments: { type: 'textarea' },
        decision: { type: 'string' },
      },
      assignTo: { group: 'approvers' },
      context: { documentId: input.documentId },
    });

    ctx.log.info('Document approval complete', { decision: result.data.decision });

    return { approved: result.data.decision === 'approved' };
  }
);
```

### 8. Built-in Components

Create wrapper components in `packages/dashboard/components/ui-render/`:

```typescript
// packages/dashboard/components/ui-render/ApprovalButtons.tsx
'use client';

import { type ComponentRenderProps } from '@json-render/react';
import { useDataValue } from '@json-render/react';
import { api } from '@/trpc/react';

export function ApprovalButtons({ element }: ComponentRenderProps) {
  const [decision, setDecision] = useDataValue(element.props.valuePath);

  const handleApprove = () => {
    setDecision('approved');
  };

  const handleReject = () => {
    setDecision('rejected');
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleApprove}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Approve
      </button>
      <button
        onClick={handleReject}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Reject
      </button>
    </div>
  );
}

// packages/dashboard/components/ui-render/index.ts
export { ApprovalButtons } from './ApprovalButtons';
export { ApprovalStatus } from './ApprovalStatus';
// ... other components
```

### 9. Dashboard Integration

Register custom components in `packages/dashboard/app/layout.tsx`:

```typescript
import { JSONUIProvider } from '@json-render/react';
import * as customComponents from '@/components/ui-render';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <JSONUIProvider components={customComponents}>
          {children}
        </JSONUIProvider>
      </body>
    </html>
  );
}
```

---

## Acceptance Criteria

- [ ] `@json-render/core` and `@json-render/react` added as dependencies
- [ ] `packages/sdk/src/ui-catalogs.ts` created with 3 catalogs (SimpleForm, Approval, DataSelection)
- [ ] `getCatalog()` function retrieves catalogs by name
- [ ] Task types extended with `ui?: UITree` and `uiCatalog?: string`
- [ ] TaskResult extended with `uiActions` array
- [ ] `packages/dashboard/app/tasks/[id]/components/UITaskView.tsx` renders json-render UI
- [ ] `UITaskView` uses DataProvider and ActionProvider from @json-render/react
- [ ] Dashboard falls back to simple form when `ui` is not provided
- [ ] tRPC router `executeTaskAction` validates actions against catalog
- [ ] `generateUI()` helper generates UI tree from description (placeholder for LLM)
- [ ] ApprovalButtons and other custom components created
- [ ] Custom components registered in dashboard via JSONUIProvider
- [ ] Example workflow demonstrates custom UI usage
- [ ] Integration tests cover catalog validation
- [ ] Dashboard UI renders custom UI correctly
- [ ] Actions trigger callbacks and update task state
- [ ] Documentation created in `docs/guides/custom-ui-rendering.md`
- [ ] All packages build successfully
- [ ] TypeScript type checking passes

---

## Dependencies

- Task 03: Core Package Setup (for base types)
- Task 06: Task Manager (for task creation)
- Task 07: SDK Workflow Helpers (for SDK integration)
- Task 10: Dashboard UI (for UI rendering integration)

---

## Technical Notes

### Using json-render Directly

Instead of creating our own UI rendering system, we integrate json-render directly:

- Use `@json-render/core` for types, validation, and catalog management
- Use `@json-render/react` for React components, contexts, and renderer
- Define Orkestra-specific catalogs for common workflow types
- Create custom components for Orkestra-specific UI patterns

### Catalog Design

Each catalog defines:

- **Components**: What UI elements AI can use
- **Actions**: What workflow callbacks AI can trigger
- **Validation**: Zod schemas for all component props

Catalogs are registered in `OrkestraCatalogs` and retrieved via `getCatalog()`.

### Data Binding Pattern

Two data sources:

- **Context data**: Read-only, accessed via `/context/path`
- **Form data**: User input, accessed via `/form/fieldName`

Example:

```typescript
{
  type: 'TextField',
  props: {
    label: 'Customer Name',
    valuePath: '/context/customer.name', // Read-only
  },
}
```

```typescript
{
  type: 'TextField',
  props: {
    label: 'Your Decision',
    valuePath: '/form/decision', // Writable
  },
}
```

### Action Flow

1. User clicks button/action in UI
2. json-render ActionProvider captures the action
3. Dashboard calls tRPC `executeTaskAction`
4. API validates action against task's catalog
5. Action is recorded and workflow resumes

### Future Enhancements

- **LLM Integration**: Connect `generateUI()` to Anthropic/Claude API
- **Streaming UI**: Stream UI tree as AI generates it
- **Custom Catalogs**: Allow tenants to define their own catalogs
- **Component Marketplace**: Share community-built components

---

## Documentation

Create `docs/guides/custom-ui-rendering.md`:

````markdown
# Custom UI Rendering with json-render

Orkestra integrates [Vercel's json-render](https://github.com/vercel-labs/json-render) to enable AI agents to generate rich, dynamic UIs for human tasks.

## Quick Start

### 1. Choose a Catalog

Orkestra includes pre-built catalogs:

- **simple-form**: Basic form components (TextField, TextArea, Select, Button)
- **approval**: Approval workflows (ApprovalStatus, CommentThread, ApprovalButtons)
- **data-selection**: Data selection interfaces (DataTable, FilterPanel, SelectionSummary)

### 2. Create Task with UI

```typescript
import { task } from '@orkestra/sdk';

const result = await task(ctx, {
  title: 'Document Approval',
  uiCatalog: 'approval',
  ui: {
    elements: [
      {
        type: 'ApprovalStatus',
        props: { status: 'pending' },
      },
      {
        type: 'TextField',
        props: {
          label: 'Comments',
          valuePath: '/form/comments',
        },
      },
    ],
  },
  form: {
    comments: { type: 'textarea' },
  },
  assignTo: { group: 'approvers' },
});
```
````

### 3. Dashboard Automatically Renders UI

The Dashboard detects `uiCatalog` and `ui` fields and renders the json-render UI instead of the simple form.

## Data Binding

Bind UI elements to task data:

```typescript
// Read from context
{ type: 'TextField', props: { valuePath: '/context/customer.name' } }

// Bind to form input
{ type: 'TextField', props: { valuePath: '/form/approval' } }
```

## Actions

Trigger workflow callbacks:

```typescript
{
  type: 'Button',
  props: {
    label: 'Approve',
    action: {
      name: 'approve',
      params: { notes: { path: '/form/comments' } },
    },
  },
}
```

## Creating Custom Catalogs

```typescript
import { createCatalog } from '@json-render/core';
import { z } from 'zod';

export const MyCatalog = createCatalog({
  components: {
    MyComponent: {
      props: z.object({
        title: z.string(),
      }),
    },
  },
  actions: {
    myAction: {
      description: 'Do something',
      params: z.object({}),
    },
  },
});
```

Then register it in `OrkestraCatalogs`.

```

---

## Tags

#orkestra #task-19 #custom-ui #json-render #human-in-the-loop
```
