// Crea questo file come src/utils/chart-legend-fix.js

/**
 * Funzione che applica forzatamente lo stile corretto alle legende di Chart.js in modalità dark
 */
export const fixChartLegends = (isDarkMode = false) => {
    // Attende un po' di tempo per assicurarsi che i grafici siano stati renderizzati
    setTimeout(() => {
      // Seleziona tutte le legende nei grafici
      const legendElements = document.querySelectorAll('.chart-container span, .chart-card li span');
      
      // Applica il colore corretto in base al tema
      legendElements.forEach(element => {
        if (isDarkMode) {
          element.style.color = '#e0e0e0';
        } else {
          element.style.color = '#333333';
        }
      });
      
      console.log(`Chart.js legends fixed for ${isDarkMode ? 'dark' : 'light'} mode`);
    }, 500);
  };
  
  /**
   * Imposta un observer che controlla il cambiamento del tema e applica la correzione
   */
  export const setupChartLegendObserver = () => {
    // Controlla se siamo in modalità dark
    const checkAndFixLegends = () => {
      const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
      fixChartLegends(isDarkMode);
    };
  
    // Esegui la correzione all'avvio
    checkAndFixLegends();
    
    // Imposta un observer per rilevare i cambiamenti di tema
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          checkAndFixLegends();
        }
      });
    });
    
    // Osserva i cambiamenti dell'attributo data-theme sul body
    observer.observe(document.body, { attributes: true });
    
    return observer; // Ritorna l'observer nel caso si voglia disconnetterlo in futuro
  };