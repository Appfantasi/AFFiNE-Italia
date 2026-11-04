/**
 * AFFiNE Italia — workspace project and task model.
 * Pure data contracts shared by desktop, web and mobile.
 */
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface WorkspaceProject {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  dueDate?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  /** AFFiNE document IDs related to this task. */
  documentIds: string[];
  /** Custom object record IDs related to this task. */
  objectRecordIds: string[];
  /** Tasks that must be completed first. */
  dependsOnTaskIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectWorkspaceData {
  version: 1;
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
}

export type ProjectIssueCode =
  | 'missing-id'
  | 'missing-name'
  | 'invalid-status'
  | 'invalid-date'
  | 'due-before-start'
  | 'duplicate-id'
  | 'missing-project'
  | 'missing-dependency'
  | 'self-dependency'
  | 'dependency-cycle';

export interface ProjectIssue {
  code: ProjectIssueCode;
  message: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value?: string): boolean {
  if (!value) return true;
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateProject(project: WorkspaceProject): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  if (!project.id.trim()) issues.push({ code: 'missing-id', message: 'Il progetto deve avere un identificativo.' });
  if (!project.name.trim()) issues.push({ code: 'missing-name', message: 'Inserisci il nome del progetto.' });
  if (!['active', 'paused', 'completed', 'archived'].includes(project.status)) {
    issues.push({ code: 'invalid-status', message: 'Stato del progetto non valido.' });
  }
  if (!isValidCalendarDate(project.startDate) || !isValidCalendarDate(project.dueDate)) {
    issues.push({ code: 'invalid-date', message: 'Una data del progetto non è valida.' });
  } else if (project.startDate && project.dueDate && project.dueDate < project.startDate) {
    issues.push({ code: 'due-before-start', message: 'La scadenza non può precedere la data iniziale.' });
  }
  return issues;
}

export function validateTask(task: WorkspaceTask): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  if (!task.id.trim()) issues.push({ code: 'missing-id', message: 'L’attività deve avere un identificativo.' });
  if (!task.title.trim()) issues.push({ code: 'missing-name', message: 'Inserisci il titolo dell’attività.' });
  if (!['todo', 'in-progress', 'blocked', 'done'].includes(task.status)) {
    issues.push({ code: 'invalid-status', message: 'Stato dell’attività non valido.' });
  }
  if (!['low', 'normal', 'high', 'urgent'].includes(task.priority)) {
    issues.push({ code: 'invalid-status', message: 'Priorità dell’attività non valida.' });
  }
  if (!isValidCalendarDate(task.startDate) || !isValidCalendarDate(task.dueDate)) {
    issues.push({ code: 'invalid-date', message: 'Una data dell’attività non è valida.' });
  } else if (task.startDate && task.dueDate && task.dueDate < task.startDate) {
    issues.push({ code: 'due-before-start', message: 'La scadenza non può precedere la data iniziale.' });
  }
  if (task.dependsOnTaskIds.includes(task.id)) {
    issues.push({ code: 'self-dependency', message: 'Un’attività non può dipendere da sé stessa.' });
  }
  return issues;
}
