# Verifiche — 8 novembre 2026

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
