# REST API Reference

Orkestra exposes its functionality via a REST API built with tRPC, providing type-safe, validated endpoints for workflows, tasks, conversations, and administrative operations.

## Overview

- **Base URL**: `http://localhost:3000`
- **Protocol**: tRPC (HTTP with JSON payloads)
- **Authentication**: Bearer token in `Authorization` header
- **Content-Type**: `application/json`

All endpoints follow the pattern: `/trpc/{router}.{procedure}`

### Request Format

```bash
curl -X POST http://localhost:3000/trpc/workflow.start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"input": {"type": "customer-support", "input": {...}}}'
```

### Response Format

**Success Response:**

```json
{
  "result": {
    "data": { ... }
  }
}
```

**Error Response:**

```json
{
  "error": {
    "message": "Error description",
    "code": "BAD_REQUEST",
    "httpStatus": 400
  }
}
```

## Authentication

All API requests require authentication via Bearer token:

```http
Authorization: Bearer <your-api-token>
```

### Authorization Levels

| Level     | Description        | Required For                           |
| --------- | ------------------ | -------------------------------------- |
| `authed`  | Authenticated user | Most operations                        |
| `manager` | Manager role       | User listing, task management          |
| `admin`   | Administrator      | User/group creation, tenant management |

---

## Workflows

Workflow operations for starting, querying, and managing workflow instances.

### `POST /trpc/workflow.start`

Start a new workflow instance.

**Parameters:**

| Name                              | Type   | Required | Description         |
| --------------------------------- | ------ | -------- | ------------------- |
| `type`                            | string | Yes      | Workflow type name  |
| `input`                           | object | Yes      | Workflow input data |
| `options`                         | object | No       | Execution options   |
| `options.workflowId`              | string | No       | Custom workflow ID  |
| `options.taskQueue`               | string | No       | Task queue name     |
| `options.executionTimeoutSeconds` | number | No       | Execution timeout   |
| `options.runTimeoutSeconds`       | number | No       | Run timeout         |
| `options.searchAttributes`        | object | No       | Search attributes   |
| `options.memo`                    | object | No       | Memo data           |
| `options.retry`                   | object | No       | Retry policy        |
| `metadata`                        | object | No       | Additional metadata |

**Request:**

```json
{
  "type": "customer-support",
  "input": {
    "question": "How do I reset my password?",
    "customerId": "cust_123"
  },
  "options": {
    "workflowId": "custom-wf-id",
    "taskQueue": "support-tasks"
  },
  "metadata": {
    "channel": "web"
  }
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "wf_abc123xyz",
      "tenantId": "tenant_456",
      "temporalWorkflowId": "custom-wf-id",
      "temporalRunId": "run_789def",
      "type": "customer-support",
      "status": "running",
      "input": {
        "question": "How do I reset my password?",
        "customerId": "cust_123"
      },
      "output": null,
      "error": null,
      "startedBy": "user_abc",
      "startedAt": "2024-01-15T10:00:00Z",
      "completedAt": null,
      "options": { ... },
      "metadata": { ... },
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### `GET /trpc/workflow.get`

Get details of a specific workflow.

**Parameters:**

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | string | Yes      | Workflow ID |

**Request:**

```bash
curl -X GET 'http://localhost:3000/trpc/workflow.get?input={"id":"wf_abc123xyz"}' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "wf_abc123xyz",
      "type": "customer-support",
      "status": "running",
      "input": { ... },
      "output": { ... },
      "startedAt": "2024-01-15T10:00:00Z",
      "completedAt": "2024-01-15T11:00:00Z"
    }
  }
}
```

### `GET /trpc/workflow.list`

List workflows with optional filtering.

**Parameters:**

| Name                   | Type            | Required | Description                       |
| ---------------------- | --------------- | -------- | --------------------------------- |
| `filter`               | object          | No       | Filter criteria                   |
| `filter.type`          | string          | No       | Filter by workflow type           |
| `filter.status`        | string or array | No       | Filter by status                  |
| `filter.startedAfter`  | string          | No       | ISO datetime filter               |
| `filter.startedBefore` | string          | No       | ISO datetime filter               |
| `filter.startedBy`     | string          | No       | Filter by starter                 |
| `pagination`           | object          | No       | Pagination options                |
| `pagination.page`      | number          | No       | Page number (default: 1)          |
| `pagination.pageSize`  | number          | No       | Page size (default: 20, max: 100) |

**Request:**

```bash
curl -X GET 'http://localhost:3000/trpc/workflow.list?input={"filter":{"status":["running","completed"]},"pagination":{"page":1,"pageSize":20}}' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "result": {
    "data": {
      "items": [
        {
          "id": "wf_abc123",
          "type": "customer-support",
          "status": "running",
          "startedAt": "2024-01-15T10:00:00Z",
          "completedAt": null
        }
      ],
      "total": 45,
      "hasMore": true
    }
  }
}
```

### `POST /trpc/workflow.signal`

Send a signal to a running workflow.

**Parameters:**

| Name         | Type   | Required | Description      |
| ------------ | ------ | -------- | ---------------- |
| `id`         | string | Yes      | Workflow ID      |
| `signalName` | string | Yes      | Signal name      |
| `args`       | array  | No       | Signal arguments |

**Request:**

```json
{
  "id": "wf_abc123xyz",
  "signalName": "cancelRequested",
  "args": ["reason", "customer requested"]
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "success": true,
      "workflowId": "wf_abc123xyz",
      "signalName": "cancelRequested",
      "signalledAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### `POST /trpc/workflow.cancel`

Cancel a running workflow (manager only).

**Parameters:**

| Name     | Type   | Required | Description         |
| -------- | ------ | -------- | ------------------- |
| `id`     | string | Yes      | Workflow ID         |
| `reason` | string | No       | Cancellation reason |

**Request:**

```json
{
  "id": "wf_abc123xyz",
  "reason": "No longer needed"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "success": true,
      "workflowId": "wf_abc123xyz",
      "cancelledAt": "2024-01-15T10:45:00Z",
      "cancelledBy": "user_manager",
      "reason": "No longer needed"
    }
  }
}
```

### `GET /trpc/workflow.query`

Query workflow state.

**Parameters:**

| Name        | Type   | Required | Description     |
| ----------- | ------ | -------- | --------------- |
| `id`        | string | Yes      | Workflow ID     |
| `queryName` | string | Yes      | Query name      |
| `args`      | array  | No       | Query arguments |

**Response:**

```json
{
  "result": {
    "data": {
      "workflowId": "wf_abc123xyz",
      "queryName": "getState",
      "result": { ... },
      "queriedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### `GET /trpc/workflow.history`

Get workflow history/events.

**Parameters:**

| Name         | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `id`         | string | Yes      | Workflow ID        |
| `pagination` | object | No       | Pagination options |

**Response:**

```json
{
  "result": {
    "data": {
      "workflowId": "wf_abc123xyz",
      "events": [
        {
          "type": "WorkflowExecutionStarted",
          "timestamp": "2024-01-15T10:00:00Z",
          "data": { ... }
        }
      ],
      "total": 15,
      "hasMore": false
    }
  }
}
```

---

## Tasks

Task operations for creating, completing, and managing human tasks.

### `POST /trpc/task.create`

Create a new human task.

**Parameters:**

| Name                     | Type   | Required | Description                                 |
| ------------------------ | ------ | -------- | ------------------------------------------- |
| `type`                   | string | Yes      | Task type identifier                        |
| `title`                  | string | Yes      | Task title                                  |
| `description`            | string | No       | Task description                            |
| `priority`               | string | No       | Priority: `low`, `medium`, `high`, `urgent` |
| `form`                   | object | Yes      | Form schema                                 |
| `form.fields`            | object | Yes      | Field definitions                           |
| `form.fieldOrder`        | array  | No       | Field display order                         |
| `assignment`             | object | Yes      | Assignment target                           |
| `assignment.userId`      | string | No       | Assign to user                              |
| `assignment.groupId`     | string | No       | Assign to group                             |
| `sla`                    | object | No       | SLA configuration                           |
| `sla.dueAt`              | string | No       | ISO 8601 due datetime                       |
| `sla.warnBeforeMinutes`  | number | No       | Warning before due                          |
| `sla.escalation`         | object | No       | Escalation config                           |
| `context`                | object | No       | Context data                                |
| `context.conversationId` | string | No       | Linked conversation                         |
| `context.relatedEntity`  | object | No       | Related entity                              |
| `metadata`               | object | No       | Additional metadata                         |
| `workflowId`             | string | No       | Parent workflow ID                          |

**Form Field Types:**

| Type          | Description            |
| ------------- | ---------------------- |
| `text`        | Single-line text input |
| `textarea`    | Multi-line text input  |
| `number`      | Numeric input          |
| `email`       | Email address          |
| `url`         | URL input              |
| `date`        | Date picker            |
| `datetime`    | Date and time picker   |
| `time`        | Time picker            |
| `select`      | Single dropdown        |
| `multiselect` | Multiple dropdown      |
| `radio`       | Radio button group     |
| `checkbox`    | Single checkbox        |
| `file`        | File upload            |
| `json`        | JSON object input      |

**Request:**

```json
{
  "type": "document-review",
  "title": "Review contract",
  "description": "Please review the attached contract",
  "priority": "high",
  "form": {
    "fields": {
      "approved": {
        "type": "boolean",
        "label": "Do you approve?",
        "required": true
      },
      "notes": {
        "type": "textarea",
        "label": "Review notes"
      }
    }
  },
  "assignment": {
    "groupId": "legal-team"
  },
  "sla": {
    "dueAt": "2024-01-15T18:00:00Z",
    "warnBeforeMinutes": 60
  },
  "context": {
    "conversationId": "conv_abc123"
  }
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "tsk_abc123xyz",
      "type": "document-review",
      "title": "Review contract",
      "status": "pending",
      "priority": "high",
      "form": { ... },
      "assignment": {
        "userId": null,
        "groupId": "legal-team"
      },
      "claimedBy": null,
      "dueAt": "2024-01-15T18:00:00Z",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### `GET /trpc/task.get`

Get task details.

**Parameters:**

| Name             | Type    | Required | Description          |
| ---------------- | ------- | -------- | -------------------- |
| `id`             | string  | Yes      | Task ID              |
| `includeHistory` | boolean | No       | Include task history |

**Response:**

```json
{
  "result": {
    "data": {
      "id": "tsk_abc123xyz",
      "type": "document-review",
      "title": "Review contract",
      "status": "assigned",
      "form": { ... },
      "assignment": { ... },
      "history": [ ... ]
    }
  }
}
```

### `GET /trpc/task.list`

List tasks with filtering.

**Parameters:**

| Name                     | Type            | Required | Description           |
| ------------------------ | --------------- | -------- | --------------------- |
| `filter`                 | object          | No       | Filter criteria       |
| `filter.status`          | string or array | No       | Task status filter    |
| `filter.priority`        | string or array | No       | Priority filter       |
| `filter.type`            | string or array | No       | Task type filter      |
| `filter.assignedUserId`  | string          | No       | Filter by user        |
| `filter.assignedGroupId` | string          | No       | Filter by group       |
| `filter.claimedBy`       | string          | No       | Filter by claimer     |
| `filter.workflowId`      | string          | No       | Filter by workflow    |
| `filter.dueBefore`       | string          | No       | ISO datetime filter   |
| `filter.dueAfter`        | string          | No       | ISO datetime filter   |
| `filter.search`          | string          | No       | Text search           |
| `sort`                   | object          | No       | Sort options          |
| `sort.field`             | string          | No       | Sort field            |
| `sort.direction`         | string          | No       | Sort direction        |
| `pagination`             | object          | No       | Pagination options    |
| `pagination.skip`        | number          | No       | Skip count            |
| `pagination.take`        | number          | No       | Take count (max: 100) |

**Response:**

```json
{
  "result": {
    "data": {
      "items": [
        {
          "id": "tsk_abc123",
          "title": "Review contract",
          "status": "assigned",
          "priority": "high",
          "dueAt": "2024-01-15T18:00:00Z"
        }
      ],
      "total": 12,
      "hasMore": true
    }
  }
}
```

### `GET /trpc/task.pending`

Get pending tasks for the current user.

**Parameters:**

| Name                | Type    | Required | Description                         |
| ------------------- | ------- | -------- | ----------------------------------- |
| `includeGroupTasks` | boolean | No       | Include group tasks (default: true) |

**Response:**

```json
{
  "result": {
    "data": {
      "items": [
        {
          "id": "tsk_abc123",
          "title": "Review contract",
          "status": "pending",
          "priority": "high"
        }
      ],
      "total": 5
    }
  }
}
```

### `POST /trpc/task.claim`

Claim a task (take ownership from a group).

**Parameters:**

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | string | Yes      | Task ID     |

**Response:**

```json
{
  "result": {
    "data": {
      "id": "tsk_abc123xyz",
      "status": "in_progress",
      "claimedBy": "user_abc",
      "claimedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### `POST /trpc/task.unclaim`

Unclaim a task (release back to group).

**Parameters:**

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | string | Yes      | Task ID     |

### `POST /trpc/task.complete`

Complete a task with form data.

**Parameters:**

| Name     | Type   | Required | Description                   |
| -------- | ------ | -------- | ----------------------------- |
| `id`     | string | Yes      | Task ID                       |
| `result` | object | Yes      | Form data (must match schema) |

**Request:**

```json
{
  "id": "tsk_abc123xyz",
  "result": {
    "approved": true,
    "notes": "Everything looks good"
  }
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "tsk_abc123xyz",
      "status": "completed",
      "result": {
        "approved": true,
        "notes": "Everything looks good"
      },
      "completedAt": "2024-01-15T11:00:00Z",
      "completedBy": "user_abc"
    }
  }
}
```

### `POST /trpc/task.reassign`

Reassign a task (manager only).

**Parameters:**

| Name               | Type   | Required | Description             |
| ------------------ | ------ | -------- | ----------------------- |
| `id`               | string | Yes      | Task ID                 |
| `assignTo.userId`  | string | No       | New assigned user       |
| `assignTo.groupId` | string | No       | New assigned group      |
| `reason`           | string | No       | Reason for reassignment |

**Request:**

```json
{
  "id": "tsk_abc123xyz",
  "assignTo": {
    "userId": "user_def456"
  },
  "reason": "Reassigned for better expertise"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "tsk_abc123xyz",
      "assignment": {
        "userId": "user_def456",
        "groupId": null
      },
      "reassignedAt": "2024-01-15T12:00:00Z"
    }
  }
}
```

### `POST /trpc/task.cancel`

Cancel a task (manager only).

**Parameters:**

| Name     | Type   | Required | Description         |
| -------- | ------ | -------- | ------------------- |
| `id`     | string | Yes      | Task ID             |
| `reason` | string | No       | Cancellation reason |

### `POST /trpc/task.addComment`

Add a comment to a task.

**Parameters:**

| Name      | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| `id`      | string | Yes      | Task ID         |
| `content` | string | Yes      | Comment content |

**Response:**

```json
{
  "result": {
    "data": {
      "taskId": "tsk_abc123xyz",
      "content": "Need more information",
      "createdBy": "user_abc",
      "createdAt": "2024-01-15T11:30:00Z"
    }
  }
}
```

### `GET /trpc/task.stats`

Get task statistics.

**Response:**

```json
{
  "result": {
    "data": {
      "total": 150,
      "byStatus": {
        "pending": 45,
        "assigned": 30,
        "in_progress": 25,
        "completed": 40,
        "cancelled": 10
      },
      "byPriority": {
        "low": 20,
        "medium": 80,
        "high": 40,
        "urgent": 10
      }
    }
  }
}
```

---

## Conversations

Conversation operations for tracking AI-human interactions.

### `POST /trpc/conversation.create`

Create a new conversation.

**Parameters:**

| Name           | Type   | Required | Description                                              |
| -------------- | ------ | -------- | -------------------------------------------------------- |
| `title`        | string | No       | Conversation title                                       |
| `channel`      | string | Yes      | Channel: `web`, `api`, `slack`, `email`, `sms`, `custom` |
| `externalId`   | string | No       | External reference ID                                    |
| `participants` | array  | No       | Initial participants                                     |
| `tags`         | array  | No       | Tags for categorization                                  |
| `workflowId`   | string | No       | Linked workflow                                          |
| `metadata`     | object | No       | Additional metadata                                      |

**Request:**

```json
{
  "title": "Customer Support Inquiry",
  "channel": "web",
  "externalId": "ticket-12345",
  "participants": [
    {
      "userId": "user_abc123",
      "role": "user",
      "name": "John Doe"
    }
  ],
  "tags": ["support", "billing"],
  "workflowId": "wf_xyz789"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "conv_abc123xyz",
      "title": "Customer Support Inquiry",
      "channel": "web",
      "status": "active",
      "messageCount": 0,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### `GET /trpc/conversation.get`

Get a conversation.

**Parameters:**

| Name              | Type    | Required | Description                            |
| ----------------- | ------- | -------- | -------------------------------------- |
| `id`              | string  | Yes      | Conversation ID                        |
| `includeMessages` | boolean | No       | Include messages                       |
| `messageLimit`    | number  | No       | Max messages (default: 100, max: 1000) |

**Response:**

```json
{
  "result": {
    "data": {
      "id": "conv_abc123xyz",
      "title": "Customer Support Inquiry",
      "channel": "web",
      "status": "active",
      "messages": [
        {
          "id": "msg_def456",
          "role": "user",
          "content": "I need help with billing",
          "createdAt": "2024-01-15T10:00:00Z"
        }
      ],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### `GET /trpc/conversation.getByExternalId`

Get a conversation by external ID.

**Parameters:**

| Name         | Type   | Required | Description |
| ------------ | ------ | -------- | ----------- |
| `externalId` | string | Yes      | External ID |

### `GET /trpc/conversation.list`

List conversations.

**Parameters:**

| Name                   | Type            | Required | Description         |
| ---------------------- | --------------- | -------- | ------------------- |
| `filter`               | object          | No       | Filter criteria     |
| `filter.status`        | string or array | No       | Status filter       |
| `filter.channel`       | string or array | No       | Channel filter      |
| `filter.tag`           | string          | No       | Tag filter          |
| `filter.workflowId`    | string          | No       | Workflow filter     |
| `filter.createdAfter`  | string          | No       | ISO datetime filter |
| `filter.createdBefore` | string          | No       | ISO datetime filter |
| `filter.search`        | string          | No       | Text search         |
| `sort`                 | object          | No       | Sort options        |
| `pagination`           | object          | No       | Pagination options  |

### `POST /trpc/conversation.update`

Update a conversation.

**Parameters:**

| Name       | Type   | Required | Description          |
| ---------- | ------ | -------- | -------------------- |
| `id`       | string | Yes      | Conversation ID      |
| `title`    | string | No       | New title            |
| `status`   | string | No       | New status           |
| `summary`  | string | No       | Conversation summary |
| `tags`     | array  | No       | Update tags          |
| `metadata` | object | No       | Update metadata      |

### `POST /trpc/conversation.append`

Append a message to a conversation.

**Parameters:**

| Name             | Type   | Required | Description                                           |
| ---------------- | ------ | -------- | ----------------------------------------------------- |
| `conversationId` | string | Yes      | Conversation ID                                       |
| `role`           | string | Yes      | Role: `user`, `assistant`, `system`, `human_operator` |
| `content`        | string | Yes      | Message content                                       |
| `contentType`    | string | No       | Format: `text`, `markdown`, `html`, `json`            |
| `senderName`     | string | No       | Sender display name                                   |
| `attachments`    | array  | No       | File attachments                                      |
| `toolCalls`      | array  | No       | Tool calls (for AI)                                   |
| `tokenUsage`     | object | No       | Token usage stats                                     |
| `metadata`       | object | No       | Additional metadata                                   |

**Request:**

```json
{
  "conversationId": "conv_abc123xyz",
  "role": "assistant",
  "content": "I can help you with your billing question...",
  "contentType": "text",
  "tokenUsage": {
    "input": 50,
    "output": 100,
    "total": 150
  }
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "msg_def456",
      "conversationId": "conv_abc123xyz",
      "role": "assistant",
      "content": "I can help you with your billing question...",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### `GET /trpc/conversation.messages`

Get messages from a conversation.

**Parameters:**

| Name             | Type   | Required | Description          |
| ---------------- | ------ | -------- | -------------------- |
| `conversationId` | string | Yes      | Conversation ID      |
| `pagination`     | object | No       | Pagination options   |
| `orderDirection` | string | No       | Order: `asc`, `desc` |

### `GET /trpc/conversation.lastMessages`

Get the last N messages.

**Parameters:**

| Name             | Type   | Required | Description                   |
| ---------------- | ------ | -------- | ----------------------------- |
| `conversationId` | string | Yes      | Conversation ID               |
| `count`          | number | No       | Count (default: 10, max: 100) |

### `POST /trpc/conversation.resolve`

Mark a conversation as resolved.

**Parameters:**

| Name      | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| `id`      | string | Yes      | Conversation ID    |
| `summary` | string | No       | Resolution summary |

### `POST /trpc/conversation.archive`

Archive a conversation.

**Parameters:**

| Name | Type   | Required | Description     |
| ---- | ------ | -------- | --------------- |
| `id` | string | Yes      | Conversation ID |

### `GET /trpc/conversation.stats`

Get conversation statistics.

---

## Administration

Administrative operations for tenant, user, and group management.

### `GET /trpc/admin.getTenant`

Get current tenant information (admin only).

**Response:**

```json
{
  "result": {
    "data": {
      "id": "tenant_abc123",
      "name": "Acme Corp",
      "status": "active",
      "config": {
        "timezone": "UTC",
        "locale": "en-US",
        "features": {
          "workflows": true,
          "tasks": true
        }
      },
      "limits": {
        "maxUsers": 100,
        "maxConcurrentWorkflows": 50
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### `POST /trpc/admin.updateTenant`

Update tenant configuration (admin only).

**Parameters:**

| Name              | Type   | Required | Description                                          |
| ----------------- | ------ | -------- | ---------------------------------------------------- |
| `name`            | string | No       | Tenant name                                          |
| `status`          | string | No       | Status: `active`, `suspended`, `pending`, `archived` |
| `config`          | object | No       | Configuration updates                                |
| `config.timezone` | string | No       | Timezone                                             |
| `config.locale`   | string | No       | Locale                                               |
| `config.features` | object | No       | Feature flags                                        |
| `config.branding` | object | No       | Branding settings                                    |
| `config.webhooks` | object | No       | Webhook configuration                                |
| `limits`          | object | No       | Limit updates                                        |
| `metadata`        | object | No       | Metadata updates                                     |

### `GET /trpc/admin.listUsers`

List users in tenant (manager only).

**Parameters:**

| Name             | Type            | Required | Description        |
| ---------------- | --------------- | -------- | ------------------ |
| `filter`         | object          | No       | Filter criteria    |
| `filter.status`  | string or array | No       | User status        |
| `filter.role`    | string or array | No       | User role          |
| `filter.groupId` | string          | No       | Group membership   |
| `filter.search`  | string          | No       | Text search        |
| `sort`           | object          | No       | Sort options       |
| `pagination`     | object          | No       | Pagination options |

**Response:**

```json
{
  "result": {
    "data": {
      "items": [
        {
          "id": "user_abc123",
          "name": "John Doe",
          "email": "john@example.com",
          "status": "active",
          "role": "operator",
          "createdAt": "2024-01-01T00:00:00Z"
        }
      ],
      "total": 25,
      "hasMore": false
    }
  }
}
```

### `GET /trpc/admin.getUser`

Get a user by ID (manager only).

**Parameters:**

| Name            | Type    | Required | Description               |
| --------------- | ------- | -------- | ------------------------- |
| `id`            | string  | Yes      | User ID                   |
| `includeGroups` | boolean | No       | Include group memberships |

### `POST /trpc/admin.createUser`

Create a new user (admin only).

**Parameters:**

| Name                        | Type   | Required | Description                                    |
| --------------------------- | ------ | -------- | ---------------------------------------------- |
| `email`                     | string | Yes      | User email                                     |
| `name`                      | string | Yes      | User name                                      |
| `role`                      | string | Yes      | Role: `admin`, `manager`, `operator`, `viewer` |
| `preferences`               | object | No       | User preferences                               |
| `preferences.timezone`      | string | No       | Timezone                                       |
| `preferences.locale`        | string | No       | Locale                                         |
| `preferences.notifications` | object | No       | Notification settings                          |
| `preferences.ui`            | object | No       | UI preferences                                 |
| `metadata`                  | object | No       | Additional metadata                            |

**Request:**

```json
{
  "email": "jane@example.com",
  "name": "Jane Smith",
  "role": "operator",
  "preferences": {
    "timezone": "America/New_York",
    "locale": "en-US",
    "notifications": {
      "taskAssigned": true,
      "taskDueSoon": true
    }
  }
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "user_def456",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "operator",
      "status": "pending",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### `POST /trpc/admin.updateUser`

Update a user (admin only).

**Parameters:**

| Name          | Type   | Required | Description        |
| ------------- | ------ | -------- | ------------------ |
| `id`          | string | Yes      | User ID            |
| `email`       | string | No       | Update email       |
| `name`        | string | No       | Update name        |
| `avatarUrl`   | string | No       | Update avatar URL  |
| `status`      | string | No       | Update status      |
| `role`        | string | No       | Update role        |
| `preferences` | object | No       | Update preferences |
| `metadata`    | object | No       | Update metadata    |

### `POST /trpc/admin.deleteUser`

Delete a user (admin only).

**Parameters:**

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | string | Yes      | User ID     |

### `GET /trpc/admin.listGroups`

List groups in tenant (manager only).

**Parameters:**

| Name                  | Type    | Required | Description              |
| --------------------- | ------- | -------- | ------------------------ |
| `filter`              | object  | No       | Filter criteria          |
| `filter.isAssignable` | boolean | No       | Filter assignable status |
| `filter.search`       | string  | No       | Text search              |
| `sort`                | object  | No       | Sort options             |
| `pagination`          | object  | No       | Pagination options       |

**Response:**

```json
{
  "result": {
    "data": {
      "items": [
        {
          "id": "grp_abc123",
          "name": "Support L1",
          "slug": "support-l1",
          "description": "First-line support team",
          "isAssignable": true,
          "memberCount": 5
        }
      ],
      "total": 8,
      "hasMore": false
    }
  }
}
```

### `GET /trpc/admin.getGroup`

Get a group by ID (manager only).

**Parameters:**

| Name             | Type    | Required | Description     |
| ---------------- | ------- | -------- | --------------- |
| `id`             | string  | Yes      | Group ID        |
| `includeMembers` | boolean | No       | Include members |

### `POST /trpc/admin.createGroup`

Create a new group (admin only).

**Parameters:**

| Name           | Type    | Required | Description         |
| -------------- | ------- | -------- | ------------------- |
| `name`         | string  | Yes      | Group name          |
| `slug`         | string  | Yes      | URL-friendly slug   |
| `description`  | string  | No       | Group description   |
| `isAssignable` | boolean | No       | Can receive tasks   |
| `metadata`     | object  | No       | Additional metadata |

**Request:**

```json
{
  "name": "Legal Team",
  "slug": "legal-team",
  "description": "Legal review team",
  "isAssignable": true
}
```

### `POST /trpc/admin.updateGroup`

Update a group (admin only).

**Parameters:**

| Name           | Type    | Required | Description              |
| -------------- | ------- | -------- | ------------------------ |
| `id`           | string  | Yes      | Group ID                 |
| `name`         | string  | No       | Update name              |
| `description`  | string  | No       | Update description       |
| `isAssignable` | boolean | No       | Update assignable status |
| `metadata`     | object  | No       | Update metadata          |

### `POST /trpc/admin.updateGroupMembers`

Update group members (admin only).

**Parameters:**

| Name        | Type   | Required | Description       |
| ----------- | ------ | -------- | ----------------- |
| `id`        | string | Yes      | Group ID          |
| `memberIds` | array  | Yes      | Array of user IDs |

### `POST /trpc/admin.addGroupMember`

Add a member to a group (admin only).

**Parameters:**

| Name      | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `groupId` | string | Yes      | Group ID    |
| `userId`  | string | Yes      | User ID     |

### `POST /trpc/admin.removeGroupMember`

Remove a member from a group (admin only).

**Parameters:**

| Name      | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `groupId` | string | Yes      | Group ID    |
| `userId`  | string | Yes      | User ID     |

### `POST /trpc/admin.deleteGroup`

Delete a group (admin only).

**Parameters:**

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | string | Yes      | Group ID    |

---

## Error Codes

| Code                    | HTTP Status | Description                               |
| ----------------------- | ----------- | ----------------------------------------- |
| `BAD_REQUEST`           | 400         | Invalid input parameters                  |
| `UNAUTHORIZED`          | 401         | Missing or invalid authentication         |
| `FORBIDDEN`             | 403         | Insufficient permissions                  |
| `NOT_FOUND`             | 404         | Resource not found                        |
| `CONFLICT`              | 409         | Resource state conflict (e.g., duplicate) |
| `INTERNAL_SERVER_ERROR` | 500         | Unexpected server error                   |

---

## Rate Limiting

API requests are rate limited per tenant:

| Tier     | Requests/Minute | Requests/Day |
| -------- | --------------- | ------------ |
| Basic    | 60              | 10,000       |
| Standard | 600             | 100,000      |
| Premium  | 6,000           | 1,000,000    |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1705262400
```

---

## Implementation Reference

- API Router: `packages/api/src/trpc/routers/`
  - Workflows: `workflow.ts:72-259`
  - Tasks: `task.ts:195-690`
  - Conversations: `conversation.ts:140-640`
  - Admin: `admin.ts:97-802`
