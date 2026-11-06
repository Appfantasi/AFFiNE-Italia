import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import type * as Y from 'yjs';

import {
  addCustomObjectRecord,
  addCustomObjectType,
  createEmptyCustomObjectWorkspace,
  exportCustomObjectWorkspace,
  importCustomObjectWorkspace,
  setCustomObjectValue,
  removeCustomObjectRecord,
  removeCustomObjectType,
  updateCustomObjectType,
  type CustomObjectWorkspaceData,
} from './registry.js';
import type {
  CustomFieldType,
  CustomObjectField,
  CustomObjectType,
  CustomObjectValue,
} from './model.js';

const STORAGE_PREFIX = 'affine-italia-custom-objects-v1:';
const FIELD_TYPES: Array<CustomFieldType | 'relation'> = [
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
  'relation',
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
    :host([hide-trigger]) { position: fixed; inset: 0; z-index: 2000; display: block; pointer-events: none; }
    :host([hide-trigger]) .panel { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); left: max(12px, env(safe-area-inset-left)); width: auto; max-height: none; box-sizing: border-box; overflow: auto; pointer-events: auto; }
    :host([hide-trigger]) .columns { grid-template-columns: minmax(0, 1fr); }
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

  @property({ type: Boolean, reflect: true })
  accessor hideTrigger = false;

  @property({ attribute: false })
  accessor workspaceId = 'default';

  @property({ attribute: false })
  accessor workspaceDoc: Y.Doc | undefined = undefined;

  @property({ attribute: false })
  accessor legacyStorageKey = '';

  /** Opens the manager from an external mobile navigation control. */
  openPanel() {
    this.open$.value = true;
    this.requestUpdate();
  }

  /** Connects the manager to the active AFFiNE workspace after mounting. */
  setWorkspaceContext(workspaceId: string, workspaceDoc: Y.Doc) {
    this.workspaceId = workspaceId;
    this.workspaceDoc = workspaceDoc;
    this.load();
    this.observeWorkspace();
  }

  private observedMap?: Y.Map<string>;
  private readonly onWorkspaceDataChanged = () => this.loadFromWorkspace();

  private readonly open$ = signal(false);
  private readonly data$ = signal<CustomObjectWorkspaceData>(
    createEmptyCustomObjectWorkspace()
  );
  private readonly selectedTypeId$ = signal('');
  private readonly selectedRecordId$ = signal('');
  private readonly typeName$ = signal('');
  private readonly fieldName$ = signal('');
  private readonly fieldType$ = signal<CustomFieldType | 'relation'>('text');
  private readonly fieldOptions$ = signal('');
  private readonly fieldRequired$ = signal(false);
  private readonly relationTargetId$ = signal('');
  private readonly relationCardinality$ = signal<'one' | 'many'>('one');
  private readonly typeNameEdit$ = signal('');
  private readonly recordTitle$ = signal('');
  private readonly status$ = signal('');

  override connectedCallback() {
    super.connectedCallback();
    this.load();
    this.observeWorkspace();
  }

  override disconnectedCallback() {
    this.observedMap?.unobserve(this.onWorkspaceDataChanged);
    this.observedMap = undefined;
    super.disconnectedCallback();
  }

  private observeWorkspace() {
    const map = this.workspaceDoc?.getMap<string>('affine:italia:custom-objects');
    if (!map || map === this.observedMap) return;
    this.observedMap?.unobserve(this.onWorkspaceDataChanged);
    this.observedMap = map;
    map.observe(this.onWorkspaceDataChanged);
  }

  private loadFromWorkspace() {
    const saved = this.observedMap?.get(this.workspaceId);
    if (!saved) return;
    const result = importCustomObjectWorkspace(saved);
    if (result.ok) this.data$.value = result.value;
    else this.status$.value = result.error;
  }

  private get storageKey() {
    return STORAGE_PREFIX + this.workspaceId;
  }

  private load() {
    try {
      this.observeWorkspace();
      const shared = this.workspaceDoc?.getMap<string>('affine:italia:custom-objects').get(this.workspaceId);
      if (shared) {
        const result = importCustomObjectWorkspace(shared);
        if (result.ok) this.data$.value = result.value;
        else this.status$.value = result.error;
        return;
      }
      // Migra automaticamente i dati creati dalle versioni precedenti.
      const local = localStorage.getItem(this.storageKey) ?? (this.legacyStorageKey ? localStorage.getItem(this.legacyStorageKey) : null);
      if (local) {
        const result = importCustomObjectWorkspace(local);
        if (result.ok) {
          this.data$.value = result.value;
          if (this.workspaceDoc) this.workspaceDoc.transact(() => {
            this.workspaceDoc!.getMap<string>('affine:italia:custom-objects').set(this.workspaceId, exportCustomObjectWorkspace(result.value));
          });
          return;
        }
        this.status$.value = result.error;
        return;
      }
      this.data$.value = createEmptyCustomObjectWorkspace();
    } catch {
      this.status$.value = 'Impossibile leggere i dati degli oggetti.';
    }
  }

  private save(data: CustomObjectWorkspaceData) {
    try {
      const serialized = exportCustomObjectWorkspace(data);
      if (this.workspaceDoc) {
        this.workspaceDoc.transact(() => {
          this.workspaceDoc!.getMap<string>('affine:italia:custom-objects').set(this.workspaceId, serialized);
        });
        this.data$.value = data;
        this.status$.value = 'Modifiche salvate nel workspace AFFiNE.';
      } else {
        localStorage.setItem(this.storageKey, serialized);
        this.data$.value = data;
        this.status$.value = 'Modifiche salvate localmente: workspace non disponibile.';
      }
    } catch {
      this.status$.value = 'Salvataggio non riuscito.';
    }
    this.requestUpdate();
  }

  private createType = () => {
    const name = this.typeName$.value.trim();
    if (!name) {
      this.status$.value = 'Inserisci il nome del tipo.';
      this.requestUpdate();
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
      this.requestUpdate();
      return;
    }
    this.save(result.value);
    this.selectedTypeId$.value = definition.id;
    this.selectedRecordId$.value = '';
    this.typeNameEdit$.value = name;
    this.typeName$.value = '';
    this.status$.value = `Tipo "${name}" creato correttamente.`;
    this.requestUpdate();
  };

  /** Handle creation through native form submission on desktop and Android WebView. */
  private onCreateTypeSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.createType();
  };

  private addField = () => {
    const type = this.data$.value.types.find(item => item.id === this.selectedTypeId$.value);
    const name = this.fieldName$.value.trim();
    if (!type || !name) {
      this.status$.value = 'Seleziona un tipo e inserisci il nome della proprietà.';
      this.requestUpdate();
      return;
    }
    const relationTarget = this.data$.value.types.find(item => item.id === this.relationTargetId$.value);
    const options = this.fieldOptions$.value.split(',').map(item => item.trim()).filter(Boolean);
    if ((this.fieldType$.value === 'select' || this.fieldType$.value === 'multi-select') && !options.length) {
      this.status$.value = 'Inserisci almeno un’opzione, separate da virgole.';
      this.requestUpdate();
      return;
    }
    if (this.fieldType$.value === 'relation' && (!relationTarget || relationTarget.id === type.id)) {
      this.status$.value = 'Scegli un altro tipo di oggetto da collegare.';
      this.requestUpdate();
      return;
    }

    const fieldId = makeId('field');
    const inverseFieldId = this.fieldType$.value === 'relation' ? makeId('field') : undefined;
    const field: CustomObjectField = {
      id: fieldId,
      name,
      type: this.fieldType$.value,
      ...(this.fieldRequired$.value ? { required: true } : {}),
      ...(this.fieldType$.value === 'select' || this.fieldType$.value === 'multi-select' ? { options } : {}),
      ...(relationTarget && inverseFieldId ? {
        relation: { targetTypeId: relationTarget.id, cardinality: this.relationCardinality$.value, inverseFieldId },
      } : {}),
    };

    const types = this.data$.value.types.map(item => {
      if (item.id === type.id) {
        return { ...item, fields: [...item.fields, field], updatedAt: Date.now() };
      }
      if (relationTarget && inverseFieldId && item.id === relationTarget.id) {
        let inverseName = `${type.name} collegati`;
        let suffix = 2;
        while (item.fields.some(existing => existing.name.toLocaleLowerCase() === inverseName.toLocaleLowerCase())) {
          inverseName = `${type.name} collegati ${suffix++}`;
        }
        const inverse: CustomObjectField = {
          id: inverseFieldId,
          name: inverseName,
          type: 'relation',
          relation: { targetTypeId: type.id, cardinality: 'many', inverseFieldId: fieldId },
        };
        return { ...item, fields: [...item.fields, inverse], updatedAt: Date.now() };
      }
      return item;
    });

    this.save({ ...this.data$.value, types });
    this.fieldName$.value = '';
    this.fieldOptions$.value = '';
    this.fieldRequired$.value = false;
    this.relationTargetId$.value = '';
    const updatedType = types.find(item => item.id === type.id);
    const propertyCount = updatedType?.fields.length ?? 0;
    this.status$.value = relationTarget
      ? `Proprietà aggiunta. “${type.name}” ora ne ha ${propertyCount}; anche “${relationTarget.name}” mostra il collegamento inverso. Puoi aggiungerne altre.`
      : `Proprietà aggiunta. “${type.name}” ora ne ha ${propertyCount}. Puoi aggiungerne altre.`;
    this.requestUpdate();
  };

  private renameType = () => {
    const type = this.data$.value.types.find(
      item => item.id === this.selectedTypeId$.value
    );
    const name = this.typeNameEdit$.value.trim();
    if (!type) {
      this.status$.value = 'Seleziona il tipo da rinominare.';
      this.requestUpdate();
      return;
    }
    if (!name) {
      this.status$.value = 'Inserisci il nuovo nome del tipo.';
      this.requestUpdate();
      return;
    }
    const result = updateCustomObjectType(this.data$.value, {
      ...type,
      name,
      updatedAt: Date.now(),
    });
    if (!result.ok) {
      this.status$.value = result.error;
      this.requestUpdate();
      return;
    }
    this.save(result.value);
    this.typeNameEdit$.value = name;
    this.status$.value = 'Nome del tipo aggiornato.';
    this.requestUpdate();
  };

  private onRenameTypeClick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    this.renameType();
  };

  private createRecord = () => {
    const title = this.recordTitle$.value.trim();
    const typeId = this.selectedTypeId$.value;
    if (!typeId) {
      this.status$.value = 'Seleziona prima un tipo di oggetto.';
      this.requestUpdate();
      return;
    }
    if (!title) {
      this.status$.value = 'Inserisci il titolo del nuovo oggetto.';
      this.requestUpdate();
      return;
    }

    const recordId = makeId('object');
    const result = addCustomObjectRecord(
      this.data$.value,
      typeId,
      recordId,
      title
    );
    if (!result.ok) {
      this.status$.value = result.error;
      this.requestUpdate();
      return;
    }

    this.save(result.value);
    this.selectedRecordId$.value = recordId;
    this.recordTitle$.value = '';
    this.status$.value = 'Oggetto creato correttamente.';
    this.requestUpdate();
  };

  /** Create records through native form submission on desktop and Android. */
  private onCreateRecordSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.createRecord();
  };

  private openLinkedRecord(recordId: string) {
    const record = this.data$.value.records.find(item => item.id === recordId);
    if (!record) return;
    this.selectedTypeId$.value = record.typeId;
    this.selectedRecordId$.value = record.id;
    this.typeNameEdit$.value = this.data$.value.types.find(item => item.id === record.typeId)?.name ?? '';
    this.status$.value = `Scheda “${record.title}” aperta.`;
    this.requestUpdate();
  }

  private updateFieldValue(recordId: string, fieldId: string, value: CustomObjectValue) {
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

  private deleteSelectedRecord = () => {
    const recordId = this.selectedRecordId$.value;
    if (!recordId) return;
    const result = removeCustomObjectRecord(this.data$.value, recordId);
    if (!result.ok) {
      this.status$.value = result.error;
      return;
    }
    this.save(result.value);
    this.selectedRecordId$.value = '';
    this.status$.value = 'Oggetto eliminato.';
  };

  private deleteSelectedType = () => {
    const typeId = this.selectedTypeId$.value;
    if (!typeId) return;
    const result = removeCustomObjectType(this.data$.value, typeId);
    if (!result.ok) {
      this.status$.value = result.error;
      return;
    }
    this.save(result.value);
    this.selectedTypeId$.value = '';
    this.selectedRecordId$.value = '';
    this.status$.value = 'Tipo eliminato.';
  };

  private renameRecord = (recordId: string, title: string) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      this.status$.value = 'Il titolo non può essere vuoto.';
      return;
    }
    const records = this.data$.value.records.map(record =>
      record.id === recordId
        ? { ...record, title: normalizedTitle, updatedAt: Date.now() }
        : record
    );
    this.save({ ...this.data$.value, records });
    this.status$.value = 'Titolo aggiornato.';
  };

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
    if (field.type === 'select') {
      return html`<select .value=${typeof value === 'string' ? value : ''}
        @change=${(event: Event) => this.updateFieldValue(recordId, field.id, (event.currentTarget as HTMLSelectElement).value || null)}>
        <option value="">Seleziona…</option>
        ${(field.options ?? []).map(option => html`<option value=${option}>${option}</option>`)}
      </select>`;
    }
    if (field.type === 'multi-select') {
      const selected = Array.isArray(value) ? value : [];
      return html`<select multiple .value=${selected.join('|')} @change=${(event: Event) => {
        const select = event.currentTarget as HTMLSelectElement;
        this.updateFieldValue(recordId, field.id, Array.from(select.selectedOptions).map(option => option.value));
      }}>
        ${(field.options ?? []).map(option => html`<option value=${option} ?selected=${selected.includes(option)}>${option}</option>`)}
      </select>`;
    }
    if (field.type === 'relation') {
      const options = this.data$.value.records.filter(
        item => item.typeId === field.relation?.targetTypeId && item.id !== recordId
      );
      const selectedIds = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
      const selectedRecords = this.data$.value.records.filter(item => selectedIds.includes(item.id));
      return html`
        <div class="section">
          ${field.relation?.cardinality === 'many'
            ? html`<select multiple size="3" @change=${(event: Event) => {
                const select = event.currentTarget as HTMLSelectElement;
                this.updateFieldValue(recordId, field.id, Array.from(select.selectedOptions).map(option => option.value));
              }}>
                ${options.map(item => html`<option value=${item.id} ?selected=${selectedIds.includes(item.id)}>${item.title}</option>`)}
              </select>`
            : html`<select .value=${typeof value === 'string' ? value : ''}
                @change=${(event: Event) => this.updateFieldValue(recordId, field.id, (event.currentTarget as HTMLSelectElement).value || null)}>
                <option value="">Nessun collegamento</option>
                ${options.map(item => html`<option value=${item.id}>${item.title}</option>`)}
              </select>`}
          ${selectedRecords.map(item => html`<button type="button" class="record" @click=${() => this.openLinkedRecord(item.id)}>Apri scheda: ${item.title} ↗</button>`)}
        </div>`;
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
      ${this.hideTrigger ? nothing : html`<button class="trigger" aria-label="Apri gestione oggetti personalizzati" @click=${() => (this.open$.value = !this.open$.value)}>
        Oggetti personalizzati (${data.types.length})
      </button>`}
      ${this.open$.value ? html`
        <section class="panel" aria-label="Gestione oggetti personalizzati">
          <div class="header">
            <div><strong>Gestione oggetti personalizzati</strong><p>1. Crea un tipo, ad esempio “Libro”. 2. Selezionalo e aggiungi le proprietà. 3. Crea gli oggetti di quel tipo.</p></div>
            <button @click=${() => (this.open$.value = false)} aria-label="Chiudi">✕</button>
          </div>
          <div class="notice">I dati sono conservati nel documento condiviso del workspace AFFiNE. Se il workspace non è disponibile, viene usato il salvataggio locale.</div>
          <div class="columns">
            <div class="section">
              <h3>1. Tipi di oggetto</h3>
              ${data.types.length ? data.types.map(type => html`
                <button class="type" aria-pressed=${type.id === this.selectedTypeId$.value}
                  @click=${() => { this.selectedTypeId$.value = type.id; this.selectedRecordId$.value = ''; this.typeNameEdit$.value = type.name; }}>
                  ${type.name} <span class="muted">(${data.records.filter(item => item.typeId === type.id).length})</span>
                </button>`) : html`<p class="muted">Non hai ancora creato tipi.</p>`}
              <form class="form" @submit=${this.onCreateTypeSubmit}>
                <input aria-label="Nome del nuovo tipo" placeholder="Nuovo tipo (es. Libro)" .value=${this.typeName$.value}
                  @input=${(event: Event) => (this.typeName$.value = (event.currentTarget as HTMLInputElement).value)}>
                <button class="primary" type="button" @click=${this.createType}>Crea tipo</button>
              </form>
              <div class="actions">
                <button @click=${this.exportBackup}>Esporta backup</button>
                <label><input type="file" accept="application/json,.json" @change=${this.importBackup} hidden>Importa backup</label>
              </div>
            </div>
            <div class="section">
              ${selectedType ? html`
                <h3>2. Proprietà di: ${selectedType.name} (${selectedType.fields.length})</h3>
                <div class="form">
                  <input aria-label="Rinomina tipo" placeholder="Nome del tipo" .value=${this.typeNameEdit$.value || selectedType.name}
                    @input=${(event: Event) => (this.typeNameEdit$.value = (event.currentTarget as HTMLInputElement).value)}>
                  <button type="button" @click=${this.onRenameTypeClick}>Rinomina</button>
                </div>
                ${selectedType.fields.length ? selectedType.fields.map(field => html`
                  <div class="row"><span>${field.name}</span><span class="muted">${field.type}</span></div>`) : html`<p class="muted">Aggiungi la prima proprietà.</p>`}
                <div class="form">
                  <input placeholder="Nome proprietà" .value=${this.fieldName$.value}
                    @input=${(event: Event) => (this.fieldName$.value = (event.currentTarget as HTMLInputElement).value)}>
                  <select .value=${this.fieldType$.value}
                    @change=${(event: Event) => (this.fieldType$.value = (event.currentTarget as HTMLSelectElement).value as CustomFieldType)}>
                    ${FIELD_TYPES.map(type => html`<option value=${type}>${type}</option>`)}
                  </select>
                  ${this.fieldType$.value === 'select' || this.fieldType$.value === 'multi-select' ? html`<input placeholder="Opzioni separate da virgole" .value=${this.fieldOptions$.value}
                    @input=${(event: Event) => (this.fieldOptions$.value = (event.currentTarget as HTMLInputElement).value)}>` : nothing}
                  ${this.fieldType$.value === 'relation' ? html`
                    <select aria-label="Tipo collegato" .value=${this.relationTargetId$.value} @change=${(event: Event) => (this.relationTargetId$.value = (event.currentTarget as HTMLSelectElement).value)}>
                      <option value="">Tipo da collegare…</option>
                      ${data.types.filter(item => item.id !== selectedType.id).map(item => html`<option value=${item.id}>${item.name}</option>`)}
                    </select>
                    <select aria-label="Numero collegamenti" .value=${this.relationCardinality$.value} @change=${(event: Event) => (this.relationCardinality$.value = (event.currentTarget as HTMLSelectElement).value as 'one' | 'many')}>
                      <option value="one">Un solo oggetto</option>
                      <option value="many">Più oggetti</option>
                    </select>` : nothing}
                  <label class="muted"><input type="checkbox" .checked=${this.fieldRequired$.value}
                    @change=${(event: Event) => (this.fieldRequired$.value = (event.currentTarget as HTMLInputElement).checked)}>Obbligatoria</label>
                  <button type="button" class="primary" @click=${this.addField}>Aggiungi proprietà</button>
                </div>
                <h3>3. Oggetti di tipo ${selectedType.name}</h3>
                <div class="record-list">
                  ${records.map(record => html`
                    <button class="record" aria-pressed=${record.id === this.selectedRecordId$.value}
                      @click=${() => (this.selectedRecordId$.value = record.id)}>${record.title}</button>`)}
                </div>
                <form class="form" @submit=${this.onCreateRecordSubmit}>
                  <input aria-label="Titolo del nuovo oggetto" placeholder="Es. Il nome del libro" .value=${this.recordTitle$.value}
                    @input=${(event: Event) => (this.recordTitle$.value = (event.currentTarget as HTMLInputElement).value)}>
                  <button type="button" class="primary" @click=${this.createRecord}>Crea nuovo oggetto</button>
                </form>
                ${selectedRecord && selectedRecord.typeId === selectedType.id ? html`
                  <h3>Modifica oggetto</h3>
                  <div class="form">
                    <input aria-label="Titolo oggetto" .value=${selectedRecord.title}
                      @change=${(event: Event) => this.renameRecord(selectedRecord.id, (event.currentTarget as HTMLInputElement).value)}>
                    <button @click=${this.deleteSelectedRecord}>Elimina oggetto</button>
                  </div>
                  ${selectedType.fields.map(field => html`
                    <div class="field"><label>${field.name}</label>${this.renderFieldEditor(field, selectedRecord.id)}</div>`)}
                ` : nothing}
                <div class="actions"><button @click=${this.deleteSelectedType}>Elimina tipo di oggetto</button></div>
                <p class="muted">Per eliminare un tipo, elimina prima gli oggetti che contiene e rimuovi le relazioni che lo utilizzano.</p>
              ` : html`<p class="muted">Per iniziare, scrivi un nome nella sezione “1. Tipi di oggetto” e premi “Crea tipo”. Poi seleziona il tipo creato, aggiungi le proprietà (ad esempio autore, anno, stato) e infine crea un nuovo oggetto nella sezione 3.</p>`}
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
