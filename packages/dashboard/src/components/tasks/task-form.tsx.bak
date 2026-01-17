/**
 * Task Form Component
 *
 * Dynamically renders a form based on a task's form schema.
 * Uses react-hook-form for validation and state management.
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller, type FieldValues, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { FormField, FormFieldType, TaskFormSchema } from '@/types/task';

/**
 * Task form props
 */
interface TaskFormProps {
  /** Form schema from the task */
  schema: TaskFormSchema;
  /** Callback when form is submitted */
  onSubmit: (data: Record<string, unknown>) => void;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Initial values for the form */
  initialValues?: Record<string, unknown>;
  /** Whether the form is disabled */
  disabled?: boolean;
}

/**
 * Build zod schema from form field definition
 */
function buildFieldSchema(field: FormField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
      schema = z.string();
      if (field.type === 'email') {
        schema = (schema as z.ZodString).email(field.validation?.errorMessage || 'Invalid email');
      }
      if (field.type === 'url') {
        schema = (schema as z.ZodString).url(field.validation?.errorMessage || 'Invalid URL');
      }
      if (field.validation?.minLength) {
        schema = (schema as z.ZodString).min(
          field.validation.minLength,
          field.validation.errorMessage || `Minimum ${field.validation.minLength} characters`
        );
      }
      if (field.validation?.maxLength) {
        schema = (schema as z.ZodString).max(
          field.validation.maxLength,
          field.validation.errorMessage || `Maximum ${field.validation.maxLength} characters`
        );
      }
      if (field.validation?.pattern) {
        schema = (schema as z.ZodString).regex(
          new RegExp(field.validation.pattern),
          field.validation.errorMessage || 'Invalid format'
        );
      }
      break;

    case 'number':
      schema = z.coerce.number();
      if (field.validation?.min !== undefined) {
        schema = (schema as z.ZodNumber).min(
          field.validation.min,
          field.validation.errorMessage || `Minimum value is ${field.validation.min}`
        );
      }
      if (field.validation?.max !== undefined) {
        schema = (schema as z.ZodNumber).max(
          field.validation.max,
          field.validation.errorMessage || `Maximum value is ${field.validation.max}`
        );
      }
      break;

    case 'date':
    case 'datetime':
    case 'time':
      schema = z.string();
      break;

    case 'select':
    case 'radio':
      if (field.options && field.options.length > 0) {
        schema = z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;

    case 'multiselect':
      schema = z.array(z.string());
      break;

    case 'checkbox':
      schema = z.boolean();
      break;

    case 'json':
      schema = z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          throw new Error('Invalid JSON');
        }
      });
      break;

    case 'file':
      schema = z.string();
      break;

    default:
      schema = z.unknown();
  }

  // Make optional if not required
  if (!field.validation?.required) {
    if (field.type === 'checkbox') {
      // Checkbox is always boolean
    } else if (field.type === 'multiselect') {
      schema = schema.optional().default([]);
    } else {
      schema = schema.optional().or(z.literal(''));
    }
  }

  return schema;
}

/**
 * Build complete form schema from task form schema
 */
function buildFormSchema(formSchema: TaskFormSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  Object.entries(formSchema.fields).forEach(([fieldName, field]) => {
    shape[fieldName] = buildFieldSchema(field);
  });

  return z.object(shape);
}

/**
 * Get default value for a field type
 */
function getDefaultValue(field: FormField): unknown {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  switch (field.type) {
    case 'checkbox':
      return false;
    case 'multiselect':
      return [];
    case 'number':
      return '';
    default:
      return '';
  }
}

/**
 * Render a form field based on its type
 */
function FormFieldRenderer({
  fieldName,
  field,
  control,
  errors,
  disabled,
  watch,
}: {
  fieldName: string;
  field: FormField;
  control: unknown;
  errors: FieldErrors<Record<string, unknown>>;
  disabled: boolean;
  watch: (name: string) => unknown;
}) {
  // Check conditional visibility
  if (field.showWhen) {
    const watchedValue = watch(field.showWhen.field);
    if (watchedValue !== field.showWhen.equals) {
      return null;
    }
  }

  if (field.hidden) {
    return null;
  }

  const error = errors[fieldName];
  const isDisabled = disabled || field.disabled;

  const fieldStyles = {
    container: {
      marginBottom: '1.25rem',
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#374151',
      marginBottom: '0.375rem',
    },
    required: {
      color: '#ef4444',
      marginLeft: '0.25rem',
    },
    input: {
      width: '100%',
      padding: '0.625rem 0.75rem',
      fontSize: '0.875rem',
      borderRadius: '6px',
      border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
      backgroundColor: isDisabled ? '#f9fafb' : '#ffffff',
      color: '#111827',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.15s',
    },
    textarea: {
      width: '100%',
      padding: '0.625rem 0.75rem',
      fontSize: '0.875rem',
      borderRadius: '6px',
      border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
      backgroundColor: isDisabled ? '#f9fafb' : '#ffffff',
      color: '#111827',
      minHeight: '100px',
      resize: 'vertical' as const,
      fontFamily: 'inherit',
      boxSizing: 'border-box' as const,
    },
    select: {
      width: '100%',
      padding: '0.625rem 0.75rem',
      fontSize: '0.875rem',
      borderRadius: '6px',
      border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
      backgroundColor: isDisabled ? '#f9fafb' : '#ffffff',
      color: '#111827',
      cursor: 'pointer',
      boxSizing: 'border-box' as const,
    },
    checkboxContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    checkbox: {
      width: '16px',
      height: '16px',
      cursor: 'pointer',
    },
    radioGroup: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.5rem',
    },
    radioOption: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    radio: {
      width: '16px',
      height: '16px',
      cursor: 'pointer',
    },
    helpText: {
      fontSize: '0.75rem',
      color: '#6b7280',
      marginTop: '0.375rem',
    },
    error: {
      fontSize: '0.75rem',
      color: '#ef4444',
      marginTop: '0.375rem',
    },
  };

  return (
    <div style={fieldStyles.container}>
      {field.type !== 'checkbox' && (
        <label style={fieldStyles.label}>
          {field.label}
          {field.validation?.required && <span style={fieldStyles.required}>*</span>}
        </label>
      )}

      <Controller
        name={fieldName}
        control={control as never}
        render={({ field: formField }) => {
          switch (field.type) {
            case 'text':
            case 'email':
            case 'url':
              return (
                <input
                  type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={fieldStyles.input}
                  {...formField}
                  value={formField.value as string || ''}
                />
              );

            case 'textarea':
            case 'json':
              return (
                <textarea
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={fieldStyles.textarea}
                  {...formField}
                  value={formField.value as string || ''}
                />
              );

            case 'number':
              return (
                <input
                  type="number"
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={fieldStyles.input}
                  min={field.validation?.min}
                  max={field.validation?.max}
                  {...formField}
                  value={formField.value as string || ''}
                />
              );

            case 'date':
              return (
                <input
                  type="date"
                  disabled={isDisabled}
                  style={fieldStyles.input}
                  {...formField}
                  value={formField.value as string || ''}
                />
              );

            case 'datetime':
              return (
                <input
                  type="datetime-local"
                  disabled={isDisabled}
                  style={fieldStyles.input}
                  {...formField}
                  value={formField.value as string || ''}
                />
              );

            case 'time':
              return (
                <input
                  type="time"
                  disabled={isDisabled}
                  style={fieldStyles.input}
                  {...formField}
                  value={formField.value as string || ''}
                />
              );

            case 'select':
              return (
                <select
                  disabled={isDisabled}
                  style={fieldStyles.select}
                  {...formField}
                  value={formField.value as string || ''}
                >
                  <option value="">
                    {field.placeholder || 'Select an option'}
                  </option>
                  {field.options?.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              );

            case 'multiselect':
              return (
                <select
                  multiple
                  disabled={isDisabled}
                  style={{ ...fieldStyles.select, minHeight: '120px' }}
                  {...formField}
                  value={(formField.value as string[]) || []}
                  onChange={(e) => {
                    const values = Array.from(
                      e.target.selectedOptions,
                      (option) => option.value
                    );
                    formField.onChange(values);
                  }}
                >
                  {field.options?.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              );

            case 'radio':
              return (
                <div style={fieldStyles.radioGroup}>
                  {field.options?.map((option) => (
                    <label key={option.value} style={fieldStyles.radioOption}>
                      <input
                        type="radio"
                        disabled={isDisabled || option.disabled}
                        style={fieldStyles.radio}
                        {...formField}
                        value={option.value}
                        checked={formField.value === option.value}
                        onChange={() => formField.onChange(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              );

            case 'checkbox':
              return (
                <div style={fieldStyles.checkboxContainer}>
                  <input
                    type="checkbox"
                    disabled={isDisabled}
                    style={fieldStyles.checkbox}
                    {...formField}
                    checked={!!formField.value}
                    onChange={(e) => formField.onChange(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                    {field.label}
                    {field.validation?.required && (
                      <span style={fieldStyles.required}>*</span>
                    )}
                  </span>
                </div>
              );

            default:
              return (
                <input
                  type="text"
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={fieldStyles.input}
                  {...formField}
                  value={formField.value as string || ''}
                />
              );
          }
        }}
      />

      {field.helpText && <p style={fieldStyles.helpText}>{field.helpText}</p>}
      {error?.message && <p style={fieldStyles.error}>{error.message}</p>}
    </div>
  );
}

/**
 * Task form component
 */
export function TaskForm({
  schema,
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialValues = {},
  disabled = false,
}: TaskFormProps) {
  // Build zod schema
  const zodSchema = useMemo(() => buildFormSchema(schema), [schema]);

  // Get field order
  const fieldOrder = schema.fieldOrder || Object.keys(schema.fields);

  // Build default values
  const defaultValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    fieldOrder.forEach((fieldName) => {
      const field = schema.fields[fieldName];
      if (field) {
        values[fieldName] = initialValues[fieldName] ?? getDefaultValue(field);
      }
    });
    return values;
  }, [schema, initialValues, fieldOrder]);

  // Setup form
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // Reset form when schema changes
  useEffect(() => {
    reset(defaultValues);
  }, [schema, reset, defaultValues]);

  const handleFormSubmit = (data: FieldValues) => {
    onSubmit(data);
  };

  const settings = schema.settings || {};

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} style={styles.form}>
      {fieldOrder.map((fieldName) => {
        const field = schema.fields[fieldName];
        if (!field) return null;

        return (
          <FormFieldRenderer
            key={fieldName}
            fieldName={fieldName}
            field={field}
            control={control}
            errors={errors}
            disabled={disabled || isSubmitting}
            watch={watch}
          />
        );
      })}

      {/* Form actions */}
      <div style={styles.actions}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={styles.cancelButton}
          >
            {settings.cancelLabel || 'Cancel'}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || disabled}
          style={styles.submitButton}
        >
          {isSubmitting ? 'Submitting...' : settings.submitLabel || 'Submit'}
        </button>
      </div>
    </form>
  );
}

/**
 * Styles
 */
const styles: Record<string, React.CSSProperties> = {
  form: {
    width: '100%',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e7eb',
    marginTop: '0.5rem',
  },
  cancelButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  submitButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#4f46e5',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
};

export default TaskForm;
