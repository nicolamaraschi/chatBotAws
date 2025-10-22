# Gestione Scadenza Token Cognito

## Panoramica

Questa implementazione gestisce automaticamente la scadenza dei token di autenticazione AWS Cognito, reindirizzando l'utente alla pagina di login quando necessario.

## Componenti

### 1. Hook `useAuthSessionMonitor`

**File**: `src/hooks/useAuthSessionMonitor.js`

Hook React personalizzato che monitora periodicamente la validità della sessione di autenticazione.

#### Funzionalità

- **Monitoraggio periodico**: Controlla la validità della sessione ogni 5 minuti (configurabile)
- **Verifica credenziali**: Controlla se le credenziali AWS sono valide e non scadute
- **Callback automatico**: Chiama `onSessionExpired` quando rileva un token scaduto
- **Prevenzione race conditions**: Evita controlli multipli concorrenti

#### Utilizzo

```javascript
import useAuthSessionMonitor from './hooks/useAuthSessionMonitor';

const MyComponent = () => {
  const handleSessionExpired = async () => {
    await AWSAuth.signOut();
    onLogout();
  };

  // Controlla ogni 5 minuti (300000 ms)
  useAuthSessionMonitor(handleSessionExpired, 5 * 60 * 1000);
};
```

### 2. Funzione `isTokenExpiredError`

Utility function che identifica se un errore è dovuto a un token scaduto.

#### Errori rilevati

- `NotAuthorizedException`
- `Token expired`
- `ExpiredTokenException`
- `The security token included in the request is expired`
- `The incoming token has expired`
- `Access token has expired`
- `Refresh token has expired`
- `Invalid token`
- `CredentialsError`

#### Utilizzo

```javascript
import { isTokenExpiredError } from './hooks/useAuthSessionMonitor';

try {
  await awsOperation();
} catch (error) {
  if (isTokenExpiredError(error)) {
    // Gestisci token scaduto
    handleSessionExpired();
  }
}
```

### 3. Funzione `withTokenExpiryHandling`

Wrapper per chiamate AWS che gestisce automaticamente errori di token scaduto.

#### Utilizzo

```javascript
import { withTokenExpiryHandling } from './hooks/useAuthSessionMonitor';

await withTokenExpiryHandling(
  async () => {
    // La tua chiamata AWS
    return await bedrockClient.send(command);
  },
  handleSessionExpired
);
```

## Integrazione in ChatComponent

### Modifiche apportate

1. **Import hook e utilities**:
   ```javascript
   import useAuthSessionMonitor, { isTokenExpiredError } from '/src/hooks/useAuthSessionMonitor';
   ```

2. **Callback per sessione scaduta**:
   ```javascript
   const handleSessionExpired = useCallback(async () => {
     console.warn('Session expired, logging out user automatically');
     try {
       await AWSAuth.signOut();
       onLogout();
     } catch (error) {
       console.error('Error during automatic logout:', error);
       onLogout();
     }
   }, [onLogout]);
   ```

3. **Attivazione monitoraggio**:
   ```javascript
   useAuthSessionMonitor(handleSessionExpired, 5 * 60 * 1000);
   ```

4. **Gestione errori in fetchCredentials**:
   ```javascript
   catch (error) {
     console.error('Error fetching credentials:', error);
     if (isTokenExpiredError(error)) {
       handleSessionExpired();
     }
   }
   ```

5. **Gestione errori in handleSubmit**:
   ```javascript
   catch (err) {
     console.error('Error invoking agent:', err);
     if (isTokenExpiredError(err)) {
       console.warn('Request failed due to expired token, logging out user');
       handleSessionExpired();
       return;
     }
     // ... gestione altri errori
   }
   ```

## Flusso di lavoro

### Scenario 1: Token scade durante l'utilizzo

1. L'utente invia un messaggio all'agente
2. La chiamata AWS fallisce con errore di token scaduto
3. `isTokenExpiredError` rileva l'errore
4. `handleSessionExpired` viene chiamato
5. L'utente viene disconnesso e reindirizzato al login

### Scenario 2: Token scade mentre l'app è inattiva

1. Il monitoraggio periodico esegue un check ogni 5 minuti
2. `checkSessionValidity` rileva che le credenziali sono scadute
3. `handleSessionExpired` viene chiamato
4. L'utente viene disconnesso e reindirizzato al login

### Scenario 3: Token scade all'avvio dell'app

1. L'app tenta di caricare le credenziali in `fetchCredentials`
2. `AWSAuth.fetchAuthSession()` fallisce con errore di token scaduto
3. `isTokenExpiredError` rileva l'errore
4. `handleSessionExpired` viene chiamato
5. L'utente viene disconnesso e reindirizzato al login

## Configurazione

### Intervallo di controllo

Puoi modificare l'intervallo di controllo della sessione modificando il secondo parametro di `useAuthSessionMonitor`:

```javascript
// Controlla ogni 3 minuti
useAuthSessionMonitor(handleSessionExpired, 3 * 60 * 1000);

// Controlla ogni 10 minuti
useAuthSessionMonitor(handleSessionExpired, 10 * 60 * 1000);
```

**Nota**: Un intervallo troppo breve può causare troppe chiamate API. Un intervallo troppo lungo può ritardare il rilevamento della scadenza.

## Best Practices

1. **Non disabilitare il monitoraggio**: Il monitoraggio periodico è essenziale per rilevare sessioni scadute
2. **Gestire sempre gli errori**: Usa `isTokenExpiredError` in tutti i blocchi catch delle chiamate AWS
3. **Log appropriati**: I log aiutano a debuggare problemi di autenticazione
4. **Graceful logout**: Il callback `handleSessionExpired` gestisce anche errori durante il logout stesso

## Testing

Per testare la gestione della scadenza del token:

1. **Test manuale**: Modifica l'intervallo di controllo a 10 secondi e attendi
2. **Test con token manipolato**: Usa strumenti come Chrome DevTools per manipolare i token in localStorage
3. **Test di rete**: Simula errori di rete per verificare il comportamento

## Troubleshooting

### L'utente viene disconnesso troppo spesso

- Aumenta l'intervallo di controllo
- Verifica che la configurazione Cognito sia corretta
- Controlla i log della console per errori specifici

### Il token scade ma l'utente non viene disconnesso

- Verifica che `useAuthSessionMonitor` sia attivo
- Controlla che `isTokenExpiredError` rilevi correttamente gli errori
- Verifica che `handleSessionExpired` venga chiamato

### Errori durante il logout automatico

- Il callback `handleSessionExpired` include un fallback che forza il logout anche in caso di errori
- Verifica i log della console per dettagli specifici

## Riferimenti

- [AWS Amplify Auth Documentation](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
- [Amazon Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html)
- [React Hooks Documentation](https://react.dev/reference/react)
