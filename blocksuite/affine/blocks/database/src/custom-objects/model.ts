/**
 * AFFiNE Italia — custom object model.
 *
 * This module defines the data contract for user-defined object types and
 * their relationships. UI and document-backed persistence are intentionally
 * kept in separate layers so this model can be reused by web, desktop and
 * mobile clients.
 */

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'multi-select'
  | 'url'
  | 'email'
  | 'file'
  | 'image';

export type RelationCardinality = 'one' | 'many';

export interface CustomObjectField {
  /** Stable identifier; do not derive this from the displayed name. */
  id: string;
  name: string;
  type: CustomFieldType | 'relation';
  required?: boolean;
  /** Used by select and multi-select fields. */
  options?: string[];
  /** Required when type is relation. */
  relation?: {
    targetTypeId: string;
    cardinality: RelationCardinality;
    inverseFieldId?: string;
  };
}

export interface CustomObjectType {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  fields: CustomObjectField[];
  createdAt: number;
  updatedAt: number;
}

export type CustomObjectValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface CustomObjectRecord {
  id: string;
  typeId: string;
  title: string;
  values: Record<string, CustomObjectValue>;
  createdAt: number;
  updatedAt: number;
}

export interface ObjectDefinitionIssue {
  code:
    | 'missing-id'
    | 'missing-name'
    | 'duplicate-field-id'
    | 'invalid-options'
    | 'missing-relation-target'
    | 'invalid-relation-cardinality';
  message: string;
  fieldId?: string;
}

/** Validate a custom type before it is saved. */
export function validateCustomObjectType(
  definition: CustomObjectType
): ObjectDefinitionIssue[] {
  const issues: ObjectDefinitionIssue[] = [];

  if (!definition.id.trim()) {
    issues.push({ code: 'missing-id', message: 'Il tipo deve avere un identificativo.' });
  }
  if (!definition.name.trim()) {
    issues.push({ code: 'missing-name', message: 'Il tipo deve avere un nome.' });
  }

  const seen = new Set<string>();
  for (const field of definition.fields) {
    if (!field.id.trim() || seen.has(field.id)) {
      issues.push({
        code: 'duplicate-field-id',
        fieldId: field.id,
        message: `Identificativo del campo mancante o duplicato: ${field.id}`,
      });
    }
    seen.add(field.id);

    if (
      (field.type === 'select' || field.type === 'multi-select') &&
      (!field.options || field.options.length === 0)
    ) {
      issues.push({
        code: 'invalid-options',
        fieldId: field.id,
        message: `Il campo "${field.name}" richiede almeno un'opzione.`,
      });
    }

    if (field.type === 'relation') {
      if (!field.relation?.targetTypeId.trim()) {
        issues.push({
          code: 'missing-relation-target',
          fieldId: field.id,
          message: `La relazione "${field.name}" deve indicare il tipo di destinazione.`,
        });
      }
      if (
        field.relation &&
        field.relation.cardinality !== 'one' &&
        field.relation.cardinality !== 'many'
      ) {
        issues.push({
          code: 'invalid-relation-cardinality',
          fieldId: field.id,
          message: `Cardinalità non valida per la relazione "${field.name}".`,
        });
      }
    }
  }

  return issues;
}

/** Create an empty record for a previously defined object type. */
export function createCustomObjectRecord(
  id: string,
  type: CustomObjectType,
  title: string,
  now = Date.now()
): CustomObjectRecord {
  const values: Record<string, CustomObjectValue> = {};

  for (const field of type.fields) {
    if (field.type === 'checkbox') {
      values[field.id] = false;
    } else if (field.type === 'multi-select') {
      values[field.id] = [];
    } else if (field.type === 'relation' && field.relation?.cardinality === 'many') {
      values[field.id] = [];
    } else {
      values[field.id] = null;
    }
  }

  return {
    id,
    typeId: type.id,
    title,
    values,
    createdAt: now,
    updatedAt: now,
  };
}

/** Return true when a value is compatible with a field definition. */
export function isCustomObjectValueValid(
  field: CustomObjectField,
  value: CustomObjectValue
): boolean {
  if (value === null) {
    return !field.required;
  }

  switch (field.type) {
    case 'text':
    case 'date':
    case 'url':
    case 'email':
    case 'file':
    case 'image':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'checkbox':
      return typeof value === 'boolean';
    case 'select':
      return (
        typeof value === 'string' &&
        (field.options ?? []).includes(value)
      );
    case 'multi-select':
      return (
        Array.isArray(value) &&
        value.every(
          item => typeof item === 'string' && (field.options ?? []).includes(item)
        )
      );
    case 'relation':
      return field.relation?.cardinality === 'many'
        ? Array.isArray(value) && value.every(item => typeof item === 'string')
        : typeof value === 'string';
  }
}
