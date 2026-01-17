# MCP Tools Reference

Orkestra exposes its functionality via Model Context Protocol tools, enabling AI agents to interact with workflows, tasks, conversations, and users.

## Overview

MCP tools follow the standard MCP protocol with typed input/output schemas. Each tool returns a JSON response with a `success` flag and `data` field containing the result.

**Response Format:**

```json
{
  "success": true,
  "data": { ... }
}
```

## Workflow Tools

### workflow_start

Start a new workflow instance.

**Parameters:**

| Name                            | Type   | Required | Description                                                          |
| ------------------------------- | ------ | -------- | -------------------------------------------------------------------- |
| type                            | string | Yes      | The workflow type name (must match a registered workflow definition) |
| input                           | object | Yes      | Input data for the workflow                                          |
| options                         | object | No       | Optional execution options                                           |
| options.workflowId              | string | No       | Custom workflow ID (auto-generated if not provided)                  |
| options.taskQueue               | string | No       | Task queue to run on                                                 |
| options.executionTimeoutSeconds | number | No       | Execution timeout in seconds                                         |
| metadata                        | object | No       | Additional metadata to attach to the workflow                        |

**Response:**

```json
{
  "id": "wfl_abc123",
  "type": "customer-support",
  "status": "running",
  "input": { "question": "...", "customerId": "..." },
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### workflow_get

Get details of a specific workflow by its ID.

**Parameters:**

| Name       | Type   | Required | Description                 |
| ---------- | ------ | -------- | --------------------------- |
| workflowId | string | Yes      | The workflow ID to retrieve |

**Response:**

```json
{
  "id": "wfl_abc123",
  "type": "customer-support",
  "status": "running",
  "input": { ... },
  "output": null,
  "startedAt": "2024-01-15T10:00:00Z",
  "completedAt": null
}
```

### workflow_list

List workflows with optional filtering. Returns paginated results.

**Parameters:**

| Name          | Type   | Required | Description                                                                                                 |
| ------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------- |
| type          | string | No       | Filter by workflow type                                                                                     |
| status        | string | No       | Filter by workflow status (`pending`, `running`, `paused`, `completed`, `failed`, `cancelled`, `timed_out`) |
| startedAfter  | string | No       | Filter workflows started after this ISO date                                                                |
| startedBefore | string | No       | Filter workflows started before this ISO date                                                               |
| limit         | number | No       | Maximum number of results (default: 20, max: 100)                                                           |
| cursor        | string | No       | Pagination cursor for next page                                                                             |

**Response:**

```json
{
  "items": [
    {
      "id": "wfl_abc123",
      "type": "customer-support",
      "status": "running",
      "startedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "nextCursor": "abc123...",
  "hasMore": true
}
```

### workflow_signal

Send a signal to a running workflow. Signals can trigger workflow state changes or pass data.

**Parameters:**

| Name       | Type   | Required | Description                       |
| ---------- | ------ | -------- | --------------------------------- |
| workflowId | string | Yes      | The workflow ID to signal         |
| signalName | string | Yes      | Name of the signal to send        |
| args       | array  | No       | Arguments to pass with the signal |

**Response:**

```json
{
  "success": true,
  "message": "Signal 'task_completed' sent to workflow wfl_abc123"
}
```

### workflow_cancel

Cancel a running workflow. The workflow will be marked as cancelled and stop execution.

**Parameters:**

| Name       | Type   | Required | Description                                 |
| ---------- | ------ | -------- | ------------------------------------------- |
| workflowId | string | Yes      | The workflow ID to cancel                   |
| reason     | string | No       | Reason for cancellation (for audit logging) |

**Response:**

```json
{
  "success": true,
  "message": "Workflow wfl_abc123 cancelled",
  "reason": "Customer request"
}
```

## Task Tools

### task_create

Create a new human task. Tasks are assigned to users or groups for completion.

**Parameters:**

| Name                        | Type   | Required | Description                                                                |
| --------------------------- | ------ | -------- | -------------------------------------------------------------------------- |
| type                        | string | Yes      | Task type identifier for categorization                                    |
| title                       | string | Yes      | Short, descriptive task title                                              |
| description                 | string | No       | Detailed instructions for completing the task                              |
| priority                    | string | No       | Task priority level (`low`, `medium`, `high`, `urgent`, default: `medium`) |
| form                        | object | Yes      | Form schema defining the data to collect                                   |
| form.fields                 | object | Yes      | Field definitions keyed by field name                                      |
| form.fieldOrder             | array  | No       | Order in which fields should be displayed                                  |
| assignment                  | object | Yes      | Who the task is assigned to                                                |
| assignment.userId           | string | No       | Assign to a specific user                                                  |
| assignment.groupId          | string | No       | Assign to a group (any member can claim)                                   |
| sla                         | object | No       | SLA (Service Level Agreement) configuration                                |
| sla.dueAt                   | string | No       | Due date/time (ISO 8601)                                                   |
| sla.warnBeforeMinutes       | number | No       | Minutes before due to send warning                                         |
| sla.escalation              | object | No       | Escalation configuration                                                   |
| sla.escalation.afterMinutes | number | No       | Minutes past due before escalation                                         |
| sla.escalation.toGroupId    | string | No       | Group to escalate to                                                       |
| sla.escalation.toUserId     | string | No       | User to escalate to                                                        |
| context                     | object | No       | Context data for the task                                                  |
| context.conversationId      | string | No       | Linked conversation ID                                                     |
| context.relatedEntity       | object | No       | Related entity reference                                                   |
| context.data                | object | No       | Additional context data                                                    |
| metadata                    | object | No       | Additional metadata                                                        |

**Form Field Types:**

| Type          | Description                   |
| ------------- | ----------------------------- |
| `text`        | Single-line text input        |
| `textarea`    | Multi-line text input         |
| `number`      | Numeric input                 |
| `email`       | Email address                 |
| `url`         | URL input                     |
| `date`        | Date picker                   |
| `datetime`    | Date and time picker          |
| `time`        | Time picker                   |
| `select`      | Dropdown selection (single)   |
| `multiselect` | Dropdown selection (multiple) |
| `radio`       | Radio button group            |
| `checkbox`    | Single checkbox               |
| `file`        | File upload                   |
| `json`        | JSON object input             |

**Response:**

```json
{
  "id": "tsk_abc123",
  "type": "document-review",
  "title": "Review document",
  "status": "pending",
  "priority": "medium",
  "form": { ... },
  "assignment": { "groupId": "reviewers" },
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### task_get

Get details of a specific task by its ID.

**Parameters:**

| Name   | Type   | Required | Description             |
| ------ | ------ | -------- | ----------------------- |
| taskId | string | Yes      | The task ID to retrieve |

**Response:**

```json
{
  "id": "tsk_abc123",
  "type": "document-review",
  "title": "Review document",
  "status": "assigned",
  "priority": "medium",
  "form": { ... },
  "assignment": { "groupId": "reviewers" },
  "claimedBy": "user_123",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### task_list

List tasks with optional filtering. Returns paginated results.

**Parameters:**

| Name              | Type   | Required | Description                                                                                                    |
| ----------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| status            | string | No       | Filter by task status (`pending`, `assigned`, `in_progress`, `completed`, `cancelled`, `expired`, `escalated`) |
| priority          | string | No       | Filter by priority (`low`, `medium`, `high`, `urgent`)                                                         |
| assignedToUserId  | string | No       | Filter by assigned user                                                                                        |
| assignedToGroupId | string | No       | Filter by assigned group                                                                                       |
| workflowId        | string | No       | Filter by parent workflow                                                                                      |
| type              | string | No       | Filter by task type                                                                                            |
| dueBefore         | string | No       | Filter tasks due before this ISO date                                                                          |
| dueAfter          | string | No       | Filter tasks due after this ISO date                                                                           |
| limit             | number | No       | Maximum number of results (default: 20, max: 100)                                                              |
| cursor            | string | No       | Pagination cursor for next page                                                                                |

**Response:**

```json
{
  "items": [
    {
      "id": "tsk_abc123",
      "title": "Review document",
      "status": "assigned",
      "priority": "medium"
    }
  ],
  "nextCursor": "abc123...",
  "hasMore": true
}
```

### task_complete

Complete a task by submitting the form data. The task status will change to completed.

**Parameters:**

| Name   | Type   | Required | Description                                              |
| ------ | ------ | -------- | -------------------------------------------------------- |
| taskId | string | Yes      | The task ID to complete                                  |
| result | object | Yes      | Form data submitted by the user (must match form schema) |

**Response:**

```json
{
  "id": "tsk_abc123",
  "status": "completed",
  "result": { "approved": true, "notes": "Looks good" },
  "completedAt": "2024-01-15T11:00:00Z",
  "completedBy": "user_123"
}
```

### task_reassign

Reassign a task to a different user or group.

**Parameters:**

| Name    | Type   | Required | Description                                 |
| ------- | ------ | -------- | ------------------------------------------- |
| taskId  | string | Yes      | The task ID to reassign                     |
| userId  | string | No       | New assigned user ID                        |
| groupId | string | No       | New assigned group ID                       |
| reason  | string | No       | Reason for reassignment (for audit logging) |

**Response:**

```json
{
  "id": "tsk_abc123",
  "assignment": {
    "userId": "user_456",
    "groupId": null
  },
  "reassignedAt": "2024-01-15T11:30:00Z"
}
```

### task_add_comment

Add a comment to a task. Comments provide additional context or updates.

**Parameters:**

| Name    | Type   | Required | Description                         |
| ------- | ------ | -------- | ----------------------------------- |
| taskId  | string | Yes      | The task ID to comment on           |
| content | string | Yes      | Comment text content                |
| userId  | string | No       | User ID of the commenter (optional) |

**Response:**

```json
{
  "taskId": "tsk_abc123",
  "commentId": "cmt_xyz789",
  "content": "Need more information",
  "createdBy": "user_123",
  "createdAt": "2024-01-15T11:45:00Z"
}
```

## Conversation Tools

### conversation_create

Create a new conversation for tracking interactions. Conversations can be linked to workflows.

**Parameters:**

| Name                  | Type   | Required | Description                                                                                           |
| --------------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------- |
| title                 | string | No       | Conversation title or subject                                                                         |
| channel               | string | Yes      | Channel through which the conversation is happening (`web`, `api`, `slack`, `email`, `sms`, `custom`) |
| externalId            | string | No       | External reference ID (e.g., ticket number, chat ID)                                                  |
| participants          | array  | No       | Initial participants in the conversation                                                              |
| participants[].userId | string | No       | User ID (null for external participants)                                                              |
| participants[].role   | string | No       | Participant role (`user`, `assistant`, `system`, `human_operator`)                                    |
| participants[].name   | string | Yes      | Display name for the participant                                                                      |
| tags                  | array  | No       | Tags for categorization                                                                               |
| metadata              | object | No       | Additional metadata                                                                                   |

**Response:**

```json
{
  "id": "cnv_abc123",
  "title": "Customer Support Inquiry",
  "channel": "web",
  "status": "active",
  "messageCount": 0,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### conversation_get

Get a conversation by ID, optionally including all messages.

**Parameters:**

| Name            | Type    | Required | Description                                         |
| --------------- | ------- | -------- | --------------------------------------------------- |
| conversationId  | string  | Yes      | The conversation ID to retrieve                     |
| includeMessages | boolean | No       | Whether to include all messages (default: false)    |
| messageLimit    | number  | No       | Maximum number of messages to include (default: 50) |

**Response:**

```json
{
  "id": "cnv_abc123",
  "title": "Customer Support Inquiry",
  "channel": "web",
  "status": "active",
  "messages": [
    {
      "id": "msg_xyz789",
      "role": "user",
      "content": "I need help with...",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### conversation_list

List conversations with optional filtering. Returns paginated results.

**Parameters:**

| Name              | Type   | Required | Description                                                                   |
| ----------------- | ------ | -------- | ----------------------------------------------------------------------------- |
| status            | string | No       | Filter by conversation status (`active`, `resolved`, `abandoned`, `archived`) |
| channel           | string | No       | Filter by channel (`web`, `api`, `slack`, `email`, `sms`, `custom`)           |
| participantUserId | string | No       | Filter by participant user ID                                                 |
| tag               | string | No       | Filter by tag                                                                 |
| workflowId        | string | No       | Filter by linked workflow                                                     |
| search            | string | No       | Search in title and summary                                                   |
| createdAfter      | string | No       | Filter conversations created after this ISO date                              |
| createdBefore     | string | No       | Filter conversations created before this ISO date                             |
| limit             | number | No       | Maximum number of results (default: 20, max: 100)                             |
| cursor            | string | No       | Pagination cursor for next page                                               |

**Response:**

```json
{
  "items": [
    {
      "id": "cnv_abc123",
      "title": "Customer Support Inquiry",
      "status": "active",
      "messageCount": 5
    }
  ],
  "nextCursor": "abc123...",
  "hasMore": true
}
```

### conversation_append

Append a new message to an existing conversation.

**Parameters:**

| Name                    | Type   | Required | Description                                                                  |
| ----------------------- | ------ | -------- | ---------------------------------------------------------------------------- |
| conversationId          | string | Yes      | The conversation ID to append to                                             |
| role                    | string | Yes      | Who is sending the message (`user`, `assistant`, `system`, `human_operator`) |
| content                 | string | Yes      | Message content                                                              |
| contentType             | string | No       | Content format (`text`, `markdown`, `html`, `json`, default: `text`)         |
| userId                  | string | No       | User ID of sender (if applicable)                                            |
| senderName              | string | No       | Display name of sender                                                       |
| attachments             | array  | No       | File attachments                                                             |
| attachments[].fileName  | string | Yes      | File name                                                                    |
| attachments[].mimeType  | string | Yes      | MIME type                                                                    |
| attachments[].sizeBytes | number | Yes      | File size in bytes                                                           |
| attachments[].url       | string | Yes      | File URL                                                                     |
| toolCalls               | array  | No       | Tool calls made in this message (for AI messages)                            |
| toolCalls[].name        | string | Yes      | Tool name                                                                    |
| toolCalls[].arguments   | object | Yes      | Tool arguments                                                               |
| toolCalls[].result      | object | No       | Tool result                                                                  |
| tokenUsage              | object | No       | Token usage for AI messages                                                  |
| tokenUsage.input        | number | Yes      | Input tokens                                                                 |
| tokenUsage.output       | number | Yes      | Output tokens                                                                |
| tokenUsage.total        | number | Yes      | Total tokens                                                                 |
| metadata                | object | No       | Additional metadata                                                          |

**Response:**

```json
{
  "id": "msg_xyz789",
  "conversationId": "cnv_abc123",
  "role": "assistant",
  "content": "Here's the information you requested...",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## User & Group Tools

### user_list

List users with optional filtering. Returns paginated results.

**Parameters:**

| Name    | Type   | Required | Description                                                          |
| ------- | ------ | -------- | -------------------------------------------------------------------- |
| status  | string | No       | Filter by user status (`active`, `inactive`, `pending`, `suspended`) |
| role    | string | No       | Filter by user role (`admin`, `manager`, `operator`, `viewer`)       |
| groupId | string | No       | Filter by group membership                                           |
| search  | string | No       | Search in name and email                                             |
| limit   | number | No       | Maximum number of results (default: 20, max: 100)                    |
| cursor  | string | No       | Pagination cursor for next page                                      |

**Response:**

```json
{
  "items": [
    {
      "id": "user_abc123",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
      "role": "operator"
    }
  ],
  "nextCursor": "abc123...",
  "hasMore": true
}
```

### group_list

List groups with optional filtering. Returns paginated results.

**Parameters:**

| Name         | Type    | Required | Description                                          |
| ------------ | ------- | -------- | ---------------------------------------------------- |
| isAssignable | boolean | No       | Filter by whether group can receive task assignments |
| search       | string  | No       | Search in name and description                       |
| limit        | number  | No       | Maximum number of results (default: 20, max: 100)    |
| cursor       | string  | No       | Pagination cursor for next page                      |

**Response:**

```json
{
  "items": [
    {
      "id": "grp_abc123",
      "name": "Support L1",
      "description": "First-line support team",
      "isAssignable": true
    }
  ],
  "nextCursor": "abc123...",
  "hasMore": true
}
```

## Resources

MCP resources provide read-only access to system state:

### orkestra://workflows

List available workflow definitions.

**Response:**

```json
{
  "workflows": [
    {
      "name": "customer-support",
      "version": "1.0.0",
      "description": "Handle customer support requests with human escalation",
      "inputSchema": {
        "type": "object",
        "properties": {
          "question": { "type": "string" },
          "customerId": { "type": "string" },
          "channel": { "type": "string" }
        },
        "required": ["question"]
      }
    }
  ]
}
```

### orkestra://tasks/pending

Get pending tasks for current user.

**Response:**

```json
{
  "items": [
    {
      "id": "tsk_abc123",
      "title": "Review document",
      "status": "pending",
      "priority": "medium",
      "dueAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### orkestra://tenant/config

Get current tenant configuration.

**Response:**

```json
{
  "tenant": {
    "id": "ten_example",
    "name": "Example Tenant",
    "status": "active"
  },
  "config": {
    "timezone": "UTC",
    "locale": "en-US",
    "features": {
      "workflows": true,
      "tasks": true,
      "conversations": true
    }
  },
  "limits": {
    "maxWorkflowsPerDay": 1000,
    "maxTasksPerWorkflow": 100,
    "maxUsersPerTenant": 100
  }
}
```

## Error Handling

All MCP tools return errors in the following format:

```json
{
  "success": false,
  "error": "Error message description",
  "errorCode": "VALIDATION_ERROR"
}
```

**Common Error Codes:**

| Code                | Description              |
| ------------------- | ------------------------ |
| `NOT_FOUND`         | Resource not found       |
| `VALIDATION_ERROR`  | Invalid input parameters |
| `PERMISSION_DENIED` | Insufficient permissions |
| `CONFLICT`          | Resource state conflict  |
| `INTERNAL_ERROR`    | Unexpected server error  |

## Implementation Reference

- MCP Server: `packages/mcp-server/src/tools/`
  - Workflows: `workflows.ts:13-144`
  - Tasks: `tasks.ts:13-283`
  - Conversations: `conversations.ts:13-216`
  - Users: `users.ts:13-73`
- Resources: `packages/mcp-server/src/resources/handlers.ts:13-214`
