// src/services/cache-service.js
import axios from 'axios';
import { API_URL } from '../config';

class CacheService { 
  constructor() {
    // Chiavi per i dati in localStorage
    this.CACHE_KEYS = {
      CLIENTS: 'sap_dashboard_clients',
      SID_PREFIX: 'sap_dashboard_sid_', // Prefisso per i SID di ogni cliente
    };

    // Tempo di scadenza della cache in millisecondi (24 ore)
    this.CACHE_EXPIRATION = 24 * 60 * 60 * 1000;
    
    // Stato interno per evitare chiamate duplicate durante il caricamento
    this.loadingClients = false;
    this.loadingSids = {};
  }

  /**
   * Controlla se i dati nella cache sono ancora validi
   * @param {Object} cachedData - Dati salvati nella cache con timestamp
   * @returns {Boolean} - true se i dati sono validi, false altrimenti
   */
  isValidCache(cachedData) {
    if (!cachedData || !cachedData.timestamp) {
      return false;
    }
    
    const now = Date.now();
    return (now - cachedData.timestamp) < this.CACHE_EXPIRATION;
  }

  /**
   * Ottiene la lista dei clienti, prima dalla cache e poi da Athena se necessario
   * @returns {Promise<Array>} - Lista dei clienti
   */
  async getClients() {
    // Controlla se i dati sono già in cache
    const cachedClients = localStorage.getItem(this.CACHE_KEYS.CLIENTS);
    
    if (cachedClients) {
      try {
        const parsedCache = JSON.parse(cachedClients);
        
        // Se la cache è ancora valida, usa quella
        if (this.isValidCache(parsedCache)) {
          console.log('🔄 Usando clienti dalla cache localStorage');
          return parsedCache.data;
        }
      } catch (err) {
        console.error('Errore nel parsing della cache clienti:', err);
      }
    }
    
    // Evita chiamate duplicate
    if (this.loadingClients) {
      // Attendi fino a quando i dati non sono disponibili
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          const freshCache = localStorage.getItem(this.CACHE_KEYS.CLIENTS);
          if (freshCache && !this.loadingClients) {
            clearInterval(checkInterval);
            try {
              const parsedCache = JSON.parse(freshCache);
              resolve(parsedCache.data);
            } catch (err) {
              console.error('Errore nel parsing della cache clienti:', err);
              resolve([]);
            }
          }
        }, 100);
      });
    }
    
    // Se non in cache o cache scaduta, carica da Athena
    this.loadingClients = true;
    
    try {
      console.log('📡 Caricando clienti da Athena...');
      
      // Chiamata all'API
      const response = await axios.get(`${API_URL}/sap/clients`);
      
      if (response.status === 200 && response.data) {
        // Salva in cache con timestamp
        const cacheData = {
          timestamp: Date.now(),
          data: response.data
        };
        
        localStorage.setItem(this.CACHE_KEYS.CLIENTS, JSON.stringify(cacheData));
        this.loadingClients = false;
        return response.data;
      } else {
        throw new Error('Risposta API non valida');
      }
    } catch (err) {
      console.error('Errore nel recupero clienti:', err);
      this.loadingClients = false;
      return [];
    }
  }

  /**
   * Ottiene la lista dei SID per un cliente specifico
   * @param {string} clientName - Nome del cliente
   * @returns {Promise<Array>} - Lista dei SID per il cliente
   */
  async getSidsForClient(clientName) {
    if (!clientName) {
      console.error('Nome cliente non specificato');
      return [];
    }
    
    const cacheKey = `${this.CACHE_KEYS.SID_PREFIX}${clientName}`;
    
    // Controlla se i dati sono già in cache
    const cachedSids = localStorage.getItem(cacheKey);
    
    if (cachedSids) {
      try {
        const parsedCache = JSON.parse(cachedSids);
        
        // Se la cache è ancora valida, usa quella
        if (this.isValidCache(parsedCache)) {
          console.log(`🔄 Usando SID per ${clientName} dalla cache localStorage`);
          return parsedCache.data;
        }
      } catch (err) {
        console.error(`Errore nel parsing della cache SID per ${clientName}:`, err);
      }
    }
    
    // Evita chiamate duplicate
    if (this.loadingSids[clientName]) {
      // Attendi fino a quando i dati non sono disponibili
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          const freshCache = localStorage.getItem(cacheKey);
          if (freshCache && !this.loadingSids[clientName]) {
            clearInterval(checkInterval);
            try {
              const parsedCache = JSON.parse(freshCache);
              resolve(parsedCache.data);
            } catch (err) {
              console.error(`Errore nel parsing della cache SID per ${clientName}:`, err);
              resolve([]);
            }
          }
        }, 100);
      });
    }
    
    // Se non in cache o cache scaduta, carica da Athena
    this.loadingSids[clientName] = true;
    
    try {
      console.log(`📡 Caricando SID per ${clientName} da Athena...`);
      
      // MODIFICA QUI: Usa clientName invece di cliente nel parametro della query
      const response = await axios.get(`${API_URL}/sap/sids`, {
        params: { clientName: clientName }
      });
      
      if (response.status === 200 && response.data) {
        // Salva in cache con timestamp
        const cacheData = {
          timestamp: Date.now(),
          data: response.data
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        this.loadingSids[clientName] = false;
        return response.data;
      } else {
        throw new Error('Risposta API non valida');
      }
    } catch (err) {
      console.error(`Errore nel recupero SID per ${clientName}:`, err);
      this.loadingSids[clientName] = false;
      return [];
    }
  }

  /**
   * Pulisce la cache per un cliente specifico
   * @param {string} clientName - Nome del cliente (opzionale)
   */
  clearClientCache(clientName = null) {
    if (clientName) {
      // Pulisce solo la cache per il cliente specificato
      const cacheKey = `${this.CACHE_KEYS.SID_PREFIX}${clientName}`;
      localStorage.removeItem(cacheKey);
      console.log(`🧹 Cache pulita per il cliente: ${clientName}`);
    } else {
      // Pulisce la cache di tutti i client
      localStorage.removeItem(this.CACHE_KEYS.CLIENTS);
      console.log('🧹 Cache clienti pulita');
    }
  }

  /**
   * Pulisce tutta la cache
   */
  clearAllCache() {
    // Pulisce clienti
    localStorage.removeItem(this.CACHE_KEYS.CLIENTS);
    
    // Cerca tutte le chiavi che iniziano con il prefisso SID e le rimuove
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_KEYS.SID_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    
    console.log('🧹 Tutta la cache pulita');
  }
}

// Esporta un'istanza singleton del servizio
export const cacheService = new CacheService();