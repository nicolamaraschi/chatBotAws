/**
 * Funzioni di utility per gestire il tema dell'applicazione
 */

/**
 * Applica il tema corrente a tutto il documento
 * @param {string} theme - 'light' o 'dark'
 */
export const applyThemeToDocument = (theme) => {
    // Imposta il data-theme sull'elemento body
    document.body.dataset.theme = theme;
    
    // Aggiorna le classi per il Cloudscape Design System
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('awsui-dark-mode');
      root.classList.remove('awsui-light-mode');
    } else {
      root.classList.add('awsui-light-mode');
      root.classList.remove('awsui-dark-mode');
    }
  };
  
  /**
   * Rileva il tema preferito dal sistema dell'utente
   * @returns {string} - 'dark' o 'light' in base alle preferenze di sistema
   */
  export const detectPreferredTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };
  
  /**
   * Inizializza il tema basandosi su localStorage con fallback alle preferenze di sistema
   * @returns {string} - Il tema iniziale ('dark' o 'light')
   */
  export const initializeTheme = () => {
    // Controlla se esiste già un tema salvato
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'light' || savedTheme === 'dark') {
      // Se esiste un tema salvato, usalo
      applyThemeToDocument(savedTheme);
      return savedTheme;
    } else {
      // Altrimenti, rileva il tema preferito dal sistema e salvalo
      const systemTheme = detectPreferredTheme();
      localStorage.setItem('theme', systemTheme);
      applyThemeToDocument(systemTheme);
      return systemTheme;
    }
  };
  
  /**
   * Salva il tema in localStorage e lo applica al documento
   * @param {string} theme - 'light' o 'dark' 
   */
  export const persistAndApplyTheme = (theme) => {
    localStorage.setItem('theme', theme);
    applyThemeToDocument(theme);
  };