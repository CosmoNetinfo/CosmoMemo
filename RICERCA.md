# Spazio: ricerca e prima implementazione

Ricerca svolta l’8 novembre 2026 sulla documentazione ufficiale pubblicamente accessibile. Il prodotto realizzato è un’applicazione indipendente ispirata ai flussi di Notion. Non è una replica completa del servizio né utilizza il suo marchio, codice o contenuti proprietari.

## Cosa rende Notion riconoscibile

### 1. Il documento è una sequenza di blocchi

Notion tratta testo, titoli, liste e contenuti speciali come elementi manipolabili della pagina. Menu con `+`, maniglia laterale e comando `/` rendono accessibili inserimento e trasformazione. Il vantaggio è poter riorganizzare il documento mantenendo una superficie di scrittura semplice. Le scorciatoie riducono la distanza tra scrittura e strutturazione.

Fonte: [Intro to writing & editing](https://www.notion.com/help/writing-and-editing-basics), [Keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts).

**Scelta per Spazio:** editor con dieci tipi di blocco: testo, tre livelli di titolo, attività, elenco puntato, citazione, evidenza, codice e divisore. Invio crea il blocco successivo; `/` apre un selettore filtrabile. I blocchi possono essere duplicati, eliminati o spostati con trascinamento e comandi su/giù. Il testo incollato viene inserito come testo semplice. La formattazione inline avanzata, gli allegati, le equazioni e gli embed non sono implementati.

### 2. Una gerarchia di pagine diventa un workspace

La barra laterale di Notion consente di navigare lo spazio di lavoro, mentre le pagine possono contenere altre pagine. I preferiti costituiscono una navigazione personale più breve della gerarchia completa.

Fonte: [Intro to workspaces](https://www.notion.com/help/intro-to-workspaces), [Writing & editing](https://www.notion.com/help/writing-and-editing-basics).

**Scelta per Spazio:** barra laterale con home, progetti, preferiti e albero delle pagine; creazione di sottopagine dal documento; modifica di titolo e icona; duplicazione, cestino e ripristino. La ricerca comprende titoli e testo. La home propone pagine aggiornate recentemente, creazione rapida e attività da completare. I contenuti iniziali sono esempi modificabili, non dati recuperati dall’account Notion.

### 3. I database permettono più letture degli stessi dati

Notion presenta gli stessi record attraverso viste diverse. Nella tabella le proprietà diventano colonne; la bacheca raggruppa gli elementi e favorisce la lettura degli stati di avanzamento. Filtri e ordinamenti modificano la vista dei dati.

Fonte: [Database views, filters, sorts & groups](https://www.notion.com/help/views-filters-and-sorts).

**Scelta per Spazio:** un database di attività personale con nome, stato, priorità, scadenza e area. Tabella e bacheca usano gli stessi record. Si possono aggiungere attività, modificare proprietà, filtrare per stato, cercare per titolo e ordinare alfabeticamente. Il trascinamento sposta le schede tra stati; un selettore permette la stessa azione su dispositivi touch. Non è ancora un motore di database generici: le proprietà sono predefinite e non ci sono viste calendario o timeline.

### 4. Relazioni e rollup costituiscono un livello diverso di complessità

Le relazioni collegano record di database diversi; i rollup aggregano proprietà di record collegati. Non sono semplici elementi grafici: richiedono un modello dati, gestione dei riferimenti e calcoli coerenti.

Fonte: [Relations & rollups](https://www.notion.com/help/relations-and-rollups).

**Scelta per Spazio:** rinviati. Per implementarli servirà introdurre definizioni di database e proprietà, tipi validati, identificatori stabili dei record e un motore di calcolo. Simulare pulsanti di relazioni senza questi comportamenti non darebbe un risultato utile.

### 5. Portabilità e disponibilità dei dati

Notion permette esportazioni di pagine e workspace, tra cui Markdown e CSV. Le esportazioni non ricostituiscono automaticamente tutte le funzionalità del sistema originale: ad esempio i collegamenti relazionali esportati non ricreano le relazioni all’importazione. La documentazione offline descrive pagine scaricabili nelle applicazioni supportate e alcune limitazioni dei database.

Fonti: [Export your content](https://www.notion.com/help/export-your-content), [Use pages offline](https://www.notion.com/help/use-pages-offline), [Relations & rollups](https://www.notion.com/help/relations-and-rollups).

**Scelta per Spazio:** salvataggio automatico in localStorage, backup completo JSON, importazione JSON che aggiunge i contenuti senza sostituire quelli esistenti, esportazione del documento in Markdown e importazione semplice di singoli file `.md`. Nell’import Markdown sono riconosciuti i titoli; gli altri elementi restano testo. Non c’è importazione automatica di ZIP Notion, allegati, CSV o database relazionali. Il backup JSON è il formato per conservare integralmente i dati di Spazio.

Il salvataggio è legato all’origine web e al profilo del browser. Cancellare i dati del sito, usare un altro browser o cambiare indirizzo non trasferisce il workspace. La versione attuale non offre sincronizzazione cloud, un servizio worker per riapertura offline o garanzie di persistenza oltre quelle del browser. Una scheda già caricata consente di continuare le modifiche locali senza chiamate a un backend per i contenuti.

## Gratuità: significato e limiti

Notion dispone già di un piano gratuito; la pagina prezzi distingue funzionalità personali, opzioni per team e capacità AI. Di conseguenza l’obiettivo di questo progetto è una base indipendente senza abbonamento applicativo e senza dipendenze funzionali da API a consumo, non l’affermazione che Notion sia esclusivamente a pagamento.

Fonte: [Notion pricing](https://www.notion.com/pricing). I piani cambiano: verificare la fonte prima di confrontare prezzi o limiti commerciali.

Spazio esegue le operazioni personali nel browser e non invia pagine o attività a un server applicativo. L’hosting e l’accesso alla versione pubblicata dipendono dal servizio Sites e dalle relative condizioni; il progetto non promette hosting illimitato gratuito. La build usa font Google come miglioramento visivo, con fallback di sistema: il download dei font costituisce una richiesta esterna, senza includere il contenuto delle pagine. Il codice sorgente può essere eseguito anche localmente.

## Cosa è disponibile e cosa resta da fare

| Area | Questa versione | Estensioni necessarie per avvicinarsi a Notion |
| --- | --- | --- |
| Scrittura | Dieci tipi di blocco, slash menu, riordino | Rich text inline, tabelle nel documento, media, embed, menzioni |
| Organizzazione | Pagine, sottopagine, preferiti, ricerca, modelli, cestino | Backlink, spostamento tra pagine, gestione di workspace multipli |
| Progetti | Attività, tabella e bacheca, filtri, ordinamento | Database personalizzabili, relazioni, formule, rollup, calendario |
| Dati | Salvataggio locale, backup JSON, Markdown | IndexedDB per volumi maggiori, migrazioni, allegati, recupero versioni |
| Collaborazione | Uso personale | Account, autorizzazioni, condivisione, commenti, presenza, sincronizzazione |
| AI | Nessun servizio collegato | Integrazione opzionale con modello locale o servizio scelto dall’utente |
| Distribuzione | App web responsiva, temi chiaro/scuro | PWA offline verificata, applicazioni desktop e mobili |

## Architettura e sviluppo successivo

La prima versione usa React, TypeScript e Vinext. Le pagine contengono blocchi tipizzati; le attività alimentano due presentazioni della stessa collezione. Il workspace include una versione dello schema. L’importazione verifica tipi, identificatori duplicati, riferimenti dei genitori e cicli prima di inserire i dati; riassegna gli identificatori delle pagine importate per evitare collisioni.

Per una versione multiutente, la proposta progettuale è separare il modello dati dall’interfaccia, introdurre un database persistente e autenticazione, applicare autorizzazioni lato server e poi aggiungere sincronizzazione. L’editing simultaneo richiederebbe una strategia esplicita di conflitti, ad esempio CRDT con Yjs, da valutare e collaudare; questa è una proposta, non una funzione già presente.

L’ordine consigliato delle estensioni è: persistenza più robusta con IndexedDB e recupero versioni; editor rich text accessibile; database personalizzabili; autenticazione e backup server; sincronizzazione; collaborazione e permessi. Ogni passaggio va testato sui dati reali senza perdere la portabilità del backup. Una copia integrale di Notion, incluse le sue integrazioni e capacità aziendali, richiede un progetto molto più esteso di questa prima implementazione.
