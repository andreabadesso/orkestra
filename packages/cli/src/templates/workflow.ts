/**
 * Workflow and Activity templates for code generation
 */

import { toPascalCase, toCamelCase } from '../utils/fs.js';

/**
 * Generate a basic workflow template
 */
export function generateWorkflowTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `/**
 * ${pascalName} Workflow
 *
 * This workflow handles ${name.replace(/-/g, ' ')} operations.
 */

import { proxyActivities, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

// Proxy activities for this workflow
const { /* add activities here */ } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Input type for this workflow
export interface ${pascalName}Input {
  // Define your input parameters here
  id: string;
}

// Output type for this workflow
export interface ${pascalName}Output {
  // Define your output parameters here
  success: boolean;
  message: string;
}

/**
 * ${pascalName} workflow implementation
 */
export async function ${camelName}Workflow(input: ${pascalName}Input): Promise<${pascalName}Output> {
  const { id } = input;

  // TODO: Implement your workflow logic here

  return {
    success: true,
    message: \`Workflow \${id} completed successfully\`,
  };
}
`;
}

/**
 * Generate a workflow template with human task example
 */
export function generateWorkflowWithTaskTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `/**
 * ${pascalName} Workflow with Human Task
 *
 * This workflow demonstrates human-in-the-loop capabilities.
 */

import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
} from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

// Proxy activities for this workflow
const { createHumanTask, waitForTaskCompletion } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Signal for task completion
export const taskCompletedSignal = defineSignal<[{ taskId: string; result: unknown }]>(
  'taskCompleted'
);

// Input type for this workflow
export interface ${pascalName}Input {
  tenantId: string;
  requesterId: string;
  context: Record<string, unknown>;
}

// Output type for this workflow
export interface ${pascalName}Output {
  success: boolean;
  result: unknown;
  handledBy: 'human' | 'automated';
}

/**
 * ${pascalName} workflow with human task
 */
export async function ${camelName}Workflow(input: ${pascalName}Input): Promise<${pascalName}Output> {
  const { tenantId, requesterId, context } = input;

  let taskResult: unknown = null;
  let isTaskCompleted = false;

  // Set up signal handler for task completion
  setHandler(taskCompletedSignal, ({ taskId, result }) => {
    taskResult = result;
    isTaskCompleted = true;
  });

  // Create a human task
  const taskId = await createHumanTask({
    tenantId,
    title: '${pascalName} Review Required',
    description: 'Please review and approve this request',
    form: {
      approved: {
        type: 'boolean',
        label: 'Approve this request?',
        required: true,
      },
      comments: {
        type: 'textarea',
        label: 'Comments',
        required: false,
      },
    },
    assignTo: { group: 'reviewers' },
    context,
    priority: 'normal',
    slaMinutes: 30,
  });

  // Wait for task completion (with timeout)
  const completed = await condition(() => isTaskCompleted, '2 hours');

  if (!completed) {
    return {
      success: false,
      result: null,
      handledBy: 'human',
    };
  }

  return {
    success: true,
    result: taskResult,
    handledBy: 'human',
  };
}
`;
}

/**
 * Generate a basic activity template
 */
export function generateActivityTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `/**
 * ${pascalName} Activity
 *
 * Activities contain the actual business logic and side effects.
 */

import { Context } from '@temporalio/activity';

// Input type for this activity
export interface ${pascalName}Input {
  // Define your input parameters here
  id: string;
}

// Output type for this activity
export interface ${pascalName}Output {
  // Define your output parameters here
  success: boolean;
  data?: unknown;
}

/**
 * ${pascalName} activity implementation
 */
export async function ${camelName}Activity(input: ${pascalName}Input): Promise<${pascalName}Output> {
  const { id } = input;

  // Get activity context for heartbeats, cancellation, etc.
  const context = Context.current();

  // TODO: Implement your activity logic here
  // - Make API calls
  // - Access databases
  // - Perform side effects

  // For long-running activities, send heartbeats
  // context.heartbeat('Processing...');

  return {
    success: true,
    data: { id, processedAt: new Date().toISOString() },
  };
}
`;
}

/**
 * Generate an activity template with human task helpers
 */
export function generateActivityWithTaskTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `/**
 * ${pascalName} Activity with Human Task
 *
 * Activity for creating and managing human tasks.
 */

import { Context } from '@temporalio/activity';

export interface CreateTaskInput {
  tenantId: string;
  title: string;
  description?: string;
  form: Record<string, unknown>;
  assignTo: { group?: string; userId?: string };
  context?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  slaMinutes?: number;
}

/**
 * Create a human task
 */
export async function ${camelName}CreateTask(input: CreateTaskInput): Promise<string> {
  const context = Context.current();

  // TODO: Integrate with @orkestra/core TaskManager
  // const taskManager = new TaskManager(/* ... */);
  // const task = await taskManager.create(input);
  // return task.id;

  // Placeholder implementation
  const taskId = \`task_\${Date.now()}\`;
  console.log(\`Created task: \${taskId}\`, input);
  return taskId;
}

/**
 * Get task status
 */
export async function ${camelName}GetTaskStatus(taskId: string): Promise<{
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  result?: unknown;
}> {
  // TODO: Integrate with @orkestra/core TaskManager
  return { status: 'pending' };
}
`;
}

/**
 * Generate package.json template for new project
 */
export function generatePackageJsonTemplate(name: string, config: {
  database: 'postgres' | 'sqlite';
  includeDashboard: boolean;
}): string {
  const dependencies: Record<string, string> = {
    '@orkestra/core': '^0.0.1',
    '@orkestra/sdk': '^0.0.1',
    '@temporalio/client': '^1.11.0',
    '@temporalio/worker': '^1.11.0',
    '@temporalio/workflow': '^1.11.0',
    '@temporalio/activity': '^1.11.0',
  };

  if (config.database === 'postgres') {
    dependencies['pg'] = '^8.11.0';
  }

  if (config.includeDashboard) {
    dependencies['@orkestra/dashboard'] = '^0.0.1';
  }

  return JSON.stringify(
    {
      name,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        dev: 'orkestra dev',
        build: 'tsc --build',
        start: 'node dist/worker.js',
        'db:migrate': 'orkestra db migrate',
        'db:push': 'orkestra db push',
        'db:studio': 'orkestra db studio',
      },
      dependencies,
      devDependencies: {
        '@orkestra/cli': '^0.0.1',
        typescript: '^5.7.0',
        '@types/node': '^20.0.0',
      },
    },
    null,
    2
  );
}

/**
 * Generate docker-compose.yml template
 */
export function generateDockerComposeTemplate(config: {
  database: 'postgres' | 'sqlite';
}): string {
  if (config.database === 'sqlite') {
    return `version: '3.8'

services:
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
    environment:
      - DB=sqlite
      - DYNAMIC_CONFIG_FILE_PATH=config/dynamicconfig/development.yaml
`;
  }

  return `version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: orkestra
      POSTGRES_PASSWORD: orkestra
      POSTGRES_DB: orkestra
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orkestra"]
      interval: 5s
      timeout: 5s
      retries: 5

  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=orkestra
      - POSTGRES_PWD=orkestra
      - POSTGRES_SEEDS=postgres
    depends_on:
      postgres:
        condition: service_healthy

  temporal-ui:
    image: temporalio/ui:latest
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    depends_on:
      - temporal

volumes:
  postgres_data:
`;
}

/**
 * Generate tsconfig.json template
 */
export function generateTsConfigTemplate(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2
  );
}

/**
 * Generate .env.example template
 */
export function generateEnvExampleTemplate(config: {
  database: 'postgres' | 'sqlite';
}): string {
  const base = `# Orkestra Configuration
NODE_ENV=development

# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
`;

  if (config.database === 'postgres') {
    return (
      base +
      `
# Database Configuration
DATABASE_URL=postgresql://orkestra:orkestra@localhost:5432/orkestra
`
    );
  }

  return (
    base +
    `
# Database Configuration
DATABASE_URL=file:./orkestra.db
`
  );
}
