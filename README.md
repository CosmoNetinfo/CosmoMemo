# CosmoMemo · Spazio

Pagine, progetti e **memoria persistente per Claude**, con Next.js e PostgreSQL Neon. Un’app personale indipendente, ispirata al modello a blocchi di Notion.

![Anteprima della home](docs/anteprima.png)

## Cosa comprende

- Pagine e sottopagine, editor a blocchi, preferiti, ricerca, modelli e cestino.
- Attività in tabella e bacheca, filtri, priorità e scadenze.
- Modalità locale nel browser e spazio cloud personale protetto da password.
- Salvataggio in Neon e controllo delle revisioni per evitare sovrascritture tra app e Claude.
- Memoria esterna con chiavi, contenuti, tag e revisioni, modificabile ed eliminabile dall’app.
- Server MCP remoto con autorizzazione OAuth, consenso, PKCE S256, rinnovo e revoca dei token.
- Backup JSON delle pagine, esportazione Markdown ed esportazione separata dei ricordi.

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

Controlla i ricordi da **Memoria di Claude**. Puoi correggerli, eliminarli o esportarli. Non usarli per password e token. La cancellazione dall’app elimina la voce dal database attivo; eventuali copie nei backup del provider seguono la sua conservazione.

### Strumenti MCP

| Strumento | Funzione |
| --- | --- |
| `list_pages` | Cerca ed elenca le pagine |
| `read_page` | Legge contenuto e revisione |
| `create_page` | Crea una pagina con blocchi |
| `update_page` | Modifica o aggiunge blocchi con controllo della revisione |
| `delete_page` | Sposta una pagina nel cestino; conserva le sottopagine |
| `list_tasks` | Legge le attività |
| `save_task` | Crea o aggiorna un’attività |
| `delete_task` | Elimina una singola attività con controllo della revisione |
| `search_memories` | Recupera i ricordi pertinenti |
| `remember` | Crea o aggiorna un ricordo |
| `forget` | Elimina un ricordo |

I permessi OAuth distinguono lettura e scrittura di pagine e memoria. Gli strumenti non autorizzati non vengono esposti. Dalle impostazioni di CosmoMemo puoi revocare un collegamento; i relativi token vengono invalidati anche se Claude li conserva.

Il permesso `pages:write` include la cancellazione: `delete_page` usa il cestino, con ripristino dall’app, mentre `delete_task` elimina definitivamente l’attività. Le sottopagine dirette della pagina eliminata restano disponibili al livello principale. La memoria viene eliminata con `forget`, nel permesso `memory:write`. Tutte queste operazioni richiedono una revisione recente e sono dichiarate distruttive nei metadati MCP. Dopo un aggiornamento, se Claude mostra ancora l’elenco precedente, aggiorna o ricollega il connettore per ricaricare gli strumenti.

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

**Non usare il prefisso `NEXT_PUBLIC_` per questi valori.** Non inserire credenziali nella repository, negli URL MCP o nella chat. `.env.local` è escluso da Git e dagli upload Vercel.

Il file `.env.example` lascia vuoti i campi riservati: non fornisce password predefinite. Le credenziali usate dai test sono generate casualmente durante l’esecuzione e non consentono l’accesso all’app pubblicata. Per controllare i file tracciati esegui `node scripts/check-repository.mjs`; con `--history` vengono controllati anche gli oggetti raggiungibili della cronologia Git. Quando le variabili server sono disponibili localmente, il controllo confronta i file con quei valori senza stamparli. Lo stesso controllo sui file tracciati viene eseguito in GitHub Actions. È un controllo aggiuntivo, non una garanzia di rilevare qualunque tipo di segreto.

Lo script `scripts/configure-cloud.mjs` automatizza la configurazione nel progetto Vercel già collegato; richiede il percorso del CLI Vercel, un account autenticato e un URL HTTPS. Genera le chiavi senza stamparle e salva le istruzioni di attivazione nella cartella superiore al repository. Conserva i valori locali se lo riesegui: non rigenerare il segreto di sessione di un’app già in uso senza pianificare la disconnessione delle sessioni esistenti.

I deployment di anteprima non ricevono automaticamente accesso al database personale. Per provarli, usa ambiente e database isolati; non assegnare le credenziali di produzione a ogni preview.

## Trasferire i dati locali

Dopo l’accesso al cloud apri **Impostazioni → Pagine di questo browser → Importa nel cloud**. I dati del browser vengono conservati e copiati nel database. Ripetere l’importazione produce duplicati.

Per trasferire le pagine dal vecchio indirizzo Sites, esporta prima il backup JSON dal vecchio sito, poi importalo nel nuovo sito dopo l’accesso al cloud. L’importazione non include automaticamente i ricordi, esportabili separatamente dalla sezione Memoria di Claude.

### Modifiche contemporanee e interruzioni

Quando torni nella scheda, l’app recupera gli aggiornamenti cloud se non ci sono modifiche locali in attesa. Il pulsante **Sincronizza** salva prima le modifiche in attesa, poi aggiorna pagine e ricordi. Mostra caricamento, conferma ed eventuali errori di rete o sessione scaduta. In caso di errore puoi riprovare dal pulsante; le bozze restano nel browser. Non c’è polling continuo, per evitare di mantenere attivo il database gratuito inutilmente.

In caso di conflitto, il salvataggio si ferma e conserva la bozza nel browser. **Esporta bozza e ricarica** scarica una copia della bozza prima di recuperare la versione cloud; puoi poi importarla e unire i contenuti. Non è un sistema di editing collaborativo simultaneo.

## Sicurezza e gestione

- Password proprietario salvata con scrypt e sale casuale; cookie di sessione HttpOnly, SameSite e Secure in produzione.
- Controllo dell’origine sulle modifiche eseguite dal browser e limite ai tentativi di accesso.
- Token MCP memorizzati come hash, associati alla risorsa e ai permessi; accesso di un’ora e rinnovo fino a 30 giorni, con rotazione e rilevamento dei riutilizzi.
- Codici OAuth monouso di cinque minuti; redirect ammessi solo per i callback Claude dichiarati e localhost `/callback` per client compatibili.
- Lo schema non espone un’API SQL pubblica e revoca i privilegi `PUBLIC` sulle tabelle applicative.

L’operatore può ripristinare la password con `npm run owner:reset` dal proprio ambiente server configurato. Il comando invalida le sessioni e tutti i collegamenti Claude. Il codice di prima attivazione non è un meccanismo di recupero per un account già attivato.

Non è stato eseguito un audit indipendente di sicurezza. La prima versione resta limitata a uso personale: niente allegati, formule, relazioni, database personalizzabili o sincronizzazione collaborativa in tempo reale.

## Struttura

L’icona di CosmoMemo è un SVG originale in `public/icons/cosmomemo.svg`. Il taccuino e la stella sono usati nella barra laterale, come favicon e nelle icone per la schermata iniziale. Per rigenerare i formati PNG, Apple e ICO esegui `node scripts/generate-icons.mjs`. Il manifest include icone 192/512 e una variante Android maskable; la variante Apple ha dimensione 180×180 e sfondo opaco.

- `app/page.tsx`, `app/globals.css`: editor e workspace.
- `app/login`, `app/oauth`, `app/mcp`: accesso personale, autorizzazione e connettore remoto.
- `app/api`: API protette per pagine, ricordi e collegamenti.
- `hooks/use-cloud-workspace.ts`: bozza locale, salvataggio con revisioni e recupero cloud.
- `components/cloud-panel.tsx`: memoria e gestione dei collegamenti.
- `lib/cloud`: database, sicurezza, OAuth e strumenti MCP.
- `db/schema.sql`: schema PostgreSQL idempotente.
- `tests/cloud.test.ts`: test di persistenza, conflitti, OAuth e protocollo MCP.
- [RICERCA.md](RICERCA.md): ricerca originale, riferita alla prima versione.
- [VERIFICHE.md](VERIFICHE.md): controlli e limiti di verifica.

GitHub Actions esegue test, build, TypeScript e test browser della sincronizzazione a ogni push e pull request. Per eseguire i test browser localmente, installa Chromium con `npx playwright install chromium`, compila con `npm run build` ed esegui `npm run test:browser`. I test browser usano risposte cloud simulate e non toccano il database personale. Il progetto non è affiliato a Notion o Anthropic. Le dipendenze mantengono le rispettive licenze.
