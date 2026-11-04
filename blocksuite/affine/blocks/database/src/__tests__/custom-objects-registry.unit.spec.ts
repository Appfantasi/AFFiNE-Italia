import { describe, expect, test } from 'vitest';

import {
  addCustomObjectRecord,
  addCustomObjectType,
  createEmptyCustomObjectWorkspace,
  exportCustomObjectWorkspace,
  importCustomObjectWorkspace,
  removeCustomObjectRecord,
  removeCustomObjectType,
  setCustomObjectValue,
  updateCustomObjectType,
} from '../custom-objects/registry.js';
import type { CustomObjectType } from '../custom-objects/model.js';

const person: CustomObjectType = {
  id: 'person',
  name: 'Persona',
  fields: [{ id: 'email', name: 'Email', type: 'email' }],
  createdAt: 1,
  updatedAt: 1,
};
const book: CustomObjectType = {
  id: 'book',
  name: 'Libro',
  fields: [
    { id: 'author', name: 'Autore', type: 'relation', relation: { targetTypeId: 'person', cardinality: 'one' } },
  ],
  createdAt: 1,
  updatedAt: 1,
};

describe('custom object registry', () => {
  test('adds types and prevents missing relation targets', () => {
    const empty = createEmptyCustomObjectWorkspace();
    expect(addCustomObjectType(empty, book).ok).toBe(false);
    const withPerson = addCustomObjectType(empty, person);
    expect(withPerson.ok).toBe(true);
    if (!withPerson.ok) return;
    expect(addCustomObjectType(withPerson.value, book).ok).toBe(true);
  });

  test('creates records and validates relation target types', () => {
    let data = createEmptyCustomObjectWorkspace();
    const p = addCustomObjectType(data, person);
    if (!p.ok) throw new Error(p.error);
    data = p.value;
    const b = addCustomObjectType(data, book);
    if (!b.ok) throw new Error(b.error);
    data = b.value;

    const pRecord = addCustomObjectRecord(data, 'person', 'p1', 'Ada Lovelace', 2);
    if (!pRecord.ok) throw new Error(pRecord.error);
    const bRecord = addCustomObjectRecord(pRecord.value, 'book', 'b1', 'Note', 3);
    if (!bRecord.ok) throw new Error(bRecord.error);

    expect(setCustomObjectValue(bRecord.value, 'b1', 'author', 'p1', 4).ok).toBe(true);
    expect(setCustomObjectValue(bRecord.value, 'b1', 'author', 'b1', 4).ok).toBe(false);
  });

  test('protects referenced types and records from accidental deletion', () => {
    let data = createEmptyCustomObjectWorkspace();
    const p = addCustomObjectType(data, person);
    if (!p.ok) throw new Error(p.error);
    const b = addCustomObjectType(p.value, book);
    if (!b.ok) throw new Error(b.error);
    const pRecord = addCustomObjectRecord(b.value, 'person', 'p1', 'Ada');
    if (!pRecord.ok) throw new Error(pRecord.error);
    expect(removeCustomObjectType(pRecord.value, 'person').ok).toBe(false);
    expect(removeCustomObjectRecord(pRecord.value, 'p1').ok).toBe(true);
  });

  test('exports and imports a workspace backup', () => {
    const data = createEmptyCustomObjectWorkspace();
    const result = importCustomObjectWorkspace(exportCustomObjectWorkspace(data));
    expect(result).toEqual({ ok: true, value: data });
    expect(importCustomObjectWorkspace('{broken').ok).toBe(false);
  });
});
