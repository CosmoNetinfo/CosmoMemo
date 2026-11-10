# CosmoMemo · Spazio

Pagine, progetti e **memoria persistente per Claude**, con Next.js e PostgreSQL Neon. Un’app personale indipendente, ispirata al modello a blocchi di Notion.

![Anteprima della home](docs/anteprima.png)

## Cosa comprende

- Pagine e sottopagine, editor a blocchi, preferiti, ricerca, modelli e cestino.
- Archivio **Tutte le pagine** con ricerca nel contenuto, filtri, ordinamento e accesso a tutte le sottopagine.
- Attività in tabella e bacheca, filtri, priorità e scadenze.
- Modalità locale nel browser e spazio cloud personale protetto da password.
- Salvataggio in Neon e controllo delle revisioni per evitare sovrascritture tra app e Claude.
- Memoria esterna con chiavi, contenuti, tag e revisioni, modificabile ed eliminabile dall’app.
- Server MCP remoto con autorizzazione OAuth, consenso, PKCE S256, rinnovo e revoca dei token.
- Backup JSON delle pagine, esportazione Markdown ed esportazione separata dei ricordi.
- Importazione Markdown in blocchi anche tramite Claude, modifica di sezioni e singoli blocchi, ricerca nel contenuto con estratti.
- Revisioni individuali per pagine e attività, con unione delle modifiche indipendenti tra app e Claude.
- Tipo e stato delle pagine, attività collegate ai progetti, cronologia con autore e ripristino di versioni, riepilogo delle novità dall’ultima lettura.

Questa versione offre **un solo account proprietario per installazione**. Non è un servizio multiutente. I visitatori senza accesso possono usare solo le pagine locali nel proprio browser; non possono leggere il tuo archivio cloud.

## Collegare Claude web/app

1. Apri il tuo sito, ad esempio https://cosmo-memo.vercel.app/login.
2. Alla prima attivazione inserisci il codice privato predisposto dal gestore e scegli una password di almeno 12 caratteri.
3. In Claude apri **Impostazioni → Connettori → Aggiungi connettore personalizzato**.
4. Nome: **CosmoMemo**. URL remoto: `https://cosmo-memo.vercel.app/mcp` (sostituisci il dominio se usi un’altra installazione).
5. Avvia il collegamento, accedi a CosmoMemo e autorizza i permessi richiesti. Non servono client ID, client secret o chiavi API Anthropic: il client viene registrato tramite DCR.
6. Abilita il connettore nella conversazione in cui vuoi usarlo.

Se apri `/mcp` direttamente nel browser, una risposta **401** con richiesta di autorizzazione è normale. L’endpoint è riservato ai client MCP autenticati.

Il supporto dei connettori dipende dal piano e dalle impostazioni del tuo account Claude. [Documentazione ufficiale sui connettori](https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers).

### Come usare la memoria

Puoi chiedere, ad esempio:

> Consulta la memoria CosmoMemo prima di rispondere e recupera il contesto del mio progetto.
>
> Ricorda in CosmoMemo che preferisco spiegazioni concise in italiano.
>
> Crea una pagina con le decisioni di oggi e salva un riepilogo nella memoria.

La memoria **resta nel database tra conversazioni e riavvii** fino a quando la elimini. Non modifica la memoria interna di Claude e non carica automaticamente tutte le chat. Claude deve richiamare gli strumenti del connettore nelle nuove conversazioni: le istruzioni del server e il prompt `riprendi_contesto` favoriscono questo flusso, senza garantirne l’esecuzione automatica da parte del modello.

Controlla i ricordi da **Memoria di Claude**. Puoi correggerli, eliminarli o esportarli. Non usarli per password e token. La cancellazione elimina la voce dalla memoria attiva e dalla ricerca. Dalla versione 3.1 la cronologia conserva anche i valori precedenti dei ricordi modificati o eliminati, nel database privato; eventuali copie nei backup del provider seguono la sua conservazione.

### Strumenti MCP

| Strumento | Funzione |
| --- | --- |
| `get_context` | Albero, ricordi recenti autorizzati, attività aperte e novità in una chiamata |
| `search_all` | Ricerca unica in pagine, attività e ricordi autorizzati |
| `list_pages` | Cerca ed elenca le pagine |
| `read_page` | Legge contenuto e revisione individuale della pagina |
| `search_pages` | Cerca nel testo delle pagine con estratti, sezione e ID dei blocchi |
| `create_page` | Crea una pagina con blocchi |
| `create_page_from_markdown` | Trasforma il contenuto di un file MD in una pagina a blocchi |
| `export_page_markdown` | Restituisce il Markdown della pagina e il nome del file |
| `update_page` | Modifica o aggiunge blocchi; ridurre `blocks` richiede `confirm_replace:true` |
| `set_page_properties` | Riclassifica tipo e stato delle pagine senza riscrivere i blocchi |
| `get_project` | Legge il progetto e le sue attività, con conteggi e paginazione |
| `read_section` | Legge una sezione e le sue sottosezioni |
| `append_to_section` | Inserisce Markdown alla fine della sezione scelta |
| `update_block` | Modifica un blocco conservandone l’identificatore |
| `insert_block` | Inserisce un blocco prima/dopo un altro, all’inizio o in fondo |
| `delete_block` | Elimina un blocco senza modificare gli altri |
| `move_page` | Sposta una pagina sotto un’altra o al livello principale |
| `restore_page` | Ripristina una pagina dal cestino |
| `delete_page` | Sposta una pagina nel cestino; conserva le sottopagine |
| `list_trash` | Elenca il cestino dalla più vecchia, con `trashed_at` e filtro `older_than_days` |
| `empty_trash` | Elimina definitivamente le pagine selezionate e le loro copie storiche |
| `list_tasks` | Filtra per progetto, stato, priorità, area e testo; pagina con `limit`/`offset` |
| `save_task` | Crea o aggiorna un’attività |
| `delete_task` | Elimina una singola attività con controllo della revisione |
| `list_page_history` | Elenca salvataggi, autore e campi modificati di una pagina |
| `read_page_version` | Legge il contenuto prima o dopo un salvataggio |
| `restore_page_version` | Ripristina una versione storica creando un nuovo salvataggio |
| `get_changes` | Restituisce le novità dall’ultimo punto di lettura del connettore |
| `mark_changes_seen` | Registra il cursore effettivamente letto e riassunto |
| `search_memories` | Recupera ricordi completi con `limit`, `offset`, `total` e `next_offset` |
| `remember` | Crea o aggiorna un ricordo |
| `forget` | Elimina un ricordo |

I permessi OAuth distinguono lettura e scrittura di pagine e memoria. Gli strumenti non autorizzati non vengono esposti. Dalle impostazioni di CosmoMemo puoi revocare un collegamento; i relativi token vengono invalidati anche se Claude li conserva.

### Novità della versione 3.3.0

Ricarica l’app e aggiorna o ricollega il connettore: `get_context.server_version` deve essere **`3.3.0`**. Restano disponibili **32 strumenti**, elencati sopra; cambiano alcuni parametri e controlli. Non servono nuove variabili d’ambiente. Prima del deploy esegui `npm run db:migrate` per installare la gestione atomica delle date, senza modificare né svuotare i contenuti esistenti.

**Data del cestino.** Quando una pagina viene cestinata, `trashed_at` viene salvato in millisecondi Unix; nel cloud usa l’orologio di PostgreSQL, senza accettare una data arbitraria del client. Le successive modifiche a una pagina già nel cestino conservano la data originale. Il ripristino rimuove il campo, anche se avviene tramite una versione storica; un nuovo cestinamento registra una nuova data. Anche le modifiche nell’app locale mantengono questi comportamenti.

`list_trash(limit,offset,older_than_days)` restituisce `trashed_at`, ordina **dalla più vecchia** e applica il filtro prima della paginazione. `older_than_days` accetta da 0 a 36.500 giorni, anche frazionari: include solo date strettamente precedenti a `adesso - giorni × 86.400.000`. Senza filtro elenca tutto il cestino. Per pagine precedenti alla 3.3 prive di `trashed_at`, restituisce `updated` come ripiego e `trashed_at_source:"updated"`; non inventa una data di cancellazione storica. Se quella pagina viene poi modificata nel cestino, la precedente data di ripiego viene conservata in `trashed_at`. Nell’app la data stimata è segnalata.

Il filtro serve **esclusivamente a proporre a Dany quali pagine eliminare**. Non avvia alcuna cancellazione: niente scadenze automatiche, cron o pulizia periodica. `empty_trash` resta manuale, con selezione delle pagine, revisioni correnti e `confirm_permanent_deletion:true` soltanto dopo conferma esplicita di Dany. La lettura del cestino e il filtro non cambiano contenuti o revisioni.

**Progetti delle attività.** `save_task` e `lib/cloud/store.ts` verificano che `project_id` indichi una pagina esistente, fuori dal cestino e con `kind:"project"`; in caso contrario lo strumento restituisce `invalid_input`. Il controllo SQL finale protegge anche dagli aggiornamenti concorrenti. `project_id:null` scollega. Se il parametro viene omesso durante un aggiornamento, conserva il collegamento ma lo verifica comunque: un’attività collegata a un progetto ormai nel cestino deve essere scollegata prima di essere modificata. Cestinare un progetto conserva le attività già collegate e non le elimina.

**Sostituzione dei blocchi.** `update_page` con `blocks` sostituisce l’intera lista. Se la lista fornita ha meno blocchi della pagina corrente, richiede **`confirm_replace:true`**; anche `blocks:[]` richiede conferma se la pagina non è vuota. La presenza di `append_blocks` non aggira il controllo. Senza conferma restituisce `invalid_input`, indica `update_block`, `insert_block` e `append_to_section` e non salva neppure altri campi presenti nella chiamata. Con un numero uguale o maggiore di blocchi il parametro non è richiesto. La revisione deve sempre essere attuale e la cronologia conserva il contenuto sostituito.

**Filtri e paginazione.** `list_tasks` combina `project_id`, `status` (`Da iniziare`, `In corso`, `Completato`), `priority` (`Alta`, `Media`, `Bassa`), `tag` (area esatta, ignorando maiuscole/accenti), `query` (tutte le parole in titolo, area e titolo del progetto), `limit` (predefinito 100, massimo 200) e `offset`. `search_memories` aggiunge `offset` a `query` e `limit` (predefinito 30, massimo 100). Entrambi restituiscono `total` e `next_offset`; `null` indica l’ultima pagina. L’ordine dei ricordi resta data di aggiornamento decrescente, poi chiave. Anche `GET /api/trash` e `GET /api/memories` accettano i rispettivi filtri e la paginazione.

**Verifica con Claude dopo il deploy.** Aggiorna gli schemi del connettore e apri una nuova chat, poi chiedi:

> Richiama la lista degli strumenti CosmoMemo e verifica con get_context che server_version sia 3.3.0. Importa una pagina di prova Markdown con due todo separati da una riga vuota, uno aperto e uno completato, ed esportala per controllare che i marcatori non siano duplicati. Chiama list_tasks con status "In corso", priority "Alta", limit 1 e offset 0; list_trash con older_than_days 30; search_memories con limit 1 e offset 1. Riporta gli esiti. Non svuotare il cestino e non eliminare pagine.

La verifica automatica usa un nuovo client SDK MCP con discovery e gli stessi passaggi su un database di test; non equivale alla prova nell’account Claude del proprietario.

### Correzioni e strumenti della versione 3.2

Aggiorna o ricollega il connettore per scaricare i nuovi schemi; `get_context.server_version` permette di verificare la versione in uso. Tipo/stato e collegamenti ai progetti erano già supportati dalla 3.1 tramite `update_page` e `list_tasks(project_id)`; dalla 3.2 hanno strumenti dedicati più facili da individuare.

- **Checkbox Markdown:** corrette le liste con righe vuote e paragrafi multipli, in cui il parser manteneva il marcatore della checkbox anche nel testo. Ora import/export non aggiunge prefissi duplicati. Un secondo marcatore scritto intenzionalmente nel contenuto viene conservato. La correzione vale per nuove importazioni, senza riscrivere automaticamente le pagine già salvate.
- **Ricerca per parole:** `search_pages(query:"vigilant curl")` usa `mode:"all"` e trova pagine che contengono entrambe le parole, anche nel titolo e in blocchi diversi. `mode:"any"` trova almeno una parola; `mode:"phrase"` richiede la frase esatta. Il confronto è per sottostringhe, senza distinzione di maiuscole e accenti, senza stemming o ricerca semantica. `list_pages.query` e `search_memories.query` mantengono il filtro per frase dichiarato nelle descrizioni.
- **Ricerca unica:** `search_all` applica le tre modalità a pagine attive, attività (anche titolo del progetto) e ricordi autorizzati. Restituisce gruppi separati con estratti, `total` e `next_offset`; `limit` vale per ciascun gruppo. Per continuare in una categoria usa `kinds:["page"]`, `["task"]` oppure `["memory"]` con il suo `next_offset`. Un connettore con sola lettura della memoria può cercare soltanto nei ricordi. Nell’app **Cerca** mostra le tre categorie e permette di scegliere la modalità; in locale cerca in pagine e attività.
- **Revisioni coerenti per entità:** `expected_page_revision`, `expected_task_revision`, **`expected_memory_revision`**. Per `remember` e `forget` il vecchio `expected_revision` resta un alias; se entrambi i parametri dei ricordi sono forniti con valori diversi la chiamata viene rifiutata. Un nuovo ricordo usa revisione 0. Gli strumenti pagina/attività continuano a rifiutare il vecchio parametro globale, per evitare sovrascritture da schemi obsoleti.
- **Proprietà e progetti:** `set_page_properties(page_id,expected_page_revision,kind,status)` cambia soltanto i campi forniti e conserva i blocchi. `get_project(project_id,include_completed,limit,offset)` restituisce la pagina, le attività collegate, il totale e quelle completate. Nell’app le proprietà sono sotto il titolo e le attività sono visibili nella pagina di tipo Progetto.
- **Blocchi singoli:** `insert_block(page_id,expected_page_revision,block,before_block_id)` inserisce prima di un blocco. In alternativa usa `after_block_id` per inserire dopo, oppure `after_block_id:null` per l’inizio. Senza ancoraggio inserisce in fondo. `delete_block(page_id,block_id,expected_page_revision)` elimina soltanto quel blocco; anche l’ultimo può essere eliminato. Gli altri ID restano invariati e il contenuto precedente è recuperabile dalla cronologia.

#### Contesto compatto

`get_context` usa `mode:"compact"` per impostazione predefinita: massimo 20 pagine nell’albero, 5 ricordi con estratti da 240 caratteri, 10 attività e 5 novità. Il contenuto JSON è limitato a 16.000 caratteri. Con `mode:"full"` i valori predefiniti sono 100 pagine, 15 ricordi con estratti da 4.000 caratteri, 40 attività e 20 novità, entro 60.000 caratteri. Anche la modalità full resta limitata.

Puoi specificare `page_limit`, `memory_limit`, `task_limit`, `change_limit` e `max_chars` (2.000–60.000). Controlla `page_tree.truncated`, `memories_truncated`, `content_truncated`, `tasks_truncated`, `changes.has_more` e `budget_truncated`. I titoli molto lunghi sono abbreviati. Il budget può ridurre il numero di elementi rispetto ai limiti richiesti. Gli estratti dei ricordi vengono limitati già nella query SQL; per il contenuto completo usa `search_memories` con la chiave. Se il budget elimina delle novità, `next_cursor` resta sull’ultima effettivamente restituita: non vengono segnate come lette modifiche non viste.

#### Elencare e svuotare il cestino

`list_trash(limit,offset)` fornisce ID e revisioni soltanto delle pagine eliminate. Dopo conferma esplicita dell’utente, chiama `empty_trash` con `pages:[{page_id,expected_page_revision},…]` e `confirm_permanent_deletion:true`. La cancellazione è atomica, fino a 200 pagine per chiamata. Revisioni obsolete o pagine non più nel cestino fanno fallire tutto il lotto. Le pagine aggiunte al cestino dopo la selezione restano intatte.

Nell’app usa **Cestino → Svuota cestino → Conferma eliminazione definitiva**. Le sottopagine vengono conservate al livello principale; le attività vengono conservate e scollegate. Vengono rimosse dal database attivo anche le copie del contenuto di quelle pagine nella cronologia; restano i metadati degli eventi e i loro ID per mantenere validi i punti di lettura. La cancellazione non elimina copie precedentemente esportate o backup del provider. La modalità locale continua a offrire il ripristino; lo svuotamento definitivo è disponibile nel cloud.

Prima del deploy esegui `npm run db:migrate`: aggiunge la funzione di cancellazione e i relativi permessi, senza svuotare il cestino né modificare i contenuti esistenti. Non servono nuove variabili d’ambiente.

### Progetti, cronologia e novità nella versione 3.1

Ogni pagina può avere `kind`: `note` (Appunto), `idea` (Idea), `project` (Progetto); e `status`: `draft` (Bozza), `active` (In corso), `done` (Completato), `archived` (Archiviato). Le pagine precedenti senza questi campi sono mostrate come Appunto/Bozza. Modificali nelle proprietà della pagina, oppure con `create_page`, `create_page_from_markdown` e `update_page`. `list_pages` accetta filtri `kind` e `status`.

`save_task(project_id: ID)` collega un’attività a una pagina di tipo Progetto; `project_id: null` scollega e l’omissione conserva il collegamento esistente. `list_tasks(project_id: ID)` filtra le attività. Nell’app la tabella e la bacheca permettono il collegamento e la pagina del progetto mostra le sue attività. Prima di cambiare il tipo di un progetto occorre scollegare le attività. Il cestino conserva i collegamenti; le attività collegate a un progetto nel cestino devono essere scollegate prima di modificarle. I backup JSON conservano i collegamenti e l’importazione rimappa gli identificatori.

Dal menu della pagina apri **Cronologia pagina**. Ogni salvataggio cloud registra il contenuto prima e dopo, data, campi modificati e autore assegnato dal server: **Tu** per l’app, **Claude** con ID del client OAuth per il connettore. L’autore indica il canale autenticato che ha scritto, non verifica chi ha formulato materialmente il testo. La registrazione è atomica con la scrittura; errori e conflitti non generano versioni parziali. La cronologia comincia con questa migrazione: la prima modifica a una pagina esistente conserva anche il contenuto precedente. Non ricostruisce i salvataggi già avvenuti. Le modifiche soltanto locali non vengono registrate nella cronologia cloud.

Seleziona **Prima della modifica** o **Dopo la modifica**, controlla l’anteprima e conferma il ripristino. Con Claude usa `list_page_history`, `read_page_version` e `restore_page_version(page_id,event_id,side,expected_page_revision)`. Il ripristino conserva l’identificatore della pagina, avanza la sua revisione e crea un nuovo evento, mantenendo le versioni già registrate. Un genitore non più disponibile viene sostituito dal livello principale; gerarchie cicliche e collegamenti alle attività non validi vengono rifiutati.

**Cosa è cambiato** elenca pagine, attività e ricordi modificati dalla tua ultima lettura. Non azzera le novità quando apri la schermata: usa **Segna queste modifiche come lette** dopo averle consultate. Per Claude, `get_context` comprende anche `changes`; con `get_changes` puoi continuare usando `since_cursor: next_cursor` finché `has_more` è falso. Solo dopo aver letto e riassunto gli eventi richiama `mark_changes_seen(cursor: next_cursor)`. Il punto di lettura è persistente, separato tra app e ciascun client OAuth, e condiviso tra le conversazioni dello stesso connettore. Un cursore già avanzato non torna indietro. Il feed espone riepiloghi e campi cambiati, non copie complete dei documenti; i ricordi vengono omessi se manca `memory:read`.

I 32 strumenti richiedono di aggiornare o ricollegare il connettore per ricaricare gli schemi. Non servono nuove variabili d’ambiente. Prima del deploy esegui `npm run db:migrate` sul database corretto: aggiunge tabelle, trigger e funzioni senza sostituire i contenuti. Le scritture di una vecchia versione del server durante il passaggio sono etichettate **Client precedente**, senza attribuirle a te o a Claude. La cronologia resta nel database e cresce con i salvataggi; il backup JSON dell’app include lo stato corrente di pagine e attività, non la cronologia né i punti di lettura. Per trasferire anche quelli usa un backup PostgreSQL completo.

Il permesso `pages:write` include la cancellazione: `delete_page` usa il cestino, con ripristino dall’app, mentre `delete_task` elimina definitivamente l’attività. Le sottopagine dirette della pagina eliminata restano disponibili al livello principale. La memoria viene eliminata con `forget`, nel permesso `memory:write`. Tutte queste operazioni richiedono una revisione recente e sono dichiarate distruttive nei metadati MCP. Dopo un aggiornamento, se Claude mostra ancora l’elenco precedente, aggiorna o ricollega il connettore per ricaricare gli strumenti.

### Revisioni per pagina nella versione 3

Ricarica il sito e aggiorna o ricollega il connettore dopo l’aggiornamento dalla versione 2. Le scritture sulle pagine usano **`expected_page_revision`**, ottenuta da `read_page.revision` oppure `page.revision`. Le attività usano **`expected_task_revision`**, presente nell’attività letta con `list_tasks` o `get_context`. La memoria usa **`expected_memory_revision`**; `expected_revision` resta un alias compatibile soltanto per i ricordi. Il contatore `workspace_revision` serve alla sincronizzazione, non va passato come revisione di una pagina.

Le nuove chiavi distinte impediscono che un client con il vecchio schema interpreti per errore una revisione globale come revisione di una pagina. Le chiamate vecchie non conformi vengono rifiutate: occorre ricaricare gli strumenti. Le creazioni non dipendono dalla revisione di altri elementi.

Due pagine diverse possono essere aggiornate partendo dalla stessa schermata. Se due scritture toccano la **stessa pagina**, la seconda deve rileggerla prima di procedere. Lo stesso vale per sezioni e blocchi della medesima pagina. Un lotto di salvataggio dell’app è atomico: un conflitto non lascia modifiche parziali. Gli aggiornamenti concorrenti di altre pagine vengono conservati e restituiti nella risposta canonica.

Prima di pubblicare questo aggiornamento esegui nuovamente `npm run db:migrate`: aggiunge la funzione PostgreSQL di aggiornamento per elemento, senza sostituire i documenti esistenti. Gli identificatori restano invariati; gli elementi precedenti partono dalla revisione 1. Il formato dei backup resta compatibile con la versione 1 del workspace.

### Markdown, sezioni e ricerca

`create_page_from_markdown` riceve il **contenuto testuale** del file nel parametro `markdown`; il server non accede a percorsi sul computer dell’utente. Il primo titolo H1 diventa il nome della pagina, salvo titolo esplicito diverso. Sono supportati sei livelli di titoli, paragrafi, liste puntate e numerate, checkbox anche annidate, citazioni, blocchi di codice con linguaggio e divisori. I marcatori inline, come grassetto e link, vengono conservati come testo Markdown nell’editor. HTML non viene eseguito; le tabelle sono conservate come codice Markdown e segnalate negli avvisi. Limiti: 500.000 caratteri e 1.000 blocchi per importazione; resta il limite di circa 2 MB per il workspace.

L’importazione di file `.md` dall’app usa lo stesso parser. L’export è disponibile sia dal menu della pagina sia tramite `export_page_markdown`.

Per modificare una sezione, usa il titolo esatto, senza distinzione tra maiuscole e accenti. Se il titolo ricorre più volte, specifica `heading_id` oppure `occurrence` (da 1): non viene scelta una sezione ambigua. Il contenuto comprende le sottosezioni fino al titolo successivo di livello pari o superiore. `append_to_section` inserisce prima di quel confine e conserva gli ID dei blocchi già presenti. `update_block` consente anche di cambiare `checked` di un blocco Todo.

`search_pages` cerca nelle pagine attive e restituisce estratti con pagina, sezione, ID del blocco e revisione. `get_context` restituisce l’albero, i ricordi recenti e le attività aperte con limiti espliciti e indicatori di troncamento. Non aggiunge informazioni della memoria se il connettore non ha il relativo permesso di lettura.

## Neon e costi

Il database è PostgreSQL ospitato da Neon. La logica MCP non chiama API AI a consumo. Alla verifica dell’8 novembre 2026 Neon Free comprende **1 GB di database per progetto**, 100 CU-ore e 5 GB di traffico in uscita al mese per progetto. Per testo e metadati è un punto di partenza; capacità e durata effettive dipendono dai dati e dall’utilizzo.

[Prezzi Neon](https://neon.com/pricing) · [Limiti del piano Free](https://neon.com/faqs/free-plan-limits-and-quotas) · [Registrazione Neon](https://console.neon.tech/signup)

I limiti dei piani gratuiti possono sospendere le operazioni: non sono una promessa di servizio illimitato o di conservazione eterna. Conserva backup delle pagine e dei ricordi. L’hosting Vercel e l’account Claude hanno condizioni separate.

## Avvio locale

Richiede Node.js 22 e npm.

```bash
npm ci
npm run dev
```

Apri http://localhost:5173. Senza variabili d’ambiente, l’app funziona in modalità locale e l’integrazione cloud rimane disattivata.

```bash
npm test
npm run build
npm run typecheck
npm start
```

I test automatici usano PostgreSQL embedded con PGlite e l’SDK MCP. Non richiedono un account Neon e non accedono al database di produzione.

## Configurazione cloud su Vercel

1. Importa la repository in Vercel con preset **Next.js** e directory principale `.`.
2. Collega un database **Neon Free** da Storage/Marketplace. Non scegliere un piano a pagamento se vuoi mantenere il piano gratuito.
3. Imposta le variabili server elencate in `.env.example`.
4. Per applicare lo schema, scarica le variabili nel file locale ignorato `.env.local` ed esegui:

```bash
npm run db:migrate
```

5. Pubblica nuovamente dopo aver configurato le variabili.
6. Apri `/login`, inserisci il codice di attivazione e scegli la password proprietario.

| Variabile | Scopo |
| --- | --- |
| `DATABASE_URL` | Connessione PostgreSQL Neon, generata dall’integrazione Vercel. È accettata anche `POSTGRES_URL`. |
| `COSMOMEMO_APP_URL` | Origine HTTPS stabile dell’app, per esempio `https://cosmo-memo.vercel.app`. In locale: `http://localhost:5173`. |
| `COSMOMEMO_SESSION_SECRET` | Segreto casuale di almeno 32 caratteri per firmare sessioni e consenso. |
| `COSMOMEMO_SETUP_TOKEN` | Codice casuale diverso dal precedente, da consegnare privatamente al proprietario per la prima attivazione. |
| `COSMOMEMO_READ_TOKEN` | Opzionale: token server separato per il riepilogo metadati di Cosmo Control. Se assente o vuoto, l’endpoint restituisce 404. |

**Non usare il prefisso `NEXT_PUBLIC_` per questi valori.** Non inserire credenziali nella repository, negli URL MCP o nella chat. `.env.local` è escluso da Git e dagli upload Vercel.

Il file `.env.example` lascia vuoti i campi riservati: non fornisce password predefinite. Le credenziali usate dai test sono generate casualmente durante l’esecuzione e non consentono l’accesso all’app pubblicata. Per controllare i file tracciati esegui `node scripts/check-repository.mjs`; con `--history` vengono controllati anche gli oggetti raggiungibili della cronologia Git. Quando le variabili server sono disponibili localmente, il controllo confronta i file con quei valori senza stamparli. Lo stesso controllo sui file tracciati viene eseguito in GitHub Actions. È un controllo aggiuntivo, non una garanzia di rilevare qualunque tipo di segreto.

Lo script `scripts/configure-cloud.mjs` automatizza la configurazione nel progetto Vercel già collegato; richiede il percorso del CLI Vercel, un account autenticato e un URL HTTPS. Genera le chiavi senza stamparle e salva le istruzioni di attivazione nella cartella superiore al repository. Conserva i valori locali se lo riesegui: non rigenerare il segreto di sessione di un’app già in uso senza pianificare la disconnessione delle sessioni esistenti.

I deployment di anteprima non ricevono automaticamente accesso al database personale. Per provarli, usa ambiente e database isolati; non assegnare le credenziali di produzione a ogni preview.

## Cosmo Control: riepilogo di sola lettura

`GET https://cosmo-memo.vercel.app/api/read-only/summary` è un’integrazione server-to-server indipendente da login, cookie, sessioni e OAuth MCP. Richiede esclusivamente `Authorization: Bearer <token>`, confrontato con `COSMOMEMO_READ_TOKEN` mediante `crypto.timingSafeEqual` su digest SHA-256 di lunghezza fissa.

La risposta ha questa struttura:

```json
{
  "generated_at": "2026-11-09T12:00:00.000Z",
  "pages": [{"id":"page-id","title":"Progetto","kind":"project","status":"active","parent_id":null,"updated":1794225600000}],
  "tasks": [{"id":"task-id","title":"Preparare il brief","status":"In corso","priority":"Alta","project_id":"page-id","due":"2026-11-12"}],
  "memories_count": 0
}
```

Include le pagine fuori dal cestino e tutte le attività. `parent_id` deriva da `parent`, `due` da `date`; scadenze vuote e collegamenti assenti diventano `null`. Per le pagine precedenti senza tipo/stato restituisce `note`/`draft`. `updated` resta un timestamp in millisecondi, `generated_at` è una data ISO UTC. Nessun blocco, contenuto di pagina, chiave/testo/tag di ricordo o dettaglio di autenticazione viene restituito.

La proiezione avviene direttamente in un’unica query `SELECT` PostgreSQL. Non usa `snapshot()` e non inizializza il workspace: se il workspace non è ancora presente restituisce liste vuote. Non scrive su Neon, neppure per il rate limit; non richiede migrazioni.

Tutte le risposte hanno `Cache-Control: no-store`. Variabile assente o vuota: **404**; token mancante, errato o header non Bearer: **401**, anche in presenza di un cookie valido. Errori del database: **503** con messaggio generico. Non inviare il token in URL o parametri di query.

Il rate limit conserva solo contatori in memoria: dopo **10 fallimenti in una finestra di 60 secondi**, i tentativi da quella sorgente vengono bloccati fino alla scadenza, sempre con **401** e `Retry-After` in secondi. Le richieste valide non incrementano il contatore; durante il blocco anche un token corretto deve attendere la scadenza. Su Vercel la sorgente è l’IP fornito da `x-vercel-forwarded-for`; fuori da Vercel viene usato un bucket comune. La memoria è limitata e non conserva i token. Il contatore è **per istanza**, si azzera al riavvio e non è distribuito tra più istanze Vercel.

### Attivazione su Vercel

1. Genera localmente un segreto casuale distinto da password, setup token e segreto di sessione:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

2. Nel progetto **cosmo-memo**, apri **Settings → Environment Variables**, aggiungi **`COSMOMEMO_READ_TOKEN`**, incolla il segreto, seleziona **Production** e abilita **Sensitive**. Non usare `NEXT_PUBLIC_` e non aggiungerlo a Preview se non vuoi attivare l’endpoint anche lì.
3. Salva ed esegui un nuovo deploy: le modifiche alle variabili non cambiano un deployment già esistente. [Gestione variabili Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables) · [Variabili Sensitive](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
4. Conserva lo stesso token nelle variabili **server** del gestionale Cosmo Control e invialo nell’header Authorization dalle sue richieste backend. Non inserirlo nel codice frontend, nei log o nella repository.
5. Per disattivare l’integrazione, rimuovi la variabile da CosmoMemo e ridistribuisci: il percorso torna a restituire 404. Per ruotare il token, sostituisci il valore su entrambi i servizi e ridistribuiscili.

I controlli repository e bundle pubblico includono anche `COSMOMEMO_READ_TOKEN`. `.env.example` lo lascia vuoto; l’integrazione rimane disattivata finché non la configuri.

## Vedere tutte le pagine

Apri **Tutte le pagine** nella barra laterale, oppure **Vedi tutte le pagine** nella home. L’archivio mostra tutte le pagine attive e le sottopagine, anche quelle oltre la profondità visibile nell’albero laterale. Puoi cercare nel titolo e nel contenuto per parole separate, filtrare per tipo/stato/preferiti e ordinare per nome o data di modifica. Mostra il genitore di ogni sottopagina e il numero totale di risultati.

L’elenco è suddiviso in schermate da 25, 50 o 100 elementi: usa **Precedente**, **Successiva** o il selettore **Pagina** per raggiungere qualsiasi risultato. Aprendo un documento e tornando all’archivio, filtri e posizione restano conservati durante la sessione nell’app. Le pagine nel cestino restano nella sezione dedicata. Funziona sia con lo spazio cloud sia con quello locale e non richiede configurazione aggiuntiva.

## Trasferire i dati locali

Dopo l’accesso al cloud apri **Impostazioni → Pagine di questo browser → Importa nel cloud**. I dati del browser vengono conservati e copiati nel database. Ripetere l’importazione produce duplicati.

Per trasferire le pagine dal vecchio indirizzo Sites, esporta prima il backup JSON dal vecchio sito, poi importalo nel nuovo sito dopo l’accesso al cloud. L’importazione non include automaticamente i ricordi, esportabili separatamente dalla sezione Memoria di Claude.

### Modifiche contemporanee e interruzioni

Quando torni nella scheda, l’app recupera gli aggiornamenti cloud se non ci sono modifiche locali in attesa. Il pulsante **Sincronizza** salva prima le modifiche in attesa, poi aggiorna pagine e ricordi. Mostra caricamento, conferma ed eventuali errori di rete o sessione scaduta. In caso di errore puoi riprovare dal pulsante; le bozze restano nel browser. Non c’è polling continuo, per evitare di mantenere attivo il database gratuito inutilmente.

In caso di conflitto sullo stesso elemento, il salvataggio si ferma e conserva la bozza nel browser. **Esporta bozza e ricarica** scarica una copia della bozza prima di recuperare la versione cloud; puoi poi importarla e unire i contenuti. Le bozze nuove registrano anche la versione di partenza e possono essere unite automaticamente a modifiche remote di altre pagine dopo un riavvio. Le vecchie bozze prive di questa base restano protette dal controllo conservativo della revisione globale. Non è un sistema di editing collaborativo simultaneo.

## Sicurezza e gestione

- Password proprietario salvata con scrypt e sale casuale; cookie di sessione HttpOnly, SameSite e Secure in produzione.
- Controllo dell’origine sulle modifiche eseguite dal browser e limite ai tentativi di accesso.
- Token MCP memorizzati come hash, associati alla risorsa e ai permessi; accesso di un’ora e rinnovo fino a 30 giorni, con rotazione e rilevamento dei riutilizzi.
- Codici OAuth monouso di cinque minuti; redirect ammessi solo per i callback Claude dichiarati e localhost `/callback` per client compatibili.
- Lo schema non espone un’API SQL pubblica e revoca i privilegi `PUBLIC` sulle tabelle applicative.

L’operatore può ripristinare la password con `npm run owner:reset` dal proprio ambiente server configurato. Il comando invalida le sessioni e tutti i collegamenti Claude. Il codice di prima attivazione non è un meccanismo di recupero per un account già attivato.

Non è stato eseguito un audit indipendente di sicurezza. L’app resta limitata a uso personale: niente allegati, formule, relazioni personalizzabili tra database o sincronizzazione collaborativa in tempo reale.

## Struttura

L’icona di CosmoMemo è un SVG originale in `public/icons/cosmomemo.svg`. Il taccuino e la stella sono usati nella barra laterale, come favicon e nelle icone per la schermata iniziale. Per rigenerare i formati PNG, Apple e ICO esegui `node scripts/generate-icons.mjs`. Il manifest include icone 192/512 e una variante Android maskable; la variante Apple ha dimensione 180×180 e sfondo opaco.

- `app/page.tsx`, `app/globals.css`: editor e workspace.
- `app/login`, `app/oauth`, `app/mcp`: accesso personale, autorizzazione e connettore remoto.
- `app/api`: API protette per pagine, ricordi e collegamenti.
- `hooks/use-cloud-workspace.ts`: bozza locale, salvataggio con revisioni e recupero cloud.
- `components/cloud-panel.tsx`: memoria e gestione dei collegamenti.
- `components/page-properties.tsx`, `components/activity-panel.tsx`: proprietà, attività collegate, cronologia e novità.
- `lib/cloud/history.ts`, `app/api/history`, `app/api/changes`: versioni e punti di lettura autenticati.
- `lib/cloud`: database, sicurezza, OAuth e strumenti MCP.
- `lib/markdown.ts`, `lib/page-content.ts`: conversione Markdown, sezioni, contesto e ricerca.
- `lib/workspace-changes.ts`: differenze per elemento e unione delle modifiche locali con la risposta cloud.
- `db/schema.sql`: schema PostgreSQL idempotente.
- `db/migrations`: scritture per elemento, cronologia atomica, integrità dei progetti e relativi permessi.
- `tests/cloud.test.ts`: test di persistenza, conflitti, OAuth e protocollo MCP.
- [RICERCA.md](RICERCA.md): ricerca originale, riferita alla prima versione.
- [VERIFICHE.md](VERIFICHE.md): controlli e limiti di verifica.

GitHub Actions esegue test, build, TypeScript e test browser della sincronizzazione a ogni push e pull request. Per eseguire i test browser localmente, installa Chromium con `npx playwright install chromium`, compila con `npm run build` ed esegui `npm run test:browser`. I test browser usano risposte cloud simulate e non toccano il database personale. Il progetto non è affiliato a Notion o Anthropic. Le dipendenze mantengono le rispettive licenze.
