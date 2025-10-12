import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'

function AppWithLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    try {
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
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithLoader />
  </StrictMode>,
)