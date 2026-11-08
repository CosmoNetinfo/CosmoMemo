# Verifiche — 8 novembre 2026

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
