import { useEffect, useCallback, useRef } from 'react';
import * as AWSAuth from '@aws-amplify/auth';

/**
 * Hook personalizzato per monitorare la validità della sessione di autenticazione
 * e gestire automaticamente il logout quando il token scade
 *
 * @param {Function} onSessionExpired - Callback da chiamare quando la sessione scade
 * @param {number} checkInterval - Intervallo di controllo in millisecondi (default: 5 minuti)
 */
const useAuthSessionMonitor = (onSessionExpired, checkInterval = 5 * 60 * 1000) => {
  const sessionCheckTimerRef = useRef(null);
  const isCheckingRef = useRef(false);

  const checkSessionValidity = useCallback(async () => {
    // Evita check multipli concorrenti
    if (isCheckingRef.current) {
      return true;
    }

    isCheckingRef.current = true;

    try {
      const session = await AWSAuth.fetchAuthSession();

      // Verifica se la sessione ha credenziali valide
      if (!session || !session.credentials) {
        console.warn('Session has no valid credentials');
        onSessionExpired();
        return false;
      }

      // Verifica se le credenziali sono scadute
      const now = new Date();
      if (session.credentials.expiration && new Date(session.credentials.expiration) <= now) {
        console.warn('Session credentials expired');
        onSessionExpired();
        return false;
      }

      // Sessione valida
      return true;
    } catch (error) {
      console.error('Error checking session validity:', error);

      // Verifica se l'errore è relativo alla scadenza del token
      if (isTokenExpiredError(error)) {
        console.warn('Token expired, logging out user');
        onSessionExpired();
        return false;
      }

      // Altri errori potrebbero essere temporanei, non fare logout
      return true;
    } finally {
      isCheckingRef.current = false;
    }
  }, [onSessionExpired]);

  // Avvia il monitoraggio periodico della sessione
  useEffect(() => {
    // Check iniziale
    checkSessionValidity();

    // Imposta check periodici
    sessionCheckTimerRef.current = setInterval(() => {
      checkSessionValidity();
    }, checkInterval);

    // Cleanup
    return () => {
      if (sessionCheckTimerRef.current) {
        clearInterval(sessionCheckTimerRef.current);
      }
    };
  }, [checkSessionValidity, checkInterval]);

  return { checkSessionValidity };
};

/**
 * Verifica se un errore è relativo alla scadenza del token
 * @param {Error} error - L'errore da verificare
 * @returns {boolean}
 */
export const isTokenExpiredError = (error) => {
  if (!error) return false;

  const errorString = error.toString().toLowerCase();
  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';

  // Verifica vari tipi di errori di token scaduto
  const expiredTokenIndicators = [
    'notauthorizedexception',
    'token expired',
    'expired token',
    'expiredtokenexception',
    'security token included in the request is expired',
    'the incoming token has expired',
    'access token has expired',
    'refresh token has expired',
    'invalid token',
    'token is not valid',
    'credentialserror'
  ];

  return expiredTokenIndicators.some(indicator =>
    errorString.includes(indicator) ||
    errorMessage.includes(indicator) ||
    errorName.includes(indicator)
  );
};

/**
 * Wrapper per chiamate AWS che gestisce automaticamente errori di token scaduto
 * @param {Function} awsCall - La chiamata AWS da eseguire
 * @param {Function} onTokenExpired - Callback da chiamare se il token è scaduto
 * @returns {Promise} Il risultato della chiamata AWS
 */
export const withTokenExpiryHandling = async (awsCall, onTokenExpired) => {
  try {
    return await awsCall();
  } catch (error) {
    if (isTokenExpiredError(error)) {
      console.warn('AWS call failed due to expired token:', error);
      onTokenExpired();
    }
    throw error; // Re-throw per permettere la gestione normale degli errori
  }
};

export default useAuthSessionMonitor;
