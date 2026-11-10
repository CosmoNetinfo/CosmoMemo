# Verifiche — 8 novembre 2026

## Archivio completo delle pagine · 10 novembre 2026

- Nuova vista **Tutte le pagine** dalla barra laterale e dalla home, con tutte le pagine attive e sottopagine, ricerca nel contenuto, filtri tipo/stato/preferiti, ordinamento e paginazione da 25/50/100 elementi.
- Ventitré test browser passati sulla build di produzione locale. I tre nuovi casi verificano 137 pagine, accesso all’ultima schermata e a una sottopagina oltre la profondità visibile dell’albero, conservazione della posizione dopo aver aperto un documento, ricerca/filtri/reset/ordinamento e navigazione su telefono. Consultare e filtrare l’elenco non invia scritture al workspace.
- Controllo visivo a 1440×1050 e 390×844: nessun errore JavaScript né overflow orizzontale. Build, TypeScript e controllo del bundle pubblico superati; i test usano dati simulati e non accedono alle pagine personali.

## Riepilogo read-only per Cosmo Control

- Trentanove gruppi di test applicativi passati, con nove nuovi test per `GET /api/read-only/summary`: token valido/errato/mancante, variabile assente o vuota, lettura della variabile reale dalla route Next, indipendenza dai cookie, formato Bearer, rate limit con scadenza e gestione degli errori senza dettagli riservati.
- Proiezione verificata con PostgreSQL embedded in una transazione `READ ONLY`: un’unica `SELECT`, chiavi esatte di risposta, esclusione del cestino, mapping di genitore/scadenza, conteggio dei ricordi senza chiavi/testi/tag e nessun contenuto dei blocchi.
- Workspace non inizializzato: liste vuote senza creazione del record. Nessuna query su richieste non autenticate o con endpoint disattivato; nessuna scrittura neppure per il rate limit, mantenuto in memoria per istanza.
- Build Next.js con route dinamica e controllo del bundle pubblico superati. Gli scanner delle credenziali includono `COSMOMEMO_READ_TOKEN`; il suo valore non viene impostato o salvato nei file tracciati.

## Versione 3.3.0 — data del cestino e scritture protette · 9 novembre 2026

- Trenta gruppi di test applicativi, inclusi sei nuovi: data server del cestinamento, conservazione durante modifiche, rimozione al ripristino ordinario/storico e nuova data al cestinamento successivo; migrazione idempotente e date locali.
- Verificati fallback `updated` per dati storici, ordine crescente stabile, soglia stretta e paginazione di `older_than_days`; le letture non eseguono cancellazioni né avanzano la revisione del workspace.
- `save_task` e store rifiutano collegamenti inesistenti, cestinati o di tipo errato con `invalid_input`; controllati anche parametro omesso durante aggiornamento e scollegamento esplicito.
- Riduzione di `blocks` rifiutata senza `confirm_replace:true`, anche se compensata da `append_blocks`; nessun salvataggio parziale o evento di cronologia per tentativi rifiutati.
- Client SDK MCP nuovo: discovery dei 32 strumenti e dei nuovi parametri, verifica versione 3.3.0, import/export todo Markdown, filtri/paginazione attività, filtro età del cestino, offset dei ricordi e ripristino senza `trashed_at`.
- La prova nella nuova chat dell’account Claude resta distinta dal test SDK. Il README contiene il prompt post-deploy, che non autorizza svuotamenti o eliminazioni.
- Venti test browser passati sulla build locale di produzione con API simulate, incluso cestinamento con data visualizzata e ripristino con rimozione di `trashed_at` dalla bozza. Build, TypeScript e controllo del bundle pubblico superati; nessun test accede ai documenti personali in Neon.

## Versione 3.2 — regressioni Markdown, ricerca e strumenti MCP · 9 novembre 2026

- Ventiquattro gruppi di test applicativi: riproduzione del difetto nelle checkbox con liste loose, import/export ripetuto senza prefissi duplicati, conservazione di marcatori letterali, ricerca AND tra titolo e blocchi, OR/frase, ricerca unica e filtri dei permessi.
- SDK MCP reale: riclassificazione senza modificare blocchi, lettura del progetto e attività, inserimento ancorato di blocchi, cancellazione mirata e rifiuto di revisioni obsolete; revisione dei ricordi con nome coerente, alias compatibile e rifiuto di valori discordanti.
- PostgreSQL embedded: cancellazione confermata del cestino, conflitto atomico, conservazione e scollegamento di attività e sottopagine, rimozione del contenuto delle copie storiche e conservazione delle pagine finite nel cestino dopo la selezione.
- Contesto compatto verificato con ricordi lunghi: limite della risposta serializzata, estratti e indicatori di troncamento; il cursore delle novità non supera gli eventi effettivamente restituiti.
- Diciannove test browser sulla build locale di produzione con API simulate, inclusi checkbox loose, ricerca unica per categorie e modalità, apertura del ricordo cercato, svuotamento solo dopo conferma ed errore di rete senza perdita delle pagine.

## Versione 3.1 — progetti, cronologia e novità · 9 novembre 2026

- Diciotto gruppi di test applicativi con PostgreSQL embedded e SDK MCP: proprietà delle pagine, attività collegate, integrità dei progetti anche nel controllo SQL finale, cronologia atomica, autori assegnati dal server, ripristino delle versioni precedenti, rifiuto di revisioni obsolete e assenza di eventi per operazioni fallite.
- Verificati paginazione delle novità, filtri sui permessi memoria, punti di lettura separati e persistenti, cursori monotoni e migrazioni idempotenti che conservano gli eventi.
- Sedici test browser con API simulate sulla build locale di produzione: nuovi controlli tipo/stato e progetti, cronologia con autore e anteprima prima della modifica, ripristino confermato, novità paginate con conferma di lettura, importazione backup con rimappatura dei collegamenti, oltre ai precedenti test Markdown e sincronizzazione.
- Build, TypeScript e controllo di assenza delle credenziali server nel bundle pubblico completati. I test non leggono né modificano le pagine personali in Neon.

## Versione 3.0 — flussi Claude, Markdown e revisioni per pagina

- Import/export Markdown con titoli H1–H6, liste puntate e numerate, checkbox annidate, citazioni e codice con linguaggio; verificata la riesportazione di codice contenente backtick. HTML conservato come testo e tabelle come codice Markdown con avvisi.
- Test SQL con PostgreSQL embedded: due pagine aggiornate in parallelo dalla stessa base, conservazione di modifiche remote a pagine/attività diverse, conflitto sulla medesima pagina senza salvataggi parziali, compatibilità del vecchio salvataggio globale e controllo di cicli tra spostamenti concorrenti.
- Test con SDK MCP: importazione del brief, lettura e aggiunta alla sezione, aggiornamento di una checkbox senza modificare gli altri blocchi, ricerca con riferimenti, contesto con limiti di autorizzazione, spostamento e ripristino.
- Verificato il rifiuto delle chiamate che usano il vecchio parametro di revisione sulle nuove scritture per pagina.
- Test browser con server simulato: import/export del file MD, preservazione di una pagina modificata da Claude mentre si salva un’altra dal browser, recupero della bozza dopo il riavvio e tutti i precedenti casi di sincronizzazione.
- Quattordici gruppi di test Node e dodici test browser superati nell’ambiente locale; i test non leggono né modificano i documenti personali nel database cloud.

## Icona web app — 9 novembre 2026

- Nuovo simbolo vettoriale originale, con taccuino, segnalibro e stella, verificato visivamente a 256, 128, 64, 32 e 16 pixel.
- Verificate le dimensioni PNG 32, 180, 192 e 512; sfondo opaco per Apple e Android maskable. Verificato anche il ritaglio circolare Android.
- Metadata aggiornati per favicon SVG/PNG/ICO, icona Apple e manifest con icone standard e maskable.
- Build Next.js e controllo TypeScript riusciti.

## Versione 2.1.1 — pulsante Sincronizza, 9 novembre 2026

- Nove test browser sulla build di produzione: aggiornamento di pagine ed editor, conferma senza nuove versioni, aggiornamento dei ricordi a revisione workspace invariata, salvataggio delle modifiche pendenti prima della lettura, errori 503 e sessione 401, stato di caricamento e risposta lenta, pagina eliminata da remoto, salvataggio fallito e conflitto concorrente.
- Le richieste dei test sono intercettate con risposte simulate: il database e l’account dell’utente non vengono modificati.
- Le operazioni automatiche e manuali condividono il salvataggio in corso; una risposta lenta non sostituisce modifiche locali più recenti. Errori e sessioni scadute sono visibili e le bozze vengono conservate.
- Ripetuti con successo i sei gruppi di test MCP/database, il controllo TypeScript, la build e il controllo del bundle pubblico per le credenziali server.
- Aggiunti i test browser a GitHub Actions.

## Versione 2.1 — cancellazione tramite Claude, 9 novembre 2026

- Aggiunti gli strumenti MCP `delete_page` e `delete_task`, entrambi nel permesso `pages:write` e dichiarati distruttivi.
- Test con SDK MCP e PostgreSQL embedded: pagina spostata nel cestino, contenuto conservato per il ripristino, sottopagine dirette spostate al livello principale e discendenti preservati.
- Test di cancellazione delle attività: rimozione del solo elemento richiesto, rifiuto delle revisioni obsolete, degli identificatori inesistenti e delle cancellazioni ripetute.
- Verificato che i client con sola lettura non vedano e non possano eseguire gli strumenti di cancellazione.
- Verificata anche l’eliminazione della memoria tramite `forget`.
- Sei gruppi di test superati, controllo TypeScript e build di produzione riusciti. I test non utilizzano il database personale dell’utente.

## Versione 2 — memoria Neon e Claude MCP

- Test con PostgreSQL embedded PGlite: persistenza, aggiornamenti con revisioni, conflitti e cancellazione dei ricordi.
- Test dell’SDK MCP con connessioni distinte: pagine e ricordi creati da un client risultano leggibili da quello successivo.
- Test Streamable HTTP stateless: inizializzazione e chiamate su istanze server separate.
- OAuth: controllo dei redirect, PKCE, codici monouso, verifica della risorsa, scadenze, rotazione dei refresh token, revoca e rilevamento del riutilizzo.
- Sessioni firmate, verifica password scrypt e limite ai tentativi di accesso.
- Browser Chromium contro Next.js e il nuovo database Neon: login, contenuti cloud visibili da un secondo contesto browser, consenso OAuth e scambio PKCE, scrittura di pagina e ricordo tramite MCP, aggiornamento della memoria dall’app, conflitto conservato come bozza esportabile, eliminazione e revoca effettiva del token.
- I dati di questa verifica erano temporanei e sono stati rimossi. Il proprietario dell’installazione deve ancora scegliere la propria password tramite prima attivazione.
- Il ritorno OAuth a Claude è stato intercettato dal test: non è stato collegato un account Claude reale. Il collegamento dal connettore dell’utente richiede la sua autenticazione e resta da verificare su quel client.
- La memoria è esterna al modello: nessuna verifica può garantire che Claude richiami automaticamente il connettore in ogni nuova chat.
- L’archivio usa un singolo account proprietario; non è stata implementata una piattaforma multiutente.
- Ripetuti con successo anche i flussi originali in modalità locale, con il cloud disattivato nel browser di prova.
- Build Next.js e TypeScript riusciti. Audit delle dipendenze di produzione: nessuna vulnerabilità segnalata al controllo.
- Il controllo sui file statici del bundle non ha trovato le credenziali server configurate. `.env.local` e il codice di attivazione non vengono caricati nella repository.
- Ripetuto l’intero flusso sulla build di produzione locale, inclusa la prima attivazione tramite codice e scelta della password. L’account temporaneo è stato rimosso al termine.

Le sezioni successive descrivono anche le verifiche della prima versione.

## Distribuzione GitHub / Vercel

- Conversione in Next.js standard 16.4.5, senza dipendenze dal runtime Sites/Cloudflare.
- Build di produzione `npm run build` e `npm run typecheck` riusciti.
- Audit npm dopo l’aggiornamento: zero vulnerabilità segnalate alla data del controllo.
- Gli stessi flussi browser elencati sotto sono stati ripetuti con successo sulla build di produzione Next.js avviata con `npm start`.
- La repository contiene un workflow GitHub Actions per installazione pulita, build e TypeScript con Node.js 22.
- La verifica locale è stata eseguita su Windows con Node.js 26. La verifica su Node.js 22 è affidata al workflow GitHub e non era stata eseguita localmente alla redazione di questa nota.
- La pubblicazione Vercel si effettua importando la repository: la riuscita della build locale non implica che un deployment Vercel sia già stato creato.

## Controlli funzionali

- TypeScript: controllo con tsc --noEmit riuscito.
- Build di produzione Vinext: completata.
- Browser Chromium, desktop 1440 × 1050 e mobile 390 × 844.
- Creazione e modifica di pagina; titolo e testo conservati dopo ricaricamento.
- Creazione di blocchi con Invio e conversione in titolo tramite comando /h2.
- Creazione di sottopagina, invio al cestino e ripristino.
- Ricerca di pagina attraverso il contenuto dei blocchi.
- Creazione di attività in tabella, cambio stato dalla bacheca e filtro coerente tra viste.
- Esportazione del backup JSON, verifica del suo contenuto e reimportazione senza sostituire i dati.
- Cambio tema e controllo dell’assenza di overflow orizzontale su mobile.
- Nessun errore JavaScript rilevato durante i flussi provati.

Schermate e script di verifica sono nella cartella ../qa del workspace locale. I dati creati dai test restano nel profilo di browser temporaneo e non diventano dati iniziali del prodotto.

Limiti: non è stato eseguito un audit completo di accessibilità, sicurezza o compatibilità tra browser. Trascinamento e prestazioni su workspace di grandi dimensioni richiedono ulteriori prove; i comandi su/giù e i selettori di stato offrono alternative al trascinamento. Non è stata verificata alcuna sincronizzazione perché non è implementata.
