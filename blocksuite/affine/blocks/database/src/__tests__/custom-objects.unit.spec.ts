import { describe, expect, test } from 'vitest';

import {
  addCustomObjectRecord,
  createEmptyCustomObjectWorkspace,
  setCustomObjectValue,
} from '../custom-objects/registry.js';

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
  test('keeps inverse relations synchronized when links are added and removed', () => {
    const book: CustomObjectType = {
      id: 'book',
      name: 'Libro',
      fields: [{
        id: 'author-link',
        name: 'Autore',
        type: 'relation',
        relation: { targetTypeId: 'author', cardinality: 'one', inverseFieldId: 'books-link' },
      }],
      createdAt: 1,
      updatedAt: 1,
    };
    const author: CustomObjectType = {
      id: 'author',
      name: 'Autore',
      fields: [{
        id: 'books-link',
        name: 'Libri collegati',
        type: 'relation',
        relation: { targetTypeId: 'book', cardinality: 'many', inverseFieldId: 'author-link' },
      }],
      createdAt: 1,
      updatedAt: 1,
    };
    let data = createEmptyCustomObjectWorkspace();
    data = { ...data, types: [book, author] };
    const bookResult = addCustomObjectRecord(data, 'book', 'book-1', 'I promessi sposi');
    expect(bookResult.ok).toBe(true);
    if (!bookResult.ok) return;
    const authorResult = addCustomObjectRecord(bookResult.value, 'author', 'author-1', 'Alessandro Manzoni');
    expect(authorResult.ok).toBe(true);
    if (!authorResult.ok) return;

    const linked = setCustomObjectValue(authorResult.value, 'book-1', 'author-link', 'author-1');
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.value.records.find(item => item.id === 'author-1')?.values['books-link']).toEqual(['book-1']);

    const unlinked = setCustomObjectValue(linked.value, 'book-1', 'author-link', null);
    expect(unlinked.ok).toBe(true);
    if (!unlinked.ok) return;
    expect(unlinked.value.records.find(item => item.id === 'author-1')?.values['books-link']).toEqual([]);
  });

});
