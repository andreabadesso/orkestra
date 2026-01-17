/**
 * Agent Tools
 *
 * Tools available to the workflow authoring agent.
 */

import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs-extra';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { findProjectRoot, readFile, writeFile, fileExists } from '../utils/fs.js';

const execFileAsync = promisify(execFile);

/**
 * Tool definitions for Claude
 */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'write_workflow_file',
    description: `Write a workflow file to the project's src/workflows directory.
Creates the file with the provided TypeScript content.
Returns the full path of the created file.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: {
          type: 'string',
          description: 'The filename without extension (e.g., "customer-support")',
        },
        content: {
          type: 'string',
          description: 'The complete TypeScript file content',
        },
        directory: {
          type: 'string',
          description: 'Optional subdirectory within src/workflows',
        },
      },
      required: ['filename', 'content'],
    },
  },
  {
    name: 'analyze_project',
    description: `Analyze the current Orkestra project structure.
Returns information about existing workflows, activities, and project configuration.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: {
          type: 'string',
          description: 'Specific directory to analyze (default: src/workflows)',
        },
      },
      required: [],
    },
  },
  {
    name: 'validate_workflow',
    description: `Validate TypeScript syntax for a workflow.
Checks for syntax errors and type issues without writing to disk.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'The TypeScript content to validate',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'read_workflow_file',
    description: `Read an existing workflow file from the project.
Returns the content of the specified workflow file.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: {
          type: 'string',
          description: 'The workflow filename (with or without .ts extension)',
        },
      },
      required: ['filename'],
    },
  },
];

/**
 * Tool execution context
 */
export interface ToolContext {
  projectRoot: string;
  workDir: string;
}

/**
 * Tool result type
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Execute a tool with the given input
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  switch (toolName) {
    case 'write_workflow_file':
      return writeWorkflowFile(
        input['filename'] as string,
        input['content'] as string,
        input['directory'] as string | undefined,
        context
      );

    case 'analyze_project':
      return analyzeProject(input['directory'] as string | undefined, context);

    case 'validate_workflow':
      return validateWorkflow(input['content'] as string, context);

    case 'read_workflow_file':
      return readWorkflowFile(input['filename'] as string, context);

    default:
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
      };
  }
}

/**
 * Write a workflow file to disk
 */
async function writeWorkflowFile(
  filename: string,
  content: string,
  directory: string | undefined,
  context: ToolContext
): Promise<ToolResult> {
  try {
    // Ensure filename doesn't have extension
    const baseName = filename.replace(/\.ts$/, '');

    // Build the path
    const workflowsDir = path.join(context.projectRoot, 'src', 'workflows');
    const targetDir = directory ? path.join(workflowsDir, directory) : workflowsDir;
    const filePath = path.join(targetDir, `${baseName}.ts`);

    // Check if file already exists
    if (await fileExists(filePath)) {
      return {
        success: false,
        message: `File already exists: ${filePath}. Use a different name or delete the existing file first.`,
        data: { path: filePath, exists: true },
      };
    }

    // Write the file
    await writeFile(filePath, content);

    // Update index.ts if it exists
    const indexPath = path.join(workflowsDir, 'index.ts');
    if (await fileExists(indexPath)) {
      try {
        const indexContent = await readFile(indexPath);
        const exportStatement = directory
          ? `export * from './${directory}/${baseName}.js';`
          : `export * from './${baseName}.js';`;

        // Only add if not already exported
        if (!indexContent.includes(exportStatement)) {
          const updatedIndex = indexContent.trimEnd() + '\n' + exportStatement + '\n';
          await writeFile(indexPath, updatedIndex);
        }
      } catch {
        // Ignore index update errors
      }
    }

    return {
      success: true,
      message: `Successfully created workflow file: ${filePath}`,
      data: { path: filePath },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Analyze the project structure
 */
async function analyzeProject(
  directory: string | undefined,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const targetDir = directory
      ? path.join(context.projectRoot, directory)
      : path.join(context.projectRoot, 'src', 'workflows');

    const analysis: {
      workflows: Array<{
        name: string;
        path: string;
        exports: string[];
        hasTask: boolean;
        hasEscalation: boolean;
      }>;
      activities: string[];
      hasPackageJson: boolean;
      hasTsConfig: boolean;
      dependencies: Record<string, string>;
    } = {
      workflows: [],
      activities: [],
      hasPackageJson: false,
      hasTsConfig: false,
      dependencies: {},
    };

    // Check for package.json
    const packagePath = path.join(context.projectRoot, 'package.json');
    if (await fileExists(packagePath)) {
      analysis.hasPackageJson = true;
      try {
        const pkg = JSON.parse(await readFile(packagePath));
        analysis.dependencies = pkg.dependencies || {};
      } catch {
        // Ignore parse errors
      }
    }

    // Check for tsconfig
    analysis.hasTsConfig = await fileExists(path.join(context.projectRoot, 'tsconfig.json'));

    // Analyze workflows directory
    if (await fs.pathExists(targetDir)) {
      const files = await fs.readdir(targetDir);

      for (const file of files) {
        if (file.endsWith('.ts') && file !== 'index.ts') {
          const filePath = path.join(targetDir, file);
          const stat = await fs.stat(filePath);

          if (stat.isFile()) {
            try {
              const content = await readFile(filePath);

              // Extract workflow info
              const workflowInfo = {
                name: file.replace('.ts', ''),
                path: filePath,
                exports: extractExports(content),
                hasTask: content.includes('task(') || content.includes('task<'),
                hasEscalation:
                  content.includes('taskWithEscalation') ||
                  content.includes('escalationChain'),
              };

              analysis.workflows.push(workflowInfo);
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    }

    // Analyze activities directory
    const activitiesDir = path.join(context.projectRoot, 'src', 'activities');
    if (await fs.pathExists(activitiesDir)) {
      const files = await fs.readdir(activitiesDir);
      analysis.activities = files
        .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
        .map((f) => f.replace('.ts', ''));
    }

    return {
      success: true,
      message: `Analyzed project at ${context.projectRoot}`,
      data: analysis,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate workflow TypeScript syntax using basic parsing
 * Note: This does a lightweight syntax check without full type checking
 * to avoid requiring tsc to be installed
 */
async function validateWorkflow(
  content: string,
  context: ToolContext
): Promise<ToolResult> {
  try {
    // Create a temporary file for validation
    const tempDir = path.join(context.projectRoot, '.orkestra-temp');
    const tempFile = path.join(tempDir, 'validate-temp.ts');

    await fs.ensureDir(tempDir);
    await writeFile(tempFile, content);

    try {
      // Try to run tsc for validation using execFile (safer than exec)
      // Use npx to find tsc in node_modules
      const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const { stderr } = await execFileAsync(npxPath, [
        'tsc',
        '--noEmit',
        '--skipLibCheck',
        '--allowImportingTsExtensions',
        '--moduleResolution', 'bundler',
        tempFile,
      ], { cwd: context.projectRoot });

      // Clean up
      await fs.remove(tempFile);

      if (stderr && stderr.includes('error')) {
        return {
          success: false,
          message: 'TypeScript validation failed',
          data: { errors: parseTypeScriptErrors(stderr) },
        };
      }

      return {
        success: true,
        message: 'TypeScript syntax is valid',
        data: { valid: true },
      };
    } catch (execError) {
      // Clean up on error
      await fs.remove(tempFile).catch(() => {});

      // Check if it's just tsc not being available
      if (execError instanceof Error && execError.message.includes('ENOENT')) {
        // Fall back to basic syntax checking
        return basicSyntaxCheck(content);
      }

      // Parse the error output
      const errorOutput =
        execError instanceof Error && 'stderr' in execError
          ? (execError as { stderr: string }).stderr
          : String(execError);

      return {
        success: false,
        message: 'TypeScript validation failed',
        data: { errors: parseTypeScriptErrors(errorOutput) },
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Basic syntax check when tsc is not available
 */
function basicSyntaxCheck(content: string): ToolResult {
  const errors: string[] = [];

  // Check for basic syntax issues
  // Count braces
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let templateDepth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    // Handle string literals
    if (!inString && !inTemplate && (char === '"' || char === "'" || char === '`')) {
      if (char === '`') {
        inTemplate = true;
        templateDepth = 1;
      } else {
        inString = true;
        stringChar = char;
      }
      continue;
    }

    if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      continue;
    }

    if (inTemplate) {
      if (char === '`' && prevChar !== '\\') {
        templateDepth--;
        if (templateDepth === 0) {
          inTemplate = false;
        }
      } else if (char === '$' && content[i + 1] === '{') {
        templateDepth++;
      }
      continue;
    }

    if (inString) continue;

    // Count brackets
    switch (char) {
      case '{': braceCount++; break;
      case '}': braceCount--; break;
      case '(': parenCount++; break;
      case ')': parenCount--; break;
      case '[': bracketCount++; break;
      case ']': bracketCount--; break;
    }
  }

  if (braceCount !== 0) {
    errors.push(`Unbalanced curly braces: ${braceCount > 0 ? 'missing' : 'extra'} ${Math.abs(braceCount)} closing brace(s)`);
  }
  if (parenCount !== 0) {
    errors.push(`Unbalanced parentheses: ${parenCount > 0 ? 'missing' : 'extra'} ${Math.abs(parenCount)} closing parenthesis`);
  }
  if (bracketCount !== 0) {
    errors.push(`Unbalanced brackets: ${bracketCount > 0 ? 'missing' : 'extra'} ${Math.abs(bracketCount)} closing bracket(s)`);
  }

  // Check for required imports
  if (content.includes('workflow(') && !content.includes("from '@orkestra/sdk'")) {
    errors.push("Missing import from '@orkestra/sdk'");
  }

  // Check for export
  if (!content.includes('export ')) {
    errors.push('No exports found - workflows should export their definitions');
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: 'Basic syntax check found issues',
      data: { errors, note: 'Full TypeScript validation unavailable - using basic checks' },
    };
  }

  return {
    success: true,
    message: 'Basic syntax check passed (full TypeScript validation unavailable)',
    data: { valid: true, note: 'Only basic syntax was checked' },
  };
}

/**
 * Read an existing workflow file
 */
async function readWorkflowFile(
  filename: string,
  context: ToolContext
): Promise<ToolResult> {
  try {
    // Ensure filename has extension
    const baseName = filename.replace(/\.ts$/, '');
    const filePath = path.join(context.projectRoot, 'src', 'workflows', `${baseName}.ts`);

    if (!(await fileExists(filePath))) {
      // Try without src/workflows prefix in case user provided full path
      const altPath = path.join(context.projectRoot, filename);
      if (await fileExists(altPath)) {
        const content = await readFile(altPath);
        return {
          success: true,
          message: `Read workflow file: ${altPath}`,
          data: { path: altPath, content },
        };
      }

      return {
        success: false,
        message: `Workflow file not found: ${filePath}`,
      };
    }

    const content = await readFile(filePath);
    return {
      success: true,
      message: `Read workflow file: ${filePath}`,
      data: { path: filePath, content },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Helper functions

function extractExports(content: string): string[] {
  const exports: string[] = [];

  // Match export const/function/interface/type
  const exportRegex = /export\s+(const|function|interface|type|class)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    if (match[2]) {
      exports.push(match[2]);
    }
  }

  return exports;
}

function parseTypeScriptErrors(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (line.includes('error TS')) {
      // Extract just the error message, not the full path
      const errorMatch = line.match(/error TS\d+:\s*(.+)/);
      if (errorMatch?.[1]) {
        errors.push(errorMatch[1]);
      } else {
        errors.push(line.trim());
      }
    }
  }

  return errors.length > 0 ? errors : [output.trim()];
}

/**
 * Initialize tool context
 */
export async function initToolContext(workDir: string): Promise<ToolContext | null> {
  // Try to find project root
  let projectRoot = await findProjectRoot(workDir);

  // If no Orkestra project found, check if current dir has src/workflows
  if (!projectRoot) {
    const workflowsDir = path.join(workDir, 'src', 'workflows');
    if (await fs.pathExists(workflowsDir)) {
      projectRoot = workDir;
    } else {
      // Check if we're in an Orkestra monorepo
      const packagePath = path.join(workDir, 'package.json');
      if (await fileExists(packagePath)) {
        try {
          const pkg = JSON.parse(await readFile(packagePath));
          if (pkg.name?.includes('orkestra') || pkg.dependencies?.['@orkestra/sdk']) {
            projectRoot = workDir;
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  if (!projectRoot) {
    return null;
  }

  return {
    projectRoot,
    workDir,
  };
}
