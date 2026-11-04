import {SignalWatcher,WithDisposable} from '@blocksuite/global/lit';
import {ShadowlessElement} from '@blocksuite/std';
import {signal} from '@preact/signals-core';
import {css,html,nothing} from 'lit';
import {property} from 'lit/decorators.js';
import type * as Y from 'yjs';
import {createEmptyDocumentArchive,exportDocumentArchive,importDocumentArchive,searchArchivedDocuments,upsertArchivedDocument} from './registry.js';
import type {ArchivedDocument,DocumentArchiveData} from './model.js';
type WorkspaceDocMeta={id:string;title:string};
function readWorkspaceDocs(doc?:Y.Doc):WorkspaceDocMeta[]{if(!doc)return[];try{const meta=doc.getMap('meta');const pages=meta.get('pages') as {toJSON?:()=>unknown}|undefined;const raw=pages?.toJSON?.();if(!Array.isArray(raw))return[];return raw.filter((item):item is Record<string,unknown>=>!!item&&typeof item==='object').map(item=>({id:typeof item.id==='string'?item.id:'',title:typeof item.title==='string'&&item.title.trim()?item.title:'Documento senza titolo'})).filter(item=>item.id)}catch{return[]}}
function splitList(value:string){return [...new Set(value.split(',').map(item=>item.trim()).filter(Boolean))]}
export class DocumentArchiveManager extends SignalWatcher(WithDisposable(ShadowlessElement)){
static override styles=css`
:host{display:inline-flex;position:relative;font:inherit;color:var(--affine-text-primary-color)}button,input,select,textarea{font:inherit}button{cursor:pointer;border:1px solid var(--affine-border-color);border-radius:8px;padding:6px 10px;background:var(--affine-background-primary-color);color:inherit}button.primary{background:var(--affine-primary-color);color:white;border-color:transparent}.panel{position:absolute;z-index:1000;top:calc(100% + 8px);right:0;width:min(820px,calc(100vw - 32px));max-height:min(78vh,760px);overflow:auto;padding:16px;border:1px solid var(--affine-border-color);border-radius:12px;background:var(--affine-background-overlay-panel-color,var(--affine-background-primary-color));box-shadow:0 12px 36px #0002}.toolbar,.form,.header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.header{justify-content:space-between}input,select,textarea{box-sizing:border-box;min-width:0;flex:1 1 180px;padding:8px;border:1px solid var(--affine-border-color);border-radius:7px;color:inherit;background:var(--affine-background-primary-color)}textarea{min-height:58px}.entry{padding:10px 0;border-bottom:1px solid var(--affine-border-color)}.entry strong{display:block}.muted{color:var(--affine-text-secondary-color);font-size:12px}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.tag{border-radius:10px;padding:2px 7px;background:var(--affine-background-secondary-color);font-size:11px}@media(max-width:480px){.panel{position:fixed;top:12px;left:12px;right:12px;width:auto;max-height:calc(100vh - 24px)}}
`;
@property({attribute:false}) accessor workspaceId='default';
@property({attribute:false}) accessor workspaceDoc:Y.Doc|undefined=undefined;
private readonly open$=signal(false);
private readonly data$=signal<DocumentArchiveData>(createEmptyDocumentArchive());
private readonly docs$=signal<WorkspaceDocMeta[]>([]);
private readonly selectedDoc$=signal('');
private readonly category$=signal('');
private readonly tags$=signal('');
private readonly description$=signal('');
private readonly projects$=signal('');
private readonly tasks$=signal('');
private readonly objects$=signal('');
private readonly query$=signal('');
private readonly categoryFilter$=signal('');
private readonly status$=signal('');
private observedMap?:Y.Map<string>;
private readonly changed=()=>this.loadShared();
override connectedCallback(){super.connectedCallback();this.docs$.value=readWorkspaceDocs(this.workspaceDoc);this.load()}
override disconnectedCallback(){this.observedMap?.unobserve(this.changed);this.observedMap=undefined;super.disconnectedCallback()}
private load(){const map=this.workspaceDoc?.getMap<string>('affine:italia:document-archive');if(!map)return;this.observedMap=map;map.observe(this.changed);this.loadShared()}
private loadShared(){const raw=this.observedMap?.get(this.workspaceId);if(!raw)return;const result=importDocumentArchive(raw);if(result.ok)this.data$.value=result.value;else this.status$.value=result.error}
private save(data:DocumentArchiveData){if(!this.workspaceDoc){this.status$.value='Workspace non disponibile: archivio non salvato.';return}this.workspaceDoc.transact(()=>this.workspaceDoc!.getMap<string>('affine:italia:document-archive').set(this.workspaceId,exportDocumentArchive(data)));this.data$.value=data;this.status$.value='Archivio salvato nel workspace AFFiNE.'}
private addOrUpdate=()=>{const doc=this.docs$.value.find(item=>item.id===this.selectedDoc$.value);if(!doc){this.status$.value='Seleziona un documento del workspace.';return}const entry:ArchivedDocument={docId:doc.id,title:doc.title,category:this.category$.value.trim()||'Senza categoria',tags:splitList(this.tags$.value),description:this.description$.value.trim(),projectIds:splitList(this.projects$.value),taskIds:splitList(this.tasks$.value),objectRecordIds:splitList(this.objects$.value),updatedAt:Date.now()};const result=upsertArchivedDocument(this.data$.value,entry);if(!result.ok){this.status$.value=result.error;return}this.save(result.value);this.status$.value='Documento aggiunto all’archivio.'}
private exportBackup=()=>{const url=URL.createObjectURL(new Blob([exportDocumentArchive(this.data$.value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='affine-italia-archivio-documenti.json';a.click();URL.revokeObjectURL(url)}
private importBackup=async(event:Event)=>{const input=event.currentTarget as HTMLInputElement;const file=input.files?.[0];if(!file)return;const result=importDocumentArchive(await file.text());if(result.ok)this.save(result.value);else this.status$.value=result.error;input.value=''}
protected override render(){const results=searchArchivedDocuments(this.data$.value,this.query$.value,this.categoryFilter$.value);const categories=[...new Set(this.data$.value.entries.map(entry=>entry.category))].sort();return html`
<button @click=${()=>{this.open$.value=!this.open$.value;this.docs$.value=readWorkspaceDocs(this.workspaceDoc)}}>Archivio (${this.data$.value.entries.length})</button>
${this.open$.value?html`<section class="panel" aria-label="Archivio documentale">
<div class="header"><div><strong>Archivio documentale</strong><div class="muted">Categorie, tag e collegamenti salvati nel workspace</div></div><button @click=${()=>this.open$.value=false}>Chiudi</button></div>
<div class="form" style="margin-top:12px">
<select aria-label="Documento del workspace" .value=${this.selectedDoc$.value} @change=${(e:Event)=>this.selectedDoc$.value=(e.currentTarget as HTMLSelectElement).value}><option value="">Seleziona documento AFFiNE…</option>${this.docs$.value.map(doc=>html`<option value=${doc.id}>${doc.title}</option>`)}</select>
<input placeholder="Categoria (es. Lavoro, Studio)" aria-label="Categoria" .value=${this.category$.value} @input=${(e:Event)=>this.category$.value=(e.currentTarget as HTMLInputElement).value}>
<input placeholder="Tag separati da virgola" aria-label="Tag" .value=${this.tags$.value} @input=${(e:Event)=>this.tags$.value=(e.currentTarget as HTMLInputElement).value}>
<textarea placeholder="Descrizione o note" aria-label="Descrizione" .value=${this.description$.value} @input=${(e:Event)=>this.description$.value=(e.currentTarget as HTMLTextAreaElement).value}></textarea>
<input placeholder="ID progetti collegati (virgole)" aria-label="Progetti collegati" .value=${this.projects$.value} @input=${(e:Event)=>this.projects$.value=(e.currentTarget as HTMLInputElement).value}>
<input placeholder="ID attività collegate (virgole)" aria-label="Attività collegate" .value=${this.tasks$.value} @input=${(e:Event)=>this.tasks$.value=(e.currentTarget as HTMLInputElement).value}>
<input placeholder="ID oggetti personalizzati (virgole)" aria-label="Oggetti collegati" .value=${this.objects$.value} @input=${(e:Event)=>this.objects$.value=(e.currentTarget as HTMLInputElement).value}>
<button class="primary" @click=${this.addOrUpdate}>Aggiungi / aggiorna</button></div>
<div class="toolbar" style="margin-top:14px"><input placeholder="Cerca titolo, descrizione, tag…" aria-label="Cerca archivio" .value=${this.query$.value} @input=${(e:Event)=>this.query$.value=(e.currentTarget as HTMLInputElement).value}>
<select aria-label="Filtra categoria" .value=${this.categoryFilter$.value} @change=${(e:Event)=>this.categoryFilter$.value=(e.currentTarget as HTMLSelectElement).value}><option value="">Tutte le categorie</option>${categories.map(category=>html`<option value=${category}>${category}</option>`)}</select></div>
${results.length?results.map(entry=>html`<article class="entry"><strong>${entry.title}</strong><div class="muted">ID documento: ${entry.docId} · ${entry.category}</div>${entry.description?html`<p>${entry.description}</p>`:nothing}<div class="tags">${entry.tags.map(tag=>html`<span class="tag">${tag}</span>`)}${entry.projectIds.map(id=>html`<span class="tag">Progetto: ${id}</span>`)}${entry.taskIds.map(id=>html`<span class="tag">Attività: ${id}</span>`)}${entry.objectRecordIds.map(id=>html`<span class="tag">Oggetto: ${id}</span>`)}</div></article>`):html`<p class="muted">Nessun documento corrisponde alla ricerca.</p>`}
<div class="toolbar" style="margin-top:12px"><button @click=${this.exportBackup}>Esporta archivio JSON</button><label class="muted">Importa backup <input type="file" accept="application/json,.json" @change=${this.importBackup}></label></div>
${this.status$.value?html`<p class="muted" role="status">${this.status$.value}</p>`:nothing}</section>`:nothing}`;}}
declare global{interface HTMLElementTagNameMap{'affine-document-archive':DocumentArchiveManager}}
