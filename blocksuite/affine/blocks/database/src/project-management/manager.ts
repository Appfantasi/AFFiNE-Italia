import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import type * as Y from 'yjs';

import {
  addProject,
  addTask,
  createEmptyProjectWorkspace,
  exportProjectWorkspace,
  getTasksForCalendar,
  getTasksForKanban,
  importProjectWorkspace,
  moveTask,
  type ProjectWorkspaceData,
} from './registry.js';
import type { TaskPriority, TaskStatus, WorkspaceProject } from './model.js';

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'Da fare' },
  { value: 'in-progress', label: 'In corso' },
  { value: 'blocked', label: 'Bloccate' },
  { value: 'done', label: 'Completate' },
];

export class ProjectManager extends SignalWatcher(WithDisposable(ShadowlessElement)) {
  static override styles = css`
    :host { display: inline-flex; position: relative; font: inherit; color: var(--affine-text-primary-color); }
    button, input, select, textarea { font: inherit; }
    button { cursor: pointer; border: 1px solid var(--affine-border-color); border-radius: 8px; padding: 6px 10px; background: var(--affine-background-primary-color); color: inherit; }
    button.primary { background: var(--affine-primary-color); color: white; border-color: transparent; }
    .panel { position: absolute; z-index: 1000; top: calc(100% + 8px); right: 0; width: min(900px, calc(100vw - 32px)); max-height: min(78vh, 760px); overflow: auto; padding: 16px; border: 1px solid var(--affine-border-color); border-radius: 12px; background: var(--affine-background-overlay-panel-color, var(--affine-background-primary-color)); box-shadow: 0 12px 36px #0002; }
    .top, .form, .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .top { justify-content: space-between; }
    input, select, textarea { box-sizing: border-box; min-width: 0; padding: 8px; border: 1px solid var(--affine-border-color); border-radius: 7px; color: inherit; background: var(--affine-background-primary-color); }
    .form > input { flex: 1 1 140px; }
    .board { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 10px; margin-top: 14px; }
    .column { min-width: 0; padding: 9px; border-radius: 9px; background: var(--affine-background-secondary-color); }
    .column h3 { margin: 0 0 8px; font-size: 13px; }
    .task { padding: 9px; margin: 6px 0; border: 1px solid var(--affine-border-color); border-radius: 8px; background: var(--affine-background-primary-color); }
    .task strong { display: block; font-size: 13px; overflow-wrap: anywhere; }
    .meta { margin: 5px 0; color: var(--affine-text-secondary-color); font-size: 11px; }
    .calendar { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
    .calendar-row { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 8px; border-bottom: 1px solid var(--affine-border-color); }
    .muted { color: var(--affine-text-secondary-color); font-size: 12px; }
    @media (max-width: 720px) { .board { grid-template-columns: repeat(2, minmax(140px, 1fr)); } }
    @media (max-width: 480px) { .panel { position: fixed; top: 12px; left: 12px; right: 12px; width: auto; max-height: calc(100vh - 24px); } .board { grid-template-columns: 1fr; } }
  `;

  @property({ attribute: false }) accessor workspaceId = 'default';
  @property({ attribute: false }) accessor workspaceDoc: Y.Doc | undefined = undefined;

  private readonly open$ = signal(false);
  private readonly data$ = signal<ProjectWorkspaceData>(createEmptyProjectWorkspace());
  private readonly projectId$ = signal('');
  private readonly projectName$ = signal('');
  private readonly taskTitle$ = signal('');
  private readonly taskDueDate$ = signal('');
  private readonly taskPriority$ = signal<TaskPriority>('normal');
  private readonly view$ = signal<'kanban' | 'calendar'>('kanban');
  private readonly status$ = signal('');
  private observedMap?: Y.Map<string>;
  private readonly onChanged = () => this.loadShared();

  override connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  override disconnectedCallback() {
    this.observedMap?.unobserve(this.onChanged);
    this.observedMap = undefined;
    super.disconnectedCallback();
  }

  private observe() {
    const map = this.workspaceDoc?.getMap<string>('affine:italia:project-management');
    if (!map || map === this.observedMap) return;
    this.observedMap?.unobserve(this.onChanged);
    this.observedMap = map;
    map.observe(this.onChanged);
  }

  private loadShared() {
    const raw = this.observedMap?.get(this.workspaceId);
    if (!raw) return;
    const parsed = importProjectWorkspace(raw);
    if (parsed.ok) {
      this.data$.value = parsed.value;
      if (!this.projectId$.value && parsed.value.projects.length) this.projectId$.value = parsed.value.projects[0].id;
    } else this.status$.value = parsed.error;
  }

  private load() {
    this.observe();
    const raw = this.workspaceDoc?.getMap<string>('affine:italia:project-management').get(this.workspaceId);
    if (raw) {
      const parsed = importProjectWorkspace(raw);
      if (parsed.ok) this.data$.value = parsed.value;
      else this.status$.value = parsed.error;
    }
    if (!this.projectId$.value && this.data$.value.projects.length) this.projectId$.value = this.data$.value.projects[0].id;
  }

  private save(data: ProjectWorkspaceData) {
    const raw = exportProjectWorkspace(data);
    if (this.workspaceDoc) {
      this.workspaceDoc.transact(() => {
        this.workspaceDoc!.getMap<string>('affine:italia:project-management').set(this.workspaceId, raw);
      });
      this.status$.value = 'Salvato nel workspace AFFiNE.';
    } else {
      this.status$.value = 'Workspace non disponibile: modifiche non salvate.';
      return;
    }
    this.data$.value = data;
  }

  private createProject = () => {
    const name = this.projectName$.value.trim();
    if (!name) { this.status$.value = 'Inserisci il nome del progetto.'; return; }
    const now = Date.now();
    const project: WorkspaceProject = { id: makeId('project'), name, status: 'active', createdAt: now, updatedAt: now };
    const result = addProject(this.data$.value, project);
    if (!result.ok) { this.status$.value = result.error; return; }
    this.save(result.value);
    this.projectId$.value = project.id;
    this.projectName$.value = '';
  };

  private createTask = () => {
    const title = this.taskTitle$.value.trim();
    if (!this.projectId$.value || !title) { this.status$.value = 'Scegli un progetto e inserisci il titolo dell’attività.'; return; }
    const now = Date.now();
    const result = addTask(this.data$.value, {
      id: makeId('task'), projectId: this.projectId$.value, title,
      status: 'todo', priority: this.taskPriority$.value,
      ...(this.taskDueDate$.value ? { dueDate: this.taskDueDate$.value } : {}),
      documentIds: [], objectRecordIds: [], dependsOnTaskIds: [],
      createdAt: now, updatedAt: now,
    });
    if (!result.ok) { this.status$.value = result.error; return; }
    this.save(result.value);
    this.taskTitle$.value = '';
    this.taskDueDate$.value = '';
    this.taskPriority$.value = 'normal';
  };

  private changeStatus = (taskId: string, status: TaskStatus) => {
    const result = moveTask(this.data$.value, taskId, status);
    if (!result.ok) this.status$.value = result.error;
    else this.save(result.value);
  };

  private renderTask(task: ProjectWorkspaceData['tasks'][number]) {
    return html`<article class="task">
      <strong>${task.title}</strong>
      <div class="meta">Priorità: ${({ low: 'Bassa', normal: 'Normale', high: 'Alta', urgent: 'Urgente' } as const)[task.priority]}
        ${task.dueDate ? html` · Scadenza: ${task.dueDate}` : nothing}</div>
      <select aria-label="Stato attività" .value=${task.status}
        @change=${(event: Event) => this.changeStatus(task.id, (event.currentTarget as HTMLSelectElement).value as TaskStatus)}>
        ${STATUSES.map(status => html`<option value=${status.value}>${status.label}</option>`)}
      </select>
    </article>`;
  }

  protected override render() {
    const data = this.data$.value;
    const project = data.projects.find(item => item.id === this.projectId$.value);
    const board = project ? getTasksForKanban(data, project.id) : undefined;
    return html`
      <button @click=${() => (this.open$.value = !this.open$.value)}>Progetti (${data.projects.length})</button>
      ${this.open$.value ? html`<section class="panel" aria-label="Gestione progetti e attività">
        <div class="top"><div><strong>Progetti e attività</strong><div class="muted">Dati condivisi nel workspace AFFiNE</div></div><button @click=${() => (this.open$.value = false)}>Chiudi</button></div>
        <div class="form" style="margin-top:12px">
          <input placeholder="Nome nuovo progetto" .value=${this.projectName$.value}
            @input=${(event: Event) => (this.projectName$.value = (event.currentTarget as HTMLInputElement).value)}>
          <button class="primary" @click=${this.createProject}>Crea progetto</button>
        </div>
        ${data.projects.length ? html`
          <div class="toolbar" style="margin-top:12px">
            <select aria-label="Seleziona progetto" .value=${this.projectId$.value}
              @change=${(event: Event) => (this.projectId$.value = (event.currentTarget as HTMLSelectElement).value)}>
              ${data.projects.map(item => html`<option value=${item.id}>${item.name}</option>`)}
            </select>
            <button aria-pressed=${this.view$.value === 'kanban'} @click=${() => (this.view$.value = 'kanban')}>Kanban</button>
            <button aria-pressed=${this.view$.value === 'calendar'} @click=${() => (this.view$.value = 'calendar')}>Scadenze</button>
          </div>
          ${project ? html`
            <div class="form" style="margin-top:10px">
              <input placeholder="Nuova attività" .value=${this.taskTitle$.value}
                @input=${(event: Event) => (this.taskTitle$.value = (event.currentTarget as HTMLInputElement).value)}>
              <input type="date" aria-label="Scadenza" .value=${this.taskDueDate$.value}
                @input=${(event: Event) => (this.taskDueDate$.value = (event.currentTarget as HTMLInputElement).value)}>
              <select aria-label="Priorità" .value=${this.taskPriority$.value}
                @change=${(event: Event) => (this.taskPriority$.value = (event.currentTarget as HTMLSelectElement).value as TaskPriority)}>
                <option value="low">Bassa</option><option value="normal">Normale</option><option value="high">Alta</option><option value="urgent">Urgente</option>
              </select>
              <button class="primary" @click=${this.createTask}>Aggiungi attività</button>
            </div>
            ${this.view$.value === 'kanban' ? html`
              <div class="board">
                ${STATUSES.map(status => {
                  const tasks = !board ? [] : status.value === 'todo' ? board.todo
                    : status.value === 'in-progress' ? board.inProgress
                    : status.value === 'blocked' ? board.blocked : board.done;
                  return html`<section class="column"><h3>${status.label} (${tasks.length})</h3>${tasks.map(task => this.renderTask(task))}</section>`;
                })}
              </div>` : html`
              <div class="calendar">
                ${getTasksForCalendar(data).filter(task => task.projectId === project.id).map(task => html`
                  <div class="calendar-row"><strong>${task.dueDate ?? task.startDate ?? '—'}</strong><span>${task.title}</span></div>`)}
                ${getTasksForCalendar(data).filter(task => task.projectId === project.id).length === 0 ? html`<p class="muted">Nessuna attività con date impostate.</p>` : nothing}
              </div>`}
          ` : nothing}
        ` : html`<p class="muted">Crea il primo progetto per iniziare.</p>`}
        ${this.status$.value ? html`<p class="muted" role="status">${this.status$.value}</p>` : nothing}
      </section>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-project-manager': ProjectManager;
  }
}
