// In src/main.jsx
import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function AppWithLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Assicurati che tutte le risorse siano caricate
    if (document.readyState === 'complete') {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => {
          setLoading(false);
        }, 500);
      });
    }

    // Assicurati che localStorage sia accessibile
    try {
      // Test di accesso a localStorage
      localStorage.getItem('test');
    } catch (error) {
      console.error('LocalStorage is not available:', error);
    }

    return () => {
      window.removeEventListener('load', () => {
        setLoading(false);
      });
    };
  }, []);

  return (
    <>
      {loading && (
        <div className={`app-loading ${!loading ? 'fade-out' : ''}`}>
          <div className="spinner"></div>
          <div className="loading-text">Inizializzazione applicazione...</div>
        </div>
      )}
      <App />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithLoader />
  </StrictMode>,
)