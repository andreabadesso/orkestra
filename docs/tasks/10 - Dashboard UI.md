# Task 10: Dashboard UI

## Overview

Build the `@orkestra/dashboard` frontend application for human task management.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟡 **High** - Essential for human-in-the-loop

## Estimated Effort

12-16 hours

## Description

Create a Next.js dashboard application where humans can view, claim, and complete tasks. The UI should be clean, functional, and focused on task completion efficiency.

## Requirements

### Package Structure

```
packages/dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Redirect to /tasks
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── tasks/
│   │   │   ├── page.tsx          # Task inbox
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Task detail
│   │   ├── history/
│   │   │   └── page.tsx          # Completed tasks
│   │   └── admin/
│   │       ├── layout.tsx
│   │       ├── page.tsx          # Dashboard
│   │       ├── users/
│   │       │   └── page.tsx
│   │       ├── groups/
│   │       │   └── page.tsx
│   │       └── settings/
│   │           └── page.tsx
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── nav.tsx
│   │   ├── tasks/
│   │   │   ├── task-list.tsx
│   │   │   ├── task-card.tsx
│   │   │   ├── task-detail.tsx
│   │   │   ├── task-form.tsx
│   │   │   └── task-history.tsx
│   │   └── admin/
│   │       ├── user-table.tsx
│   │       └── group-table.tsx
│   ├── lib/
│   │   ├── trpc.ts               # tRPC client
│   │   ├── auth.ts               # Auth utilities
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

### Task Inbox Page

```tsx
// app/tasks/page.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { TaskList } from '@/components/tasks/task-list';
import { TaskFilters } from '@/components/tasks/task-filters';

export default function TasksPage() {
  const { data: tasks, isLoading } = trpc.task.pending.useQuery();

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Inbox</h1>
        <TaskFilters />
      </div>

      {isLoading ? (
        <TaskListSkeleton />
      ) : (
        <TaskList tasks={tasks ?? []} />
      )}
    </div>
  );
}
```

### Task List Component

```tsx
// components/tasks/task-list.tsx
import { Task } from '@orkestra/core';
import { TaskCard } from './task-card';
import { formatDistanceToNow } from 'date-fns';

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending tasks. You're all caught up! 🎉
      </div>
    );
  }

  // Group by SLA urgency
  const urgent = tasks.filter(t => t.slaDeadline && isUrgent(t.slaDeadline));
  const normal = tasks.filter(t => !t.slaDeadline || !isUrgent(t.slaDeadline));

  return (
    <div className="space-y-6">
      {urgent.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-destructive mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Urgent ({urgent.length})
          </h2>
          <div className="grid gap-4">
            {urgent.map(task => (
              <TaskCard key={task.id} task={task} urgent />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">
          All Tasks ({normal.length})
        </h2>
        <div className="grid gap-4">
          {normal.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

### Task Card Component

```tsx
// components/tasks/task-card.tsx
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Task } from '@orkestra/core';
import Link from 'next/link';

interface TaskCardProps {
  task: Task;
  urgent?: boolean;
}

export function TaskCard({ task, urgent }: TaskCardProps) {
  const trpc = useTRPC();
  const claimMutation = trpc.task.claim.useMutation();

  const handleClaim = async () => {
    await claimMutation.mutateAsync({ taskId: task.id });
  };

  return (
    <Card className={urgent ? 'border-destructive' : ''}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {task.description}
              </p>
            )}
          </div>
          <Badge variant={getStatusVariant(task.status)}>
            {task.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex gap-4 text-sm text-muted-foreground">
          {task.slaDeadline && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Due {formatDistanceToNow(new Date(task.slaDeadline), { addSuffix: true })}
            </div>
          )}
          {task.assignedGroup && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {task.assignedGroup.name}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        {task.status === 'ASSIGNED' && (
          <Button
            onClick={handleClaim}
            disabled={claimMutation.isLoading}
          >
            Claim Task
          </Button>
        )}
        {task.status === 'CLAIMED' && (
          <Button asChild>
            <Link href={`/tasks/${task.id}`}>
              Complete Task
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

### Task Detail Page

```tsx
// app/tasks/[id]/page.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { TaskDetail } from '@/components/tasks/task-detail';
import { TaskForm } from '@/components/tasks/task-form';
import { ConversationContext } from '@/components/tasks/conversation-context';
import { useParams, useRouter } from 'next/navigation';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const { data: task, isLoading } = trpc.task.get.useQuery({ taskId });
  const completeMutation = trpc.task.complete.useMutation({
    onSuccess: () => router.push('/tasks'),
  });

  if (isLoading) return <TaskDetailSkeleton />;
  if (!task) return <NotFound />;

  const handleSubmit = async (formData: Record<string, unknown>) => {
    await completeMutation.mutateAsync({ taskId, formData });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <TaskDetail task={task} />
          <TaskForm
            schema={task.formSchema}
            onSubmit={handleSubmit}
            isSubmitting={completeMutation.isLoading}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {task.conversationId && (
            <ConversationContext conversationId={task.conversationId} />
          )}
          <TaskHistory taskId={taskId} />
        </div>
      </div>
    </div>
  );
}
```

### Dynamic Form Component

```tsx
// components/tasks/task-form.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSchema, buildZodSchema } from '@/lib/form-schema';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface TaskFormProps {
  schema: FormSchema;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
}

export function TaskForm({ schema, onSubmit, isSubmitting }: TaskFormProps) {
  const zodSchema = buildZodSchema(schema);
  const form = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: getDefaultValues(schema),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {Object.entries(schema.fields).map(([name, field]) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label ?? name}
                  {field.required && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  {renderField(field, formField)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Submitting...' : 'Complete Task'}
        </Button>
      </form>
    </Form>
  );
}

function renderField(field: FormField, formField: any) {
  switch (field.type) {
    case 'text':
      return <Input {...formField} />;
    case 'textarea':
      return <Textarea {...formField} rows={4} />;
    case 'boolean':
      return <Checkbox checked={formField.value} onCheckedChange={formField.onChange} />;
    case 'select':
      return (
        <Select value={formField.value} onValueChange={formField.onChange}>
          {field.options?.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </Select>
      );
    case 'number':
      return <Input type="number" {...formField} />;
    case 'date':
      return <Input type="date" {...formField} />;
    default:
      return <Input {...formField} />;
  }
}
```

### Conversation Context Panel

```tsx
// components/tasks/conversation-context.tsx
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';

interface ConversationContextProps {
  conversationId: string;
}

export function ConversationContext({ conversationId }: ConversationContextProps) {
  const { data: conversation } = trpc.conversation.get.useQuery({
    conversationId,
  });

  if (!conversation) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Conversation</CardTitle>
        <p className="text-sm text-muted-foreground">
          {conversation.participant.name ?? 'Unknown'}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {conversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${
                  msg.role === 'assistant' ? 'flex-row-reverse' : ''
                }`}
              >
                <Avatar className="h-8 w-8">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </Avatar>
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] ${
                    msg.role === 'assistant'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <span className="text-xs opacity-70">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

### Admin Pages

Create basic CRUD interfaces for:
- `/admin/users` - User management table
- `/admin/groups` - Group management with member assignment
- `/admin/settings` - Tenant configuration

## Acceptance Criteria

- [ ] Next.js app scaffolded with App Router
- [ ] Authentication flow working (login/logout)
- [ ] Task inbox displays pending tasks
- [ ] Tasks can be claimed from inbox
- [ ] Task detail page shows full context
- [ ] Dynamic form renders all field types
- [ ] Form submission completes tasks
- [ ] Conversation context displayed
- [ ] Task history timeline shown
- [ ] Admin: User list with CRUD
- [ ] Admin: Group list with member management
- [ ] Admin: Settings page
- [ ] Responsive design (mobile-friendly)
- [ ] Loading states and skeletons
- [ ] Error handling with toasts
- [ ] Dark mode support

## Dependencies

- [[01 - Initialize Monorepo]]
- [[09 - REST API]]
- [[11 - Dashboard Backend]]

## Blocked By

- [[09 - REST API]] - Need tRPC types

## Blocks

- [[14 - Integration Testing]]

## Technical Notes

### Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "@trpc/client": "^10.45.0",
    "@trpc/react-query": "^10.45.0",
    "@tanstack/react-query": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-*": "various",
    "lucide-react": "^0.300.0",
    "date-fns": "^3.0.0",
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0"
  }
}
```

### shadcn/ui Setup

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea select checkbox form table
```

## References

- [Next.js App Router](https://nextjs.org/docs/app)
- [shadcn/ui](https://ui.shadcn.com/)
- [tRPC React Query](https://trpc.io/docs/client/react)

## Tags

#orkestra #task #dashboard #frontend #nextjs #react
