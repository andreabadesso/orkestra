# Form Schemas

This guide covers how to create effective form schemas for human tasks. Forms define the structure of input required from users when completing tasks.

## Table of Contents

- [Field Types](#field-types)
- [Common Patterns](#common-patterns)
- [Validation](#validation)
- [Conditional Fields](#conditional-fields)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Field Types

### Text Fields

Single-line text input for short values like names, IDs, or labels.

```typescript
{
  name: {
    type: 'text',
    label: 'Full Name',
    placeholder: 'Enter your name',
    required: true,
  }
}
```

### Textarea

Multi-line text input for longer content like descriptions, notes, or responses.

```typescript
{
  response: {
    type: 'textarea',
    label: 'Your Response',
    placeholder: 'Please provide detailed feedback...',
    required: true,
    helpText: 'Be specific and include examples if possible',
  }
}
```

### Number Fields

Numeric input for quantities, ratings, or monetary values.

```typescript
{
  quantity: {
    type: 'number',
    label: 'Quantity',
    min: 1,
    max: 100,
    default: 1,
    required: true,
  },
  rating: {
    type: 'number',
    label: 'Customer Rating',
    min: 1,
    max: 5,
    required: true,
    helpText: 'Rate from 1 (poor) to 5 (excellent)',
  }
}
```

### Boolean Fields

Checkbox for yes/no or true/false decisions.

```typescript
{
  approved: {
    type: 'boolean',
    label: 'Approve this request',
    default: false,
    required: true,
  },
  needsFollowUp: {
    type: 'boolean',
    label: 'Requires follow-up',
    helpText: 'Check if additional action is needed',
  }
}
```

### Select Fields

Dropdown for selecting from a predefined set of options.

```typescript
{
  priority: {
    type: 'select',
    label: 'Priority Level',
    required: true,
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent', disabled: true },
    ],
  }
}
```

### Multiselect Fields

Select multiple options from a list.

```typescript
{
  tags: {
    type: 'multiselect',
    label: 'Tags',
    options: [
      { value: 'bug', label: 'Bug' },
      { value: 'feature', label: 'Feature Request' },
      { value: 'enhancement', label: 'Enhancement' },
      { value: 'documentation', label: 'Documentation' },
    ],
  }
}
```

### Radio Fields

Single selection from a group of options (all visible at once).

```typescript
{
  severity: {
    type: 'radio',
    label: 'Issue Severity',
    required: true,
    options: [
      { value: 'critical', label: 'Critical - System down' },
      { value: 'major', label: 'Major - Feature broken' },
      { value: 'minor', label: 'Minor - Workaround available' },
    ],
  }
}
```

### Checkbox Fields

Multiple checkboxes for selecting multiple items.

```typescript
{
  features: {
    type: 'checkbox',
    label: 'Features',
    options: [
      { value: 'search', label: 'Search functionality' },
      { value: 'export', label: 'Data export' },
      { value: 'api', label: 'API access' },
      { value: 'webhooks', label: 'Webhooks' },
    ],
  }
}
```

### Date Fields

Date picker for selecting a date.

```typescript
{
  dueDate: {
    type: 'date',
    label: 'Due Date',
    required: true,
    helpText: 'Select when this should be completed',
  }
}
```

### Datetime Fields

Date and time picker for specific timestamps.

```typescript
{
  scheduledTime: {
    type: 'datetime',
    label: 'Scheduled Time',
    required: true,
  }
}
```

### Email Fields

Email input with validation.

```typescript
{
  contactEmail: {
    type: 'email',
    label: 'Contact Email',
    required: true,
    placeholder: 'user@example.com',
  }
}
```

### URL Fields

URL input with validation.

```typescript
{
  documentationLink: {
    type: 'url',
    label: 'Documentation URL',
    placeholder: 'https://docs.example.com',
  }
}
```

### File Fields

File upload for attachments.

```typescript
{
  attachment: {
    type: 'file',
    label: 'Upload Document',
    helpText: 'PDF, DOC, or images up to 10MB',
  }
}
```

### JSON Fields

JSON input for structured data.

```typescript
{
  metadata: {
    type: 'json',
    label: 'Metadata (JSON)',
    helpText: 'Provide JSON-formatted metadata',
  }
}
```

---

## Common Patterns

### Approval Decision

Standard approve/reject pattern with optional comments.

```typescript
{
  decision: {
    type: 'select',
    label: 'Decision',
    required: true,
    options: [
      { value: 'approve', label: 'Approve' },
      { value: 'reject', label: 'Reject with changes' },
      { value: 'defer', label: 'Defer for later' },
    ],
  },
  comments: {
    type: 'textarea',
    label: 'Comments',
    helpText: 'Provide rationale for your decision',
  }
}
```

### Contact Information

Collecting contact details.

```typescript
{
  name: {
    type: 'text',
    label: 'Full Name',
    required: true,
  },
  email: {
    type: 'email',
    label: 'Email Address',
    required: true,
  },
  phone: {
    type: 'text',
    label: 'Phone Number',
    placeholder: '+1 (555) 123-4567',
  },
  preferredContact: {
    type: 'select',
    label: 'Preferred Contact Method',
    options: [
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
    ],
  }
}
```

### Ticket Classification

Categorizing support tickets or issues.

```typescript
{
  category: {
    type: 'select',
    label: 'Category',
    required: true,
    options: [
      { value: 'technical', label: 'Technical Issue' },
      { value: 'billing', label: 'Billing Question' },
      { value: 'feature', label: 'Feature Request' },
      { value: 'other', label: 'Other' },
    ],
  },
  severity: {
    type: 'radio',
    label: 'Severity',
    required: true,
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ],
  },
  description: {
    type: 'textarea',
    label: 'Description',
    required: true,
  }
}
```

### Document Review

Reviewing documents with annotations.

```typescript
{
  reviewed: {
    type: 'boolean',
    label: 'Document Reviewed',
    required: true,
  },
  approved: {
    type: 'select',
    label: 'Approval Status',
    required: true,
    options: [
      { value: 'approved', label: 'Approved as-is' },
      { value: 'minor_changes', label: 'Approved with minor changes' },
      { value: 'major_changes', label: 'Requires major changes' },
      { value: 'rejected', label: 'Rejected' },
    ],
  },
  reviewNotes: {
    type: 'textarea',
    label: 'Review Notes',
    helpText: 'Document specific feedback or changes required',
  }
}
```

---

## Validation

### Required Fields

Mark fields as required to ensure users provide input.

```typescript
{
  essentialField: {
    type: 'text',
    label: 'Essential Field',
    required: true,
  }
}
```

### Min/Max Values

For number fields, constrain the range.

```typescript
{
  quantity: {
    type: 'number',
    label: 'Quantity',
    min: 1,
    max: 1000,
  }
}
```

### Min/Max Length

For text fields, limit character count.

```typescript
{
  shortCode: {
    type: 'text',
    label: 'Short Code',
    min: 3,
    max: 10,
    helpText: 'Between 3 and 10 characters',
  }
}
```

### Pattern Validation

Use regex for custom validation.

```typescript
{
  postalCode: {
    type: 'text',
    label: 'Postal Code',
    pattern: '^[0-9]{5}(-[0-9]{4})?$',
    helpText: 'Format: 12345 or 12345-6789',
  },
  sku: {
    type: 'text',
    label: 'SKU',
    pattern: '^[A-Z]{3}-[0-9]{4}$',
    helpText: 'Format: ABC-1234',
  }
}
```

---

## Conditional Fields

Use TypeScript type guards for conditional logic in workflows.

```typescript
import { workflow, task } from '@orkestra/sdk';

interface ApprovalForm {
  approved: boolean;
  reason?: string;
  approver?: string;
}

export const approvalWorkflow = workflow<{}, ApprovalForm>('approval', async (ctx) => {
  const result = await task<ApprovalForm>(ctx, {
    title: 'Review Request',
    form: {
      approved: {
        type: 'boolean',
        label: 'Approved',
        required: true,
      },
      reason: {
        type: 'textarea',
        label: 'Reason for Decision',
      },
      approver: {
        type: 'text',
        label: 'Approver Name',
      },
    },
    assignTo: { group: 'approvers' },
  });

  // Conditional logic based on form data
  if (result.data.approved) {
    ctx.log.info('Request approved', { approver: result.data.approver });
  } else {
    ctx.log.info('Request rejected', { reason: result.data.reason });
  }

  return result.data;
});
```

---

## Best Practices

### 1. Use Clear Labels

```typescript
// Good
{
  customerEmail: {
    type: 'email',
    label: 'Customer Email Address',
  }
}

// Bad
{
  customerEmail: {
    type: 'email',
    label: 'Email',
  }
}
```

### 2. Provide Helpful Defaults

```typescript
{
  priority: {
    type: 'select',
    label: 'Priority',
    default: 'medium',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  }
}
```

### 3. Include Help Text

```typescript
{
  budgetAmount: {
    type: 'number',
    label: 'Budget Amount',
    helpText: 'Enter amount in USD, excluding taxes',
  }
}
```

### 4. Use Appropriate Field Types

```typescript
// Good: Select for fixed options
{
  status: {
    type: 'select',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  }
}

// Bad: Text for fixed options
{
  status: {
    type: 'text',
    label: 'Status (active/inactive)',
  }
}
```

### 5. Organize Related Fields

```typescript
{
  // Contact section
  contactName: { type: 'text', label: 'Contact Name' },
  contactEmail: { type: 'email', label: 'Contact Email' },
  contactPhone: { type: 'text', label: 'Contact Phone' },

  // Address section
  addressLine1: { type: 'text', label: 'Address Line 1' },
  city: { type: 'text', label: 'City' },
  state: { type: 'text', label: 'State' },
  zip: { type: 'text', label: 'ZIP Code' },
}
```

### 6. Validate on Both Ends

```typescript
// Form schema with validation
{
  email: {
    type: 'email',
    label: 'Email',
    required: true,
  }
}

// Also validate in workflow
const result = await task(ctx, { /* ... */ });

if (!result.data.email || !isValidEmail(result.data.email)) {
  throw new Error('Invalid email address');
}
```

### 7. Keep Forms Focused

```typescript
// Good: Single purpose form
{
  decision: { type: 'select', label: 'Decision' },
  notes: { type: 'textarea', label: 'Notes' },
}

// Bad: Too many unrelated fields
{
  decision: { type: 'select', label: 'Decision' },
  customerName: { type: 'text', label: 'Customer Name' },
  shippingAddress: { type: 'textarea', label: 'Address' },
  productDetails: { type: 'json', label: 'Products' },
  // ... 10 more fields
}
```

---

## Examples

### Complete Customer Support Form

```typescript
{
  resolution: {
    type: 'textarea',
    label: 'Resolution',
    required: true,
    helpText: 'Provide the solution or response to the customer',
  },
  category: {
    type: 'select',
    label: 'Issue Category',
    required: true,
    options: [
      { value: 'technical', label: 'Technical Issue' },
      { value: 'billing', label: 'Billing' },
      { value: 'account', label: 'Account Management' },
      { value: 'feature', label: 'Feature Request' },
      { value: 'bug', label: 'Bug Report' },
    ],
  },
  severity: {
    type: 'select',
    label: 'Severity',
    required: true,
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ],
  },
  resolved: {
    type: 'boolean',
    label: 'Issue Resolved',
    required: true,
  },
  followUpRequired: {
    type: 'boolean',
    label: 'Requires Follow-up',
    helpText: 'Check if customer needs additional attention',
  },
  followUpDate: {
    type: 'date',
    label: 'Follow-up Date',
    helpText: 'Only needed if follow-up is required',
  }
}
```

### Complete Expense Approval Form

```typescript
{
  approved: {
    type: 'select',
    label: 'Approval Decision',
    required: true,
    options: [
      { value: 'approve', label: 'Approve' },
      { value: 'approve_with_modification', label: 'Approve with Modification' },
      { value: 'reject', label: 'Reject' },
    ],
  },
  approvedAmount: {
    type: 'number',
    label: 'Approved Amount',
    min: 0,
    helpText: 'Only needed if approving with modification',
  },
  comments: {
    type: 'textarea',
    label: 'Comments',
    required: true,
    helpText: 'Provide rationale for your decision',
  },
  categoryCorrection: {
    type: 'select',
    label: 'Correct Expense Category',
    options: [
      { value: 'travel', label: 'Travel' },
      { value: 'meals', label: 'Meals' },
      { value: 'supplies', label: 'Supplies' },
      { value: 'software', label: 'Software' },
      { value: 'other', label: 'Other' },
    ],
  },
  requiresReceipt: {
    type: 'boolean',
    label: 'Requires Additional Documentation',
  }
}
```

---

## Troubleshooting

### Form Not Showing All Fields

**Symptoms**: Some fields are not visible in the Dashboard

**Solutions**:

1. Check if fields are hidden by conditional logic
2. Verify field types are supported
3. Check for disabled fields
4. Clear browser cache

### Validation Not Working

**Symptoms**: Invalid data is accepted

**Solutions**:

1. Verify `required` property is set
2. Check regex patterns are valid
3. Ensure min/max values are appropriate
4. Add backend validation as fallback

```typescript
// Client-side validation
{
  email: {
    type: 'email',
    label: 'Email',
    required: true,
  }
}

// Server-side validation
const result = await task(ctx, { /* ... */ });
if (!validateEmail(result.data.email)) {
  throw new Error('Invalid email address');
}
```

### Options Not Showing

**Symptoms**: Select/radio/multiselect options not displayed

**Solutions**:

1. Verify options array is not empty
2. Check option values are unique
3. Ensure options have both `value` and `label`
4. Check for disabled options

```typescript
// Good
{
  status: {
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  }
}

// Bad: Missing labels
{
  status: {
    type: 'select',
    options: [
      { value: 'active' },
      { value: 'inactive' },
    ],
  }
}
```

### Form Data Not Saving

**Symptoms**: Form submission doesn't persist

**Solutions**:

1. Check network connectivity
2. Verify database is running
3. Check authentication token
4. Review server logs for errors

### Too Many Fields

**Symptoms**: Form is overwhelming or hard to complete

**Solutions**:

1. Break into multiple tasks
2. Use conditional logic to hide irrelevant fields
3. Group related fields with sections
4. Consider using JSON field for complex data

```typescript
// Before: Too many fields
{
  name, email, phone, address, city, state, zip,
  product1, product2, product3, product4, product5,
  // ... 20 more fields
}

// After: Split into multiple tasks
// Task 1: Contact Information
{ name, email, phone }

// Task 2: Shipping Address
{ address, city, state, zip }

// Task 3: Product Details
{ products: { type: 'json', label: 'Products' } }
```

---

## Resources

- [Workflow Guide](./writing-workflows.md)
- [SDK API Reference](../api-reference/sdk-reference.md)
- [Task Concepts](../concepts/tasks.md)
