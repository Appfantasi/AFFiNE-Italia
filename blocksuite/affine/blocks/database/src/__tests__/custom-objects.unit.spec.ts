import { describe, expect, test } from 'vitest';

import {
  createCustomObjectRecord,
  isCustomObjectValueValid,
  validateCustomObjectType,
  type CustomObjectType,
} from '../custom-objects/model.js';

const bookType: CustomObjectType = {
  id: 'book',
  name: 'Libro',
  fields: [
    { id: 'author', name: 'Autore', type: 'relation', relation: { targetTypeId: 'person', cardinality: 'one' } },
    { id: 'tags', name: 'Categorie', type: 'multi-select', options: ['Saggio', 'Romanzo'] },
    { id: 'read', name: 'Letto', type: 'checkbox' },
  ],
  createdAt: 1,
  updatedAt: 1,
};

describe('custom object model', () => {
  test('validates object types and relation targets', () => {
    expect(validateCustomObjectType(bookType)).toEqual([]);
    expect(
      validateCustomObjectType({
        ...bookType,
        fields: [
          ...bookType.fields,
          { id: 'author', name: 'Altro autore', type: 'text' },
        ],
      }).some(issue => issue.code === 'duplicate-field-id')
    ).toBe(true);
  });

  test('creates records with type-appropriate default values', () => {
    expect(createCustomObjectRecord('book-1', bookType, 'Il nome della rosa', 10)).toEqual({
      id: 'book-1',
      typeId: 'book',
      title: 'Il nome della rosa',
      values: { author: null, tags: [], read: false },
      createdAt: 10,
      updatedAt: 10,
    });
  });

  test('checks field values against their definitions', () => {
    expect(isCustomObjectValueValid(bookType.fields[1], ['Saggio'])).toBe(true);
    expect(isCustomObjectValueValid(bookType.fields[1], ['Non previsto'])).toBe(false);
    expect(isCustomObjectValueValid(bookType.fields[2], true)).toBe(true);
  });
});
