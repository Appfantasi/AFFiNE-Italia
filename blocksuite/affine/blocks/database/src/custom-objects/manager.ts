import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import {
  addCustomObjectRecord,
  addCustomObjectType,
  createEmptyCustomObjectWorkspace,
  exportCustomObjectWorkspace,
  importCustomObjectWorkspace,
  setCustomObjectValue,
  type CustomObjectWorkspaceData,
} from '../../custom-objects/registry.js';
import type {
  CustomFieldType,
  CustomObjectField,
  CustomObjectType,
} from '../../custom-objects/model.js';

const STORAGE_PREFIX = 'affine-italia-custom-objects-v1:';
const FIELD_TYPES: CustomFieldType[] = [
  'text',
  'number',
  'date',
  'checkbox',
  'select',
  'multi-select',
  'url',
  'email',
  'file',
  'image',
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export class CustomObjectManager extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    :host { display: inline-flex; position: relative; font: inherit; color: var(--affine-text-primary-color); }
    button, input, select { font: inherit; }
    button { cursor: pointer; border: 1px solid var(--affine-border-color); border-radius: 8px; padding: 6px 10px; background: var(--affine-background-primary-color); color: inherit; }
    button.primary { background: var(--affine-primary-color); color: white; border-color: transparent; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    .trigger { white-space: nowrap; }
    .panel { position: absolute; z-index: 1000; top: calc(100% + 8px); right: 0; width: min( min(720px, calc(100vw - 32px)), 720px); max-height: min(75vh, 720px); overflow: auto; padding: 16px; border: 1px solid var(--affine-border-color); border-radius: 12px; background: var(--affine-background-overlay-panel-color, var(--affine-background-primary-color)); box-shadow: 0 12px 36px #0002; }
    .header, .row, .actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .columns { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(240px, 1.5fr); gap: 16px; margin-top: 14px; }
    .section { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
    h3 { margin: 0 0 4px; font-size: 14px; }
    p, .muted { color: var(--affine-text-secondary-color); font-size: 12px; margin: 0; }
    input, select { min-width: 0; width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid var(--affine-border-color); border-radius: 7px; color: inherit; background: var(--affine-background-primary-color); }
    .form { display: flex; gap: 6px; flex-wrap: wrap; }
    .form > * { flex: 1 1 110px; }
    .type, .record { text-align: left; width: 100%; }
    .type[aria-pressed="true"], .record[aria-pressed="true"] { border-color: var(--affine-primary-color); background: var(--affine-hover-color); }
    .record-list { display: flex; flex-direction: column; gap: 6px; }
    .field { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; }
    .notice { padding: 9px; border-radius: 8px; background: var(--affine-background-secondary-color); font-size: 12px; }
    @media (max-width: 560px) { .panel { position: fixed; top: 12px; left: 12px; right: 12px; width: auto; max-height: calc(100vh - 24px); } .columns { grid-template-columns: 1fr; } }
  `;

  @property({ attribute: false })
  accessor workspaceId = 'default';

  private readonly open$ = signal(false);
  private readonly data$ = signal<CustomObjectWorkspaceData>(
    createEmptyCustomObjectWorkspace()
  );
  private readonly selectedTypeId$ = signal('');
  private readonly selectedRecordId$ = signal('');
  private readonly typeName$ = signal('');
  private readonly fieldName$ = signal('');
  private readonly fieldType$ = signal<CustomFieldType>('text');
  private readonly recordTitle$ = signal('');
  private readonly status$ = signal('');

  override connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  private get storageKey() {
    return STORAGE_PREFIX + this.workspaceId;
  }

  private load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) {
        this.data$.value = createEmptyCustomObjectWorkspace();
        return;
      }
      const result = importCustomObjectWorkspace(saved);
      if (result.ok) {
        this.data$.value = result.value;
      } else {
        this.status$.value = result.error;
      }
    } catch {
      this.status$.value = 'Impossibile leggere i dati locali degli oggetti.';
    }
  }

  private save(data: CustomObjectWorkspaceData) {
    try {
      localStorage.setItem(this.storageKey, exportCustomObjectWorkspace(data));
      this.data$.value = data;
      this.status$.value = 'Modifiche salvate su questo dispositivo.';
    } catch {
      this.status$.value = 'Salvataggio non riuscito: spazio locale non disponibile.';
    }
  }

  private createType = () => {
    const name = this.typeName$.value.trim();
    if (!name) {
      this.status$.value = 'Inserisci il nome del tipo.';
      return;
    }
    const now = Date.now();
    const definition: CustomObjectType = {
      id: makeId('type'),
      name,
      fields: [],
      createdAt: now,
      updatedAt: now,
    };
    const result = addCustomObjectType(this.data$.value, definition);
    if (!result.ok) {
      this.status$.value = result.error;
      return;
    }
    this.save(result.value);
    this.selectedTypeId$.value = definition.id;
    this.typeName$.value = '';
  };

  private addField = () => {
    const type = this.data$.value.types.find(
      item => item.id === this.selectedTypeId$.value
    );
    const name = this.fieldName$.value.trim();
    if (!type || !name) {
      this.status$.value = 'Seleziona un tipo e inserisci il nome della proprietà.';
      return;
    }
    const field: CustomObjectField = {
      id: makeId('field'),
      name,
      type: this.fieldType$.value,
      ...(this.fieldType$.value === 'select' || this.fieldType$.value === 'multi-select'
        ? { options: ['Da definire'] }
        : {}),
    };
    const updated = { ...type, fields: [...type.fields, field], updatedAt: Date.now() };
    const result = this.data$.value.types.map(item =>
      item.id === type.id ? updated : item
    );
    this.save({ ...this.data$.value, types: result });
    this.fieldName$.value = '';
  };

  private createRecord = () => {
    const title = this.recordTitle$.value.trim();
    if (!title || !this.selectedTypeId$.value) {
      this.status$.value = 'Seleziona un tipo e inserisci il titolo dell’oggetto.';
      return;
    }
    const result = addCustomObjectRecord(
      this.data$.value,
      this.selectedTypeId$.value,
      makeId('object'),
      title
    );
    if (!result.ok) {
      this.status$.value = result.error;
      return;
    }
    this.save(result.value);
    this.selectedRecordId$.value = result.value.records.at(-1)?.id ?? '';
    this.recordTitle$.value = '';
  };

  private updateFieldValue(recordId: string, fieldId: string, value: string | number | boolean) {
    const result = setCustomObjectValue(
      this.data$.value,
      recordId,
      fieldId,
      value
    );
    if (!result.ok) {
      this.status$.value = result.error;
      return;
    }
    this.save(result.value);
  }

  private exportBackup = () => {
    const blob = new Blob([exportCustomObjectWorkspace(this.data$.value)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'affine-italia-oggetti.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  private importBackup = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const result = importCustomObjectWorkspace(await file.text());
    if (!result.ok) {
      this.status$.value = result.error;
    } else {
      this.save(result.value);
      this.status$.value = 'Backup importato e salvato su questo dispositivo.';
    }
    input.value = '';
  };

  private renderFieldEditor(field: CustomObjectField, recordId: string) {
    const record = this.data$.value.records.find(item => item.id === recordId);
    const value = record?.values[field.id] ?? null;
    if (field.type === 'checkbox') {
      return html`<input type="checkbox" .checked=${value === true}
        @change=${(event: Event) => this.updateFieldValue(recordId, field.id, (event.currentTarget as HTMLInputElement).checked)}>`;
    }
    if (field.type === 'relation') {
      const options = this.data$.value.records.filter(
        item => item.typeId === field.relation?.targetTypeId && item.id !== recordId
      );
      return html`<select .value=${typeof value === 'string' ? value : ''}
        @change=${(event: Event) => this.updateFieldValue(recordId, field.id, (event.currentTarget as HTMLSelectElement).value)}>
        <option value="">Nessun collegamento</option>
        ${options.map(item => html`<option value=${item.id}>${item.title}</option>`)}
      </select>`;
    }
    const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text';
    return html`<input type=${inputType} .value=${value === null ? '' : String(value)}
      @change=${(event: Event) => {
        const raw = (event.currentTarget as HTMLInputElement).value;
        this.updateFieldValue(recordId, field.id, field.type === 'number' ? Number(raw) : raw);
      }}>`;
  }

  protected override render() {
    const data = this.data$.value;
    const selectedType = data.types.find(type => type.id === this.selectedTypeId$.value);
    const selectedRecord = data.records.find(record => record.id === this.selectedRecordId$.value);
    const records = data.records.filter(record => record.typeId === selectedType?.id);

    return html`
      <button class="trigger" @click=${() => (this.open$.value = !this.open$.value)}>
        Oggetti (${data.types.length})
      </button>
      ${this.open$.value ? html`
        <section class="panel" aria-label="Gestione oggetti personalizzati">
          <div class="header">
            <div><strong>Oggetti personalizzati</strong><p>Tipi, proprietà e collegamenti</p></div>
            <button @click=${() => (this.open$.value = false)} aria-label="Chiudi">✕</button>
          </div>
          <div class="notice">I dati di questa prima versione sono salvati localmente su questo dispositivo e non sono ancora sincronizzati con gli altri dispositivi.</div>
          <div class="columns">
            <div class="section">
              <h3>Tipi di oggetto</h3>
              ${data.types.length ? data.types.map(type => html`
                <button class="type" aria-pressed=${type.id === this.selectedTypeId$.value}
                  @click=${() => { this.selectedTypeId$.value = type.id; this.selectedRecordId$.value = ''; }}>
                  ${type.name} <span class="muted">(${data.records.filter(item => item.typeId === type.id).length})</span>
                </button>`) : html`<p class="muted">Non hai ancora creato tipi.</p>`}
              <div class="form">
                <input placeholder="Nuovo tipo (es. Libro)" .value=${this.typeName$.value}
                  @input=${(event: Event) => (this.typeName$.value = (event.currentTarget as HTMLInputElement).value)}>
                <button class="primary" @click=${this.createType}>Crea tipo</button>
              </div>
              <div class="actions">
                <button @click=${this.exportBackup}>Esporta backup</button>
                <label><input type="file" accept="application/json,.json" @change=${this.importBackup} hidden>Importa backup</label>
              </div>
            </div>
            <div class="section">
              ${selectedType ? html`
                <h3>Proprietà di: ${selectedType.name}</h3>
                ${selectedType.fields.length ? selectedType.fields.map(field => html`
                  <div class="row"><span>${field.name}</span><span class="muted">${field.type}</span></div>`) : html`<p class="muted">Aggiungi la prima proprietà.</p>`}
                <div class="form">
                  <input placeholder="Nome proprietà" .value=${this.fieldName$.value}
                    @input=${(event: Event) => (this.fieldName$.value = (event.currentTarget as HTMLInputElement).value)}>
                  <select .value=${this.fieldType$.value}
                    @change=${(event: Event) => (this.fieldType$.value = (event.currentTarget as HTMLSelectElement).value as CustomFieldType)}>
                    ${FIELD_TYPES.map(type => html`<option value=${type}>${type}</option>`)}
                  </select>
                  <button @click=${this.addField}>Aggiungi</button>
                </div>
                <h3>Oggetti di questo tipo</h3>
                <div class="record-list">
                  ${records.map(record => html`
                    <button class="record" aria-pressed=${record.id === this.selectedRecordId$.value}
                      @click=${() => (this.selectedRecordId$.value = record.id)}>${record.title}</button>`)}
                </div>
                <div class="form">
                  <input placeholder="Titolo nuovo oggetto" .value=${this.recordTitle$.value}
                    @input=${(event: Event) => (this.recordTitle$.value = (event.currentTarget as HTMLInputElement).value)}>
                  <button class="primary" @click=${this.createRecord}>Crea oggetto</button>
                </div>
                ${selectedRecord && selectedRecord.typeId === selectedType.id ? html`
                  <h3>Modifica: ${selectedRecord.title}</h3>
                  ${selectedType.fields.map(field => html`
                    <div class="field"><label>${field.name}</label>${this.renderFieldEditor(field, selectedRecord.id)}</div>`)}
                ` : nothing}
              ` : html`<p class="muted">Crea o seleziona un tipo per gestire proprietà e oggetti.</p>`}
            </div>
          </div>
          ${this.status$.value ? html`<p role="status">${this.status$.value}</p>` : nothing}
        </section>
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-custom-object-manager': CustomObjectManager;
  }
}
