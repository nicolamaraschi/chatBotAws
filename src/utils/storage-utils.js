// Aggiungi questa funzione in src/utils/storage-utils.js (crea il file se non esiste)

/**
 * Utility di sicurezza per accesso a localStorage
 */

export const safeStorage = {
    getItem: (key, defaultValue = null) => {
      try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
      } catch (error) {
        console.error(`Error reading ${key} from localStorage:`, error);
        return defaultValue;
      }
    },
    
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.error(`Error writing ${key} to localStorage:`, error);
        return false;
      }
    },
    
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error(`Error removing ${key} from localStorage:`, error);
        return false;
      }
    },
    
    parseJSON: (key, defaultValue = null) => {
      try {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        return JSON.parse(value);
      } catch (error) {
        console.error(`Error parsing JSON from localStorage key ${key}:`, error);
        return defaultValue;
      }
    }
  };