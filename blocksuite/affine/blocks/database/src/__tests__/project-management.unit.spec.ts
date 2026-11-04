import { describe, expect, test } from 'vitest';
import {
  addProject, addTask, createEmptyProjectWorkspace, exportProjectWorkspace,
  getTasksForCalendar, getTasksForKanban, importProjectWorkspace,
  moveTask, removeProject, removeTask, updateTask,
} from '../project-management/registry.js';
import type { WorkspaceProject, WorkspaceTask } from '../project-management/model.js';

const project: WorkspaceProject = { id: 'p1', name: 'Progetto demo', status: 'active', startDate: '2026-11-01', dueDate: '2026-11-30', createdAt: 1, updatedAt: 1 };
const task: WorkspaceTask = { id: 't1', projectId: 'p1', title: 'Preparare documentazione', status: 'todo', priority: 'high', startDate: '2026-11-02', dueDate: '2026-11-10', documentIds: ['doc-1'], objectRecordIds: ['book-1'], dependsOnTaskIds: [], createdAt: 1, updatedAt: 1 };

describe('workspace project management', () => {
  test('creates projects and tasks and protects projects containing tasks', () => {
    const p = addProject(createEmptyProjectWorkspace(), project);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const t = addTask(p.value, task);
    expect(t.ok).toBe(true);
    if (t.ok) expect(removeProject(t.value, 'p1').ok).toBe(false);
  });

  test('groups tasks for Kanban and orders calendar entries by date', () => {
    const p = addProject(createEmptyProjectWorkspace(), project);
    if (!p.ok) throw new Error(p.error);
    const t = addTask(p.value, task);
    if (!t.ok) throw new Error(t.error);
    expect(getTasksForKanban(t.value, 'p1').todo).toHaveLength(1);
    expect(getTasksForCalendar(t.value)[0].id).toBe('t1');
    const moved = moveTask(t.value, 't1', 'in-progress');
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(getTasksForKanban(moved.value, 'p1').inProgress).toHaveLength(1);
  });

  test('validates dependencies and prevents deleting referenced tasks', () => {
    const p = addProject(createEmptyProjectWorkspace(), project);
    if (!p.ok) throw new Error(p.error);
    const first = addTask(p.value, task);
    if (!first.ok) throw new Error(first.error);
    const second: WorkspaceTask = { ...task, id: 't2', title: 'Revisione', dependsOnTaskIds: ['t1'] };
    const both = addTask(first.value, second);
    if (!both.ok) throw new Error(both.error);
    expect(removeTask(both.value, 't1').ok).toBe(false);
    expect(updateTask(both.value, { ...task, dependsOnTaskIds: ['t2'] }).ok).toBe(false);
  });

  test('rejects calendar dates that do not exist', () => {
    const invalid = { ...project, dueDate: '2026-02-30' };
    expect(addProject(createEmptyProjectWorkspace(), invalid).ok).toBe(false);
  });

  test('rejects tasks with missing or invalid link collections', () => {
    const p = addProject(createEmptyProjectWorkspace(), project);
    if (!p.ok) throw new Error(p.error);
    const invalid = { ...task, documentIds: null as unknown as string[] };
    expect(addTask(p.value, invalid).ok).toBe(false);
  });

  test('exports and imports project workspace data', () => {
    const p = addProject(createEmptyProjectWorkspace(), project);
    if (!p.ok) throw new Error(p.error);
    const t = addTask(p.value, task);
    if (!t.ok) throw new Error(t.error);
    expect(importProjectWorkspace(exportProjectWorkspace(t.value))).toEqual({ ok: true, value: t.value });
    expect(importProjectWorkspace('{invalid').ok).toBe(false);
  });
});
