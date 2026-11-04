import { describe, expect, test } from 'vitest';
import {
  createEmptyDocumentArchive,
  exportDocumentArchive,
  importDocumentArchive,
  searchArchivedDocuments,
  upsertArchivedDocument,
} from '../document-archive/registry.js';
import type { ArchivedDocument } from '../document-archive/model.js';

const entry: ArchivedDocument = {
  docId: 'doc-1',
  title: 'Manuale di progetto',
  category: 'Lavoro',
  tags: ['manuale', 'procedure'],
  description: 'Documentazione interna',
  projectIds: ['project-1'],
  taskIds: ['task-1'],
  objectRecordIds: ['record-1'],
  updatedAt: 10,
};

describe('workspace document archive', () => {
  test('adds and updates one archive entry per document', () => {
    const first = upsertArchivedDocument(createEmptyDocumentArchive(), entry);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const updated = upsertArchivedDocument(first.value, { ...entry, category: 'Guide' });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.entries).toHaveLength(1);
      expect(updated.value.entries[0].category).toBe('Guide');
    }
  });

  test('searches title, description, tags and category', () => {
    const saved = upsertArchivedDocument(createEmptyDocumentArchive(), entry);
    if (!saved.ok) throw new Error(saved.error);
    expect(searchArchivedDocuments(saved.value, 'procedure')).toHaveLength(1);
    expect(searchArchivedDocuments(saved.value, '', 'Lavoro')).toHaveLength(1);
    expect(searchArchivedDocuments(saved.value, 'inesistente')).toHaveLength(0);
  });

  test('exports and validates JSON backups', () => {
    const saved = upsertArchivedDocument(createEmptyDocumentArchive(), entry);
    if (!saved.ok) throw new Error(saved.error);
    expect(importDocumentArchive(exportDocumentArchive(saved.value))).toEqual({ ok: true, value: saved.value });
    expect(importDocumentArchive('{invalid').ok).toBe(false);
    expect(importDocumentArchive(JSON.stringify({ version: 1, entries: [{ ...entry, tags: 'bad' }] })).ok).toBe(false);
  });
});
