# AFFiNE Italia — Architettura del workspace relazionale

## Decisioni di prodotto

- Base applicativa: fork `Appfantasi/AFFiNE-Italia`.
- Destinazioni: Windows 11 e Android.
- Modalità dati: local-first, senza account o server obbligatorio; i dati devono restare disponibili offline.
- Ambito: suite completa con documenti, database relazionali e project management.
- Nessuna funzione AI richiesta e nessuna dipendenza da servizi a pagamento.
- Interfaccia e messaggi dell'applicazione in italiano.

## Obiettivo

Aggiungere un livello relazionale generale al workspace. L'utente deve poter definire tipi di oggetto, proprietà, record e relazioni senza modificare il codice. Un record deve poter contenere una pagina/documento AFFiNE e deve poter essere mostrato in più viste.

## Architettura logica

1. **Schema registry** — definizioni versionate dei tipi, delle proprietà e delle relazioni.
2. **Record store** — record identificati da UUID, con valori tipizzati e riferimento opzionale al documento AFFiNE.
3. **Relation store** — archi tra record, con tipo di relazione, cardinalità e regole di eliminazione.
4. **Query e indici** — filtri, ordinamenti, raggruppamenti e risoluzione delle relazioni inverse. Gli indici sono ricostruibili dai dati primari.
5. **View layer** — tabella, schede/Kanban, calendario, galleria e lista.
6. **Workspace UI** — editor e documenti AFFiNE esistenti, con pannelli per database, progetti e attività.

## Modello dati

### Tipi di proprietà iniziali

- testo breve e testo lungo
- numero e valuta (valore numerico più codice valuta)
- data e data/ora
- booleano
- selezione singola e multipla
- URL ed e-mail
- persona
- file e immagine
- relazione verso un altro tipo di oggetto

Ogni proprietà ha un ID stabile, nome, tipo, obbligatorietà, configurazione e posizione. Rinominare una proprietà non deve cambiare il suo ID. Il cambio di tipo deve essere validato e non deve perdere silenziosamente i valori incompatibili.

### Tipi e record

Ogni tipo ha ID, nome, icona opzionale, descrizione, proprietà e date di creazione/modifica. Ogni record ha ID, tipo, valori per ID proprietà, date di creazione/modifica e un eventuale riferimento al documento AFFiNE associato.

### Relazioni

Le relazioni sono entità esplicite, non semplici stringhe o ID digitati a mano. Ogni definizione stabilisce:
- tipo sorgente e tipo destinazione;
- cardinalità: uno-a-uno, uno-a-molti o molti-a-molti;
- nome della relazione e nome inverso;
- comportamento alla cancellazione: impedisci, scollega o elimina in cascata (la cascata è disattivata per impostazione predefinita).

Un collegamento viene memorizzato una sola volta. La vista inversa viene risolta interrogando la stessa relazione: non si mantengono due copie indipendenti che possono divergere. La creazione, modifica e rimozione devono essere transazionali.

## Persistenza locale

Riutilizzare il modello local-first e il ciclo di vita del workspace AFFiNE/BlockSuite. Prima di scegliere un contenitore concreto, verificare il provider effettivo usato da Windows ed Android nel ramo di sviluppo.

Il modello logico deve essere indipendente dal backend di persistenza. Le modifiche allo schema e ai dati devono essere versionate e migrabili. I dati primari devono essere persistiti nel workspace; cache e indici devono poter essere ricostruiti. Nessuna chiamata di rete è necessaria per creare, leggere o collegare record.

Non serializzare l'intero database in un'unica stringa JSON in una mappa Yjs: usare strutture dati versionate e granulari compatibili con le transazioni del workspace, dopo aver verificato le convenzioni del provider AFFiNE.

## Integrità, migrazioni e backup

- UUID stabili per tipi, proprietà, record e relazioni.
- Validazione di tipo, cardinalità e riferimenti prima del commit.
- Migrazioni numerate, idempotenti e testate su workspace di esempio.
- Esportazione/importazione JSON versionata con validazione prima dell'importazione.
- Backup completo del workspace tramite i meccanismi supportati da AFFiNE, più esportazione portabile dei database.
- Nessuna cancellazione a cascata implicita.

## Interfaccia utente

### Gestione tipi
- Crea, rinomina e archivia un tipo.
- Aggiungi più proprietà in sequenza.
- Modifica, riordina e rimuovi proprietà.
- Anteprima del tipo e validazione delle modifiche.

### Gestione record
- Crea record scegliendo il tipo.
- Modulo dinamico con tutti i campi configurati.
- Modifica e cancella record con conferma e gestione dei riferimenti.

### Relazioni
- Selettore di record ricercabile; mai richiedere all'utente di copiare ID.
- Selezione multipla quando la cardinalità lo consente.
- Sezione relazioni in entrambe le schede degli oggetti.
- Apertura diretta del documento collegato.

### Viste e project management
- Tabella come prima vista verificabile.
- Kanban basato su una proprietà selezione.
- Calendario basato su una proprietà data.
- Galleria e lista in fasi successive.
- Progetti, attività, scadenze e dipendenze modellati usando gli stessi tipi, proprietà e relazioni, non con un archivio parallelo.

## Fasi di implementazione

1. **Ricognizione tecnica**: mappare provider, lifecycle, schema database esistente, UI desktop/mobile e test; identificare il codice sperimentale preesistente da riusare o rimuovere.
2. **Core e test**: schema registry, proprietà, record, validazione, relazioni bidirezionali e migrazioni.
3. **Persistenza workspace**: integrazione con il provider locale effettivo e test di chiusura/riapertura e offline.
4. **UI database**: creazione tipo, proprietà multiple, record e relazioni senza inserimento manuale di ID.
5. **Viste**: tabella, Kanban, calendario, lista e galleria.
6. **Documenti e progetti**: record collegati a pagine, note, progetti e attività.
7. **Backup e distribuzione**: import/export, Windows 11 e Android, test di regressione.

## Criteri di accettazione minimi

- Un tipo può avere almeno più proprietà di tipi differenti; ogni proprietà può essere modificata o rimossa.
- Si possono creare, modificare e cancellare record del tipo.
- Un libro può essere collegato a un autore e a più documenti/appunti.
- Aprendo l'autore si vedono i libri collegati senza creare manualmente la relazione inversa.
- Le relazioni restano dopo chiusura e riapertura del workspace.
- Tutte le operazioni principali funzionano con interfaccia Windows e Android, anche offline.
- Un backup esportato può essere importato in un workspace vuoto e conserva tipi, proprietà, record e relazioni.
- Test automatici per cardinalità, riferimenti mancanti, cancellazione, migrazioni e round-trip backup.

## Regole di sviluppo

Non sostituire il database AFFiNE esistente alla cieca. Prima mappare le API e i provider effettivi del ramo. Separare il core dai componenti UI e aggiungere test prima di collegare i pulsanti. Ogni fase deve produrre una build verificabile per le piattaforme interessate.
