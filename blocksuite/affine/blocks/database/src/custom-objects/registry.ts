import {
  createCustomObjectRecord,
  isCustomObjectValueValid,
  validateCustomObjectType,
  type CustomObjectRecord,
  type CustomObjectType,
  type CustomObjectValue,
} from './model.js';

export interface CustomObjectWorkspaceData {
  version: 1;
  types: CustomObjectType[];
  records: CustomObjectRecord[];
}

export type RegistryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function createEmptyCustomObjectWorkspace(): CustomObjectWorkspaceData {
  return { version: 1, types: [], records: [] };
}

export function addCustomObjectType(
  data: CustomObjectWorkspaceData,
  definition: CustomObjectType
): RegistryResult<CustomObjectWorkspaceData> {
  if (data.types.some(type => type.id === definition.id)) {
    return { ok: false, error: 'Esiste già un tipo con questo identificativo.' };
  }

  const issues = validateCustomObjectType(definition);
  if (issues.length) {
    return { ok: false, error: issues.map(issue => issue.message).join(' ') };
  }

  for (const field of definition.fields) {
    if (
      field.type === 'relation' &&
      !data.types.some(type => type.id === field.relation?.targetTypeId)
    ) {
      return {
        ok: false,
        error: `Il tipo di destinazione della relazione "${field.name}" non esiste.`,
      };
    }
  }

  return { ok: true, value: { ...data, types: [...data.types, definition] } };
}

export function updateCustomObjectType(
  data: CustomObjectWorkspaceData,
  definition: CustomObjectType
): RegistryResult<CustomObjectWorkspaceData> {
  const index = data.types.findIndex(type => type.id === definition.id);
  if (index < 0) return { ok: false, error: 'Tipo di oggetto non trovato.' };

  const issues = validateCustomObjectType(definition);
  if (issues.length) {
    return { ok: false, error: issues.map(issue => issue.message).join(' ') };
  }

  const types = data.types.slice();
  types[index] = definition;
  return { ok: true, value: { ...data, types } };
}

export function removeCustomObjectType(
  data: CustomObjectWorkspaceData,
  typeId: string
): RegistryResult<CustomObjectWorkspaceData> {
  if (data.records.some(record => record.typeId === typeId)) {
    return {
      ok: false,
      error: 'Impossibile eliminare il tipo: contiene ancora oggetti. Elimina o sposta prima gli oggetti.',
    };
  }
  if (!data.types.some(type => type.id === typeId)) {
    return { ok: false, error: 'Tipo di oggetto non trovato.' };
  }
  if (
    data.types.some(type =>
      type.fields.some(
        field => field.type === 'relation' && field.relation?.targetTypeId === typeId
      )
    )
  ) {
    return {
      ok: false,
      error: 'Impossibile eliminare il tipo: è ancora utilizzato da una relazione.',
    };
  }
  return {
    ok: true,
    value: { ...data, types: data.types.filter(type => type.id !== typeId) },
  };
}

export function addCustomObjectRecord(
  data: CustomObjectWorkspaceData,
  typeId: string,
  recordId: string,
  title: string,
  now = Date.now()
): RegistryResult<CustomObjectWorkspaceData> {
  const type = data.types.find(item => item.id === typeId);
  if (!type) return { ok: false, error: 'Tipo di oggetto non trovato.' };
  if (data.records.some(record => record.id === recordId)) {
    return { ok: false, error: 'Esiste già un oggetto con questo identificativo.' };
  }
  const record = createCustomObjectRecord(recordId, type, title, now);
  return { ok: true, value: { ...data, records: [...data.records, record] } };
}

export function setCustomObjectValue(
  data: CustomObjectWorkspaceData,
  recordId: string,
  fieldId: string,
  value: CustomObjectValue,
  now = Date.now()
): RegistryResult<CustomObjectWorkspaceData> {
  const record = data.records.find(item => item.id === recordId);
  if (!record) return { ok: false, error: 'Oggetto non trovato.' };
  const type = data.types.find(item => item.id === record.typeId);
  const field = type?.fields.find(item => item.id === fieldId);
  if (!field) return { ok: false, error: 'Proprietà non trovata.' };
  if (!isCustomObjectValueValid(field, value)) {
    return { ok: false, error: `Valore non valido per la proprietà "${field.name}".` };
  }

  if (field.type === 'relation') {
    const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const targets = data.records.filter(item => ids.includes(item.id));
    if (targets.length !== ids.length) {
      return { ok: false, error: 'Uno o più oggetti collegati non esistono.' };
    }
    if (targets.some(item => item.typeId !== field.relation?.targetTypeId)) {
      return { ok: false, error: 'La relazione accetta soltanto oggetti del tipo previsto.' };
    }
  }

  const records = data.records.map(item =>
    item.id === recordId
      ? {
          ...item,
          values: { ...item.values, [fieldId]: value },
          updatedAt: now,
        }
      : item
  );
  return { ok: true, value: { ...data, records } };
}

export function removeCustomObjectRecord(
  data: CustomObjectWorkspaceData,
  recordId: string
): RegistryResult<CustomObjectWorkspaceData> {
  if (!data.records.some(record => record.id === recordId)) {
    return { ok: false, error: 'Oggetto non trovato.' };
  }

  const stillLinked = data.records.some(record =>
    Object.values(record.values).some(value =>
      Array.isArray(value) ? value.includes(recordId) : value === recordId
    )
  );
  if (stillLinked) {
    return {
      ok: false,
      error: 'L’oggetto è ancora collegato ad altri oggetti. Rimuovi prima le relazioni.',
    };
  }
  return {
    ok: true,
    value: { ...data, records: data.records.filter(record => record.id !== recordId) },
  };
}

/** Parse and validate a JSON backup without changing the current workspace. */
export function importCustomObjectWorkspace(
  json: string
): RegistryResult<CustomObjectWorkspaceData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Il file non contiene JSON valido.' };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('version' in parsed) ||
    parsed.version !== 1 ||
    !('types' in parsed) ||
    !Array.isArray(parsed.types) ||
    !('records' in parsed) ||
    !Array.isArray(parsed.records)
  ) {
    return { ok: false, error: 'Formato di archivio oggetti non riconosciuto.' };
  }

  const data = parsed as CustomObjectWorkspaceData;
  const ids = new Set<string>();
  for (const type of data.types) {
    if (ids.has(type.id) || validateCustomObjectType(type).length) {
      return { ok: false, error: 'Il backup contiene tipi duplicati o non validi.' };
    }
    ids.add(type.id);
  }
  for (const type of data.types) {
    for (const field of type.fields) {
      if (
        field.type === 'relation' &&
        !data.types.some(item => item.id === field.relation?.targetTypeId)
      ) {
        return { ok: false, error: 'Il backup contiene relazioni verso tipi inesistenti.' };
      }
    }
  }
  const recordIds = new Set<string>();
  for (const record of data.records) {
    if (
      recordIds.has(record.id) ||
      !data.types.some(type => type.id === record.typeId)
    ) {
      return { ok: false, error: 'Il backup contiene oggetti duplicati o con tipo inesistente.' };
    }
    recordIds.add(record.id);
  }
  return { ok: true, value: data };
}

export function exportCustomObjectWorkspace(
  data: CustomObjectWorkspaceData
): string {
  return JSON.stringify(data, null, 2);
}
