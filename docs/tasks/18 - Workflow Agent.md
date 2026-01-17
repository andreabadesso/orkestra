# Task 18: Workflow Authoring Agent

## Overview

Build a Claude-powered agent that helps developers write Orkestra workflows through natural conversation.

## Phase

🟣 **Phase 6: Examples**

## Priority

🟢 **Medium** - Nice to have for developer experience

## Estimated Effort

10-12 hours

## Description

Create an AI agent using Claude Agent SDK that can help developers design and write Orkestra workflows by understanding their requirements and generating code.

## Requirements

### Core Capabilities

1. **Understand Requirements** - Parse natural language descriptions of workflow needs
2. **Suggest Patterns** - Recommend appropriate workflow patterns (simple, task, escalation)
3. **Generate Code** - Produce TypeScript workflow code using Orkestra SDK
4. **Validate Output** - Check generated code for errors
5. **Write Files** - Save workflows to the project

### Tools

The agent needs these tools:

- `write_workflow_file` - Write generated workflow to disk
- `analyze_project` - Scan existing project structure
- `validate_workflow` - Run TypeScript compiler on generated code

### Example Interaction

```
You: I want to create a workflow for processing refund requests

Agent: I'd be happy to help you create a refund processing workflow. Let me ask a few questions:

1. Who should handle refund requests? (specific user, team, or based on amount?)
2. What information do you need to collect? (reason, amount, approval?)
3. Do you need SLAs? (e.g., must be processed within 24 hours)
4. Should high-value refunds require additional approval?

You: Refunds under $100 can be auto-approved. Over $100 needs manager approval within 4 hours.

Agent: Got it! Here's the workflow I'll create:

[Generates refund-processing.ts with:
- Amount check for auto-approval threshold
- Manager task for high-value refunds
- 4-hour SLA with escalation
- Form for approval decision and notes]

Would you like me to write this to src/workflows/refund-processing.ts?
```

## Acceptance Criteria

- [ ] Agent understands workflow requirements from conversation
- [ ] Generates valid Orkestra SDK code
- [ ] Handles all workflow patterns (simple, task, escalation)
- [ ] Validates generated code before saving
- [ ] Integrates with CLI (`orkestra workflow` command)
- [ ] Remembers context throughout conversation

## Dependencies

- [[07 - SDK Workflow Helpers]]
- [[13 - CLI Tool]]
- [[15 - Documentation]]

## Blocked By

- [[07 - SDK Workflow Helpers]] - Need SDK patterns to generate

## Blocks

None - this is a developer experience enhancement

## Technical Notes

### Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0"
  }
}
```

### CLI Integration

```bash
# Interactive workflow builder
npx orkestra workflow

# Or with initial prompt
npx orkestra workflow "create a customer onboarding workflow"
```

## References

- [Anthropic SDK](https://docs.anthropic.com/)
- [Claude Tool Use](https://docs.anthropic.com/claude/docs/tool-use)

## Tags

#orkestra #task #agent #workflow-builder #developer-experience
