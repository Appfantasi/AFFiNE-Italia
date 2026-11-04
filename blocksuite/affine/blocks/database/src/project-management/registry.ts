import {
  validateProject,
  validateTask,
  type ProjectWorkspaceData,
  type WorkspaceProject,
  type WorkspaceTask,
} from './model.js';

export type ProjectResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function createEmptyProjectWorkspace(): ProjectWorkspaceData {
  return { version: 1, projects: [], tasks: [] };
}

export function addProject(data: ProjectWorkspaceData, project: WorkspaceProject): ProjectResult<ProjectWorkspaceData> {
  if (data.projects.some(item => item.id === project.id)) return { ok: false, error: 'Esiste già un progetto con questo identificativo.' };
  const issues = validateProject(project);
  if (issues.length) return { ok: false, error: issues.map(issue => issue.message).join(' ') };
  return { ok: true, value: { ...data, projects: [...data.projects, project] } };
}

export function updateProject(data: ProjectWorkspaceData, project: WorkspaceProject): ProjectResult<ProjectWorkspaceData> {
  const index = data.projects.findIndex(item => item.id === project.id);
  if (index < 0) return { ok: false, error: 'Progetto non trovato.' };
  const issues = validateProject(project);
  if (issues.length) return { ok: false, error: issues.map(issue => issue.message).join(' ') };
  const projects = data.projects.slice();
  projects[index] = project;
  return { ok: true, value: { ...data, projects } };
}

export function removeProject(data: ProjectWorkspaceData, projectId: string): ProjectResult<ProjectWorkspaceData> {
  if (!data.projects.some(item => item.id === projectId)) return { ok: false, error: 'Progetto non trovato.' };
  if (data.tasks.some(task => task.projectId === projectId)) return { ok: false, error: 'Il progetto contiene attività: spostale o eliminale prima.' };
  return { ok: true, value: { ...data, projects: data.projects.filter(item => item.id !== projectId) } };
}

export function addTask(data: ProjectWorkspaceData, task: WorkspaceTask): ProjectResult<ProjectWorkspaceData> {
  if (data.tasks.some(item => item.id === task.id)) return { ok: false, error: 'Esiste già un’attività con questo identificativo.' };
  if (!data.projects.some(project => project.id === task.projectId)) return { ok: false, error: 'Il progetto selezionato non esiste.' };
  const issues = validateTask(task);
  if (issues.length) return { ok: false, error: issues.map(issue => issue.message).join(' ') };
  if (task.dependsOnTaskIds.some(id => !data.tasks.some(item => item.id === id))) return { ok: false, error: 'Una o più attività precedenti non esistono.' };
  return { ok: true, value: { ...data, tasks: [...data.tasks, task] } };
}

export function updateTask(data: ProjectWorkspaceData, task: WorkspaceTask): ProjectResult<ProjectWorkspaceData> {
  const index = data.tasks.findIndex(item => item.id === task.id);
  if (index < 0) return { ok: false, error: 'Attività non trovata.' };
  if (!data.projects.some(project => project.id === task.projectId)) return { ok: false, error: 'Il progetto selezionato non esiste.' };
  const issues = validateTask(task);
  if (issues.length) return { ok: false, error: issues.map(issue => issue.message).join(' ') };
  if (task.dependsOnTaskIds.some(id => !data.tasks.some(item => item.id === id))) return { ok: false, error: 'Una o più attività precedenti non esistono.' };
  const tasks = data.tasks.slice();
  tasks[index] = task;
  const cycle = hasDependencyCycle(tasks);
  if (cycle) return { ok: false, error: 'La modifica crea un ciclo tra le dipendenze delle attività.' };
  return { ok: true, value: { ...data, tasks } };
}

export function removeTask(data: ProjectWorkspaceData, taskId: string): ProjectResult<ProjectWorkspaceData> {
  if (!data.tasks.some(item => item.id === taskId)) return { ok: false, error: 'Attività non trovata.' };
  if (data.tasks.some(task => task.dependsOnTaskIds.includes(taskId))) return { ok: false, error: 'Altre attività dipendono da questa: rimuovi prima i collegamenti.' };
  return { ok: true, value: { ...data, tasks: data.tasks.filter(item => item.id !== taskId) } };
}

export function moveTask(data: ProjectWorkspaceData, taskId: string, status: WorkspaceTask['status']): ProjectResult<ProjectWorkspaceData> {
  const task = data.tasks.find(item => item.id === taskId);
  if (!task) return { ok: false, error: 'Attività non trovata.' };
  return updateTask(data, { ...task, status, updatedAt: Date.now() });
}

export function getTasksForCalendar(data: ProjectWorkspaceData): WorkspaceTask[] {
  return data.tasks.filter(task => Boolean(task.startDate || task.dueDate))
    .slice().sort((a, b) => (a.dueDate ?? a.startDate ?? '').localeCompare(b.dueDate ?? b.startDate ?? ''));
}

export function getTasksForKanban(data: ProjectWorkspaceData, projectId: string) {
  const tasks = data.tasks.filter(task => task.projectId === projectId);
  return {
    todo: tasks.filter(task => task.status === 'todo'),
    inProgress: tasks.filter(task => task.status === 'in-progress'),
    blocked: tasks.filter(task => task.status === 'blocked'),
    done: tasks.filter(task => task.status === 'done'),
  };
}

export function exportProjectWorkspace(data: ProjectWorkspaceData): string {
  return JSON.stringify(data, null, 2);
}

export function importProjectWorkspace(json: string): ProjectResult<ProjectWorkspaceData> {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return { ok: false, error: 'Il file non contiene JSON valido.' }; }
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 ||
      !('projects' in parsed) || !Array.isArray(parsed.projects) ||
      !('tasks' in parsed) || !Array.isArray(parsed.tasks)) {
    return { ok: false, error: 'Formato archivio progetti non riconosciuto.' };
  }
  const data = parsed as ProjectWorkspaceData;
  const projectIds = new Set<string>();
  for (const project of data.projects) {
    if (projectIds.has(project.id) || validateProject(project).length) return { ok: false, error: 'Il backup contiene progetti duplicati o non validi.' };
    projectIds.add(project.id);
  }
  const taskIds = new Set<string>();
  for (const task of data.tasks) {
    if (taskIds.has(task.id) || !projectIds.has(task.projectId) || validateTask(task).length) return { ok: false, error: 'Il backup contiene attività duplicate o non valide.' };
    taskIds.add(task.id);
  }
  for (const task of data.tasks) {
    if (task.dependsOnTaskIds.some(id => !taskIds.has(id))) return { ok: false, error: 'Il backup contiene dipendenze verso attività inesistenti.' };
  }
  if (hasDependencyCycle(data.tasks)) return { ok: false, error: 'Il backup contiene un ciclo tra le dipendenze.' };
  return { ok: true, value: data };
}

function hasDependencyCycle(tasks: WorkspaceTask[]): boolean {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const task = byId.get(id);
    if (task?.dependsOnTaskIds.some(dependency => visit(dependency))) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return tasks.some(task => visit(task.id));
}
