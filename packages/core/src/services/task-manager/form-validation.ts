/**
 * Form Validation Module
 *
 * Provides dynamic form validation using Zod schemas.
 * Validates form data against FormSchema definitions.
 */

import { z } from 'zod';
import type { FormSchema, FormField, ServiceFormFieldType } from './types.js';
import { ValidationError } from '../../errors/index.js';

/**
 * Build a Zod schema for a single form field
 *
 * @param fieldName - Field name for error messages
 * @param field - Field definition
 * @returns Zod schema for the field
 */
function buildFieldSchema(fieldName: string, field: FormField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case 'text':
    case 'textarea': {
      let textSchema = z.string();

      if (field.validation?.min !== undefined) {
        textSchema = textSchema.min(
          field.validation.min,
          field.validation.message ?? `${fieldName} must be at least ${field.validation.min} characters`
        );
      }

      if (field.validation?.max !== undefined) {
        textSchema = textSchema.max(
          field.validation.max,
          field.validation.message ?? `${fieldName} must be at most ${field.validation.max} characters`
        );
      }

      if (field.validation?.pattern) {
        textSchema = textSchema.regex(
          new RegExp(field.validation.pattern),
          field.validation.message ?? `${fieldName} has invalid format`
        );
      }

      schema = textSchema;
      break;
    }

    case 'number': {
      let numSchema = z.number({
        message: `${fieldName} must be a number`,
      });

      if (field.validation?.min !== undefined) {
        numSchema = numSchema.min(
          field.validation.min,
          field.validation.message ?? `${fieldName} must be at least ${field.validation.min}`
        );
      }

      if (field.validation?.max !== undefined) {
        numSchema = numSchema.max(
          field.validation.max,
          field.validation.message ?? `${fieldName} must be at most ${field.validation.max}`
        );
      }

      schema = numSchema;
      break;
    }

    case 'boolean': {
      schema = z.boolean({
        message: `${fieldName} must be a boolean`,
      });
      break;
    }

    case 'date': {
      // Accept ISO date strings or Date objects
      schema = z.union([
        z.string().datetime({ message: `${fieldName} must be a valid ISO date string` }),
        z.string().date(`${fieldName} must be a valid date string`),
        z.date(),
      ]);
      break;
    }

    case 'select': {
      if (!field.options || field.options.length === 0) {
        schema = z.string();
      } else {
        const validValues = field.options.map((opt) => opt.value);
        schema = z.enum(validValues as [string, ...string[]], {
          message: `${fieldName} must be one of: ${validValues.join(', ')}`,
        });
      }
      break;
    }

    default: {
      // Fallback for unknown types - accept any value
      schema = z.unknown();
    }
  }

  // Handle required/optional
  if (!field.required) {
    schema = schema.optional().nullable();
  }

  return schema;
}

/**
 * Build a complete Zod schema from a FormSchema
 *
 * @param formSchema - Form schema definition
 * @returns Zod object schema
 */
export function buildFormValidator(formSchema: FormSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [fieldName, field] of Object.entries(formSchema.fields)) {
    shape[fieldName] = buildFieldSchema(fieldName, field);
  }

  return z.object(shape);
}

/**
 * Validation result
 */
export interface FormValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validated and coerced data */
  data: Record<string, unknown> | null;
  /** Validation errors by field */
  errors: Record<string, string[]>;
}

/**
 * Validate form data against a form schema
 *
 * @param formSchema - Form schema definition
 * @param formData - Form data to validate
 * @returns Validation result
 */
export function validateFormData(
  formSchema: FormSchema,
  formData: Record<string, unknown>
): FormValidationResult {
  const validator = buildFormValidator(formSchema);

  const result = validator.safeParse(formData);

  if (result.success) {
    return {
      valid: true,
      data: result.data,
      errors: {},
    };
  }

  // Map Zod errors to our format
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return {
    valid: false,
    data: null,
    errors,
  };
}

/**
 * Validate form data and throw if invalid
 *
 * @param formSchema - Form schema definition
 * @param formData - Form data to validate
 * @returns Validated data
 * @throws ValidationError if validation fails
 */
export function validateFormDataOrThrow(
  formSchema: FormSchema,
  formData: Record<string, unknown>
): Record<string, unknown> {
  const result = validateFormData(formSchema, formData);

  if (!result.valid) {
    throw new ValidationError('Form validation failed', {
      fieldErrors: result.errors,
    });
  }

  return result.data!;
}

/**
 * Apply default values to form data
 *
 * @param formSchema - Form schema definition
 * @param formData - Partial form data
 * @returns Form data with defaults applied
 */
export function applyDefaults(
  formSchema: FormSchema,
  formData: Record<string, unknown> = {}
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...formData };

  for (const [fieldName, field] of Object.entries(formSchema.fields)) {
    if (result[fieldName] === undefined && field.default !== undefined) {
      result[fieldName] = field.default;
    }
  }

  return result;
}

/**
 * Check if a form schema is valid (well-formed)
 *
 * @param formSchema - Form schema to validate
 * @returns True if schema is valid
 */
export function isValidFormSchema(formSchema: unknown): formSchema is FormSchema {
  if (!formSchema || typeof formSchema !== 'object') {
    return false;
  }

  const schema = formSchema as Record<string, unknown>;
  const schemaFields = schema['fields'];

  if (!schemaFields || typeof schemaFields !== 'object') {
    return false;
  }

  const validTypes: ServiceFormFieldType[] = ['text', 'textarea', 'boolean', 'select', 'number', 'date'];

  for (const [_fieldName, fieldValue] of Object.entries(schemaFields)) {
    if (!fieldValue || typeof fieldValue !== 'object') {
      return false;
    }

    const field = fieldValue as Record<string, unknown>;
    const fieldType = field['type'];

    if (!fieldType || typeof fieldType !== 'string') {
      return false;
    }

    if (!validTypes.includes(fieldType as ServiceFormFieldType)) {
      return false;
    }

    // Validate select options if present
    const fieldOptions = field['options'];
    if (fieldType === 'select' && fieldOptions) {
      if (!Array.isArray(fieldOptions)) {
        return false;
      }

      for (const option of fieldOptions) {
        if (
          !option ||
          typeof option !== 'object' ||
          typeof (option as Record<string, unknown>)['value'] !== 'string' ||
          typeof (option as Record<string, unknown>)['label'] !== 'string'
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Get required field names from a form schema
 *
 * @param formSchema - Form schema definition
 * @returns Array of required field names
 */
export function getRequiredFields(formSchema: FormSchema): string[] {
  return Object.entries(formSchema.fields)
    .filter(([_, field]) => field.required)
    .map(([name]) => name);
}

/**
 * Convert Prisma form schema (JSON) to FormSchema type
 *
 * @param prismaSchema - Form schema from database (as JSON)
 * @returns Typed FormSchema or null if invalid
 */
export function parseFormSchema(prismaSchema: unknown): FormSchema | null {
  if (!isValidFormSchema(prismaSchema)) {
    return null;
  }

  return prismaSchema as FormSchema;
}
