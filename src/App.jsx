import React, { useState, useEffect, useCallback } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react'; // Needed for Provider and useAuthenticator
import PropTypes from 'prop-types';
import { fetchUserAttributes, getCurrentUser } from '@aws-amplify/auth'; // Import getCurrentUser
import { Amplify } from 'aws-amplify';

// Import CSS globali e specifici
import './styles/chart-fixes.css';
import '@aws-amplify/ui-react/styles.css'; // Necessario per Amplify UI
// IMPORTANTE: Importa l'override CSS DOPO gli stili di Amplify

import './App.css';
import './styles/theme.css';
import './dashboard-theme.css';
import 'react-resizable/css/styles.css';
import './styles/MobileLayout.css';
// NON importare LoginComponent.css qui se è già importato dentro LoginComponent.jsx

// Importa i componenti principali dell'applicazione
import ConfigComponent from './ConfigComponent';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import SidebarNavigation from './components/SidebarNavigation';
import BackgroundSelectorEnhanced from './pages/BackgroundSelectorEnhanced';
import LoginComponent from './components/LoginComponent'; // *** IMPORTA IL TUO LOGIN COMPONENT ***

// --- Funzione Principale App ---
function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [isBgSelectorOpen, setIsBgSelectorOpen] = useState(false);

  // Carica/Imposta configurazione Amplify all'avvio
  useEffect(() => {
    const storedConfig = localStorage.getItem('appConfig');
    let configToUse = null;

    if (!storedConfig && !isEditingConfig) {
      const defaultConfig = {
        cognito: { region: "eu-west-1", userPoolId: "eu-west-1_7WLST1Mlg", userPoolClientId: "vpscdsoro31v6hioq7e52ktkv", identityPoolId: "eu-west-1:36d062f2-d4f0-4b1d-ba60-5ce34cf991cc" },
        bedrock: { agentName: "SAPReportAnalyst", agentId: "93BV0V6G4L", agentAliasId: "TSTALIASID", region: "eu-west-1" }
      };
      localStorage.setItem('appConfig', JSON.stringify(defaultConfig));
      configToUse = defaultConfig;
      setIsConfigured(true);
      console.log("Configurazione predefinita applicata.");
    } else if (storedConfig && !isEditingConfig) {
      try {
        configToUse = JSON.parse(storedConfig);
        setIsConfigured(true);
      } catch (e) { console.error("Errore parsing config:", e); }
    }

    if (configToUse?.cognito) {
      try { 
        Amplify.configure({ 
          Auth: { Cognito: configToUse.cognito } 
        }); 
      }
      catch (e) { console.error("Errore config Amplify:", e); }
    } else if (!isEditingConfig) {
      console.warn("Configurazione Amplify non applicata.");
    }

    const storedBg = localStorage.getItem('backgroundImage');
    if (storedBg) setBackgroundImage(storedBg);
  }, [isEditingConfig]);

  // Gestione salvataggio configurazione
  const handleConfigSet = () => {
    setIsConfigured(true);
    setIsEditingConfig(false);
    window.location.reload(); // Ricarica per applicare config
  };

  // Gestione cambio sfondo
  const handleBackgroundChange = (newBg) => {
    if (newBg === undefined) {
      setIsBgSelectorOpen(true);
    } else {
      setBackgroundImage(newBg);
      localStorage.setItem('backgroundImage', newBg);
      setIsBgSelectorOpen(false);
    }
  };

  // Stile sfondo
  const backgroundStyle = backgroundImage
    ? (typeof backgroundImage === 'string' && backgroundImage.startsWith('color:')
        ? { backgroundColor: backgroundImage.substring(6) }
        : { backgroundImage: `url(${backgroundImage})` })
    : {};

  // Classe CSS per sfondo a colore
  useEffect(() => {
    document.body.classList.toggle('custom-background-color',
      !!(backgroundImage && typeof backgroundImage === 'string' && backgroundImage.startsWith('color:'))
    );
  }, [backgroundImage]);

  // Render App
  return (
    <ThemeProvider>
      <div className="app-background" style={{ ...backgroundStyle, position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {!isConfigured || isEditingConfig ? (
          <ConfigComponent
            onConfigSet={handleConfigSet}
            isEditingConfig={isEditingConfig}
            setEditingConfig={setIsEditingConfig}
          />
        ) : (
          // Provider necessario per useAuthenticator
          <Authenticator.Provider>
            <ErrorBoundary>
              <AuthenticatedComponent
                onEditConfigClick={() => setIsEditingConfig(true)}
                onBackgroundChange={handleBackgroundChange}
                isBgSelectorOpen={isBgSelectorOpen}
                setIsBgSelectorOpen={setIsBgSelectorOpen}
              />
            </ErrorBoundary>
          </Authenticator.Provider>
        )}
      </div>
    </ThemeProvider>
  );
}

// --- Componente che gestisce la logica post-configurazione ---
const AuthenticatedComponent = ({
  onEditConfigClick,
  onBackgroundChange,
  isBgSelectorOpen,
  setIsBgSelectorOpen
}) => {
  // Ottieni stato auth e funzione signOut
  const { authStatus, signOut } = useAuthenticator((context) => [
    context.authStatus,
    context.signOut,
  ]);
  // Stato per memorizzare l'utente dopo il login manuale o al caricamento
  const [userObject, setUserObject] = useState(null);

  // Stati UI
  const [userRole, setUserRole] = useState(undefined);
  const [userClientName, setUserClientName] = useState(undefined);
  // isInitializing ora traccia il caricamento degli attributi DOPO che sappiamo di essere autenticati
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [activeView, setActiveView] = useState('dashboard');
  const [isChatCollapsed, setIsChatCollapsed] = useState(true); // Se ancora necessario

  // Gestione resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle chat (se usato)
  const toggleChatCollapse = () => setIsChatCollapsed(!isChatCollapsed);

  // Carica attributi utente (ruolo, cliente)
  const loadUserAttributes = useCallback(async (currentUser) => {
    if (!currentUser?.username) {
      console.error("Tentativo di caricare attributi senza utente valido.");
      // Potrebbe essere necessario un logout o refresh se si arriva qui in uno stato inatteso
      signOut(); // Forzare logout potrebbe essere più sicuro
      return;
    }
    setIsInitializing(true); // Inizia caricamento attributi
    console.log('Inizio caricamento attributi per:', currentUser.username);
    try {
      const attributes = await fetchUserAttributes();
      console.log('Attributi Cognito caricati:', attributes);
      const role = attributes['custom:ruolo'] || 'cliente'; // Default a 'cliente'
      const clientName = attributes['custom:nomeCliente'] || null;
      setUserRole(role);
      setUserClientName(clientName);
      sessionStorage.setItem('userRole', role);
      sessionStorage.setItem('userClientName', clientName || '');
      console.log(`Attributi caricati: Ruolo=${role}, Cliente=${clientName || 'N/D'}`);
    } catch (e) {
      console.error("Errore caricamento attributi:", e);
      setUserRole('cliente'); // Fallback sicuro
      setUserClientName(null);
      sessionStorage.setItem('userRole', 'cliente');
      sessionStorage.setItem('userClientName', '');
    } finally {
      // Breve ritardo per UI
      setTimeout(() => setIsInitializing(false), 200);
      console.log('Fine caricamento attributi.');
    }
  }, [signOut]); // Dipende da signOut per il fallback

  // Callback per LoginComponent: memorizza utente e avvia caricamento attributi
  const handleLoginSuccess = useCallback((loggedInUser) => {
    console.log("handleLoginSuccess chiamato in App.jsx con:", loggedInUser);
    if (loggedInUser) {
      setUserObject(loggedInUser); // Memorizza l'utente passato da LoginComponent
      loadUserAttributes(loggedInUser); // Carica gli attributi
    } else {
      console.error("handleLoginSuccess chiamato senza utente valido!");
      // Gestisci questo caso inatteso, forse forzando un logout
      signOut();
    }
  }, [loadUserAttributes, signOut]); // Dipende da loadUserAttributes e signOut

  // Effetto per controllare lo stato all'avvio e caricare attributi se già loggato
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (authStatus === 'authenticated') {
        console.log("Stato autenticato rilevato all'avvio.");
        // Se siamo autenticati ma non abbiamo ancora userObject (es. refresh pagina)
        if (!userObject) {
          try {
            // Tentativo di recuperare l'utente corrente dalla sessione Amplify
            console.log("Recupero utente corrente...");
            const currentUser = await getCurrentUser();
            console.log("Utente corrente recuperato:", currentUser);
            setUserObject(currentUser); // Salva l'utente trovato
            loadUserAttributes(currentUser); // Carica attributi
          } catch (error) {
            // Se non riusciamo a recuperare l'utente, probabilmente la sessione non è valida
            console.error("Impossibile recuperare l'utente corrente:", error);
            signOut(); // Forza logout se la sessione sembra corrotta
            setIsInitializing(false); // Sblocca loader
          }
        } else {
           // Se userObject esiste già (probabilmente da handleLoginSuccess), non fare nulla qui
           console.log("userObject già presente, non ricarico attributi da useEffect.");
           setIsInitializing(false); // Assicurati che il loader sia spento
        }
      } else {
        // Se non siamo autenticati, resetta gli stati utente e spegni il loader
        console.log("Stato non autenticato rilevato.");
        setUserObject(null);
        setUserRole(undefined);
        setUserClientName(undefined);
        setIsInitializing(false);
      }
    };
    checkAuthStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]); // Esegui solo quando cambia lo stato di autenticazione


  // === Render Logica ===

  // 1. Mostra LoginComponent se non autenticato
  if (authStatus !== 'authenticated') {
    console.log("Rendering LoginComponent");
    return <LoginComponent onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. Mostra Loader se autenticato ma in fase di caricamento attributi
  // (isInitializing è true solo durante loadUserAttributes)
  if (isInitializing || userRole === undefined) {
    console.log("Rendering Loader (Initializing or userRole undefined)");
    return (
      <div className="centered-container" style={{ backgroundColor: 'var(--bg-gradient-dark)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '20px', fontSize: '1.2rem', color: 'white' }}>
            Caricamento dati utente...
          </p>
        </div>
      </div>
    );
  }

  // 3. Mostra Errore se qualcosa è andato storto dopo il login (userObject non valido)
  if (!userObject || !userObject.username) {
    console.error("Rendering Errore Post-Login (userObject non valido)");
     return (
       <div className="centered-container" style={{ backgroundColor: '#1f2937', color: 'white' }}>
         <div style={{ textAlign: 'center', padding: '2rem' }}>
           <h2 style={{ color: '#f87171' }}>⚠️ Errore Dati Utente</h2>
           <p style={{ color: '#d1d5db' }}>Impossibile caricare le informazioni utente. Riprova.</p>
           <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', margin: '5px', cursor: 'pointer', borderRadius: '5px', border: 'none' }}>Ricarica</button>
           <button onClick={signOut} style={{ padding: '10px 20px', margin: '5px', cursor: 'pointer', borderRadius: '5px', border: 'none' }}>Logout</button>
         </div>
       </div>
     );
  }

  // 4. Mostra Interfaccia Principale (utente loggato e dati caricati)
  console.log("Rendering SidebarNavigation con user:", userObject?.username);
  return (
    <>
      <SidebarNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        onBackgroundChange={() => onBackgroundChange(undefined)} // Apre selettore
        onLogout={signOut}
        userRole={userRole}
        userClientName={userClientName}
        isChatCollapsed={isChatCollapsed} // Passa stato
        toggleChatCollapse={toggleChatCollapse} // Passa funzione
        onConfigEditorClick={onEditConfigClick}
        user={userObject} // Passa l'utente memorizzato
        isMobile={isMobile}
      />
      {/* Modale Selettore Sfondo */}
      {isBgSelectorOpen && (
        <BackgroundSelectorEnhanced
          onBackgroundChange={onBackgroundChange} // Imposta sfondo
          onClose={() => setIsBgSelectorOpen(false)} // Chiude
        />
      )}
    </>
  );
};

// PropTypes
AuthenticatedComponent.propTypes = {
  onEditConfigClick: PropTypes.func.isRequired,
  onBackgroundChange: PropTypes.func.isRequired,
  isBgSelectorOpen: PropTypes.bool.isRequired,
  setIsBgSelectorOpen: PropTypes.func.isRequired
};

export default App;